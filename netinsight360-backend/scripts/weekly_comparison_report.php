<?php
/**
 * Génère un rapport de comparaison hebdomadaire (agrégats, sites dégradés, tendances horaires)
 * Usage: php weekly_comparison_report.php [--country=CI] [--recent_start=YYYY-MM-DD] [--recent_end=YYYY-MM-DD] [--prev_start=YYYY-MM-DD] [--prev_end=YYYY-MM-DD] [--top=20]
 */

require_once __DIR__ . '/../config/database.php';

$opts = [];
foreach ($argv as $arg) {
    if (strpos($arg, '--') !== 0) continue;
    $p = explode('=', $arg, 2);
    $k = substr($p[0], 2);
    $opts[$k] = $p[1] ?? '1';
}

$country = $opts['country'] ?? 'CI';
$recent_start = $opts['recent_start'] ?? '2026-03-31';
$recent_end = $opts['recent_end'] ?? '2026-04-02';
$prev_start = $opts['prev_start'] ?? '2026-03-26';
$prev_end = $opts['prev_end'] ?? '2026-03-29';
$topN = (int)($opts['top'] ?? 20);

$outDir = __DIR__ . '/../reports';
if (!is_dir($outDir)) mkdir($outDir, 0777, true);
$baseName = "compare_{$country}_{$recent_start}_{$recent_end}";

function csv_write($path, $rows) {
    $f = fopen($path, 'w');
    foreach ($rows as $r) fputcsv($f, $r);
    fclose($f);
}

try {
    $pdo = Database::getLocalConnection();
} catch (Exception $e) {
    echo "Erreur connexion locale: " . $e->getMessage() . "\n";
    exit(1);
}

function columnExists(PDO $pdo, $table, $column) {
    $sql = "SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?";
    $s = $pdo->prepare($sql);
    $s->execute([$table, $column]);
    $r = $s->fetch(PDO::FETCH_ASSOC);
    return (int)$r['cnt'] > 0;
}

$hasCountryKpiDaily = columnExists($pdo, 'kpi_daily_history', 'country_code');
$hasCountryKpisRan = columnExists($pdo, 'kpis_ran', 'country_code');

// 1) Agrégation hebdo par techno (kpi_daily_history)
$whereCountry = $hasCountryKpiDaily ? 'country_code = ? AND ' : '';
$sqlTech = "SELECT technology, AVG(kpi_value) AS avg_kpi FROM kpi_daily_history WHERE {$whereCountry} recorded_date BETWEEN ? AND ? GROUP BY technology";

$stmt = $pdo->prepare($sqlTech);
$paramsRecent = $hasCountryKpiDaily ? [$country, $recent_start, $recent_end] : [$recent_start, $recent_end];
$stmt->execute($paramsRecent);
$recentTech = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

$paramsPrev = $hasCountryKpiDaily ? [$country, $prev_start, $prev_end] : [$prev_start, $prev_end];
$stmt->execute($paramsPrev);
$prevTech = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

$techRows = [];
foreach (array_unique(array_merge(array_keys($recentTech), array_keys($prevTech))) as $tech) {
    $r = round($recentTech[$tech] ?? 0, 2);
    $p = round($prevTech[$tech] ?? 0, 2);
    $delta = round($r - $p, 2);
    $techRows[] = [$tech, $r, $p, $delta];
}
csv_write("$outDir/{$baseName}_tech_summary.csv", array_merge([['technology','recent_avg','prev_avg','delta']], $techRows));

// 2) Liste sites 4G les plus dégradés (top N)
$siteWhereCountry = $hasCountryKpiDaily ? 'country_code = ? AND ' : '';
$siteSql = "SELECT site_id, AVG(kpi_value) AS avg_kpi FROM kpi_daily_history WHERE {$siteWhereCountry} technology = '4G' AND recorded_date BETWEEN ? AND ? GROUP BY site_id";

$stmt = $pdo->prepare($siteSql);
$params = $hasCountryKpiDaily ? [$country, $recent_start, $recent_end] : [$recent_start, $recent_end];
$stmt->execute($params);
$recentSites = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

$params = $hasCountryKpiDaily ? [$country, $prev_start, $prev_end] : [$prev_start, $prev_end];
$stmt->execute($params);
$prevSites = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

$deltas = [];
foreach ($recentSites as $site => $ravg) {
    $pavg = $prevSites[$site] ?? null;
    if ($pavg === null) continue;
    $deltas[$site] = round($ravg - $pavg, 2);
}
arsort($deltas); // largest positive first, we want most negative => reverse
$deltasDesc = array_slice(array_reverse($deltas, true), 0, $topN, true);

$siteRows = [];
foreach ($deltasDesc as $site => $delta) {
    $siteRows[] = [$site, $recentSites[$site], $prevSites[$site], $delta];
}
csv_write("$outDir/{$baseName}_top_degraded_4g.csv", array_merge([['site_id','recent_avg','prev_avg','delta']], $siteRows));

// 3) Tendance horaire pour les sites ciblés (recent+prev range)
$trendRows = [];
$siteList = array_keys($deltasDesc);
if (!empty($siteList)) {
    $placeholders = implode(',', array_fill(0, count($siteList), '?'));
    $trendWhereCountry = $hasCountryKpisRan ? 'country_code = ? AND ' : '';
    $trendSql = "SELECT site_id, kpi_date, kpi_hour, kpi_global FROM kpis_ran WHERE {$trendWhereCountry} technology = '4G' AND kpi_date BETWEEN ? AND ? AND site_id IN ($placeholders) ORDER BY site_id, kpi_date, kpi_hour";
    $params = $hasCountryKpisRan ? array_merge([$country, $prev_start, $recent_end], $siteList) : array_merge([$prev_start, $recent_end], $siteList);
    $stmt = $pdo->prepare($trendSql);
    $stmt->execute($params);
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $trendRows[] = [$row['site_id'], $row['kpi_date'], $row['kpi_hour'], $row['kpi_global']];
    }
}
csv_write("$outDir/{$baseName}_trend_top_sites.csv", array_merge([['site_id','kpi_date','kpi_hour','kpi_global']], $trendRows));

// 4) Vérifier complétude des imports (heures manquantes) pour techs
$completeRows = [];
$techs = array_unique(array_merge(array_keys($recentTech), array_keys($prevTech), ['2G','3G','4G']));
foreach ($techs as $tech) {
    $whereCountry = $hasCountryKpisRan ? 'country_code = ? AND ' : '';
    $sql = "SELECT kpi_date, COUNT(DISTINCT kpi_hour) AS cnt FROM kpis_ran WHERE {$whereCountry} technology = ? AND kpi_date BETWEEN ? AND ? GROUP BY kpi_date";
    $stmt = $pdo->prepare($sql);
    $params = $hasCountryKpisRan ? [$country, $tech, $recent_start, $recent_end] : [$tech, $recent_start, $recent_end];
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $r) {
        $missing = 24 - (int)$r['cnt'];
        $completeRows[] = [$tech, $r['kpi_date'], (int)$r['cnt'], $missing];
    }
}
csv_write("$outDir/{$baseName}_completeness_recent.csv", array_merge([['technology','kpi_date','hours_present','hours_missing']], $completeRows));

// 5) Générer rapport HTML (Chart.js) - simple visualisation
$htmlPath = "$outDir/{$baseName}_report.html";
$html = "<!doctype html><html><head><meta charset=\"utf-8\"><title>Weekly comparison $country</title>\n<script src=\"https://cdn.jsdelivr.net/npm/chart.js\"></script>\n<style>body{font-family:Arial,Helvetica,sans-serif;padding:20px}</style></head><body>";
$html .= "<h2>Comparaison hebdo $country</h2>";
$html .= "<h3>Agrégat par technologie</h3>";
$html .= "<canvas id=\"techChart\" width=\"800\" height=\"300\"></canvas>";

$techLabels = [];
$recentData = [];
$prevData = [];
foreach ($techRows as $r) { $techLabels[] = $r[0]; $recentData[] = (float)$r[1]; $prevData[] = (float)$r[2]; }

$html .= "<h3>Top dégradés 4G (top $topN)</h3>";
$html .= "<table border=1 cellpadding=6><tr><th>site_id</th><th>recent_avg</th><th>prev_avg</th><th>delta</th></tr>";
foreach ($siteRows as $s) { $html .= "<tr><td>{$s[0]}</td><td>{$s[1]}</td><td>{$s[2]}</td><td>{$s[3]}</td></tr>"; }
$html .= "</table>";

$html .= "<h3>Tendance horaire (sites sélectionnés)</h3>";
$html .= "<div id=\"trend\">";
foreach ($siteList as $site) {
    $safe = preg_replace('/[^A-Za-z0-9_\-]/','_', $site);
    $html .= "<h4>$site</h4><canvas id=\"trend_$safe\" width=\"800\" height=\"200\"></canvas>";
}
$html .= "</div>";

$html .= "<script>\nconst labels = " . json_encode($techLabels) . ";\nconst recent = " . json_encode($recentData) . ";\nconst prev = " . json_encode($prevData) . ";\nconst ctx = document.getElementById('techChart').getContext('2d');\nnew Chart(ctx, {type:'bar', data:{labels:labels, datasets:[{label:'Période récente',data:recent,backgroundColor:'rgba(54,162,235,0.7)'},{label:'Période précédente',data:prev,backgroundColor:'rgba(255,159,64,0.7)'}]}});\n</script>";

// trend charts
$trendData = [];
foreach ($trendRows as $r) {
    $site = $r[0]; $ts = $r[1] . ' ' . str_pad($r[2],2,'0',STR_PAD_LEFT) . ':00:00';
    $trendData[$site][$ts] = (float)$r[3];
}

$html .= "<script>\n";
foreach ($siteList as $site) {
    $safe = preg_replace('/[^A-Za-z0-9_\-]/','_', $site);
    $series = $trendData[$site] ?? [];
    $labels = array_keys($series);
    $values = array_values($series);
    $html .= "const lbl_{$safe} = " . json_encode($labels) . ";\n";
    $html .= "const val_{$safe} = " . json_encode($values) . ";\n";
    $html .= "const ctx_{$safe} = document.getElementById('trend_{$safe}').getContext('2d');\n";
    $html .= "new Chart(ctx_{$safe},{type:'line',data:{labels:lbl_{$safe},datasets:[{label:'KPI global',data:val_{$safe},borderColor:'rgba(75,192,192,1)',fill:false}]},options:{scales:{x:{display:true,ticks:{maxRotation:90,minRotation:45}}}}});\n";
}
$html .= "</script>";

$html .= "</body></html>";
file_put_contents($htmlPath, $html);

echo "Rapport généré:\n";
echo " - CSV tech summary: $outDir/{$baseName}_tech_summary.csv\n";
echo " - CSV top degraded 4G: $outDir/{$baseName}_top_degraded_4g.csv\n";
echo " - CSV trend: $outDir/{$baseName}_trend_top_sites.csv\n";
echo " - CSV completeness: $outDir/{$baseName}_completeness_recent.csv\n";
echo " - HTML report: $htmlPath\n";

echo "Pour obtenir un PDF, ouvrez le fichier HTML dans un navigateur et imprimez en PDF.\n";

exit(0);
