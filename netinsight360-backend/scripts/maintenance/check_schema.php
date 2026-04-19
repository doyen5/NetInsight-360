<?php

require_once __DIR__ . '/_bootstrap.php';

$db = Database::getLocalConnection();
$result = $db->query('SHOW CREATE TABLE netinsight360.kpis_ran')->fetch(PDO::FETCH_ASSOC);
echo $result['Create Table'];