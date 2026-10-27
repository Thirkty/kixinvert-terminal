# Arranca KixInvert en local: una sola app en http://127.0.0.1:8000
# (FastAPI sirve la API y el frontend compilado de Next.js).
# Uso: clic derecho > "Ejecutar con PowerShell", o en una terminal:  .\iniciar.ps1
#      .\iniciar.ps1 -Desarrollo   para editar el frontend con recarga en caliente
#                                  (abre además Next.js en el puerto 3000, que usa la API del 8000)
# Requisitos: PostgreSQL encendido y el archivo .env configurado (copia .env.example).
param([switch]$Desarrollo)

$root = $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"
$frontend = Join-Path $root "frontend"

if (-not (Test-Path (Join-Path $root ".env"))) {
    Write-Host "Falta el archivo .env. Copia .env.example como .env y pon tu DATABASE_URL." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $python)) {
    Write-Host "Creando entorno de Python (.venv) e instalando dependencias..." -ForegroundColor Cyan
    py -3.12 -m venv (Join-Path $root ".venv")
    & $python -m pip install -r (Join-Path $root "requirements.txt")
}
if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
    Write-Host "Instalando dependencias del frontend..." -ForegroundColor Cyan
    Push-Location $frontend; npm ci; Pop-Location
}

if (-not $Desarrollo) {
    # Compila el frontend para que el backend lo sirva con el diseño y las animaciones actuales
    Write-Host "Compilando el frontend..." -ForegroundColor Cyan
    Push-Location $frontend; npm run build; $ok = $?; Pop-Location
    if (-not $ok) { Write-Host "La compilación del frontend falló." -ForegroundColor Red; exit 1 }
}

# Cada servidor en su propia ventana, para ver sus mensajes y cerrarlo con Ctrl+C
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; & '$python' -X utf8 -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"
$url = "http://127.0.0.1:8000"
if ($Desarrollo) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontend'; npm run dev"
    $url = "http://localhost:3000"
}

Write-Host "Arrancando... la app se abre en $url en unos segundos." -ForegroundColor Green
Start-Sleep -Seconds 8
Start-Process $url
