<?php
/**
 * NetInsight 360 — API: Statistiques des alertes
 * GET /api/alerts/get-alerts-stats.php
 */
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo = Database::getLocalConnection();

    // Cache court pour amortir les rafraîchissements front fréquents.
    $cacheTtl = 30;
    $cacheDir = realpath(__DIR__ . '/../../data') . DIRECTORY_SEPARATOR . 'cache';
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0755, true);
    }
    $cacheFile = $cacheDir . DIRECTORY_SEPARATOR . 'alerts_stats.json';
    if (is_file($cacheFile) && (time() - filemtime($cacheFile) <= $cacheTtl)) {
        $cached = @file_get_contents($cacheFile);
        if ($cached !== false && $cached !== '') {
            echo $cached;
            exit;
        }
    }

    // --- Compteurs globaux ---
    $counts = $pdo->query("
        SELECT
                SUM(status IN ('active','acknowledged','escalated'))                         AS active,
                SUM(status IN ('active','acknowledged','escalated') AND alert_type = 'critical') AS critical,
                SUM(status IN ('active','acknowledged','escalated') AND alert_type = 'warning')  AS warning,
            SUM(status = 'resolved' AND DATE(resolved_at) = CURDATE()) AS resolved_today
        FROM alerts
    ")->fetch(PDO::FETCH_ASSOC);

    // --- Par pays ---
    $byCountry = $pdo->query("
        SELECT
            COALESCE(c.country_name, s.country_code) AS name,
            COUNT(*)                                  AS count
        FROM alerts a
        LEFT JOIN sites     s ON s.id            = a.site_id
        LEFT JOIN countries c ON c.country_code  = s.country_code
            WHERE a.status IN ('active','acknowledged','escalated')
        GROUP BY s.country_code, c.country_name
        ORDER BY count DESC LIMIT 10
    ")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($byCountry as &$r) { $r['count'] = (int)$r['count']; }
    unset($r);

    // --- Évolution 7 jours ---
    $evoRows = $pdo->query("
        SELECT DATE(created_at) AS day,
               SUM(alert_type = 'critical') AS critical,
               SUM(alert_type = 'warning')  AS warning
        FROM alerts
        WHERE created_at >= CURDATE() - INTERVAL 6 DAY
        GROUP BY DATE(created_at) ORDER BY day
    ")->fetchAll(PDO::FETCH_ASSOC);
    $evolution = ['labels' => [], 'critical' => [], 'warning' => []];
    foreach ($evoRows as $r) {
        $evolution['labels'][]   = $r['day'];
        $evolution['critical'][] = (int)$r['critical'];
        $evolution['warning'][]  = (int)$r['warning'];
    }

    // --- Par domaine ---
    $domainRows = $pdo->query("
        SELECT COALESCE(s.domain,'RAN') AS dom, COUNT(*) AS cnt
        FROM alerts a
        LEFT JOIN sites s ON s.id = a.site_id
            WHERE a.status IN ('active','acknowledged','escalated')
        GROUP BY s.domain
    ")->fetchAll(PDO::FETCH_ASSOC);
    $byDomain = ['ran' => 0, 'core' => 0];
    foreach ($domainRows as $r) {
        $k = strtolower($r['dom']);
        if (array_key_exists($k, $byDomain)) $byDomain[$k] = (int)$r['cnt'];
    }

    // --- Top sites problématiques ---
    $topSites = $pdo->query("
        SELECT COALESCE(s.name, a.site_id) AS name, COUNT(*) AS alert_count
        FROM alerts a
        LEFT JOIN sites s ON s.id = a.site_id
            WHERE a.status IN ('active','acknowledged','escalated')
        GROUP BY a.site_id, s.name
        ORDER BY alert_count DESC LIMIT 5
    ")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($topSites as &$ts) { $ts['alert_count'] = (int)$ts['alert_count']; }
    unset($ts);

    // --- Temps moyen de résolution (heures) ---
    $avgRow = $pdo->query("
        SELECT ROUND(AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)), 1) AS avg_hours
        FROM alerts WHERE status = 'resolved' AND resolved_at IS NOT NULL
    ")->fetch(PDO::FETCH_ASSOC);

    $response = json_encode([
        'success' => true,
        'data' => [
            'active'               => (int)($counts['active']         ?? 0),
            'critical'             => (int)($counts['critical']        ?? 0),
            'warning'              => (int)($counts['warning']         ?? 0),
            'resolved_today'       => (int)($counts['resolved_today']  ?? 0),
            'by_country'           => $byCountry,
            'evolution'            => $evolution,
            'by_domain'            => $byDomain,
            'top_sites'            => $topSites,
            'avg_resolution_hours' => (float)($avgRow['avg_hours'] ?? 0),
        ]
    ]);

    if ($response === false) {
        throw new Exception('Erreur de serialisation JSON');
    }

    @file_put_contents($cacheFile, $response, LOCK_EX);
    echo $response;

} catch (Exception $e) {
    error_log('[get-alerts-stats] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}