/**
 * NetInsight 360 — Gestionnaire des modes d'affichage cartographique
 * ─────────────────────────────────────────────────────────────────────
 * Fournit 4 modes d'affichage pour toutes les cartes Leaflet du projet :
 *
 *  1. cluster     — Marqueurs regroupés par proximité géographique (défaut)
 *  2. individual  — Un marqueur visible par site, sans regroupement
 *  3. heatmap     — Carte de chaleur : zones rouges = KPI dégradés
 *  4. choropleth  — Régions colorées par KPI moyen par pays
 *
 * Usage dans chaque page :
 *   const mgr = new MapModeManager(leafletMap, (s) => Number(s.kpi_global || 0));
 *   // Lors d'un changement de mode :
 *   await mgr.renderMode('heatmap', sitesArray);
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Fonctions utilitaires (partagées, sans état)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne la couleur de remplissage pour la choroplèthe selon le KPI moyen.
 * Utilise les mêmes seuils que le reste de l'application (95 / 90).
 * @param {number} avgKpi - Valeur de santé 0-100
 * @returns {string} Couleur HEX
 */
function choroplethColor(avgKpi) {
    if (avgKpi >= 95) return '#10b981'; // vert   — bon
    if (avgKpi >= 90) return '#f59e0b'; // orange — alerte
    return '#ef4444';                   // rouge  — critique
}

/**
 * Calcule la santé moyenne et le nombre de sites pour un pays donné.
 * @param {Array}    sites       - Tableau de sites chargés
 * @param {string}   countryCode - Code ISO-2 (ex: 'CI', 'BJ')
 * @param {Function} getHealth   - Callback (site) => number retournant 0-100
 * @returns {{ avg: number, count: number }}
 */
function computeCountryStats(sites, countryCode, getHealth) {
    // Normaliser le code pays en majuscule pour éviter les mismatch de casse
    const code = countryCode.toUpperCase();
    const filtered = sites.filter(s =>
        (s.country_code || s.country || '').toUpperCase() === code
    );
    if (!filtered.length) return { avg: 0, count: 0 };
    const avg = filtered.reduce((sum, s) => sum + getHealth(s), 0) / filtered.length;
    return { avg, count: filtered.length };
}


// ─────────────────────────────────────────────────────────────────────────────
// Classe principale MapModeManager
// ─────────────────────────────────────────────────────────────────────────────

class MapModeManager {
    /**
     * @param {Object}   map          - Instance L.map Leaflet à piloter
     * @param {Function} getHealth    - Callback (site) => number — santé 0-100 d'un site
     *                                  Par défaut : utilise kpi_global ou health_score
     * @param {string}  [geojsonBase] - URL de base de l'endpoint GeoJSON pays
     */
    constructor(map, getHealth, geojsonBase = '../netinsight360-backend/api/map/get-country-border.php') {
        this.map         = map;
        this.getHealth   = getHealth || ((s) => Number(s.kpi_global || s.health_score || 0));
        this.geojsonBase = geojsonBase;

        /** @type {Object|null} Couche Leaflet.heat active */
        this.heatLayer = null;

        /** @type {Array} Couches GeoJSON choroplèthe actives */
        this.choroplethLayers = [];

        /** @type {HTMLElement|null} Légende flottante choroplèthe */
        this.choroplethLegend = null;
    }

    // ─── Nettoyage ─────────────────────────────────────────────────────────

    /**
     * Supprime toutes les couches gérées par ce manager (heatmap + choroplèthe).
     * Les marqueurs individuels / clusters sont gérés par la page appelante.
     */
    clearManagedLayers() {
        // Retirer la heatmap de la carte et libérer la référence
        if (this.heatLayer) {
            try { this.map.removeLayer(this.heatLayer); } catch (_) {}
            this.heatLayer = null;
        }

        // Retirer toutes les couches GeoJSON choroplèthe
        this.choroplethLayers.forEach(l => {
            try { this.map.removeLayer(l); } catch (_) {}
        });
        this.choroplethLayers = [];

        // Retirer le panneau de légende choroplèthe du DOM
        if (this.choroplethLegend && this.choroplethLegend.parentNode) {
            this.choroplethLegend.parentNode.removeChild(this.choroplethLegend);
            this.choroplethLegend = null;
        }
    }

    // ─── Mode Heatmap ──────────────────────────────────────────────────────

    /**
     * Applique le mode heatmap sur la carte.
     *
     * Prérequis : Leaflet.heat doit être chargé (CDN ajouté dans le <head>).
     * Les zones "chaudes" (rouges) correspondent aux sites avec les KPIs les plus bas.
     * L'intensité de chaque point est calculée comme : (100 - kpi) / 100
     * → KPI 0% = intensité maximale (rouge foncé)
     * → KPI 100% = intensité minimale (bleu-vert)
     *
     * @param {Array} sites - Sites avec latitude, longitude, kpi_global
     */
    applyHeatmap(sites) {
        if (typeof L.heatLayer === 'undefined') {
            console.warn('[MapModes] Leaflet.heat non chargé — mode heatmap indisponible');
            return;
        }

        // Construire les triplets [lat, lng, intensité] pour Leaflet.heat
        const points = sites
            .filter(s => {
                const lat = Number(s.latitude), lng = Number(s.longitude);
                // Ignorer les sites sans coordonnées ou avec (0,0) par défaut
                return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
            })
            .map(s => {
                const health    = this.getHealth(s);
                // Intensité inversée : un mauvais KPI génère une tache rouge plus forte
                const intensity = Math.max(0, Math.min(1, (100 - health) / 100));
                return [Number(s.latitude), Number(s.longitude), intensity];
            });

        this.heatLayer = L.heatLayer(points, {
            radius:  40,   // Rayon de diffusion de chaque point (pixels)
            blur:    22,   // Niveau de flou pour adoucir les zones
            maxZoom: 12,   // Zoom max au-delà duquel les points restent ponctuels
            // Dégradé de couleurs : froid (bon) → chaud (critique)
            gradient: {
                0.0: '#10b981', // vert   — bon
                0.4: '#f59e0b', // orange — alerte
                0.7: '#ef4444', // rouge  — critique
                1.0: '#7f1d1d'  // rouge foncé — très critique
            }
        }).addTo(this.map);
    }

    // ─── Mode Choroplèthe ──────────────────────────────────────────────────

    /**
     * Crée et attache au container de la carte un panneau de légende choroplèthe.
     * Ce panneau explique le code couleur des régions.
     * @private
     */
    _createChoroplethLegend() {
        const container = this.map.getContainer();
        const div = document.createElement('div');
        div.className = 'map-choropleth-legend';

        // Style inline pour éviter une dépendance CSS externe supplémentaire
        div.style.cssText = [
            'position:absolute', 'bottom:44px', 'right:12px',
            'z-index:1000',
            'background:rgba(255,255,255,0.96)',
            'padding:11px 15px',
            'border-radius:10px',
            'box-shadow:0 2px 14px rgba(0,0,0,0.20)',
            'font-family:Inter,Segoe UI,Arial,sans-serif',
            'font-size:0.82rem',
            'min-width:175px',
            'pointer-events:none'      // N'interfère pas avec les clics sur la carte
        ].join(';');

        div.innerHTML = `
            <div style="font-weight:700;margin-bottom:8px;color:#1e293b">
                <i class="bi bi-map-fill"></i>&nbsp; KPI moyen / pays
            </div>
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
                <span style="width:13px;height:13px;border-radius:3px;background:#10b981;display:inline-block;flex-shrink:0"></span>
                <span>Bon (&ge;&nbsp;95&nbsp;%)</span>
            </div>
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
                <span style="width:13px;height:13px;border-radius:3px;background:#f59e0b;display:inline-block;flex-shrink:0"></span>
                <span>Alerte (90–95&nbsp;%)</span>
            </div>
            <div style="display:flex;align-items:center;gap:7px">
                <span style="width:13px;height:13px;border-radius:3px;background:#ef4444;display:inline-block;flex-shrink:0"></span>
                <span>Critique (&lt;&nbsp;90&nbsp;%)</span>
            </div>
        `;
        container.appendChild(div);
        this.choroplethLegend = div;
    }

    /**
     * Dessine les polygones GeoJSON des pays avec un remplissage coloré
     * selon le KPI moyen calculé à partir des sites.
     *
     * @param {Array} entries - [{ code, name, geojson, avg, count }]
     */
    applyChoropleth(entries) {
        // Créer la légende flottante avant de dessiner les régions
        this._createChoroplethLegend();

        entries.forEach(({ code, name, geojson, avg, count }) => {
            if (!geojson?.type) return; // Ignorer les GeoJSON invalides

            const color = choroplethColor(avg);

            const layer = L.geoJSON(geojson, {
                style: {
                    color:       '#ffffff', // Bordure blanche entre les pays
                    weight:      2,
                    opacity:     1,
                    fillColor:   color,
                    fillOpacity: 0.58      // Semi-transparent pour laisser voir le fond de carte
                }
            });

            // Popup interactif au clic sur un pays
            layer.bindPopup(`
                <div style="min-width:175px;font-family:Inter,Segoe UI,Arial,sans-serif">
                    <div style="font-weight:700;margin-bottom:6px">
                        <i class="bi bi-flag"></i>&nbsp; ${name || code}
                    </div>
                    <div><b>KPI moyen&nbsp;:</b>
                        <span style="color:${color};font-weight:700">${avg.toFixed(1)}&nbsp;%</span>
                    </div>
                    <div><b>Sites&nbsp;:</b> ${count}</div>
                    <div style="margin-top:6px;font-size:0.8rem;color:#64748b">
                        ${avg >= 95 ? '✅ Bon' : (avg >= 90 ? '⚠️ Alerte' : '🔴 Critique')}
                    </div>
                </div>
            `);

            layer.addTo(this.map);
            this.choroplethLayers.push(layer);
        });
    }

    /**
     * Charge les GeoJSON des pays en parallèle, calcule les KPI moyens
     * depuis les sites déjà chargés, puis dessine la choroplèthe.
     *
     * @param {Array}    sites      - Sites déjà chargés depuis l'API
     * @param {string[]} [countries] - Codes pays à afficher (défaut : les 4 pays du réseau)
     */
    async buildChoropleth(sites, countries = ['CI', 'NE', 'BJ', 'TG']) {
        // Noms d'affichage complets des pays
        const countryNames = {
            CI: "Côte d'Ivoire",
            NE: 'Niger',
            BJ: 'Bénin',
            TG: 'Togo'
        };

        // Charger tous les GeoJSON en parallèle pour minimiser le temps d'attente
        const requests = countries.map(async (code) => {
            try {
                const res = await fetch(`${this.geojsonBase}?cc=${encodeURIComponent(code)}`);
                if (!res.ok) return null;
                const geojson = await res.json();
                if (!geojson?.type) return null;

                // Calculer le KPI moyen et le nombre de sites pour ce pays
                const { avg, count } = computeCountryStats(sites, code, this.getHealth);
                return { code, name: countryNames[code] || code, geojson, avg, count };
            } catch (e) {
                // Ne pas bloquer si un pays est indisponible
                console.warn(`[MapModes] GeoJSON ${code} non disponible :`, e);
                return null;
            }
        });

        const results = (await Promise.all(requests)).filter(Boolean);
        if (results.length) this.applyChoropleth(results);
    }
}
