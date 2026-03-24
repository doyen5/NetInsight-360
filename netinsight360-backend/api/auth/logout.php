<?php
/**
 * NetInsight 360 - API de déconnexion
 * 
 * Endpoint: POST /api/auth/logout.php
 * 
 * Cette API gère la déconnexion de l'utilisateur :
 * - Détruit la session PHP
 * - Supprime le cookie "remember_token"
 * - Nettoie le token en base de données (optionnel)
 */

// Headers CORS pour permettre les requêtes depuis le frontend
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

// Vérifier que la méthode HTTP est POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Méthode non autorisée. Utilisez POST.'
    ]);
    exit();
}

// Démarrer la session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Connexion à la base de données (pour supprimer le token)
try {
    require_once __DIR__ . '/../../config/database.php';
    $pdo = Database::getLocalConnection();
} catch (Exception $e) {
    // Si la base n'est pas accessible, on continue quand même la déconnexion
    error_log('Erreur connexion BDD pour logout: ' . $e->getMessage());
    $pdo = null;
}

// Supprimer le token "Rester connecté" de la base de données
if ($pdo && isset($_COOKIE['remember_token'])) {
    try {
        $stmt = $pdo->prepare("DELETE FROM user_tokens WHERE token = ?");
        $stmt->execute([$_COOKIE['remember_token']]);
    } catch (Exception $e) {
        error_log('Erreur suppression token: ' . $e->getMessage());
    }
}

// Supprimer le cookie "remember_token"
if (isset($_COOKIE['remember_token'])) {
    setcookie(
        'remember_token',
        '',
        time() - 3600,           // Expiration dans le passé
        '/',                     // Chemin
        '',                      // Domaine
        false,                   // Secure (false en développement)
        true                     // HttpOnly
    );
}

// Détruire complètement la session
if (session_status() === PHP_SESSION_ACTIVE) {
    // Vider le tableau de session
    $_SESSION = [];
    
    // Supprimer le cookie de session
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }
    
    // Détruire la session
    session_destroy();
}

// Journaliser la déconnexion (optionnel)
if ($pdo && isset($_SESSION['user_id'])) {
    try {
        $logStmt = $pdo->prepare("
            INSERT INTO audit_logs (user_id, action, entity_type, ip_address, user_agent, created_at)
            VALUES (?, 'logout', 'session', ?, ?, NOW())
        ");
        $logStmt->execute([
            $_SESSION['user_id'] ?? null,
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);
    } catch (Exception $e) {
        // Ignorer les erreurs de log
    }
}

// Retourner la réponse de succès
echo json_encode([
    'success' => true,
    'message' => 'Déconnexion réussie'
]);