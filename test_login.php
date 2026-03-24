<?php
require_once 'netinsight360-backend/config/database.php';

$email = 'admin@netinsight360.com';
$password = 'Admin@2026#';

$pdo = Database::getLocalConnection();
$stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch();

if ($user) {
    echo "Utilisateur trouvé !\n";
    echo "Mot de passe haché: " . $user['password'] . "\n";
    if (password_verify($password, $user['password'])) {
        echo "✅ MOT DE PASSE CORRECT !\n";
    } else {
        echo "❌ MOT DE PASSE INCORRECT\n";
    }
} else {
    echo "Utilisateur non trouvé\n";
}