<?php
/**
 * NetInsight 360 - Vérification de session
 * Endpoint: GET /api/auth/verify.php
 */

require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/session-bootstrap.php';
require_once __DIR__ . '/../../config/constants.php';
require_once __DIR__ . '/../../app/helpers/AuthSessionHelper.php';
require_once __DIR__ . '/../../app/helpers/SecuritySchemaHelper.php';

// Gérer OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

ni360_start_session();

if (!isset($_SESSION['csrf_token']) && isset($_SESSION['user_id'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// Vérifier la session
if (isset($_SESSION['user_id'])) {
    $maxIdle = defined('SESSION_EXPIRY_HOURS') ? (SESSION_EXPIRY_HOURS * 3600) : 28800;
    $lastActivity = (int) ($_SESSION['last_activity_at'] ?? $_SESSION['logged_in_at'] ?? 0);
    if ($lastActivity > 0 && (time() - $lastActivity) > $maxIdle) {
        $_SESSION = [];
        session_destroy();
        echo json_encode([
            'success' => true,
            'authenticated' => false,
            'reason' => 'SESSION_EXPIRED'
        ]);
        exit();
    }

    $_SESSION['last_activity_at'] = time();

    echo json_encode([
        'success' => true,
        'authenticated' => true,
        'csrf_token' => $_SESSION['csrf_token'] ?? null,
        'user' => [
            'id' => $_SESSION['user_id'],
            'name' => $_SESSION['user_name'],
            'email' => $_SESSION['user_email'],
            'role' => $_SESSION['user_role'],
            'twoFactorEnabled' => !empty($_SESSION['two_factor_enabled'])
        ]
    ]);
    exit();
}

// Vérifier le cookie "Rester connecté"
if (isset($_COOKIE['remember_token'])) {
    $token = $_COOKIE['remember_token'];
    
    require_once __DIR__ . '/../../config/database.php';
    $pdo = Database::getLocalConnection();
    SecuritySchemaHelper::ensureSecuritySchema($pdo);
    
    // Rechercher le token
    $stmt = $pdo->prepare("SELECT user_id, expires_at FROM user_tokens WHERE token = ?");
    $stmt->execute([hash('sha256', $token)]);
    $tokenData = $stmt->fetch();
    
    if ($tokenData && strtotime($tokenData['expires_at']) > time()) {
        // Récupérer l'utilisateur
        $userStmt = $pdo->prepare("SELECT id, name, email, role, status, last_login, two_factor_enabled, two_factor_secret_enc, two_factor_recovery_codes_json FROM users WHERE id = ? AND status = 'active'");
        $userStmt->execute([$tokenData['user_id']]);
        $user = $userStmt->fetch();
        
        if ($user) {
            $authenticatedUser = AuthSessionHelper::finalizeLogin($pdo, $user, false);
            
            echo json_encode([
                'success' => true,
                'authenticated' => true,
                'csrf_token' => $_SESSION['csrf_token'],
                'user' => $authenticatedUser
            ]);
            exit();
        }
    }
}

echo json_encode([
    'success' => true,
    'authenticated' => false
]);