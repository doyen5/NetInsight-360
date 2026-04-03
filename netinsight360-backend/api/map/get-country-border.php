<?php
/**
 * NetInsight 360 - API: Frontières GeoJSON d'un pays
 *
 * Paramètre GET :
 *   cc : code ISO-2 du pays (ex: CI, SN, CM...)
 *
 * Fonctionnement :
 *   1. Valide le code pays contre la liste réelle des sites en DB (whitelist dynamique)
 *   2. Sert le fichier depuis le cache local (data/geojson/{CC}.json) si disponible
 *   3. Sinon, télécharge depuis un CDN public et met en cache pour les prochaines requêtes
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $cc = strtoupper(trim($_GET['cc'] ?? ''));

    // Validation : code pays exactement 2 lettres
    if (!preg_match('/^[A-Z]{2}$/', $cc)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Code pays invalide']);
        exit;
    }

    // Chemin du dossier GeoJSON local
    // Les fichiers sont nommés en minuscules avec l'extension .geojson (ex: ci.geojson)
    $cacheDir   = __DIR__ . '/../../data/geojson/';
    $cacheFile  = $cacheDir . strtolower($cc) . '.geojson'; // ex: data/geojson/ci.geojson
    $cacheFileAlt = $cacheDir . $cc . '.json';              // compatibilité ancienne convention

    // Créer le dossier cache si inexistant
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0755, true);
    }

    // Servir depuis le fichier local si disponible (priorité au .geojson minuscule)
    if (file_exists($cacheFile)) {
        readfile($cacheFile);
        exit;
    }
    if (file_exists($cacheFileAlt)) {
        readfile($cacheFileAlt);
        exit;
    }

    // Télécharger depuis le CDN (fichiers GeoJSON par pays, ISO-2 en minuscule)
    // Source : https://github.com/glynnbird/countriesgeojson — fichiers individuels légers
    $cdnUrl = 'https://raw.githubusercontent.com/glynnbird/countriesgeojson/master/' . strtolower($cc) . '.geojson';

    $ctx = stream_context_create([
        'http' => [
            'timeout'        => 15,
            'ignore_errors'  => true,
            'user_agent'     => 'NetInsight360/1.0',
        ]
    ]);

    $geojson = @file_get_contents($cdnUrl, false, $ctx);

    if ($geojson === false || empty($geojson)) {
        http_response_code(502);
        echo json_encode(['success' => false, 'error' => 'Impossible de récupérer les frontières pour ce pays']);
        exit;
    }

    // Vérifier que c'est bien du JSON valide avant de mettre en cache
    $decoded = json_decode($geojson);
    if ($decoded === null) {
        http_response_code(502);
        echo json_encode(['success' => false, 'error' => 'GeoJSON invalide reçu du CDN']);
        exit;
    }

    // Mettre en cache localement sous la convention minuscule + .geojson
    file_put_contents($cacheFile, $geojson);

    echo $geojson;

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
