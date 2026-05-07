<?php
/**
 * Script de création de la fonction SQL prismis.give_site_id
 * à exécuter sur la base distante CI
 */

$basePath = dirname(__DIR__);
require_once $basePath . '/vendor/autoload.php';
require_once $basePath . '/config/database.php';

Database::bootstrapEnvironment();

try {
    $pdo = Database::getRemoteConnection();
    
    // Vérifier si la fonction existe déjà
    $stmt = $pdo->query("SHOW FUNCTION STATUS WHERE Name = 'give_site_id'");
    $exists = $stmt->fetch();
    
    if ($exists) {
        echo "La fonction give_site_id existe déjà.\n";
    } else {
        // Créer la fonction en plusieurs étapes
        // Étape 1: Créer la base si nécessaire
        $pdo->exec("CREATE DATABASE IF NOT EXISTS prismis");
        $pdo->exec("USE prismis");
        
        // Étape 2: Créer la fonction (sans DELIMITER car PDO ne le supporte pas)
        $sql = "
        CREATE FUNCTION prismis.give_site_id(cell_name VARCHAR(255))
        RETURNS VARCHAR(50) DETERMINISTIC
        BEGIN
            DECLARE site_id VARCHAR(50) DEFAULT NULL;
            DECLARE cleaned VARCHAR(50) DEFAULT NULL;
            
            IF cell_name IS NOT NULL AND LENGTH(cell_name) > 0 THEN
                SET cleaned = REGEXP_REPLACE(cell_name, '_[0-9]+$', '');
                IF cleaned = '' THEN
                    SET cleaned = cell_name;
                END IF;
                SET cleaned = REGEXP_REPLACE(cleaned, 'CELL[0-9]*$', '');
                IF cleaned = '' THEN
                    SET cleaned = cell_name;
                END IF;
                SET site_id = cleaned;
            END IF;
            
            RETURN site_id;
        END
        ";
        
        $pdo->exec($sql);
        echo "Fonction give_site_id créée avec succès.\n";
    }
    
} catch (Exception $e) {
    echo "Erreur: " . $e->getMessage() . "\n";
}