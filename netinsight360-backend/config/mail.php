<?php
/**
 * NetInsight 360 — Configuration SMTP
 *
 * Variables lues via EnvHelper::get() si un fichier .env est présent,
 * sinon les valeurs ci-dessous servent de fallback (développement WAMP local).
 *
 * Variables .env attendues :
 *   MAIL_HOST, MAIL_PORT, MAIL_SECURE, MAIL_USERNAME,
 *   MAIL_PASSWORD, MAIL_FROM_ADDRESS, MAIL_FROM_NAME
 */

require_once __DIR__ . '/../app/helpers/EnvHelper.php';
EnvHelper::load();

return [
    'host'         => EnvHelper::get('MAIL_HOST',         'smtp.gmail.com'),
    'port'         => (int) EnvHelper::get('MAIL_PORT',   587),
    'secure'       => EnvHelper::get('MAIL_SECURE',       'tls'), // 'tls' | 'ssl' | ''
    'username'     => EnvHelper::get('MAIL_USERNAME',     ''),
    'password'     => EnvHelper::get('MAIL_PASSWORD',     ''),
    'from_address' => EnvHelper::get('MAIL_FROM_ADDRESS', 'no-reply@netinsight360.local'),
    'from_name'    => EnvHelper::get('MAIL_FROM_NAME',    'NetInsight 360'),
    'app_url'      => EnvHelper::get('APP_URL',           'http://localhost:8080/NetInsight%20360'),
];
