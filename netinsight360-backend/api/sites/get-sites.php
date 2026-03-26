<?php
/**
 * NetInsight 360 - API: Récupération des sites
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost:8080');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../../config/database.php';

try {
    $pdo = Database::getLocalConnection();
    
    // Récupérer les filtres
    $country = $_GET['country'] ?? 'all';
    $vendor = $_GET['vendor'] ?? 'all';
    $tech = $_GET['tech'] ?? 'all';
    $domain = $_GET['domain'] ?? 'all';
    $status = $_GET['status'] ?? 'all';
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
    $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;
    
    // Construction de la requête - Utilisez 'name'
    $sql = "SELECT id, name, country_code, latitude, longitude, vendor, technology, domain, kpi_global, status, region, localite 
            FROM sites 
            WHERE 1=1";
    $params = [];
    
    if ($country !== 'all') {
        $sql .= " AND country_code = ?";
        $params[] = $country;
    }
    
    if ($vendor !== 'all') {
        $sql .= " AND vendor = ?";
        $params[] = $vendor;
    }
    
    if ($tech !== 'all') {
        $sql .= " AND technology = ?";
        $params[] = $tech;
    }
    
    if ($domain !== 'all') {
        $sql .= " AND domain = ?";
        $params[] = $domain;
    }
    
    if ($status !== 'all') {
        $sql .= " AND status = ?";
        $params[] = $status;
    }
    
    $sql .= " ORDER BY country_code, name LIMIT ? OFFSET ?";
    $params[] = $limit;
    $params[] = $offset;
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $sites = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Compter le total
    $countSql = "SELECT COUNT(*) FROM sites WHERE 1=1";
    $countParams = [];
    if ($country !== 'all') {
        $countSql .= " AND country_code = ?";
        $countParams[] = $country;
    }
    if ($vendor !== 'all') {
        $countSql .= " AND vendor = ?";
        $countParams[] = $vendor;
    }
    if ($tech !== 'all') {
        $countSql .= " AND technology = ?";
        $countParams[] = $tech;
    }
    if ($domain !== 'all') {
        $countSql .= " AND domain = ?";
        $countParams[] = $domain;
    }
    if ($status !== 'all') {
        $countSql .= " AND status = ?";
        $countParams[] = $status;
    }
    
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($countParams);
    $total = $countStmt->fetchColumn();
    
    // Ajouter le nom du pays - Utilisez 'country_name'
    $countries = [];
    $countryStmt = $pdo->query("SELECT country_code, country_name FROM countries");
    while ($row = $countryStmt->fetch(PDO::FETCH_ASSOC)) {
        $countries[$row['country_code']] = $row['country_name'];
    }
    
    foreach ($sites as &$site) {
        $site['country_name'] = $countries[$site['country_code']] ?? $site['country_code'];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $sites,
        'total' => $total,
        'limit' => $limit,
        'offset' => $offset
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}