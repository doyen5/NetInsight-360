<?php
require_once __DIR__ . '/../netinsight360-backend/app/helpers/AuthHelper.php';

AuthHelper::requireLogin();

$user = AuthHelper::getUser();
$userRole = AuthHelper::getUserRole();
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>NetInsight 360 - Sécurité</title>
    <link rel="icon" type="image/png" href="assets/img/logo.PNG">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-9ndCyUaIbzAi2FUVXJi0CjmCapSmO7SnpJef0486qhLnuZ2cdeRhO02iuK6FUUVM" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" integrity="sha384-XGjxtQfXaH2tnPFa9x+ruJTuLE3Aa6LhHSWRr1XeTyhezb4abCG4ccI5AkVDxqC+" crossorigin="anonymous">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/dashboard.css">
    <style>
        /* La page de sécurité regroupe l'administration du 2FA et des recovery codes. */
        .security-card { background:#fff; border-radius:24px; padding:24px; box-shadow:0 16px 40px rgba(15,23,42,.08); }
        .security-card h4 { font-size:1.1rem; font-weight:700; color:#0f172a; margin-bottom:10px; }
        .security-card p { color:#64748b; }
        .security-code-list { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px; }
        .security-code-item { background:#0f172a; color:#f8fafc; border-radius:14px; padding:12px 14px; font-family:Consolas, monospace; letter-spacing:.08em; }
        .security-qr { background:#f8fafc; border:1px solid #e2e8f0; border-radius:18px; padding:18px; display:flex; justify-content:center; }
        .security-secret { background:#f8fafc; border:1px dashed #cbd5e1; border-radius:14px; padding:12px 16px; font-family:Consolas, monospace; word-break:break-all; }
        .status-pill { display:inline-flex; align-items:center; gap:8px; border-radius:999px; padding:8px 14px; font-weight:600; }
        .status-enabled { background:#dcfce7; color:#166534; }
        .status-disabled { background:#fee2e2; color:#991b1b; }
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
            <a href="map-view.php" class="nav-link"><i class="bi bi-map"></i> Cartographie</a>
            <?php if ($userRole === 'ADMIN'): ?>
                <a href="users-management.php" class="nav-link admin-only"><i class="bi bi-people"></i> Gestion Users</a>
            <?php endif; ?>
            <a href="alerts.php" class="nav-link viewer-restricted"><i class="bi bi-bell"></i> Alertes</a>
            <?php if ($userRole === 'ADMIN'): ?>
                <a href="admin-tools.php" class="nav-link admin-only"><i class="bi bi-tools"></i> Outils Admin</a>
            <?php endif; ?>
        </nav>
    </div>

    <div class="main-content">
        <div class="header-bar">
            <div class="welcome-message"><i class="bi bi-person-circle"></i> Sécurité du compte</div>
            <div class="header-right">
                <div class="date-time" id="currentDateTime"><i class="bi bi-calendar3"></i> <span>Chargement...</span></div>
                <div class="user-info-header">
                    <div class="user-avatar" id="userAvatar">PD</div>
                    <div class="user-details">
                        <div class="user-name" id="headerUserName"><?= htmlspecialchars($user['name'] ?? 'Utilisateur') ?></div>
                        <div class="user-role" id="headerUserRole"><?= htmlspecialchars($userRole ?? 'USER') ?></div>
                    </div>
                </div>
                <button class="logout-btn-header" id="logoutBtn"><i class="bi bi-box-arrow-right"></i> Déconnexion</button>
            </div>
        </div>

        <div class="page-header mb-4">
            <h2><i class="bi bi-shield-lock"></i> Authentification à deux facteurs</h2>
            <p class="text-muted mb-0">Activez un vrai TOTP, générez vos codes de secours et gérez la sécurité du compte.</p>
        </div>

        <div class="row g-4">
            <div class="col-lg-5">
                <div class="security-card h-100">
                    <span id="twoFactorStatusBadge" class="status-pill status-disabled"><i class="bi bi-shield-x"></i> 2FA désactivé</span>
                    <p class="mt-3 mb-2">Utilisateur connecté : <strong><?= htmlspecialchars($user['email'] ?? '') ?></strong></p>
                    <p class="mb-2">Codes de secours restants : <strong id="recoveryCodesRemaining">0</strong></p>
                    <p class="mb-0">Dernière confirmation : <strong id="twoFactorConfirmedAt">Jamais</strong></p>
                </div>
            </div>
            <div class="col-lg-7">
                <div class="security-card">
                    <h4><i class="bi bi-key"></i> Préparer l’activation</h4>
                    <p>Pour commencer, confirmez votre mot de passe actuel. Le backend génèrera ensuite un secret TOTP temporaire et son QR code.</p>
                    <div class="mb-3">
                        <label class="form-label" for="setupCurrentPassword">Mot de passe actuel</label>
                        <input type="password" class="form-control" id="setupCurrentPassword" autocomplete="current-password">
                    </div>
                    <button class="btn btn-primary" id="prepareTwoFactorBtn"><i class="bi bi-shield-plus"></i> Générer mon secret 2FA</button>

                    <div id="setupResult" style="display:none; margin-top:20px;">
                        <hr>
                        <div class="security-qr mb-3" id="twoFactorQrWrapper"></div>
                        <label class="form-label">Secret manuel</label>
                        <div class="security-secret mb-3" id="twoFactorSecret"></div>
                        <div class="mb-3">
                            <label class="form-label" for="confirmTwoFactorCode">Code généré par l’application</label>
                            <input type="text" class="form-control" id="confirmTwoFactorCode" inputmode="numeric" maxlength="16" placeholder="123456">
                        </div>
                        <button class="btn btn-success" id="confirmTwoFactorBtn"><i class="bi bi-shield-check"></i> Activer le TOTP</button>
                    </div>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="security-card">
                    <h4><i class="bi bi-arrow-repeat"></i> Régénérer les codes de secours</h4>
                    <p>Utilisez cette option si vous avez consommé des codes ou si vous souhaitez invalider l’ancienne liste.</p>
                    <div class="mb-3">
                        <label class="form-label" for="regenerateCurrentPassword">Mot de passe actuel</label>
                        <input type="password" class="form-control" id="regenerateCurrentPassword" autocomplete="current-password">
                    </div>
                    <div class="mb-3">
                        <label class="form-label" for="regenerateTwoFactorCode">Code TOTP ou code de secours</label>
                        <input type="text" class="form-control" id="regenerateTwoFactorCode" maxlength="16">
                    </div>
                    <button class="btn btn-outline-primary" id="regenerateRecoveryCodesBtn"><i class="bi bi-arrow-clockwise"></i> Régénérer les codes</button>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="security-card">
                    <h4><i class="bi bi-shield-slash"></i> Désactiver le 2FA</h4>
                    <p>La désactivation exige votre mot de passe actuel et un second facteur valide.</p>
                    <div class="mb-3">
                        <label class="form-label" for="disableCurrentPassword">Mot de passe actuel</label>
                        <input type="password" class="form-control" id="disableCurrentPassword" autocomplete="current-password">
                    </div>
                    <div class="mb-3">
                        <label class="form-label" for="disableTwoFactorCode">Code TOTP ou code de secours</label>
                        <input type="text" class="form-control" id="disableTwoFactorCode" maxlength="16">
                    </div>
                    <button class="btn btn-outline-danger" id="disableTwoFactorBtn"><i class="bi bi-shield-x"></i> Désactiver le 2FA</button>
                </div>
            </div>
            <div class="col-12">
                <div class="security-card">
                    <h4><i class="bi bi-life-preserver"></i> Codes de secours</h4>
                    <p>Conservez ces codes hors ligne. Chacun ne peut être utilisé qu’une seule fois.</p>
                    <div id="recoveryCodesOutput" class="security-code-list"></div>
                </div>
            </div>
        </div>
    </div>

    <div id="logoutConfirmModal" class="logout-confirm-modal"><div class="logout-confirm-card"><i class="bi bi-box-arrow-right"></i><h3>Déconnexion</h3><p>Êtes-vous sûr de vouloir vous déconnecter ?</p><div class="logout-confirm-buttons"><button class="btn-cancel-logout" id="cancelLogoutBtn"><i class="bi bi-x-lg"></i> Annuler</button><button class="btn-confirm-logout" id="confirmLogoutBtn"><i class="bi bi-check-lg"></i> Déconnecter</button></div></div></div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" integrity="sha384-geWF76RCwLtnZ8qwWowPQNguL3RmwHVBC9FhGdlKrxdiJJigb/j/68SIy3Te4Bkz" crossorigin="anonymous"></script>
    <script src="js/api.js"></script>
    <script src="js/logout.js?v=2"></script>
    <script src="js/app.js"></script>
    <script src="js/security-settings.js"></script>
</body>
</html>