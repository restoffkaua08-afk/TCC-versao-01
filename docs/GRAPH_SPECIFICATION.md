# Especificação completa dos gráficos — TSEA V‑Twin

Este documento descreve a especificação detalhada de cada gráfico do sistema TSEA V‑Twin. Inclui: onde aparece, objetivo, tipos/formato, dados necessários, tabela de exportação e um exemplo do JSON padrão que cada endpoint `/api/charts/statistics?metric=...` deve retornar.

## Formato padrão de saída (exigido por toda API)

Todo endpoint deve retornar o seguinte padrão JSON:

```
{
  "title": "Nome do gráfico",
  "metric": "identificador_do_grafico",
  "chart_type": "bar | line | pie | doughnut",
  "labels": ["Categoria 1", "Categoria 2"],
  "series": [
    {"name":"Nome da série","data":[10,20]}
  ],
  "table": [
    {"campo_1":"valor","campo_2":10}
  ],
  "legend": [
    {"label":"Nome","description":"O que representa"}
  ],
  "meta": {
    "source":"Fonte dos dados",
    "sample_count": 2,
    "real_data": true,
    "empty": false,
    "generated_at": "2026-06-08T00:00:00"
  }
}
```

> Observação: o campo `meta.generated_at` é obrigatório e deve usar timestamp ISO8601.

---

## Lista de gráficos (especificações resumidas)

> Abaixo estão as entradas para cada gráfico do sistema. Seção: Onde aparece, Tipo ideal, Objetivo, Dados usados, Formato da tabela, Tipos permitidos e um JSON exemplo.

### 2. Operações por período
- Onde aparece: Rastreabilidade > Indicadores e Gráficos
- Tipo ideal: Barra ou Linha
- Objetivo: contar operações por dia/semana/mês
- Dados usados: `operation_id`, `started_at`, `finished_at`, `date`, `status`, `operator`, `shift`
- Eixo X: Data (ex.: 2026-06-01)
- Eixo Y: Quantidade de operações
- Tabela (Dados_Grafico): `Data | Quantidade de operações`
- Tipos permitidos: Barra, Linha

JSON exemplo:

```
{
  "title":"Operações por período",
  "metric":"operations_by_day",
  "chart_type":"bar",
  "labels":["2026-06-01","2026-06-02"],
  "series":[{"name":"Quantidade","data":[5,8]}],
  "table":[{"data":"2026-06-01","operacoes":5}],
  "legend":[{"label":"Operações","description":"Quantidade por período"}],
  "meta":{"source":"operation_records","sample_count":2,"generated_at":"2026-06-08T00:00:00"}
}
```

---

### 3. Status das operações
- Onde aparece: Rastreabilidade > Indicadores e Gráficos
- Tipo ideal: Pizza/Rosca (ou Barras)
- Objetivo: mostrar distribuição por status (Finalizado, Em ciclo, Pausado, Atenção, Crítico, Bloqueado, Erro)
- Dados usados: `operation_id`, `status`, `result`, `alarm`, `started_at`, `finished_at`
- Tabela: `Status | Quantidade | Percentual`
- Tipos permitidos: Pizza, Rosca, Barra

JSON exemplo:

```
{
  "title":"Status das operações",
  "metric":"operation_status",
  "chart_type":"doughnut",
  "labels":["Finalizado","Em ciclo","Erro"],
  "series":[{"name":"Quantidade","data":[120,5,4]}],
  "table":[{"status":"Finalizado","quantidade":120,"percent":88.9}],
  "legend":[{"label":"Finalizado","description":"Operações concluídas"}],
  "meta":{"source":"operation_records + telemetria","sample_count":129,"generated_at":"2026-06-08T00:00:00"}
}
```

---

### 4. Tempo de ciclo por operação
- Onde aparece: Rastreabilidade / Relatório da operação
- Tipo ideal: Linha ou Barras
- Objetivo: mostrar tempo real de cada operação para comparação e análise de variação
- Dados usados: `operation_id`, `started_at`, `finished_at`, `elapsed_seconds`, `estimated_seconds`, `recipe_id`, `recipe_title`, `tank_count`
- Eixo X: Operação (ex.: OP-001)
- Eixo Y: Tempo (s ou min)
- Tabela: `Operação | Receita | Tanques | Tempo estimado | Tempo real | Diferença`
- Tipos permitidos: Barra, Linha

JSON exemplo:

```
{ "title":"Tempo de ciclo por operação", "metric":"cycle_time_by_operation", "chart_type":"bar", "labels":["OP-001","OP-002"], "series":[{"name":"Tempo real (s)","data":[360,420]}], "table":[{"operacao":"OP-001","recipe":"R-A","tank_count":2,"estimated_seconds":350,"elapsed_seconds":360,"difference":10}], "legend":[{"label":"Tempo real","description":"Duração real por operação"}], "meta":{"source":"chart_telemetry + operation_records","sample_count":2,"generated_at":"2026-06-08T00:00:00"} }
```

---

### 5. Comparação: tempo estimado vs tempo real
- Onde aparece: Indicadores e relatórios
- Tipo ideal: Barras agrupadas (grouped bar)
- Objetivo: comparar eficiência (estimado x real) por operação
- Dados usados: `operation_id`, `recipe.estimated_seconds`, `elapsed_seconds`, `difference_seconds`, `status`
- Séries: `Tempo estimado`, `Tempo real`
- Tabela: `Operação | Tempo estimado | Tempo real | Diferença | Resultado`

JSON exemplo:

```
{ "title":"Estimado vs Real", "metric":"estimated_vs_real", "chart_type":"bar", "labels":["OP-001"], "series":[{"name":"Estimado","data":[350]},{"name":"Real","data":[360]}], "table":[{"operation_id":"OP-001","estimated_seconds":350,"elapsed_seconds":360,"difference_seconds":10}], "legend":[{"label":"Estimado","description":"Tempo planejado"}], "meta":{"source":"operation_records","generated_at":"2026-06-08T00:00:00"} }
```

---

### 6. Alarmes por tipo
- Onde aparece: Rastreabilidade > Indicadores e Gráficos
- Tipo ideal: Barras ou Pizza
- Objetivo: identificar quais tipos de alarme ocorrem mais e gravidade
- Dados usados: `event_id`, `operation_id`, `timestamp`, `level`, `message`, `alarm_type`, `stage`
- Tabela: `Tipo de alarme | Quantidade | Última ocorrência | Severidade`
- Tipos permitidos: Barra, Pizza, Rosca

JSON exemplo:

```
{ "title":"Alarmes por tipo", "metric":"alarms_by_type", "chart_type":"bar", "labels":["Sensor offline","Pressão fora da faixa"], "series":[{"name":"Quantidade","data":[12,7]}], "table":[{"alarme":"Sensor offline","quantidade":12,"last":"2026-06-07T14:22","severity":"WARN"}], "legend":[{"label":"Sensor offline","description":"Falhas de sensores"}], "meta":{"source":"chart_telemetry + events","generated_at":"2026-06-08T00:00:00"} }
```

---

### 7. Logs por severidade
- Onde aparece: Auditoria / Rastreabilidade
- Tipo ideal: Barras (ou Pizza)
- Objetivo: mostrar volume de logs por nível (INFO, WARN, ERROR, CRITICAL)
- Dados usados: `timestamp`, `operation_id`, `level`, `message`, `source`
- Tabela: `Severidade | Quantidade | Percentual`

JSON exemplo:

```
{ "title":"Logs por severidade", "metric":"logs_by_severity", "chart_type":"bar", "labels":["INFO","WARN","ERROR","CRITICAL"], "series":[{"name":"Quantidade","data":[500,40,10,2]}], "table":[{"severidade":"ERROR","quantidade":10,"percent":1.8}], "legend":[{"label":"ERROR","description":"Erros registrados"}], "meta":{"source":"events","generated_at":"2026-06-08T00:00:00"} }
```

---

### 8. Uso de equipamentos
- Onde aparece: Indicadores > Equipamentos
- Tipo ideal: Barras
- Objetivo: mostrar tempo ligado/quantidade de acionamentos e estado de componentes (B1, B2, óleo, sensores)
- Dados usados: `operation_id`, `pump_b1`, `pump_b2`, `pump_oil`, `sensor_id`, `hose_id`, `recipe_id`, `tank_count`, `elapsed_seconds`
- Tabela: `Equipamento | Tempo ligado | Quantidade de acionamentos | Status`

JSON exemplo:

```
{ "title":"Uso de equipamentos", "metric":"equipment_usage", "chart_type":"bar", "labels":["Bomba B1","Bomba B2","Óleo"], "series":[{"name":"Tempo ligado (s)","data":[3600,2400,1800]}], "table":[{"item":"Bomba B1","valor":3600}], "legend":[{"label":"Tempo ligado","description":"Segundos ativos"}], "meta":{"source":"plc_runtime","generated_at":"2026-06-08T00:00:00"} }
```

---

### 9. Desempenho das máquinas
- Onde aparece: Gerente > Indicadores
- Tipo ideal: Barras ou Linha
- Objetivo: métricas agregadas (tempo ligado, amostras, falhas, alarmes)
- Dados usados: `operation_id`, `pump_b1_on`, `pump_b2_on`, `pump_oil_on`, `elapsed_seconds`, `sensor_online`, `plc_online`, `alarm`
- Tabela: `Máquina | Tempo ativo | Falhas | Alarmes | Status`

JSON exemplo:

```
{ "title":"Desempenho das máquinas", "metric":"machine_performance", "chart_type":"line", "labels":["2026-06-01","2026-06-02"], "series":[{"name":"Tempo B1 (h)","data":[5,6]},{"name":"Falhas PLC","data":[1,0]}], "table":[{"machine":"B1","time_active_hours":5,"failures":1}], "meta":{"source":"plc_runtime","generated_at":"2026-06-08T00:00:00"} }
```

---

### 10. Pressão final por operação
- Onde aparece: Histórico da operação
- Tipo ideal: Linha ou Barras
- Objetivo: mostrar pressão final atingida por operação
- Dados usados: `operation_id`, `target_pressure_mbar`, `final_pressure_mbar`, `pressure_avg_tank_mbar`, `status`
- Eixo X: Operação
- Eixo Y: Pressão final (mbar)
- Tabela: `Operação | Pressão alvo | Pressão final | Diferença | Status`

JSON exemplo:

```
{ "title":"Pressão final por operação", "metric":"final_pressure_by_operation", "chart_type":"bar", "labels":["OP-001"], "series":[{"name":"Pressão final (mbar)","data":[980]}], "table":[{"operation_id":"OP-001","target_pressure_mbar":1000,"final_pressure_mbar":980,"difference":20}], "meta":{"source":"sensors","generated_at":"2026-06-08T00:00:00"} }
```

---

[O documento continua com as demais especificações completas; o arquivo salvo em `GRAPH_SPECIFICATION.md` contém o texto completo.]
