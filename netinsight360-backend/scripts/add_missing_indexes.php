<?php
/**
 * NetInsight 360 - Ajout des index manquants pour performances multi-mois
 * À exécuter UNE SEULE FOIS.
 * Usage : php scripts/add_missing_indexes.php
 */

require_once __DIR__ . '/maintenance/_bootstrap.php';

$pdo = Database::getLocalConnection();

$indexes = [
    // kpis_ran: axes de filtrage/agrégation les plus fréquents.
    'kpis_ran'  => [
        'idx_date_technology' => 'ALTER TABLE kpis_ran ADD INDEX idx_date_technology (kpi_date, technology)',
        'idx_date_global'     => 'ALTER TABLE kpis_ran ADD INDEX idx_date_global (kpi_date, kpi_global)',
        'idx_site_tech_date'  => 'ALTER TABLE kpis_ran ADD INDEX idx_site_tech_date (site_id, technology, kpi_date)',
        'idx_tech_site_date'  => 'ALTER TABLE kpis_ran ADD INDEX idx_tech_site_date (technology, site_id, kpi_date)',
    ],

    // alerts: statistiques et listing actifs.
    'alerts' => [
        'idx_status_type'      => 'ALTER TABLE alerts ADD INDEX idx_status_type (status, alert_type)',
        'idx_status_created'   => 'ALTER TABLE alerts ADD INDEX idx_status_created (status, created_at)',
        'idx_site_status'      => 'ALTER TABLE alerts ADD INDEX idx_site_status (site_id, status)',
        'idx_status_resolved'  => 'ALTER TABLE alerts ADD INDEX idx_status_resolved (status, resolved_at)',
    ],

    // sites: filtres transverses sur les écrans principaux.
    'sites' => [
        'idx_country_vendor_domain' => 'ALTER TABLE sites ADD INDEX idx_country_vendor_domain (country_code, vendor, domain)',
        'idx_vendor_domain'         => 'ALTER TABLE sites ADD INDEX idx_vendor_domain (vendor, domain)',
    ],
];

foreach ($indexes as $table => $defs) {
    // Récupérer les index existants
    $existing = [];
    foreach ($pdo->query("SHOW INDEX FROM `$table`") as $row) {
        $existing[] = $row['Key_name'];
    }

    foreach ($defs as $name => $sql) {
        if (in_array($name, $existing)) {
            echo "[$table] Index '$name' déjà présent — ignoré.\n";
            continue;
        }
        try {
            $pdo->exec($sql);
            echo "[$table] Index '$name' créé avec succès.\n";
        } catch (PDOException $e) {
            echo "[$table] ERREUR '$name' : " . $e->getMessage() . "\n";
        }
    }
}

echo "\nTerminé.\n";
