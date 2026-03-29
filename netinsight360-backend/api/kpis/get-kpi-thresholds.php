<?php
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
