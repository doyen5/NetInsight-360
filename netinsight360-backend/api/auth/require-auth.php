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
