/**
 * NetInsight 360 - Authentification
 * Supervisez. Analysez. Optimisez.
 * 
 * Gère la connexion utilisateur via l'API backend
 */

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const forgotLink = document.getElementById('forgotPassword');
    
    console.log('✅ auth.js chargé - formulaire trouvé:', !!loginForm);
    
    // Vérifier si déjà connecté
    checkExistingSession();
    
    /**
     * Vérifie si une session existe déjà
     */
    async function checkExistingSession() {
        try {
            const result = await API.verify();
            if (result.authenticated && (window.location.pathname.includes('index.html') || window.location.pathname === '/')) {
                window.location.href = 'dashboard.html';
            }
        } catch (error) {
            console.log('[Auth] Aucune session active');
        }
    }
    
    /**
     * Affiche un message d'erreur
     */
    function showError(message) {
        errorText.textContent = message;
        errorMessage.classList.add('show');
        setTimeout(() => {
            errorMessage.classList.remove('show');
        }, 3000);
    }
    
    /**
     * Réinitialise le bouton de connexion
     */
    function resetLoginButton() {
        loginBtn.classList.remove('loading');
        loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i> Se connecter';
        loginBtn.disabled = false;
    }
    
    /**
     * Gère la connexion
     */
    async function handleLogin(email, password, remember) {
        try {
            // Afficher l'état de chargement
            loginBtn.classList.add('loading');
            loginBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i> Connexion en cours...';
            loginBtn.disabled = true;
            
            console.log('[Auth] Tentative de connexion pour:', email);
            
            // Appel API
            const result = await API.login(email, password, remember);
            console.log('[Auth] Réponse API:', result);
            
            if (result.success && result.user) {
                // Sauvegarder les infos utilisateur
                sessionStorage.setItem('currentUser', JSON.stringify(result.user));
                
                // Sauvegarder "Rester connecté"
                if (remember) {
                    localStorage.setItem('rememberedUser', JSON.stringify({
                        email: result.user.email,
                        name: result.user.name,
                        role: result.user.role
                    }));
                }
                
                // Animation de succès
                loginBtn.innerHTML = '<i class="bi bi-check-lg me-2"></i> Connexion réussie...';
                loginBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                
                // Redirection
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 800);
            } else {
                showError(result.error || 'Identifiants incorrects');
                resetLoginButton();
            }
        } catch (error) {
            console.error('[Auth] Erreur de connexion:', error);
            showError('Erreur de connexion au serveur. Veuillez réessayer.');
            resetLoginButton();
        }
    }
    
    // Soumission du formulaire
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const remember = document.getElementById('rememberMe')?.checked || false;
            
            console.log('[Auth] Formulaire soumis - email:', email);
            
            if (!email || !password) {
                showError('Veuillez remplir tous les champs');
                return;
            }
            
            await handleLogin(email, password, remember);
        });
    } else {
        console.error('[Auth] Formulaire de connexion non trouvé !');
    }
    
    // Mot de passe oublié
    if (forgotLink) {
        forgotLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email')?.value.trim();
            
            if (!email) {
                showError('Veuillez saisir votre email');
                return;
            }
            
            try {
                const result = await API.forgotPassword(email);
                showError(result.message || 'Un email de réinitialisation a été envoyé');
            } catch (error) {
                showError('Erreur lors de l\'envoi. Veuillez réessayer.');
            }
        });
    }
    
    // Pré-remplir si "Rester connecté" était activé
    const remembered = localStorage.getItem('rememberedUser');
    if (remembered) {
        try {
            const user = JSON.parse(remembered);
            const emailInput = document.getElementById('email');
            if (emailInput) emailInput.value = user.email;
            const rememberCheck = document.getElementById('rememberMe');
            if (rememberCheck) rememberCheck.checked = true;
        } catch (e) {
            console.warn('[Auth] Erreur lecture rememberedUser');
        }
    }
});