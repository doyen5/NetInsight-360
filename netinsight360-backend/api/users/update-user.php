<?php
/**
 * NetInsight 360 — API: Modifier un utilisateur
 * PUT /api/users/update-user.php?id={userId}
 * Body JSON: { name, email, role, status, password? }
 * ADMIN only
 */
require_once __DIR__ . '/../cors.php';

if (!in_array($_SERVER['REQUEST_METHOD'], ['PUT', 'POST'])) {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Méthode non autorisée']); exit();
}

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/constants.php';

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

    $input    = json_decode(file_get_contents('php://input'), true);
    $name     = trim($input['name']     ?? '');
    $email    = trim($input['email']    ?? '');
    $role     = $input['role']          ?? '';
    $status   = $input['status']        ?? '';
    $password = $input['password']      ?? '';

    if (empty($name) || empty($email)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Nom et email sont requis']); exit();
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Format email invalide']); exit();
    }

    $validRoles    = ['ADMIN', 'FO_ANALYSTE', 'CUSTOMER'];
    $validStatuses = ['active', 'inactive', 'suspended'];
    if (!in_array($role,   $validRoles))    $role   = 'CUSTOMER';
    if (!in_array($status, $validStatuses)) $status = 'active';

    $pdo = Database::getLocalConnection();

    $exists = $pdo->prepare("SELECT id FROM users WHERE id = ?");
    $exists->execute([$userId]);
    if (!$exists->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Utilisateur introuvable']); exit();
    }

    $emailCheck = $pdo->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
    $emailCheck->execute([$email, $userId]);
    if ($emailCheck->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Cet email est déjà utilisé par un autre compte']); exit();
    }

    if (!empty($password)) {
        if (strlen($password) < MIN_PASSWORD_LENGTH) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Le mot de passe doit contenir au moins ' . MIN_PASSWORD_LENGTH . ' caractères']); exit();
        }
        if (strlen($password) > MAX_PASSWORD_LENGTH) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Le mot de passe est trop long']); exit();
        }
        $upd = $pdo->prepare("UPDATE users SET name=?, email=?, role=?, status=?, password=?, updated_at=NOW() WHERE id=?");
        $upd->execute([$name, $email, $role, $status, password_hash($password, PASSWORD_DEFAULT), $userId]);
    } else {
        $upd = $pdo->prepare("UPDATE users SET name=?, email=?, role=?, status=?, updated_at=NOW() WHERE id=?");
        $upd->execute([$name, $email, $role, $status, $userId]);
    }

    // Audit
    $pdo->prepare("
        INSERT INTO audit_logs (user_id, user_email, action, entity_type, entity_id, details, ip_address, created_at)
        VALUES (?, ?, 'UPDATE_USER', 'user', ?, ?, ?, NOW())
    ")->execute([
        $_SESSION['user_id'],
        $_SESSION['user_email'] ?? null,
        (string)$userId,
        json_encode(['name' => $name, 'email' => $email, 'role' => $role, 'status' => $status]),
        $_SERVER['REMOTE_ADDR'] ?? null
    ]);

    echo json_encode(['success' => true, 'message' => 'Utilisateur mis à jour avec succès']);

} catch (Exception $e) {
    error_log('[update-user] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}