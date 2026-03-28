<?php
require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';

$bounds = [
    'CI' => ['center' => [7.539989, -5.547080], 'zoom' => 7],
    'NE' => ['center' => [17.607789, 8.081666], 'zoom' => 6],
    'BJ' => ['center' => [9.307690, 2.315834], 'zoom' => 7],
    'TG' => ['center' => [8.619543, 0.824782], 'zoom' => 7],
    'SN' => ['center' => [14.497401, -14.452362], 'zoom' => 7],
    'ML' => ['center' => [17.570692, -3.996166], 'zoom' => 6],
    'BF' => ['center' => [12.364637, -1.535659], 'zoom' => 7],
    'GH' => ['center' => [7.946527, -1.023194], 'zoom' => 7],
];

$country = $_GET['country'] ?? '';

if (isset($bounds[$country])) {
    echo json_encode(['success' => true, 'data' => $bounds[$country]]);
} else {
    echo json_encode(['success' => false, 'error' => 'Pays non trouvé']);
}
