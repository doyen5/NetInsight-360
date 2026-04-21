<?php
/**
 * NetInsight 360 - API: Token CSRF
 * GET /api/auth/csrf-token.php
 * Nécessite une session authentifiée.
 */

require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/require-auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Méthode non autorisée']);
    exit();
}

if (!isset($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

echo json_encode([
    'success' => true,
    'csrf_token' => $_SESSION['csrf_token']
]);
