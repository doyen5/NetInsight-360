/**
 * NetInsight 360 - Gestion de la déconnexion
 * Supervisez. Analysez. Optimisez.
 * 
 * Ce fichier gère la déconnexion sécurisée de l'utilisateur
 */

/**
 * Fonction de déconnexion
 * Nettoie toutes les données de session et redirige vers la page de connexion
 */
function logout() {
    // Afficher une confirmation avant déconnexion (optionnel)
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        // Nettoyer le sessionStorage
        sessionStorage.clear();
        
        // Nettoyer le localStorage (si "Rester connecté" était activé)
        localStorage.removeItem('rememberedUser');
        
        // Supprimer les données temporaires
        localStorage.removeItem('userFilters');
        localStorage.removeItem('lastDashboardState');
        
        // Journaliser la déconnexion dans la console (pour debug)
        console.log('[NetInsight 360] Utilisateur déconnecté le ' + new Date().toLocaleString());
        
        // Rediriger vers la page de connexion
        window.location.href = 'index.html';
    }
}

/**
 * Fonction de déconnexion silencieuse (sans confirmation)
 * Utilisée pour les sessions expirées
 */
function forceLogout() {
    sessionStorage.clear();
    localStorage.removeItem('rememberedUser');
    window.location.href = 'index.html';
}

/**
 * Vérifie si l'utilisateur est authentifié
 * Redirige vers la page de connexion si non authentifié
 */
function checkAuthentication() {
    const currentUser = sessionStorage.getItem('currentUser');
    if (!currentUser) {
        forceLogout();
        return false;
    }
    return true;
}

/**
 * Récupère l'utilisateur courant
 */
function getCurrentUser() {
    const userStr = sessionStorage.getItem('currentUser');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch (e) {
        return null;
    }
}

/**
 * Vérifie si la session est expirée
 * @returns {boolean} true si la session est expirée, false sinon
 */
function isSessionExpired() {
    const user = getCurrentUser();
    if (!user || !user.loggedInAt) return true;
    
    const loginTime = new Date(user.loggedInAt);
    const currentTime = new Date();
    const sessionDuration = (currentTime - loginTime) / 1000 / 60 / 60; // en heures
    
    // Session expire après 8 heures (modifiable selon besoin)
    const maxSessionHours = 8;
    return sessionDuration > maxSessionHours;
}

/**
 * Rafraîchit la session (prolonge la durée)
 */
function refreshSession() {
    const user = getCurrentUser();
    if (user) {
        user.loggedInAt = new Date().toISOString();
        sessionStorage.setItem('currentUser', JSON.stringify(user));
    }
}

/**
 * Initialise un timer de déconnexion automatique
 * @param {number} minutes - Temps avant déconnexion automatique (en minutes)
 */
function initAutoLogout(minutes = 30) {
    let timer;
    
    function resetTimer() {
        clearTimeout(timer);
        timer = setTimeout(() => {
            alert('Votre session a expiré pour cause d\'inactivité. Veuillez vous reconnecter.');
            forceLogout();
        }, minutes * 60 * 1000);
    }
    
    // Réinitialiser le timer à chaque interaction utilisateur
    const events = ['mousemove', 'keypress', 'click', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetTimer);
    });
    
    resetTimer();
}

// Exporter les fonctions pour une utilisation globale
window.logout = logout;
window.forceLogout = forceLogout;
window.checkAuthentication = checkAuthentication;
window.getCurrentUser = getCurrentUser;
window.isSessionExpired = isSessionExpired;
window.refreshSession = refreshSession;
window.initAutoLogout = initAutoLogout;