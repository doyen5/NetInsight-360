<?php

/**
 * Centralise le parsing JSON et quelques nettoyages fréquents.
 */
class RequestHelper
{
    public static function requireJsonBody(): array
    {
        $rawInput = file_get_contents('php://input');
        $input = json_decode($rawInput ?: '', true);

        if (json_last_error() !== JSON_ERROR_NONE || !is_array($input)) {
            ApiResponse::error('Requête JSON invalide', 400);
        }

        return $input;
    }

    public static function string(array $input, string $key, string $default = ''): string
    {
        return trim((string) ($input[$key] ?? $default));
    }

    public static function password(array $input, string $key): string
    {
        return (string) ($input[$key] ?? '');
    }

    /**
     * Autorise un code TOTP ou un code de secours alphanumérique.
     */
    public static function twoFactorCode(array $input, string $key = 'code'): string
    {
        $value = strtoupper(preg_replace('/[^A-Z0-9-]/', '', (string) ($input[$key] ?? '')) ?? '');
        return trim($value);
    }
}