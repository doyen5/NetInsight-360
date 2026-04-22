/**
 * admin-tools.js
 * Page Outils Administrateur — NetInsight 360
 *
 * Cette page est réservée aux administrateurs et propose deux fonctionnalités :
 *  1) Gestion des imports RAN : visualisation du statut du dernier import,
 *     déclenchement manuel d'un import et consultation du log d'exécution.
 *  2) Journal d'audit : tableau paginé listant toutes les actions critiques
 *     effectuées dans l'application (création d'utilisateurs, imports, etc.).
 *
 * Architecture :
 *  - initAdminTools()     : point d'entrée appelé au chargement de la page
 *  - loadImportStatus()   : récupère et affiche l'état du dernier import RAN
 *  - triggerImport()      : déclenche un import manuel via API et surveille sa fin
 *  - setImportRunning()   : bascule l'état visuel du bouton d'import
 *  - loadAuditLogs()      : charge et affiche le journal d'audit paginé avec filtres
 *  - renderAuditRow()     : génère le HTML d'une ligne du tableau d'audit
 *  - renderPagination()   : génère les boutons de pagination pour l'audit
 *  - buildStatCard()      : helper — crée une carte de statistique import
 *  - colorizeLog()        : colorie les mots-clés ERROR/WARNING/SUCCESS dans le log
 *  - setupHeader()        : affiche nom/avatar/rôle de l'utilisateur connecté + horloge
 *  - setupLogoutModal()   : gère la modale de confirmation de déconnexion
 *  - setupMenuToggle()    : gère l'ouverture/fermeture du menu sidebar mobile
 */

// Page courante de pagination pour les logs d'audit
let _auditPage    = 1;

// Filtres courants appliqués sur le tableau d'audit
let _auditFilters = {};

// Timer de polling utilisé pour surveiller la fin d'un import en cours
let _pollTimer       = null;

// Indique que le polling a expiré (2 min) sans confirmation de fin d'import.
// Empêche loadImportStatus() de redésactiver le bouton via le setInterval.
let _pollingExpired  = false;

// Mode d'import déclenché depuis l'UI (global, 2G, 3G, 4G)
// Utilisé pour afficher un indicateur visuel sur le bouton exact lancé.
let _activeImportMode = null;

/* ============================================================
   POINT D'ENTRÉE
   Appelé dans admin-tools.php via : initAdminTools()
   Orchestre l'initialisation de tous les composants de la page.
   ============================================================ */
function initAdminTools() {
    // Affiche le nom / avatar / horloge dans le header
    setupHeader();
    // Initialise la modale de déconnexion
    setupLogoutModal();
    // Initialise le bouton d'ouverture du menu sidebar (mobile)
    setupMenuToggle();

    // --- Section Import RAN ---
    // Charge immédiatement l'état du dernier import
    loadImportStatus();
    // Bouton « Rafraîchir » → recharge le statut manuellement
    document.getElementById('refreshStatusBtn').addEventListener('click', loadImportStatus);
    // Bouton « Lancer l'import » → déclenche un import manuel
    document.getElementById('runImportBtn').addEventListener('click', triggerImport);
    // Boutons import par techno
    document.getElementById('runImport2GBtn')?.addEventListener('click', () => triggerTechImport('2G'));
    document.getElementById('runImport3GBtn')?.addEventListener('click', () => triggerTechImport('3G'));
    document.getElementById('runImport4GBtn')?.addEventListener('click', () => triggerTechImport('4G'));

    // --- Section Qualité des données + Traçabilité imports ---
    loadDataHealth();
    loadImportRuns();
    document.getElementById('refreshDataHealthBtn')?.addEventListener('click', loadDataHealth);
    document.getElementById('refreshImportRunsBtn')?.addEventListener('click', () => loadImportRuns());
    document.getElementById('importRunsSearch')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadImportRuns();
    });
    document.getElementById('compareRunsBtn')?.addEventListener('click', compareImportRuns);

    // --- Section Audit ---
    // Charge la première page des logs d'audit sans filtre
    loadAuditLogs(1, {});
    // Bouton « Appliquer les filtres » → relit les valeurs des champs et relance le chargement
    document.getElementById('auditApplyBtn').addEventListener('click', () => {
        _auditFilters = {
            action:    document.getElementById('auditFilterAction').value,
            search:    document.getElementById('auditSearch').value.trim(),
            date_from: document.getElementById('auditDateFrom').value,
            date_to:   document.getElementById('auditDateTo').value,
        };
        loadAuditLogs(1, _auditFilters);
    });

    // Actualisation automatique du statut d'import toutes les 30 secondes
    // (pour détecter si un import planifié ou automatique vient de se terminer)
    setInterval(loadImportStatus, 30000);
    // Rafraîchissement plus lent des indicateurs de gouvernance (qualité + traçabilité).
    setInterval(() => {
        loadDataHealth();
        loadImportRuns();
    }, 60000);
}

/* ============================================================
   IMPORT RAN — Statut et déclenchement
   ============================================================ */

/**
 * loadImportStatus()
 *
 * Appelle API.getImportStatus() (→ api/import/get-import-status.php) et
 * met à jour l'affichage de la section « Statut du dernier import » :
 *
 *  - Badge « Import en cours... » (spinner) ou « Prêt » (vert)
 *  - Cartes de statistiques : date du dernier import, nombre de sites RAN,
 *    nombre d'enregistrements, répartition 2G/3G/4G
 *  - Zone de log terminal : texte brut colorisé (ERROR en rouge, SUCCESS en vert…)
 *  - Historique des 5 derniers imports manuels déclenchés depuis cette page
 *
 * Si l'import est détecté comme en cours (d.is_running = true), le bouton
 * « Lancer l'import » est désactivé pour éviter un double déclenchement.
 *
 * Appelée : au chargement, au clic sur « Rafraîchir », et toutes les 30 s (setInterval).
 */
async function loadImportStatus() {
    const area = document.getElementById('importStatusArea');
    const logBox = document.getElementById('importLogBox');
    const auditList = document.getElementById('auditImportList');
    const msg = document.getElementById('importMsg');

    try {
        const res = await API.getImportStatus();
        if (!res.success) {
            area.innerHTML = `<div class="text-danger"><i class="bi bi-exclamation-circle"></i> ${res.message || res.error || 'Erreur API'}</div>`;
            // En cas d'échec du statut, on évite de laisser l'UI verrouillée indéfiniment.
            setImportRunning(false);
            return { ok: false, isRunning: false };
        }
        const d = res.data;

        // Statut running
        const runningBadge = d.is_running
            ? `<span class="badge bg-warning text-dark"><span class="spinner-border spinner-border-sm me-1"></span>Import en cours...</span>`
            : `<span class="badge bg-success">Prêt</span>`;

        // Stats KPIs RAN
        const ran = d.kpis_ran || {};
        area.innerHTML = `
            <div class="d-flex align-items-center gap-2 mb-3">${runningBadge}</div>
            <div class="row g-2">
                ${buildStatCard('Dernier import', formatDate(d.last_import_datetime || ran.last_date) || '—', 'bi-calendar-check')}
                ${buildStatCard('Sites RAN',      ran.sites    ?? '—', 'bi-wifi')}
                ${buildStatCard('Enregistrements', ran.records ?? '—', 'bi-database')}
                ${buildStatCard('Bon / Alerte / Critique', `${ran.sites_good??0} / ${ran.sites_warning??0} / ${ran.sites_critical??0}`, 'bi-bar-chart-line')}
            </div>`;

        // Log
        if (d.last_run_log) {
            logBox.innerHTML = colorizeLog(d.last_run_log);
            logBox.scrollTop = logBox.scrollHeight;
        }

        // Historique imports manuels
        if (Array.isArray(d.last_audit) && d.last_audit.length > 0) {
            auditList.innerHTML = d.last_audit.map(a => `
                <div class="d-flex justify-content-between border-bottom py-1">
                    <span>${a.user_email || 'Système'}</span>
                    <span class="text-muted">${formatDate(a.created_at)}</span>
                    <span class="badge audit-badge audit-IMPORT_TRIGGERED">${(a.details || '').match(/\b(2G|3G|4G)\b/i)?.[1]?.toUpperCase() || 'GLOBAL'}</span>
                </div>`).join('');
        } else {
            auditList.innerHTML = '<span class="text-muted">Aucun import manuel récent</span>';
        }

        // Si import en cours → mettre à jour state du bouton
        // (sauf si le polling JS a déjà expiré : on laisse le bouton actif pour retenter)
        if (!d.is_running) { _pollingExpired = false; }
        setImportRunning(d.is_running && !_pollingExpired);
        
        // Si un import vient de se terminer récemment, signale la UI Kpis RAN
        // pour afficher automatiquement le mode "Top by tech" après import.
        // On utilise sessionStorage comme canal de communication entre pages.
        if (d.just_finished) {
            try {
                sessionStorage.setItem('showTopByTechAfterImport', '1');
                // Message informatif pour l'administrateur
                msg.innerHTML = '<span class="text-info"><i class="bi bi-info-circle me-1"></i>Import terminé récemment — la vue KPIs RAN proposera automatiquement les pires sites par techno.</span>';
            } catch (_) {}
        }

        return { ok: true, isRunning: Boolean(d.is_running) };

    } catch (e) {
        area.innerHTML = `<div class="text-danger"><i class="bi bi-wifi-off"></i> Impossible de joindre l'API</div>`;
        setImportRunning(false);
        return { ok: false, isRunning: false };
    }
}

/**
 * triggerImport()
 *
 * Déclenche un import RAN manuel en appelant API.runImport()
 * (→ api/import/run-import.php).
 *
 * Comportement :
 *  1) Désactive le bouton immédiatement (setImportRunning(true)) pour éviter
 *     les doubles clics.
 *  2) Si l'API répond success:true, démarre un polling toutes les 5 secondes
 *     (via setInterval) pour surveiller l'état de l'import.
 *  3) Le polling s'arrête dès que is_running passe à false OU après 24 tentatives
 *     (= 2 minutes maximum), pour ne pas bloquer indéfiniment.
 *  4) En cas d'erreur API, réactive le bouton et affiche un message d'erreur.
 */
async function triggerImport() {
    await triggerImportInternal('global');
}

/**
 * triggerTechImport(tech)
 *
 * Déclenche un import ciblé par technologie (2G/3G/4G) en réutilisant
 * le même mécanisme de lock/polling que l'import global.
 */
async function triggerTechImport(tech) {
    await triggerImportInternal(tech);
}

/**
 * triggerImportInternal(mode)
 *
 * Centralise la logique pour tous les imports (global ou techno):
 * - anti-double clic: tous les boutons d'import sont désactivés
 * - polling de fin d'exécution
 * - message explicite de l'opération en cours
 */
async function triggerImportInternal(mode) {
    const msg = document.getElementById('importMsg');
    msg.innerHTML = '';
    _pollingExpired = false;
    _activeImportMode = mode;
    setImportButtonBusy(mode, true);
    setImportRunning(true);
    const modeLabel = mode === 'global' ? 'global' : mode;
    msg.innerHTML = `<span class="text-primary"><span class="spinner-border spinner-border-sm me-1"></span>Démarrage de l'import ${modeLabel}...</span>`;

    try {
        const res = mode === 'global' ? await API.runImport() : await API.runImportByTech(mode);
        if (res.success) {
            const successLabel = mode === 'global' ? 'global' : mode;
            msg.innerHTML = `<span class="text-success"><i class="bi bi-check-circle me-1"></i>Import ${successLabel} lancé en arrière-plan.</span>`;
            // Polling toutes les 5 s pendant 2 min
            clearInterval(_pollTimer);
            let tries = 0;
            _pollTimer = setInterval(async () => {
                tries++;
                const status = await loadImportStatus();
                // Un seul appel statut par tick. Si l'API échoue, on réessaie jusqu'au timeout.
                if ((status && status.ok && !status.isRunning) || tries >= 24) {
                    clearInterval(_pollTimer);
                    if (tries >= 24 && status?.isRunning) {
                        // Import toujours en cours après 2 min : on libère le bouton
                        // mais on empêche le setInterval(30s) de le re-bloquer
                        _pollingExpired = true;
                        msg.innerHTML = `<span class="text-warning"><i class="bi bi-exclamation-triangle me-1"></i>Import ${modeLabel}: durée maximale atteinte. Vérifiez les logs.</span>`;
                    } else if (tries >= 24 && (!status || !status.ok)) {
                        _pollingExpired = false;
                        msg.innerHTML = `<span class="text-danger"><i class="bi bi-wifi-off me-1"></i>Import ${modeLabel}: statut indisponible, vérifiez les logs puis actualisez.</span>`;
                    } else {
                        _pollingExpired = false;
                        msg.innerHTML = `<span class="text-success"><i class="bi bi-check-circle me-1"></i>Import ${modeLabel} terminé avec succès.</span>`;
                    }
                    setImportButtonBusy(mode, false);
                    _activeImportMode = null;
                    setImportRunning(false);
                }
            }, 5000);
        } else {
            setImportButtonBusy(mode, false);
            _activeImportMode = null;
            setImportRunning(false);
            msg.innerHTML = `<span class="text-danger"><i class="bi bi-x-circle me-1"></i>${res.message || res.error || 'Erreur inconnue'}</span>`;
        }
    } catch (e) {
        setImportButtonBusy(mode, false);
        _activeImportMode = null;
        setImportRunning(false);
        msg.innerHTML = '<span class="text-danger"><i class="bi bi-wifi-off me-1"></i>Erreur API</span>';
    }
}

/**
 * getImportButtonId(mode)
 *
 * Retourne l'id DOM du bouton associé au mode d'import.
 * @param {'global'|'2G'|'3G'|'4G'} mode
 * @returns {string|null}
 */
function getImportButtonId(mode) {
    const map = {
        global: 'runImportBtn',
        '2G': 'runImport2GBtn',
        '3G': 'runImport3GBtn',
        '4G': 'runImport4GBtn'
    };
    return map[mode] || null;
}

/**
 * setImportButtonBusy(mode, busy)
 *
 * Met en évidence le bouton déclenché avec un spinner « En cours... »
 * puis restaure exactement son contenu initial à la fin.
 */
function setImportButtonBusy(mode, busy) {
    const buttonId = getImportButtonId(mode);
    if (!buttonId) return;
    const btn = document.getElementById(buttonId);
    if (!btn) return;

    if (busy) {
        if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
        const label = mode === 'global' ? 'Global' : mode;
        btn.classList.add('active');
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${label} en cours...`;
    } else {
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
            delete btn.dataset.originalHtml;
        }
        btn.classList.remove('active');
    }
}

/**
 * setImportRunning(running)
 *
 * Bascule l'état visuel du bouton d'import :
 *  - running = true  → bouton désactivé + spinner visible
 *  - running = false → bouton réactivé + spinner masqué
 *
 * @param {boolean} running - true si un import est en cours
 */
function setImportRunning(running) {
    // Bonne pratique: on verrouille tous les boutons d'import pour éviter
    // les chevauchements d'exécution (global + techno en même temps).
    const btnIds = ['runImportBtn', 'runImport2GBtn', 'runImport3GBtn', 'runImport4GBtn'];
    btnIds.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = running;
    });
    // Nettoyage défensif : si aucun import n'est actif, on retire l'état visuel ciblé.
    if (!running && _activeImportMode) {
        setImportButtonBusy(_activeImportMode, false);
        _activeImportMode = null;
    }
    document.getElementById('importSpinner').classList.toggle('show', running);
}

/* ============================================================
   QUALITÉ DES DONNÉES + TRAÇABILITÉ IMPORTS
   ============================================================ */

async function loadDataHealth() {
    const scoreEl = document.getElementById('dataHealthScore');
    const freshEl = document.getElementById('dataHealthFreshness');
    const compEl = document.getElementById('dataHealthCompleteness');
    const issuesEl = document.getElementById('dataHealthIssues');
    if (!scoreEl || !freshEl || !compEl || !issuesEl) return;

    try {
        const res = await API.getDataHealth();
        if (!res.success) throw new Error(res.error || 'API error');

        const d = res.data || {};
        const score = Number(d.quality_score ?? 0);
        scoreEl.textContent = `${score.toFixed(1)}%`;
        scoreEl.style.color = score >= 90 ? '#0f766e' : (score >= 75 ? '#b45309' : '#dc2626');

        freshEl.textContent = `Dernière data RAN: ${formatDate(d.freshness?.ran_last_datetime) || '—'}`;
        compEl.textContent = `${d.totals?.active_sites ?? 0} sites actifs, ${d.completeness?.missing_coords ?? 0} sans coordonnées, ${d.completeness?.ran_without_recent_kpi ?? 0} sans KPI <24h.`;

        const issues = Array.isArray(d.issues) ? d.issues : [];
        if (issues.length === 0) {
            issuesEl.innerHTML = '<div class="small text-success"><i class="bi bi-check-circle me-1"></i>Aucun point bloquant détecté.</div>';
        } else {
            issuesEl.innerHTML = issues.map(i => {
                const cls = i.level === 'critical' ? 'health-issue critical' : 'health-issue';
                return `<div class="${cls}">${escapeHtml(i.message || 'Alerte qualité')}</div>`;
            }).join('');
        }
    } catch (e) {
        scoreEl.textContent = '—';
        freshEl.textContent = 'Santé des données indisponible';
        compEl.textContent = '';
        issuesEl.innerHTML = '<div class="small text-danger">Impossible de charger les indicateurs qualité.</div>';
    }
}

async function loadImportRuns() {
    const tbody = document.getElementById('importRunsTableBody');
    const q = document.getElementById('importRunsSearch')?.value?.trim() || '';
    const compareA = document.getElementById('runCompareA');
    const compareB = document.getElementById('runCompareB');
    if (!tbody || !compareA || !compareB) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-2">Chargement...</td></tr>';

    try {
        const res = await API.getImportRuns({ q, limit: 30 });
        if (!res.success) throw new Error(res.error || 'API error');
        const runs = res.data?.runs || [];

        if (runs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-2">Aucune exécution trouvée.</td></tr>';
            compareA.innerHTML = '<option value="">—</option>';
            compareB.innerHTML = '<option value="">—</option>';
            return;
        }

        tbody.innerHTML = runs.map(r => {
            const st = r.status === 'failed'
                ? '<span class="badge bg-danger">Échec</span>'
                : '<span class="badge bg-success">Succès</span>';
            const dur = r.duration_sec != null ? `${Number(r.duration_sec).toFixed(2)} s` : '—';
            const tpt = r.throughput_sites_sec != null ? `${Number(r.throughput_sites_sec).toFixed(0)} sites/s` : '—';
            return `<tr>
                <td>${formatDate(r.finished_at)}</td>
                <td><span class="badge bg-info text-dark">${escapeHtml(r.tech || 'GLOBAL')}</span></td>
                <td>${r.sites_imported ?? '—'}</td>
                <td>${dur}</td>
                <td>${tpt}</td>
                <td>${st}</td>
                <td>${escapeHtml(r.triggered_by || 'Système')}</td>
            </tr>`;
        }).join('');

        const options = ['<option value="">Sélectionner</option>'].concat(
            runs.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.tech)} • ${formatDate(r.finished_at)} • ${r.status === 'failed' ? 'Échec' : 'Succès'}</option>`)
        ).join('');

        compareA.innerHTML = options;
        compareB.innerHTML = options;
        window._latestImportRuns = runs;
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-2">Erreur de chargement des exécutions.</td></tr>';
    }
}

function compareImportRuns() {
    const compareA = document.getElementById('runCompareA');
    const compareB = document.getElementById('runCompareB');
    const out = document.getElementById('importRunsCompareResult');
    const runs = window._latestImportRuns || [];
    if (!compareA || !compareB || !out) return;

    const a = runs.find(r => r.id === compareA.value);
    const b = runs.find(r => r.id === compareB.value);

    if (!a || !b) {
        out.textContent = 'Sélectionnez deux exécutions pour afficher l\'écart de performance.';
        return;
    }

    const deltaSites = (Number(a.sites_imported || 0) - Number(b.sites_imported || 0));
    const deltaDuration = (Number(a.duration_sec || 0) - Number(b.duration_sec || 0));
    const deltaTpt = (Number(a.throughput_sites_sec || 0) - Number(b.throughput_sites_sec || 0));

    out.innerHTML = `
        <strong>Comparaison ${escapeHtml(a.tech)} vs ${escapeHtml(b.tech)}</strong><br>
        Sites importés: <strong>${a.sites_imported ?? '—'}</strong> vs <strong>${b.sites_imported ?? '—'}</strong> (écart: ${deltaSites >= 0 ? '+' : ''}${deltaSites})<br>
        Durée: <strong>${a.duration_sec ?? '—'} s</strong> vs <strong>${b.duration_sec ?? '—'} s</strong> (écart: ${deltaDuration >= 0 ? '+' : ''}${deltaDuration.toFixed(2)} s)<br>
        Débit: <strong>${a.throughput_sites_sec ?? '—'} sites/s</strong> vs <strong>${b.throughput_sites_sec ?? '—'} sites/s</strong> (écart: ${deltaTpt >= 0 ? '+' : ''}${deltaTpt.toFixed(0)} sites/s)
    `;
}

/* ============================================================
   JOURNAL D'AUDIT
   ============================================================ */

/**
 * loadAuditLogs(page, filters)
 *
 * Appelle API.getAuditLogs() (→ api/audit/get-audit-logs.php) pour charger
 * une page du journal d'audit et met à jour le tableau HTML.
 *
 * Colonnes affichées :
 *  - Date/heure  : timestamp de l'action (formaté fr-FR)
 *  - Utilisateur : email de l'acteur
 *  - Action      : badge coloré (ex. IMPORT_TRIGGERED, CREATE_USER…)
 *  - Entité      : type et identifiant de la ressource concernée
 *  - Détails     : données JSON associées (tronquées si longues)
 *  - IP          : adresse IP de l'acteur
 *
 * Filtres disponibles :
 *  - action    : type d'action (select peuplé dynamiquement)
 *  - search    : recherche texte libre (email, détails…)
 *  - date_from : date de début (YYYY-MM-DD)
 *  - date_to   : date de fin
 *
 * Pagination : 25 lignes par page, boutons générés par renderPagination().
 *
 * @param {number} page    - numéro de page à charger (1-based)
 * @param {object} filters - objet de filtres { action, search, date_from, date_to }
 */
async function loadAuditLogs(page, filters) {
    _auditPage    = page;
    _auditFilters = filters;

    const tbody     = document.getElementById('auditTableBody');
    const pageInfo  = document.getElementById('auditPaginationInfo');
    const pageBtns  = document.getElementById('auditPaginationBtns');

    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3"><span class="spinner-border spinner-border-sm me-2"></span>Chargement...</td></tr>';

    try {
        const res = await API.getAuditLogs({ ...filters, page, per_page: 25 });

        if (!res.success) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${res.message || 'Erreur'}</td></tr>`;
            return;
        }

        // L'API enveloppe les données dans res.data
        const d = res.data || {};

        // Peupler filtre action (une seule fois ou mise à jour)
        populateActionFilter(d.actions || []);

        if (!d.logs || d.logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Aucun log trouvé.</td></tr>';
            pageInfo.textContent = '';
            pageBtns.innerHTML   = '';
            return;
        }

        tbody.innerHTML = d.logs.map(renderAuditRow).join('');

        // Pagination
        const total = d.total || 0;
        const pages = d.pages || 1;
        pageInfo.textContent = `${total} entrée${total > 1 ? 's' : ''} — Page ${page} / ${pages}`;
        renderPagination(pageBtns, page, pages);

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erreur de connexion API</td></tr>';
    }
}

/**
 * renderAuditRow(log)
 *
 * Génère le HTML d'une ligne <tr> du tableau d'audit à partir d'un objet log.
 * Applique un badge coloré sur le champ « action » selon le type d'action.
 * Les détails JSON longs sont tronqués visuellement avec title= pour le tooltip.
 *
 * @param {object} log - entrée de log retournée par l'API
 * @returns {string} - HTML de la ligne <tr>
 */
function renderAuditRow(log) {
    const badgeClass  = ['IMPORT_TRIGGERED','CREATE_USER','UPDATE_USER','DELETE_USER'].includes(log.action)
                        ? `audit-${log.action}`
                        : 'audit-other';
    const details = log.details ? (typeof log.details === 'object' ? JSON.stringify(log.details) : log.details) : '—';
    return `
        <tr>
            <td style="white-space:nowrap;font-size:0.8rem">${formatDate(log.created_at)}</td>
            <td style="font-size:0.82rem">${escapeHtml(log.user_email || '—')}</td>
            <td><span class="audit-badge badge ${badgeClass}">${escapeHtml(log.action)}</span></td>
            <td style="font-size:0.8rem">${escapeHtml(log.entity_type || '—')} ${log.entity_id ? '#'+log.entity_id : ''}</td>
            <td style="font-size:0.78rem;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(details)}">${escapeHtml(details)}</td>
            <td style="font-size:0.78rem">${escapeHtml(log.ip_address || '—')}</td>
        </tr>`;
}

/**
 * populateActionFilter(actions)
 *
 * Remplit le <select> de filtrage par type d'action à partir de la liste
 * retournée par l'API (champ res.actions).
 * N'ajoute les options qu'une seule fois (vérifie si déjà peuplé).
 *
 * @param {string[]} actions - liste des types d'action distincts présents en base
 */
function populateActionFilter(actions) {
    const sel = document.getElementById('auditFilterAction');
    if (sel.options.length > 1) return; // déjà peuplé
    actions.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        sel.appendChild(opt);
    });
}

/**
 * renderPagination(container, current, total)
 *
 * Génère les boutons de pagination dans le conteneur donné.
 * Affiche au maximum 5 pages autour de la page courante, avec des raccourcis
 * vers la première et la dernière page si nécessaire (ex: « 1  ... 4 [5] 6 ...  12 »).
 *
 * @param {HTMLElement} container - élément DOM où injecter les boutons
 * @param {number}      current   - page actuellement affichée
 * @param {number}      total     - nombre total de pages
 */
function renderPagination(container, current, total) {
    if (total <= 1) { container.innerHTML = ''; return; }
    let html = '';
    const from = Math.max(1, current - 2);
    const to   = Math.min(total, current + 2);
    if (from > 1) html += pageBtn(1, current, '« 1');
    for (let p = from; p <= to; p++) html += pageBtn(p, current);
    if (to < total) html += pageBtn(total, current, `${total} »`);
    container.innerHTML = html;
    container.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => loadAuditLogs(parseInt(btn.dataset.page), _auditFilters));
    });
}

function pageBtn(p, current, label) {
    return `<button class="btn btn-sm page-btn ${p === current ? 'btn-primary' : 'btn-outline-secondary'}"
                    data-page="${p}">${label || p}</button>`;
}

/* ============================================================
   HELPERS VISUELS
   ============================================================ */

/**
 * buildStatCard(label, value, icon)
 *
 * Génère le HTML d'une carte de statistique import (grille 2×2).
 * Utilisé dans loadImportStatus() pour afficher : date, sites, records, 2G/3G/4G.
 *
 * @param {string} label - libellé de la carte
 * @param {string} value - valeur à afficher (peut être '—' si inconnue)
 * @param {string} icon  - classe Bootstrap Icons (ex: 'bi-calendar-check')
 * @returns {string} - HTML de la colonne <div class="col-6">
 */
function buildStatCard(label, value, icon) {
    const compactClass = label === 'Bon / Alerte / Critique' ? ' compact-triple' : '';
    return `<div class="col-6">
        <div class="stat-import-card${compactClass}">
            <div class="label"><i class="bi ${icon} me-1"></i>${label}</div>
            <div class="value">${value}</div>
        </div>
    </div>`;
}

/**
 * colorizeLog(text)
 *
 * Applique un coloriage syntaxique sur le texte brut d'un log d'import :
 *  - ERROR / ERREUR / FAILED / FAILURE → rouge (span.log-err)
 *  - WARNING / WARN                    → orange (span.log-warn)
 *  - SUCCESS / OK / DONE / TERMINÉ…   → vert (span.log-ok)
 *
 * Le texte est d'abord passé dans escapeHtml() pour éviter toute injection XSS.
 *
 * @param {string} text - contenu brut du log
 * @returns {string} - HTML colorisé
 */
function colorizeLog(text) {
    return escapeHtml(text)
        .replace(/(ERROR|ERREUR|FAILED|FAILURE)/gi,  '<span class="log-err">$1</span>')
        .replace(/(WARNING|WARN)/gi,                  '<span class="log-warn">$1</span>')
        .replace(/(SUCCESS|OK|DONE|TERMINÉ|IMPORTÉ)/gi, '<span class="log-ok">$1</span>');
}

function formatDate(str) {
    if (!str) return '—';
    // Si la valeur est une date pure (YYYY-MM-DD sans heure), on n'affiche pas l'heure
    // pour éviter le "00:00:00" parasite injecté par le navigateur via new Date()
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(str.trim());
    const d = new Date(str.replace(' ', 'T'));
    if (isNaN(d)) return str;
    if (isDateOnly) {
        return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
    }
    // Afficher la date + heure (minutes) pour la lisibilité — pas besoin des secondes
    return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' })
         + ' ' + d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ============================================================
   HEADER / SIDEBAR COMMUNS
   ============================================================ */

/**
 * setupHeader()
 *
 * Lit l'objet utilisateur connecté depuis sessionStorage (clé 'currentUser'),
 * avec fallback sur localStorage si sessionStorage est vide.
 *
 * Met à jour les éléments HTML du header :
 *  - #userName      : prénom/email dans le menu sidebar
 *  - #headerUserName: nom complet dans la barre supérieure
 *  - #headerUserRole: rôle de l'utilisateur (ex : ADMIN)
 *  - #userAvatar    : initiales de l'utilisateur (2 premières lettres)
 *
 * Lance également une horloge temps réel (#currentDateTime) mise à jour
 * toutes les secondes avec la date longue et l'heure au format fr-FR.
 *
 * Note : La clé de stockage est 'currentUser' — cohérente avec logout.js
 *        qui effectue : sessionStorage.setItem('currentUser', JSON.stringify(user))
 */
function setupHeader() {
    try {
        // Lecture de l'utilisateur connecté — clé 'currentUser' (définie par logout.js)
        const stored = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
        if (stored) {
            const u = JSON.parse(stored);
            document.getElementById('userName').textContent       = u.name || u.email || 'Admin';
            document.getElementById('headerUserName').textContent = u.name || u.email || 'Admin';
            document.getElementById('headerUserRole').textContent = u.role || 'ADMIN';
            // Initiales : 2 premiers caractères du nom ou de l'email
            const initials = (u.name || u.email || 'AD').slice(0, 2).toUpperCase();
            document.getElementById('userAvatar').textContent = initials;
        }
    } catch (_) {
        // Silencieux — l'affichage restera sur la valeur par défaut HTML
    }

    // Horloge temps réel — mise à jour toutes les secondes
    function updateClock() {
        const now = new Date();
        const el  = document.querySelector('#currentDateTime span');
        if (el) {
            el.textContent = now.toLocaleDateString('fr-FR', {
                weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
            }) + ' ' + now.toLocaleTimeString('fr-FR');
        }
    }
    updateClock();
    setInterval(updateClock, 1000);
}

/**
 * setupLogoutModal()
 *
 * Gère la modale de confirmation de déconnexion :
 *  - Clic sur #logoutBtn    → affiche la modale (classList.add('show'))
 *  - Clic sur #cancelBtn    → ferme la modale
 *  - Clic en dehors         → ferme la modale
 *  - Clic sur #confirmBtn   → appelle API.logout() (supprime la session côté serveur),
 *                             vide sessionStorage et localStorage, redirige vers index.php
 */
function setupLogoutModal() {
    const modal      = document.getElementById('logoutConfirmModal');
    const logoutBtn  = document.getElementById('logoutBtn');
    const cancelBtn  = document.getElementById('cancelLogoutBtn');
    const confirmBtn = document.getElementById('confirmLogoutBtn');

    if (!modal || !logoutBtn) return;

    logoutBtn.addEventListener('click', () => modal.classList.add('show'));
    cancelBtn.addEventListener('click', () => modal.classList.remove('show'));
    // Fermeture si clic sur le fond de la modale (hors contenu)
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });

    confirmBtn.addEventListener('click', async () => {
        // Appel API pour invalider la session PHP côté serveur
        try { await API.logout(); } catch (_) {}
        // Nettoyage des données utilisateur côté client
        sessionStorage.clear();
        localStorage.removeItem('currentUser'); // clé 'currentUser' cohérente avec logout.js
        window.location.href = 'index.php';
    });
}

/**
 * setupMenuToggle()
 *
 * Gère le bouton hamburger (#menuToggle) sur mobile/tablette :
 *  - Clic sur le bouton → bascule la classe 'open' sur #sidebar (ouvre/ferme)
 *  - Clic ailleurs sur la page → ferme automatiquement le sidebar
 *
 * Le sidebar reste toujours visible sur desktop (géré en CSS par media query).
 */
function setupMenuToggle() {
    const btn     = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (!btn || !sidebar) return;
    btn.addEventListener('click', () => sidebar.classList.toggle('open'));
    // Fermeture automatique si l'utilisateur clique en dehors du sidebar
    document.addEventListener('click', e => {
        if (!sidebar.contains(e.target) && !btn.contains(e.target)) sidebar.classList.remove('open');
    });
}
