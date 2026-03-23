/**
 * NetInsight 360 - Gestion Utilisateurs
 * Supervisez. Analysez. Optimisez.
 * 
 * Gère l'administration des utilisateurs : CRUD, statistiques, activité
 */

// ============================================
// DONNÉES SIMULÉES
// ============================================

/**
 * Liste des utilisateurs
 * Stockée en localStorage pour persistance entre les sessions
 */
let users = [
    { id: 1, name: "Prince Désiré", email: "admin@netinsight360.com", role: "ADMIN", status: "active", createdAt: "2024-01-15", lastLogin: "2025-03-22 09:30:00", password: "admin123" },
    { id: 2, name: "FO_NPM", email: "npm@netinsight360.com", role: "FO_NPM", status: "active", createdAt: "2024-02-10", lastLogin: "2025-03-21 14:20:00", password: "npm123" },
    { id: 3, name: "FO_CORE_RAN", email: "core@netinsight360.com", role: "FO_CORE_RAN", status: "active", createdAt: "2024-02-20", lastLogin: "2025-03-20 11:45:00", password: "core123" },
    { id: 4, name: "FO_CUSTOMER", email: "customer@netinsight360.com", role: "CUSTOMER", status: "active", createdAt: "2024-03-01", lastLogin: "2025-03-19 16:30:00", password: "customer123" },
    { id: 5, name: "FO_NPM", email: "amina@netinsight360.com", role: "FO_NPM", status: "active", createdAt: "2024-04-15", lastLogin: "2025-03-21 08:15:00", password: "amina123" },
    { id: 6, name: "FO_CORE_RAN", email: "koffi@netinsight360.com", role: "FO_CORE_RAN", status: "inactive", createdAt: "2024-05-20", lastLogin: "2025-02-10 10:00:00", password: "koffi123" },
    { id: 7, name: "FO_CUSTOMER", email: "fatou@netinsight360.com", role: "CUSTOMER", status: "active", createdAt: "2024-06-01", lastLogin: "2025-03-18 14:45:00", password: "fatou123" }
];

/**
 * Journal des activités
 */
let activityLog = [
    { id: 1, userId: 1, userName: "Prince Désiré", action: "login", details: "Connexion réussie", timestamp: "2025-03-22 09:30:00" },
    { id: 2, userId: 2, userName: "Jean Kouadio", action: "login", details: "Connexion réussie", timestamp: "2025-03-21 14:20:00" },
    { id: 3, userId: 1, userName: "Prince Désiré", action: "create_user", details: "Création de l'utilisateur Fatou Diop", timestamp: "2025-03-15 11:00:00" },
    { id: 4, userId: 1, userName: "Prince Désiré", action: "edit_user", details: "Modification du rôle de Marie Diallo", timestamp: "2025-03-10 15:30:00" },
    { id: 5, userId: 1, userName: "Prince Désiré", action: "delete_user", details: "Suppression de l'utilisateur test", timestamp: "2025-03-05 09:15:00" }
];

// ============================================
// VARIABLES GLOBALES
// ============================================
let currentUser = null;
let currentFilters = {
    role: 'all',
    search: ''
};
let currentPage = 1;
let itemsPerPage = 5;
let charts = {};

// ============================================
// FONCTIONS DE GESTION DE SESSION
// ============================================

/**
 * Vérifie l'authentification de l'utilisateur
 * Seul l'ADMIN peut accéder à cette page
 */
function checkAuthentication() {
    const storedUser = sessionStorage.getItem('currentUser');
    if (!storedUser) {
        window.location.href = 'index.html';
        return false;
    }
    
    try {
        const user = JSON.parse(storedUser);
        const loginTime = new Date(user.loggedInAt);
        const now = new Date();
        const hoursSinceLogin = (now - loginTime) / (1000 * 60 * 60);
        
        // Vérifier expiration session (8h)
        if (hoursSinceLogin > 8) {
            sessionStorage.clear();
            localStorage.removeItem('rememberedUser');
            window.location.href = 'index.html';
            return false;
        }
        
        // Vérifier que l'utilisateur est ADMIN
        if (user.role !== 'ADMIN') {
            alert('Accès refusé. Seuls les administrateurs peuvent accéder à cette page.');
            window.location.href = 'dashboard.html';
            return false;
        }
        
        currentUser = user;
        return true;
    } catch (e) {
        window.location.href = 'index.html';
        return false;
    }
}

/**
 * Initialise la gestion de la déconnexion
 */
function initLogoutHandler() {
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutModal = document.getElementById('logoutConfirmModal');
    const confirmBtn = document.getElementById('confirmLogoutBtn');
    const cancelBtn = document.getElementById('cancelLogoutBtn');
    
    if (!logoutBtn) return;
    
    function executeLogout() {
        logoutBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Déconnexion...';
        logoutBtn.disabled = true;
        
        setTimeout(() => {
            sessionStorage.clear();
            localStorage.removeItem('rememberedUser');
            window.location.href = 'index.html';
        }, 300);
    }
    
    function showLogoutConfirmation() {
        if (logoutModal) logoutModal.classList.add('show');
        else if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) executeLogout();
    }
    
    function hideLogoutConfirmation() {
        if (logoutModal) logoutModal.classList.remove('show');
    }
    
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showLogoutConfirmation();
    });
    
    if (confirmBtn) confirmBtn.addEventListener('click', () => { hideLogoutConfirmation(); executeLogout(); });
    if (cancelBtn) cancelBtn.addEventListener('click', () => hideLogoutConfirmation());
    if (logoutModal) logoutModal.addEventListener('click', (e) => { if (e.target === logoutModal) hideLogoutConfirmation(); });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && logoutModal?.classList.contains('show')) hideLogoutConfirmation();
    });
}

/**
 * Rafraîchit la session
 */
function refreshSession() {
    if (currentUser) {
        currentUser.loggedInAt = new Date().toISOString();
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    }
}

/**
 * Initialise le rafraîchissement de session
 */
function initSessionRefresh() {
    setInterval(refreshSession, 30 * 60 * 1000);
    ['click', 'mousemove', 'keypress', 'scroll'].forEach(event => {
        document.addEventListener(event, refreshSession);
    });
}

/**
 * Met à jour l'interface utilisateur
 */
function updateUserInterface() {
    if (!currentUser) return;
    
    document.getElementById('userName').innerText = currentUser.name;
    document.getElementById('headerUserName').innerText = currentUser.name;
    
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
    document.getElementById('userAvatar').innerText = initials;
    
    const roleMap = { 'ADMIN': 'Administrateur', 'FO_NPM': 'Agent Superviseur', 'FO_CORE_RAN': 'Agent Partageur', 'CUSTOMER': 'Agent Visualiseur' };
    document.getElementById('headerUserRole').innerText = roleMap[currentUser.role] || 'Utilisateur';
}

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Charge les données depuis localStorage
 */
function loadData() {
    const storedUsers = localStorage.getItem('netinsight_users');
    if (storedUsers) {
        users = JSON.parse(storedUsers);
    } else {
        saveData();
    }
    
    const storedActivity = localStorage.getItem('netinsight_activity');
    if (storedActivity) {
        activityLog = JSON.parse(storedActivity);
    }
}

/**
 * Sauvegarde les données dans localStorage
 */
function saveData() {
    localStorage.setItem('netinsight_users', JSON.stringify(users));
    localStorage.setItem('netinsight_activity', JSON.stringify(activityLog));
}

/**
 * Ajoute une entrée dans le journal d'activité
 */
function addActivityLog(action, details) {
    const newActivity = {
        id: activityLog.length + 1,
        userId: currentUser.id,
        userName: currentUser.name,
        action: action,
        details: details,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    activityLog.unshift(newActivity);
    // Garder seulement les 50 dernières activités
    if (activityLog.length > 50) activityLog.pop();
    saveData();
}

/**
 * Met à jour les statistiques globales
 */
function updateStats() {
    const total = users.length;
    const adminCount = users.filter(u => u.role === 'ADMIN').length;
    const npmCount = users.filter(u => u.role === 'FO_NPM').length;
    const coreCount = users.filter(u => u.role === 'FO_CORE_RAN').length;
    const customerCount = users.filter(u => u.role === 'CUSTOMER').length;
    
    document.getElementById('totalUsers').innerText = total;
    document.getElementById('adminCount').innerText = adminCount;
    document.getElementById('npmCount').innerText = npmCount;
    document.getElementById('customerCount').innerText = customerCount;
}

/**
 * Filtre les utilisateurs selon les critères
 */
function filterUsers() {
    let filtered = [...users];
    
    if (currentFilters.role !== 'all') {
        filtered = filtered.filter(u => u.role === currentFilters.role);
    }
    
    if (currentFilters.search) {
        const searchLower = currentFilters.search.toLowerCase();
        filtered = filtered.filter(u => 
            u.name.toLowerCase().includes(searchLower) || 
            u.email.toLowerCase().includes(searchLower)
        );
    }
    
    return filtered;
}

/**
 * Met à jour le tableau des utilisateurs
 */
function updateUsersTable() {
    const filteredUsers = filterUsers();
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const paginatedUsers = filteredUsers.slice(start, start + itemsPerPage);
    
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (paginatedUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Aucun utilisateur trouvé</td></tr>';
        return;
    }
    
    tbody.innerHTML = paginatedUsers.map(user => {
        const roleClass = user.role === 'ADMIN' ? 'role-admin' : 
                         (user.role === 'FO_NPM' ? 'role-npm' : 
                         (user.role === 'FO_CORE_RAN' ? 'role-core' : 'role-customer'));
        const roleLabel = user.role === 'ADMIN' ? 'Administrateur' : 
                         (user.role === 'FO_NPM' ? 'Agent Superviseur' : 
                         (user.role === 'FO_CORE_RAN' ? 'Agent Partageur' : 'Agent Visualiseur'));
        
        const statusClass = user.status === 'active' ? 'status-active' : 'status-inactive';
        const statusLabel = user.status === 'active' ? 'Actif' : 'Inactif';
        
        return `
            <tr>
                <td>${user.id}</td>
                <td><strong>${escapeHtml(user.name)}</strong></td>
                <td>${escapeHtml(user.email)}</td>
                <td><span class="role-badge ${roleClass}">${roleLabel}</span></td>
                <td>${user.createdAt}</td>
                <td>${user.lastLogin || 'Jamais'}</td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td class="action-buttons">
                    <button class="action-btn edit-btn" onclick="editUser(${user.id})" title="Modifier">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteUser(${user.id})" title="Supprimer">
                        <i class="bi bi-trash3"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Pagination
    const paginationDiv = document.getElementById('paginationControls');
    if (paginationDiv && totalPages > 1) {
        let paginationHtml = '<nav><ul class="pagination">';
        for (let i = 1; i <= totalPages; i++) {
            paginationHtml += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                <button class="page-link" onclick="goToPage(${i})">${i}</button>
            </li>`;
        }
        paginationHtml += '</ul></nav>';
        paginationDiv.innerHTML = paginationHtml;
    } else if (paginationDiv) {
        paginationDiv.innerHTML = '';
    }
}

/**
 * Échappe les caractères HTML pour éviter XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Change de page
 */
function goToPage(page) {
    currentPage = page;
    updateUsersTable();
}

/**
 * Édite un utilisateur
 */
function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    document.getElementById('userModalTitle').innerText = 'Modifier l\'utilisateur';
    document.getElementById('userId').value = user.id;
    document.getElementById('userName').value = user.name;
    document.getElementById('userEmail').value = user.email;
    document.getElementById('userRole').value = user.role;
    document.getElementById('userStatus').value = user.status;
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').placeholder = 'Laissez vide pour conserver';
    
    const modal = new bootstrap.Modal(document.getElementById('addUserModal'));
    modal.show();
}

/**
 * Supprime un utilisateur
 */
let userToDelete = null;

function deleteUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    userToDelete = user;
    document.getElementById('deleteUserName').innerText = user.name;
    const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    modal.show();
}

/**
 * Confirme la suppression
 */
function confirmDelete() {
    if (userToDelete) {
        // Ne pas supprimer l'utilisateur courant
        if (userToDelete.id === currentUser.id) {
            alert('Vous ne pouvez pas supprimer votre propre compte.');
            return;
        }
        
        users = users.filter(u => u.id !== userToDelete.id);
        saveData();
        addActivityLog('delete_user', `Suppression de l'utilisateur ${userToDelete.name}`);
        
        updateStats();
        updateUsersTable();
        updateCharts();
        updateActivityList();
        
        bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal')).hide();
        userToDelete = null;
    }
}

/**
 * Sauvegarde un utilisateur (création ou modification)
 */
function saveUser() {
    const userId = document.getElementById('userId').value;
    const name = document.getElementById('userName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const role = document.getElementById('userRole').value;
    const status = document.getElementById('userStatus').value;
    const password = document.getElementById('userPassword').value;
    
    if (!name || !email) {
        alert('Veuillez remplir tous les champs obligatoires.');
        return;
    }
    
    // Vérifier email unique
    const emailExists = users.some(u => u.email === email && u.id != userId);
    if (emailExists) {
        alert('Cet email est déjà utilisé.');
        return;
    }
    
    if (userId) {
        // Modification
        const userIndex = users.findIndex(u => u.id == userId);
        if (userIndex !== -1) {
            users[userIndex].name = name;
            users[userIndex].email = email;
            users[userIndex].role = role;
            users[userIndex].status = status;
            if (password) {
                users[userIndex].password = password;
            }
            addActivityLog('edit_user', `Modification de l'utilisateur ${name}`);
        }
    } else {
        // Création
        const newId = Math.max(...users.map(u => u.id), 0) + 1;
        const newUser = {
            id: newId,
            name: name,
            email: email,
            role: role,
            status: status,
            password: password || 'password123',
            createdAt: new Date().toISOString().split('T')[0],
            lastLogin: null
        };
        users.push(newUser);
        addActivityLog('create_user', `Création de l'utilisateur ${name} (${role})`);
    }
    
    saveData();
    updateStats();
    updateUsersTable();
    updateCharts();
    updateActivityList();
    
    // Réinitialiser et fermer le modal
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('userModalTitle').innerText = 'Ajouter un utilisateur';
    bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
}

// ============================================
// FONCTIONS DES GRAPHIQUES
// ============================================

/**
 * Met à jour tous les graphiques
 */
function updateCharts() {
    updateRoleChart();
    updateEvolutionChart();
}

/**
 * Graphique de répartition par rôle
 */
function updateRoleChart() {
    const adminCount = users.filter(u => u.role === 'ADMIN').length;
    const npmCount = users.filter(u => u.role === 'FO_NPM').length;
    const coreCount = users.filter(u => u.role === 'FO_CORE_RAN').length;
    const customerCount = users.filter(u => u.role === 'CUSTOMER').length;
    
    const ctx = document.getElementById('roleChart');
    if (!ctx) return;
    
    if (charts.role) charts.role.destroy();
    charts.role = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Administrateurs', 'Agents Superviseurs', 'Agents Partageurs', 'Agents Visualiseurs'],
            datasets: [{
                data: [adminCount, npmCount, coreCount, customerCount],
                backgroundColor: ['#ef4444', '#f59e0b', '#00a3c4', '#10b981']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

/**
 * Graphique d'évolution des créations (simulé)
 */
function updateEvolutionChart() {
    // Simuler les créations des 30 derniers jours
    const labels = [];
    const data = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
        
        // Simuler des données
        const count = users.filter(u => {
            const createdAt = new Date(u.createdAt);
            return createdAt.toDateString() === date.toDateString();
        }).length;
        data.push(count || Math.floor(Math.random() * 3));
    }
    
    const ctx = document.getElementById('evolutionChart');
    if (!ctx) return;
    
    if (charts.evolution) charts.evolution.destroy();
    charts.evolution = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nouveaux utilisateurs',
                data: data,
                borderColor: '#00a3c4',
                backgroundColor: 'rgba(0,163,196,0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Nombre d\'utilisateurs' } }
            }
        }
    });
}

/**
 * Met à jour la liste des activités récentes
 */
function updateActivityList() {
    const container = document.getElementById('recentActivityList');
    if (!container) return;
    
    const recentActivities = activityLog.slice(0, 10);
    
    if (recentActivities.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">Aucune activité récente</p>';
        return;
    }
    
    container.innerHTML = recentActivities.map(activity => {
        let iconClass = '';
        let icon = '';
        
        switch (activity.action) {
            case 'login':
                iconClass = 'login';
                icon = 'bi-box-arrow-in-right';
                break;
            case 'create_user':
                iconClass = 'create';
                icon = 'bi-person-plus-fill';
                break;
            case 'edit_user':
                iconClass = 'edit';
                icon = 'bi-pencil-square';
                break;
            case 'delete_user':
                iconClass = 'delete';
                icon = 'bi-trash3-fill';
                break;
            default:
                iconClass = 'login';
                icon = 'bi-info-circle';
        }
        
        return `
            <div class="activity-item">
                <div class="activity-icon ${iconClass}">
                    <i class="bi ${icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">
                        <strong>${escapeHtml(activity.userName)}</strong> - ${getActionLabel(activity.action)}
                    </div>
                    <div class="activity-time">${activity.details}</div>
                </div>
                <div class="activity-time">${formatTimestamp(activity.timestamp)}</div>
            </div>
        `;
    }).join('');
}

/**
 * Retourne le libellé d'une action
 */
function getActionLabel(action) {
    const labels = {
        'login': 's\'est connecté',
        'create_user': 'a créé un utilisateur',
        'edit_user': 'a modifié un utilisateur',
        'delete_user': 'a supprimé un utilisateur'
    };
    return labels[action] || action;
}

/**
 * Formate un timestamp
 */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / (1000 * 60));
    
    if (diff < 1) return 'À l\'instant';
    if (diff < 60) return `Il y a ${diff} min`;
    if (diff < 1440) return `Il y a ${Math.floor(diff / 60)} h`;
    return date.toLocaleDateString('fr-FR');
}

/**
 * Export des utilisateurs en CSV
 */
function exportUsers() {
    const filteredUsers = filterUsers();
    let csv = "ID,Nom,Email,Rôle,Statut,Date création,Dernière connexion\n";
    
    filteredUsers.forEach(user => {
        const roleLabel = user.role === 'ADMIN' ? 'Administrateur' : 
                         (user.role === 'FO_NPM' ? 'Agent Superviseur' : 
                         (user.role === 'FO_CORE_RAN' ? 'Agent Partageur' : 'Agent Visualiseur'));
        csv += `"${user.id}","${user.name}","${user.email}","${roleLabel}","${user.status}","${user.createdAt}","${user.lastLogin || ''}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `utilisateurs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ============================================
// INITIALISATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // 1. Vérification de l'authentification
    if (!checkAuthentication()) return;
    
    // 2. Chargement des données
    loadData();
    
    // 3. Mise à jour de l'interface
    updateUserInterface();
    updateStats();
    updateUsersTable();
    updateCharts();
    updateActivityList();
    
    // 4. Initialisation de la déconnexion
    initLogoutHandler();
    initSessionRefresh();
    
    // 5. Date/heure
    function updateDateTime() {
        const now = new Date();
        const dateTimeEl = document.getElementById('currentDateTime');
        if (dateTimeEl) {
            dateTimeEl.innerHTML = `<i class="bi bi-calendar3"></i> ${now.toLocaleDateString('fr-FR')} - ${now.toLocaleTimeString('fr-FR')}`;
        }
    }
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // 6. Événements
    const filterRole = document.getElementById('filterRole');
    if (filterRole) {
        filterRole.addEventListener('change', () => {
            currentFilters.role = filterRole.value;
            currentPage = 1;
            updateUsersTable();
        });
    }
    
    const searchInput = document.getElementById('searchUser');
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn && searchInput) {
        const performSearch = () => {
            currentFilters.search = searchInput.value.trim();
            currentPage = 1;
            updateUsersTable();
        };
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
    }
    
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            if (filterRole) filterRole.value = 'all';
            if (searchInput) searchInput.value = '';
            currentFilters = { role: 'all', search: '' };
            currentPage = 1;
            updateUsersTable();
        });
    }
    
    const saveUserBtn = document.getElementById('saveUserBtn');
    if (saveUserBtn) saveUserBtn.addEventListener('click', saveUser);
    
    const exportUsersBtn = document.getElementById('exportUsersBtn');
    if (exportUsersBtn) exportUsersBtn.addEventListener('click', exportUsers);
    
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmDelete);
    
    // Réinitialiser le formulaire quand le modal se ferme
    const addUserModal = document.getElementById('addUserModal');
    if (addUserModal) {
        addUserModal.addEventListener('hidden.bs.modal', () => {
            document.getElementById('userForm').reset();
            document.getElementById('userId').value = '';
            document.getElementById('userModalTitle').innerText = 'Ajouter un utilisateur';
        });
    }
    
    // Menu toggle mobile
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('show'));
    }
    
    // Exposer les fonctions globales
    window.editUser = editUser;
    window.deleteUser = deleteUser;
    window.goToPage = goToPage;
});