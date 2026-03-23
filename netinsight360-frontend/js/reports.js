/**
 * NetInsight 360 - Module Rapports
 * Supervisez. Analysez. Optimisez.
 * 
 * Ce module gère la génération et le partage des rapports.
 */

/**
 * Génère un rapport WhatsApp basé sur les pires sites
 * @returns {string} Texte du rapport
 */
function generateWhatsAppReport() {
    let sites = window.sitesData || [];
    let worst = [...sites].sort((a,b) => a.kpi - b.kpi).slice(0,10);
    let report = `📡 *NETINSIGHT 360 - RAPPORT* 📡\n\n`;
    report += `📅 Date: ${new Date().toLocaleDateString('fr-FR')}\n`;
    report += `👤 Opérateur: ${getCurrentUserName()}\n`;
    report += `📍 Sites supervisés: ${sites.length}\n\n`;
    report += `⚠️ *TOP 10 SITES CRITIQUES* ⚠️\n`;
    worst.forEach((s, i) => {
        report += `${i+1}. ${s.name} (${s.countryName}) - KPI: ${s.kpi}% - ${s.vendor}/${s.tech}\n`;
    });
    report += `\n📈 Actions recommandées:\n`;
    report += `- Vérifier les équipements Huawei en Centrafrique\n`;
    report += `- Augmenter la capacité sur les sites 2G dégradés\n`;
    report += `- Planifier maintenance préventive sur Niger\n`;
    return report;
}

/**
 * Génère un rapport PowerPoint (HTML) et le télécharge
 */
function generatePowerPointReport() {
    let sites = window.sitesData || [];
    let avgKpi = (sites.reduce((s,site) => s + site.kpi, 0) / sites.length).toFixed(1);
    
    let html = `
        <html>
        <head><meta charset="UTF-8"><title>NetInsight 360 - Rapport Hebdomadaire</title>
        <style>body{font-family:Arial;padding:40px;} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#00a3c4;color:white}</style>
        </head>
        <body>
        <h1>📡 NetInsight 360 - Rapport Hebdomadaire</h1>
        <p><strong>Période:</strong> Semaine ${getWeekNumber()} - ${new Date().toLocaleDateString('fr-FR')}</p>
        <hr>
        <h2>📊 Synthèse des Performances</h2>
        <ul>
            <li>Disponibilité RAN moyenne: ${avgKpi}%</li>
            <li>Packet Loss moyen: ${(sites.reduce((s,site) => s + site.packetLoss,0)/sites.length).toFixed(1)}%</li>
            <li>Sites critiques (&lt;90%): ${sites.filter(s => s.kpi < 90).length}</li>
            <li>Sites optimaux (&gt;98%): ${sites.filter(s => s.kpi >= 98).length}</li>
        </ul>
        <h2>⚠️ Top 10 Sites à Corriger</h2>
        <table>
            <tr><th>Site</th><th>Pays</th><th>Vendor</th><th>Techno</th><th>KPI</th><th>Status</th></tr>
            ${sites.sort((a,b)=>a.kpi-b.kpi).slice(0,10).map(s => `
                <tr>
                    <td>${s.name}</td><td>${s.countryName}</td><td>${s.vendor}</td><td>${s.tech}</td>
                    <td style="color:${s.kpi<90?'red':'orange'}">${s.kpi}%</td>
                    <td>${s.status}</td>
                </tr>
            `).join('')}
         </>
        <h2>📈 Leçons et Actions Correctives</h2>
        <ul>
            <li><strong>KPIs RAN en BAD:</strong> RRC CS SR, RAB CS SR, CSSR CS/PS SR, DL Throughput 3G, Power Congestion, LTE RRC SR</li>
            <li><strong>Centrafrique:</strong> Dégradation généralisée - Plan de remplacement équipements prévu</li>
            <li><strong>Recommandation:</strong> Intensifier monitoring sur sites critiques et planifier maintenance</li>
        </ul>
        </body>
        </html>
    `;
    
    const blob = new Blob([html], {type: 'text/html'});
    saveAs(blob, `NetInsight360_Rapport_S${getWeekNumber()}.html`);
    alert("Rapport HTML généré (ouvrable dans PowerPoint)");
}

/**
 * Ouvre le modal de comparaison hebdomadaire
 */
function showComparisonModal() {
    updateComparisonChart(); // défini dans charts.js
    document.getElementById('comparisonLessons').innerHTML = `
        <h6>📝 Leçons apprises et actions correctives</h6>
        <ul>
            <li>✅ <strong>Amélioration globale:</strong> +1.5% sur l'ensemble des KPIs</li>
            <li>🔴 <strong>KPIs RAN critiques:</strong> RRC CS SR (-1.8%), DL Throughput 3G (-2.5%)</li>
            <li>🔧 <strong>Actions menées:</strong> Remplacement antennes sur 5 sites</li>
            <li>📅 <strong>Plan d'action:</strong> Audit complet Niger et Centrafrique</li>
        </ul>
    `;
    const modal = new bootstrap.Modal(document.getElementById('comparisonModal'));
    modal.show();
}

/**
 * Retourne le numéro de semaine
 */
function getWeekNumber() {
    let d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    let week1 = new Date(d.getFullYear(),0,4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getCurrentUserName() {
    const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    return user.name || 'Utilisateur';
}