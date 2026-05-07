<?php
/**
 * NetInsight 360 - Vérification de session
 * Endpoint: GET /api/auth/verify.php
 */

require_once __DIR__ . '/../cors.php';

// Gérer OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

session_start();

if (!isset($_SESSION['csrf_token']) && isset($_SESSION['user_id'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// Vérifier la session
if (isset($_SESSION['user_id'])) {
    echo json_encode([
        'success' => true,
        'authenticated' => true,
        'csrf_token' => $_SESSION['csrf_token'] ?? null,
        'user' => [
            'id' => $_SESSION['user_id'],
            'name' => $_SESSION['user_name'],
            'email' => $_SESSION['user_email'],
            'role' => $_SESSION['user_role']
        ]
    ]);
    exit();
}

// Vérifier le cookie "Rester connecté"
if (isset($_COOKIE['remember_token'])) {
    $token = $_COOKIE['remember_token'];
    
    require_once __DIR__ . '/../../config/database.php';
    $pdo = Database::getLocalConnection();
    
    // Rechercher le token
    $stmt = $pdo->prepare("SELECT user_id, expires_at FROM user_tokens WHERE token = ?");
    $stmt->execute([hash('sha256', $token)]);
    $tokenData = $stmt->fetch();
    
    if ($tokenData && strtotime($tokenData['expires_at']) > time()) {
        // Récupérer l'utilisateur
        $userStmt = $pdo->prepare("SELECT id, name, email, role FROM users WHERE id = ? AND status = 'active'");
        $userStmt->execute([$tokenData['user_id']]);
        $user = $userStmt->fetch();
        
        if ($user) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['user_name'] = $user['name'];
            $_SESSION['user_email'] = $user['email'];
            $_SESSION['user_role'] = $user['role'];
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            
            echo json_encode([
                'success' => true,
                'authenticated' => true,
                'csrf_token' => $_SESSION['csrf_token'],
                'user' => $user
            ]);
            exit();
        }
    }
}

echo json_encode([
    'success' => true,
    'authenticated' => false
]);