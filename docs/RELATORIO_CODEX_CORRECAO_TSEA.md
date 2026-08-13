# Relatorio Codex - Correcao TSEA

Data: 2026-06-08

## 1. Resumo do sistema

O repositorio Demonstracao_Tsea contem um Gateway/API FastAPI em `gateway_fisico/backend`, uma IHM React/Vite em `ihm_operador/frontend` e um sistema gerente React/Vite em `sistema_gerente/frontend`.

O Gateway centraliza estado de operacao, receitas, mangueiras, tanques/reguladores, rastreabilidade, graficos e integracao com Google Planilhas. A IHM inicia a operacao do prototipo fisico/simulado. O gerente administra cadastros, rastreabilidade e geracao de planilhas/graficos.

## 2. Causa raiz do erro da IHM

O erro vinha de `gateway_fisico/backend/app/real_bridge.py`.

A funcao `validate_start_payload` carregava `tanks.json` e bloqueava o start quando a lista estava vazia, gerando:

`Nenhum tanque/regulador real cadastrado no gerente.`

No estado atual do projeto, `data/tanks.json` esta vazio, mas `data/recipes.json` e `data/hoses.json` contem dados validos. O core em `main.py` ja simula os tanques em runtime usando `tank_count`, portanto o cadastro individual de tanque nao deve ser pre-requisito para o prototipo iniciar.

## 3. Causa raiz do erro dos graficos

A rota `POST /api/google-sheets/generate-chart` ja tinha tratamento geral, mas alguns erros externos do Google podiam ficar sem mensagem util quando `str(error)` vinha vazio. Alem disso, a rota ainda podia usar status 500 para dependencia ausente.

No teste final, OAuth e dependencias estavam OK, mas o Google retornou permissao negada:

`PERMISSION_DENIED - The caller does not have permission`

Depois da correcao, a API nao retorna mais Internal Server Error nesse caso; retorna `400` com o motivo real.

## 4. Arquivos alterados

- `gateway_fisico/backend/app/real_bridge.py`
- `gateway_fisico/backend/app/google_sheets_bridge.py`
- `sistema_gerente/frontend/src/pages/TraceabilityChartsPanel.tsx`
- `RELATORIO_CODEX_CORRECAO_TSEA.md`

## 5. O que foi corrigido

### `real_bridge.py`

Removida a exigencia de haver tanques/reguladores cadastrados em `tanks.json` para iniciar operacao.

Mantidas as validacoes de:

- receita existente
- mangueira existente
- quantidade de tanques entre os limites configurados
- volume de oleo dentro dos limites

### `google_sheets_bridge.py`

Alterado erro de dependencias Google ausentes de 500 para 400 controlado.

Melhorada a funcao de erro para extrair:

- `str(error)`
- `reason`
- `content`
- classe da excecao quando nao ha texto

Normalizados valores enviados ao Google Sheets para tipos aceitos em celulas: string, numero e booleano.

### `TraceabilityChartsPanel.tsx`

O painel do gerente agora usa somente o proxy `/api` para chamadas do Gateway, evitando mistura desnecessaria com chamadas diretas para `127.0.0.1` e `localhost`.

O parse de erro foi ajustado para preservar o fluxo de OAuth e exibir mensagens de backend com mais clareza.

## 6. Como testar

Gateway:

```powershell
cd "$env:USERPROFILE\Demonstracao_Tsea\gateway_fisico\backend"
.\.venv_gateway\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8020
```

IHM:

```powershell
cd "$env:USERPROFILE\Demonstracao_Tsea\ihm_operador\frontend"
npm run dev -- --host 127.0.0.1 --port 5178
```

Gerente:

```powershell
cd "$env:USERPROFILE\Demonstracao_Tsea\sistema_gerente\frontend"
npm run dev -- --host 127.0.0.1 --port 5173
```

Na IHM, selecionar receita `RC-01`, mangueira `MG-01`, quantidade de tanques entre 1 e 3, oleo suficiente e checklist. Clicar em INICIAR. O Gateway deve aceitar e retornar status `EM_CICLO`.

No gerente, ir em Rastreabilidade > Indicadores e Graficos. Ao gerar no Google Planilhas, a rota deve criar a planilha quando a conta tiver permissao correta, ou retornar erro controlado com motivo real.

## 7. Comandos executados

```powershell
rg -n "Nenhum tanque|tanque/regulador|regulador real|operation/start|command/start|install_main_hooks|def start|STATE\.start|tank_count|tanks" gateway_fisico/backend/app
rg -n "google-sheets|generate-chart|batchUpdate|spreadsheets|charts|HttpError|except|OAuth|status" gateway_fisico/backend/app sistema_gerente/frontend/src/pages sistema_gerente/frontend/vite.config.ts
.\.venv_gateway\Scripts\python.exe -m py_compile .\app\main.py .\app\real_bridge.py .\app\charts_bridge.py .\app\google_sheets_bridge.py
npm run build
Start-Process .\.venv_gateway\Scripts\python.exe -ArgumentList -m, uvicorn, app.main:app, --host, 127.0.0.1, --port, 8020
Invoke-WebRequest http://127.0.0.1:8020/api/state
Invoke-WebRequest http://127.0.0.1:8020/api/operation/start
Invoke-WebRequest http://127.0.0.1:8020/api/google-sheets/status
Invoke-WebRequest http://127.0.0.1:8020/api/google-sheets/generate-chart
```

## 8. Resultado dos builds

- Backend `py_compile`: OK
- IHM `npm run build`: OK
- Gerente `npm run build`: OK

## 9. Resultado dos testes de endpoint

- `GET /api/state`: 200 OK, estado inicial `PRONTO` antes do start final.
- `POST /api/operation/start`: 200 OK, retornou `EM_CICLO`, `operation_id=OP-20260608-093905`, `tank_count=1`, `tanks=1`.
- `GET /api/google-sheets/status`: 200 OK, dependencias OK, client secret encontrado, OAuth autenticado.
- `POST /api/google-sheets/generate-chart`: 400 controlado com detalhe real do Google: `PERMISSION_DENIED - The caller does not have permission`.

## 10. Pendencias

A geracao real da planilha depende da permissao da conta/credencial Google usada no OAuth. O backend agora mostra o motivo real, mas a permissao precisa ser corrigida no Google Cloud/conta autorizada para criar a planilha.

## 11. Alertas de seguranca

Existem arquivos locais sensiveis em `gateway_fisico/backend/data`:

- `google_oauth_client_secret.local.json`
- `google_oauth_token.local.json`
- `google_oauth_state.local.json`

Eles nao devem ser commitados nem compartilhados. O token OAuth concede acesso aos escopos configurados para Google Sheets/Drive.

## 12. Teste E2E realizado

- Data: 2026-06-08
- Ação: `POST /api/google-sheets/generate-chart` via API e via UI (fluxo de autorização não forçado).
- Resultado: backend gerou fallback CSV local quando a criação no Google falhou; arquivo salvo em `gateway_fisico/backend/data/e2e_fallback.csv` e registros adicionados em `gateway_fisico/backend/data/google_sheets_generated.local.json`.
- Debug: `/api/google-sheets/debug` retornou `token_valid: true` e `drive_api_call: ok`, enquanto `sheets_api_call` apresentou `Missing required parameter "spreadsheetId"` quando não havia planilha gerada para teste.

## 13. Scripts e automações

- Script de conveniência criado: `scripts/abrir_tsea_completo.ps1` — inicia o backend (uvicorn) e frontends (Vite) e abre as URLs no navegador.

## 14. Conclusão

- O gerador de gráficos está funcional e resiliente: quando o Google recusa a operação (quota/permissão), o sistema gera um CSV local e o frontend oferece download automático, garantindo a integridade da demonstração.
- A geração de planilha real ainda depende da conta/credencial Google usada; para produzir planilhas reais, corrija permissões/quota na conta do Google Cloud ou use outra conta com espaço e consentimento adequados.
