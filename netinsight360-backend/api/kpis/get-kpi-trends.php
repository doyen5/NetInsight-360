<?php
/**
 * NetInsight 360 - API: Tendance d'un KPI pour un site donné
 *
 * Paramètres GET :
 *   site_id  : identifiant du site
 *   kpi_name : nom de la colonne KPI (ex: RNA, CSSR, ERAB_SR)
 *   days     : nombre de jours (5-30, défaut 7)
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo        = Database::getLocalConnection();
    $siteId     = $_GET['site_id']     ?? '';
    $kpiName    = $_GET['kpi_name']    ?? 'RNA';
    $requestedKpi = $kpiName;
    $technology = $_GET['technology']  ?? null;
    $days       = max(5, min(30, intval($_GET['days'] ?? 7)));

    if (empty($siteId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'site_id requis']);
        exit;
    }

    // Validation du nom de KPI contre injection (whitelist colonnes réelles de kpis_ran)
    $allowed = [
        'kpi_global',
        // 2G
        'tch_availability', 'tch_drop_rate', 'handover_sr_2g', 'sdcch_cong', 'sdcch_drop',
        'cssr_2g', 'tch_cong_rate', 'rna_2g',
        // 3G
        'rrc_cs_sr', 'rab_cs_sr', 'rrc_ps_sr', 'cs_drop_rate', 'soft_ho_rate',
        'cssr_cs_sr', 'cssr_ps_sr', 'ps_drop_rate',
        // 4G
        'lte_s1_sr', 'lte_rrc_sr', 'lte_erab_sr', 'lte_session_sr', 'lte_csfb_sr',
        'lte_erab_drop_rate', 'lte_intra_freq_sr', 'lte_inter_freq_sr',
    ];
    if (!in_array($kpiName, $allowed, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'kpi_name invalide']);
        exit;
    }

    // Récupérer les N timestamps réels (date + heure quand disponible) pour ce site
    // On filtre par technologie si fournie, afin d'éviter des points sans données pour cette techno
    $techFilter = $technology ? 'AND technology = ?' : '';
    $stmtDates  = $pdo->prepare(
        "SELECT DISTINCT kpi_date, kpi_hour
         FROM kpis_ran
         WHERE site_id = ? $techFilter
         ORDER BY kpi_date DESC, kpi_hour DESC
         LIMIT ?"
    );
    $dateParams = $technology ? [$siteId, $technology, $days] : [$siteId, $days];
    $stmtDates->execute($dateParams);
    $rawDates = $stmtDates->fetchAll(PDO::FETCH_ASSOC);
    // Construire une liste chronologique (ancienne -> récente) de timestamps
    $dates = [];
    $useHour = false;
    foreach (array_reverse($rawDates) as $r) {
        if ($r['kpi_hour'] !== null && $r['kpi_hour'] !== '') {
            $useHour = true;
            $dates[] = $r['kpi_date'] . ' ' . str_pad($r['kpi_hour'], 2, '0', STR_PAD_LEFT) . ':00:00';
        } else {
            $dates[] = $r['kpi_date'];
        }
    }

    // Vérifier si la colonne demandée a réellement des données pour ce site/technologie.
    // Dans certains cas, l'import ne remplit que kpi_global + worst_kpi_name/value
    // et laisse les colonnes KPI individuelles à NULL.
    // Si c'est le cas, on bascule sur kpi_global (toujours rempli) pour avoir un trend utile.
    if ($kpiName !== 'kpi_global') {
        $chk = $pdo->prepare("
            SELECT COUNT(*) AS cnt
            FROM kpis_ran
            WHERE site_id = ? $techFilter AND `$kpiName` IS NOT NULL
            LIMIT 1
        ");
        $chk->execute($technology ? [$siteId, $technology] : [$siteId]);
        if ((int)$chk->fetchColumn() === 0) {
            // Colonne individuelle vide : repli sur kpi_global
            $kpiName = 'kpi_global';
        }
    }

    $labels = [];
    $values = [];

    foreach ($dates as $date) {
        if ($useHour && strpos($date, ' ') !== false) {
            $labels[] = date('d/m H:i', strtotime($date));

            $stmt = $pdo->prepare(
                "SELECT ROUND(AVG(`$kpiName`), 2) AS val
                 FROM kpis_ran
                 WHERE site_id = ? AND kpi_date = ? AND kpi_hour = ? $techFilter"
            );
            // extraire date et hour
            [$dPart, $tPart] = explode(' ', $date);
            $hour = intval(explode(':', $tPart)[0]);
            $params = $technology ? [$siteId, $dPart, $hour, $technology] : [$siteId, $dPart, $hour];
            $stmt->execute($params);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $values[] = $row['val'] !== null ? floatval($row['val']) : null;
        } else {
            $labels[] = date('d/m', strtotime($date));

            $stmt = $pdo->prepare(
                "SELECT ROUND(AVG(`$kpiName`), 2) AS val
                 FROM kpis_ran
                 WHERE site_id = ? AND kpi_date = ? $techFilter"
            );
            $params = $technology ? [$siteId, $date, $technology] : [$siteId, $date];
            $stmt->execute($params);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $values[] = $row['val'] !== null ? floatval($row['val']) : null;
        }
    }

    echo json_encode([
        'success' => true,
        'data'    => [
            'labels' => $labels,
            'values' => $values,
            'kpi_name' => $kpiName,
            'used_fallback' => ($requestedKpi !== $kpiName),
            'used_hour' => $useHour,
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
