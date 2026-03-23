/**
 * NetInsight 360 - Cartographie
 * Supervisez. Analysez. Optimisez.
 * 
 * Visualisation géographique des sites réseau avec Leaflet
 * Filtres: Pays, Vendor, Technologie, Domaine, Statut KPI
 */

// ============================================
// DONNÉES SIMULÉES DES SITES
// ============================================

/**
 * Base de données des sites (fusion RAN et CORE)
 */
const mapSitesData = {
    // Côte d'Ivoire (CI)
    CI: {
        name: "Côte d'Ivoire",
        center: [6.9, -5.5],
        zoom: 7,
        sites: [
            // Sites RAN
            { id: "ET763", name: "TOUMODI", lat: 6.56322, lng: -5.03261, vendor: "Huawei", tech: "4G", domain: "RAN", kpi_global: 97.2, status: "good", region: "YAMOUSSOUKRO" },
            { id: "ET866", name: "BODOUASSO", lat: 7.402386, lng: -4.884654, vendor: "Ericsson", tech: "4G", domain: "RAN", kpi_global: 96.8, status: "good", region: "DALOA" },
            { id: "ET857", name: "ZAHIA", lat: 6.916623, lng: -6.578519, vendor: "Huawei", tech: "3G", domain: "RAN", kpi_global: 94.5, status: "warning", region: "BOUAKE" },
            { id: "ET260", name: "GOULIA", lat: 10.0159, lng: -7.20514, vendor: "Ericsson", tech: "3G", domain: "RAN", kpi_global: 92.8, status: "warning", region: "MAN" },
            { id: "ET300", name: "KOTOULA", lat: 10.1405, lng: -7.39811, vendor: "Huawei", tech: "2G", domain: "RAN", kpi_global: 89.5, status: "critical", region: "MAN" },
            { id: "ET709", name: "KOULOUAN", lat: 6.95285, lng: -7.69917, vendor: "Ericsson", tech: "2G", domain: "RAN", kpi_global: 88.2, status: "critical", region: "MAN" },
            // Sites CORE
            { id: "CORE-CI-001", name: "Abidjan Core Hub", lat: 5.336, lng: -4.026, vendor: "Huawei", tech: "CORE", domain: "CORE", kpi_global: 98.2, status: "good", region: "ABIDJAN" },
            { id: "CORE-CI-002", name: "Yamoussoukro Core", lat: 6.827, lng: -5.289, vendor: "Ericsson", tech: "CORE", domain: "CORE", kpi_global: 97.5, status: "good", region: "YAMOUSSOUKRO" }
        ]
    },
    // Niger (NE)
    NE: {
        name: "Niger",
        center: [14.5, 6.0],
        zoom: 6,
        sites: [
            { id: "ZINDER9", name: "ZINDER9", lat: 13.79435, lng: 8.97558, vendor: "Huawei", tech: "4G", domain: "RAN", kpi_global: 96.2, status: "good", region: "ZINDER" },
            { id: "ZOURAR", name: "ZOURAR", lat: 14.28397, lng: 5.36653, vendor: "Ericsson", tech: "3G", domain: "RAN", kpi_global: 93.5, status: "warning", region: "TAHOUA" },
            { id: "YAYA", name: "YAYA", lat: 13.840167, lng: 4.760194, vendor: "Ericsson", tech: "2G", domain: "RAN", kpi_global: 88.5, status: "critical", region: "TAHOUA" },
            { id: "UGAN", name: "UGAN", lat: 13.514331, lng: 2.116119, vendor: "Huawei", tech: "2G", domain: "RAN", kpi_global: 87.2, status: "critical", region: "NIAMEY" },
            { id: "CORE-NE-001", name: "Niamey Core", lat: 13.512, lng: 2.112, vendor: "Huawei", tech: "CORE", domain: "CORE", kpi_global: 96.5, status: "good", region: "NIAMEY" }
        ]
    },
    // Bénin (BJ)
    BJ: {
        name: "Bénin",
        center: [7.5, 2.5],
        zoom: 7,
        sites: [
            { id: "CEB", name: "CEB.", lat: 6.37777, lng: 2.38474, vendor: "Ericsson", tech: "4G", domain: "RAN", kpi_global: 98.5, status: "good", region: "COTONOU" },
            { id: "AKOGBATO_3", name: "AKOGBATO_3", lat: 6.358906, lng: 2.349161, vendor: "Ericsson", tech: "2G", domain: "RAN", kpi_global: 91.5, status: "warning", region: "COTONOU" },
            { id: "WOMEY_5", name: "WOMEY_5", lat: 6.42325, lng: 2.297333, vendor: "Huawei", tech: "2G", domain: "RAN", kpi_global: 89.2, status: "critical", region: "ABOMEY-CALAVI" },
            { id: "CORE-BJ-001", name: "Cotonou Core", lat: 6.496, lng: 2.603, vendor: "Ericsson", tech: "CORE", domain: "CORE", kpi_global: 99.1, status: "good", region: "COTONOU" }
        ]
    },
    // Togo (TG)
    TG: {
        name: "Togo",
        center: [7.0, 1.2],
        zoom: 7,
        sites: [
            { id: "GBAMAKOPE", name: "GBAMAKOPE", lat: 6.266791, lng: 1.256285, vendor: "Huawei", tech: "4G", domain: "RAN", kpi_global: 97.5, status: "good", region: "LOME" },
            { id: "AFAGNAN2", name: "AFAGNAN2", lat: 6.490717, lng: 1.641785, vendor: "Ericsson", tech: "2G", domain: "RAN", kpi_global: 88.9, status: "critical", region: "MARITIME" },
            { id: "CORE-TG-001", name: "Lomé Core", lat: 6.131, lng: 1.223, vendor: "Huawei", tech: "CORE", domain: "CORE", kpi_global: 97.8, status: "good", region: "LOME" }
        ]
    },
    // Centrafrique (CF)
    CF: {
        name: "Centrafrique",
        center: [5.5, 18.5],
        zoom: 7,
        sites: [
            { id: "BG002", name: "BENZ_VI", lat: 4.382278, lng: 18.555722, vendor: "Huawei", tech: "3G", domain: "RAN", kpi_global: 88.5, status: "critical", region: "BANGUI" },
            { id: "BG004", name: "FATIMA", lat: 4.360901, lng: 18.536988, vendor: "Ericsson", tech: "2G", domain: "RAN", kpi_global: 85.2, status: "critical", region: "BANGUI" },
            { id: "BG001", name: "CENTRAL", lat: 4.361025, lng: 18.585589, vendor: "Huawei", tech: "2G", domain: "RAN", kpi_global: 84.8, status: "critical", region: "BANGUI" },
            { id: "CORE-CF-001", name: "Bangui Core", lat: 4.394, lng: 18.558, vendor: "Huawei", tech: "CORE", domain: "CORE", kpi_global: 86.5, status: "critical", region: "BANGUI" }
        ]
    }
};

// ============================================
// VARIABLES GLOBALES
// ============================================
let currentUser = null;
let map = null;
let markersLayer = null;
let currentMarkers = [];
let currentFilters = {
    country: 'all',
    vendor: 'all',
    tech: 'all',
    domain: 'all',
    status: 'all'
};
let currentPage = 1;
let itemsPerPage = 10;
let charts = {};

// ============================================
// FONCTIONS DE GESTION DE SESSION
// ============================================

/**
 * Vérifie l'authentification de l'utilisateur
 */
function checkAuthentication() {
    const storedUser = sessionStorage.getItem('currentUser');
    if (!storedUser) {
        window.location.href = 'index.html';
        return false;
    }
    
    try {
        const user = JSON.parse(storedUser);
        const loginTime = new Date(user.loggedInAt);
        const now = new Date();
        const hoursSinceLogin = (now - loginTime) / (1000 * 60 * 60);
        
        if (hoursSinceLogin > 8) {
            sessionStorage.clear();
            localStorage.removeItem('rememberedUser');
            window.location.href = 'index.html';
            return false;
        }
        
        currentUser = user;
        return true;
    } catch (e) {
        window.location.href = 'index.html';
        return false;
    }
}

/**
 * Initialise la gestion de la déconnexion
 */
function initLogoutHandler() {
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutModal = document.getElementById('logoutConfirmModal');
    const confirmBtn = document.getElementById('confirmLogoutBtn');
    const cancelBtn = document.getElementById('cancelLogoutBtn');
    
    if (!logoutBtn) return;
    
    function executeLogout() {
        logoutBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Déconnexion...';
        logoutBtn.disabled = true;
        
        setTimeout(() => {
            sessionStorage.clear();
            localStorage.removeItem('rememberedUser');
            window.location.href = 'index.html';
        }, 300);
    }
    
    function showLogoutConfirmation() {
        if (logoutModal) logoutModal.classList.add('show');
        else if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) executeLogout();
    }
    
    function hideLogoutConfirmation() {
        if (logoutModal) logoutModal.classList.remove('show');
    }
    
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showLogoutConfirmation();
    });
    
    if (confirmBtn) confirmBtn.addEventListener('click', () => { hideLogoutConfirmation(); executeLogout(); });
    if (cancelBtn) cancelBtn.addEventListener('click', () => hideLogoutConfirmation());
    if (logoutModal) logoutModal.addEventListener('click', (e) => { if (e.target === logoutModal) hideLogoutConfirmation(); });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && logoutModal?.classList.contains('show')) hideLogoutConfirmation();
    });
}

/**
 * Rafraîchit la session
 */
function refreshSession() {
    if (currentUser) {
        currentUser.loggedInAt = new Date().toISOString();
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
}

/**
 * Initialise le rafraîchissement de session
 */
function initSessionRefresh() {
    setInterval(refreshSession, 30 * 60 * 1000);
    ['click', 'mousemove', 'keypress', 'scroll'].forEach(event => {
        document.addEventListener(event, refreshSession);
    });
}

/**
 * Met à jour l'interface utilisateur
 */
function updateUserInterface() {
    if (!currentUser) return;
    
    document.getElementById('userName').innerText = currentUser.name;
    document.getElementById('headerUserName').innerText = currentUser.name;
    
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
    document.getElementById('userAvatar').innerText = initials;
    
    const roleMap = { 'ADMIN': 'Administrateur', 'FO_NPM': 'Agent Superviseur', 'FO_CORE_RAN': 'Agent Partageur', 'CUSTOMER': 'Agent Visualiseur' };
    document.getElementById('headerUserRole').innerText = roleMap[currentUser.role] || 'Utilisateur';
}

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Récupère tous les sites
 */
function getAllSites() {
    let allSites = [];
    for (let countryCode in mapSitesData) {
        const country = mapSitesData[countryCode];
        country.sites.forEach(site => {
            allSites.push({
                ...site,
                country: countryCode,
                countryName: country.name
            });
        });
    }
    return allSites;
}

/**
 * Filtre les sites selon les critères
 */
function filterSites(sites) {
    return sites.filter(site => {
        if (currentFilters.country !== 'all' && site.country !== currentFilters.country) return false;
        if (currentFilters.vendor !== 'all' && site.vendor !== currentFilters.vendor) return false;
        if (currentFilters.tech !== 'all' && site.tech !== currentFilters.tech) return false;
        if (currentFilters.domain !== 'all' && site.domain !== currentFilters.domain) return false;
        if (currentFilters.status !== 'all' && site.status !== currentFilters.status) return false;
        return true;
    });
}

/**
 * Détermine la couleur du marqueur selon le statut
 */
function getMarkerColor(site) {
    if (site.domain === 'CORE') return '#00a3c4';
    switch (site.status) {
        case 'good': return '#10b981';
        case 'warning': return '#f59e0b';
        case 'critical': return '#ef4444';
        default: return '#6b7280';
    }
}

/**
 * Crée un icône personnalisé pour les marqueurs
 */
function createCustomIcon(site) {
    const color = getMarkerColor(site);
    const isCore = site.domain === 'CORE';
    
    if (isCore) {
        return L.divIcon({
            html: `<div style="background:${color}; width:12px; height:12px; border-radius:2px; border:2px solid white; transform:rotate(45deg); box-shadow:0 0 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [12, 12],
            className: 'site-marker'
        });
    }
    
    return L.divIcon({
        html: `<div style="background:${color}; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 0 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        className: 'site-marker'
    });
}

// ============================================
// FONCTIONS DE LA CARTE
// ============================================

/**
 * Initialise la carte Leaflet
 */
function initMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    map = L.map('map').setView([8.0, 2.0], 5);
    
    // Couche de tuiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> | &copy; CartoDB',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
    
    // Couche pour les marqueurs avec clustering
    markersLayer = L.markerClusterGroup({
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        maxClusterRadius: 50
    });
    
    map.addLayer(markersLayer);
    
    updateMapMarkers();
}

/**
 * Met à jour les marqueurs sur la carte
 */
function updateMapMarkers() {
    if (!markersLayer) return;
    
    markersLayer.clearLayers();
    
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites);
    
    filteredSites.forEach(site => {
        const icon = createCustomIcon(site);
        const marker = L.marker([site.lat, site.lng], { icon });
        
        // Popup avec les informations du site
        const statusText = site.status === 'good' ? '✅ Bon' : (site.status === 'warning' ? '⚠️ Alerte' : '🔴 Critique');
        const statusClass = site.status === 'good' ? 'text-success' : (site.status === 'warning' ? 'text-warning' : 'text-danger');
        
        marker.bindPopup(`
            <div style="min-width: 200px;">
                <h6 class="mb-2"><strong>${site.name}</strong></h6>
                <hr class="my-1">
                <div><i class="bi bi-building"></i> <strong>ID:</strong> ${site.id}</div>
                <div><i class="bi bi-flag"></i> <strong>Pays:</strong> ${site.countryName}</div>
                <div><i class="bi bi-building"></i> <strong>Vendor:</strong> ${site.vendor}</div>
                <div><i class="bi bi-signal"></i> <strong>Technologie:</strong> ${site.tech}</div>
                <div><i class="bi bi-diagram-3"></i> <strong>Domaine:</strong> ${site.domain}</div>
                <div><i class="bi bi-bar-chart"></i> <strong>KPI Global:</strong> <span class="${statusClass} fw-bold">${site.kpi_global}%</span></div>
                <div><i class="bi bi-info-circle"></i> <strong>Statut:</strong> ${statusText}</div>
                <hr class="my-1">
                <button class="btn btn-sm btn-primary mt-2 w-100" onclick="showSiteDetails('${site.id}')">Voir détails</button>
            </div>
        `, { className: 'custom-tooltip' });
        
        markersLayer.addLayer(marker);
    });
    
    // Mettre à jour les statistiques de la légende
    updateLegendStats(filteredSites);
}

/**
 * Met à jour les statistiques dans la légende
 */
function updateLegendStats(filteredSites) {
    const siteCount = filteredSites.length;
    const criticalCount = filteredSites.filter(s => s.status === 'critical').length;
    
    document.getElementById('legendSiteCount').innerText = siteCount;
    document.getElementById('legendCriticalCount').innerText = criticalCount;
}

/**
 * Centre la carte sur un pays
 */
function centerOnCountry(countryCode) {
    const country = mapSitesData[countryCode];
    if (country && map) {
        map.flyTo(country.center, country.zoom, { duration: 1.2 });
    }
}

/**
 * Affiche tous les sites dans la vue
 */
function fitBounds() {
    if (!map || !markersLayer) return;
    
    const bounds = markersLayer.getBounds();
    if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [50, 50], duration: 1 });
    }
}

// ============================================
// FONCTIONS DU TABLEAU
// ============================================

/**
 * Met à jour le tableau des sites
 */
function updateSitesTable() {
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites);
    const totalPages = Math.ceil(filteredSites.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const paginatedSites = filteredSites.slice(start, start + itemsPerPage);
    
    const tbody = document.getElementById('sitesTableBody');
    if (!tbody) return;
    
    if (paginatedSites.length === 0) {
        tbody.innerHTML = '米<td colspan="9" class="text-center">Aucun site trouvé</td>米';
        return;
    }
    
    tbody.innerHTML = paginatedSites.map(site => {
        const statusClass = site.status === 'good' ? 'status-good' : (site.status === 'warning' ? 'status-warning' : 'status-critical');
        const statusText = site.status === 'good' ? 'Bon' : (site.status === 'warning' ? 'Alerte' : 'Critique');
        const rowClass = `site-row-${site.status}`;
        
        return `
            <tr class="${rowClass}">
                <td><strong>${site.id}</strong></td>
                <td>${site.name}</td>
                <td><i class="bi bi-flag"></i> ${site.countryName}</td>
                <td>${site.vendor}</td>
                <td><span class="badge-tech">${site.tech}</span></td>
                <td>${site.domain}</td>
                <td><strong>${site.kpi_global}%</strong></td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn-details" onclick="showSiteDetails('${site.id}')" title="Voir détails">
                        <i class="bi bi-eye-fill"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Pagination
    const paginationDiv = document.getElementById('paginationControls');
    if (paginationDiv && totalPages > 1) {
        let paginationHtml = '<nav><ul class="pagination">';
        for (let i = 1; i <= totalPages; i++) {
            paginationHtml += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                <button class="page-link" onclick="goToPage(${i})">${i}</button>
            </li>`;
        }
        paginationHtml += '</ul></nav>';
        paginationDiv.innerHTML = paginationHtml;
    } else if (paginationDiv) {
        paginationDiv.innerHTML = '';
    }
}

/**
 * Change de page
 */
function goToPage(page) {
    currentPage = page;
    updateSitesTable();
}

// ============================================
// FONCTIONS DES GRAPHIQUES
// ============================================

/**
 * Met à jour tous les graphiques
 */
function updateCharts() {
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites);
    
    updateStatusChart(filteredSites);
    updateTechChart(filteredSites);
    updateTopCountriesList(filteredSites);
}

/**
 * Graphique de répartition par statut
 */
function updateStatusChart(sites) {
    const good = sites.filter(s => s.status === 'good').length;
    const warning = sites.filter(s => s.status === 'warning').length;
    const critical = sites.filter(s => s.status === 'critical').length;
    
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;
    
    if (charts.status) charts.status.destroy();
    charts.status = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Bon (≥95%)', 'Alerte (90-95%)', 'Critique (<90%)'],
            datasets: [{
                data: [good, warning, critical],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
            }]
        },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } }
    });
}

/**
 * Graphique de répartition par technologie
 */
function updateTechChart(sites) {
    const twoG = sites.filter(s => s.tech === '2G').length;
    const threeG = sites.filter(s => s.tech === '3G').length;
    const fourG = sites.filter(s => s.tech === '4G').length;
    const core = sites.filter(s => s.tech === 'CORE').length;
    
    const ctx = document.getElementById('techChart');
    if (!ctx) return;
    
    if (charts.tech) charts.tech.destroy();
    charts.tech = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['2G', '3G', '4G', 'CORE'],
            datasets: [{
                label: 'Nombre de sites',
                data: [twoG, threeG, fourG, core],
                backgroundColor: '#00a3c4',
                borderRadius: 8
            }]
        },
        options: { responsive: true, maintainAspectRatio: true, scales: { y: { beginAtZero: true } } }
    });
}

/**
 * Met à jour la liste des top pays
 */
function updateTopCountriesList(sites) {
    const countryMap = new Map();
    sites.forEach(site => {
        countryMap.set(site.country, {
            name: site.countryName,
            count: (countryMap.get(site.country)?.count || 0) + 1
        });
    });
    
    const sorted = Array.from(countryMap.values()).sort((a, b) => b.count - a.count);
    const container = document.getElementById('topCountriesList');
    
    if (container) {
        if (sorted.length === 0) {
            container.innerHTML = '<p class="text-center text-muted py-3">Aucune donnée</p>';
            return;
        }
        
        container.innerHTML = sorted.map(country => `
            <div class="top-country-item" onclick="centerOnCountry('${country.name === 'Côte d\'Ivoire' ? 'CI' : (country.name === 'Niger' ? 'NE' : (country.name === 'Bénin' ? 'BJ' : (country.name === 'Togo' ? 'TG' : 'CF')))}')">
                <span class="top-country-name"><i class="bi bi-flag"></i> ${country.name}</span>
                <span class="top-country-count">${country.count} site(s)</span>
            </div>
        `).join('');
    }
}

// ============================================
// FONCTIONS DU MODAL
// ============================================

/**
 * Affiche les détails d'un site
 */
function showSiteDetails(siteId) {
    const allSites = getAllSites();
    const site = allSites.find(s => s.id === siteId);
    if (!site) return;
    
    const statusText = site.status === 'good' ? 'Bon' : (site.status === 'warning' ? 'Alerte' : 'Critique');
    const statusClass = site.status === 'good' ? 'success' : (site.status === 'warning' ? 'warning' : 'danger');
    
    document.getElementById('modalSiteTitle').innerText = `${site.name} - ${site.countryName}`;
    document.getElementById('modalSiteInfo').innerHTML = `
        <table class="table table-sm">
            <tr><td><strong>ID Site</strong></td><td>${site.id}</td></tr>
            <tr><td><strong>Nom</strong></td><td>${site.name}</td></tr>
            <tr><td><strong>Pays</strong></td><td>${site.countryName}</td></tr>
            <tr><td><strong>Vendor</strong></td><td>${site.vendor}</td></tr>
            <tr><td><strong>Technologie</strong></td><td>${site.tech}</td></tr>
            <tr><td><strong>Domaine</strong></td><td>${site.domain}</td></tr>
        </table>
    `;
    
    document.getElementById('modalSitePerformance').innerHTML = `
        <table class="table table-sm">
            <tr><td><strong>KPI Global</strong></td><td class="text-${statusClass} fw-bold">${site.kpi_global}%</td></tr>
            <tr><td><strong>Statut</strong></td><td><span class="status-badge status-${site.status}">${statusText}</span></td></tr>
        </table>
    `;
    
    document.getElementById('modalSiteLocation').innerHTML = `
        <table class="table table-sm">
            <tr><td><strong>Latitude</strong></td><td>${site.lat}</td></tr>
            <tr><td><strong>Longitude</strong></td><td>${site.lng}</td></tr>
            <tr><td><strong>Région</strong></td><td>${site.region || 'Non spécifiée'}</td></tr>
        </table>
    `;
    
    window.currentSiteForModal = site;
    const modal = new bootstrap.Modal(document.getElementById('siteDetailsModal'));
    modal.show();
}

/**
 * Partage le site sur WhatsApp
 */
function shareSite() {
    if (window.currentSiteForModal) {
        const s = window.currentSiteForModal;
        const msg = `📡 *Site: ${s.name} (${s.countryName})*\nID: ${s.id}\nVendor: ${s.vendor}\nTechno: ${s.tech}\nDomaine: ${s.domain}\nKPI Global: ${s.kpi_global}%\nStatut: ${s.status}\n📍 Position: ${s.lat}, ${s.lng}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
}

/**
 * Partage la carte sur WhatsApp
 */
function shareMap() {
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites);
    const goodCount = filteredSites.filter(s => s.status === 'good').length;
    const warningCount = filteredSites.filter(s => s.status === 'warning').length;
    const criticalCount = filteredSites.filter(s => s.status === 'critical').length;
    
    let msg = `🗺️ *NETINSIGHT 360 - CARTE RÉSEAU* 🗺️\n\n`;
    msg += `📅 Date: ${new Date().toLocaleDateString('fr-FR')}\n`;
    msg += `📍 Sites affichés: ${filteredSites.length}\n\n`;
    msg += `📊 *RÉPARTITION*\n`;
    msg += `✅ Bon: ${goodCount} sites\n`;
    msg += `⚠️ Alerte: ${warningCount} sites\n`;
    msg += `🔴 Critique: ${criticalCount} sites\n\n`;
    msg += `🌍 Filtres appliqués:\n`;
    msg += `- Pays: ${currentFilters.country === 'all' ? 'Tous' : mapSitesData[currentFilters.country]?.name}\n`;
    msg += `- Vendor: ${currentFilters.vendor === 'all' ? 'Tous' : currentFilters.vendor}\n`;
    msg += `- Technologie: ${currentFilters.tech === 'all' ? 'Toutes' : currentFilters.tech}\n`;
    msg += `- Domaine: ${currentFilters.domain === 'all' ? 'Tous' : currentFilters.domain}\n`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

/**
 * Exporte le rapport cartographique
 */
function exportMapReport() {
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites);
    const date = new Date().toISOString().split('T')[0];
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>NetInsight 360 - Rapport Cartographique ${date}</title>
        <style>
            body{font-family:Arial;padding:40px;}
            table{border-collapse:collapse;width:100%;margin-top:20px;}
            th,td{border:1px solid #ddd;padding:8px;text-align:left;}
            th{background:#00a3c4;color:white;}
            .good{color:#10b981;}
            .warning{color:#f59e0b;}
            .critical{color:#ef4444;}
        </style>
        </head>
        <body>
        <h1>🗺️ NetInsight 360 - Rapport Cartographique</h1>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
        <p><strong>Utilisateur:</strong> ${currentUser.name}</p>
        <hr>
        <h2>📊 Synthèse</h2>
        <ul>
            <li>Total sites: ${filteredSites.length}</li>
            <li class="good">✅ Bon (≥95%): ${filteredSites.filter(s => s.status === 'good').length}</li>
            <li class="warning">⚠️ Alerte (90-95%): ${filteredSites.filter(s => s.status === 'warning').length}</li>
            <li class="critical">🔴 Critique (<90%): ${filteredSites.filter(s => s.status === 'critical').length}</li>
        </ul>
        <h2>📍 Liste des sites</h2>
        <table>
            <thead><tr><th>ID</th><th>Nom</th><th>Pays</th><th>Vendor</th><th>Techno</th><th>Domaine</th><th>KPI</th><th>Statut</th></tr></thead>
            <tbody>
                ${filteredSites.map(s => `
                    <tr>
                        <td>${s.id}</td><td>${s.name}</td><td>${s.countryName}</td>
                        <td>${s.vendor}</td><td>${s.tech}</td><td>${s.domain}</td>
                        <td>${s.kpi_global}%</td>
                        <td class="${s.status}">${s.status === 'good' ? 'Bon' : (s.status === 'warning' ? 'Alerte' : 'Critique')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <p><em>Généré automatiquement par NetInsight 360 - ${new Date().toLocaleString()}</em></p>
        </body>
        </html>
    `;
    
    const blob = new Blob([html], { type: 'text/html' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `rapport_cartographique_${date}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Imprime la carte
 */
function printMap() {
    window.print();
}

// ============================================
// INITIALISATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // 1. Vérification de l'authentification
    if (!checkAuthentication()) return;
    
    // 2. Mise à jour de l'interface
    updateUserInterface();
    
    // 3. Initialisation de la déconnexion
    initLogoutHandler();
    initSessionRefresh();
    
    // 4. Date/heure
    function updateDateTime() {
        const now = new Date();
        const dateTimeEl = document.getElementById('currentDateTime');
        if (dateTimeEl) {
            dateTimeEl.innerHTML = `<i class="bi bi-calendar3"></i> ${now.toLocaleDateString('fr-FR')} - ${now.toLocaleTimeString('fr-FR')}`;
        }
    }
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // 5. Initialisation de la carte
    initMap();
    
    // 6. Initialisation des graphiques et tableaux
    updateSitesTable();
    updateCharts();
    
    // 7. Événements des filtres
    const applyFilters = () => {
        currentFilters = {
            country: document.getElementById('filterCountry')?.value || 'all',
            vendor: document.getElementById('filterVendor')?.value || 'all',
            tech: document.getElementById('filterTech')?.value || 'all',
            domain: document.getElementById('filterDomain')?.value || 'all',
            status: document.getElementById('filterStatus')?.value || 'all'
        };
        currentPage = 1;
        updateMapMarkers();
        updateSitesTable();
        updateCharts();
    };
    
    document.getElementById('applyFilters')?.addEventListener('click', applyFilters);
    document.getElementById('resetFilters')?.addEventListener('click', () => {
        const selects = ['filterCountry', 'filterVendor', 'filterTech', 'filterDomain', 'filterStatus'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = 'all';
        });
        currentFilters = { country: 'all', vendor: 'all', tech: 'all', domain: 'all', status: 'all' };
        currentPage = 1;
        updateMapMarkers();
        updateSitesTable();
        updateCharts();
        if (map) map.flyTo([8.0, 2.0], 5);
    });
    
    document.getElementById('fitBoundsBtn')?.addEventListener('click', fitBounds);
    document.getElementById('shareMapBtn')?.addEventListener('click', shareMap);
    document.getElementById('exportMapBtn')?.addEventListener('click', exportMapReport);
    document.getElementById('printMapBtn')?.addEventListener('click', printMap);
    document.getElementById('shareSiteBtn')?.addEventListener('click', shareSite);
    
    // Menu toggle mobile
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('show'));
    }
    
    // Exposer les fonctions globales
    window.showSiteDetails = showSiteDetails;
    window.centerOnCountry = centerOnCountry;
    window.goToPage = goToPage;
});