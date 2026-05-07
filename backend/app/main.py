from typing import Any
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
import math, time

app = FastAPI(title="TSEA Sistema API", version="fix-backend-1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ATM = 1013.25
ROOTS_SAFE = 50.0
SV630B_M3H = 840.0
WSU2001_M3H = 4100.0
SV630B_M3S = SV630B_M3H / 3600.0
WSU2001_M3S = WSU2001_M3H / 3600.0

TANK_TYPES = {
    "medio": {"label": "Regulador médio", "volume_liters": 920.0, "structural_limit_mbar": 42.0},
    "grande": {"label": "Regulador grande", "volume_liters": 1250.0, "structural_limit_mbar": 35.0},
    "extra_grande": {"label": "Regulador crítico", "volume_liters": 1600.0, "structural_limit_mbar": 32.0},
}

RAMPS = {
    "suave": {"label": "Suave", "factor": 0.72},
    "normal": {"label": "Normal", "factor": 1.0},
    "rapida": {"label": "Rápida", "factor": 1.35},
}

HOSES = [
    {"id": 1, "code": "MG-VAC-10M-A", "length_m": 10.0, "diameter_in": 2.0, "loss_factor": 0.62, "status": "available"},
    {"id": 2, "code": "MG-VAC-14M-B", "length_m": 14.0, "diameter_in": 2.0, "loss_factor": 0.84, "status": "available"},
    {"id": 3, "code": "MG-VAC-18M-C", "length_m": 18.0, "diameter_in": 1.5, "loss_factor": 1.28, "status": "attention"},
]

TANKS = [
    {"id": 1, "code": "TQ-REG-01", "type": "grande", "volume_liters": 1250.0, "structural_limit_mbar": 35.0, "status": "available"},
    {"id": 2, "code": "TQ-REG-02", "type": "grande", "volume_liters": 1180.0, "structural_limit_mbar": 38.0, "status": "available"},
    {"id": 3, "code": "TQ-REG-03", "type": "medio", "volume_liters": 920.0, "structural_limit_mbar": 42.0, "status": "available"},
]

RECIPES = [
    {
        "id": 1,
        "name": "Reguladores TSEA - Vácuo com óleo",
        "tank_type": "grande",
        "target_pressure_mbar": 6.5,
        "roots_start_pressure_mbar": 50.0,
        "max_cycle_seconds": 900,
        "min_oil_flow_l_min": 1.8,
        "structural_risk_limit": 82,
    }
]

BASE = {
    "tank_type": "grande",
    "hose_id": 1,
    "target_pressure_mbar": 6.5,
    "roots_start_pressure_mbar": 50.0,
    "stop_pressure_mbar": 6.5,
    "oil_flow_l_min": 2.0,
    "oil_delay_seconds": 2,
    "max_cycle_seconds": 900,
    "roots_speed_pct": 65.0,
    "roots_speed_hz": 65.0,
    "vacuum_ramp": "suave",
    "hose_correction_enabled": True,
    "oil_compensation_enabled": True,
    "selected_tank": 1,
    "deviation_alert_mbar": 10.0,
    "simulate_hose_leak": False,
    "simulate_sensor_failure": False,
    "simulate_plc_loss": False,
    "pump_health_factor": 1.0,
    "calibration_factor": 0.006,
}

PRESETS = {
    "segura": {"id": "segura", "name": "Operação segura", "description": "Ciclo correto, óleo suficiente, Roots segura e mangueira adequada.", "config": {**BASE}},
    "oleo_baixo": {"id": "oleo_baixo", "name": "Óleo insuficiente", "description": "Vazão baixa de óleo aumenta o risco estrutural.", "config": {**BASE, "oil_flow_l_min": 0.8, "vacuum_ramp": "rapida"}},
    "oleo_atrasado": {"id": "oleo_atrasado", "name": "Óleo atrasado", "description": "Óleo entra tarde e gera pico de risco.", "config": {**BASE, "oil_delay_seconds": 20, "vacuum_ramp": "rapida"}},
    "mangueira_longa": {"id": "mangueira_longa", "name": "Mangueira longa", "description": "Mostra perda por condutância da mangueira.", "config": {**BASE, "hose_id": 3, "hose_correction_enabled": False}},
    "vazamento": {"id": "vazamento", "name": "Vazamento", "description": "Mostra curva real divergindo da esperada.", "config": {**BASE, "hose_id": 2, "simulate_hose_leak": True}},
    "bomba_desgastada": {"id": "bomba_desgastada", "name": "Bomba SV630B desgastada", "description": "Simula perda de eficiência da bomba primária.", "config": {**BASE, "pump_health_factor": 0.72}},
    "tanque_critico": {"id": "tanque_critico", "name": "Tanque crítico", "description": "Tanque grande com meta agressiva de pressão.", "config": {**BASE, "tank_type": "extra_grande", "target_pressure_mbar": 0.05, "stop_pressure_mbar": 0.05, "vacuum_ramp": "rapida"}},
}

STATE = {
    "running": False,
    "paused": False,
    "emergency": False,
    "started_at": None,
    "pressure": ATM,
    "oil": 0.0,
    "cycle_code": "CYC-DEMO",
    "cycles": [],
    "history": [],
    "alarms": [],
    "traces": [],
}

def hose_by_id(hose_id):
    return next((h for h in HOSES if int(h["id"]) == int(hose_id)), HOSES[0])

def hose_factor(hose, correction=True, leak=False):
    length = float(hose["length_m"])
    diameter = max(float(hose["diameter_in"]), 0.5)
    loss = float(hose["loss_factor"])
    base_loss = min(0.16, length * loss * (1 / diameter) * 0.02)
    if leak:
        base_loss += 0.18
    if correction:
        base_loss *= 0.45
    return max(0.55, 1 - base_loss)

def effective_load(pressure, oil, enabled=True):
    vacuum_load = max(0.0, ATM - max(float(pressure), 0.01)) * 0.025
    oil_comp = float(oil) * 0.72 if enabled else 0.0
    return max(0.0, vacuum_load - oil_comp)

def integrate_pressure(current, target, speed, volume, dt):
    if current <= target:
        return target
    return max(target, current * math.exp(-(max(speed, 0.000001) / max(volume, 0.001)) * dt))

def operation_state():
    if STATE["running"] and not STATE["paused"] and not STATE["emergency"]:
        elapsed = int(time.time() - STATE["started_at"])
        STATE["pressure"] = max(0.2, ATM * math.exp(-0.006 * elapsed))
        STATE["oil"] = max(0.0, (elapsed - 2) / 60 * 2.0)

        STATE["history"].append({
            "id": len(STATE["history"]) + 1,
            "timestamp": str(elapsed),
            "tank_id": 1,
            "pressure_mbar": round(STATE["pressure"], 3),
            "expected_pressure_mbar": round(max(0.2, STATE["pressure"] * 0.97), 3),
            "oil_volume_liters": round(STATE["oil"], 3),
            "oil_flow_l_min": 2.0,
            "collapse_risk_pct": 20.0,
        })

    tank_states = []
    for i, tank in enumerate(TANKS):
        hose = HOSES[min(i, len(HOSES) - 1)]
        p = STATE["pressure"] + i * 2.5
        oil = STATE["oil"]
        risk = min(100.0, effective_load(p, oil, True) / float(tank["structural_limit_mbar"]) * 100)

        tank_states.append({
            "tank": tank,
            "hose": hose,
            "pressure_mbar": round(p, 3),
            "expected_pressure_mbar": round(max(0.2, p * 0.97), 3),
            "oil_volume_liters": round(oil, 3),
            "oil_flow_l_min": 2.0,
            "hose_loss_mbar": round((1 - hose_factor(hose, True, False)) * 100, 3),
            "collapse_risk_pct": round(risk, 2),
            "status_light": "red" if risk > 82 else "yellow" if risk > 65 else "green",
        })

    cycle = None
    if STATE["running"]:
        cycle = {
            "id": 1,
            "cycle_code": STATE["cycle_code"],
            "operator": "Operador TSEA",
            "recipe_id": 1,
            "started_at": str(STATE["started_at"]),
            "finished_at": None,
            "status": "emergency" if STATE["emergency"] else "paused" if STATE["paused"] else "running",
            "initial_pressure_mbar": ATM,
            "final_pressure_mbar": None,
            "duration_seconds": int(time.time() - STATE["started_at"]) if STATE["started_at"] else 0,
            "notes": "Ciclo simulado em tempo real.",
        }

    return {
        "cycle": cycle,
        "recipe": RECIPES[0],
        "tank_states": tank_states,
        "primary_pump": {"model": "Leybold SOGEVAC SV630B", "running": STATE["running"] and not STATE["paused"], "speed_m3_h": SV630B_M3H},
        "roots_pump": {"model": "Leybold RUVAC WSU2001", "running": STATE["running"] and STATE["pressure"] <= ROOTS_SAFE, "speed_pct": 65, "safe_start_pressure_mbar": ROOTS_SAFE},
        "oil_injection": {"enabled": STATE["running"], "fault": False, "target_flow_l_min": 2.0},
        "plc_comm_ok": not STATE["emergency"],
        "paused": STATE["paused"],
        "emergency": STATE["emergency"],
        "alarms_created": len(STATE["alarms"]),
        "active_alarms": STATE["alarms"][-20:],
    }

def simulate(payload):
    cfg = {**BASE, **(payload or {})}
    tank = TANK_TYPES.get(str(cfg.get("tank_type", "grande")), TANK_TYPES["grande"])
    hose = hose_by_id(cfg.get("hose_id", 1))
    ramp = RAMPS.get(str(cfg.get("vacuum_ramp", "normal")), RAMPS["normal"])

    target = float(cfg.get("target_pressure_mbar", 6.5))
    stop = float(cfg.get("stop_pressure_mbar", target))
    roots_start = min(float(cfg.get("roots_start_pressure_mbar", ROOTS_SAFE)), ROOTS_SAFE)
    oil_flow = float(cfg.get("oil_flow_l_min", 2.0))
    oil_delay = int(cfg.get("oil_delay_seconds", 2))
    max_cycle = int(cfg.get("max_cycle_seconds", 900))
    roots_pct = float(cfg.get("roots_speed_pct", cfg.get("roots_speed_hz", 65))) / 100
    pump_health = max(0.35, min(1.15, float(cfg.get("pump_health_factor", 1))))
    calibration = max(0.001, min(0.05, float(cfg.get("calibration_factor", 0.006))))
    correction = bool(cfg.get("hose_correction_enabled", True))
    oil_enabled = bool(cfg.get("oil_compensation_enabled", True))
    leak = bool(cfg.get("simulate_hose_leak", False))
    sensor_fail = bool(cfg.get("simulate_sensor_failure", False))
    plc_loss = bool(cfg.get("simulate_plc_loss", False))

    volume = float(tank["volume_liters"]) / 1000
    hf = hose_factor(hose, correction, leak)

    expected = ATM
    real = ATM
    roots_on = False
    roots_at = None
    oil_at = None
    risk_at = None
    target_at = None
    max_load = 0.0
    max_risk = 0.0
    max_dev = 0.0
    timeline = []
    events = []
    alarms = []

    for t in range(0, max_cycle + 10, 10):
        if oil_at is None and t >= oil_delay:
            oil_at = t
            events.append({"t_seconds": t, "type": "oil_started", "label": "Óleo iniciado"})

        if not roots_on and real <= roots_start:
            roots_on = True
            roots_at = t
            events.append({"t_seconds": t, "type": "roots_started", "label": "Roots ligada"})

        roots_speed = WSU2001_M3S * roots_pct if roots_on else 0.0
        expected_speed = (SV630B_M3S + roots_speed) * calibration * ramp["factor"]
        real_speed = (SV630B_M3S * pump_health + roots_speed) * calibration * ramp["factor"] * hf

        expected = integrate_pressure(expected, target, expected_speed, volume, 10)
        real = integrate_pressure(real, target, real_speed, volume, 10)

        if leak:
            real = min(ATM, real + 0.006 * t)

        measured = real
        if sensor_fail and t > 120:
            measured = 2400.0 if (t // 20) % 2 == 0 else -8.0

        oil = 0.0 if t <= oil_delay else oil_flow * ((t - oil_delay) / 60)
        load = effective_load(real, oil, oil_enabled)
        risk = min(160.0, load / max(float(tank["structural_limit_mbar"]), 1) * 100)
        dev = abs(real - expected)

        max_load = max(max_load, load)
        max_risk = max(max_risk, risk)
        max_dev = max(max_dev, dev)

        if risk_at is None and risk >= 75:
            risk_at = t
            events.append({"t_seconds": t, "type": "risk_warning", "label": "Risco elevado"})

        if target_at is None and real <= stop:
            target_at = t
            events.append({"t_seconds": t, "type": "target_reached", "label": "Pressão alvo atingida"})

        timeline.append({
            "t_seconds": t,
            "expected_pressure_mbar": round(expected, 5),
            "real_pressure_mbar": round(real, 5),
            "sensor_pressure_mbar": round(measured, 5),
            "hose_loss_mbar": round((1 - hf) * 100, 4),
            "oil_volume_liters": round(oil, 4),
            "oil_flow_l_min": oil_flow,
            "effective_pressure_mbar": round(load, 4),
            "collapse_risk_pct": round(risk, 2),
            "roots_started": roots_on,
        })

        if target_at is not None:
            break

    status = "success"

    def add_alarm(code, severity, message):
        nonlocal status
        alarms.append({"code": code, "severity": severity, "message": message})
        if severity == "critical":
            status = "critical"
        elif status == "success":
            status = "warning"

    if oil_flow < 1.5:
        add_alarm("OIL_FLOW_LOW", "critical", "Vazão de óleo insuficiente.")
    if oil_delay > 10:
        add_alarm("OIL_DELAY", "critical", "Óleo entrou tarde demais.")
    if max_risk >= 100:
        add_alarm("STRUCTURAL_RISK", "critical", "Risco estrutural crítico.")
    elif max_risk >= 75:
        add_alarm("STRUCTURAL_ATTENTION", "warning", "Risco estrutural elevado.")
    if hf < 0.95:
        add_alarm("HOSE_LOSS", "warning", "Mangueira reduzindo velocidade efetiva.")
    if leak:
        add_alarm("HOSE_LEAK", "warning", "Possível vazamento na mangueira.")
    if pump_health < 0.85:
        add_alarm("PUMP_HEALTH_LOW", "warning", "SV630B com eficiência reduzida.")
    if sensor_fail:
        add_alarm("SENSOR_FAIL", "critical", "Falha simulada de sensor.")
    if plc_loss:
        add_alarm("PLC_LOSS", "critical", "Perda simulada de comunicação com CLP.")
    if not roots_on:
        add_alarm("ROOTS_NOT_STARTED", "warning", "Roots não entrou abaixo de 50 mbar.")
    if target_at is None:
        add_alarm("TARGET_NOT_REACHED", "warning", "Pressão alvo não atingida.")

    if status == "success":
        diagnosis = "Operação simulada segura."
        recommendation = "Manter parâmetros e usar como referência."
    elif status == "warning":
        diagnosis = "Operação com atenção. Há desvios operacionais."
        recommendation = "Revisar mangueira, bomba, óleo, rampa e tempo."
    else:
        diagnosis = "Operação crítica. Há risco operacional."
        recommendation = "Bloquear execução real e validar com engenharia."

    return {
        "status": status,
        "config": cfg,
        "tank": tank,
        "hose": hose,
        "ramp": ramp,
        "timeline": timeline,
        "events": events,
        "alarms": alarms,
        "diagnosis": diagnosis,
        "recommendation": recommendation,
        "formula_notes": {
            "vacuum_curve": "dP/dt = -(S/V) * P",
            "sv630b_speed_m3_s": round(SV630B_M3S, 4),
            "roots_speed_m3_s": round(WSU2001_M3S, 4),
            "roots_safe_pressure_mbar": ROOTS_SAFE,
        },
        "metrics": {
            "estimated_time_seconds": target_at,
            "max_effective_pressure_mbar": round(max_load, 3),
            "max_collapse_risk_pct": round(max_risk, 2),
            "max_deviation_mbar": round(max_dev, 3),
            "final_real_pressure_mbar": timeline[-1]["real_pressure_mbar"] if timeline else None,
            "final_sensor_pressure_mbar": timeline[-1]["sensor_pressure_mbar"] if timeline else None,
            "roots_started": roots_on,
            "roots_started_at": roots_at,
            "oil_started_at": oil_at,
            "first_risk_at": risk_at,
            "hose_speed_factor": round(hf, 4),
            "pump_health_factor": pump_health,
            "calibration_factor": calibration,
        },
    }

@app.get("/")
def root():
    return {"status": "ok", "service": "TSEA API"}

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "TSEA API"}

@app.get("/api/operation/state")
def get_state():
    return operation_state()

@app.post("/api/operation/tick")
def tick():
    return operation_state()

@app.post("/api/operation/start")
def start(payload: dict | None = Body(default=None)):
    operator = (payload or {}).get("operator", "Operador TSEA")
    STATE["running"] = True
    STATE["paused"] = False
    STATE["emergency"] = False
    STATE["started_at"] = time.time()
    STATE["pressure"] = ATM
    STATE["oil"] = 0.0
    STATE["cycle_code"] = f"CYC-{int(time.time())}"
    cycle = {"id": len(STATE["cycles"]) + 1, "cycle_code": STATE["cycle_code"], "operator": operator, "status": "running"}
    STATE["cycles"].append(cycle)
    return {"cycle": cycle, "state": operation_state()}

@app.post("/api/operation/pause")
def pause():
    STATE["paused"] = not STATE["paused"]
    return operation_state()

@app.post("/api/operation/stop")
def stop():
    STATE["running"] = False
    STATE["paused"] = False
    return operation_state()

@app.post("/api/operation/reset")
def reset():
    STATE["running"] = False
    STATE["paused"] = False
    STATE["emergency"] = False
    STATE["pressure"] = ATM
    STATE["oil"] = 0.0
    return operation_state()

@app.post("/api/operation/emergency")
def emergency():
    STATE["running"] = False
    STATE["emergency"] = True
    alarm = {"id": len(STATE["alarms"]) + 1, "code": "EMERGENCY_STOP", "severity": "critical", "message": "Parada de emergência acionada.", "acknowledged": False}
    STATE["alarms"].append(alarm)
    return operation_state()

@app.get("/api/operation/config-options")
def operation_options():
    return {"tank_types": TANK_TYPES, "ramps": RAMPS, "presets": PRESETS, "hoses": HOSES, "fields": list(BASE.keys())}

@app.post("/api/operation/manual-simulate")
def manual_simulate(payload: dict | None = Body(default=None)):
    return simulate(payload or BASE)

@app.get("/api/digital-twin/config-options")
def twin_options():
    return operation_options()

@app.post("/api/digital-twin/simulate")
def twin_simulate(payload: dict | None = Body(default=None)):
    return simulate(payload or BASE)

@app.get("/api/digital-twin")
def twin_state():
    st = operation_state()
    first = st["tank_states"][0]
    return {
        "health_index": 92.5,
        "stability_index": 90.0,
        "expected_pressure_mbar": first["expected_pressure_mbar"],
        "pressure_deviation_pct": abs(first["pressure_mbar"] - first["expected_pressure_mbar"]),
        "bottleneck": "Operação estável",
        "recommendations": ["Monitorar óleo, Roots e pressão.", "Comparar curva real com modelo esperado."],
    }

@app.get("/api/scenarios")
def scenarios():
    return list(PRESETS.values())

@app.post("/api/scenarios/{scenario_id}/run")
def run_scenario(scenario_id: str):
    return simulate(PRESETS.get(scenario_id, PRESETS["segura"])["config"])

@app.get("/api/tanks")
def tanks():
    return TANKS

@app.get("/api/hoses")
def hoses():
    return HOSES

@app.get("/api/recipes")
def recipes():
    return RECIPES

@app.get("/api/cycles")
def cycles():
    return STATE["cycles"][-100:]

@app.get("/api/process/history")
def history(limit: int = 180):
    return STATE["history"][-limit:]

@app.get("/api/alarms")
def alarms():
    return STATE["alarms"][-100:]

@app.post("/api/alarms/{alarm_id}/ack")
def ack(alarm_id: int):
    for alarm in STATE["alarms"]:
        if alarm.get("id") == alarm_id:
            alarm["acknowledged"] = True
            return alarm
    return {"id": alarm_id, "acknowledged": True}

@app.get("/api/traceability")
def traceability():
    return STATE["traces"][-100:]

@app.post("/api/traceability")
def create_trace(payload: dict | None = Body(default=None)):
    item = {"id": len(STATE["traces"]) + 1, "timestamp": str(time.time()), **(payload or {})}
    STATE["traces"].append(item)
    return item

@app.get("/api/maintenance/prediction")
def maintenance():
    return [
        {"id": 1, "asset_type": "Bomba", "asset_code": "SV630B", "risk_score": 28, "remaining_hours": 720, "recommendation": "Monitorar curva pressão x tempo."},
        {"id": 2, "asset_type": "Bomba", "asset_code": "WSU2001", "risk_score": 34, "remaining_hours": 610, "recommendation": "Verificar partida segura abaixo de 50 mbar."},
        {"id": 3, "asset_type": "Mangueira", "asset_code": "MG-VAC-18M-C", "risk_score": 61, "remaining_hours": 220, "recommendation": "Avaliar troca da mangueira."},
    ]

@app.get("/api/reports/operational")
def report():
    return {
        "title": "Relatório operacional TSEA",
        "cycles_count": len(STATE["cycles"]),
        "alarms_count": len(STATE["alarms"]),
        "average_recent_pressure_mbar": round(STATE["pressure"], 3),
        "max_recent_collapse_risk_pct": 20.0,
        "simulated_assets": ["SV630B", "WSU2001", "Tanques", "Mangueiras"],
    }

@app.post("/api/digital-twin/assistant")
@app.post("/api/chatbot")
@app.post("/api/chat")
@app.post("/api/ai-chat")
def assistant(payload: dict | None = Body(default=None)):
    payload = payload or {}
    result = payload.get("result")
    message = str(payload.get("message", payload.get("question", ""))).lower()

    if not result:
        return {"answer": "Execute uma simulação primeiro.", "intent": "empty", "suggested_actions": ["Executar simulação"]}

    metrics = result.get("metrics", {})

    if "tsea" in message or "apresent" in message:
        answer = f"Para a TSEA: o Gêmeo Digital simula o ciclo antes da operação real. Risco máximo: {metrics.get('max_collapse_risk_pct')}%. Recomendação: {result.get('recommendation')}"
    elif "risco" in message:
        answer = f"O risco máximo foi {metrics.get('max_collapse_risk_pct')}%. {result.get('recommendation')}"
    elif "bomba" in message:
        answer = f"A saúde da SV630B está em {metrics.get('pump_health_factor')}. Abaixo de 0,85 indica desgaste."
    elif "mangueira" in message:
        answer = f"O fator da mangueira foi {metrics.get('hose_speed_factor')}. Mangueira longa ou vazamento reduz eficiência."
    else:
        answer = f"{result.get('diagnosis')} {result.get('recommendation')}"

    return {"answer": answer, "intent": "digital_twin", "suggested_actions": ["Ver diagnóstico", "Ajustar parâmetros"]}

@app.post("/api/what-if")
def what_if(payload: dict | None = Body(default=None)):
    result = simulate(PRESETS["mangueira_longa"]["config"])
    return {
        "id": int(time.time()),
        "timestamp": str(time.time()),
        "scenario_name": (payload or {}).get("scenario_name", "Mangueira longa"),
        "recipe_id": (payload or {}).get("recipe_id", 1),
        "tank_count": 3,
        "projected_duration_seconds": result["metrics"]["estimated_time_seconds"] or 900,
        "projected_final_pressure_mbar": result["metrics"]["final_real_pressure_mbar"],
        "max_collapse_risk_pct": result["metrics"]["max_collapse_risk_pct"],
        "roots_started": result["metrics"]["roots_started"],
        "alarms": ", ".join([a["code"] for a in result["alarms"]]),
        "summary": result["diagnosis"],
    }

@app.get("/api/what-if")
def what_if_history():
    return []



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



