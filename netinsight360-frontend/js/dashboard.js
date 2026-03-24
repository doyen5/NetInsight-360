/**
 * NetInsight 360 - Dashboard
 * Supervisez. Analysez. Optimisez.
 * 
 * Page principale avec les KPIs synthétiques, carte, top/pires sites
 * Toutes les données proviennent de l'API backend
 */

let dashboardMap = null;
let dashboardMarkers = [];
let dashboardCharts = {};

// Initialiser la gestion de déconnexion au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    // Vérifier que l'utilisateur est connecté
    checkAuthentication().then(() => {
        // Initialiser la déconnexion
        initLogoutHandler();
        // Mettre à jour l'interface
        updateUserInterface();
    });
});

/**
 * Initialise le dashboard
 */
async function initDashboard() {
    // Vérifier l'authentification
    const isAuth = await checkAuthentication();
    if (!isAuth) return;
    
    // Mettre à jour l'interface utilisateur
    await updateUserInterface();
    
    // Initialiser la carte
    initDashboardMap();
    
    // Charger les données
    await loadDashboardStats();
    await loadTopWorstSites();
    await loadDashboardCharts();
    
    // Initialiser les filtres
    initDashboardFilters();
    
    // Initialiser la recherche
    initDashboardSearch();
    
    // Initialiser les rapports
    initDashboardReports();
}

/**
 * Initialise la carte du dashboard
 */
function initDashboardMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    dashboardMap = L.map('map').setView([8.0, 2.0], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(dashboardMap);
    
    loadMapMarkers();
}

/**
 * Charge les marqueurs sur la carte
 */
async function loadMapMarkers(filters = {}) {
    if (!dashboardMap) return;
    
    // Supprimer les anciens marqueurs
    dashboardMarkers.forEach(marker => dashboardMap.removeLayer(marker));
    dashboardMarkers = [];
    
    try {
        const result = await API.getMapMarkers(filters);
        if (!result.success || !result.data) return;
        
        result.data.forEach(site => {
            const color = site.status === 'good' ? '#10b981' : (site.status === 'warning' ? '#f59e0b' : '#ef4444');
            const icon = L.divIcon({
                html: `<div style="background:${color}; width:12px; height:12px; border-radius:50%; border:2px solid white;"></div>`,
                iconSize: [12, 12]
            });
            
            const marker = L.marker([site.latitude, site.longitude], { icon }).addTo(dashboardMap);
            marker.bindPopup(`
                <b>${site.name}</b><br>
                <b>ID:</b> ${site.id}<br>
                <b>Pays:</b> ${site.country_name}<br>
                <b>Vendor:</b> ${site.vendor}<br>
                <b>KPI:</b> ${site.kpi_global}%<br>
                <button class="btn btn-sm btn-primary mt-2" onclick="showSiteDetails('${site.id}')">Voir détails</button>
            `);
            dashboardMarkers.push(marker);
        });
    } catch (error) {
        console.error('[Dashboard] Erreur chargement marqueurs:', error);
    }
}

/**
 * Charge les statistiques du dashboard
 */
async function loadDashboardStats() {
    try {
        const result = await API.getDashboardStats();
        if (!result.success) return;
        
        const stats = result.data;
        document.getElementById('totalUsers').innerText = stats.total_users || 0;
        document.getElementById('totalSites').innerText = stats.total_sites || 0;
        document.getElementById('globalRanAvail').innerText = (stats.avg_ran_availability || 0) + '%';
        document.getElementById('globalPacketLoss').innerText = (stats.avg_packet_loss || 0) + '%';
    } catch (error) {
        console.error('[Dashboard] Erreur chargement stats:', error);
    }
}

/**
 * Charge les top et pires sites
 */
async function loadTopWorstSites(filters = {}) {
    try {
        const result = await API.getTopWorstSites(filters);
        if (!result.success) return;
        
        const { top, worst } = result.data;
        
        // Afficher Top 5
        const topContainer = document.getElementById('topSitesList');
        if (topContainer) {
            topContainer.innerHTML = top.map(site => `
                <div class="site-item" onclick="showSiteDetails('${site.id}')">
                    <div>
                        <span class="site-name">${escapeHtml(site.name)}</span><br>
                        <small>${site.country_name} | ${site.vendor} | ${site.technology}</small>
                    </div>
                    <div><span class="badge-good">${site.kpi_global}%</span></div>
                </div>
            `).join('');
        }
        
        // Afficher Pires 5
        const worstContainer = document.getElementById('worstSitesList');
        if (worstContainer) {
            worstContainer.innerHTML = worst.map(site => `
                <div class="site-item" onclick="showSiteDetails('${site.id}')">
                    <div>
                        <span class="site-name">${escapeHtml(site.name)}</span><br>
                        <small>${site.country_name} | ${site.vendor} | ${site.technology}</small>
                    </div>
                    <div><span class="${site.status === 'critical' ? 'badge-critical' : 'badge-warning'}">${site.kpi_global}%</span></div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('[Dashboard] Erreur chargement top/worst sites:', error);
    }
}

/**
 * Charge les graphiques du dashboard
 */
async function loadDashboardCharts() {
    try {
        const trends = await API.getGlobalTrends('RNA');
        if (trends.success) {
            chartManager.createLineChart('ranTrendChart', {
                labels: trends.data.labels,
                datasets: [{
                    label: 'RNA (%)',
                    data: trends.data.values,
                    borderColor: '#00a3c4',
                    fill: true,
                    tension: 0.4
                }]
            });
        }
        
        const packetLoss = await API.getGlobalTrends('packet_loss');
        if (packetLoss.success) {
            chartManager.createBarChart('packetLossChart', {
                labels: packetLoss.data.labels,
                datasets: [{
                    label: 'Packet Loss (%)',
                    data: packetLoss.data.values,
                    backgroundColor: '#f59e0b'
                }]
            });
        }
    } catch (error) {
        console.error('[Dashboard] Erreur chargement graphiques:', error);
    }
}

/**
 * Initialise les filtres du dashboard
 */
function initDashboardFilters() {
    const applyBtn = document.getElementById('applyFilters');
    const resetBtn = document.getElementById('resetFilters');
    
    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            const filters = {
                country: document.getElementById('filterCountry')?.value || 'all',
                vendor: document.getElementById('filterVendor')?.value || 'all',
                tech: document.getElementById('filterTech')?.value || 'all',
                domain: document.getElementById('filterDomain')?.value || 'all'
            };
            
            await loadTopWorstSites(filters);
            await loadMapMarkers(filters);
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            const selects = ['filterCountry', 'filterVendor', 'filterTech', 'filterDomain'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = 'all';
            });
            
            await loadTopWorstSites({});
            await loadMapMarkers({});
            if (dashboardMap) dashboardMap.flyTo([8.0, 2.0], 5);
        });
    }
}

/**
 * Initialise la recherche de site
 */
function initDashboardSearch() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchSite');
    
    if (!searchBtn || !searchInput) return;
    
    const performSearch = async () => {
        const query = searchInput.value.trim();
        if (!query) {
            alert('Veuillez entrer un nom de site ou un ID');
            return;
        }
        
        try {
            const result = await API.searchSite(query);
            if (result.success && result.data) {
                const site = result.data;
                showSiteDetails(site.id);
                if (dashboardMap && site.latitude && site.longitude) {
                    dashboardMap.flyTo([site.latitude, site.longitude], 12);
                }
                const statusMsg = site.status === 'good' ? '✅ Site en bonne santé' : 
                                 (site.status === 'warning' ? '⚠️ Site à surveiller' : '🔴 Site dégradé');
                alert(`Site trouvé: ${site.name}\n${statusMsg}\nKPI: ${site.kpi_global}%`);
            } else {
                alert(`Aucun site trouvé avec: ${query}`);
            }
        } catch (error) {
            console.error('[Dashboard] Erreur recherche:', error);
            alert('Erreur lors de la recherche');
        }
    };
    
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
}

/**
 * Initialise les rapports
 */
function initDashboardReports() {
    const shareBtn = document.getElementById('shareWhatsApp');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            try {
                const result = await API.generateWhatsAppReport();
                if (result.success && result.report) {
                    window.open(`https://wa.me/?text=${encodeURIComponent(result.report)}`, '_blank');
                }
            } catch (error) {
                console.error('[Dashboard] Erreur génération rapport:', error);
            }
        });
    }
    
    const exportBtn = document.getElementById('exportPowerPoint');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            try {
                const result = await API.generatePowerpointReport();
                if (result.success && result.url) {
                    window.open(result.url, '_blank');
                } else {
                    alert('Rapport généré. Vérifiez le dossier des exports.');
                }
            } catch (error) {
                console.error('[Dashboard] Erreur export:', error);
                alert('Erreur lors de l\'export');
            }
        });
    }
    
    const weeklyBtn = document.getElementById('weeklyComparison');
    if (weeklyBtn) {
        weeklyBtn.addEventListener('click', async () => {
            try {
                const result = await API.getWeeklyComparison();
                if (result.success) {
                    const ctx = document.getElementById('comparisonChart').getContext('2d');
                    new Chart(ctx, {
                        type: 'bar',
                        data: result.data
                    });
                    document.getElementById('comparisonLessons').innerHTML = result.lessons || '';
                    new bootstrap.Modal(document.getElementById('comparisonModal')).show();
                }
            } catch (error) {
                console.error('[Dashboard] Erreur comparaison:', error);
            }
        });
    }
    
    const shareSiteBtn = document.getElementById('shareSiteBtn');
    if (shareSiteBtn && window.currentSiteForModal) {
        shareSiteBtn.addEventListener('click', () => {
            const s = window.currentSiteForModal;
            const msg = `📡 *Site: ${s.name} (${s.country_name})*\nID: ${s.id}\nKPI: ${s.kpi_global}%\nVendor: ${s.vendor}\nTechno: ${s.technology}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        });
    }
}

/**
 * Affiche les détails d'un site
 * @param {string} siteId - Identifiant du site
 */
async function showSiteDetails(siteId) {
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
                <tr><td><strong>Domaine</strong></td><td>${escapeHtml(site.domain)}</td></tr>
            </table>
        `;
        
        document.getElementById('modalSitePerformance').innerHTML = `
            <table class="table table-sm">
                <tr><td><strong>KPI Global</strong></td><td class="text-${site.status === 'good' ? 'success' : (site.status === 'warning' ? 'warning' : 'danger')}">${site.kpi_global}%</td></tr>
                <tr><td><strong>Statut</strong></td><td><span class="status-badge status-${site.status}">${site.status === 'good' ? 'Bon' : (site.status === 'warning' ? 'Alerte' : 'Critique')}</span></td></tr>
            </table>
        `;
        
        document.getElementById('modalSiteLocation').innerHTML = `
            <table class="table table-sm">
                <tr><td><strong>Latitude</strong></td><td>${site.latitude || 'N/A'}</td></tr>
                <tr><td><strong>Longitude</strong></td><td>${site.longitude || 'N/A'}</td></tr>
                <tr><td><strong>Région</strong></td><td>${site.region || 'Non spécifiée'}</td></tr>
            </table>
        `;
        
        new bootstrap.Modal(document.getElementById('siteDetailsModal')).show();
    } catch (error) {
        console.error('[Dashboard] Erreur chargement détails site:', error);
    }
}

/**
 * Échappe les caractères HTML
 * @param {string} text - Texte à échapper
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', initDashboard);

// Exporter les fonctions globales
window.showSiteDetails = showSiteDetails;