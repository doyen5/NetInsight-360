/**
 * NetInsight 360 - Module Utilisateurs
 * Supervisez. Analysez. Optimisez.
 * 
 * Ce module gère l'affichage et la gestion des utilisateurs (admin uniquement).
 */

// Données simulées des utilisateurs
let users = [
    { id: 1, name: "Prince Désiré", email: "admin@netinsight360.com", role: "ADMIN", createdAt: "2024-01-15" },
    { id: 2, name: "FO_NPM", email: "npm@netinsight360.com", role: "FO_NPM", createdAt: "2024-02-10" },
    { id: 3, name: "FO_CORE_RAN", email: "core@netinsight360.com", role: "FO_CORE_RAN", createdAt: "2024-02-20" },
    { id: 4, name: "FO_CUSTOMER", email: "customer@netinsight360.com", role: "CUSTOMER", createdAt: "2024-03-01" }
];

/**
 * Affiche la liste des utilisateurs dans le tableau
 */
function displayUsersList() {
    const tbody = document.getElementById('usersList');
    if (!tbody) return;
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td><span class="badge bg-${user.role === 'ADMIN' ? 'danger' : 'info'}">${user.role}</span></td>
            <td>${user.createdAt}</td>
            <td><button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})"><i class="bi bi-trash"></i></button></td>
        </tr>
    `).join('');
}

/**
 * Supprime un utilisateur
 */
function deleteUser(id) {
    if (confirm('Supprimer cet utilisateur ?')) {
        users = users.filter(u => u.id !== id);
        displayUsersList();
        updateTotalUsersCount();
    }
}

/**
 * Ajoute un nouvel utilisateur
 */
function addUser(userData) {
    const newId = Math.max(...users.map(u => u.id), 0) + 1;
    const newUser = {
        id: newId,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        createdAt: new Date().toISOString().split('T')[0]
    };
    users.push(newUser);
    displayUsersList();
    updateTotalUsersCount();
}

/**
 * Met à jour le compteur total d'utilisateurs dans le dashboard
 */
function updateTotalUsersCount() {
    const totalUsersSpan = document.getElementById('totalUsers');
    if (totalUsersSpan) totalUsersSpan.innerText = users.length;
}