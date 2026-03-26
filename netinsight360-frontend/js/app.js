/**
 * NetInsight 360 - Application principale
 * Supervisez. Analysez. Optimisez.
 * 
 * Initialisation globale, vérification d'authentification, animations,
 * gestion de la date/heure et affichage de la dernière connexion
 */

document.addEventListener('DOMContentLoaded', async function() {
    // Vérifier l'authentification sur les pages protégées
    const protectedPages = ['dashboard.html', 'kpis-ran.html', 'kpis-core.html', 
                            'map-view.html', 'users-management.html', 'alerts.html',
                            'dashboard.php', 'kpis-ran.php', 'kpis-core.php',
                            'map-view.php', 'users-management.php', 'alerts.php'];
    const currentPage = window.location.pathname.split('/').pop();
    
    // Si on est sur une page protégée
    if (protectedPages.includes(currentPage)) {
        const isAuthenticated = await checkAuthentication();
        if (!isAuthenticated) return;
        
        // Mettre à jour l'interface utilisateur (nom, avatar, rôle, dernière connexion)
        await updateUserInterface();
        
        // Initialiser la gestion de déconnexion
        if (typeof initLogoutHandler === 'function') {
            initLogoutHandler();
        }
        
        // Initialiser la date/heure
        initDateTime();
    }
    
    // Animation réseau de fond (uniquement sur la page de connexion)
    if (currentPage === 'index.html' || currentPage === 'index.php' || currentPage === '' || currentPage === 'login.html' || currentPage === 'login.php') {
        initNetworkAnimation();
    }
});

/**
 * Initialise l'affichage de la date et heure en temps réel
 * Met à jour toutes les secondes
 */
function initDateTime() {
    const dateTimeEl = document.getElementById('currentDateTime');
    if (!dateTimeEl) {
        console.warn('[App] Élément currentDateTime non trouvé');
        return;
    }
    
    /**
     * Met à jour l'affichage de la date et heure
     */
    function updateDateTime() {
        const now = new Date();
        
        // Formatage de la date et heure en français
        const options = { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        };
        
        const formattedDate = now.toLocaleDateString('fr-FR', options);
        dateTimeEl.innerHTML = `<i class="bi bi-calendar3"></i> ${formattedDate}`;
    }
    
    // Mise à jour immédiate
    updateDateTime();
    
    // Mise à jour toutes les secondes
    setInterval(updateDateTime, 1000);
}

/**
 * Initialise l'animation réseau de fond (canvas)
 */
function initNetworkAnimation() {
    const canvas = document.getElementById('networkCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    let animationFrameId = null;
    
    class Particle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.radius = Math.random() * 2 + 1;
            this.alpha = Math.random() * 0.5 + 0.2;
        }
        
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0) this.x = width;
            if (this.x > width) this.x = 0;
            if (this.y < 0) this.y = height;
            if (this.y > height) this.y = 0;
        }
        
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 163, 196, ${this.alpha})`;
            ctx.fill();
        }
    }
    
    function initNetwork() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        particles = [];
        const count = Math.min(100, Math.floor(width * height / 10000));
        for (let i = 0; i < count; i++) {
            particles.push(new Particle(Math.random() * width, Math.random() * height));
        }
    }
    
    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    const opacity = (1 - dist / 120) * 0.25;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(0, 163, 196, ${opacity})`;
                    ctx.lineWidth = 0.8;
                    ctx.stroke();
                }
            }
        }
    }
    
    function animate() {
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => { p.update(); p.draw(); });
        drawConnections();
        animationFrameId = requestAnimationFrame(animate);
    }
    
    // Redimensionnement de la fenêtre
    window.addEventListener('resize', () => {
        initNetwork();
    });
    
    // Nettoyer l'animation lors de la fermeture de la page
    window.addEventListener('beforeunload', () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    });
    
    initNetwork();
    animate();
}

/**
 * Met à jour l'interface utilisateur avec les informations de l'utilisateur connecté
 * Affiche le nom, l'avatar, le rôle et la dernière connexion
 */
async function updateUserInterface() {
    const user = getCurrentUser();
    if (!user) {
        console.warn('[App] Aucun utilisateur trouvé dans sessionStorage');
        return;
    }
    
    // Mettre à jour le nom dans le message de bienvenue
    const userNameEl = document.getElementById('userName');
    const headerUserNameEl = document.getElementById('headerUserName');
    if (userNameEl) userNameEl.innerText = user.name;
    if (headerUserNameEl) headerUserNameEl.innerText = user.name;
    
    // Générer les initiales pour l'avatar
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    const userAvatarEl = document.getElementById('userAvatar');
    if (userAvatarEl) userAvatarEl.innerText = initials;
    
    // Afficher le rôle de l'utilisateur
    const roleMap = {
        'ADMIN': 'Administrateur',
        'FO_NPM': 'Agent Superviseur',
        'FO_CORE_RAN': 'Agent Partageur',
        'CUSTOMER': 'Agent Visualiseur'
    };
    const headerUserRoleEl = document.getElementById('headerUserRole');
    if (headerUserRoleEl) headerUserRoleEl.innerText = roleMap[user.role] || 'Utilisateur';
    
    // Afficher la dernière connexion
    const lastLoginEl = document.getElementById('lastLogin');
    if (lastLoginEl) {
        if (user.last_login) {
            try {
                const lastLoginDate = new Date(user.last_login);
                const formattedLastLogin = lastLoginDate.toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                lastLoginEl.innerHTML = `<i class="bi bi-clock-history"></i> Dernière connexion: ${formattedLastLogin}`;
                lastLoginEl.style.display = 'flex';
                lastLoginEl.style.alignItems = 'center';
                lastLoginEl.style.gap = '4px';
                lastLoginEl.style.fontSize = '0.7rem';
                lastLoginEl.style.color = '#94a3b8';
                lastLoginEl.style.marginTop = '2px';
            } catch (e) {
                console.warn('[App] Erreur formatage dernière connexion:', e);
                lastLoginEl.innerHTML = '<i class="bi bi-clock-history"></i> Dernière connexion: non disponible';
            }
        } else {
            lastLoginEl.innerHTML = '<i class="bi bi-clock-history"></i> Première connexion';
            lastLoginEl.style.display = 'flex';
            lastLoginEl.style.alignItems = 'center';
            lastLoginEl.style.gap = '4px';
            lastLoginEl.style.fontSize = '0.7rem';
            lastLoginEl.style.color = '#94a3b8';
            lastLoginEl.style.marginTop = '2px';
        }
    }
    
    // Appliquer les restrictions selon le rôle
    if (typeof applyRoleRestrictions === 'function') {
        applyRoleRestrictions(user.role);
    }
    
    console.log(`[App] Interface mise à jour pour: ${user.name} (${user.role})`);
}