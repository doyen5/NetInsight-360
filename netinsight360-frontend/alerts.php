<?php
// Inclure le helper d'authentification
require_once __DIR__ . '/../netinsight360-backend/app/helpers/AuthHelper.php';

// Vérifier que l'utilisateur est connecté
AuthHelper::requireLogin();

// Récupérer les infos utilisateur
$user = AuthHelper::getUser();
$userRole = AuthHelper::getUserRole();

// Les CUSTOMER n'ont pas accès aux alertes
if ($userRole === 'CUSTOMER') {
    header('Location: dashboard.php');
    exit;
}
?>

<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>NetInsight 360 - Centre d'Alertes</title>
    <link rel="icon" type="image/png" href="assets/img/logo.PNG">
    
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/dashboard.css">
    <link rel="stylesheet" href="css/alerts.css">
    
    <style>
        /* Styles pour le modal de déconnexion */
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
        
        .logout-confirm-modal.show {
            display: flex;
        }
        
        .logout-confirm-card {
            background: white;
            border-radius: 24px;
            padding: 30px;
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: 0 25px 50px rgba(0,0,0,0.3);
        }
        
        .logout-confirm-card i {
            font-size: 4rem;
            color: #ef4444;
            margin-bottom: 20px;
        }
        
        .logout-confirm-card h3 {
            font-size: 1.5rem;
            margin-bottom: 10px;
            color: #1e293b;
        }
        
        .logout-confirm-card p {
            color: #64748b;
            margin-bottom: 25px;
        }
        
        .logout-confirm-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
        }
        
        .logout-confirm-buttons button {
            padding: 10px 25px;
            border-radius: 40px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn-confirm-logout {
            background: #ef4444;
            color: white;
        }
        
        .btn-confirm-logout:hover {
            background: #dc2626;
        }
        
        .btn-cancel-logout {
            background: #e2e8f0;
            color: #1e293b;
        }
        
        .btn-cancel-logout:hover {
            background: #cbd5e1;
        }
        
        /* Animation pour le modal */
        @keyframes modalFadeIn {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }
        
        .logout-confirm-card {
            animation: modalFadeIn 0.2s ease-out;
        }
    </style>
</head>
<body>
    <!-- Menu Toggle pour mobile -->
    <button class="menu-toggle" id="menuToggle">
        <i class="bi bi-list"></i>
    </button>

    <!-- Sidebar -->
    <div class="sidebar" id="sidebar">
        <div class="logo-area">
            <h3><i class="bi bi-eye-fill"></i> NetInsight 360</h3>
            <p>Supervisez. Analysez. Optimisez.</p>
        </div>
        <nav class="nav flex-column">
            <a href="dashboard.php" class="nav-link" data-section="dashboard">
                <i class="bi bi-speedometer2"></i> Dashboard
            </a>
            <a href="kpis-ran.php" class="nav-link" data-section="kpi-ran">
                <i class="bi bi-wifi"></i> KPIs RAN
            </a>
            <a href="kpis-core.php" class="nav-link" data-section="kpi-core">
                <i class="bi bi-hdd-stack"></i> KPIs CORE
            </a>
            <a href="map-view.php" class="nav-link" data-section="map-view">
                <i class="bi bi-map"></i> Cartographie
            </a>
            <!--<a href="users-management.php" class="nav-link" data-section="users-management" id="navUsersManagement">
                <i class="bi bi-people"></i> Gestion Users
            </a>-->
            <a href="users-management.php" class="nav-link admin-only" data-section="users-management">
                <i class="bi bi-people"></i> Gestion Users
            </a>
            <a href="alerts.php" class="nav-link active viewer-restricted" data-section="alerts">
                <i class="bi bi-bell"></i> Alertes
            </a>
            <a href="admin-tools.php" class="nav-link admin-only"><i class="bi bi-tools"></i> Outils Admin</a>
        </nav>
    </div>

    <!-- Main Content -->
    <div class="main-content">
        <!-- Header -->
        <div class="header-bar">
            <div class="welcome-message">
                <i class="bi bi-person-circle"></i> Bienvenue, <span id="userName">Chargement...</span> 👋
            </div>
            <div class="header-right">
                <div class="date-time" id="currentDateTime">
                    <i class="bi bi-calendar3"></i> <span>Chargement...</span>
                </div>
                <div class="user-info-header">
                    <div class="user-avatar" id="userAvatar">PD</div>
                    <div class="user-details">
                        <div class="user-name" id="headerUserName">Chargement...</div>
                        <div class="user-role" id="headerUserRole">Chargement...</div>
                    </div>
                </div>
                <button class="logout-btn-header" id="logoutBtn">
                    <i class="bi bi-box-arrow-right"></i> Déconnexion
                </button>
            </div>
        </div>

        <!-- Page Title -->
        <div class="page-header mb-4">
            <h2><i class="bi bi-bell-fill"></i> Centre d'Alertes</h2>
            <p class="text-muted">Supervision en temps réel des incidents et anomalies réseau</p>
        </div>

        <!-- Cartes Statistiques -->
        <div class="row g-4 mb-4">
            <div class="col-md-3">
                <div class="stat-card alert-stat-card">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="text-muted">Alertes actives</span>
                            <div class="kpi-value text-danger" id="activeAlertsCount">0</div>
                            <small>À traiter immédiatement</small>
                        </div>
                        <div><i class="bi bi-bell-fill fs-2 text-danger"></i></div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card alert-stat-card">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="text-muted">Critiques</span>
                            <div class="kpi-value text-danger" id="criticalAlertsCount">0</div>
                            <small>Urgence absolue</small>
                        </div>
                        <div><i class="bi bi-exclamation-triangle-fill fs-2 text-danger"></i></div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card alert-stat-card">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="text-muted">Avertissements</span>
                            <div class="kpi-value text-warning" id="warningAlertsCount">0</div>
                            <small>À surveiller</small>
                        </div>
                        <div><i class="bi bi-shield-exclamation fs-2 text-warning"></i></div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card alert-stat-card">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="text-muted">Résolues (24h)</span>
                            <div class="kpi-value text-success" id="resolvedTodayCount">0</div>
                            <small>Problèmes corrigés</small>
                        </div>
                        <div><i class="bi bi-check-circle-fill fs-2 text-success"></i></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Filtres et Actions -->
        <div class="filter-bar">
            <div class="d-flex gap-3 flex-wrap align-items-center">
                <div class="filter-group">
                    <label><i class="bi bi-funnel"></i> Type</label>
                    <select id="filterType">
                        <option value="all">Toutes les alertes</option>
                        <option value="critical">Critiques</option>
                        <option value="warning">Avertissements</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label><i class="bi bi-flag"></i> Pays</label>
                    <select id="filterCountry">
                        <option value="all">Tous les pays</option>
                        <option value="CI">🇨🇮 Côte d'Ivoire</option>
                        <option value="NE">🇳🇪 Niger</option>
                        <option value="BJ">🇧🇯 Bénin</option>
                        <option value="TG">🇹🇬 Togo</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label><i class="bi bi-diagram-3"></i> Domaine</label>
                    <select id="filterDomain">
                        <option value="all">Tous</option>
                        <option value="RAN">RAN</option>
                        <option value="CORE">CORE</option>
                    </select>
                </div>
                <div class="search-box">
                    <i class="bi bi-search"></i>
                    <input type="text" id="searchAlert" placeholder="Rechercher par site, KPI...">
                    <button id="searchBtn"><i class="bi bi-arrow-right"></i></button>
                </div>
                <button class="btn btn-outline-secondary" id="resetFiltersBtn">
                    <i class="bi bi-arrow-repeat"></i> Réinitialiser
                </button>
                <button class="btn btn-success" id="exportAlertsBtn">
                    <i class="bi bi-download"></i> Exporter
                </button>
            </div>
        </div>

        <!-- Liste des alertes -->
        <div class="stat-card">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h6><i class="bi bi-list-ul"></i> Alertes en cours</h6>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-danger" id="resolveAllBtn" title="Tout résoudre">
                        <i class="bi bi-check2-all"></i> Tout résoudre
                    </button>
                </div>
            </div>
            <div id="alertsList" class="alerts-container"></div>
            <div class="mt-3" id="paginationControls"></div>
        </div>

        <!-- Graphiques d'analyse -->
        <div class="row g-4 mt-2">
            <div class="col-md-6">
                <div class="stat-card">
                    <h6><i class="bi bi-pie-chart"></i> Répartition par type d'alerte</h6>
                    <canvas id="alertTypeChart" height="250"></canvas>
                </div>
            </div>
            <div class="col-md-6">
                <div class="stat-card">
                    <h6><i class="bi bi-bar-chart"></i> Top pays impactés</h6>
                    <canvas id="topCountriesChart" height="250"></canvas>
                </div>
            </div>
            <div class="col-md-12">
                <div class="stat-card">
                    <h6><i class="bi bi-graph-up"></i> Évolution des alertes (7 derniers jours)</h6>
                    <canvas id="evolutionChart" height="200"></canvas>
                </div>
            </div>
        </div>

        <!-- Statistiques complémentaires -->
        <div class="row g-4 mt-2">
            <div class="col-md-4">
                <div class="stat-card">
                    <h6><i class="bi bi-building"></i> Top sites problématiques</h6>
                    <div id="topSitesList" class="top-sites-list"></div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="stat-card">
                    <h6><i class="bi bi-diagram-3"></i> Répartition par domaine</h6>
                    <canvas id="domainChart" height="200"></canvas>
                </div>
            </div>
            <div class="col-md-4">
                <div class="stat-card">
                    <h6><i class="bi bi-hourglass-split"></i> Temps moyen de résolution</h6>
                    <div class="text-center">
                        <div class="display-4 fw-bold text-primary" id="avgResolutionTime">0</div>
                        <span class="text-muted">heures</span>
                        <div class="mt-2 small text-muted">Basé sur les 10 dernières résolutions</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- MODAL: Détails alerte -->
    <div class="modal fade" id="alertDetailsModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header" id="alertModalHeader">
                    <h5 class="modal-title" id="alertModalTitle">Détails de l'alerte</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div id="alertDetailsContent"></div>
                    <div class="mt-3">
                        <label for="alertActionComment" class="form-label fw-semibold">Commentaire opérateur (optionnel)</label>
                        <textarea id="alertActionComment" class="form-control" rows="2" placeholder="Ex: escalade vers N2, attente intervention terrain..."></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline-primary" id="acknowledgeAlertBtn">
                        <i class="bi bi-person-check"></i> Prendre en charge
                    </button>
                    <button type="button" class="btn btn-outline-warning" id="escalateAlertBtn">
                        <i class="bi bi-arrow-up-circle"></i> Escalader
                    </button>
                    <button type="button" class="btn btn-success" id="resolveAlertBtn">
                        <i class="bi bi-check-circle"></i> Marquer comme résolue
                    </button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
                </div>
            </div>
        </div>
    </div>

    <!-- MODAL: Confirmation déconnexion -->
    <div id="logoutConfirmModal" class="logout-confirm-modal">
        <div class="logout-confirm-card">
            <i class="bi bi-box-arrow-right"></i>
            <h3>Déconnexion</h3>
            <p>Êtes-vous sûr de vouloir vous déconnecter ?</p>
            <div class="logout-confirm-buttons">
                <button class="btn-cancel-logout" id="cancelLogoutBtn">
                    <i class="bi bi-x-lg"></i> Annuler
                </button>
                <button class="btn-confirm-logout" id="confirmLogoutBtn">
                    <i class="bi bi-check-lg"></i> Déconnecter
                </button>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="js/api.js"></script>
    <script src="js/logout.js?v=2"></script>
    <script src="js/app.js"></script>
    <script src="js/charts.js"></script>
    <script src="js/alerts.js"></script>
</body>
</html>
