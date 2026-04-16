/**
 * NetInsight 360 - Gestion de la déconnexion
 * Supervisez. Analysez. Optimisez.
 * 
 * Gère la déconnexion utilisateur via l'API backend
 * Modal de confirmation, nettoyage des données locales
 * Vérification de session et expiration
 */

// Variables globales pour la gestion du modal
let logoutModalInstance = null;
let logoutButton = null;
let logoutTimer = null;

/**
 * Initialise la gestion de la déconnexion
 * @param {Object} options - Options de configuration
 */
function initLogoutHandler(options = {}) {
    logoutButton = document.getElementById('logoutBtn');
    const logoutModal = document.getElementById('logoutConfirmModal');
    const confirmBtn = document.getElementById('confirmLogoutBtn');
    const cancelBtn = document.getElementById('cancelLogoutBtn');
    
    if (!logoutButton) {
        console.warn('[Logout] Bouton de déconnexion non trouvé');
        return;
    }
    
    /**
     * Affiche le modal de confirmation
     */
    function showLogoutConfirmation() {
        if (logoutModal) {
            logoutModal.classList.add('show');
        } else {
            // Fallback si le modal n'existe pas
            if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
                executeLogout();
            }
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
     * Appelle l'API de déconnexion, nettoie le stockage, redirige
     */
    async function executeLogout() {
        const originalContent = logoutButton.innerHTML;
        
        // Afficher l'état de chargement
        logoutButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Déconnexion...';
        logoutButton.disabled = true;
        
        try {
            // Appel API de déconnexion
            const result = await API.logout();
            
            if (result.success) {
                // Nettoyer le stockage local
                sessionStorage.clear();
                localStorage.removeItem('rememberedUser');
                localStorage.removeItem('userFilters');
                localStorage.removeItem('dashboardState');
                
                // Journaliser la déconnexion
                console.log('[NetInsight 360] Utilisateur déconnecté le ' + new Date().toLocaleString());
                
                // Redirection vers la page de connexion
                window.location.href = 'index.php';
            } else {
                throw new Error(result.error || 'Erreur lors de la déconnexion');
            }
        } catch (error) {
            console.error('[Logout] Erreur lors de la déconnexion:', error);
            
            // En cas d'erreur, nettoyer quand même les données locales
            sessionStorage.clear();
            localStorage.removeItem('rememberedUser');
            
            // Afficher une notification d'erreur
            if (options.showErrorToast !== false) {
                showToast('Erreur lors de la déconnexion. Nettoyage local effectué.', 'error');
            }
            
            // Redirection après un court délai
            setTimeout(() => {
                window.location.href = 'index.php';
            }, 1500);
        } finally {
            // Restaurer le bouton (ne sera pas atteint si redirection)
            logoutButton.innerHTML = originalContent;
            logoutButton.disabled = false;
        }
    }
    
    // Événement du bouton de déconnexion
    logoutButton.addEventListener('click', (e) => {
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
 * Appelle l'API de vérification, redirige si non authentifié
 * @returns {Promise<boolean>} true si authentifié, false sinon
 */
async function checkAuthentication() {
    try {
        const result = await API.verify();
        
        if (!result.authenticated) {
            console.log('[Auth] Session expirée, redirection vers login');
            
            // Nettoyer le stockage local
            sessionStorage.clear();
            localStorage.removeItem('rememberedUser');
            
            // Redirection
            window.location.href = 'index.php';
            return false;
        }
        
        // Mettre à jour les infos utilisateur dans sessionStorage
        if (result.user) {
            sessionStorage.setItem('currentUser', JSON.stringify(result.user));
        }
        
        return true;
    } catch (error) {
        console.error('[Auth] Erreur de vérification:', error);
        
        // En cas d'erreur réseau, rediriger quand même vers login
        window.location.href = 'index.php';
        return false;
    }
}

/**
 * Vérifie l'authentification avec gestion du timeout
 * @param {number} timeoutMs - Timeout en millisecondes
 * @returns {Promise<boolean>}
 */
async function checkAuthenticationWithTimeout(timeoutMs = 5000) {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), timeoutMs);
    });
    
    try {
        await Promise.race([checkAuthentication(), timeoutPromise]);
        return true;
    } catch (error) {
        console.error('[Auth] Timeout de vérification');
        window.location.href = 'index.php';
        return false;
    }
}

/**
 * Récupère l'utilisateur courant depuis sessionStorage
 * @returns {Object|null} Utilisateur ou null
 */
function getCurrentUser() {
    const userStr = sessionStorage.getItem('currentUser');
    if (!userStr) return null;
    
    try {
        return JSON.parse(userStr);
    } catch (e) {
        console.error('[Auth] Erreur parsing utilisateur:', e);
        return null;
    }
}

/**
 * Applique les restrictions d'affichage selon le rôle de l'utilisateur
 * @param {string} role - Rôle de l'utilisateur (ADMIN, FO_ANALYSTE, CUSTOMER)
 */
function applyRoleRestrictions(role) {
    // Éléments réservés aux administrateurs
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    
    // Éléments réservés aux agents analystes (FO_ANALYSTE)
    const npmOnlyElements = document.querySelectorAll('.npm-only');
    const coreOnlyElements = document.querySelectorAll('.core-only');
    
    // Éléments restreints pour les visualiseurs (CUSTOMER)
    const viewerRestrictedElements = document.querySelectorAll('.viewer-restricted');
    
    // Masquer tous les éléments réservés d'abord
    adminOnlyElements.forEach(el => el.style.display = 'none');
    npmOnlyElements.forEach(el => el.style.display = 'none');
    coreOnlyElements.forEach(el => el.style.display = 'none');
    
    // Afficher selon le rôle
    if (role === 'ADMIN') {
        adminOnlyElements.forEach(el => el.style.display = '');
        npmOnlyElements.forEach(el => el.style.display = '');
        coreOnlyElements.forEach(el => el.style.display = '');
    } else if (role === 'FO_ANALYSTE') {
        npmOnlyElements.forEach(el => el.style.display = '');
        coreOnlyElements.forEach(el => el.style.display = '');
    }
    
    // CUSTOMER : masquer les éléments restreints
    if (role === 'CUSTOMER') {
        viewerRestrictedElements.forEach(el => el.style.display = 'none');
    }
}

/**
 * Affiche une notification toast
 * @param {string} message - Message à afficher
 * @param {string} type - Type de notification (success, error, warning, info)
 */
function showToast(message, type = 'info') {
    // Vérifier si un toast container existe
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
        `;
        document.body.appendChild(toastContainer);
    }
    
    // Couleurs selon le type
    const colors = {
        success: { bg: '#10b981', icon: 'bi-check-circle-fill' },
        error: { bg: '#ef4444', icon: 'bi-exclamation-triangle-fill' },
        warning: { bg: '#f59e0b', icon: 'bi-exclamation-triangle-fill' },
        info: { bg: '#00a3c4', icon: 'bi-info-circle-fill' }
    };
    
    const color = colors[type] || colors.info;
    
    // Créer le toast
    const toast = document.createElement('div');
    toast.className = 'toast show';
    toast.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 12px 16px;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 280px;
        animation: slideIn 0.3s ease;
        border-left: 4px solid ${color.bg};
    `;
    
    toast.innerHTML = `
        <i class="bi ${color.icon}" style="color: ${color.bg}; font-size: 1.2rem;"></i>
        <span style="flex: 1; font-size: 0.85rem;">${escapeHtml(message)}</span>
        <button type="button" class="btn-close" style="font-size: 0.7rem;" aria-label="Fermer"></button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Gestion de la fermeture
    const closeBtn = toast.querySelector('.btn-close');
    closeBtn.addEventListener('click', () => {
        toast.remove();
    });
    
    // Auto-fermeture après 3 secondes
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

/**
 * Échappe les caractères HTML
 * @param {string} text - Texte à échapper
 * @returns {string}
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Initialise un timer de session
 * @param {number} timeoutMinutes - Temps avant expiration en minutes
 */
function initSessionTimer(timeoutMinutes = 30) {
    let timer;
    
    function resetTimer() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            console.log('[Session] Expiration due à l\'inactivité');
            showToast('Votre session a expiré. Veuillez vous reconnecter.', 'warning');
            sessionStorage.clear();
            localStorage.removeItem('rememberedUser');
            window.location.href = 'index.php';
        }, timeoutMinutes * 60 * 1000);
    }
    
    // Réinitialiser le timer à chaque interaction
    const events = ['mousemove', 'keypress', 'click', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetTimer);
    });
    
    resetTimer();
}

// Exporter les fonctions globales
window.initLogoutHandler = initLogoutHandler;
window.checkAuthentication = checkAuthentication;
window.checkAuthenticationWithTimeout = checkAuthenticationWithTimeout;
window.getCurrentUser = getCurrentUser;
window.applyRoleRestrictions = applyRoleRestrictions;
window.showToast = showToast;
window.escapeHtml = escapeHtml;
window.initSessionTimer = initSessionTimer;
