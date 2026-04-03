<?php
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo    = Database::getLocalConnection();
    $type   = $_GET['type']    ?? 'worst_sites';
    $domain = $_GET['domain']  ?? 'all';
    $tech   = $_GET['tech']    ?? 'all';
    $country = $_GET['country'] ?? 'all';
    $vendor  = $_GET['vendor']  ?? 'all';
    $siteId  = trim($_GET['site_id'] ?? '');

    // Date du dernier import (jamais CURDATE, l'import tourne la nuit)
    $lastDate = $pdo->query("SELECT MAX(kpi_date) FROM kpis_ran")->fetchColumn() ?: date('Y-m-d');

    if (!empty($siteId)) {
        // ── Mode fiche site unique ──────────────────────────────────────────
        $stmt = $pdo->prepare("
            SELECT s.id, s.name, s.country_code, s.vendor, k.technology,
                   k.kpi_global, k.status, k.worst_kpi_name, k.worst_kpi_value, k.kpi_date
            FROM sites s
            INNER JOIN kpis_ran k ON k.site_id = s.id
            WHERE k.site_id = ?
            ORDER BY k.kpi_date DESC, k.technology
            LIMIT 90
        ");
        $stmt->execute([$siteId]);
        $data     = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $filename = 'site_' . preg_replace('/[^a-z0-9_-]/i', '_', $siteId) . '_' . date('Ymd_His') . '.csv';
    } else {
        // ── Mode export filtré ──────────────────────────────────────────────
        $conditions = ["k.kpi_date = ?", "k.kpi_global > 0"];
        $params     = [$lastDate];
        if ($domain  !== 'all') { $conditions[] = "s.domain = ?";       $params[] = $domain; }
        if ($tech    !== 'all') { $conditions[] = "k.technology = ?";   $params[] = $tech; }
        if ($country !== 'all') { $conditions[] = "s.country_code = ?"; $params[] = $country; }
        if ($vendor  !== 'all') { $conditions[] = "s.vendor = ?";       $params[] = $vendor; }
        $where = implode(' AND ', $conditions);

        $stmt = $pdo->prepare("
            SELECT s.id, s.name, s.country_code, s.vendor, k.technology,
                   k.kpi_global, k.status, k.worst_kpi_name, k.worst_kpi_value, k.kpi_date
            FROM sites s
            INNER JOIN kpis_ran k ON k.site_id = s.id
            WHERE $where
            ORDER BY k.kpi_global ASC
            LIMIT 500
        ");
        $stmt->execute($params);
        $data     = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $filename = $type . '_' . date('Ymd_His') . '.csv';
    }

    // Générer CSV
    $exportsDir = __DIR__ . '/../../data/exports';
    if (!is_dir($exportsDir)) mkdir($exportsDir, 0755, true);

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
