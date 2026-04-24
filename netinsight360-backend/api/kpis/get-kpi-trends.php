<?php
/**
 * NetInsight 360 - API: Tendance d'un KPI pour un site donné
 *
 * Paramètres GET :
 *   site_id  : identifiant du site
 *   kpi_name : nom du KPI (ex: "RAB CS SR", "RRC CS SR", "Taux de chute appel" — non sensible à la casse)
 *   days     : nombre de jours (5-30, défaut 7)
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo        = Database::getLocalConnection();
    $siteId     = $_GET['site_id']     ?? '';
    $kpiInput   = $_GET['kpi_name']    ?? 'kpi_global';
    $technology = $_GET['technology']  ?? null;
    $days       = max(5, min(30, intval($_GET['days'] ?? 7)));

    if (empty($siteId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'site_id requis']);
        exit;
    }

    // ===== Mapping des noms lisibles vers les colonnes SQL =====
    // Les clés sont les noms affichables (case-insensitive), les valeurs sont les colonnes SQL
    $kpiMapping = [
        // Format: "Nom Lisible" => "nom_colonne_sql"
        // 2G KPIs
        'Disponibilité TCH'          => 'tch_availability',
        'Taux de chute appel'        => 'tch_drop_rate',
        'Taux de handover 2G'        => 'handover_sr_2g',
        'Congestion SDCCH'           => 'sdcch_cong',
        'Chute SDCCH'                => 'sdcch_drop',
        'Taux établissement appel'   => 'cssr_2g',
        'Taux congestion TCH'        => 'tch_cong_rate',
        'Accessibilité RNA 2G'       => 'rna_2g',
        
        // 3G KPIs
        'RRC CS SR'                  => 'rrc_cs_sr',
        'RAB CS SR'                  => 'rab_cs_sr',
        'RRC PS SR'                  => 'rrc_ps_sr',
        'Taux de chute CS'           => 'cs_drop_rate',
        'Soft HO'                    => 'soft_ho_rate',
        'Taux établissement CS'      => 'cssr_cs_sr',
        'Taux établissement PS'      => 'cssr_ps_sr',
        'Taux de chute PS'           => 'ps_drop_rate',
        
        // 4G KPIs
        'LTE S1 SR'                  => 'lte_s1_sr',
        'LTE RRC SR'                 => 'lte_rrc_sr',
        'LTE ERAB SR'                => 'lte_erab_sr',
        'Taux établissement session' => 'lte_session_sr',
        'LTE CSFB SR'                => 'lte_csfb_sr',
        'Taux de chute ERAB'         => 'lte_erab_drop_rate',
        'LTE Intra-fréquence'        => 'lte_intra_freq_sr',
        'LTE Inter-fréquence'        => 'lte_inter_freq_sr',
        
        // KPI Global
        'KPI Global'                 => 'kpi_global',
    ];
    
    // Convertir le nom lisible en colonne SQL (case-insensitive)
    $kpiName = 'kpi_global'; // défaut
    foreach ($kpiMapping as $readableName => $columnName) {
        if (strtolower($kpiInput) === strtolower($readableName)) {
            $kpiName = $columnName;
            break;
        }
    }
    
    // Whitelist de sécurité (colonnes SQL autorisées)
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
    $requestedKpi = $kpiName; // Garder trace du KPI original demandé
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
    $valueMap = [];
    if (!empty($dates)) {
        if ($useHour) {
            $clauses = [];
            $params = [$siteId];
            foreach ($dates as $date) {
                if (strpos($date, ' ') === false) {
                    $clauses[] = '(kpi_date = ? AND kpi_hour IS NULL)';
                    $params[] = $date;
                    continue;
                }
                [$dPart, $tPart] = explode(' ', $date);
                $hour = intval(explode(':', $tPart)[0]);
                $clauses[] = '(kpi_date = ? AND kpi_hour = ?)';
                $params[] = $dPart;
                $params[] = $hour;
            }
            if (!empty($clauses)) {
                $sqlValues = "
                    SELECT kpi_date, kpi_hour, ROUND(AVG(`$kpiName`), 2) AS val
                    FROM kpis_ran
                    WHERE site_id = ?
                      AND (" . implode(' OR ', $clauses) . ")
                      " . ($technology ? ' AND technology = ?' : '') . "
                    GROUP BY kpi_date, kpi_hour
                ";
                if ($technology) $params[] = $technology;
                $stmtVals = $pdo->prepare($sqlValues);
                $stmtVals->execute($params);
                foreach ($stmtVals->fetchAll(PDO::FETCH_ASSOC) as $row) {
                    if ($row['kpi_hour'] === null || $row['kpi_hour'] === '') {
                        $key = $row['kpi_date'];
                    } else {
                        $key = $row['kpi_date'] . ' ' . str_pad((string)$row['kpi_hour'], 2, '0', STR_PAD_LEFT) . ':00:00';
                    }
                    $valueMap[$key] = $row['val'] !== null ? floatval($row['val']) : null;
                }
            }
        } else {
            $placeholders = implode(',', array_fill(0, count($dates), '?'));
            $params = array_merge([$siteId], $dates);
            if ($technology) $params[] = $technology;
            $sqlValues = "
                SELECT kpi_date, ROUND(AVG(`$kpiName`), 2) AS val
                FROM kpis_ran
                WHERE site_id = ?
                  AND kpi_date IN ($placeholders)
                  " . ($technology ? ' AND technology = ?' : '') . "
                GROUP BY kpi_date
            ";
            $stmtVals = $pdo->prepare($sqlValues);
            $stmtVals->execute($params);
            foreach ($stmtVals->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $valueMap[$row['kpi_date']] = $row['val'] !== null ? floatval($row['val']) : null;
            }
        }
    }

    foreach ($dates as $date) {
        if ($useHour && strpos($date, ' ') !== false) {
            $labels[] = date('d/m H:i', strtotime($date));
            $values[] = $valueMap[$date] ?? null;
        } else {
            $labels[] = date('d/m', strtotime($date));
            $values[] = $valueMap[$date] ?? null;
        }
    }

    echo json_encode([
        'success' => true,
        'data'    => [
            'labels' => $labels,
            'values' => $values,
            'kpi_name' => $requestedKpi,
            'kpi_column' => $kpiName,
            'used_fallback' => ($requestedKpi !== $kpiName),
            'used_hour' => $useHour,
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
