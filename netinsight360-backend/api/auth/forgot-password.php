<?php
/**
 * NetInsight 360 - Mot de passe oublié
 * Endpoint: POST /api/auth/forgot-password.php
 */

require_once __DIR__ . '/../cors.php';

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

// Stocker le token haché (SHA-256) — le token brut part dans l'URL
$tokenHash = hash('sha256', $token);
$insertStmt = $pdo->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)");
$insertStmt->execute([$email, $tokenHash, $expires]);

// Envoyer l'email de réinitialisation
require_once __DIR__ . '/../../config/mail.php';
require_once __DIR__ . '/../../app/helpers/MailHelper.php';

$mailCfg   = require __DIR__ . '/../../config/mail.php';
$resetLink = rtrim($mailCfg['app_url'], '/') . '/netinsight360-frontend/index.php'
           . '?page=reset-password&token=' . urlencode($token) . '&email=' . urlencode($email);

$bodyHtml = "
<div style=\"font-family:Arial,sans-serif;max-width:600px;margin:auto;\">
  <h2 style=\"color:#00a3c4;\">NetInsight 360 — Réinitialisation de mot de passe</h2>
  <p>Bonjour <strong>" . htmlspecialchars($user['name'], ENT_QUOTES) . "</strong>,</p>
  <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous :</p>
  <p style=\"text-align:center;margin:30px 0;\">
    <a href=\"{$resetLink}\" style=\"background:#00a3c4;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;\">
      Réinitialiser mon mot de passe
    </a>
  </p>
  <p style=\"color:#888;font-size:0.85em;\">Ce lien expire dans <strong>1 heure</strong>.<br>
  Si vous n'avez pas fait cette demande, ignorez cet email.</p>
  <hr style=\"border:none;border-top:1px solid #eee;\">
  <p style=\"color:#aaa;font-size:0.75em;\">NetInsight 360 — Plateforme de supervision réseau</p>
</div>
";

try {
    $mailer = new MailHelper($mailCfg);
    $mailer->send(
        $email,
        'Réinitialisation de votre mot de passe NetInsight 360',
        $bodyHtml
    );
    error_log("[forgot-password] Email envoyé à {$email}");
} catch (Exception $e) {
    // Ne pas exposer l'erreur SMTP au client (sécurité)
    error_log("[forgot-password] Erreur SMTP : " . $e->getMessage());
}

echo json_encode(['success' => true, 'message' => 'Si l\'email existe, un lien de réinitialisation vous sera envoyé']);