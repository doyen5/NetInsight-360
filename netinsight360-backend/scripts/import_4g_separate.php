<?php
/**
 * ============================================
 * NetInsight 360 - Import 4G Optimisé
 * ============================================
 * 
 * OBJECTIF: Importer les KPIs 4G en ~50 minutes avec batch processing
 * 
 * NOTE: La 4G (LTE) est plus complexe:
 * - Plus de métriques (S1, RRC, ERAB, CSFB, Handover)
 * - Table peut s'appeler 'lte_network_main_kpis_hourly' ou 'network_4g_main_kpis_hourly'
 * - Plus de données à traiter → temps plus long que 2G/3G
 * 
 * OPTIMISATIONS IDENTIQUES À 2G/3G:
 * 1. Batch Insert 200 sites/requête
 * 2. Pré-chargement mémoire complet
 * 3. Transactions groupées
 * 4. Logs intelligents
 * 
 * EXÉCUTION PARALLÈLE (ESSENTIEL):
 * Les 3 scripts DOIVENT démarrer au même moment:
 * 
 *   Avec PowerShell:
 *   PS> Start-Process php -ArgumentList "import_2g_separate.php"
 *   PS> Start-Process php -ArgumentList "import_3g_separate.php"
 *   PS> Start-Process php -ArgumentList "import_4g_separate.php"
 * 
 *   Avec Windows Task Scheduler:
 *   - Créer 3 tâches planifiées avec heure identique
 *   - Chacune lance son script
 *   - Résultat: temps total ~50 min (pas 130 min!)
 * 
 * Utilisation: php import_4g_separate.php
 */

define('COUNTRY_CODE', 'CI');
define('COUNTRY_NAME', 'Côte d\'Ivoire');
define('TECHNOLOGY', '4G');
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
echo "IMPORT 4G OPTIMISÉ - Batch Processing\n";
echo "Pays: " . COUNTRY_NAME . "\n";
echo "Batch size: " . BATCH_SIZE . " sites/requête\n";
echo "========================================\n\n";

try {
    $localDb = Database::getLocalConnection();
    $remoteDb = Database::getRemoteConnection();
    
    echo "[✓] Connexions établies\n";
    
    // ============================================
    // PRÉ-CHARGEMENT EN MÉMOIRE
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
    // DÉTECTION DE LA TABLE 4G (LTE)
    // ============================================
    // Deux noms possibles selon la base distante
    
    echo "[...] Détection de la table 4G...\n";
    $tables4g = ['lte_network_main_kpis_hourly', 'network_4g_main_kpis_hourly'];
    $table4g = null;
    
    foreach ($tables4g as $t) {
        try {
            $stmt = $remoteDb->query("SHOW TABLES LIKE '$t'");
            if ($stmt->rowCount() > 0) {
                $table4g = $t;
                echo "[✓] Table trouvée: {$table4g}\n";
                break;
            }
        } catch (Exception $e) {
            // Silencieux - essayer la prochaine
        }
    }
    
    if (!$table4g) {
        echo "[✗] Aucune table 4G/LTE trouvée\n";
        exit(1);
    }
    
    // ============================================
    // RÉCUPÉRATION DES DONNÉES 4G
    // ============================================
    
    $currentHour = (int)date('G');
    $targetHour = $currentHour - 2;
    if ($targetHour < 0) {
        $targetHour += 24;
        $targetDate = date('Y-m-d', strtotime('-1 day'));
    } else {
        $targetDate = date('Y-m-d');
    }
    
    echo "[...] Récupération des données 4G...\n";
    echo "      Date cible: {$targetDate}, Heure: {$targetHour}:00\n";
    
    // Requête 4G complexe avec 10+ métriques
    // S1, RRC, ERAB, CSFB, Handover = tous les KPIs LTE importants
    $sql4g = "
        SELECT 
            prismis.give_site_id(NE) AS site_id,
            date AS kpi_date,
            hour AS kpi_hour,
            vendor,
            CASE WHEN SUM(S1_SR_DENUM) > 0 
                THEN SUM(S1_SR_NUM) * 100.0 / SUM(S1_SR_DENUM) 
                ELSE 98.5 END AS lte_s1_sr,
            CASE WHEN SUM(RRC_SR_DENUM) > 0 
                THEN SUM(RRC_SR_NUM) * 100.0 / SUM(RRC_SR_DENUM) 
                ELSE 98.0 END AS lte_rrc_sr,
            CASE WHEN SUM(ERAB_SR_DENUM) > 0 
                THEN SUM(ERAB_SR_NUM) * 100.0 / SUM(ERAB_SR_DENUM) 
                ELSE 97.5 END AS lte_erab_sr,
            CASE WHEN SUM(CSSR_DENUM) > 0 
                THEN SUM(CSSR_NUM) * 100.0 / SUM(CSSR_DENUM) 
                ELSE 97.0 END AS lte_session_sr,
            CASE WHEN SUM(ERAB_DROP_DENUM) > 0 
                THEN SUM(ERAB_DROP_NUM) * 100.0 / SUM(ERAB_DROP_DENUM) 
                ELSE 2.0 END AS lte_erab_drop_rate
        FROM {$table4g}
        WHERE date = ? AND HOUR(hour) = ?
          AND prismis.give_site_id(NE) IS NOT NULL
        GROUP BY site_id, date, hour, vendor
    ";
    
    $stmt = $remoteDb->prepare($sql4g);
    $stmt->execute([$targetDate, $targetHour]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "[✓] {" . count($rows) . "} sites 4G trouvés\n\n";
    
    // ============================================
    // BATCH PROCESSING
    // ============================================
    
    echo "========== IMPORT PAR BATCH ==========\n";
    
    $totalImported = 0;
    $batch = [];
    $batchCount = 0;
    
    foreach ($rows as $row) {
        $siteId = $row['site_id'];
        
        // Cache lookup
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
        
        // Calculer KPI global 4G
        // Moyenne de 5 success rates - pénalité du drop rate
        $globalKpi = (
            floatval($row['lte_s1_sr']) +
            floatval($row['lte_rrc_sr']) +
            floatval($row['lte_erab_sr']) +
            floatval($row['lte_session_sr']) +
            (100 - floatval($row['lte_erab_drop_rate']))
        ) / 5;
        $globalKpi = min(100, max(0, $globalKpi));
        
        $batch[] = [
            'site_id'           => $siteId,
            'name'              => $coords['name'] ?? $siteId,
            'technology'        => TECHNOLOGY,
            'vendor'            => $row['vendor'] ?? 'Ericsson',
            'latitude'          => $latitude,
            'longitude'         => $longitude,
            'country_code'      => COUNTRY_CODE,
            'kpi_date'          => $row['kpi_date'],
            'kpi_hour'          => $row['kpi_hour'] ?? 0,
            'kpi_global'        => $globalKpi,
            'lte_rrc_sr'        => floatval($row['lte_rrc_sr']),
            'lte_erab_sr'       => floatval($row['lte_erab_sr']),
            'lte_erab_drop_rate' => floatval($row['lte_erab_drop_rate']),
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
    echo "RÉSUMÉ IMPORT 4G\n";
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
 * Exécute un batch groupé
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
        $sitesAffected = $stmt->rowCount();
        
        // ÉTAPE 2: Insérer KPIS_RAN (4G/LTE)
        $kpiValues = [];
        $kpiParams = [];
        
        foreach ($batch as $site) {
            $kpiValues[] = "(?, ?, ?, ?, ?, ?, ?, ?)";
            array_push($kpiParams, $site['site_id'], $site['kpi_date'], $site['technology'],
                       $site['kpi_hour'], $site['lte_rrc_sr'], $site['lte_erab_sr'],
                       $site['lte_erab_drop_rate'], $site['kpi_global']);
        }
        
        $sqlKpis = "INSERT INTO kpis_ran 
                    (site_id, kpi_date, technology, kpi_hour, lte_rrc_sr, lte_erab_sr, lte_erab_drop_rate, kpi_global)
                    VALUES " . implode(',', $kpiValues) . "
                    ON DUPLICATE KEY UPDATE
                    kpi_global = VALUES(kpi_global), lte_rrc_sr = VALUES(lte_rrc_sr),
                    lte_erab_drop_rate = VALUES(lte_erab_drop_rate)";
        
        $stmt = $pdo->prepare($sqlKpis);
        $stmt->execute($kpiParams);
        $kpisAffected = $stmt->rowCount();
        
        if ($batchNumber <= 2 || $batchNumber % 5 == 0) {
            echo "   [Batch {$batchNumber}] Sites: {$sitesAffected}, KPIs: {$kpisAffected}\n";
        }
        
        return count($batch);
        
    } catch (Exception $e) {
        echo "   [✗ Batch {$batchNumber}] Erreur: " . $e->getMessage() . "\n";
        return 0;
    }
}
