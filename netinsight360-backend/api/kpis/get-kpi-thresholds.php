<?php
/**
 * NetInsight 360 — API: Seuils KPI par technologie
 * GET /api/kpis/get-kpi-thresholds.php?tech=2G
 *
 * Retourne les seuils de classification des KPIs (good/warning/critical)
 * définis dans config/thresholds.php.
 *
 * Paramètre GET optionnel :
 *   tech : '2G' | '3G' | '4G' | 'CORE' | 'all' (défaut: all)
 *
 * Utilisé par le frontend pour colorier les jauges et badges selon les seuils.
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/thresholds.php';

$tech = $_GET['tech'] ?? 'all';
$thresholds = require __DIR__ . '/../../config/thresholds.php';

if ($tech !== 'all' && isset($thresholds[$tech])) {
    echo json_encode(['success' => true, 'data' => [$tech => $thresholds[$tech]]]);
} else {
    echo json_encode(['success' => true, 'data' => $thresholds]);
}
