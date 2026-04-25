<?php
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo    = Database::getLocalConnection();
    $domain = $_POST['domain'] ?? $_GET['domain'] ?? 'all';
    $tech   = $_POST['tech']   ?? $_GET['tech']   ?? 'all';
    $date   = date('d/m/Y');

    // Conditions dynamiques selon les filtres
    $siteConds  = [];
    $siteParams = [];
    if ($domain !== 'all') { $siteConds[] = 's.domain = ?';       $siteParams[] = $domain; }

    $kpiConds  = ['k.kpi_date = CURDATE()', 'k.kpi_global > 0'];
    $kpiParams = [];
    if ($domain !== 'all') { $kpiConds[] = 's.domain = ?';        $kpiParams[] = $domain; }
    if ($tech   !== 'all') { $kpiConds[] = 'k.technology = ?';    $kpiParams[] = $tech;   }

    // Stats globales (filtrées)
    $sitesWhere = $siteConds ? 'INNER JOIN sites s ON s.id = k.site_id WHERE ' . implode(' AND ', $siteConds) : '';
    $stmtTotal  = $pdo->prepare("SELECT COUNT(DISTINCT s.id) AS total FROM sites s" . ($siteConds ? ' WHERE ' . implode(' AND ', $siteConds) : ''));
    $stmtTotal->execute($siteParams);
    $totalSites = $stmtTotal->fetchColumn();

    $kpiWhere = implode(' AND ', $kpiConds);
    $stmtAvg  = $pdo->prepare("SELECT ROUND(AVG(k.kpi_global), 2) AS avg FROM kpis_ran k INNER JOIN sites s ON s.id = k.site_id WHERE $kpiWhere");
    $stmtAvg->execute($kpiParams);
    $avgKpi = $stmtAvg->fetchColumn() ?? 0;

    $stmtCrit = $pdo->prepare("SELECT COUNT(*) FROM kpis_ran k INNER JOIN sites s ON s.id = k.site_id WHERE $kpiWhere AND k.kpi_global < 90");
    $stmtCrit->execute($kpiParams);
    $critical = $stmtCrit->fetchColumn();

    // 5 pires sites distincts (1 ligne par site = la pire technologie)
    $worstStmt = $pdo->prepare("
        SELECT s.name,
               SUBSTRING_INDEX(GROUP_CONCAT(k.technology ORDER BY k.kpi_global ASC), ',', 1) AS technology,
               MIN(k.kpi_global) AS kpi_global,
               SUBSTRING_INDEX(GROUP_CONCAT(IFNULL(k.worst_kpi_name,'') ORDER BY k.kpi_global ASC), ',', 1) AS worst_kpi_name,
               SUBSTRING_INDEX(GROUP_CONCAT(IFNULL(k.worst_kpi_value,'') ORDER BY k.kpi_global ASC), ',', 1) AS worst_kpi_value
        FROM sites s
        INNER JOIN kpis_ran k ON k.site_id = s.id
        WHERE $kpiWhere
        GROUP BY s.id, s.name
        ORDER BY kpi_global ASC
        LIMIT 5
    ");
    $worstStmt->execute($kpiParams);
    $worst = $worstStmt->fetchAll(PDO::FETCH_ASSOC);

    $worstLines = array_map(function ($s) {
        $kpi = $s['worst_kpi_name'] ? " | {$s['worst_kpi_name']}: {$s['worst_kpi_value']}%" : '';
        return "  - {$s['name']} ({$s['technology']}): {$s['kpi_global']}%{$kpi}";
    }, $worst);

    $report = "*Rapport NetInsight 360 -- {$date}*\n\n"
            . "*Resume reseau RAN*\n"
            . "  - Sites supervises : {$totalSites}\n"
            . "  - KPI Global moyen : {$avgKpi}%\n"
            . "  - Sites critiques (KPI < 90%) : {$critical}\n\n"
            . "*Top 5 pires sites du jour*\n"
            . implode("\n", $worstLines) . "\n\n"
            . "_Rapport genere par NetInsight 360_";

    echo json_encode(['success' => true, 'report' => $report]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
