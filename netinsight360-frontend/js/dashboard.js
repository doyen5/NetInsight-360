/**
 * NetInsight 360 - Dashboard
 * Supervisez. Analysez. Optimisez.
 * 
 * Page principale du tableau de bord
 * Affiche les KPIs synthétiques, la carte, les top/pires sites
 * Gère l'authentification et la déconnexion
 * 
 * Fonctionnalités:
 * - Affichage du nom de l'utilisateur connecté
 * - Gestion complète de la déconnexion avec modal de confirmation
 * - Filtres par pays, vendor, technologie, domaine
 * - Carte Leaflet des sites
 * - Top 5 meilleurs et pires sites
 * - Graphiques d'évolution RNA et Packet Loss
 * - Rapports WhatsApp et PowerPoint
 */

// ============================================
// DONNÉES SIMULÉES
// ============================================

/**
 * Données des sites pour le dashboard
 * Fusion des données RAN et CORE
 */
const dashboardSitesData = {
    // Côte d'Ivoire (CI)
    CI: {
        name: "Côte d'Ivoire",
        center: [6.9, -5.5],
        zoom: 7,
        sites: [
            // Sites RAN
            { id: "ET763", name: "TOUMODI", lat: 6.56322, lng: -5.03261, vendor: "Huawei", tech: "4G", domain: "RAN", kpi_global: 97.2, status: "good" },
            { id: "ET866", name: "BODOUASSO", lat: 7.402386, lng: -4.884654, vendor: "Ericsson", tech: "4G", domain: "RAN", kpi_global: 96.8, status: "good" },
            { id: "ET857", name: "ZAHIA", lat: 6.916623, lng: -6.578519, vendor: "Huawei", tech: "3G", domain: "RAN", kpi_global: 94.5, status: "warning" },
            { id: "ET260", name: "GOULIA", lat: 10.0159, lng: -7.20514, vendor: "Ericsson", tech: "3G", domain: "RAN", kpi_global: 92.8, status: "warning" },
            { id: "ET300", name: "KOTOULA", lat: 10.1405, lng: -7.39811, vendor: "Huawei", tech: "2G", domain: "RAN", kpi_global: 89.5, status: "critical" },
            { id: "ET709", name: "KOULOUAN", lat: 6.95285, lng: -7.69917, vendor: "Ericsson", tech: "2G", domain: "RAN", kpi_global: 88.2, status: "critical" },
            // Sites CORE
            { id: "CORE-CI-001", name: "Abidjan Core Hub", lat: 5.336, lng: -4.026, vendor: "Huawei", tech: "CORE", domain: "CORE", kpi_global: 98.2, status: "good" },
            { id: "CORE-CI-002", name: "Yamoussoukro Core", lat: 6.827, lng: -5.289, vendor: "Ericsson", tech: "CORE", domain: "CORE", kpi_global: 97.5, status: "good" }
        ]
    },
    // Niger (NE)
    NE: {
        name: "Niger",
        center: [14.5, 6.0],
        zoom: 6,
        sites: [
            { id: "ZINDER9", name: "ZINDER9", lat: 13.79435, lng: 8.97558, vendor: "Huawei", tech: "4G", domain: "RAN", kpi_global: 96.2, status: "good" },
            { id: "ZOURAR", name: "ZOURAR", lat: 14.28397, lng: 5.36653, vendor: "Ericsson", tech: "3G", domain: "RAN", kpi_global: 93.5, status: "warning" },
            { id: "YAYA", name: "YAYA", lat: 13.840167, lng: 4.760194, vendor: "Ericsson", tech: "2G", domain: "RAN", kpi_global: 88.5, status: "critical" },
            { id: "UGAN", name: "UGAN", lat: 13.514331, lng: 2.116119, vendor: "Huawei", tech: "2G", domain: "RAN", kpi_global: 87.2, status: "critical" },
            { id: "CORE-NE-001", name: "Niamey Core", lat: 13.512, lng: 2.112, vendor: "Huawei", tech: "CORE", domain: "CORE", kpi_global: 96.5, status: "good" }
        ]
    },
    // Bénin (BJ)
    BJ: {
        name: "Bénin",
        center: [7.5, 2.5],
        zoom: 7,
        sites: [
            { id: "CEB", name: "CEB.", lat: 6.37777, lng: 2.38474, vendor: "Ericsson", tech: "4G", domain: "RAN", kpi_global: 98.5, status: "good" },
            { id: "AKOGBATO_3", name: "AKOGBATO_3", lat: 6.358906, lng: 2.349161, vendor: "Ericsson", tech: "2G", domain: "RAN", kpi_global: 91.5, status: "warning" },
            { id: "WOMEY_5", name: "WOMEY_5", lat: 6.42325, lng: 2.297333, vendor: "Huawei", tech: "2G", domain: "RAN", kpi_global: 89.2, status: "critical" },
            { id: "CORE-BJ-001", name: "Cotonou Core", lat: 6.496, lng: 2.603, vendor: "Ericsson", tech: "CORE", domain: "CORE", kpi_global: 99.1, status: "good" }
        ]
    },
    // Togo (TG)
    TG: {
        name: "Togo",
        center: [7.0, 1.2],
        zoom: 7,
        sites: [
            { id: "GBAMAKOPE", name: "GBAMAKOPE", lat: 6.266791, lng: 1.256285, vendor: "Huawei", tech: "4G", domain: "RAN", kpi_global: 97.5, status: "good" },
            { id: "AFAGNAN2", name: "AFAGNAN2", lat: 6.490717, lng: 1.641785, vendor: "Ericsson", tech: "2G", domain: "RAN", kpi_global: 88.9, status: "critical" },
            { id: "CORE-TG-001", name: "Lomé Core", lat: 6.131, lng: 1.223, vendor: "Huawei", tech: "CORE", domain: "CORE", kpi_global: 97.8, status: "good" }
        ]
    },
    // Centrafrique (CF)
    CF: {
        name: "Centrafrique",
        center: [5.5, 18.5],
        zoom: 7,
        sites: [
            { id: "BG002", name: "BENZ_VI", lat: 4.382278, lng: 18.555722, vendor: "Huawei", tech: "3G", domain: "RAN", kpi_global: 88.5, status: "critical" },
            { id: "BG004", name: "FATIMA", lat: 4.360901, lng: 18.536988, vendor: "Ericsson", tech: "2G", domain: "RAN", kpi_global: 85.2, status: "critical" },
            { id: "BG001", name: "CENTRAL", lat: 4.361025, lng: 18.585589, vendor: "Huawei", tech: "2G", domain: "RAN", kpi_global: 84.8, status: "critical" },
            { id: "CORE-CF-001", name: "Bangui Core", lat: 4.394, lng: 18.558, vendor: "Huawei", tech: "CORE", domain: "CORE", kpi_global: 86.5, status: "critical" }
        ]
    }
};

// Utilisateurs (pour le comptage)
const dashboardUsers = [
    { id: 1, name: "Prince Désiré", role: "ADMIN", status: "active" },
    { id: 2, name: "Jean Kouadio", role: "FO_NPM", status: "active" },
    { id: 3, name: "Marie Diallo", role: "FO_CORE_RAN", status: "active" },
    { id: 4, name: "Paul Konan", role: "CUSTOMER", status: "active" }
];

// ============================================
// VARIABLES GLOBALES
// ============================================
let currentUser = null;           // Utilisateur connecté
let map = null;                   // Instance de la carte Leaflet
let currentMarkers = [];          // Marqueurs sur la carte
let charts = {};                  // Stockage des graphiques
let currentFilters = {            // Filtres actifs
    country: 'all',
    vendor: 'all',
    tech: 'all',
    domain: 'all'
};

// ============================================
// FONCTIONS DE GESTION DE SESSION ET UTILISATEUR
// ============================================

/**
 * Vérifie l'authentification de l'utilisateur
 * Récupère les informations depuis sessionStorage
 * Redirige vers la page de connexion si non authentifié
 * @returns {boolean} true si authentifié, false sinon
 */
function checkAuthentication() {
    const storedUser = sessionStorage.getItem('currentUser');
    if (!storedUser) {
        console.log('[NetInsight 360] Utilisateur non authentifié, redirection vers login');
        window.location.href = 'index.html';
        return false;
    }
    
    try {
        const user = JSON.parse(storedUser);
        const loginTime = new Date(user.loggedInAt);
        const now = new Date();
        const hoursSinceLogin = (now - loginTime) / (1000 * 60 * 60);
        
        // Vérifier expiration session (8 heures maximum)
        if (hoursSinceLogin > 8) {
            console.log('[NetInsight 360] Session expirée (plus de 8h)');
            sessionStorage.clear();
            localStorage.removeItem('rememberedUser');
            window.location.href = 'index.html';
            return false;
        }
        
        currentUser = user;
        return true;
    } catch (e) {
        console.error('Erreur lors de la vérification de session:', e);
        window.location.href = 'index.html';
        return false;
    }
}

/**
 * Met à jour l'interface utilisateur avec les informations de l'utilisateur connecté
 * Affiche le nom, l'avatar et le rôle dans le header
 */
function updateUserInterface() {
    if (!currentUser) return;
    
    // Mettre à jour le nom dans le message de bienvenue
    const userNameEl = document.getElementById('userName');
    const headerUserNameEl = document.getElementById('headerUserName');
    if (userNameEl) userNameEl.innerText = currentUser.name;
    if (headerUserNameEl) headerUserNameEl.innerText = currentUser.name;
    
    // Générer les initiales pour l'avatar
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
    const userAvatarEl = document.getElementById('userAvatar');
    if (userAvatarEl) userAvatarEl.innerText = initials;
    
    // Afficher le rôle de l'utilisateur
    const roleMap = {
        'ADMIN': 'Administrateur',
        'FO_NPM': 'Agent Superviseur',
        'FO_CORE_RAN': 'Agent Partageur',
        'CUSTOMER': 'Agent Visualiseur'
    };
    const headerUserRoleEl = document.getElementById('headerUserRole');
    if (headerUserRoleEl) headerUserRoleEl.innerText = roleMap[currentUser.role] || 'Utilisateur';
    
    // Appliquer les restrictions selon le rôle
    applyRoleRestrictions();
    
    console.log(`[NetInsight 360] Utilisateur connecté: ${currentUser.name} (${currentUser.role})`);
}

/**
 * Applique les restrictions d'affichage selon le rôle de l'utilisateur
 */
function applyRoleRestrictions() {
    if (!currentUser) return;
    
    const role = currentUser.role;
    
    // Éléments à masquer selon le rôle
    const usersCard = document.getElementById('cardTotalUsers');
    const reportsSection = document.getElementById('reportButtonsRow') || document.querySelector('.report-buttons')?.parentElement?.parentElement;
    
    if (role !== 'ADMIN' && usersCard) {
        usersCard.style.display = 'none';
    }
    
    // Les rapports ne sont pas accessibles aux visualiseurs
    if (role === 'CUSTOMER' && reportsSection) {
        reportsSection.style.display = 'none';
    }
}

/**
 * Initialise la gestion de la déconnexion avec modal de confirmation
 */
function initLogoutHandler() {
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutModal = document.getElementById('logoutConfirmModal');
    const confirmBtn = document.getElementById('confirmLogoutBtn');
    const cancelBtn = document.getElementById('cancelLogoutBtn');
    
    if (!logoutBtn) {
        console.warn('[NetInsight 360] Bouton de déconnexion non trouvé');
        return;
    }
    
    /**
     * Exécute la déconnexion
     * Nettoie toutes les données et redirige vers la page de connexion
     */
    function executeLogout() {
        const originalContent = logoutBtn.innerHTML;
        
        // Afficher l'état de chargement
        logoutBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Déconnexion...';
        logoutBtn.disabled = true;
        
        setTimeout(() => {
            try {
                sessionStorage.clear();
                localStorage.removeItem('rememberedUser');
                console.log('[NetInsight 360] Utilisateur déconnecté le ' + new Date().toLocaleString());
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Erreur lors de la déconnexion:', error);
                logoutBtn.innerHTML = originalContent;
                logoutBtn.disabled = false;
                alert('Erreur lors de la déconnexion. Veuillez réessayer.');
            }
        }, 300);
    }
    
    /**
     * Affiche le modal de confirmation
     */
    function showLogoutConfirmation() {
        if (logoutModal) {
            logoutModal.classList.add('show');
        } else if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            executeLogout();
        }
    }
    
    /**
     * Cache le modal de confirmation
     */
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
 * Rafraîchit la session (prolonge la durée)
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

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Récupère tous les sites
 * @returns {Array} Liste de tous les sites
 */
function getAllSites() {
    let allSites = [];
    for (let countryCode in dashboardSitesData) {
        const country = dashboardSitesData[countryCode];
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
 * @param {Array} sites - Liste des sites
 * @returns {Array} Sites filtrés
 */
function filterSites(sites) {
    return sites.filter(site => {
        if (currentFilters.country !== 'all' && site.country !== currentFilters.country) return false;
        if (currentFilters.vendor !== 'all' && site.vendor !== currentFilters.vendor) return false;
        if (currentFilters.tech !== 'all' && site.tech !== currentFilters.tech) return false;
        if (currentFilters.domain !== 'all' && site.domain !== currentFilters.domain) return false;
        return true;
    });
}

/**
 * Détermine le statut d'un site selon son KPI global
 * @param {number} kpiGlobal - Valeur du KPI
 * @returns {string} 'good', 'warning' ou 'critical'
 */
function getSiteStatus(kpiGlobal) {
    if (kpiGlobal >= 95) return 'good';
    if (kpiGlobal >= 90) return 'warning';
    return 'critical';
}

/**
 * Met à jour les statistiques du dashboard
 */
function updateDashboardStats() {
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites);
    
    // Total utilisateurs (ADMIN uniquement)
    if (currentUser?.role === 'ADMIN') {
        document.getElementById('totalUsers').innerText = dashboardUsers.filter(u => u.status === 'active').length;
    }
    
    // Total sites
    document.getElementById('totalSites').innerText = filteredSites.length;
    
    // Disponibilité RAN moyenne
    const ranSites = filteredSites.filter(s => s.domain === 'RAN');
    const avgRan = ranSites.length > 0 ? (ranSites.reduce((s, site) => s + site.kpi_global, 0) / ranSites.length).toFixed(1) : 0;
    document.getElementById('globalRanAvail').innerText = avgRan + '%';
    
    // Packet Loss moyen CORE
    const coreSites = filteredSites.filter(s => s.domain === 'CORE');
    const avgPacketLoss = coreSites.length > 0 ? (coreSites.reduce((s, site) => s + (100 - site.kpi_global), 0) / coreSites.length).toFixed(1) : 0;
    document.getElementById('globalPacketLoss').innerText = avgPacketLoss + '%';
}

/**
 * Met à jour les listes Top 5 et Pires 5 sites
 */
function updateTopWorstSites() {
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites);
    
    // Trier par KPI global
    const sorted = [...filteredSites].sort((a, b) => b.kpi_global - a.kpi_global);
    const top5 = sorted.slice(0, 5);
    const worst5 = sorted.slice(-5).reverse();
    
    // Afficher Top 5
    const topContainer = document.getElementById('topSitesList');
    if (topContainer) {
        topContainer.innerHTML = top5.map(site => `
            <div class="site-item" onclick="showSiteDetails('${site.id}')">
                <div>
                    <span class="site-name">${site.name}</span><br>
                    <small class="text-muted">${site.countryName} | ${site.vendor} | ${site.tech}</small>
                </div>
                <div>
                    <span class="badge-good">${site.kpi_global}%</span>
                    <span class="badge-tech">${site.domain}</span>
                </div>
            </div>
        `).join('');
    }
    
    // Afficher Pires 5
    const worstContainer = document.getElementById('worstSitesList');
    if (worstContainer) {
        worstContainer.innerHTML = worst5.map(site => {
            const status = getSiteStatus(site.kpi_global);
            const badgeClass = status === 'critical' ? 'badge-critical' : 'badge-warning';
            return `
                <div class="site-item" onclick="showSiteDetails('${site.id}')">
                    <div>
                        <span class="site-name">${site.name}</span><br>
                        <small class="text-muted">${site.countryName} | ${site.vendor} | ${site.tech}</small>
                    </div>
                    <div>
                        <span class="${badgeClass}">${site.kpi_global}%</span>
                        <span class="badge-tech">${site.domain}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
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
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    updateMapMarkers();
}

/**
 * Met à jour les marqueurs sur la carte
 */
function updateMapMarkers() {
    if (!map) return;
    
    currentMarkers.forEach(marker => map.removeLayer(marker));
    currentMarkers = [];
    
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites);
    
    // Centrer la carte si un seul pays
    if (currentFilters.country !== 'all' && dashboardSitesData[currentFilters.country]) {
        const country = dashboardSitesData[currentFilters.country];
        map.flyTo(country.center, country.zoom, { duration: 1 });
    }
    
    filteredSites.forEach(site => {
        const status = getSiteStatus(site.kpi_global);
        const color = status === 'good' ? '#10b981' : (status === 'warning' ? '#f59e0b' : '#ef4444');
        
        const icon = L.divIcon({
            html: `<div style="background:${color}; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 0 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [12, 12],
            className: 'site-marker'
        });
        
        const marker = L.marker([site.lat, site.lng], { icon }).addTo(map);
        marker.bindPopup(`
            <b>${site.name}</b><br>
            <b>ID:</b> ${site.id}<br>
            <b>Pays:</b> ${site.countryName}<br>
            <b>Vendor:</b> ${site.vendor} | Tech: ${site.tech}<br>
            <b>Domaine:</b> ${site.domain}<br>
            <b>KPI Global:</b> <strong>${site.kpi_global}%</strong><br>
            <button class="btn btn-sm btn-primary mt-2" onclick="showSiteDetails('${site.id}')">Voir détails</button>
        `);
        currentMarkers.push(marker);
    });
}

// ============================================
// FONCTIONS DES GRAPHIQUES
// ============================================

/**
 * Initialise les graphiques
 */
function initCharts() {
    // Graphique RNA
    const ranCtx = document.getElementById('ranTrendChart');
    if (ranCtx) {
        charts.ranTrend = new Chart(ranCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6'],
                datasets: [{
                    label: 'RNA (%)',
                    data: [98.5, 98.9, 99.1, 99.3, 99.5, 99.7],
                    borderColor: '#00a3c4',
                    backgroundColor: 'rgba(0,163,196,0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
    
    // Graphique Packet Loss
    const packetCtx = document.getElementById('packetLossChart');
    if (packetCtx) {
        charts.packetLoss = new Chart(packetCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['CI', 'NE', 'BJ', 'TG', 'CF'],
                datasets: [{
                    label: 'Packet Loss (%)',
                    data: [0.7, 1.2, 0.65, 0.45, 2.3],
                    backgroundColor: '#f59e0b'
                }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
}

// ============================================
// FONCTIONS DU MODAL
// ============================================

/**
 * Affiche les détails d'un site dans le modal
 * @param {string} siteId - Identifiant du site
 */
function showSiteDetails(siteId) {
    const allSites = getAllSites();
    const site = allSites.find(s => s.id === siteId);
    if (!site) return;
    
    const status = getSiteStatus(site.kpi_global);
    const statusClass = status === 'good' ? 'success' : (status === 'warning' ? 'warning' : 'danger');
    
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
            <tr><td><strong>Statut</strong></td><td><span class="status-badge status-${status}">${status === 'good' ? 'Bon' : (status === 'warning' ? 'Alerte' : 'Critique')}</span></td></tr>
        </table>
    `;
    
    document.getElementById('modalSiteLocation').innerHTML = `
        <table class="table table-sm">
            <tr><td><strong>Latitude</strong></td><td>${site.lat}</td></tr>
            <tr><td><strong>Longitude</strong></td><td>${site.lng}</td></tr>
        </table>
    `;
    
    window.currentSiteForModal = site;
    const modal = new bootstrap.Modal(document.getElementById('siteDetailsModal'));
    modal.show();
}

// ============================================
// FONCTIONS DE RECHERCHE
// ============================================

/**
 * Recherche un site par nom ou ID
 */
function searchSite() {
    const searchTerm = document.getElementById('searchSite')?.value.trim().toLowerCase();
    if (!searchTerm) {
        alert('Veuillez entrer un nom de site ou un ID');
        return;
    }
    
    const allSites = getAllSites();
    const foundSite = allSites.find(s => 
        s.name.toLowerCase().includes(searchTerm) || 
        s.id.toLowerCase().includes(searchTerm)
    );
    
    if (foundSite) {
        showSiteDetails(foundSite.id);
        if (map) map.flyTo([foundSite.lat, foundSite.lng], 12);
        const status = getSiteStatus(foundSite.kpi_global);
        const statusMsg = status === 'good' ? '✅ Site en bonne santé' : (status === 'warning' ? '⚠️ Site à surveiller' : '🔴 Site dégradé - Action requise');
        alert(`Site trouvé: ${foundSite.name}\n${statusMsg}\nKPI: ${foundSite.kpi_global}%`);
    } else {
        alert(`Aucun site trouvé avec: ${searchTerm}`);
    }
}

// ============================================
// FONCTIONS DE RAPPORT
// ============================================

/**
 * Génère un rapport WhatsApp
 */
function generateWhatsAppReport() {
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites);
    const worst = [...filteredSites].sort((a, b) => a.kpi_global - b.kpi_global).slice(0, 10);
    const avgRan = filteredSites.filter(s => s.domain === 'RAN').reduce((s, site) => s + site.kpi_global, 0) / filteredSites.filter(s => s.domain === 'RAN').length;
    
    let report = `📊 *NETINSIGHT 360 - RAPPORT HEBDOMADAIRE* 📊\n\n`;

    report += `📅 Date: ${new Date().toLocaleDateString('fr-FR')}\n`;
    report += `👤 Opérateur: ${currentUser?.name || 'Utilisateur'}\n`;
    report += `📍 Sites supervisés: ${filteredSites.length}\n`;
    report += `📈 Disponibilité RAN: ${avgRan.toFixed(1)}%\n\n`;

    report += `🚨 *TOP 10 SITES CRITIQUES* 🚨\n`;

    worst.forEach((s, i) => {
        report += `${i+1}. ${s.name} (${s.countryName}) - KPI: ${s.kpi_global}% - ${s.vendor}/${s.tech}\n`;
    });

    report += `\n📌 *Actions recommandées:*\n`;
    report += `• Priorité sur Centrafrique (dégradation critique)\n`;
    report += `• Planifier maintenance sites 2G\n`;

    // 🔥 FIX FINAL
    report = report.normalize("NFC");

    let url = `https://api.whatsapp.com/send?phone=2250104836230&text=${encodeURIComponent(report)}`;

    window.open(url, '_blank');
    }

/**
 * Affiche la comparaison hebdomadaire
 */
function showWeeklyComparison() {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Côte Ivoire', 'Niger', 'Bénin', 'Togo', 'Centrafrique'],
            datasets: [
                { label: 'Semaine actuelle', data: [94.2, 92.5, 93.8, 95.2, 86.5], backgroundColor: '#00a3c4' },
                { label: 'Semaine précédente', data: [93.5, 91.2, 92.5, 94.8, 84.2], backgroundColor: '#f59e0b' }
            ]
        }
    });
    
    document.getElementById('comparisonLessons').innerHTML = `
        <h6>📝 Leçons apprises et actions correctives</h6>
        <ul>
            <li>✅ <strong>Amélioration globale:</strong> +1.5% sur l'ensemble des KPIs</li>
            <li>🔴 <strong>Centrafrique:</strong> Toujours critique mais progression de +2.3%</li>
            <li>🔧 <strong>Actions menées:</strong> Remplacement antennes Huawei sur 5 sites</li>
            <li>📅 <strong>Plan d'action:</strong> Audit complet Niger et Centrafrique</li>
        </ul>
    `;
    
    new bootstrap.Modal(document.getElementById('comparisonModal')).show();
}

// ============================================
// INITIALISATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // 1. Vérification de l'authentification
    if (!checkAuthentication()) return;
    
    // 2. Mise à jour de l'interface utilisateur
    updateUserInterface();
    
    // 3. Initialisation de la déconnexion
    initLogoutHandler();
    
    // 4. Initialisation du rafraîchissement de session
    initSessionRefresh();
    
    // 5. Date/heure en temps réel
    function updateDateTime() {
        const now = new Date();
        const dateTimeEl = document.getElementById('currentDateTime');
        if (dateTimeEl) {
            dateTimeEl.innerHTML = `<i class="bi bi-calendar3"></i> ${now.toLocaleDateString('fr-FR')} - ${now.toLocaleTimeString('fr-FR')}`;
        }
    }
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // 6. Initialisation des composants
    initMap();
    initCharts();
    updateDashboardStats();
    updateTopWorstSites();
    
    // 7. Événements des filtres
    const applyFiltersBtn = document.getElementById('applyFilters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            const countrySelect = document.getElementById('filterCountry');
            const vendorSelect = document.getElementById('filterVendor');
            const techSelect = document.getElementById('filterTech');
            const domainSelect = document.getElementById('filterDomain');
            
            currentFilters = {
                country: countrySelect?.value || 'all',
                vendor: vendorSelect?.value || 'all',
                tech: techSelect?.value || 'all',
                domain: domainSelect?.value || 'all'
            };
            updateDashboardStats();
            updateTopWorstSites();
            updateMapMarkers();
        });
    }
    
    const resetFiltersBtn = document.getElementById('resetFilters');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            const selects = ['filterCountry', 'filterVendor', 'filterTech', 'filterDomain'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = 'all';
            });
            currentFilters = { country: 'all', vendor: 'all', tech: 'all', domain: 'all' };
            updateDashboardStats();
            updateTopWorstSites();
            updateMapMarkers();
            if (map) map.flyTo([8.0, 2.0], 5);
        });
    }
    
    // 8. Événements de recherche
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchSite');
    if (searchBtn) searchBtn.addEventListener('click', searchSite);
    if (searchInput) searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchSite(); });
    
    // 9. Événements des rapports
    const shareBtn = document.getElementById('shareWhatsApp');
    if (shareBtn) shareBtn.addEventListener('click', () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(generateWhatsAppReport())}`, '_blank');
    });
    
    const exportBtn = document.getElementById('exportPowerPoint');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            alert('Fonctionnalité d\'export PowerPoint à implémenter avec le backend');
        });
    }
    
    const weeklyBtn = document.getElementById('weeklyComparison');
    if (weeklyBtn) weeklyBtn.addEventListener('click', showWeeklyComparison);
    
    const shareSiteBtn = document.getElementById('shareSiteBtn');
    if (shareSiteBtn) {
        shareSiteBtn.addEventListener('click', () => {
            if (window.currentSiteForModal) {
                const s = window.currentSiteForModal;
                const msg = `📡 *Site: ${s.name} (${s.countryName})*\nID: ${s.id}\nKPI: ${s.kpi_global}%\nVendor: ${s.vendor}\nTechno: ${s.tech}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
            }
        });
    }
    
    // 10. Menu toggle mobile
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('show'));
    }
    
    // 11. Exposer les fonctions globales
    window.showSiteDetails = showSiteDetails;
    
    console.log('[NetInsight 360] Dashboard initialisé avec succès');
});