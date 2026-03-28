<?php
/**
 * NetInsight 360 - Import complet des KPIs RAN (2G/3G/4G) pour la Côte d'Ivoire
 * 
 * Ce script :
 * 1. Récupère les KPIs depuis la base distante (2G, 3G, 4G)
 * 2. Enrichit les sites avec les coordonnées depuis un fichier CSV
 * 3. Importe les données dans la base locale
 * 
 * Exécution : php import_ran_kpis_complete.php
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

define('COUNTRY_CODE', 'CI');
define('COUNTRY_NAME', 'Côte d\'Ivoire');

// Chemins
$basePath = dirname(__DIR__);
$csvFile = $basePath . '/data/sites_coordinates.csv';

require_once $basePath . '/config/database.php';

/**
 * Classe principale d'import
 */
class RanKpiCompleteImporter
{
    /*
     * Source des coordonnées : table `sites_database` sur le serveur distant
     * (NetPulseAI_NetworkInsight). Les IDs dans cette table correspondent
     * exactement aux IDs des KPIs (AC001, AC002...), donc pas de mismatch.
     *
     * Priorité pour les coordonnées lors de updateOrCreateSite() :
     *   1. Cache $coordinates (chargé depuis sites_database distant)
     *   2. Valeurs déjà présentes dans `sites` local (si != 0)
     *   3. 0,0 par défaut (pas de coords)
     */
    private $localDb;
    private $remoteDb;
    private $date;
    private $coordinates = []; // Cache coordonnées depuis sites_database distant
    private $stats = [
        '2G' => ['imported' => 0, 'failed' => 0],
        '3G' => ['imported' => 0, 'failed' => 0],
        '4G' => ['imported' => 0, 'failed' => 0],
        'sites_updated' => 0,
        'sites_inserted' => 0,
        'alerts_created' => 0
    ];
    
    public function __construct()
    {
        $this->date = date('Y-m-d');
        
        try {
            $this->localDb = Database::getLocalConnection();
            $this->remoteDb = Database::getRemoteConnection();
            echo "[OK] Connexions établies\n\n";
        } catch (Exception $e) {
            die("[ERREUR] Connexion impossible: " . $e->getMessage() . "\n");
        }
        
        // Charger les coordonnées depuis la base distante (sites_database)
        $this->loadCoordinates();
    }

    /**
     * Charge les coordonnées depuis la table `sites_database` sur le serveur distant.
     * Cette table contient les mêmes IDs (AC001, AC002...) que les tables de KPIs,
     * donc aucun risque de mismatch.
     */
    private function loadCoordinates()
    {
        try {
            $stmt = $this->remoteDb->query("
                SELECT SITE, NOM_SITE, LOCALITE, REGION, ZONE_LOC,
                       LATITUDE, LONGITUDE, VENDOR, ZONE_OPERATIONELLE
                FROM sites_database
                WHERE LATITUDE IS NOT NULL AND LATITUDE != 0
            ");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($rows as $row) {
                $siteId = trim($row['SITE'] ?? '');
                if (empty($siteId)) continue;

                $this->coordinates[$siteId] = [
                    'name'       => $row['NOM_SITE']  ?? $siteId,
                    'latitude'   => floatval(str_replace(',', '.', $row['LATITUDE'])),
                    'longitude'  => floatval(str_replace(',', '.', $row['LONGITUDE'])),
                    'vendor'     => $row['VENDOR']    ?? 'Ericsson',
                    'localite'   => $row['LOCALITE']  ?? null,
                    'region'     => $row['REGION']    ?? null,
                    'zone_loc'   => $row['ZONE_LOC']  ?? null,
                    'zone_op'    => $row['ZONE_OPERATIONELLE'] ?? null,
                    'country_code' => 'CI',
                ];
            }

            echo "[OK] Chargé " . count($this->coordinates) . " sites depuis sites_database (base distante)\n\n";
        } catch (Exception $e) {
            echo "[AVERTISSEMENT] Impossible de charger sites_database: " . $e->getMessage() . "\n";
            echo "Les sites seront créés sans coordonnées.\n\n";
        }
    }

    // Ligne fictive pour compatibilité avec l'ancien code — non utilisée
    private function _unused_processedIds() {
        $processedIds = [];
            
    }
    
    /**
     * Point d'entrée principal
     */
    public function run()
    {
        echo "========================================\n";
        echo "IMPORT COMPLET DES KPIs RAN\n";
        echo "Pays: " . COUNTRY_NAME . "\n";
        echo "Date: " . $this->date . "\n";
        echo "========================================\n\n";
        
        // Heure de référence (H-2) — gestion du débordement sur le jour précédent
        $currentHour = (int)date('G');
        $targetHour  = $currentHour - 2;
        if ($targetHour < 0) {
            $targetHour += 24;
            $targetDate  = date('Y-m-d', strtotime('-1 day'));
        } else {
            $targetDate  = date('Y-m-d');
        }
        echo "[INFO] Heure de référence: {$targetHour}h du {$targetDate} (H-2)\n\n";
        
        // Import 2G
        echo "--- IMPORT 2G ---\n";
        $this->import2GKpis($targetDate, $targetHour);
        echo "   Importé: " . $this->stats['2G']['imported'] . " enregistrements\n";
        echo "   Échecs: " . $this->stats['2G']['failed'] . "\n\n";
        
        // Import 3G
        echo "--- IMPORT 3G ---\n";
        $this->import3GKpis($targetDate, $targetHour);
        echo "   Importé: " . $this->stats['3G']['imported'] . " enregistrements\n";
        echo "   Échecs: " . $this->stats['3G']['failed'] . "\n\n";
        
        // Import 4G
        echo "--- IMPORT 4G ---\n";
        $this->import4GKpis($targetDate, $targetHour);
        echo "   Importé: " . $this->stats['4G']['imported'] . " enregistrements\n";
        echo "   Échecs: " . $this->stats['4G']['failed'] . "\n\n";
        
        // Génération des alertes
        echo "--- GÉNÉRATION DES ALERTES ---\n";
        $this->generateAlerts();
        echo "   Alertes créées: " . $this->stats['alerts_created'] . "\n\n";
        
        // Récapitulatif
        echo "========================================\n";
        echo "RÉCAPITULATIF\n";
        echo "========================================\n";
        echo "Sites mis à jour/insérés: " . ($this->stats['sites_updated'] + $this->stats['sites_inserted']) . "\n";
        echo "KPIs 2G importés: " . $this->stats['2G']['imported'] . "\n";
        echo "KPIs 3G importés: " . $this->stats['3G']['imported'] . "\n";
        echo "KPIs 4G importés: " . $this->stats['4G']['imported'] . "\n";
        echo "Alertes créées: " . $this->stats['alerts_created'] . "\n";
        echo "========================================\n";
    }
    
    /**
     * Met à jour ou crée un site.
     * Les coordonnées viennent en priorité du cache $coordinates
     * (chargé depuis sites_database sur la base distante).
     * Fallback : valeurs déjà en base locale si != 0.
     */
    private function updateOrCreateSite($siteId, $technology, $vendor = null)
    {
        // Vérifier si le site existe déjà
        $checkStmt = $this->localDb->prepare("SELECT id, name, latitude, longitude, country_code, vendor FROM sites WHERE id = ? LIMIT 1");
        $checkStmt->execute([$siteId]);
        $existingSite = $checkStmt->fetch(PDO::FETCH_ASSOC);
        $exists = (bool)$existingSite;

        // Valeurs par défaut
        $name        = $siteId;
        $latitude    = 0.0;
        $longitude   = 0.0;
        $countryCode = COUNTRY_CODE;
        $vendorFinal = $vendor ?? 'Ericsson';
        $region      = null;
        $localite    = null;
        $source      = 'none';

        // 1) Priorité : cache depuis sites_database distant
        $remote = $this->coordinates[$siteId] ?? null;
        if ($remote && floatval($remote['latitude']) != 0) {
            $name        = $remote['name']        ?: $siteId;
            $latitude    = floatval($remote['latitude']);
            $longitude   = floatval($remote['longitude']);
            $vendorFinal = $remote['vendor']      ?: $vendorFinal;
            $region      = $remote['region']      ?? null;
            $localite    = $remote['localite']    ?? null;
            $source      = 'sites_database';
        }
        // 2) Fallback : coordonnées déjà présentes en base locale
        elseif ($existingSite && floatval($existingSite['latitude']) != 0) {
            $name        = $existingSite['name']         ?: $siteId;
            $latitude    = floatval($existingSite['latitude']);
            $longitude   = floatval($existingSite['longitude']);
            $vendorFinal = $existingSite['vendor']       ?: $vendorFinal;
            $source      = 'existing';
        }

        $domain = ($technology === 'CORE') ? 'CORE' : 'RAN';

        if ($exists) {
            // Ne mettre à jour les coordonnées que si on en a de meilleures (source distante)
            // Sinon conserver celles déjà en base
            $updateCoords = ($source === 'sites_database') ? ", latitude = ?, longitude = ?" : "";
            $sql = "UPDATE sites SET
                        name = ?, vendor = ?, technology = ?,
                        domain = ?, region = ?, localite = ?,
                        updated_at = NOW()
                        $updateCoords
                    WHERE id = ?";
            $params = [$name, $vendorFinal, $technology, $domain, $region, $localite];
            if ($source === 'sites_database') {
                $params[] = $latitude;
                $params[] = $longitude;
            }
            $params[] = $siteId;
            $stmt = $this->localDb->prepare($sql);
            $stmt->execute($params);
            $this->stats['sites_updated']++;
            if ($latitude != 0) {
                echo "      [SITE] $siteId mis à jour (source coords: $source)\n";
            }
        } else {
            // Insérer
            $sql = "INSERT INTO sites
                    (id, name, latitude, longitude, country_code, vendor, technology, domain, status, region, localite, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NOW())";
            $stmt = $this->localDb->prepare($sql);
            $stmt->execute([
                $siteId, $name, $latitude, $longitude,
                $countryCode, $vendorFinal, $technology,
                $domain, $region, $localite
            ]);
            $this->stats['sites_inserted']++;
            if ($latitude != 0) {
                echo "      [SITE] Nouveau site $siteId avec coordonnées (source: $source)\n";
            } else {
                echo "      [SITE] Nouveau site $siteId (sans coordonnées)\n";
            }
        }
    }
    
    /**
     * Import des KPIs 2G
     */
    private function import2GKpis($targetDate, $targetHour)
    {
        $sql = "
            SELECT 
                prismis.give_site_id(CELL_NAME) AS site_id,
                DATE_ID AS kpi_date,
                HOUR_ID AS kpi_hour,
                vendor,
                -- Calcul des KPIs 2G
                CASE WHEN SUM(TCH_AVAIL_DENUM) > 0 
                    THEN SUM(TCH_AVAIL_NUM) * 100.0 / SUM(TCH_AVAIL_DENUM) 
                    ELSE 99.5 END AS tch_availability,
                CASE WHEN SUM(CALL_DROP_DENUM) > 0 
                    THEN SUM(CALL_DROP_NUM) * 100.0 / SUM(CALL_DROP_DENUM) 
                    ELSE 1.5 END AS call_drop_rate,
                CASE WHEN SUM(SD_CONG_DENUM) > 0 
                    THEN SUM(SD_CONG_NUM) * 100.0 / SUM(SD_CONG_DENUM)
                    ELSE 0.3 END AS sdcch_cong,
                CASE WHEN SUM(SD_DROP_DENUM) > 0 
                    THEN SUM(SD_DROP_NUM) * 100.0 / SUM(SD_DROP_DENUM)
                    ELSE 0.2 END AS sdcch_drop,
                CASE WHEN SUM(HO_ATTEMPT) > 0 
                    THEN SUM(HO_SUCCES) * 100.0 / SUM(HO_ATTEMPT)
                    ELSE 98.5 END AS handover_sr
            FROM network_2g_main_kpis_hourly
            WHERE DATE_ID = ?
              AND HOUR(HOUR_ID) = ?
              AND prismis.give_site_id(CELL_NAME) IS NOT NULL
            GROUP BY site_id, DATE_ID, HOUR_ID, vendor
        ";
        
        $stmt = $this->remoteDb->prepare($sql);
        $stmt->execute([$targetDate, $targetHour]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "   Récupéré: " . count($rows) . " sites 2G\n";
        
        foreach ($rows as $row) {
            try {
                $siteId = $row['site_id'];
                
                // Mettre à jour ou créer le site
                $this->updateOrCreateSite($siteId, '2G', $row['vendor'] ?? null);
                
                // Calculer le KPI global
                $globalKpi = $this->calculate2GGlobalKpi($row);
                $status = $this->determineStatus($globalKpi);
                
                // Insérer dans kpis_ran
                $this->insertKpi('2G', $siteId, $globalKpi, $status, $row);
                $this->stats['2G']['imported']++;
                
            } catch (Exception $e) {
                $this->stats['2G']['failed']++;
                echo "   [ERREUR] Site " . ($row['site_id'] ?? '?') . ": " . $e->getMessage() . "\n";
            }
        }
    }
    
    /**
     * Import des KPIs 3G
     */
    private function import3GKpis($targetDate, $targetHour)
    {
        $sql = "
            SELECT 
                prismis.give_site_id(NE) AS site_id,
                DATE AS kpi_date,
                HOUR AS kpi_hour,
                vendor,
                -- Success rates
                CASE WHEN SUM(RRC_CS_DENUM) > 0 
                    THEN SUM(RRC_CS_NUM) * 100.0 / SUM(RRC_CS_DENUM) 
                    ELSE 98.0 END AS rrc_cs_sr,
                CASE WHEN SUM(RAB_CS_DENUM) > 0 
                    THEN SUM(RAB_CS_NUM) * 100.0 / SUM(RAB_CS_DENUM) 
                    ELSE 97.5 END AS rab_cs_sr,
                CASE WHEN SUM(RRC_PS_DENUM) > 0 
                    THEN SUM(RRC_PS_NUM) * 100.0 / SUM(RRC_PS_DENUM) 
                    ELSE 97.0 END AS rrc_ps_sr,
                -- Drop rates
                CASE WHEN SUM(CS_DROP_DENUM) > 0 
                    THEN SUM(CS_DROP_NUM) * 100.0 / SUM(CS_DROP_DENUM) 
                    ELSE 2.5 END AS cs_drop_rate,
                CASE WHEN SUM(PS_DROP_DENUM) > 0 
                    THEN SUM(PS_DROP_NUM) * 100.0 / SUM(PS_DROP_DENUM) 
                    ELSE 3.0 END AS ps_drop_rate,
                -- Handover
                CASE WHEN SUM(SOFT_HO_DENUM) > 0 
                    THEN SUM(SOFT_HO_NUM) * 100.0 / SUM(SOFT_HO_DENUM) 
                    ELSE 96.0 END AS soft_ho_rate
            FROM network_3g_main_kpis_hourly
            WHERE DATE = ?
              AND HOUR(HOUR) = ?
              AND prismis.give_site_id(NE) IS NOT NULL
            GROUP BY site_id, DATE, HOUR, vendor
        ";
        
        $stmt = $this->remoteDb->prepare($sql);
        $stmt->execute([$targetDate, $targetHour]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "   Récupéré: " . count($rows) . " sites 3G\n";
        
        foreach ($rows as $row) {
            try {
                $siteId = $row['site_id'];
                
                $this->updateOrCreateSite($siteId, '3G', $row['vendor'] ?? null);
                
                $globalKpi = $this->calculate3GGlobalKpi($row);
                $status = $this->determineStatus($globalKpi);
                
                $this->insertKpi('3G', $siteId, $globalKpi, $status, $row);
                $this->stats['3G']['imported']++;
                
            } catch (Exception $e) {
                $this->stats['3G']['failed']++;
                echo "   [ERREUR] Site " . ($row['site_id'] ?? '?') . ": " . $e->getMessage() . "\n";
            }
        }
    }
    
    /**
     * Import des KPIs 4G
     */
    private function import4GKpis($targetDate, $targetHour)
    {
        // Détection de la table 4G
        $tables = ['lte_network_main_kpis_hourly', 'network_4g_main_kpis_hourly'];
        $tableName = null;
        
        foreach ($tables as $table) {
            $stmt = $this->remoteDb->query("SHOW TABLES LIKE '$table'");
            if ($stmt->rowCount() > 0) {
                $tableName = $table;
                break;
            }
        }
        
        if (!$tableName) {
            echo "   [AVERTISSEMENT] Table 4G non trouvée\n";
            return;
        }
        
        $sql = "
            SELECT 
                prismis.give_site_id(NE) AS site_id,
                date AS kpi_date,
                hour AS kpi_hour,
                vendor,
                -- Success rates
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
                -- Drop rate
                CASE WHEN SUM(ERAB_DROP_DENUM) > 0 
                    THEN SUM(ERAB_DROP_NUM) * 100.0 / SUM(ERAB_DROP_DENUM) 
                    ELSE 2.0 END AS lte_erab_drop_rate,
                -- CSFB
                CASE WHEN SUM(CSFB_DENUM) > 0 
                    THEN SUM(CSFB_NUM) * 100.0 / SUM(CSFB_DENUM) 
                    ELSE 97.5 END AS lte_csfb_sr,
                -- Handovers
                CASE WHEN SUM(INTRA_FREQUENCY_DENUM) > 0 
                    THEN SUM(INTRA_FREQUENCY_NUM) * 100.0 / SUM(INTRA_FREQUENCY_DENUM) 
                    ELSE 97.0 END AS lte_intra_freq_sr,
                CASE WHEN SUM(INTER_FREQUENCY_DENUM) > 0 
                    THEN SUM(INTER_FREQUENCY_NUM) * 100.0 / SUM(INTER_FREQUENCY_DENUM) 
                    ELSE 96.5 END AS lte_inter_freq_sr
            FROM {$tableName}
            WHERE date = ?
              AND HOUR(hour) = ?
              AND prismis.give_site_id(NE) IS NOT NULL
            GROUP BY site_id, date, hour, vendor
        ";
        
        $stmt = $this->remoteDb->prepare($sql);
        $stmt->execute([$targetDate, $targetHour]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "   Récupéré: " . count($rows) . " sites 4G\n";
        
        foreach ($rows as $row) {
            try {
                $siteId = $row['site_id'];
                
                $this->updateOrCreateSite($siteId, '4G', $row['vendor'] ?? null);
                
                $globalKpi = $this->calculate4GGlobalKpi($row);
                $status = $this->determineStatus($globalKpi);
                
                $this->insertKpi('4G', $siteId, $globalKpi, $status, $row);
                $this->stats['4G']['imported']++;
                
            } catch (Exception $e) {
                $this->stats['4G']['failed']++;
                echo "   [ERREUR] Site " . ($row['site_id'] ?? '?') . ": " . $e->getMessage() . "\n";
            }
        }
    }
    
    /**
     * Insère un KPI dans la base.
     * Identifie le KPI dégradant (valeur la plus basse) et le stocke
     * dans worst_kpi_name / worst_kpi_value pour l'affichage dans le détail du site.
     */
    private function insertKpi($technology, $siteId, $globalKpi, $status, $data)
    {
        // Identifier le KPI dégradant selon la technologie
        $worstKpiName  = null;
        $worstKpiValue = null;

        if ($technology === '2G') {
            $candidates = [
                'Disponibilité TCH'   => $data['tch_availability']  ?? null,
                'Taux de chute appel' => isset($data['call_drop_rate'])  ? (100 - $data['call_drop_rate'])  : null,
                'Succès Handover'     => $data['handover_sr']        ?? null,
                'SDCCH Congestion'    => isset($data['sdcch_cong'])   ? (100 - $data['sdcch_cong'])   : null,
                'SDCCH Chute'         => isset($data['sdcch_drop'])   ? (100 - $data['sdcch_drop'])   : null,
            ];
        } elseif ($technology === '3G') {
            $candidates = [
                'RRC CS SR'           => $data['rrc_cs_sr']          ?? null,
                'RAB CS SR'           => $data['rab_cs_sr']          ?? null,
                'RRC PS SR'           => $data['rrc_ps_sr']          ?? null,
                'Chute CS'            => isset($data['cs_drop_rate']) ? (100 - $data['cs_drop_rate']) : null,
                'Soft HO'             => $data['soft_ho_rate']       ?? null,
            ];
        } else { // 4G
            $candidates = [
                'S1 SR'               => $data['lte_s1_sr']          ?? null,
                'RRC SR'              => $data['lte_rrc_sr']         ?? null,
                'ERAB SR'             => $data['lte_erab_sr']        ?? null,
                'Session SR'          => $data['lte_session_sr']     ?? null,
                'CSFB SR'             => $data['lte_csfb_sr']        ?? null,
                'Chute ERAB'          => isset($data['lte_erab_drop_rate']) ? (100 - $data['lte_erab_drop_rate']) : null,
                'HO Intra-freq'       => $data['lte_intra_freq_sr']  ?? null,
                'HO Inter-freq'       => $data['lte_inter_freq_sr']  ?? null,
            ];
        }

        // Trouver la valeur minimale parmi les candidats non nuls
        foreach ($candidates as $label => $val) {
            if ($val === null) continue;
            if ($worstKpiValue === null || $val < $worstKpiValue) {
                $worstKpiValue = round($val, 2);
                $worstKpiName  = $label;
            }
        }

        // Insérer / mettre à jour kpis_ran
        $sql = "
            INSERT INTO kpis_ran
                (site_id, kpi_date, technology, kpi_global, status, worst_kpi_name, worst_kpi_value, imported_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                kpi_global       = VALUES(kpi_global),
                status           = VALUES(status),
                worst_kpi_name   = VALUES(worst_kpi_name),
                worst_kpi_value  = VALUES(worst_kpi_value),
                imported_at      = NOW()
        ";
        $stmt = $this->localDb->prepare($sql);
        $stmt->execute([$siteId, $this->date, $technology, $globalKpi, $status, $worstKpiName, $worstKpiValue]);

        // Historique
        $historyStmt = $this->localDb->prepare("
            INSERT INTO kpi_daily_history (site_id, kpi_name, kpi_value, recorded_date, technology, domain)
            VALUES (?, 'RNA', ?, ?, ?, 'RAN')
            ON DUPLICATE KEY UPDATE kpi_value = VALUES(kpi_value)
        ");
        $historyStmt->execute([$siteId, $globalKpi, $this->date, $technology]);
    }
    
    /**
     * Calcule le KPI global pour la 2G
     */
    private function calculate2GGlobalKpi($data)
    {
        $scores = [];
        
        if (isset($data['tch_availability'])) {
            $scores[] = min(100, ($data['tch_availability'] / 99) * 100);
        }
        
        if (isset($data['call_drop_rate'])) {
            $cssr = 100 - $data['call_drop_rate'];
            $scores[] = min(100, ($cssr / 98) * 100);
        }
        
        if (isset($data['handover_sr'])) {
            $scores[] = min(100, ($data['handover_sr'] / 98) * 100);
        }
        
        if (empty($scores)) return 95;
        return round(array_sum($scores) / count($scores), 2);
    }
    
    /**
     * Calcule le KPI global pour la 3G
     */
    private function calculate3GGlobalKpi($data)
    {
        $scores = [];
        
        $kpis = ['rrc_cs_sr', 'rab_cs_sr', 'rrc_ps_sr', 'cssr_cs_sr', 'cssr_ps_sr', 'soft_ho_rate'];
        foreach ($kpis as $kpi) {
            if (isset($data[$kpi])) {
                $scores[] = min(100, ($data[$kpi] / 98) * 100);
            }
        }
        
        if (isset($data['cs_drop_rate'])) {
            $scores[] = max(0, min(100, (1 - ($data['cs_drop_rate'] / 5)) * 100));
        }
        
        if (empty($scores)) return 95;
        return round(array_sum($scores) / count($scores), 2);
    }
    
    /**
     * Calcule le KPI global pour la 4G
     */
    private function calculate4GGlobalKpi($data)
    {
        $scores = [];
        
        $kpis = ['lte_s1_sr', 'lte_rrc_sr', 'lte_erab_sr', 'lte_session_sr', 'lte_csfb_sr', 'lte_intra_freq_sr', 'lte_inter_freq_sr'];
        foreach ($kpis as $kpi) {
            if (isset($data[$kpi])) {
                $scores[] = min(100, ($data[$kpi] / 98) * 100);
            }
        }
        
        if (isset($data['lte_erab_drop_rate'])) {
            $scores[] = max(0, min(100, (1 - ($data['lte_erab_drop_rate'] / 5)) * 100));
        }
        
        if (empty($scores)) return 95;
        return round(array_sum($scores) / count($scores), 2);
    }
    
    /**
     * Détermine le statut
     */
    private function determineStatus($kpiGlobal)
    {
        if ($kpiGlobal >= 95) return 'good';
        if ($kpiGlobal >= 90) return 'warning';
        return 'critical';
    }
    
    /**
     * Génère des alertes
     */
    private function generateAlerts()
    {
        $sql = "SELECT site_id, kpi_global, status FROM kpis_ran WHERE kpi_date = ? AND status IN ('warning', 'critical')";
        $stmt = $this->localDb->prepare($sql);
        $stmt->execute([$this->date]);
        $criticalSites = $stmt->fetchAll();
        
        foreach ($criticalSites as $site) {
            $alertType = $site['status'];
            
            $check = $this->localDb->prepare("SELECT COUNT(*) FROM alerts WHERE site_id = ? AND status = 'active'");
            $check->execute([$site['site_id']]);
            
            if ($check->fetchColumn() == 0) {
                $insert = $this->localDb->prepare("
                    INSERT INTO alerts (site_id, alert_type, kpi_name, current_value, threshold_value, message, status, created_at)
                    VALUES (?, ?, 'KPI_Global', ?, 90, ?, 'active', NOW())
                ");
                
                $message = $alertType === 'critical' 
                    ? "KPI global critique : {$site['kpi_global']}%"
                    : "KPI global en alerte : {$site['kpi_global']}%";
                
                $insert->execute([$site['site_id'], $alertType, $site['kpi_global'], $message]);
                $this->stats['alerts_created']++;
            }
        }
    }
}

// Exécution
$importer = new RanKpiCompleteImporter();
$importer->run();