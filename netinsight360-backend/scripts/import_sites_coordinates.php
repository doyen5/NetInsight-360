<?php
/**
 * NetInsight 360 - Import des coordonnées des sites depuis un fichier CSV
 * Version corrigée - Gère les espaces dans l'en-tête
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

// Chemin corrigé
$csvFilePath = __DIR__ . '/../data/sites_coordinates.csv';

require_once __DIR__ . '/../config/database.php';

echo "\n========================================\n";
echo "IMPORT DES COORDONNÉES DES SITES\n";
echo "========================================\n\n";

try {
    $pdo = Database::getLocalConnection();
    echo "[OK] Connexion établie\n\n";
} catch (Exception $e) {
    die("[ERREUR] Connexion impossible: " . $e->getMessage() . "\n");
}

// Vérifier si le fichier existe
if (!file_exists($csvFilePath)) {
    echo "[ERREUR] Fichier CSV non trouvé à: " . $csvFilePath . "\n";
    exit(1);
}

echo "[OK] Fichier trouvé: " . $csvFilePath . "\n\n";

// Lire le fichier avec gestion des espaces
$handle = fopen($csvFilePath, 'r');
if (!$handle) {
    die("[ERREUR] Impossible d'ouvrir le fichier\n");
}

// Lire l'en-tête en nettoyant les espaces
$rawHeader = fgetcsv($handle, 0, ',', '"', '\\');
$header = [];
foreach ($rawHeader as $col) {
    $cleanCol = trim($col);
    if (!empty($cleanCol)) {
        $header[] = $cleanCol;
    }
}

echo "[INFO] En-tête nettoyé: " . implode(', ', $header) . "\n\n";

// Fonction pour trouver une colonne (insensible à la casse)
function findColumn($header, $search) {
    foreach ($header as $index => $col) {
        if (strtolower(trim($col)) === strtolower($search)) {
            return $index;
        }
    }
    return false;
}

// Trouver les indices des colonnes
$idxSiteId = findColumn($header, 'site_id');
$idxSiteName = findColumn($header, 'site_name');
$idxLatitude = findColumn($header, 'latitude');
$idxLongitude = findColumn($header, 'longitude');
$idxCountry = findColumn($header, 'country_code');
$idxVendor = findColumn($header, 'vendor');
$idxTechnology = findColumn($header, 'technology');
$idxRegion = findColumn($header, 'region');

echo "Colonnes détectées:\n";
echo "   site_id: " . ($idxSiteId !== false ? "colonne " . ($idxSiteId+1) : "NON TROUVÉ") . "\n";
echo "   latitude: " . ($idxLatitude !== false ? "colonne " . ($idxLatitude+1) : "NON TROUVÉ") . "\n";
echo "   longitude: " . ($idxLongitude !== false ? "colonne " . ($idxLongitude+1) : "NON TROUVÉ") . "\n";
echo "   vendor: " . ($idxVendor !== false ? "colonne " . ($idxVendor+1) : "NON TROUVÉ") . "\n";
echo "   technology: " . ($idxTechnology !== false ? "colonne " . ($idxTechnology+1) : "NON TROUVÉ") . "\n\n";

if ($idxSiteId === false || $idxLatitude === false || $idxLongitude === false) {
    echo "[ERREUR] Colonnes obligatoires manquantes.\n";
    echo "Vérifiez que votre fichier CSV contient ces colonnes: site_id, latitude, longitude\n";
    fclose($handle);
    exit(1);
}

$stats = ['updated' => 0, 'inserted' => 0, 'failed' => 0];
$lineNumber = 1;

echo "--- TRAITEMENT DES LIGNES ---\n";

while (($row = fgetcsv($handle, 0, ',', '"', '\\')) !== false) {
    $lineNumber++;
    
    // Nettoyer chaque champ
    $row = array_map('trim', $row);
    
    $siteId = $row[$idxSiteId] ?? '';
    $latitude = $row[$idxLatitude] ?? '';
    $longitude = $row[$idxLongitude] ?? '';
    
    if (empty($siteId)) {
        $stats['failed']++;
        echo "   Ligne $lineNumber: ignorée (site_id vide)\n";
        continue;
    }
    
    if (empty($latitude) || empty($longitude)) {
        $stats['failed']++;
        echo "   Ligne $lineNumber: $siteId - coordonnées manquantes\n";
        continue;
    }
    
    // Convertir les coordonnées en nombres valides
    $latitude = floatval(str_replace(',', '.', $latitude));
    $longitude = floatval(str_replace(',', '.', $longitude));
    
    // Vérifier si les coordonnées sont valides
    if ($latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
        $stats['failed']++;
        echo "   Ligne $lineNumber: $siteId - coordonnées invalides ($latitude, $longitude)\n";
        continue;
    }
    
    // Vérifier si le site existe
    $check = $pdo->prepare("SELECT COUNT(*) FROM sites WHERE id = ?");
    $check->execute([$siteId]);
    $exists = $check->fetchColumn() > 0;
    
    $siteName = ($idxSiteName !== false && isset($row[$idxSiteName]) && !empty($row[$idxSiteName])) 
                ? $row[$idxSiteName] 
                : $siteId;
    
    $countryCode = ($idxCountry !== false && isset($row[$idxCountry]) && !empty($row[$idxCountry])) 
                   ? $row[$idxCountry] 
                   : 'CI';
    
    $vendor = ($idxVendor !== false && isset($row[$idxVendor]) && !empty($row[$idxVendor])) 
              ? $row[$idxVendor] 
              : 'Huawei';
    
    $technology = ($idxTechnology !== false && isset($row[$idxTechnology]) && !empty($row[$idxTechnology])) 
                  ? $row[$idxTechnology] 
                  : '4G';
    
    $region = ($idxRegion !== false && isset($row[$idxRegion]) && !empty($row[$idxRegion])) 
              ? $row[$idxRegion] 
              : null;
    
    if ($exists) {
        $sql = "UPDATE sites SET name = ?, latitude = ?, longitude = ?, country_code = ?, vendor = ?, technology = ?, region = ? WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute([$siteName, $latitude, $longitude, $countryCode, $vendor, $technology, $region, $siteId]);
        
        if ($result) {
            $stats['updated']++;
            echo "   [MÀJ] $siteId → ($latitude, $longitude)\n";
        } else {
            $stats['failed']++;
            echo "   [ERREUR] $siteId - mise à jour échouée\n";
        }
    } else {
        $sql = "INSERT INTO sites (id, name, latitude, longitude, country_code, vendor, technology, domain, status, region) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 'RAN', 'active', ?)";
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute([$siteId, $siteName, $latitude, $longitude, $countryCode, $vendor, $technology, $region]);
        
        if ($result) {
            $stats['inserted']++;
            echo "   [NOUVEAU] $siteId → ($latitude, $longitude)\n";
        } else {
            $stats['failed']++;
            echo "   [ERREUR] $siteId - insertion échouée\n";
        }
    }
}

fclose($handle);

echo "\n========================================\n";
echo "RÉSULTAT\n";
echo "========================================\n";
echo "Sites mis à jour: " . $stats['updated'] . "\n";
echo "Sites insérés: " . $stats['inserted'] . "\n";
echo "Échecs: " . $stats['failed'] . "\n";
echo "========================================\n";