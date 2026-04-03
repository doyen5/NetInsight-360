<?php
/**
 * NetInsight 360 — AuditHelper
 * Centralise l'écriture des logs d'audit dans la table audit_logs.
 *
 * Usage :
 *   AuditHelper::ensureTable($pdo);          // créer la table si elle n'existe pas
 *   AuditHelper::log($pdo, 'CREATE_USER', action_details...);
 */
class AuditHelper
{
    /**
     * Crée la table audit_logs si elle n'existe pas.
     */
    public static function ensureTable(PDO $pdo): void
    {
        $pdo->exec("CREATE TABLE IF NOT EXISTS audit_logs (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            user_id      INT          NULL,
            user_email   VARCHAR(255) NULL,
            action       VARCHAR(100) NOT NULL,
            entity_type  VARCHAR(50)  NULL COMMENT 'ex: user, kpis_ran, alert',
            entity_id    VARCHAR(100) NULL,
            details      TEXT         NULL,
            ip_address   VARCHAR(45)  NULL,
            created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_id    (user_id),
            INDEX idx_action     (action),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }

    /**
     * Enregistre une entrée dans audit_logs.
     * Non-bloquant : les erreurs sont journalisées mais ne cassent pas l'app.
     */
    public static function log(
        PDO    $pdo,
        string $action,
        ?int   $userId      = null,
        ?string $userEmail  = null,
        ?string $entityType = null,
        ?string $entityId   = null,
        ?string $details    = null
    ): void {
        try {
            self::ensureTable($pdo);
            $stmt = $pdo->prepare("
                INSERT INTO audit_logs (user_id, user_email, action, entity_type, entity_id, details, ip_address)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $userId,
                $userEmail,
                $action,
                $entityType,
                $entityId,
                $details,
                $_SERVER['REMOTE_ADDR'] ?? null,
            ]);
        } catch (Exception $e) {
            error_log('[AuditHelper] Failed: ' . $e->getMessage());
        }
    }

    /**
     * Log depuis les infos de session courante.
     */
    public static function logFromSession(
        PDO    $pdo,
        string $action,
        ?string $entityType = null,
        ?string $entityId   = null,
        ?string $details    = null
    ): void {
        self::log(
            $pdo,
            $action,
            $_SESSION['user_id']    ?? null,
            $_SESSION['user_email'] ?? ($_SESSION['user_name'] ?? null),
            $entityType,
            $entityId,
            $details
        );
    }
}
