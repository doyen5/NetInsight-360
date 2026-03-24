<?php
require_once __DIR__ . '/../../config/database.php';

// Récupérer la connexion locale
$pdo = Database::getLocalConnection();

// OU utiliser la fonction helper
$pdo = db();

// Requête
$stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch();