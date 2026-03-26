<?php
/**
 * Script de vérification des sites importés
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: text/html; charset=utf-8');

echo "<!DOCTYPE html>
<html>
<head>
    <title>Vérification des sites - NetInsight 360</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        h1 { color: #00a3c4; }
        table { border-collapse: collapse; width: 100%; background: white; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #00a3c4; color: white; }
        tr:nth-child(even) { background: #f9f9f9; }
        .good { color: green; font-weight: bold; }
        .warning { color: orange; }
        .bad { color: red; }
    </style>
</head>
<body>
";

try {
    $pdo = Database::getLocalConnection();
    echo "<h1>🗺️ NetInsight 360 - Vérification des sites</h1>\n";
    
    // Statistiques
    $total = $pdo->query("SELECT COUNT(*) FROM sites")->fetchColumn();
    $withCoords = $pdo->query("SELECT COUNT(*) FROM sites WHERE latitude != 0 AND longitude != 0")->fetchColumn();
    $withoutCoords = $total - $withCoords;
    
    echo "<h2>📊 Statistiques</h2>\n";
    echo "<ul>\n";
    echo "   <li><strong>Total des sites:</strong> $total</li>\n";
    echo "   <li><strong>Sites avec coordonnées:</strong> <span class='good'>$withCoords</span></li>\n";
    echo "   <li><strong>Sites sans coordonnées:</strong> <span class='bad'>$withoutCoords</span></li>\n";
    echo "</ul>\n";
    
    // Liste des sites avec coordonnées
    echo "<h2>📍 Sites avec coordonnées GPS</h2>\n";
    $stmt = $pdo->query("
        SELECT id, name, latitude, longitude, vendor, technology, country_code 
        FROM sites 
        WHERE latitude != 0 AND longitude != 0 
        ORDER BY country_code, name
        LIMIT 50
    ");
    
    if ($stmt->rowCount() > 0) {
        echo "<table>\n";
        echo "<tr><th>ID</th><th>Nom</th><th>Latitude</th><th>Longitude</th><th>Vendor</th><th>Techno</th><th>Pays</th></tr>\n";
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo "<tr>";
            echo "<td>" . htmlspecialchars($row['id']) . "</td>";
            echo "<td>" . htmlspecialchars($row['name']) . "</td>";
            echo "<td class='good'>" . $row['latitude'] . "</td>";
            echo "<td class='good'>" . $row['longitude'] . "</td>";
            echo "<td>" . htmlspecialchars($row['vendor']) . "</td>";
            echo "<td>" . htmlspecialchars($row['technology']) . "</td>";
            echo "<td>" . htmlspecialchars($row['country_code']) . "</td>";
            echo "</tr>\n";
        }
        echo "</table>\n";
    } else {
        echo "<p class='bad'>Aucun site avec coordonnées trouvé !</p>\n";
    }
    
    // Liste des sites sans coordonnées
    echo "<h2>⚠️ Sites sans coordonnées (à compléter)</h2>\n";
    $stmt = $pdo->query("
        SELECT id, name, vendor, technology, country_code 
        FROM sites 
        WHERE latitude = 0 OR latitude IS NULL 
        ORDER BY country_code, name
        LIMIT 50
    ");
    
    if ($stmt->rowCount() > 0) {
        echo "<table>\n";
        echo "<tr><th>ID</th><th>Nom</th><th>Vendor</th><th>Techno</th><th>Pays</th></tr>\n";
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo "<tr>";
            echo "<td>" . htmlspecialchars($row['id']) . "</td>";
            echo "<td>" . htmlspecialchars($row['name']) . "</td>";
            echo "<td>" . htmlspecialchars($row['vendor']) . "</td>";
            echo "<td>" . htmlspecialchars($row['technology']) . "</td>";
            echo "<td>" . htmlspecialchars($row['country_code']) . "</td>";
            echo "</tr>\n";
        }
        echo "</table>\n";
    } else {
        echo "<p class='good'>Tous les sites ont des coordonnées !</p>\n";
    }
    
    // Liens utiles
    echo "<h2>🔗 Liens utiles</h2>\n";
    echo "<ul>\n";
    echo "   <li><a href='http://localhost:8080/NetInsight%20360/netinsight360-frontend/map-view.php' target='_blank'>🗺️ Voir la carte</a></li>\n";
    echo "   <li><a href='http://localhost:8080/phpmyadmin' target='_blank'>📊 phpMyAdmin</a></li>\n";
    echo "</ul>\n";
    
} catch (Exception $e) {
    echo "<p class='bad'>Erreur: " . $e->getMessage() . "</p>\n";
}

echo "</body></html>\n";
/**
 * Script de vérification des sites importés
 */

require_once __DIR__ . '/../config/database.php';

header('Content-Type: text/html; charset=utf-8');

echo "<!DOCTYPE html>
<html>
<head>
    <title>Vérification des sites - NetInsight 360</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        h1 { color: #00a3c4; }
        table { border-collapse: collapse; width: 100%; background: white; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #00a3c4; color: white; }
        tr:nth-child(even) { background: #f9f9f9; }
        .good { color: green; font-weight: bold; }
        .warning { color: orange; }
        .bad { color: red; }
    </style>
</head>
<body>
";

try {
    $pdo = Database::getLocalConnection();
    echo "<h1>🗺️ NetInsight 360 - Vérification des sites</h1>\n";
    
    // Statistiques
    $total = $pdo->query("SELECT COUNT(*) FROM sites")->fetchColumn();
    $withCoords = $pdo->query("SELECT COUNT(*) FROM sites WHERE latitude != 0 AND longitude != 0")->fetchColumn();
    $withoutCoords = $total - $withCoords;
    
    echo "<h2>📊 Statistiques</h2>\n";
    echo "<ul>\n";
    echo "   <li><strong>Total des sites:</strong> $total</li>\n";
    echo "   <li><strong>Sites avec coordonnées:</strong> <span class='good'>$withCoords</span></li>\n";
    echo "   <li><strong>Sites sans coordonnées:</strong> <span class='bad'>$withoutCoords</span></li>\n";
    echo "</ul>\n";
    
    // Liste des sites avec coordonnées
    echo "<h2>📍 Sites avec coordonnées GPS</h2>\n";
    $stmt = $pdo->query("
        SELECT id, name, latitude, longitude, vendor, technology, country_code 
        FROM sites 
        WHERE latitude != 0 AND longitude != 0 
        ORDER BY country_code, name
        LIMIT 50
    ");
    
    if ($stmt->rowCount() > 0) {
        echo "<table>\n";
        echo "<tr><th>ID</th><th>Nom</th><th>Latitude</th><th>Longitude</th><th>Vendor</th><th>Techno</th><th>Pays</th></tr>\n";
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo "<tr>";
            echo "<td>" . htmlspecialchars($row['id']) . "</td>";
            echo "<td>" . htmlspecialchars($row['name']) . "</td>";
            echo "<td class='good'>" . $row['latitude'] . "</td>";
            echo "<td class='good'>" . $row['longitude'] . "</td>";
            echo "<td>" . htmlspecialchars($row['vendor']) . "</td>";
            echo "<td>" . htmlspecialchars($row['technology']) . "</td>";
            echo "<td>" . htmlspecialchars($row['country_code']) . "</td>";
            echo "</tr>\n";
        }
        echo "</table>\n";
    } else {
        echo "<p class='bad'>Aucun site avec coordonnées trouvé !</p>\n";
    }
    
    // Liste des sites sans coordonnées
    echo "<h2>⚠️ Sites sans coordonnées (à compléter)</h2>\n";
    $stmt = $pdo->query("
        SELECT id, name, vendor, technology, country_code 
        FROM sites 
        WHERE latitude = 0 OR latitude IS NULL 
        ORDER BY country_code, name
        LIMIT 50
    ");
    
    if ($stmt->rowCount() > 0) {
        echo "<table>\n";
        echo "<tr><th>ID</th><th>Nom</th><th>Vendor</th><th>Techno</th><th>Pays</th></tr>\n";
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo "<tr>";
            echo "<td>" . htmlspecialchars($row['id']) . "</td>";
            echo "<td>" . htmlspecialchars($row['name']) . "</td>";
            echo "<td>" . htmlspecialchars($row['vendor']) . "</td>";
            echo "<td>" . htmlspecialchars($row['technology']) . "</td>";
            echo "<td>" . htmlspecialchars($row['country_code']) . "</td>";
            echo "</tr>\n";
        }
        echo "</table>\n";
    } else {
        echo "<p class='good'>Tous les sites ont des coordonnées !</p>\n";
    }
    
    // Liens utiles
    echo "<h2>🔗 Liens utiles</h2>\n";
    echo "<ul>\n";
    echo "   <li><a href='http://localhost:8080/NetInsight%20360/netinsight360-frontend/map-view.php' target='_blank'>🗺️ Voir la carte</a></li>\n";
    echo "   <li><a href='http://localhost:8080/phpmyadmin' target='_blank'>📊 phpMyAdmin</a></li>\n";
    echo "</ul>\n";
    
} catch (Exception $e) {
    echo "<p class='bad'>Erreur: " . $e->getMessage() . "</p>\n";
}

echo "</body></html>\n";