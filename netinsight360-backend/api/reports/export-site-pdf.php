<?php
// API pour exporter les données d'un site en PDF
// Accessible uniquement pour ADMIN et FO_ANALYSTE

require_once __DIR__ . '/../../app/helpers/AuthHelper.php';
require_once __DIR__ . '/../../config/database.php';

AuthHelper::requireLogin();
$userRole = AuthHelper::getUserRole();

if (!in_array($userRole, ['ADMIN', 'FO_ANALYSTE'])) {
    http_response_code(403);
    die('Accès refusé.');
}

$siteId     = $_GET['site_id'] ?? '';
$kpiName    = $_GET['kpi_name'] ?? '';
$technology = strtoupper(trim($_GET['technology'] ?? ''));
$period     = $_GET['period'] ?? '';

if (!$siteId || !$kpiName || !$technology || !$period) {
    http_response_code(400);
    die('Paramètres manquants.');
}

$siteData = getSiteData($siteId);
if (!$siteData) {
    http_response_code(404);
    die('Site non trouvé.');
}

$trends = getKPITrends($siteId, $kpiName, $technology, $period);

generatePDF($siteData, $trends, $kpiName, $technology, $period);

function getSiteData($siteId) {
    $pdo = Database::getLocalConnection();
    $stmt = $pdo->prepare(
        "SELECT s.id AS site_id, s.name AS site_name, s.region, s.technology, s.status, s.kpi_global, s.vendor, s.country_code
         FROM sites s
         WHERE s.id = ?
         LIMIT 1"
    );
    $stmt->execute([$siteId]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

function getKPITrends($siteId, $kpiName, $technology, $period) {
    $pdo = Database::getLocalConnection();

    $mapping = [
        'Disponibilité TCH'          => 'tch_availability',
        'Taux de chute appel'        => 'tch_drop_rate',
        'Taux de handover 2G'        => 'handover_sr_2g',
        'Congestion SDCCH'           => 'sdcch_cong',
        'Chute SDCCH'                => 'sdcch_drop',
        'Taux établissement appel'   => 'cssr_2g',
        'Taux congestion TCH'        => 'tch_cong_rate',
        'Accessibilité RNA 2G'       => 'rna_2g',
        'RRC CS SR'                  => 'rrc_cs_sr',
        'RAB CS SR'                  => 'rab_cs_sr',
        'RRC PS SR'                  => 'rrc_ps_sr',
        'Taux de chute CS'           => 'cs_drop_rate',
        'Soft HO'                    => 'soft_ho_rate',
        'Taux établissement CS'      => 'cssr_cs_sr',
        'Taux établissement PS'      => 'cssr_ps_sr',
        'Taux de chute PS'           => 'ps_drop_rate',
        'LTE S1 SR'                  => 'lte_s1_sr',
        'LTE RRC SR'                 => 'lte_rrc_sr',
        'LTE ERAB SR'                => 'lte_erab_sr',
        'Taux établissement session' => 'lte_session_sr',
        'LTE CSFB SR'                => 'lte_csfb_sr',
        'Taux de chute ERAB'         => 'lte_erab_drop_rate',
        'LTE Intra-fréquence'        => 'lte_intra_freq_sr',
        'LTE Inter-fréquence'        => 'lte_inter_freq_sr',
        'KPI Global'                 => 'kpi_global',
    ];

    $column = $mapping[$kpiName] ?? 'kpi_global';
    $allowed = array_values($mapping);
    if (!in_array($column, $allowed, true)) {
        $column = 'kpi_global';
    }

    $days = 7;
    if ($period === 'day') {
        $days = 5;
    } elseif ($period === 'week') {
        $days = 7;
    } elseif ($period === 'month') {
        $days = 30;
    }

    $stmtDates = $pdo->prepare(
        "SELECT DISTINCT kpi_date, kpi_hour
         FROM kpis_ran
         WHERE site_id = ? AND technology = ?
         ORDER BY kpi_date DESC, kpi_hour DESC
         LIMIT ?"
    );
    $stmtDates->execute([$siteId, $technology, $days]);
    $rawDates = $stmtDates->fetchAll(PDO::FETCH_ASSOC);

    $dates = [];
    $useHour = false;
    foreach (array_reverse($rawDates) as $row) {
        if ($row['kpi_hour'] !== null && $row['kpi_hour'] !== '') {
            $useHour = true;
            $dates[] = $row['kpi_date'] . ' ' . str_pad($row['kpi_hour'], 2, '0', STR_PAD_LEFT) . ':00:00';
        } else {
            $dates[] = $row['kpi_date'];
        }
    }

    $trends = [];
    if (!empty($dates)) {
        $placeholders = implode(',', array_fill(0, count($dates), '?'));
        $params = [$siteId];

        if ($useHour) {
            $clauses = [];
            foreach ($dates as $date) {
                if (strpos($date, ' ') === false) {
                    $clauses[] = '(kpi_date = ? AND kpi_hour IS NULL)';
                    $params[] = $date;
                } else {
                    [$d, $t] = explode(' ', $date);
                    $hour = intval(explode(':', $t)[0]);
                    $clauses[] = '(kpi_date = ? AND kpi_hour = ?)';
                    $params[] = $d;
                    $params[] = $hour;
                }
            }
            $sql = "SELECT kpi_date, kpi_hour, ROUND(AVG(`$column`), 2) AS val FROM kpis_ran WHERE site_id = ? AND technology = ? AND (" . implode(' OR ', $clauses) . ") GROUP BY kpi_date, kpi_hour ORDER BY kpi_date ASC, kpi_hour ASC";
            array_splice($params, 1, 0, $technology);
        } else {
            $params = array_merge([$siteId, $technology], $dates);
            $sql = "SELECT kpi_date, ROUND(AVG(`$column`), 2) AS val FROM kpis_ran WHERE site_id = ? AND technology = ? AND kpi_date IN ($placeholders) GROUP BY kpi_date ORDER BY kpi_date ASC";
        }

        $stmtValues = $pdo->prepare($sql);
        $stmtValues->execute($params);
        $values = [];
        while ($row = $stmtValues->fetch(PDO::FETCH_ASSOC)) {
            if ($useHour && isset($row['kpi_hour'])) {
                $key = $row['kpi_date'] . ' ' . str_pad((string)$row['kpi_hour'], 2, '0', STR_PAD_LEFT) . ':00:00';
            } else {
                $key = $row['kpi_date'];
            }
            $values[$key] = $row['val'] !== null ? round(floatval($row['val']), 2) : null;
        }

        foreach ($dates as $date) {
            $trends[] = [
                'date' => $useHour && strpos($date, ' ') ? date('d/m H:i', strtotime($date)) : date('d/m', strtotime($date)),
                'value' => $values[$date] ?? null,
            ];
        }
    }

    return $trends;
}

function generatePDF($siteData, $trends, $kpiName, $technology, $period) {
    require_once __DIR__ . '/../../vendor/setasign/fpdf/fpdf.php';

    $pdf = new \FPDF();
    $pdf->AddPage();
    $pdf->SetFont('Arial', 'B', 16);

    $pdf->Cell(0, 10, 'Rapport d\'Analyse de Site - NetInsight 360', 0, 1, 'C');
    $pdf->Ln(10);

    $pdf->SetFont('Arial', 'B', 14);
    $pdf->Cell(0, 10, 'Informations du Site', 0, 1);
    $pdf->SetFont('Arial', '', 12);
    $pdf->Cell(0, 8, 'ID Site: ' . $siteData['site_id'], 0, 1);
    $pdf->Cell(0, 8, 'Nom: ' . $siteData['site_name'], 0, 1);
    $pdf->Cell(0, 8, 'Region: ' . ($siteData['region'] ?? 'N/A'), 0, 1);
    $pdf->Cell(0, 8, 'Technologie: ' . ($siteData['technology'] ?? 'N/A'), 0, 1);
    $pdf->Cell(0, 8, 'Statut: ' . ($siteData['status'] ?? 'N/A'), 0, 1);
    $pdf->Ln(10);

    $pdf->SetFont('Arial', 'B', 14);
    $pdf->Cell(0, 10, 'Analyse KPI: ' . $kpiName, 0, 1);
    $pdf->Cell(0, 8, 'Technologie: ' . $technology, 0, 1);
    $pdf->Cell(0, 8, 'Periode: ' . getPeriodLabel($period), 0, 1);
    $pdf->Ln(5);

    $pdf->SetFont('Arial', 'B', 10);
    $pdf->Cell(70, 8, 'Date', 1);
    $pdf->Cell(50, 8, 'Valeur', 1);
    $pdf->Ln();

    $pdf->SetFont('Arial', '', 10);
    foreach ($trends as $point) {
        $pdf->Cell(70, 8, $point['date'], 1);
        $pdf->Cell(50, 8, $point['value'] === null ? 'N/A' : $point['value'], 1);
        $pdf->Ln();
    }

    if (!empty($trends)) {
        $values = array_filter(array_column($trends, 'value'), function($v) { return $v !== null; });
        if (!empty($values)) {
            $avg = array_sum($values) / count($values);
            $min = min($values);
            $max = max($values);

            $pdf->Ln(10);
            $pdf->SetFont('Arial', 'B', 12);
            $pdf->Cell(0, 10, 'Statistiques', 0, 1);
            $pdf->SetFont('Arial', '', 10);
            $pdf->Cell(0, 8, 'Moyenne: ' . number_format($avg, 2), 0, 1);
            $pdf->Cell(0, 8, 'Minimum: ' . number_format($min, 2), 0, 1);
            $pdf->Cell(0, 8, 'Maximum: ' . number_format($max, 2), 0, 1);
        }
    }

    $pdf->Ln(20);
    $pdf->SetFont('Arial', 'I', 8);
    $pdf->Cell(0, 10, 'Généré le ' . date('d/m/Y H:i'), 0, 1, 'C');

    $filename = 'site_' . $siteData['site_id'] . '_report_' . date('Y-m-d') . '.pdf';
    $pdf->Output('D', $filename);
}

function getPeriodLabel($period) {
    $labels = [
        'day' => 'Dernier Jour',
        'week' => 'Dernière Semaine',
        'month' => 'Dernier Mois'
    ];
    return $labels[$period] ?? $period;
}
?>