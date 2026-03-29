<?php
/**
 * NetInsight 360 - CRON : Purge des données anciennes
 *
 * Supprime :
 *  - kpi_daily_history       > 90 jours
 *  - kpis_ran                > 30 jours
 *  - alerts résolues         > 60 jours
 *  - audit_logs              > 90 jours
 *
 * Exécution : php cleanup-old-logs.php
 */

require_once dirname(__DIR__, 2) . '/config/database.php';

echo "[" . date('Y-m-d H:i:s') . "] Début purge\n";

try {
    $pdo = Database::getLocalConnection();

    $tasks = [
        ['kpi_daily_history', 'recorded_date', 90],
        ['kpis_ran',          'kpi_date',      30],
    ];

    foreach ($tasks as [$table, $col, $days]) {
        // Validation par whitelist — uniquement caractères alphanumériques et underscores
        if (!preg_match('/^[A-Za-z0-9_]+$/', $table) || !preg_match('/^[A-Za-z0-9_]+$/', $col)) {
            continue;
        }
        $stmt = $pdo->prepare("DELETE FROM `$table` WHERE `$col` < DATE_SUB(NOW(), INTERVAL ? DAY)");
        $stmt->execute([$days]);
        echo "  $table : " . $stmt->rowCount() . " ligne(s) supprimée(s) (> $days jours)\n";
    }

    // Alertes résolues
    $stmt = $pdo->prepare("DELETE FROM alerts WHERE status = 'resolved' AND resolved_at < DATE_SUB(NOW(), INTERVAL 60 DAY)");
    $stmt->execute();
    echo "  alerts résolues : " . $stmt->rowCount() . " ligne(s) supprimée(s) (> 60 jours)\n";

    // Audit logs
    if ($pdo->query("SHOW TABLES LIKE 'audit_logs'")->rowCount()) {
        $stmt = $pdo->prepare("DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)");
        $stmt->execute();
        echo "  audit_logs : " . $stmt->rowCount() . " ligne(s) supprimée(s) (> 90 jours)\n";
    }

    echo "[" . date('Y-m-d H:i:s') . "] Purge terminée\n";

} catch (Exception $e) {
    echo "[ERROR] " . $e->getMessage() . "\n";
    exit(1);
}
