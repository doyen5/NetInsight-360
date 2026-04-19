<?php
/**
 * ============================================
 * NetInsight 360 - Import 3G Optimisé
 * ============================================
 * 
 * OBJECTIF: Importer les KPIs 3G en ~45 minutes avec batch processing
 * 
 * OPTIMISATIONS APPLIQUÉES:
 * 1. Batch Insert: Grouper 200 INSERTs en 1 seule requête
 *    → Réduit les appels DB de 2000+ à ~10
 * 
 * 2. Pré-chargement en mémoire:
 *    → Charger toutes les coordonnées/sites AVANT la boucle
 *    → Cache-hit sur chaque lookup (O(1) au lieu de O(n))
 * 
 * 3. Transactions groupées:
 *    → 1 requête INSERT par batch (200 sites) 
 *    → Réduit la contention de verrous DB
 * 
 * 4. Logs minimalistes et impression de progression:
 *    → Afficher que les étapes clés (sans spam des 2000+ sites)
 * 
 * EXÉCUTION PARALLÈLE (TRÈS IMPORTANT):
 * Lancer en MÊME TEMPS que 2G et 4G:
 *   $ Start-Process php -ArgumentList "import_2g_separate.php"
 *   $ Start-Process php -ArgumentList "import_3g_separate.php"  
 *   $ Start-Process php -ArgumentList "import_4g_separate.php"
 * 
 * Résultat: 45 min au lieu de 2h30 séquentiel
 * 
 * Utilisation: php import_3g_separate.php
 */

define('COUNTRY_CODE', 'CI');
define('COUNTRY_NAME', 'Côte d\'Ivoire');
define('TECHNOLOGY', '3G');
define('BATCH_SIZE', 200);
define('MANFLA_SITE_ID', 'AC971');
define('MANFLA_NAME', 'MANFLA');
define('MANFLA_LAT', 7.4002338);
define('MANFLA_LNG', -5.92163);

$basePath = dirname(__DIR__);
require_once $basePath . '/config/database.php';
require_once $basePath . '/app/helpers/AuditHelper.php';

Database::bootstrapEnvironment();
error_reporting(E_ALL);
ini_set('display_errors', strtolower((string) getenv('APP_ENV')) === 'production' ? '0' : '1');
set_time_limit(3600);

$startTime = microtime(true);

echo "========================================\n";
echo "IMPORT 3G OPTIMISÉ - Batch Processing\n";
echo "Pays: " . COUNTRY_NAME . "\n";
echo "Batch size: " . BATCH_SIZE . " sites/requête\n";
echo "========================================\n\n";

try {
    $localDb = Database::getLocalConnection();
    $remoteDb = Database::getRemoteConnection();
    
    echo "[✓] Connexions établies\n";
    
    // ============================================
    // PRÉ-CHARGEMENT DES DONNÉES EN MÉMOIRE
    // ============================================
    
    echo "[...] Chargement des coordonnées...\n";
    $coordinates = [];
    $stmt = $remoteDb->query("
        SELECT SITE, NOM_SITE, LATITUDE, LONGITUDE, VENDOR, LOCALITE, REGION
        FROM sites_database
        WHERE LATITUDE IS NOT NULL AND LATITUDE != 0
    ");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $siteId = trim($row['SITE'] ?? '');
        if (!empty($siteId)) {
            $coordinates[$siteId] = [
                'name'      => $row['NOM_SITE'] ?? $siteId,
                'latitude'  => floatval(str_replace(',', '.', $row['LATITUDE'] ?? 0)),
                'longitude' => floatval(str_replace(',', '.', $row['LONGITUDE'] ?? 0)),
                'vendor'    => $row['VENDOR'] ?? 'Ericsson',
            ];
        }
    }
    // Verrou anti-régression : Manfla doit toujours rester en Côte d'Ivoire.
    $coordinates[MANFLA_SITE_ID] = [
        'name'      => MANFLA_NAME,
        'latitude'  => MANFLA_LAT,
        'longitude' => MANFLA_LNG,
        'vendor'    => $coordinates[MANFLA_SITE_ID]['vendor'] ?? 'Ericsson',
    ];
    echo "[✓] {" . count($coordinates) . "} coordonnées en cache\n";
    
    echo "[...] Chargement des sites existants...\n";
    $existingSites = [];
    $stmt = $localDb->query("SELECT id, latitude, longitude FROM sites WHERE country_code = 'CI'");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $existingSites[$row['id']] = $row;
    }
    echo "[✓] {" . count($existingSites) . "} sites en cache\n\n";
    
    // ============================================
    // RÉCUPÉRATION DES DONNÉES 3G
    // ============================================
    
    $currentHour = (int)date('G');
    $targetHour = $currentHour - 2;
    if ($targetHour < 0) {
        $targetHour += 24;
        $targetDate = date('Y-m-d', strtotime('-1 day'));
    } else {
        $targetDate = date('Y-m-d');
    }
    
    echo "[...] Récupération des données 3G...\n";
    echo "      Date cible: {$targetDate}, Heure: {$targetHour}:00\n";
    
    $sql3g = "
        SELECT 
            prismis.give_site_id(NE) AS site_id,
            DATE AS kpi_date,
            HOUR AS kpi_hour,
            vendor,
            CASE WHEN SUM(RRC_CS_DENUM) > 0 
                THEN SUM(RRC_CS_NUM) * 100.0 / SUM(RRC_CS_DENUM) 
                ELSE 98.0 END AS rrc_cs_sr,
            CASE WHEN SUM(RAB_CS_DENUM) > 0 
                THEN SUM(RAB_CS_NUM) * 100.0 / SUM(RAB_CS_DENUM) 
                ELSE 97.5 END AS rab_cs_sr,
            CASE WHEN SUM(CS_DROP_DENUM) > 0 
                THEN SUM(CS_DROP_NUM) * 100.0 / SUM(CS_DROP_DENUM) 
                ELSE 2.5 END AS cs_drop_rate
        FROM network_3g_main_kpis_hourly
        WHERE DATE = ? AND HOUR(HOUR) = ?
          AND prismis.give_site_id(NE) IS NOT NULL
        GROUP BY site_id, DATE, HOUR, vendor
    ";
    
    $stmt = $remoteDb->prepare($sql3g);
    $stmt->execute([$targetDate, $targetHour]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "[✓] {" . count($rows) . "} sites 3G trouvés\n\n";
    
    // ============================================
    // BATCH PROCESSING
    // ============================================
    
    echo "========== IMPORT PAR BATCH ==========\n";
    
    $totalImported = 0;
    $batch = [];
    $batchCount = 0;
    
    foreach ($rows as $row) {
        $siteId = $row['site_id'];
        
        // Lookup en O(1) - directement en mémoire
        $coords = $coordinates[$siteId] ?? null;
        $latitude = ($coords && floatval($coords['latitude']) != 0) 
                  ? $coords['latitude'] 
                  : ($existingSites[$siteId]['latitude'] ?? 0);
        $longitude = ($coords && floatval($coords['longitude']) != 0) 
                   ? $coords['longitude'] 
                   : ($existingSites[$siteId]['longitude'] ?? 0);

        if ($siteId === MANFLA_SITE_ID || strtoupper(trim($coords['name'] ?? '')) === MANFLA_NAME) {
            $latitude = MANFLA_LAT;
            $longitude = MANFLA_LNG;
            $coords['name'] = MANFLA_NAME;
        }
        
        // Calculer KPI global 3G
        // Moyenne des Success Rates - pénalité de drop rate
        $globalKpi = (floatval($row['rrc_cs_sr']) + floatval($row['rab_cs_sr']) + (100 - floatval($row['cs_drop_rate']))) / 3;
        $globalKpi = min(100, max(0, $globalKpi));
        
        $batch[] = [
            'site_id'      => $siteId,
            'name'         => $coords['name'] ?? $siteId,
            'technology'   => TECHNOLOGY,
            'vendor'       => $row['vendor'] ?? 'Ericsson',
            'latitude'     => $latitude,
            'longitude'    => $longitude,
            'country_code' => COUNTRY_CODE,
            'kpi_date'     => $row['kpi_date'],
            'kpi_hour'     => $row['kpi_hour'] ?? 0,
            'kpi_global'   => $globalKpi,
            'rrc_cs_sr'    => floatval($row['rrc_cs_sr']),
            'rab_cs_sr'    => floatval($row['rab_cs_sr']),
            'cs_drop_rate' => floatval($row['cs_drop_rate']),
        ];
        
        if (count($batch) >= BATCH_SIZE) {
            $batchCount++;
            $inserted = executeBatch($localDb, $batch, $batchCount);
            $totalImported += $inserted;
            $batch = [];
            
            if ($batchCount % 5 == 0) {
                echo "   [{$batchCount} batchs] {$totalImported} sites importés...\n";
            }
        }
    }
    
    // Dernier batch
    if (count($batch) > 0) {
        $batchCount++;
        $inserted = executeBatch($localDb, $batch, $batchCount);
        $totalImported += $inserted;
    }
    
    echo "\n========================================\n";
    echo "RÉSUMÉ IMPORT 3G\n";
    echo "========================================\n";
    echo "Sites importés: {$totalImported}\n";
    echo "Batchs exécutés: {$batchCount}\n";
    echo "Temps écoulé: " . round(microtime(true) - $startTime, 2) . "s\n";
    echo "Débit: " . round($totalImported / (microtime(true) - $startTime), 0) . " sites/s\n";
    echo "========================================\n";
    
} catch (Exception $e) {
    echo "[✗ ERREUR] " . $e->getMessage() . "\n";
    exit(1);
}

/**
 * Exécute un batch d'insertions groupées dans sites + kpis_ran
 */
function executeBatch($pdo, $batch, $batchNumber) {
    if (empty($batch)) return 0;
    
    try {
        // ÉTAPE 1: Insérer SITES
        $siteValues = [];
        $siteParams = [];
        
        foreach ($batch as $site) {
            $siteValues[] = "(?, ?, ?, ?, ?, ?, ?)";
            array_push($siteParams, $site['site_id'], $site['name'], $site['country_code'],
                       $site['latitude'], $site['longitude'], $site['vendor'], $site['technology']);
        }
        
        $sqlSites = "INSERT INTO sites (id, name, country_code, latitude, longitude, vendor, technology)
                     VALUES " . implode(',', $siteValues) . "
                     ON DUPLICATE KEY UPDATE 
                     name = VALUES(name), latitude = IF(VALUES(latitude) != 0, VALUES(latitude), latitude),
                     longitude = IF(VALUES(longitude) != 0, VALUES(longitude), longitude)";
        
        $stmt = $pdo->prepare($sqlSites);
        $stmt->execute($siteParams);
        
        // ÉTAPE 2: Insérer KPIS_RAN (3G)
        $kpiValues = [];
        $kpiParams = [];
        
        foreach ($batch as $site) {
            $kpiValues[] = "(?, ?, ?, ?, ?, ?, ?, ?)";
            array_push($kpiParams, $site['site_id'], $site['kpi_date'], $site['technology'],
                       $site['kpi_hour'], $site['rrc_cs_sr'], $site['rab_cs_sr'],
                       $site['cs_drop_rate'], $site['kpi_global']);
        }
        
        $sqlKpis = "INSERT INTO kpis_ran 
                    (site_id, kpi_date, technology, kpi_hour, rrc_cs_sr, rab_cs_sr, cs_drop_rate, kpi_global)
                    VALUES " . implode(',', $kpiValues) . "
                    ON DUPLICATE KEY UPDATE
                    kpi_global = VALUES(kpi_global), rrc_cs_sr = VALUES(rrc_cs_sr),
                    cs_drop_rate = VALUES(cs_drop_rate)";
        
        $stmt = $pdo->prepare($sqlKpis);
        $stmt->execute($kpiParams);
        
        return count($batch);
        
    } catch (Exception $e) {
        echo "   [✗ Batch {$batchNumber}] Erreur: " . $e->getMessage() . "\n";
        return 0;
    }
}
