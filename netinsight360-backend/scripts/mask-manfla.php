<?php
/**
 * Script pour corriger définitivement Manfla avec ses coordonnées CI.
 */

require_once __DIR__ . '/maintenance/_bootstrap.php';

try {
    $pdo = Database::getLocalConnection();
    
    // Forcer les coordonnées validées de Manfla en Côte d'Ivoire.
    $sql = "UPDATE sites
            SET latitude = 7.4002338,
                longitude = -5.92163,
                country_code = 'CI',
                updated_at = NOW()
            WHERE (name = 'MANFLA' OR id = 'AC971')";
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    
    $rowCount = $stmt->rowCount();
    
    if ($rowCount > 0) {
        echo "✓ {$rowCount} site(s) Manfla corrigé(s) avec coordonnées CI\n";
    } else {
        echo "⚠ Aucun site Manfla trouvé dans la base de données\n";
    }
    
} catch (Exception $e) {
    echo "✗ Erreur: " . $e->getMessage() . "\n";
    exit(1);
}
