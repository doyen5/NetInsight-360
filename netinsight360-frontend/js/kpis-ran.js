/**
 * NetInsight 360 - KPIs RAN
 * Supervisez. Analysez. Optimisez.
 * 
 * Page des KPIs Radio Access Network (2G/3G/4G)
 * Toutes les données proviennent de l'API backend
 */

// Correspondance libellé français worst_kpi_name → colonne SQL dans kpis_ran
const KPI_LABEL_TO_COLUMN = {
    'Disponibilité TCH':  'tch_availability',
    'Taux de chute appel':'tch_drop_rate',
    'Succès Handover':    'handover_sr_2g',
    'SDCCH Congestion':   'sdcch_cong',
    'SDCCH Chute':        'sdcch_drop',
    'RRC CS SR':          'rrc_cs_sr',
    'RAB CS SR':          'rab_cs_sr',
    'RRC PS SR':          'rrc_ps_sr',
    'Chute CS':           'cs_drop_rate',
    'Soft HO':            'soft_ho_rate',
    'S1 SR':              'lte_s1_sr',
    'RRC SR':             'lte_rrc_sr',
    'ERAB SR':            'lte_erab_sr',
    'Session SR':         'lte_session_sr',
    'CSFB SR':            'lte_csfb_sr',
    'Chute ERAB':         'lte_erab_drop_rate',
    'HO Intra-freq':      'lte_intra_freq_sr',
    'HO Inter-freq':      'lte_inter_freq_sr',
};

let ranMap = null;
let ranMarkers = [];
let ranFilters = { country: 'all', vendor: 'all', tech: 'all', worstKpi: 'all' };
let ranCountryBorderLayer = null; // Couche Leaflet GeoJSON des frontières du pays sélectionné
let ranCurrentPage = 1;
let ranItemsPerPage = 10;
let ranKpisCacheKey = '';
let ranKpisCacheData = null;

/**
 * Mode d'affichage actif sur la carte KPIs RAN.
 * Valeurs possibles : 'cluster' | 'individual' | 'heatmap'
 */
let currentRanDisplayMode = 'cluster';

/** Instance du gestionnaire de modes (initialisée dans initRanMap) */
let ranMapModeManager = null;

/** Cache des données carte pour les changements de mode sans re-fetch */
let ranSitesData = [];

function getBaseRanFilters() {
    return {
        country: ranFilters.country || 'all',
        vendor: ranFilters.vendor || 'all',
        tech: ranFilters.tech || 'all'
    };
}

function getWorstSitesFilters() {
    return {
        ...getBaseRanFilters(),
        domain: 'RAN',
        worst_kpi: ranFilters.worstKpi || 'all'
    };
}

/**
 * Construit une clé de cache stable pour la combinaison de filtres RAN.
 */
function buildRanKpisCacheKey() {
    return JSON.stringify(getBaseRanFilters());
}

/**
 * Récupère les KPIs RAN avec un cache local page-level.
 *
 * Objectif: éviter deux appels backend identiques lors d'un même rafraîchissement
 * (stats + charts) et améliorer la réactivité de la page.
 */
async function fetchRanKpisPayload(forceRefresh = false) {
    const key = buildRanKpisCacheKey();
    if (!forceRefresh && ranKpisCacheData && ranKpisCacheKey === key) {
        return { success: true, data: ranKpisCacheData };
    }

    const result = await API.getRanKpis(getBaseRanFilters());
    if (result?.success && result.data) {
        ranKpisCacheData = result.data;
        ranKpisCacheKey = key;
    }
    return result;
}

/**
 * Initialise la page KPIs RAN
 */
async function initKpisRan() {
    // Vérifier l'authentification
    const isAuth = await checkAuthentication();
    if (!isAuth) return;
    
    // Mettre à jour l'interface utilisateur
    await updateUserInterface();
    
    // Initialiser la carte
    initRanMap();
    
    // Charger les blocs principaux en parallèle pour réduire le temps d'attente initial.
    await Promise.all([
        loadRanStats(),
        loadWorstSitesTable(),
        loadRanCharts(),
    ]);
    
    // Initialiser les filtres
    initRanFilters();
    
    // Initialiser la recherche
    initRanSearch();
    // Initialiser les boutons rapports/export (même logique que map-view)
    initRanReports();

    // Si la page a été ouverte juste après un import (flag mis par admin-tools),
    // activer automatiquement l'option "Top by tech" pour aider l'opérateur.
    try {
        const flag = sessionStorage.getItem('showTopByTechAfterImport');
        const cb = document.getElementById('topByTechCheckbox');
        const sel = document.getElementById('topByTechNSelect');
        // Charger préférence utilisateur (localStorage) si présente
        let userPrefN = null;
        try {
            const currentUser = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
            if (currentUser) {
                const u = JSON.parse(currentUser);
                userPrefN = localStorage.getItem('pref_topByTech_n_' + (u.email || u.name || 'guest'));
            }
        } catch (_) { userPrefN = null; }
        if (userPrefN && sel) sel.value = userPrefN;

        if (flag === '1') {
            if (cb) cb.checked = true;
            // Forcer un rechargement des marqueurs dans ce mode
            await loadRanMapMarkers();
            // Supprimer le flag pour éviter répétition
            sessionStorage.removeItem('showTopByTechAfterImport');
        }

        // Sauvegarde de préférence : quand l'utilisateur change le select, on stocke par user
        if (sel) {
            sel.addEventListener('change', () => {
                try {
                    const currentUser = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
                    let keyUser = 'guest';
                    if (currentUser) { const u = JSON.parse(currentUser); keyUser = (u.email || u.name || 'guest'); }
                    localStorage.setItem('pref_topByTech_n_' + keyUser, sel.value);
                } catch (e) { console.warn('[KPIs RAN] impossible de sauver préférence:', e); }
            });
        }

    } catch (e) {
        console.warn('[KPIs RAN] impossible de lire flag/session/localStorage:', e);
    }
}

/**
 * Initialise la carte KPIs RAN
 */
function initRanMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    ranMap = L.map('map').setView([8.0, 2.0], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(ranMap);

    // Initialiser le gestionnaire des 4 modes d'affichage.
    // kpi_global est le score de santé global du site RAN (0-100).
    ranMapModeManager = new MapModeManager(
        ranMap,
        (s) => Number(s.kpi_global || s.health_score || 0)
    );
    
    loadRanMapMarkers();
}

/**
 * Charge les marqueurs sur la carte
 */
async function loadRanMapMarkers() {
    if (!ranMap) return;
    
    // Nettoyage complet des couches précédentes
    ranMarkers.forEach(marker => ranMap.removeLayer(marker));
    ranMarkers = [];
    if (ranMapModeManager) ranMapModeManager.clearManagedLayers();
    
    try {
        // Mode "top by tech" : affichage des X pires sites par technologie
        const topByTech = document.getElementById('topByTechCheckbox')?.checked;
        if (topByTech) {
            let topN = 10;
            try {
                const sel = document.getElementById('topByTechNSelect');
                if (sel) topN = parseInt(sel.value) || 10;
            } catch (_) { topN = 10; }
            const res = await API.getTopWorstSitesByTech({ ...getWorstSitesFilters(), top_n: topN });
            if (!res.success || !res.data) return;
            const combined = [];
            Object.keys(res.data.per_tech || {}).forEach(tech => {
                (res.data.per_tech[tech] || []).forEach(s => { s._tech_group = tech; combined.push(s); });
            });
            ranSitesData = combined;
            await renderRanMapMode(combined);
            API.updateMapCountBadge({ count: combined.length, total_count: combined.length }, 'map', `${topN} pires par techno`);
            return;
        }

        const queryFilters = { ...getBaseRanFilters(), domain: 'RAN' };
        const result = await API.getMapMarkers(queryFilters);
        if (!result.success || !result.data) return;

        // Mise en cache pour les changements de mode sans re-fetch
        ranSitesData = result.data;
        await renderRanMapMode(ranSitesData);
        API.updateMapCountBadge(result);
    } catch (error) {
        console.error('[KPIs RAN] Erreur chargement marqueurs:', error);
    }
}

/**
 * Change le mode d'affichage de la carte KPIs RAN SANS recharger depuis l'API.
 *
 * Appelé par le <select id="mapDisplayMode"> dans kpis-ran.php.
 * @param {string} mode - 'cluster' | 'individual' | 'heatmap'
 */
async function switchRanDisplayMode(mode) {
    currentRanDisplayMode = mode;
    ranMarkers.forEach(m => { try { ranMap.removeLayer(m); } catch (_) {} });
    ranMarkers = [];
    if (ranMapModeManager) ranMapModeManager.clearManagedLayers();

    if (ranSitesData && ranSitesData.length > 0) {
        await renderRanMapMode(ranSitesData);
    } else {
        await loadRanMapMarkers();
    }
}

/**
 * Rend les sites sur la carte KPIs RAN selon le mode d'affichage actif.
 * @param {Array} sites - Sites à afficher
 */
async function renderRanMapMode(sites) {
    const mode = currentRanDisplayMode;

    // ── Mode 1 : Clusters ────────────────────────────────────────────────
    if (mode === 'cluster') {
        // Cluster colorié par techno dominante dans le groupe
        const clusterGroup = L.markerClusterGroup({
            maxClusterRadius: 55,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            iconCreateFunction: (cluster) => {
                const children = cluster.getAllChildMarkers();
                const count    = children.length;
                const critCount = children.filter(m => m.options?.siteStatus === 'critical').length;
                const warnCount = children.filter(m => m.options?.siteStatus === 'warning').length;
                let color = API.COLORS.status.good;
                if (critCount >= Math.max(1, Math.ceil(count * 0.25))) color = API.COLORS.status.bad;
                else if ((critCount + warnCount) >= Math.max(1, Math.ceil(count * 0.35))) color = API.COLORS.status.warning;
                const sizeClass = count < 20 ? 'small' : (count < 80 ? 'medium' : 'large');
                const avgKpi = count > 0
                    ? (children.reduce((acc, m) => acc + Number(m.options?.siteKpi || 0), 0) / count)
                    : 0;
                return L.divIcon({
                    html: `<div class="cluster-bubble cluster-${sizeClass}" style="background:${color}"><span class="cluster-count">${count}</span><span class="cluster-kpi">${avgKpi.toFixed(0)}%</span></div>`,
                    className: 'custom-kpi-cluster',
                    iconSize: [44, 44]
                });
            }
        });
        ranMap.addLayer(clusterGroup);

        sites.forEach(site => {
            if (!site.latitude || !site.longitude || site.latitude == 0) return;
            // Icône colorée par techno pour différencier 2G/3G/4G dans les clusters
            const tc = API.techColor(site.technology || site._tech_group) || API.statusColor(site.status);
            const safeSiteId = escapeJsSingleQuoted(site.id);
            const icon = L.divIcon({
                html: `<div style="background:${tc}; width:8px; height:8px; border-radius:50%; border:1px solid white;"></div>`,
                iconSize: [8, 8]
            });
            const worstLine = site.worst_kpi_name
                ? `<br><b>KPI dégradant:</b> ${escapeHtml(site.worst_kpi_name)} (${site.worst_kpi_value}%)` : '';
            const marker = L.marker([site.latitude, site.longitude], { icon, siteStatus: site.status, siteKpi: site.kpi_global || 0 });
            marker.bindPopup(`
                <b>${escapeHtml(site.name)}</b><br>
                <b>ID:</b> ${escapeHtml(site.id)}<br>
                <b>Pays:</b> ${escapeHtml(site.country_name || site.country_code)}<br>
                <b>Vendor:</b> <span style="width:9px;height:9px;border-radius:50%;background:${API.vendorColor(site.vendor)};display:inline-block;margin-right:3px;vertical-align:middle"></span>${escapeHtml(site.vendor)} | <span class="badge-tech">${escapeHtml(site.technology || site._tech_group || 'N/A')}</span><br>
                <b>KPI global:</b> ${site.kpi_global}%${worstLine}<br>
                <button class="btn btn-sm btn-primary mt-2" onclick="showRanSiteDetails('${safeSiteId}')">Voir détails</button>
            `);
            clusterGroup.addLayer(marker);
            ranMarkers.push(marker);
        });

    } // ─── fin mode cluster ───────────────────────────────────────────────────

    // ── Mode 2 : Individuel ────────────────────────────────────────────────
    // Marqueurs colorés par techno, visibles individuellement.
    else if (mode === 'individual') {
        sites.forEach(site => {
            if (!site.latitude || !site.longitude || site.latitude == 0) return;
            const tc = API.techColor(site.technology || site._tech_group) || API.statusColor(site.status);
            const safeSiteId = escapeJsSingleQuoted(site.id);
            // Taille 14px — plus grande qu'en cluster pour rester lisible sans regroupement
            const icon = L.divIcon({
                html: `<div style="background:${tc}; width:14px; height:14px; border-radius:50%; border:2px solid white; box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
                iconSize: [14, 14]
            });
            const worstLine = site.worst_kpi_name
                ? `<br><b>KPI dégradant:</b> ${escapeHtml(site.worst_kpi_name)} (${site.worst_kpi_value}%)` : '';
            const marker = L.marker([site.latitude, site.longitude], { icon });
            marker.bindPopup(`
                <b>${escapeHtml(site.name)}</b><br>
                <b>ID:</b> ${escapeHtml(site.id)}<br>
                <b>Pays:</b> ${escapeHtml(site.country_name || site.country_code)}<br>
                <b>Vendor:</b> <span style="width:9px;height:9px;border-radius:50%;background:${API.vendorColor(site.vendor)};display:inline-block;margin-right:3px;vertical-align:middle"></span>${escapeHtml(site.vendor)} | <span class="badge-tech">${escapeHtml(site.technology || site._tech_group || 'N/A')}</span><br>
                <b>KPI global:</b> ${site.kpi_global}%${worstLine}<br>
                <button class="btn btn-sm btn-primary mt-2" onclick="showRanSiteDetails('${safeSiteId}')">Voir détails</button>
            `);
            marker.addTo(ranMap);
            ranMarkers.push(marker);
        });
    }

    // ── Mode 3 : Heatmap ────────────────────────────────────────────────
    // Les zones rouges = concentration de sites avec KPIs RAN dégradés.
    else if (mode === 'heatmap') {
        if (ranMapModeManager) ranMapModeManager.applyHeatmap(sites);
    }

    // Le mode choroplèthe a été retiré : aucun traitement supplémentaire.
}

/**
 * Charge les statistiques RAN
 */
async function loadRanStats() {
    try {
        const result = await fetchRanKpisPayload();
        if (!result.success) return;
        
        const stats = result.data.stats;
        document.getElementById('totalSitesDisplay').innerText = stats.total_sites || 0;
        document.getElementById('avgRNA').innerText = (stats.avg_rna || 0) + '%';
        document.getElementById('avgTCHDrop').innerText = (stats.avg_tch_drop || 0) + '%';
        document.getElementById('criticalSites').innerText = stats.critical_sites || 0;
        
        const filterInfo = [];
        if (ranFilters.country !== 'all') filterInfo.push(ranFilters.country);
        if (ranFilters.vendor !== 'all') filterInfo.push(ranFilters.vendor);
        if (ranFilters.tech !== 'all') filterInfo.push(ranFilters.tech);
        document.getElementById('sitesFilterInfo').innerHTML = filterInfo.length ? filterInfo.join(' - ') : 'Tous les sites';
    } catch (error) {
        console.error('[KPIs RAN] Erreur chargement stats:', error);
    }
}

/**
 * Charge le tableau des pires sites
 */
async function loadWorstSitesTable() {
    try {
        const topByTech = document.getElementById('topByTechCheckbox')?.checked;
        const worstFilters = getWorstSitesFilters();
        let worst = [];

        if (topByTech) {
            // Cohérence avec la carte: en mode top-by-tech, le tableau utilise
            // la même source dédiée par techno.
            let topN = 10;
            const topSelect = document.getElementById('topByTechNSelect');
            if (topSelect) topN = parseInt(topSelect.value, 10) || 10;

            const byTechRes = await API.getTopWorstSitesByTech({ ...worstFilters, top_n: topN });
            if (!byTechRes.success || !byTechRes.data) return;

            Object.entries(byTechRes.data.per_tech || {}).forEach(([techGroup, rows]) => {
                (rows || []).forEach(row => {
                    worst.push({ ...row, _tech_group: techGroup });
                });
            });
        } else {
            const result = await API.getTopWorstSites(worstFilters);
            if (!result.success) return;
            worst = result.data.worst || [];
        }

        worst.sort((a, b) => (parseFloat(a.kpi_global) || 0) - (parseFloat(b.kpi_global) || 0));

        const totalPages = Math.ceil(worst.length / ranItemsPerPage);
        const start = (ranCurrentPage - 1) * ranItemsPerPage;
        const paginated = worst.slice(start, start + ranItemsPerPage);
        
        const tbody = document.getElementById('worstSitesList');
        if (!tbody) return;
        
        if (paginated.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">Aucun site trouvé</td></tr>';
            return;
        }
        
        tbody.innerHTML = paginated.map((site, idx) => {
            const worstLabel = site.worst_kpi_name
                ? `<span style="font-size:0.8rem">${escapeHtml(site.worst_kpi_name)}</span><br><strong>${site.worst_kpi_value}%</strong>`
                : `<strong>${site.kpi_global}%</strong>`;
            const safeSiteId = escapeJsSingleQuoted(site.id);
            return `<tr class="site-row-${site.status}">
                <td>${start + idx + 1}</td>
                <td><strong>${escapeHtml(site.id)}</strong></td>
                <td>${escapeHtml(site.name)}</td>
                <td><i class="bi bi-flag"></i> ${escapeHtml(site.country_name)}</td>
                <td><span class="badge-tech">${escapeHtml(site.technology)}</span></td>
                <td><span style="width:9px;height:9px;border-radius:50%;background:${API.vendorColor(site.vendor)};display:inline-block;margin-right:4px;vertical-align:middle"></span>${escapeHtml(site.vendor)}</td>
                <td>${worstLabel}</td>
                <td><span class="status-badge status-${site.status}">${site.status === 'good' ? '✓ OK' : (site.status === 'warning' ? '⚠️ Alerte' : '🔴 Critique')}</span></td>
                <td><button class="btn-details" onclick="showRanSiteDetails('${safeSiteId}')"><i class="bi bi-eye-fill"></i></button></td>
            </tr>`;
        }).join('');
        
        // Pagination
        const paginationDiv = document.getElementById('paginationControls');
        if (paginationDiv && totalPages > 1) {
            let html = '<nav><ul class="pagination">';
            for (let i = 1; i <= totalPages; i++) {
                html += `<li class="page-item ${i === ranCurrentPage ? 'active' : ''}">
                    <button class="page-link" onclick="goToRanPage(${i})">${i}</button>
                </li>`;
            }
            html += '</ul></nav>';
            paginationDiv.innerHTML = html;
        } else if (paginationDiv) {
            paginationDiv.innerHTML = '';
        }
    } catch (error) {
        console.error('[KPIs RAN] Erreur chargement tableau:', error);
    }
}

/**
 * Charge les graphiques RAN
 */
async function loadRanCharts() {
    try {
        const result = await fetchRanKpisPayload();
        if (!result.success) return;
        
        const kpis = result.data.kpis;
        
        // Graphique 2G
        if (kpis['2G'] && Object.keys(kpis['2G']).length > 0) {
            chartManager.createBarChart('kpi2GChart', {
                labels: Object.keys(kpis['2G']),
                datasets: [{ label: 'Performance (%)', data: Object.values(kpis['2G']), backgroundColor: API.COLORS.tech['2G'] }]
            }, {
                scales: {
                    y: { beginAtZero: true, ticks: { callback: v => v + '%' } }
                },
                plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y}%` } } }
            });
        }
        
        // Graphique 3G
        if (kpis['3G'] && Object.keys(kpis['3G']).length > 0) {
            chartManager.createRadarChart('kpi3GChart', {
                labels: Object.keys(kpis['3G']),
                datasets: [{ label: 'Performance (%)', data: Object.values(kpis['3G']), backgroundColor: 'rgba(0,163,196,0.2)', borderColor: API.COLORS.tech['4G'] }]
            }, {
                scales: { r: { beginAtZero: true, ticks: { callback: v => v + '%' } } },
                plugins: { legend: { position: 'bottom' } }
            });
        }
        
        // Graphique 4G
        if (kpis['4G'] && Object.keys(kpis['4G']).length > 0) {
            chartManager.createLineChart('kpi4GChart', {
                labels: Object.keys(kpis['4G']),
                datasets: [{ label: 'Performance (%)', data: Object.values(kpis['4G']), borderColor: API.COLORS.tech['3G'], fill: true }]
            }, {
                scales: { y: { beginAtZero: true, ticks: { callback: v => v + '%' } } },
                plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y}%` } } }
            });
        }
        
        // Graphiques de répartition
        const distribution = result.data.distribution;
        if (distribution) {
            chartManager.createPieChart('vendorChart', {
                labels: ['Huawei', 'Ericsson'],
                datasets: [{ data: [distribution.huawei || 0, distribution.ericsson || 0], backgroundColor: [API.COLORS.vendor['Huawei'], API.COLORS.vendor['Ericsson']] }]
            });
            
            chartManager.createPieChart('techChart', {
                labels: ['2G', '3G', '4G'],
                datasets: [{ data: [distribution['2G'] || 0, distribution['3G'] || 0, distribution['4G'] || 0], backgroundColor: [API.COLORS.tech['2G'], API.COLORS.tech['3G'], API.COLORS.tech['4G']] }]
            });
            
            chartManager.createBarChart('countryChart', {
                labels: distribution.countries?.map(c => c.name) || [],
                datasets: [{ label: 'Nombre de sites', data: distribution.countries?.map(c => c.count) || [], backgroundColor: API.COLORS.tech['4G'] }]
            });
        }
    } catch (error) {
        console.error('[KPIs RAN] Erreur chargement graphiques:', error);
    }
}

/**
 * Initialise les filtres
 */
function initRanFilters() {
    const applyBtn = document.getElementById('applyFilters');
    const resetBtn = document.getElementById('resetFilters');
    const countrySelect = document.getElementById('filterCountry');
    const vendorSelect = document.getElementById('filterVendor');
    const techSelect = document.getElementById('filterTech');
    const worstKpiSelect = document.getElementById('filterWorstKpi');

    const refreshKpiOptions = async () => {
        await refreshWorstKpiOptions({
            country: countrySelect?.value || 'all',
            vendor: vendorSelect?.value || 'all',
            tech: techSelect?.value || 'all'
        });
    };

    techSelect?.addEventListener('change', refreshKpiOptions);
    countrySelect?.addEventListener('change', () => {
        if ((techSelect?.value || 'all') !== 'all') refreshKpiOptions();
    });
    vendorSelect?.addEventListener('change', () => {
        if ((techSelect?.value || 'all') !== 'all') refreshKpiOptions();
    });
    
    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            ranFilters = {
                country: countrySelect?.value || 'all',
                vendor: vendorSelect?.value || 'all',
                tech: techSelect?.value || 'all',
                worstKpi: (worstKpiSelect && !worstKpiSelect.disabled) ? (worstKpiSelect.value || 'all') : 'all'
            };
            // Invalider le cache KPIs après changement de filtres.
            ranKpisCacheData = null;
            ranKpisCacheKey = '';
            ranCurrentPage = 1;
            // Même stratégie que map-view: chargement parallèle des blocs indépendants.
            await Promise.all([
                loadRanStats(),
                loadWorstSitesTable(),
                loadRanCharts(),
                loadRanMapMarkers(),
            ]);
            // Afficher les frontières GeoJSON du pays sélectionné
            await showRanCountryBorder(ranFilters.country);
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            const selects = ['filterCountry', 'filterVendor', 'filterTech'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = 'all';
            });
            if (worstKpiSelect) {
                worstKpiSelect.innerHTML = '<option value="all">Tous les KPIs</option>';
                worstKpiSelect.value = 'all';
                worstKpiSelect.disabled = true;
            }
            ranFilters = { country: 'all', vendor: 'all', tech: 'all', worstKpi: 'all' };
            ranKpisCacheData = null;
            ranKpisCacheKey = '';
            const searchInput = document.getElementById('searchSite');
            if (searchInput) searchInput.value = '';
            ranCurrentPage = 1;
            await Promise.all([
                loadRanStats(),
                loadWorstSitesTable(),
                loadRanCharts(),
                loadRanMapMarkers(),
            ]);
            // Supprimer la couche frontières et revenir à la vue globale
            await showRanCountryBorder('all');
        });
    }

    const topByTechCheckbox = document.getElementById('topByTechCheckbox');
    const topByTechNSelect = document.getElementById('topByTechNSelect');

    // Rechargement immédiat du tableau/carte quand l'utilisateur active/désactive
    // le mode top-by-tech, sans attendre un clic sur "Appliquer".
    if (topByTechCheckbox) {
        topByTechCheckbox.addEventListener('change', async () => {
            ranCurrentPage = 1;
            await Promise.all([loadWorstSitesTable(), loadRanMapMarkers()]);
        });
    }

    if (topByTechNSelect) {
        topByTechNSelect.addEventListener('change', async () => {
            if (!topByTechCheckbox?.checked) return;
            ranCurrentPage = 1;
            await Promise.all([loadWorstSitesTable(), loadRanMapMarkers()]);
        });
    }

    refreshWorstKpiOptions({
        country: countrySelect?.value || 'all',
        vendor: vendorSelect?.value || 'all',
        tech: techSelect?.value || 'all'
    });
}

async function refreshWorstKpiOptions(filters = {}) {
    const kpiSelect = document.getElementById('filterWorstKpi');
    if (!kpiSelect) return;

    const selectedTech = filters.tech || 'all';
    const previousValue = kpiSelect.value || 'all';

    if (selectedTech === 'all') {
        kpiSelect.innerHTML = '<option value="all">Tous les KPIs</option>';
        kpiSelect.value = 'all';
        kpiSelect.disabled = true;
        return;
    }

    kpiSelect.disabled = true;
    kpiSelect.innerHTML = '<option value="all">Chargement des KPIs...</option>';

    try {
        const result = await API.getKpisByTechnology({
            country: filters.country || 'all',
            vendor: filters.vendor || 'all',
            domain: 'RAN',
            tech: selectedTech
        });

        const kpis = (result?.success && Array.isArray(result?.data?.kpis)) ? result.data.kpis : [];
        const options = ['<option value="all">Tous les KPIs</option>'];
        kpis.forEach((kpiName) => {
            options.push(`<option value="${escapeHtml(kpiName)}">${escapeHtml(kpiName)}</option>`);
        });

        kpiSelect.innerHTML = options.join('');
        kpiSelect.disabled = false;

        if (kpis.includes(previousValue)) {
            kpiSelect.value = previousValue;
        } else {
            kpiSelect.value = 'all';
        }
    } catch (error) {
        console.error('[KPIs RAN] Erreur chargement liste KPIs:', error);
        kpiSelect.innerHTML = '<option value="all">Tous les KPIs</option>';
        kpiSelect.value = 'all';
        kpiSelect.disabled = false;
    }
}

/**
 * Affiche les frontières GeoJSON du pays sélectionné sur la carte KPIs RAN.
 * Utilise le même endpoint PHP que le dashboard (données/cache partagés).
 * @param {string} countryCode - Code ISO-2 (ex: 'CI', 'BJ') ou 'all' pour vue globale
 */
async function showRanCountryBorder(countryCode) {
    if (!ranMap) return;

    // Supprimer la couche frontières précédente avant d'en créer une nouvelle
    if (ranCountryBorderLayer) {
        ranMap.removeLayer(ranCountryBorderLayer);
        ranCountryBorderLayer = null;
    }

    // Pas de pays spécifique : revenir à la vue globale Afrique de l'Ouest
    if (!countryCode || countryCode === 'all') {
        ranMap.flyTo([8.0, 2.0], 5);
        return;
    }

    try {
        // Utiliser le client API centralisé pour homogénéiser la gestion des erreurs.
        const geojson = await API.getCountryBorder(countryCode);
        if (!geojson || !geojson.type) return;

        // Ajouter la couche GeoJSON avec bordure visible et léger fond translucide
        ranCountryBorderLayer = L.geoJSON(geojson, {
            style: {
                color: '#1e3a5f',
                weight: 2.5,
                opacity: 0.9,
                fillColor: '#1e3a5f',
                fillOpacity: 0.04
            }
        }).addTo(ranMap);

        // Zoomer automatiquement pour que tout le pays soit visible
        ranMap.fitBounds(ranCountryBorderLayer.getBounds(), { padding: [60, 60], maxZoom: 8 });
    } catch (err) {
        console.warn('[KPIs RAN] Frontières pays non disponibles:', err);
    }
}

/**
 * Initialise la recherche de site
 */
function initRanSearch() {
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
                if (ranMap && site.latitude && site.longitude) {
                    ranMap.flyTo([site.latitude, site.longitude], 13);
                }
                showRanSiteDetails(site.id);
            } else {
                alert(`Aucun site trouvé pour : ${query}`);
            }
        } catch (err) {
            console.error('[KPIs RAN] Erreur recherche:', err);
        }
    };

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') performSearch(); });
}

/**
 * Affiche un message d'action non bloquant (succès/info/erreur) dans la page.
 * Évite les alert() et harmonise l'expérience avec les autres pages.
 */
function setActionMessage(targetId, type, text) {
    const el = document.getElementById(targetId);
    if (!el) return;
    if (!text) {
        el.innerHTML = '';
        return;
    }
    const cssByType = {
        success: 'text-success',
        info: 'text-info',
        warning: 'text-warning',
        error: 'text-danger'
    };
    const iconByType = {
        success: 'bi-check-circle',
        info: 'bi-info-circle',
        warning: 'bi-exclamation-triangle',
        error: 'bi-x-circle'
    };
    const cls = cssByType[type] || 'text-info';
    const icon = iconByType[type] || 'bi-info-circle';
    el.innerHTML = `<span class="${cls}"><i class="bi ${icon} me-1"></i>${escapeHtml(text)}</span>`;
}

/**
 * Convertit une période logique (jour/semaine/mois) en bornes de dates.
 */
function getPeriodDateRange(period) {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    let startDate = endDate;

    if (period === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDate = weekAgo.toISOString().split('T')[0];
    } else if (period === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startDate = monthAgo.toISOString().split('T')[0];
    }

    return { startDate, endDate };
}

/**
 * Met à jour le libellé du bouton PDF avec la période sélectionnée.
 * Le libellé persiste entre les exports pour rendre le contexte explicite.
 */
function setPdfPeriodButtonLabel(btn, period) {
    if (!btn) return;

    if (!btn.dataset.defaultHtml) {
        btn.dataset.defaultHtml = btn.innerHTML;
    }

    const periodLabel = period === 'week' ? 'Semaine' : (period === 'month' ? 'Mois' : 'Jour');
    btn.dataset.selectedPeriod = period;
    btn.innerHTML = `<i class="bi bi-file-earmark-pdf"></i> Exporter PDF - ${periodLabel}`;
}

/**
 * Exécute une action liée à un bouton avec:
 * - verrou anti double-clic
 * - spinner sur le bouton actif
 * - restauration fiable du libellé initial
 */
async function runButtonAction(btn, runningLabel, action) {
    if (!btn || btn.dataset.busy === '1') return false;

    // On fige temporairement la largeur du bouton pour éviter les sauts
    // visuels quand le libellé change pendant l'état loading.
    const buttonWidth = Math.ceil(btn.getBoundingClientRect().width);
    btn.dataset.busy = '1';
    btn.dataset.originalHtml = btn.innerHTML;
    btn.dataset.originalMinWidth = btn.style.minWidth || '';
    btn.style.minWidth = `${buttonWidth}px`;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${runningLabel}`;

    try {
        await action();
        return true;
    } finally {
        btn.disabled = false;
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
            delete btn.dataset.originalHtml;
        }
        btn.style.minWidth = btn.dataset.originalMinWidth || '';
        delete btn.dataset.originalMinWidth;
        delete btn.dataset.busy;
    }
}

/**
 * Initialise les rapports
 */
function initRanReports() {
    const exportWorstBtn = document.getElementById('exportWorstSites');
    const exportPdfBtn = document.getElementById('exportPdf');
    const worstPdfMenu = document.getElementById('kpisRanWorstPdfMenu');
    const mainPdfMenu = document.getElementById('kpisRanMainPdfMenu');

    const closeAllPdfMenus = () => {
        [worstPdfMenu, mainPdfMenu].forEach(menu => menu?.classList.remove('show'));
    };

    const togglePdfMenu = (menu) => {
        if (!menu) return;
        const shouldShow = !menu.classList.contains('show');
        closeAllPdfMenus();
        if (shouldShow) menu.classList.add('show');
    };

    // Même comportement que map-view: clic sur le bouton PDF => choix de période.
    if (exportWorstBtn && worstPdfMenu) {
        exportWorstBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePdfMenu(worstPdfMenu);
        });
    }

    if (exportPdfBtn && mainPdfMenu) {
        exportPdfBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePdfMenu(mainPdfMenu);
        });
    }

    // Fermer les menus si clic en dehors.
    document.addEventListener('click', (e) => {
        const clickedInside = e.target.closest('.dropdown-pdf-wrapper');
        if (!clickedInside) closeAllPdfMenus();
    });

    // Gestion des options de période pour les deux menus PDF.
    document.querySelectorAll('#kpisRanWorstPdfMenu .pdf-option, #kpisRanMainPdfMenu .pdf-option').forEach(option => {
        option.addEventListener('click', async (e) => {
            e.stopPropagation();
            const period = option.getAttribute('data-period') || 'day';
            const exportKind = option.getAttribute('data-export-kind') || 'main';
            const periodLabel = period === 'week' ? 'semaine' : (period === 'month' ? 'mois' : 'jour');
            const { startDate, endDate } = getPeriodDateRange(period);

            closeAllPdfMenus();

            const isWorst = exportKind === 'worst';
            const btn = isWorst ? exportWorstBtn : exportPdfBtn;
            const messageTarget = isWorst ? 'worstSitesActionMsg' : 'reportActionMsg';
            const exportType = isWorst ? 'worst_sites' : 'ran';

            // Afficher immédiatement la période choisie dans le bouton concerné.
            setPdfPeriodButtonLabel(btn, period);

            await runButtonAction(btn, 'Export PDF...', async () => {
                setActionMessage(messageTarget, 'info', `Génération du PDF (${periodLabel}) en cours...`);
                try {
                    const result = await API.exportPdf({
                        type: exportType,
                        domain: 'RAN',
                        start_date: startDate,
                        end_date: endDate,
                        ...getBaseRanFilters(),
                        worst_kpi: ranFilters.worstKpi || 'all',
                    });

                    if (result.success && result.url) {
                        const w = window.open(result.url, '_blank');
                        if (!w) {
                            setActionMessage(messageTarget, 'warning', 'Pop-up bloquée: autorisez les pop-ups pour ouvrir le PDF.');
                            return;
                        }
                        setActionMessage(messageTarget, 'success', `Export PDF (${periodLabel}) généré avec succès.`);
                    } else {
                        setActionMessage(messageTarget, 'error', result?.message || result?.error || 'Échec de génération du PDF.');
                    }
                } catch (error) {
                    console.error('[KPIs RAN] Erreur export PDF période:', error);
                    setActionMessage(messageTarget, 'error', 'Erreur pendant l\'export PDF.');
                }
            });
        });
    });

    // Boutons tableau "Pires sites - Analyse détaillée"
    const shareWorstBtn = document.getElementById('shareWorstSites');
    if (shareWorstBtn) {
        shareWorstBtn.addEventListener('click', async () => {
            await runButtonAction(shareWorstBtn, 'Partage...', async () => {
                setActionMessage('worstSitesActionMsg', 'info', 'Préparation du message WhatsApp...');
                try {
                    const result = await API.generateWhatsAppReport({
                        domain: 'RAN',
                        ...getBaseRanFilters(),
                        worst_kpi: ranFilters.worstKpi || 'all'
                    });
                    if (result.success && result.report) {
                        const w = window.open(`https://wa.me/?text=${encodeURIComponent(result.report)}`, '_blank');
                        if (!w) {
                            setActionMessage('worstSitesActionMsg', 'warning', 'Pop-up bloquée: autorisez les pop-ups pour ouvrir WhatsApp.');
                            return;
                        }
                        setActionMessage('worstSitesActionMsg', 'success', 'Message WhatsApp prêt à être envoyé.');
                    } else {
                        setActionMessage('worstSitesActionMsg', 'error', result?.message || result?.error || 'Impossible de préparer le partage.');
                    }
                } catch (error) {
                    console.error('[KPIs RAN] Erreur partage:', error);
                    setActionMessage('worstSitesActionMsg', 'error', 'Erreur pendant la préparation du partage.');
                }
            });
        });
    }

    // Boutons section "Rapports et Analyses KPIs RAN"
    const shareAllBtn = document.getElementById('shareWhatsApp');
    if (shareAllBtn) {
        shareAllBtn.addEventListener('click', async () => {
            await runButtonAction(shareAllBtn, 'Partage...', async () => {
                setActionMessage('reportActionMsg', 'info', 'Préparation du rapport WhatsApp...');
                try {
                    const result = await API.generateWhatsAppReport({
                        domain: 'RAN',
                        ...getBaseRanFilters(),
                        worst_kpi: ranFilters.worstKpi || 'all'
                    });
                    if (result.success && result.report) {
                        const w = window.open(`https://wa.me/?text=${encodeURIComponent(result.report)}`, '_blank');
                        if (!w) {
                            setActionMessage('reportActionMsg', 'warning', 'Pop-up bloquée: autorisez les pop-ups pour ouvrir WhatsApp.');
                            return;
                        }
                        setActionMessage('reportActionMsg', 'success', 'Rapport WhatsApp prêt à être envoyé.');
                    } else {
                        setActionMessage('reportActionMsg', 'error', result?.message || result?.error || 'Impossible de préparer le rapport WhatsApp.');
                    }
                } catch (error) {
                    console.error('[KPIs RAN] Erreur partage WhatsApp:', error);
                    setActionMessage('reportActionMsg', 'error', 'Erreur pendant la préparation du partage WhatsApp.');
                }
            });
        });
    }

    const weeklyBtn = document.getElementById('weeklyComparison');
    if (weeklyBtn) {
        weeklyBtn.addEventListener('click', async () => {
            await runButtonAction(weeklyBtn, 'Analyse...', async () => {
                setActionMessage('reportActionMsg', 'info', 'Calcul de la comparaison hebdomadaire...');
                try {
                    const result = await API.getWeeklyComparison();
                    if (result.success) {
                        const ctx = document.getElementById('comparisonChart')?.getContext('2d');
                        if (ctx) { const old = Chart.getChart('comparisonChart'); if (old) old.destroy(); new Chart(ctx, { type: 'bar', data: result.data }); }
                        const lessons = document.getElementById('comparisonLessons');
                        if (lessons) lessons.innerHTML = result.lessons || '';
                        bootstrap.Modal.getOrCreateInstance(document.getElementById('comparisonModal')).show();
                        setActionMessage('reportActionMsg', 'success', 'Comparaison hebdomadaire générée.');
                    } else {
                        setActionMessage('reportActionMsg', 'error', result?.message || result?.error || 'Comparaison indisponible.');
                    }
                } catch (error) {
                    console.error('[KPIs RAN] Erreur comparaison:', error);
                    setActionMessage('reportActionMsg', 'error', 'Erreur pendant la comparaison hebdomadaire.');
                }
            });
        });
    }

    const exportExcelBtn = document.getElementById('exportExcel');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', async () => {
            await runButtonAction(exportExcelBtn, 'Export Excel...', async () => {
                setActionMessage('reportActionMsg', 'info', 'Génération du fichier Excel en cours...');
                try {
                    const result = await API.exportExcel('worst_sites', {
                        domain: 'RAN',
                        ...getBaseRanFilters(),
                        worst_kpi: ranFilters.worstKpi || 'all'
                    });
                    if (result.success && result.url) {
                        const w = window.open(result.url, '_blank');
                        if (!w) {
                            setActionMessage('reportActionMsg', 'warning', 'Pop-up bloquée: autorisez les pop-ups pour ouvrir le fichier Excel.');
                            return;
                        }
                        setActionMessage('reportActionMsg', 'success', 'Export Excel généré avec succès.');
                    } else if (result.success) {
                        setActionMessage('reportActionMsg', 'info', 'Export Excel généré (vérifiez le dossier exports).');
                    } else {
                        setActionMessage('reportActionMsg', 'error', result?.message || result?.error || 'Échec de génération du fichier Excel.');
                    }
                } catch (error) {
                    console.error('[KPIs RAN] Erreur export Excel:', error);
                    setActionMessage('reportActionMsg', 'error', 'Erreur pendant l\'export Excel.');
                }
            });
        });
    }
}

/**
 * Protège une valeur injectée dans un attribut JS de type quote simple.
 */
function escapeJsSingleQuoted(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Affiche les détails d'un site RAN
 * @param {string} siteId - Identifiant du site
 */
async function showRanSiteDetails(siteId) {
    try {
        const result = await API.getSiteDetails(siteId);
        if (!result.success || !result.data) return;
        
        const site = result.data;
        window.currentSiteForModal = site;
        
        // Titre + sous-titre
        document.getElementById('modalSiteTitle').innerText = site.name;
        const subtitle = document.getElementById('modalSiteSubtitle');
        if (subtitle) subtitle.innerText = `${site.country_name} — ${site.vendor} — ${site.technology}`;

        // Barre de stats (comme image 2)
        const statusLabel = site.status === 'good' ? 'Bon' : (site.status === 'warning' ? 'Alerte' : 'Critique');
        const statusColor = API.statusColor(site.status);
        const lastDate = site.latest_kpis?.kpi_date ?? 'N/A';
        const lastImport = site.latest_kpis?.imported_at ? site.latest_kpis.imported_at.substring(0, 16).replace('T', ' ') : 'N/A';
        const worstKpiName = site.worst_kpi?.worst_kpi_name ?? (site.kpis_by_tech?.[0]?.worst_kpi_name ?? 'N/A');
        const statsBar = document.getElementById('modalStatsBar');
        if (statsBar) statsBar.innerHTML = [
            `<div><span class="text-muted">KPI dégradant</span><br><strong>${escapeHtml(worstKpiName)}</strong></div>`,
            `<div><span class="text-muted">KPI Global</span><br><strong style="color:${statusColor};font-size:1.1rem">${site.kpi_global}%</strong></div>`,
            `<div><span class="text-muted">Statut</span><br><strong style="color:${statusColor}">${statusLabel}</strong></div>`,
            `<div><span class="text-muted">Dernière date KPI</span><br><strong>${lastDate}</strong></div>`,
            `<div><span class="text-muted">Dernier import</span><br><strong>${lastImport}</strong></div>`,
        ].join('');

        // Infos générales (colonne gauche)
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

        // KPIs dégradants par technologie (colonne droite)
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
        
        // Ouvrir le modal immédiatement (ne pas attendre le chart)
        const modalEl = document.getElementById('siteDetailsModal');
        bootstrap.Modal.getOrCreateInstance(modalEl).show();

        // Charger la tendance du KPI le plus dégradant (pas kpi_global)
        try {
            // Trouver la techno avec le kpi_global le plus bas
            const worstTech = (site.kpis_by_tech || []).reduce(
                (min, t) => (!min || parseFloat(t.kpi_global) < parseFloat(min.kpi_global)) ? t : min,
                null
            );
            const worstLabel  = worstTech?.worst_kpi_name ?? null;
            const kpiColumn   = KPI_LABEL_TO_COLUMN[worstLabel] ?? 'kpi_global';
            const kpiDisplay  = worstLabel ?? 'KPI Global';

            const trends = await API.getKpiTrends(siteId, kpiColumn, 14, worstTech?.technology ?? null);
            if (trends.success && trends.data) {
                const trendColor = API.statusColor(site.status);
                // Si les colonnes KPI individuelles sont vides en DB, l'API bascule sur kpi_global
                const usedLabel = trends.data.used_fallback ? 'KPI Global' : kpiDisplay;

                // Options par défaut pour le graphique
                const chartOptions = {
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            ticks: { callback: v => v + '%' }
                        }
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y}%` } }
                    }
                };

                // Si l'API signale qu'on utilise des timestamps heure (kpi_hour),
                // afficher l'heure dans les labels et ajuster les tooltips/axe X.
                if (trends.data.used_hour) {
                    chartOptions.scales.x = {
                        ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 }
                    };
                    chartOptions.plugins.tooltip.callbacks.title = function(items) {
                        if (!items || items.length === 0) return '';
                        return items.map(it => it.label).join(' - ');
                    };
                }

                chartManager.createLineChart('trend5DaysChart', {
                    labels: trends.data.labels,
                    datasets: [{
                        label: `${site.name} — ${usedLabel} (%)`,
                        data: trends.data.values,
                        borderColor: trendColor,
                        backgroundColor: trendColor + '33',
                        fill: true
                    }]
                }, chartOptions);
            }
        } catch (trendErr) {
            console.warn('[KPIs RAN] Tendance non disponible:', trendErr);
        }

        // Bouton partage WhatsApp dans le modal
        const shareBtn = document.getElementById('shareSiteWhatsApp');
        if (shareBtn) {
            shareBtn.onclick = () => {
                const s = window.currentSiteForModal;
                if (!s) return;
                const msg = `📡 *Site: ${s.name} (${s.country_name})*\nID: ${s.id}\nKPI Global: ${s.kpi_global}%\nVendor: ${s.vendor}\nTechno: ${s.technology}\nStatut: ${s.status}`;
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
                } catch (e) { console.error('[KPIs RAN] Export CSV site:', e); }
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
                } catch (e) { console.error('[KPIs RAN] Export PDF site:', e); }
            };
        }
    } catch (error) {
        console.error('[KPIs RAN] Erreur chargement détails:', error);
    }
}

/**
 * Change de page dans le tableau
 * @param {number} page - Numéro de page
 */
function goToRanPage(page) {
    ranCurrentPage = page;
    loadWorstSitesTable();
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', initKpisRan);

// Exporter les fonctions globales
window.showRanSiteDetails = showRanSiteDetails;
window.goToRanPage = goToRanPage;