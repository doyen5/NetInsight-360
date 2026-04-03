<?php
/**
 * NetInsight 360 — API : Prédictions KPI (régression linéaire)
 *
 * GET /api/kpis/get-kpi-predictions.php
 *
 * Paramètres :
 *   site_id  : identifiant du site
 *   kpi_name : colonne KPI (whitelist, défaut kpi_global)
 *
 * Retourne :
 *   actual    : { labels[], values[] }  — 14 dernières données réelles
 *   predicted : { labels[], values[], low[], high[] } — 5 jours suivants
 *   trend     : 'improving' | 'degrading' | 'stable'
 *   slope     : pente de la droite (unité: % par jour)
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

// Whitelist identique à get-kpi-trends.php
const PRED_KPI_ALLOWED = [
    'kpi_global',
    'tch_availability', 'tch_drop_rate', 'handover_sr_2g', 'sdcch_cong', 'sdcch_drop',
    'cssr_2g', 'tch_cong_rate', 'rna_2g',
    'rrc_cs_sr', 'rab_cs_sr', 'rrc_ps_sr', 'cs_drop_rate', 'soft_ho_rate',
    'cssr_cs_sr', 'cssr_ps_sr', 'ps_drop_rate',
    'lte_s1_sr', 'lte_rrc_sr', 'lte_erab_sr', 'lte_session_sr', 'lte_csfb_sr',
    'lte_erab_drop_rate', 'lte_intra_freq_sr', 'lte_inter_freq_sr',
];

try {
    $pdo     = Database::getLocalConnection();
    $siteId  = trim($_GET['site_id']  ?? '');
    $kpiName = trim($_GET['kpi_name'] ?? 'kpi_global');

    if (empty($siteId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'site_id requis']);
        exit;
    }

    if (!in_array($kpiName, PRED_KPI_ALLOWED, true)) {
        $kpiName = 'kpi_global';
    }

    // Si la colonne demandée est vide, repli sur kpi_global (même logique que trends)
    if ($kpiName !== 'kpi_global') {
        $chk = $pdo->prepare("SELECT COUNT(*) FROM kpis_ran WHERE site_id = ? AND `$kpiName` IS NOT NULL LIMIT 1");
        $chk->execute([$siteId]);
        if ((int)$chk->fetchColumn() === 0) {
            $kpiName = 'kpi_global';
        }
    }

    // Récupérer les 14 derniers points réels (1 valeur moyenne par date)
    $stmt = $pdo->prepare("
        SELECT kpi_date, ROUND(AVG(`$kpiName`), 2) AS value
        FROM kpis_ran
        WHERE site_id = ? AND `$kpiName` IS NOT NULL
        GROUP BY kpi_date
        ORDER BY kpi_date ASC
        LIMIT 14
    ");
    $stmt->execute([$siteId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($rows) < 3) {
        echo json_encode(['success' => false, 'error' => 'Données insuffisantes pour la prédiction (minimum 3 points requis)']);
        exit;
    }

    $n = count($rows);
    $xArr = range(0, $n - 1);
    $yArr = array_map(static fn($r) => (float)$r['value'], $rows);

    // ---- Régression linéaire (moindres carrés) ----
    $sumX  = array_sum($xArr);
    $sumY  = array_sum($yArr);
    $sumXX = array_sum(array_map(static fn($xi) => $xi * $xi, $xArr));
    $sumXY = 0;
    for ($i = 0; $i < $n; $i++) {
        $sumXY += $xArr[$i] * $yArr[$i];
    }
    $denom     = ($n * $sumXX - $sumX * $sumX);
    $slope     = $denom != 0 ? ($n * $sumXY - $sumX * $sumY) / $denom : 0;
    $intercept = ($sumY - $slope * $sumX) / $n;

    // ---- Écart-type des résidus (pour intervalle de confiance 95 %) ----
    $residuals = [];
    for ($i = 0; $i < $n; $i++) {
        $residuals[] = ($yArr[$i] - ($intercept + $slope * $i)) ** 2;
    }
    $stdDev = $n > 1 ? sqrt(array_sum($residuals) / $n) : 0;

    // ---- Données réelles ----
    $actualLabels = [];
    $actualValues = [];
    foreach ($rows as $row) {
        $actualLabels[] = date('d/m', strtotime($row['kpi_date']));
        $actualValues[] = (float)$row['value'];
    }

    // ---- Prédictions sur 5 jours ----
    $predictedLabels = [];
    $predictedValues = [];
    $predictedLow    = [];
    $predictedHigh   = [];
    $lastDate        = strtotime(end($rows)['kpi_date']);

    for ($i = 1; $i <= 5; $i++) {
        $xi        = $n + $i - 1;
        $predicted = round(min(100, max(0, $intercept + $slope * $xi)), 2);
        $predictedLabels[] = date('d/m', strtotime("+{$i} days", $lastDate));
        $predictedValues[] = $predicted;
        $predictedLow[]    = round(max(0,   $predicted - 1.96 * $stdDev), 2);
        $predictedHigh[]   = round(min(100, $predicted + 1.96 * $stdDev), 2);
    }

    // ---- Tendance globale ----
    if ($slope > 0.1) {
        $trend = 'improving';
    } elseif ($slope < -0.1) {
        $trend = 'degrading';
    } else {
        $trend = 'stable';
    }

    echo json_encode([
        'success' => true,
        'data'    => [
            'actual'    => ['labels' => $actualLabels, 'values' => $actualValues],
            'predicted' => [
                'labels' => $predictedLabels,
                'values' => $predictedValues,
                'low'    => $predictedLow,
                'high'   => $predictedHigh,
            ],
            'trend'     => $trend,
            'slope'     => round($slope, 4),
            'kpi_name'  => $kpiName,
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
