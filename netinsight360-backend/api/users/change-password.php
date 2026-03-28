<?php
/**
 * NetInsight 360 — API: Changement de mot de passe
 * POST /api/users/change-password.php
 * Body JSON: { old_password, new_password }
 */
require_once __DIR__ . '/../cors.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Méthode non autorisée']); exit();
}

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $input       = json_decode(file_get_contents('php://input'), true);
    $oldPassword = $input['old_password'] ?? '';
    $newPassword = $input['new_password'] ?? '';

    if (empty($oldPassword) || empty($newPassword)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ancien et nouveau mot de passe requis']); exit();
    }
    if (strlen($newPassword) < 8) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Le nouveau mot de passe doit contenir au moins 8 caractères']); exit();
    }

    $pdo  = Database::getLocalConnection();
    $stmt = $pdo->prepare("SELECT password FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || !password_verify($oldPassword, $user['password'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Mot de passe actuel incorrect']); exit();
    }

    $upd = $pdo->prepare("UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?");
    $upd->execute([password_hash($newPassword, PASSWORD_DEFAULT), $_SESSION['user_id']]);

    echo json_encode(['success' => true, 'message' => 'Mot de passe mis à jour avec succès']);

} catch (Exception $e) {
    error_log('[change-password] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}