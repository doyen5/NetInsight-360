<?php
/**
 * NetInsight 360 - Réinitialisation du mot de passe
 * Endpoint: POST /api/auth/reset-password.php
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost:8080');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

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

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['token']) || !isset($input['email']) || !isset($input['password'])) {
    echo json_encode(['success' => false, 'error' => 'Token, email et mot de passe requis']);
    exit();
}

$token = $input['token'];
$email = trim($input['email']);
$password = $input['password'];

if (strlen($password) < 6) {
    echo json_encode(['success' => false, 'error' => 'Le mot de passe doit contenir au moins 6 caractères']);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
$pdo = Database::getLocalConnection();

// Vérifier le token
$stmt = $pdo->prepare("SELECT token, expires_at FROM password_resets WHERE email = ?");
$stmt->execute([$email]);
$resetData = $stmt->fetch();

if (!$resetData) {
    echo json_encode(['success' => false, 'error' => 'Token invalide ou expiré']);
    exit();
}

if (strtotime($resetData['expires_at']) < time()) {
    echo json_encode(['success' => false, 'error' => 'Token expiré']);
    exit();
}

if (!password_verify($token, $resetData['token'])) {
    echo json_encode(['success' => false, 'error' => 'Token invalide']);
    exit();
}

// Mettre à jour le mot de passe
$hashedPassword = password_hash($password, PASSWORD_DEFAULT);
$updateStmt = $pdo->prepare("UPDATE users SET password = ? WHERE email = ?");
$updateStmt->execute([$hashedPassword, $email]);

// Supprimer le token utilisé
$deleteStmt = $pdo->prepare("DELETE FROM password_resets WHERE email = ?");
$deleteStmt->execute([$email]);

// Supprimer tous les tokens "Rester connecté" de l'utilisateur
$deleteTokensStmt = $pdo->prepare("DELETE FROM user_tokens WHERE user_id = (SELECT id FROM users WHERE email = ?)");
$deleteTokensStmt->execute([$email]);

echo json_encode(['success' => true, 'message' => 'Mot de passe réinitialisé avec succès']);