<?php
/**
 * Migration : aligne audit_logs avec AuditHelper.php
 * Ajoute user_email et details si absents.
 * Usage : php scripts/migrate_audit_logs.php
 */
require_once __DIR__ . '/maintenance/_bootstrap.php';
$pdo = Database::getLocalConnection();

$existing = [];
foreach ($pdo->query("DESCRIBE audit_logs") as $row) {
    $existing[] = $row['Field'];
}

$added = [];
if (!in_array('user_email', $existing)) {
    $pdo->exec("ALTER TABLE audit_logs ADD COLUMN user_email VARCHAR(255) NULL AFTER user_id");
    $added[] = 'user_email';
}
if (!in_array('details', $existing)) {
    $pdo->exec("ALTER TABLE audit_logs ADD COLUMN details TEXT NULL AFTER entity_id");
    $added[] = 'details';
}

if ($added) {
    echo "Colonnes ajoutées : " . implode(', ', $added) . "\n";
} else {
    echo "Aucune modification nécessaire.\n";
}

// Vérification finale
$cols = $pdo->query("DESCRIBE audit_logs")->fetchAll(PDO::FETCH_COLUMN);
echo "Structure finale : " . implode(', ', $cols) . "\n";
