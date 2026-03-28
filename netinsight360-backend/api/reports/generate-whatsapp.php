<?php
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo    = Database::getLocalConnection();
    $domain = $_POST['domain'] ?? $_GET['domain'] ?? 'all';
    $tech   = $_POST['tech']   ?? $_GET['tech']   ?? 'all';
    $date   = date('d/m/Y');

    // Stats globales
    $stmt = $pdo->query("SELECT COUNT(*) AS total FROM sites");
    $totalSites = $stmt->fetchColumn();

    $stmt = $pdo->query("SELECT ROUND(AVG(kpi_global), 2) AS avg FROM kpis_ran WHERE kpi_date = CURDATE()");
    $avgKpi = $stmt->fetchColumn() ?? 0;

    $stmt = $pdo->query("SELECT COUNT(*) FROM kpis_ran WHERE kpi_date = CURDATE() AND kpi_global < 90");
    $critical = $stmt->fetchColumn();

    // 5 pires sites
    $worstStmt = $pdo->query("
        SELECT s.name, k.technology, k.kpi_global, k.worst_kpi_name, k.worst_kpi_value
        FROM sites s
        INNER JOIN kpis_ran k ON k.site_id = s.id AND k.kpi_date = CURDATE()
        WHERE k.kpi_global > 0
        ORDER BY k.kpi_global ASC
        LIMIT 5
    ");
    $worst = $worstStmt->fetchAll(PDO::FETCH_ASSOC);

    $worstLines = array_map(function ($s) {
        $kpi = $s['worst_kpi_name'] ? " | ⬇{$s['worst_kpi_name']}: {$s['worst_kpi_value']}%" : '';
        return "• {$s['name']} ({$s['technology']}): {$s['kpi_global']}%{$kpi}";
    }, $worst);

    $report = "📡 *Rapport NetInsight 360 — {$date}*\n\n"
            . "🔵 *Résumé réseau RAN*\n"
            . "• Sites supervisés : {$totalSites}\n"
            . "• KPI Global moyen : {$avgKpi}%\n"
            . "• Sites critiques (KPI < 90%) : {$critical}\n\n"
            . "🔴 *Top 5 pires sites du jour*\n"
            . implode("\n", $worstLines) . "\n\n"
            . "_Rapport généré automatiquement par NetInsight 360_";

    echo json_encode(['success' => true, 'report' => $report]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
