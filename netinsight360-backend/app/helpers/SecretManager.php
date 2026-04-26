<?php

require_once __DIR__ . '/EnvHelper.php';

/**
 * Gère le chiffrement applicatif des secrets sensibles stockés en base.
 * Les secrets TOTP restent ainsi chiffrés au repos et ne vivent en clair
 * que le temps strictement nécessaire à la vérification.
 */
class SecretManager
{
    private const CIPHER = 'aes-256-gcm';

    public static function getApplicationKey(): string
    {
        return self::normalizeKey(EnvHelper::assertSecureSecret('APP_KEY', 24));
    }

    public static function getTotpKey(): string
    {
        $totpKey = EnvHelper::get('TOTP_ENCRYPTION_KEY', null);
        if (is_string($totpKey) && trim($totpKey) !== '') {
            return self::normalizeKey(EnvHelper::assertSecureSecret('TOTP_ENCRYPTION_KEY', 24));
        }

        return self::getApplicationKey();
    }

    public static function encrypt(string $plaintext, ?string $key = null): string
    {
        $encryptionKey = $key ?? self::getTotpKey();
        $iv = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt($plaintext, self::CIPHER, $encryptionKey, OPENSSL_RAW_DATA, $iv, $tag);

        if (!is_string($ciphertext) || $tag === '') {
            throw new RuntimeException('Impossible de chiffrer le secret applicatif');
        }

        return base64_encode(json_encode([
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
            'value' => base64_encode($ciphertext),
        ], JSON_THROW_ON_ERROR));
    }

    public static function decrypt(string $payload, ?string $key = null): string
    {
        $decoded = json_decode(base64_decode($payload, true) ?: '', true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Secret chiffré invalide');
        }

        $iv = base64_decode((string) ($decoded['iv'] ?? ''), true);
        $tag = base64_decode((string) ($decoded['tag'] ?? ''), true);
        $value = base64_decode((string) ($decoded['value'] ?? ''), true);
        if ($iv === false || $tag === false || $value === false) {
            throw new RuntimeException('Secret chiffré corrompu');
        }

        $plaintext = openssl_decrypt($value, self::CIPHER, $key ?? self::getTotpKey(), OPENSSL_RAW_DATA, $iv, $tag);
        if (!is_string($plaintext)) {
            throw new RuntimeException('Impossible de déchiffrer le secret applicatif');
        }

        return $plaintext;
    }

    private static function normalizeKey(string $rawKey): string
    {
        if (str_starts_with($rawKey, 'base64:')) {
            $decoded = base64_decode(substr($rawKey, 7), true);
            if ($decoded === false) {
                throw new RuntimeException('Clé applicative base64 invalide');
            }

            return hash('sha256', $decoded, true);
        }

        return hash('sha256', $rawKey, true);
    }
}