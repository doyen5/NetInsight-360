<?php
/**
 * API: get-top-worst-sites-by-tech.php
 * Retourne pour chaque technologie la liste des X pires sites
 * Filtres GET acceptés : country, vendor, domain, top_n
 * Usage recommandé : appelé après un import pour afficher rapidement
 * les pires sites par technologie (ex: top_n=10).
 */

require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo = Database::getLocalConnection();

    $country = $_GET['country'] ?? 'all';
    $vendor  = $_GET['vendor']  ?? 'all';
    $domain  = $_GET['domain']  ?? 'all';
    $tech    = $_GET['tech']    ?? 'all';
    $topN    = intval($_GET['top_n'] ?? 10);
    if ($topN <= 0) $topN = 10;
    if ($topN > 50) $topN = 50;

    // Dernière date disponible
    $lastDate = $pdo->query("SELECT MAX(kpi_date) FROM kpis_ran")->fetchColumn() ?: date('Y-m-d');

    // Récupérer les technologies présentes pour cette date
    $techStmt = $pdo->prepare("SELECT DISTINCT technology FROM kpis_ran WHERE kpi_date = ? ORDER BY technology");
    $techStmt->execute([$lastDate]);
    $techs = $techStmt->fetchAll(PDO::FETCH_COLUMN);

    if ($tech !== 'all') {
        $techs = array_values(array_filter($techs, function($t) use ($tech) {
            return strtoupper((string)$t) === strtoupper((string)$tech);
        }));
    }

    $result = [ 'date' => $lastDate, 'top_n' => $topN, 'per_tech' => [] ];

    // Requête de base (sélectionne les colonnes utiles)
    $baseSelect = "SELECT
            s.id, s.name, s.country_code, COALESCE(c.country_name, s.country_code) AS country_name,
            s.vendor, k.technology, s.domain,
            COALESCE(NULLIF(s.latitude,0), NULLIF(sm.latitude,0)) AS latitude,
            COALESCE(NULLIF(s.longitude,0), NULLIF(sm.longitude,0)) AS longitude,
            COALESCE(k.kpi_global, s.kpi_global, 0) AS kpi_global,
            COALESCE(k.status, s.status, 'unknown') AS status,
            k.worst_kpi_name, k.worst_kpi_value
        FROM sites s
        INNER JOIN kpis_ran k ON k.site_id = s.id AND k.kpi_date = ?
        LEFT JOIN site_mapping sm ON sm.remote_id = s.id
        LEFT JOIN countries c ON c.country_code = s.country_code";

    foreach ($techs as $tech) {
        $where = [];
        $params = [$lastDate];
        $where[] = 'k.technology = ?'; $params[] = $tech;
        if ($country !== 'all') { $where[] = 's.country_code = ?'; $params[] = $country; }
        if ($vendor !== 'all')  { $where[] = 's.vendor = ?';       $params[] = $vendor; }
        if ($domain !== 'all')  { $where[] = 's.domain = ?';       $params[] = $domain; }

        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $having = 'HAVING kpi_global >= 0';

        $sql = "$baseSelect $whereClause $having ORDER BY kpi_global ASC LIMIT $topN";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Normalisation des types
        foreach ($rows as &$r) {
            $r['latitude'] = isset($r['latitude']) ? floatval($r['latitude']) : null;
            $r['longitude'] = isset($r['longitude']) ? floatval($r['longitude']) : null;
            $r['kpi_global'] = isset($r['kpi_global']) ? round(floatval($r['kpi_global']), 2) : null;
            $r['worst_kpi_value'] = isset($r['worst_kpi_value']) ? round(floatval($r['worst_kpi_value']), 2) : null;
        }
        $result['per_tech'][$tech] = $rows;
    }

    echo json_encode(['success' => true, 'data' => $result]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
