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
let fullSitesData = []; // cache des sites chargés pour les graphiques
let fullFilters = { country: 'all', vendor: 'all', tech: 'all', domain: 'all', status: 'all' };
let fullCurrentPage = 1;
let fullItemsPerPage = 10;

/**
 * Initialise la page de cartographie
 */
async function initMapView() {
    const isAuth = await checkAuthentication();
    if (!isAuth) return;
    
    await updateUserInterface();
    initFullMap();
    await loadFullMapMarkers();
    await loadFullSitesTable();
    await loadFullCharts();
    initFullFilters();
    initFullReports();
}

/**
 * Initialise la carte
 */
function initFullMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    fullMap = L.map('map').setView([8.0, 2.0], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(fullMap);
}

/**
 * Charge les marqueurs sur la carte
 */
async function loadFullMapMarkers() {
    if (!fullMap) return;
    
    fullMarkers.forEach(marker => fullMap.removeLayer(marker));
    fullMarkers = [];
    
    try {
        const result = await API.getMapMarkers(fullFilters);
        if (!result.success || !result.data) return;
        
        const sites = result.data;
        fullSitesData = sites; // mise en cache pour les graphiques
        
        // Centrer la carte si un seul pays
        if (fullFilters.country !== 'all') {
            try {
                const countryBounds = await API.getCountryBounds(fullFilters.country);
                if (countryBounds.success && countryBounds.data) {
                    fullMap.flyTo(countryBounds.data.center, countryBounds.data.zoom);
                }
            } catch (e) { /* silencieux si non disponible */ }
        }
        
        sites.forEach(site => {
            // Skip sites without valid coordinates
            const lat = Number(site.latitude);
            const lng = Number(site.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
                return;
            }
            let color;
            if (site.domain === 'CORE') {
                color = '#00a3c4';
            } else if (site.status === 'good') {
                color = '#10b981';
            } else if (site.status === 'warning') {
                color = '#f59e0b';
            } else {
                color = '#ef4444';
            }
            
            const icon = L.divIcon({
                html: `<div style="background:${color}; width:12px; height:12px; ${site.domain === 'CORE' ? 'border-radius:2px; transform:rotate(45deg);' : 'border-radius:50%;'} border:2px solid white;"></div>`,
                iconSize: [12, 12]
            });
            
            const marker = L.marker([lat, lng], { icon }).addTo(fullMap);
            // Afficher technologie + KPI dégradant dans le popup
            const worstLine = site.worst_kpi_name
                ? `<b>KPI dégradant:</b> ${site.worst_kpi_name} = ${site.worst_kpi_value}%<br>`
                : '';
            marker.bindPopup(`
                <b>${site.name}</b> <span style="font-size:0.8em;background:#e0e7ff;padding:1px 5px;border-radius:4px">${site.technology}</span><br>
                <b>Pays:</b> ${site.country_name}<br>
                <b>Vendor:</b> ${site.vendor}<br>
                <b>KPI Global:</b> ${site.kpi_global}%<br>
                ${worstLine}
                <button class="btn btn-sm btn-primary mt-2" onclick="showFullSiteDetails('${site.id}')">Voir détails</button>
            `);
            fullMarkers.push(marker);
        });
        
        updateLegendStats(sites);
    } catch (error) {
        console.error('[MapView] Erreur chargement marqueurs:', error);
    }
}

/**
 * Met à jour les statistiques de la légende
 */
function updateLegendStats(sites) {
    const siteCount = sites.length;
    const criticalCount = sites.filter(s => s.status === 'critical').length;
    document.getElementById('legendSiteCount').innerText = siteCount;
    document.getElementById('legendCriticalCount').innerText = criticalCount;
}

/**
 * Charge le tableau des sites
 */
async function loadFullSitesTable() {
    try {
        // Utiliser les données de la carte si disponibles, sinon appel API avec limite élevée
        let sites = fullSitesData;
        if (!sites || sites.length === 0) {
            const result = await API.getSites({ ...fullFilters, limit: 9999 });
            if (!result.success || !result.data) return;
            sites = result.data;
        }
        const totalPages = Math.ceil(sites.length / fullItemsPerPage);
        const start = (fullCurrentPage - 1) * fullItemsPerPage;
        const paginated = sites.slice(start, start + fullItemsPerPage);
        
        const tbody = document.getElementById('sitesTableBody');
        if (!tbody) return;
        
        if (paginated.length === 0) {
            tbody.innerHTML = '米<td colspan="9" class="text-center">Aucun site trouvé</td>米';
            return;
        }
        
        tbody.innerHTML = paginated.map(site => `
            <tr class="site-row-${site.status}">
                <td><strong>${escapeHtml(site.id)}</strong></td>
                <td>${escapeHtml(site.name)}</td>
                <td><i class="bi bi-flag"></i> ${escapeHtml(site.country_name)}</td>
                <td>${site.vendor}</td>
                <td><span class="badge-tech">${site.technology}</span></td>
                <td>${site.domain}</td>
                <td><strong>${site.kpi_global}%</strong></td>
                <td><span class="status-badge status-${site.status}">${site.status === 'good' ? 'Bon' : (site.status === 'warning' ? 'Alerte' : 'Critique')}</span></td>
                <td><button class="btn-details" onclick="showFullSiteDetails('${site.id}')"><i class="bi bi-eye-fill"></i></button></td>
             </tr>
        `).join('');
        
        const paginationDiv = document.getElementById('paginationControls');
        if (paginationDiv && totalPages > 1) {
            let html = '<nav><ul class="pagination">';
            for (let i = 1; i <= totalPages; i++) {
                html += `<li class="page-item ${i === fullCurrentPage ? 'active' : ''}">
                    <button class="page-link" onclick="goToFullPage(${i})">${i}</button>
                </li>`;
            }
            html += '</ul></nav>';
            paginationDiv.innerHTML = html;
        } else if (paginationDiv) {
            paginationDiv.innerHTML = '';
        }
    } catch (error) {
        console.error('[MapView] Erreur chargement tableau:', error);
    }
}

/**
 * Charge les graphiques (utilise les données déjà en cache)
 */
async function loadFullCharts() {
    try {
        // Utiliser les données déjà chargées (évite un double appel API)
        let data = fullSitesData;
        if (!data || data.length === 0) {
            const result = await API.getSites({ ...fullFilters, limit: 9999 });
            if (!result.success || !result.data) return;
            data = result.data;
        }
        
        // Répartition par statut
        const good = data.filter(s => s.status === 'good').length;
        const warning = data.filter(s => s.status === 'warning').length;
        const critical = data.filter(s => s.status === 'critical').length;
        
        chartManager.createPieChart('statusChart', {
            labels: ['Bon (≥95%)', 'Alerte (90-95%)', 'Critique (<90%)'],
            datasets: [{ data: [good, warning, critical], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'] }]
        });
        
        // Répartition par technologie
        const twoG = data.filter(s => s.technology === '2G').length;
        const threeG = data.filter(s => s.technology === '3G').length;
        const fourG = data.filter(s => s.technology === '4G').length;
        const core = data.filter(s => s.technology === 'CORE').length;
        
        chartManager.createBarChart('techChart', {
            labels: ['2G', '3G', '4G', 'CORE'],
            datasets: [{ label: 'Nombre de sites', data: [twoG, threeG, fourG, core], backgroundColor: '#00a3c4' }]
        });
        
        // Top pays
        const countryMap = new Map();
        data.forEach(site => {
            countryMap.set(site.country_name, (countryMap.get(site.country_name) || 0) + 1);
        });
        const sorted = Array.from(countryMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
        
        const container = document.getElementById('topCountriesList');
        if (container) {
            container.innerHTML = sorted.map(([name, count]) => `
                <div class="top-country-item" onclick="centerOnCountry('${name}')">
                    <span class="top-country-name"><i class="bi bi-flag"></i> ${name}</span>
                    <span class="top-country-count">${count} site(s)</span>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('[MapView] Erreur chargement graphiques:', error);
    }
}

/**
 * Initialise les filtres
 */
function initFullFilters() {
    const applyBtn = document.getElementById('applyFilters');
    const resetBtn = document.getElementById('resetFilters');
    const fitBoundsBtn = document.getElementById('fitBoundsBtn');
    
    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            fullFilters = {
                country: document.getElementById('filterCountry')?.value || 'all',
                vendor: document.getElementById('filterVendor')?.value || 'all',
                tech: document.getElementById('filterTech')?.value || 'all',
                domain: document.getElementById('filterDomain')?.value || 'all',
                status: document.getElementById('filterStatus')?.value || 'all'
            };
            fullCurrentPage = 1;
            await loadFullMapMarkers();
            await loadFullSitesTable();
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
            fullFilters = { country: 'all', vendor: 'all', tech: 'all', domain: 'all', status: 'all' };
            fullCurrentPage = 1;
            await loadFullMapMarkers();
            await loadFullSitesTable();
            await loadFullCharts();
            if (fullMap) fullMap.flyTo([8.0, 2.0], 5);
        });
    }
    
    if (fitBoundsBtn && fullMap && fullMarkers.length) {
        fitBoundsBtn.addEventListener('click', () => {
            const bounds = L.latLngBounds(fullMarkers.map(m => m.getLatLng()));
            fullMap.flyToBounds(bounds, { padding: [50, 50] });
        });
    }
}

/**
 * Initialise les rapports
 */
function initFullReports() {
    const shareBtn = document.getElementById('shareMapBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            try {
                const result = await API.generateWhatsAppReport({ type: 'map', filters: fullFilters });
                if (result.success && result.report) {
                    window.open(`https://wa.me/?text=${encodeURIComponent(result.report)}`, '_blank');
                }
            } catch (error) {
                console.error('[MapView] Erreur partage:', error);
            }
        });
    }
    
    const exportBtn = document.getElementById('exportMapBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            try {
                const result = await API.generatePowerpointReport({ type: 'map', filters: fullFilters });
                if (result.success && result.url) window.open(result.url, '_blank');
            } catch (error) {
                console.error('[MapView] Erreur export:', error);
            }
        });
    }
    
    const printBtn = document.getElementById('printMapBtn');
    if (printBtn) {
        printBtn.addEventListener('click', () => window.print());
    }

    const exportPdfMapBtn = document.getElementById('exportPdfMapBtn');
    if (exportPdfMapBtn) {
        exportPdfMapBtn.addEventListener('click', async () => {
            try {
                const result = await API.exportPdf({ type: 'map', ...fullFilters });
                if (result.success && result.url) window.open(result.url, '_blank');
            } catch (error) { console.error('[MapView] Erreur export PDF:', error); }
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
 * Affiche les détails d'un site
 * @param {string} siteId - Identifiant du site
 */
async function showFullSiteDetails(siteId) {
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
                <tr><td><strong>Vendor</strong></td><td>${escapeHtml(site.vendor)}</td> </tr>
                <tr><td><strong>Technologie</strong></td><td>${escapeHtml(site.technology)}</td> </tr>
                <tr><td><strong>Domaine</strong></td><td>${escapeHtml(site.domain)}</td> </tr>
             </table>
        `;
        
        document.getElementById('modalSitePerformance').innerHTML = `
            <table class="table table-sm">
                <tr><td><strong>KPI Global</strong></td><td class="text-${site.status === 'good' ? 'success' : (site.status === 'warning' ? 'warning' : 'danger')}">${site.kpi_global}%</td> </tr>
                <tr><td><strong>Statut</strong></td><td><span class="status-badge status-${site.status}">${site.status === 'good' ? 'Bon' : (site.status === 'warning' ? 'Alerte' : 'Critique')}</span></td> </tr>
             </table>
        `;
        
        document.getElementById('modalSiteLocation').innerHTML = `
            <table class="table table-sm">
                <tr><td><strong>Latitude</strong></td><td>${site.latitude || 'N/A'}</td> </tr>
                <tr><td><strong>Longitude</strong></td><td>${site.longitude || 'N/A'}</td> </tr>
                 </table>
        `;
        
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('siteDetailsModal'));
        modal.show();
    } catch (error) {
        console.error('[MapView] Erreur chargement détails:', error);
    }
}

/**
 * Change de page dans le tableau
 * @param {number} page - Numéro de page
 */
function goToFullPage(page) {
    fullCurrentPage = page;
    loadFullSitesTable();
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', initMapView);

window.centerOnCountry = centerOnCountry;
window.showFullSiteDetails = showFullSiteDetails;
window.goToFullPage = goToFullPage;