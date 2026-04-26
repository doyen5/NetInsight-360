<?php
/**
 * NetInsight 360 - Vérification du second facteur TOTP
 * Endpoint: POST /api/auth/verify-2fa.php
 *
 * Le login classique place l'utilisateur en état "pending_2fa".
 * Ce endpoint termine ensuite la connexion après validation du code TOTP
 * ou d'un code de secours consommable une seule fois.
 */

require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/session-bootstrap.php';
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
    ApiResponse::error('Code 2FA requis', 400);
}

try {
    $pending = AuthSessionHelper::getPendingTwoFactor();
    if ($pending === null) {
        ApiResponse::error('Défi 2FA expiré ou introuvable', 401, ['code' => 'TWO_FACTOR_CHALLENGE_EXPIRED']);
    }

    $pdo = Database::getLocalConnection();
    TwoFactorAuthHelper::ensureReady($pdo);

    $stmt = $pdo->prepare('SELECT id, name, email, role, status, last_login, two_factor_enabled, two_factor_secret_enc, two_factor_recovery_codes_json FROM users WHERE id = ?');
    $stmt->execute([(int) $pending['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || ($user['status'] ?? '') !== 'active') {
        AuthSessionHelper::clearPendingTwoFactor();
        ApiResponse::error('Compte indisponible', 401);
    }

    $verified = false;
    $usedRecoveryCode = false;

    if (!empty($user['two_factor_secret_enc'])) {
        $secret = TwoFactorAuthHelper::decryptSecret((string) $user['two_factor_secret_enc']);
        $verified = TwoFactorAuthHelper::verifyTotpCode($secret, $code);
    }

    if (!$verified) {
        $recovery = TwoFactorAuthHelper::consumeRecoveryCode($user['two_factor_recovery_codes_json'] ?? null, $code);
        if ($recovery['valid'] === true) {
            $verified = true;
            $usedRecoveryCode = true;
            $updateRecovery = $pdo->prepare('UPDATE users SET two_factor_recovery_codes_json = ?, two_factor_last_used_at = NOW() WHERE id = ?');
            $updateRecovery->execute([$recovery['updated_hashes_json'], $user['id']]);
            $user['two_factor_recovery_codes_json'] = $recovery['updated_hashes_json'];
        }
    }

    if (!$verified) {
        ApiResponse::error('Code TOTP ou code de secours invalide', 401, ['code' => 'TWO_FACTOR_INVALID']);
    }

    if (!$usedRecoveryCode) {
        $touchStmt = $pdo->prepare('UPDATE users SET two_factor_last_used_at = NOW() WHERE id = ?');
        $touchStmt->execute([$user['id']]);
    }

    $authenticatedUser = AuthSessionHelper::finalizeLogin($pdo, $user, (bool) ($pending['remember'] ?? false));
    ApiResponse::success([
        'csrf_token' => $_SESSION['csrf_token'],
        'user' => $authenticatedUser,
    ]);
} catch (Throwable $e) {
    error_log('[verify-2fa] ' . $e->getMessage());
    ApiResponse::error('Erreur serveur', 500);
}