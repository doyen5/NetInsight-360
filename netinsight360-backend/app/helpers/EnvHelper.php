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
        
        if ($path === null) {
            $path = __DIR__ . '/../../.env';
        }
        
        if (!file_exists($path)) {
            // Fichier .env inexistant, utiliser les variables d'environnement système
            self::$loaded = true;
            return false;
        }
        
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        
        foreach ($lines as $line) {
            $line = trim($line);
            
            // Ignorer les commentaires
            if (strpos($line, '#') === 0) {
                continue;
            }
            
            // Ignorer les lignes vides
            if (empty($line)) {
                continue;
            }
            
            // Séparer clé et valeur
            $parts = explode('=', $line, 2);
            if (count($parts) !== 2) {
                continue;
            }
            
            $key = trim($parts[0]);
            $value = trim($parts[1]);
            
            // Supprimer les guillemets si présents
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
        
        self::$loaded = true;
        return true;
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