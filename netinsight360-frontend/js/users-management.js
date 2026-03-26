/**
 * NetInsight 360 - Gestion Utilisateurs
 * Supervisez. Analysez. Optimisez.
 * 
 * Administration des utilisateurs via l'API backend
 * Uniquement accessible aux administrateurs
 */

let usersData = [];
let usersFilters = { role: 'all', search: '' };
let usersCurrentPage = 1;
let usersItemsPerPage = 10;

/**
 * Initialise la page de gestion utilisateurs
 */
async function initUsersManagement() {
    const isAuth = await checkAuthentication();
    if (!isAuth) return;
    
    const user = getCurrentUser();
    if (user?.role !== 'ADMIN') {
        alert('Accès refusé. Seuls les administrateurs peuvent accéder à cette page.');
        window.location.href = 'dashboard.php';
        return;
    }
    
    await updateUserInterface();
    await loadUsers();
    await loadUsersStats();
    await loadUsersCharts();
    await loadRecentActivity();
    initUsersFilters();
    initUsersEvents();
}

/**
 * Charge la liste des utilisateurs
 */
async function loadUsers() {
    try {
        const result = await API.getUsers(usersFilters);
        if (!result.success || !result.data) return;
        
        usersData = result.data;
        updateUsersTable();
    } catch (error) {
        console.error('[Users] Erreur chargement utilisateurs:', error);
    }
}

/**
 * Met à jour le tableau des utilisateurs
 */
function updateUsersTable() {
    const filtered = filterUsers();
    const totalPages = Math.ceil(filtered.length / usersItemsPerPage);
    const start = (usersCurrentPage - 1) * usersItemsPerPage;
    const paginated = filtered.slice(start, start + usersItemsPerPage);
    
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (paginated.length === 0) {
        tbody.innerHTML = '米<td colspan="8" class="text-center">Aucun utilisateur trouvé</td>米';
        return;
    }
    
    tbody.innerHTML = paginated.map(user => `
        <tr>
            <td>${user.id}</td>
            <td><strong>${escapeHtml(user.name)}</strong></td>
            <td>${escapeHtml(user.email)}</td>
            <td><span class="role-badge role-${user.role === 'ADMIN' ? 'admin' : (user.role === 'FO_NPM' ? 'npm' : (user.role === 'FO_CORE_RAN' ? 'core' : 'customer'))}">
                ${user.role === 'ADMIN' ? 'Administrateur' : (user.role === 'FO_NPM' ? 'Agent Superviseur' : (user.role === 'FO_CORE_RAN' ? 'Agent Partageur' : 'Agent Visualiseur'))}
            </span></td>
            <td>${user.created_at?.split('T')[0] || '-'}</td>
            <td>${user.last_login?.split('T')[0] || 'Jamais'}</td>
            <td><span class="status-badge ${user.status === 'active' ? 'status-active' : 'status-inactive'}">${user.status === 'active' ? 'Actif' : 'Inactif'}</span></td>
            <td>
                <button class="action-btn edit-btn" onclick="editUser(${user.id})"><i class="bi bi-pencil-square"></i></button>
                <button class="action-btn delete-btn" onclick="deleteUser(${user.id})"><i class="bi bi-trash3"></i></button>
            </td>
        </tr>
    `).join('');
    
    const paginationDiv = document.getElementById('paginationControls');
    if (paginationDiv && totalPages > 1) {
        let html = '<nav><ul class="pagination">';
        for (let i = 1; i <= totalPages; i++) {
            html += `<li class="page-item ${i === usersCurrentPage ? 'active' : ''}">
                <button class="page-link" onclick="goToUsersPage(${i})">${i}</button>
            </li>`;
        }
        html += '</ul></nav>';
        paginationDiv.innerHTML = html;
    } else if (paginationDiv) {
        paginationDiv.innerHTML = '';
    }
}

/**
 * Filtre les utilisateurs
 */
function filterUsers() {
    let filtered = [...usersData];
    
    if (usersFilters.role !== 'all') {
        filtered = filtered.filter(u => u.role === usersFilters.role);
    }
    
    if (usersFilters.search) {
        const search = usersFilters.search.toLowerCase();
        filtered = filtered.filter(u => 
            u.name.toLowerCase().includes(search) || 
            u.email.toLowerCase().includes(search)
        );
    }
    
    return filtered;
}

/**
 * Charge les statistiques des utilisateurs
 */
async function loadUsersStats() {
    try {
        const result = await API.getUserStats();
        if (!result.success) return;
        
        const stats = result.data;
        document.getElementById('totalUsers').innerText = stats.total || 0;
        document.getElementById('adminCount').innerText = stats.admin || 0;
        document.getElementById('npmCount').innerText = stats.npm || 0;
        document.getElementById('customerCount').innerText = stats.customer || 0;
    } catch (error) {
        console.error('[Users] Erreur chargement stats:', error);
    }
}

/**
 * Charge les graphiques
 */
async function loadUsersCharts() {
    try {
        const result = await API.getUserStats();
        if (!result.success) return;
        
        const stats = result.data;
        
        chartManager.createPieChart('roleChart', {
            labels: ['Administrateurs', 'Agents Superviseurs', 'Agents Partageurs', 'Agents Visualiseurs'],
            datasets: [{ data: [stats.admin || 0, stats.npm || 0, stats.core || 0, stats.customer || 0], backgroundColor: ['#ef4444', '#f59e0b', '#00a3c4', '#10b981'] }]
        });
        
        if (stats.evolution) {
            chartManager.createLineChart('evolutionChart', {
                labels: stats.evolution.labels,
                datasets: [{ label: 'Nouveaux utilisateurs', data: stats.evolution.values, borderColor: '#00a3c4', fill: true }]
            });
        }
    } catch (error) {
        console.error('[Users] Erreur chargement graphiques:', error);
    }
}

/**
 * Charge l'activité récente
 */
async function loadRecentActivity() {
    try {
        const result = await API.getUsers({ limit: 10, sort_by: 'last_login', order: 'desc' });
        if (!result.success) return;
        
        const container = document.getElementById('recentActivityList');
        if (!container) return;
        
        const users = result.data || [];
        if (users.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">Aucune activité récente</p>';
            return;
        }
        
        container.innerHTML = users.map(user => `
            <div class="activity-item">
                <div class="activity-icon login"><i class="bi bi-box-arrow-in-right"></i></div>
                <div class="activity-content">
                    <div class="activity-title"><strong>${escapeHtml(user.name)}</strong> - Dernière connexion</div>
                    <div class="activity-time">${user.last_login ? new Date(user.last_login).toLocaleString() : 'Jamais connecté'}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('[Users] Erreur chargement activité:', error);
    }
}

/**
 * Initialise les filtres
 */
function initUsersFilters() {
    const filterRole = document.getElementById('filterRole');
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchUser');
    const resetBtn = document.getElementById('resetFiltersBtn');
    
    if (filterRole) {
        filterRole.addEventListener('change', () => {
            usersFilters.role = filterRole.value;
            usersCurrentPage = 1;
            updateUsersTable();
        });
    }
    
    if (searchBtn && searchInput) {
        const performSearch = () => {
            usersFilters.search = searchInput.value.trim();
            usersCurrentPage = 1;
            updateUsersTable();
        };
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (filterRole) filterRole.value = 'all';
            if (searchInput) searchInput.value = '';
            usersFilters = { role: 'all', search: '' };
            usersCurrentPage = 1;
            updateUsersTable();
        });
    }
}

/**
 * Initialise les événements
 */
function initUsersEvents() {
    const saveBtn = document.getElementById('saveUserBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveUser);
    }
    
    const exportBtn = document.getElementById('exportUsersBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportUsers);
    }
    
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDeleteUser);
    }
}

/**
 * Édite un utilisateur
 * @param {number} userId - Identifiant de l'utilisateur
 */
function editUser(userId) {
    const user = usersData.find(u => u.id === userId);
    if (!user) return;
    
    document.getElementById('userModalTitle').innerText = 'Modifier l\'utilisateur';
    document.getElementById('userId').value = user.id;
    document.getElementById('userName').value = user.name;
    document.getElementById('userEmail').value = user.email;
    document.getElementById('userRole').value = user.role;
    document.getElementById('userStatus').value = user.status;
    document.getElementById('userPassword').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('addUserModal'));
    modal.show();
}

/**
 * Sauvegarde un utilisateur (création ou modification)
 */
async function saveUser() {
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
    
    try {
        let result;
        if (userId) {
            // Modification
            const data = { name, email, role, status };
            if (password) data.password = password;
            result = await API.updateUser(userId, data);
        } else {
            // Création
            if (!password) {
                alert('Le mot de passe est requis pour la création.');
                return;
            }
            result = await API.createUser({ name, email, role, status, password });
        }
        
        if (result.success) {
            await loadUsers();
            await loadUsersStats();
            await loadUsersCharts();
            
            document.getElementById('userForm').reset();
            document.getElementById('userId').value = '';
            document.getElementById('userModalTitle').innerText = 'Ajouter un utilisateur';
            bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
        } else {
            alert(result.error || 'Erreur lors de l\'enregistrement');
        }
    } catch (error) {
        console.error('[Users] Erreur sauvegarde:', error);
        alert('Erreur lors de l\'enregistrement');
    }
}

/**
 * Prépare la suppression d'un utilisateur
 * @param {number} userId - Identifiant de l'utilisateur
 */
let userToDelete = null;

function deleteUser(userId) {
    const user = usersData.find(u => u.id === userId);
    if (!user) return;
    
    userToDelete = user;
    document.getElementById('deleteUserName').innerText = user.name;
    const modal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    modal.show();
}

/**
 * Confirme la suppression d'un utilisateur
 */
async function confirmDeleteUser() {
    if (!userToDelete) return;
    
    const currentUser = getCurrentUser();
    if (userToDelete.id === currentUser?.id) {
        alert('Vous ne pouvez pas supprimer votre propre compte.');
        return;
    }
    
    try {
        const result = await API.deleteUser(userToDelete.id);
        if (result.success) {
            await loadUsers();
            await loadUsersStats();
            await loadUsersCharts();
            
            bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal')).hide();
            userToDelete = null;
        } else {
            alert(result.error || 'Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('[Users] Erreur suppression:', error);
        alert('Erreur lors de la suppression');
    }
}

/**
 * Exporte les utilisateurs en CSV
 */
function exportUsers() {
    const filtered = filterUsers();
    let csv = "ID,Nom,Email,Rôle,Statut,Date création,Dernière connexion\n";
    
    filtered.forEach(user => {
        const roleLabel = user.role === 'ADMIN' ? 'Administrateur' : 
                         (user.role === 'FO_NPM' ? 'Agent Superviseur' : 
                         (user.role === 'FO_CORE_RAN' ? 'Agent Partageur' : 'Agent Visualiseur'));
        csv += `"${user.id}","${user.name}","${user.email}","${roleLabel}","${user.status}","${user.created_at || ''}","${user.last_login || ''}"\n`;
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

/**
 * Change de page
 * @param {number} page - Numéro de page
 */
function goToUsersPage(page) {
    usersCurrentPage = page;
    updateUsersTable();
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', initUsersManagement);

window.editUser = editUser;
window.deleteUser = deleteUser;
window.goToUsersPage = goToUsersPage;