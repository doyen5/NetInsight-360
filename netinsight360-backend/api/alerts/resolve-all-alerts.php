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

try {
    $pdo  = Database::getLocalConnection();
    $stmt = $pdo->prepare("
        UPDATE alerts
        SET status = 'resolved', resolved_at = NOW(), resolved_by = ?
        WHERE status IN ('active', 'acknowledged')
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