<?php
/**
 * NetInsight 360 - Rafraîchissement du token "Rester connecté"
 * Endpoint: POST /api/auth/refresh-token.php
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost:8080');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Credentials: true');

// Gérer OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Méthode non autorisée']);
    exit();
}

session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'Non authentifié']);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
$pdo = Database::getLocalConnection();

// Générer un nouveau token
$newToken = bin2hex(random_bytes(32));
$expires = date('Y-m-d H:i:s', strtotime('+30 days'));

// Supprimer l'ancien token
$stmt = $pdo->prepare("DELETE FROM user_tokens WHERE user_id = ?");
$stmt->execute([$_SESSION['user_id']]);

// Créer le nouveau token
$insertStmt = $pdo->prepare("INSERT INTO user_tokens (user_id, token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)");
$insertStmt->execute([
    $_SESSION['user_id'],
    password_hash($newToken, PASSWORD_DEFAULT),
    $expires,
    $_SERVER['REMOTE_ADDR'] ?? null,
    $_SERVER['HTTP_USER_AGENT'] ?? null
]);

// Définir le cookie
setcookie('remember_token', $newToken, time() + 86400 * 30, '/', '', false, true);

echo json_encode(['success' => true, 'message' => 'Token rafraîchi avec succès']);