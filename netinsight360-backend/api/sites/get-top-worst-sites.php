<?php
/**
 * NetInsight 360 - API: Top/Pires sites (version dédupliquée par site)
 *
 * Cette version retourne des sites uniques (id site unique), triés selon leur
 * meilleure/pire performance. Si un site a plusieurs lignes KPI (plusieurs
 * technos/KPIs), seule la ligne la plus pertinente pour le tri est conservée.
 *
 * Filtres acceptés (GET) : country, vendor, tech, domain, worst_kpi
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
    $worstKpi = trim((string)($_GET['worst_kpi'] ?? 'all'));

    // Dernière date disponible (pas forcément aujourd'hui si l'import tourne en H-2)
    $lastDate = $pdo->query("SELECT MAX(kpi_date) FROM kpis_ran")->fetchColumn() ?: date('Y-m-d');

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
        INNER JOIN kpis_ran     k   ON k.site_id = s.id AND k.kpi_date = ?
        LEFT  JOIN site_mapping sm  ON sm.remote_id = s.id
        LEFT  JOIN countries    c   ON c.country_code = s.country_code";

    $where  = [];
    $params = [$lastDate];
    if ($country !== 'all') { $where[] = 's.country_code = ?'; $params[] = $country; }
    if ($vendor  !== 'all') { $where[] = 's.vendor = ?';       $params[] = $vendor;  }
    if ($tech    !== 'all') { $where[] = 'k.technology = ?';   $params[] = $tech;    }
    if ($domain  !== 'all') { $where[] = 's.domain = ?';       $params[] = $domain;  }
    if ($worstKpi !== '' && strcasecmp($worstKpi, 'all') !== 0) {
        $where[] = 'k.worst_kpi_name = ?';
        $params[] = $worstKpi;
    }

    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    // Pas de filtre lat/lng pour la liste : les sites sans coords sont quand même pertinents
    $having = "HAVING kpi_global > 0";

    // On récupère un volume suffisant de lignes triées, puis on déduplique par site.
    // Cela garantit des "vrais" top/worst sites (sans répétition du même site).
    $scanLimit = 1000;

    // Top (lignes triées du meilleur vers le moins bon)
    $stmtTop = $pdo->prepare("$baseSelect $whereClause $having ORDER BY kpi_global DESC LIMIT $scanLimit");
    $stmtTop->execute($params);
    $topRows = $stmtTop->fetchAll(PDO::FETCH_ASSOC);

    // Worst (lignes triées du pire vers le moins pire)
    $stmtWorst = $pdo->prepare("$baseSelect $whereClause $having ORDER BY kpi_global ASC LIMIT $scanLimit");
    $stmtWorst->execute($params);
    $worstRows = $stmtWorst->fetchAll(PDO::FETCH_ASSOC);

    $pickUniqueSites = function (array $rows, int $limit): array {
        $seen = [];
        $result = [];

        foreach ($rows as $row) {
            $siteId = (string)($row['id'] ?? '');
            if ($siteId === '' || isset($seen[$siteId])) {
                continue;
            }

            $seen[$siteId] = true;
            $result[] = $row;

            if (count($result) >= $limit) {
                break;
            }
        }

        return $result;
    };

    $top = $pickUniqueSites($topRows, 5);
    $worst = $pickUniqueSites($worstRows, 35);

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

