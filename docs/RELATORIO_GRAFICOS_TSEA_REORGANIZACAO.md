RELATORIO_GRAFICOS_TSEA_REORGANIZACAO.md

1. Problemas identificados
- Muitos indicadores sem narrativa operacional; falta de agrupamento lógico.
- Catálogo não expunha "pergunta" e "grupo" para cada métrica.
- Interface listava métricas de forma plana; difícil escolher o gráfico correto.
- Exportador do Google gerava planilha genérica em alguns fallbacks.
- Erros do Google (403) eram apresentados como "Gateway/API não respondeu" no frontend.
- Alguns endpoints não usavam telemetria histórica quando não havia operação ativa (ex.: rampa de vácuo).

2. Gráficos mantidos / organizados
Grupo 1 — Operação em tempo real
- `vacuum_ramp` — Rampa de vácuo (line). Pergunta: "A pressão está caindo conforme esperado?"
- `pressure_target_vs_measured` — Pressão alvo vs medida (line). Pergunta: "A operação está chegando perto da pressão prevista?"
- `oil_flow_over_time` (planejado) — Óleo/vazão (line). Pergunta: "A injeção de óleo está estável?"

Grupo 2 — Histórico e produtividade
- `operations_by_day` (bar)
- `cycle_time` / `cycle_time_by_operation` (bar)
- `estimated_vs_real` (planejado)

Grupo 3 — Segurança e falhas
- `operation_status` (doughnut)
- `alarms_by_type` (bar)
- `risk_by_operation` (planejado)

Grupo 4 — Equipamentos
- `equipment_usage` (bar)
- `machine_performance` (bar)

3. Arquivos alterados
- `gateway_fisico/backend/app/charts_bridge.py`
  - Adicionei `METRIC_INFO` com `label`, `question`, `group`, `chart_type`.
  - Catalog (`/api/charts/catalog`) agora expõe `question`, `group` e `recommended_chart`.
  - `api_statistics` agora preenche `question`, `meta.group` e `meta.generated_at` no retorno.
  - `vacuum_ramp` ajustado: se não houver operação em curso, tenta operação com mais amostras; se ainda vazio, concatena pontos históricos ordenados por timestamp (limite 1000 pontos).

- `gateway_fisico/backend/app/google_sheets_bridge.py`
  - Mantido; já cria as três abas obrigatórias: `Dados_Grafico`, `Dados_Completos`, `Grafico`.
  - Fallback CSV/HTML/XLSX implementado (XlsxWriter quando disponível).

- `sistema_gerente/frontend/src/pages/TraceabilityChartsPanel.tsx`
  - Agora carrega `/api/charts/catalog` dinamicamente e apresenta métricas agrupadas por `group`.
  - Mensagem de erro aprimorada para tratar 403 do Google e orientar reautorização.

4. Resultado dos builds
- Backend: `py_compile` executado nos módulos `main.py`, `charts_bridge.py`, `google_sheets_bridge.py`, `real_bridge.py` — sem erros.
- Frontend Gerente: `npm run build` — sucesso (dist gerado).
- Frontend IHM: `npm run build` — sucesso (dist gerado).

5. Testes de endpoint (amostras)
- `GET /api/charts/catalog` — retorna catálogo com `question` e `group` para cada métrica (OK).
- `GET /api/charts/statistics?metric=pressure_target_vs_measured` — retornou série com dados históricos (OK).
- `GET /api/charts/operation-ramp/OP-20260608-094401` — retornou pontos de telemetria (OK).
- `GET /api/charts/statistics?metric=vacuum_ramp` — agora tenta: 1) estado atual; 2) operação com mais amostras; 3) concatenação de telemetria histórica — retornou pontos históricos com sucesso.

6. Como usar a nova tela
1. Abra o Gerente (http://127.0.0.1:5173).
2. Em Indicadores e Gráficos escolha o grupo/métrica (o selector agrupa por `group` retornado pelo backend).
3. Clique em "Visualizar gráfico" para abrir o preview local (fundo branco, logo TSEA, gráfico central).
4. Clique em "Gerar no Google Planilhas" para criar a planilha; se o Google negar, um fallback CSV/HTML/XLSX será oferecido localmente automaticamente.
5. Use "Reautorizar Google" se receber indicação de erro 403.

7. Pendências / próximos passos recomendados
- Implementar e mapear as métricas faltantes mencionadas no seu roteiro (`oil_flow_over_time`, `estimated_vs_real`, `risk_by_operation`, etc.).
- Polir UI para exibir cards por grupo (atualmente o selector agrupa; próximo passo: cards com pergunta, botão Visualizar/Gerar).
- Implementar legenda interativa e hover com explicação no `ChartPreview`.
- Adicionar testes automatizados para endpoints `/api/charts/statistics` e para geração de arquivos de fallback.
- Garantir a planilha gerada no Google contenha o gráfico nativo (já tentado; o código adiciona um chart via API quando possível).

8. Arquivos adicionados/modificados (resumo)
- Modificado: `gateway_fisico/backend/app/charts_bridge.py`
- Modificado: `gateway_fisico/backend/app/google_sheets_bridge.py` (manutenção/fallbacks)
- Modificado: `sistema_gerente/frontend/src/pages/TraceabilityChartsPanel.tsx`
- Adicionado: `RELATORIO_GRAFICOS_TSEA_REORGANIZACAO.md` (este relatório)

9. Próximo passo que executo agora (opcional)
- Posso continuar e transformar a lista de métricas em cards visuais, com descrição/filtragem e botões em cada card. Quer que eu siga e implemente os cards e a área de visualização grande do painel agora?

---
Relatório gerado automaticamente por assistência de desenvolvimento local. Para testes manuais rápidos, execute os comandos listados no seu prompt (py_compile/build/invocações API).