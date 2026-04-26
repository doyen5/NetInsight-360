<?php

require_once __DIR__ . '/../../app/helpers/EnvHelper.php';

if (!function_exists('ni360_env_bool')) {
    function ni360_env_bool(string $key, bool $default): bool
    {
        $value = EnvHelper::get($key, null);
        if ($value === null || $value === '') {
            return $default;
        }

        $normalized = strtolower(trim((string) $value));
        return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
    }
}

if (!function_exists('ni360_is_https')) {
    function ni360_is_https(): bool
    {
        if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
            return true;
        }

        $forwardedProto = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
        return $forwardedProto === 'https';
    }
}

if (!function_exists('ni360_session_cookie_params')) {
    function ni360_session_cookie_params(): array
    {
        $secureByConfig = EnvHelper::get('SESSION_SECURE', 'auto');
        $secure = strtolower((string) $secureByConfig) === 'auto'
            ? ni360_is_https()
            : ni360_env_bool('SESSION_SECURE', false);

        return [
            'lifetime' => max(0, (int) EnvHelper::get('SESSION_LIFETIME', 0)),
            'path' => '/',
            'domain' => '',
            'secure' => $secure,
            'httponly' => ni360_env_bool('SESSION_HTTP_ONLY', true),
            'samesite' => EnvHelper::get('SESSION_SAMESITE', 'Strict'),
        ];
    }
}

if (!function_exists('ni360_start_session')) {
    function ni360_start_session(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        $sessionName = trim((string) EnvHelper::get('SESSION_NAME', 'netinsight_session'));
        if ($sessionName !== '') {
            session_name($sessionName);
        }

        session_set_cookie_params(ni360_session_cookie_params());
        session_start();
    }
}

if (!function_exists('ni360_remember_cookie_options')) {
    function ni360_remember_cookie_options(int $expiresAt): array
    {
        $sessionParams = ni360_session_cookie_params();

        return [
            'expires' => $expiresAt,
            'path' => '/',
            'domain' => '',
            'secure' => $sessionParams['secure'],
            'httponly' => true,
            'samesite' => $sessionParams['samesite'],
        ];
    }
}