# Arranca KixInvert en local: backend (FastAPI, puerto 8000) y frontend (Next.js, puerto 3000).
# Uso: clic derecho > "Ejecutar con PowerShell", o en una terminal:  .\iniciar.ps1
#      .\iniciar.ps1 -Produccion   compila el frontend y lo sirve optimizado (más estable, sin recarga en caliente)
# Requisitos: PostgreSQL encendido y el archivo .env configurado (copia .env.example).
param([switch]$Produccion)

$root = $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path (Join-Path $root ".env"))) {
    Write-Host "Falta el archivo .env. Copia .env.example como .env y pon tu DATABASE_URL." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $python)) {
    Write-Host "Creando entorno de Python (.venv) e instalando dependencias..." -ForegroundColor Cyan
    py -3.12 -m venv (Join-Path $root ".venv")
    & $python -m pip install -r (Join-Path $root "requirements.txt")
}
if (-not (Test-Path (Join-Path $root "frontend\node_modules"))) {
    Write-Host "Instalando dependencias del frontend..." -ForegroundColor Cyan
    Push-Location (Join-Path $root "frontend"); npm ci; Pop-Location
}

# Cada servidor en su propia ventana, para ver sus mensajes y cerrarlo con Ctrl+C
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; & '$python' -X utf8 -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"
$frontendCmd = if ($Produccion) { "npm run build; npm run start" } else { "npm run dev" }
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; $frontendCmd"

Write-Host "Arrancando... la app se abre en el navegador en unos segundos." -ForegroundColor Green
Start-Sleep -Seconds $(if ($Produccion) { 40 } else { 8 })
Start-Process "http://localhost:3000"
