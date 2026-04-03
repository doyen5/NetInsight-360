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
let countryBorderLayer = null; // Couche Leaflet GeoJSON affichant les frontières du pays sélectionné

/**
 * Affiche un toast en bas à droite avec la date/heure de la dernière connexion
 */
function showLastLoginToast() {
    const raw = sessionStorage.getItem('lastLoginToast');
    if (!raw) return;
    sessionStorage.removeItem('lastLoginToast');

    // Formater la date en français
    const d = new Date(raw.replace(' ', 'T'));
    const formatted = d.toLocaleDateString('fr-FR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const msgEl = document.getElementById('lastLoginMsg');
    const toastEl = document.getElementById('lastLoginToast');
    if (!msgEl || !toastEl) return;

    msgEl.textContent = 'Dernière connexion : ' + formatted;
    new bootstrap.Toast(toastEl).show();
}

// Un seul point d'entrée : initDashboard() gère l'auth, le logout et l'UI

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
 * Affiche les frontières GeoJSON du pays sélectionné sur la carte.
 * Si country = 'all' ou absent, supprime la couche existante.
 * @param {string} countryCode - Code ISO-2 du pays (ex: 'CI') ou 'all'
 */
async function showCountryBorder(countryCode) {
    if (!dashboardMap) return;

    // Supprimer la couche précédente avant d'en créer une nouvelle
    if (countryBorderLayer) {
        dashboardMap.removeLayer(countryBorderLayer);
        countryBorderLayer = null;
    }

    // Pas de pays spécifique : remettre la vue globale Afrique de l'Ouest
    if (!countryCode || countryCode === 'all') {
        dashboardMap.flyTo([8.0, 2.0], 5);
        return;
    }

    try {
        // Appel à notre endpoint PHP qui sert le GeoJSON (depuis le dossier data/geojson/ local)
        const res = await fetch(`../netinsight360-backend/api/map/get-country-border.php?cc=${encodeURIComponent(countryCode)}`);
        if (!res.ok) return;
        const geojson = await res.json();

        // Ajouter la couche GeoJSON avec un style de frontière visible
        countryBorderLayer = L.geoJSON(geojson, {
            style: {
                color: '#1e3a5f',      // Bleu foncé — cohérent avec la charte graphique
                weight: 2.5,
                opacity: 0.9,
                fillColor: '#1e3a5f',
                fillOpacity: 0.04     // Léger fond pour délimiter visuellement le pays
            }
        }).addTo(dashboardMap);

        // Zoomer automatiquement sur le pays avec du padding pour ne pas coller les bords
        dashboardMap.fitBounds(countryBorderLayer.getBounds(), { padding: [60, 60], maxZoom: 8 });
    } catch (err) {
        console.warn('[Dashboard] Frontières pays non disponibles:', err);
    }
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
            // Ignorer les sites sans coordonnées valides
            const lat = Number(site.latitude);
            const lng = Number(site.longitude);
            if (lat === 0 && lng === 0) return;

            const color = API.statusColor(site.status);
            const icon = L.divIcon({
                html: `<div style="background:${color}; width:12px; height:12px; border-radius:50%; border:2px solid white;"></div>`,
                iconSize: [12, 12]
            });
            
            const marker = L.marker([lat, lng], { icon }).addTo(dashboardMap);
            // Afficher technologie + KPI dégradant dans le popup
            const worstLine = site.worst_kpi_name
                ? `<b>KPI dégradant (${site.technology}):</b> ${site.worst_kpi_name} = ${site.worst_kpi_value}%<br>`
                : '';
            marker.bindPopup(`
                <b>${site.name}</b> <span style="font-size:0.8em;background:#e0e7ff;padding:1px 5px;border-radius:4px">${site.technology}</span><br>
                <b>Pays:</b> ${site.country_name}<br>
                <b>Vendor:</b> ${site.vendor}<br>
                <b>KPI Global:</b> ${site.kpi_global}%<br>
                ${worstLine}
                <button class="btn btn-sm btn-primary mt-2" onclick="showSiteDetails('${site.id}')">Voir détails</button>
            `);
            dashboardMarkers.push(marker);
        });
        // Badge : X affichés / Y total
        API.updateMapCountBadge(result);
    } catch (error) {
        console.error('[Dashboard] Erreur chargement marqueurs:', error);
    }

    // Afficher les frontières GeoJSON du pays sélectionné et zoomer dessus
    await showCountryBorder(filters.country || 'all');
}

/**
 * Charge les statistiques du dashboard
 * @param {Object} filters - Filtres optionnels (country, vendor, tech)
 */
async function loadDashboardStats(filters = {}) {
    try {
        const result = await API.getDashboardStats(filters);
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
                        <span class="site-name">${escapeHtml(site.name)}</span>
                        <span style="font-size:0.75em;background:#e0e7ff;padding:1px 5px;border-radius:10px;margin-left:4px">${escapeHtml(site.technology)}</span><br>
                        <small>${site.country_name} | ${site.vendor}</small>
                    </div>
                    <div><span class="badge-good">${site.kpi_global}%</span></div>
                </div>
            `).join('');
        }

        // Afficher Pires 5 (1 par techno si possible, sinon les 5 premiers)
        const worst5 = worst.slice(0, 5);
        const worstContainer = document.getElementById('worstSitesList');
        if (worstContainer) {
            worstContainer.innerHTML = worst5.map(site => {
                const worstLine = site.worst_kpi_name
                    ? `<br><small style="color:#ef4444">⬇ ${escapeHtml(site.worst_kpi_name)}: ${site.worst_kpi_value}%</small>`
                    : '';
                return `
                <div class="site-item" onclick="showSiteDetails('${site.id}')">
                    <div>
                        <span class="site-name">${escapeHtml(site.name)}</span>
                        <span style="font-size:0.75em;background:#fee2e2;padding:1px 5px;border-radius:10px;margin-left:4px">${escapeHtml(site.technology)}</span><br>
                        <small>${site.country_name} | ${site.vendor}</small>
                        ${worstLine}
                    </div>
                    <div><span class="${site.status === 'critical' ? 'badge-critical' : 'badge-warning'}">${site.kpi_global}%</span></div>
                </div>`;
            }).join('');
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
            await loadDashboardStats(filters);
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
            await loadDashboardStats({});
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
                // Centrer la carte puis ouvrir le modal
                if (dashboardMap && site.latitude && site.longitude) {
                    dashboardMap.flyTo([site.latitude, site.longitude], 12);
                }
                showSiteDetails(site.id);
            } else {
                // Afficher un toast discret au lieu d'un alert bloquant
                const notice = document.getElementById('searchNotice');
                if (notice) { notice.textContent = `Aucun site trouvé pour : ${query}`; notice.style.display = 'block'; setTimeout(() => { notice.style.display = 'none'; }, 4000); }
                else alert(`Aucun site trouvé avec: ${query}`);
            }
        } catch (error) {
            console.error('[Dashboard] Erreur recherche:', error);
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
    

    
    const weeklyBtn = document.getElementById('weeklyComparison');
    if (weeklyBtn) {
        weeklyBtn.addEventListener('click', async () => {
            try {
                const result = await API.getWeeklyComparison();
                if (result.success) {
                    // Barre de stats
                    const statsBar = document.getElementById('comparisonStatsBar');
                    if (statsBar && result.data?.datasets?.length === 2) {
                        const [ds1, ds2] = result.data.datasets;
                        const avg = arr => arr.length ? (arr.reduce((a,b) => a+b,0)/arr.length).toFixed(1) : '0';
                        const avgRecent   = avg(ds1.data);
                        const avgPrevious = avg(ds2.data);
                        const diff = (parseFloat(avgRecent) - parseFloat(avgPrevious)).toFixed(2);
                        const diffColor = diff >= 0 ? API.COLORS.trend.up : API.COLORS.trend.down;
                        const techLabels = result.data.labels || [];
                        const techCells = techLabels.map((t, i) => {
                            const v1 = ds1.data[i] ?? 0, v2 = ds2.data[i] ?? 0;
                            const d = (v1 - v2).toFixed(1);
                            const c = d >= 0 ? API.COLORS.trend.up : API.COLORS.trend.down;
                            return `<div class="text-center px-3"><span class="text-muted">${t}</span><br><strong>${v1}%</strong> <span style="color:${c};font-size:0.75rem">${d >= 0 ? '+':''}${d}%</span></div>`;
                        }).join('');
                        statsBar.innerHTML = `
                            <div class="w-100 d-flex justify-content-center gap-4 pb-2 border-bottom">
                                <div class="text-center"><span class="text-muted">Période récente</span><br><strong>${ds1.label}</strong></div>
                                <div class="text-center"><span class="text-muted">Période précédente</span><br><strong>${ds2.label}</strong></div>
                            </div>
                            <div class="w-100 d-flex justify-content-center gap-4 pt-2">
                                ${techCells}
                                <div class="text-center px-3"><span class="text-muted">Évolution globale</span><br><strong style="color:${diffColor}">${diff >= 0 ? '+':''}${diff}%</strong></div>
                            </div>`;
                    }

                    // Graphique compact
                    const ctx = document.getElementById('comparisonChart').getContext('2d');
                    Chart.getChart('comparisonChart')?.destroy();
                    new Chart(ctx, {
                        type: 'bar',
                        data: result.data,
                        options: {
                            responsive: true,
                            plugins: {
                                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                                tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}%` } }
                            },
                            scales: {
                                y: { beginAtZero: false, min: 80, max: 100, ticks: { font: { size: 10 }, callback: v => v + '%' }, grid: { color: '#f0f0f0' } },
                                x: { ticks: { font: { size: 11 } } }
                            }
                        }
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
    if (shareSiteBtn) {
        shareSiteBtn.addEventListener('click', () => {
            const s = window.currentSiteForModal;
            if (!s) return;
            const msg = `📡 *Site: ${s.name} (${s.country_name})*\nID: ${s.id}\nKPI: ${s.kpi_global}%\nVendor: ${s.vendor}\nTechno: ${s.technology}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        });
    }

    const exportExcelBtn = document.getElementById('exportExcel');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', async () => {
            try {
                const filters = {
                    country: document.getElementById('filterCountry')?.value || 'all',
                    vendor:  document.getElementById('filterVendor')?.value  || 'all',
                    tech:    document.getElementById('filterTech')?.value    || 'all',
                    domain:  document.getElementById('filterDomain')?.value  || 'all',
                };
                const result = await API.exportExcel('dashboard', filters);
                if (result.success && result.url) window.open(result.url, '_blank');
                else alert('Rapport Excel généré dans le dossier exports.');
            } catch (error) {
                console.error('[Dashboard] Erreur export Excel:', error);
            }
        });
    }

    const exportPdfBtn = document.getElementById('exportPdf');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', async () => {
            try {
                const filters = {
                    country: document.getElementById('filterCountry')?.value || 'all',
                    vendor:  document.getElementById('filterVendor')?.value  || 'all',
                    tech:    document.getElementById('filterTech')?.value    || 'all',
                    domain:  document.getElementById('filterDomain')?.value  || 'all',
                };
                const result = await API.exportPdf({ type: 'dashboard', ...filters });
                if (result.success && result.url) window.open(result.url, '_blank');
            } catch (error) {
                console.error('[Dashboard] Erreur export PDF:', error);
            }
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
                <tr><td><strong>KPI Global</strong></td>
                    <td class="text-${site.status === 'good' ? 'success' : (site.status === 'warning' ? 'warning' : 'danger')}">${site.kpi_global}%</td></tr>
                <tr><td><strong>Statut</strong></td>
                    <td><span class="status-badge status-${site.status}">${site.status === 'good' ? 'Bon' : (site.status === 'warning' ? 'Alerte' : 'Critique')}</span></td></tr>
                ${site.worst_kpi
                    ? `<tr><td><strong>KPI dégradant</strong></td>
                       <td style="color:#ef4444">⬇ ${escapeHtml(site.worst_kpi.worst_kpi_name)} = ${site.worst_kpi.worst_kpi_value}% <small>(${escapeHtml(site.worst_kpi.technology)})</small></td></tr>`
                    : ''}
                ${(site.kpis_by_tech && site.kpis_by_tech.length > 0)
                    ? site.kpis_by_tech.map(k => `
                        <tr>
                            <td><strong>KPI ${escapeHtml(k.technology)}</strong></td>
                            <td class="text-${k.status === 'good' ? 'success' : (k.status === 'warning' ? 'warning' : 'danger')}">${k.kpi_global}%
                                ${k.worst_kpi_name ? `<br><small style="color:#ef4444">⬇ ${escapeHtml(k.worst_kpi_name)}: ${k.worst_kpi_value}%</small>` : ''}
                            </td>
                        </tr>`).join('')
                    : ''}
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

// Toast "Dernière connexion" : déclenché indépendamment des appels réseau
document.addEventListener('DOMContentLoaded', () => setTimeout(showLastLoginToast, 800));

// Exporter les fonctions globales
window.showSiteDetails = showSiteDetails;