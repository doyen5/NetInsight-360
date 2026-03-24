<?php
/**
 * NetInsight 360 - API de connexion
 * Endpoint: POST /api/auth/login.php
 */

// Activation des erreurs pour le debug
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Headers CORS
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost:8080');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

// Gérer la requête OPTIONS (pre-flight CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

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

try {
    $pdo = Database::getLocalConnection();
    
    // Récupérer l'utilisateur
    $stmt = $pdo->prepare("SELECT id, name, email, password, role, status FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    
    if (!$user) {
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
        echo json_encode(['success' => false, 'error' => 'Email ou mot de passe incorrect']);
        exit();
    }
    
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
                password_hash($token, PASSWORD_DEFAULT),
                $expires,
                $_SERVER['REMOTE_ADDR'] ?? null,
                $_SERVER['HTTP_USER_AGENT'] ?? null
            ]);
            
            // Définir le cookie
            setcookie('remember_token', $token, time() + 86400 * 30, '/', '', false, true);
        }
    }
    
    // Retourner la réponse de succès
    echo json_encode([
        'success' => true,
        'user' => [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'loggedInAt' => date('Y-m-d H:i:s')
        ]
    ]);
    
} catch (PDOException $e) {
    error_log($e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Erreur de base de données']);
} catch (Exception $e) {
    error_log($e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}