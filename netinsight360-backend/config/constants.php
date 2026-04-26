<?php
/**
 * NetInsight 360 - Constantes globales
 * Fichier de configuration des constantes utilisées dans toute l'application
 */

require_once __DIR__ . '/../app/helpers/EnvHelper.php';
EnvHelper::load();

// ============================================
// CONSTANTES DE L'APPLICATION
// ============================================

define('APP_NAME', 'NetInsight 360');
define('APP_VERSION', '1.0.0');
define('APP_TAGLINE', 'Supervisez. Analysez. Optimisez.');
define('APP_ENV', EnvHelper::get('APP_ENV', 'development'));
define('APP_URL', EnvHelper::get('APP_URL', 'http://localhost:8080/NetInsight%20360'));
define('APP_TIMEZONE', EnvHelper::get('APP_TIMEZONE', 'Africa/Abidjan'));

// ============================================
// CONSTANTES DE PERFORMANCE
// ============================================

define('ITEMS_PER_PAGE', 10);
define('SESSION_EXPIRY_HOURS', 8);
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOGIN_ATTEMPT_TIMEOUT', 15); // minutes
define('MIN_PASSWORD_LENGTH', 12);
define('MAX_PASSWORD_LENGTH', 72);
define('MAX_PASSWORD_RESET_REQUEST_ATTEMPTS', 5);
define('MAX_PASSWORD_RESET_CONFIRM_ATTEMPTS', 5);
define('PASSWORD_RESET_ATTEMPT_TIMEOUT', 15); // minutes
define('TWO_FACTOR_SETUP_TTL_SECONDS', 600);
define('TWO_FACTOR_CHALLENGE_TTL_SECONDS', 300);

// ============================================
// CONSTANTES DES KPIs
// ============================================

define('KPI_THRESHOLD_GOOD', 97);
define('KPI_THRESHOLD_WARNING', 90);
define('KPI_THRESHOLD_CRITICAL', 85);

define('KPI_TARGET_RNA', 99.5);
define('KPI_TARGET_TCH_AVAIL', 99);
define('KPI_TARGET_CSSR', 98);
define('KPI_TARGET_SDCCH_CONG', 0.5);
define('KPI_TARGET_SDCCH_DROP', 0.5);
define('KPI_TARGET_TCH_DROP', 2);
define('KPI_TARGET_TCH_CONG', 2);
define('KPI_TARGET_HANDOVER', 98);
define('KPI_TARGET_PACKET_LOSS', 1);

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
    'Huawei' => ['name' => 'Huawei', 'color' => '#d61414'],
    'Ericsson' => ['name' => 'Ericsson', 'color' => '#0944a3']
]);

// ============================================
// CONSTANTES DES PAYS
// ============================================

define('COUNTRIES', [
    'CI' => ['name' => 'Côte d\'Ivoire', 'code' => 'CI', 'center_lat' => 6.877,  'center_lng' => -5.282, 'zoom' => 7],
    'NE' => ['name' => 'Niger',          'code' => 'NE', 'center_lat' => 14.512, 'center_lng' =>  6.112, 'zoom' => 6],
    'BJ' => ['name' => 'Bénin',          'code' => 'BJ', 'center_lat' =>  7.496, 'center_lng' =>  2.603, 'zoom' => 7],
    'TG' => ['name' => 'Togo',           'code' => 'TG', 'center_lat' =>  7.131, 'center_lng' =>  1.223, 'zoom' => 7],
    'CF' => ['name' => 'Centrafrique',   'code' => 'CF', 'center_lat' =>  6.612, 'center_lng' => 20.940, 'zoom' => 6]
]);

// ============================================
// COORDONNÉES DE SUPPORT
// ============================================

define('SUPPORT_EMAIL', EnvHelper::get('SUPPORT_EMAIL', 'support@netinsight360.app'));

// ============================================
// FUSEAU HORAIRE
// ============================================

date_default_timezone_set(APP_TIMEZONE);