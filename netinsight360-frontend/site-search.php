<?php
// Inclure le helper d'authentification
require_once __DIR__ . '/../netinsight360-backend/app/helpers/AuthHelper.php';

// Vérifier que l'utilisateur est connecté et a le bon rôle
AuthHelper::requireLogin();
$user = AuthHelper::getUser();
$userRole = AuthHelper::getUserRole();

// Vérifier les permissions : seulement ADMIN et FO_ANALYSTE
if (!in_array($userRole, ['ADMIN', 'FO_ANALYSTE'])) {
    http_response_code(403);
    die('Accès refusé. Vous devez être Admin ou Analyste pour accéder à cette page.');
}

$siteSearchCssVersion = @filemtime(__DIR__ . '/css/site-search.css') ?: time();
$dashboardCssVersion = @filemtime(__DIR__ . '/css/dashboard.css') ?: time();
$apiJsVersion = @filemtime(__DIR__ . '/js/api.js') ?: time();
$siteSearchJsVersion = @filemtime(__DIR__ . '/js/site-search.js') ?: time();
?>

<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>NetInsight 360 - Recherche Site</title>
    <link rel="icon" type="image/png" href="assets/img/logo.PNG">

    <!-- Bootstrap 5 CSS -->
    <link href="assets/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="assets/css/bootstrap-icons.min.css">
    <!-- Leaflet CSS -->
    <link rel="stylesheet" href="assets/css/leaflet.css" />
    <!-- Chart.js -->
    <script src="assets/js/chart.umd.min.js"></script>
    <!-- Google Fonts -->
    <link href="assets/css/inter.css" rel="stylesheet">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/dashboard.css?v=<?= $dashboardCssVersion ?>">
    <link rel="stylesheet" href="css/site-search.css?v=<?= $siteSearchCssVersion ?>">
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
            <a href="map-view.php" class="nav-link"><i class="bi bi-map"></i> Cartographie</a>
            <a href="site-search.php" class="nav-link active"><i class="bi bi-search"></i> Recherche Site</a>
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

        <div class="row g-4 mb-4">
            <div class="col-12">
                <div class="stat-card">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <h6 class="mb-1"><i class="bi bi-search"></i> Recherche et analyse de site</h6>
                            <p class="text-muted mb-0">Sélectionnez un site, une technologie et un KPI pour afficher la tendance et générer un rapport PDF.</p>
                        </div>
                    </div>
                    <form id="siteSearchForm">
                        <div class="filter-bar">
                            <div class="filter-group flex-column flex-grow-1">
                                <label for="siteSearch"><i class="bi bi-building"></i> Site</label>
                                <div class="position-relative w-100">
                                    <input type="text" class="form-control" id="siteSearch" placeholder="Nom du site, ID ou région..." autocomplete="off" required>
                                    <div id="siteSuggestions" class="suggestions-list"></div>
                                </div>
                            </div>
                            <div class="filter-group flex-column">
                                <label for="technologySelect"><i class="bi bi-signal"></i> Technologie</label>
                                <select class="form-select" id="technologySelect" required>
                                    <option value="">Sélectionner</option>
                                    <option value="2G">2G</option>
                                    <option value="3G">3G</option>
                                    <option value="4G">4G</option>
                                </select>
                            </div>
                            <div class="filter-group flex-column">
                                <label for="kpiSelect"><i class="bi bi-graph-up"></i> KPI</label>
                                <select class="form-select" id="kpiSelect" disabled required>
                                    <option value="">Sélectionner une technologie d'abord</option>
                                </select>
                            </div>
                            <div class="filter-group flex-column">
                                <label for="periodSelect"><i class="bi bi-calendar3"></i> Période</label>
                                <select class="form-select" id="periodSelect" required>
                                    <option value="day">Jour</option>
                                    <option value="week">Semaine</option>
                                    <option value="month">Mois</option>
                                </select>
                            </div>
                            <div class="filter-group flex-column align-items-end">
                                <label class="opacity-0">Action</label>
                                <button type="submit" class="btn btn-primary">Analyser</button>
                            </div>
                        </div>
                    </form>
                    <div id="searchNotice" class="small text-muted mt-2">Sélectionnez un site et une technologie pour charger les KPIs.</div>
                </div>
            </div>
        </div>

            <div id="resultsSection" class="row g-4" style="display: none;">
                <div class="col-xl-4">
                    <div class="stat-card">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="mb-0"><i class="bi bi-info-circle"></i> Informations du site</h6>
                            <button id="exportPdfBtn" class="btn btn-success btn-sm">
                                <i class="bi bi-file-earmark-pdf"></i> Exporter PDF
                            </button>
                        </div>
                        <div id="siteInfo"></div>
                    </div>
                </div>
                <div class="col-xl-8">
                    <div class="stat-card">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="mb-0"><i class="bi bi-bar-chart-line"></i> Tendance KPI</h6>
                            <span id="trendInfo" class="text-muted"></span>
                        </div>
                        <div id="kpiChartContainer"><canvas id="kpiChart"></canvas></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Bootstrap JS -->
    <script src="assets/js/bootstrap.bundle.min.js"></script>
    <!-- Leaflet JS -->
    <script src="assets/js/leaflet.js"></script>
    <!-- Custom JS -->
    <script src="js/api.js?v=<?= $apiJsVersion ?>"></script>
    <script src="js/site-search.js?v=<?= $siteSearchJsVersion ?>"></script>
</body>
</html>
