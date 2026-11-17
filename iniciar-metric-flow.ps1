
# ==========================================
# INICIALIZADOR - METRIC FLOW
# ==========================================

$Projeto = "$env:USERPROFILE\Documents\Projetos\metric-flow"
$Automacao = "$Projeto\automacao"

Write-Host "Iniciando Metric Flow..." -ForegroundColor Green

# 1. Iniciar frontend (Node.js)
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$Projeto'; npm run dev"
)

# 2. Iniciar API Python
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$Automacao'; & '.\.env\Scripts\python.exe' api.py"
)

Write-Host "Frontend e API iniciados!" -ForegroundColor Green
