<?php
require_once __DIR__ . '/../netinsight360-backend/app/helpers/AuthHelper.php';
AuthHelper::requireLogin();
$user     = AuthHelper::getUser();
$userRole = AuthHelper::getUserRole();
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
    <title>NetInsight 360 - Outils Admin</title>
    <link rel="icon" type="image/png" href="assets/img/logo.PNG">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/dashboard.css">
    <style>
        /* Header de page: fond clair pour garantir la lisibilité */
        .page-header {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 20px 25px;
            border-radius: 20px;
            margin-bottom: 25px;
        }
        .page-header h2 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 8px;
        }
        .page-header h2 i {
            color: #00a3c4;
            margin-right: 10px;
        }
        .page-header p {
            color: #64748b !important;
            margin-bottom: 0;
        }

        .log-box { background:#0f172a; color:#94a3b8; font-family:monospace; font-size:0.78rem; padding:14px; border-radius:8px; max-height:320px; overflow-y:auto; white-space:pre-wrap; word-break:break-all; }
        .log-box .log-ok      { color:#10b981; }
        .log-box .log-err     { color:#ef4444; }
        .log-box .log-warn    { color:#f59e0b; }
        .stat-import-card { border-left:4px solid #00a3c4; padding:12px 16px; background:#f8fafc; border-radius:8px; margin-bottom:12px; }
        .stat-import-card .label { font-size:0.78rem; color:#64748b; margin-bottom:2px; }
        .stat-import-card .value { font-size:1.4rem; font-weight:700; color:#1e3a5f; }
        .audit-badge { font-size:0.72rem; padding:2px 8px; border-radius:12px; font-weight:600; }
        .audit-IMPORT_TRIGGERED  { background:#dbeafe; color:#1d4ed8; }
        .audit-CREATE_USER       { background:#d1fae5; color:#059669; }
        .audit-UPDATE_USER       { background:#fef3c7; color:#d97706; }
        .audit-DELETE_USER       { background:#fee2e2; color:#dc2626; }
        .audit-other             { background:#f1f5f9; color:#475569; }
        .running-spinner         { display:none; }
        .running-spinner.show    { display:inline-block; }
        .import-actions { display:flex; flex-wrap:nowrap; gap:6px; overflow-x:hidden; }
        .import-actions .btn {
            white-space: nowrap;
            padding: 0.28rem 0.48rem;
            font-size: 0.84rem;
            line-height: 1.2;
        }
        .import-actions .btn i { margin-right: 0.2rem !important; }
        #runImportBtn {
            padding: 0.26rem 0.44rem;
            font-size: 0.82rem;
        }
        .logout-confirm-modal { position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);z-index:2000;display:none;align-items:center;justify-content:center; }
        .logout-confirm-modal.show { display:flex; }
        .logout-confirm-card { background:#fff;border-radius:24px;padding:30px;max-width:400px;width:90%;text-align:center;box-shadow:0 25px 50px rgba(0,0,0,.3); }
        .logout-confirm-card i { font-size:4rem;color:#ef4444;margin-bottom:20px; }
        .logout-confirm-card h3 { font-size:1.5rem;margin-bottom:10px;color:#1e293b; }
        .logout-confirm-card p { color:#64748b;margin-bottom:25px; }
        .logout-confirm-buttons { display:flex;gap:15px;justify-content:center; }
        .logout-confirm-buttons button { padding:10px 25px;border-radius:40px;font-weight:600;border:none;cursor:pointer; }
        .btn-confirm-logout { background:#ef4444;color:#fff; } .btn-confirm-logout:hover { background:#dc2626; }
        .btn-cancel-logout  { background:#e2e8f0;color:#1e293b; } .btn-cancel-logout:hover { background:#cbd5e1; }
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
            <a href="dashboard.php"        class="nav-link"><i class="bi bi-speedometer2"></i> Dashboard</a>
            <a href="kpis-ran.php"         class="nav-link"><i class="bi bi-wifi"></i> KPIs RAN</a>
            <a href="kpis-core.php"        class="nav-link"><i class="bi bi-hdd-stack"></i> KPIs CORE</a>
            <a href="map-view.php"         class="nav-link"><i class="bi bi-map"></i> Cartographie</a>
            <a href="users-management.php" class="nav-link admin-only"><i class="bi bi-people"></i> Gestion Users</a>
            <a href="alerts.php"           class="nav-link viewer-restricted"><i class="bi bi-bell"></i> Alertes</a>
            <a href="admin-tools.php"      class="nav-link active admin-only"><i class="bi bi-tools"></i> Outils Admin</a>
        </nav>
    </div>

    <div class="main-content">
        <div class="header-bar">
            <div class="welcome-message"><i class="bi bi-person-circle"></i> Bienvenue, <span id="userName">Chargement...</span> 👋</div>
            <div class="header-right">
                <!-- Barre de recherche globale : accessible sur toutes les pages (sites, KPI, pays...) -->
                <div style="position:relative;margin-right:12px;">
                    <input id="globalSearch" class="form-control form-control-sm" placeholder="Recherche (sites, KPI, pays...)" style="width:320px;" autocomplete="off">
                    <div id="globalSearchResults" style="position:absolute;top:36px;left:0;right:0;z-index:1500;background:#fff;border:1px solid #e6eef6;border-radius:6px;display:none;max-height:280px;overflow:auto;"></div>
                </div>
                <div class="date-time" id="currentDateTime"><i class="bi bi-calendar3"></i> <span>Chargement...</span></div>
                <div class="user-info-header">
                    <div class="user-avatar" id="userAvatar">AD</div>
                    <div class="user-details">
                        <div class="user-name" id="headerUserName">Chargement...</div>
                        <div class="user-role" id="headerUserRole">Chargement...</div>
                    </div>
                </div>
                <button class="logout-btn-header" id="logoutBtn"><i class="bi bi-box-arrow-right"></i> Déconnexion</button>
            </div>
        </div>

        <div class="page-header mb-4">
            <h2><i class="bi bi-tools"></i> Outils Administrateur</h2>
            <p class="text-muted">Import des données, audit d'activité et supervision de la base</p>
        </div>

        <!-- ============================================================ -->
        <!-- SECTION 1 : Import RAN                                        -->
        <!-- ============================================================ -->
        <div class="row g-4 mb-4">

            <!-- Statut import -->
            <div class="col-lg-5">
                <div class="stat-card h-100">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h6 class="mb-0"><i class="bi bi-cloud-download"></i> Statut Import RAN</h6>
                        <button class="btn btn-sm btn-outline-secondary" id="refreshStatusBtn" title="Actualiser">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>

                    <div id="importStatusArea">
                        <div class="text-center text-muted py-3"><i class="bi bi-hourglass-split"></i> Chargement...</div>
                    </div>

                    <hr class="my-3">

                    <div class="import-actions align-items-center">
                        <button class="btn btn-primary" id="runImportBtn">
                            <i class="bi bi-play-circle"></i> Lancer l'import maintenant
                        </button>
                        <button class="btn btn-outline-success" id="runImport2GBtn">
                            <i class="bi bi-broadcast"></i> Import 2G
                        </button>
                        <button class="btn btn-outline-warning" id="runImport3GBtn">
                            <i class="bi bi-broadcast-pin"></i> Import 3G
                        </button>
                        <button class="btn btn-outline-info" id="runImport4GBtn">
                            <i class="bi bi-diagram-3"></i> Import 4G
                        </button>
                        <span class="running-spinner" id="importSpinner">
                            <span class="spinner-border spinner-border-sm text-primary me-1"></span>
                            Import en cours...
                        </span>
                    </div>
                    <div class="mt-2" id="importMsg"></div>
                </div>
            </div>

            <!-- Log dernière exécution -->
            <div class="col-lg-7">
                <div class="stat-card h-100">
                    <h6 class="mb-3"><i class="bi bi-terminal"></i> Log dernière exécution</h6>
                    <div class="log-box" id="importLogBox">Aucun log disponible.</div>

                    <div class="mt-3">
                        <h6 class="mb-2" style="font-size:0.85rem;color:#64748b">Historique des imports déclenchés manuellement</h6>
                        <div id="auditImportList" style="font-size:0.82rem;max-height:120px;overflow-y:auto"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ============================================================ -->
        <!-- SECTION 2 : Logs d'audit                                      -->
        <!-- ============================================================ -->
        <div class="stat-card mb-4">
            <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h6 class="mb-0"><i class="bi bi-shield-check"></i> Journal d'audit</h6>
                <div class="d-flex gap-2 flex-wrap">
                    <select class="form-select form-select-sm" id="auditFilterAction" style="width:180px">
                        <option value="">Toutes les actions</option>
                    </select>
                    <input type="text" class="form-control form-control-sm" id="auditSearch" placeholder="Rechercher..." style="width:180px">
                    <input type="date" class="form-control form-control-sm" id="auditDateFrom" style="width:140px" title="Date début">
                    <input type="date" class="form-control form-control-sm" id="auditDateTo"   style="width:140px" title="Date fin">
                    <button class="btn btn-sm btn-primary" id="auditApplyBtn"><i class="bi bi-funnel"></i> Filtrer</button>
                </div>
            </div>

            <div class="table-responsive">
                <table class="table table-sm table-hover" id="auditTable">
                    <thead>
                        <tr>
                            <th>Date/Heure</th>
                            <th>Utilisateur</th>
                            <th>Action</th>
                            <th>Entité</th>
                            <th>Détails</th>
                            <th>IP</th>
                        </tr>
                    </thead>
                    <tbody id="auditTableBody">
                        <tr><td colspan="6" class="text-center text-muted py-3">Chargement...</td></tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination audit -->
            <div class="d-flex justify-content-between align-items-center mt-2">
                <span class="text-muted" style="font-size:0.82rem" id="auditPaginationInfo"></span>
                <div class="d-flex gap-1" id="auditPaginationBtns"></div>
            </div>
        </div>

    </div><!-- /main-content -->

    <!-- Modal Déconnexion -->
    <div id="logoutConfirmModal" class="logout-confirm-modal">
        <div class="logout-confirm-card">
            <i class="bi bi-box-arrow-right"></i>
            <h3>Déconnexion</h3>
            <p>Êtes-vous sûr de vouloir vous déconnecter ?</p>
            <div class="logout-confirm-buttons">
                <button class="btn-cancel-logout"  id="cancelLogoutBtn"><i class="bi bi-x-lg"></i> Annuler</button>
                <button class="btn-confirm-logout" id="confirmLogoutBtn"><i class="bi bi-check-lg"></i> Déconnecter</button>
            </div>
        </div>
    </div>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <!-- API Client -->
    <script src="js/api.js"></script>
    <!-- Logout / Auth utilities -->
    <script src="js/logout.js"></script>
    <!-- App core -->
    <script src="js/app.js"></script>
    <!-- Admin Tools -->
    <script src="js/admin-tools.js"></script>
    <script>document.addEventListener('DOMContentLoaded', initAdminTools);</script>
</body>
</html>
