<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost:8080');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../../config/database.php';

// generate-powerpoint.php génère un rapport CSV formaté
// (PPT natif nécessite une librairie externe non disponible)

try {
    $pdo  = Database::getLocalConnection();
    $date = date('d/m/Y');

    $stmt = $pdo->query("SELECT COUNT(*) AS total FROM sites");
    $totalSites = $stmt->fetchColumn();

    $stmt = $pdo->query("SELECT ROUND(AVG(kpi_global), 2) AS avg FROM kpis_ran WHERE kpi_date = CURDATE()");
    $avgKpi = $stmt->fetchColumn() ?? 0;

    $worstStmt = $pdo->query("
        SELECT s.id, s.name, k.technology, k.kpi_global, k.worst_kpi_name, k.worst_kpi_value
        FROM sites s
        INNER JOIN kpis_ran k ON k.site_id = s.id AND k.kpi_date = CURDATE()
        WHERE k.kpi_global > 0
        ORDER BY k.kpi_global ASC
        LIMIT 35
    ");
    $worst = $worstStmt->fetchAll(PDO::FETCH_ASSOC);

    $exportsDir = __DIR__ . '/../../data/exports';
    if (!is_dir($exportsDir)) mkdir($exportsDir, 0755, true);

    $filename = 'rapport_hebdo_' . date('Ymd_His') . '.csv';
    $filepath = $exportsDir . '/' . $filename;

    $fh = fopen($filepath, 'w');
    fprintf($fh, chr(0xEF) . chr(0xBB) . chr(0xBF));
    fputcsv($fh, ["RAPPORT HEBDOMADAIRE NETINSIGHT 360 — {$date}"], ';');
    fputcsv($fh, [], ';');
    fputcsv($fh, ["Indicateur", "Valeur"], ';');
    fputcsv($fh, ["Sites supervisés", $totalSites], ';');
    fputcsv($fh, ["KPI Global moyen", $avgKpi . "%"], ';');
    fputcsv($fh, [], ';');
    fputcsv($fh, ["--- ANALYSE DES PIRES SITES ---"], ';');
    fputcsv($fh, ["Site ID", "Nom", "Technologie", "KPI Global (%)", "KPI Dégradant", "Valeur (%)"], ';');
    foreach ($worst as $s) {
        fputcsv($fh, [
            $s['id'], $s['name'], $s['technology'],
            $s['kpi_global'], $s['worst_kpi_name'] ?? '', $s['worst_kpi_value'] ?? ''
        ], ';');
    }
    fclose($fh);

    $url = '/NetInsight%20360/netinsight360-backend/data/exports/' . $filename;
    echo json_encode(['success' => true, 'url' => $url]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
