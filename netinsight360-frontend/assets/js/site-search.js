// JavaScript pour la page de recherche de site
// Ce script gère la recherche de sites, l'affichage des résultats et l'export PDF

document.addEventListener('DOMContentLoaded', function() {
    const siteSearchInput = document.getElementById('siteSearch');
    const suggestionsList = document.getElementById('siteSuggestions');
    const siteSearchForm = document.getElementById('siteSearchForm');
    const resultsSection = document.getElementById('resultsSection');
    const siteInfoDiv = document.getElementById('siteInfo');
    const technologySelect = document.getElementById('technologySelect');
    const periodSelect = document.getElementById('periodSelect');
    const kpiSelect = document.getElementById('kpiSelect');
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const trendInfo = document.getElementById('trendInfo');

    let selectedSite = null;
    let selectedTechnology = '';
    let kpiChart = null;

    siteSearchInput.addEventListener('input', debounce(function() {
        const query = this.value.trim();
        if (query.length < 2) {
            hideSuggestions();
            return;
        }

        fetch(`../netinsight360-backend/api/sites/search-site.php?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                let sites = [];
                if (data.success && data.data) {
                    if (Array.isArray(data.data)) {
                        sites = data.data;
                    } else if (Array.isArray(data.data.sites)) {
                        sites = data.data.sites;
                    } else {
                        sites = [data.data];
                    }
                }

                if (sites.length > 0) {
                    showSuggestions(sites);
                } else {
                    hideSuggestions();
                }
            })
            .catch(error => {
                console.error('Recherche site échouée:', error);
                hideSuggestions();
            });
    }, 250));

    technologySelect.addEventListener('change', function() {
        selectedTechnology = this.value;
        loadKPIsForTechnology(selectedTechnology);
    });

    siteSearchForm.addEventListener('submit', function(e) {
        e.preventDefault();

        if (!selectedSite) {
            alert('Veuillez sélectionner un site valide.');
            return;
        }
        if (!selectedTechnology) {
            alert('Veuillez sélectionner une technologie.');
            return;
        }

        const period = periodSelect.value;
        const kpi = kpiSelect.value;

        if (!kpi) {
            alert('Veuillez sélectionner un KPI.');
            return;
        }

        loadSiteData(selectedSite, period, kpi, selectedTechnology);
    });

    exportPdfBtn.addEventListener('click', function() {
        if (!selectedSite) return;

        const period = periodSelect.value;
        const kpi = kpiSelect.value;
        const technology = selectedTechnology;

        if (!kpi || !technology) {
            alert("Veuillez sélectionner une technologie et un KPI avant d'exporter.");
            return;
        }

        const pdfUrl = `../netinsight360-backend/api/reports/export-site-pdf.php?site_id=${encodeURIComponent(selectedSite.site_id)}&kpi_name=${encodeURIComponent(kpi)}&technology=${encodeURIComponent(technology)}&period=${encodeURIComponent(period)}`;
        window.open(pdfUrl, '_blank');
    });

    document.addEventListener('click', function(e) {
        if (!siteSearchInput.contains(e.target) && !suggestionsList.contains(e.target)) {
            hideSuggestions();
        }
    });

    function debounce(fn, delay) {
        let timer = null;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    function showSuggestions(sites) {
        suggestionsList.innerHTML = '';
        sites.forEach(site => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `
                <div class="item-title">${site.site_name || site.name || 'Site inconnu'} (${site.site_id || site.id || ''})</div>
                <div class="item-meta">${site.region || site.country_name || 'Région inconnue'} · ${site.technology || 'Tech inconnue'}</div>
            `;
            item.addEventListener('click', function() {
                selectSite(site);
            });
            suggestionsList.appendChild(item);
        });
        suggestionsList.style.display = 'block';
    }

    function hideSuggestions() {
        suggestionsList.innerHTML = '';
        suggestionsList.style.display = 'none';
    }

    function selectSite(site) {
        selectedSite = {
            site_id: site.site_id || site.id || '',
            site_name: site.site_name || site.name || 'Non défini',
            region: site.region || site.country_name || 'N/A',
            technology: site.technology || '' ,
            status: site.status || 'N/A'
        };

        siteSearchInput.value = `${selectedSite.site_name} (${selectedSite.site_id})`;
        hideSuggestions();

        if (selectedSite.technology) {
            technologySelect.value = selectedSite.technology;
            selectedTechnology = selectedSite.technology;
            loadKPIsForTechnology(selectedTechnology);
        }
    }

    function loadKPIsForTechnology(technology) {
        kpiSelect.innerHTML = '';

        if (!technology) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Sélectionner une technologie d\'abord';
            kpiSelect.appendChild(option);
            kpiSelect.disabled = true;
            return;
        }

        kpiSelect.disabled = true;
        kpiSelect.innerHTML = '<option value="">Chargement des KPIs...</option>';

        fetch(`../netinsight360-backend/api/sites/get-kpis-by-tech.php?tech=${encodeURIComponent(technology)}`)
            .then(response => response.json())
            .then(data => {
                const kpis = Array.isArray(data.data?.kpis) ? data.data.kpis : [];
                if (data.success && kpis.length > 0) {
                    renderKpiOptions(kpis);
                } else {
                    kpiSelect.innerHTML = '<option value="">Aucun KPI trouvé pour cette technologie</option>';
                    kpiSelect.disabled = true;
                }
            })
            .catch(error => {
                console.error('Erreur de chargement KPI:', error);
                kpiSelect.innerHTML = '<option value="">Erreur de chargement des KPIs</option>';
                kpiSelect.disabled = true;
            });
    }

    function renderKpiOptions(kpis) {
        kpiSelect.innerHTML = '<option value="">Sélectionner un KPI...</option>';
        kpis.forEach(kpi => {
            const option = document.createElement('option');
            option.value = kpi;
            option.textContent = kpi;
            kpiSelect.appendChild(option);
        });
        kpiSelect.disabled = false;
    }

    function loadSiteData(site, period, kpi, technology) {
        displaySiteInfo(site, technology);
        trendInfo.textContent = `${kpi} • ${getPeriodLabel(period)}`;

        const days = mapPeriodToDays(period);
        fetch(`../netinsight360-backend/api/kpis/get-kpi-trends.php?site_id=${encodeURIComponent(site.site_id)}&kpi_name=${encodeURIComponent(kpi)}&technology=${encodeURIComponent(technology)}&days=${days}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.data) {
                    displayKPIChart(data.data.labels, data.data.values, kpi, technology, period);
                    resultsSection.style.display = 'flex';
                } else {
                    alert('Erreur lors du chargement des données KPI : ' + (data.error || 'Réponse invalide'));
                }
            })
            .catch(error => {
                console.error('Erreur de chargement des tendances KPI :', error);
                alert('Erreur lors du chargement des données.');
            });
    }

    function displaySiteInfo(site, technology) {
        siteInfoDiv.innerHTML = `
            <h6>Informations générales</h6>
            <p><strong>ID du site :</strong> ${site.site_id}</p>
            <p><strong>Nom :</strong> ${site.site_name}</p>
            <p><strong>Région :</strong> ${site.region}</p>
            <p><strong>Technologie du site :</strong> ${site.technology || 'N/A'}</p>
            <p><strong>Technologie choisie :</strong> ${technology}</p>
            <p><strong>Statut :</strong> ${site.status}</p>
        `;
    }

    function displayKPIChart(labels, values, kpi, technology, period) {
        const ctx = document.getElementById('kpiChart').getContext('2d');
        if (kpiChart) {
            kpiChart.destroy();
        }

        kpiChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `${kpi} (${technology})`,
                    data: values,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.25)',
                    tension: 0.2,
                    pointRadius: 4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Tendance ${kpi} — ${getPeriodLabel(period)}`
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    function mapPeriodToDays(period) {
        if (period === 'day') return 5;
        if (period === 'week') return 7;
        if (period === 'month') return 30;
        return 7;
    }

    function getPeriodLabel(period) {
        return {
            day: 'Dernier Jour',
            week: 'Dernière Semaine',
            month: 'Dernier Mois'
        }[period] || period;
    }

    initializeUserInfo();
});

function initializeUserInfo() {
    const userStr = sessionStorage.getItem('currentUser');
    if (!userStr) {
        console.warn('[SiteSearch] Utilisateur non trouvé dans sessionStorage');
        return;
    }

    let user = null;
    try {
        user = JSON.parse(userStr);
    } catch (error) {
        console.error('[SiteSearch] Impossible de parser currentUser :', error);
        return;
    }

    const userNameEl = document.getElementById('userName');
    const headerUserNameEl = document.getElementById('headerUserName');
    const userAvatarEl = document.getElementById('userAvatar');
    const headerUserRoleEl = document.getElementById('headerUserRole');
    const currentDateTimeEl = document.querySelector('#currentDateTime span');

    if (userNameEl) userNameEl.textContent = user.name || user.email || 'Utilisateur';
    if (headerUserNameEl) headerUserNameEl.textContent = user.name || user.email || 'Utilisateur';
    if (userAvatarEl) {
        const initials = (user.name || user.email || 'U').split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2);
        userAvatarEl.textContent = initials;
    }

    if (headerUserRoleEl) {
        const roleMap = {
            'ADMIN': 'Administrateur',
            'FO_ANALYSTE': 'Agent Analyste',
            'CUSTOMER': 'Visualiseur'
        };
        headerUserRoleEl.textContent = roleMap[user.role] || 'Utilisateur';
    }

    if (currentDateTimeEl) {
        const now = new Date();
        currentDateTimeEl.textContent = now.toLocaleString('fr-FR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}
