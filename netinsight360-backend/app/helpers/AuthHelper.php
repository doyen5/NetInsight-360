<?php
/**
 * NetInsight 360 - Helper d'authentification et restrictions par rôle
 * 
 * Ce fichier gère :
 * - La vérification de l'authentification de l'utilisateur
 * - Les restrictions d'accès selon le rôle (ADMIN, FO_ANALYSTE, CUSTOMER)
 * - La génération des menus et éléments d'interface adaptés au rôle
 * 
 * Emplacement: netinsight360-backend/app/helpers/AuthHelper.php
 */

// Démarrer la session si elle n'est pas déjà active
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

class AuthHelper
{
    /**
     * Rôles disponibles dans l'application
     */
    const ROLE_ADMIN = 'ADMIN';
    const ROLE_ANALYSTE = 'FO_ANALYSTE';
    const ROLE_CUSTOMER = 'CUSTOMER';
    
    /**
     * Définition des permissions par rôle
     * Structure: 'nom_de_la_permission' => [rôles_autorisés]
     */
    private static $permissions = [
        // Gestion des utilisateurs (CRUD)
        'manage_users' => [self::ROLE_ADMIN],
        
        // Vue de la carte "Total Utilisateurs"
        'view_user_stats' => [self::ROLE_ADMIN],
        
        // Gestion des alertes (résolution)
        'manage_alerts' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE],
        
        // Export de données (Excel, CSV)
        'export_data' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE],
        
        // Génération de rapports (WhatsApp, PowerPoint)
        'generate_reports' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE],
        
        // Visualisation des KPIs CORE
        'view_core_kpis' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE],
        
        // Visualisation des alertes (lecture seule)
        'view_alerts' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE, self::ROLE_CUSTOMER],
        
        // Visualisation des KPIs RAN
        'view_ran_kpis' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE, self::ROLE_CUSTOMER],
        
        // Visualisation de la cartographie
        'view_map' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE, self::ROLE_CUSTOMER],
        
        // Visualisation du dashboard principal
        'view_dashboard' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE, self::ROLE_CUSTOMER],
    ];
    
    /**
     * Vérifie si l'utilisateur est connecté
     * 
     * @return bool
     */
    public static function isLoggedIn(): bool
    {
        return isset($_SESSION['user_id']) && isset($_SESSION['user_role']);
    }
    
    /**
     * Récupère le rôle de l'utilisateur connecté
     * 
     * @return string|null
     */
    public static function getUserRole(): ?string
    {
        return $_SESSION['user_role'] ?? null;
    }
    
    /**
     * Récupère les informations de l'utilisateur connecté
     * 
     * @return array|null
     */
    public static function getUser(): ?array
    {
        if (!self::isLoggedIn()) {
            return null;
        }
        
        return [
            'id' => $_SESSION['user_id'] ?? null,
            'name' => $_SESSION['user_name'] ?? null,
            'email' => $_SESSION['user_email'] ?? null,
            'role' => $_SESSION['user_role'] ?? null,
            'last_login' => $_SESSION['last_login'] ?? null
        ];
    }
    
    /**
     * Vérifie si l'utilisateur a une permission spécifique
     * 
     * @param string $permission Nom de la permission
     * @return bool
     */
    public static function hasPermission(string $permission): bool
    {
        if (!self::isLoggedIn()) {
            return false;
        }
        
        $userRole = self::getUserRole();
        
        if (!isset(self::$permissions[$permission])) {
            // Si la permission n'est pas définie, seul l'ADMIN y a accès par défaut
            return $userRole === self::ROLE_ADMIN;
        }
        
        return in_array($userRole, self::$permissions[$permission]);
    }
    
    /**
     * Vérifie si l'utilisateur a un rôle spécifique
     * 
     * @param string|array $roles Rôle ou liste de rôles autorisés
     * @return bool
     */
    public static function hasRole($roles): bool
    {
        if (!self::isLoggedIn()) {
            return false;
        }
        
        $userRole = self::getUserRole();
        
        if (is_array($roles)) {
            return in_array($userRole, $roles);
        }
        
        return $userRole === $roles;
    }
    
    /**
     * Redirige vers la page de connexion si l'utilisateur n'est pas authentifié
     * 
     * @param string $redirectTo Page de redirection après connexion (optionnel)
     */
    public static function requireLogin(string $redirectTo = ''): void
    {
        if (!self::isLoggedIn()) {
            $loginUrl = '/NetInsight%20360/index.php';
            if (!empty($redirectTo)) {
                $loginUrl .= '?redirect=' . urlencode($redirectTo);
            }
            header('Location: ' . $loginUrl);
            exit();
        }
    }
    
    /**
     * Vérifie que l'utilisateur a accès à une page et redirige si nécessaire
     * 
     * @param string $requiredRole Rôle requis (ou array de rôles)
     */
    public static function requireRole($requiredRole): void
    {
        self::requireLogin();
        
        if (!self::hasRole($requiredRole)) {
            // Rediriger vers le dashboard avec un message d'erreur
            $_SESSION['error_message'] = 'Vous n\'avez pas les droits pour accéder à cette page.';
            header('Location: /NetInsight%20360/netinsight360-frontend/dashboard.php');
            exit();
        }
    }
    
    /**
     * Vérifie que l'utilisateur a une permission spécifique
     * 
     * @param string $permission Permission requise
     */
    public static function requirePermission(string $permission): void
    {
        self::requireLogin();
        
        if (!self::hasPermission($permission)) {
            http_response_code(403);
            echo json_encode(['error' => 'Accès non autorisé']);
            exit();
        }
    }
    
    /**
     * Génère la sidebar en fonction du rôle de l'utilisateur
     * 
     * @return string HTML de la sidebar
     */
    public static function renderSidebar(): string
    {
        $userRole = self::getUserRole();
        $currentPage = basename($_SERVER['REQUEST_URI'], '.php');
        
        $menuItems = [
            'dashboard' => [
                'url' => 'dashboard.html',
                'icon' => 'bi-speedometer2',
                'label' => 'Dashboard',
                'roles' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE, self::ROLE_CUSTOMER]
            ],
            'kpis-ran' => [
                'url' => 'kpis-ran.html',
                'icon' => 'bi-wifi',
                'label' => 'KPIs RAN',
                'roles' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE, self::ROLE_CUSTOMER]
            ],
            'kpis-core' => [
                'url' => 'kpis-core.html',
                'icon' => 'bi-hdd-stack',
                'label' => 'KPIs CORE',
                'roles' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE, self::ROLE_CUSTOMER]  // CUSTOMER a accès
            ],
            'map-view' => [
                'url' => 'map-view.html',
                'icon' => 'bi-map',
                'label' => 'Cartographie',
                'roles' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE, self::ROLE_CUSTOMER]
            ],
            'alerts' => [
                'url' => 'alerts.html',
                'icon' => 'bi-bell',
                'label' => 'Alertes',
                'roles' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE]  // CUSTOMER n'a pas accès
            ],
            'users-management' => [
                'url' => 'users-management.html',
                'icon' => 'bi-people',
                'label' => 'Gestion Users',
                'roles' => [self::ROLE_ADMIN]  // Seul ADMIN a accès
            ]
        ];
        
        $html = '<nav class="nav flex-column">';
        
        foreach ($menuItems as $item) {
            if (in_array($userRole, $item['roles'])) {
                $activeClass = (strpos($currentPage, $item['url']) !== false) ? 'active' : '';
                $html .= sprintf(
                    '<a href="%s" class="nav-link %s" data-section="%s">
                        <i class="bi %s"></i> %s
                    </a>',
                    $item['url'],
                    $activeClass,
                    str_replace('.html', '', $item['url']),
                    $item['icon'],
                    $item['label']
                );
            }
        }
        
        $html .= '</nav>';
        
        return $html;
    }
    
    /**
     * Vérifie si un élément doit être affiché pour l'utilisateur connecté
     * 
     * @param string $elementType Type d'élément (ex: 'user_card', 'export_buttons', 'report_section')
     * @return bool
     */
    public static function canView(string $elementType): bool
    {
        $userRole = self::getUserRole();
        
        $elementPermissions = [
            'user_card' => [self::ROLE_ADMIN],  // Carte Total Utilisateurs
            'export_buttons' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE],  // Boutons d'export
            'report_section' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE],  // Section rapports
            'resolve_alerts' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE],  // Résolution d'alertes
            'core_kpis_section' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE, self::ROLE_CUSTOMER],  // Section KPIs CORE
            'alerts_section' => [self::ROLE_ADMIN, self::ROLE_ANALYSTE]  // Section Alertes
        ];
        
        if (!isset($elementPermissions[$elementType])) {
            return true; // Par défaut, afficher si non spécifié
        }
        
        return in_array($userRole, $elementPermissions[$elementType]);
    }
    
    /**
     * Affiche un élément HTML conditionnellement selon le rôle
     * 
     * @param string $elementType Type d'élément
     * @param string $htmlContent Contenu HTML à afficher si autorisé
     * @param string $cssClass Classe CSS optionnelle pour l'élément
     */
    public static function renderIfAllowed(string $elementType, string $htmlContent, string $cssClass = ''): void
    {
        if (self::canView($elementType)) {
            $classAttr = $cssClass ? ' class="' . $cssClass . '"' : '';
            echo '<div' . $classAttr . '>' . $htmlContent . '</div>';
        }
    }
    
    /**
     * Vérifie si l'utilisateur peut exporter des données
     * 
     * @return bool
     */
    public static function canExport(): bool
    {
        return self::hasPermission('export_data');
    }
    
    /**
     * Vérifie si l'utilisateur peut générer des rapports
     * 
     * @return bool
     */
    public static function canGenerateReports(): bool
    {
        return self::hasPermission('generate_reports');
    }
    
    /**
     * Vérifie si l'utilisateur peut gérer les alertes (résoudre)
     * 
     * @return bool
     */
    public static function canManageAlerts(): bool
    {
        return self::hasPermission('manage_alerts');
    }
    
    /**
     * Récupère le libellé du rôle en français
     * 
     * @param string|null $role
     * @return string
     */
    public static function getRoleLabel(?string $role = null): string
    {
        $role = $role ?? self::getUserRole();
        
        $labels = [
            self::ROLE_ADMIN => 'Administrateur',
            self::ROLE_ANALYSTE => 'Agent Analyste',
            self::ROLE_CUSTOMER => 'Agent Visualiseur'
        ];
        
        return $labels[$role] ?? 'Utilisateur';
    }
}