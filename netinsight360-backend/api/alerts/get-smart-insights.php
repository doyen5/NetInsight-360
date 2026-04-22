<?php
/**
 * NetInsight 360 — API: Alertes intelligentes
 * GET /api/alerts/get-smart-insights.php
 *
 * Retourne des insights orientés exploitation:
 * - seuil dynamique (baseline 7 jours)
 * - score d'anomalie (z-score)
 * - recommandation d'action
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

if (($_SESSION['user_role'] ?? '') === 'CUSTOMER') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Accès non autorisé']);
    exit;
}

try {
    $pdo = Database::getLocalConnection();

    $slot = $pdo->query("\n        SELECT\n            MAX(kpi_date) AS max_date\n        FROM kpis_ran\n    ")->fetch(PDO::FETCH_ASSOC);

    if (!$slot || empty($slot['max_date'])) {
        echo json_encode(['success' => true, 'data' => ['items' => [], 'generated_at' => date('Y-m-d H:i:s')]]);
        exit;
    }

    $maxDate = $slot['max_date'];
    $maxHourRow = $pdo->prepare("SELECT MAX(kpi_hour) AS max_hour FROM kpis_ran WHERE kpi_date = ?");
    $maxHourRow->execute([$maxDate]);
    $maxHourRaw = $maxHourRow->fetch(PDO::FETCH_ASSOC)['max_hour'] ?? null;
    $maxHour = ($maxHourRaw !== null && $maxHourRaw !== '') ? (int)$maxHourRaw : null;

    $configs = [
        [
            'id' => 'RNA',
            'tech' => null,
            'expr' => 'kpi_global',
            'label' => 'RNA global RAN',
            'direction' => 'high', // plus haut = meilleur
            'target' => 99.5,
            'recommendation' => 'Vérifier les clusters radio avec dégradation simultanée multi-tech et prioriser les sites critiques.'
        ],
        [
            'id' => '2G_TCH_DROP',
            'tech' => '2G',
            'expr' => 'tch_drop_rate',
            'label' => '2G TCH Drop Rate',
            'direction' => 'low', // plus bas = meilleur
            'target' => 2.0,
            'recommendation' => 'Contrôler congestion TRX, qualité radio et handovers 2G sur les zones impactées.'
        ],
        [
            'id' => '3G_CSSR',
            'tech' => '3G',
            'expr' => '(IFNULL(rrc_cs_sr, 0) + IFNULL(rab_cs_sr, 0)) / NULLIF((rrc_cs_sr IS NOT NULL) + (rab_cs_sr IS NOT NULL), 0)',
            'label' => '3G CSSR',
            'direction' => 'high',
            'target' => 98.0,
            'recommendation' => 'Analyser la signalisation CS (RRC/RAB), capacité NodeB et causes d’échec setup.'
        ],
        [
            'id' => '4G_ERAB_SR',
            'tech' => '4G',
            'expr' => 'lte_erab_sr',
            'label' => '4G ERAB Success Rate',
            'direction' => 'high',
            'target' => 97.5,
            'recommendation' => 'Inspecter admission control LTE, saturation eNodeB et stabilité des bearers.'
        ],
    ];

    $items = [];

    foreach ($configs as $cfg) {
        $whereNow = ['kpi_date = ?', $cfg['expr'] . ' IS NOT NULL'];
        $paramsNow = [$maxDate];
        if ($maxHour !== null) {
            $whereNow[] = 'kpi_hour = ?';
            $paramsNow[] = $maxHour;
        }
        if ($cfg['tech']) {
            $whereNow[] = 'technology = ?';
            $paramsNow[] = $cfg['tech'];
        }

        $sqlNow = "SELECT ROUND(AVG(" . $cfg['expr'] . "), 2) AS current_val, COUNT(*) AS row_count FROM kpis_ran WHERE " . implode(' AND ', $whereNow);
        $stNow = $pdo->prepare($sqlNow);
        $stNow->execute($paramsNow);
        $nowRow = $stNow->fetch(PDO::FETCH_ASSOC);
        // Si aucune ligne avec des données réelles, ignorer ce KPI
        if (empty($nowRow) || (int)($nowRow['row_count'] ?? 0) === 0) {
            continue;
        }
        $current = (float)($nowRow['current_val'] ?? 0);

        $whereBase = ['kpi_date >= DATE_SUB(?, INTERVAL 7 DAY)', $cfg['expr'] . ' IS NOT NULL'];
        $paramsBase = [$maxDate];
        if ($cfg['tech']) {
            $whereBase[] = 'technology = ?';
            $paramsBase[] = $cfg['tech'];
        }

        $sqlBase = "\n            SELECT\n                ROUND(AVG(" . $cfg['expr'] . "), 2) AS baseline_avg,\n                ROUND(STDDEV_SAMP(" . $cfg['expr'] . "), 4) AS baseline_std\n            FROM kpis_ran\n            WHERE " . implode(' AND ', $whereBase) . "\n        ";
        $stBase = $pdo->prepare($sqlBase);
        $stBase->execute($paramsBase);
        $baseRow = $stBase->fetch(PDO::FETCH_ASSOC) ?: [];

        $avg = (float)($baseRow['baseline_avg'] ?? 0);
        $std = (float)($baseRow['baseline_std'] ?? 0);

        $dynamicThreshold = $cfg['target'];
        if ($std > 0) {
            if ($cfg['direction'] === 'high') {
                $dynamicThreshold = round($avg - (1.5 * $std), 2);
            } else {
                $dynamicThreshold = round($avg + (1.5 * $std), 2);
            }
        }

        $zScore = 0.0;
        if ($std > 0) {
            $zScore = round(abs($current - $avg) / $std, 2);
        }

        $isBad = false;
        if ($cfg['direction'] === 'high') {
            $isBad = $current < $dynamicThreshold;
        } else {
            $isBad = $current > $dynamicThreshold;
        }

        $severity = 'good';
        if ($isBad && $zScore >= 2.5) {
            $severity = 'critical';
        } elseif ($isBad || $zScore >= 1.8) {
            $severity = 'warning';
        }

        $items[] = [
            'id' => $cfg['id'],
            'label' => $cfg['label'],
            'technology' => $cfg['tech'] ?: 'ALL',
            'current' => $current,
            'baseline_avg' => $avg,
            'baseline_std' => $std,
            'dynamic_threshold' => $dynamicThreshold,
            'target' => $cfg['target'],
            'direction' => $cfg['direction'],
            'z_score' => $zScore,
            'severity' => $severity,
            'recommendation' => $cfg['recommendation'],
        ];
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'slot' => [
                'kpi_date' => $maxDate,
                'kpi_hour' => $maxHour,
            ],
            'generated_at' => date('Y-m-d H:i:s'),
            'items' => $items,
        ]
    ]);
} catch (Exception $e) {
    error_log('[get-smart-insights] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Erreur serveur']);
}
