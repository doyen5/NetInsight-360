<?php

require_once __DIR__ . '/../../api/auth/session-bootstrap.php';

/**
 * Encapsule le cycle de vie de la session utilisateur pour éviter les duplications
 * entre login classique, 2FA et restauration via remember_token.
 */
class AuthSessionHelper
{
    public static function finalizeLogin(PDO $pdo, array $user, bool $remember): array
    {
        ni360_start_session();
        session_regenerate_id(true);

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_name'] = $user['name'];
        $_SESSION['user_email'] = $user['email'];
        $_SESSION['user_role'] = $user['role'];
        $_SESSION['two_factor_enabled'] = !empty($user['two_factor_enabled']) ? 1 : 0;
        $_SESSION['logged_in_at'] = time();
        $_SESSION['authenticated_at'] = time();
        $_SESSION['last_activity_at'] = time();
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        $_SESSION['two_factor_verified_at'] = time();
        unset($_SESSION['pending_2fa']);

        $updateStmt = $pdo->prepare('UPDATE users SET last_login = NOW(), last_ip = ? WHERE id = ?');
        $updateStmt->execute([$_SERVER['REMOTE_ADDR'] ?? null, $user['id']]);

        if ($remember) {
            self::issueRememberToken($pdo, (int) $user['id']);
        }

        return [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'loggedInAt' => date('Y-m-d H:i:s'),
            'lastLogin' => $user['last_login'] ?? null,
            'twoFactorEnabled' => !empty($user['two_factor_enabled']),
        ];
    }

    public static function storePendingTwoFactor(array $user, bool $remember): void
    {
        ni360_start_session();
        session_regenerate_id(true);

        $_SESSION['pending_2fa'] = [
            'user_id' => (int) $user['id'],
            'name' => (string) $user['name'],
            'email' => (string) $user['email'],
            'role' => (string) $user['role'],
            'remember' => $remember,
            'last_login' => $user['last_login'] ?? null,
            'started_at' => time(),
            'expires_at' => time() + (defined('TWO_FACTOR_CHALLENGE_TTL_SECONDS') ? TWO_FACTOR_CHALLENGE_TTL_SECONDS : 300),
        ];
    }

    public static function getPendingTwoFactor(): ?array
    {
        ni360_start_session();
        $pending = $_SESSION['pending_2fa'] ?? null;
        if (!is_array($pending)) {
            return null;
        }

        if (((int) ($pending['expires_at'] ?? 0)) < time()) {
            unset($_SESSION['pending_2fa']);
            return null;
        }

        return $pending;
    }

    public static function clearPendingTwoFactor(): void
    {
        ni360_start_session();
        unset($_SESSION['pending_2fa']);
    }

    public static function storePendingTwoFactorSetup(string $secret): void
    {
        ni360_start_session();
        $_SESSION['pending_2fa_setup'] = [
            'secret' => $secret,
            'issued_at' => time(),
            'expires_at' => time() + (defined('TWO_FACTOR_SETUP_TTL_SECONDS') ? TWO_FACTOR_SETUP_TTL_SECONDS : 600),
        ];
    }

    public static function getPendingTwoFactorSetup(): ?array
    {
        ni360_start_session();
        $pending = $_SESSION['pending_2fa_setup'] ?? null;
        if (!is_array($pending)) {
            return null;
        }

        if (((int) ($pending['expires_at'] ?? 0)) < time()) {
            unset($_SESSION['pending_2fa_setup']);
            return null;
        }

        return $pending;
    }

    public static function clearPendingTwoFactorSetup(): void
    {
        ni360_start_session();
        unset($_SESSION['pending_2fa_setup']);
    }

    private static function issueRememberToken(PDO $pdo, int $userId): void
    {
        $token = bin2hex(random_bytes(32));
        $expires = date('Y-m-d H:i:s', strtotime('+30 days'));

        $tableExists = $pdo->query("SHOW TABLES LIKE 'user_tokens'")->rowCount() > 0;
        if (!$tableExists) {
            return;
        }

        $deleteStmt = $pdo->prepare('DELETE FROM user_tokens WHERE user_id = ?');
        $deleteStmt->execute([$userId]);

        $insertStmt = $pdo->prepare('INSERT INTO user_tokens (user_id, token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)');
        $insertStmt->execute([
            $userId,
            hash('sha256', $token),
            $expires,
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null,
        ]);

        setcookie('remember_token', $token, ni360_remember_cookie_options(time() + 86400 * 30));
    }
}