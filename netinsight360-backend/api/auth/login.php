<?php
/**
 * NetInsight 360 - API de connexion
 * Endpoint: POST /api/auth/login.php
 */

// Headers CORS
require_once __DIR__ . '/../cors.php';

// Vérifier que la méthode est POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Méthode non autorisée']);
    exit();
}

// Récupérer les données JSON envoyées par le frontend
$input = json_decode(file_get_contents('php://input'), true);

// Vérifier que les données sont présentes
if (!$input || !isset($input['email']) || !isset($input['password'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email et mot de passe requis']);
    exit();
}

// Récupérer les variables
$email = trim($input['email']);
$password = $input['password'];
$remember = isset($input['remember']) ? (bool)$input['remember'] : false;

// Connexion à la base de données
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/constants.php';

try {
    $pdo = Database::getLocalConnection();
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
        http_response_code(429);
        echo json_encode([
            'success' => false,
            'error'   => 'Trop de tentatives de connexion. Réessayez dans ' . LOGIN_ATTEMPT_TIMEOUT . ' minutes.',
        ]);
        exit();
    }

    // Nettoyer les vieilles tentatives (> 1 heure) pour éviter la croissance infinie
    $pdo->exec("DELETE FROM login_attempts WHERE attempted_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)");

    // Récupérer l'utilisateur
    $stmt = $pdo->prepare("SELECT id, name, email, password, role, status, last_login FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user) {
        // Enregistrer la tentative (email inexistant)
        $pdo->prepare("INSERT INTO login_attempts (ip_address, email) VALUES (?, ?)")->execute([$ip, $email]);
        echo json_encode(['success' => false, 'error' => 'Email ou mot de passe incorrect']);
        exit();
    }
    
    // Vérifier le statut du compte
    if ($user['status'] !== 'active') {
        echo json_encode(['success' => false, 'error' => 'Compte désactivé. Contactez l\'administrateur.']);
        exit();
    }
    
    // Vérifier le mot de passe
    if (!password_verify($password, $user['password'])) {
        // Enregistrer la tentative échouée
        $pdo->prepare("INSERT INTO login_attempts (ip_address, email) VALUES (?, ?)")->execute([$ip, $email]);
        echo json_encode(['success' => false, 'error' => 'Email ou mot de passe incorrect']);
        exit();
    }

    // Connexion réussie : effacer les tentatives précédentes pour cet email
    $pdo->prepare("DELETE FROM login_attempts WHERE email = ?")->execute([$email]);
    
    // Démarrer la session
    session_start();
    
    // Stocker les informations utilisateur en session
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_name'] = $user['name'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_role'] = $user['role'];
    $_SESSION['logged_in_at'] = time();
    
    // Mettre à jour la dernière connexion
    $updateStmt = $pdo->prepare("UPDATE users SET last_login = NOW(), last_ip = ? WHERE id = ?");
    $updateStmt->execute([$_SERVER['REMOTE_ADDR'] ?? null, $user['id']]);
    
    // Si "Rester connecté" est coché, créer un token
    if ($remember) {
        $token = bin2hex(random_bytes(32));
        $expires = date('Y-m-d H:i:s', strtotime('+30 days'));
        
        // Vérifier si la table user_tokens existe
        $tableExists = $pdo->query("SHOW TABLES LIKE 'user_tokens'")->rowCount() > 0;
        
        if ($tableExists) {
            // Supprimer l'ancien token
            $deleteStmt = $pdo->prepare("DELETE FROM user_tokens WHERE user_id = ?");
            $deleteStmt->execute([$user['id']]);
            
            // Créer le nouveau token
            $insertStmt = $pdo->prepare("INSERT INTO user_tokens (user_id, token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)");
            $insertStmt->execute([
                $user['id'],
                hash('sha256', $token),
                $expires,
                $_SERVER['REMOTE_ADDR'] ?? null,
                $_SERVER['HTTP_USER_AGENT'] ?? null
            ]);
            
            // Définir le cookie (secure=true si HTTPS, false en dev HTTP local)
            $isSecure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
            setcookie('remember_token', $token, time() + 86400 * 30, '/', '', $isSecure, true);
        }
    }
    
    // Retourner la réponse de succès
    echo json_encode([
        'success' => true,
        'user' => [
            'id'          => $user['id'],
            'name'        => $user['name'],
            'email'       => $user['email'],
            'role'        => $user['role'],
            'loggedInAt'  => date('Y-m-d H:i:s'),
            // Dernière connexion AVANT celle-ci (null si c'est la première)
            'lastLogin'   => $user['last_login'] ?? null
        ]
    ]);
    
} catch (PDOException $e) {
    error_log($e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Erreur de base de données']);
} catch (Exception $e) {
    error_log($e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}