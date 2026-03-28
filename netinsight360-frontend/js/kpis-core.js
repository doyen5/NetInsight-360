/**
 * NetInsight 360 - KPIs CORE
 * Supervisez. Analysez. Optimisez.
 * 
 * Page des KPIs du cœur de réseau (Packet Loss, Latence, Jitter)
 * Toutes les données proviennent de l'API backend
 */

let coreMap = null;
let coreMarkers = [];
let coreFilters = { country: 'all', vendor: 'all' };
let coreCurrentPage = 1;
let coreItemsPerPage = 10;

/**
 * Initialise la page KPIs CORE
 */
async function initKpisCore() {
    const isAuth = await checkAuthentication();
    if (!isAuth) return;
    
    await updateUserInterface();
    initCoreMap();
    await loadCoreStats();
    await loadCoreWorstSitesTable();
    await loadCoreCharts();
    initCoreFilters();
    initCoreReports();
}

/**
 * Initialise la carte CORE
 */
function initCoreMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    coreMap = L.map('map').setView([8.0, 2.0], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(coreMap);
    
    loadCoreMapMarkers();
}

/**
 * Charge les marqueurs sur la carte
 */
async function loadCoreMapMarkers() {
    if (!coreMap) return;
    
    coreMarkers.forEach(marker => coreMap.removeLayer(marker));
    coreMarkers = [];
    
    try {
        const result = await API.getSites({ ...coreFilters, domain: 'CORE' });
        if (!result.success || !result.data) return;
        
        result.data.forEach(site => {
            const icon = L.divIcon({
                html: `<div style="background:#00a3c4; width:12px; height:12px; border-radius:2px; transform:rotate(45deg); border:2px solid white;"></div>`,
                iconSize: [12, 12]
            });
            
            const marker = L.marker([site.latitude, site.longitude], { icon }).addTo(coreMap);
            marker.bindPopup(`
                <b>${site.name}</b><br>
                <b>ID:</b> ${site.id}<br>
                <b>Pays:</b> ${site.country_name}<br>
                <b>Packet Loss:</b> ${site.packet_loss}%<br>
                <button class="btn btn-sm btn-primary mt-2" onclick="showCoreSiteDetails('${site.id}')">Voir détails</button>
            `);
            coreMarkers.push(marker);
        });
    } catch (error) {
        console.error('[KPIs CORE] Erreur chargement marqueurs:', error);
    }
}

/**
 * Charge les statistiques CORE
 */
async function loadCoreStats() {
    try {
        const result = await API.getCoreKpis(coreFilters);
        if (!result.success) return;
        
        const stats = result.data.stats;
        document.getElementById('avgPacketLoss').innerText = (stats.avg_packet_loss || 0) + '%';
        document.getElementById('avgLatency').innerText = (stats.avg_latency || 0) + ' ms';
        document.getElementById('avgJitter').innerText = (stats.avg_jitter || 0) + ' ms';
        document.getElementById('avgThroughput').innerText = (stats.avg_throughput || 0) + ' Gbps';
        
        const packetLossPercent = Math.min((stats.avg_packet_loss / 2) * 100, 100);
        document.getElementById('packetLossProgress').style.width = packetLossPercent + '%';
        const latencyPercent = Math.min((stats.avg_latency / 100) * 100, 100);
        document.getElementById('latencyProgress').style.width = latencyPercent + '%';
        const jitterPercent = Math.min((stats.avg_jitter / 30) * 100, 100);
        document.getElementById('jitterProgress').style.width = jitterPercent + '%';
        const throughputPercent = Math.min((stats.avg_throughput / 1000) * 100, 100);
        document.getElementById('throughputProgress').style.width = throughputPercent + '%';
    } catch (error) {
        console.error('[KPIs CORE] Erreur chargement stats:', error);
    }
}

/**
 * Charge le tableau des pires sites CORE
 */
async function loadCoreWorstSitesTable() {
    try {
        const result = await API.getTopWorstSites({ ...coreFilters, domain: 'CORE', sort_by: 'packet_loss' });
        if (!result.success) return;
        
        const worst = result.data.worst || [];
        const totalPages = Math.ceil(worst.length / coreItemsPerPage);
        const start = (coreCurrentPage - 1) * coreItemsPerPage;
        const paginated = worst.slice(start, start + coreItemsPerPage);
        
        const tbody = document.getElementById('worstSitesList');
        if (!tbody) return;
        
        if (paginated.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center">Aucun site trouvé</td></tr>';
            return;
        }
        
        tbody.innerHTML = paginated.map((site, idx) => `
            <tr>
                <td>${start + idx + 1}</td>
                <td><strong>${escapeHtml(site.id)}</strong></td>
                <td>${escapeHtml(site.name)}</td>
                <td><i class="bi bi-flag"></i> ${escapeHtml(site.country_name)}</td>
                <td>${site.vendor}</td>
                <td><span class="${site.packet_loss > 1 ? 'packetloss-high' : (site.packet_loss > 0.5 ? 'packetloss-medium' : 'packetloss-low')}">${site.packet_loss}%</span></td>
                <td>${site.latency} ms</td>
                <td>${site.jitter} ms</td>
                <td>${site.throughput} Gbps</td>
                <td><span class="status-badge status-${site.status}">${site.status === 'good' ? '✓ OK' : (site.status === 'warning' ? '⚠️ Alerte' : '🔴 Critique')}</span></td>
                <td><button class="btn-details" onclick="showCoreSiteDetails('${site.id}')"><i class="bi bi-eye-fill"></i></button></td>
            </tr>
        `).join('');
        
        const paginationDiv = document.getElementById('paginationControls');
        if (paginationDiv && totalPages > 1) {
            let html = '<nav><ul class="pagination">';
            for (let i = 1; i <= totalPages; i++) {
                html += `<li class="page-item ${i === coreCurrentPage ? 'active' : ''}">
                    <button class="page-link" onclick="goToCorePage(${i})">${i}</button>
                </li>`;
            }
            html += '</ul></nav>';
            paginationDiv.innerHTML = html;
        } else if (paginationDiv) {
            paginationDiv.innerHTML = '';
        }
    } catch (error) {
        console.error('[KPIs CORE] Erreur chargement tableau:', error);
    }
}

/**
 * Charge les graphiques CORE
 */
async function loadCoreCharts() {
    try {
        const result = await API.getCoreKpis(coreFilters);
        if (!result.success) return;
        
        const trends = result.data.trends;
        if (trends) {
            chartManager.createLineChart('packetLossTrendChart', {
                labels: trends.labels,
                datasets: [{ label: 'Packet Loss (%)', data: trends.packet_loss, borderColor: '#ef4444', fill: true }]
            });
        }
        
        const byCountry = result.data.by_country;
        if (byCountry) {
            chartManager.createBarChart('latencyCountryChart', {
                labels: byCountry.map(c => c.name),
                datasets: [{ label: 'Latence (ms)', data: byCountry.map(c => c.latency), backgroundColor: '#00a3c4' }]
            });
        }
        
        const byVendor = result.data.by_vendor;
        if (byVendor) {
            chartManager.createBarChart('vendorPacketLossChart', {
                labels: ['Huawei', 'Ericsson'],
                datasets: [{ label: 'Packet Loss (%)', data: [byVendor.huawei || 0, byVendor.ericsson || 0], backgroundColor: ['#00a3c4', '#f59e0b'] }]
            });
        }
        
        const distribution = result.data.distribution;
        if (distribution) {
            chartManager.createPieChart('vendorChart', {
                labels: ['Huawei', 'Ericsson'],
                datasets: [{ data: [distribution.huawei || 0, distribution.ericsson || 0], backgroundColor: ['#00a3c4', '#f59e0b'] }]
            });
            
            chartManager.createBarChart('countryChart', {
                labels: distribution.countries?.map(c => c.name) || [],
                datasets: [{ label: 'Nombre de sites CORE', data: distribution.countries?.map(c => c.count) || [], backgroundColor: '#00a3c4' }]
            });
        }
        
        const healthScore = result.data.health_score || 75;
        chartManager.createPieChart('healthScoreChart', {
            labels: ['Santé du réseau', 'Dégradation'],
            datasets: [{ data: [healthScore, 100 - healthScore], backgroundColor: ['#10b981', '#e2e8f0'] }]
        });
    } catch (error) {
        console.error('[KPIs CORE] Erreur chargement graphiques:', error);
    }
}

/**
 * Initialise les filtres
 */
function initCoreFilters() {
    const applyBtn = document.getElementById('applyFilters');
    const resetBtn = document.getElementById('resetFilters');
    
    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            coreFilters = {
                country: document.getElementById('filterCountry')?.value || 'all',
                vendor: document.getElementById('filterVendor')?.value || 'all'
            };
            coreCurrentPage = 1;
            await loadCoreStats();
            await loadCoreWorstSitesTable();
            await loadCoreCharts();
            await loadCoreMapMarkers();
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            const selects = ['filterCountry', 'filterVendor'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = 'all';
            });
            coreFilters = { country: 'all', vendor: 'all' };
            coreCurrentPage = 1;
            await loadCoreStats();
            await loadCoreWorstSitesTable();
            await loadCoreCharts();
            await loadCoreMapMarkers();
            if (coreMap) coreMap.flyTo([8.0, 2.0], 5);
        });
    }
}

/**
 * Initialise les rapports
 */
function initCoreReports() {
    const exportBtn = document.getElementById('exportWorstSites');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            try {
                const result = await API.exportExcel('worst_sites', { domain: 'CORE', ...coreFilters });
                if (result.success && result.url) window.open(result.url, '_blank');
            } catch (error) {
                console.error('[KPIs CORE] Erreur export:', error);
            }
        });
    }
    
    const shareBtn = document.getElementById('shareWorstSites');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            try {
                const result = await API.generateWhatsAppReport({ domain: 'CORE', ...coreFilters });
                if (result.success && result.report) {
                    window.open(`https://wa.me/?text=${encodeURIComponent(result.report)}`, '_blank');
                }
            } catch (error) {
                console.error('[KPIs CORE] Erreur partage:', error);
            }
        });
    }

    const exportPdfBtn = document.getElementById('exportPdf');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', async () => {
            try {
                const result = await API.exportPdf({ type: 'core', domain: 'CORE', ...coreFilters });
                if (result.success && result.url) window.open(result.url, '_blank');
            } catch (error) {
                console.error('[KPIs CORE] Erreur export PDF:', error);
            }
        });
    }
}

/**
 * Affiche les détails d'un site CORE
 * @param {string} siteId - Identifiant du site
 */
async function showCoreSiteDetails(siteId) {
    try {
        const result = await API.getSiteDetails(siteId);
        if (!result.success || !result.data) return;
        
        const site = result.data;
        window.currentSiteForModal = site;
        
        document.getElementById('modalSiteTitle').innerText = `${site.name} - ${site.country_name}`;
        document.getElementById('modalSiteInfo').innerHTML = `
            <table class="table table-sm">
                <tr><td><strong>ID Site</strong></td><td>${escapeHtml(site.id)}</td> </tr>
                <tr><td><strong>Nom</strong></td><td>${escapeHtml(site.name)}</td> </tr>
                <tr><td><strong>Pays</strong></td><td>${escapeHtml(site.country_name)}</td> </tr>
                <tr><td><strong>Vendor</strong></td><td>${escapeHtml(site.vendor)}</td> </tr>
             </table>
        `;
        
        document.getElementById('modalCoreMetrics').innerHTML = `
            <table class="table table-sm">
                <tr><td><strong>Packet Loss</strong></td><td class="${site.packet_loss > 1 ? 'text-danger' : (site.packet_loss > 0.5 ? 'text-warning' : 'text-success')}">${site.packet_loss}%</td> </tr>
                <tr><td><strong>Latence</strong></td><td>${site.latency} ms</td> </tr>
                <tr><td><strong>Jitter</strong></td><td>${site.jitter} ms</td> </tr>
                <tr><td><strong>Débit</strong></td><td>${site.throughput} Gbps</td> </tr>
             </table>
        `;
        
        const trends = await API.getKpiTrends(siteId, 'packet_loss', 5);
        if (trends.success && trends.data) {
            chartManager.createLineChart('trend5DaysChart', {
                labels: trends.data.labels,
                datasets: [{
                    label: `${site.name} - Évolution Packet Loss (%)`,
                    data: trends.data.values,
                    borderColor: '#ef4444',
                    fill: true
                }]
            });
        }
        
        const modal = new bootstrap.Modal(document.getElementById('siteDetailsModal'));
        modal.show();
    } catch (error) {
        console.error('[KPIs CORE] Erreur chargement détails:', error);
    }
}

/**
 * Change de page dans le tableau
 * @param {number} page - Numéro de page
 */
function goToCorePage(page) {
    coreCurrentPage = page;
    loadCoreWorstSitesTable();
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', initKpisCore);

window.showCoreSiteDetails = showCoreSiteDetails;
window.goToCorePage = goToCorePage;