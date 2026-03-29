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
    $pdo     = Database::getLocalConnection();
    $siteId  = $_GET['site_id']  ?? '';
    $kpiName = $_GET['kpi_name'] ?? 'RNA';
    $days    = max(5, min(30, intval($_GET['days'] ?? 7)));

    if (empty($siteId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'site_id requis']);
        exit;
    }

    // Validation du nom de KPI contre injection (whitelist colonnes connues)
    $allowed = [
        'RNA','TCH_Availability','CSSR','CDR_TCH','SDCCH_SR','SDCCH_Drop',
        'RRC_SR','ERAB_SR','HO_SR','UL_BLER','DL_BLER','VoLTE_SR',
        'Packet_Loss','Latency','CSFB_SR','kpi_global'
    ];
    if (!in_array($kpiName, $allowed, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'kpi_name invalide']);
        exit;
    }

    $labels = [];
    $values = [];

    for ($i = $days - 1; $i >= 0; $i--) {
        $date     = date('Y-m-d', strtotime("-$i days"));
        $labels[] = date('d/m', strtotime($date));

        $stmt = $pdo->prepare("
            SELECT ROUND(AVG(`$kpiName`), 2) AS val
            FROM kpis_ran
            WHERE site_id = ? AND kpi_date = ?
        ");
        $stmt->execute([$siteId, $date]);
        $row      = $stmt->fetch(PDO::FETCH_ASSOC);
        $values[] = $row['val'] !== null ? floatval($row['val']) : null;
    }

    echo json_encode([
        'success' => true,
        'data'    => ['labels' => $labels, 'values' => $values, 'kpi_name' => $kpiName]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
