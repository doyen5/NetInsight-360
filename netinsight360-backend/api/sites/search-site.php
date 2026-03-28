<?php
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo = Database::getLocalConnection();

    $q = trim($_GET['q'] ?? '');
    if (empty($q)) {
        echo json_encode(['success' => false, 'error' => 'Paramètre q requis']);
        exit;
    }

    $like = '%' . $q . '%';

    $stmt = $pdo->prepare("
        SELECT
            s.id, s.name, s.country_code, s.vendor, s.technology, s.domain,
            s.kpi_global, s.status, s.region, s.localite,
            COALESCE(NULLIF(s.latitude, 0),  NULLIF(sm.latitude, 0),  0) AS latitude,
            COALESCE(NULLIF(s.longitude, 0), NULLIF(sm.longitude, 0), 0) AS longitude,
            COALESCE(c.country_name, s.country_code) AS country_name,
            k.worst_kpi_name,
            k.worst_kpi_value
        FROM sites s
        LEFT JOIN site_mapping sm ON sm.remote_id = s.id
        LEFT JOIN countries    c  ON c.country_code = s.country_code
        LEFT JOIN kpis_ran     k  ON k.site_id = s.id AND k.kpi_date = CURDATE()
        WHERE s.id LIKE ? OR s.name LIKE ?
        ORDER BY
            CASE WHEN s.id = ? THEN 0 WHEN s.id LIKE ? THEN 1 ELSE 2 END,
            s.name
        LIMIT 1
    ");
    $stmt->execute([$like, $like, $q, $q . '%']);
    $site = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$site) {
        echo json_encode(['success' => false, 'error' => 'Aucun site trouvé']);
        exit;
    }

    $site['latitude']        = floatval($site['latitude']);
    $site['longitude']       = floatval($site['longitude']);
    $site['kpi_global']      = round(floatval($site['kpi_global']), 2);
    $site['worst_kpi_value'] = isset($site['worst_kpi_value']) ? round(floatval($site['worst_kpi_value']), 2) : null;

    echo json_encode(['success' => true, 'data' => $site]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
