<?php
/**
 * Prépare l'enrôlement TOTP de l'utilisateur courant.
 * On vérifie d'abord le mot de passe pour éviter qu'une session volée n'active un second facteur.
 */

require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../app/helpers/ApiResponse.php';
require_once __DIR__ . '/../../app/helpers/RequestHelper.php';
require_once __DIR__ . '/../../app/helpers/AuthSessionHelper.php';
require_once __DIR__ . '/../../app/helpers/TwoFactorAuthHelper.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/constants.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ApiResponse::error('Méthode non autorisée', 405);
}

$input = RequestHelper::requireJsonBody();
$currentPassword = RequestHelper::password($input, 'current_password');
if ($currentPassword === '') {
    ApiResponse::error('Mot de passe actuel requis', 400);
}

try {
    $pdo = Database::getLocalConnection();
    TwoFactorAuthHelper::ensureReady($pdo);

    $stmt = $pdo->prepare('SELECT id, name, email, password, two_factor_enabled FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user || !password_verify($currentPassword, (string) $user['password'])) {
        ApiResponse::error('Mot de passe actuel incorrect', 400);
    }

    if (!empty($user['two_factor_enabled'])) {
        ApiResponse::error('Le 2FA TOTP est déjà activé sur ce compte', 409);
    }

    $profile = TwoFactorAuthHelper::generateProfile(APP_NAME, (string) $user['email']);
    AuthSessionHelper::storePendingTwoFactorSetup($profile['secret']);

    ApiResponse::success([
        'data' => [
            'secret' => $profile['secret'],
            'otpauth_uri' => $profile['otpauth_uri'],
            'qr_svg' => $profile['qr_svg'],
            'expires_in' => TWO_FACTOR_SETUP_TTL_SECONDS,
        ],
    ]);
} catch (Throwable $e) {
    error_log('[setup-2fa] ' . $e->getMessage());
    ApiResponse::error('Erreur serveur', 500);
}