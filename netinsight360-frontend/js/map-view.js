/**
 * NetInsight 360 - Cartographie
 * Supervisez. Analysez. Optimisez.
 * 
 * Page de visualisation cartographique des sites réseau
 */
/**
 * Modifications apportées:
 * - Le code frontend ignore désormais les sites sans coordonnées valides
 *   (latitude/longitude nulles ou égales à 0) pour éviter d'afficher
 *   des marqueurs génériques à (0,0).
 * - Les markers utilisent des valeurs numériques explicites (Number(site.latitude)).
 */

let fullMap = null;
let fullMarkers = [];
let fullClusterLayer = null;
let fullSitesData = []; // cache des marqueurs carte (20 pires/tech)
let fullTableData = []; // cache du tableau (tous les sites filtrés, triés par criticité)
let fullFilters = { country: 'all', vendor: 'all', tech: 'all', domain: 'all', status: 'all', score_mode: 'fixed' };
let fullCountryBorderLayer = null; // Couche Leaflet GeoJSON des frontières du pays sélectionné
let fullCurrentPage = 1;
let fullItemsPerPage = 10;

/**
 * Mode d'affichage actif sur la carte de cartographie.
 * Valeurs possibles : 'cluster' | 'individual' | 'heatmap'
 */
let currentFullDisplayMode = 'cluster';

/** Instance du gestionnaire de modes (initialisée dans initFullMap) */
let fullMapModeManager = null;

function getSiteRiskLevel(site) {
    return site?.risk_level || site?.status || 'good';
}

function getRiskColor(site) {
    if (site?.domain === 'CORE') return API.COLORS.tech['CORE'];
    const risk = getSiteRiskLevel(site);
    if (risk === 'critical') return API.COLORS.status.bad;
    if (risk === 'warning') return API.COLORS.status.warning;
    return API.COLORS.status.good;
}

function getRiskLabel(risk) {
    if (risk === 'critical') return 'Critique';
    if (risk === 'warning') return 'Alerte';
    return 'Bon';
}

function updateLegendModeHint(scoreMode = 'fixed') {
    const hint = document.getElementById('legendModeHint');
    if (!hint) return;

    // PHASE 2: le mode dynamique colore selon baseline pays+tech (et non seuils statiques).
    hint.innerHTML = scoreMode === 'dynamic'
        ? '<span class="legend-color" style="background: linear-gradient(135deg,#0ea5e9,#ef4444);"></span><span>Mode dynamique (baseline pays + techno)</span>'
        : '<span class="legend-color" style="background: linear-gradient(135deg,#10b981,#ef4444);"></span><span>Mode fixe (seuils métier)</span>';
}

function buildClusterRecommendation(clusterSites) {
    // PHASE 3: recommandation automatique pilotée par sévérité + KPI dégradant dominant.
    if (!clusterSites || clusterSites.length === 0) {
        return 'Aucune recommandation (cluster vide).';
    }

    const total = clusterSites.length;
    const criticalCount = clusterSites.filter(s => getSiteRiskLevel(s) === 'critical').length;
    const criticalRatio = total > 0 ? (criticalCount / total) : 0;

    const kpiCounter = new Map();
    clusterSites.forEach(s => {
        const wk = (s.worst_kpi_name || '').trim();
        if (!wk) return;
        kpiCounter.set(wk, (kpiCounter.get(wk) || 0) + 1);
    });
    const topKpi = Array.from(kpiCounter.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    if (criticalRatio >= 0.35) {
        return topKpi
            ? `Priorité immédiate: ouvrir un plan d'action cluster sur ${topKpi} et traiter les sites critiques en premier.`
            : 'Priorité immédiate: traiter les sites critiques du cluster et vérifier capacité/couverture.';
    }
    if (criticalRatio >= 0.15) {
        return topKpi
            ? `Action préventive: surveiller ${topKpi}, corriger les sites en alerte avant bascule en critique.`
            : 'Action préventive: stabiliser les sites en alerte et suivre les prochaines mesures.';
    }
    return 'Cluster globalement stable: maintenir la surveillance et confirmer la tendance sur 24h.';
}

function buildClusterLayer() {
    if (!fullMap) return null;

    return L.markerClusterGroup({
        maxClusterRadius: 55,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        // PHASE 1 + 2: l'icône de cluster reflète volume + état KPI agrégé.
        iconCreateFunction: (cluster) => {
            const children = cluster.getAllChildMarkers().map(m => m.options?.siteData).filter(Boolean);
            const count = children.length;
            const critical = children.filter(s => getSiteRiskLevel(s) === 'critical').length;
            const warning = children.filter(s => getSiteRiskLevel(s) === 'warning').length;
            const good = Math.max(0, count - critical - warning);

            let dominantRisk = 'good';
            if (critical >= Math.max(1, Math.ceil(count * 0.25))) {
                dominantRisk = 'critical';
            } else if ((critical + warning) >= Math.max(1, Math.ceil(count * 0.35))) {
                dominantRisk = 'warning';
            }

            const avgHealth = count > 0
                ? (children.reduce((acc, s) => acc + Number(s.health_score || s.kpi_global || 0), 0) / count)
                : 0;

            const bgColor = dominantRisk === 'critical'
                ? API.COLORS.status.bad
                : (dominantRisk === 'warning' ? API.COLORS.status.warning : API.COLORS.status.good);

            const sizeClass = count < 20 ? 'small' : (count < 80 ? 'medium' : 'large');
            const html = `
                <div class="cluster-bubble cluster-${dominantRisk} cluster-${sizeClass}" style="background:${bgColor}">
                    <span class="cluster-count">${count}</span>
                    <span class="cluster-kpi">${avgHealth.toFixed(0)}%</span>
                </div>
            `;

            return L.divIcon({
                html,
                className: 'custom-kpi-cluster',
                iconSize: [44, 44]
            });
        }
    });
}

/**
 * Initialise la page de cartographie
 */
async function initMapView() {
    const isAuth = await checkAuthentication();
    if (!isAuth) return;
    
    await updateUserInterface();
    initFullMap();

    // Chargement parallèle : carte + tableau (sources distinctes)
    await Promise.all([
        loadFullMapMarkers(),
        loadFullSitesTable(),
    ]);
    await loadFullCharts();

    initFullFilters();
    initFullSearch();
    initFullReports();
}

/**
 * Initialise la carte
 * Vue par défaut: Afrique entière (latitude 37 au nord, -35 au sud, longitude -17 à l'ouest, 55 à l'est)
 */
function initFullMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    // Créer la carte sans position initiale fixe
    fullMap = L.map('map');
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(fullMap);
    
    // Afficher l'Afrique entière au chargement: bounds [[lat_nord, lon_ouest], [lat_sud, lon_est]]
    // Latitude: de 37° (Tunisie nord) à -35° (Afrique du Sud)
    // Longitude: de -17° (Mauritanie ouest) à 55° (Somalie est)
    const africaBounds = L.latLngBounds([[37, -17], [-35, 55]]);
    fullMap.fitBounds(africaBounds, { padding: [30, 30] });

    // Initialiser le gestionnaire des modes d'affichage.
    // La fonction getHealth retourne le score de santé (0-100) d'un site.
    // On préfère health_score (mode dynamique) sinon kpi_global (mode fixe).
    fullMapModeManager = new MapModeManager(
        fullMap,
        (s) => Number(s.health_score || s.kpi_global || 0)
    );
}

/**
 * Charge les marqueurs sur la carte (appel API + rendu selon le mode actif).
 * Stocke les données dans fullSitesData pour permettre le changement de mode
 * sans re-fetcher depuis l'API.
 */
async function loadFullMapMarkers() {
    if (!fullMap) return;

    // ── Nettoyage complet avant redraw ──────────────────────────────────────
    // 1. Supprimer le cluster si actif
    if (fullClusterLayer) { fullMap.removeLayer(fullClusterLayer); fullClusterLayer = null; }
    // 2. Supprimer les marqueurs individuels précédents
    fullMarkers.forEach(marker => { try { fullMap.removeLayer(marker); } catch (_) {} });
    fullMarkers = [];
    // 3. Supprimer la heatmap gérée par le manager
    if (fullMapModeManager) fullMapModeManager.clearManagedLayers();
    
    try {
        // Si une option "Top by Tech" existe sur la page, transmettre le flag
        const queryFilters = { ...fullFilters };
        try {
            const topCb = document.getElementById('topByTechCheckbox');
            if (topCb && topCb.checked) queryFilters.top_by_tech = '1';
        } catch (e) { /* ignore */ }

        const result = await API.getMapMarkers(queryFilters);
        if (!result.success || !result.data) return;

        updateLegendModeHint(result.score_mode || fullFilters.score_mode || 'fixed');
        
        const sites = result.data;
        // Mise en cache des données pour permettre le changement de mode
        // sans recharger depuis l'API (voir switchFullDisplayMode)
        fullSitesData = sites;

        // Afficher les frontières GeoJSON du pays sélectionné et zoomer dessus
        await showFullCountryBorder(fullFilters.country);

        // Déléguer le rendu à la fonction de mode
        await renderFullMapMode(sites);

        updateLegendStats(sites);
        API.updateMapCountBadge(result);
    } catch (error) {
        console.error('[MapView] Erreur chargement marqueurs:', error);
    }
}

/**
 * Change le mode d'affichage de la carte SANS recharger depuis l'API.
 * Utilise le cache fullSitesData pour re-rendre instantanément.
 *
 * Appelé par le <select id="mapDisplayMode"> dans map-view.php.
 * @param {string} mode - 'cluster' | 'individual' | 'heatmap'
 */
async function switchFullDisplayMode(mode) {
    currentFullDisplayMode = mode;

    // Nettoyer toutes les couches actives
    if (fullClusterLayer) { fullMap.removeLayer(fullClusterLayer); fullClusterLayer = null; }
    fullMarkers.forEach(m => { try { fullMap.removeLayer(m); } catch (_) {} });
    fullMarkers = [];
    if (fullMapModeManager) fullMapModeManager.clearManagedLayers();

    if (fullSitesData && fullSitesData.length > 0) {
        // Données déjà en cache : re-rendre immédiatement
        await renderFullMapMode(fullSitesData);
    } else {
        // Pas encore de données : déclencher un chargement complet
        await loadFullMapMarkers();
    }
}

/**
 * Rend les sites sur la carte selon currentFullDisplayMode.
 * Cette fonction est le point central du système de modes :
 * elle dispatche vers le bon rendu sans re-fetcher les données.
 *
 * @param {Array} sites - Sites à afficher (depuis fullSitesData)
 */
async function renderFullMapMode(sites) {
    const mode = currentFullDisplayMode;

    // ── Mode 1 : Clusters (défaut) ───────────────────────────────────────────
    // Regroupement intelligent avec icône colorée par dominance KPI du groupe.
    if (mode === 'cluster') {
        fullClusterLayer = buildClusterLayer();
        if (fullClusterLayer) fullMap.addLayer(fullClusterLayer);

        sites.forEach(site => {
            const lat = Number(site.latitude);
            const lng = Number(site.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return;

            const color     = getRiskColor(site);
            const riskLevel = getSiteRiskLevel(site);
            const riskLabel = getRiskLabel(riskLevel);

            // Icône compacte 6px — les clusters regroupent visuellement les sites proches
            const icon = L.divIcon({
                html: `<div style="background:${color}; width:6px; height:6px; ${site.domain === 'CORE' ? 'border-radius:1px; transform:rotate(45deg);' : 'border-radius:50%;'} border:1px solid white;"></div>`,
                iconSize: [6, 6]
            });
            
            const marker = L.marker([lat, lng], { icon, siteData: site });
            // Afficher technologie + KPI dégradant dans le popup
            const worstLine = site.worst_kpi_name
                ? `<b>KPI dégradant:</b> ${site.worst_kpi_name} = ${site.worst_kpi_value}%<br>`
                : '';
            const baselineLine = site.dynamic_baseline
                ? `<b>Seuils dynamiques:</b> Alerte ${site.dynamic_baseline.warn_threshold}% | Critique ${site.dynamic_baseline.crit_threshold}%<br>`
                : '';
            marker.bindPopup(`
                <b>${site.name}</b> <span style="font-size:0.8em;background:#e0e7ff;padding:1px 5px;border-radius:4px">${site.technology}</span><br>
                <b>Pays:</b> ${site.country_name}<br>
                <b>Vendor:</b> <span style="width:9px;height:9px;border-radius:50%;background:${API.vendorColor(site.vendor)};display:inline-block;margin-right:3px;vertical-align:middle"></span>${site.vendor}<br>
                <b>KPI Global:</b> ${site.kpi_global}%<br>
                <b>Score santé:</b> ${Number(site.health_score || site.kpi_global || 0).toFixed(2)}%<br>
                <b>Niveau:</b> <span style="color:${color};font-weight:700">${riskLabel}</span><br>
                ${baselineLine}
                ${worstLine}
                <b>Action:</b> ${site.recommendation || 'Suivi standard'}<br>
                <button class="btn btn-sm btn-primary mt-2" onclick="showFullSiteDetails('${site.id}')">Voir détails</button>
            `);

            if (fullClusterLayer) {
                fullClusterLayer.addLayer(marker);
            } else {
                marker.addTo(fullMap);
            }
            fullMarkers.push(marker);
        });

        // Sur clic cluster: affichage d'un résumé KPI + recommandation dynamique.
        if (fullClusterLayer) {
            fullClusterLayer.on('clusterclick', (e) => {
                const clusterSites = e.layer.getAllChildMarkers().map(m => m.options?.siteData).filter(Boolean);
                const total = clusterSites.length;
                const critical = clusterSites.filter(s => getSiteRiskLevel(s) === 'critical').length;
                const warning = clusterSites.filter(s => getSiteRiskLevel(s) === 'warning').length;
                const good = Math.max(0, total - critical - warning);
                const avgHealth = total > 0
                    ? (clusterSites.reduce((acc, s) => acc + Number(s.health_score || s.kpi_global || 0), 0) / total)
                    : 0;
                const recommendation = buildClusterRecommendation(clusterSites);

                const html = `
                    <div style="min-width:260px">
                        <div style="font-weight:700;margin-bottom:6px">Cluster KPI</div>
                        <div><b>Sites:</b> ${total}</div>
                        <div><b>Score moyen:</b> ${avgHealth.toFixed(2)}%</div>
                        <div><b>Bon:</b> ${good} | <b>Alerte:</b> ${warning} | <b>Critique:</b> ${critical}</div>
                        <div style="margin-top:8px"><b>Reco:</b> ${recommendation}</div>
                    </div>
                `;
                e.layer.bindPopup(html).openPopup();
            });
        }

    } // ─── fin mode cluster ───────────────────────────────────────────────────

    // ── Mode 2 : Individuel ────────────────────────────────────────────────────
    // Chaque site = un marqueur visible indépendant, sans regroupement.
    // Idéal pour zoomer sur une zone et inspecter chaque site distinctement.
    else if (mode === 'individual') {
        sites.forEach(site => {
            const lat = Number(site.latitude);
            const lng = Number(site.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return;

            const color     = getRiskColor(site);
            const riskLabel = getRiskLabel(getSiteRiskLevel(site));

            // Marqueur 14px (plus grand qu'en mode cluster) pour rester lisible
            // CORE → carré tourné 45°, RAN → cercle coloré par statut KPI
            const icon = L.divIcon({
                html: `<div style="background:${color};width:14px;height:14px;
                    ${site.domain === 'CORE' ? 'border-radius:2px;transform:rotate(45deg);' : 'border-radius:50%;'}
                    border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>`,
                iconSize: [14, 14]
            });

            const worstLine    = site.worst_kpi_name
                ? `<b>KPI dégradant:</b> ${site.worst_kpi_name} = ${site.worst_kpi_value}%<br>` : '';
            const baselineLine = site.dynamic_baseline
                ? `<b>Seuils dyn.:</b> alerte ${site.dynamic_baseline.warn_threshold}% | critique ${site.dynamic_baseline.crit_threshold}%<br>` : '';

            const marker = L.marker([lat, lng], { icon, siteData: site });
            marker.bindPopup(`
                <b>${site.name}</b> <span style="font-size:0.8em;background:#e0e7ff;padding:1px 5px;border-radius:4px">${site.technology}</span><br>
                <b>Pays:</b> ${site.country_name}<br>
                <b>Vendor:</b> <span style="width:9px;height:9px;border-radius:50%;background:${API.vendorColor(site.vendor)};display:inline-block;margin-right:3px;vertical-align:middle"></span>${site.vendor}<br>
                <b>KPI Global:</b> ${site.kpi_global}%<br>
                <b>Score santé:</b> ${Number(site.health_score || site.kpi_global || 0).toFixed(2)}%<br>
                <b>Niveau:</b> <span style="color:${color};font-weight:700">${riskLabel}</span><br>
                ${baselineLine}${worstLine}
                <b>Action:</b> ${site.recommendation || 'Suivi standard'}<br>
                <button class="btn btn-sm btn-primary mt-2" onclick="showFullSiteDetails('${site.id}')">Voir détails</button>
            `);
            marker.addTo(fullMap);
            fullMarkers.push(marker);
        });
    }

    // ── Mode 3 : Heatmap ──────────────────────────────────────────────────────
    // Carte de chaleur où les zones rouges indiquent une concentration de sites
    // avec des KPIs dégradés. Requires Leaflet.heat (chargé dans les pages PHP).
    // L'intensité de chaque point = (100 - kpi) / 100 → rouge = mauvais.
    else if (mode === 'heatmap') {
        if (fullMapModeManager) fullMapModeManager.applyHeatmap(sites);
    }

    // Le mode choroplèthe a été retiré : aucun traitement supplémentaire.
}

/**
 * Met à jour les statistiques de la légende
 */
function updateLegendStats(sites) {
    const siteCount = sites.length;
    const criticalCount = sites.filter(s => getSiteRiskLevel(s) === 'critical').length;
    document.getElementById('legendSiteCount').innerText = siteCount;
    document.getElementById('legendCriticalCount').innerText = criticalCount;
}

/**
 * Charge le tableau des sites — appel API dédié, indépendant des marqueurs de la carte.
 * Données triées par kpi_global ASC (pires sites en premier).
 */
async function loadFullSitesTable() {
    try {
        const tableFilters = {
            country: fullFilters.country,
            vendor: fullFilters.vendor,
            tech: fullFilters.tech,
            domain: fullFilters.domain,
            status: fullFilters.status,
            limit: 500
        };
        const result = await API.getSites(tableFilters);
        if (!result.success || !result.data) return;
        fullTableData = result.data;
        fullCurrentPage = 1;
        renderSitesTable();
    } catch (error) {
        console.error('[MapView] Erreur chargement tableau:', error);
    }
}

/**
 * Rend le tableau (pagination locale sur fullTableData — pas de re-fetch).
 */
function renderSitesTable() {
    const tbody = document.getElementById('sitesTableBody');
    if (!tbody) return;

    // En mode dynamique, on s'appuie sur les données enrichies de get-map-markers
    // pour garder la cohérence visuelle entre carte (clusters/couleurs) et tableau.
    const sourceData = (fullFilters.score_mode === 'dynamic' && fullSitesData.length > 0)
        ? fullSitesData
        : fullTableData;

    if (!sourceData || sourceData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Aucun site trouvé pour ces filtres</td></tr>';
        const paginationDiv = document.getElementById('paginationControls');
        if (paginationDiv) paginationDiv.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(sourceData.length / fullItemsPerPage);
    const start      = (fullCurrentPage - 1) * fullItemsPerPage;
    const paginated  = sourceData.slice(start, start + fullItemsPerPage);

    const statusLabel = s => s === 'good' ? 'Bon' : (s === 'warning' ? 'Alerte' : 'Critique');

    tbody.innerHTML = paginated.map(site => {
        const risk = getSiteRiskLevel(site);
        return `
        <tr class="site-row-${risk}">
            <td><strong>${escapeHtml(site.id)}</strong></td>
            <td>${escapeHtml(site.name)}</td>
            <td><i class="bi bi-flag"></i> ${escapeHtml(site.country_name ?? site.country_code)}</td>
            <td><span style="width:9px;height:9px;border-radius:50%;background:${API.vendorColor(site.vendor)};display:inline-block;margin-right:4px;vertical-align:middle"></span>${escapeHtml(site.vendor)}</td>
            <td><strong>${escapeHtml(site.technology)}</strong></td>
            <td>${escapeHtml(site.domain)}</td>
            <td><strong title="${escapeHtml(site.worst_kpi_name || 'N/A')}">${escapeHtml(site.worst_kpi_name || 'N/A')}</strong><br><span style="font-size:0.75rem;color:#4f46e5">${site.worst_kpi_value || 0}%</span></td>
            <td><span class="status-badge status-${risk}">${statusLabel(risk)}</span></td>
            <td><button class="btn-details" onclick="showFullSiteDetails('${escapeHtml(site.id)}')"><i class="bi bi-eye-fill"></i></button></td>
        </tr>
    `;
    }).join('');

    const paginationDiv = document.getElementById('paginationControls');
    if (!paginationDiv) return;
    if (totalPages <= 1) { paginationDiv.innerHTML = ''; return; }

    // Pagination compacte : max 7 liens visibles
    const maxLinks = 7;
    let startPage = Math.max(1, fullCurrentPage - Math.floor(maxLinks / 2));
    let endPage   = Math.min(totalPages, startPage + maxLinks - 1);
    if (endPage - startPage < maxLinks - 1) startPage = Math.max(1, endPage - maxLinks + 1);

    let html = `<nav aria-label="Pages"><ul class="pagination pagination-sm mb-0">`;
    html += `<li class="page-item ${fullCurrentPage === 1 ? 'disabled' : ''}"><button class="page-link" onclick="goToFullPage(${fullCurrentPage - 1})">&laquo;</button></li>`;
    if (startPage > 1) html += `<li class="page-item"><button class="page-link" onclick="goToFullPage(1)">1</button></li>${startPage > 2 ? '<li class="page-item disabled"><span class="page-link">…</span></li>' : ''}`;
    for (let i = startPage; i <= endPage; i++) {
        html += `<li class="page-item ${i === fullCurrentPage ? 'active' : ''}"><button class="page-link" onclick="goToFullPage(${i})">${i}</button></li>`;
    }
    if (endPage < totalPages) html += `${endPage < totalPages - 1 ? '<li class="page-item disabled"><span class="page-link">…</span></li>' : ''}<li class="page-item"><button class="page-link" onclick="goToFullPage(${totalPages})">${totalPages}</button></li>`;
    html += `<li class="page-item ${fullCurrentPage === totalPages ? 'disabled' : ''}"><button class="page-link" onclick="goToFullPage(${fullCurrentPage + 1})">&raquo;</button></li>`;
    html += `</ul><span class="text-muted ms-2" style="font-size:0.8rem">${sourceData.length} sites — page ${fullCurrentPage}/${totalPages}</span></nav>`;
    paginationDiv.innerHTML = html;
}

/**
 * Charge les graphiques (utilise fullTableData — données complètes et filtrées).
 */
async function loadFullCharts() {
    try {
        // fullTableData est chargé par loadFullSitesTable() — utiliser ce cache
        // Si vide (chargement initial parallèle), utiliser fullSitesData comme fallback
        const data = (fullTableData && fullTableData.length > 0) ? fullTableData : fullSitesData;
        if (!data || data.length === 0) return;

        // Récupérer l'API RAN KPIs pour les statistiques globales fiables
        // et la distribution par pays (au lieu de calculer manuellement)
        let ranKpis = null;
        let countriesDistribution = [];
        try {
            ranKpis = await API.getRanKpis(fullFilters);
            countriesDistribution = ranKpis?.success
                ? (ranKpis.data?.distribution?.countries || [])
                : [];
        } catch (distributionError) {
            console.warn('[MapView] Répartition pays indisponible, fallback sur les données locales.', distributionError);
        }
        
        // --- GRAPHIQUE 1: Répartition par statut ---
        // Utiliser les stats du backend RAN KPIs pour la vraie répartition de tous les sites
        // (évite le biais du tri par criticité + limite dans fullTableData)
        let good = 0, warning = 0, critical = 0;
        if (ranKpis?.success && ranKpis.data?.stats) {
            const stats = ranKpis.data.stats;
            good = parseInt(stats.good_sites) || 0;
            warning = parseInt(stats.warning_sites) || 0;
            critical = parseInt(stats.critical_sites) || 0;
        }
        
        console.log('[MapView] Statut - Good:', good, 'Warning:', warning, 'Critical:', critical);
        
        chartManager.createPieChart('statusChart', {
            labels: ['Bon (≥95%)', 'Alerte (90-95%)', 'Critique (<90%)'],
            datasets: [{ data: [good, warning, critical], backgroundColor: [API.COLORS.status.good, API.COLORS.status.warning, API.COLORS.status.bad] }]
        });
        
        // Répartition par technologie — Couleurs distinctes par tech
        const techCounts = { '2G': 0, '3G': 0, '4G': 0, 'CORE': 0 };
        data.forEach((s) => {
            const t = s.technology;
            if (techCounts[t] !== undefined) techCounts[t] += 1;
        });
        const twoG = techCounts['2G'];
        const threeG = techCounts['3G'];
        const fourG = techCounts['4G'];
        const core = techCounts['CORE'];
        
        chartManager.createBarChart('techChart', {
            labels: ['2G', '3G', '4G', 'CORE'],
            datasets: [{ 
                label: 'Nombre de sites', 
                data: [twoG, threeG, fourG, core], 
                backgroundColor: [
                    API.COLORS.tech['2G'],    // 2G: vert
                    API.COLORS.tech['3G'],    // 3G: orange
                    API.COLORS.tech['4G'],    // 4G: cyan
                    API.COLORS.tech['CORE']   // CORE: violet
                ]
            }]
        });
        
        // --- Top pays — utiliser l'agrégation backend ---
        let sorted = countriesDistribution
            .map(country => [country.name, Number(country.count) || 0])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (sorted.length === 0) {
            // Fallback: recalculer depuis les données locales
            const countryMap = new Map();
            data.forEach(site => {
                countryMap.set(site.country_name, (countryMap.get(site.country_name) || 0) + 1);
            });
            sorted = Array.from(countryMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
        }
        
        // --- Pires KPIs par technologie ---
        // Affiche les 3 KPIs les plus dégradants pour chaque technologie (2G, 3G, 4G) avec noms complets et date
        // Très utile pour identifier rapidement les points critiques du réseau par domaine
        const worstContainer = document.getElementById('worstKpisPanel');
        if (worstContainer && ranKpis?.success && ranKpis.data?.kpis) {
            const kpis = ranKpis.data.kpis;
            const lastKpiDate = ranKpis.data.last_kpi_date;
            const technologies = ['2G', '3G', '4G'];
            const techClasses = { '2G': 'tech-2g', '3G': 'tech-3g', '4G': 'tech-4g' };
            
            // Format de la date pour affichage (ex: "19 avril 2026")
            let dateDisplay = '';
            if (lastKpiDate) {
                const dateObj = new Date(lastKpiDate + ' 00:00:00');
                dateDisplay = dateObj.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
            }
            
            // En-tête avec la date des données
            const headerHtml = dateDisplay ? `<div class="worst-kpis-header">Données du <strong>${dateDisplay}</strong></div>` : '';
            
            // Corps avec les KPIs par technologie en grille (3 colonnes)
            const techsHtml = technologies.map(tech => {
                const techKpis = kpis[tech] || {};
                // Trier les KPIs par valeur (pires en premier) et prendre les 3 pires
                const techSorted = Object.entries(techKpis)
                    .sort((a, b) => b[1] - a[1])  // Tri descendant: pire valeur en premier
                    .slice(0, 3);
                
                const kpiRowsHtml = techSorted.length > 0
                    ? techSorted.map(([kpiName, value]) => `
                        <div class="worst-kpi-row">
                            <span class="worst-kpi-name">${kpiName}</span>
                            <span class="worst-kpi-value">${value.toFixed(1)}%</span>
                        </div>
                    `).join('')
                    : '<div style="font-size: 0.8rem; color: #94a3b8; padding: 4px;">— Aucune donnée —</div>';
                
                return `
                    <div class="worst-kpis-tech ${techClasses[tech] || ''}">
                        <div class="worst-kpis-tech-label">${tech}</div>
                        <div class="worst-kpis-list">
                            ${kpiRowsHtml}
                        </div>
                    </div>
                `;
            }).join('');
            
            console.log('[MapView] Pires KPIs (date:', lastKpiDate, '):', kpis);
            worstContainer.innerHTML = headerHtml + `<div class="worst-kpis-techs-container">${techsHtml}</div>`;
        } else if (worstContainer) {
            console.warn('[MapView] Container #worstKpisPanel trouvé mais données RAN indisponibles');
            worstContainer.innerHTML = '<div style="padding: 10px; color: #94a3b8; font-size: 0.9rem;">Données non disponibles</div>';
        }
    } catch (error) {
        console.error('[MapView] Erreur chargement graphiques:', error);
    }
}

/**
 * Initialise les filtres
 */
async function refreshMapKpiOptions() {
    const kpiSelect = document.getElementById('filterKpi');
    if (!kpiSelect) return;
    const tech = document.getElementById('filterTech')?.value || 'all';
    const country = document.getElementById('filterCountry')?.value || 'all';
    const vendor = document.getElementById('filterVendor')?.value || 'all';
    const domain = document.getElementById('filterDomain')?.value || 'all';
    if (tech === 'all') {
        kpiSelect.innerHTML = '<option value="all">Tous les KPIs</option>';
        kpiSelect.value = 'all';
        kpiSelect.disabled = true;
        return;
    }
    kpiSelect.disabled = true;
    kpiSelect.innerHTML = '<option value="all">Chargement...</option>';
    try {
        const result = await API.getKpisByTechnology({ country, vendor, tech, domain: domain !== 'all' ? domain : 'RAN' });
        const kpis = (result?.success && Array.isArray(result?.data?.kpis)) ? result.data.kpis : [];
        kpiSelect.innerHTML = '<option value="all">Tous les KPIs</option>' +
            kpis.map(k => `<option value="${k}">${k}</option>`).join('');
        kpiSelect.disabled = kpis.length === 0;
    } catch (e) {
        kpiSelect.innerHTML = '<option value="all">Tous les KPIs</option>';
        kpiSelect.disabled = false;
    }
}

function initFullFilters() {
    const applyBtn = document.getElementById('applyFilters');
    const resetBtn = document.getElementById('resetFilters');
    const fitBoundsBtn = document.getElementById('fitBoundsBtn');
    const techSelect = document.getElementById('filterTech');
    const countrySelect = document.getElementById('filterCountry');
    const vendorSelect = document.getElementById('filterVendor');

    techSelect?.addEventListener('change', refreshMapKpiOptions);
    countrySelect?.addEventListener('change', () => {
        if ((techSelect?.value || 'all') !== 'all') refreshMapKpiOptions();
    });
    vendorSelect?.addEventListener('change', () => {
        if ((techSelect?.value || 'all') !== 'all') refreshMapKpiOptions();
    });
    
    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            const kpiSelect = document.getElementById('filterKpi');
            fullFilters = {
                country: document.getElementById('filterCountry')?.value || 'all',
                vendor: document.getElementById('filterVendor')?.value || 'all',
                tech: document.getElementById('filterTech')?.value || 'all',
                domain: document.getElementById('filterDomain')?.value || 'all',
                status: document.getElementById('filterStatus')?.value || 'all',
                score_mode: document.getElementById('filterScoreMode')?.value || 'fixed',
                kpi: (kpiSelect && !kpiSelect.disabled) ? (kpiSelect.value || 'all') : 'all'
            };
            fullCurrentPage = 1;
            // Carte + tableau rechargés en parallèle (sources indépendantes)
            await Promise.all([
                loadFullMapMarkers(),
                loadFullSitesTable(),
            ]);
            await loadFullCharts();
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            const selects = ['filterCountry', 'filterVendor', 'filterTech', 'filterDomain', 'filterStatus'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = 'all';
            });
            const scoreModeSelect = document.getElementById('filterScoreMode');
            if (scoreModeSelect) scoreModeSelect.value = 'fixed';
            const kpiSelect = document.getElementById('filterKpi');
            if (kpiSelect) {
                kpiSelect.innerHTML = '<option value="all">Tous les KPIs</option>';
                kpiSelect.value = 'all';
                kpiSelect.disabled = true;
            }
            fullFilters = { country: 'all', vendor: 'all', tech: 'all', domain: 'all', status: 'all', score_mode: 'fixed', kpi: 'all' };
            const searchInput = document.getElementById('searchSite');
            if (searchInput) searchInput.value = '';
            fullCurrentPage = 1;
            await Promise.all([
                loadFullMapMarkers(),
                loadFullSitesTable(),
            ]);
            await loadFullCharts();
            // Supprimer la couche frontières et revenir à la vue globale
            await showFullCountryBorder('all');
        });
    }

    // Bouton "Ajuster la vue" — centre la carte sur l'ensemble des marqueurs visibles
    if (fitBoundsBtn) {
        fitBoundsBtn.addEventListener('click', () => {
            if (!fullMap) return;
            if (fullMarkers.length === 0) { fullMap.flyTo([8.0, 2.0], 5); return; }
            const bounds = L.latLngBounds(fullMarkers.map(m => m.getLatLng()));
            fullMap.flyToBounds(bounds, { padding: [50, 50] });
        });
    }
}

/**
 * Affiche les frontières GeoJSON du pays sélectionné sur la carte Map View.
 * Partage le même endpoint PHP et les mêmes fichiers GeoJSON en cache que le dashboard.
 * Pays disponibles : ci.geojson, bj.geojson, cf.geojson, ne.geojson, tg.geojson
 * @param {string} countryCode - Code ISO-2 (ex: 'CI', 'BJ') ou 'all' pour vue globale (Afrique entière)
 */
async function showFullCountryBorder(countryCode) {
    if (!fullMap) return;

    // Supprimer la couche précédente avant d'en créer une nouvelle
    if (fullCountryBorderLayer) {
        fullMap.removeLayer(fullCountryBorderLayer);
        fullCountryBorderLayer = null;
    }

    // Pas de pays spécifique : afficher l'Afrique entière avec fitBounds
    // Cela remplace le setView/flyTo qui était figé sur la CI
    if (!countryCode || countryCode === 'all') {
        const africaBounds = L.latLngBounds([[37, -17], [-35, 55]]);
        fullMap.fitBounds(africaBounds, { padding: [30, 30] });
        return;
    }

    try {
        const res = await fetch(`../netinsight360-backend/api/map/get-country-border.php?cc=${encodeURIComponent(countryCode)}`);
        if (!res.ok) return;
        const geojson = await res.json();

        // Ajouter la couche GeoJSON avec bordure visible et léger fond translucide
        fullCountryBorderLayer = L.geoJSON(geojson, {
            style: {
                color: '#1e3a5f',
                weight: 2.5,
                opacity: 0.9,
                fillColor: '#1e3a5f',
                fillOpacity: 0.04
            }
        }).addTo(fullMap);

        // Zoom pays: on adoucit l'agrandissement automatique.
        // Au lieu d'un maxZoom fixe, on adapte selon la taille du pays pour éviter
        // un zoom trop agressif sur les petits territoires.
        const bounds = fullCountryBorderLayer.getBounds();
        const latSpan = Math.abs(bounds.getNorth() - bounds.getSouth());
        const lngSpan = Math.abs(bounds.getEast() - bounds.getWest());
        const span = Math.max(latSpan, lngSpan);

        let adaptiveMaxZoom = 8;
        if (span < 1.5) {
            adaptiveMaxZoom = 6.8;
        } else if (span < 3.0) {
            adaptiveMaxZoom = 7.2;
        } else if (span < 6.0) {
            adaptiveMaxZoom = 7.6;
        }

        fullMap.fitBounds(bounds, { padding: [90, 90], maxZoom: adaptiveMaxZoom });
    } catch (err) {
        console.warn('[MapView] Frontières pays non disponibles:', err);
    }
}

/**
 * Initialise les rapports
 */
function initFullReports() {
    // Menu déroulant pour l'export PDF
    const pdfOptions = document.querySelectorAll('.pdf-option');
    pdfOptions.forEach(option => {
        option.addEventListener('click', async () => {
            const period = option.getAttribute('data-period');
            try {
                // Convertir "period" en dates start_date et end_date
                const now = new Date();
                let startDate, endDate = now.toISOString().split('T')[0];
                
                if (period === 'day') {
                    startDate = endDate;
                } else if (period === 'week') {
                    const weekAgo = new Date(now);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    startDate = weekAgo.toISOString().split('T')[0];
                } else if (period === 'month') {
                    const monthAgo = new Date(now);
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    startDate = monthAgo.toISOString().split('T')[0];
                }
                
                // IMPORTANT:
                // L'endpoint export-pdf.php retourne du JSON { success, url } pour type=map.
                // On doit d'abord appeler l'API puis ouvrir result.url, sinon on affiche le JSON brut.
                const result = await API.exportPdf({
                    type: 'map',
                    start_date: startDate,
                    end_date: endDate,
                    ...(fullFilters || {})
                });

                if (result?.success && result?.url) {
                    const w = window.open(result.url, '_blank');
                    if (!w) {
                        alert('Pop-up bloquée: autorisez les pop-ups pour ouvrir le rapport PDF.');
                    }
                } else {
                    alert(result?.error || 'Impossible de générer le rapport PDF.');
                }
            } catch (error) { 
                console.error('[MapView] Erreur export PDF:', error); 
                alert('Une erreur est survenue lors de la génération du PDF.');
            }
        });
    });
    
    // Export CSV — télécharge les sites du tableau
    const exportCsvBtn = document.getElementById('exportCsvMapBtn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            if (!fullTableData || fullTableData.length === 0) {
                alert('Aucune donnée à exporter');
                return;
            }
            // Construire le CSV
            const headers = ['Site ID', 'Nom', 'Pays', 'Vendor', 'Technologie', 'Domaine', 'Pire KPI', 'Valeur KPI', 'Statut'];
            const rows = fullTableData.map(site => [
                site.id,
                `"${site.name}"`,
                site.country_name || site.country_code || 'N/A',
                site.vendor || 'N/A',
                site.technology || 'N/A',
                site.domain || 'N/A',
                site.worst_kpi_name || 'N/A',
                site.worst_kpi_value || 'N/A',
                site.status || 'unknown'
            ]);
            const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
            
            // Télécharger
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `NetInsight360_CartographieSites_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
        });
    }
    
    // Générer rapport — crée un rapport synthétique HTML printable avec stats
    const generateReportBtn = document.getElementById('generateReportBtn');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', () => {
            try {
                // Construire l'URL d'export rapport
                const params = new URLSearchParams({ 
                    type: 'map_report',
                    ...(fullFilters || {})
                }).toString();
                const url = `/NetInsight%20360/netinsight360-backend/api/reports/export-pdf.php?${params}`;
                window.open(url, '_blank');
            } catch (error) {
                console.error('[MapView] Erreur génération rapport:', error);
                alert('Une erreur est survenue lors de la génération du rapport');
            }
        });
    }
    
    // Snapshot — sauvegarde l'état actuel des filtres et données
    const downloadSnapshotBtn = document.getElementById('downloadSnapshotBtn');
    if (downloadSnapshotBtn) {
        downloadSnapshotBtn.addEventListener('click', () => {
            const statusCounts = { good: 0, warning: 0, critical: 0 };
            const techCounts = { '2G': 0, '3G': 0, '4G': 0 };
            (fullTableData || []).forEach((s) => {
                if (statusCounts[s.status] !== undefined) statusCounts[s.status] += 1;
                if (techCounts[s.technology] !== undefined) techCounts[s.technology] += 1;
            });

            const snapshot = {
                timestamp: new Date().toISOString(),
                filters: fullFilters,
                sitesCount: fullTableData?.length || 0,
                statusCounts,
                techCounts
            };
            
            const json = JSON.stringify(snapshot, null, 2);
            const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `cartographie_snapshot_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
            link.click();
        });
    }
}

/**
 * Centre la carte sur un pays
 * @param {string} countryName - Nom du pays
 */
function centerOnCountry(countryName) {
    const countryMap = {
        'Côte d\'Ivoire': [6.877, -5.282, 7],
        'Niger': [14.512, 6.112, 6],
        'Bénin': [7.496, 2.603, 7],
        'Togo': [7.131, 1.223, 7]
    };
    
    const coords = countryMap[countryName];
    if (coords && fullMap) {
        fullMap.flyTo([coords[0], coords[1]], coords[2]);
    }
}

/**
 * Initialise la recherche de site
 */
function initFullSearch() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchSite');
    if (!searchBtn || !searchInput) return;

    const performSearch = async () => {
        const query = searchInput.value.trim();
        if (!query) return;
        try {
            const result = await API.searchSite(query);
            if (result.success && result.data) {
                const site = result.data;
                if (fullMap && site.latitude && site.longitude) {
                    fullMap.flyTo([site.latitude, site.longitude], 13);
                }
                showFullSiteDetails(site.id);
            } else {
                alert(`Aucun site trouvé pour : ${query}`);
            }
        } catch (err) {
            console.error('[Map View] Erreur recherche:', err);
        }
    };

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') performSearch(); });
}

/**
 * Affiche les détails d'un site
 * @param {string} siteId - Identifiant du site
 */
async function showFullSiteDetails(siteId) {
    try {
        const result = await API.getSiteDetails(siteId);
        if (!result.success || !result.data) return;
        
        const site = result.data;
        window.currentSiteForModal = site;
        
        // Titre et sous-titre
        document.getElementById('modalSiteTitle').innerText = site.name;
        const subtitle = document.getElementById('modalSiteSubtitle');
        if (subtitle) subtitle.innerText = `${site.country_name} — ${site.vendor} — ${site.technology}`;

        // Barre de stats (pire KPI, statut, dates)
        const statusLabel = site.status === 'good' ? 'Bon' : (site.status === 'warning' ? 'Alerte' : 'Critique');
        const statusColor = API.statusColor(site.status);
        const lastDate = site.latest_kpis?.kpi_date ?? site.kpi_date ?? 'N/A';
        const lastImport = site.latest_kpis?.imported_at ? site.latest_kpis.imported_at.substring(0,16).replace('T',' ') : 'N/A';
        const worstKpiName = site.worst_kpi?.worst_kpi_name ?? (site.kpis_by_tech?.[0]?.worst_kpi_name ?? 'N/A');
        const worstKpiValue = site.worst_kpi?.worst_kpi_value ?? (site.kpis_by_tech?.[0]?.worst_kpi_value ?? 0);
        const statsBar = document.getElementById('modalStatsBar');
        if (statsBar) statsBar.innerHTML = [
            `<div><span class="text-muted">Pire KPI du site</span><br><strong style="color:#ef4444">${escapeHtml(worstKpiName)}</strong></div>`,
            `<div><span class="text-muted">Valeur</span><br><strong style="color:#ef4444;font-size:1.1rem">${worstKpiValue}%</strong></div>`,
            `<div><span class="text-muted">Statut global</span><br><strong style="color:${statusColor}">${statusLabel}</strong></div>`,
            `<div><span class="text-muted">Dernière date KPI</span><br><strong>${lastDate}</strong></div>`,
            `<div><span class="text-muted">Dernier import</span><br><strong>${lastImport}</strong></div>`,
        ].join('');

        // Informations générales
        document.getElementById('modalSiteInfo').innerHTML = `
            <table class="table table-sm table-borderless mb-0" style="font-size:0.85rem">
                <tr><td class="text-muted pe-2">ID Site</td><td><strong>${escapeHtml(site.id)}</strong></td></tr>
                <tr><td class="text-muted pe-2">Pays</td><td>${escapeHtml(site.country_name)}</td></tr>
                <tr><td class="text-muted pe-2">Vendor</td><td>${escapeHtml(site.vendor)}</td></tr>
                <tr><td class="text-muted pe-2">Technologie</td><td>${escapeHtml(site.technology)}</td></tr>
                <tr><td class="text-muted pe-2">Domaine</td><td>${escapeHtml(site.domain)}</td></tr>
                ${site.region ? `<tr><td class="text-muted pe-2">Région</td><td>${escapeHtml(site.region)}</td></tr>` : ''}
                ${site.localite ? `<tr><td class="text-muted pe-2">Localité</td><td>${escapeHtml(site.localite)}</td></tr>` : ''}
                ${(site.latitude && site.latitude !== 0) ? `<tr><td class="text-muted pe-2">GPS</td><td style="font-size:0.75rem">${site.latitude}, ${site.longitude}</td></tr>` : ''}
            </table>
        `;

        // KPIs dégradants par technologie
        const worstDiv = document.getElementById('modalWorstKpis');
        if (worstDiv) {
            const techs = site.kpis_by_tech || [];
            if (techs.length === 0) {
                worstDiv.innerHTML = '<p class="text-muted small">Aucune donnée disponible</p>';
            } else {
                const techColors = API.COLORS.tech;
                worstDiv.innerHTML = techs.map(t => {
                    const tc = techColors[t.technology] || '#6c757d';
                    const kpiGlobalColor = API.statusColor(t.status);
                    const worstLine = t.worst_kpi_name
                        ? `<div style="font-size:0.78rem;color:#ef4444"><i class="bi bi-arrow-down-short"></i> <strong>${escapeHtml(t.worst_kpi_name)}</strong> : ${t.worst_kpi_value}%</div>`
                        : `<div style="font-size:0.78rem" class="text-muted">Aucun KPI dégradant</div>`;
                    return `<div class="mb-2 p-2 rounded" style="background:#f8f9fa;border-left:3px solid ${tc}">
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="badge" style="background:${tc}">${escapeHtml(t.technology)}</span>
                            <span style="font-size:0.85rem">KPI Global : <strong style="color:${kpiGlobalColor}">${t.kpi_global}%</strong></span>
                            <small class="text-muted">${t.kpi_date ?? ''}</small>
                        </div>
                        ${worstLine}
                    </div>`;
                }).join('');
            }
        }

        // Ouvrir le modal
        const modalEl = document.getElementById('siteDetailsModal');
        bootstrap.Modal.getOrCreateInstance(modalEl).show();

        // Mettre à jour le label du graphique de tendance
        const trendLabel = document.getElementById('trendKpiLabel');
        if (trendLabel) trendLabel.innerText = worstKpiName;

        // Charger la tendance du pire KPI (14 jours)
        try {
            // Utiliser le nom du pire KPI au lieu de 'kpi_global'
            const trends = await API.getKpiTrends(siteId, worstKpiName, 14, site.technology);
            if (trends.success && trends.data) {
                const defaultOptions = {
                    scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } },
                    plugins: { 
                        legend: { position: 'bottom' }, 
                        tooltip: { 
                            callbacks: { 
                                label: ctx => ` ${ctx.parsed.y}%`,
                                title: function(items) {
                                    if (!items || items.length === 0) return '';
                                    // Afficher la date et l'heure si disponible
                                    return items.map(it => it.label).join(' — ');
                                }
                            } 
                        } 
                    }
                };

                if (trends.data.used_hour) {
                    defaultOptions.scales.x = { ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 } };
                }

                chartManager.createLineChart('trend5DaysChart', {
                    labels: trends.data.labels,
                    datasets: [{ label: `${site.name} — ${worstKpiName} (%)`, data: trends.data.values, borderColor: API.COLORS.status.bad, backgroundColor: 'rgba(239,68,68,0.1)', fill: true }]
                }, defaultOptions);
            }
        } catch (trendErr) {
            console.warn('[MapView] Tendance non disponible:', trendErr);
        }

        // Bouton partage WhatsApp
        const shareBtn = document.getElementById('shareSiteWhatsApp');
        if (shareBtn) {
            shareBtn.onclick = () => {
                const s = window.currentSiteForModal;
                if (!s) return;
                const worstKpiInfo = s.worst_kpi?.worst_kpi_name ? `\nPire KPI: ${s.worst_kpi.worst_kpi_name} (${s.worst_kpi.worst_kpi_value}%)` : '';
                const msg = `📡 *Site: ${s.name} (${s.country_name})*\nID: ${s.id}${worstKpiInfo}\nVendor: ${s.vendor}\nTechno: ${s.technology}\nStatut: ${s.status}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
            };
        }

        // Boutons export de fiche site dans le modal
        const exportSiteCsvBtn = document.getElementById('exportSiteCsv');
        if (exportSiteCsvBtn) {
            exportSiteCsvBtn.onclick = async () => {
                const s = window.currentSiteForModal;
                if (!s) return;
                try {
                    const result = await API.exportSite(s.id, 'csv');
                    if (result.success && result.url) window.open(result.url, '_blank');
                } catch (e) { console.error('[MapView] Export CSV site:', e); }
            };
        }

        const exportSitePdfBtn = document.getElementById('exportSitePdf');
        if (exportSitePdfBtn) {
            exportSitePdfBtn.onclick = async () => {
                const s = window.currentSiteForModal;
                if (!s) return;
                try {
                    const result = await API.exportSite(s.id, 'pdf');
                    if (result.success && result.url) window.open(result.url, '_blank');
                } catch (e) { console.error('[MapView] Export PDF site:', e); }
            };
        }
    } catch (error) {
        console.error('[MapView] Erreur chargement détails:', error);
    }
}

/**
 * Change de page dans le tableau (pas de re-fetch — utilise fullTableData en cache).
 * @param {number} page - Numéro de page
 */
function goToFullPage(page) {
    fullCurrentPage = page;
    renderSitesTable();
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', initMapView);

window.centerOnCountry   = centerOnCountry;
window.showFullSiteDetails = showFullSiteDetails;
window.goToFullPage      = goToFullPage;
window.renderSitesTable  = renderSitesTable;