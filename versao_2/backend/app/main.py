from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(
    title="TSEA V-Twin - Protótipo Físico",
    version="2.0.0",
    description="API reduzida para demonstração física com 1 câmara, 1 bomba, 1 sensor, 1 mangueira e 1 lâmpada/B2 simulada.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


TANKS = [
    {
        "id": 1,
        "code": "PANELA-01",
        "type": "camara_prototipo",
        "description": "Câmara/tanque de demonstração do protótipo físico",
        "volume_liters": 6,
        "structural_limit_mbar": 120,
        "status": "available",
    }
]

HOSES = [
    {
        "id": 1,
        "code": "MG-PROT-01",
        "length_m": 2.0,
        "diameter_in": 0.375,
        "diameter_mm": 10,
        "loss_factor": 0.35,
        "status": "available",
    }
]

RECIPES = [
    {
        "id": 1,
        "name": "Protótipo físico - ciclo de bancada",
        "tank_type": "camara_prototipo",
        "target_pressure_mbar": 6.5,
        "roots_start_pressure_mbar": 80,
        "max_cycle_seconds": 120,
        "sample_interval_seconds": 3,
    }
]

EQUIPMENT_SPECS = {
    "primary_pump": {
        "code": "B1-PROT",
        "model": "Mini bomba de vácuo do protótipo",
        "technology": "Bomba de vácuo demonstrativa de bancada",
        "role": "Evacuação da câmara/tanque de demonstração.",
        "nominal_speed_50hz_m3_h": 1,
        "nominal_speed_60hz_m3_h": 1,
        "ultimate_pressure_no_gas_ballast_mbar": 6.5,
        "motor_power_kw": 0.12,
    },
    "roots_pump": {
        "code": "B2-LAMP",
        "model": "Lâmpada industrial simulando B2/Roots",
        "technology": "Sinalização/atuador demonstrativo",
        "role": "Representa o acionamento automático da segunda bomba quando a pressão atinge o limite configurado.",
        "safe_start_pressure_mbar": 80,
    },
    "sensor": {
        "code": "SP-PROT-01",
        "model": "Sensor de pressão/vácuo do protótipo",
        "technology": "Sensor demonstrativo conectado ao PLC/kit IoT",
        "role": "Mede a pressão da câmara/tanque de demonstração.",
    },
    "hose": {
        "code": "MG-PROT-01",
        "model": "Mangueira de bancada",
        "role": "Conecta a bomba à câmara/tanque de demonstração.",
    },
}


STATE: dict[str, Any] = {
    "cycle": {
        "id": "OP-PROT-0001",
        "status": "stopped",
        "started_at": None,
        "operator": "Operador 01",
        "elapsed_seconds": 0,
        "sample_interval_seconds": 3,
    },
    "primary_pump": {
        "model": EQUIPMENT_SPECS["primary_pump"]["model"],
        "code": EQUIPMENT_SPECS["primary_pump"]["code"],
        "running": False,
        "blocked": False,
        "health_pct": 100,
        "connection": "connected",
    },
    "roots_pump": {
        "model": EQUIPMENT_SPECS["roots_pump"]["model"],
        "code": EQUIPMENT_SPECS["roots_pump"]["code"],
        "running": False,
        "blocked": False,
        "safe_start_pressure_mbar": 80,
        "health_pct": 100,
        "connection": "waiting",
    },
    "sensor": {
        "code": EQUIPMENT_SPECS["sensor"]["code"],
        "pressure_mbar": 1013.0,
        "connection": "connected",
        "status": "available",
    },
    "plc_comm_ok": True,
    "tower_light": "green",
    "emergency_active": False,
    "ramp_samples": [],
    "logs": [],
}

OPERATIONS: list[dict[str, Any]] = []
SIMULATIONS: list[dict[str, Any]] = []


class OperationStartPayload(BaseModel):
    operator: str = "Operador 01"
    tank_id: int | str | None = 1
    hose_id: int | str | None = 1
    recipe_id: int | str | None = 1
    target_pressure_mbar: float = 6.5
    roots_start_pressure_mbar: float = 80
    max_cycle_seconds: int = 120
    tank_type: str = "camara_prototipo"
    notes: str = ""


class SimulationPayload(BaseModel):
    tank_type: str = "camara_prototipo"
    hose_id: int | str = 1
    target_pressure_mbar: float = 6.5
    roots_start_pressure_mbar: float = 80
    max_cycle_seconds: int = 120
    pump_health_factor: float = 1.0
    calibration_factor: float = 1.0
    hose_correction_enabled: bool = True
    simulate_hose_leak: bool = False
    simulate_sensor_failure: bool = False
    simulate_plc_loss: bool = False


class SimulationRecordPayload(BaseModel):
    name: str = "Simulação do protótipo físico"
    config: dict[str, Any]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def add_log(kind: str, message: str) -> None:
    STATE["logs"].insert(
        0,
        {
            "id": f"LOG-{len(STATE['logs']) + 1:04d}",
            "created_at": now_iso(),
            "type": kind,
            "message": message,
        },
    )


def get_hose(hose_id: int | str) -> dict[str, Any]:
    return HOSES[0]


def get_tank_by_type(tank_type: str) -> dict[str, Any]:
    return TANKS[0]


def hose_loss_mbar() -> float:
    hose = HOSES[0]
    length = float(hose.get("length_m", 2.0))
    diameter_mm = float(hose.get("diameter_mm", 10))
    factor = float(hose.get("loss_factor", 0.35))
    return round((length / max(diameter_mm, 1)) * factor * 10, 2)


def sensor_pressure(elapsed: int) -> float:
    if STATE["cycle"]["status"] != "running":
        return float(STATE["sensor"].get("pressure_mbar", 1013.0))

    target = RECIPES[0]["target_pressure_mbar"]
    pressure = 1013.0 * math.exp(-elapsed / 18)
    return round(max(target, pressure), 2)


def build_tank_states() -> list[dict[str, Any]]:
    elapsed = int(STATE["cycle"]["elapsed_seconds"])
    pressure = sensor_pressure(elapsed)
    loss = hose_loss_mbar()
    effective_pressure = round(max(0.5, pressure - loss), 2)

    if pressure <= STATE["roots_pump"]["safe_start_pressure_mbar"]:
        status_light = "yellow" if STATE["cycle"]["status"] == "running" else "green"
    else:
        status_light = "green"

    if STATE["emergency_active"]:
        status_light = "red"

    STATE["sensor"]["pressure_mbar"] = pressure
    STATE["tower_light"] = status_light

    return [
        {
            "tank": TANKS[0],
            "hose": HOSES[0],
            "sensor": STATE["sensor"],
            "pressure_mbar": pressure,
            "expected_pressure_mbar": RECIPES[0]["target_pressure_mbar"],
            "effective_pressure_mbar": effective_pressure,
            "hose_loss_mbar": loss,
            "collapse_risk_pct": 0,
            "status_light": status_light,
        }
    ]


def maybe_sample_ramp() -> None:
    elapsed = int(STATE["cycle"]["elapsed_seconds"])
    interval = int(STATE["cycle"].get("sample_interval_seconds", 3))

    if STATE["cycle"]["status"] != "running":
        return

    if elapsed <= 0 or elapsed % interval != 0:
        return

    states = build_tank_states()
    item = states[0]

    STATE["ramp_samples"].append(
        {
            "time_seconds": elapsed,
            "pressure_mbar": item["pressure_mbar"],
            "real_pressure_mbar": item["pressure_mbar"],
            "expected_pressure_mbar": item["expected_pressure_mbar"],
            "effective_pressure_mbar": item["effective_pressure_mbar"],
            "hose_loss_mbar": item["hose_loss_mbar"],
            "primary_pump_running": STATE["primary_pump"]["running"],
            "b2_lamp_running": STATE["roots_pump"]["running"],
            "status": STATE["cycle"]["status"],
        }
    )


def simulate(payload: SimulationPayload) -> dict[str, Any]:
    pressure = 1013.0
    target = max(0.5, payload.target_pressure_mbar)
    timeline = []
    roots_on = False
    loss = hose_loss_mbar()

    for t in range(0, payload.max_cycle_seconds + 1, 3):
        if pressure <= payload.roots_start_pressure_mbar:
            roots_on = True

        decay = 18 / max(payload.pump_health_factor, 0.2)
        if payload.simulate_hose_leak:
            decay *= 1.45
        if payload.simulate_sensor_failure:
            pressure += 4
        if payload.simulate_plc_loss:
            roots_on = False

        pressure = max(target, 1013.0 * math.exp(-t / decay))
        effective = max(0.5, pressure - loss)

        timeline.append(
            {
                "time_seconds": t,
                "pressure_mbar": round(pressure, 2),
                "real_pressure_mbar": round(pressure, 2),
                "expected_pressure_mbar": target,
                "effective_pressure_mbar": round(effective, 2),
                "hose_loss_mbar": loss,
                "roots_on": roots_on,
            }
        )

        if pressure <= target * 1.05:
            break

    status = "success"
    diagnosis = "Simulação compatível com o protótipo físico."
    recommendation = "Executar ciclo, registrar rampa e validar leitura do sensor."

    if payload.simulate_sensor_failure or payload.simulate_plc_loss:
        status = "critical"
        diagnosis = "Falha simulada de sensor ou comunicação com PLC."
        recommendation = "Bloquear ciclo e verificar conexão antes da operação."
    elif payload.simulate_hose_leak:
        status = "warning"
        diagnosis = "Tendência de perda na mangueira."
        recommendation = "Verificar vedação e repetir teste."

    return {
        "id": f"SIM-PROT-{len(SIMULATIONS) + 1:04d}",
        "created_at": now_iso(),
        "status": status,
        "diagnosis": diagnosis,
        "recommendation": recommendation,
        "config": payload.model_dump(),
        "metrics": {
            "estimated_time_seconds": timeline[-1]["time_seconds"],
            "final_real_pressure_mbar": timeline[-1]["real_pressure_mbar"],
            "hose_loss_mbar": loss,
            "sample_interval_seconds": 3,
        },
        "traceability": {
            "tank": TANKS[0],
            "hose": HOSES[0],
            "primary_pump": EQUIPMENT_SPECS["primary_pump"],
            "b2_lamp": EQUIPMENT_SPECS["roots_pump"],
            "sensor": EQUIPMENT_SPECS["sensor"],
            "actions": [
                "Preparação do protótipo",
                "Ligação da bomba B1",
                "Leitura do sensor",
                "Cálculo da pressão estimada na câmara",
                "Acionamento da lâmpada/B2 simulada",
                "Registro da rampa de 3 em 3 segundos",
            ],
        },
        "timeline": timeline,
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "TSEA V-Twin - Protótipo Físico", "time": now_iso()}


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
    STATE["cycle"]["id"] = f"OP-PROT-{len(OPERATIONS) + 1:04d}"
    STATE["cycle"]["status"] = "running"
    STATE["cycle"]["started_at"] = now_iso()
    STATE["cycle"]["operator"] = payload.operator
    STATE["cycle"]["elapsed_seconds"] = 0
    STATE["cycle"]["sample_interval_seconds"] = 3

    STATE["primary_pump"]["running"] = True
    STATE["primary_pump"]["blocked"] = False
    STATE["roots_pump"]["running"] = False
    STATE["roots_pump"]["blocked"] = False
    STATE["roots_pump"]["safe_start_pressure_mbar"] = payload.roots_start_pressure_mbar
    STATE["emergency_active"] = False
    STATE["ramp_samples"] = []
    STATE["logs"] = []

    record = {
        "id": STATE["cycle"]["id"],
        "created_at": now_iso(),
        "operator": payload.operator,
        "status": "em_andamento",
        "tank_type": "camara_prototipo",
        "tank_id": 1,
        "hose_id": 1,
        "target_pressure_mbar": payload.target_pressure_mbar,
        "final_pressure_mbar": None,
        "config": payload.model_dump(),
    }

    OPERATIONS.insert(0, record)
    add_log("Operação", "Ciclo iniciado no protótipo físico. Bomba B1 ligada.")
    return operation_state()


@app.post("/api/operation/tick")
def operation_tick() -> dict[str, Any]:
    if STATE["cycle"]["status"] == "running":
        STATE["cycle"]["elapsed_seconds"] += 3

        states = build_tank_states()
        pressure = states[0]["pressure_mbar"]

        if pressure <= STATE["roots_pump"]["safe_start_pressure_mbar"] and not STATE["roots_pump"]["running"]:
            STATE["roots_pump"]["running"] = True
            STATE["roots_pump"]["connection"] = "connected"
            add_log("Automação", "Lâmpada/B2 simulada acionada pelo limite de pressão.")

        maybe_sample_ramp()

        if pressure <= RECIPES[0]["target_pressure_mbar"] * 1.05:
            STATE["cycle"]["status"] = "stopped"
            STATE["primary_pump"]["running"] = False
            STATE["roots_pump"]["running"] = False

            for op in OPERATIONS:
                if op["status"] == "em_andamento":
                    op["status"] = "concluido"
                    op["final_pressure_mbar"] = round(pressure, 2)
                    op["ramp_samples"] = STATE["ramp_samples"]
                    op["logs"] = STATE["logs"]
                    break

            add_log("Operação", "Ciclo finalizado automaticamente após atingir a pressão alvo.")

    return operation_state()


@app.post("/api/operation/pause")
def operation_pause() -> dict[str, Any]:
    STATE["cycle"]["status"] = "paused"
    STATE["primary_pump"]["running"] = False
    STATE["roots_pump"]["running"] = False
    add_log("Operação", "Ciclo pausado pelo operador.")
    return operation_state()


@app.post("/api/operation/stop")
def operation_stop() -> dict[str, Any]:
    STATE["cycle"]["status"] = "stopped"
    STATE["primary_pump"]["running"] = False
    STATE["roots_pump"]["running"] = False

    for op in OPERATIONS:
        if op["status"] == "em_andamento":
            op["status"] = "concluido"
            op["final_pressure_mbar"] = build_tank_states()[0]["pressure_mbar"]
            op["ramp_samples"] = STATE["ramp_samples"]
            op["logs"] = STATE["logs"]
            break

    add_log("Operação", "Ciclo encerrado e salvo.")
    return operation_state()


@app.post("/api/operation/reset")
def operation_reset() -> dict[str, Any]:
    STATE["cycle"]["status"] = "stopped"
    STATE["cycle"]["elapsed_seconds"] = 0
    STATE["primary_pump"]["running"] = False
    STATE["roots_pump"]["running"] = False
    STATE["sensor"]["pressure_mbar"] = 1013.0
    STATE["tower_light"] = "green"
    STATE["emergency_active"] = False
    STATE["ramp_samples"] = []
    STATE["logs"] = []
    return operation_state()


@app.post("/api/operation/emergency")
def operation_emergency() -> dict[str, Any]:
    STATE["cycle"]["status"] = "emergency"
    STATE["primary_pump"]["running"] = False
    STATE["primary_pump"]["blocked"] = True
    STATE["roots_pump"]["running"] = False
    STATE["roots_pump"]["blocked"] = True
    STATE["tower_light"] = "red"
    STATE["emergency_active"] = True

    for op in OPERATIONS:
        if op["status"] == "em_andamento":
            op["status"] = "abortado"
            op["ramp_samples"] = STATE["ramp_samples"]
            op["logs"] = STATE["logs"]
            break

    add_log("Emergência", "Parada de emergência acionada. Bomba e B2 simulada bloqueadas.")
    return operation_state()


@app.get("/api/digital-twin/config-options")
def config_options() -> dict[str, Any]:
    return {
        "tank_types": {
            "camara_prototipo": {
                "label": "Câmara do protótipo",
                "volume_liters": TANKS[0]["volume_liters"],
                "structural_limit_mbar": TANKS[0]["structural_limit_mbar"],
            }
        },
        "hoses": HOSES,
        "recipes": RECIPES,
        "presets": {
            "physical_demo": {
                "name": "Demonstração física limpa",
                "description": "Ciclo com 1 câmara, 1 bomba, 1 sensor, 1 mangueira e B2 simulada por lâmpada.",
                "config": {
                    "tank_type": "camara_prototipo",
                    "hose_id": 1,
                    "target_pressure_mbar": 6.5,
                    "roots_start_pressure_mbar": 80,
                    "max_cycle_seconds": 120,
                    "pump_health_factor": 1.0,
                    "calibration_factor": 1.0,
                    "hose_correction_enabled": True,
                    "simulate_hose_leak": False,
                    "simulate_sensor_failure": False,
                    "simulate_plc_loss": False,
                },
            }
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
        record = {"id": operation_id, "status": "indisponivel", "ramp_samples": [], "logs": []}

    chart = record.get("ramp_samples") or STATE["ramp_samples"]
    return {"record": record, "result": {"timeline": chart}, "chart": chart}


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
        "tank_type": "camara_prototipo",
        "hose_id": 1,
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
    return operation_start(OperationStartPayload())


@app.get("/api/reports/operational")
def reports_operational() -> dict[str, Any]:
    states = build_tank_states()
    return {
        "title": "Relatório Operacional - Protótipo Físico",
        "generated_at": now_iso(),
        "cycles_count": len(OPERATIONS),
        "simulations_count": len(SIMULATIONS),
        "alarms_count": len([a for a in alarms() if a["severity"] != "success"]),
        "average_recent_pressure_mbar": states[0]["pressure_mbar"],
        "equipment": EQUIPMENT_SPECS,
    }


@app.get("/api/alarms")
def alarms() -> list[dict[str, Any]]:
    if STATE["emergency_active"]:
        return [{"code": "EMG-PROT", "severity": "critical", "message": "Emergência acionada no protótipo físico."}]

    if not STATE["plc_comm_ok"]:
        return [{"code": "PLC-PROT", "severity": "warning", "message": "Comunicação com PLC/kit IoT em atenção."}]

    return [{"code": "SYS-OK", "severity": "success", "message": "Protótipo físico sem alarmes críticos."}]


@app.get("/api/maintenance/prediction")
def maintenance_prediction() -> list[dict[str, Any]]:
    return [
        {
            "asset_code": "B1-PROT",
            "risk_score": 0,
            "remaining_hours": 999,
            "recommendation": "Protótipo limpo. Registrar horas após início dos testes físicos.",
        },
        {
            "asset_code": "MG-PROT-01",
            "risk_score": 0,
            "remaining_hours": 999,
            "recommendation": "Mangueira única cadastrada para demonstração.",
        },
        {
            "asset_code": "SP-PROT-01",
            "risk_score": 0,
            "remaining_hours": 999,
            "recommendation": "Sensor único cadastrado para demonstração.",
        },
    ]


@app.post("/api/admin/clear")
def admin_clear() -> dict[str, Any]:
    OPERATIONS.clear()
    SIMULATIONS.clear()
    STATE["cycle"]["status"] = "stopped"
    STATE["cycle"]["elapsed_seconds"] = 0
    STATE["primary_pump"]["running"] = False
    STATE["primary_pump"]["blocked"] = False
    STATE["roots_pump"]["running"] = False
    STATE["roots_pump"]["blocked"] = False
    STATE["sensor"]["pressure_mbar"] = 1013.0
    STATE["ramp_samples"] = []
    STATE["logs"] = []
    STATE["tower_light"] = "green"
    STATE["emergency_active"] = False
    return {"ok": True, "message": "Dados da versão 2 zerados."}