<?php
/**
 * NetInsight 360 — API : Déclencher un import manuel par technologie
 *
 * POST /api/admin/run-import-tech.php
 * Body JSON: { tech: '2G'|'3G'|'4G' }
 *
 * Bonnes pratiques appliquées:
 * - Rôle ADMIN obligatoire
 * - Verrou global unique pour éviter les chevauchements d'exécution
 * - Audit détaillé de l'action déclenchée
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../app/helpers/AuditHelper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Méthode non autorisée']);
    exit;
}

if (($_SESSION['user_role'] ?? '') !== 'ADMIN') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Accès réservé aux administrateurs']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$tech = strtoupper(trim((string)($input['tech'] ?? '')));

$map = [
    '2G' => 'import_2g_separate.php',
    '3G' => 'import_3g_separate.php',
    '4G' => 'import_4g_separate.php',
];

if (!isset($map[$tech])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Technologie invalide. Valeurs autorisées: 2G, 3G, 4G']);
    exit;
}

$scriptPath = realpath(__DIR__ . '/../../scripts/' . $map[$tech]);
if (!$scriptPath || !is_file($scriptPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Script d\'import techno introuvable']);
    exit;
}

$logsDir = realpath(__DIR__ . '/../../logs');
if (!$logsDir) {
    $logsDir = __DIR__ . '/../../logs';
    @mkdir($logsDir, 0755, true);
}

// Verrou global: empêche import global + import techno en parallèle.
$lockFile = $logsDir . DIRECTORY_SEPARATOR . 'netinsight_import.lock';
if (file_exists($lockFile) && (time() - filemtime($lockFile)) < 600) {
    echo json_encode(['success' => false, 'error' => 'Un import est déjà en cours. Réessayez dans quelques minutes.']);
    exit;
}

function resolvePhpBinForTechImport(): string {
    $candidates = [
        PHP_BINDIR . DIRECTORY_SEPARATOR . 'php.exe',
        'C:\\PHP\\php.exe',
    ];
    foreach ($candidates as $c) {
        if (is_file($c)) return $c;
    }
    return 'php';
}

$phpBin = resolvePhpBinForTechImport();
$logFile = $logsDir . DIRECTORY_SEPARATOR . 'import_run_' . strtolower($tech) . '.log';

if (PHP_OS_FAMILY === 'Windows') {
    $inner = sprintf('"%s" "%s" >> "%s" 2>&1', $phpBin, $scriptPath, $logFile);
    $cmd = 'start /B cmd /c "' . $inner . '"';
    pclose(popen($cmd, 'r'));
} else {
    $cmd = sprintf('"%s" "%s" >> "%s" 2>&1 &', $phpBin, $scriptPath, $logFile);
    exec($cmd);
}

@file_put_contents($lockFile, (string)getmypid());

try {
    $pdo = Database::getLocalConnection();
    AuditHelper::logFromSession(
        $pdo,
        'IMPORT_TRIGGERED_' . $tech,
        'kpis_ran',
        $tech,
        sprintf('Import manuel %s déclenché par %s depuis %s', $tech, $_SESSION['user_email'] ?? '?', $_SERVER['REMOTE_ADDR'] ?? '?')
    );
} catch (Exception $e) {
    // Non bloquant.
}

echo json_encode([
    'success' => true,
    'message' => sprintf('Import %s lancé en arrière-plan.', $tech),
    'tech' => $tech,
]);
