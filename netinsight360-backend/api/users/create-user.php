<?php
/**
 * NetInsight 360 — API: Créer un utilisateur
 * POST /api/users/create-user.php
 * Body JSON: { name, email, password, role, status }
 * ADMIN only
 */
require_once __DIR__ . '/../cors.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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
    $input    = json_decode(file_get_contents('php://input'), true);
    $name     = trim($input['name']     ?? '');
    $email    = trim($input['email']    ?? '');
    $password = $input['password']      ?? '';
    $role     = $input['role']          ?? 'CUSTOMER';
    $status   = $input['status']        ?? 'active';

    if (empty($name) || empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Nom, email et mot de passe sont requis']); exit();
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Format email invalide']); exit();
    }
    if (strlen($password) < MIN_PASSWORD_LENGTH) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Le mot de passe doit contenir au moins ' . MIN_PASSWORD_LENGTH . ' caractères']); exit();
    }
    if (strlen($password) > MAX_PASSWORD_LENGTH) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Le mot de passe est trop long']); exit();
    }

    $validRoles    = ['ADMIN', 'FO_ANALYSTE', 'CUSTOMER'];
    $validStatuses = ['active', 'inactive', 'suspended'];
    if (!in_array($role,   $validRoles))    $role   = 'CUSTOMER';
    if (!in_array($status, $validStatuses)) $status = 'active';

    $pdo   = Database::getLocalConnection();
    $check = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $check->execute([$email]);
    if ($check->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Cet email est déjà utilisé']); exit();
    }

    $ins = $pdo->prepare("
        INSERT INTO users (name, email, password, role, status, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())
    ");
    $ins->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), $role, $status]);
    $newId = (int)$pdo->lastInsertId();

    // Audit
    $pdo->prepare("
        INSERT INTO audit_logs (user_id, user_email, action, entity_type, entity_id, details, ip_address, created_at)
        VALUES (?, ?, 'CREATE_USER', 'user', ?, ?, ?, NOW())
    ")->execute([
        $_SESSION['user_id'],
        $_SESSION['user_email'] ?? null,
        (string)$newId,
        json_encode(['name' => $name, 'email' => $email, 'role' => $role]),
        $_SERVER['REMOTE_ADDR'] ?? null
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Utilisateur créé avec succès',
        'data'    => ['id' => $newId, 'name' => $name, 'email' => $email, 'role' => $role, 'status' => $status]
    ]);

} catch (Exception $e) {
    error_log('[create-user] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}