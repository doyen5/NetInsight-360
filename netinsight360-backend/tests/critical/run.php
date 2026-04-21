<?php
/**
 * NetInsight 360 - Tests critiques (sans framework)
 *
 * Couverture:
 * - Auth/login/session
 * - Endpoints admin sensibles
 * - Imports (statut, lock, erreurs)
 * - Alignement des rôles (vocabulaire unique)
 */

declare(strict_types=1);

$root = dirname(__DIR__, 2);
$failures = [];

function readText(string $path): string
{
    if (!is_file($path)) {
        throw new RuntimeException("Fichier introuvable: {$path}");
    }

    $content = file_get_contents($path);
    if ($content === false) {
        throw new RuntimeException("Impossible de lire: {$path}");
    }

    return $content;
}

function ok(string $label): void
{
    echo "[OK]   {$label}" . PHP_EOL;
}

function fail(string $label, string $detail, array &$failures): void
{
    $msg = "[FAIL] {$label} - {$detail}";
    $failures[] = $msg;
    echo $msg . PHP_EOL;
}

function assertContains(string $label, string $haystack, string $needle, array &$failures): void
{
    if (strpos($haystack, $needle) === false) {
        fail($label, "Texte attendu manquant: {$needle}", $failures);
        return;
    }

    ok($label);
}

function assertRegex(string $label, string $haystack, string $pattern, array &$failures): void
{
    if (!preg_match($pattern, $haystack)) {
        fail($label, "Pattern non trouvé: {$pattern}", $failures);
        return;
    }

    ok($label);
}

try {
    $login = readText($root . '/api/auth/login.php');
    $verify = readText($root . '/api/auth/verify.php');
    $requireAuth = readText($root . '/api/auth/require-auth.php');
    $csrfTokenEndpoint = readText($root . '/api/auth/csrf-token.php');
    $runImport = readText($root . '/api/admin/run-import.php');
    $runImportTech = readText($root . '/api/admin/run-import-tech.php');
    $getImportStatus = readText($root . '/api/admin/get-import-status.php');
    $getUsers = readText($root . '/api/users/get-users.php');
    $createUser = readText($root . '/api/users/create-user.php');
    $updateUser = readText($root . '/api/users/update-user.php');
    $deleteUser = readText($root . '/api/users/delete-user.php');
    $rootReadme = readText(dirname($root) . '/README.md');
    $backendReadme = readText($root . '/README.md');

    // Auth/login/session
    assertContains('Login: rate limit actif', $login, 'MAX_LOGIN_ATTEMPTS', $failures);
    assertContains('Login: session démarrée', $login, 'session_start();', $failures);
    assertContains('Login: token CSRF session', $login, "\$_SESSION['csrf_token']", $failures);
    assertContains('Verify: renvoi du token CSRF', $verify, "'csrf_token'", $failures);
    assertContains('Require-auth: timeout session', $requireAuth, 'SESSION_EXPIRY_HOURS', $failures);
    assertContains('Require-auth: contrôle méthodes mutatrices', $requireAuth, "['POST', 'PUT', 'PATCH', 'DELETE']", $failures);
    assertContains('Require-auth: erreur CSRF explicite', $requireAuth, 'CSRF_INVALID', $failures);
    assertContains('Endpoint CSRF dédié présent', $csrfTokenEndpoint, "csrf_token", $failures);

    // Endpoints admin sensibles
    assertContains('Admin import global: auth requise', $runImport, "require-auth.php", $failures);
    assertContains('Admin import global: rôle ADMIN requis', $runImport, "\$_SESSION['user_role'] !== 'ADMIN'", $failures);
    assertContains('Admin import par techno: auth requise', $runImportTech, "require-auth.php", $failures);
    assertContains('Admin import par techno: rôle ADMIN requis', $runImportTech, "'ADMIN'", $failures);
    assertContains('Users list: rôle ADMIN requis', $getUsers, "\$_SESSION['user_role'] !== 'ADMIN'", $failures);
    assertContains('Users create: rôle ADMIN requis', $createUser, "\$_SESSION['user_role'] !== 'ADMIN'", $failures);
    assertContains('Users update: rôle ADMIN requis', $updateUser, "\$_SESSION['user_role'] !== 'ADMIN'", $failures);
    assertContains('Users delete: rôle ADMIN requis', $deleteUser, "\$_SESSION['user_role'] !== 'ADMIN'", $failures);

    // Imports (statut, lock, erreurs)
    assertContains('Import global: lock file', $runImport, 'netinsight_import.lock', $failures);
    assertContains('Import global: message erreur si import en cours', $runImport, 'Un import est déjà en cours', $failures);
    assertContains('Import status: expose is_running', $getImportStatus, "'is_running'", $failures);
    assertContains('Import status: vérifie lock récent', $getImportStatus, 'time() - filemtime', $failures);

    // Alignement rôle (vocabulaire unique)
    assertRegex('README racine: rôle analyste unique', $rootReadme, '/FO_ANALYSTE/', $failures);
    assertRegex('README backend: rôle analyste unique', $backendReadme, '/FO_ANALYSTE/', $failures);
    if (preg_match('/FO_NPM|FO_CORE_RAN/', $rootReadme)) {
        fail('README racine', 'Rôles obsolètes détectés (FO_NPM/FO_CORE_RAN)', $failures);
    } else {
        ok('README racine: pas de rôles obsolètes');
    }
    if (preg_match('/FO_NPM|FO_CORE_RAN/', $backendReadme)) {
        fail('README backend', 'Rôles obsolètes détectés (FO_NPM/FO_CORE_RAN)', $failures);
    } else {
        ok('README backend: pas de rôles obsolètes');
    }
} catch (Throwable $e) {
    fail('Initialisation des tests', $e->getMessage(), $failures);
}

echo PHP_EOL;
if (!empty($failures)) {
    echo 'Résultat: ECHEC (' . count($failures) . ' problème(s))' . PHP_EOL;
    exit(1);
}

echo 'Résultat: SUCCES' . PHP_EOL;
exit(0);
