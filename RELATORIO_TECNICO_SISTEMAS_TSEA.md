# Relatório Técnico do Sistema Supervisório e Interface Homem-Máquina (IHM)
## TSEA V-Twin — Sistema Supervisório + IHM (apenas camada de software)

**Versão:** 1.0
**Data:** 2026-07-29
**Escopo:** exclusivamente os sistemas de software desenvolvidos — Gateway FastAPI, Sistema Gerente (supervisório) e IHM do Operador. **A camada física (CLP Altus XP325, Modbus TCP, Node-RED, motores, faróis) está fora do escopo deste relatório**, conforme restrição do solicitante.

---

## 1. Visão Geral

O **TSEA V-Twin** é um sistema supervisório industrial para controle, monitoramento, rastreabilidade e geração de indicadores do processo de **vácuo em tanques e reguladores** de gás. O projeto é composto por **três aplicações de software** que se comunicam entre si por HTTP/JSON e WebSocket, e por uma camada de persistência local baseada em arquivos JSON.

### Objetivo do projeto

Disponibilizar ao usuário final (operador e gestão) um sistema digital capaz de:

- Conduzir um **ciclo completo de vácuo** em tanques a partir de uma receita de processo.
- **Visualizar em tempo real** o estado de cada tanque, das bombas (B1 e B2), do sistema de óleo, da pressão, do risco estrutural e da sinalização luminosa.
- **Padronizar e rastrear** cada operação (quem executou, em qual tanque, com qual receita, em que horário, com quais medições).
- **Exportar registros** em formato `.docx` (Word) e `.xlsx` (Excel) para fins de auditoria e apresentação.
- **Simular cenários** (Gêmeo Digital) antes de aplicar mudanças em produção, sem afetar o ciclo real.
- **Manter cadastros** de tanques, mangueiras, receitas, fórmulas e operadores, persistidos localmente.

### Fronteira do relatório

| Camada | Incluída? | Justificativa |
|---|---|---|
| Gateway FastAPI (Python) | ✅ | Software central, peça-chave |
| Sistema Gerente (React 19 / TS) | ✅ | Sistema supervisório, foco do relatório |
| IHM do Operador (React 18 / TS) | ✅ | Interface homem-máquina, foco do relatório |
| Persistência em JSON / `data/` | ✅ | Como o software guarda estado |
| WebSocket `/ws/live` | ✅ | Canal de tempo real |
| `node_red_bridge.py` | ⚠️ apenas citado | É um *adapter* HTTP para um sistema externo (Node-RED), **não é parte dos "meus sistemas"** — incluído apenas como ponto de integração |
| `plc_modbus_bridge.py` | ❌ | Excluído por restrição |
| Node-RED, CLP Altus XP325, Modbus TCP, bancada física | ❌ | Excluídos por restrição |

---

## 2. Objetivos

### 2.1 Objetivo geral

Construir uma plataforma de software modular que implemente o ciclo de vácuo completo (Preparo → Vácuo Inicial → Vácuo Profundo → Injeção de Óleo → Estabilização → Finalização) com separação clara entre a **visão do operador** (IHM) e a **visão gerencial** (Sistema Gerente), ambas alimentadas por um **gateway único** de estado.

### 2.2 Objetivos específicos

1. **Padronizar a operação** via receitas editáveis (pressão-alvo, volume de óleo, tempo de cada etapa, mangueira vinculada).
2. **Garantir segurança operacional** com checklists pré e pós-ciclo, lockout de botões perigosos e rotina de emergência dedicada.
3. **Rastrear 100% das operações** com registros imutáveis (`operation_records.json`) contendo medições, tempos, alertas, versão da receita e configuração usada.
4. **Fornecer indicadores gerenciais** por meio de gráficos (rampa de vácuo em tempo real, distribuição de status, alarmes, performance, etc.).
5. **Permitir simulação de risco** (Gêmeo Digital) com 4 cenários-base e cenários customizados pelo gerente, sem afetar o ciclo real.
6. **Exportar evidências** em Word (relatório da operação) e Excel/Sheets (lista de operações).
7. **Operar offline** em modo simulado, sem depender de nenhum hardware externo, para fins de demonstração e validação.

---

## 3. Arquitetura do Software

### 3.1 Visão macro

```
┌──────────────────────────┐    ┌──────────────────────────┐
│   IHM do Operador        │    │  Sistema Gerente         │
│   React 18 + TS 5.6      │    │  React 19 + TS 5.7       │
│   Vite 5.4 · porta 5178  │    │  Vite 6.0 · porta 5173   │
└────────────┬─────────────┘    └─────────────┬────────────┘
             │ REST + WebSocket              │ REST + WebSocket
             │ (polling 1s / 3s / 4s)        │ (polling 4s)
             ▼                                ▼
       ┌──────────────────────────────────────────┐
       │       Gateway FastAPI (Python)            │
       │       FastAPI + Uvicorn · porta 8020     │
       │  ┌──────────────┐  ┌──────────────────┐  │
       │  │ main.py      │  │ real_bridge.py   │  │
       │  │ (núcleo)     │  │ (cadastros + HW) │  │
       │  └──────────────┘  └──────────────────┘  │
       │  ┌──────────────┐  ┌──────────────────┐  │
       │  │ charts_bridge│  │ node_red_bridge  │  │
       │  │ (gráficos)   │  │ (adapter HTTP)   │  │
       │  └──────────────┘  └──────────────────┘  │
       └──────────────────┬───────────────────────┘
                          │ JSON files
                          ▼
              ┌──────────────────────────┐
              │  gateway_fisico/backend/ │
              │  data/                   │
              │  · recipes.json          │
              │  · tanks.json            │
              │  · hoses.json            │
              │  · operation_records.json│
              │  · chart_telemetry.json  │
              │  · chart_workspace.json  │
              │  · reports.json          │
              └──────────────────────────┘
```

### 3.2 Portas e processos

| Aplicação | Tecnologia | Porta | Origem |
|---|---|---|---|
| Gateway (backend) | FastAPI + Uvicorn (Python) | `8020` | `gateway_fisico/backend/app/main.py` |
| Sistema Gerente | React 19 + Vite 6 | `5173` | `sistema_gerente/frontend/` |
| IHM do Operador | React 18 + Vite 5 | `5178` | `ihm_operador/frontend/` |
| WebSocket | `/ws/live` | `8020` | Mesmo processo do Gateway |

### 3.3 Camadas internas

| Camada | Responsabilidade | Arquivos-chave |
|---|---|---|
| **API / Orquestrador** | Receber comandos, manter estado de operação, expor REST e WS | `app/main.py` (1373 linhas) |
| **Cadastros reais** | CRUD de tanques, mangueiras, receitas, fórmulas; integração HW | `app/real_bridge.py` (1165 linhas) |
| **Gráficos e indicadores** | Catálogo, métricas, workspace dos gráficos | `app/charts_bridge.py` (1025 linhas) |
| **Adaptador HTTP externo** | Encaminhar `cycle`/`emergency` para fora (Node-RED) | `app/node_red_bridge.py` |
| **Persistência** | JSON files em `gateway_fisico/backend/data/` | Lidos por todos os bridges |

---

## 4. Sistema Supervisório (Gerente — React 19)

É a **interface de gestão**. Foco em **visão, indicadores, configuração e auditoria**. Acessado em `http://127.0.0.1:5173`.

### 4.1 Camada de acesso

* `ManagerRootGate` → wrapper de boot
* `AccessGate` → splash de boot (5 s) → tela de login (se não houver usuário no `localStorage`) → splash pós-login (3 s) → sistema
* `managerUsers.ts` → 3 usuários hardcoded:
  * `1001 / 1234` — Kauã Restoff (Admin)
  * `2001 / 1234` — Operador TSEA
  * `3001 / 1234` — Supervisor TSEA
* Logs de acesso gravados em `localStorage` (`tsea_manager_access_logs`).

### 4.2 Layout (`AppShell`)

* **Top bar** com identidade visual TSEA, status badge, alternância de tema (claro/escuro), colapso do menu lateral.
* **Menu lateral** com 5 entradas:
  1. **Painel** (Dashboard)
  2. **Operação**
  3. **Gêmeo Digital**
  4. **Rastreabilidade**
  5. **Parâmetros**

### 4.3 Tela 1 — Painel (Dashboard)

**Arquivo:** `pages/DashboardPage.tsx` (206 linhas)

* 4 métricas em destaque: **Estado do Ciclo · Pressão Média · Risco Máximo · Registros**.
* **Mapa operacional** com um card por tanque: visual de tanque industrial (gás, pressão, óleo), código, tipo, leitura atual, pressão-alvo, volume de óleo, risco estrutural, mangueira vinculada, sinal luminoso (verde/amarelo/vermelho) e nota de processo.
* **Cards laterais** com a Bomba Primária (B1 — Leybold SOGEVAC SV 630 B) e Bomba Secundária / Roots (B2 — Leybold RUVAC WSU 2001), além de **Sensores e Óleo** (vazão, volume estimado, status).
* **Componente `RealtimeRamp`** — rampa de vácuo em tempo real (compartilhado com a tela de Rastreabilidade).

### 4.4 Tela 2 — Operação (`OperationPage.tsx`, 711 linhas)

Tela de "copiloto" durante a execução de uma operação:
* Visualiza o estado do ciclo em tempo real, com tanques em cards grandes.
* Permite ao gerente (não operador) **intervir em receitas** durante o ciclo, se autorizado.
* Mostra console de eventos e log de comandos.
* Botões de **start / pause / resume / stop / emergency** refletindo o estado atual.
* Reflete o `OperationState` retornado por `/api/operation/state`.

### 4.5 Tela 3 — Gêmeo Digital (`DigitalTwinPage.tsx`, 999 linhas)

Recurso único deste sistema. Permite **simular condições** e ver o resultado em isolamento, sem tocar o ciclo real.

* **4 cenários base** (base-seguro, base-produtivo, base-mangueira, base-sensor) — cada um com configuração pré-definida de tanques, mangueiras, receitas, fórmulas.
* **Cenários customizados** salvos em `localStorage` (`tsea.gemeo10.customScenarios`).
* Executa `/api/digital-twin/simulate` (POST) e armazena o último resultado (`tsea.gemeo10.lastResult`).
* Renderiza resultado com `RealtimeRamp` para comparar curvas esperada vs medida.
* Histórico de simulações em `tsea.gemeo10.history`.

### 4.6 Tela 4 — Rastreabilidade

Dividida em duas áreas:

#### 4.6.1 Lista e detalhe (`TraceabilityPage.tsx`, 1195 linhas)

* Lista de **operações** + **simulações** com filtros por data, status, operador.
* Detalhe da operação (`TseaRecordDetail`) — todas as medições, alertas, eventos, checklist.
* Exporta **Word** da operação via `tseaHRBuildWordRecord` + `tseaHRDownloadWord` (gera `.docx` no cliente).
* Exporta **Excel** agregado via Google Sheets bridge (`google_sheets_bridge.py`) ou `.xlsx` local.
* Exporta **Word geral** (`tseaHRBuildWordGeneral`) — múltiplas operações em um único documento.

#### 4.6.2 Gráficos (`TraceabilityChartsPanel.tsx`, 996 linhas)

Painel de gráficos do Gerente, com 10 métricas disponíveis:

| Métrica | Função |
|---|---|
| `operations_by_day` | Operações por dia (linha) |
| `operation_status` | Pizza de status (PRONTO, EM_CICLO, PAUSADO, FINALIZADO, BLOQUEADO) |
| `cycle_time` | Histograma de tempo de ciclo |
| `vacuum_ramp` | Rampa de vácuo — tempo vs pressão |
| `alarms_by_type` | Barras por tipo de alarme |
| `equipment_usage` | Uso percentual de bombas B1/B2 |
| `machine_performance` | Performance por máquina |
| `reports_exported` | Quantidade de relatórios emitidos |
| `logs_by_severity` | Logs por severidade |
| `pressure_target_vs_measured` | Pressão alvo vs medida |
| `oil_injected_by_operation` | Óleo injetado por operação |

Funções: `loadCatalog`, `loadStatistics`, `loadWorkspace`, `saveWorkspace`, `deleteWorkspace`. Operam sobre `/api/charts/*`. Os workspaces (conjuntos de gráficos selecionados) ficam em `chart_workspace.json`.

### 4.7 Tela 5 — Parâmetros (`ParametersPage.tsx`, 311 linhas)

Cadastros persistidos em `data/`:
* **Tanques** — código, tipo, volume, limites estruturais.
* **Mangueiras** — código, comprimento, diâmetro, perdas, volume interno (calculado).
* **Receitas** — etapas, duração, pressões-alvo, óleo, mangueiras vinculadas.
* **Fórmulas** — expressões de cálculo customizadas.
* **Operadores** — usuários do sistema.

Todas as edições são feitas via `/api/real/*` (POST/PUT/DELETE) e `/api/parameters`.

### 4.8 Configurações locais (`localStorage`)

| Chave | Função |
|---|---|
| `tsea.theme` | Tema claro/escuro |
| `tsea.operationConfig` | Configuração padrão de operação |
| `tsea.twinConfiguracao` | Última config do Gêmeo Digital |
| `tsea.localTanks/hoses/recipes/formulas/operators` | Cache local dos cadastros |
| `tsea.gemeo10.customScenarios` | Cenários custom do Gêmeo |
| `tsea.gemeo10.history` | Histórico de simulações |
| `tsea.gemeo10.lastResult` | Resultado da última simulação |
| `tsea_manager_current_user` | Usuário autenticado |
| `tsea_manager_access_logs` | Log de logins |

### 4.9 Painel flutuante de integração (`HardwareBridgePanel`)

* Dock flutuante com status de **PLC / ESP32 / Gateway**.
* Polling de 1 s em `/api/hardware/state`.
* No Gerente (variante admin) mostra **botões de modo** (SIMULADO, BANCADA_SEGURA, FISICO_HTTP) + **RESET**.
* Exibe `desired_outputs` (B1, B2, óleo, farol verde/amarelo/vermelho, emergency_stop) e ack do PLC.

---

## 5. IHM (Interface Homem-Máquina do Operador)

Acessada em `http://127.0.0.1:5178`. É a **estação de trabalho do operador de chão de fábrica**. Foco em **eficiência, segurança e clareza visual**.

### 5.1 Stack e contexto

* **React 18.3.1** + **TypeScript 5.6.3** + **Vite 5.4.11**.
* `lucide-react` para ícones.
* Polling:
  * **1 s** — `/api/state` (loop principal)
  * **3 s** — `/api/real/parameters`, `/api/real/recipes`
* Persistência local: `localStorage` `tsea_ihm_registros_dia`.
* Comandos enviados por `POST`:
  * `/api/command/start`
  * `/api/command/emergency`
  * `/api/command/stop`
  * `/api/checklist/pre`
  * `/api/checklist/final`

### 5.2 Máquina de fases

```
boot → inicial → preparar_receita → preparar_dados
                                    → checklist_pre
                                    → revisao
                                    → operação
                                    → finalizacao
                                    → registros_dia
                                    → alarmes
```

| Fase | Função |
|---|---|
| `boot` | Splash inicial |
| `inicial` | Tela de boas-vindas, seleção de operador |
| `preparar_receita` | Seleção da receita (RC-01, MG-01, etc.) |
| `preparar_dados` | Confirmação dos parâmetros do ciclo |
| `checklist_pre` | 9 itens de checklist pré-ciclo |
| `revisao` | Tela de revisão final antes de iniciar |
| `operação` | Ciclo em andamento, com 4 abas: **Reguladores · Bombas · Óleo · Informações** |
| `finalizacao` | 9 itens de checklist pós-ciclo |
| `registros_dia` | Histórico de operações do dia |
| `alarmes` | Lista de alarmes ativos |

### 5.3 Limites operacionais (`OPERATIONAL_LIMITS`)

| Parâmetro | Faixa |
|---|---|
| Tanques | 1 a 3 |
| Volume de óleo | 0 a 300 L |
| Pressão | 0,01 a 1013 mbar |
| Tempo de ciclo | 30 a 3600 s |
| Perda de carga da mangueira | até 15 mbar |

### 5.4 Códigos de alarme (6)

| Código | Descrição |
|---|---|
| `ALM-001` | Gateway offline |
| `ALM-002` | Perda de comunicação com sensor |
| `ALM-003` | Pressão fora da faixa |
| `ALM-004` | Volume de óleo acima do limite |
| `ALM-005` | Checklist não confirmado |
| `ALM-006` | Estado da operação inválido |

### 5.5 Checklists

* **Pré-ciclo (9 itens)** — integridade física, mangueiras conectadas, nível de óleo, EPI, etc.
* **Pós-ciclo (9 itens)** — despressurização, desconexão, limpeza, registro.

### 5.6 Abas durante o ciclo

* **Reguladores** — pressão, pressão-alvo, status do regulador.
* **Bombas** — B1 e B2 com health, modelo, rotação, temperatura.
* **Óleo** — volume injetado, vazão, status.
* **Informações** — etapa atual, tempo decorrido, alertas recentes.

### 5.7 Painel de integração (`HardwareBridgePanel` variante IHM)

* Versão *read-only* do painel — **sem botões de modo** e **sem reset**.
* Apenas monitoramento: PLC online? ESP32 ok? Gateway ok? Saídas desejadas? Confirmação do PLC?

### 5.8 Acessórios

* `IhmIndustrialIcon` — helper para ícones SVG (operação, registro, tanque, tempo, pressão, óleo).
* `IndustrialIcons.tsx` — biblioteca de ícones custom.

---

## 6. Tecnologias Utilizadas

### 6.1 Backend (Gateway)

| Tecnologia | Versão | Uso |
|---|---|---|
| Python | 3.x | Runtime |
| FastAPI | atual | Framework HTTP assíncrono |
| Uvicorn | atual | Servidor ASGI |
| Pydantic | atual | Validação de schemas (RecipePayload, StartCommand, ChecklistPayload) |
| WebSocket | stdlib | Broadcast de `/ws/live` |
| asyncio | stdlib | Loop de simulação 1 Hz |
| python-multipart | atual | Form data |
| requests | atual | Cliente HTTP (Node-RED adapter) |
| PyYAML / JSON | stdlib | Persistência |
| openpyxl / XlsxWriter | atual | Export `.xlsx` |

### 6.2 Frontend Gerente

| Tecnologia | Versão | Uso |
|---|---|---|
| React | 19 | UI |
| TypeScript | 5.7.2 | Tipagem |
| Vite | 6.0.7 | Bundler e dev server |
| Chart.js | 4.4.0 | Gráficos |
| lucide-react | atual | Ícones |
| CSS custom | — | Tema claro/escuro, dashboard industrial |

### 6.3 Frontend IHM

| Tecnologia | Versão | Uso |
|---|---|---|
| React | 18.3.1 | UI |
| TypeScript | 5.6.3 | Tipagem |
| Vite | 5.4.11 | Bundler e dev server |
| lucide-react | atual | Ícones |
| CSS custom | — | Tema industrial |

### 6.4 Persistência

* **JSON files** — única fonte de verdade do estado.
* Diretório: `gateway_fisico/backend/data/`.

### 6.5 Comunicação

| Protocolo | Uso |
|---|---|
| HTTP REST | Comandos, leitura de estado, CRUD |
| WebSocket `/ws/live` | Broadcast de estado em tempo real |
| CORS | Liberado para origens locais (5173, 5178) |

### 6.6 Excluídos por restrição

* CLP Altus XP325
* Node-RED
* Modbus TCP
* MestreTool / Structured Text
* ESP32 (aparece no painel como status, mas não é detalhe do software)

---

## 7. Funcionalidades

### 7.1 Sistema Supervisório (Gerente)

| Funcionalidade | Onde |
|---|---|
| Login com 3 perfis (Admin, Operador, Supervisor) | `AccessGate.tsx` |
| Dashboard com mapa de tanques, bombas, sensores e óleo | `DashboardPage.tsx` |
| Gráfico de rampa de vácuo em tempo real | `RealtimeRamp` |
| Operação ao vivo (estado, comandos, eventos) | `OperationPage.tsx` |
| Gêmeo Digital com 4 cenários base + custom | `DigitalTwinPage.tsx` |
| Histórico de operações e simulações | `TraceabilityPage.tsx` |
| Detalhe da operação (registros, medições, alertas) | `TseaRecordDetail` |
| Exportação de operação para Word (.docx) | `tseaHRBuildWordRecord` |
| Exportação geral (múltiplas operações) para Word | `tseaHRBuildWordGeneral` |
| Exportação para Excel/Google Sheets | `google_sheets_bridge.py` |
| Painel de 10 gráficos gerenciais | `TraceabilityChartsPanel.tsx` |
| CRUD de tanques, mangueiras, receitas, fórmulas, operadores | `ParametersPage.tsx` |
| Temas claro/escuro | `AppShell.tsx` |
| Logs de acesso | `managerUsers.ts` |
| Painel de status do hardware (PLC/ESP32/Gateway) | `HardwareBridgePanel.tsx` |
| Alarmes: lista, filtros, detalhes | `/api/alarms` |
| Manutenção preditiva | `/api/maintenance/prediction` |

### 7.2 IHM do Operador

| Funcionalidade | Onde |
|---|---|
| Boot splash + seleção de operador | fase `boot`/`inicial` |
| Seleção de receita | fase `preparar_receita` |
| Confirmação de parâmetros | fase `preparar_dados` |
| Checklist pré-ciclo (9 itens) | fase `checklist_pre` |
| Tela de revisão final | fase `revisao` |
| Início de ciclo (comando `start`) | fase `operação` |
| Acompanhamento em 4 abas (Reguladores, Bombas, Óleo, Informações) | durante ciclo |
| Acionamento de **emergência** | botão sempre disponível |
| Checklist pós-ciclo (9 itens) | fase `finalizacao` |
| Registros do dia (ciclo atual) | fase `registros_dia` |
| Tela de alarmes | fase `alarmes` |
| Status do hardware (somente leitura) | `HardwareBridgePanel.tsx` (variante IHM) |
| Validação de limites (tanques, óleo, pressão, tempo) | `OPERATIONAL_LIMITS` |

### 7.3 Gateway (Backend)

| Funcionalidade | Endpoint |
|---|---|
| Health-check | `GET /api/health` |
| Snapshot do estado | `GET /api/state` |
| Estado da operação | `GET /api/operation/state` |
| Iniciar operação | `POST /api/operation/start` |
| Pausar / retomar / parar / reset | `POST /api/operation/{pause,resume,stop,reset}` |
| Emergência | `POST /api/operation/emergency` |
| Tick de simulação | `POST /api/operation/tick` |
| Comandos granulares | `POST /api/command/*` |
| Checklist pré/pós | `POST /api/checklist/pre`, `POST /api/checklist/final` |
| Alarmes | `GET /api/alarms` |
| Manutenção preditiva | `GET /api/maintenance/prediction` |
| Histórico de operações | `GET /api/records/operations` |
| Detalhe de operação | `GET /api/records/operations/{id}` |
| Relatórios operacionais | `GET /api/reports/operational` |
| Catálogo de gráficos | `GET /api/charts/catalog` |
| Rampa em tempo real | `GET /api/charts/realtime-ramp` |
| Rampa por operação | `GET /api/charts/operation-ramp/{id}` |
| Estatísticas | `GET /api/charts/statistics` |
| Workspace de gráficos | `GET/POST/DELETE /api/charts/workspace` |
| Tanques | `GET /api/tanks` |
| Mangueiras | `GET /api/hoses` |
| Receitas | `GET/POST /api/recipes`, `POST /api/recipes/reset` |
| CRUD cadastros reais | `/api/real/*` |
| Parâmetros | `GET /api/parameters` |
| Schema de hardware | `GET /api/hardware/schema` |
| Saídas desejadas | `GET /api/hardware/desired-outputs` |
| Confirmação de comando | `POST /api/hardware/command-ack` |
| Modo de operação | `POST /api/hardware/mode` |
| Estado do hardware | `GET /api/hardware/state` |
| Ingestão de telemetria | `POST /api/hardware/ingest` |
| Reset de hardware | `POST /api/hardware/reset` |
| Configurações do gêmeo | `GET /api/digital-twin/config-options` |
| Simulação de gêmeo | `POST /api/digital-twin/simulate` |
| Broadcast WebSocket | `WS /ws/live` |

---

## 8. Características Técnicas

### 8.1 Gateway

* **Linguagem:** Python 3
* **Framework:** FastAPI + Uvicorn
* **Concorrência:** loop `asyncio` principal + lock para escrita no estado
* **Loop de simulação:** 1 Hz (`update_simulation`)
* **Persistência:** JSON files (sem banco de dados)
* **Validação:** Pydantic (`RecipePayload`, `StartCommand`, `ChecklistPayload`)
* **Limites de código:** tabela `CODE_LIMITS` em `real_bridge.py` impede valores fora de faixa
* **Watchdog:** 5 s para timeout de comunicação com hardware
* **CORS:** liberado para origens locais
* **Tratamento de erros:** exceções devolvidas em JSON estruturado

### 8.2 Gerente

* **Linguagem:** TypeScript 5.7.2
* **Framework:** React 19
* **Bundler:** Vite 6.0.7
* **Gráficos:** Chart.js 4.4.0
* **Tema:** CSS custom com alternância claro/escuro
* **Estado:** combina estado do servidor (REST polling 4 s) com `localStorage` para preferências
* **Login:** credenciais hardcoded + `localStorage` para sessão
* **5 visões:** Painel, Operação, Gêmeo Digital, Rastreabilidade, Parâmetros
* **Polling intervals:** 4 s (estado, operações, alarmes, manutenção, simulações, tanques, mangueiras, receitas)
* **Painel HW:** 1 s em `/api/hardware/state`

### 8.3 IHM

* **Linguagem:** TypeScript 5.6.3
* **Framework:** React 18.3.1
* **Bundler:** Vite 5.4.11
* **Ícones:** lucide-react + IndustrialIcons custom
* **Máquina de fases:** 10 estados
* **Polling:** 1 s em `/api/state`; 3 s em `/api/real/parameters`, `/api/real/recipes`
* **Persistência local:** `localStorage` `tsea_ihm_registros_dia`
* **Checklists:** 9 + 9 itens
* **Validação:** `OPERATIONAL_LIMITS` no front, `CODE_LIMITS` no back (defesa em profundidade)
* **Painel HW:** 1 s, read-only

### 8.4 Equipamentos documentados (na camada de software)

* **Bomba Primária B1** — Leybold SOGEVAC SV 630 B
* **Bomba Secundária / Roots B2** — Leybold RUVAC WSU 2001
* **Sistema de Óleo** — controlado pelo estado `oil_injection` (target_flow_l_min, current_flow_l_min, enabled)

*(Esses modelos aparecem nos cards de bomba do Gerente e nas abas da IHM — referências ao processo físico, mas parte do software.)*

### 8.5 Status da operação

| Status | Significado |
|---|---|
| `PRONTO` | Aguardando início |
| `EM_CICLO` | Executando |
| `PAUSADO` | Pausado pelo operador |
| `FINALIZADO` | Ciclo concluído com sucesso |
| `BLOQUEADO` | Interrompido por emergência/erro |

### 8.6 Etapas do ciclo

| Etapa | Significado |
|---|---|
| `PREPARO` | Setup inicial |
| `VACUO_INICIAL` | Vácuo primário |
| `VACUO_PROFUNDO` | Vácuo com B1 + B2 |
| `INJECAO_DE_OLEO` | Injeção de óleo |
| `ESTABILIZACAO` | Aguardando acomodação |
| `FINALIZACAO` | Conclusão |
| `BLOQUEADO` | Bloqueio de segurança |

---

## 9. Tempo de Desenvolvimento

> **Observação:** as informações de tempo foram estimadas a partir do histórico do projeto
> (`README.md`, `RELATORIO_CORRECAO_FINAL_TSEA.md`, `RELATORIO_GERAL_FINAL_TSEA.md`) e devem
> ser interpretadas como **referência, não como métrica precisa**.

| Fase | Janela estimada | Marcos |
|---|---|---|
| Especificação e contratos | jan–fev/2026 | `CONTRATO_PLC_TSEA.md` |
| Gateway MVP | fev–mar/2026 | `gateway_fisico/backend/app/main.py` |
| IHM operador | mar–abr/2026 | `ihm_operador/frontend/` |
| Sistema Gerente | abr–mai/2026 | `sistema_gerente/frontend/` |
| Ajustes de encoding e receitas | jun/2026 | `RELATORIO_CORRECAO_FINAL_TSEA.md` |
| Adaptação para bancada (excluída do relatório) | jun–jul/2026 | `CONTRATO_ST_PLC_XP325.md` |
| Gêmeo Digital + Word export | jul/2026 | `TseaDigitalTwin10`, `tseaHRBuildWord*` |
| Validação e relatórios finais | jul/2026 | `RELATORIO_GERAL_FINAL_TSEA.md` |

> A composição dos módulos (gateway + IHM + gerente + persistência) e a separação entre
> camada de software e camada física permitiram **adições incrementais** — por exemplo, o
> Gêmeo Digital e a exportação Word foram acrescentados sem alterar contratos já estabelecidos.

---

## 10. Persistência e Camada de Dados

### 10.1 Arquivos JSON (`gateway_fisico/backend/data/`)

| Arquivo | Conteúdo |
|---|---|
| `recipes.json` | Receitas (etapas, durações, alvos, mangueiras) |
| `tanks.json` | Cadastro de tanques |
| `hoses.json` | Cadastro de mangueiras |
| `operation_records.json` | Histórico imutável de operações |
| `chart_telemetry.json` | Buffer de telemetria para gráficos (amostra 3 s) |
| `chart_workspace.json` | Workspaces salvos de gráficos (Gerente) |
| `reports.json` | Histórico de relatórios exportados |

### 10.2 Edge cases garantidos pelo software

* Reconhecimento de **etapas com e sem acento** (ajuste de jun/2026).
* IHM não fica sem receita visual enquanto o Gateway carrega.
* Gerente padronizado para usar `/api` (não `/api/v1`).
* Normalização de tanque/mangueira/receita antes de persistir (`normalize_tank`, `normalize_hose`, `normalize_recipe`).
* Fórmula `hose_internal_volume_liters` calculada a partir de comprimento × seção.

---

## 11. Mapa de Conexões (Software)

```
┌────────────────────────────────────────────────────────────────────┐
│                          ESTAÇÕES DO USUÁRIO                       │
│                                                                    │
│  ┌────────────────────────────┐  ┌──────────────────────────────┐  │
│  │  IHM (React 18)            │  │  Gerente (React 19)          │  │
│  │  http://127.0.0.1:5178     │  │  http://127.0.0.1:5173       │  │
│  │                            │  │                              │  │
│  │  • POST /api/command/*     │  │  • GET /api/operation/state  │  │
│  │  • POST /api/checklist/*   │  │  • GET /api/state (4s)       │  │
│  │  • GET /api/state (1s)     │  │  • GET /api/alarms           │  │
│  │  • GET /api/real/... (3s)  │  │  • GET /api/maintenance/...  │  │
│  │  • GET /api/real/recipes   │  │  • GET /api/records/...      │  │
│  │  • WS /ws/live             │  │  • GET /api/charts/...       │  │
│  │  • HardwareBridgePanel (RO)│  │  • GET /api/tanks etc.       │  │
│  └────────────────┬───────────┘  └────────────────┬─────────────┘  │
└───────────────────┼─────────────────────────────┼─────────────────┘
                    │ REST + WebSocket            │
                    ▼                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                     GATEWAY FASTAPI :8020                           │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  main.py  (núcleo)                                          │  │
│  │  • GatewayState (estado em memória)                         │  │
│  │  • Loop asyncio 1 Hz (simulação)                            │  │
│  │  • Broadcast /ws/live                                       │  │
│  │  • Endpoints REST (start, pause, stop, emergency, etc.)     │  │
│  │  • install_main_hooks: patch dos métodos quando            │  │
│  │    modo = BANCADA_SEGURA / FISICO_HTTP / MODBUS_TCP         │  │
│  └────────────────────────────┬─────────────────────────────────┘  │
│                               │                                    │
│  ┌────────────────────────────┼─────────────────────────────────┐  │
│  │  real_bridge.py           │                                 │  │
│  │  • CRUD /api/real/* e /api/parameters                      │  │
│  │  • /api/hardware/* (schema, desired-outputs, ingest, ...)  │  │
│  │  • CODE_LIMITS, watchdog, normalização                     │  │
│  └────────────────────────────┼─────────────────────────────────┘  │
│                               │                                    │
│  ┌────────────────────────────┼─────────────────────────────────┐  │
│  │  charts_bridge.py          │                                 │  │
│  │  • /api/charts/catalog                                      │  │
│  │  • /api/charts/realtime-ramp                                │  │
│  │  • /api/charts/operation-ramp/{id}                          │  │
│  │  • /api/charts/statistics (10 métricas)                     │  │
│  │  • /api/charts/workspace (GET/POST/DELETE)                 │  │
│  └────────────────────────────┼─────────────────────────────────┘  │
│                               │                                    │
│  ┌────────────────────────────┼─────────────────────────────────┐  │
│  │  node_red_bridge.py        │  (apenas adapter HTTP — fora   │  │
│  │  • /api/node-red/status    │   do escopo "meus sistemas")    │  │
│  │  • /api/node-red/health    │                                 │  │
│  └────────────────────────────┼─────────────────────────────────┘  │
│                               │                                    │
│                               ▼                                    │
│         ┌──────────────────────────────────────┐                  │
│         │  gateway_fisico/backend/data/        │                  │
│         │  recipes.json · tanks.json ·         │                  │
│         │  hoses.json · operation_records.json│                  │
│         │  chart_telemetry.json ·              │                  │
│         │  chart_workspace.json · reports.json │                  │
│         └──────────────────────────────────────┘                  │
└────────────────────────────────────────────────────────────────────┘
```

### 11.1 Eventos de comando (ciclo)

```
IHM → POST /api/command/start  →  Gateway.start()
Gateway → atualiza GatewayState.cycle.status = EM_CICLO
Gateway → entra no loop de simulação (1 Hz)
Gateway → broadcast /ws/live com novo state
Gerente → reflete no Dashboard, Operação, Gêmeo

IHM → POST /api/command/emergency  →  Gateway.emergency_stop()
Gateway → cycle.status = BLOQUEADO
Gateway → broadcast /ws/live
Gerente → alerta na UI, alarme registrado
```

### 11.2 Eventos de leitura (dashboards)

```
Gerente (4 s) → GET /api/state            → cards, métricas, rampas
Gerente (4 s) → GET /api/operation/state  → tela Operação
Gerente (4 s) → GET /api/records/operations → lista Rastreabilidade
Gerente (4 s) → GET /api/charts/statistics → TraceabilityChartsPanel
Gerente (4 s) → GET /api/alarms             → tabela de alarmes
Gerente (4 s) → GET /api/maintenance/prediction → painel de saúde
IHM (1 s) → GET /api/state                → mapas, abas, rampas
IHM (3 s) → GET /api/real/parameters, recipes → prepara dados
```

---

## 12. Como Executar

### 12.1 Comando único (recomendado)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\abrir_tsea_completo.ps1
```

O script, de forma idempotente:

1. Detecta a pasta do projeto (`$Repo`).
2. Fecha processos antigos nas portas `8020, 5173, 5178, 1880` (Stop-Port).
3. Cria `.venv_gateway` se necessário e instala:
   `fastapi uvicorn pydantic python-multipart requests pymodbus google-api-python-client google-auth google-auth-oauthlib google-auth-httplib2 XlsxWriter`.
4. Sobe o **Gateway**: `uvicorn app.main:app --host 127.0.0.1 --port 8020 --reload`.
5. Sobe o **Gerente**: `npm install` (se necessário) + `npm run dev -- --host 127.0.0.1 --port 5173`.
6. Sobe a **IHM**: `npm install` (se necessário) + `npm run dev -- --host 127.0.0.1 --port 5178`.
7. (Opcional) Sobe o **Node-RED** se estiver instalado globalmente.
8. Abre automaticamente os dois navegadores (Gerente e IHM).

### 12.2 Scripts auxiliares

| Script | Função |
|---|---|
| `scripts/abrir_tsea_completo.ps1` | Sobe Gateway + Gerente + IHM |
| `scripts/iniciar_node_red.ps1` | **Excluído do escopo** — adapter externo |

### 12.3 URLs

| Serviço | URL |
|---|---|
| Gateway | http://127.0.0.1:8020 |
| Saúde do Gateway | http://127.0.0.1:8020/api/health |
| Estado atual | http://127.0.0.1:8020/api/state |
| Sistema Gerente | http://127.0.0.1:5173 |
| IHM Operador | http://127.0.0.1:5178 |
| WebSocket | ws://127.0.0.1:8020/ws/live |

---

## 13. Considerações Finais

### 13.1 Pontos fortes

* **Separação clara de responsabilidades** — IHM (operar), Gerente (gerir), Gateway (orquestrar). Cada um pode evoluir independentemente.
* **Estado único de verdade** no Gateway, consumido por REST + WebSocket — nenhuma das UIs mantém estado autoritativo.
* **Persistência simples e auditável** — JSON files podem ser inspecionados, versionados e versionados com git.
* **Camada de software resiliente** — opera 100% em modo simulado, sem depender de hardware externo.
* **Defesa em profundidade** — limites checados tanto no front (`OPERATIONAL_LIMITS`) quanto no back (`CODE_LIMITS`).
* **Gêmeo Digital** é um diferencial: permite testar mudanças de receita e parâmetros sem risco ao processo real.
* **Exportação Word** no Gerente transforma cada operação em documento auditável, próprio para o dia da apresentação.

### 13.2 Limitações assumidas

* Persistência em JSON files — adequado para um protótipo, mas **não escala** para múltiplas instâncias ou concorrência intensiva.
* Polling (1 s, 3 s, 4 s) em vez de streaming — funciona bem, mas o WebSocket já existe para evolução futura.
* `localStorage` guarda preferências e cache — **limpa entre dispositivos**.
* **Idioma:** todo o software está em PT-BR (legado de fábrica).

### 13.3 Trabalhos futuros

* Migrar persistência para SQLite/PostgreSQL.
* Transformar polling em WebSocket-first (UI passiva).
* Internacionalização (i18n).
* Autenticação contra SSO corporativo em vez de usuários hardcoded.
* Empacotamento em Docker / Compose (já há base para isso nos scripts PowerShell).

---

**Anexo — referências internas**

* `README.md` — visão geral, portas, arquitetura.
* `RELATORIO_GERAL_FINAL_TSEA.md` — relatório completo (inclui camada física).
* `RELATORIO_CORRECAO_FINAL_TSEA.md` — correções aplicadas (jun–jul/2026).
* `gateway_fisico/backend/app/main.py` — núcleo do Gateway.
* `gateway_fisico/backend/app/real_bridge.py` — cadastros + hardware.
* `gateway_fisico/backend/app/charts_bridge.py` — gráficos.
* `sistema_gerente/frontend/src/pages/*.tsx` — visões do Gerente.
* `ihm_operador/frontend/src/main.tsx` — máquina de fases da IHM.
* `scripts/abrir_tsea_completo.ps1` — script de inicialização.

> **Restrição respeitada:** este relatório cobre **apenas** o Gateway (Python), o Sistema Gerente (React 19) e a IHM do Operador (React 18). Os arquivos `node_red_bridge.py`, `plc_modbus_bridge.py`, `node_red/`, `CONTRATO_PLC_TSEA.md`, `CONTRATO_ST_PLC_XP325.md` e quaisquer referências à bancada IoT SENAI, CLP Altus XP325, Modbus TCP, motores e faróis estão **fora do escopo** e são citados apenas como pontos de integração quando estritamente necessário.
