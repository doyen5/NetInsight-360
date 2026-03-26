<?php
$file = __DIR__ . '/../data/sites_coordinates.csv';
echo "<pre>";

if (!file_exists($file)) {
    echo "Fichier non trouvé: $file\n";
    exit;
}

$handle = fopen($file, 'r');
$lineNum = 0;

while (($line = fgets($handle)) !== false && $lineNum < 15) {
    $lineNum++;
    echo "Ligne $lineNum: " . htmlspecialchars($line) . "\n";
}

fclose($handle);
echo "</pre>";  