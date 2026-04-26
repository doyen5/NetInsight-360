<?php
/**
 * NetInsight 360 — CORS Helper centralisé
 * À inclure en tête de chaque endpoint API via :
 *   require_once __DIR__ . '/../cors.php';
 */
header('Content-Type: application/json');

require_once __DIR__ . '/../app/helpers/EnvHelper.php';
EnvHelper::load(__DIR__ . '/../.env.local');
EnvHelper::load(__DIR__ . '/../.env');

// Origines autorisées : même hôte (toutes variantes de port local + production)
$allowedOrigins = [
    'http://localhost',
    'http://localhost:80',
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1',
    'http://127.0.0.1:8080',
];

// Ajouter les origines explicites définies dans l'environnement
$configuredOrigins = trim((string) EnvHelper::get('APP_ORIGIN', ''));
if ($configuredOrigins !== '') {
    foreach (explode(',', $configuredOrigins) as $configuredOrigin) {
        $configuredOrigin = trim($configuredOrigin);
        if ($configuredOrigin !== '') {
            $allowedOrigins[] = $configuredOrigin;
        }
    }
}

$allowedOrigins = array_values(array_unique($allowedOrigins));

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    // Fallback : même origine (requêtes sans Origin, ex. Postman / CLI)
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    header('Access-Control-Allow-Origin: ' . $scheme . '://' . $host);
}

header('Vary: Origin');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
