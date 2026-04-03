<?php
/**
 * NetInsight 360 — API : Logs d'audit
 *
 * GET /api/audit/get-audit-logs.php
 *
 * Paramètres optionnels :
 *   page       : page courante (défaut 1)
 *   limit      : lignes par page (10-100, défaut 25)
 *   action     : filtre action exacte (ex: CREATE_USER)
 *   user_id    : filtre par utilisateur
 *   search     : recherche libre sur email / details / entity_id
 *   date_from  : date début (Y-m-d)
 *   date_to    : date fin   (Y-m-d)
 *
 * Accès : ADMIN uniquement
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../app/helpers/AuditHelper.php';

if ($_SESSION['user_role'] !== 'ADMIN') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Accès réservé aux administrateurs']);
    exit;
}

try {
    $pdo = Database::getLocalConnection();
    AuditHelper::ensureTable($pdo);

    $page     = max(1, (int)($_GET['page']  ?? 1));
    $limit    = min(100, max(10, (int)($_GET['limit'] ?? 25)));
    $offset   = ($page - 1) * $limit;
    $action   = $_GET['action']    ?? 'all';
    $userId   = $_GET['user_id']   ?? 'all';
    $search   = trim($_GET['search']   ?? '');
    $dateFrom = trim($_GET['date_from'] ?? '');
    $dateTo   = trim($_GET['date_to']   ?? '');

    $conditions = [];
    $params     = [];

    if ($action !== 'all' && $action !== '') {
        $conditions[] = 'a.action = ?';
        $params[]     = $action;
    }
    if ($userId !== 'all' && is_numeric($userId)) {
        $conditions[] = 'a.user_id = ?';
        $params[]     = (int)$userId;
    }
    if ($search !== '') {
        $like = '%' . $search . '%';
        $conditions[] = '(a.user_email LIKE ? OR a.details LIKE ? OR a.entity_id LIKE ?)';
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
        $conditions[] = 'DATE(a.created_at) >= ?';
        $params[]     = $dateFrom;
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
        $conditions[] = 'DATE(a.created_at) <= ?';
        $params[]     = $dateTo;
    }

    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';

    // Pagination : total
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM audit_logs a $where");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // Données paginées
    $dataStmt = $pdo->prepare("
        SELECT a.*, u.name AS user_name
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.user_id
        $where
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
    ");
    $dataStmt->execute([...$params, $limit, $offset]);
    $logs = $dataStmt->fetchAll(PDO::FETCH_ASSOC);

    // Liste d'actions distinctes pour le filtre
    $actionsStmt = $pdo->query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
    $actions     = $actionsStmt->fetchAll(PDO::FETCH_COLUMN);

    // Liste d'utilisateurs distincts pour le filtre
    $usersStmt = $pdo->query('
        SELECT DISTINCT a.user_id, COALESCE(u.name, a.user_email) AS label
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.user_id IS NOT NULL
        ORDER BY label
    ');
    $users = $usersStmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'data'    => [
            'logs'    => $logs,
            'total'   => $total,
            'page'    => $page,
            'pages'   => (int)ceil($total / $limit),
            'limit'   => $limit,
            'actions' => $actions,
            'users'   => $users,
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
