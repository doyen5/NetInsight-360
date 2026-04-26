<?php
// index.php - Page de connexion
require_once __DIR__ . '/../netinsight360-backend/app/helpers/AuthHelper.php';
require_once __DIR__ . '/../netinsight360-backend/config/constants.php';

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
    <link rel="icon" type="image/png" href="assets/img/logo.PNG">
    
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-9ndCyUaIbzAi2FUVXJi0CjmCapSmO7SnpJef0486qhLnuZ2cdeRhO02iuK6FUUVM" crossorigin="anonymous">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" integrity="sha384-XGjxtQfXaH2tnPFa9x+ruJTuLE3Aa6LhHSWRr1XeTyhezb4abCG4ccI5AkVDxqC+" crossorigin="anonymous">
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
                                            <!-- Étape 1: identifiants primaires -->
                                            <div id="primaryLoginFields">
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
                                                    <input type="password" id="password" class="field-input" placeholder="••••••••" required autocomplete="current-password" maxlength="72">
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
                                                <a href="mailto:<?= htmlspecialchars(SUPPORT_EMAIL) ?>"><?= htmlspecialchars(SUPPORT_EMAIL) ?></a>
                                            </div>
                                            </div>

                                            <!-- Étape 2: second facteur TOTP ou code de secours.
                                                 Cette section reste masquée tant que le backend n'a pas validé
                                                 le mot de passe et demandé explicitement le 2FA. -->
                                            <div id="twoFactorPanel" style="display:none; margin-top: 16px;">
                                                <div class="field-group">
                                                    <label for="twoFactorCode" class="field-label">
                                                        <i class="bi bi-shield-lock-fill"></i>
                                                        Code 2FA
                                                    </label>
                                                    <div class="field-wrap">
                                                        <span class="field-icon-left"><i class="bi bi-123"></i></span>
                                                        <input type="text" id="twoFactorCode" class="field-input" placeholder="123456 ou code de secours" autocomplete="one-time-code" inputmode="numeric" maxlength="16">
                                                    </div>
                                                    <small style="color:#94a3b8; display:block; margin-top:8px;">Entrez le code de votre application d’authentification ou un code de secours.</small>
                                                </div>
                                                <div style="display:flex; gap:12px; margin-top: 18px;">
                                                    <button type="button" class="login-btn" id="verifyTwoFactorBtn" style="margin:0; flex:1;">
                                                        <span class="btn-content"><i class="bi bi-shield-check"></i><span>Valider le 2FA</span></span>
                                                    </button>
                                                    <button type="button" class="btn btn-outline-light" id="cancelTwoFactorBtn" style="border-radius:999px; padding: 0 18px;">Retour</button>
                                                </div>
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
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js" integrity="sha384-geWF76RCwLtnZ8qwWowPQNguL3RmwHVBC9FhGdlKrxdiJJigb/j/68SIy3Te4Bkz" crossorigin="anonymous"></script>
    <script src="js/api.js?v=2"></script>
    <script src="js/auth.js?v=2"></script>
    <script src="js/app.js"></script>
</body>
</html>
