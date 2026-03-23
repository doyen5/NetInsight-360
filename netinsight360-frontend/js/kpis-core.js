/**
 * NetInsight 360 - KPIs CORE
 * Supervisez. Analysez. Optimisez.
 * 
 * Gère l'affichage et l'analyse des KPIs du cœur de réseau
 * KPI principal: Packet Loss
 */

// ============================================
// DONNÉES SIMULÉES DES SITES CORE
// ============================================

/**
 * Base de données des sites CORE par pays
 * Structure: { id, name, lat, lng, vendor, packet_loss, latency, jitter, throughput, status }
 */
const coreSitesData = {
    // Côte d'Ivoire (CI)
    CI: {
        name: "Côte d'Ivoire",
        center: [6.9, -5.5],
        zoom: 7,
        sites: [
            { id: "CORE-CI-001", name: "Abidjan Core Hub", lat: 5.336, lng: -4.026, vendor: "Huawei", packet_loss: 0.35, latency: 42, jitter: 8, throughput: 850, status: "good" },
            { id: "CORE-CI-002", name: "Yamoussoukro Core", lat: 6.827, lng: -5.289, vendor: "Ericsson", packet_loss: 0.52, latency: 48, jitter: 12, throughput: 720, status: "good" },
            { id: "CORE-CI-003", name: "Bouaké Core", lat: 7.683, lng: -5.033, vendor: "Huawei", packet_loss: 0.78, latency: 55, jitter: 15, throughput: 680, status: "warning" },
            { id: "CORE-CI-004", name: "San Pedro Core", lat: 4.748, lng: -6.636, vendor: "Ericsson", packet_loss: 0.95, latency: 62, jitter: 18, throughput: 590, status: "warning" },
            { id: "CORE-CI-005", name: "Korhogo Core", lat: 9.419, lng: -5.620, vendor: "Huawei", packet_loss: 1.25, latency: 78, jitter: 22, throughput: 520, status: "critical" }
        ]
    },
    // Niger (NE)
    NE: {
        name: "Niger",
        center: [14.5, 6.0],
        zoom: 6,
        sites: [
            { id: "CORE-NE-001", name: "Niamey Core", lat: 13.512, lng: 2.112, vendor: "Huawei", packet_loss: 0.68, latency: 55, jitter: 14, throughput: 680, status: "good" },
            { id: "CORE-NE-002", name: "Zinder Core", lat: 13.807, lng: 8.988, vendor: "Ericsson", packet_loss: 0.92, latency: 68, jitter: 19, throughput: 590, status: "warning" },
            { id: "CORE-NE-003", name: "Agadez Core", lat: 16.974, lng: 7.991, vendor: "Huawei", packet_loss: 1.45, latency: 85, jitter: 25, throughput: 480, status: "critical" },
            { id: "CORE-NE-004", name: "Tahoua Core", lat: 14.889, lng: 5.263, vendor: "Ericsson", packet_loss: 1.18, latency: 75, jitter: 22, throughput: 540, status: "critical" }
        ]
    },
    // Bénin (BJ)
    BJ: {
        name: "Bénin",
        center: [7.5, 2.5],
        zoom: 7,
        sites: [
            { id: "CORE-BJ-001", name: "Cotonou Core", lat: 6.496, lng: 2.603, vendor: "Ericsson", packet_loss: 0.28, latency: 38, jitter: 7, throughput: 920, status: "good" },
            { id: "CORE-BJ-002", name: "Porto-Novo Core", lat: 6.496, lng: 2.603, vendor: "Huawei", packet_loss: 0.45, latency: 45, jitter: 10, throughput: 780, status: "good" },
            { id: "CORE-BJ-003", name: "Parakou Core", lat: 9.350, lng: 2.617, vendor: "Ericsson", packet_loss: 0.88, latency: 58, jitter: 16, throughput: 620, status: "warning" },
            { id: "CORE-BJ-004", name: "Djougou Core", lat: 9.700, lng: 1.667, vendor: "Huawei", packet_loss: 1.05, latency: 70, jitter: 21, throughput: 550, status: "critical" }
        ]
    },
    // Togo (TG)
    TG: {
        name: "Togo",
        center: [7.0, 1.2],
        zoom: 7,
        sites: [
            { id: "CORE-TG-001", name: "Lomé Core", lat: 6.131, lng: 1.223, vendor: "Huawei", packet_loss: 0.42, latency: 44, jitter: 9, throughput: 810, status: "good" },
            { id: "CORE-TG-002", name: "Kara Core", lat: 9.551, lng: 1.186, vendor: "Ericsson", packet_loss: 0.85, latency: 60, jitter: 17, throughput: 630, status: "warning" },
            { id: "CORE-TG-003", name: "Sokodé Core", lat: 8.983, lng: 1.138, vendor: "Huawei", packet_loss: 1.12, latency: 72, jitter: 20, throughput: 520, status: "critical" }
        ]
    },
    // Centrafrique (CF)
    CF: {
        name: "Centrafrique",
        center: [5.5, 18.5],
        zoom: 7,
        sites: [
            { id: "CORE-CF-001", name: "Bangui Core", lat: 4.394, lng: 18.558, vendor: "Huawei", packet_loss: 1.85, latency: 95, jitter: 28, throughput: 420, status: "critical" },
            { id: "CORE-CF-002", name: "Bimbo Core", lat: 4.257, lng: 18.416, vendor: "Ericsson", packet_loss: 2.10, latency: 105, jitter: 32, throughput: 380, status: "critical" },
            { id: "CORE-CF-003", name: "Berbérati Core", lat: 4.250, lng: 15.783, vendor: "Huawei", packet_loss: 1.95, latency: 98, jitter: 30, throughput: 400, status: "critical" }
        ]
    }
};

// ============================================
// VARIABLES GLOBALES
// ============================================
let currentUser = null;
let map = null;
let currentMarkers = [];
let charts = {};
let currentFilters = {
    country: 'all',
    vendor: 'all'
};
let currentPage = 1;
let itemsPerPage = 10;

// ============================================
// FONCTIONS DE GESTION DE SESSION ET DÉCONNEXION
// ============================================

/**
 * Vérifie l'authentification de l'utilisateur
 */
function checkAuthentication() {
    const storedUser = sessionStorage.getItem('currentUser');
    if (!storedUser) {
        window.location.href = 'index.html';
        return false;
    }
    
    try {
        const user = JSON.parse(storedUser);
        const loginTime = new Date(user.loggedInAt);
        const now = new Date();
        const hoursSinceLogin = (now - loginTime) / (1000 * 60 * 60);
        
        if (hoursSinceLogin > 8) {
            sessionStorage.clear();
            localStorage.removeItem('rememberedUser');
            window.location.href = 'index.html';
            return false;
        }
        
        currentUser = user;
        return true;
    } catch (e) {
        window.location.href = 'index.html';
        return false;
    }
}

/**
 * Initialise la gestion de la déconnexion
 */
function initLogoutHandler() {
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutModal = document.getElementById('logoutConfirmModal');
    const confirmBtn = document.getElementById('confirmLogoutBtn');
    const cancelBtn = document.getElementById('cancelLogoutBtn');
    
    if (!logoutBtn) return;
    
    function showLogoutConfirmation() {
        if (logoutModal) logoutModal.classList.add('show');
        else if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) executeLogout();
    }
    
    function hideLogoutConfirmation() {
        if (logoutModal) logoutModal.classList.remove('show');
    }
    
    function executeLogout() {
        logoutBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Déconnexion...';
        logoutBtn.disabled = true;
        
        setTimeout(() => {
            sessionStorage.clear();
            localStorage.removeItem('rememberedUser');
            window.location.href = 'index.html';
        }, 300);
    }
    
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showLogoutConfirmation();
    });
    
    if (confirmBtn) confirmBtn.addEventListener('click', () => { hideLogoutConfirmation(); executeLogout(); });
    if (cancelBtn) cancelBtn.addEventListener('click', () => hideLogoutConfirmation());
    if (logoutModal) logoutModal.addEventListener('click', (e) => { if (e.target === logoutModal) hideLogoutConfirmation(); });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && logoutModal?.classList.contains('show')) hideLogoutConfirmation();
    });
}

/**
 * Rafraîchit la session
 */
function refreshSession() {
    const userStr = sessionStorage.getItem('currentUser');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            user.loggedInAt = new Date().toISOString();
            sessionStorage.setItem('currentUser', JSON.stringify(user));
        } catch (e) {}
    }
}

/**
 * Initialise le rafraîchissement de session
 */
function initSessionRefresh() {
    setInterval(refreshSession, 30 * 60 * 1000);
    ['click', 'mousemove', 'keypress', 'scroll'].forEach(event => {
        document.addEventListener(event, refreshSession);
    });
}

/**
 * Met à jour l'interface utilisateur
 */
function updateUserInterface() {
    if (!currentUser) return;
    
    document.getElementById('userName').innerText = currentUser.name;
    document.getElementById('headerUserName').innerText = currentUser.name;
    
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
    document.getElementById('userAvatar').innerText = initials;
    
    const roleMap = { 'ADMIN': 'Administrateur', 'FO_NPM': 'Agent Superviseur', 'FO_CORE_RAN': 'Agent Partageur', 'CUSTOMER': 'Agent Visualiseur' };
    document.getElementById('headerUserRole').innerText = roleMap[currentUser.role] || 'Utilisateur';
}

// ============================================
// FONCTIONS UTILITAIRES CORE
// ============================================

/**
 * Récupère tous les sites CORE
 */
function getAllSites() {
    let allSites = [];
    for (let countryCode in coreSitesData) {
        const country = coreSitesData[countryCode];
        country.sites.forEach(site => {
            allSites.push({
                ...site,
                country: countryCode,
                countryName: country.name
            });
        });
    }
    return allSites;
}

/**
 * Filtre les sites
 */
function filterSites(sites, filters) {
    return sites.filter(site => {
        if (filters.country && filters.country !== 'all' && site.country !== filters.country) return false;
        if (filters.vendor && filters.vendor !== 'all' && site.vendor !== filters.vendor) return false;
        return true;
    });
}

/**
 * Détermine le statut d'un site selon le Packet Loss
 */
function getSiteStatus(packetLoss) {
    if (packetLoss <= 0.5) return 'good';
    if (packetLoss <= 1.0) return 'warning';
    return 'critical';
}

/**
 * Calcule la moyenne
 */
function calculateAverage(sites, field) {
    let sum = 0;
    let count = 0;
    sites.forEach(site => {
        if (site[field] !== undefined) {
            sum += site[field];
            count++;
        }
    });
    return count > 0 ? (sum / count).toFixed(1) : 0;
}

/**
 * Met à jour les statistiques globales
 */
function updateGlobalStats() {
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites, currentFilters);
    
    const avgPacketLoss = calculateAverage(filteredSites, 'packet_loss');
    const avgLatency = calculateAverage(filteredSites, 'latency');
    const avgJitter = calculateAverage(filteredSites, 'jitter');
    const avgThroughput = calculateAverage(filteredSites, 'throughput');
    
    document.getElementById('avgPacketLoss').innerText = avgPacketLoss + '%';
    document.getElementById('avgLatency').innerText = avgLatency + ' ms';
    document.getElementById('avgJitter').innerText = avgJitter + ' ms';
    document.getElementById('avgThroughput').innerText = avgThroughput + ' Gbps';
    
    // Mise à jour des progress bars
    const packetLossPercent = Math.min((avgPacketLoss / 2) * 100, 100);
    document.getElementById('packetLossProgress').style.width = packetLossPercent + '%';
    document.getElementById('packetLossProgress').className = `progress-bar ${avgPacketLoss > 1 ? 'bg-danger' : (avgPacketLoss > 0.5 ? 'bg-warning' : 'bg-success')}`;
    
    const latencyPercent = Math.min((avgLatency / 100) * 100, 100);
    document.getElementById('latencyProgress').style.width = latencyPercent + '%';
    document.getElementById('latencyProgress').className = `progress-bar ${avgLatency > 80 ? 'bg-danger' : (avgLatency > 50 ? 'bg-warning' : 'bg-info')}`;
    
    const jitterPercent = Math.min((avgJitter / 30) * 100, 100);
    document.getElementById('jitterProgress').style.width = jitterPercent + '%';
    document.getElementById('jitterProgress').className = `progress-bar ${avgJitter > 25 ? 'bg-danger' : (avgJitter > 15 ? 'bg-warning' : 'bg-primary')}`;
    
    const throughputPercent = Math.min((avgThroughput / 1000) * 100, 100);
    document.getElementById('throughputProgress').style.width = throughputPercent + '%';
}

/**
 * Met à jour le tableau des pires sites (triés par Packet Loss)
 */
function updateWorstSitesTable() {
    const allSites = getAllSites();
    let filteredSites = filterSites(allSites, currentFilters);
    
    filteredSites.sort((a, b) => b.packet_loss - a.packet_loss);
    
    const totalPages = Math.ceil(filteredSites.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const paginatedSites = filteredSites.slice(start, start + itemsPerPage);
    
    const tbody = document.getElementById('worstSitesList');
    if (!tbody) return;
    
    if (paginatedSites.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center">Aucun site trouvé</td></tr>';
        return;
    }
    
    tbody.innerHTML = paginatedSites.map((site, index) => {
        const status = getSiteStatus(site.packet_loss);
        const rowClass = `site-row-${status}`;
        const packetLossClass = site.packet_loss > 1 ? 'packetloss-high' : (site.packet_loss > 0.5 ? 'packetloss-medium' : 'packetloss-low');
        
        return `
            <tr class="${rowClass}">
                <td>${start + index + 1}</td>
                <td><strong>${site.id}</strong></td>
                <td>${site.name}</td>
                <td><i class="bi bi-flag"></i> ${site.countryName}</td>
                <td>${site.vendor}</td>
                <td><span class="${packetLossClass}">${site.packet_loss}%</span></td>
                <td>${site.latency} ms</td>
                <td>${site.jitter} ms</td>
                <td>${site.throughput} Gbps</td>
                <td><span class="status-badge status-${status}">${status === 'good' ? '✓ OK' : (status === 'warning' ? '⚠️ Alerte' : '🔴 Critique')}</span></td>
                <td>
                    <button class="btn-details" onclick="showSiteDetails('${site.id}')" data-tooltip="Voir détails">
                        <i class="bi bi-eye-fill"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    const paginationDiv = document.getElementById('paginationControls');
    if (paginationDiv && totalPages > 1) {
        let paginationHtml = '<nav><ul class="pagination">';
        for (let i = 1; i <= totalPages; i++) {
            paginationHtml += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                <button class="page-link" onclick="goToPage(${i})">${i}</button>
            </li>`;
        }
        paginationHtml += '</ul></nav>';
        paginationDiv.innerHTML = paginationHtml;
    } else if (paginationDiv) {
        paginationDiv.innerHTML = '';
    }
}

/**
 * Change de page
 */
function goToPage(page) {
    currentPage = page;
    updateWorstSitesTable();
}

/**
 * Affiche les détails d'un site
 */
function showSiteDetails(siteId) {
    const allSites = getAllSites();
    const site = allSites.find(s => s.id === siteId);
    if (!site) return;
    
    const status = getSiteStatus(site.packet_loss);
    const statusClass = status === 'good' ? 'success' : (status === 'warning' ? 'warning' : 'danger');
    
    document.getElementById('modalSiteTitle').innerText = `${site.name} - ${site.countryName}`;
    document.getElementById('modalSiteInfo').innerHTML = `
        <table class="table table-sm">
            <tr><td><strong>ID Site:</strong></td><td>${site.id}</td></tr>
            <tr><td><strong>Nom:</strong></td><td>${site.name}</td></tr>
            <tr><td><strong>Pays:</strong></td><td>${site.countryName}</td></tr>
            <tr><td><strong>Vendor:</strong></td><td>${site.vendor}</td></tr>
            <tr><td><strong>Packet Loss:</strong></td><td><strong class="text-${statusClass}">${site.packet_loss}%</strong></td></tr>
            <tr><td><strong>Statut:</strong></td><td><span class="status-badge status-${status}">${status}</span></td></tr>
        </table>
    `;
    
    document.getElementById('modalCoreMetrics').innerHTML = `
        <table class="table table-sm">
            <tr><td><strong>Latence:</strong></td><td>${site.latency} ms</td><td>Objectif: &lt; 100 ms</td></tr>
            <tr><td><strong>Jitter:</strong></td><td>${site.jitter} ms</td><td>Objectif: &lt; 30 ms</td></tr>
            <tr><td><strong>Débit:</strong></td><td>${site.throughput} Gbps</td><td>Objectif: > 500 Gbps</td></tr>
        </table>
    `;
    
    // Trend sur 5 jours
    const trendData = [site.packet_loss + 0.5, site.packet_loss + 0.3, site.packet_loss + 0.1, site.packet_loss - 0.1, site.packet_loss];
    if (charts.trend5Days) charts.trend5Days.destroy();
    const ctx = document.getElementById('trend5DaysChart').getContext('2d');
    charts.trend5Days = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['J-4', 'J-3', 'J-2', 'J-1', 'Aujourd\'hui'],
            datasets: [{
                label: `${site.name} - Évolution Packet Loss (%)`,
                data: trendData,
                borderColor: status === 'good' ? '#10b981' : (status === 'warning' ? '#f59e0b' : '#ef4444'),
                backgroundColor: 'rgba(0,163,196,0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: true }
    });
    
    window.currentSiteForModal = site;
    new bootstrap.Modal(document.getElementById('siteDetailsModal')).show();
}

// ============================================
// FONCTIONS DES GRAPHIQUES
// ============================================

/**
 * Met à jour tous les graphiques
 */
function updateAllCharts() {
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites, currentFilters);
    
    updatePacketLossTrendChart(filteredSites);
    updateLatencyCountryChart();
    updateVendorPacketLossChart();
    updateVendorChart(filteredSites);
    updateCountryChart(filteredSites);
    updateHealthScoreChart(filteredSites);
}

/**
 * Graphique d'évolution Packet Loss
 */
function updatePacketLossTrendChart(sites) {
    const days = ['J-4', 'J-3', 'J-2', 'J-1', 'Aujourd\'hui'];
    const avgData = [];
    
    for (let i = 0; i < days.length; i++) {
        const avg = calculateAverage(sites, 'packet_loss');
        avgData.push(parseFloat(avg) + (Math.random() * 0.3 - 0.15));
    }
    
    if (charts.packetLossTrend) charts.packetLossTrend.destroy();
    const ctx = document.getElementById('packetLossTrendChart').getContext('2d');
    charts.packetLossTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [{
                label: 'Packet Loss Moyen (%)',
                data: avgData,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239,68,68,0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: true }
    });
}

/**
 * Graphique Latence par pays
 */
function updateLatencyCountryChart() {
    const countries = ['CI', 'NE', 'BJ', 'TG', 'CF'];
    const countryNames = ['Côte Ivoire', 'Niger', 'Bénin', 'Togo', 'Centrafrique'];
    const latencies = countries.map(code => {
        const sites = coreSitesData[code]?.sites || [];
        return calculateAverage(sites, 'latency');
    });
    
    if (charts.latencyCountry) charts.latencyCountry.destroy();
    const ctx = document.getElementById('latencyCountryChart').getContext('2d');
    charts.latencyCountry = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: countryNames,
            datasets: [{
                label: 'Latence (ms)',
                data: latencies,
                backgroundColor: '#00a3c4',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Latence (ms)' } } }
        }
    });
}

/**
 * Graphique Packet Loss par Vendor
 */
function updateVendorPacketLossChart() {
    const allSites = getAllSites();
    const huaweiSites = allSites.filter(s => s.vendor === 'Huawei');
    const ericssonSites = allSites.filter(s => s.vendor === 'Ericsson');
    
    const huaweiAvg = calculateAverage(huaweiSites, 'packet_loss');
    const ericssonAvg = calculateAverage(ericssonSites, 'packet_loss');
    
    if (charts.vendorPacketLoss) charts.vendorPacketLoss.destroy();
    const ctx = document.getElementById('vendorPacketLossChart').getContext('2d');
    charts.vendorPacketLoss = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Huawei', 'Ericsson'],
            datasets: [{
                label: 'Packet Loss Moyen (%)',
                data: [huaweiAvg, ericssonAvg],
                backgroundColor: ['#00a3c4', '#f59e0b'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Packet Loss (%)' } } }
        }
    });
}

/**
 * Graphique répartition par vendor
 */
function updateVendorChart(sites) {
    const huaweiCount = sites.filter(s => s.vendor === 'Huawei').length;
    const ericssonCount = sites.filter(s => s.vendor === 'Ericsson').length;
    
    if (charts.vendor) charts.vendor.destroy();
    const ctx = document.getElementById('vendorChart').getContext('2d');
    charts.vendor = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Huawei', 'Ericsson'],
            datasets: [{ data: [huaweiCount, ericssonCount], backgroundColor: ['#00a3c4', '#f59e0b'] }]
        },
        options: { responsive: true, maintainAspectRatio: true }
    });
}

/**
 * Graphique répartition par pays
 */
function updateCountryChart(sites) {
    const countries = ['CI', 'NE', 'BJ', 'TG', 'CF'];
    const countryNames = ['Côte Ivoire', 'Niger', 'Bénin', 'Togo', 'Centrafrique'];
    const counts = countries.map(code => sites.filter(s => s.country === code).length);
    
    if (charts.country) charts.country.destroy();
    const ctx = document.getElementById('countryChart').getContext('2d');
    charts.country = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: countryNames,
            datasets: [{ label: 'Nombre de sites CORE', data: counts, backgroundColor: '#00a3c4', borderRadius: 8 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Nombre de sites' } } }
        }
    });
}

/**
 * Graphique Score de santé CORE
 */
function updateHealthScoreChart(sites) {
    const avgPacketLoss = calculateAverage(sites, 'packet_loss');
    const healthScore = Math.max(0, 100 - (avgPacketLoss * 20));
    const healthClass = healthScore >= 80 ? 'excellent' : (healthScore >= 60 ? 'good' : 'poor');
    
    if (charts.healthScore) charts.healthScore.destroy();
    const ctx = document.getElementById('healthScoreChart').getContext('2d');
    charts.healthScore = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Santé du réseau', 'Dégradation'],
            datasets: [{ data: [healthScore, 100 - healthScore], backgroundColor: ['#10b981', '#e2e8f0'] }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw.toFixed(1)}%` } } }
        }
    });
}

// ============================================
// FONCTIONS DE LA CARTE
// ============================================

function initMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    map = L.map('map').setView([8.0, 2.0], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    updateMapMarkers();
}

function updateMapMarkers() {
    if (!map) return;
    
    currentMarkers.forEach(marker => map.removeLayer(marker));
    currentMarkers = [];
    
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites, currentFilters);
    
    if (currentFilters.country !== 'all' && coreSitesData[currentFilters.country]) {
        const country = coreSitesData[currentFilters.country];
        map.flyTo(country.center, country.zoom, { duration: 1 });
    }
    
    filteredSites.forEach(site => {
        const status = getSiteStatus(site.packet_loss);
        const color = status === 'good' ? '#10b981' : (status === 'warning' ? '#f59e0b' : '#ef4444');
        
        const icon = L.divIcon({
            html: `<div style="background:${color}; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 0 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [12, 12],
            className: 'site-marker'
        });
        
        const marker = L.marker([site.lat, site.lng], { icon }).addTo(map);
        marker.bindPopup(`
            <b>${site.name}</b><br>
            <b>ID:</b> ${site.id}<br>
            <b>Pays:</b> ${site.countryName}<br>
            <b>Vendor:</b> ${site.vendor}<br>
            <b>Packet Loss:</b> <strong class="text-${status === 'good' ? 'success' : (status === 'warning' ? 'warning' : 'danger')}">${site.packet_loss}%</strong><br>
            <b>Latence:</b> ${site.latency} ms<br>
            <button class="btn btn-sm btn-primary mt-2" onclick="showSiteDetails('${site.id}')">Voir détails</button>
        `);
        currentMarkers.push(marker);
    });
}

// ============================================
// FONCTIONS D'EXPORT ET RAPPORTS
// ============================================

function exportWorstSitesCSV() {
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites, currentFilters);
    const sorted = [...filteredSites].sort((a, b) => b.packet_loss - a.packet_loss);
    
    let csv = "Site ID,Nom,Pays,Vendor,Packet Loss (%),Latence (ms),Jitter (ms),Débit (Gbps),Statut\n";
    sorted.forEach(site => {
        csv += `"${site.id}","${site.name}","${site.countryName}","${site.vendor}",${site.packet_loss},${site.latency},${site.jitter},${site.throughput},"${getSiteStatus(site.packet_loss)}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'pires_sites_core.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function generateWhatsAppReport() {
    const allSites = getAllSites();
    const filteredSites = filterSites(allSites, currentFilters);
    const worst = [...filteredSites].sort((a, b) => b.packet_loss - a.packet_loss).slice(0, 10);
    const avgPacketLoss = calculateAverage(filteredSites, 'packet_loss');
    
    let report = `📡 *NETINSIGHT 360 - RAPPORT KPIs CORE* 📡\n\n`;
    report += `📅 Date: ${new Date().toLocaleDateString('fr-FR')}\n`;
    report += `📍 Sites CORE analysés: ${filteredSites.length}\n`;
    report += `📊 Packet Loss moyen: ${avgPacketLoss}%\n\n`;
    report += `⚠️ *TOP 10 SITES AVEC PACKET LOSS ÉLEVÉ* ⚠️\n`;
    worst.forEach((s, i) => {
        const status = getSiteStatus(s.packet_loss);
        report += `${i+1}. ${s.name} (${s.countryName}) - Packet Loss: ${s.packet_loss}% - ${s.vendor}\n`;
    });
    report += `\n📈 *Actions recommandées:*\n`;
    report += `- Priorité sur sites Centrafrique (Packet Loss > 1.8%)\n`;
    report += `- Vérifier les liaisons fibre sur sites Huawei en dégradation\n`;
    report += `- Planifier maintenance sur équipements Ericsson au Niger\n`;
    return report;
}

function showWeeklyComparison() {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Côte Ivoire', 'Niger', 'Bénin', 'Togo', 'Centrafrique'],
            datasets: [
                { label: 'Semaine actuelle - Packet Loss (%)', data: [0.77, 1.06, 0.67, 0.80, 1.97], backgroundColor: '#ef4444' },
                { label: 'Semaine précédente - Packet Loss (%)', data: [0.68, 0.95, 0.58, 0.72, 1.85], backgroundColor: '#f59e0b' }
            ]
        }
    });
    
    document.getElementById('comparisonLessons').innerHTML = `
        <h6>📝 Leçons apprises et actions correctives - KPIs CORE</h6>
        <ul>
            <li>✅ <strong>Amélioration Bénin:</strong> Packet Loss en baisse grâce à l'optimisation des routeurs</li>
            <li>🔴 <strong>Centrafrique:</strong> Packet Loss critique (>1.8%) - Plan d'urgence en cours</li>
            <li>🔧 <strong>Actions menées:</strong> Remplacement switchs Huawei à Abidjan, upgrade firmware Ericsson</li>
            <li>📅 <strong>Plan d'action:</strong> Audit complet du backbone Centrafrique et Niger</li>
        </ul>
    `;
    
    new bootstrap.Modal(document.getElementById('comparisonModal')).show();
}

// ============================================
// INITIALISATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuthentication()) return;
    
    updateUserInterface();
    initLogoutHandler();
    initSessionRefresh();
    
    function updateDateTime() {
        const now = new Date();
        const dateTimeEl = document.getElementById('currentDateTime');
        if (dateTimeEl) {
            dateTimeEl.innerHTML = `<i class="bi bi-calendar3"></i> ${now.toLocaleDateString('fr-FR')} - ${now.toLocaleTimeString('fr-FR')}`;
        }
    }
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    initMap();
    updateGlobalStats();
    updateWorstSitesTable();
    updateAllCharts();
    
    document.getElementById('applyFilters')?.addEventListener('click', () => {
        currentFilters = {
            country: document.getElementById('filterCountry')?.value || 'all',
            vendor: document.getElementById('filterVendor')?.value || 'all'
        };
        currentPage = 1;
        updateGlobalStats();
        updateWorstSitesTable();
        updateAllCharts();
        updateMapMarkers();
    });
    
    document.getElementById('resetFilters')?.addEventListener('click', () => {
        const countrySelect = document.getElementById('filterCountry');
        const vendorSelect = document.getElementById('filterVendor');
        if (countrySelect) countrySelect.value = 'all';
        if (vendorSelect) vendorSelect.value = 'all';
        currentFilters = { country: 'all', vendor: 'all' };
        currentPage = 1;
        updateGlobalStats();
        updateWorstSitesTable();
        updateAllCharts();
        updateMapMarkers();
        if (map) map.flyTo([8.0, 2.0], 5);
    });
    
    document.getElementById('exportWorstSites')?.addEventListener('click', exportWorstSitesCSV);
    document.getElementById('shareWorstSites')?.addEventListener('click', () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(generateWhatsAppReport())}`, '_blank');
    });
    document.getElementById('shareWhatsApp')?.addEventListener('click', () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(generateWhatsAppReport())}`, '_blank');
    });
    document.getElementById('weeklyComparison')?.addEventListener('click', showWeeklyComparison);
    document.getElementById('shareSiteWhatsApp')?.addEventListener('click', () => {
        if (window.currentSiteForModal) {
            const s = window.currentSiteForModal;
            const msg = `📡 *Site CORE: ${s.name} (${s.countryName})*\nID: ${s.id}\nPacket Loss: ${s.packet_loss}%\nLatence: ${s.latency} ms\nJitter: ${s.jitter} ms\nDébit: ${s.throughput} Gbps`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        }
    });
    
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('show'));
    }
    
    window.showSiteDetails = showSiteDetails;
    window.goToPage = goToPage;
});