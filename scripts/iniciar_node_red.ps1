# TSEA V-Twin - Iniciar Node-RED
# Sobe o Node-RED apontando para o flow do projeto.
# Uso: powershell -ExecutionPolicy Bypass -File .\scripts\iniciar_node_red.ps1

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 > $null

$Repo = Split-Path -Parent $PSScriptRoot
$Flow = Join-Path $Repo "node_red\flows.json"

Write-Host "Repositorio: $Repo"
Write-Host "Flow: $Flow"

if (-not (Test-Path $Flow)) {
    Write-Error "Flow nao encontrado em $Flow"
    exit 1
}

# Verifica Node.js
$node = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $node) {
    Write-Error "Node.js nao encontrado. Instale de https://nodejs.org"
    exit 1
}

# Verifica se Node-RED esta instalado globalmente
$nr = (Get-Command node-red -ErrorAction SilentlyContinue)
if (-not $nr) {
    Write-Host "Instalando node-red globalmente..."
    npm install -g node-red
}

# Importa o flow como projeto
$userDir = Join-Path $env:USERPROFILE ".node-red"
if (-not (Test-Path $userDir)) { New-Item -ItemType Directory -Path $userDir | Out-Null }

# Copia o flow para o diretorio do Node-RED
$destFlow = Join-Path $userDir "flows_tsea.json"
Copy-Item -Force $Flow $destFlow

Write-Host "Flow copiado para $destFlow"
Write-Host "Para carregar: abra o Node-RED em http://127.0.0.1:1880 e faca Import do arquivo."
Write-Host ""
Write-Host "Iniciando Node-RED..."
Write-Host ""

node-red --userDir $userDir
