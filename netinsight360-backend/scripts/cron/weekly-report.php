<?php
/**
 * NetInsight 360 - CRON : Rapport hebdomadaire par email
 *
 * Envoie chaque lundi matin le bilan de la semaine écoulée aux ADMINs.
 * Contenu : nb alertes créées, résolues, pires sites, tendance RNA.
 *
 * Exécution : php weekly-report.php
 */

require_once dirname(__DIR__, 2) . '/config/database.php';
require_once dirname(__DIR__, 2) . '/app/helpers/MailHelper.php';

echo "[" . date('Y-m-d H:i:s') . "] Génération rapport hebdomadaire\n";

try {
    $pdo  = Database::getLocalConnection();
    $week = date('W');
    $from = date('Y-m-d', strtotime('last monday', strtotime('+1 day')));
    $to   = date('Y-m-d');

    // Stats alertes
    $alertsStmt = $pdo->prepare("
        SELECT
            COUNT(*)                                          AS total,
            SUM(CASE WHEN severity = 'critical' THEN 1 END)  AS critical,
            SUM(CASE WHEN status   = 'resolved' THEN 1 END)  AS resolved
        FROM alerts
        WHERE created_at BETWEEN ? AND ?
    ");
    $alertsStmt->execute([$from . ' 00:00:00', $to . ' 23:59:59']);
    $alerts = $alertsStmt->fetch(PDO::FETCH_ASSOC);

    // Top 5 pires sites
    $worstStmt = $pdo->prepare("
        SELECT s.name, s.vendor, k.technology, ROUND(k.kpi_global, 2) AS kpi_global
        FROM kpis_ran k
        INNER JOIN sites s ON s.id = k.site_id
        WHERE k.kpi_date = (SELECT MAX(kpi_date) FROM kpis_ran)
        ORDER BY k.kpi_global ASC LIMIT 5
    ");
    $worstStmt->execute();
    $worst = $worstStmt->fetchAll(PDO::FETCH_ASSOC);

    // Construction du HTML
    $worstRows = '';
    foreach ($worst as $s) {
        $worstRows .= "<tr><td>{$s['name']}</td><td>{$s['vendor']}</td><td>{$s['technology']}</td><td style='color:red'>{$s['kpi_global']}%</td></tr>";
    }

    $subject = "[NetInsight 360] Rapport Semaine $week";
    $html = "
    <h2>NetInsight 360 - Rapport Semaine $week ($from au $to)</h2>
    <h3>Alertes</h3>
    <ul>
      <li>Total créées : <strong>{$alerts['total']}</strong></li>
      <li>Critiques : <strong>{$alerts['critical']}</strong></li>
      <li>Résolues : <strong>{$alerts['resolved']}</strong></li>
    </ul>
    <h3>Top 5 pires sites (dernière date)</h3>
    <table border=\"1\" cellpadding=\"6\">
      <tr><th>Site</th><th>Vendor</th><th>Techno</th><th>KPI Global</th></tr>
      $worstRows
    </table>
    ";

    // Récupérer les emails ADMINs
    $admins = $pdo->query("
        SELECT email, full_name FROM users
        WHERE role = 'ADMIN' AND status = 'active'
    ")->fetchAll(PDO::FETCH_ASSOC);

    $mailCfg = require dirname(__DIR__, 2) . '/config/mail.php';
    $mailer  = new MailHelper($mailCfg);

    foreach ($admins as $admin) {
        $mailer->send($admin['email'], $subject, $html);
        echo "  Email envoyé à {$admin['email']}\n";
    }

    echo "[" . date('Y-m-d H:i:s') . "] Rapport envoyé à " . count($admins) . " admin(s)\n";

} catch (Exception $e) {
    echo "[ERROR] " . $e->getMessage() . "\n";
    exit(1);
}
