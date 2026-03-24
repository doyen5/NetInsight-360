<?php
/**
 * NetInsight 360 - Mot de passe oublié
 * Endpoint: POST /api/auth/forgot-password.php
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

if (!isset($input['email']) || empty($input['email'])) {
    echo json_encode(['success' => false, 'error' => 'Email requis']);
    exit();
}

$email = trim($input['email']);

require_once __DIR__ . '/../../config/database.php';
$pdo = Database::getLocalConnection();

// Vérifier si l'email existe
$stmt = $pdo->prepare("SELECT id, name FROM users WHERE email = ? AND status = 'active'");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user) {
    // Ne pas révéler si l'email existe ou non (sécurité)
    echo json_encode(['success' => true, 'message' => 'Si l\'email existe, un lien de réinitialisation vous sera envoyé']);
    exit();
}

// Générer un token unique
$token = bin2hex(random_bytes(32));
$expires = date('Y-m-d H:i:s', strtotime('+1 hour'));

// Supprimer les anciens tokens pour cet email
$deleteStmt = $pdo->prepare("DELETE FROM password_resets WHERE email = ?");
$deleteStmt->execute([$email]);

// Stocker le nouveau token
$insertStmt = $pdo->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)");
$insertStmt->execute([$email, password_hash($token, PASSWORD_DEFAULT), $expires]);

// Ici, envoyer un email avec le lien de réinitialisation
// $resetLink = "http://localhost:8080/NetInsight%20360/reset-password.php?token={$token}&email=" . urlencode($email);
// mail($email, "Réinitialisation mot de passe NetInsight 360", "Cliquez ici : $resetLink");

echo json_encode(['success' => true, 'message' => 'Si l\'email existe, un lien de réinitialisation vous sera envoyé']);