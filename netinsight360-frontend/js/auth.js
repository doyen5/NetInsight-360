/**
 * NetInsight 360 - Gestion de la déconnexion
 * Supervisez. Analysez. Optimisez.
 * 
 * Gère la déconnexion utilisateur via l'API backend
 * Modal de confirmation, nettoyage des données locales
 */

let logoutModal = null;
let logoutBtn = null;

/**
 * Initialise la gestion de la déconnexion
 */
function initLogoutHandler() {
    logoutBtn = document.getElementById('logoutBtn');
    logoutModal = document.getElementById('logoutConfirmModal');
    const confirmBtn = document.getElementById('confirmLogoutBtn');
    const cancelBtn = document.getElementById('cancelLogoutBtn');
    
    if (!logoutBtn) return;
    
    /**
     * Affiche le modal de confirmation
     */
    function showLogoutConfirmation() {
        if (logoutModal) {
            logoutModal.classList.add('show');
        } else if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            executeLogout();
        }
    }
    
    /**
     * Cache le modal de confirmation
     */
    function hideLogoutConfirmation() {
        if (logoutModal) {
            logoutModal.classList.remove('show');
        }
    }
    
    /**
     * Exécute la déconnexion
     */
    async function executeLogout() {
        const originalContent = logoutBtn.innerHTML;
        
        // Afficher l'état de chargement
        logoutBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Déconnexion...';
        logoutBtn.disabled = true;
        
        try {
            // Appel API de déconnexion
            await API.logout();
            
            // Nettoyer le stockage local
            sessionStorage.clear();
            localStorage.removeItem('rememberedUser');
            localStorage.removeItem('userFilters');
            
            // Journaliser la déconnexion
            console.log('[NetInsight 360] Utilisateur déconnecté le ' + new Date().toLocaleString());
            
            // Redirection
            window.location.href = 'index.html';
        } catch (error) {
            console.error('[Logout] Erreur lors de la déconnexion:', error);
            // En cas d'erreur, nettoyer quand même les données locales
            sessionStorage.clear();
            localStorage.removeItem('rememberedUser');
            window.location.href = 'index.html';
        }
    }
    
    // Événement du bouton de déconnexion
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showLogoutConfirmation();
    });
    
    // Événements du modal
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            hideLogoutConfirmation();
            executeLogout();
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            hideLogoutConfirmation();
        });
    }
    
    // Fermer le modal en cliquant à l'extérieur
    if (logoutModal) {
        logoutModal.addEventListener('click', (e) => {
            if (e.target === logoutModal) {
                hideLogoutConfirmation();
            }
        });
    }
    
    // Fermer avec la touche Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && logoutModal?.classList.contains('show')) {
            hideLogoutConfirmation();
        }
    });
}

/**
 * Vérifie l'authentification de l'utilisateur
 * @returns {Promise<boolean>} true si authentifié
 */
async function checkAuthentication() {
    try {
        const result = await API.verify();
        
        if (!result.authenticated) {
            window.location.href = 'index.html';
            return false;
        }
        
        // Mettre à jour les infos utilisateur
        if (result.user) {
            sessionStorage.setItem('currentUser', JSON.stringify(result.user));
        }
        return true;
    } catch (error) {
        console.error('[Auth] Erreur de vérification:', error);
        window.location.href = 'index.html';
        return false;
    }
}

/**
 * Récupère l'utilisateur courant depuis sessionStorage
 * @returns {object|null} Utilisateur ou null
 */
function getCurrentUser() {
    const userStr = sessionStorage.getItem('currentUser');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch (e) {
        console.error('[Auth] Erreur parsing user:', e);
        return null;
    }
}

/**
 * Met à jour l'interface utilisateur (nom, avatar, rôle)
 */
async function updateUserInterface() {
    const user = getCurrentUser();
    if (!user) return;
    
    // Mettre à jour le nom
    const userNameEl = document.getElementById('userName');
    const headerUserNameEl = document.getElementById('headerUserName');
    if (userNameEl) userNameEl.innerText = user.name;
    if (headerUserNameEl) headerUserNameEl.innerText = user.name;
    
    // Mettre à jour l'avatar
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    const userAvatarEl = document.getElementById('userAvatar');
    if (userAvatarEl) userAvatarEl.innerText = initials;
    
    // Mettre à jour le rôle
    const roleMap = {
        'ADMIN': 'Administrateur',
        'FO_NPM': 'Agent Superviseur',
        'FO_CORE_RAN': 'Agent Partageur',
        'CUSTOMER': 'Agent Visualiseur'
    };
    const headerUserRoleEl = document.getElementById('headerUserRole');
    if (headerUserRoleEl) headerUserRoleEl.innerText = roleMap[user.role] || 'Utilisateur';
}

// Exporter les fonctions globales
window.initLogoutHandler = initLogoutHandler;
window.checkAuthentication = checkAuthentication;
window.getCurrentUser = getCurrentUser;
window.updateUserInterface = updateUserInterface;