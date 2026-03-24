/**
 * NetInsight 360 - Gestion des graphiques
 * Supervisez. Analysez. Optimisez.
 * 
 * Utilitaires pour la création et la mise à jour des graphiques Chart.js
 */

class ChartManager {
    constructor() {
        this.charts = {};
    }
    
    /**
     * Crée un graphique en barres
     * @param {string} canvasId - ID du canvas
     * @param {object} data - Données du graphique
     * @param {object} options - Options Chart.js
     */
    createBarChart(canvasId, data, options = {}) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return null;
        
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: true,
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { position: 'bottom' } }
        };
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: { ...defaultOptions, ...options }
        });
        
        return this.charts[canvasId];
    }
    
    /**
     * Crée un graphique en ligne
     * @param {string} canvasId - ID du canvas
     * @param {object} data - Données du graphique
     * @param {object} options - Options Chart.js
     */
    createLineChart(canvasId, data, options = {}) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return null;
        
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { position: 'bottom' } }
        };
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: data,
            options: { ...defaultOptions, ...options }
        });
        
        return this.charts[canvasId];
    }
    
    /**
     * Crée un graphique circulaire (pie/doughnut)
     * @param {string} canvasId - ID du canvas
     * @param {object} data - Données du graphique
     * @param {string} type - 'pie' ou 'doughnut'
     */
    createPieChart(canvasId, data, type = 'doughnut') {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return null;
        
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        this.charts[canvasId] = new Chart(ctx, {
            type: type,
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { position: 'bottom' } }
            }
        });
        
        return this.charts[canvasId];
    }
    
    /**
     * Crée un graphique radar
     * @param {string} canvasId - ID du canvas
     * @param {object} data - Données du graphique
     */
    createRadarChart(canvasId, data) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return null;
        
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'radar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: { r: { beginAtZero: true, max: 100 } }
            }
        });
        
        return this.charts[canvasId];
    }
    
    /**
     * Détruit un graphique
     * @param {string} canvasId - ID du canvas
     */
    destroy(canvasId) {
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
            delete this.charts[canvasId];
        }
    }
    
    /**
     * Détruit tous les graphiques
     */
    destroyAll() {
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key]) {
                this.charts[key].destroy();
            }
        });
        this.charts = {};
    }
}

// Instance globale
window.chartManager = new ChartManager();