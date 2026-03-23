/**
 * NetInsight 360 - Module KPIs
 * Supervisez. Analysez. Optimisez.
 * 
 * Ce module affiche les KPIs RAN et CORE dans les sections correspondantes.
 */

// Données simulées des KPIs RAN (avec statuts)
const kpiRanDetails = [
    { name: "RNA (Radio Network Availability)", value: 99.3, target: 99.5, unit: "%", status: "warning" },
    { name: "TCH Availability (2G)", value: 99.1, target: 99, unit: "%", status: "good" },
    { name: "CSSR (2G)", value: 98.2, target: 98, unit: "%", status: "good" },
    { name: "RRC CS SR (3G)", value: 96.2, target: 98, unit: "%", status: "bad" },
    { name: "RAB CS SR (3G)", value: 95.8, target: 98, unit: "%", status: "bad" },
    // ... (tous les KPIs RAN)
];

// Données simulées des KPIs CORE
const kpiCoreDetails = [
    { name: "Packet Loss", value: 0.85, target: 1, unit: "%", status: "good" },
    { name: "Latence Moyenne", value: 48, target: 100, unit: "ms", status: "good" },
    { name: "Jitter", value: 14, target: 30, unit: "ms", status: "good" },
    { name: "Débit Core", value: 820, target: 500, unit: "Gbps", status: "good" }
];

/**
 * Affiche la liste des KPIs RAN dans la section dédiée
 */
function displayKpiRan() {
    const container = document.getElementById('kpiRanTable');
    if (!container) return;
    
    let html = '<div class="row">';
    kpiRanDetails.forEach(kpi => {
        let statusClass = kpi.status === 'good' ? 'badge-good' : (kpi.status === 'warning' ? 'badge-warning' : 'badge-critical');
        let textClass = kpi.status === 'good' ? 'text-success' : (kpi.status === 'warning' ? 'text-warning' : 'text-danger');
        html += `
            <div class="col-md-4 mb-3">
                <div class="p-3 border rounded">
                    <div class="d-flex justify-content-between">
                        <strong>${kpi.name}</strong>
                        <span class="${statusClass}">${kpi.status === 'good' ? '✓ OK' : (kpi.status === 'warning' ? '⚠️ Alerte' : '🔴 BAD')}</span>
                    </div>
                    <div class="fs-3 fw-bold mt-2 ${textClass}">${kpi.value}${kpi.unit}</div>
                    <small class="text-muted">Objectif: ${kpi.target}${kpi.unit}</small>
                    <div class="progress mt-2">
                        <div class="progress-bar ${kpi.status === 'good' ? 'bg-success' : (kpi.status === 'warning' ? 'bg-warning' : 'bg-danger')}" 
                             style="width: ${Math.min((kpi.value/kpi.target)*100, 100)}%"></div>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

/**
 * Affiche la liste des KPIs CORE dans la section dédiée
 */
function displayKpiCore() {
    const container = document.getElementById('kpiCoreTable');
    if (!container) return;
    
    let html = '<div class="row">';
    kpiCoreDetails.forEach(kpi => {
        html += `
            <div class="col-md-4 mb-3">
                <div class="p-3 border rounded">
                    <strong>${kpi.name}</strong>
                    <div class="fs-3 fw-bold mt-2">${kpi.value}${kpi.unit}</div>
                    <small>Objectif: ${kpi.target}${kpi.unit}</small>
                    <div class="progress mt-2">
                        <div class="progress-bar bg-info" style="width: ${Math.min((kpi.value/kpi.target)*100, 100)}%"></div>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}