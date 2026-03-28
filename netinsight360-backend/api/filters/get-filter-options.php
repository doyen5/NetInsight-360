<?php
/**
 * NetInsight 360 — API: Options de filtres disponibles
 * GET /api/filters/get-filter-options.php
 * Retourne les valeurs uniques réelles de la base (pays, vendors, technologies, domaines).
 */
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo = Database::getLocalConnection();

    $countries = $pdo->query("
        SELECT DISTINCT s.country_code AS code, COALESCE(c.country_name, s.country_code) AS name
        FROM sites s
        LEFT JOIN countries c ON c.country_code = s.country_code
        ORDER BY name
    ")->fetchAll(PDO::FETCH_ASSOC);

    $vendors = $pdo->query("
        SELECT DISTINCT vendor FROM sites WHERE vendor IS NOT NULL ORDER BY vendor
    ")->fetchAll(PDO::FETCH_COLUMN);

    $technologies = $pdo->query("
        SELECT DISTINCT technology FROM sites WHERE technology IS NOT NULL ORDER BY technology
    ")->fetchAll(PDO::FETCH_COLUMN);

    $domains = $pdo->query("
        SELECT DISTINCT domain FROM sites WHERE domain IS NOT NULL ORDER BY domain
    ")->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode([
        'success' => true,
        'data' => [
            'countries'    => $countries,
            'vendors'      => array_values($vendors),
            'technologies' => array_values($technologies),
            'domains'      => array_values($domains),
            'kpi_statuses' => ['good', 'warning', 'critical'],
        ]
    ]);

} catch (Exception $e) {
    error_log('[get-filter-options] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}