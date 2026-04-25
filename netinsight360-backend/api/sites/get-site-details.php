<?php
/**
 * NetInsight 360 - API: Détails d'un site
 *
 * Retourne toutes les informations d'un site ainsi que :
 *  - les derniers KPIs (kpis_ran) avec le KPI dégradant (worst_kpi_name / worst_kpi_value)
 *  - les coordonnées GPS (priorité sites.latitude, fallback site_mapping)
 *
 * Le KPI dégradant est affiché dans le modal "Détails du site" côté frontend.
 */

require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/thresholds.php';

try {
    $pdo = Database::getLocalConnection();
    $thresholds = require __DIR__ . '/../../config/thresholds.php';

    // Mapping entre libellés KPI stockés (worst_kpi_name) et clés de seuils métier.
    // Cette table permet d'exposer un seuil de référence dans la modale frontend.
    $kpiLabelToThresholdKey = [
        // 2G
        'Disponibilité TCH' => 'TCH_Availability',
        'Taux de chute appel' => 'TCH_Drop_Rate',
        'Succès Handover' => 'Handover_SR',
        'SDCCH Congestion' => 'SDCCH_Cong',
        'SDCCH Chute' => 'SDCCH_Drop',
        'Taux établissement appel' => 'CSSR',
        'Taux congestion TCH' => 'TCH_Cong_Rate',
        'Accessibilité RNA 2G' => 'RNA',

        // 3G
        'RRC CS SR' => 'RRC_CS_SR',
        'RAB CS SR' => 'RAB_CS_SR',
        'RRC PS SR' => 'RRC_PS_SR',
        'Chute CS' => 'CS_Drop_Rate',
        'Soft HO' => 'Soft_HO_Rate',
        'Taux établissement CS' => 'CSSR_CS_SR',
        'Taux établissement PS' => 'CSSR_PS_SR',
        'Chute PS' => 'PS_Drop_Rate',

        // 4G
        'S1 SR' => 'LTE_S1_SR',
        'RRC SR' => 'LTE_RRC_SR',
        'ERAB SR' => 'LTE_ERAB_SR',
        'Session SR' => 'LTE_Session_SR',
        'CSFB SR' => 'LTE_CSFB_SR',
        'Chute ERAB' => 'LTE_ERAB_Drop',
        'HO Intra-freq' => 'LTE_Intra_Freq_SR',
        'HO Inter-freq' => 'LTE_Inter_Freq_SR',
    ];

    $siteId = $_GET['id'] ?? '';
    if (empty($siteId)) {
        echo json_encode(['success' => false, 'error' => 'ID du site requis']);
        exit;
    }

    // --- Informations du site ---
    // Coordonnées : priorité sites.latitude (peuplée par import depuis sites_database)
    // Fallback : site_mapping si sites.latitude = 0
    $stmt = $pdo->prepare("
        SELECT
            s.id, s.name, s.country_code, s.vendor, s.technology, s.domain,
            s.kpi_global, s.status, s.region, s.localite,
            COALESCE(NULLIF(s.latitude,  0), NULLIF(sm.latitude,  0), 0) AS latitude,
            COALESCE(NULLIF(s.longitude, 0), NULLIF(sm.longitude, 0), 0) AS longitude
        FROM sites s
        LEFT JOIN site_mapping sm ON sm.remote_id = s.id
        WHERE s.id = ?
        LIMIT 1
    ");
    $stmt->execute([$siteId]);
    $site = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$site) {
        echo json_encode(['success' => false, 'error' => 'Site non trouvé']);
        exit;
    }

    // --- Nom du pays ---
    $cStmt = $pdo->prepare("SELECT country_name FROM countries WHERE country_code = ?");
    $cStmt->execute([$site['country_code']]);
    $country = $cStmt->fetch(PDO::FETCH_ASSOC);
    $site['country_name'] = $country['country_name'] ?? $site['country_code'];

    // --- Derniers KPIs (une ligne par technologie) ---
    // On trie par kpi_date DESC puis kpi_global ASC pour avoir le pire en premier
    $kpiStmt = $pdo->prepare("
        SELECT
            technology,
            kpi_date,
            kpi_global,
            status,
            worst_kpi_name,
            worst_kpi_value,
            imported_at
        FROM kpis_ran
        WHERE site_id = ?
        ORDER BY kpi_date DESC, kpi_global ASC
        LIMIT 10
    ");
    $kpiStmt->execute([$siteId]);
    $kpiRows = $kpiStmt->fetchAll(PDO::FETCH_ASSOC);

    // KPI le plus récent (toutes technos confondues)
    $latestKpi = $kpiRows[0] ?? null;

    // KPI dégradant global : ligne avec le kpi_global le plus bas du jour
    $worstKpi = null;
    foreach ($kpiRows as $row) {
        if ($row['kpi_date'] === date('Y-m-d')) {
            if ($worstKpi === null || floatval($row['kpi_global']) < floatval($worstKpi['kpi_global'])) {
                $worstKpi = $row;
            }
        }
    }

    // Typage numérique
    $site['latitude']   = floatval($site['latitude']);
    $site['longitude']  = floatval($site['longitude']);
    $site['kpi_global'] = round(floatval($site['kpi_global']), 2);

    // Construire le tableau de KPIs par technologie (le plus récent par techno)
    $kpiByTech = [];
    foreach ($kpiRows as $row) {
        $tech = $row['technology'];
        if (!isset($kpiByTech[$tech])) {
            $worstKpiName = $row['worst_kpi_name'];
            $worstKpiValue = isset($row['worst_kpi_value']) ? round(floatval($row['worst_kpi_value']), 2) : null;

            // Injecter les seuils du KPI dégradant pour expliciter la gravité côté UI.
            $thresholdTarget = null;
            $thresholdWarning = null;
            $thresholdCritical = null;
            $higherIsBetter = null;
            $gapToTarget = null;

            $thresholdKey = $kpiLabelToThresholdKey[$worstKpiName] ?? null;
            if ($thresholdKey !== null && isset($thresholds[$tech][$thresholdKey])) {
                $thresholdMeta = $thresholds[$tech][$thresholdKey];
                $thresholdTarget = isset($thresholdMeta['target']) ? floatval($thresholdMeta['target']) : null;
                $thresholdWarning = isset($thresholdMeta['warning']) ? floatval($thresholdMeta['warning']) : null;
                $thresholdCritical = isset($thresholdMeta['critical']) ? floatval($thresholdMeta['critical']) : null;
                $higherIsBetter = isset($thresholdMeta['higher_is_better']) ? (bool)$thresholdMeta['higher_is_better'] : null;

                if ($thresholdTarget !== null && $worstKpiValue !== null && $higherIsBetter !== null) {
                    // Convention: gap < 0 => KPI en écart défavorable par rapport à la cible.
                    $gapToTarget = $higherIsBetter
                        ? round($worstKpiValue - $thresholdTarget, 2)
                        : round($thresholdTarget - $worstKpiValue, 2);
                }
            }

            $kpiByTech[$tech] = [
                'technology'      => $tech,
                'kpi_date'        => $row['kpi_date'],
                'kpi_global'      => round(floatval($row['kpi_global']), 2),
                'status'          => $row['status'],
                'worst_kpi_name'  => $worstKpiName,
                'worst_kpi_value' => $worstKpiValue,
                'worst_kpi_threshold_target' => $thresholdTarget,
                'worst_kpi_threshold_warning' => $thresholdWarning,
                'worst_kpi_threshold_critical' => $thresholdCritical,
                'worst_kpi_higher_is_better' => $higherIsBetter,
                'worst_kpi_gap_to_target' => $gapToTarget,
            ];
        }
    }

    $kpisByTech = array_values($kpiByTech);

    // Harmoniser l'ordre d'affichage: incidents d'abord, puis KPI global croissant.
    $severityOrder = ['critical' => 0, 'warning' => 1, 'good' => 2];
    usort($kpisByTech, function ($a, $b) use ($severityOrder) {
        $sa = $severityOrder[$a['status']] ?? 3;
        $sb = $severityOrder[$b['status']] ?? 3;
        if ($sa !== $sb) return $sa <=> $sb;
        return floatval($a['kpi_global']) <=> floatval($b['kpi_global']);
    });

    $incident = $kpisByTech[0] ?? null;

    // KPI global effectif de la fiche: moyenne des technos visibles (évite les 0 incohérents du champ sites.kpi_global).
    $effectiveKpiGlobal = round(floatval($site['kpi_global']), 2);
    if (count($kpisByTech) > 0) {
        $sum = 0.0;
        foreach ($kpisByTech as $t) {
            $sum += floatval($t['kpi_global']);
        }
        $effectiveKpiGlobal = round($sum / count($kpisByTech), 2);
    } elseif ($latestKpi && isset($latestKpi['kpi_global'])) {
        $effectiveKpiGlobal = round(floatval($latestKpi['kpi_global']), 2);
    }

    $effectiveStatus = $incident['status'] ?? $site['status'];

    $site['latest_kpis']   = $latestKpi;
    $site['worst_kpi']     = $worstKpi;
    $site['kpis_by_tech']  = $kpisByTech;
    $site['effective_kpi_global'] = $effectiveKpiGlobal;
    $site['effective_status'] = $effectiveStatus;
    $site['incident'] = $incident ? [
        'technology' => $incident['technology'],
        'status' => $incident['status'],
        'worst_kpi_name' => $incident['worst_kpi_name'],
        'worst_kpi_value' => $incident['worst_kpi_value'],
        'worst_kpi_threshold_target' => $incident['worst_kpi_threshold_target'],
        'worst_kpi_gap_to_target' => $incident['worst_kpi_gap_to_target'],
        'kpi_global' => $incident['kpi_global'],
    ] : null;

    echo json_encode(['success' => true, 'data' => $site]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
