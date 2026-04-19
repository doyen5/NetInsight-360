<?php

require_once __DIR__ . '/_bootstrap.php';

$db = Database::getLocalConnection();

echo "Modification de la clé unique sur kpis_ran...\n";

try {
    echo "  [1/2] Suppression de l'ancienne contrainte...\n";
    $db->exec('ALTER TABLE netinsight360.kpis_ran DROP INDEX unique_site_datetime');
    echo "  [✓] Ancienne clé supprimée\n";

    echo "  [2/2] Création de la nouvelle contrainte (site_id, kpi_date, kpi_hour, technology)...\n";
    $db->exec('ALTER TABLE netinsight360.kpis_ran ADD UNIQUE KEY unique_site_datetime (site_id, kpi_date, kpi_hour, technology)');
    echo "  [✓] Nouvelle clé créée\n";

    echo "\n✓ Clé unique modifiée avec succès!\n";
    echo "  Maintenant 2G, 3G et 4G peuvent coexister pour un même site/date/heure\n";
} catch (Exception $e) {
    echo "\n✗ Erreur: " . $e->getMessage() . "\n";
    exit(1);
}