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
            COUNT(DISTINCT site_id)                       AS sites,
            COUNT(*)                                      AS records,
            SUM(status = 'good')                          AS sites_good,
            SUM(status = 'warning')                       AS sites_warning,
            SUM(status = 'critical')                      AS sites_critical
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

    // --- Date/heure du dernier import (approx.) ---
    // On utilise le timestamp du fichier de log utilisé (si présent) comme
    // indication de la fin de l'exécution. Ce n'est pas une preuve absolue
    // mais permet d'indiquer heure + minute du dernier import sans modifier
    // le script d'import. Si aucun fichier de log, on tombe back sur la
    // dernière entrée d'audit IMPORT_TRIGGERED (si disponible).
    $lastImportTimestamp = null;
    // Priorité : marker file écrit par le script d'import (import_finished.json)
    $markerFile = realpath(__DIR__ . '/../../logs') . DIRECTORY_SEPARATOR . 'import_finished.json';
    if ($markerFile && file_exists($markerFile)) {
        $lastImportTimestamp = filemtime($markerFile);
    } elseif ($logSource && file_exists($logSource)) {
        // Ancien comportement : timestamp du log d'exécution
        $lastImportTimestamp = filemtime($logSource);
    } else {
        // Fallback : chercher la dernière entrée IMPORT_TRIGGERED dans audit_logs
        $row = $pdo->query("SELECT MAX(created_at) AS ts FROM audit_logs WHERE action = 'IMPORT_TRIGGERED'")->fetch(PDO::FETCH_ASSOC);
        if ($row && $row['ts']) {
            $lastImportTimestamp = strtotime($row['ts']);
        }
    }

    $lastImportDatetime = $lastImportTimestamp ? date('Y-m-d H:i:s', $lastImportTimestamp) : null;

    // --- Import en cours ? (lock file < 10 min) ---
    // Vérifier les deux emplacements possibles (migration de sys_get_temp_dir vers logs/)
    $lockFile      = realpath(__DIR__ . '/../../logs') . DIRECTORY_SEPARATOR . 'netinsight_import.lock';
    $lockFileOld   = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'netinsight_import.lock';
    $activeLock    = null;
    foreach ([$lockFile, $lockFileOld] as $lf) {
        if (file_exists($lf) && (time() - filemtime($lf)) < 600) {
            $activeLock = $lf;
            break;
        }
    }
    $isRunning = ($activeLock !== null);

    // --- Déterminer si l'import vient de se terminer récemment ---
    // On considère "just_finished" vrai si l'import n'est pas en cours et que
    // le timestamp du dernier import est dans les dernières N secondes.
    $justFinished = false;
    if (!$isRunning && $lastImportTimestamp) {
        $justFinished = (time() - $lastImportTimestamp) < 180; // 3 minutes
    }

    // Supprimer le marker file import_finished.json après consommation si il est
    // récent afin d'éviter une réutilisation multiple. On ne supprime que si
    // le marker existe et si sa date est dans la fenêtre récente (5 minutes).
    if ($markerFile && file_exists($markerFile) && $lastImportTimestamp) {
        $age = time() - $lastImportTimestamp;
        if ($age < 300) { // 5 minutes
            try { @unlink($markerFile); } catch (Exception $e) { /* non bloquant */ }
        }
    }

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
            // Ajout de métadonnées pour l'UI : datetime du dernier import et
            // un flag indiquant qu'il vient de se terminer.
            'last_import_datetime' => $lastImportDatetime,
            'just_finished'        => $justFinished,
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
