<?php
/**
 * NetInsight 360 - API: DÃ©tails d'un site
 *
 * Retourne toutes les informations d'un site ainsi que :
 *  - les derniers KPIs (kpis_ran) avec le KPI dÃ©gradant (worst_kpi_name / worst_kpi_value)
 *  - les coordonnÃ©es GPS (prioritÃ© sites.latitude, fallback site_mapping)
 *
 * Le KPI dÃ©gradant est affichÃ© dans le modal "DÃ©tails du site" cÃ´tÃ© frontend.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost:8080');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../../config/database.php';

try {
    $pdo = Database::getLocalConnection();

    $siteId = $_GET['id'] ?? '';
    if (empty($siteId)) {
        echo json_encode(['success' => false, 'error' => 'ID du site requis']);
        exit;
    }

    // --- Informations du site ---
    // CoordonnÃ©es : prioritÃ© sites.latitude (peuplÃ©e par import depuis sites_database)
    // Fallback : site_mapping si sites.latitude = 0
    $stmt = $pdo->prepare("
        SELECT
            s.id, s.name, s.country_code, s.vendor, s.technology, s.domain,
            s.kpi_global, s.status, s.region, s.localite,
            COALESCE(NULLIF(s.latitude,  0), NULLIF(sm.latitude,  0), 0) AS latitude,
            COALESCE(NULLIF(s.longitude, 0), NULLIF(sm.longitude, 0), 0) AS longitude
        FROM sites s
        LEFT JOIN site_mapping sm ON sm.remote_id = s.id
        WHERE s.id = ?
        LIMIT 1
    ");
    $stmt->execute([$siteId]);
    $site = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$site) {
        echo json_encode(['success' => false, 'error' => 'Site non trouvÃ©']);
        exit;
    }

    // --- Nom du pays ---
    $cStmt = $pdo->prepare("SELECT country_name FROM countries WHERE country_code = ?");
    $cStmt->execute([$site['country_code']]);
    $country = $cStmt->fetch(PDO::FETCH_ASSOC);
    $site['country_name'] = $country['country_name'] ?? $site['country_code'];

    // --- Derniers KPIs (une ligne par technologie) ---
    // On trie par kpi_date DESC puis kpi_global ASC pour avoir le pire en premier
    $kpiStmt = $pdo->prepare("
        SELECT
            technology,
            kpi_date,
            kpi_global,
            status,
            worst_kpi_name,
            worst_kpi_value,
            imported_at
        FROM kpis_ran
        WHERE site_id = ?
        ORDER BY kpi_date DESC, kpi_global ASC
        LIMIT 10
    ");
    $kpiStmt->execute([$siteId]);
    $kpiRows = $kpiStmt->fetchAll(PDO::FETCH_ASSOC);

    // KPI le plus rÃ©cent (toutes technos confondues)
    $latestKpi = $kpiRows[0] ?? null;

    // KPI dÃ©gradant global : ligne avec le kpi_global le plus bas du jour
    $worstKpi = null;
    foreach ($kpiRows as $row) {
        if ($row['kpi_date'] === date('Y-m-d')) {
            if ($worstKpi === null || floatval($row['kpi_global']) < floatval($worstKpi['kpi_global'])) {
                $worstKpi = $row;
            }
        }
    }

    // Typage numÃ©rique
    $site['latitude']   = floatval($site['latitude']);
    $site['longitude']  = floatval($site['longitude']);
    $site['kpi_global'] = round(floatval($site['kpi_global']), 2);

    // Construire le tableau de KPIs par technologie (le plus rÃ©cent par techno)
    $kpiByTech = [];
    foreach ($kpiRows as $row) {
        $tech = $row['technology'];
        if (!isset($kpiByTech[$tech])) {
            $kpiByTech[$tech] = [
                'technology'      => $tech,
                'kpi_date'        => $row['kpi_date'],
                'kpi_global'      => round(floatval($row['kpi_global']), 2),
                'status'          => $row['status'],
                'worst_kpi_name'  => $row['worst_kpi_name'],
                'worst_kpi_value' => isset($row['worst_kpi_value']) ? round(floatval($row['worst_kpi_value']), 2) : null,
            ];
        }
    }

    $site['latest_kpis']   = $latestKpi;
    $site['worst_kpi']     = $worstKpi;
    $site['kpis_by_tech']  = array_values($kpiByTech);

    echo json_encode(['success' => true, 'data' => $site]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
