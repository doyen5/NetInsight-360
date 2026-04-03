<?php
/**
 * NetInsight 360 - API: Comparaison d'un KPI entre deux périodes pour un site
 *
 * Compare la période courante (N derniers jours) avec la période précédente
 * (les N jours qui précèdent la période courante).
 *
 * Paramètres GET :
 *   site_id    : identifiant du site (requis)
 *   kpi_name   : nom de la colonne KPI (défaut: kpi_global)
 *   technology : filtre technologie optionnel (2G, 3G, 4G, CORE)
 *   days       : taille de chaque période en jours (5-30, défaut 7)
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo        = Database::getLocalConnection();
    $siteId     = $_GET['site_id']    ?? '';
    $kpiName    = $_GET['kpi_name']   ?? 'kpi_global';
    $technology = $_GET['technology'] ?? null;
    $days       = max(5, min(30, intval($_GET['days'] ?? 7)));

    if (empty($siteId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'site_id requis']);
        exit;
    }

    // Whitelist des colonnes KPI autorisées (identique à get-kpi-trends.php)
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

    $techFilter = $technology ? 'AND technology = ?' : '';

    // ---------------------------------------------------------------
    // Récupérer les 2*N dernières dates disponibles pour ce site
    // (période courante = N premières, période précédente = N suivantes)
    // ---------------------------------------------------------------
    $limitTotal = $days * 2;
    $stmtDates  = $pdo->prepare("
        SELECT DISTINCT kpi_date
        FROM kpis_ran
        WHERE site_id = ? $techFilter
        ORDER BY kpi_date DESC
        LIMIT ?
    ");
    $dateParams = $technology ? [$siteId, $technology, $limitTotal] : [$siteId, $limitTotal];
    $stmtDates->execute($dateParams);
    $allDates = $stmtDates->fetchAll(PDO::FETCH_COLUMN);

    // Pas assez de données
    if (count($allDates) < 2) {
        echo json_encode([
            'success' => true,
            'data'    => [
                'current'  => ['labels' => [], 'values' => [], 'avg' => null],
                'previous' => ['labels' => [], 'values' => [], 'avg' => null],
                'diff_avg' => null,
                'diff_pct' => null,
                'kpi_name' => $kpiName,
            ],
        ]);
        exit;
    }

    // Vérifier si la colonne individuelle contient des données ; sinon, repli sur kpi_global
    if ($kpiName !== 'kpi_global') {
        $chk = $pdo->prepare("
            SELECT COUNT(*) FROM kpis_ran
            WHERE site_id = ? $techFilter AND `$kpiName` IS NOT NULL
            LIMIT 1
        ");
        $chk->execute($technology ? [$siteId, $technology] : [$siteId]);
        if ((int)$chk->fetchColumn() === 0) {
            $kpiName = 'kpi_global';
        }
    }

    // Période courante = les $days premières dates (les plus récentes)
    $currentDates  = array_reverse(array_slice($allDates, 0, $days));
    // Période précédente = les $days dates suivantes
    $previousDates = array_reverse(array_slice($allDates, $days, $days));

    /**
     * Calcule labels/values/avg pour un tableau de dates.
     */
    $fetchPeriod = function (array $dates) use ($pdo, $siteId, $kpiName, $technology, $techFilter): array {
        $labels = [];
        $values = [];

        foreach ($dates as $date) {
            $labels[] = date('d/m', strtotime($date));
            $stmt = $pdo->prepare("
                SELECT ROUND(AVG(`$kpiName`), 2) AS val
                FROM kpis_ran
                WHERE site_id = ? AND kpi_date = ? $techFilter
            ");
            $params = $technology ? [$siteId, $date, $technology] : [$siteId, $date];
            $stmt->execute($params);
            $row      = $stmt->fetch(PDO::FETCH_ASSOC);
            $values[] = $row['val'] !== null ? floatval($row['val']) : null;
        }

        $nonNull = array_filter($values, fn($v) => $v !== null);
        $avg     = count($nonNull) > 0 ? round(array_sum($nonNull) / count($nonNull), 2) : null;

        return ['labels' => $labels, 'values' => $values, 'avg' => $avg];
    };

    $current  = $fetchPeriod($currentDates);
    $previous = count($previousDates) > 0 ? $fetchPeriod($previousDates) : ['labels' => [], 'values' => [], 'avg' => null];

    // Différence absolue et relative entre les deux moyennes
    $diffAvg = null;
    $diffPct = null;
    if ($current['avg'] !== null && $previous['avg'] !== null) {
        $diffAvg = round($current['avg'] - $previous['avg'], 2);
        if ($previous['avg'] != 0) {
            $diffPct = round(($diffAvg / $previous['avg']) * 100, 1);
        }
    }

    echo json_encode([
        'success' => true,
        'data'    => [
            'current'      => $current,
            'previous'     => $previous,
            'diff_avg'     => $diffAvg,
            'diff_pct'     => $diffPct,
            'kpi_name'     => $kpiName,
            'used_fallback' => $kpiName === 'kpi_global',
        ],
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
