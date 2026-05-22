# Prototipo_IHM

Protótipo de IHM local industrial para operação do processo de vácuo e óleo da TSEA.

## Objetivo

Esta interface representa uma IHM de chão de fábrica para tablet industrial fixado na máquina. A conexão real com PLC, sensores e sistema supervisório ainda não está implementada; por enquanto, a lógica é simulada e preparada para integração futura.

## Estrutura

- backend: API Python/FastAPI simulada.
- frontend: interface React/TypeScript da IHM.

## Telas

- Início operacional
- Preparação do ciclo
- Operação em andamento
- Alarmes
- Registro do ciclo

## Portas locais

- Frontend: http://127.0.0.1:5178
- API: http://127.0.0.1:8010/docs