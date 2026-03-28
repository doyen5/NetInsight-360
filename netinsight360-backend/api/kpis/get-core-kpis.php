<?php
/**
 * NetInsight 360 — API: KPIs CORE
 * GET /api/kpis/get-core-kpis.php
 * Params: country, vendor
 *
 * Note: kpis_core ne contient que packet_loss (pas latency/jitter/throughput).
 * Ces métriques sont retournées à 0 en attendant des données réelles.
 */
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo = Database::getLocalConnection();

    $country = $_GET['country'] ?? 'all';
    $vendor  = $_GET['vendor']  ?? 'all';

    $conditions  = ["s.domain = 'CORE'", "k.kpi_date = (SELECT MAX(kpi_date) FROM kpis_core)"];
    $params      = [];

    if ($country !== 'all') { $conditions[] = "s.country_code = ?"; $params[] = $country; }
    if ($vendor  !== 'all') { $conditions[] = "s.vendor = ?";       $params[] = $vendor;  }

    $where = implode(' AND ', $conditions);

    // --- Statistiques globales ---
    $statsRow = $pdo->prepare("
        SELECT
            ROUND(AVG(k.packet_loss), 2)  AS avg_packet_loss,
            ROUND(AVG(k.kpi_global),  2)  AS avg_kpi_global,
            COUNT(DISTINCT s.id)          AS total_sites,
            COUNT(CASE WHEN k.status = 'critical' THEN 1 END) AS critical_sites
        FROM sites s
        INNER JOIN kpis_core k ON k.site_id = s.id
        WHERE $where
    ");
    $statsRow->execute($params);
    $stats = $statsRow->fetch(PDO::FETCH_ASSOC);

    // --- Tendances 7 jours ---
    $tConds  = ["s.domain = 'CORE'", "k.kpi_date >= CURDATE() - INTERVAL 6 DAY"];
    $tParams = [];
    if ($country !== 'all') { $tConds[] = "s.country_code = ?"; $tParams[] = $country; }
    if ($vendor  !== 'all') { $tConds[] = "s.vendor = ?";       $tParams[] = $vendor; }
    $tWhere  = implode(' AND ', $tConds);

    $trendStmt = $pdo->prepare("
        SELECT k.kpi_date, ROUND(AVG(k.packet_loss), 2) AS avg_pl
        FROM sites s INNER JOIN kpis_core k ON k.site_id = s.id
        WHERE $tWhere GROUP BY k.kpi_date ORDER BY k.kpi_date
    ");
    $trendStmt->execute($tParams);
    $trends = ['labels' => [], 'packet_loss' => []];
    foreach ($trendStmt->fetchAll(PDO::FETCH_ASSOC) as $tr) {
        $trends['labels'][]      = $tr['kpi_date'];
        $trends['packet_loss'][] = (float)$tr['avg_pl'];
    }

    // --- Par pays ---
    $cStmt = $pdo->prepare("
        SELECT
            COALESCE(c.country_name, s.country_code) AS name,
            ROUND(AVG(k.packet_loss), 2)              AS latency,
            ROUND(AVG(k.kpi_global),  2)              AS kpi_global
        FROM sites s
        INNER JOIN kpis_core k  ON k.site_id        = s.id
        LEFT  JOIN countries c  ON c.country_code   = s.country_code
        WHERE $where
        GROUP BY s.country_code, c.country_name ORDER BY latency DESC
    ");
    $cStmt->execute($params);
    $byCountry = $cStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($byCountry as &$row) {
        $row['latency']    = (float)$row['latency'];
        $row['kpi_global'] = (float)$row['kpi_global'];
    }
    unset($row);

    // --- Par vendor (packet_loss moyen) ---
    $vStmt = $pdo->prepare("
        SELECT
            ROUND(AVG(CASE WHEN s.vendor = 'Huawei'   THEN k.packet_loss END), 2) AS huawei,
            ROUND(AVG(CASE WHEN s.vendor = 'Ericsson' THEN k.packet_loss END), 2) AS ericsson
        FROM sites s INNER JOIN kpis_core k ON k.site_id = s.id WHERE $where
    ");
    $vStmt->execute($params);
    $vRow     = $vStmt->fetch(PDO::FETCH_ASSOC);
    $byVendor = ['huawei' => (float)($vRow['huawei'] ?? 0), 'ericsson' => (float)($vRow['ericsson'] ?? 0)];

    // --- Distribution vendor (nb sites) ---
    $dStmt = $pdo->prepare("
        SELECT
            SUM(CASE WHEN s.vendor = 'Huawei'   THEN 1 ELSE 0 END) AS huawei,
            SUM(CASE WHEN s.vendor = 'Ericsson' THEN 1 ELSE 0 END) AS ericsson
        FROM sites s INNER JOIN kpis_core k ON k.site_id = s.id WHERE $where
    ");
    $dStmt->execute($params);
    $dRow         = $dStmt->fetch(PDO::FETCH_ASSOC);
    $distribution = ['huawei' => (int)($dRow['huawei'] ?? 0), 'ericsson' => (int)($dRow['ericsson'] ?? 0)];

    echo json_encode([
        'success' => true,
        'data' => [
            'stats' => [
                'avg_packet_loss' => (float)($stats['avg_packet_loss'] ?? 0),
                'avg_latency'     => 0,
                'avg_jitter'      => 0,
                'avg_throughput'  => 0,
                'avg_kpi_global'  => (float)($stats['avg_kpi_global']  ?? 0),
                'total_sites'     => (int)($stats['total_sites']        ?? 0),
                'critical_sites'  => (int)($stats['critical_sites']     ?? 0),
            ],
            'trends'       => $trends,
            'by_country'   => $byCountry,
            'by_vendor'    => $byVendor,
            'distribution' => $distribution,
        ]
    ]);

} catch (Exception $e) {
    error_log('[get-core-kpis] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}