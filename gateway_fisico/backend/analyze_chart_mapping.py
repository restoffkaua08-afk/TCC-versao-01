import importlib, json
charts = importlib.import_module('app.charts_bridge')
google = importlib.import_module('app.google_sheets_bridge')

# request a sample chart
metrics = [
    ("operations_by_day", "bar", "month"),
    ("operation_status", "pie", "month"),
    ("vacuum_ramp", "line", "all"),
    ("cycle_time", "line", "month"),
]

for metric, ctype, period in metrics:
    print('\n======================================')
    print(f"Metric: {metric} type={ctype} period={period}")
    chart = charts.api_statistics(metric=metric, chart_type=ctype, period=period, date_start=None, date_end=None)
    print(json.dumps({k: chart.get(k) for k in ['title','chart_type','labels','series','table','meta']}, indent=2, ensure_ascii=False))

    chart_rows = google._chart_rows(chart)
    full_rows = google._full_rows(chart)
    chart_values = [["Categoria","Valor"]] + [[google._sheet_cell(r['categoria']), google._sheet_cell(r['valor'])] for r in chart_rows]

    print('\n--- chart_rows (first 10) ---')
    print(json.dumps(chart_rows[:10], indent=2, ensure_ascii=False))
    print('\n--- full_rows (first 10) ---')
    print(json.dumps(full_rows[:10], indent=2, ensure_ascii=False))
    print('\n--- chart_values (first 20) ---')
    print(json.dumps(chart_values[:20], indent=2, ensure_ascii=False))

    print('\n--- types sample ---')
    for i,row in enumerate(chart_rows[:5]):
        print(i, type(row.get('categoria')) , type(row.get('valor')), row)

print('\n--- analysis done ---')
