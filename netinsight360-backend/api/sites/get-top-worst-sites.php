<?php
/**
 * NetInsight 360 - API: Top 5 meilleurs et 35 pires sites (Option A)
 *
 * Option A : chaque ligne = combinaison site + technologie.
 * Filtres acceptés (GET) : country, vendor, tech, domain
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost:8080');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../../config/database.php';

try {
    $pdo = Database::getLocalConnection();

    $country = $_GET['country'] ?? 'all';
    $vendor  = $_GET['vendor']  ?? 'all';
    $tech    = $_GET['tech']    ?? 'all';
    $domain  = $_GET['domain']  ?? 'all';

    $baseSelect = "SELECT
            s.id,
            s.name,
            s.country_code,
            COALESCE(c.country_name, s.country_code)                          AS country_name,
            s.vendor,
            k.technology,
            s.domain,
            COALESCE(NULLIF(s.latitude, 0),  NULLIF(sm.latitude, 0))         AS latitude,
            COALESCE(NULLIF(s.longitude, 0), NULLIF(sm.longitude, 0))        AS longitude,
            COALESCE(k.kpi_global, s.kpi_global, 0)                          AS kpi_global,
            COALESCE(k.status, s.status, 'unknown')                          AS status,
            k.worst_kpi_name,
            k.worst_kpi_value
        FROM sites s
        INNER JOIN kpis_ran     k   ON k.site_id = s.id AND k.kpi_date = CURDATE()
        LEFT  JOIN site_mapping sm  ON sm.remote_id = s.id
        LEFT  JOIN countries    c   ON c.country_code = s.country_code";

    $where  = [];
    $params = [];
    if ($country !== 'all') { $where[] = 's.country_code = ?'; $params[] = $country; }
    if ($vendor  !== 'all') { $where[] = 's.vendor = ?';       $params[] = $vendor;  }
    if ($tech    !== 'all') { $where[] = 'k.technology = ?';   $params[] = $tech;    }
    if ($domain  !== 'all') { $where[] = 's.domain = ?';       $params[] = $domain;  }

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $having = "HAVING kpi_global > 0 AND latitude IS NOT NULL AND latitude != 0 AND longitude != 0";

    // Top 5 meilleurs (kpi_global DESC)
    $stmtTop = $pdo->prepare("$baseSelect $whereClause $having ORDER BY kpi_global DESC LIMIT 5");
    $stmtTop->execute($params);
    $top = $stmtTop->fetchAll(PDO::FETCH_ASSOC);

    // 35 pires (kpi_global ASC)
    $stmtWorst = $pdo->prepare("$baseSelect $whereClause $having ORDER BY kpi_global ASC LIMIT 35");
    $stmtWorst->execute($params);
    $worst = $stmtWorst->fetchAll(PDO::FETCH_ASSOC);

    $normalize = function (array &$sites): void {
        foreach ($sites as &$site) {
            $site['latitude']        = floatval($site['latitude']);
            $site['longitude']       = floatval($site['longitude']);
            $site['kpi_global']      = round(floatval($site['kpi_global']), 2);
            $site['worst_kpi_value'] = isset($site['worst_kpi_value'])
                ? round(floatval($site['worst_kpi_value']), 2) : null;
        }
    };
    $normalize($top);
    $normalize($worst);

    echo json_encode(['success' => true, 'data' => ['top' => $top, 'worst' => $worst]]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

