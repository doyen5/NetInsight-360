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
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/session-bootstrap.php';

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
    ni360_start_session();
}

// CSRF: exiger le jeton uniquement si une session authentifiée existe.
if (isset($_SESSION['user_id'])) {
    $csrfHeader = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $csrfToken = $_SESSION['csrf_token'] ?? '';
    if (!is_string($csrfHeader) || $csrfHeader === '' || !is_string($csrfToken) || $csrfToken === '' || !hash_equals($csrfToken, $csrfHeader)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'error' => 'Jeton CSRF invalide ou manquant.',
            'code' => 'CSRF_INVALID'
        ]);
        exit();
    }
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
        $stmt->execute([hash('sha256', $_COOKIE['remember_token'])]);
    } catch (Exception $e) {
        error_log('Erreur suppression token: ' . $e->getMessage());
    }
}

// Supprimer le cookie "remember_token"
if (isset($_COOKIE['remember_token'])) {
    setcookie(
        'remember_token',
        '',
        ni360_remember_cookie_options(time() - 3600)
    );
}

// Sauvegarder l'identifiant avant la destruction de session
$loggedUserId    = $_SESSION['user_id']    ?? null;
$loggedUserEmail = $_SESSION['user_email'] ?? null;

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

// Journaliser la déconnexion
if ($pdo && $loggedUserId !== null) {
    try {
        $logStmt = $pdo->prepare("
            INSERT INTO audit_logs (user_id, user_email, action, entity_type, ip_address, created_at)
            VALUES (?, ?, 'LOGOUT', 'session', ?, NOW())
        ");
        $logStmt->execute([
            $loggedUserId,
            $loggedUserEmail,
            $_SERVER['REMOTE_ADDR'] ?? null
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