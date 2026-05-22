# Prototipo_IHM

Protótipo de IHM local para operação do processo de vácuo e óleo da TSEA.

## Objetivo

Esta interface representa uma IHM de chão de fábrica para tablet industrial fixado na máquina.

A conexão real com PLC, sensores e sistema supervisório ainda não está implementada. A lógica atual é simulada, mas estruturada para futura integração.

## Princípios da IHM

- Fundo claro/platinum para leitura em ambiente industrial.
- Uso de cores apenas para estado operacional: verde, amarelo e vermelho.
- Operador não avança etapas manualmente.
- Sequência do ciclo simulada como automática pelo CLP.
- Ações críticas exigem confirmação.
- Foco em checklist, vácuo, óleo, bombas, alarmes e registro.

## Portas locais

- Frontend: http://127.0.0.1:5178
- API: http://127.0.0.1:8010/docs