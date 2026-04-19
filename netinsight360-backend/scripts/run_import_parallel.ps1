# ============================================
# NetInsight 360 - Lanceur d'Import 2G/3G/4G Parallèle
# ============================================
# 
# OBJECTIF: Démarrer les 3 imports SIMULTANÉMENT
# pour réduire le temps total de 2h30 à ~50 minutes
#
# AVANT D'EXÉCUTER:
# 1. Ouvrir PowerShell EN TANT QUE ADMINISTRATEUR
# 2. Vérifier que PHP est dans le PATH: php -v
# 3. Vérifier les chemins dans ce script
#
# EXÉCUTION:
# PS> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# PS> .\run_import_parallel.ps1
#
# Le script:
# - Lance 3 processus PHP simultanément
# - Affiche les logs de chaque import en temps réel
# - Attend que tous les 3 se terminent
# - Affiche un résumé final

# Configuration
$basePath = "c:\wamp64\www\NetInsight 360\netinsight360-backend"
$phpExe = "php"  # Supposant que PHP est dans le PATH

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "IMPORT PARALLÈLE 2G/3G/4G" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que PHP est disponible
try {
    & $phpExe -v | Out-Null
    Write-Host "[✓] PHP trouvé" -ForegroundColor Green
} catch {
    Write-Host "[✗] PHP non trouvé. Ajoutez PHP au PATH ou spécifiez le chemin complet." -ForegroundColor Red
    exit 1
}

Write-Host "[...] Lancement des 3 imports en parallèle..." -ForegroundColor Yellow
Write-Host ""

$startTime = Get-Date

# Lancer les 3 scripts en parallèle
# Start-Process crée chaque script dans un processus séparé
# -NoNewWindow: affiche l'output dans la console actuelle

$process2G = Start-Process -FilePath $phpExe -ArgumentList "$basePath\scripts\import_2g_separate.php" -PassThru -NoNewWindow
$process3G = Start-Process -FilePath $phpExe -ArgumentList "$basePath\scripts\import_3g_separate.php" -PassThru -NoNewWindow
$process4G = Start-Process -FilePath $phpExe -ArgumentList "$basePath\scripts\import_4g_separate.php" -PassThru -NoNewWindow

Write-Host "[✓] Processus lancés:" -ForegroundColor Green
Write-Host "    PID 2G: $($process2G.Id)" -ForegroundColor Green
Write-Host "    PID 3G: $($process3G.Id)" -ForegroundColor Green
Write-Host "    PID 4G: $($process4G.Id)" -ForegroundColor Green
Write-Host ""
Write-Host "En attente de fin des imports..." -ForegroundColor Yellow

# Attendre la fin des 3 processus
$process2G.WaitForExit()
$process3G.WaitForExit()
$process4G.WaitForExit()

$endTime = Get-Date
$totalTime = ($endTime - $startTime).TotalSeconds

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "IMPORT TERMINÉ" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "[✓] Tous les imports sont terminés" -ForegroundColor Green
Write-Host "Temps total: $([Math]::Round($totalTime, 2)) secondes (~$([Math]::Round($totalTime/60, 2)) minutes)" -ForegroundColor Green
Write-Host ""
Write-Host "Codes de sortie:" -ForegroundColor Cyan
Write-Host "  2G: $($process2G.ExitCode)" 
Write-Host "  3G: $($process3G.ExitCode)"
Write-Host "  4G: $($process4G.ExitCode)"
Write-Host ""

if ($process2G.ExitCode -eq 0 -and $process3G.ExitCode -eq 0 -and $process4G.ExitCode -eq 0) {
    Write-Host "[✓] SUCCÈS - Tous les imports ont réussi!" -ForegroundColor Green
} else {
    Write-Host "[✗] ATTENTION - Au moins un import a échoué (code != 0)" -ForegroundColor Red
}

Write-Host "============================================" -ForegroundColor Cyan
