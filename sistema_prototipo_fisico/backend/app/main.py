from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(
    title="TSEA Supervisório Digital",
    version="1.0.0",
    description="API para supervisão operacional, rastreabilidade e simulação do processo de vácuo."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


TANKS = [
    {"id": 1, "code": "TQ-REG-01", "type": "grande", "volume_liters": 1250, "structural_limit_mbar": 35, "status": "available"},
    {"id": 2, "code": "TQ-REG-02", "type": "grande", "volume_liters": 1250, "structural_limit_mbar": 35, "status": "available"},
    {"id": 3, "code": "TQ-REG-03", "type": "extra_grande", "volume_liters": 1800, "structural_limit_mbar": 32, "status": "attention"},
]

HOSES = [
    {"id": 1, "code": "MG-VAC-10M-A", "length_m": 10, "diameter_in": 2.0, "loss_factor": 0.62, "status": "available"},
    {"id": 2, "code": "MG-VAC-14M-B", "length_m": 14, "diameter_in": 2.0, "loss_factor": 0.84, "status": "available"},
    {"id": 3, "code": "MG-VAC-18M-C", "length_m": 18, "diameter_in": 1.5, "loss_factor": 1.28, "status": "attention"},
]

RECIPES = [
    {
        "id": 1,
        "name": "Reguladores TSEA - Vácuo com óleo",
        "tank_type": "grande",
        "target_pressure_mbar": 6.5,
        "roots_start_pressure_mbar": 50,
        "max_cycle_seconds": 900,
        "min_oil_flow_l_min": 1.8,
    },
    {
        "id": 2,
        "name": "Ciclo seguro padrão",
        "tank_type": "grande",
        "target_pressure_mbar": 8,
        "roots_start_pressure_mbar": 55,
        "max_cycle_seconds": 780,
        "min_oil_flow_l_min": 2.0,
    },
    {
        "id": 3,
        "name": "Tanque extra grande - ciclo controlado",
        "tank_type": "extra_grande",
        "target_pressure_mbar": 7.5,
        "roots_start_pressure_mbar": 60,
        "max_cycle_seconds": 1100,
        "min_oil_flow_l_min": 2.4,
    },
]

EQUIPMENT_SPECS = {
    "primary_pump": {
        "model": "Leybold SOGEVAC SV 630 B",
        "technology": "Bomba rotativa de palhetas lubrificada a óleo",
        "nominal_speed_50hz_m3_h": 640,
        "nominal_speed_60hz_m3_h": 755,
        "ultimate_pressure_no_gas_ballast_mbar": 0.08,
        "ultimate_pressure_gas_ballast_mbar": 0.7,
        "oil_filling_liters": 20,
        "motor_power_kw": 15,
        "nominal_rpm_50hz": 820,
        "inlet": "DN 100 PN 10 / DN 100 ISO-K",
    },
    "roots_pump": {
        "model": "Leybold RUVAC WSU 2001",
        "technology": "Bomba Roots com motor blindado refrigerado a ar",
        "nominal_speed_50hz_m3_h": 2050,
        "nominal_speed_60hz_m3_h": 2460,
        "effective_speed_with_sogevac_50hz_m3_h": 1850,
        "ultimate_pressure_mbar": 0.04,
        "max_differential_pressure_mbar": 50,
        "leak_rate_mbar_l_s": 1e-4,
    },
}

STATE: dict[str, Any] = {
    "cycle": {
        "id": "CICLO-0001",
        "status": "stopped",
        "started_at": None,
        "operator": "Operador TSEA",
        "elapsed_seconds": 0,
    },
    "primary_pump": {
        "model": EQUIPMENT_SPECS["primary_pump"]["model"],
        "running": False,
        "speed_m3_h": EQUIPMENT_SPECS["primary_pump"]["nominal_speed_50hz_m3_h"],
        "health_pct": 96,
    },
    "roots_pump": {
        "model": EQUIPMENT_SPECS["roots_pump"]["model"],
        "running": False,
        "speed_m3_h": EQUIPMENT_SPECS["roots_pump"]["nominal_speed_50hz_m3_h"],
        "safe_start_pressure_mbar": 50,
        "health_pct": 94,
    },
    "oil_injection": {
        "enabled": False,
        "target_flow_l_min": 2.0,
        "current_flow_l_min": 0.0,
    },
    "plc_comm_ok": True,
}

OPERATIONS: list[dict[str, Any]] = []
SIMULATIONS: list[dict[str, Any]] = []


class OperationStartPayload(BaseModel):
    operator: str = "Operador TSEA"
    tank_id: int | str | None = 1
    hose_id: int | str | None = 1
    recipe_id: int | str | None = 1
    target_pressure_mbar: float = 6.5
    roots_start_pressure_mbar: float = 50
    max_cycle_seconds: int = 900
    oil_flow_l_min: float = 2.0
    tank_type: str = "grande"
    notes: str = ""


class SimulationPayload(BaseModel):
    tank_type: str = "grande"
    hose_id: int | str = 1
    target_pressure_mbar: float = 6.5
    roots_start_pressure_mbar: float = 50
    oil_flow_l_min: float = 2.0
    oil_delay_seconds: float = 0
    max_cycle_seconds: int = 900
    pump_health_factor: float = 1.0
    calibration_factor: float = 1.0
    hose_correction_enabled: bool = True
    oil_compensation_enabled: bool = True
    simulate_hose_leak: bool = False
    simulate_sensor_failure: bool = False
    simulate_plc_loss: bool = False


class SimulationRecordPayload(BaseModel):
    name: str = "Simulação Operacional"
    config: dict[str, Any]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_tank_by_type(tank_type: str) -> dict[str, Any]:
    for tank in TANKS:
        if str(tank["type"]) == str(tank_type):
            return tank
    return TANKS[0]


def get_hose(hose_id: int | str) -> dict[str, Any]:
    for hose in HOSES:
        if str(hose["id"]) == str(hose_id) or str(hose["code"]) == str(hose_id):
            return hose
    return HOSES[0]


def cycle_pressure(base_pressure: float, elapsed: int, tank_index: int) -> float:
    if STATE["cycle"]["status"] != "running":
        return base_pressure

    decay = max(5.0, base_pressure * math.exp(-(elapsed + tank_index * 8) / 180))
    return round(decay, 2)


def build_tank_states() -> list[dict[str, Any]]:
    elapsed = int(STATE["cycle"]["elapsed_seconds"])
    result = []

    for index, tank in enumerate(TANKS):
        hose = HOSES[index % len(HOSES)]
        base_pressure = 1013.0
        pressure = cycle_pressure(base_pressure, elapsed, index)
        expected = max(6.0, pressure * 0.92)
        hose_loss = round(hose["loss_factor"] * 2.3, 2)
        oil = round(min(8.0, elapsed / 80 + index * 0.4), 2) if STATE["oil_injection"]["enabled"] else 0
        effective_pressure = pressure + hose_loss - oil * 0.4
        risk = max(5, min(98, (tank["structural_limit_mbar"] / max(effective_pressure, 1)) * 18))
        if pressure <= tank["structural_limit_mbar"]:
            risk = min(98, 70 + (tank["structural_limit_mbar"] - pressure) * 2.2)

        result.append(
            {
                "tank": tank,
                "hose": hose,
                "pressure_mbar": pressure,
                "expected_pressure_mbar": round(expected, 2),
                "effective_pressure_mbar": round(effective_pressure, 2),
                "hose_loss_mbar": hose_loss,
                "oil_volume_liters": oil,
                "collapse_risk_pct": round(risk, 2),
                "status_light": "red" if risk >= 82 else "yellow" if risk >= 65 else "green",
            }
        )

    return result


def simulate(payload: SimulationPayload) -> dict[str, Any]:
    tank = get_tank_by_type(payload.tank_type)
    hose = get_hose(payload.hose_id)

    volume_m3 = tank["volume_liters"] / 1000
    primary_speed_m3_s = EQUIPMENT_SPECS["primary_pump"]["nominal_speed_50hz_m3_h"] / 3600
    roots_speed_m3_s = EQUIPMENT_SPECS["roots_pump"]["effective_speed_with_sogevac_50hz_m3_h"] / 3600

    health = max(0.35, min(1.15, payload.pump_health_factor))
    hose_factor = hose["loss_factor"] if payload.hose_correction_enabled else 0.5
    oil_factor = max(0.45, min(1.25, payload.oil_flow_l_min / 2.0)) if payload.oil_compensation_enabled else 1.0

    if payload.simulate_hose_leak:
        hose_factor *= 1.9
    if payload.simulate_sensor_failure:
        health *= 0.8
    if payload.simulate_plc_loss:
        health *= 0.7

    target = max(0.5, payload.target_pressure_mbar)
    pressure = 1013.0
    timeline = []
    roots_on = False
    oil_on = False
    max_risk = 0
    final_time = payload.max_cycle_seconds

    for t in range(0, payload.max_cycle_seconds + 1, 30):
        if pressure <= payload.roots_start_pressure_mbar:
            roots_on = True

        if t >= payload.oil_delay_seconds:
            oil_on = True

        active_speed = primary_speed_m3_s + (roots_speed_m3_s if roots_on else 0)
        active_speed *= health
        active_speed *= payload.calibration_factor
        loss = hose_factor * 0.025
        oil_gain = 0.018 * oil_factor if oil_on else 0

        k = max(0.0007, (active_speed / max(volume_m3, 0.1)) * 0.009 - loss + oil_gain)
        pressure = max(target, pressure * math.exp(-k * 30))

        effective = pressure + hose_factor * 2.4
        if payload.oil_flow_l_min < 1.5:
            effective += 8
        if payload.simulate_hose_leak:
            effective += 14
        if payload.simulate_sensor_failure:
            effective += 7

        margin = tank["structural_limit_mbar"] - effective
        risk = max(4, min(99, 100 - margin * 2.6))
        max_risk = max(max_risk, risk)

        timeline.append(
            {
                "time_seconds": t,
                "real_pressure_mbar": round(pressure, 2),
                "expected_pressure_mbar": round(max(target, pressure * 0.93), 2),
                "effective_pressure_mbar": round(effective, 2),
                "collapse_risk_pct": round(risk, 2),
                "roots_on": roots_on,
                "oil_on": oil_on,
                "hose_loss_mbar": round(hose_factor * 2.4, 2),
            }
        )

        if pressure <= target * 1.05:
            final_time = t
            break

    status = "success"
    diagnosis = "Ciclo simulado aprovado para execução operacional."
    recommendation = "Parâmetros dentro da faixa de operação."

    if max_risk >= 82 or payload.simulate_plc_loss or payload.simulate_sensor_failure:
        status = "critical"
        diagnosis = "Ciclo simulado reprovado por risco operacional ou falha simulada."
        recommendation = "Revisar mangueira, bomba, sensor, óleo e intertravamentos antes da execução."
    elif max_risk >= 65 or payload.oil_flow_l_min < 1.5 or payload.simulate_hose_leak:
        status = "warning"
        diagnosis = "Ciclo simulado com restrição técnica."
        recommendation = "Acompanhar tendência de pressão, vazão de óleo e perda de carga na mangueira."

    return {
        "id": f"SIM-{len(SIMULATIONS) + 1:04d}",
        "created_at": now_iso(),
        "status": status,
        "diagnosis": diagnosis,
        "recommendation": recommendation,
        "config": payload.model_dump(),
        "metrics": {
            "estimated_time_seconds": final_time,
            "final_real_pressure_mbar": round(timeline[-1]["real_pressure_mbar"], 2),
            "max_collapse_risk_pct": round(max_risk, 2),
            "tank_structural_limit_mbar": tank["structural_limit_mbar"],
            "hose_loss_factor": hose["loss_factor"],
        },
        "traceability": {
            "tank": tank,
            "hose": hose,
            "primary_pump": EQUIPMENT_SPECS["primary_pump"],
            "roots_pump": EQUIPMENT_SPECS["roots_pump"],
            "actions": [
                "Carregamento dos parâmetros",
                "Evacuação inicial",
                "Validação de pressão para Roots",
                "Entrada de óleo",
                "Avaliação de risco estrutural",
                "Fechamento do diagnóstico",
            ],
        },
        "timeline": timeline,
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "TSEA Supervisório Digital", "time": now_iso()}


@app.get("/api/equipment/specs")
def equipment_specs() -> dict[str, Any]:
    return EQUIPMENT_SPECS


@app.get("/api/tanks")
def tanks() -> list[dict[str, Any]]:
    return TANKS


@app.get("/api/hoses")
def hoses() -> list[dict[str, Any]]:
    return HOSES


@app.get("/api/recipes")
def recipes() -> list[dict[str, Any]]:
    return RECIPES


@app.get("/api/operation/state")
def operation_state() -> dict[str, Any]:
    return {**STATE, "tank_states": build_tank_states()}


@app.post("/api/operation/start")
def operation_start(payload: OperationStartPayload) -> dict[str, Any]:
    STATE["cycle"]["status"] = "running"
    STATE["cycle"]["started_at"] = now_iso()
    STATE["cycle"]["operator"] = payload.operator
    STATE["cycle"]["elapsed_seconds"] = 0
    STATE["primary_pump"]["running"] = True
    STATE["roots_pump"]["running"] = False
    STATE["oil_injection"]["enabled"] = True
    STATE["oil_injection"]["target_flow_l_min"] = payload.oil_flow_l_min
    STATE["oil_injection"]["current_flow_l_min"] = payload.oil_flow_l_min

    record = {
        "id": f"OP-{len(OPERATIONS) + 1:04d}",
        "created_at": now_iso(),
        "operator": payload.operator,
        "status": "em_andamento",
        "tank_type": payload.tank_type,
        "hose_id": payload.hose_id,
        "target_pressure_mbar": payload.target_pressure_mbar,
        "final_pressure_mbar": None,
        "config": payload.model_dump(),
    }
    OPERATIONS.insert(0, record)
    return operation_state()


@app.post("/api/operation/tick")
def operation_tick() -> dict[str, Any]:
    if STATE["cycle"]["status"] == "running":
        STATE["cycle"]["elapsed_seconds"] += 12

        tank_states = build_tank_states()
        avg_pressure = sum(t["pressure_mbar"] for t in tank_states) / len(tank_states)

        if avg_pressure <= STATE["roots_pump"]["safe_start_pressure_mbar"]:
            STATE["roots_pump"]["running"] = True

        if avg_pressure <= 8:
            STATE["cycle"]["status"] = "stopped"
            STATE["primary_pump"]["running"] = False
            STATE["roots_pump"]["running"] = False
            for op in OPERATIONS:
                if op["status"] == "em_andamento":
                    op["status"] = "concluido"
                    op["final_pressure_mbar"] = round(avg_pressure, 2)
                    break

    return operation_state()


@app.post("/api/operation/pause")
def operation_pause() -> dict[str, Any]:
    STATE["cycle"]["status"] = "paused"
    STATE["primary_pump"]["running"] = False
    STATE["roots_pump"]["running"] = False
    return operation_state()


@app.post("/api/operation/stop")
def operation_stop() -> dict[str, Any]:
    STATE["cycle"]["status"] = "stopped"
    STATE["primary_pump"]["running"] = False
    STATE["roots_pump"]["running"] = False
    for op in OPERATIONS:
        if op["status"] == "em_andamento":
            op["status"] = "concluido"
            states = build_tank_states()
            op["final_pressure_mbar"] = round(sum(t["pressure_mbar"] for t in states) / len(states), 2)
            break
    return operation_state()


@app.post("/api/operation/reset")
def operation_reset() -> dict[str, Any]:
    STATE["cycle"]["status"] = "stopped"
    STATE["cycle"]["elapsed_seconds"] = 0
    STATE["primary_pump"]["running"] = False
    STATE["roots_pump"]["running"] = False
    STATE["oil_injection"]["enabled"] = False
    STATE["oil_injection"]["current_flow_l_min"] = 0
    return operation_state()


@app.post("/api/operation/emergency")
def operation_emergency() -> dict[str, Any]:
    STATE["cycle"]["status"] = "emergency"
    STATE["primary_pump"]["running"] = False
    STATE["roots_pump"]["running"] = False
    STATE["oil_injection"]["enabled"] = False
    for op in OPERATIONS:
        if op["status"] == "em_andamento":
            op["status"] = "abortado"
            break
    return operation_state()


@app.get("/api/digital-twin/config-options")
def config_options() -> dict[str, Any]:
    return {
        "tank_types": {
            "medio": {"label": "Médio", "volume_liters": 800, "structural_limit_mbar": 40},
            "grande": {"label": "Grande", "volume_liters": 1250, "structural_limit_mbar": 35},
            "extra_grande": {"label": "Extra grande", "volume_liters": 1800, "structural_limit_mbar": 32},
        },
        "hoses": HOSES,
        "recipes": RECIPES,
        "presets": {
            "safe_cycle": {
                "name": "Ciclo operacional seguro",
                "description": "Parâmetros dentro da faixa recomendada para reguladores.",
                "config": {
                    "tank_type": "grande",
                    "hose_id": 1,
                    "target_pressure_mbar": 6.5,
                    "roots_start_pressure_mbar": 50,
                    "oil_flow_l_min": 2.0,
                    "oil_delay_seconds": 0,
                    "pump_health_factor": 1.0,
                    "calibration_factor": 1.0,
                    "hose_correction_enabled": True,
                    "oil_compensation_enabled": True,
                    "simulate_hose_leak": False,
                    "simulate_sensor_failure": False,
                    "simulate_plc_loss": False,
                },
            },
            "low_oil": {
                "name": "Baixa vazão de óleo",
                "description": "Valida impacto de óleo insuficiente na estabilidade do ciclo.",
                "config": {
                    "tank_type": "grande",
                    "hose_id": 2,
                    "target_pressure_mbar": 6.5,
                    "roots_start_pressure_mbar": 50,
                    "oil_flow_l_min": 0.8,
                    "oil_delay_seconds": 80,
                    "pump_health_factor": 0.95,
                    "calibration_factor": 1.0,
                    "hose_correction_enabled": True,
                    "oil_compensation_enabled": True,
                    "simulate_hose_leak": False,
                    "simulate_sensor_failure": False,
                    "simulate_plc_loss": False,
                },
            },
            "hose_loss": {
                "name": "Perda elevada na mangueira",
                "description": "Valida cenário com mangueira longa/restritiva.",
                "config": {
                    "tank_type": "extra_grande",
                    "hose_id": 3,
                    "target_pressure_mbar": 7.5,
                    "roots_start_pressure_mbar": 60,
                    "oil_flow_l_min": 2.2,
                    "oil_delay_seconds": 20,
                    "pump_health_factor": 0.9,
                    "calibration_factor": 1.0,
                    "hose_correction_enabled": True,
                    "oil_compensation_enabled": True,
                    "simulate_hose_leak": True,
                    "simulate_sensor_failure": False,
                    "simulate_plc_loss": False,
                },
            },
            "sensor_fault": {
                "name": "Falha de sensor",
                "description": "Valida comportamento do diagnóstico com leitura comprometida.",
                "config": {
                    "tank_type": "grande",
                    "hose_id": 1,
                    "target_pressure_mbar": 6.5,
                    "roots_start_pressure_mbar": 50,
                    "oil_flow_l_min": 2.0,
                    "oil_delay_seconds": 0,
                    "pump_health_factor": 0.85,
                    "calibration_factor": 1.0,
                    "hose_correction_enabled": True,
                    "oil_compensation_enabled": True,
                    "simulate_hose_leak": False,
                    "simulate_sensor_failure": True,
                    "simulate_plc_loss": False,
                },
            },
        },
    }


@app.post("/api/digital-twin/simulate")
def digital_twin_simulate(payload: SimulationPayload) -> dict[str, Any]:
    return simulate(payload)


@app.get("/api/records/operations")
def records_operations() -> dict[str, Any]:
    return {"items": OPERATIONS}


@app.get("/api/records/operations/{operation_id}")
def record_operation_detail(operation_id: str) -> dict[str, Any]:
    record = next((item for item in OPERATIONS if item["id"] == operation_id), None)
    if not record:
        record = {"id": operation_id, "status": "indisponivel"}
    config = record.get("config", {})
    sim = simulate(SimulationPayload(**{k: v for k, v in config.items() if k in SimulationPayload.model_fields}))
    return {"record": record, "result": sim, "chart": sim["timeline"]}


@app.post("/api/records/operations/{operation_id}/resimulate")
def record_operation_resimulate(operation_id: str) -> dict[str, Any]:
    return record_operation_detail(operation_id)


@app.get("/api/records/simulations")
def records_simulations() -> dict[str, Any]:
    return {"items": SIMULATIONS}


@app.post("/api/records/simulations")
def create_simulation_record(payload: SimulationRecordPayload) -> dict[str, Any]:
    sim = simulate(SimulationPayload(**payload.config))
    record = {
        "id": sim["id"],
        "created_at": sim["created_at"],
        "name": payload.name,
        "status": sim["status"],
        "tank_type": payload.config.get("tank_type", "grande"),
        "hose_id": payload.config.get("hose_id", 1),
        "max_collapse_risk_pct": sim["metrics"]["max_collapse_risk_pct"],
        "config": payload.config,
        "result": sim,
    }
    SIMULATIONS.insert(0, record)
    return record


@app.get("/api/records/simulations/{simulation_id}")
def record_simulation_detail(simulation_id: str) -> dict[str, Any]:
    record = next((item for item in SIMULATIONS if item["id"] == simulation_id), None)
    if not record:
        record = {"id": simulation_id, "status": "indisponivel", "result": None}
    result = record.get("result") or {}
    return {"record": record, "result": result, "chart": result.get("timeline", [])}


@app.post("/api/records/simulations/{simulation_id}/resimulate")
def record_simulation_resimulate(simulation_id: str) -> dict[str, Any]:
    detail = record_simulation_detail(simulation_id)
    config = detail["record"].get("config", {})
    return simulate(SimulationPayload(**config))


@app.post("/api/records/simulations/{simulation_id}/convert-to-operation")
def convert_simulation_to_operation(simulation_id: str) -> dict[str, Any]:
    detail = record_simulation_detail(simulation_id)
    config = detail["record"].get("config", {})
    payload = OperationStartPayload(
        operator="Operador TSEA",
        tank_type=config.get("tank_type", "grande"),
        hose_id=config.get("hose_id", 1),
        target_pressure_mbar=config.get("target_pressure_mbar", 6.5),
        roots_start_pressure_mbar=config.get("roots_start_pressure_mbar", 50),
        oil_flow_l_min=config.get("oil_flow_l_min", 2.0),
    )
    return operation_start(payload)


@app.get("/api/reports/operational")
def reports_operational() -> dict[str, Any]:
    states = build_tank_states()
    avg_pressure = round(sum(t["pressure_mbar"] for t in states) / len(states), 2)
    return {
        "title": "Relatório Operacional TSEA",
        "generated_at": now_iso(),
        "cycles_count": len(OPERATIONS),
        "simulations_count": len(SIMULATIONS),
        "alarms_count": len([a for a in alarms() if a["severity"] != "success"]),
        "average_recent_pressure_mbar": avg_pressure,
        "equipment": EQUIPMENT_SPECS,
    }


@app.get("/api/alarms")
def alarms() -> list[dict[str, Any]]:
    states = build_tank_states()
    alarms_list = []
    for item in states:
        risk = item["collapse_risk_pct"]
        if risk >= 82:
            alarms_list.append({"code": f"ALM-{item['tank']['code']}", "severity": "critical", "message": "Risco estrutural elevado no tanque."})
        elif risk >= 65:
            alarms_list.append({"code": f"ALM-{item['tank']['code']}", "severity": "warning", "message": "Tendência de risco operacional."})

    if not alarms_list:
        alarms_list.append({"code": "SYS-OK", "severity": "success", "message": "Sistema operacional sem alarmes críticos."})

    return alarms_list


@app.get("/api/maintenance/prediction")
def maintenance_prediction() -> list[dict[str, Any]]:
    return [
        {"asset_code": "SV 630 B", "risk_score": 18, "remaining_hours": 420, "recommendation": "Acompanhar óleo, ruído e temperatura."},
        {"asset_code": "WSU 2001", "risk_score": 24, "remaining_hours": 360, "recommendation": "Verificar intertravamento e diferencial de pressão."},
        {"asset_code": "MG-VAC-18M-C", "risk_score": 41, "remaining_hours": 180, "recommendation": "Inspecionar vedação e perda de carga."},
    ]


# TSEA_BACKEND_SIMULATION_FALLBACK_START
from fastapi import Body as _TSEA_Body
from datetime import datetime as _TSEA_datetime
import math as _TSEA_math

_TSEA_SIMULATIONS_MEMORY = []

def _tsea_simulate_cycle(payload: dict):
    hose_factor = float(payload.get("hose_loss_factor", payload.get("loss_factor", 0.85)))
    oil_flow = float(payload.get("oil_flow_l_min", 2.0))
    oil_delay = float(payload.get("oil_delay_seconds", 0))
    pump_health = float(payload.get("pump_health_factor", 1.0))
    target = float(payload.get("target_pressure_mbar", 6.5))
    max_cycle = float(payload.get("max_cycle_seconds", 900))

    risk = max(4, min(98, 18 + hose_factor * 14 + max(0, 2 - oil_flow) * 16 + oil_delay * 0.18 + max(0, 1 - pump_health) * 42))
    estimated = min(max_cycle, 430 + hose_factor * 45 + oil_delay * 1.6 + (1 - pump_health) * 180)
    final_pressure = max(target, target + hose_factor * 0.7 + max(0, 2 - oil_flow) * 1.8)

    status = "critical" if risk >= 82 else "warning" if risk >= 65 else "success"

    diagnosis = (
        "Simulação aprovada. O ciclo mantém margem operacional aceitável."
        if status == "success"
        else "Simulação aprovada com restrição. Existe tendência de perda, atraso ou redução de margem."
        if status == "warning"
        else "Simulação reprovada. O ciclo apresenta risco elevado e não deve ser liberado sem revisão."
    )

    recommendation = (
        "Manter parâmetros e registrar o cenário como referência operacional."
        if status == "success"
        else "Revisar mangueira, vazão de óleo, sensores e condição das bombas antes da execução real."
        if status == "warning"
        else "Bloquear execução, revisar vedação, mangueira, bomba secundária, sensores e limites estruturais."
    )

    timeline = []
    for i in range(18):
        step = i / 17
        pressure = max(final_pressure, 1000 * _TSEA_math.exp(-step * 5.5) + final_pressure)
        timeline.append({
            "second": round(step * estimated),
            "pressure_mbar": pressure,
            "real_pressure_mbar": pressure + hose_factor * step * 2.2,
            "expected_pressure_mbar": max(final_pressure, pressure * 0.93),
            "effective_pressure_mbar": final_pressure + risk * step * 0.18,
            "collapse_risk_pct": round(risk * step),
            "hose_loss_mbar": hose_factor,
        })

    result = {
        "id": f"SIM-{int(_TSEA_datetime.now().timestamp())}",
        "created_at": _TSEA_datetime.now().isoformat(),
        "scenario": payload.get("name", "Simulação operacional"),
        "status": status,
        "diagnosis": diagnosis,
        "recommendation": recommendation,
        "config": payload,
        "metrics": {
            "estimated_time_seconds": round(estimated),
            "final_real_pressure_mbar": final_pressure,
            "max_collapse_risk_pct": risk,
            "oil_flow_l_min": oil_flow,
            "hose_loss_factor": hose_factor,
        },
        "timeline": timeline,
    }

    _TSEA_SIMULATIONS_MEMORY.insert(0, result)
    return result

try:
    app.router.routes = [
        route for route in app.router.routes
        if getattr(route, "path", "") not in [
            "/api/digital-twin/simulate-safe",
            "/api/records/simulations-safe"
        ]
    ]
except Exception:
    pass

@app.post("/api/digital-twin/simulate-safe")
def tsea_digital_twin_simulate_safe(payload: dict = _TSEA_Body(default={})):
    return _tsea_simulate_cycle(payload or {})

@app.get("/api/records/simulations-safe")
def tsea_records_simulations_safe():
    return {"items": _TSEA_SIMULATIONS_MEMORY}
# TSEA_BACKEND_SIMULATION_FALLBACK_END

# TSEA_PLC_KIT_IOT_START
# Integração física simplificada para bancada SENAI / Kit IoT / ESP32.
# Configure a variável de ambiente TSEA_PLC_BASE_URL com o IP do kit:
# Exemplo PowerShell:
# $env:TSEA_PLC_BASE_URL="http://192.168.0.50"

import os as _tsea_os
import time as _tsea_time
import json as _tsea_json
import urllib.request as _tsea_urllib_request
import urllib.error as _tsea_urllib_error

_tsea_plc_state = {
    "running": False,
    "finished": False,
    "emergency": False,
    "motor1_on": False,
    "motor2_on": False,
    "green_light": False,
    "yellow_light": False,
    "red_light": False,
    "alarm_on": False,
    "pressure_actual": 1000.0,
    "pressure_target": 10.0,
    "motor2_start_pressure": 50.0,
    "cycle_time": 0,
    "system_state": 0,
    "status": "Parado",
    "risk_percent": 0.0,
    "source": "simulado_backend",
    "_last_tick": _tsea_time.time(),
}

def _tsea_plc_tick():
    now = _tsea_time.time()
    elapsed = now - float(_tsea_plc_state.get("_last_tick", now))

    if elapsed < 1:
        return

    _tsea_plc_state["_last_tick"] = now

    if not _tsea_plc_state["running"] or _tsea_plc_state["finished"] or _tsea_plc_state["emergency"]:
        return

    _tsea_plc_state["cycle_time"] = int(_tsea_plc_state.get("cycle_time", 0)) + int(elapsed)

    _tsea_plc_state["motor1_on"] = True
    _tsea_plc_state["green_light"] = True
    _tsea_plc_state["yellow_light"] = False
    _tsea_plc_state["red_light"] = False
    _tsea_plc_state["alarm_on"] = False
    _tsea_plc_state["status"] = "Operacional"
    _tsea_plc_state["system_state"] = 1

    if float(_tsea_plc_state["pressure_actual"]) <= float(_tsea_plc_state["motor2_start_pressure"]):
        _tsea_plc_state["motor2_on"] = True
        _tsea_plc_state["system_state"] = 2

    if _tsea_plc_state["motor1_on"] and not _tsea_plc_state["motor2_on"]:
        _tsea_plc_state["pressure_actual"] = float(_tsea_plc_state["pressure_actual"]) - (12.0 * elapsed)

    if _tsea_plc_state["motor1_on"] and _tsea_plc_state["motor2_on"]:
        _tsea_plc_state["pressure_actual"] = float(_tsea_plc_state["pressure_actual"]) - (37.0 * elapsed)

    if float(_tsea_plc_state["pressure_actual"]) <= float(_tsea_plc_state["pressure_target"]):
        _tsea_plc_state["pressure_actual"] = float(_tsea_plc_state["pressure_target"])
        _tsea_plc_state["running"] = False
        _tsea_plc_state["finished"] = True
        _tsea_plc_state["motor1_on"] = False
        _tsea_plc_state["motor2_on"] = False
        _tsea_plc_state["green_light"] = True
        _tsea_plc_state["yellow_light"] = False
        _tsea_plc_state["red_light"] = False
        _tsea_plc_state["alarm_on"] = False
        _tsea_plc_state["status"] = "Finalizado"
        _tsea_plc_state["system_state"] = 3
        _tsea_plc_state["risk_percent"] = 0.0

def _tsea_plc_external_call(action: str):
    base_url = _tsea_os.getenv("TSEA_PLC_BASE_URL", "").strip().rstrip("/")

    if not base_url:
        return None

    endpoint = f"{base_url}/{action}"

    try:
        with _tsea_urllib_request.urlopen(endpoint, timeout=3) as response:
            raw = response.read().decode("utf-8")
            data = _tsea_json.loads(raw)
            if isinstance(data, dict):
                data["source"] = "kit_iot"
            return data
    except Exception as exc:
        return {
            "source": "kit_iot_indisponivel",
            "error": str(exc),
            "fallback": True,
            **{k: v for k, v in _tsea_plc_state.items() if not k.startswith("_")},
        }

def _tsea_plc_local_action(action: str):
    _tsea_plc_tick()

    if action == "start":
        _tsea_plc_state["running"] = True
        _tsea_plc_state["finished"] = False
        _tsea_plc_state["emergency"] = False
        _tsea_plc_state["motor1_on"] = True
        _tsea_plc_state["motor2_on"] = False
        _tsea_plc_state["green_light"] = True
        _tsea_plc_state["yellow_light"] = False
        _tsea_plc_state["red_light"] = False
        _tsea_plc_state["alarm_on"] = False
        _tsea_plc_state["status"] = "Operacional"
        _tsea_plc_state["system_state"] = 1
        _tsea_plc_state["_last_tick"] = _tsea_time.time()

    elif action == "stop":
        _tsea_plc_state["running"] = False
        _tsea_plc_state["motor1_on"] = False
        _tsea_plc_state["motor2_on"] = False
        _tsea_plc_state["green_light"] = False
        _tsea_plc_state["yellow_light"] = False
        _tsea_plc_state["red_light"] = False
        _tsea_plc_state["alarm_on"] = False
        _tsea_plc_state["status"] = "Parado"
        _tsea_plc_state["system_state"] = 0

    elif action == "reset":
        _tsea_plc_state.update({
            "running": False,
            "finished": False,
            "emergency": False,
            "motor1_on": False,
            "motor2_on": False,
            "green_light": False,
            "yellow_light": False,
            "red_light": False,
            "alarm_on": False,
            "pressure_actual": 1000.0,
            "cycle_time": 0,
            "system_state": 0,
            "status": "Parado",
            "risk_percent": 0.0,
            "_last_tick": _tsea_time.time(),
        })

    elif action == "emergency":
        _tsea_plc_state["running"] = False
        _tsea_plc_state["emergency"] = True
        _tsea_plc_state["motor1_on"] = False
        _tsea_plc_state["motor2_on"] = False
        _tsea_plc_state["green_light"] = False
        _tsea_plc_state["yellow_light"] = False
        _tsea_plc_state["red_light"] = True
        _tsea_plc_state["alarm_on"] = True
        _tsea_plc_state["status"] = "Crítico"
        _tsea_plc_state["system_state"] = 5
        _tsea_plc_state["risk_percent"] = 100.0

    return {k: v for k, v in _tsea_plc_state.items() if not k.startswith("_")}

def _tsea_plc_action(action: str):
    external = _tsea_plc_external_call(action)
    if external is not None and not external.get("fallback"):
        return external
    local = _tsea_plc_local_action(action)
    if external is not None and external.get("fallback"):
        local["kit_iot_error"] = external.get("error")
    return local

@app.get("/api/plc/status")
def tsea_plc_status():
    external = _tsea_plc_external_call("status")
    if external is not None and not external.get("fallback"):
        return external

    _tsea_plc_tick()
    local = {k: v for k, v in _tsea_plc_state.items() if not k.startswith("_")}
    if external is not None and external.get("fallback"):
        local["kit_iot_error"] = external.get("error")
    return local

@app.post("/api/plc/start")
def tsea_plc_start():
    return _tsea_plc_action("start")

@app.post("/api/plc/stop")
def tsea_plc_stop():
    return _tsea_plc_action("stop")

@app.post("/api/plc/reset")
def tsea_plc_reset():
    return _tsea_plc_action("reset")

@app.post("/api/plc/emergency")
def tsea_plc_emergency():
    return _tsea_plc_action("emergency")

@app.get("/api/technical/margin-rules")
def tsea_margin_rules():
    return {
        "formula": "desvio_percentual = abs(valor_medido - valor_esperado) / valor_esperado * 100",
        "rules": [
            {
                "status": "Operacional",
                "color": "verde",
                "condition": "desvio <= margem_permitida",
                "description": "Valor dentro da tolerância definida."
            },
            {
                "status": "Atenção",
                "color": "amarelo",
                "condition": "margem_permitida < desvio <= 2 * margem_permitida",
                "description": "Valor fora da margem, mas ainda em faixa de verificação."
            },
            {
                "status": "Crítico",
                "color": "vermelho",
                "condition": "desvio > 2 * margem_permitida",
                "description": "Valor fora do limite aceitável."
            }
        ],
        "general_status_rule": "Se qualquer parâmetro essencial estiver crítico, o status geral deve ser crítico."
    }

@app.get("/api/technical/evaluate-margin")
def tsea_evaluate_margin(expected: float, measured: float, margin: float = 5.0):
    if expected == 0:
        return {
            "expected": expected,
            "measured": measured,
            "margin": margin,
            "deviation_percent": 0,
            "status": "Indefinido",
            "message": "Valor esperado igual a zero não permite cálculo percentual."
        }

    deviation = abs(measured - expected) / abs(expected) * 100

    if deviation <= margin:
        status = "Operacional"
        color = "verde"
    elif deviation <= margin * 2:
        status = "Atenção"
        color = "amarelo"
    else:
        status = "Crítico"
        color = "vermelho"

    return {
        "expected": expected,
        "measured": measured,
        "margin": margin,
        "deviation_percent": round(deviation, 2),
        "status": status,
        "color": color
    }

@app.get("/api/technical/event-markers")
def tsea_event_markers():
    return {
        "markers": [
            {
                "event": "Bomba primária ligada",
                "condition": "início do ciclo",
                "visual": "marcador no início da curva"
            },
            {
                "event": "Bomba secundária ligada",
                "condition": "pressão <= pressão de acionamento",
                "visual": "marcador no ponto de entrada da segunda bomba"
            },
            {
                "event": "Óleo iniciado",
                "condition": "tempo >= atraso do óleo",
                "visual": "marcador na curva de vácuo"
            },
            {
                "event": "Risco detectado",
                "condition": "risco operacional acima do limite configurado",
                "visual": "marcador crítico"
            },
            {
                "event": "Pressão alvo atingida",
                "condition": "pressão atual <= pressão final desejada",
                "visual": "marcador de conclusão"
            }
        ]
    }
# TSEA_PLC_KIT_IOT_END

