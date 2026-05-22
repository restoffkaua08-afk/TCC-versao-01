# Arquitetura TSEA

## Domínio

O backend foi reorientado para o processo real de vácuo em tanques de reguladores da TSEA. Os models principais são:

- `User` e `Operator`
- `Tank`, `Hose`, `Recipe`
- `VacuumCycle`, `PressureReading`
- `AlarmEvent`, `TraceEvent`
- `MaintenanceInsight`, `SimulationResult`

Cada `PressureReading` pertence a um ciclo e a um tanque, contendo pressão real simulada, pressão esperada, volume/vazão de óleo, perda de carga da mangueira e risco de colapso.

## Engine de Simulação

`backend/app/services/simulation.py` contém:

- `PrimaryPumpSV630B`
- `RootsPumpWSU2001`
- `TankModel`
- `HoseModel`
- `OilInjectionSystem`
- `PressureSensor`
- `DigitalTwinEngine`
- `VacuumProcessEngine`

O ciclo simulado executa início do ciclo, partida da primária, queda de pressão por tanque, partida segura da Roots, influência das mangueiras, vazamento, injeção de óleo, cálculo de risco estrutural, alarmes e encerramento automático.

## Frontend

A navegação principal foi organizada em:

- Operação
- Histórico e Rastreabilidade
- Inteligência do Processo
- Relatórios
- Configurações

Dentro de Inteligência do Processo ficam Gêmeo Digital, What-if, Manutenção e Assistente.

## Persistência

SQLite é usado por padrão em `backend/tsea.db`. O seed inicial cria 3 tanques, 3 mangueiras, 1 receita, 1 operador e 1 usuário.

## Limites do Protótipo

Não há comunicação real com CLP, sensores, inversores ou bombas Leybold. A lógica é determinística-estocástica para demonstração industrial e deve ser calibrada com curvas reais antes de uso operacional.
