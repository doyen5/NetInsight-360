<?php
/**
 * NetInsight 360 — API: Statistiques utilisateurs
 * GET /api/users/get-user-stats.php
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

    $row = $pdo->query("
        SELECT
            COUNT(*)                   AS total,
            SUM(role = 'ADMIN')        AS admin,
            SUM(role = 'FO_ANALYSTE')  AS analyst,
            SUM(role = 'CUSTOMER')     AS customer,
            SUM(status = 'active')     AS active_users
        FROM users
    ")->fetch(PDO::FETCH_ASSOC);

    // Évolution inscriptions sur 30 jours
    $evoRows = $pdo->query("
        SELECT DATE(created_at) AS day, COUNT(*) AS cnt
        FROM users
        WHERE created_at >= CURDATE() - INTERVAL 29 DAY
        GROUP BY DATE(created_at) ORDER BY day
    ")->fetchAll(PDO::FETCH_ASSOC);

    $evolution = ['labels' => [], 'values' => []];
    foreach ($evoRows as $r) {
        $evolution['labels'][] = $r['day'];
        $evolution['values'][] = (int)$r['cnt'];
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'total'        => (int)($row['total']        ?? 0),
            'admin'        => (int)($row['admin']        ?? 0),
            'analyst'      => (int)($row['analyst']      ?? 0),
            'npm'          => (int)($row['analyst']      ?? 0),
            'core'         => 0,
            'customer'     => (int)($row['customer']     ?? 0),
            'active_users' => (int)($row['active_users'] ?? 0),
            'evolution'    => $evolution,
        ]
    ]);

} catch (Exception $e) {
    error_log('[get-user-stats] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}