<?php
/**
 * NetInsight 360 - API de connexion
 * Endpoint: POST /api/auth/login.php
 */

// Headers CORS
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/session-bootstrap.php';
require_once __DIR__ . '/../../app/helpers/ApiResponse.php';
require_once __DIR__ . '/../../app/helpers/RequestHelper.php';
require_once __DIR__ . '/../../app/helpers/SecuritySchemaHelper.php';
require_once __DIR__ . '/../../app/helpers/AuthSessionHelper.php';

// Vérifier que la méthode est POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ApiResponse::error('Méthode non autorisée', 405);
}

// Le corps JSON est désormais parsé via un helper partagé afin d'aligner
// les erreurs et de réduire les duplications sur les endpoints sensibles.
$input = RequestHelper::requireJsonBody();

// Vérifier que les données sont présentes
if (!$input || !isset($input['email']) || !isset($input['password'])) {
    ApiResponse::error('Email et mot de passe requis', 400);
}

// Récupérer les variables
$email = RequestHelper::string($input, 'email');
$password = RequestHelper::password($input, 'password');
$remember = isset($input['remember']) ? (bool)$input['remember'] : false;

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    ApiResponse::error('Format email invalide', 400);
}

if (!is_string($password) || $password === '') {
    ApiResponse::error('Email et mot de passe requis', 400);
}

// Connexion à la base de données
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/constants.php';

$invalidCredentialsMessage = 'Email ou mot de passe incorrect';

try {
    $pdo = Database::getLocalConnection();
    SecuritySchemaHelper::ensureSecuritySchema($pdo);
    $ip  = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

    // ---------------------------------------------------------------
    // Rate limiting : MAX_LOGIN_ATTEMPTS tentatives / LOGIN_ATTEMPT_TIMEOUT min
    // ---------------------------------------------------------------
    $pdo->exec("CREATE TABLE IF NOT EXISTS login_attempts (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        ip_address   VARCHAR(45)  NOT NULL,
        email        VARCHAR(255) NOT NULL,
        attempted_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ip_email   (ip_address, email),
        INDEX idx_attempted_at (attempted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $window   = date('Y-m-d H:i:s', strtotime('-' . LOGIN_ATTEMPT_TIMEOUT . ' minutes'));
    $cntStmt  = $pdo->prepare("
        SELECT COUNT(*) FROM login_attempts
        WHERE (ip_address = ? OR email = ?) AND attempted_at > ?
    ");
    $cntStmt->execute([$ip, $email, $window]);
    if ((int)$cntStmt->fetchColumn() >= MAX_LOGIN_ATTEMPTS) {
        ApiResponse::error('Trop de tentatives de connexion. Réessayez dans ' . LOGIN_ATTEMPT_TIMEOUT . ' minutes.', 429);
    }

    // Nettoyer les vieilles tentatives (> 1 heure) pour éviter la croissance infinie
    $pdo->exec("DELETE FROM login_attempts WHERE attempted_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)");

    // Récupérer l'utilisateur
    $stmt = $pdo->prepare("SELECT id, name, email, password, role, status, last_login, two_factor_enabled, two_factor_secret_enc, two_factor_recovery_codes_json FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user) {
        // Enregistrer la tentative (email inexistant)
        $pdo->prepare("INSERT INTO login_attempts (ip_address, email) VALUES (?, ?)")->execute([$ip, $email]);
        ApiResponse::error($invalidCredentialsMessage, 401);
    }
    
    // Vérifier le statut du compte
    if ($user['status'] !== 'active') {
        $pdo->prepare("INSERT INTO login_attempts (ip_address, email) VALUES (?, ?)")->execute([$ip, $email]);
        ApiResponse::error($invalidCredentialsMessage, 401);
    }
    
    // Vérifier le mot de passe
    if (!password_verify($password, $user['password'])) {
        // Enregistrer la tentative échouée
        $pdo->prepare("INSERT INTO login_attempts (ip_address, email) VALUES (?, ?)")->execute([$ip, $email]);
        ApiResponse::error($invalidCredentialsMessage, 401);
    }

    // Connexion réussie : effacer les tentatives précédentes pour cet email
    $pdo->prepare("DELETE FROM login_attempts WHERE email = ?")->execute([$email]);

    // Si le compte a un secret TOTP confirmé, on bascule dans un état de pré-authentification.
    // Aucun cookie de session durable n'est émis tant que le second facteur n'est pas validé.
    if (!empty($user['two_factor_enabled']) && !empty($user['two_factor_secret_enc'])) {
        AuthSessionHelper::storePendingTwoFactor($user, $remember);
        ApiResponse::success([
            'requires_2fa' => true,
            'message' => 'Code de vérification requis.',
            'two_factor_method' => 'totp',
        ]);
    }

    $authenticatedUser = AuthSessionHelper::finalizeLogin($pdo, $user, $remember);
    ApiResponse::success([
        'csrf_token' => $_SESSION['csrf_token'],
        'user' => $authenticatedUser,
    ]);
    
} catch (PDOException $e) {
    error_log($e->getMessage());
    ApiResponse::error('Erreur de base de données', 500);
} catch (Exception $e) {
    error_log($e->getMessage());
    ApiResponse::error('Erreur serveur', 500);
}