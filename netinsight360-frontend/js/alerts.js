/**
 * NetInsight 360 - Centre d'Alertes
 * Supervisez. Analysez. Optimisez.
 * 
 * Gère la supervision en temps réel des alertes réseau
 * Types: critical (rouge) et warning (orange)
 */

// ============================================
// DONNÉES SIMULÉES DES ALERTES
// ============================================

/**
 * Structure d'une alerte:
 * {
 *   id: number,
 *   type: 'critical' | 'warning',
 *   title: string,
 *   message: string,
 *   siteId: string,
 *   siteName: string,
 *   country: string,
 *   countryName: string,
 *   domain: 'RAN' | 'CORE',
 *   kpi: string,
 *   value: number,
 *   threshold: number,
 *   timestamp: string,
 *   status: 'active' | 'resolved',
 *   resolvedAt: string | null
 * }
 */

let alerts = [
    {
        id: 1, type: 'critical', title: 'Dégradation critique RNA',
        message: 'La disponibilité radio est tombée sous le seuil critique de 90%',
        siteId: 'ET300', siteName: 'KOTOULA', country: 'CI', countryName: 'Côte d\'Ivoire',
        domain: 'RAN', kpi: 'RNA', value: 88.5, threshold: 95,
        timestamp: '2025-03-22 08:30:00', status: 'active', resolvedAt: null
    },
    {
        id: 2, type: 'critical', title: 'Packet Loss élevé',
        message: 'Perte de paquets excessive sur le cœur de réseau',
        siteId: 'CORE-CF-001', siteName: 'Bangui Core', country: 'CF', countryName: 'Centrafrique',
        domain: 'CORE', kpi: 'Packet Loss', value: 2.1, threshold: 1,
        timestamp: '2025-03-22 07:15:00', status: 'active', resolvedAt: null
    },
    {
        id: 3, type: 'warning', title: 'TCH Drop Rate en hausse',
        message: 'Le taux d\'abandon d\'appels approche le seuil d\'alerte',
        siteId: 'YAYA', siteName: 'YAYA', country: 'NE', countryName: 'Niger',
        domain: 'RAN', kpi: 'TCH Drop', value: 3.5, threshold: 2,
        timestamp: '2025-03-22 06:45:00', status: 'active', resolvedAt: null
    },
    {
        id: 4, type: 'warning', title: 'Latence anormale',
        message: 'Latence réseau supérieure à la normale',
        siteId: 'CORE-NE-003', siteName: 'Agadez Core', country: 'NE', countryName: 'Niger',
        domain: 'CORE', kpi: 'Latence', value: 85, threshold: 100,
        timestamp: '2025-03-22 05:20:00', status: 'active', resolvedAt: null
    },
    {
        id: 5, type: 'critical', title: 'Site hors service',
        message: 'Le site ne répond plus aux sondes de supervision',
        siteId: 'BG001', siteName: 'CENTRAL', country: 'CF', countryName: 'Centrafrique',
        domain: 'RAN', kpi: 'Disponibilité', value: 0, threshold: 95,
        timestamp: '2025-03-22 04:00:00', status: 'active', resolvedAt: null
    },
    {
        id: 6, type: 'warning', title: 'Congestion SDCCH',
        message: 'Congestion du canal de signalisation',
        siteId: 'WOMEY_5', siteName: 'WOMEY_5', country: 'BJ', countryName: 'Bénin',
        domain: 'RAN', kpi: 'SDCCH Cong', value: 0.88, threshold: 0.5,
        timestamp: '2025-03-21 23:30:00', status: 'active', resolvedAt: null
    },
    {
        id: 7, type: 'critical', title: 'LTE RRC SR dégradé',
        message: 'Taux d\'établissement de connexion LTE en baisse',
        siteId: 'ET709', siteName: 'KOULOUAN', country: 'CI', countryName: 'Côte d\'Ivoire',
        domain: 'RAN', kpi: 'LTE RRC SR', value: 87.5, threshold: 98,
        timestamp: '2025-03-21 22:15:00', status: 'active', resolvedAt: null
    },
    {
        id: 8, type: 'warning', title: 'Jitter élevé',
        message: 'Variation de latence excessive',
        siteId: 'CORE-BJ-004', siteName: 'Djougou Core', country: 'BJ', countryName: 'Bénin',
        domain: 'CORE', kpi: 'Jitter', value: 21, threshold: 30,
        timestamp: '2025-03-21 20:00:00', status: 'active', resolvedAt: null
    },
    {
        id: 9, type: 'critical', title: 'Handover SR critique',
        message: 'Taux de réussite des transferts inter-cellules très faible',
        siteId: 'BG004', siteName: 'FATIMA', country: 'CF', countryName: 'Centrafrique',
        domain: 'RAN', kpi: 'Handover SR', value: 84.2, threshold: 98,
        timestamp: '2025-03-21 18:30:00', status: 'active', resolvedAt: null
    },
    {
        id: 10, type: 'warning', title: 'Débit descendant faible',
        message: 'Débit LTE inférieur aux attentes',
        siteId: 'ZOURAR', siteName: 'ZOURAR', country: 'NE', countryName: 'Niger',
        domain: 'RAN', kpi: 'DL Throughput', value: 8.5, threshold: 15,
        timestamp: '2025-03-21 16:45:00', status: 'active', resolvedAt: null
    },
    {
        id: 11, type: 'critical', title: 'UL CE Congestion',
        message: 'Congestion des ressources uplink',
        siteId: 'ET857', siteName: 'ZAHIA', country: 'CI', countryName: 'Côte d\'Ivoire',
        domain: 'RAN', kpi: 'UL CE Congestion', value: 28, threshold: 20,
        timestamp: '2025-03-21 14:20:00', status: 'active', resolvedAt: null
    },
    {
        id: 12, type: 'warning', title: 'Soft HO Rate faible',
        message: 'Taux de handover soft en baisse',
        siteId: 'BG002', siteName: 'BENZ_VI', country: 'CF', countryName: 'Centrafrique',
        domain: 'RAN', kpi: 'Soft HO Rate', value: 87.2, threshold: 98,
        timestamp: '2025-03-21 12:00:00', status: 'active', resolvedAt: null
    }
];

// Alertes résolues (historique)
let resolvedAlerts = [
    {
        id: 101, type: 'critical', title: 'Site hors service',
        siteName: 'AGADEZ', countryName: 'Niger', domain: 'RAN',
        timestamp: '2025-03-20 10:00:00', resolvedAt: '2025-03-20 15:30:00'
    },
    {
        id: 102, type: 'warning', title: 'Latence élevée',
        siteName: 'LOMÉ', countryName: 'Togo', domain: 'CORE',
        timestamp: '2025-03-20 08:00:00', resolvedAt: '2025-03-20 12:00:00'
    }
];

// ============================================
// VARIABLES GLOBALES
// ============================================
let currentUser = null;
let currentFilters = {
    type: 'all',
    country: 'all',
    domain: 'all',
    search: ''
};
let currentPage = 1;
let itemsPerPage = 5;
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
 * Filtre les alertes selon les critères
 */
function filterAlerts() {
    let filtered = alerts.filter(a => a.status === 'active');
    
    if (currentFilters.type !== 'all') {
        filtered = filtered.filter(a => a.type === currentFilters.type);
    }
    
    if (currentFilters.country !== 'all') {
        filtered = filtered.filter(a => a.country === currentFilters.country);
    }
    
    if (currentFilters.domain !== 'all') {
        filtered = filtered.filter(a => a.domain === currentFilters.domain);
    }
    
    if (currentFilters.search) {
        const searchLower = currentFilters.search.toLowerCase();
        filtered = filtered.filter(a => 
            a.siteName.toLowerCase().includes(searchLower) || 
            a.title.toLowerCase().includes(searchLower) ||
            a.kpi.toLowerCase().includes(searchLower)
        );
    }
    
    // Trier par timestamp (plus récent d'abord)
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return filtered;
}

/**
 * Met à jour les statistiques
 */
function updateStats() {
    const activeAlerts = alerts.filter(a => a.status === 'active');
    const criticalCount = activeAlerts.filter(a => a.type === 'critical').length;
    const warningCount = activeAlerts.filter(a => a.type === 'warning').length;
    
    // Alertes résolues aujourd'hui
    const today = new Date().toISOString().split('T')[0];
    const resolvedToday = resolvedAlerts.filter(a => a.resolvedAt && a.resolvedAt.split(' ')[0] === today).length;
    
    document.getElementById('activeAlertsCount').innerText = activeAlerts.length;
    document.getElementById('criticalAlertsCount').innerText = criticalCount;
    document.getElementById('warningAlertsCount').innerText = warningCount;
    document.getElementById('resolvedTodayCount').innerText = resolvedToday;
}

/**
 * Calcule le temps moyen de résolution
 */
function updateAvgResolutionTime() {
    const lastResolved = resolvedAlerts.slice(-10);
    let totalHours = 0;
    let count = 0;
    
    lastResolved.forEach(alert => {
        if (alert.timestamp && alert.resolvedAt) {
            const start = new Date(alert.timestamp);
            const end = new Date(alert.resolvedAt);
            const hours = (end - start) / (1000 * 60 * 60);
            totalHours += hours;
            count++;
        }
    });
    
    const avg = count > 0 ? (totalHours / count).toFixed(1) : 0;
    document.getElementById('avgResolutionTime').innerText = avg;
}

/**
 * Met à jour la liste des alertes
 */
function updateAlertsList() {
    const filteredAlerts = filterAlerts();
    const totalPages = Math.ceil(filteredAlerts.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const paginatedAlerts = filteredAlerts.slice(start, start + itemsPerPage);
    
    const container = document.getElementById('alertsList');
    if (!container) return;
    
    if (paginatedAlerts.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-check-circle-fill fs-1 text-success"></i>
                <p class="mt-3 text-muted">Aucune alerte active. Tout va bien !</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = paginatedAlerts.map(alert => {
        const alertClass = alert.type === 'critical' ? 'critical' : 'warning';
        const icon = alert.type === 'critical' ? 'bi-exclamation-triangle-fill' : 'bi-shield-exclamation';
        
        return `
            <div class="alert-card ${alertClass}" onclick="showAlertDetails(${alert.id})">
                <div class="alert-icon">
                    <i class="bi ${icon}"></i>
                </div>
                <div class="alert-content">
                    <div class="alert-title">
                        ${escapeHtml(alert.title)}
                        <span class="alert-badge badge-${alertClass} ms-2">${alert.type === 'critical' ? 'CRITIQUE' : 'AVERTISSEMENT'}</span>
                    </div>
                    <div class="alert-details">
                        ${escapeHtml(alert.message)} - ${escapeHtml(alert.siteName)} (${alert.countryName}) - ${alert.domain}
                    </div>
                    <div class="alert-meta">
                        <span><i class="bi bi-building"></i> ${escapeHtml(alert.siteName)}</span>
                        <span><i class="bi bi-flag"></i> ${alert.countryName}</span>
                        <span><i class="bi bi-diagram-3"></i> ${alert.domain}</span>
                        <span><i class="bi bi-bar-chart"></i> ${alert.kpi}: ${alert.value}% (seuil: ${alert.threshold}%)</span>
                        <span><i class="bi bi-clock"></i> ${formatTimestamp(alert.timestamp)}</span>
                    </div>
                </div>
                <button class="resolve-btn" onclick="resolveAlert(event, ${alert.id})" title="Marquer comme résolue">
                    <i class="bi bi-check-circle"></i>
                </button>
            </div>
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
 * Affiche les détails d'une alerte dans le modal
 */
let currentAlertId = null;

function showAlertDetails(alertId) {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return;
    
    currentAlertId = alertId;
    
    const modalHeader = document.getElementById('alertModalHeader');
    const modalTitle = document.getElementById('alertModalTitle');
    const modalContent = document.getElementById('alertDetailsContent');
    
    if (modalHeader) {
        modalHeader.className = `modal-header ${alert.type === 'critical' ? 'bg-danger' : 'bg-warning'} text-white`;
    }
    
    if (modalTitle) modalTitle.innerText = alert.title;
    
    if (modalContent) {
        modalContent.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <table class="table table-sm">
                        <tr><th>Site</th><td>${escapeHtml(alert.siteName)} (${alert.siteId})</td></tr>
                        <tr><th>Pays</th><td>${alert.countryName}</td></tr>
                        <tr><th>Domaine</th><td>${alert.domain}</td></tr>
                        <tr><th>KPI</th><td>${alert.kpi}</td></tr>
                        <tr><th>Valeur actuelle</th><td class="${alert.value < alert.threshold ? 'text-danger fw-bold' : 'text-warning'}">${alert.value}%</td></tr>
                        <tr><th>Seuil critique</th><td>${alert.threshold}%</td></tr>
                        <tr><th>Date/heure</th><td>${alert.timestamp}</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <div class="alert alert-${alert.type === 'critical' ? 'danger' : 'warning'}">
                        <strong>Message complet :</strong><br>
                        ${escapeHtml(alert.message)}
                    </div>
                    <div class="mt-3">
                        <strong>Actions recommandées :</strong>
                        <ul>
                            ${getRecommendedActions(alert)}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('alertDetailsModal'));
    modal.show();
}

/**
 * Recommande des actions selon le type d'alerte
 */
function getRecommendedActions(alert) {
    const actions = {
        'RNA': ['Vérifier les équipements radio', 'Contrôler les alarmes site', 'Planifier une maintenance'],
        'Packet Loss': ['Analyser les liaisons fibre', 'Vérifier les routeurs', 'Contrôler les logs équipements'],
        'TCH Drop': ['Optimiser les paramètres radio', 'Vérifier la couverture', 'Analyser les interférences'],
        'Latence': ['Contrôler le backbone', 'Vérifier les charges', 'Analyser le routage'],
        'LTE RRC SR': ['Optimiser les paramètres LTE', 'Vérifier la congestion', 'Contrôler les ressources'],
        'default': ['Inspecter les logs', 'Contacter le support technique', 'Planifier une intervention']
    };
    
    const actionList = actions[alert.kpi] || actions.default;
    return actionList.map(action => `<li>${action}</li>`).join('');
}

/**
 * Résout une alerte
 */
function resolveAlert(event, alertId) {
    if (event) event.stopPropagation();
    
    const alertIndex = alerts.findIndex(a => a.id === alertId);
    if (alertIndex !== -1) {
        const resolvedAlert = {
            ...alerts[alertIndex],
            status: 'resolved',
            resolvedAt: new Date().toISOString().replace('T', ' ').slice(0, 19)
        };
        
        // Ajouter à l'historique
        resolvedAlerts.unshift(resolvedAlert);
        if (resolvedAlerts.length > 50) resolvedAlerts.pop();
        
        // Supprimer des alertes actives
        alerts.splice(alertIndex, 1);
        
        // Sauvegarder
        saveAlertsToStorage();
        
        // Mettre à jour l'affichage
        updateStats();
        updateAlertsList();
        updateTopSites();
        updateCharts();
        updateAvgResolutionTime();
        
        // Fermer le modal si ouvert
        const modal = bootstrap.Modal.getInstance(document.getElementById('alertDetailsModal'));
        if (modal) modal.hide();
    }
}

/**
 * Résout toutes les alertes
 */
function resolveAllAlerts() {
    if (confirm('Êtes-vous sûr de vouloir résoudre TOUTES les alertes actives ?')) {
        alerts.forEach(alert => {
            resolvedAlerts.unshift({
                ...alert,
                status: 'resolved',
                resolvedAt: new Date().toISOString().replace('T', ' ').slice(0, 19)
            });
        });
        
        alerts = [];
        saveAlertsToStorage();
        
        updateStats();
        updateAlertsList();
        updateTopSites();
        updateCharts();
        updateAvgResolutionTime();
    }
}

/**
 * Sauvegarde les alertes dans localStorage
 */
function saveAlertsToStorage() {
    localStorage.setItem('netinsight_alerts', JSON.stringify(alerts));
    localStorage.setItem('netinsight_resolved_alerts', JSON.stringify(resolvedAlerts));
}

/**
 * Charge les alertes depuis localStorage
 */
function loadAlertsFromStorage() {
    const storedAlerts = localStorage.getItem('netinsight_alerts');
    if (storedAlerts) {
        alerts = JSON.parse(storedAlerts);
    }
    
    const storedResolved = localStorage.getItem('netinsight_resolved_alerts');
    if (storedResolved) {
        resolvedAlerts = JSON.parse(storedResolved);
    }
}

// ============================================
// FONCTIONS DES GRAPHIQUES
// ============================================

/**
 * Met à jour tous les graphiques
 */
function updateCharts() {
    updateAlertTypeChart();
    updateTopCountriesChart();
    updateEvolutionChart();
    updateDomainChart();
    updateTopSites();
}

/**
 * Graphique de répartition par type d'alerte
 */
function updateAlertTypeChart() {
    const activeAlerts = alerts.filter(a => a.status === 'active');
    const criticalCount = activeAlerts.filter(a => a.type === 'critical').length;
    const warningCount = activeAlerts.filter(a => a.type === 'warning').length;
    
    const ctx = document.getElementById('alertTypeChart');
    if (!ctx) return;
    
    if (charts.alertType) charts.alertType.destroy();
    charts.alertType = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Critiques', 'Avertissements'],
            datasets: [{
                data: [criticalCount, warningCount],
                backgroundColor: ['#ef4444', '#f59e0b']
            }]
        },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } }
    });
}

/**
 * Graphique des top pays impactés
 */
function updateTopCountriesChart() {
    const activeAlerts = alerts.filter(a => a.status === 'active');
    const countryMap = new Map();
    
    activeAlerts.forEach(alert => {
        const key = alert.country;
        const name = alert.countryName;
        countryMap.set(key, { name, count: (countryMap.get(key)?.count || 0) + 1 });
    });
    
    const sorted = Array.from(countryMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);
    
    const ctx = document.getElementById('topCountriesChart');
    if (!ctx) return;
    
    if (charts.topCountries) charts.topCountries.destroy();
    charts.topCountries = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: sorted.map(c => c.name),
            datasets: [{
                label: "Nombre d'alertes",
                data: sorted.map(c => c.count),
                backgroundColor: '#00a3c4',
                borderRadius: 8
            }]
        },
        options: { responsive: true, maintainAspectRatio: true, scales: { y: { beginAtZero: true } } }
    });
}

/**
 * Graphique d'évolution des alertes (7 derniers jours)
 */
function updateEvolutionChart() {
    const labels = [];
    const criticalData = [];
    const warningData = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        labels.push(date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
        
        const allAlerts = [...alerts, ...resolvedAlerts];
        const dayAlerts = allAlerts.filter(a => a.timestamp && a.timestamp.split(' ')[0] === dateStr);
        criticalData.push(dayAlerts.filter(a => a.type === 'critical').length);
        warningData.push(dayAlerts.filter(a => a.type === 'warning').length);
    }
    
    const ctx = document.getElementById('evolutionChart');
    if (!ctx) return;
    
    if (charts.evolution) charts.evolution.destroy();
    charts.evolution = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Critiques', data: criticalData, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4 },
                { label: 'Avertissements', data: warningData, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: true, tension: 0.4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: true }
    });
}

/**
 * Graphique de répartition par domaine
 */
function updateDomainChart() {
    const activeAlerts = alerts.filter(a => a.status === 'active');
    const ranCount = activeAlerts.filter(a => a.domain === 'RAN').length;
    const coreCount = activeAlerts.filter(a => a.domain === 'CORE').length;
    
    const ctx = document.getElementById('domainChart');
    if (!ctx) return;
    
    if (charts.domain) charts.domain.destroy();
    charts.domain = new Chart(ctx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: ['RAN (Radio)', 'CORE (Cœur)'],
            datasets: [{ data: [ranCount, coreCount], backgroundColor: ['#00a3c4', '#f59e0b'] }]
        },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } }
    });
}

/**
 * Met à jour la liste des top sites problématiques
 */
function updateTopSites() {
    const activeAlerts = alerts.filter(a => a.status === 'active');
    const siteMap = new Map();
    
    activeAlerts.forEach(alert => {
        const key = alert.siteId;
        siteMap.set(key, { name: alert.siteName, count: (siteMap.get(key)?.count || 0) + 1 });
    });
    
    const sorted = Array.from(siteMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);
    const container = document.getElementById('topSitesList');
    
    if (container) {
        if (sorted.length === 0) {
            container.innerHTML = '<p class="text-center text-muted py-3">Aucun site problématique</p>';
            return;
        }
        
        container.innerHTML = sorted.map(site => `
            <div class="top-site-item">
                <span class="top-site-name">${escapeHtml(site.name)}</span>
                <span class="top-site-count">${site.count} alerte(s)</span>
            </div>
        `).join('');
    }
}

/**
 * Export des alertes en CSV
 */
function exportAlerts() {
    const filteredAlerts = filterAlerts();
    let csv = "ID,Type,Titre,Site,Pays,Domaine,KPI,Valeur,Seuil,Date\n";
    
    filteredAlerts.forEach(alert => {
        csv += `"${alert.id}","${alert.type}","${alert.title}","${alert.siteName}","${alert.countryName}","${alert.domain}","${alert.kpi}",${alert.value},${alert.threshold},"${alert.timestamp}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `alertes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Échappe les caractères HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Formate un timestamp
 */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / (1000 * 60));
    
    if (diff < 1) return 'À l\'instant';
    if (diff < 60) return `Il y a ${diff} min`;
    if (diff < 1440) return `Il y a ${Math.floor(diff / 60)} h`;
    return date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Change de page
 */
function goToPage(page) {
    currentPage = page;
    updateAlertsList();
}

// ============================================
// INITIALISATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // 1. Vérification de l'authentification
    if (!checkAuthentication()) return;
    
    // 2. Chargement des données
    loadAlertsFromStorage();
    
    // 3. Mise à jour de l'interface
    updateUserInterface();
    updateStats();
    updateAlertsList();
    updateCharts();
    updateTopSites();
    updateAvgResolutionTime();
    
    // 4. Initialisation de la déconnexion
    initLogoutHandler();
    initSessionRefresh();
    
    // 5. Date/heure
    function updateDateTime() {
        const now = new Date();
        const dateTimeEl = document.getElementById('currentDateTime');
        if (dateTimeEl) {
            dateTimeEl.innerHTML = `<i class="bi bi-calendar3"></i> ${now.toLocaleDateString('fr-FR')} - ${now.toLocaleTimeString('fr-FR')}`;
        }
    }
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // 6. Événements des filtres
    const filterType = document.getElementById('filterType');
    const filterCountry = document.getElementById('filterCountry');
    const filterDomain = document.getElementById('filterDomain');
    const searchInput = document.getElementById('searchAlert');
    const searchBtn = document.getElementById('searchBtn');
    
    const applyFilters = () => {
        currentFilters.type = filterType?.value || 'all';
        currentFilters.country = filterCountry?.value || 'all';
        currentFilters.domain = filterDomain?.value || 'all';
        currentFilters.search = searchInput?.value.trim() || '';
        currentPage = 1;
        updateAlertsList();
        updateCharts();
    };
    
    if (filterType) filterType.addEventListener('change', applyFilters);
    if (filterCountry) filterCountry.addEventListener('change', applyFilters);
    if (filterDomain) filterDomain.addEventListener('change', applyFilters);
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', applyFilters);
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') applyFilters(); });
    }
    
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            if (filterType) filterType.value = 'all';
            if (filterCountry) filterCountry.value = 'all';
            if (filterDomain) filterDomain.value = 'all';
            if (searchInput) searchInput.value = '';
            currentFilters = { type: 'all', country: 'all', domain: 'all', search: '' };
            currentPage = 1;
            updateAlertsList();
            updateCharts();
        });
    }
    
    const exportBtn = document.getElementById('exportAlertsBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportAlerts);
    
    const resolveAllBtn = document.getElementById('resolveAllBtn');
    if (resolveAllBtn) resolveAllBtn.addEventListener('click', resolveAllAlerts);
    
    const resolveAlertBtn = document.getElementById('resolveAlertBtn');
    if (resolveAlertBtn) {
        resolveAlertBtn.addEventListener('click', () => {
            if (currentAlertId) {
                resolveAlert(null, currentAlertId);
            }
        });
    }
    
    // Menu toggle mobile
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('show'));
    }
    
    // Exposer les fonctions globales
    window.showAlertDetails = showAlertDetails;
    window.resolveAlert = resolveAlert;
    window.goToPage = goToPage;
});