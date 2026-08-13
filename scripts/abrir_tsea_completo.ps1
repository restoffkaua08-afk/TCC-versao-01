$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 > $null

# Descobre a pasta do projeto sem precisar escrever Kauã no código.
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = Split-Path -Parent $ScriptDir

Write-Host "Projeto detectado em: $Repo" -ForegroundColor Cyan

$Backend = Join-Path $Repo "gateway_fisico\backend"
$IHM = Join-Path $Repo "ihm_operador\frontend"
$Gerente = Join-Path $Repo "sistema_gerente\frontend"

if (!(Test-Path $Backend)) {
    throw "Backend nao encontrado: $Backend"
}

if (!(Test-Path $IHM)) {
    throw "IHM nao encontrada: $IHM"
}

if (!(Test-Path $Gerente)) {
    throw "Gerente nao encontrado: $Gerente"
}

function Stop-Port {
    param([int]$Port)

    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        try {
            Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
        } catch {}
    }
}

Write-Host "Fechando portas antigas..." -ForegroundColor Cyan
Stop-Port 8020
Stop-Port 5173
Stop-Port 5178
Stop-Port 1880

Write-Host "Abrindo Gateway na porta 8020..." -ForegroundColor Cyan

$GatewayPython = Join-Path $Backend ".venv_gateway\Scripts\python.exe"

if (!(Test-Path $GatewayPython)) {
    Write-Host "Ambiente Python do Gateway nao encontrado. Criando..." -ForegroundColor Yellow
    Set-Location $Backend

    py -m venv .venv_gateway 2>$null
    if ($LASTEXITCODE -ne 0) {
        python -m venv .venv_gateway
    }

    .\.venv_gateway\Scripts\python.exe -m pip install --upgrade pip
    .\.venv_gateway\Scripts\pip.exe install fastapi uvicorn pydantic python-multipart requests pymodbus google-api-python-client google-auth google-auth-oauthlib google-auth-httplib2 XlsxWriter
}

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command",
    "cd `"$Backend`"; .\.venv_gateway\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8020 --reload"
)

Start-Sleep -Seconds 3

Write-Host "Abrindo Sistema Gerente na porta 5173..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command",
    "cd `"$Gerente`"; if (!(Test-Path node_modules)) { npm install }; npm run dev -- --host 127.0.0.1 --port 5173"
)

Start-Sleep -Seconds 2

Write-Host "Abrindo IHM na porta 5178..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command",
    "cd `"$IHM`"; if (!(Test-Path node_modules)) { npm install }; npm run dev -- --host 127.0.0.1 --port 5178"
)

Start-Sleep -Seconds 5

# Tenta subir o Node-RED opcionalmente (Bancada IoT SENAI)
$NodeRedCmd = Get-Command node-red -ErrorAction SilentlyContinue
if ($NodeRedCmd) {
    Write-Host "Abrindo Node-RED na porta 1880..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command",
        "node-red --userDir `"$env:USERPROFILE\.node-red`""
    )
    Start-Sleep -Seconds 2
    Write-Host "Node-RED:         http://127.0.0.1:1880"
    Write-Host "  IMPORTANTE: faca import do flow em node_red\flows.json no Node-RED"
} else {
    Write-Host "Node-RED nao instalado globalmente - pule este passo se nao for usar bancada IoT SENAI." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Sistema iniciado." -ForegroundColor Green
Write-Host "Gateway:          http://127.0.0.1:8020"
Write-Host "Estado:           http://127.0.0.1:8020/api/state"
Write-Host "Gerente:          http://127.0.0.1:5173"
Write-Host "IHM:              http://127.0.0.1:5178"
Write-Host "Node-RED:         http://127.0.0.1:1880 (se instalado)"

Start-Process "http://127.0.0.1:5173"
Start-Process "http://127.0.0.1:5178"