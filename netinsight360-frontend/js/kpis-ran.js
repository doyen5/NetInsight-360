/**
 * NetInsight 360 - KPIs RAN
 * Supervisez. Analysez. Optimisez.
 * 
 * Page des KPIs Radio Access Network (2G/3G/4G)
 * Toutes les données proviennent de l'API backend
 */

let ranMap = null;
let ranMarkers = [];
let ranFilters = { country: 'all', vendor: 'all', tech: 'all' };
let ranCurrentPage = 1;
let ranItemsPerPage = 10;

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
    
    // Charger les données
    await loadRanStats();
    await loadWorstSitesTable();
    await loadRanCharts();
    
    // Initialiser les filtres
    initRanFilters();
    
    // Initialiser les rapports
    initRanReports();
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
    
    loadRanMapMarkers();
}

/**
 * Charge les marqueurs sur la carte
 */
async function loadRanMapMarkers() {
    if (!ranMap) return;
    
    ranMarkers.forEach(marker => ranMap.removeLayer(marker));
    ranMarkers = [];
    
    try {
        const result = await API.getMapMarkers({ ...ranFilters, domain: 'RAN' });
        if (!result.success || !result.data) return;
        
        result.data.forEach(site => {
            if (!site.latitude || !site.longitude || site.latitude == 0) return;
            const color = site.status === 'good' ? '#10b981' : (site.status === 'warning' ? '#f59e0b' : '#ef4444');
            const icon = L.divIcon({
                html: `<div style="background:${color}; width:12px; height:12px; border-radius:50%; border:2px solid white;"></div>`,
                iconSize: [12, 12]
            });
            
            const marker = L.marker([site.latitude, site.longitude], { icon }).addTo(ranMap);
            const worstLine = site.worst_kpi_name
                ? `<br><b>KPI dégradant:</b> ${site.worst_kpi_name} (${site.worst_kpi_value}%)`
                : '';
            marker.bindPopup(`
                <b>${site.name}</b><br>
                <b>ID:</b> ${site.id}<br>
                <b>Pays:</b> ${site.country_name || site.country_code}<br>
                <b>Vendor:</b> ${site.vendor} | <span class="badge-tech">${site.technology}</span><br>
                <b>KPI global:</b> ${site.kpi_global}%${worstLine}<br>
                <button class="btn btn-sm btn-primary mt-2" onclick="showRanSiteDetails('${site.id}')">Voir détails</button>
            `);
            ranMarkers.push(marker);
        });
    } catch (error) {
        console.error('[KPIs RAN] Erreur chargement marqueurs:', error);
    }
}

/**
 * Charge les statistiques RAN
 */
async function loadRanStats() {
    try {
        const result = await API.getRanKpis(ranFilters);
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
        const result = await API.getTopWorstSites({ ...ranFilters, domain: 'RAN' });
        if (!result.success) return;
        
        const worst = result.data.worst || [];
        const totalPages = Math.ceil(worst.length / ranItemsPerPage);
        const start = (ranCurrentPage - 1) * ranItemsPerPage;
        const paginated = worst.slice(start, start + ranItemsPerPage);
        
        const tbody = document.getElementById('worstSitesList');
        if (!tbody) return;
        
        if (paginated.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">Aucun site trouvé</td></tr>';
            return;
        }
        
        tbody.innerHTML = paginated.map((site, idx) => `
            <tr class="site-row-${site.status}">
                <td>${start + idx + 1}</td>
                <td><strong>${escapeHtml(site.id)}</strong></td>
                <td>${escapeHtml(site.name)}</td>
                <td><i class="bi bi-flag"></i> ${escapeHtml(site.country_name)}</td>
                <td><span class="badge-tech">${site.technology}</span></td>
                <td>${site.vendor}</td>
                <td><strong>${site.kpi_global}%</strong></td>
                <td><span class="status-badge status-${site.status}">${site.status === 'good' ? '✓ OK' : (site.status === 'warning' ? '⚠️ Alerte' : '🔴 Critique')}</span></td>
                <td><button class="btn-details" onclick="showRanSiteDetails('${site.id}')"><i class="bi bi-eye-fill"></i></button></td>
            </tr>
        `).join('');
        
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
        const result = await API.getRanKpis(ranFilters);
        if (!result.success) return;
        
        const kpis = result.data.kpis;
        
        // Graphique 2G
        if (kpis['2G']) {
            chartManager.createBarChart('kpi2GChart', {
                labels: Object.keys(kpis['2G']),
                datasets: [{ label: 'Performance (%)', data: Object.values(kpis['2G']), backgroundColor: '#10b981' }]
            });
        }
        
        // Graphique 3G
        if (kpis['3G']) {
            chartManager.createRadarChart('kpi3GChart', {
                labels: Object.keys(kpis['3G']),
                datasets: [{ label: 'Performance (%)', data: Object.values(kpis['3G']), backgroundColor: 'rgba(0,163,196,0.2)', borderColor: '#00a3c4' }]
            });
        }
        
        // Graphique 4G
        if (kpis['4G']) {
            chartManager.createLineChart('kpi4GChart', {
                labels: Object.keys(kpis['4G']),
                datasets: [{ label: 'Performance (%)', data: Object.values(kpis['4G']), borderColor: '#f59e0b', fill: true }]
            });
        }
        
        // Graphiques de répartition
        const distribution = result.data.distribution;
        if (distribution) {
            chartManager.createPieChart('vendorChart', {
                labels: ['Huawei', 'Ericsson'],
                datasets: [{ data: [distribution.huawei || 0, distribution.ericsson || 0], backgroundColor: ['#00a3c4', '#f59e0b'] }]
            });
            
            chartManager.createPieChart('techChart', {
                labels: ['2G', '3G', '4G'],
                datasets: [{ data: [distribution['2G'] || 0, distribution['3G'] || 0, distribution['4G'] || 0], backgroundColor: ['#10b981', '#f59e0b', '#00a3c4'] }]
            });
            
            chartManager.createBarChart('countryChart', {
                labels: distribution.countries?.map(c => c.name) || [],
                datasets: [{ label: 'Nombre de sites', data: distribution.countries?.map(c => c.count) || [], backgroundColor: '#00a3c4' }]
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
    
    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            ranFilters = {
                country: document.getElementById('filterCountry')?.value || 'all',
                vendor: document.getElementById('filterVendor')?.value || 'all',
                tech: document.getElementById('filterTech')?.value || 'all'
            };
            ranCurrentPage = 1;
            await loadRanStats();
            await loadWorstSitesTable();
            await loadRanCharts();
            await loadRanMapMarkers();
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            const selects = ['filterCountry', 'filterVendor', 'filterTech'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = 'all';
            });
            ranFilters = { country: 'all', vendor: 'all', tech: 'all' };
            ranCurrentPage = 1;
            await loadRanStats();
            await loadWorstSitesTable();
            await loadRanCharts();
            await loadRanMapMarkers();
            if (ranMap) ranMap.flyTo([8.0, 2.0], 5);
        });
    }
}

/**
 * Initialise les rapports
 */
function initRanReports() {
    // Boutons tableau "Pires sites - Analyse détaillée"
    const exportWorstBtn = document.getElementById('exportWorstSites');
    if (exportWorstBtn) {
        exportWorstBtn.addEventListener('click', async () => {
            try {
                const result = await API.exportExcel('worst_sites', { domain: 'RAN', ...ranFilters });
                if (result.success && result.url) window.open(result.url, '_blank');
            } catch (error) { console.error('[KPIs RAN] Erreur export:', error); }
        });
    }

    const shareWorstBtn = document.getElementById('shareWorstSites');
    if (shareWorstBtn) {
        shareWorstBtn.addEventListener('click', async () => {
            try {
                const result = await API.generateWhatsAppReport({ domain: 'RAN', ...ranFilters });
                if (result.success && result.report)
                    window.open(`https://wa.me/?text=${encodeURIComponent(result.report)}`, '_blank');
            } catch (error) { console.error('[KPIs RAN] Erreur partage:', error); }
        });
    }

    // Boutons section "Rapports et Analyses KPIs RAN"
    const shareAllBtn = document.getElementById('shareWhatsApp');
    if (shareAllBtn) {
        shareAllBtn.addEventListener('click', async () => {
            try {
                const result = await API.generateWhatsAppReport({ domain: 'RAN', ...ranFilters });
                if (result.success && result.report)
                    window.open(`https://wa.me/?text=${encodeURIComponent(result.report)}`, '_blank');
            } catch (error) { console.error('[KPIs RAN] Erreur partage WhatsApp:', error); }
        });
    }

    const exportPptBtn = document.getElementById('exportPowerPoint');
    if (exportPptBtn) {
        exportPptBtn.addEventListener('click', async () => {
            try {
                const result = await API.generatePowerpointReport({ domain: 'RAN', ...ranFilters });
                if (result.success && result.url) window.open(result.url, '_blank');
            } catch (error) { console.error('[KPIs RAN] Erreur export PPT:', error); }
        });
    }

    const weeklyBtn = document.getElementById('weeklyComparison');
    if (weeklyBtn) {
        weeklyBtn.addEventListener('click', async () => {
            try {
                const result = await API.getWeeklyComparison();
                if (result.success) {
                    const ctx = document.getElementById('comparisonChart')?.getContext('2d');
                    if (ctx) { const old = Chart.getChart('comparisonChart'); if (old) old.destroy(); new Chart(ctx, { type: 'bar', data: result.data }); }
                    const lessons = document.getElementById('comparisonLessons');
                    if (lessons) lessons.innerHTML = result.lessons || '';
                    bootstrap.Modal.getOrCreateInstance(document.getElementById('comparisonModal')).show();
                }
            } catch (error) { console.error('[KPIs RAN] Erreur comparaison:', error); }
        });
    }
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
        
        document.getElementById('modalSiteTitle').innerText = `${site.name} - ${site.country_name}`;
        document.getElementById('modalSiteInfo').innerHTML = `
            <table class="table table-sm">
                <tr><td><strong>ID Site</strong></td><td>${escapeHtml(site.id)}</td></tr>
                <tr><td><strong>Nom</strong></td><td>${escapeHtml(site.name)}</td></tr>
                <tr><td><strong>Pays</strong></td><td>${escapeHtml(site.country_name)}</td></tr>
                <tr><td><strong>Vendor</strong></td><td>${escapeHtml(site.vendor)}</td></tr>
                <tr><td><strong>Technologie</strong></td><td>${escapeHtml(site.technology)}</td></tr>
                <tr><td><strong>KPI Global</strong></td><td>${site.kpi_global}%</td></tr>
            </table>
        `;

        // Pires KPIs par technologie
        const worstDiv = document.getElementById('modalWorstKpis');
        if (worstDiv) {
            const techs = site.kpis_by_tech || [];
            if (techs.length === 0) {
                worstDiv.innerHTML = '<p class="text-muted">Aucune donnée disponible</p>';
            } else {
                worstDiv.innerHTML = techs.map(t => {
                    const kpiLine = t.worst_kpi_name
                        ? `<span class="text-danger">↓ ${escapeHtml(t.worst_kpi_name)}: ${t.worst_kpi_value}%</span>`
                        : '<span class="text-muted">N/A</span>';
                    return `<div class="d-flex justify-content-between align-items-center py-1 border-bottom">
                        <span><span class="badge bg-secondary me-2">${escapeHtml(t.technology)}</span> KPI: <strong>${t.kpi_global}%</strong></span>
                        ${kpiLine}
                    </div>`;
                }).join('');
            }
        }
        
        // Charger les tendances
        const trends = await API.getKpiTrends(siteId, 'RNA', 5);
        if (trends.success && trends.data) {
            chartManager.createLineChart('trend5DaysChart', {
                labels: trends.data.labels,
                datasets: [{
                    label: `${site.name} - Évolution RNA (%)`,
                    data: trends.data.values,
                    borderColor: site.status === 'good' ? '#10b981' : (site.status === 'warning' ? '#f59e0b' : '#ef4444'),
                    fill: true
                }]
            });
        }
        
        // Détruire l'instance précédente du chart pour éviter les conflits
        const existingChart = Chart.getChart('trend5DaysChart');
        if (existingChart) existingChart.destroy();

        const modalEl = document.getElementById('siteDetailsModal');
        bootstrap.Modal.getOrCreateInstance(modalEl).show();

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