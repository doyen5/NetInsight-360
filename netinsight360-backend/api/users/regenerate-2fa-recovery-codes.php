<?php
/**
 * Régénère les codes de secours 2FA après une validation forte.
 */

require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../app/helpers/ApiResponse.php';
require_once __DIR__ . '/../../app/helpers/RequestHelper.php';
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
    $isValid = TwoFactorAuthHelper::verifyTotpCode($secret, $code);
    if (!$isValid) {
        $recovery = TwoFactorAuthHelper::consumeRecoveryCode($user['two_factor_recovery_codes_json'] ?? null, $code);
        if (!$recovery['valid']) {
            ApiResponse::error('Code TOTP ou code de secours invalide', 400);
        }
    }

    $newCodes = TwoFactorAuthHelper::generateRecoveryCodes();
    $updateStmt = $pdo->prepare('UPDATE users SET two_factor_recovery_codes_json = ?, two_factor_last_used_at = NOW() WHERE id = ?');
    $updateStmt->execute([$newCodes['hashed'], $_SESSION['user_id']]);

    ApiResponse::success([
        'message' => 'Nouveaux codes de secours générés',
        'data' => [
            'recovery_codes' => $newCodes['plain'],
        ],
    ]);
} catch (Throwable $e) {
    error_log('[regenerate-2fa-recovery-codes] ' . $e->getMessage());
    ApiResponse::error('Erreur serveur', 500);
}