<?php
/**
 * Helper functions for import scripts
 * Utilise la table `sites` locale pour enrichir les données
 */

/**
 * Enrichit les données brutes avec les informations de la table `sites`
 * 
 * @param array $rows Données brutes issues de la base distante
 * @param PDO $pdo Connexion locale
 * @return array Données enrichies
 */
function enrichirAvecSitesLocaux(array $rows, PDO $pdo): array
{
    if (empty($rows)) {
        return $rows;
    }
    
    // Récupérer tous les sites uniques présents dans les données
    $sitesUniques = array_unique(array_column($rows, 'site'));
    $placeholders = implode(',', array_fill(0, count($sitesUniques), '?'));
    
    // Requête avec jointure sur la table countries
    $sql = "SELECT s.id, s.name, s.latitude, s.longitude, 
                   s.vendor, s.technology, s.localite, s.region,
                   s.zone_loc, s.zone_operationnelle, s.status,
                   c.country_name, c.map_latitude, c.map_longitude, c.map_zoom
            FROM sites s
            LEFT JOIN countries c ON s.country_code = c.country_code
            WHERE s.id IN ($placeholders)";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($sitesUniques);
    $sitesInfo = [];
    
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $sitesInfo[$row['id']] = $row;
    }
    
    // Enrichir chaque ligne
    foreach ($rows as &$row) {
        $siteId = $row['site'];
        if (isset($sitesInfo[$siteId])) {
            $info = $sitesInfo[$siteId];
            $row['nom_site'] = $info['name'] ?? $row['site'];
            $row['localite'] = $info['localite'] ?? null;
            $row['region'] = $info['region'] ?? null;
            $row['zone_loc'] = $info['zone_loc'] ?? null;
            $row['zone_operationnelle'] = $info['zone_operationnelle'] ?? null;
            $row['longitude'] = $info['longitude'] ?? null;
            $row['latitude'] = $info['latitude'] ?? null;
            $row['vendor'] = $info['vendor'] ?? $row['vendor'] ?? null;
            $row['country_name'] = $info['country_name'] ?? null;
        } else {
            // Site non référencé - l'ajouter automatiquement
            $row['nom_site'] = $row['site'];
            $row['localite'] = null;
            $row['region'] = null;
            $row['zone_loc'] = null;
            $row['zone_operationnelle'] = null;
            $row['longitude'] = null;
            $row['latitude'] = null;
            
            // Ajouter le site manquant à la table sites
            addMissingSite($pdo, $siteId, $row['country_code'], $row['vendor'] ?? null);
        }
    }
    
    return $rows;
}

/**
 * Ajoute un site manquant dans la table sites
 */
function addMissingSite(PDO $pdo, string $siteId, string $countryCode, ?string $vendor = null): void
{
    // Déterminer la technologie approximative (basée sur l'ID)
    $technology = guessTechnologyFromSiteId($siteId);
    $domain = ($technology === 'CORE') ? 'CORE' : 'RAN';
    
    $sql = "INSERT INTO sites (id, name, country_code, vendor, technology, domain, status)
            VALUES (:id, :name, :country_code, :vendor, :technology, :domain, 'active')
            ON DUPLICATE KEY UPDATE
            updated_at = NOW()";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':id' => $siteId,
        ':name' => $siteId,
        ':country_code' => $countryCode,
        ':vendor' => $vendor,
        ':technology' => $technology,
        ':domain' => $domain
    ]);
    
    error_log("[INFO] Nouveau site ajouté: $siteId", 3, __DIR__ . '/../logs/missing_sites.log');
}

/**
 * Devine la technologie à partir de l'ID du site
 */
function guessTechnologyFromSiteId(string $siteId): string
{
    if (strpos($siteId, 'CORE') !== false) return 'CORE';
    if (preg_match('/[2G]/', $siteId)) return '2G';
    if (preg_match('/[3G]/', $siteId)) return '3G';
    return '4G'; // Par défaut
}