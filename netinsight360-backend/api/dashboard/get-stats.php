<?php
/**
 * NetInsight 360 - API: Statistiques du dashboard
 */

require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo = Database::getLocalConnection();

    // Paramètres de filtrage (optionnels)
    $country = $_GET['country'] ?? 'all';
    $vendor  = $_GET['vendor']  ?? 'all';
    $tech    = $_GET['tech']    ?? 'all';

    // Conditions dynamiques pour les sites
    $siteConds  = ["s.status = 'active'"];
    $siteParams = [];
    if ($country !== 'all') { $siteConds[] = 's.country_code = ?'; $siteParams[] = $country; }
    if ($vendor  !== 'all') { $siteConds[] = 's.vendor = ?';       $siteParams[] = $vendor;  }
    $siteWhere = implode(' AND ', $siteConds);

    // Total sites (filtré)
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM sites s WHERE $siteWhere");
    $stmt->execute($siteParams);
    $totalSites = $stmt->fetchColumn();

    // Conditions dynamiques pour les KPIs RAN
    $techList = ['2G', '3G', '4G'];
    if ($tech !== 'all' && in_array($tech, $techList, true)) {
        $techList = [$tech];
    }
    $techPlaceholders = implode(',', array_fill(0, count($techList), '?'));
    $ranConds  = ["k.technology IN ($techPlaceholders)", 'k.kpi_global > 0'];
    $ranParams = $techList;
    if ($country !== 'all') { $ranConds[] = 's.country_code = ?'; $ranParams[] = $country; }
    if ($vendor  !== 'all') { $ranConds[] = 's.vendor = ?';       $ranParams[] = $vendor;  }
    $ranWhere  = implode(' AND ', $ranConds);

    // Disponibilité RAN moyenne (filtrée)
    $stmtRan = $pdo->prepare(
        "SELECT AVG(k.kpi_global)
         FROM kpis_ran k
         INNER JOIN sites s ON s.id = k.site_id
         WHERE $ranWhere
         ORDER BY k.kpi_date DESC
         LIMIT 100"
    );
    $stmtRan->execute($ranParams);
    $ranAvg = $stmtRan->fetchColumn();
    
    // Packet Loss CORE moyen (si la table existe)
    try {
        $coreAvg = $pdo->query("SELECT AVG(packet_loss) FROM kpis_core WHERE packet_loss > 0 ORDER BY kpi_date DESC LIMIT 100")->fetchColumn();
    } catch (Exception $e) {
        $coreAvg = 0;
    }
    
    // Total utilisateurs
    $totalUsers = $pdo->query("SELECT COUNT(*) FROM users WHERE status = 'active'")->fetchColumn();
    
    echo json_encode([
        'success' => true,
        'data' => [
            'total_users' => intval($totalUsers),
            'total_sites' => intval($totalSites),
            'avg_ran_availability' => round(floatval($ranAvg), 2),
            'avg_packet_loss' => round(floatval($coreAvg), 2)
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}