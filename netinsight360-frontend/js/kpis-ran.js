/**
 * NetInsight 360 - KPIs RAN
 * Supervisez. Analysez. Optimisez.
 * 
 * Gère l'affichage et l'analyse des KPIs Radio Access Network
 * Technologies: 2G, 3G, 4G
 * 
 * Fonctionnalités:
 * - Affichage du nom de l'utilisateur connecté
 * - Gestion complète de la déconnexion avec modal de confirmation
 * - Filtres par pays, vendor, technologie
 * - Tableau des pires sites avec pagination
 * - Graphiques interactifs
 * - Carte Leaflet
 * - Rapports WhatsApp et PowerPoint
 */

// ============================================
// DONNÉES SIMULÉES DES SITES RAN
// ============================================

/**
 * Base de données des sites RAN par pays
 * Structure: { id, name, lat, lng, vendor, tech, kpi_global, status, kpis }
 */
const ranSitesData = {
    // Côte d'Ivoire (CI)
    CI: {
        name: "Côte d'Ivoire",
        center: [6.9, -5.5],
        zoom: 7,
        sites: [
            { id: "ET763", name: "TOUMODI", lat: 6.56322, lng: -5.03261, vendor: "Huawei", tech: "4G", kpi_global: 97.2, status: "good",
              kpis: { RNA: 98.5, tch_avail: 99.1, cssr: 98.2, sdcch_cong: 0.35, sdcch_drop: 0.28, tch_drop: 1.6, tch_cong: 1.4, handover: 98.5,
                      rrc_cs: 96.2, rab_cs: 95.8, rrc_ps: 97.5, cssr_cs: 94.2, cssr_ps: 93.8, cs_drop: 1.8, ps_drop: 2.2, soft_ho: 96.5,
                      ul_thru: 4.8, dl_thru: 12.5, lte_s1: 99.2, lte_rrc: 97.1, lte_erab: 98.8, lte_session: 96.5, lte_erab_drop: 1.2, lte_csfb: 97.8,
                      lte_intra: 96.2, lte_inter: 97.5, lte_dl_prb: 52, lte_ul_thru: 18.5, lte_dl_thru: 42.8 } },
            { id: "ET866", name: "BODOUASSO", lat: 7.402386, lng: -4.884654, vendor: "Ericsson", tech: "4G", kpi_global: 96.8, status: "good",
              kpis: { RNA: 98.2, tch_avail: 99.0, cssr: 98.0, sdcch_cong: 0.38, sdcch_drop: 0.30, tch_drop: 1.7, tch_cong: 1.5, handover: 98.2,
                      lte_s1: 99.0, lte_rrc: 97.5, lte_erab: 98.5, lte_session: 97.0, lte_erab_drop: 1.3, lte_csfb: 97.5, lte_intra: 96.8, lte_inter: 97.2 } },
            { id: "ET857", name: "ZAHIA", lat: 6.916623, lng: -6.578519, vendor: "Huawei", tech: "3G", kpi_global: 94.5, status: "warning",
              kpis: { RNA: 95.2, rrc_cs: 94.2, rab_cs: 93.8, rrc_ps: 95.5, cssr_cs: 92.5, cssr_ps: 91.8, cs_drop: 2.2, ps_drop: 2.8, soft_ho: 94.2,
                      ul_thru: 4.2, dl_thru: 10.2, code_cong: 22, power_cong: 25, ul_ce_cong: 18, dl_ce_cong: 30 } },
            { id: "ET260", name: "GOULIA", lat: 10.0159, lng: -7.20514, vendor: "Ericsson", tech: "3G", kpi_global: 92.8, status: "warning",
              kpis: { RNA: 93.5, rrc_cs: 92.8, rab_cs: 92.2, rrc_ps: 94.5, cssr_cs: 91.2, cssr_ps: 90.5, cs_drop: 2.5, ps_drop: 3.0, soft_ho: 93.2 } },
            { id: "ET300", name: "KOTOULA", lat: 10.1405, lng: -7.39811, vendor: "Huawei", tech: "2G", kpi_global: 89.5, status: "critical",
              kpis: { RNA: 90.2, tch_avail: 89.5, cssr: 88.2, sdcch_cong: 0.85, sdcch_drop: 0.72, tch_drop: 3.2, tch_cong: 2.8, handover: 87.5 } },
            { id: "ET709", name: "KOULOUAN", lat: 6.95285, lng: -7.69917, vendor: "Ericsson", tech: "2G", kpi_global: 88.2, status: "critical",
              kpis: { RNA: 88.5, tch_avail: 87.8, cssr: 86.5, sdcch_cong: 0.95, sdcch_drop: 0.88, tch_drop: 3.8, tch_cong: 3.2, handover: 86.2 } }
        ]
    },
    // Niger (NE)
    NE: {
        name: "Niger",
        center: [14.5, 6.0],
        zoom: 6,
        sites: [
            { id: "ZINDER9", name: "ZINDER9", lat: 13.79435, lng: 8.97558, vendor: "Huawei", tech: "4G", kpi_global: 96.2, status: "good",
              kpis: { RNA: 97.5, lte_s1: 98.8, lte_rrc: 97.2, lte_erab: 98.2, lte_session: 96.8, lte_erab_drop: 1.4, lte_csfb: 97.2 } },
            { id: "ZOURAR", name: "ZOURAR", lat: 14.28397, lng: 5.36653, vendor: "Ericsson", tech: "3G", kpi_global: 93.5, status: "warning",
              kpis: { RNA: 94.2, rrc_cs: 93.5, rab_cs: 93.0, rrc_ps: 94.8, cssr_cs: 92.2, cssr_ps: 91.5, cs_drop: 2.4, ps_drop: 2.9 } },
            { id: "YAYA", name: "YAYA", lat: 13.840167, lng: 4.760194, vendor: "Ericsson", tech: "2G", kpi_global: 88.5, status: "critical",
              kpis: { RNA: 89.2, tch_avail: 88.5, cssr: 87.2, sdcch_cong: 0.92, sdcch_drop: 0.85, tch_drop: 3.5, tch_cong: 3.0, handover: 86.5 } },
            { id: "UGAN", name: "UGAN", lat: 13.514331, lng: 2.116119, vendor: "Huawei", tech: "2G", kpi_global: 87.2, status: "critical",
              kpis: { RNA: 87.8, tch_avail: 87.0, cssr: 86.2, sdcch_cong: 1.05, sdcch_drop: 0.98, tch_drop: 4.0, tch_cong: 3.5, handover: 85.8 } }
        ]
    },
    // Bénin (BJ)
    BJ: {
        name: "Bénin",
        center: [7.5, 2.5],
        zoom: 7,
        sites: [
            { id: "CEB", name: "CEB.", lat: 6.37777, lng: 2.38474, vendor: "Ericsson", tech: "4G", kpi_global: 98.5, status: "good",
              kpis: { RNA: 99.2, lte_s1: 99.5, lte_rrc: 98.8, lte_erab: 99.1, lte_session: 98.5, lte_erab_drop: 0.9, lte_csfb: 98.5 } },
            { id: "AKOGBATO_3", name: "AKOGBATO_3", lat: 6.358906, lng: 2.349161, vendor: "Ericsson", tech: "2G", kpi_global: 91.5, status: "warning",
              kpis: { RNA: 92.2, tch_avail: 91.5, cssr: 90.8, sdcch_cong: 0.65, sdcch_drop: 0.58, tch_drop: 2.5, tch_cong: 2.2, handover: 90.5 } },
            { id: "WOMEY_5", name: "WOMEY_5", lat: 6.42325, lng: 2.297333, vendor: "Huawei", tech: "2G", kpi_global: 89.2, status: "critical",
              kpis: { RNA: 89.8, tch_avail: 89.2, cssr: 88.5, sdcch_cong: 0.88, sdcch_drop: 0.82, tch_drop: 3.2, tch_cong: 2.8, handover: 88.2 } }
        ]
    },
    // Togo (TG)
    TG: {
        name: "Togo",
        center: [7.0, 1.2],
        zoom: 7,
        sites: [
            { id: "GBAMAKOPE", name: "GBAMAKOPE", lat: 6.266791, lng: 1.256285, vendor: "Huawei", tech: "4G", kpi_global: 97.5, status: "good",
              kpis: { RNA: 98.2, lte_s1: 98.8, lte_rrc: 97.5, lte_erab: 98.2, lte_session: 97.2, lte_erab_drop: 1.2, lte_csfb: 97.5 } },
            { id: "AFAGNAN2", name: "AFAGNAN2", lat: 6.490717, lng: 1.641785, vendor: "Ericsson", tech: "2G", kpi_global: 88.9, status: "critical",
              kpis: { RNA: 89.5, tch_avail: 89.0, cssr: 88.2, sdcch_cong: 0.92, sdcch_drop: 0.86, tch_drop: 3.5, tch_cong: 3.0, handover: 87.8 } }
        ]
    },
    // Centrafrique (CF)
    CF: {
        name: "Centrafrique",
        center: [5.5, 18.5],
        zoom: 7,
        sites: [
            { id: "BG002", name: "BENZ_VI", lat: 4.382278, lng: 18.555722, vendor: "Huawei", tech: "3G", kpi_global: 88.5, status: "critical",
              kpis: { RNA: 89.2, rrc_cs: 88.2, rab_cs: 87.5, rrc_ps: 89.5, cssr_cs: 86.2, cssr_ps: 85.5, cs_drop: 3.2, ps_drop: 3.8, soft_ho: 87.2 } },
            { id: "BG004", name: "FATIMA", lat: 4.360901, lng: 18.536988, vendor: "Ericsson", tech: "2G", kpi_global: 85.2, status: "critical",
              kpis: { RNA: 86.2, tch_avail: 85.5, cssr: 84.8, sdcch_cong: 1.15, sdcch_drop: 1.08, tch_drop: 4.5, tch_cong: 3.8, handover: 84.2 } },
            { id: "BG001", name: "CENTRAL", lat: 4.361025, lng: 18.585589, vendor: "Huawei", tech: "2G", kpi_global: 84.8, status: "critical",
              kpis: { RNA: 85.5, tch_avail: 84.8, cssr: 84.2, sdcch_cong: 1.22, sdcch_drop: 1.15, tch_drop: 4.8, tch_cong: 4.2, handover: 83.5 } }
        ]
    }
};

// ============================================
// VARIABLES GLOBALES
// ============================================
let currentUser = null;      // Stocke les informations de l'utilisateur connecté
let map = null;              // Instance de la carte Leaflet
let currentMarkers = [];     // Liste des marqueurs sur la carte
let charts = {};             // Stockage des instances Chart.js pour destruction propre
let currentFilters = {       // Filtres actifs
    country: 'all',
    vendor: 'all',
    tech: 'all'
};
let currentPage = 1;         // Page courante pour la pagination
let itemsPerPage = 10;       // Nombre d'éléments par page

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
    
    console.log(`[NetInsight 360] Utilisateur connecté: ${currentUser.name} (${currentUser.role})`);
}

/**
 * Initialise la gestion de la déconnexion avec modal de confirmation
 * Gère l'affichage du modal, la confirmation et le nettoyage des données
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
        // Sauvegarder le contenu original pour restauration en cas d'erreur
        const originalContent = logoutBtn.innerHTML;
        
        // Afficher l'état de chargement
        logoutBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Déconnexion...';
        logoutBtn.disabled = true;
        
        // Petit délai pour l'effet visuel
        setTimeout(() => {
            try {
                // Nettoyer toutes les données de session
                sessionStorage.clear();
                localStorage.removeItem('rememberedUser');
                localStorage.removeItem('userFilters');
                
                // Journaliser la déconnexion
                console.log('[NetInsight 360] Utilisateur déconnecté le ' + new Date().toLocaleString());
                
                // Rediriger vers la page de connexion
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
        } else {
            // Fallback si le modal n'existe pas
            if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
                executeLogout();
            }
        }
    }
    
    /**
     * Cache le modal de confirmation
     */
    function hideLogoutConfirmation() {
        if (logoutModal) {
            logoutModal.classList.remove('show');
        }
    }
    
    // Événement du bouton de déconnexion
    logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        showLogoutConfirmation();
    });
    
    // Événements du modal
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function(e) {
            e.preventDefault();
            hideLogoutConfirmation();
            executeLogout();
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            hideLogoutConfirmation();
        });
    }
    
    // Fermer le modal en cliquant à l'extérieur
    if (logoutModal) {
        logoutModal.addEventListener('click', function(e) {
            if (e.target === logoutModal) {
                hideLogoutConfirmation();
            }
        });
    }
    
    // Fermer avec la touche Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && logoutModal && logoutModal.classList.contains('show')) {
            hideLogoutConfirmation();
        }
    });
}

/**
 * Rafraîchit la session (prolonge la durée)
 * Met à jour le timestamp de la dernière activité
 */
function refreshSession() {
    if (currentUser) {
        currentUser.loggedInAt = new Date().toISOString();
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        console.log('[NetInsight 360] Session rafraîchie à', new Date().toLocaleTimeString());
    }
}

/**
 * Initialise le timer de rafraîchissement de session
 * Rafraîchit la session toutes les 30 minutes et à chaque interaction utilisateur
 */
function initSessionRefresh() {
    // Rafraîchir toutes les 30 minutes
    setInterval(refreshSession, 30 * 60 * 1000);
    
    // Rafraîchir à chaque interaction utilisateur
    const events = ['click', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, refreshSession);
    });
}

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Récupère tous les sites de tous les pays
 * @returns {Array} Liste de tous les sites avec leurs informations
 */
function getAllSites() {
    let allSites = [];
    for (let countryCode in ranSitesData) {
        const country = ranSitesData[countryCode];
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
 * @param {Object} filters - Critères de filtrage
 * @returns {Array} Sites filtrés
 */
function filterSites(sites, filters) {
    return sites.filter(site => {
        if (filters.country && filters.country !== 'all' && site.country !== filters.country) return false;
        if (filters.vendor && filters.vendor !== 'all' && site.vendor !== filters.vendor) return false;
        if (filters.tech && filters.tech !== 'all' && site.tech !== filters.tech) return false;
        return true;
    });
}

/**
 * Détermine le statut d'un site selon son KPI global
 * @param {number} kpiGlobal - Valeur du KPI global
 * @returns {string} 'good', 'warning' ou 'critical'
 */
function getSiteStatus(kpiGlobal) {
    if (kpiGlobal >= 95) return 'good';
    if (kpiGlobal >= 90) return 'warning';
    return 'critical';
}

/**
 * Calcule la moyenne d'un KPI pour un ensemble de sites
 * @param {Array} sites - Liste des sites
 * @param {string} kpiName - Nom du KPI
 * @returns {number} Moyenne arrondie à 1 décimale
 */
function calculateAverageKpi(sites, kpiName) {
    let sum = 0;
    let count = 0;
    sites.forEach(site => {
        if (site.kpis && site.kpis[kpiName] !== undefined) {
            sum += site.kpis[kpiName];
            count++;
        }
    });
    return count > 0 ? (sum / count).toFixed(1) : 0;
}

/**
 * Met à jour les statistiques globales
 * Affiche le nombre total de sites, la moyenne RNA, TCH Drop et les sites critiques
 */
function updateGlobalStats() {
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites, currentFilters);
    
    // Total sites
    const totalSitesEl = document.getElementById('totalSitesDisplay');
    if (totalSitesEl) totalSitesEl.innerText = filteredSites.length;
    
    // Moyenne RNA
    const avgRNA = calculateAverageKpi(filteredSites, 'RNA');
    const avgRNAEl = document.getElementById('avgRNA');
    if (avgRNAEl) avgRNAEl.innerText = avgRNA + '%';
    
    // Moyenne TCH Drop (2G)
    const avgTCHDrop = calculateAverageKpi(filteredSites, 'tch_drop');
    const avgTCHDropEl = document.getElementById('avgTCHDrop');
    if (avgTCHDropEl) avgTCHDropEl.innerText = avgTCHDrop + '%';
    
    // Sites critiques
    const criticalCount = filteredSites.filter(s => getSiteStatus(s.kpi_global) === 'critical').length;
    const criticalSitesEl = document.getElementById('criticalSites');
    if (criticalSitesEl) criticalSitesEl.innerText = criticalCount;
    
    // Info filtre
    const filterInfo = [];
    if (currentFilters.country !== 'all') filterInfo.push(ranSitesData[currentFilters.country]?.name);
    if (currentFilters.vendor !== 'all') filterInfo.push(currentFilters.vendor);
    if (currentFilters.tech !== 'all') filterInfo.push(currentFilters.tech);
    const sitesFilterInfoEl = document.getElementById('sitesFilterInfo');
    if (sitesFilterInfoEl) sitesFilterInfoEl.innerHTML = filterInfo.length ? filterInfo.join(' - ') : 'Tous les sites';
}

/**
 * Met à jour le tableau des pires sites
 * Trie par KPI global ascendant et applique la pagination
 */
function updateWorstSitesTable() {
    const allSites = getAllSites();
    let filteredSites = filterSites(allSites, currentFilters);
    
    // Trier par KPI global (ascendant - les pires en premier)
    filteredSites.sort((a, b) => a.kpi_global - b.kpi_global);
    
    // Pagination
    const totalPages = Math.ceil(filteredSites.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const paginatedSites = filteredSites.slice(start, start + itemsPerPage);
    
    const tbody = document.getElementById('worstSitesList');
    if (!tbody) return;
    
    if (paginatedSites.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">Aucun site trouvé</td></tr>';
        return;
    }
    
    tbody.innerHTML = paginatedSites.map((site, index) => {
        const status = getSiteStatus(site.kpi_global);
        const rowClass = status === 'critical' ? 'site-row-critical' : (status === 'warning' ? 'site-row-warning' : '');
        const statusBadge = `<span class="status-badge status-${status}">${status === 'good' ? '✓ OK' : (status === 'warning' ? '⚠️ Alerte' : '🔴 Critique')}</span>`;
        
        return `
            <tr class="${rowClass}">
                <td>${start + index + 1}</td>
                <td><strong>${site.id}</strong></td>
                <td>${site.name}</td>
                <td><i class="bi bi-flag"></i> ${site.countryName}</td>
                <td><span class="badge-tech">${site.tech}</span></td>
                <td>${site.vendor}</td>
                <td><strong>${site.kpi_global}%</strong></td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn-details" onclick="showSiteDetails('${site.id}')" data-tooltip="Voir détails">
                        <i class="bi bi-eye-fill"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Pagination controls
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
 * Change de page dans le tableau
 * @param {number} page - Numéro de page
 */
function goToPage(page) {
    currentPage = page;
    updateWorstSitesTable();
}

// ============================================
// FONCTIONS DES GRAPHIQUES
// ============================================

/**
 * Met à jour tous les graphiques
 */
function updateAllCharts() {
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites, currentFilters);
    
    // Graphiques 2G, 3G, 4G
    update2GChart(filteredSites);
    update3GChart(filteredSites);
    update4GChart(filteredSites);
    
    // Graphiques de répartition
    updateVendorChart(filteredSites);
    updateTechChart(filteredSites);
    updateCountryChart(filteredSites);
}

/**
 * Graphique KPIs 2G
 * @param {Array} sites - Liste des sites filtrés
 */
function update2GChart(sites) {
    const twoGSites = sites.filter(s => s.tech === '2G');
    const kpis = ['tch_avail', 'cssr', 'sdcch_cong', 'sdcch_drop', 'tch_drop', 'tch_cong', 'handover'];
    const labels = ['TCH Avail', 'CSSR', 'SDCCH Cong', 'SDCCH Drop', 'TCH Drop', 'TCH Cong', 'Handover'];
    const values = kpis.map(kpi => calculateAverageKpi(twoGSites, kpi));
    
    const ctx = document.getElementById('kpi2GChart');
    if (!ctx) return;
    
    if (charts.kpi2G) charts.kpi2G.destroy();
    charts.kpi2G = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Performance (%)',
                data: values,
                backgroundColor: '#10b981',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Pourcentage (%)' } } }
        }
    });
}

/**
 * Graphique KPIs 3G
 * @param {Array} sites - Liste des sites filtrés
 */
function update3GChart(sites) {
    const threeGSites = sites.filter(s => s.tech === '3G');
    const kpis = ['rrc_cs', 'rab_cs', 'rrc_ps', 'cssr_cs', 'cssr_ps', 'cs_drop', 'ps_drop', 'soft_ho'];
    const labels = ['RRC CS', 'RAB CS', 'RRC PS', 'CSSR CS', 'CSSR PS', 'CS Drop', 'PS Drop', 'Soft HO'];
    const values = kpis.map(kpi => calculateAverageKpi(threeGSites, kpi));
    
    const ctx = document.getElementById('kpi3GChart');
    if (!ctx) return;
    
    if (charts.kpi3G) charts.kpi3G.destroy();
    charts.kpi3G = new Chart(ctx.getContext('2d'), {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Performance (%)',
                data: values,
                backgroundColor: 'rgba(0,163,196,0.2)',
                borderColor: '#00a3c4',
                pointBackgroundColor: '#00a3c4'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: { r: { beginAtZero: true, max: 100 } }
        }
    });
}

/**
 * Graphique KPIs 4G
 * @param {Array} sites - Liste des sites filtrés
 */
function update4GChart(sites) {
    const fourGSites = sites.filter(s => s.tech === '4G');
    const kpis = ['lte_s1', 'lte_rrc', 'lte_erab', 'lte_session', 'lte_erab_drop', 'lte_csfb', 'lte_intra', 'lte_inter'];
    const labels = ['S1 SR', 'RRC SR', 'ERAB SR', 'Session SR', 'ERAB Drop', 'CSFB SR', 'Intra Freq', 'Inter Freq'];
    const values = kpis.map(kpi => calculateAverageKpi(fourGSites, kpi));
    
    const ctx = document.getElementById('kpi4GChart');
    if (!ctx) return;
    
    if (charts.kpi4G) charts.kpi4G.destroy();
    charts.kpi4G = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Performance (%)',
                data: values,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245,158,11,0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });
}

/**
 * Graphique répartition par vendor
 * @param {Array} sites - Liste des sites filtrés
 */
function updateVendorChart(sites) {
    const huaweiCount = sites.filter(s => s.vendor === 'Huawei').length;
    const ericssonCount = sites.filter(s => s.vendor === 'Ericsson').length;
    
    const ctx = document.getElementById('vendorChart');
    if (!ctx) return;
    
    if (charts.vendor) charts.vendor.destroy();
    charts.vendor = new Chart(ctx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: ['Huawei', 'Ericsson'],
            datasets: [{
                data: [huaweiCount, ericssonCount],
                backgroundColor: ['#00a3c4', '#f59e0b']
            }]
        },
        options: { responsive: true, maintainAspectRatio: true }
    });
}

/**
 * Graphique répartition par technologie
 * @param {Array} sites - Liste des sites filtrés
 */
function updateTechChart(sites) {
    const twoG = sites.filter(s => s.tech === '2G').length;
    const threeG = sites.filter(s => s.tech === '3G').length;
    const fourG = sites.filter(s => s.tech === '4G').length;
    
    const ctx = document.getElementById('techChart');
    if (!ctx) return;
    
    if (charts.tech) charts.tech.destroy();
    charts.tech = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['2G', '3G', '4G'],
            datasets: [{
                data: [twoG, threeG, fourG],
                backgroundColor: ['#10b981', '#f59e0b', '#00a3c4']
            }]
        },
        options: { responsive: true, maintainAspectRatio: true }
    });
}

/**
 * Graphique répartition par pays
 * @param {Array} sites - Liste des sites filtrés
 */
function updateCountryChart(sites) {
    const countries = ['CI', 'NE', 'BJ', 'TG', 'CF'];
    const countryNames = ['Côte Ivoire', 'Niger', 'Bénin', 'Togo', 'Centrafrique'];
    const counts = countries.map(code => sites.filter(s => s.country === code).length);
    
    const ctx = document.getElementById('countryChart');
    if (!ctx) return;
    
    if (charts.country) charts.country.destroy();
    charts.country = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: countryNames,
            datasets: [{
                label: 'Nombre de sites',
                data: counts,
                backgroundColor: '#00a3c4',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Nombre de sites' } } }
        }
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
    const filteredSites = filterSites(allSites, currentFilters);
    
    // Centrer la carte si un seul pays
    if (currentFilters.country !== 'all' && ranSitesData[currentFilters.country]) {
        const country = ranSitesData[currentFilters.country];
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
            <b>KPI Global:</b> <strong>${site.kpi_global}%</strong><br>
            <button class="btn btn-sm btn-primary mt-2" onclick="showSiteDetails('${site.id}')">Voir détails</button>
        `);
        currentMarkers.push(marker);
    });
}

// ============================================
// FONCTIONS DU MODAL
// ============================================

/**
 * Retourne l'objectif pour un KPI donné
 * @param {string} kpiName - Nom du KPI
 * @returns {number} Valeur cible
 */
function getTargetForKpi(kpiName) {
    const targets = {
        RNA: 99.5, tch_avail: 99, cssr: 98, sdcch_cong: 0.5, sdcch_drop: 0.5,
        tch_drop: 2, tch_cong: 2, handover: 98, rrc_cs: 98, rab_cs: 98,
        rrc_ps: 98, cssr_cs: 98, cssr_ps: 98, cs_drop: 2, ps_drop: 2,
        soft_ho: 98, ul_thru: 5, dl_thru: 15, lte_s1: 98, lte_rrc: 98,
        lte_erab: 98, lte_session: 98, lte_erab_drop: 2, lte_csfb: 98,
        lte_intra: 98, lte_inter: 98
    };
    return targets[kpiName] || 95;
}

/**
 * Formate le nom d'un KPI pour affichage
 * @param {string} kpiName - Nom technique du KPI
 * @returns {string} Nom formaté
 */
function formatKpiName(kpiName) {
    const names = {
        RNA: "Radio Network Availability",
        tch_avail: "TCH Availability", cssr: "CSSR", sdcch_cong: "SDCCH Congestion",
        sdcch_drop: "SDCCH Drop", tch_drop: "TCH Drop Rate", tch_cong: "TCH Congestion",
        handover: "Handover SR", rrc_cs: "RRC CS SR", rab_cs: "RAB CS SR",
        rrc_ps: "RRC PS SR", cssr_cs: "CSSR CS SR", cssr_ps: "CSSR PS SR",
        cs_drop: "CS Drop Rate", ps_drop: "PS Drop Rate", soft_ho: "Soft HO Rate",
        ul_thru: "UL Throughput", dl_thru: "DL Throughput",
        lte_s1: "LTE S1 Signaling SR", lte_rrc: "LTE RRC SR", lte_erab: "LTE ERAB SR",
        lte_session: "LTE Session Setup SR", lte_erab_drop: "LTE ERAB Drop Rate",
        lte_csfb: "LTE CSFB SR", lte_intra: "LTE Intra Frequency SR",
        lte_inter: "LTE Inter Frequency SR"
    };
    return names[kpiName] || kpiName;
}

/**
 * Génère des données de tendance sur 5 jours
 * @param {number} currentValue - Valeur actuelle
 * @returns {Array} Données des 5 derniers jours
 */
function generateTrendData(currentValue) {
    return [currentValue - 3.2, currentValue - 2.1, currentValue - 1.5, currentValue - 0.8, currentValue];
}

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
    
    const modalTitle = document.getElementById('modalSiteTitle');
    const modalSiteInfo = document.getElementById('modalSiteInfo');
    const modalWorstKpis = document.getElementById('modalWorstKpis');
    
    if (modalTitle) modalTitle.innerText = `${site.name} - ${site.countryName}`;
    if (modalSiteInfo) {
        modalSiteInfo.innerHTML = `
            <table class="table table-sm">
                <tr><td><strong>ID Site:</strong></td><td>${site.id}</td></tr>
                <tr><td><strong>Nom:</strong></td><td>${site.name}</td></tr>
                <tr><td><strong>Pays:</strong></td><td>${site.countryName}</td></tr>
                <tr><td><strong>Vendor:</strong></td><td>${site.vendor}</td></tr>
                <tr><td><strong>Technologie:</strong></td><td>${site.tech}</td></tr>
                <tr><td><strong>KPI Global:</strong></td><td><strong class="text-${statusClass}">${site.kpi_global}%</strong></td></tr>
                <tr><td><strong>Statut:</strong></td><td><span class="status-badge status-${status}">${status}</span></td></tr>
            </table>
        `;
    }
    
    // Top 5 pires KPIs pour ce site
    let kpiEntries = Object.entries(site.kpis).map(([name, value]) => ({ name, value, target: getTargetForKpi(name) }));
    let worstKpis = kpiEntries.sort((a, b) => (a.value / a.target) - (b.value / b.target)).slice(0, 5);
    
    if (modalWorstKpis) {
        modalWorstKpis.innerHTML = worstKpis.map(k => `
            <div class="d-flex justify-content-between align-items-center p-2 border-bottom">
                <span><strong>${formatKpiName(k.name)}</strong></span>
                <span class="badge ${k.value < k.target ? 'bg-danger' : 'bg-warning'}">${k.value}% / ${k.target}%</span>
                <span>${((k.target - k.value)/k.target * 100).toFixed(1)}% sous objectif</span>
            </div>
        `).join('');
    }
    
    // Trend sur 5 jours
    const trendData = generateTrendData(site.kpi_global);
    const trendCtx = document.getElementById('trend5DaysChart');
    if (trendCtx) {
        if (charts.trend5Days) charts.trend5Days.destroy();
        const ctx = trendCtx.getContext('2d');
        charts.trend5Days = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['J-4', 'J-3', 'J-2', 'J-1', 'Aujourd\'hui'],
                datasets: [{
                    label: `${site.name} - Évolution KPI (%)`,
                    data: trendData,
                    borderColor: status === 'good' ? '#10b981' : (status === 'warning' ? '#f59e0b' : '#ef4444'),
                    backgroundColor: 'rgba(0,163,196,0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
    
    window.currentSiteForModal = site;
    const modal = new bootstrap.Modal(document.getElementById('siteDetailsModal'));
    modal.show();
}

// ============================================
// FONCTIONS D'EXPORT ET RAPPORTS
// ============================================

/**
 * Export des pires sites en CSV
 */
function exportWorstSitesCSV() {
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites, currentFilters);
    const sorted = [...filteredSites].sort((a, b) => a.kpi_global - b.kpi_global);
    
    let csv = "Site ID,Nom,Pays,Vendor,Technologie,KPI Global,Statut\n";
    sorted.forEach(site => {
        csv += `"${site.id}","${site.name}","${site.countryName}","${site.vendor}","${site.tech}",${site.kpi_global},"${getSiteStatus(site.kpi_global)}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `pires_sites_ran_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('[NetInsight 360] Export CSV des pires sites effectué');
}

/**
 * Génère un rapport WhatsApp
 * @returns {string} Contenu du rapport
 */
function generateWhatsAppReport() {
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites, currentFilters);
    const worst = [...filteredSites].sort((a, b) => a.kpi_global - b.kpi_global).slice(0, 10);
    const avgRNA = calculateAverageKpi(filteredSites, 'RNA');
    const userName = currentUser ? currentUser.name : 'Utilisateur';
    
    let report = `📡 *NETINSIGHT 360 - RAPPORT KPIs RAN* 📡\n\n`;
    report += `📅 Date: ${new Date().toLocaleDateString('fr-FR')}\n`;
    report += `👤 Opérateur: ${userName}\n`;
    report += `📍 Sites analysés: ${filteredSites.length}\n`;
    report += `📊 Disponibilité RAN moyenne: ${avgRNA}%\n\n`;
    report += `⚠️ *TOP 10 SITES CRITIQUES* ⚠️\n`;
    worst.forEach((s, i) => {
        report += `${i+1}. ${s.name} (${s.countryName}) - KPI: ${s.kpi_global}% - ${s.vendor}/${s.tech}\n`;
    });
    report += `\n📈 *Actions recommandées:*\n`;
    report += `- Vérifier les sites en Centrafrique (dégradation critique)\n`;
    report += `- Planifier maintenance sur sites 2G avec TCH Drop > 2%\n`;
    report += `- Optimiser paramètres LTE pour améliorer RRC SR\n`;
    return report;
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
            <li>🔴 <strong>KPIs RAN critiques:</strong> RRC CS SR (-1.8%), DL Throughput 3G (-2.5%)</li>
            <li>🔧 <strong>Actions menées:</strong> Remplacement antennes sur sites critiques</li>
            <li>📅 <strong>Plan d'action:</strong> Audit complet Centrafrique et Niger</li>
        </ul>
    `;
    
    new bootstrap.Modal(document.getElementById('comparisonModal')).show();
}

// ============================================
// INITIALISATION DE LA PAGE
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // 1. Vérification de l'authentification
    if (!checkAuthentication()) {
        return;
    }
    
    // 2. Mise à jour de l'interface utilisateur (nom, avatar, rôle)
    updateUserInterface();
    
    // 3. Initialisation de la gestion de déconnexion
    initLogoutHandler();
    
    // 4. Initialisation du rafraîchissement de session
    initSessionRefresh();
    
    // 5. Mise à jour date/heure en temps réel
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
    updateGlobalStats();
    updateWorstSitesTable();
    updateAllCharts();
    
    // 7. Événements des filtres
    const applyFiltersBtn = document.getElementById('applyFilters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            const countrySelect = document.getElementById('filterCountry');
            const vendorSelect = document.getElementById('filterVendor');
            const techSelect = document.getElementById('filterTech');
            
            currentFilters = {
                country: countrySelect ? countrySelect.value : 'all',
                vendor: vendorSelect ? vendorSelect.value : 'all',
                tech: techSelect ? techSelect.value : 'all'
            };
            currentPage = 1;
            updateGlobalStats();
            updateWorstSitesTable();
            updateAllCharts();
            updateMapMarkers();
            
            console.log('[NetInsight 360] Filtres appliqués:', currentFilters);
        });
    }
    
    const resetFiltersBtn = document.getElementById('resetFilters');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            const countrySelect = document.getElementById('filterCountry');
            const vendorSelect = document.getElementById('filterVendor');
            const techSelect = document.getElementById('filterTech');
            
            if (countrySelect) countrySelect.value = 'all';
            if (vendorSelect) vendorSelect.value = 'all';
            if (techSelect) techSelect.value = 'all';
            
            currentFilters = { country: 'all', vendor: 'all', tech: 'all' };
            currentPage = 1;
            updateGlobalStats();
            updateWorstSitesTable();
            updateAllCharts();
            updateMapMarkers();
            if (map) map.flyTo([8.0, 2.0], 5);
            
            console.log('[NetInsight 360] Filtres réinitialisés');
        });
    }
    
    // 8. Événements des boutons de rapport
    const exportBtn = document.getElementById('exportWorstSites');
    if (exportBtn) exportBtn.addEventListener('click', exportWorstSitesCSV);
    
    const shareWorstBtn = document.getElementById('shareWorstSites');
    if (shareWorstBtn) {
        shareWorstBtn.addEventListener('click', () => {
            const report = generateWhatsAppReport();
            window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank');
        });
    }
    
    const shareWhatsAppBtn = document.getElementById('shareWhatsApp');
    if (shareWhatsAppBtn) {
        shareWhatsAppBtn.addEventListener('click', () => {
            const report = generateWhatsAppReport();
            window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank');
        });
    }
    
    const weeklyComparisonBtn = document.getElementById('weeklyComparison');
    if (weeklyComparisonBtn) weeklyComparisonBtn.addEventListener('click', showWeeklyComparison);
    
    const shareSiteBtn = document.getElementById('shareSiteWhatsApp');
    if (shareSiteBtn) {
        shareSiteBtn.addEventListener('click', () => {
            if (window.currentSiteForModal) {
                const s = window.currentSiteForModal;
                const msg = `📡 *Site: ${s.name} (${s.countryName})*\nID: ${s.id}\nKPI Global: ${s.kpi_global}%\nVendor: ${s.vendor}\nTechno: ${s.tech}\nStatut: ${getSiteStatus(s.kpi_global)}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
            }
        });
    }
    
    // 9. Menu toggle mobile
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }
    
    // 10. Exposer les fonctions globales pour les appels depuis le HTML
    window.showSiteDetails = showSiteDetails;
    window.goToPage = goToPage;
    window.getAllSites = getAllSites;
    window.filterSites = filterSites;
    window.getSiteStatus = getSiteStatus;
    
    console.log('[NetInsight 360] Page KPIs RAN initialisée avec succès');
});