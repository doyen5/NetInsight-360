<?php
/**
 * NetInsight 360 — API : Forcer le déverrouillage d'import
 *
 * POST /api/admin/force-unlock-import.php
 *
 * Accès : ADMIN uniquement
 *
 * Supprime le fichier de lock d'import pour débloquer un import bloqué.
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';

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

$logsDir = realpath(__DIR__ . '/../../logs');
if (!$logsDir) {
    $logsDir = __DIR__ . '/../../logs';
    @mkdir($logsDir, 0755, true);
}

$lockFile = $logsDir . DIRECTORY_SEPARATOR . 'netinsight_import.lock';
$lockFileOld = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'netinsight_import.lock';

$removed = false;
$errors = [];

// Supprimer le lock principal
if (file_exists($lockFile)) {
    if (@unlink($lockFile)) {
        $removed = true;
    } else {
        $errors[] = "Impossible de supprimer $lockFile";
    }
}

// Supprimer l'ancien lock si présent
if (file_exists($lockFileOld)) {
    if (@unlink($lockFileOld)) {
        $removed = true;
    } else {
        $errors[] = "Impossible de supprimer $lockFileOld";
    }
}

// Supprimer aussi le marker de fin
$markerFile = $logsDir . DIRECTORY_SEPARATOR . 'import_finished.json';
if (file_exists($markerFile)) {
    @unlink($markerFile);
}

if ($removed) {
    // Logger l'action dans audit
    try {
        require_once __DIR__ . '/../../config/database.php';
        require_once __DIR__ . '/../../app/helpers/AuditHelper.php';
        $pdo = Database::getLocalConnection();
        AuditHelper::logFromSession(
            $pdo,
            'IMPORT_UNLOCKED',
            'system',
            'CI',
            sprintf('Déverrouillage forcé par %s depuis %s', $_SESSION['user_email'] ?? '?', $_SERVER['REMOTE_ADDR'] ?? '?')
        );
    } catch (Exception $e) {
        // Non bloquant
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Lock d\'import supprimé avec succès.'
    ]);
} else {
    echo json_encode([
        'success' => false,
        'error' => 'Aucun lock trouvé ou erreur lors de la suppression: ' . implode(', ', $errors)
    ]);
}