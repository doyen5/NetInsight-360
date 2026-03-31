<?php
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

/**
 * Calcule la moyenne de kpi_global par technologie pour un ensemble de dates.
 * @param PDO    $pdo
 * @param array  $dates  liste de dates 'Y-m-d'
 * @return array ['2G' => float, '3G' => float, '4G' => float, 'global' => float]
 */
function avgKpiByTech(PDO $pdo, array $dates): array {
    $result = ['2G' => 0.0, '3G' => 0.0, '4G' => 0.0, 'global' => 0.0];
    if (!$dates) return $result;
    $ph   = implode(',', array_fill(0, count($dates), '?'));
    $stmt = $pdo->prepare("
        SELECT technology, ROUND(AVG(kpi_global), 2) AS avg
        FROM kpis_ran
        WHERE kpi_date IN ($ph) AND kpi_global > 0
        GROUP BY technology
    ");
    $stmt->execute($dates);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $sum  = 0.0; $cnt = 0;
    foreach ($rows as $row) {
        $result[$row['technology']] = (float)$row['avg'];
        $sum += (float)$row['avg']; $cnt++;
    }
    $result['global'] = $cnt > 0 ? round($sum / $cnt, 2) : 0.0;
    return $result;
}

try {
    $pdo = Database::getLocalConnection();

    // Récupère les 14 dernières dates disponibles dans kpis_ran
    $allDates = $pdo->query("
        SELECT DISTINCT kpi_date FROM kpis_ran
        ORDER BY kpi_date DESC LIMIT 14
    ")->fetchAll(PDO::FETCH_COLUMN);

    if (!$allDates) {
        echo json_encode(['success' => false, 'error' => 'Aucune donnée disponible.']);
        exit;
    }

    // Moitié récente / moitié précédente (ordre DESC → index 0 = plus récent)
    $n        = max(1, intdiv(count($allDates), 2));
    $recent   = array_slice($allDates, 0, $n);   // dates les plus récentes
    $previous = array_slice($allDates, $n);       // dates précédentes

    $kpiRecent   = avgKpiByTech($pdo, $recent);
    $kpiPrevious = avgKpiByTech($pdo, $previous);

    // Labels de période pour l'affichage
    $labelRecent   = date('d/m', strtotime(min($recent)))   . ' – ' . date('d/m', strtotime(max($recent)));
    $labelPrevious = $previous
        ? date('d/m', strtotime(min($previous))) . ' – ' . date('d/m', strtotime(max($previous)))
        : 'N/A';

    $techs  = ['2G', '3G', '4G'];
    $dataRecent   = array_map(fn($t) => $kpiRecent[$t],   $techs);
    $dataPrevious = array_map(fn($t) => $kpiPrevious[$t], $techs);

    // Évolution globale
    $evolution = $kpiPrevious['global'] > 0
        ? round($kpiRecent['global'] - $kpiPrevious['global'], 2)
        : 0;
    $icon   = $evolution >= 0 ? '✅' : '⚠️';
    $verb   = $evolution >= 0 ? 'améliorée' : 'dégradée';
    $lesson = "{$icon} La qualité réseau s'est <strong>{$verb} de " . abs($evolution) . "%</strong> "
            . "entre la période précédente et la période récente.";

    echo json_encode([
        'success' => true,
        'data' => [
            'labels'   => $techs,
            'datasets' => [
                [
                    'label'           => "Période récente ({$labelRecent})",
                    'data'            => $dataRecent,
                    'backgroundColor' => 'rgba(0,163,196,0.7)',
                    'borderColor'     => 'rgba(0,163,196,1)',
                    'borderWidth'     => 1,
                ],
                [
                    'label'           => "Période précédente ({$labelPrevious})",
                    'data'            => $dataPrevious,
                    'backgroundColor' => 'rgba(245,158,11,0.7)',
                    'borderColor'     => 'rgba(245,158,11,1)',
                    'borderWidth'     => 1,
                ],
            ]
        ],
        'lessons' => "
            <p class='mt-3'>{$lesson}</p>
            <p>
                KPI Global — Période récente&nbsp;: <strong>{$kpiRecent['global']}%</strong>
                &nbsp;|&nbsp;
                Période précédente&nbsp;: <strong>{$kpiPrevious['global']}%</strong>
            </p>
            <p class='text-muted small'>
                Période récente&nbsp;: {$labelRecent} ({$n} date(s)) &nbsp;·&nbsp;
                Période précédente&nbsp;: {$labelPrevious} (" . count($previous) . " date(s))
            </p>"
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
