from datetime import datetime
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


app = FastAPI(
    title="TSEA IHM Local API",
    description="API simulada para protótipo de IHM local da TSEA.",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CycleConfig(BaseModel):
    operator: str
    shift: str
    tank_count: int = Field(ge=1, le=3)
    recipe: str
    hose: str
    control_mode: Literal["local", "remoto"] = "local"


class CommandRequest(BaseModel):
    command: str
    source: str = "ihm_local"


@app.get("/")
def root():
    return {
        "name": "TSEA IHM Local API",
        "status": "online",
        "mode": "simulated",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/api/state")
def get_state():
    return {
        "device": {
            "profile": "tablet_industrial_simulado",
            "kiosk_mode": True,
            "glove_touch": "previsto",
            "sunlight_readable": "previsto",
            "ip_rating": "referencia_minima_ip65",
        },
        "machine": {
            "status": "pronta",
            "control_mode": "local",
            "interlocks": "liberado",
            "emergency": "liberada",
        },
        "communications": {
            "plc": "simulado_online",
            "supervisory": "aguardando_integracao",
            "pressure_sensor": "ok",
            "oil_sensor": "ok",
        },
        "cycle": {
            "id": "IHM-OP-0001",
            "stage": "preparacao",
            "tank_count": 2,
            "active_alarm": None,
        },
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/api/cycle/start")
def start_cycle(config: CycleConfig):
    return {
        "message": "Ciclo simulado iniciado",
        "operation_id": "IHM-OP-0001",
        "config": config.model_dump(),
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/api/command")
def send_command(command: CommandRequest):
    return {
        "message": "Comando simulado recebido",
        "command": command.model_dump(),
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/api/emergency")
def emergency_stop():
    return {
        "message": "Emergência geral simulada acionada",
        "status": "bloqueado",
        "timestamp": datetime.now().isoformat(),
    }