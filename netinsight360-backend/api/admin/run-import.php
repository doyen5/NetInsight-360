<?php
/**
 * NetInsight 360 — API : Déclencher un import RAN manuel
 *
 * POST /api/admin/run-import.php
 *
 * Accès : ADMIN uniquement
 *
 * Lance `import_ran_kpis_complete.php` en arrière-plan (Windows + Linux).
 * Un fichier de lock empêche les exécutions simultanées (timeout 10 min).
 * Trace l'action dans audit_logs.
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

if ($_SESSION['user_role'] !== 'ADMIN') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Accès réservé aux administrateurs']);
    exit;
}

// --- Vérification du script ---
$scriptPath = realpath(__DIR__ . '/../../scripts/import_ran_kpis_complete.php');
if (!$scriptPath || !is_file($scriptPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Script d\'import introuvable']);
    exit;
}

// --- Anti-double exécution ---
// Chemin fixe dans logs/ pour que le script CLI puisse aussi le supprimer
$lockFile  = realpath(__DIR__ . '/../../logs') . DIRECTORY_SEPARATOR . 'netinsight_import.lock';
if (file_exists($lockFile) && (time() - filemtime($lockFile)) < 600) {
    echo json_encode(['success' => false, 'error' => 'Un import est déjà en cours. Réessayez dans quelques minutes.']);
    exit;
}

// --- Résolution du binaire PHP CLI ---
// Sous Apache/mod_php, PHP_BINARY renvoie httpd.exe (le process Apache lui-même).
// On cherche php.exe dans cet ordre :
//   1) PHP_BINDIR/php.exe  (dossier du module PHP WAMP)
//   2) C:\PHP\php.exe       (chemin standard de ce serveur)
//   3) 'php'                (fallback : PATH)
function resolvePhpBin(): string {
    $candidates = [
        PHP_BINDIR . DIRECTORY_SEPARATOR . 'php.exe',
        'C:\\PHP\\php.exe',
    ];
    foreach ($candidates as $c) {
        if (is_file($c)) return $c;
    }
    return 'php'; // fallback PATH
}
$phpBin  = resolvePhpBin();
$logFile = realpath(__DIR__ . '/../../logs') . DIRECTORY_SEPARATOR . 'import_run.log';

// Créer le dossier logs si nescessaire
if (!is_dir(dirname($logFile))) {
    @mkdir(dirname($logFile), 0755, true);
}

// --- Lancement en arrière-plan ---
if (PHP_OS_FAMILY === 'Windows') {
    // Double cmd nécessaire sous Apache/Windows (contexte SERVICE) :
    //   - popen() appelle déjà  cmd /c <commande>
    //   - start /B  détache le process fils du process Apache
    //   - le cmd interne gère la redirection stdout+stderr vers le log
    // Sans ce double cmd, la redirection > s'applique à start (sortie vide),
    // pas à PHP → log vide, script jamais exécuté correctement.
    $inner = sprintf('"%s" "%s" >> "%s" 2>&1', $phpBin, $scriptPath, $logFile);
    $cmd   = 'start /B cmd /c "' . $inner . '"';
    pclose(popen($cmd, 'r'));
} else {
    // Linux/Mac
    $cmd = sprintf('"%s" "%s" >> "%s" 2>&1 &', $phpBin, $scriptPath, $logFile);
    exec($cmd);
}

// Créer le lock file
@file_put_contents($lockFile, (string)getmypid());

// --- Audit ---
try {
    $pdo = Database::getLocalConnection();
    AuditHelper::logFromSession(
        $pdo,
        'IMPORT_TRIGGERED',
        'kpis_ran',
        'CI',
        sprintf('Import manuel déclenché par %s depuis %s', $_SESSION['user_email'] ?? '?', $_SERVER['REMOTE_ADDR'] ?? '?')
    );
} catch (Exception $e) {
    // non bloquant
}

echo json_encode([
    'success' => true,
    'message' => 'Import lancé en arrière-plan. Actualisez le statut dans quelques minutes.',
]);
