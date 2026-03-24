<?php
require_once __DIR__ . '/netinsight360-backend/config/database.php';

echo "<h1>Test des connexions</h1>";

// Test connexion locale
try {
    $pdo = Database::getLocalConnection();
    $stmt = $pdo->query("SELECT 'Connexion locale OK' as message");
    $result = $stmt->fetch();
    echo "<p style='color:green'>✓ " . $result['message'] . "</p>";
} catch (Exception $e) {
    echo "<p style='color:red'>✗ Erreur locale: " . $e->getMessage() . "</p>";
}

// Test connexion distante
try {
    $remote = Database::getRemoteConnection();
    $stmt = $remote->query("SELECT 'Connexion distante OK' as message");
    $result = $stmt->fetch();
    echo "<p style='color:green'>✓ " . $result['message'] . "</p>";
} catch (Exception $e) {
    echo "<p style='color:red'>✗ Erreur distante: " . $e->getMessage() . "</p>";
}

// Afficher les logs
echo "<h2>Logs de connexion</h2>";
echo "<pre>";
print_r(Database::getLogs());
echo "</pre>";