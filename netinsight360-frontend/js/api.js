/**
 * NetInsight 360 - API Client
 * Supervisez. Analysez. Optimisez.
 * 
 * Centralise tous les appels vers le backend PHP
 * Gère les requêtes HTTP, les erreurs et les tokens d'authentification
 */

// Configuration de l'API
const API_BASE_URL = '/NetInsight%20360/api';

class API {
    /**
     * Requête générique vers l'API
     * @param {string} endpoint - Point d'entrée API (ex: /auth/login.php)
     * @param {object} options - Options fetch (method, body, etc.)
     * @returns {Promise<object>} - Réponse JSON
     */
    static async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        
        // Configuration par défaut
        const config = {
            credentials: 'include', // Inclut les cookies de session
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        // Si body est un objet, le convertir en JSON
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
    
    /**
     * Connexion utilisateur
     * @param {string} email - Email de l'utilisateur
     * @param {string} password - Mot de passe
     * @param {boolean} remember - Rester connecté
     */
    static async login(email, password, remember = false) {
        return this.request('/auth/login.php', {
            method: 'POST',
            body: { email, password, remember }
        });
    }
    
    /**
     * Déconnexion
     */
    static async logout() {
        return this.request('/auth/logout.php', {
            method: 'POST'
        });
    }
    
    /**
     * Vérification de session
     */
    static async verify() {
        return this.request('/auth/verify.php');
    }
    
    // ============================================
    // SITES
    // ============================================
    
    /**
     * Récupère la liste des sites
     * @param {object} filters - Filtres (country, vendor, tech, domain)
     */
    static async getSites(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/sites/get-sites.php${suffix}`);
    }
    
    /**
     * Récupère les détails d'un site
     * @param {string} siteId - Identifiant du site
     */
    static async getSiteDetails(siteId) {
        return this.request(`/sites/get-site-details.php?id=${encodeURIComponent(siteId)}`);
    }
    
    /**
     * Recherche un site par nom ou ID
     * @param {string} query - Terme de recherche
     */
    static async searchSite(query) {
        return this.request(`/sites/search-site.php?q=${encodeURIComponent(query)}`);
    }
    
    /**
     * Récupère les top/pires sites
     * @param {object} filters - Filtres (country, vendor, tech, domain)
     */
    static async getTopWorstSites(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/sites/get-top-worst-sites.php${suffix}`);
    }
    
    // ============================================
    // KPIs
    // ============================================
    
    /**
     * Récupère les KPIs RAN
     * @param {object} filters - Filtres (country, technology, vendor)
     */
    static async getRanKpis(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/kpis/get-ran-kpis.php${suffix}`);
    }
    
    /**
     * Récupère les KPIs CORE
     * @param {object} filters - Filtres (country, vendor)
     */
    static async getCoreKpis(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/kpis/get-core-kpis.php${suffix}`);
    }
    
    /**
     * Récupère les tendances d'un KPI sur N jours
     * @param {string} siteId - Identifiant du site
     * @param {string} kpiName - Nom du KPI
     * @param {number} days - Nombre de jours
     */
    static async getKpiTrends(siteId, kpiName, days = 5) {
        return this.request(`/kpis/get-kpi-trends.php?site_id=${encodeURIComponent(siteId)}&kpi_name=${encodeURIComponent(kpiName)}&days=${days}`);
    }
    
    /**
     * Récupère les prédictions pour un site
     * @param {string} siteId - Identifiant du site
     * @param {string} kpiName - Nom du KPI
     */
    static async getKpiPredictions(siteId, kpiName) {
        return this.request(`/kpis/get-kpi-predictions.php?site_id=${encodeURIComponent(siteId)}&kpi_name=${encodeURIComponent(kpiName)}`);
    }
    
    /**
     * Récupère la comparaison entre sites
     * @param {string} siteId - Identifiant du site
     */
    static async getKpiComparison(siteId) {
        return this.request(`/kpis/get-kpi-comparison.php?site_id=${encodeURIComponent(siteId)}`);
    }
    
    // ============================================
    // ALERTES
    // ============================================
    
    /**
     * Récupère les alertes actives
     * @param {object} filters - Filtres (type, country, domain)
     */
    static async getAlerts(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/alerts/get-alerts.php${suffix}`);
    }
    
    /**
     * Résout une alerte
     * @param {number} alertId - Identifiant de l'alerte
     */
    static async resolveAlert(alertId) {
        return this.request('/alerts/resolve-alert.php', {
            method: 'POST',
            body: { alert_id: alertId }
        });
    }
    
    /**
     * Résout toutes les alertes
     */
    static async resolveAllAlerts() {
        return this.request('/alerts/resolve-all-alerts.php', {
            method: 'POST'
        });
    }
    
    /**
     * Récupère les statistiques des alertes
     */
    static async getAlertsStats() {
        return this.request('/alerts/get-alerts-stats.php');
    }
    
    // ============================================
    // UTILISATEURS
    // ============================================
    
    /**
     * Récupère la liste des utilisateurs
     * @param {object} filters - Filtres (role, search)
     */
    static async getUsers(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/users/get-users.php${suffix}`);
    }
    
    /**
     * Crée un nouvel utilisateur
     * @param {object} userData - Données utilisateur (name, email, role, password)
     */
    static async createUser(userData) {
        return this.request('/users/create-user.php', {
            method: 'POST',
            body: userData
        });
    }
    
    /**
     * Modifie un utilisateur
     * @param {number} userId - Identifiant de l'utilisateur
     * @param {object} userData - Données à modifier
     */
    static async updateUser(userId, userData) {
        return this.request(`/users/update-user.php?id=${userId}`, {
            method: 'PUT',
            body: userData
        });
    }
    
    /**
     * Supprime un utilisateur
     * @param {number} userId - Identifiant de l'utilisateur
     */
    static async deleteUser(userId) {
        return this.request(`/users/delete-user.php?id=${userId}`, {
            method: 'DELETE'
        });
    }
    
    /**
     * Change le mot de passe
     * @param {string} oldPassword - Ancien mot de passe
     * @param {string} newPassword - Nouveau mot de passe
     */
    static async changePassword(oldPassword, newPassword) {
        return this.request('/users/change-password.php', {
            method: 'POST',
            body: { old_password: oldPassword, new_password: newPassword }
        });
    }
    
    /**
     * Demande de réinitialisation de mot de passe
     * @param {string} email - Email de l'utilisateur
     */
    static async forgotPassword(email) {
        return this.request('/users/forgot-password.php', {
            method: 'POST',
            body: { email }
        });
    }
    
    /**
     * Réinitialise le mot de passe
     * @param {string} token - Token de réinitialisation
     * @param {string} email - Email de l'utilisateur
     * @param {string} password - Nouveau mot de passe
     */
    static async resetPassword(token, email, password) {
        return this.request('/users/reset-password.php', {
            method: 'POST',
            body: { token, email, password }
        });
    }
    
    /**
     * Récupère les statistiques des utilisateurs
     */
    static async getUserStats() {
        return this.request('/users/get-user-stats.php');
    }
    
    // ============================================
    // RAPPORTS
    // ============================================
    
    /**
     * Génère un rapport WhatsApp
     * @param {object} filters - Filtres à appliquer
     */
    static async generateWhatsAppReport(filters = {}) {
        return this.request('/reports/generate-whatsapp.php', {
            method: 'POST',
            body: filters
        });
    }
    
    /**
     * Génère un rapport PowerPoint
     * @param {object} filters - Filtres à appliquer
     */
    static async generatePowerpointReport(filters = {}) {
        return this.request('/reports/generate-powerpoint.php', {
            method: 'POST',
            body: filters
        });
    }
    
    /**
     * Récupère la comparaison hebdomadaire
     */
    static async getWeeklyComparison() {
        return this.request('/reports/get-weekly-comparison.php');
    }
    
    /**
     * Exporte les données en Excel
     * @param {string} type - Type de données à exporter
     * @param {object} filters - Filtres à appliquer
     */
    static async exportExcel(type, filters = {}) {
        const params = new URLSearchParams({ type, ...filters }).toString();
        return this.request(`/reports/export-excel.php?${params}`);
    }
    
    // ============================================
    // CARTE
    // ============================================
    
    /**
     * Récupère les marqueurs pour la carte
     * @param {object} filters - Filtres (country, vendor, tech, domain)
     */
    static async getMapMarkers(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const suffix = params ? `?${params}` : '';
        return this.request(`/map/get-map-markers.php${suffix}`);
    }
    
    /**
     * Récupère les limites d'un pays
     * @param {string} countryCode - Code pays
     */
    static async getCountryBounds(countryCode) {
        return this.request(`/map/get-country-bounds.php?country=${countryCode}`);
    }
    
    // ============================================
    // FILTRES
    // ============================================
    
    /**
     * Récupère les options de filtres disponibles
     */
    static async getFilterOptions() {
        return this.request('/filters/get-filter-options.php');
    }
    
    // ============================================
    // DASHBOARD
    // ============================================
    
    /**
     * Récupère les statistiques du dashboard
     */
    static async getDashboardStats() {
        return this.request('/dashboard/get-stats.php');
    }
    
    /**
     * Récupère les tendances globales
     * @param {string} kpi - KPI à analyser
     */
    static async getGlobalTrends(kpi = 'RNA') {
        return this.request(`/dashboard/get-trends.php?kpi=${kpi}`);
    }
}

// Exporter pour utilisation globale
window.API = API;