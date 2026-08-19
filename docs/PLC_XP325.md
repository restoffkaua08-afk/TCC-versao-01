# Integração com CLP Altus XP325

Este documento resume a configuração utilizada na bancada IoT do SENAI para integrar o TSEA V-Twin ao CLP Altus XP325.

A lógica executada pelo CLP está versionada em [`../plc/TSEA_MAIN.st`](../plc/TSEA_MAIN.st). Este arquivo deve ser usado como referência principal do código em Structured Text.

## Comunicação

- Protocolo: Modbus TCP
- CLP: Altus XP325
- Porta padrão: `502`
- O endereço IP deve ser ajustado conforme a rede da bancada antes da execução.

## Mapa de saídas

| Saída | Tag | Função |
| --- | --- | --- |
| `Q0.0` | `DO_Bomba1` | Motor 1 / Bomba B1 |
| `Q0.1` | `DO_Bomba2` | Motor 2 / Bomba B2 |
| `Q0.2` | `DO_Oleo` | Motor 3 / sistema de óleo |
| `Q0.3` | `DO_FarolVerde` | sinalização verde |
| `Q0.4` | `DO_FarolAmar` | sinalização amarela |
| `Q0.5` | `DO_FarolVerm` | sinalização vermelha |

## Mapa de entradas

| Entrada | Tag | Função |
| --- | --- | --- |
| `I0.0` | `DI_Emergencia` | emergência |
| `I0.1` | `DI_FB_Motor1` | feedback Motor 1 |
| `I0.2` | `DI_FB_Motor2` | feedback Motor 2 |
| `I0.3` | `DI_FB_Motor3` | feedback Motor 3 |
| `I0.4` | `DI_Start` | start físico |
| `I0.5` | `DI_Stop` | stop físico |

## Status Modbus

| Tipo | Endereço | Tag |
| --- | --- | --- |
| Coil | `16` | `ST_CicloAtivo` |
| Coil | `17` | `ST_Finalizado` |
| Coil | `18` | `ST_EmergenciaAtiva` |
| Holding Register | `0` | `ST_EtapaAtual` |
| Holding Register | `1` | `ST_CodigoAlarme` |

## Sequência de controle

A máquina de estados implementada no CLP utiliza as etapas abaixo:

| Etapa | Comportamento |
| --- | --- |
| `0` | estado pronto |
| `10` | Motor 1 ligado |
| `20` | Motores 1 e 2 ligados |
| `30` | Motores 1 e 2 e sistema de óleo ligados |
| `40` | ciclo finalizado |
| `-1` | emergência |

A temporização das etapas é realizada pela lógica do CLP.

## Emergência

A condição de emergência possui prioridade sobre o restante do ciclo. Quando detectada:

- as saídas de processo são desligadas;
- a sinalização vermelha é acionada;
- `ST_EmergenciaAtiva` é publicado;
- a etapa passa para `-1`;
- o código de alarme é atualizado.

## Fluxo da integração

```text
IHM
  -> Gateway FastAPI
  -> Node-RED
  -> Modbus TCP
  -> CLP Altus XP325
  -> motores e sinalizadores
```

## Importação da lógica no MasterTool

1. Criar ou abrir o projeto correspondente ao CLP XP325.
2. Adicionar um programa em Structured Text chamado `TSEA_MAIN`.
3. Utilizar como base o conteúdo de [`plc/TSEA_MAIN.st`](../plc/TSEA_MAIN.st).
4. Conferir o mapeamento de entradas, saídas e variáveis Modbus de acordo com a bancada utilizada.
5. Compilar o projeto antes do download para o CLP.
6. Realizar os primeiros testes com os atuadores supervisionados e, quando possível, validar a lógica em monitoramento antes de energizar o processo completo.

## Teste lógico recomendado

Antes da ligação dos atuadores reais, acompanhe as variáveis de estado no ambiente de programação do CLP:

- `etapa`;
- `ciclo_iniciado`;
- `DO_Bomba1`;
- `DO_Bomba2`;
- `DO_Oleo`;
- `DO_FarolVerde`;
- `DO_FarolAmar`;
- `DO_FarolVerm`;
- `ST_CicloAtivo`;
- `ST_Finalizado`;
- `ST_EmergenciaAtiva`.

O comportamento esperado é a progressão `0 -> 10 -> 20 -> 30 -> 40`. Ao acionar a emergência, o estado deve ir para `-1` e as saídas do processo devem ser desligadas.

## Observação

A bancada IoT representa fisicamente os atuadores de um cenário industrial. Antes de usar outro equipamento ou outra rede, revise o mapa Modbus, os endereços físicos e as condições de segurança do ambiente.
