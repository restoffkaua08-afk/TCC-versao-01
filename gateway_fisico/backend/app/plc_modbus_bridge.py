"""
Ponte Modbus TCP para o PLC XP325/In-Tech/InPi.

Objetivo:
- manter o Gateway como autoridade da operação;
- usar o PLC como ponte de I/O físico;
- ler entradas digitais: emergência, OUT1/OUT2 do GHPC, feedbacks;
- escrever saídas digitais: bomba/lâmpada/farol/válvula simulada;
- suportar modo SIMULATED para testar sem PLC real.

Observação:
O mapa de endereços em config/plc_map.json é inicial e deve ser ajustado conforme o software da bancada/XP325.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.real_bridge import build_desired_outputs

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parents[1]
CONFIG_DIR = BASE_DIR / "config"
DATA_DIR = BASE_DIR / "data"

PLC_MAP_FILE = CONFIG_DIR / "plc_map.json"
PLC_RUNTIME_FILE = DATA_DIR / "plc_runtime.json"

DEFAULT_PLC_MAP: dict[str, Any] = {
    "enabled": False,
    "mode": "SIMULATED",
    "host": "192.168.0.50",
    "port": 502,
    "unit_id": 1,
    "timeout_s": 2.0,
    "bench_outputs_allow_actuators": False,
    "sensor": {
        "model": "GHPC SCD-020-01",
        "type": "DIGITAL_PRESSURE_SWITCH",
        "range_min_kpa": -100,
        "range_max_kpa": 100,
        "numeric_pressure_available": False,
        "out1_description": "Limite de vacuo configurado no sensor",
        "out2_description": "Segundo limite/alarme configurado no sensor",
    },
    "inputs": {
        "emergency": {"type": "discrete_input", "address": 0},
        "sensor_out1_npn": {"type": "discrete_input", "address": 1},
        "sensor_out2_pnp": {"type": "discrete_input", "address": 2},
        "feedback_pump_b1": {"type": "discrete_input", "address": 3},
        "feedback_pump_b2": {"type": "discrete_input", "address": 4},
        "feedback_oil": {"type": "discrete_input", "address": 5},
    },
    "outputs": {
        "pump_b1": {"type": "coil", "address": 0},
        "pump_b2": {"type": "coil", "address": 1},
        "oil_valve": {"type": "coil", "address": 2},
        "alarm_green": {"type": "coil", "address": 3},
        "alarm_yellow": {"type": "coil", "address": 4},
        "alarm_red": {"type": "coil", "address": 5},
    },
}


class PlcConfigPayload(BaseModel):
    enabled: bool | None = None
    mode: str | None = None
    host: str | None = None
    port: int | None = None
    unit_id: int | None = None
    timeout_s: float | None = None
    bench_outputs_allow_actuators: bool | None = None


class PlcSimulatedInputsPayload(BaseModel):
    emergency: bool = False
    sensor_out1_npn: bool = False
    sensor_out2_pnp: bool = False
    feedback_pump_b1: bool = False
    feedback_pump_b2: bool = False
    feedback_oil: bool = False
    plc_online: bool = True
    sensor_online: bool = True


def _core():
    from app import main as core

    return core


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_json(path: Path, fallback: Any) -> Any:
    path.parent.mkdir(parents=True, exist_ok=True)

    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return fallback

    return fallback


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def load_plc_map() -> dict[str, Any]:
    data = _read_json(PLC_MAP_FILE, DEFAULT_PLC_MAP)

    if not isinstance(data, dict):
        data = dict(DEFAULT_PLC_MAP)

    merged = dict(DEFAULT_PLC_MAP)
    merged.update(data)

    merged["sensor"] = {**DEFAULT_PLC_MAP["sensor"], **dict(data.get("sensor", {}))}
    merged["inputs"] = {**DEFAULT_PLC_MAP["inputs"], **dict(data.get("inputs", {}))}
    merged["outputs"] = {**DEFAULT_PLC_MAP["outputs"], **dict(data.get("outputs", {}))}

    return merged


def save_plc_map(data: dict[str, Any]) -> dict[str, Any]:
    _write_json(PLC_MAP_FILE, data)
    return data


def load_runtime() -> dict[str, Any]:
    runtime = _read_json(
        PLC_RUNTIME_FILE,
        {
            "last_sync_at": None,
            "last_error": None,
            "simulated_inputs": {},
            "last_inputs": {},
            "last_outputs": {},
        },
    )

    if not isinstance(runtime, dict):
        runtime = {}

    runtime.setdefault("last_sync_at", None)
    runtime.setdefault("last_error", None)
    runtime.setdefault("simulated_inputs", {})
    runtime.setdefault("last_inputs", {})
    runtime.setdefault("last_outputs", {})

    return runtime


def save_runtime(data: dict[str, Any]) -> dict[str, Any]:
    _write_json(PLC_RUNTIME_FILE, data)
    return data


def _import_modbus_client():
    try:
        from pymodbus.client import ModbusTcpClient

        return ModbusTcpClient
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"pymodbus nao instalado ou indisponivel: {error}",
        )


def _modbus_call(method, *args, unit_id: int = 1, **kwargs):
    try:
        return method(*args, slave=unit_id, **kwargs)
    except TypeError:
        try:
            return method(*args, unit=unit_id, **kwargs)
        except TypeError:
            return method(*args, **kwargs)


def _read_bool_result(result: Any, index: int = 0) -> bool:
    if result is None:
        return False

    if hasattr(result, "isError") and result.isError():
        return False

    bits = getattr(result, "bits", None)

    if bits is None:
        return False

    if len(bits) <= index:
        return False

    return bool(bits[index])


def read_plc_inputs_modbus(plc_map: dict[str, Any]) -> dict[str, bool]:
    ModbusTcpClient = _import_modbus_client()

    host = str(plc_map.get("host") or "192.168.0.50")
    port = int(plc_map.get("port") or 502)
    unit_id = int(plc_map.get("unit_id") or 1)
    timeout_s = float(plc_map.get("timeout_s") or 2.0)

    client = ModbusTcpClient(host=host, port=port, timeout=timeout_s)

    if not client.connect():
        raise RuntimeError(f"Nao conectou ao PLC Modbus TCP em {host}:{port}.")

    try:
        values: dict[str, bool] = {}

        for name, spec in dict(plc_map.get("inputs", {})).items():
            address = int(spec.get("address", 0))
            input_type = str(spec.get("type", "discrete_input")).lower()

            if input_type == "coil":
                result = _modbus_call(client.read_coils, address=address, count=1, unit_id=unit_id)
            else:
                result = _modbus_call(client.read_discrete_inputs, address=address, count=1, unit_id=unit_id)

            values[name] = _read_bool_result(result)

        return values
    finally:
        try:
            client.close()
        except Exception:
            pass


def write_plc_outputs_modbus(plc_map: dict[str, Any], outputs: dict[str, bool]) -> None:
    ModbusTcpClient = _import_modbus_client()

    host = str(plc_map.get("host") or "192.168.0.50")
    port = int(plc_map.get("port") or 502)
    unit_id = int(plc_map.get("unit_id") or 1)
    timeout_s = float(plc_map.get("timeout_s") or 2.0)

    client = ModbusTcpClient(host=host, port=port, timeout=timeout_s)

    if not client.connect():
        raise RuntimeError(f"Nao conectou ao PLC Modbus TCP em {host}:{port}.")

    try:
        for name, spec in dict(plc_map.get("outputs", {})).items():
            address = int(spec.get("address", 0))
            value = bool(outputs.get(name, False))
            result = _modbus_call(client.write_coil, address=address, value=value, unit_id=unit_id)

            if hasattr(result, "isError") and result.isError():
                raise RuntimeError(f"Erro ao escrever coil {name} no endereco {address}.")
    finally:
        try:
            client.close()
        except Exception:
            pass


def safe_outputs_for_mode(plc_map: dict[str, Any], desired_outputs: dict[str, Any]) -> dict[str, bool]:
    mode = str(plc_map.get("mode", "SIMULATED")).upper()
    allow_bench_actuators = bool(plc_map.get("bench_outputs_allow_actuators", False))

    outputs = dict(desired_outputs.get("outputs", {}))

    if mode in {"SIMULATED", "BANCADA_SEGURA"} and not allow_bench_actuators:
        outputs["pump_b1"] = False
        outputs["pump_b2"] = False
        outputs["oil_valve"] = False

    return {
        "pump_b1": bool(outputs.get("pump_b1", False)),
        "pump_b2": bool(outputs.get("pump_b2", False)),
        "oil_valve": bool(outputs.get("oil_valve", False)),
        "alarm_green": bool(outputs.get("alarm_green", False)),
        "alarm_yellow": bool(outputs.get("alarm_yellow", False)),
        "alarm_red": bool(outputs.get("alarm_red", False)),
    }


def apply_inputs_to_gateway(inputs: dict[str, bool], plc_map: dict[str, Any]) -> dict[str, Any]:
    core = _core()
    state = core.STATE

    mode = str(plc_map.get("mode", "SIMULATED")).upper()

    if mode == "MODBUS_TCP":
        state.mode = "MODBUS_TCP"
    elif mode == "BANCADA_SEGURA":
        state.mode = "BANCADA_SEGURA"

    emergency = bool(inputs.get("emergency", False))
    out1 = bool(inputs.get("sensor_out1_npn", False))
    out2 = bool(inputs.get("sensor_out2_pnp", False))
    plc_online = bool(inputs.get("plc_online", True))
    sensor_online = bool(inputs.get("sensor_online", True))

    state.plc_online = plc_online
    state.sensor_online = sensor_online
    state.emergency = emergency
    state.last_ingest_at = _now_iso()
    state.last_ingest_monotonic = datetime.now(timezone.utc).timestamp()

    state.actual_pumps = {
        "b1": bool(inputs.get("feedback_pump_b1", False)),
        "b2": bool(inputs.get("feedback_pump_b2", False)),
        "oil": bool(inputs.get("feedback_oil", False)),
    }

    state.actual_hardware = {
        "source": "PLC_MODBUS",
        "plc_model": "XP325",
        "sensor_model": plc_map.get("sensor", {}).get("model", "GHPC SCD-020-01"),
        "sensor_type": plc_map.get("sensor", {}).get("type", "DIGITAL_PRESSURE_SWITCH"),
        "numeric_pressure_available": bool(plc_map.get("sensor", {}).get("numeric_pressure_available", False)),
        "pressure_numeric_available": False,
        "pressure_display": "Indisponível — sensor digital OUT1/OUT2",
        "sensor_out1_npn": out1,
        "sensor_out2_pnp": out2,
        "emergency": emergency,
        "plc_online": plc_online,
        "sensor_online": sensor_online,
    }

    if emergency:
        state.status = "BLOQUEADO"
        state.stage = "BLOQUEADO"
        state.pump_b1 = False
        state.pump_b2 = False
        state.pump_oil = False
        state.alarm = "EMERGENCIA_FISICA"
    elif not plc_online:
        state.status = "BLOQUEADO"
        state.stage = "BLOQUEADO"
        state.pump_b1 = False
        state.pump_b2 = False
        state.pump_oil = False
        state.alarm = "PLC_OFFLINE"
    elif not sensor_online:
        state.alarm = "SENSOR_OFFLINE"
    elif out2:
        state.alarm = "SENSOR_OUT2_ATIVO"
    elif state.alarm in {"EMERGENCIA_FISICA", "PLC_OFFLINE", "SENSOR_OFFLINE", "SENSOR_OUT2_ATIVO", "PLC_MODBUS_ERRO"}:
        state.alarm = None

    state.external_pressure_machine_mbar = None

    state.external_tanks_payload = [
        {
            "id": "T1",
            "code": "T1",
            "pressure_mbar": None,
            "machine_pressure_mbar": None,
            "hose_loss_mbar": 0.0,
            "oil_in_l": float(getattr(state, "oil_injected_l", 0.0)),
            "risk_pct": 70.0 if out2 else 30.0 if out1 else 10.0,
            "status": "LIMITE_2" if out2 else "LIMITE_1" if out1 else "AGUARDANDO_LIMITE",
            "sensor_out1_npn": out1,
            "sensor_out2_pnp": out2,
            "pressure_numeric_available": False,
            "pressure_display": "Indisponível — sensor digital OUT1/OUT2",
            "sensor_mode": "DIGITAL_PRESSURE_SWITCH",
        }
    ]

    return state.payload()


@router.get("/api/plc/map")
def get_plc_map() -> dict[str, Any]:
    return load_plc_map()


@router.post("/api/plc/config")
def update_plc_config(payload: PlcConfigPayload) -> dict[str, Any]:
    plc_map = load_plc_map()
    data = payload.model_dump(exclude_none=True)

    if "mode" in data:
        mode = str(data["mode"]).upper()
        if mode not in {"DISABLED", "SIMULATED", "BANCADA_SEGURA", "MODBUS_TCP"}:
            raise HTTPException(status_code=422, detail="Modo PLC invalido.")
        data["mode"] = mode
        data["enabled"] = mode != "DISABLED"

    plc_map.update(data)
    return save_plc_map(plc_map)


@router.post("/api/plc/simulate-inputs")
def simulate_plc_inputs(payload: PlcSimulatedInputsPayload) -> dict[str, Any]:
    runtime = load_runtime()
    runtime["simulated_inputs"] = payload.model_dump()
    runtime["last_sync_at"] = _now_iso()
    runtime["last_error"] = None
    save_runtime(runtime)
    return runtime


@router.get("/api/plc/status")
def plc_status() -> dict[str, Any]:
    return {
        "map": load_plc_map(),
        "runtime": load_runtime(),
    }


@router.post("/api/plc/sync-once")
async def plc_sync_once() -> dict[str, Any]:
    core = _core()
    plc_map = load_plc_map()
    runtime = load_runtime()

    mode = str(plc_map.get("mode", "SIMULATED")).upper()

    try:
        if mode == "DISABLED":
            return {"ok": True, "mode": mode, "message": "PLC desabilitado.", "runtime": runtime}

        if mode == "MODBUS_TCP":
            inputs = read_plc_inputs_modbus(plc_map)
            inputs["plc_online"] = True
            inputs["sensor_online"] = True
        else:
            simulated = dict(runtime.get("simulated_inputs", {}))
            inputs = {
                "emergency": bool(simulated.get("emergency", False)),
                "sensor_out1_npn": bool(simulated.get("sensor_out1_npn", False)),
                "sensor_out2_pnp": bool(simulated.get("sensor_out2_pnp", False)),
                "feedback_pump_b1": bool(simulated.get("feedback_pump_b1", False)),
                "feedback_pump_b2": bool(simulated.get("feedback_pump_b2", False)),
                "feedback_oil": bool(simulated.get("feedback_oil", False)),
                "plc_online": bool(simulated.get("plc_online", True)),
                "sensor_online": bool(simulated.get("sensor_online", True)),
            }

        state_payload = apply_inputs_to_gateway(inputs, plc_map)
        desired = build_desired_outputs(core.STATE)
        outputs = safe_outputs_for_mode(plc_map, desired)

        if mode == "MODBUS_TCP":
            write_plc_outputs_modbus(plc_map, outputs)

        runtime["last_sync_at"] = _now_iso()
        runtime["last_error"] = None
        runtime["last_inputs"] = inputs
        runtime["last_outputs"] = outputs
        save_runtime(runtime)

        await core.broadcast()

        return {
            "ok": True,
            "mode": mode,
            "inputs": inputs,
            "outputs": outputs,
            "state": state_payload,
            "desired_outputs": desired,
        }
    except Exception as error:
        runtime["last_sync_at"] = _now_iso()
        runtime["last_error"] = str(error)
        save_runtime(runtime)

        core.STATE.plc_online = False
        core.STATE.pump_b1 = False
        core.STATE.pump_b2 = False
        core.STATE.pump_oil = False
        core.STATE.alarm = "PLC_MODBUS_ERRO"
        await core.broadcast()

        raise HTTPException(status_code=500, detail=str(error))


@router.post("/api/plc/force-safe")
async def plc_force_safe() -> dict[str, Any]:
    core = _core()
    plc_map = load_plc_map()

    safe = {
        "pump_b1": False,
        "pump_b2": False,
        "oil_valve": False,
        "alarm_green": False,
        "alarm_yellow": False,
        "alarm_red": True,
    }

    if str(plc_map.get("mode", "SIMULATED")).upper() == "MODBUS_TCP":
        write_plc_outputs_modbus(plc_map, safe)

    core.STATE.pump_b1 = False
    core.STATE.pump_b2 = False
    core.STATE.pump_oil = False
    core.STATE.status = "BLOQUEADO"
    core.STATE.stage = "BLOQUEADO"
    core.STATE.alarm = "FORCE_SAFE_PLC"

    await core.broadcast()

    return {"ok": True, "outputs": safe}