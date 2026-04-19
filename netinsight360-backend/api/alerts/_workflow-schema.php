<?php
/**
 * Garantit la disponibilité du schéma nécessaire au workflow d'alertes.
 *
 * Pourquoi ici ?
 * - Évite de bloquer le déploiement avec une migration manuelle immédiate.
 * - Rend les endpoints compatibles même si la base est en retard.
 */
function ensureAlertsWorkflowSchema(PDO $pdo): void
{
    static $checked = false;
    if ($checked) {
        return;
    }

    // Compatibilité MySQL/MariaDB: on évite "ADD COLUMN IF NOT EXISTS"
    // car certaines versions ne le supportent pas.
    $hasColumn = static function (string $table, string $column) use ($pdo): bool {
        $stmt = $pdo->prepare("\n            SELECT COUNT(*)
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
        ");
        $stmt->execute([$table, $column]);
        return (int)$stmt->fetchColumn() > 0;
    };

    // Colonnes de prise en charge (assignation opérateur).
    if (!$hasColumn('alerts', 'acknowledged_at')) {
        $pdo->exec("ALTER TABLE alerts ADD COLUMN acknowledged_at DATETIME NULL");
    }
    if (!$hasColumn('alerts', 'acknowledged_by')) {
        $pdo->exec("ALTER TABLE alerts ADD COLUMN acknowledged_by INT NULL");
    }

    // Colonnes d'escalade (transfert à un niveau de priorité supérieur).
    if (!$hasColumn('alerts', 'escalated_at')) {
        $pdo->exec("ALTER TABLE alerts ADD COLUMN escalated_at DATETIME NULL");
    }
    if (!$hasColumn('alerts', 'escalated_by')) {
        $pdo->exec("ALTER TABLE alerts ADD COLUMN escalated_by INT NULL");
    }

    // Historique des actions sur alertes.
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS alert_history (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            alert_id BIGINT UNSIGNED NOT NULL,
            action_type VARCHAR(40) NOT NULL,
            action_by INT NULL,
            action_note VARCHAR(255) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_alert_history_alert_id (alert_id),
            INDEX idx_alert_history_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $checked = true;
}
