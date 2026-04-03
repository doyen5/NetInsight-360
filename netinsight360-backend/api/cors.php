<?php
/**
 * NetInsight 360 — CORS Helper centralisé
 * À inclure en tête de chaque endpoint API via :
 *   require_once __DIR__ . '/../cors.php';
 */
header('Content-Type: application/json');

// Origines autorisées : même hôte (toutes variantes de port local + production)
$allowedOrigins = [
    'http://localhost',
    'http://localhost:80',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1',
    'http://127.0.0.1:8080',
];

// Ajouter l'origine de production si définie dans l'environnement
if (!empty($_SERVER['APP_ORIGIN'])) {
    $allowedOrigins[] = $_SERVER['APP_ORIGIN'];
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    // Fallback : même origine (requêtes sans Origin, ex. Postman / CLI)
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    header('Access-Control-Allow-Origin: ' . $scheme . '://' . $host);
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
