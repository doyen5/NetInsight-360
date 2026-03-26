<?php
/**
 * Import des KPIs avec mapping des IDs
 */
/**
 * Modifications:
 * - Ajout d'une tentative d'enrichissement automatique depuis la base distante
 *   (détection d'une table contenant `latitude` et `longitude`).
 * - Les coordonnées distantes sont injectées dans le cache `$coordinates`
 *   afin que la logique de mapping les utilise en priorité (sans CSV).
 */

require_once __DIR__ . '/../config/database.php';

$csvFile = __DIR__ . '/../data/sites_coordinates.csv';

if (!file_exists($csvFile)) {
    die("[ERREUR] Fichier CSV non trouvé: $csvFile\n");
}

echo "========================================\n";
echo "IMPORT AVEC MAPPING DES SITES\n";
echo "========================================\n\n";

$pdo = Database::getLocalConnection();
$remoteDb = Database::getRemoteConnection();

// 1. Charger les coordonnées depuis le CSV
$coordinates = [];

$handle = fopen($csvFile, 'r');
$header = fgetcsv($handle);
$header = array_map('trim', $header);

$idxId = array_search('id', $header);
$idxName = array_search('name', $header);
$idxLat = array_search('latitude', $header);
$idxLng = array_search('longitude', $header);
$idxCountry = array_search('country_code', $header);
$idxVendor = array_search('vendor', $header);
$idxTech = array_search('technology', $header);
$idxRegion = array_search('region', $header);

$processed = [];

while (($row = fgetcsv($handle)) !== false) {
    $row = array_map('trim', $row);
    $siteId = $row[$idxId] ?? '';
    
    if (empty($siteId) || in_array($siteId, $processed)) continue;
    $processed[] = $siteId;
    
    $coordinates[$siteId] = [
        'id' => $siteId,
        'name' => $row[$idxName] ?? $siteId,
        'latitude' => floatval(str_replace(',', '.', $row[$idxLat] ?? 0)),
        'longitude' => floatval(str_replace(',', '.', $row[$idxLng] ?? 0)),
        'country_code' => $row[$idxCountry] ?? 'CI',
        'vendor' => $row[$idxVendor] ?? 'Huawei',
        'technology' => $row[$idxTech] ?? '4G',
        'region' => $row[$idxRegion] ?? null
    ];
}
fclose($handle);

echo "[OK] Chargé " . count($coordinates) . " sites depuis CSV\n\n";

// 2. Récupérer les IDs réels depuis la base distante
echo "--- RÉCUPÉRATION DES IDs DISTANTS ---\n";

$remoteIds = [];

// 2G
$sql = "SELECT DISTINCT prismis.give_site_id(CELL_NAME) AS site_id 
        FROM network_2g_main_kpis_hourly 
        WHERE DATE_ID = CURDATE() 
        LIMIT 500";
$stmt = $remoteDb->query($sql);
$ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
foreach ($ids as $id) {
    if (!empty($id)) $remoteIds[$id] = true;
}
echo "   2G: " . count($ids) . " IDs\n";

// 3G
$sql = "SELECT DISTINCT prismis.give_site_id(NE) AS site_id 
        FROM network_3g_main_kpis_hourly 
        WHERE DATE = CURDATE() 
        LIMIT 500";
$stmt = $remoteDb->query($sql);
$ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
foreach ($ids as $id) {
    if (!empty($id)) $remoteIds[$id] = true;
}
echo "   3G: " . count($ids) . " IDs\n";

// 4G
$tables = ['lte_network_main_kpis_hourly', 'network_4g_main_kpis_hourly'];
foreach ($tables as $table) {
    try {
        $sql = "SELECT DISTINCT prismis.give_site_id(NE) AS site_id FROM $table WHERE date = CURDATE() LIMIT 500";
        $stmt = $remoteDb->query($sql);
        $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
        foreach ($ids as $id) {
            if (!empty($id)) $remoteIds[$id] = true;
        }
        echo "   4G ($table): " . count($ids) . " IDs\n";
        break;
    } catch (Exception $e) {}
}

$remoteIds = array_keys($remoteIds);
echo "\nTotal IDs distants uniques: " . count($remoteIds) . "\n\n";

// ------------------------------------------------------------------
// Tentative d'enrichissement automatique depuis la base distante
// Si la base distante contient une table d'inventaire/site avec des colonnes
// `latitude` et `longitude`, on récupère ces coordonnées et on insère
// directement dans le cache $coordinates pour que la logique suivante
// utilise ces valeurs sans passer par le CSV.
// Ceci permet d'éviter la dépendance au fichier CSV si la source distante
// dispose déjà des coordonnées.
// ------------------------------------------------------------------
try {
    $candStmt = $remoteDb->prepare("SELECT TABLE_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('latitude','longitude') GROUP BY TABLE_NAME HAVING COUNT(DISTINCT COLUMN_NAME) = 2 LIMIT 1");
    $candStmt->execute();
    $remoteTable = $candStmt->fetchColumn();
    if ($remoteTable) {
        echo "[INFO] Table distante candidate pour coordonnées détectée: {$remoteTable}\n";

        // Trouver une colonne ID candidate dans la table distante
        $colsStmt = $remoteDb->prepare("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?");
        $colsStmt->execute([$remoteTable]);
        $cols = $colsStmt->fetchAll(PDO::FETCH_COLUMN);

        $idCandidates = ['remote_id','id','site','site_id','ne','name'];
        $idCol = null;
        foreach ($idCandidates as $c) {
            if (in_array($c, $cols, true)) { $idCol = $c; break; }
        }

        if ($idCol) {
            echo "[INFO] Colonne distante utilisée comme identifiant: {$idCol}\n";
            // Récupérer les coordonnées pour les remoteIds (par lots)
            $chunks = array_chunk($remoteIds, 200);
            $found = 0;
            foreach ($chunks as $chunk) {
                $placeholders = implode(',', array_fill(0, count($chunk), '?'));
                $sql = "SELECT {$idCol} AS remote_id, latitude, longitude, ";
                // choisir un nom possible pour label
                if (in_array('site_name', $cols, true)) {
                    $sql .= "site_name";
                } elseif (in_array('name', $cols, true)) {
                    $sql .= "name";
                } else {
                    $sql .= "'' AS site_name";
                }
                $sql .= " FROM {$remoteTable} WHERE {$idCol} IN ({$placeholders})";

                $stmt = $remoteDb->prepare($sql);
                $stmt->execute($chunk);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as $r) {
                    $rid = (string)($r['remote_id'] ?? '');
                    if ($rid === '') continue;
                    $lat = isset($r['latitude']) ? floatval($r['latitude']) : 0.0;
                    $lng = isset($r['longitude']) ? floatval($r['longitude']) : 0.0;
                    $label = $r['site_name'] ?? $rid;
                    if ($lat != 0.0 || $lng != 0.0) {
                        $coordinates[$rid] = [
                            'id' => $rid,
                            'name' => $label,
                            'latitude' => $lat,
                            'longitude' => $lng,
                            'country_code' => 'CI',
                            'vendor' => 'Huawei',
                            'technology' => '4G',
                            'region' => null
                        ];
                        $found++;
                    }
                }
            }
            echo "[INFO] Enrichi cache coords depuis distant: {$found} entrées ajoutées\n\n";
        } else {
            echo "[WARN] Aucune colonne identifiante trouvée dans la table distante {$remoteTable}\n\n";
        }
    } else {
        echo "[INFO] Aucune table distante avec latitude/longitude détectée.\n\n";
    }
} catch (Throwable $e) {
    echo "[WARN] Échec détection source distante: " . $e->getMessage() . "\n\n";
}

// 3. Créer une table de correspondance
echo "--- CRÉATION DE LA TABLE DE CORRESPONDANCE ---\n";

$pdo->exec("DROP TABLE IF EXISTS site_mapping");
$pdo->exec("
    CREATE TABLE IF NOT EXISTS site_mapping (
        remote_id VARCHAR(50) PRIMARY KEY,
        local_id VARCHAR(50),
        site_name VARCHAR(255),
        latitude DECIMAL(10,6),
        longitude DECIMAL(10,6),
        country_code VARCHAR(2),
        vendor VARCHAR(50),
        technology VARCHAR(10),
        region VARCHAR(255)
    )
");

// 4. Associer les IDs (par défaut, on garde l'ID distant)
$mapped = 0;
foreach ($remoteIds as $remoteId) {
    // Chercher si on a des coordonnées pour cet ID
    $coords = null;
    
    // Chercher par ID exact
    if (isset($coordinates[$remoteId])) {
        $coords = $coordinates[$remoteId];
    } else {
        // Chercher par nom approximatif (si le nom contient une partie de l'ID)
        foreach ($coordinates as $csvId => $csvData) {
            if (strpos($remoteId, $csvId) !== false || strpos($csvId, $remoteId) !== false) {
                $coords = $csvData;
                break;
            }
        }
    }
    
    if ($coords) {
        $mapped++;
        $sql = "INSERT INTO site_mapping (remote_id, local_id, site_name, latitude, longitude, country_code, vendor, technology, region)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $remoteId,
            $coords['id'],
            $coords['name'],
            $coords['latitude'],
            $coords['longitude'],
            $coords['country_code'],
            $coords['vendor'],
            $coords['technology'],
            $coords['region']
        ]);
    } else {
        // Pas de correspondance, utiliser l'ID distant
        $sql = "INSERT INTO site_mapping (remote_id, local_id, site_name, latitude, longitude, country_code, vendor, technology)
                VALUES (?, ?, ?, 0, 0, 'CI', 'Huawei', '4G')";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$remoteId, $remoteId, $remoteId]);
    }
}

echo "   Sites avec correspondance: $mapped\n";
echo "   Sites sans correspondance: " . (count($remoteIds) - $mapped) . "\n\n";

// 5. Mettre à jour la table sites avec les coordonnées
echo "--- MISE À JOUR DE LA TABLE SITES ---\n";

$sql = "SELECT remote_id, local_id, site_name, latitude, longitude, country_code, vendor, technology, region FROM site_mapping WHERE latitude != 0";
$stmt = $pdo->query($sql);
$sitesToUpdate = $stmt->fetchAll();

$updated = 0;
$inserted = 0;

foreach ($sitesToUpdate as $site) {
    $check = $pdo->prepare("SELECT COUNT(*) FROM sites WHERE id = ?");
    $check->execute([$site['remote_id']]);
    
    if ($check->fetchColumn() > 0) {
        $update = $pdo->prepare("UPDATE sites SET 
            name = ?, latitude = ?, longitude = ?, 
            country_code = ?, vendor = ?, technology = ?, 
            region = ?, updated_at = NOW()
            WHERE id = ?");
        $update->execute([
            $site['site_name'], $site['latitude'], $site['longitude'],
            $site['country_code'], $site['vendor'], $site['technology'],
            $site['region'], $site['remote_id']
        ]);
        $updated++;
    } else {
        $insert = $pdo->prepare("INSERT INTO sites 
            (id, name, latitude, longitude, country_code, vendor, technology, domain, status, region, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'RAN', 'active', ?, NOW())");
        $insert->execute([
            $site['remote_id'], $site['site_name'], $site['latitude'], $site['longitude'],
            $site['country_code'], $site['vendor'], $site['technology'], $site['region']
        ]);
        $inserted++;
    }
}

echo "   Sites mis à jour: $updated\n";
echo "   Nouveaux sites insérés: $inserted\n";
echo "   Sites sans coordonnées: " . (count($remoteIds) - count($sitesToUpdate)) . "\n\n";

// 6. Afficher quelques résultats
echo "--- EXEMPLES DE SITES AVEC COORDONNÉES ---\n";
$stmt = $pdo->query("SELECT id, name, latitude, longitude, vendor FROM sites WHERE latitude != 0 LIMIT 10");
$samples = $stmt->fetchAll();

foreach ($samples as $sample) {
    echo "   {$sample['id']}: ({$sample['latitude']}, {$sample['longitude']}) - {$sample['name']}\n";
}

echo "\n========================================\n";
echo "IMPORT TERMINÉ\n";
echo "========================================\n";