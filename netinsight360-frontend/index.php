<?php
// index.php - Page de connexion
require_once __DIR__ . '/../netinsight360-backend/app/helpers/AuthHelper.php';

// Si déjà connecté, rediriger vers le dashboard
if (AuthHelper::isLoggedIn()) {
    header('Location: dashboard.php');
    exit();
}
?>

<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>NetInsight 360 - Connexion</title>
    
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <!-- Container principal avec effet de fond animé -->
    <div class="login-container">
        <div class="container">
            <div class="row justify-content-center">
                <div class="col-lg-10 col-md-11">
                    <div class="login-card">
                        <div class="row g-0">
                            <!-- Section gauche : Logo et branding -->
                            <div class="col-lg-5 logo-section">
                                <div class="logo-icon">
                                    <img src="assets/img/mylogo.png" alt="NetInsight 360" class="logo-img">
                                </div>
                                <h1>NetInsight 360</h1>
                                <div class="tagline">SUPERVISEZ. ANALYSEZ. OPTIMISEZ.</div>
                                <p>Plateforme de supervision et d'analyse réseau à 360°</p>
                                <div class="network-stats">
                                    <div class="stat-item">
                                        <div class="stat-number">5</div>
                                        <div class="stat-label">PAYS SUIVIS</div>
                                    </div>
                                    <div class="stat-item">
                                        <div class="stat-number">2500+</div>
                                        <div class="stat-label">SITES ACTIFS</div>
                                    </div>
                                    <div class="stat-item">
                                        <div class="stat-number">24/7</div>
                                        <div class="stat-label">MONITORING</div>
                                    </div>
                                </div>
                            </div>
                            <!-- Section droite : Formulaire de connexion -->
                            <div class="col-lg-7 form-section">
                                <h2>Bienvenue</h2>
                                <p class="subtitle">Connectez-vous à votre espace de supervision réseau</p>
                                <div class="error-message" id="errorMessage">
                                    <i class="bi bi-exclamation-triangle-fill"></i>
                                    <span id="errorText">Identifiants incorrects</span>
                                </div>
                                <form id="loginForm">
                                    <div class="input-group-custom">
                                        <i class="bi bi-envelope-fill"></i>
                                        <input type="email" id="email" placeholder="Adresse email" required>
                                    </div>
                                    <div class="input-group-custom">
                                        <i class="bi bi-lock-fill"></i>
                                        <input type="password" id="password" placeholder="Mot de passe" required>
                                    </div>
                                    <div class="form-options">
                                        <label class="checkbox-custom">
                                            <input type="checkbox" id="rememberMe"> 
                                            <span>Rester connecté</span>
                                        </label>
                                        <a href="#" class="forgot-link" id="forgotPassword">Mot de passe oublié ?</a>
                                    </div>
                                    <button type="submit" class="login-btn" id="loginBtn">
                                        <i class="bi bi-box-arrow-in-right me-2"></i> Se connecter
                                    </button>
                                    <div class="help-text">
                                        <i class="bi bi-headset"></i> Assistance technique : <a href="mailto:princedesirek@gmail.com">princedesirek@gmail.com</a>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Canvas pour l'animation réseau de fond -->
    <canvas id="networkCanvas"></canvas>

    <!-- Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="js/api.js"></script>
    <script src="js/auth.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
