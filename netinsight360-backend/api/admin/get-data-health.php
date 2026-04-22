<?php
/**
 * NetInsight 360 — API: Santé des données
 * GET /api/admin/get-data-health.php
 *
 * Fournit des indicateurs de qualité de données pour pilotage opérationnel:
 * - fraîcheur des flux KPI (RAN/CORE)
 * - complétude du référentiel sites
 * - couverture KPI récente par site
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

if (($_SESSION['user_role'] ?? '') !== 'ADMIN') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Accès réservé aux administrateurs']);
    exit;
}

try {
    $pdo = Database::getLocalConnection();

    $totalSites = (int)$pdo->query("SELECT COUNT(*) FROM sites WHERE status = 'active'")->fetchColumn();

    $missingCoords = (int)$pdo->query("\n        SELECT COUNT(*)\n        FROM sites\n        WHERE status = 'active'\n          AND (latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0)\n    ")->fetchColumn();

    $missingCountry = (int)$pdo->query("\n        SELECT COUNT(*)\n        FROM sites\n        WHERE status = 'active'\n          AND (country_code IS NULL OR country_code = '')\n    ")->fetchColumn();

    $latestRanRow = $pdo->query("\n        SELECT\n            MAX(kpi_date) AS last_date,\n            MAX(CONCAT(kpi_date, ' ', LPAD(IFNULL(kpi_hour, 0), 2, '0'), ':00:00')) AS last_datetime\n        FROM kpis_ran\n    ")->fetch(PDO::FETCH_ASSOC);

    $kpisRanRows = (int)$pdo->query("SELECT COUNT(*) FROM kpis_ran")->fetchColumn();

    $kpisCoreRows = 0;
    $latestCoreDate = null;
    $coreTableExists = (bool)$pdo->query("SHOW TABLES LIKE 'kpis_core'")->fetchColumn();
    if ($coreTableExists) {
        $kpisCoreRows = (int)$pdo->query("SELECT COUNT(*) FROM kpis_core")->fetchColumn();
        $latestCoreDate = $pdo->query("SELECT MAX(kpi_date) FROM kpis_core")->fetchColumn() ?: null;
    }

    // Sites RAN sans KPI sur les dernières 24h
    $ranNoRecentKpi = (int)$pdo->query("\n        SELECT COUNT(*)\n        FROM sites s\n        LEFT JOIN (\n            SELECT site_id, MAX(CONCAT(kpi_date, ' ', LPAD(IFNULL(kpi_hour, 0), 2, '0'), ':00:00')) AS last_seen\n            FROM kpis_ran\n            GROUP BY site_id\n        ) k ON k.site_id = s.id\n        WHERE s.status = 'active'\n          AND s.domain = 'RAN'\n          AND (k.last_seen IS NULL OR k.last_seen < DATE_SUB(NOW(), INTERVAL 24 HOUR))\n    ")->fetchColumn();

    // Score simple de qualité (0-100), utile pour suivi global.
    $coordRatio = $totalSites > 0 ? max(0, min(1, 1 - ($missingCoords / $totalSites))) : 0;
    $countryRatio = $totalSites > 0 ? max(0, min(1, 1 - ($missingCountry / $totalSites))) : 0;
    $recentRatio = $totalSites > 0 ? max(0, min(1, 1 - ($ranNoRecentKpi / $totalSites))) : 0;
    $qualityScore = round((($coordRatio * 0.4) + ($countryRatio * 0.2) + ($recentRatio * 0.4)) * 100, 1);

    $issues = [];
    if ($missingCoords > 0) {
        $issues[] = [
            'level' => $missingCoords > 100 ? 'critical' : 'warning',
            'message' => "$missingCoords site(s) actifs sans coordonnées GPS exploitables."
        ];
    }
    if ($ranNoRecentKpi > 0) {
        $issues[] = [
            'level' => $ranNoRecentKpi > 200 ? 'critical' : 'warning',
            'message' => "$ranNoRecentKpi site(s) RAN sans KPI sur les dernières 24h."
        ];
    }
    if (!$latestRanRow || empty($latestRanRow['last_datetime'])) {
        $issues[] = [
            'level' => 'critical',
            'message' => 'Aucune donnée KPI RAN détectée.'
        ];
    }
    if ($coreTableExists && !$latestCoreDate) {
        $issues[] = [
            'level' => 'warning',
            'message' => 'Table kpis_core présente mais vide.'
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'quality_score' => $qualityScore,
            'totals' => [
                'active_sites' => $totalSites,
                'kpis_ran_rows' => $kpisRanRows,
                'kpis_core_rows' => $kpisCoreRows,
            ],
            'completeness' => [
                'missing_coords' => $missingCoords,
                'missing_country' => $missingCountry,
                'ran_without_recent_kpi' => $ranNoRecentKpi,
            ],
            'freshness' => [
                'ran_last_date' => $latestRanRow['last_date'] ?? null,
                'ran_last_datetime' => $latestRanRow['last_datetime'] ?? null,
                'core_last_date' => $latestCoreDate,
            ],
            'issues' => $issues,
        ]
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
