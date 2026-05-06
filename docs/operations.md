# Operação TSEA

## Inicialização

1. Suba a API em `http://localhost:8000`.
2. Suba o frontend em `http://localhost:5173`.
3. Abra a tela `Operação`.
4. Use `Iniciar ciclo` para criar um novo ciclo ou aguarde o tick automático iniciar a simulação.

## Tela de Operação

A operação acompanha:

- Até 3 tanques simultâneos.
- Pressão atual e esperada por tanque.
- Vazão e volume de óleo.
- Status da bomba primária Leybold SOGEVAC SV630B.
- Status da bomba Roots Leybold RUVAC WSU2001.
- Risco de colapso estrutural.
- Gráfico de pressão x tempo.
- Alarmes críticos recentes.

Comandos disponíveis:

- `Iniciar ciclo`: cria ciclo e liga a bomba primária.
- `Pausar`: congela a evolução da simulação.
- `Parar`: encerra o ciclo pelo operador.
- `Emergência`: registra alarme crítico e encerra.
- `Reset`: limpa o estado ativo da engine.

## Rastreabilidade

Cada ciclo recebe `cycle_code`, operador, timestamps, status, pressão inicial/final e duração. Eventos operacionais são gravados em `TraceEvent`.

## Gêmeo Digital

Compara a pressão real simulada contra a curva esperada da receita e indica desvio, saúde, estabilidade, gargalo e recomendações.

## What-if

A tela executa cenário com multiplicadores de perda de mangueira e vazamento para estimar duração, pressão final, risco estrutural, partida da Roots e alarmes prováveis.

## Assistente

O assistente local responde por palavras-chave sobre pressão, vácuo, óleo, vazão, mangueiras, alarmes e manutenção.

## O que ainda é simulado

- Leituras de pressão.
- Estado das bombas SV630B e WSU2001.
- Perda de carga por mangueira.
- Vazamento por tanque.
- Injeção de óleo.
- Falha de sensor.
- Perda de comunicação com CLP.
- Risco de colapso.
- Manutenção preditiva.
