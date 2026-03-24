/**
 * NetInsight 360 - Centre d'Alertes
 * Supervisez. Analysez. Optimisez.
 * 
 * Gestion des alertes réseau via l'API backend
 */

let alertsData = [];
let alertsFilters = { type: 'all', country: 'all', domain: 'all', search: '' };
let alertsCurrentPage = 1;
let alertsItemsPerPage = 5;

/**
 * Initialise la page des alertes
 */
async function initAlerts() {
    const isAuth = await checkAuthentication();
    if (!isAuth) return;
    
    await updateUserInterface();
    await loadAlerts();
    await loadAlertsStats();
    await loadAlertsCharts();
    await loadTopSites();
    await loadAvgResolutionTime();
    initAlertsFilters();
    initAlertsEvents();
}

/**
 * Charge les alertes
 */
async function loadAlerts() {
    try {
        const result = await API.getAlerts(alertsFilters);
        if (!result.success) return;
        
        alertsData = result.data || [];
        updateAlertsList();
    } catch (error) {
        console.error('[Alerts] Erreur chargement alertes:', error);
    }
}

/**
 * Met à jour la liste des alertes
 */
function updateAlertsList() {
    const filtered = filterAlerts();
    const totalPages = Math.ceil(filtered.length / alertsItemsPerPage);
    const start = (alertsCurrentPage - 1) * alertsItemsPerPage;
    const paginated = filtered.slice(start, start + alertsItemsPerPage);
    
    const container = document.getElementById('alertsList');
    if (!container) return;
    
    if (paginated.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-check-circle-fill fs-1 text-success"></i>
                <p class="mt-3 text-muted">Aucune alerte active. Tout va bien !</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = paginated.map(alert => `
        <div class="alert-card ${alert.alert_type}" onclick="showAlertDetails(${alert.id})">
            <div class="alert-icon">
                <i class="bi ${alert.alert_type === 'critical' ? 'bi-exclamation-triangle-fill' : 'bi-shield-exclamation'}"></i>
            </div>
            <div class="alert-content">
                <div class="alert-title">
                    ${escapeHtml(alert.title || alert.kpi_name)}
                    <span class="alert-badge badge-${alert.alert_type}">${alert.alert_type === 'critical' ? 'CRITIQUE' : 'AVERTISSEMENT'}</span>
                </div>
                <div class="alert-details">
                    ${escapeHtml(alert.message)} - ${escapeHtml(alert.site_name)} (${alert.country_name}) - ${alert.domain}
                </div>
                <div class="alert-meta">
                    <span><i class="bi bi-building"></i> ${escapeHtml(alert.site_name)}</span>
                    <span><i class="bi bi-flag"></i> ${alert.country_name}</span>
                    <span><i class="bi bi-diagram-3"></i> ${alert.domain}</span>
                    <span><i class="bi bi-bar-chart"></i> ${alert.kpi_name}: ${alert.current_value}% (seuil: ${alert.threshold_value}%)</span>
                    <span><i class="bi bi-clock"></i> ${formatTimestamp(alert.created_at)}</span>
                </div>
            </div>
            <button class="resolve-btn" onclick="resolveAlert(event, ${alert.id})" title="Marquer comme résolue">
                <i class="bi bi-check-circle"></i>
            </button>
        </div>
    `).join('');
    
    const paginationDiv = document.getElementById('paginationControls');
    if (paginationDiv && totalPages > 1) {
        let html = '<nav><ul class="pagination">';
        for (let i = 1; i <= totalPages; i++) {
            html += `<li class="page-item ${i === alertsCurrentPage ? 'active' : ''}">
                <button class="page-link" onclick="goToAlertsPage(${i})">${i}</button>
            </li>`;
        }
        html += '</ul></nav>';
        paginationDiv.innerHTML = html;
    } else if (paginationDiv) {
        paginationDiv.innerHTML = '';
    }
}

/**
 * Filtre les alertes
 */
function filterAlerts() {
    let filtered = [...alertsData];
    
    if (alertsFilters.type !== 'all') {
        filtered = filtered.filter(a => a.alert_type === alertsFilters.type);
    }
    
    if (alertsFilters.country !== 'all') {
        filtered = filtered.filter(a => a.country_code === alertsFilters.country);
    }
    
    if (alertsFilters.domain !== 'all') {
        filtered = filtered.filter(a => a.domain === alertsFilters.domain);
    }
    
    if (alertsFilters.search) {
        const search = alertsFilters.search.toLowerCase();
        filtered = filtered.filter(a => 
            a.site_name?.toLowerCase().includes(search) ||
            a.kpi_name?.toLowerCase().includes(search) ||
            a.message?.toLowerCase().includes(search)
        );
    }
    
    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Charge les statistiques des alertes
 */
async function loadAlertsStats() {
    try {
        const result = await API.getAlertsStats();
        if (!result.success) return;
        
        const stats = result.data;
        document.getElementById('activeAlertsCount').innerText = stats.active || 0;
        document.getElementById('criticalAlertsCount').innerText = stats.critical || 0;
        document.getElementById('warningAlertsCount').innerText = stats.warning || 0;
        document.getElementById('resolvedTodayCount').innerText = stats.resolved_today || 0;
    } catch (error) {
        console.error('[Alerts] Erreur chargement stats:', error);
    }
}

/**
 * Charge les graphiques
 */
async function loadAlertsCharts() {
    try {
        const result = await API.getAlertsStats();
        if (!result.success) return;
        
        const stats = result.data;
        
        chartManager.createPieChart('alertTypeChart', {
            labels: ['Critiques', 'Avertissements'],
            datasets: [{ data: [stats.critical || 0, stats.warning || 0], backgroundColor: ['#ef4444', '#f59e0b'] }]
        });
        
        if (stats.by_country) {
            chartManager.createBarChart('topCountriesChart', {
                labels: stats.by_country.map(c => c.name),
                datasets: [{ label: "Nombre d'alertes", data: stats.by_country.map(c => c.count), backgroundColor: '#00a3c4' }]
            });
        }
        
        if (stats.evolution) {
            chartManager.createLineChart('evolutionChart', {
                labels: stats.evolution.labels,
                datasets: [
                    { label: 'Critiques', data: stats.evolution.critical, borderColor: '#ef4444', fill: true },
                    { label: 'Avertissements', data: stats.evolution.warning, borderColor: '#f59e0b', fill: true }
                ]
            });
        }
        
        if (stats.by_domain) {
            chartManager.createPieChart('domainChart', {
                labels: ['RAN (Radio)', 'CORE (Cœur)'],
                datasets: [{ data: [stats.by_domain.ran || 0, stats.by_domain.core || 0], backgroundColor: ['#00a3c4', '#f59e0b'] }]
            });
        }
    } catch (error) {
        console.error('[Alerts] Erreur chargement graphiques:', error);
    }
}

/**
 * Charge les top sites problématiques
 */
async function loadTopSites() {
    try {
        const result = await API.getAlertsStats();
        if (!result.success) return;
        
        const container = document.getElementById('topSitesList');
        if (!container) return;
        
        const topSites = result.data.top_sites || [];
        if (topSites.length === 0) {
            container.innerHTML = '<p class="text-center text-muted py-3">Aucun site problématique</p>';
            return;
        }
        
        container.innerHTML = topSites.map(site => `
            <div class="top-site-item">
                <span class="top-site-name">${escapeHtml(site.name)}</span>
                <span class="top-site-count">${site.alert_count} alerte(s)</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('[Alerts] Erreur chargement top sites:', error);
    }
}

/**
 * Charge le temps moyen de résolution
 */
async function loadAvgResolutionTime() {
    try {
        const result = await API.getAlertsStats();
        if (!result.success) return;
        
        const avgTime = result.data.avg_resolution_hours || 0;
        document.getElementById('avgResolutionTime').innerText = avgTime;
    } catch (error) {
        console.error('[Alerts] Erreur chargement temps résolution:', error);
    }
}

/**
 * Initialise les filtres
 */
function initAlertsFilters() {
    const filterType = document.getElementById('filterType');
    const filterCountry = document.getElementById('filterCountry');
    const filterDomain = document.getElementById('filterDomain');
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchAlert');
    const resetBtn = document.getElementById('resetFiltersBtn');
    
    const applyFilters = () => {
        alertsFilters = {
            type: filterType?.value || 'all',
            country: filterCountry?.value || 'all',
            domain: filterDomain?.value || 'all',
            search: searchInput?.value.trim() || ''
        };
        alertsCurrentPage = 1;
        updateAlertsList();
        loadAlertsCharts();
    };
    
    if (filterType) filterType.addEventListener('change', applyFilters);
    if (filterCountry) filterCountry.addEventListener('change', applyFilters);
    if (filterDomain) filterDomain.addEventListener('change', applyFilters);
    
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', applyFilters);
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') applyFilters(); });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (filterType) filterType.value = 'all';
            if (filterCountry) filterCountry.value = 'all';
            if (filterDomain) filterDomain.value = 'all';
            if (searchInput) searchInput.value = '';
            alertsFilters = { type: 'all', country: 'all', domain: 'all', search: '' };
            alertsCurrentPage = 1;
            updateAlertsList();
            loadAlertsCharts();
        });
    }
}

/**
 * Initialise les événements
 */
function initAlertsEvents() {
    const exportBtn = document.getElementById('exportAlertsBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportAlerts);
    }
    
    const resolveAllBtn = document.getElementById('resolveAllBtn');
    if (resolveAllBtn) {
        resolveAllBtn.addEventListener('click', resolveAllAlerts);
    }
    
    const resolveAlertBtn = document.getElementById('resolveAlertBtn');
    if (resolveAlertBtn) {
        resolveAlertBtn.addEventListener('click', () => {
            if (currentAlertId) {
                resolveAlert(null, currentAlertId);
            }
        });
    }
}

let currentAlertId = null;

/**
 * Affiche les détails d'une alerte
 * @param {number} alertId - Identifiant de l'alerte
 */
function showAlertDetails(alertId) {
    const alert = alertsData.find(a => a.id === alertId);
    if (!alert) return;
    
    currentAlertId = alertId;
    
    const modalHeader = document.getElementById('alertModalHeader');
    const modalTitle = document.getElementById('alertModalTitle');
    const modalContent = document.getElementById('alertDetailsContent');
    
    if (modalHeader) {
        modalHeader.className = `modal-header ${alert.alert_type === 'critical' ? 'bg-danger' : 'bg-warning'} text-white`;
    }
    if (modalTitle) modalTitle.innerText = alert.title || alert.kpi_name;
    if (modalContent) {
        modalContent.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <table class="table table-sm">
                        <tr><th>Site</th><td>${escapeHtml(alert.site_name)} (${alert.site_id})</td></tr>
                        <tr><th>Pays</th><td>${escapeHtml(alert.country_name)}</td></tr>
                        <tr><th>Domaine</th><td>${alert.domain}</td></tr>
                        <tr><th>KPI</th><td>${alert.kpi_name}</td></tr>
                        <tr><th>Valeur actuelle</th><td class="text-danger fw-bold">${alert.current_value}%</td></tr>
                        <tr><th>Seuil critique</th><td>${alert.threshold_value}%</td></tr>
                        <tr><th>Date/heure</th><td>${new Date(alert.created_at).toLocaleString()}</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <div class="alert alert-${alert.alert_type === 'critical' ? 'danger' : 'warning'}">
                        <strong>Message :</strong><br>
                        ${escapeHtml(alert.message || 'Alerte réseau détectée')}
                    </div>
                    <div class="mt-3">
                        <strong>Actions recommandées :</strong>
                        <ul>
                            <li>Vérifier les équipements concernés</li>
                            <li>Analyser les logs système</li>
                            <li>Contacter l'équipe de maintenance</li>
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
 * Résout une alerte
 * @param {Event} event - Événement
 * @param {number} alertId - Identifiant de l'alerte
 */
async function resolveAlert(event, alertId) {
    if (event) event.stopPropagation();
    
    try {
        const result = await API.resolveAlert(alertId);
        if (result.success) {
            await loadAlerts();
            await loadAlertsStats();
            await loadAlertsCharts();
            await loadTopSites();
            await loadAvgResolutionTime();
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('alertDetailsModal'));
            if (modal) modal.hide();
        } else {
            alert(result.error || 'Erreur lors de la résolution');
        }
    } catch (error) {
        console.error('[Alerts] Erreur résolution:', error);
        alert('Erreur lors de la résolution');
    }
}

/**
 * Résout toutes les alertes
 */
async function resolveAllAlerts() {
    if (!confirm('Êtes-vous sûr de vouloir résoudre TOUTES les alertes actives ?')) return;
    
    try {
        const result = await API.resolveAllAlerts();
        if (result.success) {
            await loadAlerts();
            await loadAlertsStats();
            await loadAlertsCharts();
            await loadTopSites();
            await loadAvgResolutionTime();
        } else {
            alert(result.error || 'Erreur lors de la résolution');
        }
    } catch (error) {
        console.error('[Alerts] Erreur résolution totale:', error);
        alert('Erreur lors de la résolution');
    }
}

/**
 * Exporte les alertes en CSV
 */
function exportAlerts() {
    const filtered = filterAlerts();
    let csv = "ID,Type,Titre,Site,Pays,Domaine,KPI,Valeur,Seuil,Date\n";
    
    filtered.forEach(alert => {
        csv += `"${alert.id}","${alert.alert_type}","${alert.title || alert.kpi_name}","${alert.site_name}","${alert.country_name}","${alert.domain}","${alert.kpi_name}",${alert.current_value},${alert.threshold_value},"${alert.created_at}"\n`;
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
 * Formate un timestamp
 * @param {string} timestamp - Timestamp ISO
 * @returns {string} - Format relatif
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
 * @param {number} page - Numéro de page
 */
function goToAlertsPage(page) {
    alertsCurrentPage = page;
    updateAlertsList();
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', initAlerts);

window.showAlertDetails = showAlertDetails;
window.resolveAlert = resolveAlert;
window.goToAlertsPage = goToAlertsPage;