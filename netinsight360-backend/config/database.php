<?php
/**
 * NetInsight 360 - Configuration des bases de données
 * 
 * Ce fichier gère les connexions aux bases de données :
 * - locale (netinsight360)
 * - distante (NetPulseAI_NetworkInsight)
 * 
 * Utilisation:
 *   $localDb = DatabaseConfig::getLocalConnection();
 *   $remoteDb = DatabaseConfig::getRemoteConnection();
 */

// Chargement des variables d'environnement
require_once __DIR__ . '/../app/helpers/EnvHelper.php';

class DatabaseConfig
{
    /** @var PDO Instance de connexion locale */
    private static $localConnection = null;
    
    /** @var PDO Instance de connexion distante */
    private static $remoteConnection = null;
    
    /** @var array Log des erreurs */
    private static $errorLog = [];
    
    /**
     * Récupère la connexion à la base de données locale
     * 
     * @return PDO
     * @throws PDOException
     */
    public static function getLocalConnection(): PDO
    {
        if (self::$localConnection === null) {
            try {
                $host = EnvHelper::get('DB_HOST', 'localhost');
                $port = EnvHelper::get('DB_PORT', '3306');
                $dbname = EnvHelper::get('DB_NAME', 'netinsight360');
                $username = EnvHelper::get('DB_USER', 'root');
                $password = EnvHelper::get('DB_PASS', '');
                $charset = EnvHelper::get('DB_CHARSET', 'utf8mb4');
                
                $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";
                
                $options = [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                    PDO::ATTR_PERSISTENT => false,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES {$charset}, time_zone = '+00:00'"
                ];
                
                self::$localConnection = new PDO($dsn, $username, $password, $options);
                
                // Journaliser la connexion réussie
                self::log('Connexion locale établie avec succès', 'info');
                
            } catch (PDOException $e) {
                self::log('Erreur connexion locale: ' . $e->getMessage(), 'error');
                throw $e;
            }
        }
        
        return self::$localConnection;
    }
    
    /**
     * Récupère la connexion à la base de données distante (NetPulseAI_NetworkInsight)
     * 
     * @return PDO
     * @throws PDOException
     */
    public static function getRemoteConnection(): PDO
    {
        if (self::$remoteConnection === null) {
            try {
                $host = EnvHelper::get('REMOTE_DB_HOST', '10.171.16.120');
                $port = EnvHelper::get('REMOTE_DB_PORT', '3306');
                $dbname = EnvHelper::get('REMOTE_DB_NAME', 'NetPulseAI_NetworkInsight');
                $username = EnvHelper::get('REMOTE_DB_USER', 'fo_npm');
                $password = EnvHelper::get('REMOTE_DB_PASS', 'fo_npm');
                $charset = EnvHelper::get('REMOTE_DB_CHARSET', 'utf8mb4');
                
                $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";
                
                $options = [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_TIMEOUT => 30, // Timeout de 30 secondes
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES {$charset}"
                ];
                
                self::$remoteConnection = new PDO($dsn, $username, $password, $options);
                
                // Journaliser la connexion réussie
                self::log('Connexion distante établie avec succès', 'info');
                
            } catch (PDOException $e) {
                self::log('Erreur connexion distante: ' . $e->getMessage(), 'error');
                throw $e;
            }
        }
        
        return self::$remoteConnection;
    }
    
    /**
     * Teste la connexion à la base distante
     * 
     * @return bool
     */
    public static function testRemoteConnection(): bool
    {
        try {
            $pdo = self::getRemoteConnection();
            $pdo->query('SELECT 1');
            return true;
        } catch (PDOException $e) {
            return false;
        }
    }
    
    /**
     * Teste la connexion à la base locale
     * 
     * @return bool
     */
    public static function testLocalConnection(): bool
    {
        try {
            $pdo = self::getLocalConnection();
            $pdo->query('SELECT 1');
            return true;
        } catch (PDOException $e) {
            return false;
        }
    }
    
    /**
     * Ferme les connexions actives
     */
    public static function closeConnections(): void
    {
        self::$localConnection = null;
        self::$remoteConnection = null;
        self::log('Connexions fermées', 'info');
    }
    
    /**
     * Journalise les événements de connexion
     * 
     * @param string $message
     * @param string $level
     */
    private static function log(string $message, string $level = 'info'): void
    {
        $logDir = __DIR__ . '/../logs/';
        if (!is_dir($logDir)) {
            mkdir($logDir, 0777, true);
        }
        
        $logFile = $logDir . 'db_connections.log';
        $timestamp = date('Y-m-d H:i:s');
        $logEntry = "[{$timestamp}] [{$level}] {$message}" . PHP_EOL;
        
        file_put_contents($logFile, $logEntry, FILE_APPEND);
        
        // Stocker également en mémoire pour débogage
        self::$errorLog[] = [
            'timestamp' => $timestamp,
            'level' => $level,
            'message' => $message
        ];
    }
    
    /**
     * Récupère les logs des connexions
     * 
     * @return array
     */
    public static function getLogs(): array
    {
        return self::$errorLog;
    }
}