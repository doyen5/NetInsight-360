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
let ranCountryBorderLayer = null; // Couche Leaflet GeoJSON des frontières du pays sélectionné
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
        // Si l'option 'topByTechCheckbox' est cochée, on demande au backend
        // les X pires sites par technologie (utile à afficher juste après un import).
        const topByTech = document.getElementById('topByTechCheckbox')?.checked;
        if (topByTech) {
            // Appel API dédié retournant { date, top_n, per_tech: { '2G':[...], ... } }
                // Déterminer top_n : choisir la valeur du select si présente, sinon 10
                let topN = 10;
                try {
                    const sel = document.getElementById('topByTechNSelect');
                    if (sel) topN = parseInt(sel.value) || 10;
                } catch (_) { topN = 10; }
                const res = await API.getTopWorstSitesByTech({ ...ranFilters, domain: 'RAN', top_n: topN });
            if (!res.success || !res.data) return;
            // Fusionner les listes par techno pour afficher sur la carte
            const combined = [];
            Object.keys(res.data.per_tech || {}).forEach(tech => {
                (res.data.per_tech[tech] || []).forEach(s => { s._tech_group = tech; combined.push(s); });
            });

            // Créer les marqueurs
            combined.forEach(site => {
                if (!site.latitude || !site.longitude || site.latitude == 0) return;
                const tc = API.techColor(site.technology || site._tech_group) || '#6c757d';
                const icon = L.divIcon({
                    html: `<div style="background:${tc}; width:14px; height:14px; border-radius:50%; border:2px solid white;"></div>`,
                    iconSize: [14, 14]
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
                    <small class="text-muted">Tech group: ${site._tech_group}</small><br>
                    <button class="btn btn-sm btn-primary mt-2" onclick="showRanSiteDetails('${site.id}')">Voir détails</button>
                `);
                ranMarkers.push(marker);
            });

            // Mettre à jour le badge avec le nombre affiché
            API.updateMapCountBadge({ count: combined.length, total_count: combined.length });
            return;
        }

        // Mode normal : récupérer les marqueurs standards (tous les sites selon filtre)
        const result = await API.getMapMarkers({ ...ranFilters, domain: 'RAN' });
        if (!result.success || !result.data) return;
        
        result.data.forEach(site => {
            if (!site.latitude || !site.longitude || site.latitude == 0) return;
            const color = API.statusColor(site.status);
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
        // Badge : X affichés / Y total
        API.updateMapCountBadge(result);
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
                datasets: [{ data: [distribution.huawei || 0, distribution.ericsson || 0], backgroundColor: [API.COLORS.tech['4G'], API.COLORS.tech['3G']] }]
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
            ranFilters = { country: 'all', vendor: 'all', tech: 'all' };
            ranCurrentPage = 1;
            await loadRanStats();
            await loadWorstSitesTable();
            await loadRanCharts();
            await loadRanMapMarkers();
            // Supprimer la couche frontières et revenir à la vue globale
            await showRanCountryBorder('all');
        });
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
        const res = await fetch(`../netinsight360-backend/api/map/get-country-border.php?cc=${encodeURIComponent(countryCode)}`);
        if (!res.ok) return;
        const geojson = await res.json();

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

    const exportExcelBtn = document.getElementById('exportExcel');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', async () => {
            try {
                const result = await API.exportExcel('worst_sites', { domain: 'RAN', ...ranFilters });
                if (result.success && result.url) window.open(result.url, '_blank');
                else alert('Export Excel généré dans le dossier exports.');
            } catch (error) { console.error('[KPIs RAN] Erreur export Excel:', error); }
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