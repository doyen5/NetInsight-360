<?php
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

// generate-powerpoint.php génère un rapport CSV formaté
// (PPT natif nécessite une librairie externe non disponible)

try {
    $pdo    = Database::getLocalConnection();
    $domain = $_POST['domain'] ?? $_GET['domain'] ?? 'all';
    $tech   = $_POST['tech']   ?? $_GET['tech']   ?? 'all';
    $date   = date('d/m/Y');

    // Conditions dynamiques selon les filtres
    $siteConds  = [];
    $siteParams = [];
    if ($domain !== 'all') { $siteConds[] = 's.domain = ?';     $siteParams[] = $domain; }

    $stmtTotal = $pdo->prepare(
        "SELECT COUNT(DISTINCT s.id) FROM sites s" . ($siteConds ? ' WHERE ' . implode(' AND ', $siteConds) : '')
    );
    $stmtTotal->execute($siteParams);
    $totalSites = $stmtTotal->fetchColumn();

    $kpiConds  = ['k.kpi_date = CURDATE()', 'k.kpi_global > 0'];
    $kpiParams = [];
    if ($domain !== 'all') { $kpiConds[] = 's.domain = ?';      $kpiParams[] = $domain; }
    if ($tech   !== 'all') { $kpiConds[] = 'k.technology = ?';  $kpiParams[] = $tech;   }
    $kpiWhere = implode(' AND ', $kpiConds);

    $stmtAvg = $pdo->prepare("SELECT ROUND(AVG(k.kpi_global), 2) AS avg FROM kpis_ran k INNER JOIN sites s ON s.id = k.site_id WHERE $kpiWhere");
    $stmtAvg->execute($kpiParams);
    $avgKpi = $stmtAvg->fetchColumn() ?? 0;

    $worstStmt = $pdo->prepare("
        SELECT s.id, s.name, k.technology, k.kpi_global, k.worst_kpi_name, k.worst_kpi_value
        FROM sites s
        INNER JOIN kpis_ran k ON k.site_id = s.id
        WHERE $kpiWhere
        ORDER BY k.kpi_global ASC
        LIMIT 35
    ");
    $worstStmt->execute($kpiParams);
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
