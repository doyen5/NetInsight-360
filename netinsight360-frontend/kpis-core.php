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
    <title>NetInsight 360 - KPIs CORE</title>
    
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
    <link rel="stylesheet" href="css/kpis-core.css">
    
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
            <a href="kpis-core.php" class="nav-link active"><i class="bi bi-hdd-stack"></i> KPIs CORE</a>
            <a href="map-view.php" class="nav-link"><i class="bi bi-map"></i> Cartographie</a>
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
            <h2><i class="bi bi-hdd-stack"></i> KPIs CORE - Performance du Cœur de Réseau</h2>
            <p class="text-muted">Supervision des indicateurs clés du réseau cœur (Packet Loss, Latence, Jitter, Débit)</p>
        </div>

        <div class="filter-bar">
            <div class="filter-group"><label><i class="bi bi-flag"></i> Pays</label><select id="filterCountry"><option value="all">Tous les pays</option><option value="CI">🇨🇮 Côte d'Ivoire</option><option value="NE">🇳🇪 Niger</option><option value="BJ">🇧🇯 Bénin</option><option value="TG">🇹🇬 Togo</option><option value="CF">🇨🇫 Centrafrique</option></select></div>
            <div class="filter-group"><label><i class="bi bi-building"></i> Vendor</label><select id="filterVendor"><option value="all">Tous</option><option value="Huawei">Huawei</option><option value="Ericsson">Ericsson</option></select></div>
            <button class="btn btn-primary btn-sm" id="applyFilters"><i class="bi bi-funnel"></i> Appliquer</button>
            <button class="btn btn-secondary btn-sm" id="resetFilters"><i class="bi bi-arrow-repeat"></i> Réinitialiser</button>
        </div>

        <div class="row g-4 mb-4">
            <div class="col-md-3"><div class="stat-card"><div><span class="text-muted">Packet Loss Moyen</span><div class="kpi-value" id="avgPacketLoss">0%</div></div><div><i class="bi bi-hdd-network fs-2 text-warning"></i></div><small>Seuil critique: > 1%</small><div class="progress mt-2"><div class="progress-bar bg-warning" id="packetLossProgress" style="width: 0%"></div></div></div></div>
            <div class="col-md-3"><div class="stat-card"><div><span class="text-muted">Latence Moyenne</span><div class="kpi-value" id="avgLatency">0 ms</div></div><div><i class="bi bi-speedometer2 fs-2 text-info"></i></div><small>Objectif: &lt; 100 ms</small><div class="progress mt-2"><div class="progress-bar bg-info" id="latencyProgress" style="width: 0%"></div></div></div></div>
            <div class="col-md-3"><div class="stat-card"><div><span class="text-muted">Jitter Moyen</span><div class="kpi-value" id="avgJitter">0 ms</div></div><div><i class="bi bi-graph-up fs-2 text-primary"></i></div><small>Objectif: &lt; 30 ms</small><div class="progress mt-2"><div class="progress-bar bg-primary" id="jitterProgress" style="width: 0%"></div></div></div></div>
            <div class="col-md-3"><div class="stat-card"><div><span class="text-muted">Débit Core</span><div class="kpi-value" id="avgThroughput">0 Gbps</div></div><div><i class="bi bi-arrow-left-right fs-2 text-success"></i></div><small>Objectif: > 500 Gbps</small><div class="progress mt-2"><div class="progress-bar bg-success" id="throughputProgress" style="width: 0%"></div></div></div></div>
        </div>

        <div class="stat-card mb-4"><h6><i class="bi bi-map"></i> Carte des sites CORE</h6><div id="map" style="height: 450px;"></div></div>

        <div class="row g-4 mb-4">
            <div class="col-md-12"><div class="stat-card"><div class="d-flex justify-content-between align-items-center mb-3"><h6><i class="bi bi-exclamation-triangle-fill text-danger"></i> Pires sites CORE - Analyse Packet Loss</h6><div class="btn-group"><button class="btn btn-sm btn-outline-primary" id="exportWorstSites"><i class="bi bi-download"></i> Exporter CSV</button><button class="btn btn-sm btn-outline-success" id="shareWorstSites"><i class="bi bi-whatsapp"></i> Partager</button></div></div><div class="table-responsive"><table class="table table-hover" id="worstSitesTable"><thead class="table-light"><tr><th>#</th><th>Site ID</th><th>Nom du site</th><th>Pays</th><th>Vendor</th><th>Packet Loss</th><th>Latence</th><th>Jitter</th><th>Débit</th><th>Status</th><th>Actions</th></tr></thead><tbody id="worstSitesList"><tr><td colspan="11" class="text-center">Chargement des données...</td></tr></tbody></table></div><div class="mt-3" id="paginationControls"></div></div></div>
        </div>

        <div class="row g-4">
            <div class="col-md-6"><div class="stat-card"><h6><i class="bi bi-hdd-network"></i> Évolution Packet Loss (5 derniers jours)</h6><canvas id="packetLossTrendChart" height="250"></canvas></div></div>
            <div class="col-md-6"><div class="stat-card"><h6><i class="bi bi-speedometer2"></i> Latence par pays</h6><canvas id="latencyCountryChart" height="250"></canvas></div></div>
            <div class="col-md-12"><div class="stat-card"><h6><i class="bi bi-bar-chart-steps"></i> Comparaison Packet Loss par Vendor</h6><canvas id="vendorPacketLossChart" height="300"></canvas></div></div>
        </div>

        <div class="row g-4 mt-2">
            <div class="col-md-4"><div class="stat-card"><h6><i class="bi bi-pie-chart"></i> Répartition par vendor</h6><canvas id="vendorChart" height="200"></canvas></div></div>
            <div class="col-md-4"><div class="stat-card"><h6><i class="bi bi-flag"></i> Répartition par pays</h6><canvas id="countryChart" height="200"></canvas></div></div>
            <div class="col-md-4"><div class="stat-card"><h6><i class="bi bi-graph-up"></i> Score de santé CORE</h6><canvas id="healthScoreChart" height="200"></canvas></div></div>
        </div>

        <div class="row mt-4"><div class="col-12"><div class="stat-card"><h6><i class="bi bi-file-text"></i> Rapports et Analyses KPIs CORE</h6><div class="report-buttons"><button class="btn btn-whatsapp" id="shareWhatsApp"><i class="bi bi-whatsapp"></i> Partager sur WhatsApp</button><button class="btn btn-powerpoint" id="exportPowerPoint"><i class="bi bi-file-ppt"></i> Exporter Rapport Hebdo</button><button class="btn btn-info" id="weeklyComparison"><i class="bi bi-graph-up"></i> Comparaison Hebdomadaire</button></div></div></div></div>
    </div>

    <!-- Modals -->
    <div class="modal fade" id="siteDetailsModal" tabindex="-1"><div class="modal-dialog modal-xl"><div class="modal-content"><div class="modal-header bg-primary text-white"><h5 class="modal-title" id="modalSiteTitle">Détails du site CORE</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body"><div class="row"><div class="col-md-6"><h6><i class="bi bi-info-circle"></i> Informations générales</h6><div id="modalSiteInfo" class="p-3 bg-light rounded"></div></div><div class="col-md-6"><h6><i class="bi bi-exclamation-triangle"></i> Détails des métriques CORE</h6><div id="modalCoreMetrics" class="p-3 bg-light rounded"></div></div></div><div class="row mt-4"><div class="col-12"><h6><i class="bi bi-graph-up"></i> Évolution Packet Loss (5 jours)</h6><canvas id="trend5DaysChart" height="200"></canvas></div></div></div><div class="modal-footer"><button class="btn btn-success" id="shareSiteWhatsApp"><i class="bi bi-whatsapp"></i> Partager sur WhatsApp</button><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button></div></div></div></div>
    <div class="modal fade" id="comparisonModal" tabindex="-1"><div class="modal-dialog modal-xl"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Comparaison Hebdomadaire des KPIs CORE</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><canvas id="comparisonChart" height="300"></canvas><div class="mt-4" id="comparisonLessons"></div></div></div></div></div>
    <div id="logoutConfirmModal" class="logout-confirm-modal"><div class="logout-confirm-card"><i class="bi bi-box-arrow-right"></i><h3>Déconnexion</h3><p>Êtes-vous sûr de vouloir vous déconnecter ?</p><div class="logout-confirm-buttons"><button class="btn-cancel-logout" id="cancelLogoutBtn"><i class="bi bi-x-lg"></i> Annuler</button><button class="btn-confirm-logout" id="confirmLogoutBtn"><i class="bi bi-check-lg"></i> Déconnecter</button></div></div></div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="js/api.js"></script>
    <script src="js/logout.js?v=2"></script>
    <script src="js/app.js"></script>
    <script src="js/charts.js"></script>
    <script src="js/kpis-core.js"></script>
</body>
</html>
