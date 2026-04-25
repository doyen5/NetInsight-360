/**
 * NetInsight 360 - KPIs CORE
 * Supervisez. Analysez. Optimisez.
 * 
 * Page des KPIs du cœur de réseau (Packet Loss, Latence, Jitter)
 * Toutes les données proviennent de l'API backend
 */

let coreMap = null;
let coreMarkers = [];
let coreCountryBorderLayer = null;
let coreFilters = { country: 'all', vendor: 'all' };
let coreCurrentPage = 1;
let coreItemsPerPage = 10;

/**
 * Mode d'affichage actif sur la carte KPIs CORE.
 * Valeurs possibles : 'cluster' | 'individual' | 'heatmap'
 */
let currentCoreDisplayMode = 'cluster';

/** Instance du gestionnaire de modes (initialisée dans initCoreMap) */
let coreMapModeManager = null;

/** Cache des données carte pour les changements de mode sans re-fetch */
let coreSitesData = [];

/** Référence au layer cluster actif — supprimé avant chaque changement de mode */
let coreClusterLayer = null;

/**
 * Initialise la page KPIs CORE
 */
async function initKpisCore() {
    const isAuth = await checkAuthentication();
    if (!isAuth) return;
    
    await updateUserInterface();
    initCoreMap();
    await loadCoreStats();
    await loadCoreWorstSitesTable();
    await loadCoreCharts();
    initCoreFilters();
    initCoreSearch();
    initCoreReports();
}

/**
 * Initialise la carte CORE
 */
function initCoreMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    coreMap = L.map('map').setView([8.0, 2.0], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(coreMap);

    // Initialiser le gestionnaire des 4 modes d'affichage.
    // Pour CORE, la santé est inversée : un packet_loss élevé est mauvais.
    // On utilise 100 - (packet_loss * 50) comme proxy KPI (0-100) pour la heatmap.
    // Le rendu choroplèthe est désactivé ; le score reste utilisé pour la heatmap.
    coreMapModeManager = new MapModeManager(
        coreMap,
        (s) => {
            if (s.kpi_global !== undefined) return Number(s.kpi_global || 0);
            // Fallback : convertir packet_loss en score (inversé)
            const pl = Number(s.packet_loss || 0);
            return Math.max(0, 100 - pl * 50);
        }
    );
    
    loadCoreMapMarkers();
}

/**
 * Charge les marqueurs sur la carte
 */
async function loadCoreMapMarkers() {
    if (!coreMap) return;
    
    // Nettoyage complet des couches précédentes
    if (coreClusterLayer) { coreMap.removeLayer(coreClusterLayer); coreClusterLayer = null; }
    coreMarkers.forEach(marker => coreMap.removeLayer(marker));
    coreMarkers = [];
    if (coreMapModeManager) coreMapModeManager.clearManagedLayers();
    
    try {
        const result = await API.getSites({ ...coreFilters, domain: 'CORE' });
        if (!result.success || !result.data) return;

        // Mise en cache pour les changements de mode sans re-fetch
        coreSitesData = result.data;
        await renderCoreMapMode(coreSitesData);
        API.updateMapCountBadge({ count: coreMarkers.length, total_count: result.data?.length ?? coreMarkers.length });
    } catch (error) {
        console.error('[KPIs CORE] Erreur chargement marqueurs:', error);
    }
}

/**
 * Change le mode d'affichage de la carte KPIs CORE SANS recharger depuis l'API.
 *
 * Appelé par le <select id="mapDisplayMode"> dans kpis-core.php.
 * @param {string} mode - 'cluster' | 'individual' | 'heatmap'
 */
async function switchCoreDisplayMode(mode) {
    currentCoreDisplayMode = mode;
    if (coreClusterLayer) { coreMap.removeLayer(coreClusterLayer); coreClusterLayer = null; }
    coreMarkers.forEach(m => { try { coreMap.removeLayer(m); } catch (_) {} });
    coreMarkers = [];
    if (coreMapModeManager) coreMapModeManager.clearManagedLayers();

    if (coreSitesData && coreSitesData.length > 0) {
        await renderCoreMapMode(coreSitesData);
    } else {
        await loadCoreMapMarkers();
    }
}

/**
 * Rend les sites CORE sur la carte selon le mode d'affichage actif.
 * Les sites CORE sont représentés par des carrés (rotation 45°) pour les distinguer
 * visuellement des sites RAN (cercles).
 * @param {Array} sites - Sites CORE à afficher
 */
async function renderCoreMapMode(sites) {
    const mode = currentCoreDisplayMode;

    // ── Mode 1 : Clusters ────────────────────────────────────────────────
    if (mode === 'cluster') {
        const clusterGroup = L.markerClusterGroup({
            maxClusterRadius: 55,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                // Couleur CORE unifiée avec teinte bleue (cyan) = domaine CORE
                const sizeClass = count < 20 ? 'small' : (count < 80 ? 'medium' : 'large');
                return L.divIcon({
                    html: `<div class="cluster-bubble cluster-${sizeClass}" style="background:${API.COLORS.tech['CORE']}"><span class="cluster-count">${count}</span></div>`,
                    className: 'custom-kpi-cluster',
                    iconSize: [44, 44]
                });
            }
        });
        coreClusterLayer = clusterGroup;
        coreMap.addLayer(clusterGroup);

        sites.forEach(site => {
            // Carré tourné = icône standardisée pour les sites CORE dans tout le projet
            const icon = L.divIcon({
                html: `<div style="background:${API.COLORS.tech['CORE']}; width:10px; height:10px; border-radius:2px; transform:rotate(45deg); border:1px solid white;"></div>`,
                iconSize: [10, 10]
            });
            const marker = L.marker([site.latitude, site.longitude], { icon });
            marker.bindPopup(`
                <b>${site.name}</b><br>
                <b>ID:</b> ${site.id}<br>
                <b>Pays:</b> ${site.country_name}<br>
                <b>Packet Loss:</b> ${site.packet_loss}%<br>
                <button class="btn btn-sm btn-primary mt-2" onclick="showCoreSiteDetails('${site.id}')">Voir détails</button>
            `);
            clusterGroup.addLayer(marker);
            coreMarkers.push(marker);
        });

    } // ─── fin mode cluster ───────────────────────────────────────────────────

    // ── Mode 2 : Individuel ────────────────────────────────────────────────
    // Carrés CORE individuels, plus grands pour la lisibilité sans clustering.
    else if (mode === 'individual') {
        sites.forEach(site => {
            const icon = L.divIcon({
                html: `<div style="background:${API.COLORS.tech['CORE']}; width:14px; height:14px; border-radius:2px; transform:rotate(45deg); border:2px solid white; box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
                iconSize: [14, 14]
            });
            const marker = L.marker([site.latitude, site.longitude], { icon }).addTo(coreMap);
            marker.bindPopup(`
                <b>${site.name}</b><br>
                <b>ID:</b> ${site.id}<br>
                <b>Pays:</b> ${site.country_name}<br>
                <b>Packet Loss:</b> ${site.packet_loss}%<br>
                <button class="btn btn-sm btn-primary mt-2" onclick="showCoreSiteDetails('${site.id}')">Voir détails</button>
            `);
            coreMarkers.push(marker);
        });
    }

    // ── Mode 3 : Heatmap ────────────────────────────────────────────────
    // Zones rouges = concentrations de sites CORE avec packet_loss élevé.
    else if (mode === 'heatmap') {
        if (coreMapModeManager) coreMapModeManager.applyHeatmap(sites);
    }

    // Le mode choroplèthe a été retiré : aucun traitement supplémentaire.
}

/**
 * Charge les statistiques CORE
 */
async function loadCoreStats() {
    try {
        const result = await API.getCoreKpis(coreFilters);
        if (!result.success) return;
        
        const stats = result.data.stats;
        document.getElementById('avgPacketLoss').innerText = (stats.avg_packet_loss || 0) + '%';
        document.getElementById('avgLatency').innerText = (stats.avg_latency || 0) + ' ms';
        document.getElementById('avgJitter').innerText = (stats.avg_jitter || 0) + ' ms';
        document.getElementById('avgThroughput').innerText = (stats.avg_throughput || 0) + ' Gbps';
        
        const packetLossPercent = Math.min((stats.avg_packet_loss / 2) * 100, 100);
        document.getElementById('packetLossProgress').style.width = packetLossPercent + '%';
        const latencyPercent = Math.min((stats.avg_latency / 100) * 100, 100);
        document.getElementById('latencyProgress').style.width = latencyPercent + '%';
        const jitterPercent = Math.min((stats.avg_jitter / 30) * 100, 100);
        document.getElementById('jitterProgress').style.width = jitterPercent + '%';
        const throughputPercent = Math.min((stats.avg_throughput / 1000) * 100, 100);
        document.getElementById('throughputProgress').style.width = throughputPercent + '%';
    } catch (error) {
        console.error('[KPIs CORE] Erreur chargement stats:', error);
    }
}

/**
 * Charge le tableau des pires sites CORE
 */
async function loadCoreWorstSitesTable() {
    try {
        const result = await API.getTopWorstSites({ ...coreFilters, domain: 'CORE', sort_by: 'packet_loss' });
        if (!result.success) return;
        
        const worst = result.data.worst || [];
        const totalPages = Math.ceil(worst.length / coreItemsPerPage);
        const start = (coreCurrentPage - 1) * coreItemsPerPage;
        const paginated = worst.slice(start, start + coreItemsPerPage);
        
        const tbody = document.getElementById('worstSitesList');
        if (!tbody) return;
        
        if (paginated.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center">Aucun site trouvé</td></tr>';
            return;
        }
        
        tbody.innerHTML = paginated.map((site, idx) => `
            <tr>
                <td>${start + idx + 1}</td>
                <td><strong>${escapeHtml(site.id)}</strong></td>
                <td>${escapeHtml(site.name)}</td>
                <td><i class="bi bi-flag"></i> ${escapeHtml(site.country_name)}</td>
                <td><span style="width:9px;height:9px;border-radius:50%;background:${API.vendorColor(site.vendor)};display:inline-block;margin-right:4px;vertical-align:middle"></span>${escapeHtml(site.vendor)}</td>
                <td><span class="${site.packet_loss > 1 ? 'packetloss-high' : (site.packet_loss > 0.5 ? 'packetloss-medium' : 'packetloss-low')}">${site.packet_loss}%</span></td>
                <td>${site.latency} ms</td>
                <td>${site.jitter} ms</td>
                <td>${site.throughput} Gbps</td>
                <td><span class="status-badge status-${site.status}">${site.status === 'good' ? '✓ OK' : (site.status === 'warning' ? '⚠️ Alerte' : '🔴 Critique')}</span></td>
                <td><button class="btn-details" onclick="showCoreSiteDetails('${site.id}')"><i class="bi bi-eye-fill"></i></button></td>
            </tr>
        `).join('');
        
        const paginationDiv = document.getElementById('paginationControls');
        if (paginationDiv && totalPages > 1) {
            let html = '<nav><ul class="pagination">';
            for (let i = 1; i <= totalPages; i++) {
                html += `<li class="page-item ${i === coreCurrentPage ? 'active' : ''}">
                    <button class="page-link" onclick="goToCorePage(${i})">${i}</button>
                </li>`;
            }
            html += '</ul></nav>';
            paginationDiv.innerHTML = html;
        } else if (paginationDiv) {
            paginationDiv.innerHTML = '';
        }
    } catch (error) {
        console.error('[KPIs CORE] Erreur chargement tableau:', error);
    }
}

/**
 * Charge les graphiques CORE
 */
async function loadCoreCharts() {
    try {
        const result = await API.getCoreKpis(coreFilters);
        if (!result.success) return;
        
        const trends = result.data.trends;
        if (trends) {
            chartManager.createLineChart('packetLossTrendChart', {
                labels: trends.labels,
                datasets: [{ label: 'Packet Loss (%)', data: trends.packet_loss, borderColor: API.COLORS.status.bad, fill: true }]
            });
        }
        
        const byCountry = result.data.by_country;
        if (byCountry) {
            chartManager.createBarChart('latencyCountryChart', {
                labels: byCountry.map(c => c.name),
                datasets: [{ label: 'Packet Loss (%)', data: byCountry.map(c => c.packet_loss), backgroundColor: API.COLORS.tech['4G'] }]
            });
        }
        
        const byVendor = result.data.by_vendor;
        if (byVendor) {
            chartManager.createBarChart('vendorPacketLossChart', {
                labels: ['Huawei', 'Ericsson'],
                datasets: [{ label: 'Packet Loss (%)', data: [byVendor.huawei || 0, byVendor.ericsson || 0], backgroundColor: [API.COLORS.vendor['Huawei'], API.COLORS.vendor['Ericsson']] }]
            });
        }
        
        const distribution = result.data.distribution;
        if (distribution) {
            chartManager.createPieChart('vendorChart', {
                labels: ['Huawei', 'Ericsson'],
                datasets: [{ data: [distribution.huawei || 0, distribution.ericsson || 0], backgroundColor: [API.COLORS.vendor['Huawei'], API.COLORS.vendor['Ericsson']] }]
            });
            
            chartManager.createBarChart('countryChart', {
                labels: distribution.countries?.map(c => c.name) || [],
                datasets: [{ label: 'Nombre de sites CORE', data: distribution.countries?.map(c => c.count) || [], backgroundColor: API.COLORS.tech['4G'] }]
            });
        }
        
        const healthScore = result.data.health_score || 75;
        chartManager.createPieChart('healthScoreChart', {
            labels: ['Santé du réseau', 'Dégradation'],
            datasets: [{ data: [healthScore, 100 - healthScore], backgroundColor: [API.COLORS.status.good, '#e2e8f0'] }]
        });
    } catch (error) {
        console.error('[KPIs CORE] Erreur chargement graphiques:', error);
    }
}

/**
 * Initialise les filtres
 */
async function refreshCoreKpiOptions() {
    const kpiSelect = document.getElementById('filterKpi');
    if (!kpiSelect) return;
    const tech = document.getElementById('filterTech')?.value || 'all';
    const country = document.getElementById('filterCountry')?.value || 'all';
    const vendor = document.getElementById('filterVendor')?.value || 'all';
    if (tech === 'all') {
        kpiSelect.innerHTML = '<option value="all">Tous les KPIs</option>';
        kpiSelect.value = 'all';
        kpiSelect.disabled = true;
        return;
    }
    kpiSelect.disabled = true;
    kpiSelect.innerHTML = '<option value="all">Chargement...</option>';
    try {
        const result = await API.getKpisByTechnology({ country, vendor, tech, domain: 'CORE' });
        const kpis = (result?.success && Array.isArray(result?.data?.kpis)) ? result.data.kpis : [];
        kpiSelect.innerHTML = '<option value="all">Tous les KPIs</option>' +
            kpis.map(k => `<option value="${k}">${k}</option>`).join('');
        kpiSelect.disabled = kpis.length === 0;
    } catch (e) {
        kpiSelect.innerHTML = '<option value="all">Tous les KPIs</option>';
        kpiSelect.disabled = false;
    }
}

function initCoreFilters() {
    const applyBtn = document.getElementById('applyFilters');
    const resetBtn = document.getElementById('resetFilters');
    const techSelect = document.getElementById('filterTech');
    const countrySelect = document.getElementById('filterCountry');
    const vendorSelect = document.getElementById('filterVendor');

    techSelect?.addEventListener('change', refreshCoreKpiOptions);
    countrySelect?.addEventListener('change', () => {
        if ((techSelect?.value || 'all') !== 'all') refreshCoreKpiOptions();
    });
    vendorSelect?.addEventListener('change', () => {
        if ((techSelect?.value || 'all') !== 'all') refreshCoreKpiOptions();
    });
    
    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            const kpiSelect = document.getElementById('filterKpi');
            coreFilters = {
                country: document.getElementById('filterCountry')?.value || 'all',
                vendor: document.getElementById('filterVendor')?.value || 'all',
                tech: document.getElementById('filterTech')?.value || 'all',
                kpi: (kpiSelect && !kpiSelect.disabled) ? (kpiSelect.value || 'all') : 'all'
            };
            coreCurrentPage = 1;
            await loadCoreStats();
            await loadCoreWorstSitesTable();
            await loadCoreCharts();
            await loadCoreMapMarkers();
            await showCoreCountryBorder(coreFilters.country);
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            const selects = ['filterCountry', 'filterVendor', 'filterTech'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = 'all';
            });
            const kpiSelect = document.getElementById('filterKpi');
            if (kpiSelect) {
                kpiSelect.innerHTML = '<option value="all">Tous les KPIs</option>';
                kpiSelect.value = 'all';
                kpiSelect.disabled = true;
            }
            coreFilters = { country: 'all', vendor: 'all', tech: 'all', kpi: 'all' };
            const searchInput = document.getElementById('searchSite');
            if (searchInput) searchInput.value = '';
            coreCurrentPage = 1;
            await loadCoreStats();
            await loadCoreWorstSitesTable();
            await loadCoreCharts();
            await loadCoreMapMarkers();
            await showCoreCountryBorder('all');
        });
    }
}

async function showCoreCountryBorder(countryCode) {
    if (!coreMap) return;

    if (coreCountryBorderLayer) {
        coreMap.removeLayer(coreCountryBorderLayer);
        coreCountryBorderLayer = null;
    }

    if (!countryCode || countryCode === 'all') {
        coreMap.flyTo([8.0, 2.0], 5);
        return;
    }

    try {
        const res = await fetch(`../netinsight360-backend/api/map/get-country-border.php?cc=${encodeURIComponent(countryCode)}`);
        if (!res.ok) return;
        const geojson = await res.json();

        coreCountryBorderLayer = L.geoJSON(geojson, {
            style: {
                color: '#1e3a5f',
                weight: 2.5,
                opacity: 0.9,
                fillColor: '#1e3a5f',
                fillOpacity: 0.04
            }
        }).addTo(coreMap);

        coreMap.fitBounds(coreCountryBorderLayer.getBounds(), { padding: [60, 60], maxZoom: 8 });
    } catch (err) {
        console.warn('[KPIs CORE] Frontières pays non disponibles:', err);
    }
}

/**
 * Initialise la recherche de site
 */
function initCoreSearch() {
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
                if (coreMap && site.latitude && site.longitude) {
                    coreMap.flyTo([site.latitude, site.longitude], 13);
                }
                showCoreSiteDetails(site.id);
            } else {
                alert(`Aucun site trouvé pour : ${query}`);
            }
        } catch (err) {
            console.error('[KPIs CORE] Erreur recherche:', err);
        }
    };

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') performSearch(); });
}

/**
 * Initialise les rapports
 */
function initCoreReports() {
    const exportBtn = document.getElementById('exportWorstSites');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            try {
                const result = await API.exportExcel('worst_sites', { domain: 'CORE', ...coreFilters });
                if (result.success && result.url) window.open(result.url, '_blank');
            } catch (error) {
                console.error('[KPIs CORE] Erreur export:', error);
            }
        });
    }
    
    const shareBtn = document.getElementById('shareWorstSites');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            try {
                const result = await API.generateWhatsAppReport({ domain: 'CORE', ...coreFilters });
                if (result.success && result.report) {
                    window.open(`https://wa.me/?text=${encodeURIComponent(result.report)}`, '_blank');
                }
            } catch (error) {
                console.error('[KPIs CORE] Erreur partage:', error);
            }
        });
    }

    const exportPdfBtn = document.getElementById('exportPdf');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', async () => {
            try {
                const result = await API.exportPdf({ type: 'core', domain: 'CORE', ...coreFilters });
                if (result.success && result.url) window.open(result.url, '_blank');
            } catch (error) {
                console.error('[KPIs CORE] Erreur export PDF:', error);
            }
        });
    }
}

/**
 * Affiche les détails d'un site CORE
 * @param {string} siteId - Identifiant du site
 */
async function showCoreSiteDetails(siteId) {
    try {
        const result = await API.getSiteDetails(siteId);
        if (!result.success || !result.data) return;
        
        const site = result.data;
        window.currentSiteForModal = site;
        
        document.getElementById('modalSiteTitle').innerText = `${site.name} - ${site.country_name}`;
        document.getElementById('modalSiteInfo').innerHTML = `
            <table class="table table-sm">
                <tr><td><strong>ID Site</strong></td><td>${escapeHtml(site.id)}</td> </tr>
                <tr><td><strong>Nom</strong></td><td>${escapeHtml(site.name)}</td> </tr>
                <tr><td><strong>Pays</strong></td><td>${escapeHtml(site.country_name)}</td> </tr>
                <tr><td><strong>Vendor</strong></td><td><span style="width:9px;height:9px;border-radius:50%;background:${API.vendorColor(site.vendor)};display:inline-block;margin-right:4px;vertical-align:middle"></span>${escapeHtml(site.vendor)}</td> </tr>
             </table>
        `;
        
        document.getElementById('modalCoreMetrics').innerHTML = `
            <table class="table table-sm">
                <tr><td><strong>Packet Loss</strong></td><td class="${site.packet_loss > 1 ? 'text-danger' : (site.packet_loss > 0.5 ? 'text-warning' : 'text-success')}">${site.packet_loss}%</td> </tr>
                <tr><td><strong>Latence</strong></td><td>${site.latency} ms</td> </tr>
                <tr><td><strong>Jitter</strong></td><td>${site.jitter} ms</td> </tr>
                <tr><td><strong>Débit</strong></td><td>${site.throughput} Gbps</td> </tr>
             </table>
        `;
        
        const trends = await API.getKpiTrends(siteId, 'packet_loss', 5);
        if (trends.success && trends.data) {
            const options = {
                scales: { y: { ticks: { callback: v => v + '%' } } },
                plugins: { legend: { position: 'bottom' } }
            };
            if (trends.data.used_hour) {
                options.scales.x = { ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 } };
                options.plugins.tooltip = { callbacks: { title: items => (items || []).map(i => i.label).join(' - '), label: ctx => ` ${ctx.parsed.y}%` } };
            }
            chartManager.createLineChart('trend5DaysChart', {
                labels: trends.data.labels,
                datasets: [{
                    label: `${site.name} - Évolution Packet Loss (%)`,
                    data: trends.data.values,
                    borderColor: API.COLORS.status.bad,
                    fill: true
                }]
            }, options);
        }
        
        const modal = new bootstrap.Modal(document.getElementById('siteDetailsModal'));
        modal.show();
    } catch (error) {
        console.error('[KPIs CORE] Erreur chargement détails:', error);
    }
}

/**
 * Change de page dans le tableau
 * @param {number} page - Numéro de page
 */
function goToCorePage(page) {
    coreCurrentPage = page;
    loadCoreWorstSitesTable();
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', initKpisCore);

window.showCoreSiteDetails = showCoreSiteDetails;
window.goToCorePage = goToCorePage;