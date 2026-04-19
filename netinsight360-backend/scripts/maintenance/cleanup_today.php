<?php

require_once __DIR__ . '/_bootstrap.php';

$db = Database::getLocalConnection();

echo "Nettoyage des données kpis_ran pour aujourd'hui...\n";

$today = date('Y-m-d');
echo "  Date: {$today}\n";

try {
    $stmt = $db->prepare('DELETE FROM netinsight360.kpis_ran WHERE kpi_date = ?');
    $stmt->execute([$today]);
    $count = $stmt->rowCount();
    echo "  [✓] {$count} lignes supprimées\n";

    echo "\n✓ Nettoyage effectué! Prêt à relancer les imports.\n";
} catch (Exception $e) {
    echo "\n✗ Erreur: " . $e->getMessage() . "\n";
    exit(1);
}