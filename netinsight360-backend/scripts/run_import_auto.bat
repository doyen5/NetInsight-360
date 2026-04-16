@echo off
:: ============================================================
:: NetInsight 360 - Import automatique KPIs RAN toutes les 2h
:: Planifié via le Planificateur de tâches Windows.
::
:: Ce script :
::   1. Vérifie que MySQL/WAMP est accessible (optionnel)
::   2. Lance le script PHP d'import
::   3. Enregistre la date, le résultat et les erreurs dans un fichier log
:: ============================================================

:: Détecter le binaire PHP : cherche dans WAMP en priorité, puis C:\PHP, puis PATH
SET PHP_EXE=php
FOR /D %%d IN ("C:\wamp64\bin\php\php*") DO SET PHP_EXE=%%d\php.exe
IF NOT EXIST "%PHP_EXE%" SET PHP_EXE=C:\PHP\php.exe
IF NOT EXIST "%PHP_EXE%" SET PHP_EXE=php
SET SCRIPT=C:\wamp64\www\NetInsight 360\netinsight360-backend\scripts\import_ran_kpis_complete.php
SET LOG_DIR=C:\wamp64\www\NetInsight 360\netinsight360-backend\logs
SET LOG_FILE=%LOG_DIR%\import_cron.log

:: Créer le dossier logs s'il n'existe pas
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: Estampille horodatée
for /f "tokens=1-5 delims=/ " %%a in ("%DATE%") do (
    set D=%%c-%%b-%%a
)
for /f "tokens=1-3 delims=:." %%a in ("%TIME%") do (
    set T=%%a:%%b:%%c
)

echo [%D% %T%] === Démarrage import automatique === >> "%LOG_FILE%"

:: Lancer l'import PHP et capturer la sortie + code de retour
"%PHP_EXE%" -f "%SCRIPT%" >> "%LOG_FILE%" 2>&1
SET EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% EQU 0 (
    echo [%D% %T%] Import terminé avec SUCCÈS. >> "%LOG_FILE%"
) else (
    echo [%D% %T%] ERREUR import - code sortie: %EXIT_CODE% >> "%LOG_FILE%"
)

echo [%D% %T%] ============================================ >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"
