<?php
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo  = Database::getLocalConnection();
    $kpi  = strtolower(trim((string)($_GET['kpi'] ?? 'rna')));
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
    } elseif ($kpi === 'rna') {
        // RNA par technologie (2G/3G/4G) avec date + heure
        $stmt = $pdo->prepare("
            SELECT kpi_date, kpi_hour, technology,
                   ROUND(AVG(kpi_global), 2) AS avg_val
            FROM kpis_ran
            WHERE kpi_date >= DATE_SUB((SELECT MAX(kpi_date) FROM kpis_ran), INTERVAL ? DAY)
              AND kpi_global > 0
              AND technology IN ('2G', '3G', '4G')
            GROUP BY kpi_date, kpi_hour, technology
            ORDER BY kpi_date ASC, kpi_hour ASC, technology ASC
        ");
        $stmt->execute([$days]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Construire la liste ordonnée des timestamps uniques (clé = date|heure)
        $timestamps = [];
        foreach ($rows as $r) {
            $key = $r['kpi_date'] . '|' . ($r['kpi_hour'] ?? '');
            if (!isset($timestamps[$key])) {
                $timestamps[$key] = ['date' => $r['kpi_date'], 'hour' => $r['kpi_hour']];
            }
        }

        // Construire les labels courts (axe X) et longs (tooltip)
        $labelMap     = [];
        $fullLabelMap = [];
        foreach ($timestamps as $key => $ts) {
            $h = (string)($ts['hour'] ?? '');
            $fullDate = date('d/m/Y', strtotime($ts['date']));
            if ($h !== '') {
                $hPad = str_pad($h, 2, '0', STR_PAD_LEFT);
                $labelMap[$key]     = date('d/m', strtotime($ts['date'])) . ' ' . $hPad . ':00';
                $fullLabelMap[$key] = $fullDate . ' ' . $hPad . ':00';
            } else {
                $labelMap[$key]     = date('d/m', strtotime($ts['date']));
                $fullLabelMap[$key] = $fullDate . ' — heure inconnue';
            }
        }

        // Indexer les valeurs par (timestamp_key => technologie)
        $dataByKey = [];
        foreach ($rows as $r) {
            $key = $r['kpi_date'] . '|' . ($r['kpi_hour'] ?? '');
            $dataByKey[$key][$r['technology']] = (float)$r['avg_val'];
        }

        // Construire les tableaux par technologie (null si absent pour ce créneau)
        $data2G = $data3G = $data4G = [];
        $fullLabels = [];
        foreach ($timestamps as $key => $ts) {
            $labels[]     = $labelMap[$key];
            $fullLabels[] = $fullLabelMap[$key];
            $data2G[] = $dataByKey[$key]['2G'] ?? null;
            $data3G[] = $dataByKey[$key]['3G'] ?? null;
            $data4G[] = $dataByKey[$key]['4G'] ?? null;
        }

        echo json_encode([
            'success' => true,
            'data'    => [
                'labels'     => $labels,
                'fullLabels' => $fullLabels,
                '2G'         => $data2G,
                '3G'         => $data3G,
                '4G'         => $data4G,
            ]
        ]);
        exit;
    } else {
        $metricMap = [
            'tch_drop_rate' => [
                'technology' => '2G',
                'expr'       => 'tch_drop_rate',
                'operator'   => '<=',
                'unit'       => '%',
                'label'      => '2G - TCH Drop Rate'
            ],
            'cssr' => [
                'technology' => '3G',
                // CSSR synthétique = moyenne des succès CS RRC/RAB disponibles.
                'expr'       => '(IFNULL(rrc_cs_sr, 0) + IFNULL(rab_cs_sr, 0)) / NULLIF((rrc_cs_sr IS NOT NULL) + (rab_cs_sr IS NOT NULL), 0)',
                'operator'   => '>=',
                'unit'       => '%',
                'label'      => '3G - CSSR'
            ],
            'lte_erab_sr' => [
                'technology' => '4G',
                'expr'       => 'lte_erab_sr',
                'operator'   => '>=',
                'unit'       => '%',
                'label'      => '4G - ERAB Success Rate'
            ],
        ];

        if (!isset($metricMap[$kpi])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'KPI non supporté']);
            exit;
        }

        $conf = $metricMap[$kpi];
        $expr = $conf['expr'];

        $stmt = $pdo->prepare("\n+            SELECT\n+                kpi_date,\n+                kpi_hour,\n+                ROUND(AVG($expr), 2) AS avg_val\n+            FROM kpis_ran\n+            WHERE kpi_date >= DATE_SUB((SELECT MAX(kpi_date) FROM kpis_ran), INTERVAL ? DAY)\n+              AND technology = ?\n+              AND $expr IS NOT NULL\n+            GROUP BY kpi_date, kpi_hour\n+            ORDER BY kpi_date ASC, kpi_hour ASC\n+        ");
        $stmt->execute([$days, $conf['technology']]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $fullLabels = [];
        foreach ($rows as $row) {
            $date = (string)$row['kpi_date'];
            $hour = $row['kpi_hour'];
            $hourTxt = ($hour === null || $hour === '') ? '' : ' ' . str_pad((string)$hour, 2, '0', STR_PAD_LEFT) . ':00';
            $labels[] = date('d/m', strtotime($date)) . $hourTxt;
            $fullLabels[] = date('d/m/Y', strtotime($date)) . $hourTxt;
            $values[] = (float)$row['avg_val'];
        }

        echo json_encode([
            'success' => true,
            'data'    => [
                'labels'      => $labels,
                'fullLabels'  => $fullLabels,
                'values'      => $values,
                'meta'        => [
                    'technology' => $conf['technology'],
                    'operator'   => $conf['operator'],
                    'unit'       => $conf['unit'],
                    'label'      => $conf['label']
                ]
            ]
        ]);
        exit;
    }

    echo json_encode([
        'success' => true,
        'data'    => ['labels' => $labels, 'values' => $values]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
