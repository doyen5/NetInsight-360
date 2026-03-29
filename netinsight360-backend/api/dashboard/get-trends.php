<?php
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo  = Database::getLocalConnection();
    $kpi  = $_GET['kpi'] ?? 'RNA';
    $days = max(5, min(30, intval($_GET['days'] ?? 7)));

    $labels = [];
    $values = [];

    if ($kpi === 'packet_loss') {
        // Packet Loss : agrégation desde kpis_core sur les N derniers jours avec données
        $tableExists = $pdo->query("SHOW TABLES LIKE 'kpis_core'")->fetchColumn();
        if ($tableExists) {
            $stmt = $pdo->prepare("
                SELECT DATE(kpi_date) AS d, ROUND(AVG(packet_loss), 2) AS avg_val
                FROM kpis_core
                WHERE kpi_date >= DATE_SUB((SELECT MAX(kpi_date) FROM kpis_core), INTERVAL ? DAY)
                  AND packet_loss IS NOT NULL
                GROUP BY DATE(kpi_date)
                ORDER BY d ASC
                LIMIT ?
            ");
            $stmt->execute([$days, $days]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            $rows = [];
        }
        foreach ($rows as $row) {
            $labels[] = date('d/m', strtotime($row['d']));
            $values[] = floatval($row['avg_val']);
        }
    } else {
        // RNA (et tout autre KPI RAN) : agrégation depuis kpis_ran sur les N derniers jours avec données
        $stmt = $pdo->prepare("
            SELECT kpi_date AS d, ROUND(AVG(kpi_global), 2) AS avg_val
            FROM kpis_ran
            WHERE kpi_date >= DATE_SUB((SELECT MAX(kpi_date) FROM kpis_ran), INTERVAL ? DAY)
              AND kpi_global > 0
            GROUP BY kpi_date
            ORDER BY kpi_date ASC
            LIMIT ?
        ");
        $stmt->execute([$days, $days]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) {
            $labels[] = date('d/m', strtotime($row['d']));
            $values[] = floatval($row['avg_val']);
        }
    }

    echo json_encode([
        'success' => true,
        'data'    => ['labels' => $labels, 'values' => $values]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
