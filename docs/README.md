# TSEA Sistema

Protótipo industrial para controle simulado do processo de vácuo em até 3 tanques de reguladores da TSEA.

O sistema representa o processo TSEA com tanques, mangueiras, receitas, bomba primária Leybold SOGEVAC SV630B, bomba Roots Leybold RUVAC WSU2001, injeção de óleo, risco estrutural, alarmes industriais, rastreabilidade, histórico, Gêmeo Digital, what-if, manutenção preditiva, relatórios e assistente do operador.

## Estrutura

- `backend/`: API FastAPI, SQLite, models SQLModel, engine TSEA, alarmes, rastreabilidade e serviços analíticos.
- `frontend/`: supervisório React/TypeScript com navegação executiva e técnica.
- `docs/`: documentação técnica e operacional.

## Executar Backend

```powershell
cd backend
uv venv .venv --python 3.12
uv pip install -r requirements.txt
uv run uvicorn app.main:app --reload --port 8000
```

API: `http://localhost:8000/api`

Docs interativas: `http://localhost:8000/docs`

## Executar Frontend

```powershell
cd frontend
npm install
npm.cmd run dev
```

Painel: `http://localhost:5173`

## Fluxo Operacional

1. A API cria dados iniciais de tanques, mangueiras, receita e operador.
2. O frontend chama `POST /api/operation/tick` periodicamente.
3. A engine liga a primária SV630B, reduz a pressão por tanque e libera a Roots WSU2001 somente abaixo da pressão segura da receita.
4. Cada leitura registra pressão real simulada, pressão esperada, óleo, perda de carga da mangueira e risco de colapso.
5. A API persiste leituras, ciclos, alarmes, eventos de rastreabilidade, manutenção e resultados what-if.

## Navegação

- Operação
- Histórico e Rastreabilidade
- Inteligência do Processo
- Relatórios
- Configurações

## Verificações

```powershell
cd frontend
npm.cmd run build
```

```powershell
cd backend
uv run python -m compileall app
```

## Gêmeo Digital com cenários demonstrativos

Esta versão adiciona uma camada de demonstração para o Gêmeo Digital.

Novos endpoints:

- `GET /api/scenarios`: lista cenários.
- `GET /api/scenarios/{scenario_id}`: detalha cenário.
- `POST /api/scenarios/{scenario_id}/run`: executa cenário e retorna timeline, alarmes, diagnóstico e recomendação.
- `POST /api/ai-chat`: assistente contextual com OpenAI quando `OPENAI_API_KEY` estiver configurada.

Cenários disponíveis:

- `safe_cycle`: operação segura.
- `delayed_oil_collapse`: óleo atrasado com risco estrutural.
- `early_roots_start`: Roots acionada fora da faixa segura.
- `hose_loss_high`: mangueira longa com perda elevada.
- `tank_leak`: vazamento em um tanque.
- `sensor_failure`: falha de sensor.

O objetivo desses cenários é demonstrar, de forma clara, como o Gêmeo Digital ajuda a prever falhas, justificar alarmes e recomendar ações antes que uma operação real seja comprometida.

Para usar IA real:

1. Crie `backend/.env`.
2. Adicione `OPENAI_API_KEY=sua_chave`.
3. Reinicie o backend.

Sem chave, o sistema usa fallback local baseado em regras.

## Operação configurável

A tela de Operação agora permite configurar manualmente o ciclo antes de simular.

Campos disponíveis:

- Tipo do tanque.
- Mangueira.
- Pressão final desejada.
- Pressão para ligar a Roots.
- Pressão para desligar as bombas.
- Vazão de óleo.
- Atraso da injeção de óleo.
- Tempo máximo de ciclo.
- Velocidade da Roots em Hz.
- Rampa de vácuo.
- Correção da mangueira.
- Compensação de óleo.
- Tanque específico.
- Limite de desvio real x esperado.
- Simular vazamento.
- Simular falha de sensor.
- Simular perda de comunicação com CLP.

Novos endpoints:

- `GET /api/operation/config-options`
- `POST /api/operation/manual-simulate`

O objetivo é demonstrar cenários seguros e cenários críticos, mostrando como o Gêmeo Digital calcula curva de pressão, perda de carga, pressão efetiva, risco de colapso e alarmes.

## Correção de UX: Operação x Gêmeo Digital

A tela `Operação` agora é focada em supervisão ao vivo do processo.

A tela `Gêmeo Digital` concentra as simulações hipotéticas, cenários prontos e configuração manual dos parâmetros:

- Tipo do tanque.
- Mangueira.
- Pressão final desejada.
- Pressão para ligar a Roots.
- Pressão para desligar as bombas.
- Vazão de óleo.
- Atraso da injeção de óleo.
- Tempo máximo.
- Velocidade da Roots.
- Rampa de vácuo.
- Correção da mangueira.
- Compensação de óleo.
- Vazamento simulado.
- Falha de sensor.
- Perda de comunicação com CLP.

Também foi adicionado um visual do regulador/tanque:

- Azul: ar/gás interno.
- Vermelho: carga de pressão.
- Amarelo: óleo.

Esse visual aparece na operação ao vivo e nas simulações do Gêmeo Digital.
=====================================================================
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 > $null

$Project = "$env:USERPROFILE\Desktop\TSEA-Sistema"

cd $Project

Write-Host "Parando servidores antigos..." -ForegroundColor Cyan
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Abrindo projeto no VS Code..." -ForegroundColor Cyan
code $Project

Write-Host "Subindo backend na porta 8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit","-Command","cd `"$Project\backend`"; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

Start-Sleep -Seconds 4

Write-Host "Subindo frontend na porta 5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit","-Command","cd `"$Project\frontend`"; npm run dev"

Start-Sleep -Seconds 5

Write-Host "Abrindo sistema no navegador..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host "Abrindo documentação da API..." -ForegroundColor Cyan
Start-Process "http://127.0.0.1:8000/docs"

Write-Host "Sistema iniciado. Deixe as duas janelas do backend e frontend abertas." -ForegroundColor Green