# Protótipo TSEA V-Twin (Bancada IoT SENAI)

Sistema de demonstração do projeto TSEA V-Twin para controle, monitoramento,
rastreabilidade e geração de gráficos do processo de vácuo em tanques/reguladores.

A validação física foi realizada utilizando a **bancada IoT do SENAI** equipada
com CLP Altus XP325 e três motores elétricos representando os atuadores
industriais (Bomba B1, Bomba B2 e Sistema de Óleo). A arquitetura lógica
permanece idêntica à proposta industrial, alterando apenas o meio físico
utilizado para demonstração.

## Arquitetura

```
IHM (React)              -> http://127.0.0.1:5178
Sistema Gerente (React)  -> http://127.0.0.1:5173
Gateway FastAPI          -> http://127.0.0.1:8020
Node-RED (Modbus TCP)    -> http://127.0.0.1:1880
CLP Altus XP325          -> 172.24.10.10:502 (Modbus TCP)
```

Fluxo de comando:

```
IHM → POST /api/operation/start → Gateway
Gateway → POST /tsea/api/cycle → Node-RED
Node-RED → write_coil/write_register Modbus → CLP XP325
CLP XP325 → energiza Q0.0/Q0.1/Q0.2/Q0.3/Q0.4/Q0.5 → Motores + Faróis
```

## Estrutura principal

```txt
prototipo-tsea/
├── gateway_fisico/
│   └── backend/
│       ├── app/
│       │   ├── main.py                       (núcleo do Gateway)
│       │   ├── plc_modbus_bridge.py          (Modbus TCP direto)
│       │   ├── node_red_bridge.py            (cliente Node-RED)  ← NOVO
│       │   ├── real_bridge.py                (cadastros reais)
│       │   ├── charts_bridge.py              (gráficos)
│       │   └── google_sheets_bridge.py       (Sheets/CSV)
│       ├── config/plc_map.json               (mapa Modbus)        ← ATUALIZADO
│       └── data/                             (persistência)
├── ihm_operador/
│   └── frontend/
│       ├── src/
│       ├── package.json
│       └── vite.config.ts
├── sistema_gerente/
│   └── frontend/
│       ├── src/
│       ├── package.json
│       └── vite.config.ts
├── node_red/                                                       ← NOVO
│   ├── README.md
│   └── flows.json                                                  ← NOVO
├── scripts/
├── docs/
├── README.md
└── CONTRATO_PLC_TSEA.md
```

## Portas

* Gateway/API: <http://127.0.0.1:8020>
* IHM do operador: <http://127.0.0.1:5178>
* Sistema gerente: <http://127.0.0.1:5173>
* Node-RED: <http://127.0.0.1:1880>

## Como abrir

```powershell
# Sobe Gateway + Gerente + IHM
powershell -ExecutionPolicy Bypass -File .\scripts\abrir_tsea_completo.ps1

# Em outro terminal, sobe o Node-RED
powershell -ExecutionPolicy Bypass -File .\scripts\iniciar_node_red.ps1
```

## Endpoints novos (Bancada IoT SENAI)

| Método | URL                            | Função                                                  |
| ------ | ------------------------------ | ------------------------------------------------------- |
| POST   | `/api/operation/start`          | Inicia operação + chama Node-RED                        |
| POST   | `/api/operation/emergency`      | Aciona emergência + chama Node-RED                      |
| GET    | `/api/node-red/status`          | Status atual do Node-RED                                |
| GET    | `/api/node-red/health`          | Ping no Node-RED                                        |
| GET    | `/api/plc/map`                  | Mapa Modbus (6 coils + 3 status + 2 registradores)     |

## Componentes

### Gateway/API

Backend FastAPI responsável por estado da operação, receitas, mangueiras,
comandos, rastreabilidade, gráficos e integração com Google Planilhas. Também
encaminha comandos para o Node-RED (Bancada IoT SENAI).

### Node-RED

Ponte HTTP ↔ Modbus TCP com o CLP XP325. Define a sequência de acionamento
dos motores/faróis conforme a etapa da operação. Flow em `node_red/flows.json`.

### IHM do Operador

Interface para o operador preparar e iniciar a operação. Visualiza o estado em
tempo real vindo do Gateway, que reflete o estado real da bancada.

### Sistema Gerente

Interface gerencial para acompanhar operação, cadastros, indicadores, gráficos
e relatórios.

## Segurança

Arquivos `.local.json`, tokens OAuth e segredos Google não devem ser commitados.