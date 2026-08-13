# Relatório de Correção Final - TSEA

## Mudanças aplicadas (junho/2026)

- Dados mínimos criados: RC-01, MG-01 e TQ-01.
- Textos corrompidos por encoding corrigidos em IHM e Gerente.
- IHM ajustada para reconhecer etapas do backend com e sem acento.
- IHM ajustada para não ficar sem receita visual enquanto o Gateway carrega.
- Gerente padronizado para usar /api.
- Painel de gráficos verificado para métricas extras.
- Builds executados na IHM e no Gerente.

## Mudanças aplicadas (julho/2026 — Bancada IoT SENAI)

Adaptação do projeto para validação física na bancada IoT do SENAI:

- **Bancada física**: CLP Altus XP325 + 3 motores elétricos
  (Motor 1 = Bomba B1, Motor 2 = Bomba B2, Motor 3 = Sistema de Óleo).
- **Comunicação**: Gateway → Node-RED → Modbus TCP → CLP.
- **Node-RED** (`node_red/flows.json`): flow com 3 endpoints
  (`POST /tsea/api/cycle`, `POST /tsea/api/emergency`, `GET /tsea/api/status`)
  que controlam os 3 motores e 3 faróis via Modbus.
- **Ponte Node-RED** (`gateway_fisico/backend/app/node_red_bridge.py`):
  cliente HTTP que o Gateway usa para enviar comandos à bancada.
  Inclui `/api/node-red/status` e `/api/node-red/health`.
- **Mapa Modbus** (`gateway_fisico/backend/config/plc_map.json`): atualizado
  com 6 coils (3 motores + 3 faróis), 3 status_coils e 2 holding registers.
- **Adaptador no main.py**: quando a IHM chama `/api/operation/start` ou
  `/api/operation/emergency`, o Gateway também chama o Node-RED. Se o Node-RED
  estiver offline, o Gateway continua funcionando no modo simulado.

> "A validação física foi realizada utilizando a bancada IoT do SENAI equipada
> com CLP Altus XP325 e três motores elétricos representando os atuadores
> industriais (Bomba B1, Bomba B2 e Sistema de Óleo). A arquitetura lógica
> permanece idêntica à proposta industrial, alterando apenas o meio físico
> utilizado para demonstração."

## Teste manual recomendado

1. Abrir Gateway, IHM e Gerente:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\abrir_tsea_completo.ps1
   ```
2. Abrir Node-RED (em outro terminal):
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\iniciar_node_red.ps1
   ```
3. Importar o flow em `node_red/flows.json` no Node-RED.
4. Verificar IHM (http://127.0.0.1:5178) mostra receita RC-01 e mangueira MG-01.
5. Verificar Gerente (http://127.0.0.1:5173) carrega dashboard.
6. Conferir /api/health retorna 200.
7. Marcar checklist.
8. Iniciar operação.
9. Verificar atualização no Gerente.
10. Abrir Rastreabilidade > Gráficos.

## Relatório geral final

Para o relatório completo com mapa de ligações físicas (motores em
Q0.0–Q0.2, faróis em Q0.3–Q0.5, emergência em I0.0), programa ST do
XP325, status dos smoke tests ponta-a-ponta e instruções dia da
apresentação, ver **`RELATORIO_GERAL_FINAL_TSEA.md`** (gerado em
2026-07-27).