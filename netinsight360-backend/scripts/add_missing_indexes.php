<?php
/**
 * NetInsight 360 - Ajout des index manquants pour performances multi-mois
 * À exécuter UNE SEULE FOIS.
 * Usage : php scripts/add_missing_indexes.php
 */

require_once __DIR__ . '/../config/database.php';

$pdo = Database::getLocalConnection();

$indexes = [
    // (kpi_date, technology) → accélère les requêtes filtrées par date + techno
    'kpis_ran'  => [
        'idx_date_technology' => 'ALTER TABLE kpis_ran ADD INDEX idx_date_technology (kpi_date, technology)',
        'idx_date_global'     => 'ALTER TABLE kpis_ran ADD INDEX idx_date_global (kpi_date, kpi_global)',
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
