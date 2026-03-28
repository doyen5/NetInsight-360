<?php
/**
 * NetInsight 360 — Export PDF
 *
 * Génère un rapport HTML complet puis le convertit en PDF
 * via la technique print-to-PDF (header Content-Disposition).
 * Sans lib externe : retourne un fichier HTML auto-imprimable
 * avec CSS @media print optimisé, accepté nativement par les navigateurs.
 *
 * Paramètres GET :
 *   type    = dashboard | ran | core | map | worst_sites (défaut: dashboard)
 *   domain  = RAN | CORE | all
 *   tech    = 2G | 3G | 4G | all
 *   country = CI | NE | BJ | TG | CF | all
 */

header('Access-Control-Allow-Origin: http://localhost:8080');
header('Access-Control-Allow-Credentials: true');

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo     = Database::getLocalConnection();
    $type    = $_GET['type']    ?? 'dashboard';
    $domain  = $_GET['domain']  ?? 'all';
    $tech    = $_GET['tech']    ?? 'all';
    $country = $_GET['country'] ?? 'all';
    $date    = date('d/m/Y H:i');
    $dateFile = date('Ymd_His');

    // ─── Récupération des données ─────────────────────────────────────────────

    // Statistiques globales
    $stmt = $pdo->query("SELECT COUNT(*) FROM sites");
    $totalSites = (int)$stmt->fetchColumn();

    $maxDate = $pdo->query("SELECT MAX(kpi_date) FROM kpis_ran")->fetchColumn() ?: date('Y-m-d');

    // Conditions de filtrage
    $conds  = ["k.kpi_date = '$maxDate'", "k.kpi_global > 0"];
    $params = [];
    if ($country !== 'all') { $conds[] = "s.country_code = ?"; $params[] = $country; }
    if ($domain  !== 'all') { $conds[] = "s.domain = ?";       $params[] = $domain;  }
    if ($tech    !== 'all') { $conds[] = "k.technology = ?";   $params[] = $tech;    }
    $where = implode(' AND ', $conds);

    // KPI moyen
    $st = $pdo->prepare("SELECT ROUND(AVG(k.kpi_global),2) FROM sites s INNER JOIN kpis_ran k ON k.site_id=s.id WHERE $where");
    $st->execute($params);
    $avgKpi = (float)($st->fetchColumn() ?: 0);

    // Sites critiques
    $stCrit = $pdo->prepare("SELECT COUNT(*) FROM sites s INNER JOIN kpis_ran k ON k.site_id=s.id WHERE $where AND k.kpi_global < 90");
    $stCrit->execute($params);
    $critical = (int)$stCrit->fetchColumn();

    // Répartition par statut
    $stDist = $pdo->prepare("
        SELECT
            SUM(CASE WHEN k.kpi_global >= 95                  THEN 1 ELSE 0 END) AS good,
            SUM(CASE WHEN k.kpi_global >= 90 AND k.kpi_global < 95 THEN 1 ELSE 0 END) AS warning,
            SUM(CASE WHEN k.kpi_global <  90                  THEN 1 ELSE 0 END) AS critical
        FROM sites s INNER JOIN kpis_ran k ON k.site_id = s.id
        WHERE $where
    ");
    $stDist->execute($params);
    $dist = $stDist->fetch(PDO::FETCH_ASSOC);

    // Répartition par technologie
    $stTech = $pdo->prepare("
        SELECT k.technology, COUNT(DISTINCT s.id) AS cnt
        FROM sites s INNER JOIN kpis_ran k ON k.site_id = s.id
        WHERE $where
        GROUP BY k.technology
        ORDER BY k.technology
    ");
    $stTech->execute($params);
    $techDist = $stTech->fetchAll(PDO::FETCH_ASSOC);

    // Top 20 pires sites
    $stWorst = $pdo->prepare("
        SELECT s.id, s.name, s.country_code, s.vendor,
               k.technology, k.kpi_global, k.worst_kpi_name, k.worst_kpi_value
        FROM sites s INNER JOIN kpis_ran k ON k.site_id = s.id
        WHERE $where
        ORDER BY k.kpi_global ASC
        LIMIT 20
    ");
    $stWorst->execute($params);
    $worst = $stWorst->fetchAll(PDO::FETCH_ASSOC);

    // Nom de pays
    $countries = [];
    foreach ($pdo->query("SELECT country_code, country_name FROM countries") as $r) {
        $countries[$r['country_code']] = $r['country_name'];
    }

    // ─── Génération HTML ──────────────────────────────────────────────────────

    // Barre de titre
    $filterLabel = '';
    if ($country !== 'all') $filterLabel .= ' — ' . ($countries[$country] ?? $country);
    if ($domain  !== 'all') $filterLabel .= ' — ' . $domain;
    if ($tech    !== 'all') $filterLabel .= ' — ' . $tech;

    // Tableau pires sites
    $rowsHtml = '';
    foreach ($worst as $i => $s) {
        $kpi = number_format($s['kpi_global'], 2);
        $statusClass = $s['kpi_global'] < 90 ? 'critical' : ($s['kpi_global'] < 95 ? 'warning' : 'good');
        $statusLabel = $s['kpi_global'] < 90 ? 'Critique' : ($s['kpi_global'] < 95 ? 'Alerte' : 'Bon');
        $worstKpi = $s['worst_kpi_name'] ? htmlspecialchars($s['worst_kpi_name']) . ' (' . number_format($s['worst_kpi_value'], 2) . '%)' : '—';
        $country_name = $countries[$s['country_code']] ?? $s['country_code'];
        $rowsHtml .= '<tr>
            <td>' . ($i + 1) . '</td>
            <td><strong>' . htmlspecialchars($s['id']) . '</strong></td>
            <td>' . htmlspecialchars($s['name']) . '</td>
            <td>' . htmlspecialchars($country_name) . '</td>
            <td><span class="badge">' . htmlspecialchars($s['technology']) . '</span></td>
            <td>' . htmlspecialchars($s['vendor']) . '</td>
            <td><strong>' . $kpi . '%</strong></td>
            <td class="status-' . $statusClass . '">' . $statusLabel . '</td>
            <td style="font-size:0.82em">' . $worstKpi . '</td>
        </tr>';
    }

    // Lignes répartition technologie
    $techRowsHtml = '';
    foreach ($techDist as $t) {
        $techRowsHtml .= '<tr><td>' . htmlspecialchars($t['technology']) . '</td><td>' . $t['cnt'] . '</td></tr>';
    }

    $good    = (int)($dist['good']    ?? 0);
    $warning = (int)($dist['warning'] ?? 0);
    $crit    = (int)($dist['critical'] ?? 0);

    // Bloc HTML technologie (pré-calculé pour éviter une expression dans heredoc)
    $techTableHtml = $techRowsHtml
        ? '<table><thead><tr><th>Technologie</th><th>Nombre de sites</th></tr></thead><tbody>' . $techRowsHtml . '</tbody></table>'
        : '<p style="color:#94a3b8;font-size:0.85em">Aucune donnée</p>';

    // Générer fichier
    $exportsDir = __DIR__ . '/../../data/exports';
    if (!is_dir($exportsDir)) mkdir($exportsDir, 0755, true);

    $filename = 'rapport_pdf_' . $dateFile . '.html';
    $filepath = $exportsDir . '/' . $filename;

    $html = <<<HTML
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport NetInsight 360 — {$date}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; background: #fff; }
  .page { max-width: 1050px; margin: 0 auto; padding: 20px 30px; }
  /* Header */
  .header { background: linear-gradient(135deg, #0c1a3d 0%, #00a3c4 100%); color: white; padding: 28px 32px; border-radius: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 1.6em; font-weight: 800; letter-spacing: -0.5px; }
  .header .subtitle { font-size: 0.85em; opacity: 0.85; margin-top: 4px; }
  .header .meta { text-align: right; font-size: 0.82em; opacity: 0.9; }
  /* KPI Cards */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
  .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; text-align: center; }
  .kpi-card .label { font-size: 0.78em; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .kpi-card .value { font-size: 1.9em; font-weight: 800; margin: 6px 0 2px; }
  .kpi-card .sublabel { font-size: 0.75em; color: #94a3b8; }
  .value-blue   { color: #00a3c4; }
  .value-green  { color: #10b981; }
  .value-yellow { color: #f59e0b; }
  .value-red    { color: #ef4444; }
  /* Distribution */
  .distrib-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px; }
  .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; }
  .stat-card h3 { font-size: 0.9em; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
  .dist-item { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #f1f5f9; }
  .dist-item:last-child { border-bottom: none; }
  .dist-label { font-size: 0.88em; }
  .dist-bar-wrap { display: flex; align-items: center; gap: 8px; }
  .dist-bar { height: 8px; border-radius: 4px; min-width: 4px; }
  .dist-count { font-weight: 700; font-size: 0.9em; min-width: 30px; text-align: right; }
  /* Table */
  .section-title { font-size: 1em; font-weight: 700; color: #1e293b; margin-bottom: 12px; padding: 10px 14px; background: #f1f5f9; border-radius: 8px; border-left: 4px solid #00a3c4; }
  table { width: 100%; border-collapse: collapse; font-size: 0.83em; }
  thead th { background: #0c1a3d; color: white; padding: 9px 10px; text-align: left; font-weight: 600; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  .badge { background: #e0e7ff; color: #4f46e5; padding: 2px 8px; border-radius: 20px; font-size: 0.82em; font-weight: 600; }
  .status-good     { color: #059669; font-weight: 600; }
  .status-warning  { color: #d97706; font-weight: 600; }
  .status-critical { color: #dc2626; font-weight: 600; }
  /* Footer */
  .footer { margin-top: 28px; text-align: center; font-size: 0.78em; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  /* Print */
  @media print {
    body { font-size: 9pt; }
    .page { padding: 10px 15px; }
    .header { padding: 18px 20px; }
    .no-print { display: none !important; }
    table { font-size: 7.5pt; }
    thead th { font-size: 7.5pt; padding: 6px 7px; }
    tbody td  { padding: 5px 7px; }
    .kpi-card .value { font-size: 1.5em; }
    @page { margin: 15mm; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Bouton impression (masqué à l'impression) -->
  <div class="no-print" style="text-align:right; margin-bottom:12px;">
    <button onclick="window.print()" style="background:#00a3c4;color:#fff;border:none;padding:10px 22px;border-radius:8px;font-size:0.9em;font-weight:600;cursor:pointer;">
      🖨️ Imprimer / Enregistrer en PDF
    </button>
  </div>

  <!-- Header -->
  <div class="header">
    <div>
      <div style="font-size:0.75em;opacity:0.7;margin-bottom:4px;">📡 RAPPORT D'ANALYSE RÉSEAU</div>
      <h1>NetInsight 360{$filterLabel}</h1>
      <div class="subtitle">Supervisez. Analysez. Optimisez.</div>
    </div>
    <div class="meta">
      <div style="font-size:1em;font-weight:700">{$date}</div>
      <div>Données au : {$maxDate}</div>
      <div style="margin-top:6px;background:rgba(255,255,255,0.15);padding:4px 10px;border-radius:20px;">Confidentiel</div>
    </div>
  </div>

  <!-- KPI Cards -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="label">Sites supervisés</div>
      <div class="value value-blue">{$totalSites}</div>
      <div class="sublabel">Total du réseau</div>
    </div>
    <div class="kpi-card">
      <div class="label">KPI Global moyen</div>
      <div class="value value-green">{$avgKpi}%</div>
      <div class="sublabel">Objectif ≥ 99.5%</div>
    </div>
    <div class="kpi-card">
      <div class="label">Sites bons</div>
      <div class="value value-green">{$good}</div>
      <div class="sublabel">KPI ≥ 95%</div>
    </div>
    <div class="kpi-card">
      <div class="label">Sites critiques</div>
      <div class="value value-red">{$critical}</div>
      <div class="sublabel">KPI &lt; 90%</div>
    </div>
  </div>

  <!-- Distribution -->
  <div class="distrib-grid">
    <div class="stat-card">
      <h3>📊 Répartition par statut</h3>
      <div class="dist-item">
        <span class="dist-label" style="color:#059669">✅ Bon (≥ 95%)</span>
        <div class="dist-bar-wrap"><div class="dist-bar" style="width:60px;background:#10b981"></div><span class="dist-count">{$good}</span></div>
      </div>
      <div class="dist-item">
        <span class="dist-label" style="color:#d97706">⚠️ Alerte (90-95%)</span>
        <div class="dist-bar-wrap"><div class="dist-bar" style="width:40px;background:#f59e0b"></div><span class="dist-count">{$warning}</span></div>
      </div>
      <div class="dist-item">
        <span class="dist-label" style="color:#dc2626">🔴 Critique (< 90%)</span>
        <div class="dist-bar-wrap"><div class="dist-bar" style="width:50px;background:#ef4444"></div><span class="dist-count">{$crit}</span></div>
      </div>
    </div>
    <div class="stat-card">
      <h3>📶 Répartition par technologie</h3>
      {$techTableHtml}
    </div>
  </div>

  <!-- Table pires sites -->
  <div class="section-title">⚠️ Top 20 — Pires sites du réseau</div>
  <table>
    <thead>
      <tr><th>#</th><th>Site ID</th><th>Nom du site</th><th>Pays</th><th>Techno</th><th>Vendor</th><th>KPI Global</th><th>Statut</th><th>KPI Dégradant</th></tr>
    </thead>
    <tbody>
      {$rowsHtml}
    </tbody>
  </table>

  <div class="footer">
    Rapport généré automatiquement par NetInsight 360 le {$date} — Données confidentielles, usage interne uniquement
  </div>
</div>
<script>
  // Auto-print si paramètre ?autoprint=1
  if (new URLSearchParams(window.location.search).get('autoprint') === '1') {
    window.addEventListener('load', () => setTimeout(() => window.print(), 500));
  }
</script>
</body>
</html>
HTML;

    file_put_contents($filepath, $html);
    $url = '/NetInsight%20360/netinsight360-backend/data/exports/' . $filename;

    // Retourner JSON avec URL
require_once __DIR__ . '/../cors.php';

    echo json_encode(['success' => true, 'url' => $url, 'filename' => $filename]);

} catch (Exception $e) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
