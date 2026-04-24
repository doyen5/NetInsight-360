<?php
/**
 * NetInsight 360 - API: Marqueurs de la carte
 *
 * Depuis la correction du script d'import, les coordonnées sont
 * directement dans sites.latitude / sites.longitude (source : sites_database
 * sur le serveur distant).
 *
 * Pour chaque site, on renvoie :
 *  - les meilleures coordonnées disponibles (sites d'abord, fallback site_mapping)
 *  - le kpi_global et status du jour (kpis_ran) ou la valeur stockée dans sites
 *  - le KPI dégradant (worst_kpi_name) pour l'affichage dans les popups
 *  - la technologie pour colorer / filtrer par techno (option A)
 *
 * Filtre HAVING : exclut les sites sans coordonnées valides (lat=0 ou lng=0)
 */

require_once __DIR__ . '/../cors.php';

require_once __DIR__ . '/../auth/require-auth.php';
require_once __DIR__ . '/../../config/database.php';

try {
    $pdo = Database::getLocalConnection();

    // --- Filtres ---
    $country = $_GET['country'] ?? 'all';
    $vendor  = $_GET['vendor']  ?? 'all';
    $tech    = $_GET['tech']    ?? 'all';
    $domain  = $_GET['domain']  ?? 'all';
    $status  = $_GET['status']  ?? 'all';
    $limit   = isset($_GET['limit']) ? (int)$_GET['limit'] : 1200;
    if ($limit < 100) $limit = 100;
    if ($limit > 5000) $limit = 5000;
    // Mode de scoring: fixed (seuils métiers statiques) ou dynamic (baseline pays+tech)
    $scoreMode = strtolower(trim((string)($_GET['score_mode'] ?? 'fixed')));
    if (!in_array($scoreMode, ['fixed', 'dynamic'], true)) {
        $scoreMode = 'fixed';
    }

    // --- Requête principale ---
    // LEFT JOIN kpis_ran sur la dernière date disponible (pas forcément aujourd'hui)
    // Statut calculé dynamiquement d'après kpi_global pour être cohérent avec les stats
    $sql = "SELECT
                s.id,
                s.name,
                s.country_code,
                COALESCE(c.country_name, s.country_code)                 AS country_name,
                s.vendor,
                COALESCE(k.technology, s.technology, 'N/A')              AS technology,
                s.domain,
                COALESCE(NULLIF(s.latitude, 0), NULLIF(sm.latitude, 0))  AS latitude,
                COALESCE(NULLIF(s.longitude, 0), NULLIF(sm.longitude, 0)) AS longitude,
                COALESCE(k.kpi_global, s.kpi_global, 0)                  AS kpi_global,
                CASE
                    WHEN COALESCE(k.kpi_global, s.kpi_global, 0) >= 95 THEN 'good'
                    WHEN COALESCE(k.kpi_global, s.kpi_global, 0) >= 90 THEN 'warning'
                    ELSE 'critical'
                END                                                       AS status,
                k.worst_kpi_name,
                k.worst_kpi_value
            FROM sites s
            LEFT JOIN (
                SELECT k1.*
                FROM kpis_ran k1
                INNER JOIN (SELECT site_id, technology, MAX(kpi_date) AS max_date FROM kpis_ran GROUP BY site_id, technology) k2
                    ON k1.site_id = k2.site_id AND k1.technology = k2.technology AND k1.kpi_date = k2.max_date
            ) k ON k.site_id = s.id
            LEFT JOIN site_mapping sm ON sm.remote_id = s.id
            LEFT JOIN countries c ON c.country_code = s.country_code AND c.is_active = 1
            WHERE 1=1";

    $params = [];
    if ($country !== 'all') { $sql .= " AND s.country_code = ?"; $params[] = $country; }
    if ($vendor  !== 'all') { $sql .= " AND s.vendor = ?";       $params[] = $vendor;  }
    if ($tech    !== 'all') { $sql .= " AND k.technology = ?";   $params[] = $tech;    }
    if ($domain  !== 'all') { $sql .= " AND s.domain = ?";       $params[] = $domain;  }
    // Exclure les sites sans coordonnées valides
    // Exclut les coordonnées nulles/zéro et hors des limites de l'Afrique
    $sql .= " HAVING latitude IS NOT NULL AND latitude != 0 AND longitude != 0"
          . " AND latitude BETWEEN -5.0 AND 25.0"
          . " AND longitude BETWEEN -18.0 AND 30.0";
    // Limite configurable: plus basse par défaut pour réduire la latence perçue.
    $sql .= " ORDER BY kpi_global ASC LIMIT $limit";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $sites = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // --- Option: limiter à 20 sites par technologie pour éviter la surcharge de la carte ---
    // Par défaut on retourne tous les marqueurs (comportement historique). La limitation
    // par techno est active uniquement si `top_by_tech=1` est passée en paramètre.
    $totalBeforeLimit = count($sites); // total AVANT toute limitation (pour le badge frontend)
    $limited = false;
    $topByTech = ($_GET['top_by_tech'] ?? '0') === '1';
    if ($topByTech) {
        $limitPerTech = 20;
        $byTech = [];
        foreach ($sites as $site) {
            $t = $site['technology'] ?? 'N/A';
            if (!isset($byTech[$t])) $byTech[$t] = [];
            if (count($byTech[$t]) < $limitPerTech) {
                $byTech[$t][] = $site;
            }
        }
        $sites = array_merge(...array_values($byTech));
        $limited = true;
    }

    foreach ($sites as &$site) {
        $site['latitude']       = floatval($site['latitude']);
        $site['longitude']      = floatval($site['longitude']);
        $site['kpi_global']     = round(floatval($site['kpi_global']), 2);
        $site['worst_kpi_name'] = $site['worst_kpi_name']  ?? null;
        $site['worst_kpi_value']= isset($site['worst_kpi_value']) ? round(floatval($site['worst_kpi_value']), 2) : null;

        // PHASE 1 — Score santé unifié (0..100) et recommandation de base.
        // On réutilise kpi_global comme base de health_score pour garder
        // une lecture métier cohérente entre dashboard et cartographie.
        $site['health_score'] = round(max(0, min(100, floatval($site['kpi_global']))), 2);
        $site['risk_fixed'] = $site['status'];

        // Recommandation opérationnelle par KPI dégradant principal.
        $wk = strtolower(trim((string)($site['worst_kpi_name'] ?? '')));
        if ($wk === '') {
            $site['recommendation'] = 'Surveiller le site et confirmer la stabilité sur les prochains cycles de mesure.';
        } elseif (strpos($wk, 'drop') !== false || strpos($wk, 'chute') !== false) {
            $site['recommendation'] = 'Prioriser la réduction des coupures: vérifier handovers, couverture radio et congestion locale.';
        } elseif (strpos($wk, 'avail') !== false || strpos($wk, 'disponibil') !== false) {
            $site['recommendation'] = 'Vérifier la disponibilité équipements/liaisons, incidents énergie et maintenance préventive.';
        } elseif (strpos($wk, 'cssr') !== false || strpos($wk, 'rrc') !== false || strpos($wk, 'rab') !== false) {
            $site['recommendation'] = 'Analyser la signalisation et l’admission: optimiser setup, capacité et paramètres radio.';
        } elseif (strpos($wk, 'cong') !== false || strpos($wk, 'prb') !== false) {
            $site['recommendation'] = 'Traiter la congestion: équilibrage de charge, capacité additionnelle et optimisation traffic steering.';
        } else {
            $site['recommendation'] = 'Contrôler les KPIs dégradés et planifier une action ciblée sur la zone impactée.';
        }
    }
    unset($site);

    // PHASE 2 — Seuils dynamiques par pays+technologie (baseline locale)
    // On évite ce calcul coûteux quand le mode fixe est demandé.
    $groupStats = [];
    if ($scoreMode === 'dynamic') {
        $groupBuckets = [];
        foreach ($sites as $s) {
            $kpi = floatval($s['kpi_global'] ?? 0);
            if ($kpi <= 0) continue;
            $groupKey = ($s['country_code'] ?? 'NA') . '|' . ($s['technology'] ?? 'NA');
            if (!isset($groupBuckets[$groupKey])) $groupBuckets[$groupKey] = [];
            $groupBuckets[$groupKey][] = $kpi;
        }

        foreach ($groupBuckets as $groupKey => $vals) {
            $n = count($vals);
            if ($n === 0) continue;
            $avg = array_sum($vals) / $n;
            $var = 0.0;
            foreach ($vals as $v) {
                $d = $v - $avg;
                $var += $d * $d;
            }
            $std = $n > 1 ? sqrt($var / ($n - 1)) : 0.0;

            // Seuils dynamiques bornés pour éviter les extrêmes visuels.
            $warn = max(85.0, min(98.5, $avg - max(0.6, 1.0 * $std)));
            $crit = max(75.0, min(95.0, $avg - max(1.2, 2.0 * $std)));
            if ($crit >= $warn) {
                $crit = max(75.0, $warn - 2.0);
            }

            $groupStats[$groupKey] = [
                'count' => $n,
                'avg' => round($avg, 2),
                'std' => round($std, 3),
                'warn_threshold' => round($warn, 2),
                'crit_threshold' => round($crit, 2),
            ];
        }
    }

    foreach ($sites as &$site) {
        $groupKey = ($site['country_code'] ?? 'NA') . '|' . ($site['technology'] ?? 'NA');
        $kpi = floatval($site['kpi_global'] ?? 0);
        $gs = $groupStats[$groupKey] ?? null;

        if ($gs && ($gs['count'] ?? 0) >= 5) {
            $warn = floatval($gs['warn_threshold']);
            $crit = floatval($gs['crit_threshold']);
            if ($kpi >= $warn) {
                $riskDyn = 'good';
            } elseif ($kpi >= $crit) {
                $riskDyn = 'warning';
            } else {
                $riskDyn = 'critical';
            }

            $std = floatval($gs['std']);
            $z = $std > 0 ? round(($kpi - floatval($gs['avg'])) / $std, 2) : 0.0;
            $site['risk_dynamic'] = $riskDyn;
            $site['z_score'] = $z;
            $site['dynamic_baseline'] = [
                'avg' => floatval($gs['avg']),
                'std' => $std,
                'warn_threshold' => $warn,
                'crit_threshold' => $crit,
                'sample_size' => intval($gs['count']),
            ];
        } else {
            // Fallback automatique si échantillon insuffisant.
            $site['risk_dynamic'] = $site['risk_fixed'];
            $site['z_score'] = 0.0;
            $site['dynamic_baseline'] = null;
        }

        // Niveau de risque utilisé par le front selon le mode choisi.
        $site['risk_level'] = ($scoreMode === 'dynamic') ? $site['risk_dynamic'] : $site['risk_fixed'];
    }
    unset($site);

    // Filtre statut final appliqué sur le niveau actif (fixed/dynamic)
    $validStatuses = ['good', 'warning', 'critical'];
    if ($status !== 'all' && in_array($status, $validStatuses, true)) {
        $sites = array_values(array_filter($sites, function ($s) use ($status) {
            return ($s['risk_level'] ?? '') === $status;
        }));
    }

    echo json_encode([
        'success'            => true,
        'data'               => $sites,
        'count'              => count($sites),
        'total_count'        => $totalBeforeLimit,
        'score_mode'         => $scoreMode,
        'dynamic_groups'     => $groupStats,
        'limit_per_tech'     => $topByTech ? $limitPerTech : null,
        'limited_by_top_by_tech' => $limited,
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
