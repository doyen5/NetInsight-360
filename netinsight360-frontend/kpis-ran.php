<?php
// Inclure le helper d'authentification
require_once __DIR__ . '/../netinsight360-backend/app/helpers/AuthHelper.php';

// Vérifier que l'utilisateur est connecté
AuthHelper::requireLogin();

// Récupérer les infos utilisateur
$user = AuthHelper::getUser();
$userRole = AuthHelper::getUserRole();

$kpisRanCssVersion = @filemtime(__DIR__ . '/css/kpis-ran.css') ?: time();
$apiJsVersion = @filemtime(__DIR__ . '/js/api.js') ?: time();
$kpisRanJsVersion = @filemtime(__DIR__ . '/js/kpis-ran.js') ?: time();
?>

<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>NetInsight 360 - KPIs RAN</title>
    <link rel="icon" type="image/png" href="assets/img/logo.PNG">
    
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <!-- Leaflet CSS -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/dashboard.css">
    <link rel="stylesheet" href="css/kpis-ran.css?v=<?= $kpisRanCssVersion ?>">
    
    <style>
        .logout-confirm-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            z-index: 2000;
            display: none;
            align-items: center;
            justify-content: center;
        }
        .logout-confirm-modal.show { display: flex; }
        .logout-confirm-card {
            background: white;
            border-radius: 24px;
            padding: 30px;
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: 0 25px 50px rgba(0,0,0,0.3);
        }
        .logout-confirm-card i { font-size: 4rem; color: #ef4444; margin-bottom: 20px; }
        .logout-confirm-card h3 { font-size: 1.5rem; margin-bottom: 10px; color: #1e293b; }
        .logout-confirm-card p { color: #64748b; margin-bottom: 25px; }
        .logout-confirm-buttons { display: flex; gap: 15px; justify-content: center; }
        .logout-confirm-buttons button { padding: 10px 25px; border-radius: 40px; font-weight: 600; border: none; cursor: pointer; }
        .btn-confirm-logout { background: #ef4444; color: white; }
        .btn-confirm-logout:hover { background: #dc2626; }
        .btn-cancel-logout { background: #e2e8f0; color: #1e293b; }
        .btn-cancel-logout:hover { background: #cbd5e1; }
    </style>
</head>
<body>
    <button class="menu-toggle" id="menuToggle"><i class="bi bi-list"></i></button>

    <div class="sidebar" id="sidebar">
        <div class="logo-area">
            <h3><i class="bi bi-eye-fill"></i> NetInsight 360</h3>
            <p>Supervisez. Analysez. Optimisez.</p>
        </div>
        <nav class="nav flex-column">
            <a href="dashboard.php" class="nav-link"><i class="bi bi-speedometer2"></i> Dashboard</a>
            <a href="kpis-ran.php" class="nav-link active"><i class="bi bi-wifi"></i> KPIs RAN</a>
            <a href="kpis-core.php" class="nav-link"><i class="bi bi-hdd-stack"></i> KPIs CORE</a>
            <a href="map-view.php" class="nav-link"><i class="bi bi-map"></i> Cartographie</a>
            <a href="users-management.php" class="nav-link admin-only" data-section="users-management">
                <i class="bi bi-people"></i> Gestion Users
            </a>
            <a href="alerts.php" class="nav-link viewer-restricted"><i class="bi bi-bell"></i> Alertes</a>
            <a href="admin-tools.php" class="nav-link admin-only"><i class="bi bi-tools"></i> Outils Admin</a>
        </nav>
    </div>

    <div class="main-content">
        <div class="header-bar">
            <div class="welcome-message"><i class="bi bi-person-circle"></i> Bienvenue, <span id="userName">Chargement...</span> 👋</div>
            <div class="header-right">
                <div class="date-time" id="currentDateTime"><i class="bi bi-calendar3"></i> <span>Chargement...</span></div>
                <div class="user-info-header">
                    <div class="user-avatar" id="userAvatar">PD</div>
                    <div class="user-details">
                        <div class="user-name" id="headerUserName">Chargement...</div>
                        <div class="user-role" id="headerUserRole">Chargement...</div>
                    </div>
                </div>
                <button class="logout-btn-header" id="logoutBtn"><i class="bi bi-box-arrow-right"></i> Déconnexion</button>
            </div>
        </div>

        <div class="page-header mb-4">
            <h2><i class="bi bi-wifi"></i> KPIs RAN - Performance Radio</h2>
            <p class="text-muted">Supervision des indicateurs clés du réseau d'accès radio (2G/3G/4G)</p>
        </div>

        <div class="filter-bar">
            <div class="filter-group"><label><i class="bi bi-flag"></i> Pays</label><select id="filterCountry"><option value="all">Tous les pays</option><option value="CI">🇨🇮 Côte d'Ivoire</option><option value="NE">🇳🇪 Niger</option><option value="BJ">🇧🇯 Bénin</option><option value="TG">🇹🇬 Togo</option></select></div>
            <div class="filter-group"><label><i class="bi bi-building"></i> Vendor</label><select id="filterVendor"><option value="all">Tous</option><option value="Huawei">Huawei</option><option value="Ericsson">Ericsson</option></select></div>
            <div class="filter-group"><label><i class="bi bi-signal"></i> Technologie</label><select id="filterTech"><option value="all">Toutes</option><option value="2G">2G</option><option value="3G">3G</option><option value="4G">4G</option></select></div>
            <!-- Option pour n'afficher que les X pires sites par technologie (utile après import) -->
            <div class="filter-group" style="display:flex;align-items:center;gap:8px">
                <input type="checkbox" id="topByTechCheckbox">
                <label for="topByTechCheckbox" style="margin:0">Afficher top</label>
                <select id="topByTechNSelect" class="form-select form-select-sm" style="width:90px">
                    <option value="5">5 pires</option>
                    <option value="10" selected>10 pires</option>
                    <option value="20">20 pires</option>
                </select>
                <label style="margin:0">par techno</label>
            </div>
            <button class="btn btn-primary btn-sm" id="applyFilters"><i class="bi bi-funnel"></i> Appliquer</button>
            <button class="btn btn-secondary btn-sm" id="resetFilters"><i class="bi bi-arrow-repeat"></i> Réinitialiser</button>
            <div class="search-box"><i class="bi bi-search"></i><input type="text" id="searchSite" placeholder="Rechercher un site..."><button id="searchBtn"><i class="bi bi-arrow-right"></i></button></div>
        </div>

        <div class="row g-4 mb-4">
            <div class="col-md-3"><div class="stat-card"><div><span class="text-muted">Sites supervisés</span><div class="kpi-value" id="totalSitesDisplay">0</div></div><div><i class="bi bi-building fs-2 text-primary"></i></div><small id="sitesFilterInfo">Tous les sites</small></div></div>
            <div class="col-md-3"><div class="stat-card"><div><span class="text-muted">Disponibilité RAN (RNA)</span><div class="kpi-value" id="avgRNA">0%</div></div><div><i class="bi bi-wifi fs-2 text-success"></i></div><small>Objectif ≥ 99.5%</small></div></div>
            <div class="col-md-3"><div class="stat-card"><div><span class="text-muted">TCH Drop Rate (2G)</span><div class="kpi-value" id="avgTCHDrop">0%</div></div><div><i class="bi bi-phone fs-2 text-warning"></i></div><small>Objectif ≤ 2%</small></div></div>
            <div class="col-md-3"><div class="stat-card"><div><span class="text-muted">Sites critiques</span><div class="kpi-value text-danger" id="criticalSites">0</div></div><div><i class="bi bi-exclamation-triangle-fill fs-2 text-danger"></i></div><small>KPI global &lt; 90%</small></div></div>
        </div>

        <div class="stat-card mb-4"><h6><i class="bi bi-map"></i> Carte des sites RAN</h6><div id="map" style="height: 450px;"></div></div>

        <div class="row g-4 mb-4">
            <div class="col-md-12"><div class="stat-card"><div class="d-flex justify-content-between align-items-center mb-3"><h6><i class="bi bi-exclamation-triangle-fill text-danger"></i> Pires sites - Analyse détaillée</h6><div class="btn-group viewer-restricted"><div class="dropdown-pdf-wrapper"><button class="btn btn-sm btn-outline-danger" id="exportWorstSites"><i class="bi bi-file-earmark-pdf"></i> Exporter PDF</button><div class="pdf-export-menu" id="kpisRanWorstPdfMenu"><div class="pdf-option" data-export-kind="worst" data-period="day"><i class="bi bi-calendar-day"></i> Par jour</div><div class="pdf-option" data-export-kind="worst" data-period="week"><i class="bi bi-calendar-week"></i> Par semaine</div><div class="pdf-option" data-export-kind="worst" data-period="month"><i class="bi bi-calendar-month"></i> Par mois</div></div></div><button class="btn btn-sm btn-outline-success" id="shareWorstSites"><i class="bi bi-whatsapp"></i> Partager</button></div></div><div class="small mb-2" id="worstSitesActionMsg" aria-live="polite"></div><div class="table-responsive"><table class="table table-hover" id="worstSitesTable"><thead class="table-light"><tr><th>#</th><th>Site ID</th><th>Nom du site</th><th>Pays</th><th>Technologie</th><th>Vendor</th><th>KPI Dégradant</th><th>Status</th><th>Actions</th></tr></thead><tbody id="worstSitesList"><tr><td colspan="9" class="text-center">Chargement des données...</td></tr></tbody></table></div><div class="mt-3" id="paginationControls"></div></div></div>
        </div>

        <div class="row g-4">
            <div class="col-md-6"><div class="stat-card"><h6><i class="bi bi-phone"></i> KPIs 2G - Performance voix</h6><canvas id="kpi2GChart" height="250"></canvas></div></div>
            <div class="col-md-6"><div class="stat-card"><h6><i class="bi bi-signal"></i> KPIs 3G - Performance données</h6><canvas id="kpi3GChart" height="250"></canvas></div></div>
            <div class="col-md-12"><div class="stat-card"><h6><i class="bi bi-speedometer2"></i> KPIs 4G - Performance LTE</h6><canvas id="kpi4GChart" height="100"></canvas></div></div>
        </div>

        <div class="row g-4 mt-2">
            <div class="col-md-4"><div class="stat-card"><h6><i class="bi bi-pie-chart"></i> Répartition par vendor</h6><canvas id="vendorChart" height="200"></canvas></div></div>
            <div class="col-md-4"><div class="stat-card"><h6><i class="bi bi-bar-chart"></i> Répartition par technologie</h6><canvas id="techChart" height="200"></canvas></div></div>
            <div class="col-md-4"><div class="stat-card"><h6><i class="bi bi-flag"></i> Répartition par pays</h6><canvas id="countryChart" height="200"></canvas></div></div>
        </div>

        <div class="row mt-4 viewer-restricted"><div class="col-12"><div class="stat-card"><h6><i class="bi bi-file-text"></i> Rapports et Analyses KPIs RAN</h6><div class="report-buttons"><button class="btn btn-whatsapp" id="shareWhatsApp"><i class="bi bi-whatsapp"></i> Partager sur WhatsApp</button><button class="btn btn-success" id="exportExcel"><i class="bi bi-file-earmark-excel"></i> Exporter Excel</button><div class="dropdown-pdf-wrapper"><button class="btn btn-danger" id="exportPdf"><i class="bi bi-file-earmark-pdf"></i> Exporter PDF</button><div class="pdf-export-menu" id="kpisRanMainPdfMenu"><div class="pdf-option" data-export-kind="main" data-period="day"><i class="bi bi-calendar-day"></i> Par jour</div><div class="pdf-option" data-export-kind="main" data-period="week"><i class="bi bi-calendar-week"></i> Par semaine</div><div class="pdf-option" data-export-kind="main" data-period="month"><i class="bi bi-calendar-month"></i> Par mois</div></div></div><button class="btn btn-info" id="weeklyComparison"><i class="bi bi-graph-up"></i> Comparaison Hebdomadaire</button></div><div class="small mt-2" id="reportActionMsg" aria-live="polite"></div></div></div></div>
    </div>

    <!-- Modals -->
    <div class="modal fade" id="siteDetailsModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content"><div class="modal-header py-2" style="background:linear-gradient(135deg,#1e3a5f,#00a3c4);color:white"><div><h6 class="modal-title mb-0" id="modalSiteTitle">Détails du site</h6><small id="modalSiteSubtitle" class="opacity-75 small"></small></div><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div id="modalStatsBar" class="px-3 py-2 border-bottom d-flex flex-wrap gap-3" style="background:#f8f9fa;font-size:0.8rem"></div><div class="modal-body p-3"><div class="row g-3"><div class="col-md-5"><p class="text-muted small text-uppercase fw-bold mb-2"><i class="bi bi-info-circle"></i> Informations générales</p><div id="modalSiteInfo"></div></div><div class="col-md-7"><p class="text-muted small text-uppercase fw-bold mb-2"><i class="bi bi-exclamation-triangle"></i> KPIs dégradants par technologie</p><div id="modalWorstKpis"></div></div></div><div class="mt-3"><p class="text-muted small text-uppercase fw-bold mb-1"><i class="bi bi-graph-up"></i> Trend KPI Global — 14 jours</p><canvas id="trend5DaysChart" height="110"></canvas></div></div><div class="modal-footer py-2"><button class="btn btn-success btn-sm viewer-restricted" id="shareSiteWhatsApp"><i class="bi bi-whatsapp"></i> Partager WhatsApp</button><button class="btn btn-outline-success btn-sm viewer-restricted" id="exportSiteCsv"><i class="bi bi-file-earmark-excel"></i> Export CSV</button><button class="btn btn-outline-danger btn-sm viewer-restricted" id="exportSitePdf"><i class="bi bi-file-earmark-pdf"></i> Export PDF</button><button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Fermer</button></div></div></div></div>
    <div class="modal fade" id="comparisonModal" tabindex="-1"><div class="modal-dialog modal-xl"><div class="modal-content"><div class="modal-header py-2" style="background:linear-gradient(135deg,#1e3a5f,#00a3c4);color:white"><div><h6 class="modal-title mb-0"><i class="bi bi-graph-up"></i> Comparaison des KPIs par période</h6><small id="comparisonPeriod" class="opacity-75 small"></small></div><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body p-3"><div id="comparisonStatsBar" class="d-flex flex-wrap gap-3 mb-3 p-2 rounded" style="background:#f8f9fa;font-size:0.8rem"></div><canvas id="comparisonChart" height="140"></canvas><div class="mt-2" id="comparisonLessons"></div></div></div></div></div>
    <div id="logoutConfirmModal" class="logout-confirm-modal"><div class="logout-confirm-card"><i class="bi bi-box-arrow-right"></i><h3>Déconnexion</h3><p>Êtes-vous sûr de vouloir vous déconnecter ?</p><div class="logout-confirm-buttons"><button class="btn-cancel-logout" id="cancelLogoutBtn"><i class="bi bi-x-lg"></i> Annuler</button><button class="btn-confirm-logout" id="confirmLogoutBtn"><i class="bi bi-check-lg"></i> Déconnecter</button></div></div></div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="js/api.js?v=<?= $apiJsVersion ?>"></script>
    <script src="js/logout.js?v=2"></script>
    <script src="js/app.js?v=2"></script>
    <script src="js/charts.js?v=2"></script>
    <script src="js/kpis-ran.js?v=<?= $kpisRanJsVersion ?>"></script>
</body>
</html>
