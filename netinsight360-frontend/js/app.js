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
/**
 * Initialise l'animation de fond : pluie de code + réseau de particules
 */
function initNetworkAnimation() {
    const canvas = document.getElementById('networkCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let W, H;
    let rafId = null;

    // ── Caractères "code réseau" ─────────────────────────────────────────────
    const CODE_CHARS =
        '01アイウエオカキクケコABCDEF0123456789' +
        '><{}[]!#%?@∑∆πΩ∞≠≡→↓⇒⟶::==/\\|' +
        'SIGNAL PING DROP LOSS ACK SYN RST KPI' +
        '§░▒▓█▄▀■□●○';

    // ── Colonnes de pluie ────────────────────────────────────────────────────
    const COL_W = 18;       // largeur d'une colonne en px
    let columns = [];

    class RainDrop {
        constructor(x) {
            this.x      = x;
            this.y      = Math.random() * -500;          // départ hors écran
            this.speed  = 1.5 + Math.random() * 3.5;
            this.len    = 8  + Math.floor(Math.random() * 18);   // nb de chars
            this.chars  = [];
            this.timer  = 0;
            this.mutate = 3 + Math.floor(Math.random() * 8);     // frames entre mutations
            this.hue    = Math.random() < 0.15 ? 180 : 195;      // cyan ou vert-bleu rare
            this._genChars();
        }

        _genChars() {
            this.chars = Array.from({ length: this.len }, () =>
                CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
            );
        }

        update() {
            this.y += this.speed;
            this.timer++;
            // Muter un char aléatoire périodiquement
            if (this.timer % this.mutate === 0) {
                const idx = Math.floor(Math.random() * this.chars.length);
                this.chars[idx] = CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
            }
            // Réinitialiser quand sorti de l'écran
            if (this.y - this.len * COL_W > H) {
                this.y     = Math.random() * -200;
                this.speed = 1.5 + Math.random() * 3.5;
                this.len   = 8 + Math.floor(Math.random() * 18);
                this._genChars();
            }
        }

        draw() {
            ctx.font = `bold 13px 'Courier New', monospace`;
            for (let i = 0; i < this.chars.length; i++) {
                const cy = this.y - i * COL_W;
                if (cy < -COL_W || cy > H + COL_W) continue;

                let alpha, color;
                if (i === 0) {
                    // Tête de colonne : blanc brillant
                    alpha = 1;
                    color = `rgba(200, 240, 255, ${alpha})`;
                    // Halo autour de la tête
                    ctx.shadowColor = `rgba(0, 212, 255, 0.9)`;
                    ctx.shadowBlur  = 10;
                } else {
                    // Queue : dégradé cyan → transparent
                    alpha = (1 - i / this.chars.length) * 0.85;
                    color = `hsla(${this.hue}, 100%, 65%, ${alpha})`;
                    ctx.shadowBlur = 0;
                }
                ctx.fillStyle = color;
                ctx.fillText(this.chars[i], this.x, cy);
            }
            ctx.shadowBlur = 0;
        }
    }

    // ── Particules réseau ────────────────────────────────────────────────────
    let particles = [];

    class Particle {
        constructor() {
            this.reset(true);
        }
        reset(random) {
            this.x     = random ? Math.random() * W : (Math.random() < 0.5 ? 0 : W);
            this.y     = random ? Math.random() * H : Math.random() * H;
            this.vx    = (Math.random() - 0.5) * 0.4;
            this.vy    = (Math.random() - 0.5) * 0.4;
            this.r     = 1 + Math.random() * 2;
            this.alpha = 0.15 + Math.random() * 0.35;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset(false);
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 163, 196, ${this.alpha})`;
            ctx.shadowColor = 'rgba(0, 212, 255, 0.4)';
            ctx.shadowBlur  = 6;
            ctx.fill();
            ctx.shadowBlur  = 0;
        }
    }

    function drawConnections() {
        const MAX_DIST = 130;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx   = particles[i].x - particles[j].x;
                const dy   = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < MAX_DIST) {
                    const op = (1 - dist / MAX_DIST) * 0.18;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(0, 163, 196, ${op})`;
                    ctx.lineWidth   = 0.7;
                    ctx.stroke();
                }
            }
        }
    }

    // ── Init ─────────────────────────────────────────────────────────────────
    function init() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;

        // Colonnes de pluie
        const numCols = Math.floor(W / COL_W);
        columns = Array.from({ length: numCols }, (_, i) => new RainDrop(i * COL_W + COL_W / 2));

        // Particules réseau
        const numParts = Math.min(80, Math.floor(W * H / 12000));
        particles = Array.from({ length: numParts }, () => new Particle());
    }

    // ── Boucle principale ────────────────────────────────────────────────────
    function animate() {
        // Fond semi-transparent → trainée sombre derrière la pluie
        ctx.fillStyle = 'rgba(9, 14, 28, 0.22)';
        ctx.fillRect(0, 0, W, H);

        // 1. Connexions réseau (derrière tout)
        drawConnections();

        // 2. Particules
        particles.forEach(p => { p.update(); p.draw(); });

        // 3. Pluie de code (devant)
        columns.forEach(c => { c.update(); c.draw(); });

        rafId = requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => {
        if (rafId) cancelAnimationFrame(rafId);
        init();
        animate();
    });
    window.addEventListener('beforeunload', () => {
        if (rafId) cancelAnimationFrame(rafId);
    });

    init();
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
        'FO_ANALYSTE': 'Agent Analyste',
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