<?php
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../vendor/autoload.php';

use PhpOffice\PhpPresentation\PhpPresentation;
use PhpOffice\PhpPresentation\IOFactory;
use PhpOffice\PhpPresentation\Style\Alignment;
use PhpOffice\PhpPresentation\Style\Color;
use PhpOffice\PhpPresentation\Style\Fill;
use PhpOffice\PhpPresentation\Style\Border;

// ─── helpers ──────────────────────────────────────────────────────────────────
function pptText(string $text, int $size = 11, bool $bold = false, string $hex = 'FF000000'): \PhpOffice\PhpPresentation\Shape\RichText\Run {
    $run = new \PhpOffice\PhpPresentation\Shape\RichText\Run($text);
    $run->getFont()->setSize($size)->setBold($bold)->setColor(new Color($hex));
    return $run;
}

function pptTextBox(\PhpOffice\PhpPresentation\Slide $slide,
    int $x, int $y, int $w, int $h,
    string $text, int $size = 12, bool $bold = false,
    string $hex = 'FF000000', string $hAlign = Alignment::HORIZONTAL_LEFT): \PhpOffice\PhpPresentation\Shape\RichText
{
    $shape = $slide->createRichTextShape();
    $shape->setOffsetX($x)->setOffsetY($y)->setWidth($w)->setHeight($h);
    $shape->getActiveParagraph()->getAlignment()
        ->setHorizontal($hAlign)->setVertical(Alignment::VERTICAL_CENTER);
    $run = $shape->createTextRun($text);
    $run->getFont()->setSize($size)->setBold($bold)->setColor(new Color($hex));
    return $shape;
}

// ─── données BD ──────────────────────────────────────────────────────────────
try {
    $pdo  = Database::getLocalConnection();

    // L'API JS envoie un body JSON → $_POST est vide, il faut décoder php://input
    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $domain  = $body['domain']  ?? $_POST['domain']  ?? $_GET['domain']  ?? 'all';
    $tech    = $body['tech']    ?? $_POST['tech']    ?? $_GET['tech']    ?? 'all';
    $country = $body['country'] ?? $_POST['country'] ?? $_GET['country'] ?? 'all';
    $vendor  = $body['vendor']  ?? $_POST['vendor']  ?? $_GET['vendor']  ?? 'all';
    $date    = date('d/m/Y');

    // MAX(kpi_date) — jamais CURDATE() (import H-2)
    $lastDate = $pdo->query("SELECT MAX(kpi_date) FROM kpis_ran")->fetchColumn();
    if (!$lastDate) $lastDate = date('Y-m-d');

    $siteConds = []; $siteParams = [];
    if ($domain  !== 'all') { $siteConds[] = 's.domain = ?';       $siteParams[] = $domain; }
    if ($country !== 'all') { $siteConds[] = 's.country_code = ?'; $siteParams[] = $country; }
    if ($vendor  !== 'all') { $siteConds[] = 's.vendor = ?';       $siteParams[] = $vendor; }

    $stmtTotal = $pdo->prepare(
        "SELECT COUNT(DISTINCT s.id) FROM sites s" . ($siteConds ? ' WHERE ' . implode(' AND ', $siteConds) : '')
    );
    $stmtTotal->execute($siteParams);
    $totalSites = (int)$stmtTotal->fetchColumn();

    $kpiConds = ['k.kpi_date = ?', 'k.kpi_global > 0']; $kpiParams = [$lastDate];
    if ($domain  !== 'all') { $kpiConds[] = 's.domain = ?';       $kpiParams[] = $domain; }
    if ($tech    !== 'all') { $kpiConds[] = 'k.technology = ?';   $kpiParams[] = $tech; }
    if ($country !== 'all') { $kpiConds[] = 's.country_code = ?'; $kpiParams[] = $country; }
    if ($vendor  !== 'all') { $kpiConds[] = 's.vendor = ?';       $kpiParams[] = $vendor; }
    $kpiWhere = implode(' AND ', $kpiConds);

    $stmtAvg = $pdo->prepare("SELECT ROUND(AVG(k.kpi_global),2) FROM kpis_ran k INNER JOIN sites s ON s.id=k.site_id WHERE $kpiWhere");
    $stmtAvg->execute($kpiParams);
    $avgKpi = (float)($stmtAvg->fetchColumn() ?? 0);

    $worstStmt = $pdo->prepare("
        SELECT s.id, s.name, s.country_code, k.technology, k.kpi_global, k.worst_kpi_name, k.worst_kpi_value
        FROM sites s INNER JOIN kpis_ran k ON k.site_id = s.id
        WHERE $kpiWhere ORDER BY k.kpi_global ASC LIMIT 35
    ");
    $worstStmt->execute($kpiParams);
    $worst = $worstStmt->fetchAll(PDO::FETCH_ASSOC);

    // ─── création PresenPhpPresentation ──────────────────────────────────────
    $prs = new PhpPresentation();
    $prs->getDocumentProperties()
        ->setCreator('NetInsight 360')
        ->setTitle("Rapport KPIs RAN — {$date}");

    // ═══════════════════════════════════════════════════════════════════════
    // SLIDE 1 — Page de titre + KPIs clés
    // ═══════════════════════════════════════════════════════════════════════
    $slide1 = $prs->getActiveSlide();

    // Bandeau titre (fond bleu #00274C)
    $bgRect = $slide1->createRichTextShape();
    $bgRect->setOffsetX(0)->setOffsetY(0)->setWidth(9144000)->setHeight(1600000);
    $bgRect->getFill()->setFillType(Fill::FILL_SOLID)->setStartColor(new Color('FF00274C'));
    $bgRect->getBorder()->setLineStyle(Border::LINE_NONE);
    $bgRect->createTextRun('');

    // Titre principal
    pptTextBox($slide1, 200000, 200000, 8700000, 700000,
        'NetInsight 360 — Rapport KPIs RAN', 32, true, 'FFFFFFFF', Alignment::HORIZONTAL_LEFT);

    // Sous-titre
    $filterLabel = implode(' | ', array_filter([
        $domain  !== 'all' ? "Domaine: {$domain}"   : null,
        $country !== 'all' ? "Pays: {$country}"     : null,
        $vendor  !== 'all' ? "Vendor: {$vendor}"    : null,
        $tech    !== 'all' ? "Techno: {$tech}"      : null,
    ])) ?: 'Tous les sites supervisés';
    pptTextBox($slide1, 200000, 900000, 8700000, 500000,
        "Données du {$lastDate}  •  Généré le {$date}  •  {$filterLabel}",
        14, false, 'FFADD8E6', Alignment::HORIZONTAL_LEFT);

    // ─── 3 cartes KPI ───────────────────────────────────────────────────────
    $cards = [
        ['Sites supervisés',  (string)$totalSites, 'FF00A3C4'],
        ['KPI Global moyen',  number_format($avgKpi, 1) . '%',
            $avgKpi >= 90 ? 'FF10B981' : ($avgKpi >= 75 ? 'FFF59E0B' : 'FFEF4444')],
        ['Pires sites listés', (string)count($worst), 'FFEF4444'],
    ];
    $cardW = 2800000; $cardH = 900000; $cardY = 1800000; $gap = 100000;
    $startX = (9144000 - (count($cards) * $cardW + (count($cards)-1) * $gap)) / 2;
    foreach ($cards as $i => [$label, $val, $col]) {
        $cx = (int)($startX + $i * ($cardW + $gap));
        $card = $slide1->createRichTextShape();
        $card->setOffsetX($cx)->setOffsetY($cardY)->setWidth($cardW)->setHeight($cardH);
        $card->getFill()->setFillType(Fill::FILL_SOLID)->setStartColor(new Color('FFF8F9FA'));
        $card->getBorder()->setLineStyle(Border::LINE_SINGLE)
            ->setLineWidth(1)->setDashStyle(Border::DASH_SOLID)->setColor(new Color('FFE5E7EB'));
        $card->createTextRun('');

        // Valeur (grande)
        pptTextBox($slide1, $cx + 50000, $cardY + 60000, $cardW - 100000, 500000,
            $val, 36, true, 'FF' . substr($col, 2), Alignment::HORIZONTAL_CENTER);
        // Label
        pptTextBox($slide1, $cx + 50000, $cardY + 550000, $cardW - 100000, 280000,
            $label, 11, false, 'FF6B7280', Alignment::HORIZONTAL_CENTER);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SLIDE 2 — Tableau des pires sites
    // ═══════════════════════════════════════════════════════════════════════
    $slide2 = $prs->createSlide();

    // Titre slide 2
    pptTextBox($slide2, 200000, 80000, 8700000, 450000,
        'Analyse des pires sites RAN', 22, true, 'FF00274C');
    pptTextBox($slide2, 200000, 500000, 8700000, 280000,
        "Données : {$lastDate}  •  Classés par KPI Global croissant", 11, false, 'FF6B7280');

    // ─── tableau ────────────────────────────────────────────────────────────
    if (count($worst) > 0) {
        $cols  = ['#', 'Site ID', 'Nom', 'Pays', 'Techno', 'KPI Global', 'KPI Dégradant', 'Valeur'];
        $colW  = [300000, 800000, 1700000, 700000, 600000, 850000, 1700000, 700000];
        $rowH  = 270000;
        $tableX = 200000;
        $tableY = 850000;

        // En-tête
        $curX = $tableX;
        foreach ($cols as $ci => $col) {
            $hd = $slide2->createRichTextShape();
            $hd->setOffsetX($curX)->setOffsetY($tableY)->setWidth($colW[$ci])->setHeight($rowH);
            $hd->getFill()->setFillType(Fill::FILL_SOLID)->setStartColor(new Color('FF00274C'));
            $hd->getBorder()->setLineStyle(Border::LINE_SINGLE)
                ->setLineWidth(1)->setDashStyle(Border::DASH_SOLID)->setColor(new Color('FF1E3A5F'));
            $hd->getActiveParagraph()->getAlignment()
                ->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);
            $run = $hd->createTextRun($col);
            $run->getFont()->setSize(9)->setBold(true)->setColor(new Color('FFFFFFFF'));
            $curX += $colW[$ci];
        }

        // Lignes de données
        foreach ($worst as $ri => $s) {
            $rowY   = $tableY + ($ri + 1) * $rowH;
            $bgHex  = ($ri % 2 === 0) ? 'FFFFFFFF' : 'FFF1F5F9';
            $kpiVal = (float)($s['kpi_global'] ?? 0);
            $kpiColor = $kpiVal >= 90 ? 'FF10B981' : ($kpiVal >= 75 ? 'FFF59E0B' : 'FFEF4444');
            $cells = [
                (string)($ri + 1),
                (string)($s['id'] ?? ''),
                (string)($s['name'] ?? ''),
                (string)($s['country_code'] ?? ''),
                (string)($s['technology'] ?? ''),
                number_format($kpiVal, 1) . '%',
                (string)($s['worst_kpi_name'] ?? '—'),
                isset($s['worst_kpi_value']) ? number_format((float)$s['worst_kpi_value'], 1) . '%' : '—',
            ];
            $curX = $tableX;
            foreach ($cells as $ci => $cellVal) {
                $cell = $slide2->createRichTextShape();
                $cell->setOffsetX($curX)->setOffsetY($rowY)->setWidth($colW[$ci])->setHeight($rowH);
                $cell->getFill()->setFillType(Fill::FILL_SOLID)->setStartColor(new Color($bgHex));
                $cell->getBorder()->setLineStyle(Border::LINE_SINGLE)
                    ->setLineWidth(1)->setDashStyle(Border::DASH_SOLID)->setColor(new Color('FFE5E7EB'));
                $cell->getActiveParagraph()->getAlignment()
                    ->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);
                $run = $cell->createTextRun($cellVal);
                $hexFont = ($ci === 5) ? $kpiColor : 'FF374151';
                $run->getFont()->setSize(8)->setBold($ci === 1 || $ci === 5)->setColor(new Color($hexFont));
                $curX += $colW[$ci];
            }
        }
    } else {
        pptTextBox($slide2, 200000, 900000, 8700000, 400000,
            'Aucun site trouvé pour les filtres sélectionnés.', 14, false, 'FF6B7280', Alignment::HORIZONTAL_CENTER);
    }

    // ─── sauvegarde ─────────────────────────────────────────────────────────
    $exportsDir = __DIR__ . '/../../data/exports';
    if (!is_dir($exportsDir)) mkdir($exportsDir, 0755, true);

    $filename = 'rapport_ran_' . date('Ymd_His') . '.pptx';
    $filepath = $exportsDir . '/' . $filename;

    $writer = IOFactory::createWriter($prs, 'PowerPoint2007');
    $writer->save($filepath);

    $url = '/NetInsight%20360/netinsight360-backend/data/exports/' . rawurlencode($filename);
    echo json_encode(['success' => true, 'url' => $url]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
