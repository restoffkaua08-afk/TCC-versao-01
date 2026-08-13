from __future__ import annotations

# TSEA_PHYSICAL_GATEWAY_NOTES
# Este arquivo mantém o núcleo do Gateway FastAPI usado pela demonstração.
# Regra de manutenção:
# - Cadastros reais ficam em data/recipes.json, data/tanks.json e data/hoses.json.
# - A ponte de hardware físico fica em app/real_bridge.py.
# - Não adicionar receitas, tanques ou mangueiras fixas neste arquivo.
# - Compatibilidade antiga deve existir apenas para telas legadas, sem criar dados falsos.

import asyncio
import json
import math
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="TSEA Physical Gateway",
    description="Gateway simulado para conectar IHM, sistema do gerente e prototipo fisico.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5178",
        "http://localhost:5178",
        "http://127.0.0.1:8020",
        "http://localhost:8020",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_RECIPES: list[dict[str, Any]] = []


EMPTY_RECIPE: dict[str, Any] = {
    "id": "__SEM_RECEITA__",
    "title": "Nenhuma receita cadastrada",
    "name": "Nenhuma receita cadastrada",
    "tank_type": "Nao definido",
    "estimated_seconds": 0,
    "max_cycle_seconds": 0,
    "target_pressure_mbar": 1013.0,
    "roots_start_pressure_mbar": 0.0,
    "b2_start_seconds": 0,
    "oil_start_seconds": 0,
    "stabilization_seconds": 0,
    "oil_per_tank_l": 0.0,
    "min_oil_flow_l_min": 0.0,
    "note": "Cadastre uma receita no sistema do gerente para iniciar uma operacao.",
}
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
RECIPES_FILE = DATA_DIR / "recipes.json"


def load_recipes() -> list[dict[str, Any]]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if RECIPES_FILE.exists():
        try:
            data = json.loads(RECIPES_FILE.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return data
        except Exception:
            pass

    return []


def save_recipes(recipes: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    RECIPES_FILE.write_text(json.dumps(recipes, indent=2, ensure_ascii=False), encoding="utf-8")


RECIPES: list[dict[str, Any]] = load_recipes()


class RecipePayload(BaseModel):
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
    min_oil_flow_l_min: float | None = None
    note: str | None = None


def normalize_recipe(payload: RecipePayload) -> dict[str, Any]:
    timestamp = datetime.now().strftime("%H%M%S")
    estimated_seconds = int(payload.estimated_seconds or payload.max_cycle_seconds or 205)
    oil_start = int(payload.oil_start_seconds or max(70, min(120, estimated_seconds * 0.45)))
    stabilization = int(payload.stabilization_seconds or max(oil_start + 40, estimated_seconds * 0.78))

    oil_per_tank = payload.oil_per_tank_l
    if oil_per_tank is None:
        oil_per_tank = max(30.0, float(payload.min_oil_flow_l_min or 2.0) * 25.0)

    return {
        "id": payload.id or f"REC-{timestamp}",
        "title": payload.title or payload.name or "Receita cadastrada pelo gerente",
        "tank_type": payload.tank_type or "Comum",
        "estimated_seconds": estimated_seconds,
        "target_pressure_mbar": float(payload.target_pressure_mbar or 8.0),
        "roots_start_pressure_mbar": float(payload.roots_start_pressure_mbar or 50.0),
        "b2_start_seconds": int(payload.b2_start_seconds or 24),
        "oil_start_seconds": oil_start,
        "stabilization_seconds": stabilization,
        "oil_per_tank_l": float(oil_per_tank),
        "note": payload.note or "Receita cadastrada pelo sistema do gerente.",
    }

HOSES: dict[str, dict[str, Any]] = {}


EMPTY_HOSE: dict[str, Any] = {
    "id": "__SEM_MANGUEIRA__",
    "code": "__SEM_MANGUEIRA__",
    "label": "Nenhuma mangueira cadastrada",
    "descricao": "Nenhuma mangueira cadastrada",
    "length_m": 0.0,
    "internal_diameter_mm": 0.0,
    "internal_volume_l": 0.0,
    "loss_base_mbar": 0.0,
    "calibrated_loss_mbar": 0.0,
}


class StartCommand(BaseModel):
    recipe_id: str = Field(default="")
    tank_count: int = Field(default=1, ge=1, le=3)
    hose_id: str = Field(default="")
    oil_reservoir_l: float = Field(default=50.0, ge=0)
    operator: str = Field(default="OPERADOR 01")
    shift: str = Field(default="MANHA")


class ChecklistPayload(BaseModel):
    operation_id: str | None = None
    items: dict[str, bool] = Field(default_factory=dict)
    observation: str = ""


class GatewayState:
    def __init__(self) -> None:
        self.operation_id = ""
        self.status = "PRONTO"
        self.stage = "PREPARO"
        self.mode = "SIMULADO"
        self.recipe = RECIPES[0] if RECIPES else EMPTY_RECIPE
        self.tank_count = 1
        self.hose = EMPTY_HOSE
        self.oil_reservoir_l = 50.0
        self.oil_injected_l = 0.0
        self.elapsed_seconds = 0
        self.operator = "OPERADOR 01"
        self.shift = "MANHA"
        self.pump_b1 = False
        self.pump_b2 = False
        self.pump_oil = False
        self.sensor_online = True
        self.plc_online = True
        self.emergency = False
        self.alarm: str | None = None
        self.events: list[dict[str, Any]] = []
        self.history_today: list[dict[str, Any]] = []

    def event(self, message: str, level: str = "INFO") -> None:
        self.events.insert(
            0,
            {
                "time": datetime.now().isoformat(timespec="seconds"),
                "level": level,
                "message": message,
            },
        )
        self.events = self.events[:80]

    def current_pressure_machine(self) -> float:
        external_pressure = getattr(self, "external_pressure_machine_mbar", None)
        if getattr(self, "mode", "SIMULADO") == "FISICO_HTTP" and external_pressure is not None:
            return max(0.001, min(1013.0, float(external_pressure)))

        if self.status not in ["EM_CICLO", "FINALIZADO", "PAUSADO"]:
            return 1013.0

        target = float(self.recipe["target_pressure_mbar"])

        if self.elapsed_seconds <= 0:
            return 1013.0

        b2_start = int(self.recipe["b2_start_seconds"])
        oil_start = int(self.recipe["oil_start_seconds"])

        if self.elapsed_seconds < b2_start:
            return max(6.0, 1013.0 * math.exp(-self.elapsed_seconds / 4.8))

        if self.elapsed_seconds < oil_start:
            return max(target, 75.0 * math.exp(-(self.elapsed_seconds - b2_start) / 22.0))

        return target

    def compute_stage(self) -> str:
        if self.status == "PRONTO":
            return "PREPARO"
        if self.status == "BLOQUEADO":
            return "BLOQUEADO"
        if self.status == "PAUSADO":
            return self.stage
        if self.status == "FINALIZADO":
            return "FINALIZACAO"

        if self.elapsed_seconds < int(self.recipe["b2_start_seconds"]):
            return "VACUO_INICIAL"
        if self.elapsed_seconds < int(self.recipe["oil_start_seconds"]):
            return "VACUO_PROFUNDO"
        if self.elapsed_seconds < int(self.recipe["stabilization_seconds"]):
            return "INJECAO_DE_OLEO"
        if self.elapsed_seconds < int(self.recipe["estimated_seconds"]):
            return "ESTABILIZACAO"
        return "FINALIZACAO"

    def required_oil(self) -> float:
        return float(self.recipe["oil_per_tank_l"]) * self.tank_count

    def current_oil_flow(self) -> float:
        external_flow = getattr(self, "external_oil_flow_l_min", None)
        if getattr(self, "mode", "SIMULADO") == "FISICO_HTTP" and external_flow is not None:
            return max(0.0, float(external_flow))

        if self.pump_oil and self.status == "EM_CICLO":
            return max(1.2, self.tank_count * 1.5)
        return 0.0

    def update_simulation(self) -> None:
        if self.status != "EM_CICLO":
            return

        old_stage = self.stage

        self.elapsed_seconds += 1
        self.stage = self.compute_stage()

        self.pump_b1 = self.stage in ["VACUO_INICIAL", "VACUO_PROFUNDO", "INJECAO_DE_OLEO", "ESTABILIZACAO"]
        self.pump_b2 = self.stage == "VACUO_PROFUNDO"
        self.pump_oil = self.stage in ["INJECAO_DE_OLEO", "ESTABILIZACAO"]

        if self.stage != old_stage:
            self.event(f"Etapa atual: {self.stage}", "INFO")

        if self.pump_oil:
            required = self.required_oil()
            progress = min(1.0, max(0.0, (self.elapsed_seconds - int(self.recipe["oil_start_seconds"])) / 75.0))
            self.oil_injected_l = min(self.oil_reservoir_l, required * progress)

        if self.elapsed_seconds >= int(self.recipe["estimated_seconds"]):
            self.finish(auto=True)

    def tanks_payload(self) -> list[dict[str, Any]]:
        external_tanks = getattr(self, "external_tanks_payload", None)
        if getattr(self, "mode", "SIMULADO") == "FISICO_HTTP" and isinstance(external_tanks, list) and external_tanks:
            return external_tanks[: max(1, self.tank_count)]

        pressure_machine = self.current_pressure_machine()
        tanks: list[dict[str, Any]] = []

        for index in range(self.tank_count):
            hose_loss = float(self.hose.get("loss_base_mbar", self.hose.get("calibrated_loss_mbar", 0.0))) + index * 0.35 + (self.tank_count - 1) * 0.42
            pressure_tank = max(float(self.recipe["target_pressure_mbar"]), pressure_machine + hose_loss)
            oil_in_tank = self.oil_injected_l / max(self.tank_count, 1)

            risk = 18.0
            if self.recipe["id"] == "CRI-003":
                risk += 35.0
            if pressure_tank < 10:
                risk += 10.0
            if self.tank_count >= 3:
                risk += 6.0

            risk = min(95.0, max(0.0, risk))

            tanks.append(
                {
                    "id": f"T{index + 1}",
                    "code": f"T{index + 1}",
                    "pressure_mbar": round(pressure_tank, 3),
                    "machine_pressure_mbar": round(pressure_machine, 3),
                    "hose_loss_mbar": round(hose_loss, 3),
                    "oil_in_l": round(oil_in_tank, 3),
                    "risk_pct": round(risk, 2),
                    "status": "ATENCAO" if risk >= 65 else "OK",
                }
            )

        return tanks

    def payload(self) -> dict[str, Any]:
        pressure_machine = self.current_pressure_machine()
        tanks = self.tanks_payload()

        numeric_pressures: list[float] = []

        for tank in tanks:
            value = tank.get("pressure_mbar")

            try:
                if value is not None:
                    numeric_pressures.append(float(value))
            except Exception:
                pass

        pressure_avg = sum(numeric_pressures) / max(len(numeric_pressures), 1) if numeric_pressures else None
        pressure_avg_payload = round(pressure_avg, 3) if pressure_avg is not None else None

        return {
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "mode": self.mode,
            "operation_id": self.operation_id,
            "status": self.status,
            "stage": self.stage,
            "elapsed_seconds": self.elapsed_seconds,
            "operator": self.operator,
            "shift": self.shift,
            "recipe": self.recipe,
            "hose": self.hose,
            "tank_count": self.tank_count,
            "pressure_machine_mbar": round(pressure_machine, 3) if pressure_machine is not None else None,
            "pressure_avg_tank_mbar": pressure_avg_payload,
            "pressure_numeric_available": pressure_avg is not None,
            "pressure_display": f"{pressure_avg_payload} mbar" if pressure_avg is not None else "Indisponível — sensor digital OUT1/OUT2",
            "tanks": tanks,
            "pumps": {
                "b1": self.pump_b1,
                "b2": self.pump_b2,
                "oil": self.pump_oil,
            },
            "oil": {
                "reservoir_l": round(self.oil_reservoir_l, 3),
                "required_l": round(self.required_oil(), 3),
                "injected_l": round(self.oil_injected_l, 3),
                "remaining_l": round(max(0.0, self.oil_reservoir_l - self.oil_injected_l), 3),
                "flow_l_min": round(self.current_oil_flow(), 3),
                "temperature_c": 60.0,
            },
            "hardware": {
                "sensor_online": self.sensor_online,
                "plc_online": self.plc_online,
                "emergency": self.emergency,
            },
            "alarm": self.alarm,
            "events": self.events,
        }

    def start(self, command: StartCommand) -> dict[str, Any]:
        recipe = next((item for item in RECIPES if item["id"] == command.recipe_id), None)
        if recipe is None:
            raise ValueError("Receita nao encontrada. Cadastre uma receita real no sistema do gerente.")

        sync_real_hoses_into_legacy_hoses()
        hose = HOSES.get(command.hose_id)
        if hose is None:
            raise ValueError("Mangueira nao encontrada. Cadastre uma mangueira real no sistema do gerente.")

        required_oil = float(recipe["oil_per_tank_l"]) * command.tank_count
        if command.oil_reservoir_l < required_oil:
            raise ValueError(f"Oleo insuficiente. Necessario: {required_oil} L.")

        self.operation_id = f"OP-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        self.status = "EM_CICLO"
        self.stage = "VACUO_INICIAL"
        self.recipe = recipe
        self.tank_count = command.tank_count
        self.hose = hose
        self.oil_reservoir_l = command.oil_reservoir_l
        self.oil_injected_l = 0.0
        self.elapsed_seconds = 0
        self.operator = command.operator
        self.shift = command.shift
        self.pump_b1 = True
        self.pump_b2 = False
        self.pump_oil = False
        self.emergency = False
        self.alarm = None
        self.events = []
        self.event(f"Operacao {self.operation_id} iniciada.", "INFO")
        return self.payload()

    def pause(self) -> dict[str, Any]:
        if self.status == "EM_CICLO":
            self.status = "PAUSADO"
            self.pump_b1 = False
            self.pump_b2 = False
            self.pump_oil = False
            self.event("Operacao pausada.", "WARN")
        return self.payload()

    def resume(self) -> dict[str, Any]:
        if self.status == "PAUSADO":
            self.status = "EM_CICLO"
            self.event("Operacao retomada.", "INFO")
        return self.payload()

    def stop(self) -> dict[str, Any]:
        if self.status in ["EM_CICLO", "PAUSADO"]:
            self.finish(auto=False)
        return self.payload()

    def emergency_stop(self) -> dict[str, Any]:
        self.status = "BLOQUEADO"
        self.stage = "BLOQUEADO"
        self.pump_b1 = False
        self.pump_b2 = False
        self.pump_oil = False
        self.emergency = True
        self.alarm = "EMERGENCIA_ACIONADA"
        self.event("Emergencia acionada. Sistema bloqueado.", "CRITICAL")
        return self.payload()

    def reset(self) -> dict[str, Any]:
        self.status = "PRONTO"
        self.stage = "PREPARO"
        self.operation_id = ""
        self.elapsed_seconds = 0
        self.oil_injected_l = 0.0
        self.pump_b1 = False
        self.pump_b2 = False
        self.pump_oil = False
        self.emergency = False
        self.alarm = None
        self.events = []
        self.event("Gateway reiniciado para novo ciclo.", "INFO")
        return self.payload()

    def finish(self, auto: bool) -> None:
        self.status = "FINALIZADO"
        self.stage = "FINALIZACAO"
        self.pump_b1 = False
        self.pump_b2 = False
        self.pump_oil = False
        self.oil_injected_l = min(self.oil_reservoir_l, self.required_oil())

        record = {
            "operation_id": self.operation_id,
            "time": datetime.now().isoformat(timespec="seconds"),
            "status": self.status,
            "tank_count": self.tank_count,
            "recipe_id": self.recipe["id"],
            "recipe_title": self.recipe["title"],
            "elapsed_seconds": self.elapsed_seconds,
            "oil_injected_l": round(self.oil_injected_l, 3),
            "auto": auto,
        }

        self.history_today.insert(0, record)
        self.history_today = self.history_today[:50]
        self.event("Operacao finalizada automaticamente." if auto else "Operacao finalizada por comando.", "INFO")


STATE = GatewayState()
CLIENTS: set[WebSocket] = set()

# TSEA_OPERATION_TRACEABILITY_START

OPERATION_RECORDS_FILE = DATA_DIR / "operation_records.json"


def load_operation_records() -> list[dict[str, Any]]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if OPERATION_RECORDS_FILE.exists():
        try:
            data = json.loads(OPERATION_RECORDS_FILE.read_text(encoding="utf-8"))
            return data if isinstance(data, list) else []
        except Exception:
            return []

    return []


def save_operation_records() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OPERATION_RECORDS_FILE.write_text(
        json.dumps(OPERATION_RECORDS[:150], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


OPERATION_RECORDS: list[dict[str, Any]] = load_operation_records()


def _safe_recipe() -> dict[str, Any]:
    return public_recipe(STATE.recipe) if "public_recipe" in globals() else STATE.recipe


def _safe_hose() -> dict[str, Any]:
    return public_hose(STATE.hose) if "public_hose" in globals() else STATE.hose


def _operation_status_label() -> str:
    if STATE.status == "EM_CICLO":
        return "Em andamento"
    if STATE.status == "PAUSADO":
        return "Atenção"
    if STATE.status == "FINALIZADO":
        return "Operacional"
    if STATE.status == "BLOQUEADO":
        return "Crítico"
    return "Registrado"


def _operation_result_text() -> str:
    if STATE.status == "EM_CICLO":
        return "Operação em execução e monitorada em tempo real pelo Gateway."
    if STATE.status == "PAUSADO":
        return "Operação pausada com registro mantido para rastreabilidade."
    if STATE.status == "FINALIZADO":
        return "Operação finalizada e consolidada no histórico técnico."
    if STATE.status == "BLOQUEADO":
        return "Operação bloqueada por evento crítico."
    return "Operação registrada pelo Gateway."


def _operation_observation_text(max_risk: float) -> str:
    if max_risk >= 82:
        return "Risco crítico. Verificar pressão, mangueira, sensores, bomba e condição estrutural."
    if max_risk >= 65:
        return "Operação com atenção. Monitorar perda de carga, óleo e estabilidade da curva."
    return "Operação dentro da faixa demonstrativa esperada."


def current_operation_record(extra: dict[str, Any] | None = None, forced_status: str | None = None) -> dict[str, Any] | None:
    if not STATE.operation_id:
        return None

    now = datetime.now().isoformat(timespec="seconds")
    payload = STATE.payload()
    recipe = _safe_recipe()
    hose = _safe_hose()

    tanks = payload.get("tanks", [])
    pressure_avg_raw = payload.get("pressure_avg_tank_mbar")
    try:
        pressure_avg = float(pressure_avg_raw) if pressure_avg_raw is not None else 0.0
    except Exception:
        pressure_avg = 0.0
    target_pressure = float(recipe.get("target_pressure_mbar") or 0)

    oil_payload = payload.get("oil", {})
    pump_payload = payload.get("pumps", {})
    hardware_payload = payload.get("hardware", {})

    max_risk = max([float(tank.get("risk_pct") or 0) for tank in tanks], default=0.0)
    tank_codes = ", ".join(str(tank.get("code") or tank.get("id") or "TQ") for tank in tanks) or "TQ"

    existing = next(
        (item for item in OPERATION_RECORDS if str(item.get("id")) == str(STATE.operation_id)),
        None,
    )

    timeline = list(existing.get("timeline", [])) if existing else []
    timeline.append({
        "second": STATE.elapsed_seconds,
        "time": now,
        "real_pressure_mbar": round(pressure_avg, 3),
        "expected_pressure_mbar": round(target_pressure, 3),
        "effective_pressure_mbar": round(pressure_avg, 3),
        "machine_pressure_mbar": payload.get("pressure_machine_mbar"),
        "stage": STATE.stage,
        "oil_injected_l": oil_payload.get("injected_l"),
        "oil_flow_l_min": oil_payload.get("flow_l_min"),
        "risk_pct": round(max_risk, 2),
        "pump_b1": pump_payload.get("b1"),
        "pump_b2": pump_payload.get("b2"),
        "pump_oil": pump_payload.get("oil"),
    })
    timeline = timeline[-240:]

    event_messages = [
        str(event.get("message") or "")
        for event in STATE.events
        if event.get("message")
    ][:30]

    components = [
        {
            "type": "Bomba primária",
            "id": "B1",
            "status": "Ligada" if pump_payload.get("b1") else "Desligada",
            "performance": "96%",
            "reading": "Mini bomba de vácuo / bomba primária",
            "impact": "Evacuação inicial e sustentação do ciclo de vácuo.",
        },
        {
            "type": "Bomba secundária / Roots simulada",
            "id": "B2",
            "status": "Ligada" if pump_payload.get("b2") else "Aguardando",
            "performance": "94%" if pump_payload.get("b2") else "Aguardando faixa",
            "reading": "Lâmpada simulando B2/Roots",
            "impact": "Representa o reforço de vácuo após faixa segura.",
        },
        {
            "type": "Linha de óleo",
            "id": "OIL-01",
            "status": "Ativa" if pump_payload.get("oil") else "Aguardando",
            "performance": f"{oil_payload.get('flow_l_min', 0)} L/min",
            "reading": f"{oil_payload.get('injected_l', 0)} L injetados",
            "impact": "Representa a etapa de impregnação/enchimento monitorado.",
        },
        {
            "type": "Sensor de pressão",
            "id": f"SP-{tank_codes}",
            "status": "Online" if hardware_payload.get("sensor_online") else "Falha",
            "performance": "98%" if hardware_payload.get("sensor_online") else "0%",
            "reading": payload.get("pressure_display") or (f"{round(pressure_avg, 3)} mbar" if pressure_avg else "Indisponível"),
            "impact": "Base de leitura para painel, rastreabilidade e alarmes.",
        },
        {
            "type": "Mangueira",
            "id": hose.get("code") or hose.get("id") or "__SEM_MANGUEIRA__",
            "status": "Vinculada",
            "performance": str(hose.get("loss_base_mbar", hose.get("loss_factor", "--"))),
            "reading": "Perda de carga simulada",
            "impact": "Afeta diferença entre pressão da máquina e pressão estimada no tanque.",
        },
        {
            "type": "PLC / Gateway",
            "id": "PLC-SIM",
            "status": "Online" if hardware_payload.get("plc_online") else "Offline",
            "performance": "Simulado",
            "reading": STATE.stage,
            "impact": "Centraliza comando, estado operacional, intertravamentos e eventos.",
        },
    ]

    actions = [
        {
            "step": event.get("time"),
            "status": event.get("level"),
            "ref": STATE.stage,
            "log": event.get("message"),
        }
        for event in STATE.events[:30]
    ]

    record = {
        "id": STATE.operation_id,
        "operation_id": STATE.operation_id,
        "type": "Operação",
        "name": f"{recipe.get('title', recipe.get('name', 'Receita operacional'))} - {STATE.operation_id}",
        "title": f"{recipe.get('title', recipe.get('name', 'Receita operacional'))} - {STATE.operation_id}",
        "created_at": existing.get("created_at") if existing else now,
        "started_at": existing.get("started_at") if existing else now,
        "updated_at": now,
        "finished_at": now if STATE.status == "FINALIZADO" else (existing.get("finished_at") if existing else None),
        "operator": STATE.operator,
        "user": STATE.operator,
        "shift": STATE.shift,
        "status": forced_status or _operation_status_label(),
        "stage": STATE.stage,
        "tank": tank_codes,
        "tank_count": STATE.tank_count,
        "hose": hose.get("code") or hose.get("id") or "__SEM_MANGUEIRA__",
        "recipe": recipe.get("title") or recipe.get("name") or recipe.get("id"),
        "recipe_id": recipe.get("id"),
        "initial_pressure_mbar": 1013.0,
        "final_pressure_mbar": round(pressure_avg, 3),
        "pressure_mbar": round(pressure_avg, 3),
        "target_pressure_mbar": target_pressure,
        "cycle_time": f"{STATE.elapsed_seconds}s",
        "duration": f"{STATE.elapsed_seconds}s",
        "elapsed_seconds": STATE.elapsed_seconds,
        "oil": f"{oil_payload.get('injected_l', 0)} L · {oil_payload.get('flow_l_min', 0)} L/min",
        "oil_volume_liters": oil_payload.get("injected_l", 0),
        "oil_flow_l_min": oil_payload.get("flow_l_min", 0),
        "risk": round(max_risk, 2),
        "collapse_risk_pct": round(max_risk, 2),
        "result": _operation_result_text(),
        "observations": _operation_observation_text(max_risk),
        "events": event_messages or ["Operação registrada no Gateway."],
        "tanks": tanks,
        "timeline": timeline,
        "raw_state": payload,
        "components": components,
        "actions": actions,
    }

    if existing:
        if existing.get("checklist_pre") and not (extra and "checklist_pre" in extra):
            record["checklist_pre"] = existing.get("checklist_pre")
        if existing.get("checklist_final") and not (extra and "checklist_final" in extra):
            record["checklist_final"] = existing.get("checklist_final")

    if extra:
        record.update(extra)

    return record


def upsert_operation_record(extra: dict[str, Any] | None = None, forced_status: str | None = None) -> dict[str, Any] | None:
    record = current_operation_record(extra=extra, forced_status=forced_status)

    if record is None:
        return None

    index = next(
        (idx for idx, item in enumerate(OPERATION_RECORDS) if str(item.get("id")) == str(record.get("id"))),
        None,
    )

    if index is None:
        OPERATION_RECORDS.insert(0, record)
    else:
        OPERATION_RECORDS[index] = record
        OPERATION_RECORDS.insert(0, OPERATION_RECORDS.pop(index))

    save_operation_records()
    STATE.history_today = OPERATION_RECORDS[:50]
    return record


def find_operation_record(record_id: str) -> dict[str, Any] | None:
    if STATE.operation_id and str(STATE.operation_id) == str(record_id):
        upsert_operation_record()

    return next(
        (item for item in OPERATION_RECORDS if str(item.get("id")) == str(record_id)),
        None,
    )

# TSEA_OPERATION_TRACEABILITY_END




async def broadcast() -> None:
    payload = STATE.payload()
    disconnected: list[WebSocket] = []

    for websocket in list(CLIENTS):
        try:
            await websocket.send_json(payload)
        except Exception:
            disconnected.append(websocket)

    for websocket in disconnected:
        CLIENTS.discard(websocket)


async def simulation_loop() -> None:
    while True:
        STATE.update_simulation()
        if STATE.operation_id:
            upsert_operation_record()
        await broadcast()
        await asyncio.sleep(1)


@app.on_event("startup")
async def on_startup() -> None:
    STATE.event("Gateway fisico iniciado em modo simulado.", "INFO")
    asyncio.create_task(simulation_loop())



# TSEA_GATEWAY_COMPAT_ROUTES_START

# Compatibilidade legada: mantida vazia para não criar tanque falso.
TANKS: list[dict[str, Any]] = []


def public_recipe(recipe: dict[str, Any]) -> dict[str, Any]:
    estimated_seconds = int(recipe.get("estimated_seconds") or recipe.get("max_cycle_seconds") or 205)
    oil_per_tank = float(recipe.get("oil_per_tank_l") or 50.0)
    min_oil_flow = float(recipe.get("min_oil_flow_l_min") or max(1.2, oil_per_tank / 25.0))

    return {
        **recipe,
        "id": str(recipe.get("id") or "__SEM_RECEITA__"),
        "name": recipe.get("name") or recipe.get("title") or "Receita Operacional",
        "title": recipe.get("title") or recipe.get("name") or "Receita Operacional",
        "tank_type": recipe.get("tank_type") or "Comum",
        "estimated_seconds": estimated_seconds,
        "max_cycle_seconds": int(recipe.get("max_cycle_seconds") or estimated_seconds),
        "target_pressure_mbar": float(recipe.get("target_pressure_mbar") or 8.0),
        "roots_start_pressure_mbar": float(recipe.get("roots_start_pressure_mbar") or 50.0),
        "b2_start_seconds": int(recipe.get("b2_start_seconds") or 24),
        "oil_start_seconds": int(recipe.get("oil_start_seconds") or 90),
        "stabilization_seconds": int(recipe.get("stabilization_seconds") or 165),
        "oil_per_tank_l": oil_per_tank,
        "min_oil_flow_l_min": min_oil_flow,
        "note": recipe.get("note") or recipe.get("observacao") or "Receita operacional.",
    }


def public_hose(hose: dict[str, Any]) -> dict[str, Any]:
    code = str(hose.get("code") or hose.get("id") or "__SEM_MANGUEIRA__")

    return {
        **hose,
        "id": code,
        "code": code,
        "label": hose.get("label") or hose.get("descricao") or code,
        "length_m": float(hose.get("length_m") or 0),
        "diameter_in": float(hose.get("diameter_in") or 0),
        "internal_diameter_mm": float(hose.get("internal_diameter_mm") or 0),
        "internal_volume_l": float(hose.get("internal_volume_l") or 0),
        "loss_factor": float(hose.get("loss_factor") or hose.get("loss_base_mbar") or 0),
        "loss_base_mbar": float(hose.get("loss_base_mbar") or hose.get("loss_factor") or 0),
        "calibrated_loss_mbar": float(hose.get("calibrated_loss_mbar") or hose.get("loss_base_mbar") or 0),
        "status": hose.get("status") or "not_configured",
    }


def normalize_recipe_id(value: Any) -> str:
    text = str(value or "").strip()

    if any(str(recipe.get("id")) == text for recipe in RECIPES):
        return text

    if text.isdigit():
        index = int(text) - 1
        if 0 <= index < len(RECIPES):
            return str(RECIPES[index].get("id"))

    return ""


def normalize_hose_id(value: Any) -> str:
    text = str(value or "").strip()

    if text in HOSES:
        return text

    return ""


def legacy_status(status: str) -> str:
    mapping = {
        "PRONTO": "stopped",
        "EM_CICLO": "running",
        "PAUSADO": "paused",
        "FINALIZADO": "stopped",
        "BLOQUEADO": "emergency",
    }

    return mapping.get(status, "stopped")


def legacy_state_payload() -> dict[str, Any]:
    payload = STATE.payload()
    recipe = public_recipe(STATE.recipe)
    hose = public_hose(STATE.hose)

    tank_states: list[dict[str, Any]] = []

    for tank in payload.get("tanks", []):
        risk = float(tank.get("risk_pct") or 0)

        tank_states.append(
            {
                "tank": {
                    "id": tank.get("id"),
                    "code": tank.get("code"),
                    "type": recipe.get("tank_type"),
                },
                "hose": hose,
                "pressure_mbar": tank.get("pressure_mbar"),
                "expected_pressure_mbar": recipe.get("target_pressure_mbar"),
                "effective_pressure_mbar": tank.get("pressure_mbar"),
                "machine_pressure_mbar": tank.get("machine_pressure_mbar"),
                "hose_loss_mbar": tank.get("hose_loss_mbar"),
                "oil_volume_liters": tank.get("oil_in_l"),
                "collapse_risk_pct": risk,
                "status_light": "red" if risk >= 82 else "yellow" if risk >= 65 else "green",
            }
        )

    return {
        **payload,
        "recipe": recipe,
        "hose": hose,
        "cycle": {
            "status": legacy_status(str(payload.get("status"))),
            "stage": payload.get("stage"),
            "elapsed_seconds": payload.get("elapsed_seconds"),
        },
        "tank_states": tank_states,
        "primary_pump": {
            "running": bool(payload.get("pumps", {}).get("b1")),
            "model": "Mini bomba de vácuo do protótipo",
            "health_pct": 96,
        },
        "roots_pump": {
            "running": bool(payload.get("pumps", {}).get("b2")),
            "model": "Lâmpada simulando B2/Roots",
            "health_pct": 94 if payload.get("pumps", {}).get("b2") else 0,
        },
        "oil_injection": {
            "enabled": bool(payload.get("pumps", {}).get("oil")),
            "current_flow_l_min": payload.get("oil", {}).get("flow_l_min"),
            "target_flow_l_min": recipe.get("min_oil_flow_l_min"),
            "injected_l": payload.get("oil", {}).get("injected_l"),
            "required_l": payload.get("oil", {}).get("required_l"),
        },
        "plc_comm_ok": bool(payload.get("hardware", {}).get("plc_online")),
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "status": "online",
        "gateway": "TSEA Physical Gateway",
        "mode": STATE.mode,
    }


@app.get("/api/operation/state")
def legacy_operation_state() -> dict[str, Any]:
    return legacy_state_payload()


@app.post("/api/operation/tick")
async def legacy_operation_tick() -> dict[str, Any]:
    STATE.update_simulation()
    await broadcast()
    return legacy_state_payload()


@app.post("/api/operation/start")
async def legacy_operation_start(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        if "sync_real_hoses_into_legacy_hoses" in globals():
            sync_real_hoses_into_legacy_hoses()

        raw_recipe_id = str(payload.get("recipe_id") or "").strip()
        raw_hose_id = str(payload.get("hose_id") or "").strip()

        command = StartCommand(
            recipe_id=normalize_recipe_id(raw_recipe_id) or raw_recipe_id,
            tank_count=max(1, min(3, int(payload.get("tank_count") or 1))),
            hose_id=normalize_hose_id(raw_hose_id) or raw_hose_id,
            oil_reservoir_l=float(payload.get("oil_reservoir_l") or payload.get("oleoColocado") or 150),
            operator=str(payload.get("operator") or "OPERADOR 01"),
            shift=str(payload.get("shift") or "MANHA"),
        )

        STATE.start(command)
        upsert_operation_record()

        # Encaminha comando para o Node-RED (Bancada IoT SENAI).
        # Falha do Node-RED NAO quebra a IHM.
        node_red_result: dict[str, Any] = {"forwarded": False}
        try:
            from app.node_red_bridge import _post_json, _read_node_red_url
            base = _read_node_red_url().rstrip("/")
            node_red_result = await _post_json(
                f"{base}/tsea/api/cycle",
                {
                    "source": "gateway",
                    "operation_id": STATE.operation_id,
                    "recipe_id": STATE.recipe.get("id"),
                    "tank_count": command.tank_count,
                    "operator": command.operator,
                },
            )
            node_red_result = {"forwarded": True, **(node_red_result or {})}
        except Exception as nr_error:
            STATE.event(f"Node-RED indisponivel: {nr_error}", "WARN")
            node_red_result = {"forwarded": False, "error": str(nr_error)}

        result = legacy_state_payload()
        result["node_red"] = node_red_result
        await broadcast()
        return result
    except Exception as error:
        STATE.event(f"Falha ao iniciar operacao pela IHM: {error}", "ERROR")
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/api/operation/pause")
async def legacy_operation_pause() -> dict[str, Any]:
    STATE.pause()
    upsert_operation_record()
    await broadcast()
    return legacy_state_payload()


@app.post("/api/operation/stop")
async def legacy_operation_stop() -> dict[str, Any]:
    STATE.stop()
    upsert_operation_record(forced_status="Operacional")
    await broadcast()
    return legacy_state_payload()


@app.post("/api/operation/reset")
async def legacy_operation_reset() -> dict[str, Any]:
    STATE.reset()
    await broadcast()
    return legacy_state_payload()


@app.post("/api/operation/emergency")
async def legacy_operation_emergency() -> dict[str, Any]:
    STATE.emergency_stop()
    upsert_operation_record(forced_status="Crítico")

    # Encaminha emergencia para o Node-RED (Bancada IoT SENAI).
    node_red_result: dict[str, Any] = {"forwarded": False}
    try:
        from app.node_red_bridge import _post_json, _read_node_red_url
        base = _read_node_red_url().rstrip("/")
        node_red_result = await _post_json(
            f"{base}/tsea/api/emergency",
            {"source": "gateway", "reason": "ihm_button"},
        )
        node_red_result = {"forwarded": True, **(node_red_result or {})}
    except Exception as nr_error:
        STATE.event(f"Node-RED indisponivel: {nr_error}", "WARN")
        node_red_result = {"forwarded": False, "error": str(nr_error)}

    result = legacy_state_payload()
    result["node_red"] = node_red_result
    await broadcast()
    return result


@app.get("/api/tanks")
def get_tanks() -> list[dict[str, Any]]:
    return TANKS


@app.get("/api/digital-twin/config-options")
def digital_twin_config_options() -> dict[str, Any]:
    return {
        "presets": {
            "seguro": {
                "name": "Ciclo seguro padrao",
                "config": {
                    "tank_type": "Comum",
                    "target_pressure_mbar": 8,
                    "roots_start_pressure_mbar": 50,
                    "oil_flow_l_min": 2,
                    "max_cycle_seconds": 205,
                },
            },
            "critico": {
                "name": "Tanque critico",
                "config": {
                    "tank_type": "Critico",
                    "target_pressure_mbar": 35,
                    "roots_start_pressure_mbar": 50,
                    "oil_flow_l_min": 1.6,
                    "max_cycle_seconds": 255,
                },
            },
        }
    }


@app.get("/api/reports/operational")
def reports_operational() -> dict[str, Any]:
    if STATE.operation_id:
        upsert_operation_record()

    return {
        "summary": legacy_state_payload(),
        "history_today": OPERATION_RECORDS,
    }


@app.get("/api/alarms")
def get_alarms() -> list[dict[str, Any]]:
    return [
        event for event in STATE.events
        if str(event.get("level", "")).upper() in ["WARN", "WARNING", "CRITICAL", "ERROR"]
    ]


@app.get("/api/maintenance/prediction")
def maintenance_prediction() -> list[dict[str, Any]]:
    return [
        {
            "component": "Mini bomba de vacuo",
            "status": "operacional",
            "health_pct": 96,
            "recommendation": "Monitorar horimetro durante a demonstracao.",
        },
        {
            "component": "Lampada B2/Roots simulada",
            "status": "operacional",
            "health_pct": 94,
            "recommendation": "Validar acionamento por faixa de pressao.",
        },
    ]


@app.get("/api/records/operations")
def records_operations() -> dict[str, Any]:
    if STATE.operation_id:
        upsert_operation_record()

    return {
        "items": OPERATION_RECORDS,
    }


@app.get("/api/records/operations/{record_id}")
def records_operation_detail(record_id: str) -> dict[str, Any]:
    record = find_operation_record(record_id)

    if record is None:
        return {
            "record": None,
            "error": "Registro nao encontrado.",
        }

    return {
        "record": record,
    }


@app.get("/api/records/simulations")
def records_simulations() -> dict[str, Any]:
    return {
        "items": [],
    }


@app.post("/api/records/simulations")
async def create_simulation_record(payload: dict[str, Any]) -> dict[str, Any]:
    STATE.event(f"Simulacao registrada pelo sistema gerente: {payload.get('name', 'Simulacao')}", "INFO")
    await broadcast()

    return {
        "ok": True,
        "record": payload,
    }


@app.post("/api/digital-twin/simulate")
def digital_twin_simulate(payload: dict[str, Any]) -> dict[str, Any]:
    pressure = float(payload.get("target_pressure_mbar") or payload.get("pressaoFinal") or 8)
    oil_flow = float(payload.get("oil_flow_l_min") or payload.get("min_oil_flow_l_min") or 2)
    max_cycle = int(payload.get("max_cycle_seconds") or payload.get("estimated_seconds") or 205)

    risk = 18
    if pressure < 8:
        risk += 8
    if oil_flow < 1.5:
        risk += 20
    if bool(payload.get("simulate_hose_leak")):
        risk += 22
    if bool(payload.get("simulate_sensor_failure")):
        risk += 18

    risk = min(95, risk)

    return {
        "id": f"SIM-{datetime.now().strftime('%H%M%S')}",
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "status": "critical" if risk >= 82 else "warning" if risk >= 65 else "success",
        "diagnosis": "Simulacao executada pelo gateway da demonstracao fisica.",
        "recommendation": "Validar parametros no prototipo fisico antes da apresentacao.",
        "metrics": {
            "final_real_pressure_mbar": pressure,
            "estimated_time_seconds": max_cycle,
            "max_collapse_risk_pct": risk,
            "oil_flow_l_min": oil_flow,
        },
        "config": payload,
    }

# TSEA_GATEWAY_COMPAT_ROUTES_END


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "TSEA Physical Gateway",
        "status": "online",
        "docs": "/docs",
    }


@app.get("/api/state")
def get_state() -> dict[str, Any]:
    return STATE.payload()


@app.get("/api/recipes")
def get_recipes() -> list[dict[str, Any]]:
    return [public_recipe(item) for item in RECIPES]


@app.post("/api/recipes")
async def create_recipe(payload: RecipePayload) -> dict[str, Any]:
    item = normalize_recipe(payload)

    existing_index = next((index for index, recipe in enumerate(RECIPES) if str(recipe.get("id")) == str(item["id"])), None)

    if existing_index is None:
        RECIPES.append(item)
        STATE.event(f"Receita cadastrada pelo gerente: {item['id']} - {item['title']}", "INFO")
    else:
        RECIPES[existing_index] = item
        STATE.event(f"Receita atualizada pelo gerente: {item['id']} - {item['title']}", "INFO")

    save_recipes(RECIPES)
    await broadcast()
    return item


@app.post("/api/recipes/reset")
async def reset_recipes() -> list[dict[str, Any]]:
    RECIPES.clear()

    save_recipes(RECIPES)
    STATE.event("Receitas limpas. Cadastre novas receitas pelo sistema do gerente.", "WARN")
    await broadcast()
    return RECIPES


@app.get("/api/hoses")
def get_hoses() -> list[dict[str, Any]]:
    return [public_hose(item) for item in HOSES.values()]


@app.get("/api/history/today")
def get_history_today() -> list[dict[str, Any]]:
    if STATE.operation_id:
        upsert_operation_record()

    return OPERATION_RECORDS


@app.post("/api/command/start")
async def command_start(command: StartCommand) -> dict[str, Any]:
    try:
        if "sync_real_hoses_into_legacy_hoses" in globals():
            sync_real_hoses_into_legacy_hoses()

        payload = STATE.start(command)
        upsert_operation_record()
        await broadcast()
        return payload
    except Exception as error:
        STATE.event(f"Falha ao iniciar operacao: {error}", "ERROR")
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/api/command/pause")
async def command_pause() -> dict[str, Any]:
    payload = STATE.pause()
    upsert_operation_record()
    await broadcast()
    return payload


@app.post("/api/command/resume")
async def command_resume() -> dict[str, Any]:
    payload = STATE.resume()
    upsert_operation_record()
    await broadcast()
    return payload


@app.post("/api/command/stop")
async def command_stop() -> dict[str, Any]:
    payload = STATE.stop()
    upsert_operation_record(forced_status="Operacional")
    await broadcast()
    return payload


@app.post("/api/command/emergency")
async def command_emergency() -> dict[str, Any]:
    payload = STATE.emergency_stop()
    upsert_operation_record(forced_status="Crítico")
    await broadcast()
    return payload


@app.post("/api/command/reset")
async def command_reset() -> dict[str, Any]:
    payload = STATE.reset()
    await broadcast()
    return payload


@app.post("/api/checklist/pre")
async def checklist_pre(payload: ChecklistPayload) -> dict[str, Any]:
    STATE.event("Checklist inicial recebido.", "INFO")
    upsert_operation_record(extra={"checklist_pre": payload.model_dump()})
    await broadcast()
    return {
        "ok": True,
        "received": payload.model_dump(),
    }


@app.post("/api/checklist/final")
async def checklist_final(payload: ChecklistPayload) -> dict[str, Any]:
    STATE.event("Checklist final recebido.", "INFO")
    upsert_operation_record(extra={"checklist_final": payload.model_dump()})
    await broadcast()
    return {
        "ok": True,
        "received": payload.model_dump(),
    }


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket) -> None:
    await websocket.accept()
    CLIENTS.add(websocket)

    try:
        await websocket.send_json(STATE.payload())

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        CLIENTS.discard(websocket)
    except Exception:
        CLIENTS.discard(websocket)

try:
    from app.real_bridge import router as real_bridge_router, install_main_hooks
    install_main_hooks(globals())
    app.include_router(real_bridge_router)
except Exception as real_bridge_error:
    print(f"[TSEA REAL BRIDGE] Falha ao carregar ponte real: {real_bridge_error}")

try:
    from app.plc_modbus_bridge import router as plc_modbus_router
    app.include_router(plc_modbus_router)
except Exception as plc_modbus_error:
    print(f"[TSEA PLC MODBUS] Falha ao carregar ponte Modbus: {plc_modbus_error}")
try:
    from app.node_red_bridge import router as node_red_router
    app.include_router(node_red_router)
except Exception as node_red_error:
    print(f"[TSEA NODE RED] Falha ao carregar ponte Node-RED: {node_red_error}")
try:
    from app.charts_bridge import router as charts_bridge_router
    app.include_router(charts_bridge_router)
except Exception as charts_bridge_error:
    print(f"[TSEA CHARTS] Falha ao carregar ponte de gráficos: {charts_bridge_error}")
try:
    from app.google_sheets_bridge import router as google_sheets_bridge_router
    app.include_router(google_sheets_bridge_router)
except Exception as google_sheets_bridge_error:
    print(f"[TSEA GOOGLE SHEETS] Falha ao carregar ponte Google Sheets: {google_sheets_bridge_error}")