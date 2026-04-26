<?php
/**
 * NetInsight 360 - Réinitialisation du mot de passe
 * Endpoint: POST /api/auth/reset-password.php
 */

require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../../config/constants.php';

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

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Requête JSON invalide']);
    exit();
}

if (!isset($input['token']) || !isset($input['email']) || !isset($input['password'])) {
    echo json_encode(['success' => false, 'error' => 'Token, email et mot de passe requis']);
    exit();
}

$token = $input['token'];
$email = trim($input['email']);
$password = $input['password'];

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Format email invalide']);
    exit();
}

if (!is_string($password) || strlen($password) < MIN_PASSWORD_LENGTH) {
    echo json_encode(['success' => false, 'error' => 'Le mot de passe doit contenir au moins ' . MIN_PASSWORD_LENGTH . ' caractères']);
    exit();
}

if (strlen($password) > MAX_PASSWORD_LENGTH) {
    echo json_encode(['success' => false, 'error' => 'Le mot de passe est trop long']);
    exit();
}

require_once __DIR__ . '/../../config/database.php';
$pdo = Database::getLocalConnection();

$pdo->exec("CREATE TABLE IF NOT EXISTS password_reset_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    email VARCHAR(255) NOT NULL,
    action_type ENUM('request', 'confirm') NOT NULL,
    attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_reset_attempt_lookup (ip_address, email, action_type),
    INDEX idx_reset_attempted_at (attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$window = date('Y-m-d H:i:s', strtotime('-' . PASSWORD_RESET_ATTEMPT_TIMEOUT . ' minutes'));
$attemptStmt = $pdo->prepare("SELECT COUNT(*) FROM password_reset_attempts WHERE action_type = 'confirm' AND (ip_address = ? OR email = ?) AND attempted_at > ?");
$attemptStmt->execute([$ip, $email, $window]);
if ((int) $attemptStmt->fetchColumn() >= MAX_PASSWORD_RESET_CONFIRM_ATTEMPTS) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Trop de tentatives de réinitialisation. Réessayez plus tard.']);
    exit();
}

$pdo->prepare("INSERT INTO password_reset_attempts (ip_address, email, action_type) VALUES (?, ?, 'confirm')")
    ->execute([$ip, $email]);
$pdo->exec("DELETE FROM password_reset_attempts WHERE attempted_at < DATE_SUB(NOW(), INTERVAL 1 DAY)");

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

if (!hash_equals((string) $resetData['token'], hash('sha256', (string) $token))) {
    echo json_encode(['success' => false, 'error' => 'Token invalide']);
    exit();
}

$userStmt = $pdo->prepare("SELECT id, status FROM users WHERE email = ?");
$userStmt->execute([$email]);
$user = $userStmt->fetch();

if (!$user || ($user['status'] ?? '') !== 'active') {
    echo json_encode(['success' => false, 'error' => 'Token invalide ou expiré']);
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