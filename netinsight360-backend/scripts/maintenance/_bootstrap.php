<?php

require_once __DIR__ . '/../../config/database.php';

Database::bootstrapEnvironment();

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Forbidden');
}

if ((string) getenv('ALLOW_MAINTENANCE_SCRIPTS') !== '1') {
    fwrite(STDERR, "Autorisation manquante: définissez ALLOW_MAINTENANCE_SCRIPTS=1 pour exécuter ce script.\n");
    exit(1);
}