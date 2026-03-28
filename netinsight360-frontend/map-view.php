<?php
// Inclure le helper d'authentification
require_once __DIR__ . '/../netinsight360-backend/app/helpers/AuthHelper.php';

// Vérifier que l'utilisateur est connecté
AuthHelper::requireLogin();

// Récupérer les infos utilisateur
$user = AuthHelper::getUser();
$userRole = AuthHelper::getUserRole();
?>

<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>NetInsight 360 - Cartographie</title>
    
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <!-- Leaflet CSS -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css" />
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/dashboard.css">
    <link rel="stylesheet" href="css/map-view.css">
    
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
            <a href="alerts.php" class="nav-link"><i class="bi bi-bell"></i> Alertes</a>
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
            <div class="filter-group"><label><i class="bi bi-diagram-3"></i> Domaine</label><select id="filterDomain"><option value="all">Tous</option><option value="RAN">RAN</option><option value="CORE">CORE</option></select></div>
            <div class="filter-group"><label><i class="bi bi-bar-chart"></i> Statut KPI</label><select id="filterStatus"><option value="all">Tous</option><option value="good">✅ Bon (≥95%)</option><option value="warning">⚠️ Alerte (90-95%)</option><option value="critical">🔴 Critique (<90%)</option></select></div>
            <button class="btn btn-primary btn-sm" id="applyFilters"><i class="bi bi-funnel"></i> Appliquer</button>
            <button class="btn btn-secondary btn-sm" id="resetFilters"><i class="bi bi-arrow-repeat"></i> Réinitialiser</button>
            <button class="btn btn-info btn-sm" id="fitBoundsBtn"><i class="bi bi-arrows-fullscreen"></i> Voir tout</button>
        </div>

        <div class="map-container">
            <div id="map"></div>
            <div class="map-legend">
                <div class="legend-title"><i class="bi bi-info-circle"></i> Légende</div>
                <div class="legend-item"><span class="legend-color" style="background: #10b981;"></span><span>Bon (KPI ≥ 95%)</span></div>
                <div class="legend-item"><span class="legend-color" style="background: #f59e0b;"></span><span>Alerte (KPI 90-95%)</span></div>
                <div class="legend-item"><span class="legend-color" style="background: #ef4444;"></span><span>Critique (KPI &lt; 90%)</span></div>
                <div class="legend-item"><span class="legend-color" style="background: #00a3c4;"></span><span>Site CORE</span></div>
                <hr class="my-2">
                <div class="legend-stats" id="legendStats"><div><i class="bi bi-building"></i> Sites: <span id="legendSiteCount">0</span></div><div><i class="bi bi-exclamation-triangle text-danger"></i> Critiques: <span id="legendCriticalCount">0</span></div></div>
            </div>
        </div>

        <div class="row g-4 mt-2">
            <div class="col-md-4"><div class="stat-card"><h6><i class="bi bi-bar-chart"></i> Répartition par statut</h6><canvas id="statusChart" height="200"></canvas></div></div>
            <div class="col-md-4"><div class="stat-card"><h6><i class="bi bi-pie-chart"></i> Répartition par technologie</h6><canvas id="techChart" height="200"></canvas></div></div>
            <div class="col-md-4"><div class="stat-card"><h6><i class="bi bi-building"></i> Top 5 sites par pays</h6><div id="topCountriesList" class="top-countries-list"></div></div></div>
        </div>

        <div class="row mt-4">
            <div class="col-12"><div class="stat-card"><h6><i class="bi bi-table"></i> Liste des sites (cliquez sur un site pour voir les détails)</h6><div class="table-responsive"><table class="table table-hover" id="sitesTable"><thead><tr><th>Site ID</th><th>Nom</th><th>Pays</th><th>Vendor</th><th>Technologie</th><th>Domaine</th><th>KPI Global</th><th>Statut</th><th>Actions</th></tr></thead><tbody id="sitesTableBody"><tr><td colspan="9" class="text-center">Chargement des données...</td></tr></tbody></table></div><div class="mt-3" id="paginationControls"></div></div></div>
        </div>

        <div class="row mt-4"><div class="col-12"><div class="stat-card"><h6><i class="bi bi-file-text"></i> Rapports Cartographiques</h6><div class="report-buttons"><button class="btn btn-whatsapp" id="shareMapBtn"><i class="bi bi-whatsapp"></i> Partager la carte</button><button class="btn btn-powerpoint" id="exportMapBtn"><i class="bi bi-file-ppt"></i> Exporter rapport</button><button class="btn btn-danger" id="exportPdfMapBtn"><i class="bi bi-file-earmark-pdf"></i> Exporter PDF</button><button class="btn btn-info" id="printMapBtn"><i class="bi bi-printer"></i> Imprimer la carte</button></div></div></div></div>
    </div>

    <!-- Modals -->
    <div class="modal fade" id="siteDetailsModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content"><div class="modal-header bg-primary text-white"><h5 class="modal-title" id="modalSiteTitle">Détails du site</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body"><div class="row"><div class="col-md-6"><h6><i class="bi bi-info-circle"></i> Informations générales</h6><div id="modalSiteInfo" class="p-3 bg-light rounded"></div></div><div class="col-md-6"><h6><i class="bi bi-bar-chart"></i> Performances</h6><div id="modalSitePerformance" class="p-3 bg-light rounded"></div></div></div><div class="row mt-3"><div class="col-12"><h6><i class="bi bi-geo-alt"></i> Localisation</h6><div id="modalSiteLocation" class="p-3 bg-light rounded"></div></div></div></div><div class="modal-footer"><button class="btn btn-success" id="shareSiteBtn"><i class="bi bi-whatsapp"></i> Partager</button><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button></div></div></div></div>
    <div id="logoutConfirmModal" class="logout-confirm-modal"><div class="logout-confirm-card"><i class="bi bi-box-arrow-right"></i><h3>Déconnexion</h3><p>Êtes-vous sûr de vouloir vous déconnecter ?</p><div class="logout-confirm-buttons"><button class="btn-cancel-logout" id="cancelLogoutBtn"><i class="bi bi-x-lg"></i> Annuler</button><button class="btn-confirm-logout" id="confirmLogoutBtn"><i class="bi bi-check-lg"></i> Déconnecter</button></div></div></div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"></script>
    <script src="js/api.js"></script>
    <script src="js/logout.js?v=2"></script>
    <script src="js/app.js"></script>
    <script src="js/map-view.js"></script>
</body>
</html>
