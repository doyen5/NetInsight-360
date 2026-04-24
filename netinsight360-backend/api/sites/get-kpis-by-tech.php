<?php
/**
 * NetInsight 360 - API: Liste des KPIs disponibles par technologie
 *
 * Filtres GET acceptes : country, vendor, domain, tech
 * Retour :
 * {
 *   success: true,
 *   data: {
 *     technology: '2G',
 *     kpis: ['Disponibilite TCH', 'Taux de chute appel', ...]
 *   }
 * }
 */

require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo = Database::getLocalConnection();

    $country = $_GET['country'] ?? 'all';
    $vendor  = $_GET['vendor'] ?? 'all';
    $domain  = $_GET['domain'] ?? 'all';
    $tech    = strtoupper(trim((string)($_GET['tech'] ?? 'all')));

    if ($tech === '' || $tech === 'ALL') {
        echo json_encode([
            'success' => true,
            'data' => [
                'technology' => 'all',
                'kpis' => []
            ]
        ]);
        exit;
    }

    $lastDate = $pdo->query("SELECT MAX(kpi_date) FROM kpis_ran")->fetchColumn() ?: date('Y-m-d');

    $where = [
        'k.kpi_date = ?',
        'k.technology = ?',
        "k.worst_kpi_name IS NOT NULL",
        "k.worst_kpi_name <> ''"
    ];
    $params = [$lastDate, $tech];

    if ($country !== 'all') {
        $where[] = 's.country_code = ?';
        $params[] = $country;
    }
    if ($vendor !== 'all') {
        $where[] = 's.vendor = ?';
        $params[] = $vendor;
    }
    if ($domain !== 'all') {
        $where[] = 's.domain = ?';
        $params[] = $domain;
    }

    $sql = "
        SELECT DISTINCT k.worst_kpi_name
        FROM kpis_ran k
        INNER JOIN sites s ON s.id = k.site_id
        WHERE " . implode(' AND ', $where) . "
        ORDER BY k.worst_kpi_name ASC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $kpis = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (!empty($row['worst_kpi_name'])) {
            $kpis[] = $row['worst_kpi_name'];
        }
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'technology' => $tech,
            'kpis' => $kpis,
            'kpi_date' => $lastDate
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
