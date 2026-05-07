<?php
/**
 * NetInsight 360 — Vérification d'authentification centralisée
 *
 * À inclure (require_once) dans TOUS les endpoints protégés,
 * après les headers CORS / OPTIONS handler.
 *
 * Usage :
 *   require_once __DIR__ . '/../auth/require-auth.php';
 *
 * Si la session est valide → exécution continue normalement.
 * Si non authentifié      → HTTP 401 + JSON + exit().
 */

// Démarrer la session si pas encore démarrée
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        'success'   => false,
        'error'     => 'Non authentifié. Veuillez vous connecter.',
        'code'      => 'UNAUTHORIZED'
    ]);
    exit();
}

if (!isset($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// ---- Session idle timeout ----
// SESSION_EXPIRY_HOURS défini dans config/constants.php (défaut : 8h)
require_once __DIR__ . '/../../config/constants.php';
$maxIdle = defined('SESSION_EXPIRY_HOURS') ? (SESSION_EXPIRY_HOURS * 3600) : 28800;
if (isset($_SESSION['logged_in_at']) && (time() - (int)$_SESSION['logged_in_at']) > $maxIdle) {
    session_destroy();
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error'   => 'Session expirée. Veuillez vous reconnecter.',
        'code'    => 'SESSION_EXPIRED'
    ]);
    exit();
}
// Rafraîchir le timer d'inactivité à chaque appel API
$_SESSION['logged_in_at'] = time();

// ---- Protection CSRF sur requêtes mutatrices ----
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
    $csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($csrfHeader) || $csrfHeader === '' || !hash_equals($_SESSION['csrf_token'], $csrfHeader)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => 'Jeton CSRF invalide ou manquant.',
            'code' => 'CSRF_INVALID'
        ]);
        exit();
    }
}
