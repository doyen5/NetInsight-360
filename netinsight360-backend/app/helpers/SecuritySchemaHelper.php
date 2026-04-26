<?php

/**
 * Initialise les tables et colonnes de sécurité au fil de l'eau.
 * Ce choix évite de bloquer le déploiement en l'absence d'un système de migrations.
 */
class SecuritySchemaHelper
{
    public static function ensureSecuritySchema(PDO $pdo): void
    {
        self::ensureUsersTwoFactorColumns($pdo);
        self::ensurePasswordResetAttemptsTable($pdo);
    }

    public static function ensurePasswordResetAttemptsTable(PDO $pdo): void
    {
        $pdo->exec("CREATE TABLE IF NOT EXISTS password_reset_attempts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ip_address VARCHAR(45) NOT NULL,
            email VARCHAR(255) NOT NULL,
            action_type ENUM('request', 'confirm') NOT NULL,
            attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_reset_attempt_lookup (ip_address, email, action_type),
            INDEX idx_reset_attempted_at (attempted_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    public static function ensureUsersTwoFactorColumns(PDO $pdo): void
    {
        $columns = self::getUsersTableColumns($pdo);

        $requiredColumns = [
            'two_factor_enabled' => "ALTER TABLE users ADD COLUMN two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER email_verified",
            'two_factor_secret_enc' => "ALTER TABLE users ADD COLUMN two_factor_secret_enc TEXT NULL AFTER two_factor_enabled",
            'two_factor_recovery_codes_json' => "ALTER TABLE users ADD COLUMN two_factor_recovery_codes_json LONGTEXT NULL AFTER two_factor_secret_enc",
            'two_factor_confirmed_at' => "ALTER TABLE users ADD COLUMN two_factor_confirmed_at DATETIME NULL AFTER two_factor_recovery_codes_json",
            'two_factor_last_used_at' => "ALTER TABLE users ADD COLUMN two_factor_last_used_at DATETIME NULL AFTER two_factor_confirmed_at",
        ];

        foreach ($requiredColumns as $column => $sql) {
            if (!isset($columns[$column])) {
                $pdo->exec($sql);
            }
        }
    }

    /**
     * Retourne les colonnes existantes de la table users pour éviter les ALTER inutiles.
     *
     * @return array<string, true>
     */
    private static function getUsersTableColumns(PDO $pdo): array
    {
        $stmt = $pdo->query('SHOW COLUMNS FROM users');
        $columns = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $column) {
            if (isset($column['Field'])) {
                $columns[(string) $column['Field']] = true;
            }
        }

        return $columns;
    }
}