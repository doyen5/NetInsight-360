<?php
/**
 * NetInsight 360 - API: KPI le plus dégradant par technologie
 *
 * Pour chaque techno (2G/3G/4G), retourne les N pires sites
 * triés par kpi_global ASC avec leur KPI le plus dégradant.
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo     = Database::getLocalConnection();
    $country = $_GET['country'] ?? 'all';
    $vendor  = $_GET['vendor']  ?? 'all';
    $limit   = max(1, min(20, intval($_GET['limit'] ?? 5)));

    $result = [];

    foreach (['2G', '3G', '4G'] as $tech) {
        $conditions = [
            "k.kpi_date = (SELECT MAX(kpi_date) FROM kpis_ran)",
            "k.technology = ?"
        ];
        $params = [$tech];

        if ($country !== 'all') { $conditions[] = "s.country_code = ?"; $params[] = $country; }
        if ($vendor  !== 'all') { $conditions[] = "s.vendor = ?";       $params[] = $vendor;  }

        $where = implode(' AND ', $conditions);

        $stmt = $pdo->prepare("
            SELECT
                s.id, s.name, s.vendor,
                COALESCE(c.country_name, s.country_code) AS country_name,
                k.technology,
                ROUND(k.kpi_global, 2)      AS kpi_global,
                k.worst_kpi_name,
                ROUND(k.worst_kpi_value, 2) AS worst_kpi_value
            FROM sites s
            INNER JOIN kpis_ran k  ON k.site_id = s.id
            LEFT  JOIN countries c ON c.country_code = s.country_code AND c.is_active = 1
            WHERE $where
            ORDER BY k.kpi_global ASC
            LIMIT ?
        ");
        $params[] = $limit;
        $stmt->execute($params);
        $result[$tech] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    echo json_encode(['success' => true, 'data' => $result]);

} catch (Exception $e) {
    error_log('[get-worst-kpis-by-tech] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}
