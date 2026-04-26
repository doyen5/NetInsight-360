<?php

require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/SecretManager.php';
require_once __DIR__ . '/SecuritySchemaHelper.php';

use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use OTPHP\TOTP;

/**
 * Encapsule le workflow TOTP: génération, QR, vérification et recovery codes.
 */
class TwoFactorAuthHelper
{
    public static function ensureReady(PDO $pdo): void
    {
        SecuritySchemaHelper::ensureSecuritySchema($pdo);
    }

    public static function generateProfile(string $issuer, string $label): array
    {
        $totp = TOTP::generate();
        $totp->setLabel($label);
        $totp->setIssuer($issuer);
        $totp->setDigits(6);
        $totp->setPeriod(30);

        $provisioningUri = $totp->getProvisioningUri();

        return [
            'secret' => $totp->getSecret(),
            'otpauth_uri' => $provisioningUri,
            'qr_svg' => self::renderQrSvg($provisioningUri),
        ];
    }

    public static function verifyTotpCode(string $secret, string $code): bool
    {
        $normalized = self::normalizeTotpCode($code);
        if ($normalized === '') {
            return false;
        }

        $totp = TOTP::createFromSecret($secret);
        return $totp->verify($normalized, null, 30);
    }

    public static function encryptSecret(string $secret): string
    {
        return SecretManager::encrypt($secret, SecretManager::getTotpKey());
    }

    public static function decryptSecret(string $encryptedSecret): string
    {
        return SecretManager::decrypt($encryptedSecret, SecretManager::getTotpKey());
    }

    /**
     * Génère des codes de secours lisibles une seule fois côté utilisateur.
     * Les versions persistées sont hashées pour éviter toute fuite exploitable.
     *
     * @return array{plain: array<int, string>, hashed: string}
     */
    public static function generateRecoveryCodes(int $count = 8): array
    {
        $plainCodes = [];
        $hashedCodes = [];

        for ($index = 0; $index < $count; $index++) {
            $code = strtoupper(substr(bin2hex(random_bytes(5)), 0, 10));
            $formatted = substr($code, 0, 5) . '-' . substr($code, 5, 5);
            $plainCodes[] = $formatted;
            $hashedCodes[] = password_hash($formatted, PASSWORD_DEFAULT);
        }

        return [
            'plain' => $plainCodes,
            'hashed' => json_encode($hashedCodes, JSON_THROW_ON_ERROR),
        ];
    }

    /**
     * Permet l'usage d'un code de secours en le consommant immédiatement.
     *
     * @return array{valid: bool, updated_hashes_json: string|null}
     */
    public static function consumeRecoveryCode(?string $hashesJson, string $inputCode): array
    {
        if (!is_string($hashesJson) || trim($hashesJson) === '') {
            return ['valid' => false, 'updated_hashes_json' => null];
        }

        $hashes = json_decode($hashesJson, true);
        if (!is_array($hashes)) {
            return ['valid' => false, 'updated_hashes_json' => null];
        }

        $normalizedInput = strtoupper(trim($inputCode));
        foreach ($hashes as $index => $hash) {
            if (is_string($hash) && password_verify($normalizedInput, $hash)) {
                unset($hashes[$index]);

                return [
                    'valid' => true,
                    'updated_hashes_json' => json_encode(array_values($hashes), JSON_THROW_ON_ERROR),
                ];
            }
        }

        return ['valid' => false, 'updated_hashes_json' => null];
    }

    public static function normalizeTotpCode(string $code): string
    {
        return preg_replace('/\D/', '', $code) ?? '';
    }

    private static function renderQrSvg(string $content): string
    {
        $renderer = new ImageRenderer(
            new RendererStyle(220),
            new SvgImageBackEnd()
        );

        return (new Writer($renderer))->writeString($content);
    }
}