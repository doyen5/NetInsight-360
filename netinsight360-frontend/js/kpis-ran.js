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
        
        tbody.innerHTML = paginated.map((site, idx) => {
            const worstLabel = site.worst_kpi_name
                ? `<span style="font-size:0.8rem">${escapeHtml(site.worst_kpi_name)}</span><br><strong>${site.worst_kpi_value}%</strong>`
                : `<strong>${site.kpi_global}%</strong>`;
            return `<tr class="site-row-${site.status}">
                <td>${start + idx + 1}</td>
                <td><strong>${escapeHtml(site.id)}</strong></td>
                <td>${escapeHtml(site.name)}</td>
                <td><i class="bi bi-flag"></i> ${escapeHtml(site.country_name)}</td>
                <td><span class="badge-tech">${site.technology}</span></td>
                <td>${site.vendor}</td>
                <td>${worstLabel}</td>
                <td><span class="status-badge status-${site.status}">${site.status === 'good' ? '✓ OK' : (site.status === 'warning' ? '⚠️ Alerte' : '🔴 Critique')}</span></td>
                <td><button class="btn-details" onclick="showRanSiteDetails('${site.id}')"><i class="bi bi-eye-fill"></i></button></td>
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
                const result = await API.exportPdf({ type: 'worst_sites', domain: 'RAN', ...ranFilters });
                if (result.success && result.url) window.open(result.url, '_blank');
            } catch (error) { console.error('[KPIs RAN] Erreur export PDF:', error); }
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

    const exportPdfBtn = document.getElementById('exportPdf');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', async () => {
            try {
                const result = await API.exportPdf({ type: 'ran', domain: 'RAN', ...ranFilters });
                if (result.success && result.url) window.open(result.url, '_blank');
            } catch (error) { console.error('[KPIs RAN] Erreur export PDF:', error); }
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
        
        // Titre + sous-titre
        document.getElementById('modalSiteTitle').innerText = site.name;
        const subtitle = document.getElementById('modalSiteSubtitle');
        if (subtitle) subtitle.innerText = `${site.country_name} — ${site.vendor} — ${site.technology}`;

        // Barre de stats (comme image 2)
        const statusLabel = site.status === 'good' ? 'Bon' : (site.status === 'warning' ? 'Alerte' : 'Critique');
        const statusColor = site.status === 'good' ? '#10b981' : (site.status === 'warning' ? '#f59e0b' : '#ef4444');
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
                const techColors = { '2G': '#10b981', '3G': '#00a3c4', '4G': '#f59e0b' };
                worstDiv.innerHTML = techs.map(t => {
                    const tc = techColors[t.technology] || '#6c757d';
                    const kpiGlobalColor = t.status === 'good' ? '#10b981' : (t.status === 'warning' ? '#f59e0b' : '#ef4444');
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

            const trends = await API.getKpiTrends(siteId, kpiColumn, 14);
            if (trends.success && trends.data) {
                const trendColor = site.status === 'good' ? '#10b981' : (site.status === 'warning' ? '#f59e0b' : '#ef4444');
                chartManager.createLineChart('trend5DaysChart', {
                    labels: trends.data.labels,
                    datasets: [{
                        label: `${site.name} — ${kpiDisplay} (%)`,
                        data: trends.data.values,
                        borderColor: trendColor,
                        backgroundColor: trendColor + '33',
                        fill: true
                    }]
                });
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