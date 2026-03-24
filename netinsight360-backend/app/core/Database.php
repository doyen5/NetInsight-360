<?php
/**
 * NetInsight 360 - Gestionnaire de bases de données
 * 
 * Classe unifiée pour interagir avec les bases locale et distante
 * Fournit des méthodes pour les requêtes courantes et la gestion des KPIs
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../helpers/EnvHelper.php';

class Database
{
    /** @var PDO Connexion locale */
    private $localDb;
    
    /** @var PDO Connexion distante */
    private $remoteDb;
    
    /** @var array Configuration des seuils */
    private $thresholds;
    
    /**
     * Constructeur - Initialise les connexions
     */
    public function __construct()
    {
        $this->localDb = DatabaseConfig::getLocalConnection();
        $this->remoteDb = DatabaseConfig::getRemoteConnection();
        $this->thresholds = include __DIR__ . '/../../config/thresholds.php';
    }
    
    // ============================================
    // MÉTHODES POUR LA BASE LOCALE
    // ============================================
    
    /**
     * Récupère les KPIs RAN depuis la base locale
     * 
     * @param string $countryCode Code pays (CI, NE, BJ, TG, CF)
     * @param string $technology Technologie (2G, 3G, 4G)
     * @param string $vendor Vendor (Huawei, Ericsson)
     * @return array
     */
    public function getLocalRanKpis(?string $countryCode = null, ?string $technology = null, ?string $vendor = null): array
    {
        $sql = "SELECT s.id, s.name, s.country_code, c.name as country_name, 
                       s.vendor, s.technology, s.domain,
                       k.kpi_date, k.kpi_global, k.status,
                       k.rna_2g, k.tch_availability, k.cssr_2g, k.sdcch_cong, 
                       k.sdcch_drop, k.tch_drop_rate, k.tch_cong_rate, k.handover_sr_2g,
                       k.rrc_cs_sr, k.rab_cs_sr, k.rrc_ps_sr, k.cssr_cs_sr, k.cssr_ps_sr,
                       k.cs_drop_rate, k.ps_drop_rate, k.soft_ho_rate,
                       k.ul_throughput_3g, k.dl_throughput_3g,
                       k.lte_s1_sr, k.lte_rrc_sr, k.lte_erab_sr, k.lte_session_sr,
                       k.lte_erab_drop_rate, k.lte_csfb_sr, k.lte_intra_freq_sr, k.lte_inter_freq_sr,
                       k.lte_dl_prb_util, k.lte_ul_throughput, k.lte_dl_throughput
                FROM sites s
                JOIN countries c ON s.country_code = c.code
                LEFT JOIN kpis_ran k ON s.id = k.site_id
                    AND k.kpi_date = (SELECT MAX(kpi_date) FROM kpis_ran WHERE site_id = s.id)
                WHERE s.domain = 'RAN'
                  AND s.status = 'active'";
        
        $params = [];
        
        if ($countryCode && $countryCode !== 'all') {
            $sql .= " AND s.country_code = ?";
            $params[] = $countryCode;
        }
        
        if ($technology && $technology !== 'all') {
            $sql .= " AND s.technology = ?";
            $params[] = $technology;
        }
        
        if ($vendor && $vendor !== 'all') {
            $sql .= " AND s.vendor = ?";
            $params[] = $vendor;
        }
        
        $stmt = $this->localDb->prepare($sql);
        $stmt->execute($params);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Récupère les KPIs CORE depuis la base locale
     * 
     * @param string $countryCode Code pays
     * @return array
     */
    public function getLocalCoreKpis(?string $countryCode = null): array
    {
        $sql = "SELECT s.id, s.name, s.country_code, c.name as country_name, 
                       s.vendor,
                       k.packet_loss, k.latency, k.jitter, k.throughput, k.availability,
                       k.kpi_global, k.status
                FROM sites s
                JOIN countries c ON s.country_code = c.code
                LEFT JOIN kpis_core k ON s.id = k.site_id 
                    AND k.kpi_date = (SELECT MAX(kpi_date) FROM kpis_core WHERE site_id = s.id)
                WHERE s.domain = 'CORE'
                  AND s.status = 'active'";
        
        $params = [];
        
        if ($countryCode && $countryCode !== 'all') {
            $sql .= " AND s.country_code = ?";
            $params[] = $countryCode;
        }
        
        $stmt = $this->localDb->prepare($sql);
        $stmt->execute($params);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Récupère les tendances sur N jours pour un KPI
     * 
     * @param string $siteId ID du site
     * @param string $kpiName Nom du KPI
     * @param int $days Nombre de jours
     * @return array
     */
    public function getKpiTrends(string $siteId, string $kpiName, int $days = 5): array
    {
        $sql = "SELECT recorded_date, kpi_value 
                FROM kpi_daily_history 
                WHERE site_id = ? AND kpi_name = ?
                ORDER BY recorded_date DESC 
                LIMIT ?";
        
        $stmt = $this->localDb->prepare($sql);
        $stmt->execute([$siteId, $kpiName, $days]);
        
        $results = $stmt->fetchAll();
        
        // Retourner dans l'ordre chronologique
        return array_reverse($results);
    }
    
    /**
     * Récupère les pires sites par KPI
     * 
     * @param string $kpiName Nom du KPI
     * @param int $limit Nombre de résultats
     * @return array
     */
    public function getWorstSitesByKpi(string $kpiName, int $limit = 5): array
    {
        $sql = "SELECT s.id, s.name, s.country_code, c.name as country_name,
                       s.vendor, s.technology,
                       h.kpi_value, h.recorded_date,
                       t.critical_threshold, t.warning_threshold
                FROM kpi_daily_history h
                JOIN sites s ON h.site_id = s.id
                JOIN countries c ON s.country_code = c.code
                LEFT JOIN alert_thresholds t ON t.kpi_name = h.kpi_name 
                    AND t.technology = s.technology
                WHERE h.kpi_name = ?
                  AND h.recorded_date = (SELECT MAX(recorded_date) FROM kpi_daily_history)
                ORDER BY h.kpi_value ASC
                LIMIT ?";
        
        $stmt = $this->localDb->prepare($sql);
        $stmt->execute([$kpiName, $limit]);
        
        return $stmt->fetchAll();
    }
    
    // ============================================
    // MÉTHODES POUR LA BASE DISTANTE
    // ============================================
    
    /**
     * Récupère les KPIs 2G depuis la base distante
     * 
     * @param string $countryCode Code pays
     * @param string $date Date au format YYYY-MM-DD
     * @return array
     */
    public function getRemote2GKpis(?string $countryCode = null, ?string $date = null): array
    {
        $date = $date ?: date('Y-m-d');
        
        $sql = "SELECT site_id, tch_availability, cssr, sdcch_cong, sdcch_drop,
                       tch_drop_rate, tch_cong_rate, handover_sr, kpi_date
                FROM ran_2g_kpis 
                WHERE kpi_date = ?";
        
        $params = [$date];
        
        if ($countryCode && $countryCode !== 'all') {
            $sql .= " AND country_code = ?";
            $params[] = $countryCode;
        }
        
        $stmt = $this->remoteDb->prepare($sql);
        $stmt->execute($params);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Récupère les KPIs 3G depuis la base distante
     * 
     * @param string $countryCode Code pays
     * @param string $date Date au format YYYY-MM-DD
     * @return array
     */
    public function getRemote3GKpis(?string $countryCode = null, ?string $date = null): array
    {
        $date = $date ?: date('Y-m-d');
        
        $sql = "SELECT site_id, rrc_cs_sr, rab_cs_sr, rrc_ps_sr, cssr_cs_sr, cssr_ps_sr,
                       cs_drop_rate, ps_drop_rate, soft_ho_rate,
                       ul_throughput, dl_throughput, code_congestion,
                       power_congestion, ul_ce_congestion, dl_ce_congestion, kpi_date
                FROM ran_3g_kpis 
                WHERE kpi_date = ?";
        
        $params = [$date];
        
        if ($countryCode && $countryCode !== 'all') {
            $sql .= " AND country_code = ?";
            $params[] = $countryCode;
        }
        
        $stmt = $this->remoteDb->prepare($sql);
        $stmt->execute($params);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Récupère les KPIs 4G depuis la base distante
     * 
     * @param string $countryCode Code pays
     * @param string $date Date au format YYYY-MM-DD
     * @return array
     */
    public function getRemote4GKpis(?string $countryCode = null, ?string $date = null): array
    {
        $date = $date ?: date('Y-m-d');
        
        $sql = "SELECT site_id, lte_s1_sr, lte_rrc_sr, lte_erab_sr, lte_session_sr,
                       lte_erab_drop_rate, lte_csfb_sr, lte_intra_freq_sr,
                       lte_inter_freq_sr, lte_dl_prb_util, lte_ul_throughput,
                       lte_dl_throughput, lte_ul_prb_util, kpi_date
                FROM ran_4g_kpis 
                WHERE kpi_date = ?";
        
        $params = [$date];
        
        if ($countryCode && $countryCode !== 'all') {
            $sql .= " AND country_code = ?";
            $params[] = $countryCode;
        }
        
        $stmt = $this->remoteDb->prepare($sql);
        $stmt->execute($params);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Récupère tous les KPIs RAN (2G/3G/4G) depuis la base distante
     * 
     * @param string $countryCode Code pays
     * @param string $date Date au format YYYY-MM-DD
     * @return array
     */
    public function getAllRemoteRanKpis(?string $countryCode = null, ?string $date = null): array
    {
        $date = $date ?: date('Y-m-d');
        
        $result = [
            '2G' => $this->getRemote2GKpis($countryCode, $date),
            '3G' => $this->getRemote3GKpis($countryCode, $date),
            '4G' => $this->getRemote4GKpis($countryCode, $date),
            'date' => $date,
            'country' => $countryCode ?: 'all'
        ];
        
        return $result;
    }
    
    /**
     * Récupère les KPIs par vendor (Huawei/Ericsson)
     * 
     * @param string $vendor Vendor (Huawei, Ericsson)
     * @param string $technology Technologie (2G, 3G, 4G)
     * @param string $date Date
     * @return array
     */
    public function getRemoteKpisByVendor(string $vendor, string $technology, ?string $date = null): array
    {
        $date = $date ?: date('Y-m-d');
        
        switch ($technology) {
            case '2G':
                return $this->getRemote2GKpis(null, $date);
            case '3G':
                return $this->getRemote3GKpis(null, $date);
            case '4G':
                return $this->getRemote4GKpis(null, $date);
            default:
                return [];
        }
    }
    
    // ============================================
    // MÉTHODES D'IMPORT
    // ============================================
    
    /**
     * Importe les KPIs RAN depuis la base distante vers la base locale
     * 
     * @param string $date Date d'import
     * @return array Résultat de l'import
     */
    public function importRanKpis(?string $date = null): array
    {
        $date = $date ?: date('Y-m-d');
        $result = [
            'success' => true,
            'date' => $date,
            'records_imported' => 0,
            'errors' => []
        ];
        
        try {
            // Récupérer les KPIs depuis la base distante
            $remoteKpis = $this->getAllRemoteRanKpis(null, $date);
            
            // Pour chaque technologie, importer les données
            foreach ($remoteKpis as $tech => $kpis) {
                if ($tech === 'date' || $tech === 'country') continue;
                
                foreach ($kpis as $kpi) {
                    try {
                        // Vérifier si le site existe dans la base locale
                        $siteExists = $this->checkSiteExists($kpi['site_id']);
                        
                        if (!$siteExists) {
                            // Créer le site s'il n'existe pas
                            $this->createSiteFromRemote($kpi['site_id'], $tech);
                        }
                        
                        // Insérer ou mettre à jour les KPIs
                        $this->insertRanKpi($kpi, $tech, $date);
                        $result['records_imported']++;
                        
                    } catch (Exception $e) {
                        $result['errors'][] = [
                            'site_id' => $kpi['site_id'],
                            'technology' => $tech,
                            'error' => $e->getMessage()
                        ];
                    }
                }
            }
            
            // Journaliser l'import
            $this->logImport('ran', $result['records_imported'], count($result['errors']));
            
        } catch (Exception $e) {
            $result['success'] = false;
            $result['errors'][] = $e->getMessage();
            $this->logImport('ran', 0, 1, 'failed', $e->getMessage());
        }
        
        return $result;
    }
    
    /**
     * Vérifie si un site existe dans la base locale
     * 
     * @param string $siteId ID du site
     * @return bool
     */
    private function checkSiteExists(string $siteId): bool
    {
        $stmt = $this->localDb->prepare("SELECT COUNT(*) FROM sites WHERE id = ?");
        $stmt->execute([$siteId]);
        return $stmt->fetchColumn() > 0;
    }
    
    /**
     * Crée un site à partir des données distantes
     * 
     * @param string $siteId ID du site
     * @param string $technology Technologie
     */
    private function createSiteFromRemote(string $siteId, string $technology): void
    {
        // Données par défaut pour un site
        $sql = "INSERT INTO sites (id, name, country_code, vendor, technology, domain, status, latitude, longitude)
                VALUES (?, ?, ?, ?, ?, 'RAN', 'active', 0, 0)";
        
        // Déterminer le pays à partir du site ID
        $countryCode = $this->extractCountryFromSiteId($siteId);
        
        $stmt = $this->localDb->prepare($sql);
        $stmt->execute([
            $siteId,
            $siteId,
            $countryCode,
            $this->guessVendor($siteId),
            $technology
        ]);
    }
    
    /**
     * Insère un KPI RAN dans la base locale
     * 
     * @param array $kpi Données du KPI
     * @param string $technology Technologie
     * @param string $date Date
     */
    private function insertRanKpi(array $kpi, string $technology, string $date): void
    {
        // Calcul du KPI global
        $globalKpi = $this->calculateGlobalKpi($kpi, $technology);
        $status = $this->determineStatus($globalKpi);
        
        $sql = "INSERT INTO kpis_ran (site_id, kpi_date, technology, kpi_global, status, imported_at) 
                VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                kpi_global = VALUES(kpi_global),
                status = VALUES(status),
                imported_at = NOW()";
        
        $stmt = $this->localDb->prepare($sql);
        $stmt->execute([$kpi['site_id'], $date, $technology, $globalKpi, $status]);
        
        // Insertion dans l'historique
        $this->insertKpiHistory($kpi, $technology, $date);
    }
    
    /**
     * Insère les KPIs dans l'historique
     */
    private function insertKpiHistory(array $kpi, string $technology, string $date): void
    {
        $kpiFields = $this->getKpiFieldsForTechnology($technology);
        
        foreach ($kpiFields as $fieldName => $displayName) {
            if (isset($kpi[$fieldName])) {
                $sql = "INSERT INTO kpi_daily_history (site_id, kpi_name, kpi_value, recorded_date, technology, domain)
                        VALUES (?, ?, ?, ?, ?, 'RAN')
                        ON DUPLICATE KEY UPDATE
                        kpi_value = VALUES(kpi_value)";
                
                $stmt = $this->localDb->prepare($sql);
                $stmt->execute([$kpi['site_id'], $displayName, $kpi[$fieldName], $date, $technology]);
            }
        }
    }
    
    /**
     * Calcule le KPI global pour un site
     */
    private function calculateGlobalKpi(array $kpi, string $technology): float
    {
        $thresholds = $this->thresholds[$technology] ?? [];
        $sum = 0;
        $count = 0;
        
        foreach ($thresholds as $kpiName => $config) {
            $fieldName = $this->getFieldNameFromKpiName($kpiName);
            if (isset($kpi[$fieldName])) {
                $value = $kpi[$fieldName];
                $target = $config['target'];
                
                // Normaliser selon que plus haut ou plus bas est mieux
                if ($config['higher_is_better']) {
                    $score = ($value / $target) * 100;
                } else {
                    $score = ($target / max($value, 0.01)) * 100;
                }
                
                $sum += min(100, $score);
                $count++;
            }
        }
        
        return $count > 0 ? round($sum / $count, 2) : 0;
    }
    
    /**
     * Détermine le statut à partir du KPI global
     */
    private function determineStatus(float $kpiGlobal): string
    {
        if ($kpiGlobal >= KPI_THRESHOLD_GOOD) return 'good';
        if ($kpiGlobal >= KPI_THRESHOLD_WARNING) return 'warning';
        return 'critical';
    }
    
    /**
     * Journalise l'import
     */
    private function logImport(string $type, int $imported, int $failed, string $status = 'success', ?string $error = null): void
    {
        $sql = "INSERT INTO import_logs (import_type, records_imported, records_failed, status, error_message, started_at, completed_at)
                VALUES (?, ?, ?, ?, ?, NOW(), NOW())";
        
        $stmt = $this->localDb->prepare($sql);
        $stmt->execute([$type, $imported, $failed, $status, $error]);
    }
    
    /**
     * Extrait le pays à partir de l'ID du site
     */
    private function extractCountryFromSiteId(string $siteId): string
    {
        // Logique basée sur le préfixe du site ID
        if (strpos($siteId, 'ET') !== false || strpos($siteId, 'CORE-CI') !== false) return 'CI';
        if (strpos($siteId, 'ZINDER') !== false || strpos($siteId, 'CORE-NE') !== false) return 'NE';
        if (strpos($siteId, 'CEB') !== false || strpos($siteId, 'CORE-BJ') !== false) return 'BJ';
        if (strpos($siteId, 'GBAMAKOPE') !== false || strpos($siteId, 'CORE-TG') !== false) return 'TG';
        if (strpos($siteId, 'BG') !== false || strpos($siteId, 'CORE-CF') !== false) return 'CF';
        
        return 'CI'; // Par défaut
    }
    
    /**
     * Devine le vendor à partir de l'ID du site
     */
    private function guessVendor(string $siteId): string
    {
        // Logique basée sur le pattern
        if (preg_match('/(HUAWEI|HW)/i', $siteId)) return 'Huawei';
        if (preg_match('/(ERICSSON|ERI)/i', $siteId)) return 'Ericsson';
        
        return 'Huawei'; // Par défaut
    }
    
    /**
     * Retourne les champs KPI pour une technologie donnée
     */
    private function getKpiFieldsForTechnology(string $technology): array
    {
        $fields = [
            '2G' => [
                'tch_availability' => 'TCH Availability',
                'cssr' => 'CSSR',
                'sdcch_cong' => 'SDCCH Congestion',
                'sdcch_drop' => 'SDCCH Drop',
                'tch_drop_rate' => 'TCH Drop Rate',
                'tch_cong_rate' => 'TCH Congestion',
                'handover_sr' => 'Handover SR'
            ],
            '3G' => [
                'rrc_cs_sr' => 'RRC CS SR',
                'rab_cs_sr' => 'RAB CS SR',
                'rrc_ps_sr' => 'RRC PS SR',
                'cssr_cs_sr' => 'CSSR CS SR',
                'cssr_ps_sr' => 'CSSR PS SR',
                'cs_drop_rate' => 'CS Drop Rate',
                'ps_drop_rate' => 'PS Drop Rate',
                'soft_ho_rate' => 'Soft HO Rate',
                'ul_throughput' => 'UL Throughput',
                'dl_throughput' => 'DL Throughput'
            ],
            '4G' => [
                'lte_s1_sr' => 'LTE S1 SR',
                'lte_rrc_sr' => 'LTE RRC SR',
                'lte_erab_sr' => 'LTE ERAB SR',
                'lte_session_sr' => 'LTE Session SR',
                'lte_erab_drop_rate' => 'LTE ERAB Drop',
                'lte_csfb_sr' => 'LTE CSFB SR',
                'lte_intra_freq_sr' => 'LTE Intra Freq SR',
                'lte_inter_freq_sr' => 'LTE Inter Freq SR'
            ]
        ];
        
        return $fields[$technology] ?? [];
    }
    
    /**
     * Convertit un nom de KPI en nom de champ
     */
    private function getFieldNameFromKpiName(string $kpiName): string
    {
        $map = [
            'RNA' => 'rna',
            'TCH_Availability' => 'tch_availability',
            'CSSR' => 'cssr',
            'SDCCH_Cong' => 'sdcch_cong',
            'SDCCH_Drop' => 'sdcch_drop',
            'TCH_Drop_Rate' => 'tch_drop_rate',
            'TCH_Cong_Rate' => 'tch_cong_rate',
            'Handover_SR' => 'handover_sr',
            'RRC_CS_SR' => 'rrc_cs_sr',
            'RAB_CS_SR' => 'rab_cs_sr',
            'RRC_PS_SR' => 'rrc_ps_sr',
            'CSSR_CS_SR' => 'cssr_cs_sr',
            'CSSR_PS_SR' => 'cssr_ps_sr',
            'CS_Drop_Rate' => 'cs_drop_rate',
            'PS_Drop_Rate' => 'ps_drop_rate',
            'Soft_HO_Rate' => 'soft_ho_rate',
            'UL_Throughput' => 'ul_throughput',
            'DL_Throughput' => 'dl_throughput',
            'LTE_S1_SR' => 'lte_s1_sr',
            'LTE_RRC_SR' => 'lte_rrc_sr',
            'LTE_ERAB_SR' => 'lte_erab_sr',
            'LTE_Session_SR' => 'lte_session_sr',
            'LTE_ERAB_Drop' => 'lte_erab_drop_rate',
            'LTE_CSFB_SR' => 'lte_csfb_sr',
            'LTE_Intra_Freq_SR' => 'lte_intra_freq_sr',
            'LTE_Inter_Freq_SR' => 'lte_inter_freq_sr'
        ];
        
        return $map[$kpiName] ?? strtolower($kpiName);
    }
}