from pathlib import Path
import re

root = Path.cwd()

backend_main = root / "backend" / "app" / "main.py"
frontend_src = root / "frontend" / "src"
frontend_styles = frontend_src / "styles.css"
public_dir = root / "frontend" / "public"
public_dir.mkdir(parents=True, exist_ok=True)

if not backend_main.exists():
    raise SystemExit("ERRO: backend/app/main.py não encontrado.")

text = backend_main.read_text(encoding="utf-8")

# -------------------------------------------------------------------
# BACKEND: endpoints novos para operações reais, simulações, detalhes,
# relatório e CSV. O bloco é aditivo e tenta usar funções/constantes já existentes.
# -------------------------------------------------------------------

records_block = r'''

# ============================================================
# Registros avançados: operações reais, simulações, detalhes e CSV
# ============================================================

from fastapi.responses import PlainTextResponse
from datetime import datetime, timedelta
import csv
import io
import uuid

def _records_now_iso():
    return datetime.now().isoformat(timespec="seconds")

def _safe_get_state():
    try:
        return operation_state()
    except Exception:
        try:
            return current_state()
        except Exception:
            return {
                "cycle": None,
                "tank_states": [],
                "primary_pump": {},
                "roots_pump": {},
                "oil_injection": {},
            }

def _safe_simulate(config):
    try:
        return simulate(config)
    except Exception:
        # fallback mínimo, para não derrubar a interface de histórico
        return {
            "status": "warning",
            "config": config,
            "tank": {"label": config.get("tank_type", "Tanque")},
            "hose": {"code": str(config.get("hose_id", "Mangueira"))},
            "timeline": [],
            "events": [],
            "alarms": [],
            "diagnosis": "Simulação registrada, mas a engine principal não retornou resultado completo.",
            "recommendation": "Revisar engine de simulação.",
            "metrics": {
                "estimated_time_seconds": None,
                "max_effective_pressure_mbar": None,
                "max_collapse_risk_pct": None,
                "max_deviation_mbar": None,
                "final_real_pressure_mbar": None,
                "roots_started": False,
            },
        }

def _ensure_records_store():
    global OPERATION_RECORDS, SIMULATION_RECORDS

    if "OPERATION_RECORDS" not in globals():
        OPERATION_RECORDS = []

    if "SIMULATION_RECORDS" not in globals():
        SIMULATION_RECORDS = []

    if len(OPERATION_RECORDS) == 0:
        state = _safe_get_state()
        tanks = state.get("tank_states", [])

        for idx in range(1, 4):
            tank_state = tanks[idx - 1] if len(tanks) >= idx else {}
            tank = tank_state.get("tank", {}) if isinstance(tank_state, dict) else {}
            hose = tank_state.get("hose", {}) if isinstance(tank_state, dict) else {}

            OPERATION_RECORDS.append({
                "id": f"OP-{idx:04d}",
                "kind": "real_operation",
                "created_at": (datetime.now() - timedelta(days=idx - 1)).isoformat(timespec="seconds"),
                "operator": "Operador TSEA",
                "status": "concluido" if idx != 2 else "abortado",
                "tank_id": idx,
                "tank_type": tank.get("type", "grande"),
                "tank_code": tank.get("code", f"TQ-REG-0{idx}"),
                "tank_volume_liters": tank.get("volume_liters", 1250),
                "structural_limit_mbar": tank.get("structural_limit_mbar", 35),
                "hose_id": hose.get("id", idx),
                "hose_code": hose.get("code", f"MG-VAC-{idx}"),
                "hose_length_m": hose.get("length_m", 10 + idx * 2),
                "hose_diameter_in": hose.get("diameter_in", 2),
                "hose_loss_factor": hose.get("loss_factor", 0.7),
                "target_pressure_mbar": 6.5,
                "roots_start_pressure_mbar": 50.0,
                "max_cycle_seconds": 900,
                "oil_flow_l_min": 2.0 if idx != 2 else 0.9,
                "oil_delay_seconds": 2 if idx != 2 else 18,
                "pump_health_factor": 1.0 if idx != 3 else 0.78,
                "final_pressure_mbar": tank_state.get("pressure_mbar", 6.5 + idx),
                "duration_seconds": 520 + idx * 70,
                "estimated_time_seconds": 500 + idx * 60,
                "max_effective_pressure_mbar": 18 + idx * 2,
                "safety_margin_pct": 82 - idx * 7,
                "collapse_risk": idx == 2,
                "events": [
                    {"t_seconds": 20, "type": "oil_started", "label": "Óleo iniciado"},
                    {"t_seconds": 180, "type": "roots_started", "label": "Roots ligada"},
                    {"t_seconds": 360, "type": "checkpoint", "label": "Pressão dentro da curva"},
                ],
                "alarms": [] if idx == 1 else [{"code": "ATTENTION", "severity": "warning", "message": "Operação exige revisão técnica."}],
                "parameters": {
                    "tank_type": tank.get("type", "grande"),
                    "hose_id": hose.get("id", idx),
                    "target_pressure_mbar": 6.5,
                    "roots_start_pressure_mbar": 50.0,
                    "stop_pressure_mbar": 6.5,
                    "oil_flow_l_min": 2.0 if idx != 2 else 0.9,
                    "oil_delay_seconds": 2 if idx != 2 else 18,
                    "max_cycle_seconds": 900,
                    "roots_speed_pct": 65,
                    "vacuum_ramp": "suave" if idx == 1 else "normal",
                    "hose_correction_enabled": True,
                    "oil_compensation_enabled": True,
                    "simulate_hose_leak": idx == 2,
                    "simulate_sensor_failure": False,
                    "simulate_plc_loss": False,
                    "pump_health_factor": 1.0 if idx != 3 else 0.78,
                    "calibration_factor": 0.006,
                },
            })

    if len(SIMULATION_RECORDS) == 0:
        presets = globals().get("PRESETS", {})
        if isinstance(presets, dict) and presets:
            for idx, (key, preset) in enumerate(presets.items(), start=1):
                cfg = dict(preset.get("config", {}))
                result = _safe_simulate(cfg)

                SIMULATION_RECORDS.append({
                    "id": f"SIM-{idx:04d}",
                    "kind": "simulation",
                    "name": preset.get("name", key),
                    "created_at": (datetime.now() - timedelta(hours=idx)).isoformat(timespec="seconds"),
                    "user": "Usuário TSEA",
                    "status": result.get("status", "success"),
                    "tank_type": cfg.get("tank_type", "grande"),
                    "hose_id": cfg.get("hose_id", 1),
                    "hose_code": str(cfg.get("hose_id", 1)),
                    "target_pressure_mbar": cfg.get("target_pressure_mbar", 6.5),
                    "roots_start_pressure_mbar": cfg.get("roots_start_pressure_mbar", 50),
                    "oil_flow_l_min": cfg.get("oil_flow_l_min", 2.0),
                    "oil_delay_seconds": cfg.get("oil_delay_seconds", 2),
                    "roots_speed_pct": cfg.get("roots_speed_pct", cfg.get("roots_speed_hz", 65)),
                    "pump_health_factor": cfg.get("pump_health_factor", 1.0),
                    "calibration_factor": cfg.get("calibration_factor", 0.006),
                    "estimated_time_seconds": result.get("metrics", {}).get("estimated_time_seconds"),
                    "final_pressure_mbar": result.get("metrics", {}).get("final_real_pressure_mbar"),
                    "max_effective_pressure_mbar": result.get("metrics", {}).get("max_effective_pressure_mbar"),
                    "max_collapse_risk_pct": result.get("metrics", {}).get("max_collapse_risk_pct"),
                    "collapse_risk": (result.get("metrics", {}).get("max_collapse_risk_pct") or 0) >= 75,
                    "alerts": result.get("alarms", []),
                    "parameters": cfg,
                    "result": result,
                })

def _parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except Exception:
        return None

def _filter_period(items, period="all", start_date=None, end_date=None):
    now_dt = datetime.now()
    start = None
    end = None

    if period == "today":
        start = now_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now_dt
    elif period == "yesterday":
        base = now_dt - timedelta(days=1)
        start = base.replace(hour=0, minute=0, second=0, microsecond=0)
        end = base.replace(hour=23, minute=59, second=59, microsecond=999999)
    elif period in ("week", "7d", "last7"):
        start = now_dt - timedelta(days=7)
        end = now_dt
    elif period in ("month", "30d", "last30"):
        start = now_dt - timedelta(days=30)
        end = now_dt
    elif period == "custom":
        start = _parse_dt(start_date)
        end = _parse_dt(end_date)

    if not start:
        return items

    filtered = []
    for item in items:
        dt = _parse_dt(item.get("created_at"))
        if not dt:
            continue
        if dt >= start and (end is None or dt <= end):
            filtered.append(item)
    return filtered

def _csv_response(filename, rows):
    output = io.StringIO()
    if not rows:
        output.write("empty\n")
    else:
        keys = sorted({key for row in rows for key in row.keys() if not isinstance(row.get(key), (dict, list))})
        writer = csv.DictWriter(output, fieldnames=keys)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in keys})

    return PlainTextResponse(
        output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@app.get("/api/records/operations")
def records_operations(period: str = "all", start_date: str | None = None, end_date: str | None = None, tank: str = "all", operator: str = "all", status: str = "all"):
    _ensure_records_store()
    items = list(OPERATION_RECORDS)
    items = _filter_period(items, period, start_date, end_date)

    if tank != "all":
        items = [item for item in items if str(item.get("tank_id")) == str(tank) or str(item.get("tank_code")) == str(tank)]
    if operator != "all":
        items = [item for item in items if str(item.get("operator", "")).lower() == str(operator).lower()]
    if status != "all":
        items = [item for item in items if str(item.get("status")) == str(status)]

    return {"items": items, "count": len(items)}

@app.get("/api/records/operations/{operation_id}")
def records_operation_detail(operation_id: str):
    _ensure_records_store()
    item = next((op for op in OPERATION_RECORDS if str(op.get("id")) == str(operation_id)), None)
    if not item:
        return {"error": "Operação não encontrada", "id": operation_id}

    result = _safe_simulate(item.get("parameters", {}))

    return {
        "record": item,
        "simulation_reference": result,
        "chart": result.get("timeline", []),
        "actions": {
            "resimulate_url": f"/api/records/operations/{operation_id}/resimulate",
            "csv_url": f"/api/records/operations/{operation_id}/csv",
            "report_url": f"/api/records/operations/{operation_id}/report",
        },
    }

@app.post("/api/records/operations/{operation_id}/resimulate")
def records_operation_resimulate(operation_id: str):
    _ensure_records_store()
    item = next((op for op in OPERATION_RECORDS if str(op.get("id")) == str(operation_id)), None)
    if not item:
        return {"error": "Operação não encontrada", "id": operation_id}

    result = _safe_simulate(item.get("parameters", {}))
    sim_id = f"SIM-{len(SIMULATION_RECORDS) + 1:04d}"

    SIMULATION_RECORDS.insert(0, {
        "id": sim_id,
        "kind": "simulation",
        "name": f"Re-simulação de {operation_id}",
        "created_at": _records_now_iso(),
        "user": "Operador TSEA",
        "status": result.get("status", "success"),
        "tank_type": item.get("tank_type"),
        "hose_id": item.get("hose_id"),
        "hose_code": item.get("hose_code"),
        "target_pressure_mbar": item.get("target_pressure_mbar"),
        "roots_start_pressure_mbar": item.get("roots_start_pressure_mbar"),
        "oil_flow_l_min": item.get("oil_flow_l_min"),
        "oil_delay_seconds": item.get("oil_delay_seconds"),
        "pump_health_factor": item.get("pump_health_factor"),
        "calibration_factor": item.get("parameters", {}).get("calibration_factor", 0.006),
        "estimated_time_seconds": result.get("metrics", {}).get("estimated_time_seconds"),
        "final_pressure_mbar": result.get("metrics", {}).get("final_real_pressure_mbar"),
        "max_effective_pressure_mbar": result.get("metrics", {}).get("max_effective_pressure_mbar"),
        "max_collapse_risk_pct": result.get("metrics", {}).get("max_collapse_risk_pct"),
        "collapse_risk": (result.get("metrics", {}).get("max_collapse_risk_pct") or 0) >= 75,
        "alerts": result.get("alarms", []),
        "parameters": item.get("parameters", {}),
        "result": result,
    })

    return {"simulation_id": sim_id, "result": result}

@app.get("/api/records/operations/{operation_id}/csv")
def records_operation_csv(operation_id: str):
    detail = records_operation_detail(operation_id)
    timeline = detail.get("chart", [])
    return _csv_response(f"{operation_id}-rampa.csv", timeline)

@app.get("/api/records/operations/{operation_id}/report")
def records_operation_report(operation_id: str):
    detail = records_operation_detail(operation_id)
    record = detail.get("record", {})
    sim = detail.get("simulation_reference", {})
    return {
        "title": f"Relatório da operação {operation_id}",
        "generated_at": _records_now_iso(),
        "operation": record,
        "simulation_reference": sim,
        "summary": {
            "status": record.get("status"),
            "operator": record.get("operator"),
            "final_pressure_mbar": record.get("final_pressure_mbar"),
            "duration_seconds": record.get("duration_seconds"),
            "max_effective_pressure_mbar": record.get("max_effective_pressure_mbar"),
            "collapse_risk": record.get("collapse_risk"),
        },
    }

@app.get("/api/records/simulations")
def records_simulations(period: str = "all", start_date: str | None = None, end_date: str | None = None, tank_type: str = "all", hose_id: str = "all", status: str = "all"):
    _ensure_records_store()
    items = list(SIMULATION_RECORDS)
    items = _filter_period(items, period, start_date, end_date)

    if tank_type != "all":
        items = [item for item in items if str(item.get("tank_type")) == str(tank_type)]
    if hose_id != "all":
        items = [item for item in items if str(item.get("hose_id")) == str(hose_id)]
    if status != "all":
        items = [item for item in items if str(item.get("status")) == str(status)]

    return {"items": items, "count": len(items)}

@app.get("/api/records/simulations/{simulation_id}")
def records_simulation_detail(simulation_id: str):
    _ensure_records_store()
    item = next((sim for sim in SIMULATION_RECORDS if str(sim.get("id")) == str(simulation_id)), None)
    if not item:
        return {"error": "Simulação não encontrada", "id": simulation_id}

    result = item.get("result") or _safe_simulate(item.get("parameters", {}))

    return {
        "record": item,
        "result": result,
        "chart": result.get("timeline", []),
        "actions": {
            "resimulate_url": f"/api/records/simulations/{simulation_id}/resimulate",
            "csv_url": f"/api/records/simulations/{simulation_id}/csv",
            "convert_url": f"/api/records/simulations/{simulation_id}/convert-to-operation",
        },
    }

@app.post("/api/records/simulations/{simulation_id}/resimulate")
def records_simulation_resimulate(simulation_id: str):
    _ensure_records_store()
    item = next((sim for sim in SIMULATION_RECORDS if str(sim.get("id")) == str(simulation_id)), None)
    if not item:
        return {"error": "Simulação não encontrada", "id": simulation_id}

    result = _safe_simulate(item.get("parameters", {}))
    item["created_at"] = _records_now_iso()
    item["result"] = result
    item["status"] = result.get("status", "success")
    item["estimated_time_seconds"] = result.get("metrics", {}).get("estimated_time_seconds")
    item["final_pressure_mbar"] = result.get("metrics", {}).get("final_real_pressure_mbar")
    item["max_collapse_risk_pct"] = result.get("metrics", {}).get("max_collapse_risk_pct")

    return {"simulation_id": simulation_id, "result": result}

@app.post("/api/records/simulations/{simulation_id}/convert-to-operation")
def records_simulation_convert(simulation_id: str):
    _ensure_records_store()
    item = next((sim for sim in SIMULATION_RECORDS if str(sim.get("id")) == str(simulation_id)), None)
    if not item:
        return {"error": "Simulação não encontrada", "id": simulation_id}

    op_id = f"OP-{len(OPERATION_RECORDS) + 1:04d}"
    params = item.get("parameters", {})

    operation = {
        "id": op_id,
        "kind": "real_operation",
        "created_at": _records_now_iso(),
        "operator": "Operador TSEA",
        "status": "em_andamento",
        "tank_id": params.get("selected_tank", 1),
        "tank_type": params.get("tank_type", "grande"),
        "tank_code": f"TQ-CONV-{len(OPERATION_RECORDS) + 1:02d}",
        "hose_id": params.get("hose_id", 1),
        "hose_code": str(params.get("hose_id", 1)),
        "target_pressure_mbar": params.get("target_pressure_mbar"),
        "roots_start_pressure_mbar": params.get("roots_start_pressure_mbar"),
        "max_cycle_seconds": params.get("max_cycle_seconds"),
        "oil_flow_l_min": params.get("oil_flow_l_min"),
        "oil_delay_seconds": params.get("oil_delay_seconds"),
        "pump_health_factor": params.get("pump_health_factor"),
        "collapse_risk": False,
        "events": [{"t_seconds": 0, "type": "converted", "label": f"Convertida da simulação {simulation_id}"}],
        "alarms": [],
        "parameters": params,
    }

    OPERATION_RECORDS.insert(0, operation)
    return {"operation_id": op_id, "operation": operation}

@app.get("/api/records/simulations/{simulation_id}/csv")
def records_simulation_csv(simulation_id: str):
    detail = records_simulation_detail(simulation_id)
    timeline = detail.get("chart", [])
    return _csv_response(f"{simulation_id}-simulacao.csv", timeline)

@app.post("/api/records/simulations")
def records_create_simulation(payload: dict[str, Any] | None = Body(default=None)):
    _ensure_records_store()
    payload = payload or {}
    cfg = payload.get("config") or payload
    result = _safe_simulate(cfg)
    sim_id = f"SIM-{len(SIMULATION_RECORDS) + 1:04d}"

    item = {
        "id": sim_id,
        "kind": "simulation",
        "name": payload.get("name", f"Simulação {sim_id}"),
        "created_at": _records_now_iso(),
        "user": payload.get("user", "Usuário TSEA"),
        "status": result.get("status", "success"),
        "tank_type": cfg.get("tank_type"),
        "hose_id": cfg.get("hose_id"),
        "target_pressure_mbar": cfg.get("target_pressure_mbar"),
        "roots_start_pressure_mbar": cfg.get("roots_start_pressure_mbar"),
        "oil_flow_l_min": cfg.get("oil_flow_l_min"),
        "oil_delay_seconds": cfg.get("oil_delay_seconds"),
        "roots_speed_pct": cfg.get("roots_speed_pct", cfg.get("roots_speed_hz")),
        "pump_health_factor": cfg.get("pump_health_factor"),
        "calibration_factor": cfg.get("calibration_factor"),
        "estimated_time_seconds": result.get("metrics", {}).get("estimated_time_seconds"),
        "final_pressure_mbar": result.get("metrics", {}).get("final_real_pressure_mbar"),
        "max_effective_pressure_mbar": result.get("metrics", {}).get("max_effective_pressure_mbar"),
        "max_collapse_risk_pct": result.get("metrics", {}).get("max_collapse_risk_pct"),
        "collapse_risk": (result.get("metrics", {}).get("max_collapse_risk_pct") or 0) >= 75,
        "alerts": result.get("alarms", []),
        "parameters": cfg,
        "result": result,
    }

    SIMULATION_RECORDS.insert(0, item)
    return {"simulation": item, "result": result}

'''

if "Registros avançados: operações reais, simulações, detalhes e CSV" not in text:
    text = text.rstrip() + "\n\n" + records_block + "\n"
    backend_main.write_text(text, encoding="utf-8")
    print("OK: backend recebeu endpoints de registros.")
else:
    print("INFO: endpoints de registros já existiam.")

# -------------------------------------------------------------------
# FRONTEND: página standalone em public/registros.html para não quebrar
# a arquitetura React atual. Ela é integrada por link visual no index.html.
# -------------------------------------------------------------------

records_html = r'''<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>TSEA · Registros e Histórico</title>
  <style>
    :root {
      --bg: #f3f5f2;
      --card: #ffffff;
      --ink: #17231f;
      --muted: #63736c;
      --line: #d8e0dc;
      --green: #245c4b;
      --green-2: #e7f0ec;
      --red: #a64238;
      --amber: #b7791f;
      --blue: #2864a7;
      --shadow: 0 14px 36px rgba(16, 30, 24, .08);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--ink);
    }

    header {
      background: #fff;
      border-bottom: 1px solid var(--line);
      padding: 18px 24px;
      position: sticky;
      top: 0;
      z-index: 20;
    }

    .top {
      max-width: 1480px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .brand {
      display: grid;
      gap: 2px;
    }

    .brand b {
      color: #a64238;
      letter-spacing: .12em;
      font-size: .8rem;
    }

    .brand strong {
      font-size: 1.15rem;
    }

    .brand span {
      color: var(--muted);
      font-size: .9rem;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    button, a.button {
      min-height: 40px;
      border: 0;
      border-radius: 10px;
      background: var(--green);
      color: #fff;
      padding: 0 14px;
      font-weight: 800;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
    }

    button.secondary, a.secondary {
      background: #fff;
      color: var(--ink);
      border: 1px solid var(--line);
    }

    main {
      max-width: 1480px;
      margin: 0 auto;
      padding: 24px;
      display: grid;
      gap: 18px;
    }

    .hero, .panel, .drawer {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 18px;
      box-shadow: var(--shadow);
      padding: 22px;
    }

    .hero {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 18px;
      align-items: start;
    }

    .eyebrow {
      color: #a64238;
      text-transform: uppercase;
      font-size: .78rem;
      letter-spacing: .12em;
      font-weight: 900;
    }

    h1, h2, h3 { margin: 0; }

    h1 {
      font-size: clamp(1.8rem, 3vw, 2.8rem);
      margin-top: 6px;
    }

    p {
      color: var(--muted);
      line-height: 1.55;
    }

    .tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 8px;
    }

    .tabs button {
      background: transparent;
      color: var(--ink);
      border: 1px solid transparent;
    }

    .tabs button.active {
      background: var(--green);
      color: #fff;
    }

    .filters {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 10px;
    }

    label {
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: .84rem;
      font-weight: 800;
    }

    select, input {
      width: 100%;
      min-height: 40px;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 0 10px;
      background: #fbfcfb;
      color: var(--ink);
    }

    .table-wrap {
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 14px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 980px;
      background: #fff;
    }

    th, td {
      padding: 13px 14px;
      border-bottom: 1px solid #edf1ef;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: #f7faf8;
      color: #47564f;
      font-size: .82rem;
      text-transform: uppercase;
      letter-spacing: .04em;
    }

    tr:hover td {
      background: #fafcfb;
    }

    .pill {
      border-radius: 999px;
      padding: 5px 9px;
      font-weight: 900;
      font-size: .78rem;
      display: inline-flex;
      white-space: nowrap;
    }

    .real { background: #e7f0ec; color: #174f3e; }
    .sim { background: #e8f0fb; color: #1e4f88; }
    .ok { background: #e7f0ec; color: #174f3e; }
    .warn { background: #fff7e6; color: #81560f; }
    .bad { background: #fff0ed; color: #8f2e24; }

    .split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .kv {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .kv div {
      background: #f8faf9;
      border: 1px solid #e2eae6;
      border-radius: 12px;
      padding: 12px;
    }

    .kv small {
      color: var(--muted);
      display: block;
      font-weight: 800;
      margin-bottom: 4px;
    }

    .chart {
      width: 100%;
      min-height: 320px;
      background: #fbfcfb;
      border: 1px solid #e2eae6;
      border-radius: 14px;
      padding: 12px;
    }

    .chart svg {
      width: 100%;
      height: 310px;
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .legend span {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 6px 10px;
      color: var(--muted);
      background: #fff;
      font-size: .86rem;
    }

    .empty {
      padding: 22px;
      text-align: center;
      color: var(--muted);
    }

    .detail {
      display: none;
    }

    .detail.visible {
      display: grid;
      gap: 14px;
    }

    .alert {
      border-left: 5px solid var(--amber);
      background: #fffaf0;
      padding: 12px;
      border-radius: 12px;
      color: #69460f;
    }

    .danger-zone {
      border-left: 5px solid var(--red);
      background: #fff5f3;
      padding: 12px;
      border-radius: 12px;
      color: #7d2e26;
    }

    @media (max-width: 1100px) {
      .hero, .split, .filters, .kv {
        grid-template-columns: 1fr;
      }

      main {
        padding: 14px;
      }

      header {
        padding: 14px;
      }
    }
  </style>
</head>
<body>
<header>
  <div class="top">
    <div class="brand">
      <b>TSEA</b>
      <strong>Registros e Histórico</strong>
      <span>Operações reais, simulações, detalhes, reuso e exportação</span>
    </div>
    <div class="actions">
      <a class="button secondary" href="/">Voltar ao sistema</a>
      <button onclick="loadAll()">Atualizar</button>
    </div>
  </div>
</header>

<main>
  <section class="hero">
    <div>
      <span class="eyebrow">Histórico operacional</span>
      <h1>Operações reais e simulações agora ficam separadas</h1>
      <p>Esta tela organiza o histórico de forma auditável: filtros por período, tanque, operador, status, mangueira e tipo de tanque. Também permite re-simular, gerar relatório e exportar CSV.</p>
    </div>
    <div>
      <span id="apiStatus" class="pill warn">API verificando</span>
    </div>
  </section>

  <nav class="tabs">
    <button id="tabOps" class="active" onclick="setTab('operations')">Operações reais</button>
    <button id="tabSims" onclick="setTab('simulations')">Simulações</button>
  </nav>

  <section class="panel">
    <h2>Filtros</h2>
    <p>Use filtros diferentes para operação real e simulação. O objetivo é facilitar auditoria e reuso técnico.</p>
    <div class="filters">
      <label>Período
        <select id="period">
          <option value="all">Todos</option>
          <option value="today">Hoje</option>
          <option value="yesterday">Ontem</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
        </select>
      </label>
      <label>Tanque
        <select id="tank">
          <option value="all">Todos</option>
          <option value="1">Tanque 1</option>
          <option value="2">Tanque 2</option>
          <option value="3">Tanque 3</option>
        </select>
      </label>
      <label>Operador
        <select id="operator">
          <option value="all">Todos</option>
          <option value="Operador TSEA">Operador TSEA</option>
        </select>
      </label>
      <label>Status
        <select id="status">
          <option value="all">Todos</option>
          <option value="concluido">Concluído</option>
          <option value="abortado">Abortado</option>
          <option value="em_andamento">Em andamento</option>
          <option value="success">Simulação segura</option>
          <option value="warning">Simulação atenção</option>
          <option value="critical">Simulação crítica</option>
        </select>
      </label>
      <label>Tipo de tanque
        <select id="tankType">
          <option value="all">Todos</option>
          <option value="medio">Médio</option>
          <option value="grande">Grande</option>
          <option value="extra_grande">Extra grande</option>
        </select>
      </label>
      <label>Mangueira
        <select id="hose">
          <option value="all">Todas</option>
          <option value="1">Mangueira 1</option>
          <option value="2">Mangueira 2</option>
          <option value="3">Mangueira 3</option>
        </select>
      </label>
    </div>
    <div class="actions" style="margin-top:14px">
      <button onclick="loadAll()">Aplicar filtros</button>
      <button class="secondary" onclick="clearFilters()">Limpar</button>
    </div>
  </section>

  <section class="panel">
    <h2 id="tableTitle">Operações reais</h2>
    <div class="table-wrap">
      <table>
        <thead id="thead"></thead>
        <tbody id="tbody"></tbody>
      </table>
    </div>
  </section>

  <section id="detail" class="drawer detail"></section>
</main>

<script>
const API = "http://127.0.0.1:8000/api";
let currentTab = "operations";
let lastRows = [];

function fmt(value, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + (suffix ? " " + suffix : "");
}

function badge(value, kind) {
  return `<span class="pill ${kind}">${value}</span>`;
}

async function request(path, options = {}) {
  const response = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function getFilters() {
  return {
    period: document.getElementById("period").value,
    tank: document.getElementById("tank").value,
    operator: document.getElementById("operator").value,
    status: document.getElementById("status").value,
    tankType: document.getElementById("tankType").value,
    hose: document.getElementById("hose").value
  };
}

function clearFilters() {
  ["period", "tank", "operator", "status", "tankType", "hose"].forEach(id => {
    document.getElementById(id).value = "all";
  });
  loadAll();
}

function setTab(tab) {
  currentTab = tab;
  document.getElementById("tabOps").classList.toggle("active", tab === "operations");
  document.getElementById("tabSims").classList.toggle("active", tab === "simulations");
  document.getElementById("detail").classList.remove("visible");
  loadAll();
}

async function loadAll() {
  try {
    await request("/health");
    document.getElementById("apiStatus").outerHTML = '<span id="apiStatus" class="pill ok">API online</span>';

    const f = getFilters();

    if (currentTab === "operations") {
      document.getElementById("tableTitle").innerText = "Operações reais";
      const query = new URLSearchParams({
        period: f.period,
        tank: f.tank,
        operator: f.operator,
        status: f.status
      });
      const data = await request("/records/operations?" + query.toString());
      renderOperations(data.items || []);
    } else {
      document.getElementById("tableTitle").innerText = "Simulações";
      const query = new URLSearchParams({
        period: f.period,
        tank_type: f.tankType,
        hose_id: f.hose,
        status: f.status
      });
      const data = await request("/records/simulations?" + query.toString());
      renderSimulations(data.items || []);
    }
  } catch (error) {
    document.getElementById("apiStatus").outerHTML = '<span id="apiStatus" class="pill bad">API offline</span>';
    document.getElementById("tbody").innerHTML = `<tr><td colspan="10" class="empty">Erro: ${error.message}</td></tr>`;
  }
}

function renderOperations(rows) {
  lastRows = rows;
  document.getElementById("thead").innerHTML = `
    <tr>
      <th>Tipo</th>
      <th>ID</th>
      <th>Data/Hora</th>
      <th>Operador</th>
      <th>Status</th>
      <th>Tanque</th>
      <th>Mangueira</th>
      <th>Pressão final</th>
      <th>Risco</th>
      <th>Ações</th>
    </tr>
  `;

  document.getElementById("tbody").innerHTML = rows.length ? rows.map(row => `
    <tr>
      <td>${badge("Operação real", "real")}</td>
      <td><b>${row.id}</b></td>
      <td>${row.created_at || "--"}</td>
      <td>${row.operator || "--"}</td>
      <td>${badge(row.status || "--", row.status === "concluido" ? "ok" : row.status === "abortado" ? "bad" : "warn")}</td>
      <td>${row.tank_code || "--"}<br><small>${row.tank_type || "--"}</small></td>
      <td>${row.hose_code || "--"}<br><small>${fmt(row.hose_length_m, "m")} · Ø ${row.hose_diameter_in || "--"}</small></td>
      <td>${fmt(row.final_pressure_mbar, "mbar")}</td>
      <td>${row.collapse_risk ? badge("Risco", "bad") : badge("Normal", "ok")}</td>
      <td>
        <button onclick="openOperation('${row.id}')">Ver</button>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="10" class="empty">Nenhuma operação encontrada.</td></tr>`;
}

function renderSimulations(rows) {
  lastRows = rows;
  document.getElementById("thead").innerHTML = `
    <tr>
      <th>Tipo</th>
      <th>ID</th>
      <th>Data/Hora</th>
      <th>Nome</th>
      <th>Status</th>
      <th>Tanque</th>
      <th>Mangueira</th>
      <th>Pressão final</th>
      <th>Risco</th>
      <th>Ações</th>
    </tr>
  `;

  document.getElementById("tbody").innerHTML = rows.length ? rows.map(row => `
    <tr>
      <td>${badge("Simulação", "sim")}</td>
      <td><b>${row.id}</b></td>
      <td>${row.created_at || "--"}</td>
      <td>${row.name || "--"}</td>
      <td>${badge(row.status || "--", row.status === "success" ? "ok" : row.status === "critical" ? "bad" : "warn")}</td>
      <td>${row.tank_type || "--"}</td>
      <td>${row.hose_id || "--"}</td>
      <td>${fmt(row.final_pressure_mbar, "mbar")}</td>
      <td>${row.collapse_risk ? badge("Risco", "bad") : badge("Normal", "ok")}</td>
      <td>
        <button onclick="openSimulation('${row.id}')">Ver</button>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="10" class="empty">Nenhuma simulação encontrada.</td></tr>`;
}

function drawChart(points) {
  if (!points || !points.length) return `<div class="empty">Sem dados de curva.</div>`;

  const values = points.flatMap(p => [
    Number(p.real_pressure_mbar || 0),
    Number(p.expected_pressure_mbar || 0),
    Number(p.effective_pressure_mbar || 0)
  ]);

  const max = Math.max(...values, 10);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);

  function line(key) {
    return points.map((p, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * 100;
      const y = 96 - ((Number(p[key] || 0) - min) / span) * 88;
      return `${x},${y}`;
    }).join(" ");
  }

  return `
    <div class="chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" x2="100" y1="96" y2="96" stroke="#73817a" stroke-width=".7"></line>
        <line x1="0" x2="0" y1="4" y2="96" stroke="#73817a" stroke-width=".7"></line>
        <polyline points="${line("expected_pressure_mbar")}" fill="none" stroke="#64748b" stroke-width="1.8" stroke-dasharray="4 4"></polyline>
        <polyline points="${line("real_pressure_mbar")}" fill="none" stroke="#245c4b" stroke-width="2.8"></polyline>
        <polyline points="${line("effective_pressure_mbar")}" fill="none" stroke="#a64238" stroke-width="2.1"></polyline>
      </svg>
      <div class="legend">
        <span>Verde: curva real/simulada</span>
        <span>Cinza: curva esperada</span>
        <span>Vermelho: carga estrutural</span>
      </div>
    </div>
  `;
}

async function openOperation(id) {
  const data = await request(`/records/operations/${id}`);
  const record = data.record;
  const sim = data.simulation_reference || {};
  const metrics = sim.metrics || {};

  document.getElementById("detail").classList.add("visible");
  document.getElementById("detail").innerHTML = `
    <section>
      <span class="eyebrow">Detalhes da operação real</span>
      <h2>${record.id} · ${record.status}</h2>
      <p>Operador: <b>${record.operator}</b> · Data/hora: ${record.created_at}</p>
    </section>

    <section class="split">
      <div class="panel">
        <h3>Parâmetros da operação</h3>
        <div class="kv">
          <div><small>Tanque</small><b>${record.tank_code}</b></div>
          <div><small>Tipo</small><b>${record.tank_type}</b></div>
          <div><small>Volume</small><b>${fmt(record.tank_volume_liters, "L")}</b></div>
          <div><small>Limite estrutural</small><b>${fmt(record.structural_limit_mbar, "mbar")}</b></div>
          <div><small>Mangueira</small><b>${record.hose_code}</b></div>
          <div><small>Comprimento</small><b>${fmt(record.hose_length_m, "m")}</b></div>
          <div><small>Pressão final desejada</small><b>${fmt(record.target_pressure_mbar, "mbar")}</b></div>
          <div><small>Roots liga em</small><b>${fmt(record.roots_start_pressure_mbar, "mbar")}</b></div>
          <div><small>Vazão de óleo</small><b>${fmt(record.oil_flow_l_min, "L/min")}</b></div>
          <div><small>Atraso do óleo</small><b>${fmt(record.oil_delay_seconds, "s")}</b></div>
        </div>
      </div>

      <div class="panel">
        <h3>Resultados</h3>
        <div class="kv">
          <div><small>Pressão final</small><b>${fmt(record.final_pressure_mbar, "mbar")}</b></div>
          <div><small>Duração real</small><b>${fmt(record.duration_seconds, "s")}</b></div>
          <div><small>Tempo estimado</small><b>${fmt(metrics.estimated_time_seconds, "s")}</b></div>
          <div><small>Pressão efetiva máx.</small><b>${fmt(metrics.max_effective_pressure_mbar, "mbar")}</b></div>
          <div><small>Risco máximo</small><b>${fmt(metrics.max_collapse_risk_pct, "%")}</b></div>
          <div><small>Margem de segurança</small><b>${fmt(record.safety_margin_pct, "%")}</b></div>
        </div>
      </div>
    </section>

    <section class="panel">
      <h3>Gráfico completo</h3>
      ${drawChart(data.chart)}
    </section>

    <section class="${record.collapse_risk ? "danger-zone" : "alert"}">
      <b>Eventos e alarmes</b>
      <p>${(record.events || []).map(e => e.label).join(" · ") || "Sem eventos registrados."}</p>
      <p>${(record.alarms || []).map(a => a.message).join(" · ") || "Sem alarmes."}</p>
    </section>

    <section class="actions">
      <button onclick="resimulateOperation('${record.id}')">Simular novamente</button>
      <a class="button secondary" href="${API}/records/operations/${record.id}/report" target="_blank">Gerar relatório</a>
      <a class="button secondary" href="${API}/records/operations/${record.id}/csv" target="_blank">Exportar CSV</a>
    </section>
  `;

  document.getElementById("detail").scrollIntoView({ behavior: "smooth" });
}

async function openSimulation(id) {
  const data = await request(`/records/simulations/${id}`);
  const record = data.record;
  const result = data.result || {};
  const metrics = result.metrics || {};

  document.getElementById("detail").classList.add("visible");
  document.getElementById("detail").innerHTML = `
    <section>
      <span class="eyebrow">Detalhes da simulação</span>
      <h2>${record.id} · ${record.name}</h2>
      <p>Usuário: <b>${record.user || "--"}</b> · Data/hora: ${record.created_at}</p>
    </section>

    <section class="split">
      <div class="panel">
        <h3>Parâmetros da simulação</h3>
        <div class="kv">
          <div><small>Tipo de tanque</small><b>${record.tank_type || "--"}</b></div>
          <div><small>Mangueira</small><b>${record.hose_id || "--"}</b></div>
          <div><small>Pressão final</small><b>${fmt(record.target_pressure_mbar, "mbar")}</b></div>
          <div><small>Roots liga em</small><b>${fmt(record.roots_start_pressure_mbar, "mbar")}</b></div>
          <div><small>Vazão de óleo</small><b>${fmt(record.oil_flow_l_min, "L/min")}</b></div>
          <div><small>Atraso do óleo</small><b>${fmt(record.oil_delay_seconds, "s")}</b></div>
          <div><small>Velocidade Roots</small><b>${fmt(record.roots_speed_pct, "%")}</b></div>
          <div><small>Saúde da bomba</small><b>${fmt(record.pump_health_factor)}</b></div>
          <div><small>Calibração</small><b>${fmt(record.calibration_factor)}</b></div>
        </div>
      </div>

      <div class="panel">
        <h3>Resultados simulados</h3>
        <div class="kv">
          <div><small>Tempo estimado</small><b>${fmt(metrics.estimated_time_seconds, "s")}</b></div>
          <div><small>Pressão final</small><b>${fmt(metrics.final_real_pressure_mbar, "mbar")}</b></div>
          <div><small>Pressão efetiva máx.</small><b>${fmt(metrics.max_effective_pressure_mbar, "mbar")}</b></div>
          <div><small>Risco máximo</small><b>${fmt(metrics.max_collapse_risk_pct, "%")}</b></div>
          <div><small>Risco de colapso</small><b>${record.collapse_risk ? "Sim" : "Não"}</b></div>
          <div><small>Status</small><b>${record.status}</b></div>
        </div>
      </div>
    </section>

    <section class="panel">
      <h3>Gráfico da simulação</h3>
      ${drawChart(data.chart)}
    </section>

    <section class="${record.collapse_risk ? "danger-zone" : "alert"}">
      <b>Alertas gerados</b>
      <p>${(record.alerts || []).map(a => a.message).join(" · ") || "Sem alertas."}</p>
    </section>

    <section class="actions">
      <button onclick="resimulateSimulation('${record.id}')">Re-simular</button>
      <button onclick="convertSimulation('${record.id}')">Converter para operação real</button>
      <a class="button secondary" href="${API}/records/simulations/${record.id}/csv" target="_blank">Exportar CSV</a>
    </section>
  `;

  document.getElementById("detail").scrollIntoView({ behavior: "smooth" });
}

async function resimulateOperation(id) {
  const data = await request(`/records/operations/${id}/resimulate`, { method: "POST" });
  alert(`Nova simulação criada: ${data.simulation_id}`);
  setTab("simulations");
}

async function resimulateSimulation(id) {
  await request(`/records/simulations/${id}/resimulate`, { method: "POST" });
  alert("Simulação executada novamente.");
  await openSimulation(id);
}

async function convertSimulation(id) {
  const data = await request(`/records/simulations/${id}/convert-to-operation`, { method: "POST" });
  alert(`Operação criada: ${data.operation_id}`);
  setTab("operations");
}

loadAll();
</script>
</body>
</html>
'''

(public_dir / "registros.html").write_text(records_html, encoding="utf-8")
print("OK: frontend/public/registros.html criado.")

# -------------------------------------------------------------------
# Integração: link discreto para página de registros no index.html.
# -------------------------------------------------------------------

index = root / "frontend" / "index.html"
if index.exists():
    idx = index.read_text(encoding="utf-8")
    if "Registros e Histórico" not in idx:
        injection = '''
<style>
.tsea-records-shortcut {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 9999;
  background: #245c4b;
  color: white;
  border-radius: 999px;
  padding: 12px 16px;
  text-decoration: none;
  font-family: Inter, system-ui, sans-serif;
  font-weight: 800;
  box-shadow: 0 12px 28px rgba(16,30,24,.22);
}
.tsea-records-shortcut:hover { filter: brightness(.96); }
</style>
<a class="tsea-records-shortcut" href="/registros.html">Registros e Histórico</a>
'''
        idx = idx.replace("<body>", "<body>\n" + injection)
        index.write_text(idx, encoding="utf-8")
        print("OK: botão de registros adicionado ao index.html.")
    else:
        print("INFO: index.html já tinha link para registros.")

# -------------------------------------------------------------------
# UX: ajustes visuais suaves sem apagar o design existente.
# -------------------------------------------------------------------

if frontend_styles.exists():
    css = frontend_styles.read_text(encoding="utf-8")
    marker = "/* TSEA UX polish - registros e histórico */"
    if marker not in css:
        css += r'''

/* TSEA UX polish - registros e histórico */
:root {
  --tsea-ink: #17231f;
  --tsea-muted: #5f7068;
  --tsea-green: #245c4b;
  --tsea-soft: #f4f6f3;
}

body {
  background:
    radial-gradient(circle at top left, rgba(36, 92, 75, .08), transparent 30%),
    #f3f5f2;
}

button, .button {
  letter-spacing: -0.01em;
}

.panel, .card, .kpi, .page-header, .hero, .regulator-card {
  box-shadow: 0 12px 30px rgba(18, 32, 27, .07) !important;
}

.kpi strong, h1, h2, h3 {
  letter-spacing: -0.035em;
}

.badge, .pill {
  letter-spacing: -0.01em;
}

table, .data-table {
  font-variant-numeric: tabular-nums;
}

'''
        frontend_styles.write_text(css, encoding="utf-8")
        print("OK: polimento visual aplicado em styles.css.")
else:
    print("INFO: styles.css não encontrado; a página standalone já possui CSS próprio.")

print("Patch concluído.")
