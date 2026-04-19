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
let alertsTotalItems = 0;
let alertsTotalPages = 1;
let alertsAutoRefreshTimer = null;
let currentAlertStatus = null;

function getActionComment() {
    const input = document.getElementById('alertActionComment');
    return input ? input.value.trim() : '';
}

function clearActionComment() {
    const input = document.getElementById('alertActionComment');
    if (input) input.value = '';
}

function getStatusLabel(status) {
    if (status === 'acknowledged') return 'En cours';
    if (status === 'escalated') return 'Escaladée';
    return 'Nouveau';
}

/**
 * Initialise la page des alertes
 */
async function initAlerts() {
    const isAuth = await checkAuthentication();
    if (!isAuth) return;

    await updateUserInterface();

    // Chargement initial: on récupère en parallèle la page d'alertes et les stats dashboard.
    await Promise.all([loadAlerts(), refreshAlertsDashboardStats()]);

    initAlertsFilters();
    initAlertsEvents();
    startAlertsAutoRefresh();
}

/**
 * Charge les alertes depuis le backend.
 * @param {boolean} fetchAllForExport - Si true, récupère un volume large pour export CSV.
 * @returns {Promise<Array>} Liste d'alertes récupérées.
 */
async function loadAlerts(fetchAllForExport = false) {
    try {
        const query = {
            ...alertsFilters,
            page: fetchAllForExport ? 1 : alertsCurrentPage,
            per_page: fetchAllForExport ? 100 : alertsItemsPerPage
        };

        const result = await API.getAlerts(query);
        if (!result.success) return [];

        const data = result.data || [];

        if (fetchAllForExport) {
            return data;
        }

        alertsData = data;
        alertsTotalItems = Number(result.total || 0);
        alertsTotalPages = Math.max(1, Number(result.total_pages || 1));

        // Protection: si la page courante dépasse le total (ex: après résolution), on revient à la dernière page valide.
        if (alertsCurrentPage > alertsTotalPages) {
            alertsCurrentPage = alertsTotalPages;
            return await loadAlerts(false);
        }

        updateAlertsList();
        return alertsData;
    } catch (error) {
        console.error('[Alerts] Erreur chargement alertes:', error);
        if (!fetchAllForExport) {
            const container = document.getElementById('alertsList');
            if (container) {
                container.innerHTML = `
                    <div class="text-center py-4">
                        <i class="bi bi-exclamation-triangle-fill text-danger fs-3"></i>
                        <p class="mt-2 text-danger mb-1">Impossible de charger les alertes</p>
                        <small class="text-muted">Vérifiez la connexion API ou rechargez la page.</small>
                    </div>
                `;
            }
        }
        return [];
    }
}

/**
 * Récupère les statistiques globales alertes (appel unique, réutilisé ensuite).
 * Cette mutualisation évite 4 appels API redondants à chaque rafraîchissement.
 */
async function fetchAlertsStats() {
    try {
        const result = await API.getAlertsStats();
        if (!result.success) return null;
        return result.data;
    } catch (error) {
        console.error('[Alerts] Erreur chargement stats:', error);
        return null;
    }
}

/**
 * Rafraîchit toute la zone dashboard alertes à partir d'un seul payload stats.
 */
async function refreshAlertsDashboardStats() {
    const stats = await fetchAlertsStats();
    if (!stats) return;

    renderAlertsStats(stats);
    renderAlertsCharts(stats);
    renderTopSites(stats);
    renderAvgResolutionTime(stats);
}

/**
 * Met à jour la liste des alertes (la pagination est déjà faite côté backend).
 */
function updateAlertsList() {
    const container = document.getElementById('alertsList');
    if (!container) return;

    if (alertsData.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-check-circle-fill fs-1 text-success"></i>
                <p class="mt-3 text-muted">Aucune alerte active. Tout va bien !</p>
            </div>
        `;
        renderPagination();
        return;
    }

    container.innerHTML = alertsData.map(alert => `
        <div class="alert-card ${alert.alert_type}" onclick="showAlertDetails(${alert.id})">
            <div class="alert-icon">
                <i class="bi ${alert.alert_type === 'critical' ? 'bi-exclamation-triangle-fill' : 'bi-shield-exclamation'}"></i>
            </div>
            <div class="alert-content">
                <div class="alert-title">
                    ${escapeHtml(alert.title || alert.kpi_name)}
                    <span class="alert-badge badge-${alert.alert_type}">${alert.alert_type === 'critical' ? 'CRITIQUE' : 'AVERTISSEMENT'}</span>
                    <span class="alert-status-chip ${alert.status}">${getStatusLabel(alert.status)}</span>
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
                    ${alert.acknowledged_by_name ? `<span><i class="bi bi-person-check"></i> Pris en charge par ${escapeHtml(alert.acknowledged_by_name)}</span>` : ''}
                    ${alert.escalated_by_name ? `<span><i class="bi bi-arrow-up-circle"></i> Escaladée par ${escapeHtml(alert.escalated_by_name)}</span>` : ''}
                </div>
            </div>
            <div class="alert-actions">
                ${alert.status === 'active' ? `
                    <button class="ack-btn" onclick="acknowledgeAlert(event, ${alert.id})" title="Prendre en charge">
                        <i class="bi bi-person-check"></i>
                    </button>
                ` : ''}
                ${alert.status !== 'escalated' ? `
                    <button class="escalate-btn" onclick="escalateAlert(event, ${alert.id})" title="Escalader">
                        <i class="bi bi-arrow-up-circle"></i>
                    </button>
                ` : ''}
                <button class="resolve-btn" onclick="resolveAlert(event, ${alert.id})" title="Marquer comme résolue">
                    <i class="bi bi-check-circle"></i>
                </button>
            </div>
        </div>
    `).join('');

    renderPagination();
}

/**
 * Rendu de la pagination basé sur les métadonnées backend.
 */
function renderPagination() {
    const paginationDiv = document.getElementById('paginationControls');
    if (!paginationDiv) return;

    if (alertsTotalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    const cur = alertsCurrentPage;
    const pages = [];

    pages.push(1);
    if (cur - 2 > 2) pages.push('...');
    for (let i = Math.max(2, cur - 2); i <= Math.min(alertsTotalPages - 1, cur + 2); i++) {
        pages.push(i);
    }
    if (cur + 2 < alertsTotalPages - 1) pages.push('...');
    if (alertsTotalPages > 1) pages.push(alertsTotalPages);

    let html = '<nav aria-label="Pagination alertes"><ul class="pagination flex-wrap">';
    html += `<li class="page-item ${cur === 1 ? 'disabled' : ''}">
        <button class="page-link" onclick="goToAlertsPage(${cur - 1})" ${cur === 1 ? 'disabled' : ''}>&lsaquo;</button></li>`;

    for (const p of pages) {
        if (p === '...') {
            html += '<li class="page-item disabled"><span class="page-link pagination-ellipsis">…</span></li>';
        } else {
            html += `<li class="page-item ${p === cur ? 'active' : ''}">
                <button class="page-link" onclick="goToAlertsPage(${p})">${p}</button></li>`;
        }
    }

    html += `<li class="page-item ${cur === alertsTotalPages ? 'disabled' : ''}">
        <button class="page-link" onclick="goToAlertsPage(${cur + 1})" ${cur === alertsTotalPages ? 'disabled' : ''}>&rsaquo;</button></li>`;
    html += '</ul></nav>';

    // Indication utile de volume total.
    html += `<div class="text-center mt-2 small text-muted">${alertsTotalItems} alerte(s) au total</div>`;

    paginationDiv.innerHTML = html;
}

/**
 * Remplit les cartes statistiques.
 */
function renderAlertsStats(stats) {
    document.getElementById('activeAlertsCount').innerText = stats.active || 0;
    document.getElementById('criticalAlertsCount').innerText = stats.critical || 0;
    document.getElementById('warningAlertsCount').innerText = stats.warning || 0;
    document.getElementById('resolvedTodayCount').innerText = stats.resolved_today || 0;
}

/**
 * Rend les graphiques à partir du même objet stats (pas de second appel API).
 */
function renderAlertsCharts(stats) {
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
            labels: ['RAN (Radio)', 'CORE (Coeur)'],
            datasets: [{ data: [stats.by_domain.ran || 0, stats.by_domain.core || 0], backgroundColor: ['#00a3c4', '#f59e0b'] }]
        });
    }
}

/**
 * Rend la liste des sites les plus impactés.
 */
function renderTopSites(stats) {
    const container = document.getElementById('topSitesList');
    if (!container) return;

    const topSites = stats.top_sites || [];
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
}

/**
 * Rend la carte du temps moyen de résolution.
 */
function renderAvgResolutionTime(stats) {
    const avgTime = stats.avg_resolution_hours || 0;
    document.getElementById('avgResolutionTime').innerText = avgTime;
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

    const applyFilters = async () => {
        alertsFilters = {
            type: filterType?.value || 'all',
            country: filterCountry?.value || 'all',
            domain: filterDomain?.value || 'all',
            search: searchInput?.value.trim() || ''
        };
        alertsCurrentPage = 1;
        // Les filtres sont appliqués côté API, on recharge uniquement la liste paginée.
        await loadAlerts();
    };

    if (filterType) filterType.addEventListener('change', applyFilters);
    if (filterCountry) filterCountry.addEventListener('change', applyFilters);
    if (filterDomain) filterDomain.addEventListener('change', applyFilters);

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', applyFilters);
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') applyFilters(); });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            if (filterType) filterType.value = 'all';
            if (filterCountry) filterCountry.value = 'all';
            if (filterDomain) filterDomain.value = 'all';
            if (searchInput) searchInput.value = '';
            alertsFilters = { type: 'all', country: 'all', domain: 'all', search: '' };
            alertsCurrentPage = 1;
            await loadAlerts();
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

    const acknowledgeAlertBtn = document.getElementById('acknowledgeAlertBtn');
    if (acknowledgeAlertBtn) {
        acknowledgeAlertBtn.addEventListener('click', () => {
            if (currentAlertId) {
                acknowledgeAlert(null, currentAlertId);
            }
        });
    }

    const escalateAlertBtn = document.getElementById('escalateAlertBtn');
    if (escalateAlertBtn) {
        escalateAlertBtn.addEventListener('click', () => {
            if (currentAlertId) {
                escalateAlert(null, currentAlertId);
            }
        });
    }
}

let currentAlertId = null;

/**
 * Affiche les détails d'une alerte
 * @param {number} alertId - Identifiant de l'alerte
 */
async function showAlertDetails(alertId) {
    const alert = alertsData.find(a => a.id === alertId);
    if (!alert) return;

    currentAlertId = alertId;
    currentAlertStatus = alert.status;

    const modalHeader = document.getElementById('alertModalHeader');
    const modalTitle = document.getElementById('alertModalTitle');
    const modalContent = document.getElementById('alertDetailsContent');
    const acknowledgeAlertBtn = document.getElementById('acknowledgeAlertBtn');
    const escalateAlertBtn = document.getElementById('escalateAlertBtn');

    // Le bouton "Prendre en charge" n'est affiché que pour les alertes actives.
    if (acknowledgeAlertBtn) {
        acknowledgeAlertBtn.style.display = alert.status === 'active' ? 'inline-block' : 'none';
    }
    if (escalateAlertBtn) {
        escalateAlertBtn.style.display = alert.status === 'escalated' ? 'none' : 'inline-block';
    }

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
                        ${escapeHtml(alert.message || 'Alerte reseau detectee')}
                    </div>
                    <div class="mt-3">
                        <strong>Actions recommandées :</strong>
                        <ul>
                            <li>Vérifier les équipements concernés</li>
                            <li>Analyser les logs système</li>
                            <li>Contacter l'équipe de maintenance</li>
                        </ul>
                    </div>
                    <div class="history-timeline" id="alertHistoryTimeline">
                        <div class="history-meta">Chargement de l'historique...</div>
                    </div>
                </div>
            </div>
        `;
    }

    await loadAlertHistory(alertId);

    const modal = new bootstrap.Modal(document.getElementById('alertDetailsModal'));
    modal.show();
}

/**
 * Charge la timeline de traitement pour l'alerte affichée.
 */
async function loadAlertHistory(alertId) {
    const container = document.getElementById('alertHistoryTimeline');
    if (!container) return;

    try {
        const result = await API.getAlertHistory(alertId);
        const items = result?.success ? (result.data?.history || []) : [];

        if (items.length === 0) {
            container.innerHTML = '<div class="history-meta">Aucun historique disponible</div>';
            return;
        }

        const actionLabel = (type) => {
            if (type === 'created') return 'Création';
            if (type === 'acknowledged') return 'Prise en charge';
            if (type === 'escalated') return 'Escalade';
            if (type === 'resolved') return 'Résolution';
            if (type === 'resolved_all') return 'Résolution en masse';
            return type;
        };

        container.innerHTML = `
            <strong>Historique de traitement</strong>
            ${items.map((item) => `
                <div class="history-item">
                    <div class="history-title">${actionLabel(item.action_type)} - ${escapeHtml(item.action_note || '')}</div>
                    <div class="history-meta">${escapeHtml(item.actor_name || 'Système')} - ${new Date(item.created_at).toLocaleString('fr-FR')}</div>
                </div>
            `).join('')}
        `;
    } catch (error) {
        container.innerHTML = '<div class="history-meta">Historique indisponible</div>';
    }
}

/**
 * Prend en charge une alerte (statut acknowledged / en cours).
 */
async function acknowledgeAlert(event, alertId) {
    if (event) event.stopPropagation();

    try {
        const result = await API.acknowledgeAlert(alertId, getActionComment());
        if (result.success) {
            await Promise.all([loadAlerts(), refreshAlertsDashboardStats()]);

            // Si la modal est ouverte, on recharge son contenu pour refléter le nouveau statut.
            if (currentAlertId === alertId) {
                await showAlertDetails(alertId);
            }
            clearActionComment();
        } else {
            alert(result.error || 'Erreur lors de la prise en charge');
        }
    } catch (error) {
        console.error('[Alerts] Erreur prise en charge:', error);
        alert('Erreur lors de la prise en charge');
    }
}

/**
 * Escalade une alerte à un niveau de priorité supérieur.
 */
async function escalateAlert(event, alertId) {
    if (event) event.stopPropagation();

    try {
        const result = await API.escalateAlert(alertId, getActionComment());
        if (result.success) {
            await Promise.all([loadAlerts(), refreshAlertsDashboardStats()]);

            if (currentAlertId === alertId) {
                await showAlertDetails(alertId);
            }
            clearActionComment();
        } else {
            alert(result.error || 'Erreur lors de l\'escalade');
        }
    } catch (error) {
        console.error('[Alerts] Erreur escalade:', error);
        alert('Erreur lors de l\'escalade');
    }
}

/**
 * Résout une alerte
 * @param {Event} event - Événement
 * @param {number} alertId - Identifiant de l'alerte
 */
async function resolveAlert(event, alertId) {
    if (event) event.stopPropagation();

    try {
        const result = await API.resolveAlert(alertId, getActionComment());
        if (result.success) {
            // Après action métier, on rafraîchit la liste + les stats agrégées.
            await Promise.all([loadAlerts(), refreshAlertsDashboardStats()]);

            const modal = bootstrap.Modal.getInstance(document.getElementById('alertDetailsModal'));
            if (modal) modal.hide();
            clearActionComment();
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
            await Promise.all([loadAlerts(), refreshAlertsDashboardStats()]);
        } else {
            alert(result.error || 'Erreur lors de la résolution');
        }
    } catch (error) {
        console.error('[Alerts] Erreur résolution totale:', error);
        alert('Erreur lors de la résolution');
    }
}

/**
 * Exporte les alertes en CSV UTF-8 (avec BOM) pour une ouverture correcte dans Excel.
 */
async function exportAlerts() {
    const allAlerts = await loadAlerts(true);

    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [];

    rows.push(['ID', 'Type', 'Titre', 'Site', 'Pays', 'Domaine', 'KPI', 'Valeur', 'Seuil', 'Date']);

    allAlerts.forEach(alert => {
        rows.push([
            alert.id,
            alert.alert_type,
            alert.title || alert.kpi_name,
            alert.site_name,
            alert.country_name,
            alert.domain,
            alert.kpi_name,
            alert.current_value,
            alert.threshold_value,
            alert.created_at
        ]);
    });

    const csvBody = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const utf8Bom = '\uFEFF';

    const blob = new Blob([utf8Bom + csvBody], { type: 'text/csv;charset=utf-8;' });
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
async function goToAlertsPage(page) {
    if (page < 1 || page > alertsTotalPages || page === alertsCurrentPage) return;
    alertsCurrentPage = page;
    await loadAlerts();
}

/**
 * Rafraîchissement automatique léger pour supervision quasi temps réel.
 */
function startAlertsAutoRefresh() {
    if (alertsAutoRefreshTimer) {
        clearInterval(alertsAutoRefreshTimer);
    }

    alertsAutoRefreshTimer = setInterval(async () => {
        await Promise.all([loadAlerts(), refreshAlertsDashboardStats()]);
    }, 60000);
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', initAlerts);

window.showAlertDetails = showAlertDetails;
window.resolveAlert = resolveAlert;
window.acknowledgeAlert = acknowledgeAlert;
window.escalateAlert = escalateAlert;
window.goToAlertsPage = goToAlertsPage;
