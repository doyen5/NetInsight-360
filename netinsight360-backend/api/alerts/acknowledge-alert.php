<?php
/**
 * NetInsight 360 — API: Prendre en charge une alerte
 * POST /api/alerts/acknowledge-alert.php
 * Body JSON: { alert_id: int, note?: string }
 */
require_once __DIR__ . '/../cors.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Méthode non autorisée']);
    exit();
}

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/_workflow-schema.php';

// Seuls les rôles opérationnels peuvent prendre en charge une alerte.
if (!isset($_SESSION['user_role']) || !in_array($_SESSION['user_role'], ['ADMIN', 'FO_ANALYSTE'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Accès refusé']);
    exit();
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $alertId = isset($input['alert_id']) ? (int)$input['alert_id'] : 0;
    $note = trim((string)($input['note'] ?? ''));

    if ($alertId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "ID d'alerte invalide"]);
        exit();
    }

    $pdo = Database::getLocalConnection();
    ensureAlertsWorkflowSchema($pdo);

    // Le passage en "acknowledged" matérialise la prise en charge par un opérateur.
    $stmt = $pdo->prepare("
        UPDATE alerts
        SET status = 'acknowledged', acknowledged_at = NOW(), acknowledged_by = ?
        WHERE id = ? AND status IN ('active', 'escalated')
    ");
    $stmt->execute([$_SESSION['user_id'], $alertId]);

    if ($stmt->rowCount() === 0) {
        echo json_encode(['success' => false, 'error' => 'Alerte introuvable ou déjà prise en charge/résolue']);
        exit();
    }

    $actionNote = $note !== '' ? $note : 'Prise en charge opérateur';
    $hist = $pdo->prepare("
        INSERT INTO alert_history (alert_id, action_type, action_by, action_note)
        VALUES (?, 'acknowledged', ?, ?)
    ");
    $hist->execute([$alertId, $_SESSION['user_id'], $actionNote]);

    echo json_encode(['success' => true, 'message' => 'Alerte prise en charge avec succès']);
} catch (Exception $e) {
    error_log('[acknowledge-alert] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}
