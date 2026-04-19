<?php
/**
 * NetInsight 360 — API: Liste des alertes actives
 * GET /api/alerts/get-alerts.php
 * Params: type (critical|warning|all), country, domain, search, page, per_page
 */
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/_workflow-schema.php';

try {
    $pdo = Database::getLocalConnection();
    ensureAlertsWorkflowSchema($pdo);

    $type    = $_GET['type']    ?? 'all';
    $country = $_GET['country'] ?? 'all';
    $domain  = $_GET['domain']  ?? 'all';
    $search  = trim($_GET['search'] ?? '');

    // Pagination serveur: limite la charge côté frontend et DB.
    $page    = max(1, (int)($_GET['page'] ?? 1));
    $perPage = (int)($_GET['per_page'] ?? 10);
    if ($perPage < 1) $perPage = 10;
    if ($perPage > 100) $perPage = 100;
    $offset  = ($page - 1) * $perPage;

    // On affiche les alertes non résolues: nouvelles, en cours et escaladées.
    $conditions = ["a.status IN ('active', 'acknowledged', 'escalated')"];
    $params     = [];

    if ($type    !== 'all') { $conditions[] = "a.alert_type = ?";   $params[] = $type; }
    if ($country !== 'all') { $conditions[] = "s.country_code = ?"; $params[] = $country; }
    if ($domain  !== 'all') { $conditions[] = "s.domain = ?";       $params[] = $domain; }
    if ($search  !== '') {
        $conditions[] = "(a.kpi_name LIKE ? OR a.message LIKE ? OR s.name LIKE ?)";
        $like = '%' . $search . '%';
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }

    $where = implode(' AND ', $conditions);

    // 1) Total brut pour la pagination.
    $countStmt = $pdo->prepare("
        SELECT COUNT(*) AS total
        FROM alerts a
        LEFT JOIN sites    s ON s.id             = a.site_id
        LEFT JOIN countries c ON c.country_code  = s.country_code
        WHERE $where
    ");
    $countStmt->execute($params);
    $total = (int)($countStmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0);

    // 2) Page courante uniquement.
    $stmt = $pdo->prepare("
        SELECT
            a.id, a.site_id, a.alert_type, a.kpi_name,
            a.current_value, a.threshold_value, a.message,
            a.status, a.created_at, a.acknowledged_at, a.escalated_at,
            COALESCE(s.name, a.site_id)                    AS site_name,
            COALESCE(s.country_code, '')                   AS country_code,
            COALESCE(c.country_name, s.country_code, '')   AS country_name,
            COALESCE(s.domain, 'RAN')                      AS domain,
            COALESCE(u_ack.name, '')                       AS acknowledged_by_name,
            COALESCE(u_esc.name, '')                       AS escalated_by_name
        FROM alerts a
        LEFT JOIN sites    s ON s.id             = a.site_id
        LEFT JOIN countries c ON c.country_code  = s.country_code
        LEFT JOIN users u_ack ON u_ack.id        = a.acknowledged_by
        LEFT JOIN users u_esc ON u_esc.id        = a.escalated_by
        WHERE $where
        ORDER BY FIELD(a.alert_type, 'critical', 'warning'), a.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $queryParams = array_merge($params, [$perPage, $offset]);
    $stmt->execute($queryParams);

    $alerts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($alerts as &$alert) {
        $alert['title']           = $alert['kpi_name'];
        $alert['current_value']   = (float)$alert['current_value'];
        $alert['threshold_value'] = (float)$alert['threshold_value'];
    }
    unset($alert);

    echo json_encode([
        'success' => true,
        'data' => $alerts,
        'total' => $total,
        'page' => $page,
        'per_page' => $perPage,
        'total_pages' => (int)ceil($total / $perPage)
    ]);

} catch (Exception $e) {
    error_log('[get-alerts] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}
