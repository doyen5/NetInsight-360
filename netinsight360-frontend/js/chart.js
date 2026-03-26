/**
 * NetInsight 360 - Gestion des graphiques
 * Supervisez. Analysez. Optimisez.
 * 
 * Classe utilitaire pour la création et la gestion des graphiques Chart.js (app.js)
 * Centralise la création, la mise à jour et la destruction des graphiques
 */

class ChartManager {
    constructor() {
        /**
         * Stockage des instances de graphiques
         * @type {Object.<string, Chart>}
         */
        this.charts = {};
        
        /**
         * Configuration des couleurs par défaut
         */
        this.defaultColors = {
            primary: '#00a3c4',
            success: '#10b981',
            warning: '#f59e0b',
            danger: '#ef4444',
            info: '#3b82f6',
            secondary: '#64748b'
        };
        
        /**
         * Configuration des dégradés
         */
        this.gradients = {};
    }
    
    /**
     * Crée un dégradé pour un canvas
     * @param {CanvasRenderingContext2D} ctx - Contexte canvas
     * @param {string} colorStart - Couleur de début
     * @param {string} colorEnd - Couleur de fin
     * @returns {CanvasGradient}
     */
    createGradient(ctx, colorStart, colorEnd) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);
        return gradient;
    }
    
    /**
     * Crée un graphique en barres
     * @param {string} canvasId - ID du canvas
     * @param {Object} data - Données du graphique
     * @param {Object} options - Options Chart.js
     * @returns {Chart|null}
     */
    createBarChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`[ChartManager] Canvas ${canvasId} introuvable`);
            return null;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Détruire l'instance existante
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        // Options par défaut
        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { family: 'Inter, sans-serif', size: 11 },
                        boxWidth: 12,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleFont: { family: 'Inter, sans-serif', size: 12 },
                    bodyFont: { family: 'Inter, sans-serif', size: 11 },
                    padding: 10,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#e2e8f0', drawBorder: false },
                    title: { display: false }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 } }
                }
            }
        };
        
        // Fusionner les options
        const mergedOptions = this.deepMerge(defaultOptions, options);
        
        // Créer le graphique
        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: mergedOptions
        });
        
        return this.charts[canvasId];
    }
    
    /**
     * Crée un graphique en ligne
     * @param {string} canvasId - ID du canvas
     * @param {Object} data - Données du graphique
     * @param {Object} options - Options Chart.js
     * @returns {Chart|null}
     */
    createLineChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`[ChartManager] Canvas ${canvasId} introuvable`);
            return null;
        }
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Inter, sans-serif', size: 11 }, boxWidth: 12 }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleFont: { family: 'Inter, sans-serif', size: 12 },
                    bodyFont: { family: 'Inter, sans-serif', size: 11 },
                    padding: 10,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#e2e8f0', drawBorder: false },
                    ticks: { font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 } }
                }
            },
            elements: {
                line: { tension: 0.4, borderWidth: 2, fill: true },
                point: { radius: 3, hoverRadius: 5, borderWidth: 2, backgroundColor: 'white' }
            }
        };
        
        const mergedOptions = this.deepMerge(defaultOptions, options);
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: data,
            options: mergedOptions
        });
        
        return this.charts[canvasId];
    }
    
    /**
     * Crée un graphique circulaire (pie)
     * @param {string} canvasId - ID du canvas
     * @param {Object} data - Données du graphique
     * @param {Object} options - Options Chart.js
     * @returns {Chart|null}
     */
    createPieChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`[ChartManager] Canvas ${canvasId} introuvable`);
            return null;
        }
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Inter, sans-serif', size: 11 }, boxWidth: 12 }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleFont: { family: 'Inter, sans-serif', size: 12 },
                    bodyFont: { family: 'Inter, sans-serif', size: 11 },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: (context) => {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        };
        
        const mergedOptions = this.deepMerge(defaultOptions, options);
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'pie',
            data: data,
            options: mergedOptions
        });
        
        return this.charts[canvasId];
    }
    
    /**
     * Crée un graphique en anneau (doughnut)
     * @param {string} canvasId - ID du canvas
     * @param {Object} data - Données du graphique
     * @param {Object} options - Options Chart.js
     * @returns {Chart|null}
     */
    createDoughnutChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`[ChartManager] Canvas ${canvasId} introuvable`);
            return null;
        }
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Inter, sans-serif', size: 11 }, boxWidth: 12 }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleFont: { family: 'Inter, sans-serif', size: 12 },
                    bodyFont: { family: 'Inter, sans-serif', size: 11 },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: (context) => {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        };
        
        const mergedOptions = this.deepMerge(defaultOptions, options);
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: mergedOptions
        });
        
        return this.charts[canvasId];
    }
    
    /**
     * Crée un graphique radar
     * @param {string} canvasId - ID du canvas
     * @param {Object} data - Données du graphique
     * @param {Object} options - Options Chart.js
     * @returns {Chart|null}
     */
    createRadarChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`[ChartManager] Canvas ${canvasId} introuvable`);
            return null;
        }
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Inter, sans-serif', size: 11 }, boxWidth: 12 }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleFont: { family: 'Inter, sans-serif', size: 12 },
                    bodyFont: { family: 'Inter, sans-serif', size: 11 },
                    padding: 10,
                    cornerRadius: 8
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { stepSize: 20, backdropColor: 'transparent', font: { size: 9 } },
                    grid: { color: '#e2e8f0' },
                    pointLabels: { font: { size: 10, family: 'Inter, sans-serif' } }
                }
            },
            elements: {
                line: { borderWidth: 2, tension: 0.1 },
                point: { radius: 3, hoverRadius: 5, borderWidth: 2, backgroundColor: 'white' }
            }
        };
        
        const mergedOptions = this.deepMerge(defaultOptions, options);
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'radar',
            data: data,
            options: mergedOptions
        });
        
        return this.charts[canvasId];
    }
    
    /**
     * Met à jour un graphique existant
     * @param {string} canvasId - ID du canvas
     * @param {Object} data - Nouvelles données
     * @param {Object} options - Nouvelles options (optionnel)
     */
    updateChart(canvasId, data, options = {}) {
        if (this.charts[canvasId]) {
            if (data) {
                this.charts[canvasId].data = data;
            }
            if (options) {
                Object.assign(this.charts[canvasId].options, options);
            }
            this.charts[canvasId].update();
        } else {
            console.warn(`[ChartManager] Graphique ${canvasId} non trouvé pour mise à jour`);
        }
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
            this.destroy(key);
        });
        this.charts = {};
    }
    
    /**
     * Récupère une instance de graphique
     * @param {string} canvasId - ID du canvas
     * @returns {Chart|null}
     */
    getChart(canvasId) {
        return this.charts[canvasId] || null;
    }
    
    /**
     * Vérifie si un graphique existe
     * @param {string} canvasId - ID du canvas
     * @returns {boolean}
     */
    hasChart(canvasId) {
        return !!this.charts[canvasId];
    }
    
    /**
     * Fusionne deux objets en profondeur
     * @param {Object} target - Objet cible
     * @param {Object} source - Objet source
     * @returns {Object}
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                    if (typeof target[key] === 'object' && target[key] !== null) {
                        result[key] = this.deepMerge(target[key], source[key]);
                    } else {
                        result[key] = this.deepMerge({}, source[key]);
                    }
                } else {
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    }
}

// Créer une instance globale du gestionnaire de graphiques
window.chartManager = new ChartManager();