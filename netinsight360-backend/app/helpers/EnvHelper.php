<?php
/**
 * NetInsight 360 - Helper pour les variables d'environnement
 * 
 * Gère le chargement et l'accès aux variables d'environnement depuis le fichier .env
 */

class EnvHelper
{
    /** @var array Variables d'environnement chargées */
    private static $variables = [];
    
    /** @var bool Flag indiquant si le fichier .env a été chargé */
    private static $loaded = false;

    /** @var array<string> Valeurs considérées comme placeholders non sûrs */
    private static array $unsafePlaceholders = [
        '',
        'change-me',
        'changeme',
        'example',
        'placeholder',
        'secret',
        'password',
        'default',
        'fo_npm',
    ];
    
    /**
     * Charge le fichier .env
     * 
     * @param string $path Chemin vers le fichier .env
     * @return bool
     */
    public static function load(?string $path = null): bool
    {
        if (self::$loaded) {
            return true;
        }

        $candidates = [];
        if ($path !== null) {
            $candidates[] = $path;
        } else {
            $candidates[] = __DIR__ . '/../../.env';
            $candidates[] = __DIR__ . '/../../.env.local';
        }

        $loadedAny = false;
        foreach ($candidates as $candidate) {
            if (!is_string($candidate) || !file_exists($candidate)) {
                continue;
            }

            $loadedAny = true;
            $lines = file($candidate, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($lines === false) {
                continue;
            }

            foreach ($lines as $line) {
                $line = trim($line);

                if (strpos($line, '#') === 0 || $line === '') {
                    continue;
                }

                $parts = explode('=', $line, 2);
                if (count($parts) !== 2) {
                    continue;
                }

                $key = trim($parts[0]);
                $value = trim($parts[1]);

                if (preg_match('/^"(.*)"$/', $value, $matches)) {
                    $value = $matches[1];
                } elseif (preg_match("/^'(.*)'$/", $value, $matches)) {
                    $value = $matches[1];
                }

                self::$variables[$key] = $value;
                putenv("{$key}={$value}");
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }

        self::$loaded = true;
        return $loadedAny;
    }
    
    /**
     * Récupère une variable d'environnement
     * 
     * @param string $key Nom de la variable
     * @param mixed $default Valeur par défaut
     * @return mixed
     */
    public static function get(string $key, $default = null)
    {
        if (!self::$loaded) {
            self::load();
        }
        
        // Priorité: getenv() > variable chargée > default
        $value = getenv($key);
        if ($value !== false) {
            return $value;
        }
        
        if (array_key_exists($key, self::$variables)) {
            return self::$variables[$key];
        }
        
        if (array_key_exists($key, $_ENV)) {
            return $_ENV[$key];
        }
        
        return $default;
    }

    /**
     * Récupère une variable obligatoire.
     */
    public static function require(string $key): string
    {
        $value = self::get($key, null);
        if (!is_string($value) || trim($value) === '') {
            throw new RuntimeException("Variable d'environnement requise absente: {$key}");
        }

        return $value;
    }

    /**
     * Retourne une variable de type booléen.
     */
    public static function getBool(string $key, bool $default = false): bool
    {
        $value = self::get($key, null);
        if ($value === null) {
            return $default;
        }

        return in_array(strtolower(trim((string) $value)), ['1', 'true', 'yes', 'on'], true);
    }

    /**
     * Indique si l'application tourne en production.
     */
    public static function isProduction(): bool
    {
        return strtolower((string) self::get('APP_ENV', 'development')) === 'production';
    }

    /**
     * Vérifie qu'un secret n'est pas un placeholder faible.
     */
    public static function assertSecureSecret(string $key, int $minLength = 24): string
    {
        $value = trim(self::require($key));
        if (strlen($value) < $minLength || self::isUnsafePlaceholder($value)) {
            throw new RuntimeException("Secret d'environnement invalide pour {$key}");
        }

        return $value;
    }

    /**
     * Masque une valeur sensible pour les logs de diagnostic.
     */
    public static function mask(string $value, int $visible = 4): string
    {
        if ($value === '') {
            return '';
        }

        $visible = max(1, min($visible, strlen($value)));
        return substr($value, 0, $visible) . str_repeat('*', max(4, strlen($value) - $visible));
    }

    /**
     * Génère une clé aléatoire encodée en base64 avec préfixe explicite.
     */
    public static function generateBase64Secret(int $bytes = 32): string
    {
        return 'base64:' . base64_encode(random_bytes($bytes));
    }

    private static function isUnsafePlaceholder(string $value): bool
    {
        return in_array(strtolower(trim($value)), self::$unsafePlaceholders, true);
    }
    
    /**
     * Définit une variable d'environnement
     * 
     * @param string $key
     * @param mixed $value
     */
    public static function set(string $key, $value): void
    {
        self::$variables[$key] = $value;
        putenv("{$key}={$value}");
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
    
    /**
     * Vérifie si une variable existe
     * 
     * @param string $key
     * @return bool
     */
    public static function has(string $key): bool
    {
        return self::get($key) !== null;
    }
    
    /**
     * Récupère toutes les variables
     * 
     * @return array
     */
    public static function all(): array
    {
        if (!self::$loaded) {
            self::load();
        }
        
        return self::$variables;
    }
}