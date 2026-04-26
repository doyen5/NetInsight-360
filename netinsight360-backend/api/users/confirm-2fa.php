<?php
/**
 * Confirme le secret TOTP temporaire et persiste la configuration.
 * Les recovery codes sont renvoyés une seule fois et stockés hashés en base.
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
$code = RequestHelper::twoFactorCode($input);
if ($code === '') {
    ApiResponse::error('Code TOTP requis', 400);
}

try {
    $pending = AuthSessionHelper::getPendingTwoFactorSetup();
    if ($pending === null || empty($pending['secret'])) {
        ApiResponse::error('Configuration 2FA expirée. Relancez la préparation.', 400);
    }

    if (!TwoFactorAuthHelper::verifyTotpCode((string) $pending['secret'], $code)) {
        ApiResponse::error('Code TOTP invalide', 400);
    }

    $pdo = Database::getLocalConnection();
    TwoFactorAuthHelper::ensureReady($pdo);

    $recoveryCodes = TwoFactorAuthHelper::generateRecoveryCodes();
    $updateStmt = $pdo->prepare('UPDATE users SET two_factor_enabled = 1, two_factor_secret_enc = ?, two_factor_recovery_codes_json = ?, two_factor_confirmed_at = NOW() WHERE id = ?');
    $updateStmt->execute([
        TwoFactorAuthHelper::encryptSecret((string) $pending['secret']),
        $recoveryCodes['hashed'],
        $_SESSION['user_id'],
    ]);

    $_SESSION['two_factor_enabled'] = 1;
    AuthSessionHelper::clearPendingTwoFactorSetup();

    ApiResponse::success([
        'message' => '2FA TOTP activé avec succès',
        'data' => [
            'recovery_codes' => $recoveryCodes['plain'],
        ],
    ]);
} catch (Throwable $e) {
    error_log('[confirm-2fa] ' . $e->getMessage());
    ApiResponse::error('Erreur serveur', 500);
}