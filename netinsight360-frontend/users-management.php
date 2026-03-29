<?php
require_once __DIR__ . '/../netinsight360-backend/app/helpers/AuthHelper.php';
AuthHelper::requireLogin();
$user = AuthHelper::getUser();
$userRole = AuthHelper::getUserRole();
// Rediriger si non admin
if ($userRole !== 'ADMIN') {
    header('Location: dashboard.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>NetInsight 360 - Gestion Utilisateurs</title>
    <link rel="icon" type="image/png" href="assets/img/logo.PNG">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/dashboard.css">
    <style>
        .role-badge { padding: 3px 10px; border-radius: 20px; font-size: 0.78em; font-weight: 600; }
        .role-admin    { background: #fee2e2; color: #dc2626; }
        .role-npm      { background: #e0e7ff; color: #4f46e5; }
        .role-core     { background: #d1fae5; color: #059669; }
        .role-customer { background: #fef3c7; color: #d97706; }
        .status-active   { background: #d1fae5; color: #059669; padding: 2px 8px; border-radius: 20px; font-size: 0.8em; }
        .status-inactive { background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 20px; font-size: 0.8em; }
        .action-btn  { border: none; background: transparent; cursor: pointer; padding: 4px 6px; border-radius: 6px; transition: background .2s; }
        .edit-btn:hover   { background: #e0e7ff; }
        .delete-btn:hover { background: #fee2e2; }
        .activity-item { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
        .activity-icon { width: 36px; height: 36px; border-radius: 50%; background: #e0e7ff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .activity-content .activity-title { font-size: 0.9em; font-weight: 500; }
        .activity-content .activity-time  { font-size: 0.78em; color: #94a3b8; }
        .logout-confirm-modal { position: fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,.5); backdrop-filter:blur(4px); z-index:2000; display:none; align-items:center; justify-content:center; }
        .logout-confirm-modal.show { display:flex; }
        .logout-confirm-card { background:#fff; border-radius:24px; padding:30px; max-width:400px; width:90%; text-align:center; box-shadow:0 25px 50px rgba(0,0,0,.3); }
        .logout-confirm-card i { font-size:4rem; color:#ef4444; margin-bottom:20px; }
        .logout-confirm-card h3 { font-size:1.5rem; margin-bottom:10px; color:#1e293b; }
        .logout-confirm-card p { color:#64748b; margin-bottom:25px; }
        .logout-confirm-buttons { display:flex; gap:15px; justify-content:center; }
        .logout-confirm-buttons button { padding:10px 25px; border-radius:40px; font-weight:600; border:none; cursor:pointer; }
        .btn-confirm-logout { background:#ef4444; color:#fff; }
        .btn-confirm-logout:hover { background:#dc2626; }
        .btn-cancel-logout  { background:#e2e8f0; color:#1e293b; }
        .btn-cancel-logout:hover { background:#cbd5e1; }
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
            <a href="dashboard.php"   class="nav-link"><i class="bi bi-speedometer2"></i> Dashboard</a>
            <a href="kpis-ran.php"    class="nav-link"><i class="bi bi-wifi"></i> KPIs RAN</a>
            <a href="kpis-core.php"   class="nav-link"><i class="bi bi-hdd-stack"></i> KPIs CORE</a>
            <a href="map-view.php"    class="nav-link"><i class="bi bi-map"></i> Cartographie</a>
            <a href="users-management.php" class="nav-link active"><i class="bi bi-people"></i> Gestion Users</a>
            <a href="alerts.php"      class="nav-link"><i class="bi bi-bell"></i> Alertes</a>
        </nav>
    </div>

    <div class="main-content">
        <div class="header-bar">
            <div class="welcome-message"><i class="bi bi-person-circle"></i> Bienvenue, <span id="userName">Chargement...</span> ðŸ‘‹</div>
            <div class="header-right">
                <div class="date-time" id="currentDateTime"><i class="bi bi-calendar3"></i> <span>Chargement...</span></div>
                <div class="user-info-header">
                    <div class="user-avatar" id="userAvatar">PD</div>
                    <div class="user-details">
                        <div class="user-name" id="headerUserName">Chargement...</div>
                        <div class="user-role" id="headerUserRole">Chargement...</div>
                    </div>
                </div>
                <button class="logout-btn-header" id="logoutBtn"><i class="bi bi-box-arrow-right"></i> DÃ©connexion</button>
            </div>
        </div>

        <div class="page-header mb-4">
            <h2><i class="bi bi-people-fill"></i> Gestion des Utilisateurs</h2>
            <p class="text-muted">Administration des comptes, rÃ´les et permissions</p>
        </div>

        <!-- KPI Cards -->
        <div class="row g-4 mb-4">
            <div class="col-md-3"><div class="stat-card"><div class="d-flex justify-content-between align-items-center"><div><span class="text-muted">Total utilisateurs</span><div class="kpi-value" id="totalUsers">0</div></div><i class="bi bi-people-fill fs-2 text-primary"></i></div></div></div>
            <div class="col-md-3"><div class="stat-card"><div class="d-flex justify-content-between align-items-center"><div><span class="text-muted">Administrateurs</span><div class="kpi-value text-danger" id="adminCount">0</div></div><i class="bi bi-shield-fill fs-2 text-danger"></i></div></div></div>
            <div class="col-md-3"><div class="stat-card"><div class="d-flex justify-content-between align-items-center"><div><span class="text-muted">Agents Superviseurs</span><div class="kpi-value text-primary" id="npmCount">0</div></div><i class="bi bi-person-badge-fill fs-2 text-primary"></i></div></div></div>
            <div class="col-md-3"><div class="stat-card"><div class="d-flex justify-content-between align-items-center"><div><span class="text-muted">Agents Visualiseurs</span><div class="kpi-value text-warning" id="customerCount">0</div></div><i class="bi bi-eye-fill fs-2 text-warning"></i></div></div></div>
        </div>

        <!-- Filtres + bouton Ajouter -->
        <div class="filter-bar mb-4">
            <div class="d-flex gap-3 flex-wrap align-items-center">
                <div class="filter-group"><label><i class="bi bi-person-gear"></i> RÃ´le</label>
                    <select id="filterRole">
                        <option value="all">Tous les rÃ´les</option>
                        <option value="ADMIN">Administrateur</option>
                        <option value="FO_ANALYSTE">Agent Analyste</option>
                        <option value="CUSTOMER">Agent Visualiseur</option>
                    </select>
                </div>
                <div class="search-box"><i class="bi bi-search"></i>
                    <input type="text" id="searchUser" placeholder="Rechercher par nom, email...">
                    <button id="searchBtn"><i class="bi bi-arrow-right"></i></button>
                </div>
                <button class="btn btn-outline-secondary" id="resetFiltersBtn"><i class="bi bi-arrow-repeat"></i> RÃ©initialiser</button>
                <button class="btn btn-success ms-auto" id="addUserBtn" data-bs-toggle="modal" data-bs-target="#addUserModal">
                    <i class="bi bi-person-plus-fill"></i> Ajouter un utilisateur
                </button>
                <button class="btn btn-outline-primary" id="exportUsersBtn"><i class="bi bi-download"></i> Exporter</button>
            </div>
        </div>

        <!-- Tableau utilisateurs -->
        <div class="stat-card mb-4">
            <h6 class="mb-3"><i class="bi bi-table"></i> Liste des utilisateurs</h6>
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead class="table-light">
                        <tr><th>#</th><th>Nom</th><th>Email</th><th>RÃ´le</th><th>CrÃ©Ã© le</th><th>DerniÃ¨re connexion</th><th>Statut</th><th>Actions</th></tr>
                    </thead>
                    <tbody id="usersTableBody"><tr><td colspan="8" class="text-center">Chargement...</td></tr></tbody>
                </table>
            </div>
            <div class="mt-3" id="paginationControls"></div>
        </div>

        <!-- Graphiques -->
        <div class="row g-4 mb-4">
            <div class="col-md-6"><div class="stat-card"><h6><i class="bi bi-pie-chart"></i> RÃ©partition par rÃ´le</h6><canvas id="roleChart" height="250"></canvas></div></div>
            <div class="col-md-6"><div class="stat-card"><h6><i class="bi bi-graph-up"></i> Ã‰volution des inscriptions</h6><canvas id="evolutionChart" height="250"></canvas></div></div>
        </div>

        <!-- ActivitÃ© rÃ©cente -->
        <div class="row g-4">
            <div class="col-md-12"><div class="stat-card"><h6><i class="bi bi-clock-history"></i> ActivitÃ© rÃ©cente</h6><div id="recentActivityList"><p class="text-center text-muted">Chargement...</p></div></div></div>
        </div>
    </div>

    <!-- Modal Ajouter/Modifier utilisateur -->
    <div class="modal fade" id="addUserModal" tabindex="-1">
        <div class="modal-dialog"><div class="modal-content">
            <div class="modal-header bg-primary text-white">
                <h5 class="modal-title" id="userModalTitle">Ajouter un utilisateur</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <form id="userForm">
                    <input type="hidden" id="userId">
                    <div class="mb-3"><label class="form-label">Nom complet *</label><input type="text" class="form-control" id="userName" required></div>
                    <div class="mb-3"><label class="form-label">Adresse email *</label><input type="email" class="form-control" id="userEmail" required></div>
                    <div class="mb-3"><label class="form-label">RÃ´le *</label>
                        <select class="form-control" id="userRole">
                            <option value="ADMIN">Administrateur</option>
                            <option value="FO_ANALYSTE">Agent Analyste</option>
                            <option value="CUSTOMER">Agent Visualiseur</option>
                        </select>
                    </div>
                    <div class="mb-3"><label class="form-label">Statut</label>
                        <select class="form-control" id="userStatus">
                            <option value="active">Actif</option>
                            <option value="inactive">Inactif</option>
                        </select>
                    </div>
                    <div class="mb-3"><label class="form-label">Mot de passe <small class="text-muted">(laisser vide pour ne pas changer)</small></label><input type="password" class="form-control" id="userPassword" autocomplete="new-password"></div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
                <button type="button" class="btn btn-primary" id="saveUserBtn"><i class="bi bi-save"></i> Enregistrer</button>
            </div>
        </div></div>
    </div>

    <!-- Modal confirmation suppression -->
    <div class="modal fade" id="deleteConfirmModal" tabindex="-1">
        <div class="modal-dialog modal-sm"><div class="modal-content">
            <div class="modal-header bg-danger text-white">
                <h5 class="modal-title">Supprimer l'utilisateur</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-center">
                <i class="bi bi-exclamation-triangle-fill text-danger fs-1"></i>
                <p class="mt-2">Supprimer <strong id="deleteUserName"></strong> ?<br><small class="text-muted">Cette action est irrÃ©versible.</small></p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annuler</button>
                <button type="button" class="btn btn-danger" id="confirmDeleteBtn"><i class="bi bi-trash3"></i> Supprimer</button>
            </div>
        </div></div>
    </div>

    <div id="logoutConfirmModal" class="logout-confirm-modal">
        <div class="logout-confirm-card">
            <i class="bi bi-box-arrow-right"></i><h3>DÃ©connexion</h3>
            <p>ÃŠtes-vous sÃ»r de vouloir vous dÃ©connecter ?</p>
            <div class="logout-confirm-buttons">
                <button class="btn-cancel-logout" id="cancelLogoutBtn"><i class="bi bi-x-lg"></i> Annuler</button>
                <button class="btn-confirm-logout" id="confirmLogoutBtn"><i class="bi bi-check-lg"></i> DÃ©connecter</button>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="js/api.js"></script>
    <script src="js/logout.js?v=2"></script>
    <script src="js/app.js"></script>
    <script src="js/users-management.js"></script>
</body>
</html>