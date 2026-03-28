<?php
/**
 * NetInsight 360 — API: Liste des alertes actives
 * GET /api/alerts/get-alerts.php
 * Params: type (critical|warning|all), country, domain, search
 */
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo = Database::getLocalConnection();

    $type    = $_GET['type']    ?? 'all';
    $country = $_GET['country'] ?? 'all';
    $domain  = $_GET['domain']  ?? 'all';
    $search  = trim($_GET['search'] ?? '');

    $conditions = ["a.status = 'active'"];
    $params     = [];

    if ($type    !== 'all') { $conditions[] = "a.alert_type = ?";   $params[] = $type; }
    if ($country !== 'all') { $conditions[] = "s.country_code = ?"; $params[] = $country; }
    if ($domain  !== 'all') { $conditions[] = "s.domain = ?";       $params[] = $domain; }
    if ($search  !== '') {
        $conditions[] = "(a.kpi_name LIKE ? OR a.message LIKE ? OR s.name LIKE ?)";
        $like = '%' . $search . '%';
        $params[] = $like; $params[] = $like; $params[] = $like;
    }

    $where = implode(' AND ', $conditions);

    $stmt = $pdo->prepare("
        SELECT
            a.id, a.site_id, a.alert_type, a.kpi_name,
            a.current_value, a.threshold_value, a.message,
            a.status, a.created_at,
            COALESCE(s.name, a.site_id)                    AS site_name,
            COALESCE(s.country_code, '')                   AS country_code,
            COALESCE(c.country_name, s.country_code, '')   AS country_name,
            COALESCE(s.domain, 'RAN')                      AS domain
        FROM alerts a
        LEFT JOIN sites    s ON s.id             = a.site_id
        LEFT JOIN countries c ON c.country_code  = s.country_code
        WHERE $where
        ORDER BY FIELD(a.alert_type, 'critical', 'warning'), a.created_at DESC
        LIMIT 500
    ");
    $stmt->execute($params);
    $alerts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($alerts as &$alert) {
        $alert['title']           = $alert['kpi_name'];
        $alert['current_value']   = (float)$alert['current_value'];
        $alert['threshold_value'] = (float)$alert['threshold_value'];
    }

    echo json_encode(['success' => true, 'data' => $alerts, 'total' => count($alerts)]);

} catch (Exception $e) {
    error_log('[get-alerts] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}