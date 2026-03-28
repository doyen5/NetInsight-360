<?php
/**
 * NetInsight 360 — API: Supprimer un utilisateur
 * DELETE /api/users/delete-user.php?id={userId}
 * ADMIN only — ne peut pas supprimer son propre compte
 */
require_once __DIR__ . '/../cors.php';

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Méthode non autorisée']); exit();
}

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SESSION['user_role'] !== 'ADMIN') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Accès réservé aux administrateurs.']); exit();
}

try {
    $userId = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($userId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID utilisateur invalide']); exit();
    }
    if ($userId === (int)$_SESSION['user_id']) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Vous ne pouvez pas supprimer votre propre compte']); exit();
    }

    $pdo   = Database::getLocalConnection();
    $check = $pdo->prepare("SELECT name, email FROM users WHERE id = ?");
    $check->execute([$userId]);
    $user  = $check->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Utilisateur introuvable']); exit();
    }

    // Audit avant suppression
    $pdo->prepare("
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, ip_address, user_agent, created_at)
        VALUES (?, 'delete_user', 'user', ?, ?, ?, ?, NOW())
    ")->execute([
        $_SESSION['user_id'], (string)$userId,
        json_encode(['name' => $user['name'], 'email' => $user['email']]),
        $_SERVER['REMOTE_ADDR'] ?? null,
        $_SERVER['HTTP_USER_AGENT'] ?? null
    ]);

    // Supprimer tokens remember_me associés
    $pdo->prepare("DELETE FROM user_tokens WHERE user_id = ?")->execute([$userId]);
    $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$userId]);

    echo json_encode(['success' => true, 'message' => 'Utilisateur supprimé avec succès']);

} catch (Exception $e) {
    error_log('[delete-user] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}