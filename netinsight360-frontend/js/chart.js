/**
 * NetInsight 360 - Module Graphiques
 * Supervisez. Analysez. Optimisez.
 * 
 * Ce module initialise et met à jour les graphiques Chart.js.
 */

let ranTrendChart, packetLossChart, trend5DaysChart, comparisonChart;

/**
 * Initialise tous les graphiques du dashboard
 */
function initCharts() {
    // Graphique d'évolution RAN (RNA)
    const ctxTrend = document.getElementById('ranTrendChart')?.getContext('2d');
    if (ctxTrend) {
        ranTrendChart = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6'],
                datasets: [{
                    label: 'RNA (%)',
                    data: [97.8, 98.2, 98.5, 98.9, 99.1, 99.3],
                    borderColor: '#00a3c4',
                    backgroundColor: 'rgba(0,163,196,0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }

    // Graphique Packet Loss par pays
    const ctxPacket = document.getElementById('packetLossChart')?.getContext('2d');
    if (ctxPacket) {
        packetLossChart = new Chart(ctxPacket, {
            type: 'bar',
            data: {
                labels: ['CI', 'NE', 'TG', 'BJ', 'CF'],
                datasets: [{
                    label: 'Packet Loss (%)',
                    data: [0.85, 1.25, 0.95, 0.75, 2.1],
                    backgroundColor: '#f59e0b'
                }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
}

/**
 * Met à jour le graphique de tendance sur 5 jours pour un site donné
 * @param {object} site - Le site pour lequel afficher la tendance
 * @param {string} canvasId - ID du canvas
 */
function updateTrend5DaysChart(site, canvasId = 'trend5DaysChart') {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    // Générer des données de tendance (à remplacer par données réelles)
    const trendData = [site.kpi - 3.2, site.kpi - 2.1, site.kpi - 1.5, site.kpi - 0.8, site.kpi];
    
    if (trend5DaysChart) trend5DaysChart.destroy();
    
    trend5DaysChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['J-4', 'J-3', 'J-2', 'J-1', 'Aujourd\'hui'],
            datasets: [{
                label: `${site.name} - Évolution KPI (%)`,
                data: trendData,
                borderColor: site.status === 'good' ? '#10b981' : (site.status === 'warning' ? '#f59e0b' : '#ef4444'),
                backgroundColor: 'rgba(0,163,196,0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: true }
    });
}

/**
 * Met à jour le graphique de comparaison hebdomadaire
 */
function updateComparisonChart() {
    const ctx = document.getElementById('comparisonChart')?.getContext('2d');
    if (!ctx) return;
    
    if (comparisonChart) comparisonChart.destroy();
    
    comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Côte Ivoire', 'Niger', 'Togo', 'Bénin', 'Centrafrique'],
            datasets: [
                { label: 'Semaine actuelle', data: [94.2, 92.5, 93.8, 95.2, 86.5], backgroundColor: '#00a3c4' },
                { label: 'Semaine précédente', data: [93.5, 91.2, 92.5, 94.8, 84.2], backgroundColor: '#f59e0b' }
            ]
        }
    });
}