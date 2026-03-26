<?php
/**
 * NetInsight 360 - API: Statistiques du dashboard
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost:8080');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../../config/database.php';

try {
    $pdo = Database::getLocalConnection();
    
    // Total sites
    $totalSites = $pdo->query("SELECT COUNT(*) FROM sites WHERE status = 'active'")->fetchColumn();
    
    // Disponibilité RAN moyenne
    $ranAvg = $pdo->query("SELECT AVG(kpi_global) FROM kpis_ran WHERE technology IN ('2G','3G','4G') AND kpi_global > 0 ORDER BY kpi_date DESC LIMIT 100")->fetchColumn();
    
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