/**
 * NetInsight 360 - Dashboard
 * Supervisez. Analysez. Optimisez.
 * 
 * Page principale avec les KPIs synthétiques, carte, top/pires sites
 * Toutes les données proviennent de l'API backend
 */

let dashboardMap = null;
let dashboardMarkers = [];
let dashboardCharts = {};
let countryBorderLayer = null; // Couche Leaflet GeoJSON affichant les frontières du pays sélectionné

/**
 * Affiche un toast en bas à droite avec la date/heure de la dernière connexion
 */
function showLastLoginToast() {
    const raw = sessionStorage.getItem('lastLoginToast');
    if (!raw) return;
    sessionStorage.removeItem('lastLoginToast');

    // Formater la date en français
    const d = new Date(raw.replace(' ', 'T'));
    const formatted = d.toLocaleDateString('fr-FR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const msgEl = document.getElementById('lastLoginMsg');
    const toastEl = document.getElementById('lastLoginToast');
    if (!msgEl || !toastEl) return;

    msgEl.textContent = 'Dernière connexion : ' + formatted;
    new bootstrap.Toast(toastEl).show();
}

// Un seul point d'entrée : initDashboard() gère l'auth, le logout et l'UI

/**
 * Initialise le dashboard
 */
async function initDashboard() {
    // Vérifier l'authentification
    const isAuth = await checkAuthentication();
    if (!isAuth) return;
    
    // Mettre à jour l'interface utilisateur
    await updateUserInterface();

    // Active les bulles explicatives KPI (icônes info-circle).
    initDashboardTooltips();
    
    // Initialiser la carte
    initDashboardMap();
    
    // Charger les données
    await loadDashboardStats();
    await loadTopWorstSites();
    await loadDashboardCharts();
    
    // Initialiser les filtres
    initDashboardFilters();
    
    // Initialiser la recherche
    initDashboardSearch();
    
    // Initialiser les rapports
    initDashboardReports();
}

function initDashboardTooltips() {
    try {
        document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
            if (bootstrap.Tooltip.getInstance(el)) return;
            new bootstrap.Tooltip(el);
        });
    } catch (_) {
        // Non bloquant: le dashboard reste fonctionnel même sans tooltip.
    }
}

/**
 * Initialise la carte du dashboard
 */
function initDashboardMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    dashboardMap = L.map('map').setView([8.0, 2.0], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(dashboardMap);
    
    loadMapMarkers();
}

/**
 * Affiche les frontières GeoJSON du pays sélectionné sur la carte.
 * Si country = 'all' ou absent, supprime la couche existante.
 * @param {string} countryCode - Code ISO-2 du pays (ex: 'CI') ou 'all'
 */
async function showCountryBorder(countryCode) {
    if (!dashboardMap) return;

    // Supprimer la couche précédente avant d'en créer une nouvelle
    if (countryBorderLayer) {
        dashboardMap.removeLayer(countryBorderLayer);
        countryBorderLayer = null;
    }

    // Pas de pays spécifique : remettre la vue globale Afrique de l'Ouest
    if (!countryCode || countryCode === 'all') {
        dashboardMap.flyTo([8.0, 2.0], 5);
        return;
    }

    try {
        // Utiliser le client API centralisé pour homogénéiser la gestion des erreurs.
        const geojson = await API.getCountryBorder(countryCode);
        if (!geojson || !geojson.type) return;

        // Ajouter la couche GeoJSON avec un style de frontière visible
        countryBorderLayer = L.geoJSON(geojson, {
            style: {
                color: '#1e3a5f',      // Bleu foncé — cohérent avec la charte graphique
                weight: 2.5,
                opacity: 0.9,
                fillColor: '#1e3a5f',
                fillOpacity: 0.04     // Léger fond pour délimiter visuellement le pays
            }
        }).addTo(dashboardMap);

        // Zoomer automatiquement sur le pays avec du padding pour ne pas coller les bords
        dashboardMap.fitBounds(countryBorderLayer.getBounds(), { padding: [60, 60], maxZoom: 8 });
    } catch (err) {
        console.warn('[Dashboard] Frontières pays non disponibles:', err);
    }
}

/**
 * Charge les marqueurs sur la carte
 */
async function loadMapMarkers(filters = {}) {
    if (!dashboardMap) return;
    
    // Supprimer les anciens marqueurs
    dashboardMarkers.forEach(marker => dashboardMap.removeLayer(marker));
    dashboardMarkers = [];
    
    try {
        // Transmettre top_by_tech=1 si l'option est présente et cochée
        const queryFilters = { ...filters };
        try {
            const topCb = document.getElementById('topByTechCheckbox');
            if (topCb && topCb.checked) queryFilters.top_by_tech = '1';
        } catch (e) { /* ignore */ }

        const result = await API.getMapMarkers(queryFilters);
        if (!result.success || !result.data) return;
        
        result.data.forEach(site => {
            // Ignorer les sites sans coordonnées valides
            const lat = Number(site.latitude);
            const lng = Number(site.longitude);
            if (lat === 0 && lng === 0) return;

            const color = API.statusColor(site.status);
            const icon = L.divIcon({
                html: `<div style="background:${color}; width:12px; height:12px; border-radius:50%; border:2px solid white;"></div>`,
                iconSize: [12, 12]
            });
            
            const safeSiteId = escapeJsSingleQuoted(site.id);
            const marker = L.marker([lat, lng], { icon }).addTo(dashboardMap);
            // Afficher technologie + KPI dégradant dans le popup
            const worstLine = site.worst_kpi_name
                ? `<b>KPI dégradant (${escapeHtml(site.technology)}):</b> ${escapeHtml(site.worst_kpi_name)} = ${site.worst_kpi_value}%<br>`
                : '';
            marker.bindPopup(`
                <b>${escapeHtml(site.name)}</b> <span style="font-size:0.8em;background:#e0e7ff;padding:1px 5px;border-radius:4px">${escapeHtml(site.technology)}</span><br>
                <b>Pays:</b> ${escapeHtml(site.country_name)}<br>
                <b>Vendor:</b> <span style="width:9px;height:9px;border-radius:50%;background:${API.vendorColor(site.vendor)};display:inline-block;margin-right:3px;vertical-align:middle"></span>${escapeHtml(site.vendor)}<br>
                <b>KPI Global:</b> ${site.kpi_global}%<br>
                ${worstLine}
                <button class="btn btn-sm btn-primary mt-2" onclick="showSiteDetails('${safeSiteId}')">Voir détails</button>
            `);
            dashboardMarkers.push(marker);
        });
        // Badge : X affichés / Y total
        API.updateMapCountBadge(result);
    } catch (error) {
        console.error('[Dashboard] Erreur chargement marqueurs:', error);
    }

    // Afficher les frontières GeoJSON du pays sélectionné et zoomer dessus
    await showCountryBorder(filters.country || 'all');
}

/**
 * Charge les statistiques du dashboard
 * @param {Object} filters - Filtres optionnels (country, vendor, tech)
 */
async function loadDashboardStats(filters = {}) {
    try {
        const result = await API.getDashboardStats(filters);
        if (!result.success) return;
        
        const stats = result.data;
        document.getElementById('totalUsers').innerText = stats.total_users || 0;
        document.getElementById('totalSites').innerText = stats.total_sites || 0;
        document.getElementById('globalRanAvail').innerText = (stats.avg_ran_availability || 0) + '%';
        document.getElementById('globalPacketLoss').innerText = (stats.avg_packet_loss || 0) + '%';
    } catch (error) {
        console.error('[Dashboard] Erreur chargement stats:', error);
    }
}

/**
 * Charge les top et pires sites
 */
async function loadTopWorstSites(filters = {}) {
    try {
        const result = await API.getTopWorstSites(filters);
        if (!result.success) return;
        
        const { top, worst } = result.data;
        
        // Afficher Top 5
        const topContainer = document.getElementById('topSitesList');
        if (topContainer) {
            topContainer.innerHTML = top.map(site => `
                <div class="site-item" onclick="showSiteDetails('${escapeJsSingleQuoted(site.id)}')">
                    <div>
                        <span class="site-name">${escapeHtml(site.name)}</span>
                        <span style="font-size:0.75em;background:#e0e7ff;padding:1px 5px;border-radius:10px;margin-left:4px">${escapeHtml(site.technology)}</span><br>
                        <small>${site.country_name} | <span style="width:8px;height:8px;border-radius:50%;background:${API.vendorColor(site.vendor)};display:inline-block;margin-right:2px;vertical-align:middle"></span>${escapeHtml(site.vendor)}</small>
                    </div>
                    <div><span class="badge-good">${site.kpi_global}%</span></div>
                </div>
            `).join('');
        }

        // Afficher Pires 5 (1 par techno si possible, sinon les 5 premiers)
        const worst5 = worst.slice(0, 5);
        const worstContainer = document.getElementById('worstSitesList');
        if (worstContainer) {
            worstContainer.innerHTML = worst5.map(site => {
                const worstLine = site.worst_kpi_name
                    ? `<br><small style="color:#ef4444">⬇ ${escapeHtml(site.worst_kpi_name)}: ${site.worst_kpi_value}%</small>`
                    : '';
                return `
                <div class="site-item" onclick="showSiteDetails('${escapeJsSingleQuoted(site.id)}')">
                    <div>
                        <span class="site-name">${escapeHtml(site.name)}</span>
                        <span style="font-size:0.75em;background:#fee2e2;padding:1px 5px;border-radius:10px;margin-left:4px">${escapeHtml(site.technology)}</span><br>
                        <small>${site.country_name} | <span style="width:8px;height:8px;border-radius:50%;background:${API.vendorColor(site.vendor)};display:inline-block;margin-right:2px;vertical-align:middle"></span>${escapeHtml(site.vendor)}</small>
                        ${worstLine}
                    </div>
                    <div><span class="${site.status === 'critical' ? 'badge-critical' : 'badge-warning'}">${site.kpi_global}%</span></div>
                </div>`;
            }).join('');
        }
    } catch (error) {
        console.error('[Dashboard] Erreur chargement top/worst sites:', error);
    }
}

/**
 * Charge les graphiques du dashboard
 */
async function loadDashboardCharts() {
    try {
        // IMPORTANT:
        // On évite Promise.all() strict car un seul endpoint KPI en erreur
        // peut empêcher tous les graphes de se dessiner.
        // Ici chaque requête est isolée et n'impacte pas les autres.
        const safeGetTrend = async (kpiName) => {
            try {
                return await API.getGlobalTrends(kpiName);
            } catch (e) {
                console.warn(`[Dashboard] KPI ${kpiName} indisponible:`, e);
                return null;
            }
        };

        const trends = await safeGetTrend('RNA');
        const tchDrop = await safeGetTrend('tch_drop_rate');
        const cssr = await safeGetTrend('cssr');
        const erab = await safeGetTrend('lte_erab_sr');
        const packetLoss = await safeGetTrend('packet_loss');

        if (trends.success) {
            // Calcul dynamique de l'axe Y : min arrondi à la dizaine inf. - 2, max 100
            const allVals = [
                ...(trends.data['2G'] || []),
                ...(trends.data['3G'] || []),
                ...(trends.data['4G'] || [])
            ].filter(v => v !== null && v !== undefined);
            const yMin = allVals.length ? Math.max(0, Math.floor((Math.min(...allVals) - 2) / 5) * 5) : 0;
            const fullLabels = trends.data.fullLabels || trends.data.labels;

            chartManager.createLineChart('ranTrendChart', {
                labels: trends.data.labels,
                datasets: [
                    {
                        label: '2G',
                        data: trends.data['2G'],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59,130,246,0.10)',
                        fill: false,
                        tension: 0.3,
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        borderDash: [],
                        spanGaps: true
                    },
                    {
                        label: '3G',
                        data: trends.data['3G'],
                        borderColor: '#22c55e',
                        backgroundColor: 'rgba(34,197,94,0.10)',
                        fill: false,
                        tension: 0.3,
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        borderDash: [6, 3],
                        spanGaps: true
                    },
                    {
                        label: '4G',
                        data: trends.data['4G'],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239,68,68,0.10)',
                        fill: false,
                        tension: 0.3,
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        borderDash: [2, 4],
                        spanGaps: true
                    }
                ]
            }, {
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, padding: 18 }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            title: items => items.length ? fullLabels[items[0].dataIndex] : '',
                            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(2) + ' %' : 'N/A'}`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { maxRotation: 45, minRotation: 30 }
                    },
                    y: {
                        min: yMin,
                        max: 100,
                        title: { display: true, text: 'RNA (%)' },
                        ticks: { callback: v => v + ' %' }
                    }
                },
                interaction: { mode: 'index', intersect: false }
            });
        }

        // Fallback:
        // si la tendance KPI spécifique n'est pas disponible, on réutilise
        // la série RNA de la techno correspondante pour garder un graphe visible.
        const fallback2G = trends?.success ? (trends.data['2G'] || []) : [];
        const fallback3G = trends?.success ? (trends.data['3G'] || []) : [];
        const fallback4G = trends?.success ? (trends.data['4G'] || []) : [];
        const fallbackLabels = trends?.success ? (trends.data.labels || []) : [];
        const fallbackFullLabels = trends?.success ? (trends.data.fullLabels || trends.data.labels || []) : [];

        if (tchDrop?.success || fallback2G.length > 0) {
            const tchLabels = tchDrop?.success ? (tchDrop.data.labels || []) : fallbackLabels;
            const tchValues = tchDrop?.success ? (tchDrop.data.values || []) : fallback2G;
            const fullLabels = tchDrop?.success
                ? (tchDrop.data.fullLabels || tchDrop.data.labels || [])
                : fallbackFullLabels;
            const maxVal = Math.max(5, ...(tchValues.map(v => Number(v) || 0)));
            chartManager.createLineChart('tchDropTrendChart', {
                labels: tchLabels,
                datasets: [{
                    label: 'TCH Drop Rate (%)',
                    data: tchValues,
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249,115,22,0.16)',
                    fill: true,
                    tension: 0.25,
                    borderWidth: 2.2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    spanGaps: true
                }]
            }, {
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 14 } },
                    tooltip: {
                        callbacks: {
                            title: items => items.length ? fullLabels[items[0].dataIndex] : '',
                            label: ctx => `TCH Drop: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(2) + ' %' : 'N/A'}`
                        }
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: Math.ceil(maxVal + 1),
                        title: { display: true, text: 'TCH Drop Rate (%)' },
                        ticks: { callback: v => v + ' %' }
                    }
                }
            });
        }

        if (cssr?.success || fallback3G.length > 0) {
            const cssrLabels = cssr?.success ? (cssr.data.labels || []) : fallbackLabels;
            const cssrValues = cssr?.success ? (cssr.data.values || []) : fallback3G;
            const fullLabels = cssr?.success
                ? (cssr.data.fullLabels || cssr.data.labels || [])
                : fallbackFullLabels;
            const cssrVals = cssrValues.filter(v => v !== null && v !== undefined);
            const yMin = cssrVals.length ? Math.max(80, Math.floor((Math.min(...cssrVals) - 2) / 5) * 5) : 80;
            chartManager.createLineChart('cssrTrendChart', {
                labels: cssrLabels,
                datasets: [{
                    label: 'CSSR (%)',
                    data: cssrValues,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,0.14)',
                    fill: true,
                    tension: 0.25,
                    borderWidth: 2.2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    spanGaps: true
                }]
            }, {
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 14 } },
                    tooltip: {
                        callbacks: {
                            title: items => items.length ? fullLabels[items[0].dataIndex] : '',
                            label: ctx => `CSSR: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(2) + ' %' : 'N/A'}`
                        }
                    }
                },
                scales: {
                    y: {
                        min: yMin,
                        max: 100,
                        title: { display: true, text: 'CSSR (%)' },
                        ticks: { callback: v => v + ' %' }
                    }
                }
            });
        }

        if (erab?.success || fallback4G.length > 0) {
            const erabLabels = erab?.success ? (erab.data.labels || []) : fallbackLabels;
            const erabValues = erab?.success ? (erab.data.values || []) : fallback4G;
            const fullLabels = erab?.success
                ? (erab.data.fullLabels || erab.data.labels || [])
                : fallbackFullLabels;
            const erabVals = erabValues.filter(v => v !== null && v !== undefined);
            const yMin = erabVals.length ? Math.max(80, Math.floor((Math.min(...erabVals) - 2) / 5) * 5) : 80;
            chartManager.createLineChart('erabTrendChart', {
                labels: erabLabels,
                datasets: [{
                    label: 'ERAB SR (%)',
                    data: erabValues,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139,92,246,0.14)',
                    fill: true,
                    tension: 0.25,
                    borderWidth: 2.2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    spanGaps: true
                }]
            }, {
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 14 } },
                    tooltip: {
                        callbacks: {
                            title: items => items.length ? fullLabels[items[0].dataIndex] : '',
                            label: ctx => `ERAB SR: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(2) + ' %' : 'N/A'}`
                        }
                    }
                },
                scales: {
                    y: {
                        min: yMin,
                        max: 100,
                        title: { display: true, text: 'ERAB Success Rate (%)' },
                        ticks: { callback: v => v + ' %' }
                    }
                }
            });
        }

        if (packetLoss?.success) {
            chartManager.createBarChart('packetLossChart', {
                labels: packetLoss.data.labels,
                datasets: [{
                    label: 'Packet Loss (%)',
                    data: packetLoss.data.values,
                    backgroundColor: '#f59e0b'
                }]
            }, {
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: false, padding: 12 }
                    }
                }
            });
        }
    } catch (error) {
        console.error('[Dashboard] Erreur chargement graphiques:', error);
    }
}

/**
 * Initialise les filtres du dashboard
 */
function initDashboardFilters() {
    const applyBtn = document.getElementById('applyFilters');
    const resetBtn = document.getElementById('resetFilters');
    
    if (applyBtn) {
        applyBtn.addEventListener('click', async () => {
            const filters = {
                country: document.getElementById('filterCountry')?.value || 'all',
                vendor: document.getElementById('filterVendor')?.value || 'all',
                tech: document.getElementById('filterTech')?.value || 'all',
                domain: document.getElementById('filterDomain')?.value || 'all'
            };
            
            await loadTopWorstSites(filters);
            await loadMapMarkers(filters);
            await loadDashboardStats(filters);
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            const selects = ['filterCountry', 'filterVendor', 'filterTech', 'filterDomain'];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = 'all';
            });
            
            await loadTopWorstSites({});
            await loadMapMarkers({});
            await loadDashboardStats({});
        });
    }
}

/**
 * Initialise la recherche de site
 */
function initDashboardSearch() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchSite');
    
    if (!searchBtn || !searchInput) return;
    
    const performSearch = async () => {
        const query = searchInput.value.trim();
        const notice = document.getElementById('searchNotice');

        const showNotice = (text) => {
            if (!notice) return;
            notice.textContent = text;
            notice.style.display = 'block';
            setTimeout(() => {
                notice.style.display = 'none';
            }, 3500);
        };

        if (!query) {
            showNotice('Veuillez entrer un nom de site ou un ID.');
            return;
        }
        
        try {
            const result = await API.searchSite(query);
            if (result.success && result.data) {
                const site = result.data;
                // Centrer la carte puis ouvrir le modal
                if (dashboardMap && site.latitude && site.longitude) {
                    dashboardMap.flyTo([site.latitude, site.longitude], 12);
                }
                showSiteDetails(site.id);
            } else {
                showNotice(`Aucun site trouvé pour : ${query}`);
            }
        } catch (error) {
            console.error('[Dashboard] Erreur recherche:', error);
            showNotice('Erreur lors de la recherche. Réessayez.');
        }
    };
    
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
}

/**
 * Initialise les rapports
 */
function initDashboardReports() {
    const reportMsgId = 'reportActionMsg';

    const setActionMessage = (type, text) => {
        const el = document.getElementById(reportMsgId);
        if (!el) return;
        if (!text) {
            el.innerHTML = '';
            return;
        }
        const cssByType = {
            success: 'text-success',
            info: 'text-info',
            warning: 'text-warning',
            error: 'text-danger'
        };
        const iconByType = {
            success: 'bi-check-circle',
            info: 'bi-info-circle',
            warning: 'bi-exclamation-triangle',
            error: 'bi-x-circle'
        };
        const cls = cssByType[type] || 'text-info';
        const icon = iconByType[type] || 'bi-info-circle';
        el.innerHTML = `<span class="${cls}"><i class="bi ${icon} me-1"></i>${escapeHtml(text)}</span>`;
    };

    const runButtonAction = async (btn, runningLabel, action) => {
        if (!btn || btn.dataset.busy === '1') return false;

        const width = Math.ceil(btn.getBoundingClientRect().width);
        btn.dataset.busy = '1';
        btn.dataset.originalHtml = btn.innerHTML;
        btn.dataset.originalMinWidth = btn.style.minWidth || '';
        btn.style.minWidth = `${width}px`;
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${runningLabel}`;

        try {
            await action();
            return true;
        } finally {
            btn.disabled = false;
            if (btn.dataset.originalHtml) {
                btn.innerHTML = btn.dataset.originalHtml;
                delete btn.dataset.originalHtml;
            }
            btn.style.minWidth = btn.dataset.originalMinWidth || '';
            delete btn.dataset.originalMinWidth;
            delete btn.dataset.busy;
        }
    };

    const getPeriodDateRange = (period) => {
        const now = new Date();
        const endDate = now.toISOString().split('T')[0];
        let startDate = endDate;

        if (period === 'week') {
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            startDate = weekAgo.toISOString().split('T')[0];
        } else if (period === 'month') {
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            startDate = monthAgo.toISOString().split('T')[0];
        }

        return { startDate, endDate };
    };

    const setPdfPeriodButtonLabel = (btn, period) => {
        if (!btn) return;
        const periodLabel = period === 'week' ? 'Semaine' : (period === 'month' ? 'Mois' : 'Jour');
        btn.dataset.selectedPeriod = period;
        btn.innerHTML = `<i class="bi bi-file-earmark-pdf"></i> Exporter PDF - ${periodLabel}`;
    };

    const exportPdfBtn = document.getElementById('exportPdf');
    const pdfMenu = document.getElementById('dashboardPdfMenu');

    const closePdfMenu = () => {
        pdfMenu?.classList.remove('show');
    };

    if (exportPdfBtn && pdfMenu) {
        exportPdfBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            pdfMenu.classList.toggle('show');
        });
    }

    document.addEventListener('click', (e) => {
        const inside = e.target.closest('.dropdown-pdf-wrapper');
        if (!inside) closePdfMenu();
    });

    document.querySelectorAll('#dashboardPdfMenu .pdf-option').forEach(option => {
        option.addEventListener('click', async (e) => {
            e.stopPropagation();
            const period = option.getAttribute('data-period') || 'day';
            const periodLabel = period === 'week' ? 'semaine' : (period === 'month' ? 'mois' : 'jour');
            const { startDate, endDate } = getPeriodDateRange(period);
            closePdfMenu();
            setPdfPeriodButtonLabel(exportPdfBtn, period);

            const filters = {
                country: document.getElementById('filterCountry')?.value || 'all',
                vendor:  document.getElementById('filterVendor')?.value  || 'all',
                tech:    document.getElementById('filterTech')?.value    || 'all',
                domain:  document.getElementById('filterDomain')?.value  || 'all',
            };

            await runButtonAction(exportPdfBtn, 'Export PDF...', async () => {
                setActionMessage('info', `Génération du PDF (${periodLabel}) en cours...`);
                try {
                    const result = await API.exportPdf({
                        type: 'dashboard',
                        start_date: startDate,
                        end_date: endDate,
                        ...filters
                    });
                    if (result.success && result.url) {
                        const w = window.open(result.url, '_blank');
                        if (!w) {
                            setActionMessage('warning', 'Pop-up bloquée: autorisez les pop-ups pour ouvrir le PDF.');
                            return;
                        }
                        setActionMessage('success', `Export PDF (${periodLabel}) généré avec succès.`);
                    } else {
                        setActionMessage('error', result?.message || result?.error || 'Échec de génération du PDF.');
                    }
                } catch (error) {
                    console.error('[Dashboard] Erreur export PDF:', error);
                    setActionMessage('error', 'Erreur pendant l\'export PDF.');
                }
            });
        });
    });

    const shareBtn = document.getElementById('shareWhatsApp');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            await runButtonAction(shareBtn, 'Partage...', async () => {
                setActionMessage('info', 'Préparation du rapport WhatsApp...');
                try {
                    const result = await API.generateWhatsAppReport();
                    if (result.success && result.report) {
                        const w = window.open(`https://wa.me/?text=${encodeURIComponent(result.report)}`, '_blank');
                        if (!w) {
                            setActionMessage('warning', 'Pop-up bloquée: autorisez les pop-ups pour ouvrir WhatsApp.');
                            return;
                        }
                        setActionMessage('success', 'Rapport WhatsApp prêt à être envoyé.');
                    } else {
                        setActionMessage('error', result?.message || result?.error || 'Impossible de préparer le rapport WhatsApp.');
                    }
                } catch (error) {
                    console.error('[Dashboard] Erreur génération rapport:', error);
                    setActionMessage('error', 'Erreur pendant la préparation du rapport WhatsApp.');
                }
            });
        });
    }
    

    
    const weeklyBtn = document.getElementById('weeklyComparison');
    if (weeklyBtn) {
        weeklyBtn.addEventListener('click', async () => {
            await runButtonAction(weeklyBtn, 'Analyse...', async () => {
                setActionMessage('info', 'Calcul de la comparaison hebdomadaire...');
                try {
                    const result = await API.getWeeklyComparison();
                    if (result.success) {
                    // Barre de stats
                    const statsBar = document.getElementById('comparisonStatsBar');
                    if (statsBar && result.data?.datasets?.length === 2) {
                        const [ds1, ds2] = result.data.datasets;
                        const avg = arr => arr.length ? (arr.reduce((a,b) => a+b,0)/arr.length).toFixed(1) : '0';
                        const avgRecent   = avg(ds1.data);
                        const avgPrevious = avg(ds2.data);
                        const diff = (parseFloat(avgRecent) - parseFloat(avgPrevious)).toFixed(2);
                        const diffColor = diff >= 0 ? API.COLORS.trend.up : API.COLORS.trend.down;
                        const techLabels = result.data.labels || [];
                        const techCells = techLabels.map((t, i) => {
                            const v1 = ds1.data[i] ?? 0, v2 = ds2.data[i] ?? 0;
                            const d = (v1 - v2).toFixed(1);
                            const c = d >= 0 ? API.COLORS.trend.up : API.COLORS.trend.down;
                            return `<div class="text-center px-3"><span class="text-muted">${t}</span><br><strong>${v1}%</strong> <span style="color:${c};font-size:0.75rem">${d >= 0 ? '+':''}${d}%</span></div>`;
                        }).join('');
                        statsBar.innerHTML = `
                            <div class="w-100 d-flex justify-content-center gap-4 pb-2 border-bottom">
                                <div class="text-center"><span class="text-muted">Période récente</span><br><strong>${ds1.label}</strong></div>
                                <div class="text-center"><span class="text-muted">Période précédente</span><br><strong>${ds2.label}</strong></div>
                            </div>
                            <div class="w-100 d-flex justify-content-center gap-4 pt-2">
                                ${techCells}
                                <div class="text-center px-3"><span class="text-muted">Évolution globale</span><br><strong style="color:${diffColor}">${diff >= 0 ? '+':''}${diff}%</strong></div>
                            </div>`;
                    }

                    // Graphique compact
                    const ctx = document.getElementById('comparisonChart').getContext('2d');
                    Chart.getChart('comparisonChart')?.destroy();
                    new Chart(ctx, {
                        type: 'bar',
                        data: result.data,
                        options: {
                            responsive: true,
                            plugins: {
                                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                                tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}%` } }
                            },
                            scales: {
                                y: { beginAtZero: false, min: 80, max: 100, ticks: { font: { size: 10 }, callback: v => v + '%' }, grid: { color: '#f0f0f0' } },
                                x: { ticks: { font: { size: 11 } } }
                            }
                        }
                    });
                    document.getElementById('comparisonLessons').innerHTML = result.lessons || '';
                        new bootstrap.Modal(document.getElementById('comparisonModal')).show();
                        setActionMessage('success', 'Comparaison hebdomadaire générée.');
                    } else {
                        setActionMessage('error', result?.message || result?.error || 'Comparaison indisponible.');
                    }
                } catch (error) {
                    console.error('[Dashboard] Erreur comparaison:', error);
                    setActionMessage('error', 'Erreur pendant la comparaison hebdomadaire.');
                }
            });
        });
    }
    
    const shareSiteBtn = document.getElementById('shareSiteBtn');
    if (shareSiteBtn) {
        shareSiteBtn.addEventListener('click', () => {
            const s = window.currentSiteForModal;
            if (!s) return;
            const msg = `📡 *Site: ${s.name} (${s.country_name})*\nID: ${s.id}\nKPI: ${s.kpi_global}%\nVendor: ${s.vendor}\nTechno: ${s.technology}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        });
    }

    const exportExcelBtn = document.getElementById('exportExcel');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', async () => {
            await runButtonAction(exportExcelBtn, 'Export Excel...', async () => {
                setActionMessage('info', 'Génération du fichier Excel en cours...');
                try {
                    const filters = {
                        country: document.getElementById('filterCountry')?.value || 'all',
                        vendor:  document.getElementById('filterVendor')?.value  || 'all',
                        tech:    document.getElementById('filterTech')?.value    || 'all',
                        domain:  document.getElementById('filterDomain')?.value  || 'all',
                    };
                    const result = await API.exportExcel('dashboard', filters);
                    if (result.success && result.url) {
                        const w = window.open(result.url, '_blank');
                        if (!w) {
                            setActionMessage('warning', 'Pop-up bloquée: autorisez les pop-ups pour ouvrir le fichier Excel.');
                            return;
                        }
                        setActionMessage('success', 'Export Excel généré avec succès.');
                    } else if (result.success) {
                        setActionMessage('info', 'Rapport Excel généré (vérifiez le dossier exports).');
                    } else {
                        setActionMessage('error', result?.message || result?.error || 'Échec de génération du fichier Excel.');
                    }
                } catch (error) {
                    console.error('[Dashboard] Erreur export Excel:', error);
                    setActionMessage('error', 'Erreur pendant l\'export Excel.');
                }
            });
        });
    }
}

/**
 * Affiche les détails d'un site
 * @param {string} siteId - Identifiant du site
 */
async function showSiteDetails(siteId) {
    try {
        const result = await API.getSiteDetails(siteId);
        if (!result.success || !result.data) return;
        
        const site = result.data;
        window.currentSiteForModal = site;
        
        document.getElementById('modalSiteTitle').innerText = `${site.name} - ${site.country_name}`;
        document.getElementById('modalSiteInfo').innerHTML = `
            <table class="table table-sm">
                <tr><td><strong>ID Site</strong></td><td>${escapeHtml(site.id)}</td></tr>
                <tr><td><strong>Nom</strong></td><td>${escapeHtml(site.name)}</td></tr>
                <tr><td><strong>Pays</strong></td><td>${escapeHtml(site.country_name)}</td></tr>
                <tr><td><strong>Vendor</strong></td><td><span style="width:9px;height:9px;border-radius:50%;background:${API.vendorColor(site.vendor)};display:inline-block;margin-right:4px;vertical-align:middle"></span>${escapeHtml(site.vendor)}</td></tr>
                <tr><td><strong>Technologie</strong></td><td>${escapeHtml(site.technology)}</td></tr>
                <tr><td><strong>Domaine</strong></td><td>${escapeHtml(site.domain)}</td></tr>
            </table>
        `;
        
        document.getElementById('modalSitePerformance').innerHTML = `
            <table class="table table-sm">
                <tr><td><strong>KPI Global</strong></td>
                    <td class="text-${site.status === 'good' ? 'success' : (site.status === 'warning' ? 'warning' : 'danger')}">${site.kpi_global}%</td></tr>
                <tr><td><strong>Statut</strong></td>
                    <td><span class="status-badge status-${site.status}">${site.status === 'good' ? 'Bon' : (site.status === 'warning' ? 'Alerte' : 'Critique')}</span></td></tr>
                ${site.worst_kpi
                    ? `<tr><td><strong>KPI dégradant</strong></td>
                       <td style="color:#ef4444">⬇ ${escapeHtml(site.worst_kpi.worst_kpi_name)} = ${site.worst_kpi.worst_kpi_value}% <small>(${escapeHtml(site.worst_kpi.technology)})</small></td></tr>`
                    : ''}
                ${(site.kpis_by_tech && site.kpis_by_tech.length > 0)
                    ? site.kpis_by_tech.map(k => `
                        <tr>
                            <td><strong>KPI ${escapeHtml(k.technology)}</strong></td>
                            <td class="text-${k.status === 'good' ? 'success' : (k.status === 'warning' ? 'warning' : 'danger')}">${k.kpi_global}%
                                ${k.worst_kpi_name ? `<br><small style="color:#ef4444">⬇ ${escapeHtml(k.worst_kpi_name)}: ${k.worst_kpi_value}%</small>` : ''}
                            </td>
                        </tr>`).join('')
                    : ''}
            </table>
        `;
        
        document.getElementById('modalSiteLocation').innerHTML = `
            <table class="table table-sm">
                <tr><td><strong>Latitude</strong></td><td>${site.latitude || 'N/A'}</td></tr>
                <tr><td><strong>Longitude</strong></td><td>${site.longitude || 'N/A'}</td></tr>
                <tr><td><strong>Région</strong></td><td>${site.region || 'Non spécifiée'}</td></tr>
            </table>
        `;
        
        new bootstrap.Modal(document.getElementById('siteDetailsModal')).show();
    } catch (error) {
        console.error('[Dashboard] Erreur chargement détails site:', error);
    }
}

/**
 * Échappe les caractères HTML
 * @param {string} text - Texte à échapper
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Protège une valeur injectée dans un attribut JS de type quote simple.
 */
function escapeJsSingleQuoted(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', initDashboard);

// Toast "Dernière connexion" : déclenché indépendamment des appels réseau
document.addEventListener('DOMContentLoaded', () => setTimeout(showLastLoginToast, 800));

// Exporter les fonctions globales
window.showSiteDetails = showSiteDetails;