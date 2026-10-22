# Roda um JSX no After Effects mais recente instalado.
# Uso: powershell -File rodar_no_after.ps1 C:\caminho\projeto.jsx
# So use com autorizacao do usuario: o script altera o projeto aberto no After.
# Notas testadas no AE 2026 (Windows):
#  - "-r" com o After fechado so abre o programa e ignora o script; por isso abrimos antes.
#  - o caminho vai SEM aspas (com aspas o After ignora o script), mesmo com espacos.
param([Parameter(Mandatory = $true)][string]$Jsx)

$jsxFull = (Resolve-Path $Jsx).Path
$ae = Get-ChildItem "C:\Program Files\Adobe" -Directory -Filter "Adobe After Effects 20*" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -First 1
if (-not $ae) { Write-Error "After Effects nao encontrado em C:\Program Files\Adobe"; exit 1 }
$exe = Join-Path $ae.FullName "Support Files\AfterFX.exe"

$proc = Get-Process AfterFX -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle }
if (-not $proc) {
    Write-Output "Abrindo $($ae.Name)..."
    Start-Process -FilePath $exe | Out-Null
    $limite = (Get-Date).AddMinutes(3)
    do { Start-Sleep 3; $proc = Get-Process AfterFX -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } }
    while (-not $proc -and (Get-Date) -lt $limite)
    if (-not $proc) { Write-Error "O After nao abriu a tempo"; exit 1 }
    Start-Sleep 5
}
Start-Process -FilePath $exe -ArgumentList ("-r " + $jsxFull) | Out-Null
Write-Output "Script enviado ao $($ae.Name): $jsxFull"
