<?php
/**
 * NetInsight 360 - CRON : Agrégation quotidienne des KPIs dans kpi_daily_history
 *
 * À exécuter après l'import RAN (ex: 02h30 chaque jour).
 * Calcule la moyenne de chaque KPI par (date, technologie, pays)
 * et l'insère dans kpi_daily_history pour alimenter les graphiques de tendance.
 *
 * Exécution : php daily-kpi-aggregate.php [YYYY-MM-DD]  (défaut: hier)
 */

require_once dirname(__DIR__, 2) . '/config/database.php';

$targetDate = $argv[1] ?? date('Y-m-d', strtotime('-1 day'));
echo "[" . date('Y-m-d H:i:s') . "] Agrégation KPIs pour $targetDate\n";

try {
    $pdo = Database::getLocalConnection();

    // Supprime les entrées existantes pour cette date (idempotent)
    $pdo->prepare("DELETE FROM kpi_daily_history WHERE recorded_date = ?")->execute([$targetDate]);

    $kpiColumns = [
        '2G' => ['RNA', 'TCH_Availability', 'CSSR', 'CDR_TCH', 'SDCCH_SR', 'SDCCH_Drop'],
        '3G' => ['RRC_SR', 'ERAB_SR', 'HO_SR', 'UL_BLER', 'DL_BLER'],
        '4G' => ['RRC_SR', 'ERAB_SR', 'HO_SR', 'UL_BLER', 'DL_BLER', 'VoLTE_SR'],
    ];

    $inserted = 0;
    foreach ($kpiColumns as $tech => $columns) {
        foreach ($columns as $col) {
            // Validation par whitelist — $col vient d'un tableau statique mais on s'assure
            // qu'il ne contient que des caractères alphanumériques et underscores
            if (!preg_match('/^[A-Za-z0-9_]+$/', $col)) {
                continue;
            }
            $stmt = $pdo->prepare("
                INSERT INTO kpi_daily_history (kpi_name, technology, country_code, kpi_value, recorded_date)
                SELECT ?, k.technology, s.country_code, ROUND(AVG(`$col`), 4), ?
                FROM kpis_ran k
                INNER JOIN sites s ON s.id = k.site_id
                WHERE k.technology = ? AND k.kpi_date = ? AND `$col` IS NOT NULL
                GROUP BY k.technology, s.country_code
            ");
            $stmt->execute([$col, $targetDate, $tech, $targetDate]);
            $inserted += $stmt->rowCount();
        }
    }

    echo "[" . date('Y-m-d H:i:s') . "] $inserted entrées insérées dans kpi_daily_history\n";

} catch (Exception $e) {
    echo "[ERROR] " . $e->getMessage() . "\n";
    exit(1);
}
