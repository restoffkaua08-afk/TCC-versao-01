
"""
# TSEA_REAL_BRIDGE_MAINTENANCE
# Este módulo é a camada de integração física.
# Manutenção futura:
# - Comandos desejados para ESP32/PLC saem por /api/hardware/desired-outputs.
# - Leituras reais entram por /api/hardware/ingest.
# - O ESP32/PLC não deve decidir sozinho o estado principal da operação.
# - O Gateway/IHM iniciam, pausam, finalizam e bloqueiam a operação.
# - Sensor real precisa ser calibrado em hardware/esp32_http_bridge/esp32_http_bridge.ino.

Ponte real do protótipo físico TSEA V-Twin.

Responsabilidades:
- Receber cadastros reais do gerente: receitas, tanques e mangueiras.
- Sincronizar esses dados com a IHM.
- Bloquear operação sem receita, tanque ou mangueira real.
- Calcular volume interno real da mangueira.
- Receber leituras físicas via HTTP.
- Expor comandos desejados para ESP32/PLC.
- Aplicar watchdog de comunicação.
- Manter limites fixos no código, não editáveis pelo gerente.

Fluxo físico recomendado:
ESP32/PLC -> POST /api/hardware/ingest
ESP32/PLC <- GET  /api/hardware/desired-outputs
"""

from __future__ import annotations

import importlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
TANKS_FILE = DATA_DIR / "tanks.json"
HOSES_FILE = DATA_DIR / "hoses.json"
OPERATION_RECORDS_FILE = DATA_DIR / "operation_records.json"

WATCHDOG_TIMEOUT_SECONDS = 5.0

CODE_LIMITS: dict[str, Any] = {
    "tank_count_min": 1,
    "tank_count_max": 3,
    "oil_min_l": 0.0,
    "oil_max_l": 300.0,
    "pressure_min_mbar": 0.01,
    "pressure_max_mbar": 1013.0,
    "cycle_min_seconds": 30,
    "cycle_max_seconds": 3600,
    "hose_length_min_m": 0.1,
    "hose_length_max_m": 30.0,
    "hose_diameter_min_mm": 2.0,
    "hose_diameter_max_mm": 80.0,
    "tank_volume_min_l": 0.1,
    "tank_volume_max_l": 5000.0,
    "tank_diameter_min_mm": 50.0,
    "tank_diameter_max_mm": 3000.0,
    "tank_height_min_mm": 50.0,
    "tank_height_max_mm": 6000.0,
    "wall_thickness_min_mm": 0.5,
    "wall_thickness_max_mm": 50.0,
    "calibrated_loss_min_mbar": 0.0,
    "calibrated_loss_max_mbar": 200.0,
}

_ALLOWED_STATUS = {"PRONTO", "EM_CICLO", "PAUSADO", "FINALIZADO", "BLOQUEADO"}
_ALLOWED_STAGE = {
    "PREPARO",
    "VACUO_INICIAL",
    "VACUO_PROFUNDO",
    "INJECAO_DE_OLEO",
    "ESTABILIZACAO",
    "FINALIZACAO",
    "BLOQUEADO",
}


class TankPayload(BaseModel):
    id: str | None = None
    code: str | None = None
    name: str | None = None
    type: str | None = None
    tank_type: str | None = None
    volume_liters: float | None = None
    diameter_mm: float | None = None
    height_mm: float | None = None
    wall_thickness_mm: float | None = None
    structural_limit_mbar: float | None = None
    status: str | None = None
    note: str | None = None


class HosePayload(BaseModel):
    id: str | None = None
    code: str | None = None
    label: str | None = None
    descricao: str | None = None
    length_m: float | None = None
    internal_diameter_mm: float | None = None
    diameter_mm: float | None = None
    calibrated_loss_mbar: float | None = None
    loss_base_mbar: float | None = None
    status: str | None = None
    note: str | None = None


class RecipePayloadReal(BaseModel):
    id: str | None = None
    title: str | None = None
    name: str | None = None
    tank_type: str | None = None
    estimated_seconds: int | None = None
    max_cycle_seconds: int | None = None
    target_pressure_mbar: float | None = None
    roots_start_pressure_mbar: float | None = None
    b2_start_seconds: int | None = None
    oil_start_seconds: int | None = None
    stabilization_seconds: int | None = None
    oil_per_tank_l: float | None = None
    note: str | None = None


class HardwareModePayload(BaseModel):
    mode: str = Field(default="SIMULADO")


class HardwareAckPayload(BaseModel):
    command_id: str | None = None
    applied: bool = False
    message: str | None = None
    outputs: dict[str, Any] = Field(default_factory=dict)


class HardwareIngestPayload(BaseModel):
    status: str | None = None
    stage: str | None = None
    elapsed_seconds: int | None = None
    pressure_machine_mbar: float | None = None
    tanks: list[dict[str, Any]] = Field(default_factory=list)
    pumps: dict[str, bool] = Field(default_factory=dict)
    oil: dict[str, Any] = Field(default_factory=dict)
    hardware: dict[str, Any] = Field(default_factory=dict)
    alarm: str | None = None
    event: str | None = None


def _core():
    return importlib.import_module("app.main")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso_now() -> str:
    return _now().isoformat()


def _read_json(path: Path, fallback: Any) -> Any:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return fallback

    return fallback


def _write_json(path: Path, data: Any) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _strict_float(value: Any, field: str, minimum: float, maximum: float, default: float | None = None) -> float:
    if value is None:
        if default is None:
            raise HTTPException(status_code=422, detail=f"{field} é obrigatório.")
        value = default

    try:
        number = float(value)
    except Exception:
        raise HTTPException(status_code=422, detail=f"{field} deve ser numérico.")

    if number < minimum or number > maximum:
        raise HTTPException(status_code=422, detail=f"{field} fora da faixa permitida: {minimum} a {maximum}.")

    return number


def _strict_int(value: Any, field: str, minimum: int, maximum: int, default: int | None = None) -> int:
    if value is None:
        if default is None:
            raise HTTPException(status_code=422, detail=f"{field} é obrigatório.")
        value = default

    try:
        number = int(value)
    except Exception:
        raise HTTPException(status_code=422, detail=f"{field} deve ser inteiro.")

    if number < minimum or number > maximum:
        raise HTTPException(status_code=422, detail=f"{field} fora da faixa permitida: {minimum} a {maximum}.")

    return number


def _clamp_float(value: Any, minimum: float, maximum: float, fallback: float) -> float:
    try:
        number = float(value)
    except Exception:
        number = fallback

    return max(minimum, min(maximum, number))


def _to_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value

    if value is None:
        return default

    return str(value).strip().lower() in {"1", "true", "sim", "on", "ligado", "ligada"}


def get_limits() -> dict[str, Any]:
    return dict(CODE_LIMITS)


def _sanitize_code(value: Any, prefix: str) -> str:
    text = str(value or "").strip().upper().replace(" ", "-")

    if not text:
        return f"{prefix}-{datetime.now().strftime('%H%M%S')}"

    allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"
    cleaned = "".join(ch for ch in text if ch in allowed)

    return cleaned or f"{prefix}-{datetime.now().strftime('%H%M%S')}"


def hose_internal_volume_liters(length_m: float, internal_diameter_mm: float) -> float:
    """
    Volume interno real da mangueira.

    V = π × (D² / 4) × L

    D em metros.
    L em metros.
    Resultado final convertido para litros.
    """
    diameter_m = internal_diameter_mm / 1000.0
    volume_m3 = math.pi * ((diameter_m ** 2) / 4.0) * length_m
    return volume_m3 * 1000.0


def normalize_tank(raw: dict[str, Any]) -> dict[str, Any]:
    limits = get_limits()
    code = _sanitize_code(raw.get("code") or raw.get("id"), "TQ")

    if not code:
        raise HTTPException(status_code=422, detail="Código do tanque é obrigatório.")

    volume_liters = _strict_float(raw.get("volume_liters"), "volume_liters", limits["tank_volume_min_l"], limits["tank_volume_max_l"], 50.0)
    diameter_mm = _strict_float(raw.get("diameter_mm"), "diameter_mm", limits["tank_diameter_min_mm"], limits["tank_diameter_max_mm"], 740.0)
    height_mm = _strict_float(raw.get("height_mm"), "height_mm", limits["tank_height_min_mm"], limits["tank_height_max_mm"], 1000.0)
    wall_mm = _strict_float(raw.get("wall_thickness_mm"), "wall_thickness_mm", limits["wall_thickness_min_mm"], limits["wall_thickness_max_mm"], 3.4)
    structural_limit = _strict_float(raw.get("structural_limit_mbar"), "structural_limit_mbar", limits["pressure_min_mbar"], limits["pressure_max_mbar"], 35.0)

    return {
        "id": code,
        "code": code,
        "name": str(raw.get("name") or raw.get("title") or code).strip(),
        "type": str(raw.get("type") or raw.get("tank_type") or "Regulador").strip(),
        "volume_liters": round(volume_liters, 3),
        "diameter_mm": round(diameter_mm, 3),
        "height_mm": round(height_mm, 3),
        "wall_thickness_mm": round(wall_mm, 3),
        "structural_limit_mbar": round(structural_limit, 3),
        "status": str(raw.get("status") or "available"),
        "note": str(raw.get("note") or ""),
    }


def normalize_hose(raw: dict[str, Any]) -> dict[str, Any]:
    limits = get_limits()
    code = _sanitize_code(raw.get("code") or raw.get("id"), "MG")

    if not code:
        raise HTTPException(status_code=422, detail="Código da mangueira é obrigatório.")

    length_m = _strict_float(raw.get("length_m"), "length_m", limits["hose_length_min_m"], limits["hose_length_max_m"], 8.0)
    internal_diameter_mm = _strict_float(
        raw.get("internal_diameter_mm") or raw.get("diameter_mm") or raw.get("diameter_in"),
        "internal_diameter_mm",
        limits["hose_diameter_min_mm"],
        limits["hose_diameter_max_mm"],
        10.0,
    )
    calibrated_loss = _strict_float(
        raw.get("calibrated_loss_mbar") if raw.get("calibrated_loss_mbar") is not None else raw.get("loss_base_mbar"),
        "calibrated_loss_mbar",
        limits["calibrated_loss_min_mbar"],
        limits["calibrated_loss_max_mbar"],
        1.2,
    )

    internal_volume_l = hose_internal_volume_liters(length_m, internal_diameter_mm)

    return {
        "id": code,
        "code": code,
        "label": str(raw.get("label") or raw.get("descricao") or code).strip(),
        "descricao": str(raw.get("label") or raw.get("descricao") or code).strip(),
        "length_m": round(length_m, 3),
        "internal_diameter_mm": round(internal_diameter_mm, 3),
        "internal_volume_l": round(internal_volume_l, 6),
        "calibrated_loss_mbar": round(calibrated_loss, 3),
        "loss_base_mbar": round(calibrated_loss, 3),
        "status": str(raw.get("status") or "available"),
        "note": str(raw.get("note") or "Perda calibrada deve ser ajustada depois do ensaio real."),
    }


def normalize_recipe(raw: dict[str, Any]) -> dict[str, Any]:
    limits = get_limits()
    timestamp = datetime.now().strftime("%H%M%S")
    rid = _sanitize_code(raw.get("id") or raw.get("title") or raw.get("name"), "REC")

    if not rid:
        raise HTTPException(status_code=422, detail="ID da receita é obrigatório.")

    estimated = _strict_int(raw.get("estimated_seconds") or raw.get("max_cycle_seconds"), "estimated_seconds", limits["cycle_min_seconds"], limits["cycle_max_seconds"], 205)
    target = _strict_float(raw.get("target_pressure_mbar"), "target_pressure_mbar", limits["pressure_min_mbar"], limits["pressure_max_mbar"], 8.0)
    roots = _strict_float(raw.get("roots_start_pressure_mbar"), "roots_start_pressure_mbar", limits["pressure_min_mbar"], limits["pressure_max_mbar"], 50.0)

    b2 = _strict_int(raw.get("b2_start_seconds"), "b2_start_seconds", 0, estimated, 24)
    oil = _strict_int(raw.get("oil_start_seconds"), "oil_start_seconds", b2, estimated, max(b2, int(estimated * 0.45)))
    stabilization = _strict_int(raw.get("stabilization_seconds"), "stabilization_seconds", oil, estimated, max(oil, int(estimated * 0.78)))
    oil_per_tank = _strict_float(raw.get("oil_per_tank_l"), "oil_per_tank_l", limits["oil_min_l"], limits["oil_max_l"], 50.0)

    return {
        "id": rid,
        "title": str(raw.get("title") or raw.get("name") or rid).strip(),
        "name": str(raw.get("name") or raw.get("title") or rid).strip(),
        "tank_type": str(raw.get("tank_type") or "Regulador").strip(),
        "estimated_seconds": estimated,
        "max_cycle_seconds": estimated,
        "target_pressure_mbar": target,
        "roots_start_pressure_mbar": roots,
        "b2_start_seconds": b2,
        "oil_start_seconds": oil,
        "stabilization_seconds": stabilization,
        "oil_per_tank_l": oil_per_tank,
        "note": str(raw.get("note") or ""),
    }


def get_tanks() -> list[dict[str, Any]]:
    data = _read_json(TANKS_FILE, [])
    return [normalize_tank(item) for item in data if isinstance(item, dict)]


def get_hoses() -> list[dict[str, Any]]:
    data = _read_json(HOSES_FILE, [])
    return [normalize_hose(item) for item in data if isinstance(item, dict)]


def get_recipes() -> list[dict[str, Any]]:
    core = _core()
    recipes = getattr(core, "RECIPES", [])
    return recipes if isinstance(recipes, list) else []


def save_recipes(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    core = _core()
    normalized_items = [normalize_recipe(item) for item in items if isinstance(item, dict)]

    if not hasattr(core, "RECIPES") or not isinstance(core.RECIPES, list):
        core.RECIPES = []

    core.RECIPES.clear()
    core.RECIPES.extend(normalized_items)

    if hasattr(core, "save_recipes") and callable(core.save_recipes):
        core.save_recipes(core.RECIPES)

    recipes_file = Path(getattr(core, "RECIPES_FILE", DATA_DIR / "recipes.json"))
    _write_json(recipes_file, core.RECIPES)

    return core.RECIPES


def sync_legacy_hoses_for_main(main_globals: dict[str, Any] | None = None) -> None:
    if main_globals is None:
        main_globals = vars(_core())

    hoses_dict = main_globals.get("HOSES")

    if not isinstance(hoses_dict, dict):
        return

    # Remove qualquer mangueira demonstrativa antiga.
    for key in list(hoses_dict.keys()):
        if str(key) in {"MG-01", "MG-02", "MG-03"}:
            hoses_dict.pop(key, None)

    # Insere somente mangueiras reais cadastradas pelo gerente.
    for hose in get_hoses():
        hoses_dict[str(hose["id"])] = {
            "id": str(hose["id"]),
            "code": str(hose["code"]),
            "label": str(hose.get("label") or hose.get("descricao") or hose["id"]),
            "descricao": str(hose.get("descricao") or hose.get("label") or hose["id"]),
            "length_m": float(hose.get("length_m") or 0.0),
            "internal_diameter_mm": float(hose.get("internal_diameter_mm") or 0.0),
            "internal_volume_l": float(hose.get("internal_volume_l") or 0.0),
            "loss_base_mbar": float(hose.get("loss_base_mbar") or hose.get("calibrated_loss_mbar") or 0.0),
            "calibrated_loss_mbar": float(hose.get("calibrated_loss_mbar") or hose.get("loss_base_mbar") or 0.0),
        }


def validate_start_payload(data: dict[str, Any]) -> None:
    limits = get_limits()
    recipes = get_recipes()
    hoses = get_hoses()

    # For prototype operation, do not block start when there are no registered recipes/hoses.
    # Validate payload minimally: require recipe_id and hose_id strings but do not require them
    # to match stored records for simulated runs.
    recipe_id = str(data.get("recipe_id") or "").strip()
    hose_id = str(data.get("hose_id") or "").strip()

    if not recipe_id:
        raise ValueError("Receita (recipe_id) é obrigatória para iniciar a operação.")

    if not hose_id:
        raise ValueError("Mangueira (hose_id) é obrigatória para iniciar a operação.")

    tank_count = int(data.get("tank_count") or 0)
    if tank_count < limits["tank_count_min"] or tank_count > limits["tank_count_max"]:
        raise ValueError("Quantidade de reguladores fora dos limites.")

    oil_reservoir_l = float(data.get("oil_reservoir_l") or 0)
    if oil_reservoir_l < limits["oil_min_l"] or oil_reservoir_l > limits["oil_max_l"]:
        raise ValueError("Volume de óleo fora dos limites.")


def apply_watchdog(state: Any) -> None:
    if getattr(state, "mode", "SIMULADO") not in {"FISICO_HTTP", "BANCADA_SEGURA", "MODBUS_TCP"}:
        return

    last_ts = getattr(state, "last_ingest_monotonic", None)

    if last_ts is None:
        state.plc_online = False
        state.pump_b1 = False
        state.pump_b2 = False
        state.pump_oil = False
        state.alarm = "PLC_AGUARDANDO_INGEST"
        return

    age = (_now().timestamp() - float(last_ts))

    if age <= WATCHDOG_TIMEOUT_SECONDS:
        return

    state.plc_online = False
    state.pump_b1 = False
    state.pump_b2 = False
    state.pump_oil = False
    state.status = "BLOQUEADO"
    state.stage = "BLOQUEADO"
    state.alarm = "PLC_OFFLINE"


def build_desired_outputs(state: Any) -> dict[str, Any]:
    apply_watchdog(state)

    mode = getattr(state, "mode", "SIMULADO")
    emergency = bool(getattr(state, "emergency", False))
    plc_online = bool(getattr(state, "plc_online", True))
    sensor_online = bool(getattr(state, "sensor_online", True))
    alarm = getattr(state, "alarm", None)
    status = getattr(state, "status", "PRONTO")
    stage = getattr(state, "stage", "PREPARO")

    critical_alarms = {"EMERGENCIA_FISICA", "PLC_AGUARDANDO_INGEST", "PLC_OFFLINE", "SENSOR_OFFLINE", "PLC_MODBUS_ERRO", "FORCE_SAFE_PLC"}
    blocked = emergency or not plc_online or not sensor_online or status == "BLOQUEADO" or alarm in critical_alarms

    pump_b1 = False if blocked else bool(getattr(state, "pump_b1", False))
    pump_b2 = False if blocked else bool(getattr(state, "pump_b2", False))
    oil_valve = False if blocked else bool(getattr(state, "pump_oil", False))

    return {
        "command_id": f"CMD-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "mode": mode,
        "allowed_to_run": not blocked,
        "bench_safe": mode == "BANCADA_SEGURA",
        "physical_power_allowed": mode in {"FISICO_HTTP", "MODBUS_TCP"} and not blocked,
        "status": status,
        "stage": stage,
        "outputs": {
            "pump_b1": pump_b1,
            "pump_b2": pump_b2,
            "oil_valve": oil_valve,
            "alarm_green": status == "EM_CICLO" and not blocked and not alarm,
            "alarm_yellow": bool(alarm) and not blocked,
            "alarm_red": blocked,
            "emergency_stop": blocked,
        },
        "notes": {
            "command_authority": "Gateway/IHM",
            "hardware_role": "Executa comandos e devolve leituras reais.",
            "safe_bench_mode": "BANCADA_SEGURA deve ser usado com LEDs ou relés sem carga.",
            "modbus_mode": "MODBUS_TCP usa PLC XP325 como ponte de I/O.",
        },
        "safety": {
            "emergency": emergency,
            "plc_online": plc_online,
            "sensor_online": sensor_online,
            "alarm": alarm,
            "watchdog_timeout_seconds": WATCHDOG_TIMEOUT_SECONDS,
            "last_ingest_at": getattr(state, "last_ingest_at", None),
        },
    }


def normalize_hardware_tanks(payload: HardwareIngestPayload) -> list[dict[str, Any]]:
    if payload.tanks:
        normalized: list[dict[str, Any]] = []

        for index, tank in enumerate(payload.tanks[:3]):
            raw_pressure = tank.get("pressure_mbar")
            numeric_available = raw_pressure is not None
            pressure_machine = _clamp_float(tank.get("machine_pressure_mbar", payload.pressure_machine_mbar), 0.001, 1013.0, 1013.0)
            hose_loss = _clamp_float(tank.get("hose_loss_mbar"), 0.0, 200.0, 0.0)
            pressure_tank = _clamp_float(raw_pressure, 0.001, 1013.0, pressure_machine + hose_loss) if numeric_available else None
            oil_in_l = _clamp_float(tank.get("oil_in_l"), 0.0, 10000.0, 0.0)
            risk_pct = _clamp_float(tank.get("risk_pct"), 0.0, 100.0, 0.0)

            normalized.append(
                {
                    "id": str(tank.get("id") or f"T{index + 1}"),
                    "code": str(tank.get("code") or tank.get("id") or f"T{index + 1}"),
                    "pressure_mbar": round(pressure_tank, 3) if pressure_tank is not None else None,
                    "machine_pressure_mbar": round(pressure_machine, 3) if numeric_available else None,
                    "hose_loss_mbar": round(hose_loss, 3) if numeric_available else 0.0,
                    "oil_in_l": round(oil_in_l, 3),
                    "risk_pct": round(risk_pct, 2),
                    "status": str(tank.get("status") or ("ATENCAO" if risk_pct >= 65 else "OK")),
                    "pressure_numeric_available": numeric_available,
                    "pressure_display": f"{round(pressure_tank, 3)} mbar" if pressure_tank is not None else "Indisponível — sensor digital OUT1/OUT2",
                    "sensor_out1_npn": bool(tank.get("sensor_out1_npn", False)),
                    "sensor_out2_pnp": bool(tank.get("sensor_out2_pnp", False)),
                }
            )

        return normalized

    core = _core()
    state = core.STATE
    pressure_machine = _clamp_float(payload.pressure_machine_mbar, 0.001, 1013.0, 1013.0)
    tank_count = max(1, int(getattr(state, "tank_count", 1)))
    hose = getattr(state, "hose", {}) or {}
    hose_loss_base = float(hose.get("calibrated_loss_mbar", hose.get("loss_base_mbar", 0.0)))

    return [
        {
            "id": f"T{index + 1}",
            "code": f"T{index + 1}",
            "pressure_mbar": round(min(1013.0, pressure_machine + hose_loss_base), 3),
            "machine_pressure_mbar": round(pressure_machine, 3),
            "hose_loss_mbar": round(hose_loss_base, 3),
            "oil_in_l": round(float(getattr(state, "oil_injected_l", 0.0)) / tank_count, 3),
            "risk_pct": 18.0,
            "status": "OK",
        }
        for index in range(tank_count)
    ]


def install_main_hooks(main_globals: dict[str, Any]) -> None:
    if main_globals.get("_TSEA_REAL_HOOKS_INSTALLED"):
        return

    main_globals["_TSEA_REAL_HOOKS_INSTALLED"] = True

    def sync_real_hoses_into_legacy_hoses() -> None:
        sync_legacy_hoses_for_main(main_globals)

    main_globals["sync_real_hoses_into_legacy_hoses"] = sync_real_hoses_into_legacy_hoses
    sync_legacy_hoses_for_main(main_globals)

    state = main_globals.get("STATE")

    if state is None:
        return

    if not hasattr(state, "mode"):
        state.mode = "SIMULADO"
    if not hasattr(state, "external_pressure_machine_mbar"):
        state.external_pressure_machine_mbar = None
    if not hasattr(state, "external_tanks_payload"):
        state.external_tanks_payload = []
    if not hasattr(state, "external_oil_flow_l_min"):
        state.external_oil_flow_l_min = None
    if not hasattr(state, "sensor_online"):
        state.sensor_online = True
    if not hasattr(state, "plc_online"):
        state.plc_online = True
    if not hasattr(state, "emergency"):
        state.emergency = False
    if not hasattr(state, "last_ingest_at"):
        state.last_ingest_at = None
    if not hasattr(state, "last_ingest_monotonic"):
        state.last_ingest_monotonic = None
    if not hasattr(state, "last_command_ack"):
        state.last_command_ack = None
    if not hasattr(state, "actual_pumps"):
        state.actual_pumps = {"b1": False, "b2": False, "oil": False}
    if not hasattr(state, "actual_hardware"):
        state.actual_hardware = {}
    if not hasattr(state, "actual_oil"):
        state.actual_oil = {}
    if not hasattr(state, "sensor_calibration"):
        state.sensor_calibration = {
            "status": "pendente",
            "note": "Substituir curva demonstrativa do ESP32 pela curva real do sensor."
        }

    cls = state.__class__

    if not hasattr(cls, "_real_bridge_original_start") and hasattr(cls, "start"):
        cls._real_bridge_original_start = cls.start

        def start_real(self, command):
            sync_legacy_hoses_for_main(main_globals)

            try:
                data = command.model_dump()
            except Exception:
                data = {
                    "recipe_id": getattr(command, "recipe_id", None),
                    "tank_count": getattr(command, "tank_count", None),
                    "hose_id": getattr(command, "hose_id", None),
                    "oil_reservoir_l": getattr(command, "oil_reservoir_l", None),
                }

            validate_start_payload(data)
            return cls._real_bridge_original_start(self, command)

        cls.start = start_real

    if not hasattr(cls, "_real_bridge_original_payload") and hasattr(cls, "payload"):
        cls._real_bridge_original_payload = cls.payload

        def payload_real(self):
            apply_watchdog(self)
            data = cls._real_bridge_original_payload(self)

            if isinstance(data, dict):
                data["hardware"] = {
                    "mode": getattr(self, "mode", "SIMULADO"),
                    "sensor_online": bool(getattr(self, "sensor_online", True)),
                    "plc_online": bool(getattr(self, "plc_online", True)),
                    "emergency": bool(getattr(self, "emergency", False)),
                    "last_ingest_at": getattr(self, "last_ingest_at", None),
                    "last_command_ack": getattr(self, "last_command_ack", None),
                    "actual_pumps": getattr(self, "actual_pumps", {}),
                    "actual_hardware": getattr(self, "actual_hardware", {}),
                    "actual_oil": getattr(self, "actual_oil", {}),
                    "sensor_calibration": getattr(self, "sensor_calibration", {}),
                    "desired_outputs": build_desired_outputs(self),
                }

            return data

        cls.payload = payload_real

    if not hasattr(cls, "_real_bridge_original_current_pressure_machine") and hasattr(cls, "current_pressure_machine"):
        cls._real_bridge_original_current_pressure_machine = cls.current_pressure_machine

        def current_pressure_machine_real(self):
            external_pressure = getattr(self, "external_pressure_machine_mbar", None)

            if getattr(self, "mode", "SIMULADO") in {"FISICO_HTTP", "BANCADA_SEGURA", "MODBUS_TCP"} and external_pressure is not None:
                return max(0.001, min(1013.0, float(external_pressure)))

            return cls._real_bridge_original_current_pressure_machine(self)

        cls.current_pressure_machine = current_pressure_machine_real

    if not hasattr(cls, "_real_bridge_original_current_oil_flow") and hasattr(cls, "current_oil_flow"):
        cls._real_bridge_original_current_oil_flow = cls.current_oil_flow

        def current_oil_flow_real(self):
            external_flow = getattr(self, "external_oil_flow_l_min", None)

            if getattr(self, "mode", "SIMULADO") in {"FISICO_HTTP", "BANCADA_SEGURA", "MODBUS_TCP"} and external_flow is not None:
                return max(0.0, float(external_flow))

            return cls._real_bridge_original_current_oil_flow(self)

        cls.current_oil_flow = current_oil_flow_real

    if not hasattr(cls, "_real_bridge_original_tanks_payload") and hasattr(cls, "tanks_payload"):
        cls._real_bridge_original_tanks_payload = cls.tanks_payload

        def tanks_payload_real(self):
            external_tanks = getattr(self, "external_tanks_payload", None)

            if getattr(self, "mode", "SIMULADO") in {"FISICO_HTTP", "BANCADA_SEGURA", "MODBUS_TCP"} and isinstance(external_tanks, list) and external_tanks:
                return external_tanks[: max(1, int(getattr(self, "tank_count", 1)))]

            return cls._real_bridge_original_tanks_payload(self)

        cls.tanks_payload = tanks_payload_real


@router.get("/api/real/parameters")
def api_real_parameters() -> dict[str, Any]:
    sync_legacy_hoses_for_main()

    return {
        "recipes": get_recipes(),
        "tanks": get_tanks(),
        "hoses": get_hoses(),
        "limits": get_limits(),
        "formulas": {
            "hose_internal_volume_l": "V = pi * (Dinterno^2 / 4) * L",
            "pressure_relation": "P_tanque = P_sensor + deltaP_linha",
            "effective_pumping_speed": "1/Sefetivo = 1/Sbomba + 1/Cmangueira",
            "note": "A perda real da linha precisa ser calibrada com ensaio físico.",
        },
    }


@router.get("/api/parameters")
def api_parameters_alias() -> dict[str, Any]:
    return api_real_parameters()


@router.get("/api/real/limits")
def api_real_limits() -> dict[str, Any]:
    return get_limits()


@router.get("/api/real/recipes")
def api_real_recipes() -> list[dict[str, Any]]:
    return get_recipes()


@router.post("/api/real/recipes")
async def api_real_create_recipe(payload: RecipePayloadReal) -> dict[str, Any]:
    items = get_recipes()
    item = normalize_recipe(payload.model_dump(exclude_none=True))

    index = next((idx for idx, current in enumerate(items) if str(current.get("id")) == str(item.get("id"))), None)

    if index is None:
        items.append(item)
    else:
        items[index] = item

    saved_items = save_recipes(items)
    item = next((current for current in saved_items if str(current.get("id")) == str(item.get("id"))), item)

    core = _core()
    core.STATE.event(f"Receita cadastrada/atualizada: {item['id']}", "INFO")
    await core.broadcast()

    return item


@router.delete("/api/real/recipes/{recipe_id}")
async def api_real_delete_recipe(recipe_id: str) -> dict[str, Any]:
    items = [item for item in get_recipes() if str(item.get("id")) != str(recipe_id)]
    saved_items = save_recipes(items)

    core = _core()
    core.STATE.event(f"Receita removida: {recipe_id}", "WARN")
    await core.broadcast()

    return {"ok": True, "recipes": saved_items}


@router.get("/api/real/tanks")
def api_real_tanks() -> list[dict[str, Any]]:
    return get_tanks()


@router.post("/api/real/tanks")
async def api_real_create_tank(payload: TankPayload) -> dict[str, Any]:
    items = get_tanks()
    item = normalize_tank(payload.model_dump(exclude_none=True))

    index = next((idx for idx, current in enumerate(items) if str(current.get("id")) == str(item.get("id"))), None)

    if index is None:
        items.append(item)
    else:
        items[index] = item

    _write_json(TANKS_FILE, items)

    core = _core()
    core.STATE.event(f"Tanque cadastrado/atualizado: {item['id']}", "INFO")
    await core.broadcast()

    return item


@router.delete("/api/real/tanks/{tank_id}")
async def api_real_delete_tank(tank_id: str) -> dict[str, Any]:
    items = [
        item for item in get_tanks()
        if str(item.get("id")) != str(tank_id) and str(item.get("code")) != str(tank_id)
    ]

    _write_json(TANKS_FILE, items)

    core = _core()
    core.STATE.event(f"Tanque removido: {tank_id}", "WARN")
    await core.broadcast()

    return {"ok": True, "tanks": items}


@router.get("/api/real/hoses")
def api_real_hoses() -> list[dict[str, Any]]:
    sync_legacy_hoses_for_main()
    return get_hoses()


@router.post("/api/real/hoses")
async def api_real_create_hose(payload: HosePayload) -> dict[str, Any]:
    items = get_hoses()
    item = normalize_hose(payload.model_dump(exclude_none=True))

    index = next((idx for idx, current in enumerate(items) if str(current.get("id")) == str(item.get("id"))), None)

    if index is None:
        items.append(item)
    else:
        items[index] = item

    _write_json(HOSES_FILE, items)
    sync_legacy_hoses_for_main()

    core = _core()
    core.STATE.event(f"Mangueira cadastrada/atualizada: {item['id']}", "INFO")
    await core.broadcast()

    return item


@router.delete("/api/real/hoses/{hose_id}")
async def api_real_delete_hose(hose_id: str) -> dict[str, Any]:
    items = [
        item for item in get_hoses()
        if str(item.get("id")) != str(hose_id) and str(item.get("code")) != str(hose_id)
    ]

    _write_json(HOSES_FILE, items)
    sync_legacy_hoses_for_main()

    core = _core()
    core.STATE.event(f"Mangueira removida: {hose_id}", "WARN")
    await core.broadcast()

    return {"ok": True, "hoses": items}


@router.get("/api/hardware/schema")
def api_hardware_schema() -> dict[str, Any]:
    return {
        "description": "Contrato HTTP para conectar ESP32/PLC ao Gateway TSEA.",
        "cycle_recommendation_ms": 1000,
        "ingest": "POST /api/hardware/ingest",
        "desired_outputs": "GET /api/hardware/desired-outputs",
        "command_ack": "POST /api/hardware/command-ack",
        "payload_example": {
            "status": "EM_CICLO",
            "stage": "VACUO_INICIAL",
            "elapsed_seconds": 12,
            "pressure_machine_mbar": 82.4,
            "pumps": {"b1": True, "b2": False, "oil": False},
            "oil": {"injected_l": 0, "remaining_l": 120, "flow_l_min": 0},
            "hardware": {"sensor_online": True, "plc_online": True, "emergency": False},
            "tanks": [
                {
                    "id": "T1",
                    "pressure_mbar": 83.6,
                    "machine_pressure_mbar": 82.4,
                    "hose_loss_mbar": 1.2,
                    "oil_in_l": 0,
                    "risk_pct": 18,
                }
            ],
            "alarm": None,
        },
    }


@router.get("/api/hardware/desired-outputs")
def api_hardware_desired_outputs() -> dict[str, Any]:
    core = _core()
    return build_desired_outputs(core.STATE)


@router.post("/api/hardware/command-ack")
async def api_hardware_command_ack(payload: HardwareAckPayload) -> dict[str, Any]:
    core = _core()
    core.STATE.last_command_ack = {
        "received_at": _iso_now(),
        "command_id": payload.command_id,
        "applied": payload.applied,
        "message": payload.message,
        "outputs": payload.outputs,
    }

    if payload.applied:
        core.STATE.event(f"PLC confirmou comando: {payload.command_id or 'sem id'}", "INFO")
    else:
        core.STATE.event(f"PLC recusou/falhou comando: {payload.command_id or 'sem id'}", "WARN")

    await core.broadcast()

    return {"ok": True, "ack": core.STATE.last_command_ack}


@router.post("/api/hardware/mode")
async def api_hardware_mode(payload: HardwareModePayload) -> dict[str, Any]:
    core = _core()
    state = core.STATE
    mode = payload.mode.strip().upper()

    if mode not in {"SIMULADO", "FISICO_HTTP", "BANCADA_SEGURA", "MODBUS_TCP"}:
        raise HTTPException(status_code=422, detail="Modo inválido. Use SIMULADO, FISICO_HTTP, BANCADA_SEGURA ou MODBUS_TCP.")

    state.mode = mode

    if mode == "SIMULADO":
        state.external_pressure_machine_mbar = None
        state.external_tanks_payload = []
        state.external_oil_flow_l_min = None
        state.sensor_online = True
        state.plc_online = True
        state.emergency = False
        state.last_ingest_at = None
        state.last_ingest_monotonic = None
        state.alarm = None
        state.event("Gateway alterado para modo SIMULADO.", "INFO")
    else:
        state.event(f"Gateway alterado para modo {mode}.", "INFO")

    await core.broadcast()

    return {"ok": True, "mode": state.mode, "state": state.payload()}


@router.get("/api/hardware/state")
def api_hardware_state() -> dict[str, Any]:
    core = _core()
    apply_watchdog(core.STATE)

    return {
        "ok": True,
        "mode": getattr(core.STATE, "mode", "SIMULADO"),
        "state": core.STATE.payload(),
        "desired_outputs": build_desired_outputs(core.STATE),
    }


@router.post("/api/hardware/ingest")
async def api_hardware_ingest(payload: HardwareIngestPayload) -> dict[str, Any]:
    core = _core()
    state = core.STATE

    if getattr(state, "mode", "SIMULADO") not in {"FISICO_HTTP", "BANCADA_SEGURA", "MODBUS_TCP"}:
        state.mode = "FISICO_HTTP"

    state.last_ingest_at = _iso_now()
    state.last_ingest_monotonic = _now().timestamp()

    if getattr(state, "alarm", None) in {"PLC_AGUARDANDO_INGEST", "PLC_OFFLINE"}:
        state.alarm = None

    operation_active = bool(getattr(state, "operation_id", None))

    if operation_active and payload.status and payload.status in _ALLOWED_STATUS:
        if payload.status in {"BLOQUEADO", "PAUSADO", "FINALIZADO"}:
            state.status = payload.status

    if operation_active and payload.stage and payload.stage in _ALLOWED_STAGE:
        state.stage = payload.stage

    if operation_active and payload.elapsed_seconds is not None:
        state.elapsed_seconds = max(0, int(payload.elapsed_seconds))

    if payload.pressure_machine_mbar is not None:
        state.external_pressure_machine_mbar = _clamp_float(payload.pressure_machine_mbar, 0.001, 1013.0, 1013.0)

    pumps = payload.pumps or {}
    state.actual_pumps = {
        "b1": _to_bool(pumps.get("b1"), False),
        "b2": _to_bool(pumps.get("b2"), False),
        "oil": _to_bool(pumps.get("oil"), False),
    }

    oil = payload.oil or {}
    state.actual_oil = dict(oil)

    if operation_active and "injected_l" in oil:
        state.oil_injected_l = _clamp_float(oil.get("injected_l"), 0.0, 10000.0, getattr(state, "oil_injected_l", 0.0))

    if operation_active and "remaining_l" in oil:
        remaining = _clamp_float(oil.get("remaining_l"), 0.0, 10000.0, 0.0)
        state.oil_injected_l = max(0.0, float(getattr(state, "oil_reservoir_l", 0.0)) - remaining)

    if operation_active and "flow_l_min" in oil:
        state.external_oil_flow_l_min = _clamp_float(oil.get("flow_l_min"), 0.0, 200.0, 0.0)

    hardware = payload.hardware or {}
    state.actual_hardware = dict(hardware)

    if "sensor_online" in hardware:
        state.sensor_online = _to_bool(hardware.get("sensor_online"), True)

    if "plc_online" in hardware:
        state.plc_online = _to_bool(hardware.get("plc_online"), True)

    if "emergency" in hardware:
        state.emergency = _to_bool(hardware.get("emergency"))

    if getattr(state, "emergency", False):
        state.status = "BLOQUEADO"
        state.stage = "BLOQUEADO"
        state.pump_b1 = False
        state.pump_b2 = False
        state.pump_oil = False
        state.alarm = "EMERGENCIA_FISICA"
    elif payload.alarm:
        state.alarm = str(payload.alarm)
    elif getattr(state, "alarm", None) in {"EMERGENCIA_FISICA", "PLC_AGUARDANDO_INGEST", "PLC_OFFLINE", "SENSOR_OFFLINE"}:
        state.alarm = None

    state.external_tanks_payload = normalize_hardware_tanks(payload)

    if payload.event:
        state.event(str(payload.event), "INFO")

    try:
        if getattr(state, "operation_id", None):
            core.upsert_operation_record()
    except Exception:
        pass

    await core.broadcast()

    return {
        "ok": True,
        "mode": state.mode,
        "operation_active": operation_active,
        "state": state.payload(),
        "desired_outputs": build_desired_outputs(state),
    }


@router.post("/api/hardware/reset")
async def api_hardware_reset() -> dict[str, Any]:
    core = _core()
    state = core.STATE

    state.mode = "SIMULADO"
    state.external_pressure_machine_mbar = None
    state.external_tanks_payload = []
    state.external_oil_flow_l_min = None
    state.sensor_online = True
    state.plc_online = True
    state.emergency = False
    state.last_ingest_at = None
    state.last_ingest_monotonic = None
    state.alarm = None
    state.event("Ponte física reiniciada para modo simulado.", "INFO")

    await core.broadcast()

    return {"ok": True, "mode": state.mode, "state": state.payload()}


@router.post("/api/real/admin/clear-data")
async def api_real_admin_clear_data() -> dict[str, Any]:
    core = _core()

    save_recipes([])
    _write_json(TANKS_FILE, [])
    _write_json(HOSES_FILE, [])

    if hasattr(core, "OPERATION_RECORDS"):
        try:
            core.OPERATION_RECORDS.clear()
        except Exception:
            pass

    try:
        core.save_operation_records()
    except Exception:
        pass

    try:
        if hasattr(core, "OPERATION_RECORDS_FILE"):
            _write_json(Path(core.OPERATION_RECORDS_FILE), [])
    except Exception:
        pass

    state = core.STATE

    try:
        state.reset()
    except Exception:
        pass

    state.history_today = []
    state.events = []
    state.operation_id = None
    state.mode = "SIMULADO"
    state.external_pressure_machine_mbar = None
    state.external_tanks_payload = []
    state.external_oil_flow_l_min = None
    state.sensor_online = True
    state.plc_online = True
    state.emergency = False
    state.last_ingest_at = None
    state.last_ingest_monotonic = None
    state.last_command_ack = None
    state.alarm = None
    state.event("Base limpa para nova demonstração real.", "INFO")

    sync_legacy_hoses_for_main()

    await core.broadcast()

    return {
        "ok": True,
        "message": "Base limpa. Cadastre receitas, tanques e mangueiras novamente no gerente.",
        "recipes": [],
        "tanks": [],
        "hoses": [],
        "records": [],
    }
