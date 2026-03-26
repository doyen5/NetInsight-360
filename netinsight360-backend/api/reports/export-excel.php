<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost:8080');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../../config/database.php';

try {
    $pdo    = Database::getLocalConnection();
    $type   = $_GET['type'] ?? 'worst_sites';
    $domain = $_GET['domain'] ?? 'all';
    $tech   = $_GET['tech']   ?? 'all';

    // Construire la requête selon le type
    $conditions = ["k.kpi_date = CURDATE()", "k.kpi_global > 0"];
    $params     = [];
    if ($domain !== 'all') { $conditions[] = "s.domain = ?";      $params[] = $domain; }
    if ($tech   !== 'all') { $conditions[] = "k.technology = ?";  $params[] = $tech;   }
    $where = implode(' AND ', $conditions);

    $rows = $pdo->prepare("
        SELECT s.id, s.name, s.country_code, s.vendor, k.technology,
               k.kpi_global, k.status, k.worst_kpi_name, k.worst_kpi_value, k.kpi_date
        FROM sites s
        INNER JOIN kpis_ran k ON k.site_id = s.id
        WHERE $where
        ORDER BY k.kpi_global ASC
        LIMIT 100
    ");
    $rows->execute($params);
    $data = $rows->fetchAll(PDO::FETCH_ASSOC);

    // Générer CSV
    $exportsDir = __DIR__ . '/../../data/exports';
    if (!is_dir($exportsDir)) mkdir($exportsDir, 0755, true);

    $filename  = $type . '_' . date('Ymd_His') . '.csv';
    $filepath  = $exportsDir . '/' . $filename;

    $fh = fopen($filepath, 'w');
    fprintf($fh, chr(0xEF) . chr(0xBB) . chr(0xBF)); // BOM UTF-8
    fputcsv($fh, ['Site ID', 'Nom', 'Pays', 'Vendor', 'Technologie', 'KPI Global (%)', 'Statut', 'KPI Dégradant', 'Valeur KPI Dégradant (%)', 'Date'], ';');
    foreach ($data as $row) {
        fputcsv($fh, [
            $row['id'], $row['name'], $row['country_code'], $row['vendor'],
            $row['technology'], $row['kpi_global'], $row['status'],
            $row['worst_kpi_name'] ?? '', $row['worst_kpi_value'] ?? '', $row['kpi_date']
        ], ';');
    }
    fclose($fh);

    $url = '/NetInsight%20360/netinsight360-backend/data/exports/' . $filename;
    echo json_encode(['success' => true, 'url' => $url, 'filename' => $filename]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
