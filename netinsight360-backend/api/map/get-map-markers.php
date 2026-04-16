<?php
/**
 * NetInsight 360 - API: Marqueurs de la carte
 *
 * Depuis la correction du script d'import, les coordonnées sont
 * directement dans sites.latitude / sites.longitude (source : sites_database
 * sur le serveur distant).
 *
 * Pour chaque site, on renvoie :
 *  - les meilleures coordonnées disponibles (sites d'abord, fallback site_mapping)
 *  - le kpi_global et status du jour (kpis_ran) ou la valeur stockée dans sites
 *  - le KPI dégradant (worst_kpi_name) pour l'affichage dans les popups
 *  - la technologie pour colorer / filtrer par techno (option A)
 *
 * Filtre HAVING : exclut les sites sans coordonnées valides (lat=0 ou lng=0)
 */

require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo = Database::getLocalConnection();

    // --- Filtres ---
    $country = $_GET['country'] ?? 'all';
    $vendor  = $_GET['vendor']  ?? 'all';
    $tech    = $_GET['tech']    ?? 'all';
    $domain  = $_GET['domain']  ?? 'all';
    $status  = $_GET['status']  ?? 'all';

    // --- Requête principale ---
    // LEFT JOIN kpis_ran sur la dernière date disponible (pas forcément aujourd'hui)
    // Statut calculé dynamiquement d'après kpi_global pour être cohérent avec les stats
    $sql = "SELECT
                s.id,
                s.name,
                s.country_code,
                s.vendor,
                COALESCE(k.technology, s.technology, 'N/A')              AS technology,
                s.domain,
                COALESCE(NULLIF(s.latitude, 0), NULLIF(sm.latitude, 0))  AS latitude,
                COALESCE(NULLIF(s.longitude, 0), NULLIF(sm.longitude, 0)) AS longitude,
                COALESCE(k.kpi_global, s.kpi_global, 0)                  AS kpi_global,
                CASE
                    WHEN COALESCE(k.kpi_global, s.kpi_global, 0) >= 95 THEN 'good'
                    WHEN COALESCE(k.kpi_global, s.kpi_global, 0) >= 90 THEN 'warning'
                    ELSE 'critical'
                END                                                       AS status,
                k.worst_kpi_name,
                k.worst_kpi_value
            FROM sites s
            LEFT JOIN (
                SELECT k1.*
                FROM kpis_ran k1
                INNER JOIN (SELECT site_id, technology, MAX(kpi_date) AS max_date FROM kpis_ran GROUP BY site_id, technology) k2
                    ON k1.site_id = k2.site_id AND k1.technology = k2.technology AND k1.kpi_date = k2.max_date
            ) k ON k.site_id = s.id
            LEFT JOIN site_mapping sm ON sm.remote_id = s.id
            WHERE 1=1";

    $params = [];
    if ($country !== 'all') { $sql .= " AND s.country_code = ?"; $params[] = $country; }
    if ($vendor  !== 'all') { $sql .= " AND s.vendor = ?";       $params[] = $vendor;  }
    if ($tech    !== 'all') { $sql .= " AND k.technology = ?";   $params[] = $tech;    }
    if ($domain  !== 'all') { $sql .= " AND s.domain = ?";       $params[] = $domain;  }
    // 'status' est un alias CASE dans le SELECT — non filtrable dans WHERE.
    // On valide via whitelist puis on filtre dans HAVING après calcul.
    $statusHaving = '';
    $validStatuses = ['good', 'warning', 'critical'];
    if ($status !== 'all' && in_array($status, $validStatuses, true)) {
        $statusHaving = " AND status = '" . $status . "'";
    }

    // Exclure les sites sans coordonnées valides
    // Exclut les coordonnées nulles/zéro et hors des limites de l'Afrique
    $sql .= " HAVING latitude IS NOT NULL AND latitude != 0 AND longitude != 0"
          . " AND latitude BETWEEN -5.0 AND 25.0"
          . " AND longitude BETWEEN -18.0 AND 30.0"
          . $statusHaving;
    $sql .= " ORDER BY kpi_global ASC LIMIT 2000";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $sites = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // --- Option: limiter à 20 sites par technologie pour éviter la surcharge de la carte ---
    // Par défaut on retourne tous les marqueurs (comportement historique). La limitation
    // par techno est active uniquement si `top_by_tech=1` est passée en paramètre.
    $totalBeforeLimit = count($sites); // total AVANT toute limitation (pour le badge frontend)
    $limited = false;
    $topByTech = ($_GET['top_by_tech'] ?? '0') === '1';
    if ($topByTech) {
        $limitPerTech = 20;
        $byTech = [];
        foreach ($sites as $site) {
            $t = $site['technology'] ?? 'N/A';
            if (!isset($byTech[$t])) $byTech[$t] = [];
            if (count($byTech[$t]) < $limitPerTech) {
                $byTech[$t][] = $site;
            }
        }
        $sites = array_merge(...array_values($byTech));
        $limited = true;
    }

    // --- Enrichissement : nom du pays ---
    $countries = [];
    $cStmt = $pdo->query("SELECT country_code, country_name FROM countries WHERE is_active = 1");
    while ($row = $cStmt->fetch(PDO::FETCH_ASSOC)) {
        $countries[$row['country_code']] = $row['country_name'];
    }

    foreach ($sites as &$site) {
        $site['country_name']   = $countries[$site['country_code']] ?? $site['country_code'];
        $site['latitude']       = floatval($site['latitude']);
        $site['longitude']      = floatval($site['longitude']);
        $site['kpi_global']     = round(floatval($site['kpi_global']), 2);
        $site['worst_kpi_name'] = $site['worst_kpi_name']  ?? null;
        $site['worst_kpi_value']= isset($site['worst_kpi_value']) ? round(floatval($site['worst_kpi_value']), 2) : null;
    }

    echo json_encode([
        'success'            => true,
        'data'               => $sites,
        'count'              => count($sites),
        'total_count'        => $totalBeforeLimit,
        'limit_per_tech'     => $topByTech ? $limitPerTech : null,
        'limited_by_top_by_tech' => $limited,
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
