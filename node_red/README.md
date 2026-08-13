# Node-RED – TSEA V-Twin / Bancada IoT SENAI

Ponte entre o Gateway FastAPI e o CLP Altus XP325 da bancada IoT do SENAI.

## O que faz

O Node-RED recebe comandos HTTP do Gateway e escreve nas saídas digitais do
XP325 via Modbus TCP. Cada motor / farol está ligado a uma saída física
diferente do CLP (vide `plc_map.json`).

## Endpoints expostos

| Método | URL                  | Ação                                                   |
| ------ | -------------------- | ------------------------------------------------------ |
| POST   | `/tsea/api/cycle`    | Inicia o ciclo 0 → 10 → 20 → 30 → 40 (ligando motores) |
| POST   | `/tsea/api/emergency`| Desliga todos os motores, liga farol vermelho           |
| GET    | `/tsea/api/status`   | Retorna o estado atual do CLP (coils + registradores)  |

## Sequência implementada no `cycle`

| Etapa | Tempo | Ação                                  |
| ----- | ----- | ------------------------------------- |
| 0     | —     | Farol verde ON (estado PRONTO)        |
| 10    | 5 s   | Motor 1 ON, farol amarelo ON          |
| 20    | 5 s   | Motor 2 ON                            |
| 30    | 5 s   | Motor 3 ON (sistema de óleo)          |
| 40    | —     | Farol verde ON, farol amarelo OFF (FINALIZADO) |

`ST_CicloAtivo` é setado em 10 e zerado em 40.
`ST_Finalizado` é setado em 40 e zerado em 0 (novo ciclo).
`ST_EtapaAtual` (registrador) reflete a etapa corrente.

## Emergency

Todos os motores OFF, farol vermelho ON, ST_EmergenciaAtiva = TRUE,
ST_EtapaAtual = -1, ST_CodigoAlarme = 1.

## Como instalar

1. Abra o Node-RED em <http://127.0.0.1:1880>.
2. Menu (≡) → Import → Clipboard.
3. Cole o conteúdo de `flows.json`.
4. Clique em Deploy.
5. Importe o flow novamente a cada reinicialização, OU habilite o projeto
   para gravar em `flows.json` automaticamente.

## Configuração Modbus

O flow usa `modbus-flex-getter` e `modbus-flex-writer` apontando para
`172.24.10.10:502` (XP325). Esse IP deve ser editado no nó
`modbus-config` caso a bancada utilize outro endereço.

Se `pymodbus` no Gateway estiver instalado, o Node-RED **não** precisa
do `node-red-contrib-modbus` instalado (o Gateway pode escrever direto).
Mas como a especificação do TCC pede Gateway → Node-RED → CLP, o Node-RED
faz a tradução final.

## Estrutura do flow

- **`/tsea/api/cycle`** → function seq → modbus-write (multi-coil)
- **`/tsea/api/emergency`** → modbus-write (todos os motores OFF + red ON)
- **`/tsea/api/status`** → modbus-read (coils + holding registers) → payload JSON
- **shared-state**: objeto global com `ST_*`, alimentado por ambos os paths

## Convenções de coil

| Nome              | Endereço | Tag CLP            |
| ----------------- | -------- | ------------------ |
| pump_b1           | 0        | DO_Bomba1          |
| pump_b2           | 1        | DO_Bomba2          |
| oil_valve         | 2        | DO_Oleo            |
| alarm_green       | 3        | DO_FarolVerde      |
| alarm_yellow      | 4        | DO_FarolAmarelo    |
| alarm_red         | 5        | DO_FarolVermelho   |
| ciclo_ativo       | 16       | ST_CicloAtivo      |
| finalizado        | 17       | ST_Finalizado      |
| emergencia_ativa  | 18       | ST_EmergenciaAtiva |

Registradores:

| Nome            | Endereço | Tag CLP          |
| --------------- | -------- | ---------------- |
| etapa_atual     | 0        | ST_EtapaAtual    |
| codigo_alarme   | 1        | ST_CodigoAlarme  |
