/**
 * NetInsight 360 - Module API
 * Supervisez. Analysez. Optimisez.
 * 
 * Ce module simule les appels API vers le backend.
 * Plus tard, il sera remplacé par de vrais appels fetch().
 */

const API = (function() {
    // Données simulées
    let sitesData = [];
    let usersData = [];
    let kpisRanData = [];
    let kpisCoreData = [];

    // Initialisation avec des données factices (sera chargé depuis le serveur plus tard)
    function initMockData() {
        // Données des pays
        const countries = {
            CI: { name: "Côte d'Ivoire", center: [6.9, -5.5], zoom: 7 },
            NE: { name: "Niger", center: [14.5, 6.0], zoom: 6 },
            TG: { name: "Togo", center: [7.0, 1.2], zoom: 7 },
            BJ: { name: "Bénin", center: [7.5, 2.5], zoom: 7 },
            CF: { name: "Centrafrique", center: [5.5, 18.5], zoom: 7 }
        };

        // Sites (exemple)
        sitesData = [
            { id: "ET763", name: "TOUMODI", lat: 6.56322, lng: -5.03261, vendor: "Huawei", tech: "4G", kpi: 97.2, packetLoss: 0.5, domain: "RAN", country: "CI", status: "good" },
            { id: "ET300", name: "KOTOULA", lat: 10.1405, lng: -7.39811, vendor: "Huawei", tech: "2G", kpi: 89.5, packetLoss: 1.5, domain: "RAN", country: "CI", status: "critical" },
            // ... ajouter d'autres sites selon les données précédentes
        ];

        // Utilisateurs
        usersData = [
            { id: 1, name: "Prince Désiré", email: "admin@netinsight360.com", role: "ADMIN", createdAt: "2024-01-15" },
            { id: 2, name: "FO_NPM", email: "npm@netinsight360.com", role: "FO_NPM", createdAt: "2024-02-10" }
        ];

        // KPIs RAN (exemple)
        kpisRanData = [
            { name: "RNA", value: 99.3, target: 99.5, unit: "%", status: "warning" },
            { name: "TCH Availability", value: 99.1, target: 99, unit: "%", status: "good" }
        ];
    }

    // Appel API générique
    async function call(endpoint, method = 'GET', data = null) {
        // Simulation de délai réseau
        await new Promise(resolve => setTimeout(resolve, 300));

        // Ici, on pourrait faire un vrai fetch vers le backend
        // Pour l'instant, on retourne des données mockées selon l'endpoint
        switch(endpoint) {
            case '/api/auth/login':
                // Simuler login
                if (data.email === 'admin@netinsight360.com' && data.password === 'admin123') {
                    return { success: true, user: { name: 'Prince Désiré', role: 'ADMIN' } };
                }
                return { success: false, error: 'Invalid credentials' };
            case '/api/sites':
                return { success: true, data: sitesData };
            case '/api/sites/top-worst':
                return { success: true, data: { top: sitesData.slice(0,5), worst: sitesData.slice(-5) } };
            case '/api/kpis/ran':
                return { success: true, data: kpisRanData };
            case '/api/kpis/core':
                return { success: true, data: kpisCoreData };
            case '/api/users':
                return { success: true, data: usersData };
            default:
                return { success: false, error: 'Endpoint not found' };
        }
    }

    // Exposer les méthodes publiques
    return {
        initMockData,
        call,
        // Méthodes spécifiques pour faciliter l'utilisation
        login: (email, password) => call('/api/auth/login', 'POST', { email, password }),
        getSites: () => call('/api/sites'),
        getTopWorstSites: () => call('/api/sites/top-worst'),
        getRanKpis: () => call('/api/kpis/ran'),
        getCoreKpis: () => call('/api/kpis/core'),
        getUsers: () => call('/api/users'),
        createUser: (user) => call('/api/users', 'POST', user),
        deleteUser: (id) => call(`/api/users/${id}`, 'DELETE')
    };
})();

// Initialiser les données mockées au chargement
API.initMockData();