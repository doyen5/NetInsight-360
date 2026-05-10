/**
 * NetInsight 360 - Rapports
 * Supervisez. Analysez. Optimisez.
 * 
 * Utilitaires pour la génération de rapports
 */

/**
 * Génère un rapport WhatsApp
 * @param {object} filters - Filtres à appliquer
 * @returns {Promise<string>} - Contenu du rapport
 */
async function generateWhatsAppReport(filters = {}) {
    try {
        const result = await API.generateWhatsAppReport(filters);
        if (result.success && result.report) {
            return result.report;
        }
        throw new Error(result.error || 'Erreur de génération');
    } catch (error) {
        console.error('[Reports] Erreur génération WhatsApp:', error);
        throw error;
    }
}

/**
 * Exporte des données en Excel
 * @param {string} type - Type de données (sites, alerts, users)
 * @param {object} filters - Filtres à appliquer
 * @returns {Promise<string>} - URL du fichier
 */
async function exportToExcel(type, filters = {}) {
    try {
        const result = await API.exportExcel(type, filters);
        if (result.success && result.url) {
            return result.url;
        }
        throw new Error(result.error || 'Erreur d\'export');
    } catch (error) {
        console.error('[Reports] Erreur export Excel:', error);
        throw error;
    }
}

/**
 * Ouvre un rapport dans un nouvel onglet
 * @param {string} url - URL du rapport
 */
function openReport(url) {
    window.open(url, '_blank');
}

/**
 * Partage un rapport via WhatsApp
 * @param {string} text - Texte à partager
 */
function shareViaWhatsApp(text) {
    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
}

// Exporter les fonctions
window.generateWhatsAppReport = generateWhatsAppReport;
window.exportToExcel = exportToExcel;
window.openReport = openReport;
window.shareViaWhatsApp = shareViaWhatsApp;