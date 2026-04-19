<?php
/**
 * NetInsight 360 — API: Historique de traitement d'une alerte
 * GET /api/alerts/get-alert-history.php?alert_id=123
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/_workflow-schema.php';

try {
    $alertId = isset($_GET['alert_id']) ? (int)$_GET['alert_id'] : 0;
    if ($alertId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "ID d'alerte invalide"]);
        exit();
    }

    $pdo = Database::getLocalConnection();
    ensureAlertsWorkflowSchema($pdo);

    $baseStmt = $pdo->prepare("\n        SELECT id, created_at, acknowledged_at, acknowledged_by, escalated_at, escalated_by, resolved_at, resolved_by
        FROM alerts
        WHERE id = ?
        LIMIT 1
    ");
    $baseStmt->execute([$alertId]);
    $alert = $baseStmt->fetch(PDO::FETCH_ASSOC);

    if (!$alert) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Alerte introuvable']);
        exit();
    }

    $historyStmt = $pdo->prepare("\n        SELECT h.action_type, h.action_note, h.created_at,
               COALESCE(u.name, CONCAT('User #', h.action_by)) AS actor_name
        FROM alert_history h
        LEFT JOIN users u ON u.id = h.action_by
        WHERE h.alert_id = ?
        ORDER BY h.created_at ASC
    ");
    $historyStmt->execute([$alertId]);
    $history = $historyStmt->fetchAll(PDO::FETCH_ASSOC);

    // Timeline minimale garantie même si l'historique est vide (backward compatibility).
    $fallback = [];

    if (!empty($alert['created_at'])) {
        $fallback[] = [
            'action_type' => 'created',
            'action_note' => 'Alerte créée',
            'created_at' => $alert['created_at'],
            'actor_name' => 'Système'
        ];
    }

    if (!empty($alert['acknowledged_at'])) {
        $fallback[] = [
            'action_type' => 'acknowledged',
            'action_note' => 'Alerte prise en charge',
            'created_at' => $alert['acknowledged_at'],
            'actor_name' => $alert['acknowledged_by'] ? ('User #' . $alert['acknowledged_by']) : 'N/A'
        ];
    }

    if (!empty($alert['escalated_at'])) {
        $fallback[] = [
            'action_type' => 'escalated',
            'action_note' => 'Alerte escaladée',
            'created_at' => $alert['escalated_at'],
            'actor_name' => $alert['escalated_by'] ? ('User #' . $alert['escalated_by']) : 'N/A'
        ];
    }

    if (!empty($alert['resolved_at'])) {
        $fallback[] = [
            'action_type' => 'resolved',
            'action_note' => 'Alerte résolue',
            'created_at' => $alert['resolved_at'],
            'actor_name' => $alert['resolved_by'] ? ('User #' . $alert['resolved_by']) : 'N/A'
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'alert_id' => (int)$alertId,
            'history' => !empty($history) ? $history : $fallback
        ]
    ]);
} catch (Exception $e) {
    error_log('[get-alert-history] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}
