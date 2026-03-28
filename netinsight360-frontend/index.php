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
                                <!-- Orbes décoratifs 3D -->
                                <div class="orb orb-1"></div>
                                <div class="orb orb-2"></div>

                                <div class="form-glass-card" id="formCard">
                                    <!-- Reflet glare -->
                                    <div class="card-glare" id="cardGlare"></div>

                                    <div class="form-inner">
                                        <div class="form-header">
                                            <div class="form-icon-badge">
                                                <i class="bi bi-shield-check"></i>
                                            </div>
                                            <h2>Bienvenue</h2>
                                            <p class="subtitle">Connectez-vous à votre espace</p>
                                        </div>

                                        <div class="error-message" id="errorMessage">
                                            <i class="bi bi-exclamation-triangle-fill"></i>
                                            <span id="errorText">Identifiants incorrects</span>
                                        </div>

                                        <form id="loginForm">
                                            <!-- Champ email -->
                                            <div class="field-group">
                                                <label for="email" class="field-label">
                                                    <i class="bi bi-envelope-fill"></i>
                                                    Adresse email
                                                </label>
                                                <div class="field-wrap">
                                                    <span class="field-icon-left"><i class="bi bi-person-circle"></i></span>
                                                    <input type="email" id="email" class="field-input" placeholder="exemple@domaine.com" required autocomplete="email">
                                                    <span class="field-status-dot" id="emailDot"></span>
                                                </div>
                                            </div>

                                            <!-- Champ mot de passe -->
                                            <div class="field-group">
                                                <label for="password" class="field-label">
                                                    <i class="bi bi-shield-lock-fill"></i>
                                                    Mot de passe
                                                </label>
                                                <div class="field-wrap">
                                                    <span class="field-icon-left"><i class="bi bi-lock-fill"></i></span>
                                                    <input type="password" id="password" class="field-input" placeholder="••••••••" required autocomplete="current-password">
                                                    <button type="button" class="eye-toggle" id="togglePassword" tabindex="-1" aria-label="Afficher/masquer le mot de passe">
                                                        <i class="bi bi-eye-slash-fill" id="eyeIcon"></i>
                                                    </button>
                                                </div>
                                            </div>

                                            <div class="form-options">
                                                <label class="checkbox-custom">
                                                    <input type="checkbox" id="rememberMe">
                                                    <span class="checkmark"></span>
                                                    <span>Rester connecté</span>
                                                </label>
                                                <a href="#" class="forgot-link" id="forgotPassword">
                                                    <i class="bi bi-question-circle me-1"></i>Mot de passe oublié ?
                                                </a>
                                            </div>

                                            <button type="submit" class="login-btn" id="loginBtn">
                                                <span class="btn-content">
                                                    <i class="bi bi-box-arrow-in-right"></i>
                                                    <span>Se connecter</span>
                                                </span>
                                                <div class="btn-shine"></div>
                                            </button>

                                            <div class="help-text">
                                                <i class="bi bi-headset"></i> Assistance :
                                                <a href="mailto:princedesirek@gmail.com">princedesirek@gmail.com</a>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Canvas pour l'animation réseau de fond -->
    <canvas id="networkCanvas"></canvas>

    <!-- Panda de feedback connexion -->
    <div class="panda-wrapper" id="pandaWrapper">
        <div class="panda-bubble" id="pandaBubble">
            <span id="pandaMsg">Identifiants incorrects !</span>
            <div class="bubble-tail"></div>
        </div>
        <div class="panda" id="pandaChar">
            <!-- Corps -->
            <div class="panda-body">
                <!-- Oreilles -->
                <div class="panda-ear panda-ear-left"></div>
                <div class="panda-ear panda-ear-right"></div>
                <!-- Tête -->
                <div class="panda-head">
                    <!-- Taches oculaires -->
                    <div class="panda-eye-patch panda-eye-patch-left"></div>
                    <div class="panda-eye-patch panda-eye-patch-right"></div>
                    <!-- Yeux -->
                    <div class="panda-eye panda-eye-left">
                        <div class="panda-pupil"></div>
                        <div class="panda-shine"></div>
                    </div>
                    <div class="panda-eye panda-eye-right">
                        <div class="panda-pupil"></div>
                        <div class="panda-shine"></div>
                    </div>
                    <!-- Bouche -->
                    <div class="panda-nose"></div>
                    <div class="panda-mouth" id="pandaMouth"></div>
                    <!-- Joues -->
                    <div class="panda-cheek panda-cheek-left"></div>
                    <div class="panda-cheek panda-cheek-right"></div>
                </div>
                <!-- Larmes (état erreur) -->
                <div class="panda-tear panda-tear-left"></div>
                <div class="panda-tear panda-tear-right"></div>
                <!-- Bras -->
                <div class="panda-arm panda-arm-left"></div>
                <div class="panda-arm panda-arm-right"></div>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="js/api.js"></script>
    <script src="js/auth.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
