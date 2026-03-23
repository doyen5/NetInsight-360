/**
 * NetInsight 360 - Application principale
 * Supervisez. Analysez. Optimisez.
 * 
 * Initialise l'animation réseau de fond et vérifie la session
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialiser l'animation réseau de fond
    initNetworkAnimation();
    
    // Vérifier l'authentification sur les pages protégées
    const protectedPages = ['dashboard.html', 'kpis-ran.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (protectedPages.includes(currentPage)) {
        checkAuthAndRedirect();
    }
});

/**
 * Vérifie l'authentification et redirige si nécessaire
 */
function checkAuthAndRedirect() {
    const currentUser = sessionStorage.getItem('currentUser');
    if (!currentUser) {
        console.log('[NetInsight 360] Utilisateur non authentifié, redirection vers login');
        window.location.href = 'index.html';
        return false;
    }
    
    // Vérifier l'expiration de session
    try {
        const user = JSON.parse(currentUser);
        const loginTime = new Date(user.loggedInAt);
        const now = new Date();
        const hoursSinceLogin = (now - loginTime) / (1000 * 60 * 60);
        
        if (hoursSinceLogin > 8) {
            console.log('[NetInsight 360] Session expirée, redirection vers login');
            sessionStorage.clear();
            window.location.href = 'index.html';
            return false;
        }
    } catch (e) {
        console.error('Erreur lors de la vérification de session', e);
    }
    
    return true;
}

/**
 * Animation réseau de fond
 */
function initNetworkAnimation() {
    const canvas = document.getElementById('networkCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];

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
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => { p.update(); p.draw(); });
        drawConnections();
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => initNetwork());
    initNetwork();
    animate();
}