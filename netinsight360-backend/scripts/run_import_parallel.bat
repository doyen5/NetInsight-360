@echo off
REM ============================================
REM NetInsight 360 - Lanceur d'Import Parallèle (Batch)
REM ============================================
REM
REM Alternative au PowerShell pour lancer les 3 imports en parallèle
REM Utilisation: run_import_parallel.bat
REM
REM NOTE: Les 3 processus tournent vraiment en parallèle
REM La fenêtre affiche les logs simultanés (peut être mélangés)
REM Chaque processus a sa propre fenêtre console

setlocal enabledelayedexpansion

set "BASEPATH=c:\wamp64\www\NetInsight 360\netinsight360-backend"
set "PHPCMD=php"

echo ============================================
echo IMPORT PARALLELE 2G/3G/4G
echo ============================================
echo.

REM Vérifier PHP
php -v >nul 2>&1
if errorlevel 1 (
    echo [X] PHP non trouvé. Ajoutez PHP au PATH.
    pause
    exit /b 1
)

echo [OK] PHP trouve
echo.
echo [...] Lancement des 3 imports en parallele...
echo.

REM Lancer les 3 processus en parallèle
REM START crée une nouvelle fenêtre pour chaque processus
REM /B les lance dans la MÊME fenêtre (optionnel)

start "IMPORT 2G" "%PHPCMD%" "%BASEPATH%\scripts\import_2g_separate.php"
start "IMPORT 3G" "%PHPCMD%" "%BASEPATH%\scripts\import_3g_separate.php"
start "IMPORT 4G" "%PHPCMD%" "%BASEPATH%\scripts\import_4g_separate.php"

echo.
echo [OK] Les 3 imports ont ete lances en parallele
echo Consultez les 3 fenetres de console pour voir la progression
echo.
echo Temps estime total: 45-50 minutes
echo.
pause
