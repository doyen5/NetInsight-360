<?php

require_once __DIR__ . '/_bootstrap.php';

$db = Database::getLocalConnection();

$result = $db->query('
    SELECT technology, COUNT(*) as count
    FROM netinsight360.kpis_ran
    WHERE kpi_date = CURDATE()
    GROUP BY technology
    ORDER BY technology
')->fetchAll(PDO::FETCH_ASSOC);

echo "Résultats finaux - KPIs importés pour aujourd'hui:\n";
echo "=================================================\n";
foreach ($result as $row) {
    echo $row['technology'] . ": {" . $row['count'] . "} sites\n";
}
echo "=================================================\n";
echo "Total: " . array_sum(array_column($result, 'count')) . " sites\n";