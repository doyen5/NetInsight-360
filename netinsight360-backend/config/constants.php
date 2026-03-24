<?php
/**
 * NetInsight 360 - Constantes globales
 * Fichier de configuration des constantes utilisées dans toute l'application
 */

// ============================================
// CONSTANTES DE L'APPLICATION
// ============================================

define('APP_NAME', 'NetInsight 360');
define('APP_VERSION', '1.0.0');
define('APP_TAGLINE', 'Supervisez. Analysez. Optimisez.');
define('APP_ENV', getenv('APP_ENV') ?: 'development');
define('APP_URL', getenv('APP_URL') ?: 'http://localhost/netinsight360');
define('APP_TIMEZONE', getenv('APP_TIMEZONE') ?: 'Africa/Abidjan');

// ============================================
// CONSTANTES DE PERFORMANCE
// ============================================

define('ITEMS_PER_PAGE', 10);
define('SESSION_EXPIRY_HOURS', 8);
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOGIN_ATTEMPT_TIMEOUT', 15); // minutes

// ============================================
// CONSTANTES DES KPIs
// ============================================

// Seuils de performance
define('KPI_THRESHOLD_GOOD', 95);
define('KPI_THRESHOLD_WARNING', 90);
define('KPI_THRESHOLD_CRITICAL', 85);

// Objectifs par défaut
define('KPI_TARGET_RNA', 99.5);
define('KPI_TARGET_TCH_AVAIL', 99);
define('KPI_TARGET_CSSR', 98);
define('KPI_TARGET_SDCCH_CONG', 0.5);
define('KPI_TARGET_SDCCH_DROP', 0.5);
define('KPI_TARGET_TCH_DROP', 2);
define('KPI_TARGET_TCH_CONG', 2);
define('KPI_TARGET_HANDOVER', 98);
define('KPI_TARGET_PACKET_LOSS', 0.5);

// ============================================
// CONSTANTES DES TECHNOLOGIES
// ============================================

define('TECHNOLOGIES', [
    '2G' => ['name' => '2G', 'color' => '#10b981'],
    '3G' => ['name' => '3G', 'color' => '#f59e0b'],
    '4G' => ['name' => '4G', 'color' => '#00a3c4'],
    'CORE' => ['name' => 'CORE', 'color' => '#8b5cf6']
]);

// ============================================
// CONSTANTES DES VENDORS
// ============================================

define('VENDORS', [
    'Huawei' => ['name' => 'Huawei', 'color' => '#ef4444'],
    'Ericsson' => ['name' => 'Ericsson', 'color' => '#3b82f6']
]);

// ============================================
// CONSTANTES DES PAYS
// ============================================

define('COUNTRIES', [
    'CI' => ['name' => 'Côte d\'Ivoire', 'code' => 'CI', 'center_lat' => 6.877, 'center_lng' => -5.282, 'zoom' => 7],
    'NE' => ['name' => 'Niger', 'code' => 'NE', 'center_lat' => 14.512, 'center_lng' => 6.112, 'zoom' => 6],
    'BJ' => ['name' => 'Bénin', 'code' => 'BJ', 'center_lat' => 7.496, 'center_lng' => 2.603, 'zoom' => 7],
    'TG' => ['name' => 'Togo', 'code' => 'TG', 'center_lat' => 7.131, 'center_lng' => 1.223, 'zoom' => 7],
    'CF' => ['name' => 'Centrafrique', 'code' => 'CF', 'center_lat' => 5.394, 'center_lng' => 18.558, 'zoom' => 7]
]);

// ============================================
// CONSTANTES DE LOGGING
// ============================================

define('LOG_LEVEL', getenv('LOG_LEVEL') ?: 'debug');
define('LOG_PATH', getenv('LOG_PATH') ?: __DIR__ . '/../logs/');
define('LOG_MAX_FILES', 30);

// ============================================
// FUSEAU HORAIRE
// ============================================

date_default_timezone_set(APP_TIMEZONE);