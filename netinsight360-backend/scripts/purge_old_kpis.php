<?php
/**
 * NetInsight 360 - Script de purge des données anciennes
 * -------------------------------------------------------
 * Supprime les données horaires de kpis_ran et kpis_core
 * de plus de RETENTION_MONTHS mois.
 *
 * PRÉREQUIS : kpi_daily_history doit contenir les résumés
 * journaliers avant de supprimer les données horaires.
 *
 * Usage manuel  : php scripts/purge_old_kpis.php
 * Usage planifié: Tâche Windows (1er de chaque mois, ex. 02h00)
 *
 * Commande Task Scheduler :
 *   php "C:\wamp64\www\NetInsight 360\netinsight360-backend\scripts\purge_old_kpis.php"
 */

require_once __DIR__ . '/../config/database.php';

// ── Configuration ────────────────────────────────────────────────────────────
define('RETENTION_MONTHS', 3);   // Garder X mois de données horaires
define('LOG_FILE', __DIR__ . '/../logs/purge.log');

// ── Helpers ──────────────────────────────────────────────────────────────────
function logMsg(string $msg): void {
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . PHP_EOL;
    file_put_contents(LOG_FILE, $line, FILE_APPEND);
    echo $line;
}

// ── Connexion ─────────────────────────────────────────────────────────────────
try {
    $pdo = Database::getLocalConnection();
} catch (Exception $e) {
    logMsg('ERREUR connexion DB : ' . $e->getMessage());
    exit(1);
}

$cutoffDate = date('Y-m-d', strtotime('-' . RETENTION_MONTHS . ' months'));
logMsg("=== Début purge (seuil : données antérieures à $cutoffDate) ===");

// ── Sécurité : vérifier que kpi_daily_history couvre les dates à purger ──────
$stmt = $pdo->prepare(
    "SELECT COUNT(DISTINCT recorded_date) AS cnt
     FROM kpi_daily_history
     WHERE recorded_date < ?"
);
$stmt->execute([$cutoffDate]);
$dailyCount = (int)$stmt->fetchColumn();

$stmt2 = $pdo->prepare(
    "SELECT COUNT(DISTINCT kpi_date) AS cnt
     FROM kpis_ran
     WHERE kpi_date < ?"
);
$stmt2->execute([$cutoffDate]);
$ranCount = (int)$stmt2->fetchColumn();

if ($ranCount > 0 && $dailyCount === 0) {
    logMsg("ABANDON : $ranCount dates dans kpis_ran à purger mais kpi_daily_history ne contient aucun résumé pour ces dates.");
    logMsg("Lancez d'abord le script d'import pour alimenter kpi_daily_history avant de purger.");
    exit(1);
}

if ($ranCount === 0) {
    logMsg("Aucune donnée à purger dans kpis_ran (rien avant $cutoffDate).");
} else {
    logMsg("kpis_ran : $ranCount dates à purger / kpi_daily_history : $dailyCount dates couvertes — OK");
}

// ── Purge kpis_ran ────────────────────────────────────────────────────────────
if ($ranCount > 0) {
    try {
        $del = $pdo->prepare("DELETE FROM kpis_ran WHERE kpi_date < ?");
        $del->execute([$cutoffDate]);
        $deleted = $del->rowCount();
        logMsg("kpis_ran : $deleted lignes supprimées.");
    } catch (PDOException $e) {
        logMsg("ERREUR purge kpis_ran : " . $e->getMessage());
    }
}

// ── Purge kpis_core ───────────────────────────────────────────────────────────
$stmt3 = $pdo->prepare("SELECT COUNT(*) FROM kpis_core WHERE kpi_date < ?");
$stmt3->execute([$cutoffDate]);
$coreCount = (int)$stmt3->fetchColumn();

if ($coreCount === 0) {
    logMsg("Aucune donnée à purger dans kpis_core.");
} else {
    try {
        $del2 = $pdo->prepare("DELETE FROM kpis_core WHERE kpi_date < ?");
        $del2->execute([$cutoffDate]);
        logMsg("kpis_core : " . $del2->rowCount() . " lignes supprimées.");
    } catch (PDOException $e) {
        logMsg("ERREUR purge kpis_core : " . $e->getMessage());
    }
}

// ── Résumé ────────────────────────────────────────────────────────────────────
logMsg("=== Purge terminée. kpi_daily_history conservé intégralement. ===");
exit(0);
