<?php
/**
 * NetInsight 360 — API: Liste des utilisateurs
 * GET /api/users/get-users.php
 * ADMIN only
 */
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SESSION['user_role'] !== 'ADMIN') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Accès réservé aux administrateurs.']); exit();
}

try {
    $pdo = Database::getLocalConnection();

    $role   = $_GET['role']   ?? 'all';
    $limit  = isset($_GET['limit'])  ? max(1, min(500, (int)$_GET['limit']))  : 100;
    $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset'])            : 0;

    $allowedSort = ['name', 'email', 'role', 'last_login', 'created_at'];
    $sortBy = in_array($_GET['sort_by'] ?? '', $allowedSort) ? $_GET['sort_by'] : 'created_at';
    $order  = strtoupper($_GET['order'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

    $conditions = ['1=1'];
    $params     = [];

    if ($role !== 'all') {
        $conditions[] = 'role = ?';
        $params[] = $role;
    }

    $where = implode(' AND ', $conditions);
    $dataParams = array_merge($params, [$limit, $offset]);

    $stmt = $pdo->prepare("
        SELECT id, name, email, role, status, created_at, last_login
        FROM users WHERE $where ORDER BY $sortBy $order LIMIT ? OFFSET ?
    ");
    $stmt->execute($dataParams);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE $where");
    $countStmt->execute($params);

    echo json_encode([
        'success' => true,
        'data'    => $users,
        'total'   => (int)$countStmt->fetchColumn(),
        'limit'   => $limit,
        'offset'  => $offset,
    ]);

} catch (Exception $e) {
    error_log('[get-users] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}