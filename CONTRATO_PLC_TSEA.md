# Contrato PLC / ESP32 - TSEA V-Twin (Bancada IoT SENAI)

Este documento define como a bancada IoT do SENAI conversa com o Gateway Python
via Node-RED. A bancada é equipada com CLP Altus XP325 e três motores elétricos
que representam os atuadores industriais (Bomba B1, Bomba B2 e Sistema de Óleo).

## Visão geral da bancada

| Saída física        | Tag CLP         | Atuador                          |
| ------------------- | --------------- | -------------------------------- |
| Q0.0                | DO_Bomba1       | Motor 1 (representa Bomba B1)    |
| Q0.1                | DO_Bomba2       | Motor 2 (representa Bomba B2)    |
| Q0.2                | DO_Oleo         | Motor 3 (representa Sistema de Óleo) |
| Q0.3                | DO_FarolVerde   | Farol verde                      |
| Q0.4                | DO_FarolAmarelo | Farol amarelo                    |
| Q0.5                | DO_FarolVermelho| Farol vermelho                   |

> Caso a bancada utilize outro endereçamento físico, adapte o `plc_map.json` e o
> flow do Node-RED (`node_red/flows.json`). Os tags acima são a referência do
> Structured Text fornecido.

## Fluxo de operação

```
IHM (porta 5178)
        │  POST /api/operation/start
        ▼
Gateway FastAPI (porta 8020)
        │  POST /tsea/api/cycle
        ▼
Node-RED (porta 1880)
        │  write_coil/write_register via Modbus TCP
        ▼
CLP Altus XP325 (172.24.10.10:502)
        │  Saídas digitais (Q0.0 - Q0.5)
        ▼
Motores + Faróis (bancada IoT SENAI)
```

## Sequência implementada

A bancada foi programada em Structured Text (XP325) com a seguinte máquina de
estados. O Gateway apenas dispara `cycle`/`emergency` — toda a temporização é
feita pelo CLP.

### Estado PRONTO (0)

- Todos os motores OFF
- Farol verde ON
- Farol amarelo OFF
- Farol vermelho OFF

### Iniciar (`POST /tsea/api/cycle`)

| Etapa | Duração | Ação                                          |
| ----- | ------- | --------------------------------------------- |
| 0     | —       | Estado PRONTO                                 |
| 10    | 5 s     | Motor 1 ON, farol amarelo ON                  |
| 20    | 5 s     | Motor 2 ON                                    |
| 30    | 5 s     | Motor 3 ON (sistema de óleo)                  |
| 40    | —       | Motor 3 OFF, farol verde ON, amarelo OFF      |

`ST_CicloAtivo` é setado em 10 e zerado em 40.
`ST_Finalizado` é setado em 40 (zerado em 0).
`ST_EtapaAtual` (holding register 0) reflete a etapa corrente.

### Emergência (`POST /tsea/api/emergency`)

- Todos os motores OFF
- Farol vermelho ON
- `ST_EmergenciaAtiva = TRUE`
- `ST_EtapaAtual = -1`
- `ST_CodigoAlarme = 1`

## Endpoints Gateway expostos

| Método | URL                            | Função                                                  |
| ------ | ------------------------------ | ------------------------------------------------------- |
| POST   | `/api/operation/start`          | Inicia operação (também chama Node-RED `/cycle`)        |
| POST   | `/api/operation/emergency`      | Aciona emergência (também chama Node-RED `/emergency`)  |
| GET    | `/api/node-red/status`          | Status atual do Node-RED                                |
| GET    | `/api/node-red/health`          | Ping no Node-RED                                        |

> Os endpoints `/api/operation/*` permanecem idênticos à especificação anterior.
> A camada Node-RED é uma adição transparente — se o Node-RED estiver offline,
> o Gateway continua respondendo e cai no modo simulado.

## Endpoints Node-RED expostos

| Método | URL                  | Função                                                |
| ------ | -------------------- | ----------------------------------------------------- |
| POST   | `/tsea/api/cycle`    | Inicia ciclo no CLP (escreve sequência de coils)      |
| POST   | `/tsea/api/emergency`| Aciona emergência (tudo OFF + farol vermelho)         |
| GET    | `/tsea/api/status`   | Lê estado atual do CLP (coils + holding registers)    |

## Modbus TCP — mapa de coils/registradores

| Nome              | Tipo               | Endereço | Tag CLP            |
| ----------------- | ------------------ | -------- | ------------------ |
| pump_b1           | Coil               | 0        | DO_Bomba1          |
| pump_b2           | Coil               | 1        | DO_Bomba2          |
| oil_valve         | Coil               | 2        | DO_Oleo            |
| alarm_green       | Coil               | 3        | DO_FarolVerde      |
| alarm_yellow      | Coil               | 4        | DO_FarolAmarelo    |
| alarm_red         | Coil               | 5        | DO_FarolVermelho   |
| ciclo_ativo       | Coil               | 16       | ST_CicloAtivo      |
| finalizado        | Coil               | 17       | ST_Finalizado      |
| emergencia_ativa  | Coil               | 18       | ST_EmergenciaAtiva |
| etapa_atual       | Holding Register   | 0        | ST_EtapaAtual      |
| codigo_alarme     | Holding Register   | 1        | ST_CodigoAlarme    |

## Como abrir o sistema

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\abrir_tsea_completo.ps1
```

O script acima sobe Gateway, Gerente e IHM. Para incluir o Node-RED, abra outro
terminal PowerShell e rode:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\iniciar_node_red.ps1
```

## Observação sobre a arquitetura

> "A validação física foi realizada utilizando a bancada IoT do SENAI equipada
> com CLP Altus XP325 e três motores elétricos representando os atuadores
> industriais (Bomba B1, Bomba B2 e Sistema de Óleo). A arquitetura lógica
> permanece idêntica à proposta industrial, alterando apenas o meio físico
> utilizado para demonstração."