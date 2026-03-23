/**
 * NetInsight 360 - Authentification
 * Supervisez. Analysez. Optimisez.
 * 
 * Gère la connexion utilisateur avec session persistante
 */

// Credentials de test
const validCredentials = {
    admin: { email: 'admin@netinsight360.com', password: 'admin123', role: 'ADMIN', name: 'Prince Désiré' },
    npm: { email: 'npm@netinsight360.com', password: 'npm123', role: 'FO_NPM', name: 'FO_NPM' },
    core: { email: 'core@netinsight360.com', password: 'core123', role: 'FO_CORE_RAN', name: 'FO_CORE_RAN' },
    customer: { email: 'customer@netinsight360.com', password: 'customer123', role: 'CUSTOMER', name: 'CUSTOMER' }
};

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const forgotLink = document.getElementById('forgotPassword');

    // Vérifier si déjà connecté
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser && window.location.pathname.includes('index.html')) {
        window.location.href = 'dashboard.html';
        return;
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
     * Gère la connexion
     */
    function handleLogin(email, password, remember) {
        // Vérification des identifiants
        let user = null;
        for (let key in validCredentials) {
            if (validCredentials[key].email === email && validCredentials[key].password === password) {
                user = validCredentials[key];
                break;
            }
        }
        
        if (user) {
            // Créer la session
            const sessionData = {
                email: user.email,
                role: user.role,
                name: user.name,
                loggedInAt: new Date().toISOString()
            };
            
            // Sauvegarder la session
            sessionStorage.setItem('currentUser', JSON.stringify(sessionData));
            
            // Sauvegarder "Rester connecté" si coché
            if (remember) {
                localStorage.setItem('rememberedUser', JSON.stringify({
                    email: user.email,
                    name: user.name,
                    role: user.role
                }));
            }
            
            // Animation de succès
            loginBtn.innerHTML = '<i class="bi bi-check-lg me-2"></i> Connexion réussie...';
            loginBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            loginBtn.disabled = true;
            
            // Redirection
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 800);
        } else {
            showError('Email ou mot de passe incorrect');
            
            // Animation d'erreur
            loginBtn.style.transform = 'shake 0.5s ease-in-out';
            setTimeout(() => {
                loginBtn.style.transform = '';
            }, 500);
        }
    }

    /**
     * Gère la soumission du formulaire
     */
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const remember = document.getElementById('rememberMe').checked;
        
        if (!email || !password) {
            showError('Veuillez remplir tous les champs');
            return;
        }
        
        // Animation de chargement
        loginBtn.classList.add('loading');
        loginBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i> Connexion en cours...';
        
        // Simuler un délai réseau
        setTimeout(() => {
            loginBtn.classList.remove('loading');
            handleLogin(email, password, remember);
        }, 1000);
    });
    
    // Gestion "Mot de passe oublié"
    if (forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            showError('Fonctionnalité à venir : contactez votre administrateur');
        });
    }
    
    // Pré-remplir si "Rester connecté" était activé
    const remembered = localStorage.getItem('rememberedUser');
    if (remembered) {
        const user = JSON.parse(remembered);
        document.getElementById('email').value = user.email;
        document.getElementById('rememberMe').checked = true;
    }
});