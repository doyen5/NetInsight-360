<?php
// test_remote_ids.php
require_once __DIR__ . '/config/database.php';

$pdo = Database::getRemoteConnection();

// Test 2G
$sql = "SELECT DISTINCT prismis.give_site_id(CELL_NAME) AS site_id 
        FROM network_2g_main_kpis_hourly 
        WHERE DATE_ID = CURDATE() 
        LIMIT 20";
$stmt = $pdo->query($sql);
$ids = $stmt->fetchAll(PDO::FETCH_COLUMN);

echo "IDs 2G trouvés:\n";
print_r($ids);