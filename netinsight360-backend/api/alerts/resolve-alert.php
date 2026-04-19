<?php
/**
 * NetInsight 360 — API: Résoudre une alerte
 * POST /api/alerts/resolve-alert.php
 * Body JSON: { alert_id: int, note?: string }
 */
require_once __DIR__ . '/../cors.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Méthode non autorisée']); exit();
}

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/_workflow-schema.php';

// Sécurité: seules les équipes opérationnelles peuvent résoudre une alerte.
if (!isset($_SESSION['user_role']) || !in_array($_SESSION['user_role'], ['ADMIN', 'FO_ANALYSTE'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Accès refusé']);
    exit();
}

try {
    $input   = json_decode(file_get_contents('php://input'), true);
    $alertId = isset($input['alert_id']) ? (int)$input['alert_id'] : 0;
    $note    = trim((string)($input['note'] ?? ''));

    if ($alertId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "ID d'alerte invalide"]); exit();
    }

    $pdo  = Database::getLocalConnection();
    ensureAlertsWorkflowSchema($pdo);
    $stmt = $pdo->prepare("
        UPDATE alerts
        SET status = 'resolved', resolved_at = NOW(), resolved_by = ?
        WHERE id = ? AND status IN ('active', 'acknowledged', 'escalated')
    ");
    $stmt->execute([$_SESSION['user_id'], $alertId]);

    if ($stmt->rowCount() === 0) {
        echo json_encode(['success' => false, 'error' => 'Alerte introuvable ou déjà résolue']);
    } else {
        // Trace l'action pour la timeline de traitement.
        $actionNote = $note !== '' ? $note : 'Alerte résolue';
        $hist = $pdo->prepare("\n            INSERT INTO alert_history (alert_id, action_type, action_by, action_note)
            VALUES (?, 'resolved', ?, ?)
        ");
        $hist->execute([$alertId, $_SESSION['user_id'], $actionNote]);

        echo json_encode(['success' => true, 'message' => 'Alerte résolue avec succès']);
    }

} catch (Exception $e) {
    error_log('[resolve-alert] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}