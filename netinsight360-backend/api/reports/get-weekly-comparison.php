<?php
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo = Database::getLocalConnection();

    // Semaine courante : lun-dim de cette semaine
    $thisMonday = date('Y-m-d', strtotime('monday this week'));
    $lastMonday = date('Y-m-d', strtotime('monday last week'));
    $lastSunday = date('Y-m-d', strtotime('sunday last week'));

    $labels   = [];
    $thisWeek = [];
    $lastWeek = [];

    for ($i = 0; $i < 7; $i++) {
        $dateThis = date('Y-m-d', strtotime($thisMonday . " +$i days"));
        $dateLast = date('Y-m-d', strtotime($lastMonday . " +$i days"));
        $labels[] = date('D d/m', strtotime($dateThis));

        $stmt = $pdo->prepare("
            SELECT ROUND(AVG(kpi_value), 2) AS avg
            FROM kpi_daily_history
            WHERE kpi_name = 'RNA' AND recorded_date = ?
        ");
        $stmt->execute([$dateThis]);
        $thisWeek[] = floatval($stmt->fetchColumn() ?? 0);

        $stmt->execute([$dateLast]);
        $lastWeek[] = floatval($stmt->fetchColumn() ?? 0);
    }

    // Calcul d'évolution
    $avgThis = array_sum(array_filter($thisWeek)) / max(1, count(array_filter($thisWeek)));
    $avgLast = array_sum(array_filter($lastWeek)) / max(1, count(array_filter($lastWeek)));
    $evolution = $avgLast > 0 ? round($avgThis - $avgLast, 2) : 0;
    $lesson = $evolution >= 0
        ? "✅ La qualité réseau s'est améliorée de {$evolution}% par rapport à la semaine dernière."
        : "⚠️ La qualité réseau a baissé de " . abs($evolution) . "% par rapport à la semaine dernière.";

    echo json_encode([
        'success' => true,
        'data' => [
            'labels'   => $labels,
            'datasets' => [
                ['label' => 'Cette semaine', 'data' => $thisWeek, 'backgroundColor' => 'rgba(0,163,196,0.6)'],
                ['label' => 'Semaine dernière', 'data' => $lastWeek, 'backgroundColor' => 'rgba(245,158,11,0.6)']
            ]
        ],
        'lessons' => "<p class='mt-3'>{$lesson}</p>
                      <p>Moyenne cette semaine: <strong>{$avgThis}%</strong> | Semaine dernière: <strong>{$avgLast}%</strong></p>"
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
