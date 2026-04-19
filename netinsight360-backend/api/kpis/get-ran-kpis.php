<?php
/**
 * NetInsight 360 - API: KPIs RAN agrégés
 *
 * Retourne :
 *  - stats     : total_sites, avg_rna, avg_tch_drop, critical_sites
 *  - kpis      : { '2G': {label: value}, '3G': {...}, '4G': {...} }
 *  - distribution : { huawei, ericsson, '2G', '3G', '4G', countries[] }
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

    // Construction des filtres — utilise la dernière date importée (pas forcément aujourd'hui)
    $conditions = ["k.kpi_date = (SELECT MAX(kpi_date) FROM kpis_ran)"];
    $params     = [];

    if ($country !== 'all') { $conditions[] = "s.country_code = ?"; $params[] = $country; }
    if ($vendor  !== 'all') { $conditions[] = "s.vendor = ?";       $params[] = $vendor;  }
    if ($tech    !== 'all') { $conditions[] = "k.technology = ?";   $params[] = $tech;    }
    if ($domain  !== 'all') { $conditions[] = "s.domain = ?";       $params[] = $domain;  }

    $where = implode(' AND ', $conditions);

    // --- 1. Statistiques globales ---
    $statsStmt = $pdo->prepare("
        SELECT
            COUNT(DISTINCT s.id)                                                         AS total_sites,
            ROUND(AVG(k.kpi_global), 2)                                                  AS avg_rna,
            ROUND(AVG(CASE
                WHEN k.technology = '2G' AND k.worst_kpi_name = 'Taux de chute appel'
                THEN k.worst_kpi_value ELSE NULL END), 2)                                AS avg_tch_drop,
            COUNT(CASE WHEN k.kpi_global >= 95 THEN 1 END)                               AS good_sites,
            COUNT(CASE WHEN k.kpi_global >= 90 AND k.kpi_global < 95 THEN 1 END)        AS warning_sites,
            COUNT(CASE WHEN k.kpi_global < 90 THEN 1 END)                                AS critical_sites
        FROM sites s
        INNER JOIN kpis_ran k ON k.site_id = s.id
        WHERE $where
    ");
    $statsStmt->execute($params);
    $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);

    // --- 2. KPIs par technologie (moyenne worst_kpi_value par indicateur) ---
    $kpis = ['2G' => [], '3G' => [], '4G' => []];

    $kpiStmt = $pdo->prepare("
        SELECT
            k.technology,
            k.worst_kpi_name,
            ROUND(AVG(k.worst_kpi_value), 2) AS avg_value
        FROM sites s
        INNER JOIN kpis_ran k ON k.site_id = s.id
        WHERE $where
          AND k.worst_kpi_name IS NOT NULL
        GROUP BY k.technology, k.worst_kpi_name
        ORDER BY k.technology, avg_value ASC
    ");
    $kpiStmt->execute($params);

    foreach ($kpiStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $t = $row['technology'];
        if (array_key_exists($t, $kpis)) {
            $kpis[$t][$row['worst_kpi_name']] = (float)$row['avg_value'];
        }
    }

    // --- 3. Distribution vendor + technologie ---
    $distStmt = $pdo->prepare("
        SELECT
            SUM(CASE WHEN s.vendor     = 'Huawei'   THEN 1 ELSE 0 END) AS huawei,
            SUM(CASE WHEN s.vendor     = 'Ericsson'  THEN 1 ELSE 0 END) AS ericsson,
            SUM(CASE WHEN k.technology = '2G'       THEN 1 ELSE 0 END) AS `2G`,
            SUM(CASE WHEN k.technology = '3G'       THEN 1 ELSE 0 END) AS `3G`,
            SUM(CASE WHEN k.technology = '4G'       THEN 1 ELSE 0 END) AS `4G`
        FROM sites s
        INNER JOIN kpis_ran k ON k.site_id = s.id
        WHERE $where
    ");
    $distStmt->execute($params);
    $distribution = $distStmt->fetch(PDO::FETCH_ASSOC);

    // Conversion en entiers
    foreach (['huawei', 'ericsson', '2G', '3G', '4G'] as $key) {
        $distribution[$key] = (int)($distribution[$key] ?? 0);
    }

    // --- 4. Distribution par pays ---
    $countryStmt = $pdo->prepare("
        SELECT
            COALESCE(c.country_name, s.country_code) AS name,
            COUNT(DISTINCT s.id)                      AS count
        FROM sites s
        INNER JOIN kpis_ran k ON k.site_id = s.id
        LEFT  JOIN countries c ON c.country_code = s.country_code
        WHERE $where
        GROUP BY s.country_code, c.country_name
        ORDER BY count DESC
    ");
    $countryStmt->execute($params);
    $distribution['countries'] = $countryStmt->fetchAll(PDO::FETCH_ASSOC);

    // Récupérer la dernière date des KPIs (date de la dernière importation)
    $dateStmt = $pdo->query("SELECT MAX(kpi_date) AS last_kpi_date FROM kpis_ran");
    $dateRow = $dateStmt->fetch(PDO::FETCH_ASSOC);
    $lastKpiDate = $dateRow['last_kpi_date'] ?? null;

    echo json_encode([
        'success' => true,
        'data'    => [
            'stats'        => $stats,
            'kpis'         => $kpis,
            'distribution' => $distribution,
            'last_kpi_date' => $lastKpiDate,  // Dernière date d'importation des KPIs
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
