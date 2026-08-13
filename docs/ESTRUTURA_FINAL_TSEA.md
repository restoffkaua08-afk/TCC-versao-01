# Estrutura Final — TSEA V-Twin (Versão Final)

Data: 2026-06-08

Resumo rápido
- Projeto: Demonstracao_Tsea
- Objetivo: Gateway + IHM + Gerente funcionando ponta a ponta, com gerador de gráficos que cria planilhas no Google Sheets quando permitido e gera CSV local de fallback quando não.

Estrutura principal

- gateway_fisico/
   - backend/
      - app/
         - main.py                 (FastAPI app)
         - google_sheets_bridge.py (integração Sheets/Drive + fallback CSV)
         - charts_bridge.py       (prepara dados para gráficos)
         - real_bridge.py         (validações de start relaxadas para protótipo)
      - data/                    (arquivos locais: tokens, client_secret, generated)
      - .venv_gateway/           (venv local - não commitado)

- ihm_operador/
   - frontend/                 (IHM - Vite + React)

- sistema_gerente/
   - frontend/                 (Gerente - Vite + React)
      - src/pages/TraceabilityChartsPanel.tsx (UI do gerador com fallback CSV)

- scripts/
   - abrir_tsea_completo.ps1    (script para iniciar backend e frontends)

O que foi verificado (resumo de testes)
- Compilação/build
   - `gateway_fisico/backend` — `py_compile` passou para módulos alterados.
   - `ihm_operador/frontend` — `npm run build` executado com sucesso.
   - `sistema_gerente/frontend` — `npm run build` executado com sucesso.

- Funcionalidade do gerador de gráficos
   - Fluxo ideal (Google Sheets): quando a conta/credencial Google tem permissão e quota, a API cria a planilha e retorna `spreadsheet_url`.
   - Fluxo fallback: quando a criação no Google falha (ex.: quota/permissão), o backend gera um CSV local codificado em base64 e retorna `fallback_csv_base64` e `fallback_csv_filename` → o frontend baixa automaticamente o CSV.
   - Testes E2E realizados: chamadas `POST /api/google-sheets/generate-chart` resultaram em fallback CSV (arquivo salvo em `gateway_fisico/backend/data/e2e_fallback.csv`) — comportamento verificado.

Observações e limitações
- A geração real no Google depende de fatores externos (conta Google, quota, permissões no projeto Google Cloud). O sistema agora revela a mensagem técnica do erro quando o Google recusa, o que facilita correção por administração da conta.
- Arquivos sensíveis em `gateway_fisico/backend/data`: `google_oauth_client_secret.local.json`, `google_oauth_token.local.json` e `google_oauth_state.local.json`. Não versionar.

Como executar localmente (rápido)

1) Start backend (venv virtual):

```powershell
cd "C:\Users\Kauã\Demonstracao_Tsea\gateway_fisico\backend"
.\.venv_gateway\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8020 --reload
```

2) Start IHM (dev):

```powershell
cd "C:\Users\Kauã\Demonstracao_Tsea\ihm_operador\frontend"
npm run dev -- --host 127.0.0.1 --port 5178
```

3) Start Gerente (dev):

```powershell
cd "C:\Users\Kauã\Demonstracao_Tsea\sistema_gerente\frontend"
npm run dev -- --host 127.0.0.1 --port 5173
```

4) Gerar gráfico via UI (Gerente) ou via API:

- UI: acessar `http://127.0.0.1:5173` → Rastreabilidade > Indicadores e Gráficos → Entrar com Google (se necessário) → Gerar no Google Planilhas.
- API (teste):

```powershell
$body = @{ metric = 'operations_by_day'; chart_type = 'bar'; period = 'month'; title = 'Teste' } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:8020/api/google-sheets/generate-chart" -Method POST -ContentType "application/json" -Body $body
```

Aspectos finais
- Status atual: builds OK; gerador testado (fallback OK). Para garantia total do caminho "criar no Google", revalide com a conta Google que será usada na demo (liberar espaço, revisar escopos, ou usar outra conta com espaço e consentimento adequados).

Arquivo com resultados e passos de correção: `RELATORIO_CODEX_CORRECAO_TSEA.md`.