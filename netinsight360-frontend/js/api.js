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
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `Erreur HTTP ${response.status}`);
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
    
    static async getKpiTrends(siteId, kpiName, days = 5) {
        return this.request(`/kpis/get-kpi-trends.php?site_id=${encodeURIComponent(siteId)}&kpi_name=${encodeURIComponent(kpiName)}&days=${days}`);
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
    
    static async resolveAlert(alertId) {
        return this.request('/alerts/resolve-alert.php', {
            method: 'POST',
            body: { alert_id: alertId }
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
        return this.request('/users/forgot-password.php', {
            method: 'POST',
            body: { email }
        });
    }
    
    static async resetPassword(token, email, password) {
        return this.request('/users/reset-password.php', {
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
    
    static async generatePowerpointReport(filters = {}) {
        return this.request('/reports/generate-powerpoint.php', {
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
    
    static async getDashboardStats() {
        return this.request('/dashboard/get-stats.php');
    }
    
    static async getGlobalTrends(kpi = 'RNA') {
        return this.request(`/dashboard/get-trends.php?kpi=${kpi}`);
    }
}

// Exporter pour utilisation globale
window.API = API;