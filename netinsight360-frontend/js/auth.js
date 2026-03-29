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
            if (result.authenticated && (window.location.pathname.includes('index.php') || window.location.pathname === '/')) {
                window.location.href = 'dashboard.php';
            }
        } catch (error) {
            console.log('[Auth] Aucune session active');
        }
    }
    
    /**
     * Affiche le panda avec un message (state = 'error' | 'happy')
     */
    function showPanda(state, message) {
        const wrapper = document.getElementById('pandaWrapper');
        const msgEl   = document.getElementById('pandaMsg');
        if (!wrapper || !msgEl) return;

        // Réinitialiser les classes d'état
        wrapper.classList.remove('show', 'error', 'happy');
        msgEl.textContent = message;

        // Forcer un reflow pour que la transition se rejoue
        void wrapper.offsetWidth;

        wrapper.classList.add('show', state);

        // Masquer après délai
        const delay = state === 'happy' ? 2200 : 3200;
        clearTimeout(wrapper._hideTimer);
        wrapper._hideTimer = setTimeout(() => {
            wrapper.classList.remove('show');
        }, delay);
    }

    /**
     * Affiche un message d'erreur
     */
    function showError(message) {
        errorText.textContent = message;
        errorMessage.classList.add('show');
        showPanda('error', message);
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
                
                // Mémoriser la dernière connexion pour affichage toast sur le dashboard
                if (result.user.lastLogin) {
                    sessionStorage.setItem('lastLoginToast', result.user.lastLogin);
                }
                
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
                showPanda('happy', 'Bienvenue ! 🎉');
                
                // Redirection
                setTimeout(() => {
                    window.location.href = 'dashboard.php';
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

    // ── Toggle afficher/masquer mot de passe ─────────────────────────────────
    const togglePasswordBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eyeIcon');
    if (togglePasswordBtn && passwordInput && eyeIcon) {
        togglePasswordBtn.addEventListener('click', () => {
            const isHidden = passwordInput.type === 'password';
            passwordInput.type = isHidden ? 'text' : 'password';
            eyeIcon.className = isHidden ? 'bi bi-eye-fill' : 'bi bi-eye-slash-fill';
            passwordInput.focus();
        });
    }

    // ── Effet 3D tilt sur la card formulaire ─────────────────────────────────
    const formCard = document.getElementById('formCard');
    const cardGlare = document.getElementById('cardGlare');
    if (formCard) {
        const MAX_TILT = 10; // degrés max

        formCard.addEventListener('mousemove', (e) => {
            const rect = formCard.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top  + rect.height / 2;
            const dx = (e.clientX - cx) / (rect.width  / 2);
            const dy = (e.clientY - cy) / (rect.height / 2);

            const rotY =  dx * MAX_TILT;
            const rotX = -dy * MAX_TILT;

            formCard.style.transform =
                `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.02,1.02,1.02)`;

            // Déplacer le reflet selon la position de la souris
            if (cardGlare) {
                const glareX = ((e.clientX - rect.left) / rect.width)  * 100;
                const glareY = ((e.clientY - rect.top)  / rect.height) * 100;
                cardGlare.style.background =
                    `radial-gradient(400px circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.1) 0%, transparent 60%)`;
            }
        });

        formCard.addEventListener('mouseleave', () => {
            formCard.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
            if (cardGlare) cardGlare.style.background = 'none';
        });
    }
});