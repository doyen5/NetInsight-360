<?php
// Inclure le helper d'authentification
require_once __DIR__ . '/../netinsight360-backend/app/helpers/AuthHelper.php';

// Vérifier que l'utilisateur est connecté
AuthHelper::requireLogin();

// Récupérer les infos utilisateur
$user = AuthHelper::getUser();
$userRole = AuthHelper::getUserRole();

$mapViewCssVersion = @filemtime(__DIR__ . '/css/map-view.css') ?: time();
$apiJsVersion = @filemtime(__DIR__ . '/js/api.js') ?: time();
$mapViewJsVersion = @filemtime(__DIR__ . '/js/map-view.js') ?: time();
?>

<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>NetInsight 360 - Cartographie</title>
    <link rel="icon" type="image/png" href="assets/img/logo.PNG">
    
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-9ndCyUaIbzAi2FUVXJi0CjmCapSmO7SnpJef0486qhLnuZ2cdeRhO02iuK6FUUVM" crossorigin="anonymous">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" integrity="sha384-XGjxtQfXaH2tnPFa9x+ruJTuLE3Aa6LhHSWRr1XeTyhezb4abCG4ccI5AkVDxqC+" crossorigin="anonymous">
    <!-- Leaflet CSS -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H" crossorigin="anonymous" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css" integrity="sha384-lPzjPsFQL6te2x+VxmV6q1DpRxpRk0tmnl2cpwAO5y04ESyc752tnEWPKDfl1olr" crossorigin="anonymous" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css" integrity="sha384-5kMSQJ6S4Qj5i09mtMNrWpSi8iXw230pKU76xTmrpezGnNJQzj0NzXjQLLg+jE7k" crossorigin="anonymous" />
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js" integrity="sha384-e6nUZLBkQ86NJ6TVVKAeSaK8jWa3NhkYWZFomE39AvDbQWeie9PlQqM3pmYW5d1g" crossorigin="anonymous"></script>
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/dashboard.css">
    <link rel="stylesheet" href="css/map-view.css?v=<?= $mapViewCssVersion ?>">
    
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
            <a href="kpis-ran.php" class="nav-link"><i class="bi bi-wifi"></i> KPIs RAN</a>
            <a href="kpis-core.php" class="nav-link"><i class="bi bi-hdd-stack"></i> KPIs CORE</a>
            <a href="map-view.php" class="nav-link active"><i class="bi bi-map"></i> Cartographie</a>
            <!--<a href="users-management.php" class="nav-link" data-section="users-management" id="navUsersManagement">
                <i class="bi bi-people"></i> Gestion Users
            </a>-->
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
            <h2><i class="bi bi-map-fill"></i> Cartographie Réseau</h2>
            <p class="text-muted">Visualisation géographique de l'ensemble des sites réseau avec filtres avancés</p>
        </div>

        <div class="filter-bar">
            <div class="filter-group"><label><i class="bi bi-flag"></i> Pays</label><select id="filterCountry"><option value="all">Tous les pays</option><option value="CI">🇨🇮 Côte d'Ivoire</option><option value="NE">🇳🇪 Niger</option><option value="BJ">🇧🇯 Bénin</option><option value="TG">🇹🇬 Togo</option></select></div>
            <div class="filter-group"><label><i class="bi bi-building"></i> Vendor</label><select id="filterVendor"><option value="all">Tous</option><option value="Huawei">Huawei</option><option value="Ericsson">Ericsson</option></select></div>
            <div class="filter-group"><label><i class="bi bi-signal"></i> Technologie</label><select id="filterTech"><option value="all">Toutes</option><option value="2G">2G</option><option value="3G">3G</option><option value="4G">4G</option></select></div>
            <div class="filter-group"><label><i class="bi bi-bar-chart"></i> KPI</label><select id="filterKpi" disabled><option value="all">Tous les KPIs</option></select></div>
            <div class="filter-group"><label><i class="bi bi-diagram-3"></i> Domaine</label><select id="filterDomain"><option value="all">Tous</option><option value="RAN">RAN</option><option value="CORE">CORE</option></select></div>
            <div class="filter-group"><label><i class="bi bi-bar-chart"></i> Statut KPI</label><select id="filterStatus"><option value="all">Tous</option><option value="good">✅ Bon (≥95%)</option><option value="warning">⚠️ Alerte (90-95%)</option><option value="critical">🔴 Critique (<90%)</option></select></div>
            <div class="filter-group"><label><i class="bi bi-palette"></i> Couleurs KPI</label><select id="filterScoreMode"><option value="fixed">Seuils fixes</option><option value="dynamic">Seuils dynamiques</option></select></div>
            <!-- Sélecteur du mode d'affichage de la carte (cluster/individuel/heatmap/choroplèthe) -->
            <div class="filter-group"><label><i class="bi bi-layers"></i> Affichage</label><select id="mapDisplayMode" onchange="switchFullDisplayMode(this.value)"><option value="cluster">🔵 Clusters</option><option value="individual">📍 Individuel</option><option value="heatmap">🔥 Heatmap</option></select></div>
            <button class="btn btn-primary btn-sm" id="applyFilters"><i class="bi bi-funnel"></i> Appliquer</button>
            <button class="btn btn-secondary btn-sm" id="resetFilters"><i class="bi bi-arrow-repeat"></i> Réinitialiser</button>
            <button class="btn btn-info btn-sm" id="fitBoundsBtn"><i class="bi bi-arrows-fullscreen"></i> Voir tout</button>
            <div class="search-box"><i class="bi bi-search"></i><input type="text" id="searchSite" placeholder="Rechercher un site..."><button id="searchBtn"><i class="bi bi-arrow-right"></i></button></div>
        </div>

        <div class="map-container">
            <div id="map"></div>
            <div class="map-legend">
                <div class="legend-title"><i class="bi bi-info-circle"></i> Légende</div>
                <div class="legend-item"><span class="legend-color" style="background: #10b981;"></span><span>Bon (KPI ≥ 95%)</span></div>
                <div class="legend-item"><span class="legend-color" style="background: #f59e0b;"></span><span>Alerte (KPI 90-95%)</span></div>
                <div class="legend-item"><span class="legend-color" style="background: #ef4444;"></span><span>Critique (KPI &lt; 90%)</span></div>
                <div class="legend-item"><span class="legend-color" style="background: #00a3c4;"></span><span>Site CORE</span></div>
                <div class="legend-item" id="legendModeHint"><span class="legend-color" style="background: linear-gradient(135deg,#10b981,#ef4444);"></span><span>Mode fixe (seuils métier)</span></div>
                <hr class="my-2">
                <div class="legend-stats" id="legendStats"><div><i class="bi bi-building"></i> Sites: <span id="legendSiteCount">0</span></div><div><i class="bi bi-exclamation-triangle text-danger"></i> Critiques: <span id="legendCriticalCount">0</span></div></div>
            </div>
        </div>

        <div class="row g-3 mt-2 map-kpi-row">
            <div class="col-lg-3 col-md-6"><div class="stat-card compact-card"><h6><i class="bi bi-bar-chart"></i> Répartition par statut</h6><canvas id="statusChart" height="150"></canvas></div></div>
            <div class="col-lg-3 col-md-6"><div class="stat-card compact-card"><h6><i class="bi bi-pie-chart"></i> Répartition par technologie</h6><canvas id="techChart" height="150"></canvas></div></div>
            <div class="col-lg-6 col-md-12"><div class="stat-card compact-card"><h6><i class="bi bi-exclamation-triangle"></i> Pires performances par technologie</h6><div id="worstKpisPanel" class="worst-kpis-panel"></div></div></div>
        </div>

        <div class="row mt-4">
            <div class="col-12"><div class="stat-card"><h6><i class="bi bi-table"></i> Liste des sites (cliquez sur un site pour voir les détails)</h6><div class="table-responsive"><table class="table table-hover" id="sitesTable"><thead><tr><th>Site ID</th><th>Nom</th><th>Pays</th><th>Vendor</th><th>Technologie</th><th>Domaine</th><th>Pire KPI</th><th>Statut</th><th>Actions</th></tr></thead><tbody id="sitesTableBody"><tr><td colspan="9" class="text-center">Chargement des données...</td></tr></tbody></table></div><div class="mt-3" id="paginationControls"></div></div></div>
        </div>

        <div class="row mt-4 viewer-restricted"><div class="col-12"><div class="stat-card"><h6><i class="bi bi-file-text"></i> Rapports Cartographiques</h6><div class="report-buttons"><div class="dropdown-pdf-wrapper"><button class="btn btn-danger" id="exportPdfMapBtn"><i class="bi bi-file-earmark-pdf"></i> Exporter PDF</button><div class="pdf-export-menu" id="pdfExportMenu"><div class="pdf-option" data-period="day"><i class="bi bi-calendar-day"></i> Par jour</div><div class="pdf-option" data-period="week"><i class="bi bi-calendar-week"></i> Par semaine</div><div class="pdf-option" data-period="month"><i class="bi bi-calendar-month"></i> Par mois</div></div></div><button class="btn btn-success" id="exportCsvMapBtn"><i class="bi bi-file-earmark-excel"></i> Exporter CSV</button><button class="btn btn-primary" id="generateReportBtn"><i class="bi bi-graph-up"></i> Générer rapport</button><button class="btn btn-secondary" id="downloadSnapshotBtn"><i class="bi bi-cloud-download"></i> Snapshot</button></div></div></div></div>
    </div>

    <!-- Modals -->
    <div class="modal fade" id="siteDetailsModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content"><div class="modal-header py-2" style="background:linear-gradient(135deg,#1e3a5f,#00a3c4);color:white"><div><h6 class="modal-title mb-0" id="modalSiteTitle">Détails du site</h6><small id="modalSiteSubtitle" class="opacity-75 small"></small></div><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div id="modalStatsBar" class="px-3 py-2 border-bottom d-flex flex-wrap gap-3" style="background:#f8f9fa;font-size:0.8rem"></div><div class="modal-body p-3"><div class="row g-3"><div class="col-md-5"><p class="text-muted small text-uppercase fw-bold mb-2"><i class="bi bi-info-circle"></i> Informations générales</p><div id="modalSiteInfo"></div></div><div class="col-md-7"><p class="text-muted small text-uppercase fw-bold mb-2"><i class="bi bi-exclamation-triangle"></i> KPIs dégradants par technologie</p><div id="modalWorstKpis"></div></div></div><div class="mt-3"><p class="text-muted small text-uppercase fw-bold mb-1"><i class="bi bi-graph-up"></i> Tendance — <span id="trendKpiLabel">KPI dégradant</span> (14 jours)</p><canvas id="trend5DaysChart" height="110"></canvas></div></div><div class="modal-footer py-2"><button class="btn btn-success btn-sm viewer-restricted" id="shareSiteWhatsApp"><i class="bi bi-whatsapp"></i> Partager WhatsApp</button><button class="btn btn-outline-success btn-sm viewer-restricted" id="exportSiteCsv"><i class="bi bi-file-earmark-excel"></i> Export CSV</button><button class="btn btn-outline-danger btn-sm viewer-restricted" id="exportSitePdf"><i class="bi bi-file-earmark-pdf"></i> Export PDF</button><button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Fermer</button></div></div></div></div>
    <div id="logoutConfirmModal" class="logout-confirm-modal"><div class="logout-confirm-card"><i class="bi bi-box-arrow-right"></i><h3>Déconnexion</h3><p>Êtes-vous sûr de vouloir vous déconnecter ?</p><div class="logout-confirm-buttons"><button class="btn-cancel-logout" id="cancelLogoutBtn"><i class="bi bi-x-lg"></i> Annuler</button><button class="btn-confirm-logout" id="confirmLogoutBtn"><i class="bi bi-check-lg"></i> Déconnecter</button></div></div></div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" integrity="sha384-geWF76RCwLtnZ8qwWowPQNguL3RmwHVBC9FhGdlKrxdiJJigb/j/68SIy3Te4Bkz" crossorigin="anonymous"></script>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH" crossorigin="anonymous"></script>
    <script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js" integrity="sha384-RLIyj5q1b5XJTn0tqUhucRZe40nFTocRP91R/NkRJHwAe4XxnTV77FXy/vGLiec2" crossorigin="anonymous"></script>
    <!-- Leaflet.heat — requis pour le mode heatmap -->
    <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js" integrity="sha384-mFKkGiGvT5vo1fEyGCD3hshDdKmW3wzXW/x+fWriYJArD0R3gawT6lMvLboM22c0" crossorigin="anonymous"></script>
    <script src="js/api.js?v=<?= $apiJsVersion ?>"></script>
    <script src="js/logout.js?v=2"></script>
    <script src="js/app.js"></script>
    <script src="js/charts.js?v=2"></script>
    <!-- Utilitaire partagé des 4 modes d'affichage — doit précéder map-view.js -->
    <script src="js/map-modes.js"></script>
    <script src="js/map-view.js?v=<?= $mapViewJsVersion ?>"></script>
</body>
</html>
