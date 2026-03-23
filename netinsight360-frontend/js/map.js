/**
 * NetInsight 360 - Module Carte
 * Supervisez. Analysez. Optimisez.
 * 
 * Ce module initialise et gère la carte Leaflet avec les marqueurs des sites.
 */

let map;
let currentMarkers = [];

/**
 * Initialise la carte Leaflet
 */
function initMap() {
    if (map) return;
    
    map = L.map('map').setView([10.0, 5.0], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
    }).addTo(map);
}

/**
 * Met à jour les marqueurs sur la carte selon les filtres
 * @param {object} filters - Objet contenant les filtres (country, vendor, tech, domain)
 */
async function updateMapMarkers(filters = {}) {
    // Supprimer les marqueurs existants
    currentMarkers.forEach(marker => map.removeLayer(marker));
    currentMarkers = [];

    // Récupérer les sites (depuis l'API ou les données locales)
    let sites = await getFilteredSites(filters);
    
    if (filters.country && filters.country !== 'all') {
        const countryData = getCountryData(filters.country);
        if (countryData) {
            map.flyTo(countryData.center, countryData.zoom, { duration: 1.2 });
        }
    }
    
    // Ajouter les marqueurs
    sites.forEach(site => {
        let color = site.status === 'good' ? '#10b981' : (site.status === 'warning' ? '#f59e0b' : '#ef4444');
        let icon = L.divIcon({
            html: `<div style="background:${color}; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 0 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [12, 12],
            className: 'site-marker'
        });
        
        let marker = L.marker([site.lat, site.lng], { icon }).addTo(map);
        marker.bindPopup(`
            <b>${site.name}</b><br>
            <b>ID:</b> ${site.id}<br>
            <b>Pays:</b> ${site.countryName}<br>
            <b>Vendor:</b> ${site.vendor} | Tech: ${site.tech}<br>
            <b>KPI Global:</b> ${site.kpi}%<br>
            <b>Status:</b> <span class="badge bg-${site.status === 'good' ? 'success' : (site.status === 'warning' ? 'warning' : 'danger')}">${site.status}</span><br>
            <button class="btn btn-sm btn-primary mt-2" onclick="window.showSiteDetails('${site.id}')">Voir détails</button>
        `);
        marker.siteId = site.id;
        currentMarkers.push(marker);
    });
}

/**
 * Récupère les sites filtrés (simulation)
 */
async function getFilteredSites(filters) {
    // Ici on récupérerait depuis l'API, mais pour l'instant on utilise window.sitesData défini ailleurs
    let sites = window.sitesData || [];
    
    if (filters.country && filters.country !== 'all') {
        sites = sites.filter(s => s.country === filters.country);
    }
    if (filters.vendor && filters.vendor !== 'all') {
        sites = sites.filter(s => s.vendor === filters.vendor);
    }
    if (filters.tech && filters.tech !== 'all') {
        sites = sites.filter(s => s.tech === filters.tech);
    }
    if (filters.domain && filters.domain !== 'all') {
        sites = sites.filter(s => s.domain === filters.domain);
    }
    
    return sites;
}

/**
 * Retourne les données d'un pays
 */
function getCountryData(countryCode) {
    const countries = {
        CI: { name: "Côte d'Ivoire", center: [6.9, -5.5], zoom: 7 },
        NE: { name: "Niger", center: [14.5, 6.0], zoom: 6 },
        TG: { name: "Togo", center: [7.0, 1.2], zoom: 7 },
        BJ: { name: "Bénin", center: [7.5, 2.5], zoom: 7 },
        CF: { name: "Centrafrique", center: [5.5, 18.5], zoom: 7 }
    };
    return countries[countryCode];
}