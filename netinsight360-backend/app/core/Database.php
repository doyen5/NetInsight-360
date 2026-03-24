<?php
/**
 * NetInsight 360 - Gestionnaire de bases de données
 * 
 * Classe unifiée pour interagir avec les bases locale et distante
 */

class Database
{
    /** @var PDO Instance de connexion locale */
    private static $localConnection = null;
    
    /** @var PDO Instance de connexion distante */
    private static $remoteConnection = null;
    
    /** @var array Log des erreurs */
    private static $errorLog = [];
    
    /** @var bool Indique si les variables d'environnement sont chargées */
    private static $envLoaded = false;
    
    /**
     * Charge les variables d'environnement depuis .env
     */
    private static function loadEnv(): void
    {
        if (self::$envLoaded) {
            return;
        }
        
        $envFile = __DIR__ . '/../.env';
        if (file_exists($envFile)) {
            $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if (strpos($line, '#') === 0 || empty($line)) {
                    continue;
                }
                
                $parts = explode('=', $line, 2);
                if (count($parts) === 2) {
                    $key = trim($parts[0]);
                    $value = trim($parts[1]);
                    
                    if (preg_match('/^"(.*)"$/', $value, $matches)) {
                        $value = $matches[1];
                    } elseif (preg_match("/^'(.*)'$/", $value, $matches)) {
                        $value = $matches[1];
                    }
                    
                    putenv("{$key}={$value}");
                    $_ENV[$key] = $value;
                }
            }
        }
        
        self::$envLoaded = true;
    }
    
    /**
     * Récupère une variable d'environnement
     */
    private static function getEnv(string $key, $default = null)
    {
        self::loadEnv();
        
        $value = getenv($key);
        if ($value !== false) {
            return $value;
        }
        
        return $_ENV[$key] ?? $default;
    }
    
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
                $host = self::getEnv('DB_HOST', 'localhost');
                $port = self::getEnv('DB_PORT', '3306');
                $dbname = self::getEnv('DB_NAME', 'netinsight360');
                $username = self::getEnv('DB_USER', 'root');
                $password = self::getEnv('DB_PASS', '');
                $charset = self::getEnv('DB_CHARSET', 'utf8mb4');
                
                $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";
                
                $options = [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                    PDO::ATTR_PERSISTENT => false,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES {$charset}"
                ];
                
                self::$localConnection = new PDO($dsn, $username, $password, $options);
                self::log('Connexion locale établie avec succès', 'info');
                
            } catch (PDOException $e) {
                self::log('Erreur connexion locale: ' . $e->getMessage(), 'error');
                throw $e;
            }
        }
        
        return self::$localConnection;
    }
    
    /**
     * Récupère la connexion à la base de données distante
     * 
     * @return PDO
     * @throws PDOException
     */
    public static function getRemoteConnection(): PDO
    {
        if (self::$remoteConnection === null) {
            try {
                $host = self::getEnv('REMOTE_DB_HOST', '10.171.16.120');
                $port = self::getEnv('REMOTE_DB_PORT', '3306');
                $dbname = self::getEnv('REMOTE_DB_NAME', 'NetPulseAI_NetworkInsight');
                $username = self::getEnv('REMOTE_DB_USER', 'fo_npm');
                $password = self::getEnv('REMOTE_DB_PASS', 'fo_npm');
                $charset = self::getEnv('REMOTE_DB_CHARSET', 'utf8mb4');
                
                $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";
                
                $options = [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_TIMEOUT => 30,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES {$charset}"
                ];
                
                self::$remoteConnection = new PDO($dsn, $username, $password, $options);
                self::log('Connexion distante établie avec succès', 'info');
                
            } catch (PDOException $e) {
                self::log('Erreur connexion distante: ' . $e->getMessage(), 'error');
                throw $e;
            }
        }
        
        return self::$remoteConnection;
    }
    
    /**
     * Récupère la connexion locale (alias)
     * 
     * @return PDO
     */
    public static function getInstance(): PDO
    {
        return self::getLocalConnection();
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
            self::log('Test connexion distante échoué: ' . $e->getMessage(), 'warning');
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
            self::log('Test connexion locale échoué: ' . $e->getMessage(), 'warning');
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
            @mkdir($logDir, 0777, true);
        }
        
        $logFile = $logDir . 'db_connections.log';
        $timestamp = date('Y-m-d H:i:s');
        $logEntry = "[{$timestamp}] [{$level}] {$message}" . PHP_EOL;
        
        @file_put_contents($logFile, $logEntry, FILE_APPEND);
        
        self::$errorLog[] = [
            'timestamp' => $timestamp,
            'level' => $level,
            'message' => $message
        ];
        
        if (count(self::$errorLog) > 100) {
            array_shift(self::$errorLog);
        }
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

/**
 * Fonction helper pour la connexion locale
 * 
 * @return PDO
 */
function db(): PDO
{
    return Database::getLocalConnection();
}

/**
 * Fonction helper pour la connexion distante
 * 
 * @return PDO
 */
function remote_db(): PDO
{
    return Database::getRemoteConnection();
}