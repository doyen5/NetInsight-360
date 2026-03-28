<?php
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo  = Database::getLocalConnection();
    $kpi  = $_GET['kpi'] ?? 'RNA';
    $days = max(5, min(30, intval($_GET['days'] ?? 7)));

    // Génère les N derniers jours
    $labels = [];
    $values = [];

    for ($i = $days - 1; $i >= 0; $i--) {
        $date     = date('Y-m-d', strtotime("-$i days"));
        $labels[] = date('d/m', strtotime($date));

        $stmt = $pdo->prepare("
            SELECT ROUND(AVG(kpi_value), 2) AS avg_val
            FROM kpi_daily_history
            WHERE kpi_name = ? AND recorded_date = ?
        ");
        $stmt->execute([$kpi, $date]);
        $row      = $stmt->fetch(PDO::FETCH_ASSOC);
        $values[] = $row['avg_val'] !== null ? floatval($row['avg_val']) : null;
    }

    echo json_encode([
        'success' => true,
        'data'    => ['labels' => $labels, 'values' => $values]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
