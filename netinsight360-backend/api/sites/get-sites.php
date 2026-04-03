<?php
/**
 * NetInsight 360 - API: Récupération des sites
 * Jointure kpis_ran pour obtenir le kpi_global et le statut en temps réel.
 * Tri par kpi_global ASC (pires sites en premier).
 */

require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo = Database::getLocalConnection();

    $country = $_GET['country'] ?? 'all';
    $vendor  = $_GET['vendor']  ?? 'all';
    $tech    = $_GET['tech']    ?? 'all';
    $domain  = $_GET['domain']  ?? 'all';
    $status  = $_GET['status']  ?? 'all';
    $limit   = isset($_GET['limit'])  ? min(intval($_GET['limit']), 5000) : 500;
    $offset  = isset($_GET['offset']) ? intval($_GET['offset']) : 0;

    // Sous-requête : dernière donnée KPI par (site_id, technology)
    $kpiSub = "(
        SELECT k1.*
        FROM kpis_ran k1
        INNER JOIN (
            SELECT site_id, technology, MAX(kpi_date) AS max_date
            FROM kpis_ran
            GROUP BY site_id, technology
        ) k2 ON k1.site_id   = k2.site_id
             AND k1.technology = k2.technology
             AND k1.kpi_date   = k2.max_date
    )";

    $sql = "SELECT
                s.id,
                s.name,
                s.country_code,
                s.vendor,
                s.domain,
                s.region,
                s.localite,
                COALESCE(k.technology, s.technology, 'N/A')     AS technology,
                ROUND(COALESCE(k.kpi_global, 0), 2)             AS kpi_global,
                k.worst_kpi_name,
                ROUND(k.worst_kpi_value, 2)                     AS worst_kpi_value,
                k.kpi_date,
                CASE
                    WHEN COALESCE(k.kpi_global, 0) >= 95 THEN 'good'
                    WHEN COALESCE(k.kpi_global, 0) >= 90 THEN 'warning'
                    ELSE 'critical'
                END AS status
            FROM sites s
            INNER JOIN $kpiSub k ON k.site_id = s.id
            WHERE 1=1";

    $params = [];
    if ($country !== 'all') { $sql .= " AND s.country_code = ?"; $params[] = $country; }
    if ($vendor  !== 'all') { $sql .= " AND s.vendor = ?";       $params[] = $vendor;  }
    if ($tech    !== 'all') { $sql .= " AND k.technology = ?";   $params[] = $tech;    }
    if ($domain  !== 'all') { $sql .= " AND s.domain = ?";       $params[] = $domain;  }
    if ($status  !== 'all') { $sql .= " AND k.status = ?";       $params[] = $status;  }

    // Compter avant la pagination
    $countSql    = "SELECT COUNT(*) FROM ($sql) AS sub";
    $countStmt   = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // Tri par criticité (pires KPI en premier) + pagination
    $sql .= " ORDER BY kpi_global ASC LIMIT ? OFFSET ?";
    $params[] = $limit;
    $params[] = $offset;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $sites = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Enrichir avec le nom du pays
    $countries = [];
    $cStmt = $pdo->query("SELECT country_code, country_name FROM countries WHERE is_active = 1");
    while ($row = $cStmt->fetch(PDO::FETCH_ASSOC)) {
        $countries[$row['country_code']] = $row['country_name'];
    }
    foreach ($sites as &$site) {
        $site['country_name']    = $countries[$site['country_code']] ?? $site['country_code'];
        $site['worst_kpi_value'] = isset($site['worst_kpi_value']) ? floatval($site['worst_kpi_value']) : null;
    }
    unset($site);

    echo json_encode([
        'success' => true,
        'data'    => $sites,
        'total'   => $total,
        'limit'   => $limit,
        'offset'  => $offset,
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
