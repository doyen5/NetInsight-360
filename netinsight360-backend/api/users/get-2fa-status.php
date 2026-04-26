<?php
/**
 * Expose l'état 2FA de l'utilisateur courant.
 * Cette route alimente la page de sécurité et évite d'exposer le secret lui-même.
 */

require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../app/helpers/ApiResponse.php';
require_once __DIR__ . '/../../app/helpers/AuthSessionHelper.php';
require_once __DIR__ . '/../../app/helpers/TwoFactorAuthHelper.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    ApiResponse::error('Méthode non autorisée', 405);
}

try {
    $pdo = Database::getLocalConnection();
    TwoFactorAuthHelper::ensureReady($pdo);

    $stmt = $pdo->prepare('SELECT two_factor_enabled, two_factor_confirmed_at, two_factor_recovery_codes_json FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        ApiResponse::error('Utilisateur introuvable', 404);
    }

    $recoveryCodes = json_decode((string) ($row['two_factor_recovery_codes_json'] ?? '[]'), true);
    ApiResponse::success([
        'data' => [
            'enabled' => !empty($row['two_factor_enabled']),
            'confirmed_at' => $row['two_factor_confirmed_at'] ?? null,
            'recovery_codes_remaining' => is_array($recoveryCodes) ? count($recoveryCodes) : 0,
            'has_pending_setup' => AuthSessionHelper::getPendingTwoFactorSetup() !== null,
        ],
    ]);
} catch (Throwable $e) {
    error_log('[get-2fa-status] ' . $e->getMessage());
    ApiResponse::error('Erreur serveur', 500);
}