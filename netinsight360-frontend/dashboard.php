<?php
// Inclure le helper d'authentification
require_once __DIR__ . '/../netinsight360-backend/app/helpers/AuthHelper.php';

// Vérifier que l'utilisateur est connecté
AuthHelper::requireLogin();

// Récupérer les infos utilisateur
$user = AuthHelper::getUser();
$userRole = AuthHelper::getUserRole();

$dashboardCssVersion = @filemtime(__DIR__ . '/css/dashboard.css') ?: time();
$apiJsVersion = @filemtime(__DIR__ . '/js/api.js') ?: time();
$dashboardJsVersion = @filemtime(__DIR__ . '/js/dashboard.js') ?: time();
$kpiColClass = ($userRole === 'ADMIN') ? 'col-md-3 col-sm-6' : 'col-md-4 col-sm-6';
?>

<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>NetInsight 360 - Dashboard</title>
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
    <link rel="stylesheet" href="css/dashboard.css?v=<?= $dashboardCssVersion ?>">
</head>
<body>
    <button class="menu-toggle" id="menuToggle"><i class="bi bi-list"></i></button>

    <div class="sidebar" id="sidebar">
        <div class="logo-area">
            <h3><i class="bi bi-eye-fill"></i> NetInsight 360</h3>
            <p>Supervisez. Analysez. Optimisez.</p>
        </div>
        <nav class="nav flex-column">
            <a href="dashboard.php" class="nav-link active"><i class="bi bi-speedometer2"></i> Dashboard</a>
            <a href="kpis-ran.php" class="nav-link"><i class="bi bi-wifi"></i> KPIs RAN</a>
            <a href="kpis-core.php" class="nav-link"><i class="bi bi-hdd-stack"></i> KPIs CORE</a>
            <a href="map-view.php" class="nav-link"><i class="bi bi-map"></i> Cartographie</a>
            <?php if ($userRole === 'ADMIN'): ?>
                <a href="users-management.php" class="nav-link admin-only" data-section="users-management">
                    <i class="bi bi-people"></i> Gestion Users
                </a>
            <?php endif; ?>
            <a href="alerts.php" class="nav-link viewer-restricted"><i class="bi bi-bell"></i> Alertes</a>
            <?php if ($userRole === 'ADMIN'): ?>
                <a href="admin-tools.php" class="nav-link admin-only"><i class="bi bi-tools"></i> Outils Admin</a>
            <?php endif; ?>
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

        <!-- KPIs Cards -->
        <div class="row g-4 mb-4">
            <?php if ($userRole === 'ADMIN'): ?>
                <div class="col-md-3 col-sm-6 admin-only" id="cardTotalUsers">
                    <div class="stat-card">
                        <div class="d-flex justify-content-between">
                            <div>
                                <span class="text-muted">Total Utilisateurs</span>
                                <div class="kpi-value" id="totalUsers">0</div>
                            </div>
                            <div><i class="bi bi-people-fill fs-2 text-primary"></i></div>
                        </div>
                        <small>Comptes actifs</small>
                    </div>
                </div>
            <?php endif; ?>
            <div class="<?= $kpiColClass ?>">
                <div class="stat-card">
                    <div class="d-flex justify-content-between">
                        <div><span class="text-muted">Sites Supervisés <i class="bi bi-info-circle text-secondary" data-bs-toggle="tooltip" title="Nombre de sites actifs visibles avec les filtres courants."></i></span><div class="kpi-value" id="totalSites">0</div></div>
                        <div><i class="bi bi-building fs-2 text-success"></i></div>
                    </div>
                    <small>RAN + CORE</small>
                </div>
            </div>
            <div class="<?= $kpiColClass ?>">
                <div class="stat-card">
                    <div class="d-flex justify-content-between">
                        <div><span class="text-muted">Disponibilité RAN <i class="bi bi-info-circle text-secondary" data-bs-toggle="tooltip" title="RNA moyen: plus la valeur est haute, meilleure est la qualité perçue du réseau radio."></i></span><div class="kpi-value" id="globalRanAvail">0%</div></div>
                        <div><i class="bi bi-wifi fs-2 text-info"></i></div>
                    </div>
                    <small>Objectif ≥ 99.5%</small>
                </div>
            </div>
            <div class="<?= $kpiColClass ?>">
                <div class="stat-card">
                    <div class="d-flex justify-content-between">
                        <div><span class="text-muted">Packet Loss CORE <i class="bi bi-info-circle text-secondary" data-bs-toggle="tooltip" title="Taux de paquets perdus au coeur réseau: plus la valeur est basse, meilleure est la performance."></i></span><div class="kpi-value" id="globalPacketLoss">0%</div></div>
                        <div><i class="bi bi-hdd-network fs-2 text-warning"></i></div>
                    </div>
                    <small>Seuil critique: > 1%</small>
                </div>
            </div>
        </div>

        <!-- Filtres -->
        <div class="filter-bar">
            <div class="filter-group"><label><i class="bi bi-flag"></i> Pays</label><select id="filterCountry"><option value="all">Tous</option><option value="CI">Côte d'Ivoire</option><option value="NE">Niger</option><option value="TG">Togo</option><option value="BJ">Bénin</option></select></div>
            <div class="filter-group"><label><i class="bi bi-building"></i> Vendor</label><select id="filterVendor"><option value="all">Tous</option><option value="Huawei">Huawei</option><option value="Ericsson">Ericsson</option></select></div>
            <div class="filter-group"><label><i class="bi bi-signal"></i> Technologie</label><select id="filterTech"><option value="all">Toutes</option><option value="2G">2G</option><option value="3G">3G</option><option value="4G">4G</option></select></div>
            <div class="filter-group"><label><i class="bi bi-bar-chart"></i> KPI</label><select id="filterKpi" disabled><option value="all">Tous les KPIs</option></select></div>
            <div class="filter-group"><label><i class="bi bi-diagram-3"></i> Domaine</label><select id="filterDomain"><option value="all">Tous</option><option value="RAN">RAN</option><option value="CORE">CORE</option></select></div>
            <div class="search-box"><i class="bi bi-search"></i><input type="text" id="searchSite" placeholder="Rechercher un site..."><button id="searchBtn"><i class="bi bi-arrow-right"></i></button></div>
            <div class="small text-warning" id="searchNotice" style="display:none" aria-live="polite"></div>
            <!-- Sélecteur du mode d'affichage de la carte (cluster/individuel/heatmap/choroplèthe) -->
            <div class="filter-group"><label><i class="bi bi-layers"></i> Affichage</label><select id="mapDisplayMode" onchange="switchDashDisplayMode(this.value)"><option value="cluster">🔵 Clusters</option><option value="individual">📍 Individuel</option><option value="heatmap">🔥 Heatmap</option></select></div>
            <button class="btn btn-primary btn-sm" id="applyFilters"><i class="bi bi-funnel"></i> Appliquer</button>
            <button class="btn btn-secondary btn-sm" id="resetFilters"><i class="bi bi-arrow-repeat"></i> Réinitialiser</button>
        </div>

        <!-- Carte -->
        <div class="stat-card mb-4"><h6><i class="bi bi-map"></i> Carte des sites réseau</h6><div id="map"></div></div>

        <!-- Top et Pires Sites -->
        <div class="row g-4 mb-4">
            <div class="col-md-6"><div class="stat-card"><h6><i class="bi bi-trophy-fill text-warning"></i> Top 5 Meilleurs Sites</h6><div id="topSitesList"></div></div></div>
            <div class="col-md-6"><div class="stat-card"><h6><i class="bi bi-exclamation-triangle-fill text-danger"></i> Pires 5 Sites</h6><div id="worstSitesList"></div></div></div>
        </div>

        <!-- Graphiques -->
        <div class="row g-4 dashboard-kpi-layout">
            <div class="col-xl-8">
                <div class="row g-3">
                    <div class="col-md-6">
                        <div class="stat-card kpi-trend-card">
                            <h6><i class="bi bi-graph-up"></i> RNA (global RAN) <i class="bi bi-info-circle text-secondary" data-bs-toggle="tooltip" title="Indicateur synthétique de performance RAN multi-tech. La tendance doit rester stable et élevée."></i></h6>
                            <canvas id="ranTrendChart" height="170"></canvas>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="stat-card kpi-trend-card">
                            <h6><i class="bi bi-telephone-x"></i> 2G - TCH Drop Rate <i class="bi bi-info-circle text-secondary" data-bs-toggle="tooltip" title="Taux de coupure d'appel 2G. Objectif: minimiser cette valeur."></i></h6>
                            <canvas id="tchDropTrendChart" height="170"></canvas>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="stat-card kpi-trend-card">
                            <h6><i class="bi bi-broadcast-pin"></i> 3G - CSSR <i class="bi bi-info-circle text-secondary" data-bs-toggle="tooltip" title="Call Setup Success Rate 3G. Plus le pourcentage est haut, meilleure est l'initialisation des sessions."></i></h6>
                            <canvas id="cssrTrendChart" height="170"></canvas>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="stat-card kpi-trend-card">
                            <h6><i class="bi bi-signal"></i> 4G - ERAB Success Rate <i class="bi bi-info-circle text-secondary" data-bs-toggle="tooltip" title="Taux de succès d'établissement des bearers LTE. Plus haut = meilleure expérience data 4G."></i></h6>
                            <canvas id="erabTrendChart" height="170"></canvas>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-xl-4">
                <div class="stat-card packetloss-compact-card">
                    <h6><i class="bi bi-hdd-stack"></i> Packet Loss par pays</h6>
                    <canvas id="packetLossChart" height="150"></canvas>
                </div>
            </div>
        </div>

        <!-- Rapports -->
        <div class="row mt-4 viewer-restricted">
            <div class="col-12">
                <div class="stat-card">
                    <h6><i class="bi bi-file-text"></i> Rapports et Analyses</h6>
                    <div class="report-buttons">
                        <button class="btn btn-whatsapp" id="shareWhatsApp"><i class="bi bi-whatsapp"></i> Partager sur WhatsApp</button>
                        <button class="btn btn-success" id="exportExcel"><i class="bi bi-file-earmark-excel"></i> Exporter Excel</button>
                        <div class="dropdown-pdf-wrapper">
                            <button class="btn btn-danger" id="exportPdf"><i class="bi bi-file-earmark-pdf"></i> Exporter PDF</button>
                            <div class="pdf-export-menu" id="dashboardPdfMenu">
                                <div class="pdf-option" data-period="day"><i class="bi bi-calendar-day"></i> Par jour</div>
                                <div class="pdf-option" data-period="week"><i class="bi bi-calendar-week"></i> Par semaine</div>
                                <div class="pdf-option" data-period="month"><i class="bi bi-calendar-month"></i> Par mois</div>
                            </div>
                        </div>
                        <button class="btn btn-info" id="weeklyComparison"><i class="bi bi-graph-up"></i> Comparaison Hebdomadaire</button>
                    </div>
                    <div class="small mt-2" id="reportActionMsg" aria-live="polite"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- Modals -->
    <div class="modal fade" id="siteDetailsModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content"><div class="modal-header bg-primary text-white"><h5 class="modal-title" id="modalSiteTitle">Détails du site</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body"><div class="row"><div class="col-md-6"><h6><i class="bi bi-info-circle"></i> Informations générales</h6><div id="modalSiteInfo" class="p-3 bg-light rounded"></div></div><div class="col-md-6"><h6><i class="bi bi-bar-chart"></i> Performances</h6><div id="modalSitePerformance" class="p-3 bg-light rounded"></div></div></div><div class="row mt-3"><div class="col-12"><h6><i class="bi bi-geo-alt"></i> Localisation</h6><div id="modalSiteLocation" class="p-3 bg-light rounded"></div></div></div></div><div class="modal-footer"><button class="btn btn-success viewer-restricted" id="shareSiteBtn"><i class="bi bi-whatsapp"></i> Partager</button><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button></div></div></div></div>
    <div class="modal fade" id="comparisonModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content"><div class="modal-header py-2" style="background:linear-gradient(135deg,#1e3a5f,#00a3c4);color:white"><h6 class="modal-title mb-0"><i class="bi bi-graph-up"></i> Comparaison des KPIs par période</h6><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body p-3"><div id="comparisonStatsBar" class="d-flex flex-wrap gap-3 mb-3 p-2 rounded" style="background:#f8f9fa;font-size:0.8rem"></div><canvas id="comparisonChart" height="140"></canvas><div class="mt-2" id="comparisonLessons"></div></div></div></div></div>
    <div id="logoutConfirmModal" class="logout-confirm-modal"><div class="logout-confirm-card"><i class="bi bi-box-arrow-right"></i><h3>Déconnexion</h3><p>Êtes-vous sûr de vouloir vous déconnecter ?</p><div class="logout-confirm-buttons"><button class="btn-cancel-logout" id="cancelLogoutBtn"><i class="bi bi-x-lg"></i> Annuler</button><button class="btn-confirm-logout" id="confirmLogoutBtn"><i class="bi bi-check-lg"></i> Déconnecter</button></div></div></div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <!-- Plugins Leaflet requis pour les modes cluster et heatmap -->
    <script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"></script>
    <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
    <!-- Toast : dernière connexion -->
    <div class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index:9999">
        <div id="lastLoginToast" class="toast align-items-center text-bg-dark border-0" role="alert" aria-live="assertive" data-bs-autohide="true" data-bs-delay="6000">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="bi bi-clock-history me-2"></i>
                    <span id="lastLoginMsg">Dernière connexion : —</span>
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    </div>

    <!-- Ordre correct : utilitaires généraux d'abord, puis les pages -->
    <script src="js/api.js?v=<?= $apiJsVersion ?>"></script>
    <script src="js/logout.js?v=2"></script>
    <script src="js/app.js?v=2"></script>
    <script src="js/charts.js?v=2"></script>
    <!-- Utilitaire partagé des 4 modes d'affichage — doit précéder dashboard.js -->
    <script src="js/map-modes.js"></script>
    <script src="js/dashboard.js?v=<?= $dashboardJsVersion ?>"></script>

</body>
</html>
