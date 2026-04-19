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
let fullSitesData = []; // cache des marqueurs carte (20 pires/tech)
let fullTableData = []; // cache du tableau (tous les sites filtrés, triés par criticité)
let fullFilters = { country: 'all', vendor: 'all', tech: 'all', domain: 'all', status: 'all' };
let fullCountryBorderLayer = null; // Couche Leaflet GeoJSON des frontières du pays sélectionné
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
}

/**
 * Charge les marqueurs sur la carte
 */
async function loadFullMapMarkers() {
    if (!fullMap) return;
    
    fullMarkers.forEach(marker => fullMap.removeLayer(marker));
    fullMarkers = [];
    
    try {
        // Si une option "Top by Tech" existe sur la page, transmettre le flag
        const queryFilters = { ...fullFilters };
        try {
            const topCb = document.getElementById('topByTechCheckbox');
            if (topCb && topCb.checked) queryFilters.top_by_tech = '1';
        } catch (e) { /* ignore */ }

        const result = await API.getMapMarkers(queryFilters);
        if (!result.success || !result.data) return;
        
        const sites = result.data;
        fullSitesData = sites; // mise en cache pour les graphiques
        
        // Afficher les frontières GeoJSON du pays sélectionné et zoomer dessus
        await showFullCountryBorder(fullFilters.country);
        
        sites.forEach(site => {
            // Skip sites without valid coordinates
            const lat = Number(site.latitude);
            const lng = Number(site.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
                return;
            }
            let color;
            if (site.domain === 'CORE') {
                color = API.COLORS.tech['CORE'];
            } else {
                color = API.statusColor(site.status);
            }
            
            // Créer une icône avec taille réduite (6px au lieu de 12px)
            // Réduit la surcharge visuelle quand de nombreux sites sont affichés sur la carte
            // Les points CORE sont des carrés rotés, les autres sont des cercles colorés par statut
            const icon = L.divIcon({
                html: `<div style="background:${color}; width:6px; height:6px; ${site.domain === 'CORE' ? 'border-radius:1px; transform:rotate(45deg);' : 'border-radius:50%;'} border:1px solid white;"></div>`,
                iconSize: [6, 6]
            });
            
            const marker = L.marker([lat, lng], { icon }).addTo(fullMap);
            // Afficher technologie + KPI dégradant dans le popup
            const worstLine = site.worst_kpi_name
                ? `<b>KPI dégradant:</b> ${site.worst_kpi_name} = ${site.worst_kpi_value}%<br>`
                : '';
            marker.bindPopup(`
                <b>${site.name}</b> <span style="font-size:0.8em;background:#e0e7ff;padding:1px 5px;border-radius:4px">${site.technology}</span><br>
                <b>Pays:</b> ${site.country_name}<br>
                <b>Vendor:</b> <span style="width:9px;height:9px;border-radius:50%;background:${API.vendorColor(site.vendor)};display:inline-block;margin-right:3px;vertical-align:middle"></span>${site.vendor}<br>
                <b>KPI Global:</b> ${site.kpi_global}%<br>
                ${worstLine}
                <button class="btn btn-sm btn-primary mt-2" onclick="showFullSiteDetails('${site.id}')">Voir détails</button>
            `);
            fullMarkers.push(marker);
        });
        
        updateLegendStats(sites);
        // Badge : X affichés / Y total
        API.updateMapCountBadge(result);
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
 * Charge le tableau des sites — appel API dédié, indépendant des marqueurs de la carte.
 * Données triées par kpi_global ASC (pires sites en premier).
 */
async function loadFullSitesTable() {
    try {
        const result = await API.getSites({ ...fullFilters, limit: 1000 });
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

    if (!fullTableData || fullTableData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Aucun site trouvé pour ces filtres</td></tr>';
        const paginationDiv = document.getElementById('paginationControls');
        if (paginationDiv) paginationDiv.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(fullTableData.length / fullItemsPerPage);
    const start      = (fullCurrentPage - 1) * fullItemsPerPage;
    const paginated  = fullTableData.slice(start, start + fullItemsPerPage);

    const statusLabel = s => s === 'good' ? 'Bon' : (s === 'warning' ? 'Alerte' : 'Critique');

    tbody.innerHTML = paginated.map(site => `
        <tr class="site-row-${site.status}">
            <td><strong>${escapeHtml(site.id)}</strong></td>
            <td>${escapeHtml(site.name)}</td>
            <td><i class="bi bi-flag"></i> ${escapeHtml(site.country_name ?? site.country_code)}</td>
            <td><span style="width:9px;height:9px;border-radius:50%;background:${API.vendorColor(site.vendor)};display:inline-block;margin-right:4px;vertical-align:middle"></span>${escapeHtml(site.vendor)}</td>
            <td><strong>${escapeHtml(site.technology)}</strong></td>
            <td>${escapeHtml(site.domain)}</td>
            <td><strong title="${escapeHtml(site.worst_kpi_name || 'N/A')}">${escapeHtml(site.worst_kpi_name || 'N/A')}</strong><br><span style="font-size:0.75rem;color:#4f46e5">${site.worst_kpi_value || 0}%</span></td>
            <td><span class="status-badge status-${site.status}">${statusLabel(site.status)}</span></td>
            <td><button class="btn-details" onclick="showFullSiteDetails('${escapeHtml(site.id)}')"><i class="bi bi-eye-fill"></i></button></td>
        </tr>
    `).join('');

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
    html += `</ul><span class="text-muted ms-2" style="font-size:0.8rem">${fullTableData.length} sites — page ${fullCurrentPage}/${totalPages}</span></nav>`;
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
        const twoG = data.filter(s => s.technology === '2G').length;
        const threeG = data.filter(s => s.technology === '3G').length;
        const fourG = data.filter(s => s.technology === '4G').length;
        const core = data.filter(s => s.technology === 'CORE').length;
        
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
            fullFilters = { country: 'all', vendor: 'all', tech: 'all', domain: 'all', status: 'all' };
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

        // Zoomer automatiquement pour que tout le pays sélectionné soit visible
        // fitBounds() centrera et ajustera automatiquement le zoom selon la taille du pays
        // padding=[60, 60] ajoute de l'espace autour des bordures du pays pour meilleure lisibilité
        // maxZoom=8 évite de zoomer trop fort sur les petits pays
        fullMap.fitBounds(fullCountryBorderLayer.getBounds(), { padding: [60, 60], maxZoom: 8 });
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
                
                // Construire l'URL d'export PDF
                const params = new URLSearchParams({ 
                    type: 'map', 
                    start_date: startDate, 
                    end_date: endDate,
                    ...(fullFilters || {})
                }).toString();
                const url = `/NetInsight%20360/netinsight360-backend/api/reports/export-pdf.php?${params}`;
                window.open(url, '_blank');
            } catch (error) { 
                console.error('[MapView] Erreur export PDF:', error); 
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
            const snapshot = {
                timestamp: new Date().toISOString(),
                filters: fullFilters,
                sitesCount: fullTableData?.length || 0,
                statusCounts: {
                    good: fullTableData?.filter(s => s.status === 'good').length || 0,
                    warning: fullTableData?.filter(s => s.status === 'warning').length || 0,
                    critical: fullTableData?.filter(s => s.status === 'critical').length || 0,
                },
                techCounts: {
                    '2G': fullTableData?.filter(s => s.technology === '2G').length || 0,
                    '3G': fullTableData?.filter(s => s.technology === '3G').length || 0,
                    '4G': fullTableData?.filter(s => s.technology === '4G').length || 0,
                }
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