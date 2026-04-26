<?php
/**
 * Désactive le 2FA après double vérification: mot de passe + TOTP/recovery code.
 */

require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../app/helpers/ApiResponse.php';
require_once __DIR__ . '/../../app/helpers/RequestHelper.php';
require_once __DIR__ . '/../../app/helpers/AuthSessionHelper.php';
require_once __DIR__ . '/../../app/helpers/TwoFactorAuthHelper.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ApiResponse::error('Méthode non autorisée', 405);
}

$input = RequestHelper::requireJsonBody();
$currentPassword = RequestHelper::password($input, 'current_password');
$code = RequestHelper::twoFactorCode($input);
if ($currentPassword === '' || $code === '') {
    ApiResponse::error('Mot de passe actuel et code 2FA requis', 400);
}

try {
    $pdo = Database::getLocalConnection();
    TwoFactorAuthHelper::ensureReady($pdo);

    $stmt = $pdo->prepare('SELECT password, two_factor_enabled, two_factor_secret_enc, two_factor_recovery_codes_json FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user || !password_verify($currentPassword, (string) $user['password'])) {
        ApiResponse::error('Mot de passe actuel incorrect', 400);
    }

    if (empty($user['two_factor_enabled']) || empty($user['two_factor_secret_enc'])) {
        ApiResponse::error('Le 2FA n’est pas activé sur ce compte', 409);
    }

    $secret = TwoFactorAuthHelper::decryptSecret((string) $user['two_factor_secret_enc']);
    $isValidTotp = TwoFactorAuthHelper::verifyTotpCode($secret, $code);
    $recovery = ['valid' => false, 'updated_hashes_json' => null];

    if (!$isValidTotp) {
        $recovery = TwoFactorAuthHelper::consumeRecoveryCode($user['two_factor_recovery_codes_json'] ?? null, $code);
        if (!$recovery['valid']) {
            ApiResponse::error('Code TOTP ou code de secours invalide', 400);
        }
    }

    $updateStmt = $pdo->prepare('UPDATE users SET two_factor_enabled = 0, two_factor_secret_enc = NULL, two_factor_recovery_codes_json = NULL, two_factor_confirmed_at = NULL, two_factor_last_used_at = NOW() WHERE id = ?');
    $updateStmt->execute([$_SESSION['user_id']]);

    $_SESSION['two_factor_enabled'] = 0;
    AuthSessionHelper::clearPendingTwoFactorSetup();
    ApiResponse::success(['message' => '2FA TOTP désactivé avec succès']);
} catch (Throwable $e) {
    error_log('[disable-2fa] ' . $e->getMessage());
    ApiResponse::error('Erreur serveur', 500);
}