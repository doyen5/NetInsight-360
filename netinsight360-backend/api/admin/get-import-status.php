<?php
/**
 * NetInsight 360 — API : Statut de la dernière importation
 *
 * GET /api/admin/get-import-status.php
 *
 * Accès : ADMIN uniquement
 *
 * Retourne :
 *   - Statistiques kpis_ran (dernière date, nombre de sites/enregistrements)
 *   - Nombre total de sites en base
 *   - Dernière entrée dans le log d'import
 *   - Si un import est actuellement en cours (lock file)
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SESSION['user_role'] !== 'ADMIN') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Accès réservé aux administrateurs']);
    exit;
}

try {
    $pdo = Database::getLocalConnection();

    // --- Statistiques kpis_ran ---
    $kpisStmt = $pdo->query("
        SELECT
            MAX(kpi_date)                                                   AS last_date,
            MIN(kpi_date)                                                   AS first_date,
            COUNT(DISTINCT site_id)                                         AS sites,
            COUNT(*)                                                        AS records,
            COUNT(DISTINCT CASE WHEN technology = '2G' THEN site_id END)   AS sites_2g,
            COUNT(DISTINCT CASE WHEN technology = '3G' THEN site_id END)   AS sites_3g,
            COUNT(DISTINCT CASE WHEN technology = '4G' THEN site_id END)   AS sites_4g
        FROM kpis_ran
    ");
    $kpisRan = $kpisStmt->fetch(PDO::FETCH_ASSOC);

    // --- Sites totaux ---
    $sitesRAN  = (int)$pdo->query("SELECT COUNT(*) FROM sites WHERE domain = 'RAN'")->fetchColumn();
    $sitesCORE = (int)$pdo->query("SELECT COUNT(*) FROM sites WHERE domain = 'CORE'")->fetchColumn();

    // --- Log d'import (fichier JSON) ---
    $logFile   = __DIR__ . '/../../logs/import.json';
    $importLog = null;
    if (file_exists($logFile)) {
        $importLog = json_decode(file_get_contents($logFile), true);
    }

    // --- Log texte de la dernière exécution ---
    // Priorité : log manuel (import_run.log), sinon log planifié (import_cron.log)
    $runLogFile  = __DIR__ . '/../../logs/import_run.log';
    $cronLogFile = __DIR__ . '/../../logs/import_cron.log';
    $logSource   = file_exists($runLogFile) ? $runLogFile : (file_exists($cronLogFile) ? $cronLogFile : null);
    $lastRunLog  = '';
    if ($logSource) {
        $lines      = file($logSource, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $lastRunLog = implode("\n", array_slice($lines, -50));
    }

    // --- Import en cours ? (lock file < 10 min) ---
    $lockFile  = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'netinsight_import.lock';
    $isRunning = file_exists($lockFile) && (time() - filemtime($lockFile)) < 600;

    // --- Dernière activité d'import dans audit_logs ---
    $lastAuditStmt = $pdo->query("
        SELECT created_at, user_email, details
        FROM audit_logs
        WHERE action = 'IMPORT_TRIGGERED'
        ORDER BY created_at DESC
        LIMIT 5
    ");
    $lastImportAudit = $lastAuditStmt ? $lastAuditStmt->fetchAll(PDO::FETCH_ASSOC) : [];

    echo json_encode([
        'success' => true,
        'data'    => [
            'kpis_ran'         => $kpisRan,
            'sites_ran'        => $sitesRAN,
            'sites_core'       => $sitesCORE,
            'import_log'       => $importLog,
            'last_run_log'     => $lastRunLog,
            'is_running'       => $isRunning,
            'last_audit'       => $lastImportAudit,
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
