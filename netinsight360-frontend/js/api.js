/**
 * NetInsight 360 - API Client
 * Supervisez. Analysez. Optimisez.
 * 
 * Centralise tous les appels vers le backend PHP
 * Gère les requêtes HTTP, les erreurs et les tokens d'authentification
 */

// Configuration de l'API - CORRIGÉ
const API_BASE_URL = '/NetInsight%20360/netinsight360-backend/api';

class API {
    /**
     * Requête générique vers l'API
     * @param {string} endpoint - Point d'entrée API (ex: /auth/login.php)
     * @param {object} options - Options fetch (method, body, etc.)
     * @returns {Promise<object>} - Réponse JSON
     */
    static async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        
        console.log('[API] Requête vers:', url);  // Ajout pour debug
        
        // Configuration par défaut
        const config = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }
        
        try {
            const response = await fetch(url, config);
            const rawText = await response.text();
            const contentType = response.headers.get('content-type') || '';
            let data = null;

            // Le backend doit répondre en JSON. Si ce n'est pas le cas,
            // on renvoie une erreur explicite plutôt qu'un échec de parsing opaque.
            if (contentType.includes('application/json')) {
                data = rawText ? JSON.parse(rawText) : {};
            } else {
                try {
                    data = rawText ? JSON.parse(rawText) : {};
                } catch (_) {
                    data = {
                        success: false,
                        error: rawText ? `Réponse API non JSON: ${rawText.slice(0, 180)}` : 'Réponse API vide ou invalide'
                    };
                }
            }
            
            if (!response.ok) {
                throw new Error(data.error || `Erreur HTTP ${response.status}`);
            }

            if (typeof data !== 'object' || data === null) {
                throw new Error('Format de réponse API invalide');
            }
            
            return data;
        } catch (error) {
            console.error(`[API Error] ${endpoint}:`, error);
            throw error;
        }
    }
    
    // ============================================
    // AUTHENTIFICATION
    // ============================================
    
    static async login(email, password, remember = false) {
        return this.request('/auth/login.php', {
            method: 'POST',
            body: { email, password, remember }
        });
    }
    
    static async logout() {
        return this.request('/auth/logout.php', {
            method: 'POST'
        });
    }
    
    static async verify() {
        return this.request('/auth/verify.php');
    }
    
    // ============================================
    // SITES
    // ============================================
    
    static async getSites(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/sites/get-sites.php${suffix}`);
    }
    
    static async getSiteDetails(siteId) {
        return this.request(`/sites/get-site-details.php?id=${encodeURIComponent(siteId)}`);
    }
    
    static async searchSite(query) {
        return this.request(`/sites/search-site.php?q=${encodeURIComponent(query)}`);
    }
    
    static async getTopWorstSites(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/sites/get-top-worst-sites.php${suffix}`);
    }
    
    /**
     * Récupère les X pires sites groupés par technologie.
     * Retour attendu: { success:true, data: { date, top_n, per_tech: { '2G':[...], '3G':[...], ... } } }
     * Params acceptés : country, vendor, domain, top_n
     */
    static async getTopWorstSitesByTech(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/sites/get-top-worst-sites-by-tech.php${suffix}`);
    }
    
    // ============================================
    // KPIs
    // ============================================
    
    static async getRanKpis(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/kpis/get-ran-kpis.php${suffix}`);
    }
    
    static async getCoreKpis(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/kpis/get-core-kpis.php${suffix}`);
    }
    
    static async getKpiTrends(siteId, kpiName, days = 5, technology = null) {
        let url = `/kpis/get-kpi-trends.php?site_id=${encodeURIComponent(siteId)}&kpi_name=${encodeURIComponent(kpiName)}&days=${days}`;
        if (technology) url += `&technology=${encodeURIComponent(technology)}`;
        return this.request(url);
    }
    
    static async getKpiPredictions(siteId, kpiName) {
        return this.request(`/kpis/get-kpi-predictions.php?site_id=${encodeURIComponent(siteId)}&kpi_name=${encodeURIComponent(kpiName)}`);
    }
    
    static async getKpiComparison(siteId) {
        return this.request(`/kpis/get-kpi-comparison.php?site_id=${encodeURIComponent(siteId)}`);
    }
    
    // ============================================
    // ALERTES
    // ============================================
    
    static async getAlerts(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/alerts/get-alerts.php${suffix}`);
    }
    
    static async resolveAlert(alertId, note = '') {
        return this.request('/alerts/resolve-alert.php', {
            method: 'POST',
            body: { alert_id: alertId, note }
        });
    }

    static async acknowledgeAlert(alertId, note = '') {
        return this.request('/alerts/acknowledge-alert.php', {
            method: 'POST',
            body: { alert_id: alertId, note }
        });
    }

    static async escalateAlert(alertId, note = '') {
        return this.request('/alerts/escalate-alert.php', {
            method: 'POST',
            body: { alert_id: alertId, note }
        });
    }
    
    static async resolveAllAlerts() {
        return this.request('/alerts/resolve-all-alerts.php', {
            method: 'POST'
        });
    }
    
    static async getAlertsStats() {
        return this.request('/alerts/get-alerts-stats.php');
    }

    static async getAlertHistory(alertId) {
        return this.request(`/alerts/get-alert-history.php?alert_id=${encodeURIComponent(alertId)}`);
    }
    
    // ============================================
    // UTILISATEURS
    // ============================================
    
    static async getUsers(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/users/get-users.php${suffix}`);
    }
    
    static async createUser(userData) {
        return this.request('/users/create-user.php', {
            method: 'POST',
            body: userData
        });
    }
    
    static async updateUser(userId, userData) {
        return this.request(`/users/update-user.php?id=${userId}`, {
            method: 'PUT',
            body: userData
        });
    }
    
    static async deleteUser(userId) {
        return this.request(`/users/delete-user.php?id=${userId}`, {
            method: 'DELETE'
        });
    }
    
    static async changePassword(oldPassword, newPassword) {
        return this.request('/users/change-password.php', {
            method: 'POST',
            body: { old_password: oldPassword, new_password: newPassword }
        });
    }
    
    static async forgotPassword(email) {
        return this.request('/auth/forgot-password.php', {
            method: 'POST',
            body: { email }
        });
    }
    
    static async resetPassword(token, email, password) {
        return this.request('/auth/reset-password.php', {
            method: 'POST',
            body: { token, email, password }
        });
    }
    
    static async getUserStats() {
        return this.request('/users/get-user-stats.php');
    }
    
    // ============================================
    // RAPPORTS
    // ============================================
    
    static async generateWhatsAppReport(filters = {}) {
        return this.request('/reports/generate-whatsapp.php', {
            method: 'POST',
            body: filters
        });
    }
    
    static async getWeeklyComparison() {
        return this.request('/reports/get-weekly-comparison.php');
    }
    
    static async exportExcel(type, filters = {}) {
        const params = new URLSearchParams({ type, ...filters }).toString();
        return this.request(`/reports/export-excel.php?${params}`);
    }

    static async exportSite(siteId, format = 'csv') {
        if (format === 'pdf') {
            return this.request(`/reports/export-pdf.php?site_id=${encodeURIComponent(siteId)}`);
        }
        return this.request(`/reports/export-excel.php?type=site&site_id=${encodeURIComponent(siteId)}`);
    }

    static async exportPdf(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/reports/export-pdf.php${suffix}`);
    }
    
    // ============================================
    // CARTE
    // ============================================
    
    static async getMapMarkers(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/map/get-map-markers.php${suffix}`);
    }
    
    static async getCountryBounds(countryCode) {
        return this.request(`/map/get-country-bounds.php?country=${countryCode}`);
    }
    
    // ============================================
    // FILTRES
    // ============================================
    
    static async getFilterOptions() {
        return this.request('/filters/get-filter-options.php');
    }
    
    // ============================================
    // DASHBOARD
    // ============================================
    
    static async getDashboardStats(filters = {}) {
        const params = new URLSearchParams();
        if (filters.country && filters.country !== 'all') params.set('country', filters.country);
        if (filters.vendor  && filters.vendor  !== 'all') params.set('vendor',  filters.vendor);
        if (filters.tech    && filters.tech    !== 'all') params.set('tech',    filters.tech);
        const qs = params.toString();
        return this.request('/dashboard/get-stats.php' + (qs ? '?' + qs : ''));
    }
    
    static async getGlobalTrends(kpi = 'RNA') {
        return this.request(`/dashboard/get-trends.php?kpi=${kpi}`);
    }

    // ============================================
    // AUDIT
    // ============================================

    static async getAuditLogs(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/audit/get-audit-logs.php${suffix}`);
    }

    // ============================================
    // ADMIN — IMPORT
    // ============================================

    static async getImportStatus() {
        return this.request('/admin/get-import-status.php');
    }

    static async runImport() {
        return this.request('/admin/run-import.php', { method: 'POST' });
    }

    static async runImportByTech(tech) {
        return this.request('/admin/run-import-tech.php', {
            method: 'POST',
            body: { tech }
        });
    }

    // ============================================
    // UTILITAIRES CARTE — Badge compteur sites
    // ============================================

    /**
     * Met à jour le badge "X affichés / Y total" dans l'en-tête de la carte.
     * @param {object} result - Réponse de getMapMarkers (doit contenir count et total_count)
     * @param {string} mapElementId - ID de l'élément map Leaflet (défaut: 'map')
     */
    static updateMapCountBadge(result, mapElementId = 'map') {
        const mapEl = document.getElementById(mapElementId);
        if (!mapEl) return;
        const cardTitle = mapEl.closest('.stat-card')?.querySelector('h6, h5');
        if (!cardTitle) return;

        let badge = cardTitle.querySelector('.map-count-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'map-count-badge badge ms-2';
            badge.style.cssText = 'font-size:0.72rem;font-weight:500;vertical-align:middle;cursor:default';
            cardTitle.appendChild(badge);
        }

        const displayed = result.count    ?? 0;
        const total     = result.total_count ?? displayed;

        if (displayed < total) {
            badge.className = 'map-count-badge badge bg-warning text-dark ms-2';
            badge.title     = `Affichage limité à 20 sites par technologie (pires KPI). ${total - displayed} sites masqués.`;
            badge.textContent = `${displayed} / ${total} sites`;
        } else {
            badge.className = 'map-count-badge badge bg-success ms-2';
            badge.title     = 'Tous les sites sont affichés';
            badge.textContent = `${displayed} sites`;
        }
    }
}

// ============================================================
// Couleurs centralisées — référencées par tous les modules JS
// ============================================================
API.COLORS = {
    status: {
        good:     '#10b981',
        warning:  '#f59e0b',
        bad:      '#ef4444',
        critical: '#ef4444', // alias de bad — statut renvoyé par le backend
        unknown:  '#94a3b8',
    },
    tech: {
        '2G':   '#10b981',
        '3G':   '#f59e0b',
        '4G':   '#00a3c4',
        'CORE': '#8b5cf6',
    },
    trend: {
        up:   '#10b981',
        down: '#ef4444',
        flat: '#94a3b8',
    },
    brand: '#00a3c4',
    // Couleurs par vendor — ajout demandé : Huawei = rouge, Ericsson = bleu ciel
    vendor: {
        'Huawei':    '#ef4444',
        'Ericsson':  '#7dd3fc'
    }
};

/** Retourne la couleur hex correspondant au statut d'un site. */
API.statusColor = (status) => API.COLORS.status[status] ?? API.COLORS.status.unknown;

/** Retourne la couleur hex correspondant à une technologie. */
API.techColor = (tech) => API.COLORS.tech[tech] ?? '#94a3b8';

/** Retourne la couleur hex correspondant à un vendor (si connue). */
API.vendorColor = (vendor) => API.COLORS.vendor[vendor] ?? '#94a3b8';

// Exporter pour utilisation globale
window.API = API;