<?php
/**
 * NetInsight 360 — API: Traçabilité des imports
 * GET /api/admin/get-import-runs.php?q=&limit=
 *
 * Agrège les métadonnées des derniers logs d'import:
 * - techno ciblée (GLOBAL/2G/3G/4G)
 * - timestamp de fin (mtime du log)
 * - volume importé, batchs, durée, débit
 * - statut (success/failed)
 * - utilisateur déclencheur probable (audit)
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

if (($_SESSION['user_role'] ?? '') !== 'ADMIN') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Accès réservé aux administrateurs']);
    exit;
}

function parseRunLog(string $filePath, string $tech): array {
    $raw = @file_get_contents($filePath) ?: '';

    $sitesImported = null;
    $batches = null;
    $durationSec = null;
    $throughput = null;

    if (preg_match('/Sites importés:\s*([0-9]+)/u', $raw, $m)) {
        $sitesImported = (int)$m[1];
    }
    if (preg_match('/Batchs exécutés:\s*([0-9]+)/u', $raw, $m)) {
        $batches = (int)$m[1];
    }
    if (preg_match('/Temps écoulé:\s*([0-9]+(?:\.[0-9]+)?)s/u', $raw, $m)) {
        $durationSec = (float)$m[1];
    }
    if (preg_match('/Débit:\s*([0-9]+(?:\.[0-9]+)?)\s*sites\/s/u', $raw, $m)) {
        $throughput = (float)$m[1];
    }

    $status = (preg_match('/\[✗\s*ERREUR\]|\bERREUR\b|\bERROR\b/u', $raw) === 1)
        ? 'failed'
        : 'success';

    return [
        'id' => sha1($filePath . '|' . ((string)@filemtime($filePath))),
        'tech' => $tech,
        'log_file' => basename($filePath),
        'finished_at' => @date('Y-m-d H:i:s', (int)@filemtime($filePath)),
        'sites_imported' => $sitesImported,
        'batches' => $batches,
        'duration_sec' => $durationSec,
        'throughput_sites_sec' => $throughput,
        'status' => $status,
    ];
}

try {
    $pdo = Database::getLocalConnection();

    $q = trim((string)($_GET['q'] ?? ''));
    $limit = (int)($_GET['limit'] ?? 20);
    if ($limit < 5) $limit = 5;
    if ($limit > 100) $limit = 100;

    $logsDir = realpath(__DIR__ . '/../../logs') ?: (__DIR__ . '/../../logs');
    $candidates = [
        ['file' => $logsDir . DIRECTORY_SEPARATOR . 'import_run.log', 'tech' => 'GLOBAL'],
        ['file' => $logsDir . DIRECTORY_SEPARATOR . 'import_run_2g.log', 'tech' => '2G'],
        ['file' => $logsDir . DIRECTORY_SEPARATOR . 'import_run_3g.log', 'tech' => '3G'],
        ['file' => $logsDir . DIRECTORY_SEPARATOR . 'import_run_4g.log', 'tech' => '4G'],
        ['file' => $logsDir . DIRECTORY_SEPARATOR . 'import_cron.log', 'tech' => 'GLOBAL'],
    ];

    $runs = [];
    foreach ($candidates as $entry) {
        if (is_file($entry['file'])) {
            $runs[] = parseRunLog($entry['file'], $entry['tech']);
        }
    }

    // Associer un utilisateur probable depuis les derniers triggers d'audit.
    $auditRows = $pdo->query("\n        SELECT created_at, user_email, action\n        FROM audit_logs\n        WHERE action IN ('IMPORT_TRIGGERED', 'IMPORT_TRIGGERED_2G', 'IMPORT_TRIGGERED_3G', 'IMPORT_TRIGGERED_4G')\n        ORDER BY created_at DESC\n        LIMIT 200\n    ")->fetchAll(PDO::FETCH_ASSOC);

    foreach ($runs as &$run) {
        $runTs = strtotime((string)$run['finished_at']);
        $best = null;
        $bestDelta = PHP_INT_MAX;

        foreach ($auditRows as $row) {
            $action = (string)($row['action'] ?? '');
            $actionTech = 'GLOBAL';
            if (str_ends_with($action, '_2G')) $actionTech = '2G';
            if (str_ends_with($action, '_3G')) $actionTech = '3G';
            if (str_ends_with($action, '_4G')) $actionTech = '4G';

            if ($actionTech !== $run['tech']) {
                continue;
            }

            $delta = abs($runTs - strtotime((string)$row['created_at']));
            if ($delta < $bestDelta) {
                $bestDelta = $delta;
                $best = $row;
            }
        }

        $run['triggered_by'] = $best['user_email'] ?? 'Système';
    }
    unset($run);

    // Tri du plus récent au plus ancien.
    usort($runs, function ($a, $b) {
        return strcmp((string)$b['finished_at'], (string)$a['finished_at']);
    });

    if ($q !== '') {
        $qLower = mb_strtolower($q);
        $runs = array_values(array_filter($runs, function ($run) use ($qLower) {
            $haystack = mb_strtolower(implode(' ', [
                (string)($run['tech'] ?? ''),
                (string)($run['log_file'] ?? ''),
                (string)($run['triggered_by'] ?? ''),
                (string)($run['status'] ?? ''),
                (string)($run['finished_at'] ?? ''),
            ]));
            return str_contains($haystack, $qLower);
        }));
    }

    $runs = array_slice($runs, 0, $limit);

    echo json_encode([
        'success' => true,
        'data' => [
            'runs' => $runs,
            'total' => count($runs)
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
