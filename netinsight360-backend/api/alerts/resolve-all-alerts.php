<?php
/**
 * NetInsight 360 — API: Résoudre toutes les alertes actives
 * POST /api/alerts/resolve-all-alerts.php
 */
require_once __DIR__ . '/../cors.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Méthode non autorisée']); exit();
}

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/_workflow-schema.php';

// Sécurité: la résolution en masse est limitée aux rôles opérationnels.
if (!isset($_SESSION['user_role']) || !in_array($_SESSION['user_role'], ['ADMIN', 'FO_ANALYSTE'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Accès refusé']);
    exit();
}

try {
    $pdo  = Database::getLocalConnection();
    ensureAlertsWorkflowSchema($pdo);

    // Historiser les alertes ciblées par l'opération de masse.
    $hist = $pdo->prepare("\n        INSERT INTO alert_history (alert_id, action_type, action_by, action_note)
        SELECT id, 'resolved_all', ?, 'Résolution en masse'
        FROM alerts
           WHERE status IN ('active', 'acknowledged', 'escalated')
    ");
    $hist->execute([$_SESSION['user_id']]);
    $stmt = $pdo->prepare("
        UPDATE alerts
        SET status = 'resolved', resolved_at = NOW(), resolved_by = ?
           WHERE status IN ('active', 'acknowledged', 'escalated')
    ");
    $stmt->execute([$_SESSION['user_id']]);

    echo json_encode([
        'success' => true,
        'message' => $stmt->rowCount() . ' alerte(s) résolue(s)',
        'count'   => $stmt->rowCount()
    ]);

} catch (Exception $e) {
    error_log('[resolve-all-alerts] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}