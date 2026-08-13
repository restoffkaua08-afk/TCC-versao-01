"""
Ponte HTTP Gateway <-> Node-RED (Bancada IoT SENAI).

Quando o operador aperta Iniciar na IHM, o Gateway:
    1. atualiza o estado interno (state.start)
    2. chama POST /tsea/api/cycle no Node-RED (que controla o CLP XP325)

Quando aperta Emergencia:
    1. bloqueia o estado interno
    2. chama POST /tsea/api/emergency no Node-RED

Quando o Gerente/IHM pede status:
    1. devolve o estado interno do Gateway + estado lido do Node-RED
       via GET /tsea/api/status

Se o Node-RED estiver indisponivel, o Gateway NAO quebra:
ele loga e segue com o modo SIMULADO (ou BANCADA_SEGURA se assim estiver).
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("tsea.node_red")

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parents[1]
CONFIG_FILE = BASE_DIR / "config" / "plc_map.json"
RUNTIME_FILE = BASE_DIR / "data" / "plc_runtime.json"


# ---------------------------------------------------------------------------
# Configuracao
# ---------------------------------------------------------------------------

DEFAULT_NODE_RED_URL = "http://127.0.0.1:1880"
TIMEOUT_S = 2.0


def _read_node_red_url() -> str:
    """Le a URL do Node-RED do plc_map.json, com fallback."""
    try:
        if CONFIG_FILE.exists():
            data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
            url = data.get("node_red_url")
            if isinstance(url, str) and url:
                return url
    except Exception as error:
        logger.warning("Falha ao ler plc_map.json: %s", error)
    return DEFAULT_NODE_RED_URL


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# HTTP client (sem requests) — usa urllib para nao adicionar dependencia
# ---------------------------------------------------------------------------

async def _post_json(url: str, payload: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    import urllib.request

    loop = asyncio.get_event_loop()

    def _do():
        data = json.dumps(payload or {}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
                body = resp.read()
                status = resp.getcode()
        except Exception as exc:
            return {"ok": False, "error": str(exc), "status": 0}

        try:
            return {"ok": True, "status": status, "body": json.loads(body)}
        except Exception:
            return {"ok": True, "status": status, "body": body.decode("utf-8", errors="replace")}

    return await loop.run_in_executor(None, _do)


async def _get_json(url: str) -> dict[str, Any]:
    import urllib.request

    loop = asyncio.get_event_loop()

    def _do():
        req = urllib.request.Request(url, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
                body = resp.read()
                status = resp.getcode()
        except Exception as exc:
            return {"ok": False, "error": str(exc), "status": 0}

        try:
            return {"ok": True, "status": status, "body": json.loads(body)}
        except Exception:
            return {"ok": True, "status": status, "body": body.decode("utf-8", errors="replace")}

    return await loop.run_in_executor(None, _do)


# ---------------------------------------------------------------------------
# Cache local do status (para o caso do Node-RED cair)
# ---------------------------------------------------------------------------

_last_status: dict[str, Any] = {
    "ok": False,
    "source": "cache",
    "pumps": {"pump_b1": False, "pump_b2": False, "oil_valve": False},
    "alarms": {"alarm_green": True, "alarm_yellow": False, "alarm_red": False},
    "status": {"ciclo_ativo": False, "finalizado": False, "emergencia_ativa": False},
    "registers": {"etapa_atual": 0, "codigo_alarme": 0},
    "timestamp": _now_iso(),
}


def _persist_runtime(snapshot: dict[str, Any]) -> None:
    try:
        RUNTIME_FILE.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "last_sync_at": _now_iso(),
            "node_red": snapshot,
        }
        RUNTIME_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception as error:
        logger.warning("Falha ao persistir plc_runtime.json: %s", error)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class StartCyclePayload(BaseModel):
    operator: str | None = None
    recipe_id: str | None = None
    tank_count: int | None = None


class EmergencyPayload(BaseModel):
    reason: str | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/api/node-red/cycle")
async def node_red_cycle() -> dict[str, Any]:
    """Chamado pelo frontend (Gerente / IHM) para iniciar ciclo.

    Aciona POST /tsea/api/cycle no Node-RED, que escala os motores.
    """
    base = _read_node_red_url().rstrip("/")
    url = f"{base}/tsea/api/cycle"
    logger.info("Enviando cycle para Node-RED em %s", url)
    result = await _post_json(url, {"source": "gateway"})

    if result.get("ok") and result.get("status", 0) < 400:
        return {
            "ok": True,
            "node_red": True,
            "status": result.get("status"),
            "response": result.get("body"),
            "forwarded_to": url,
        }

    logger.warning("Node-RED indisponivel em %s: %s", url, result.get("error"))
    return {
        "ok": False,
        "node_red": False,
        "error": result.get("error", "Falha ao comunicar com Node-RED."),
        "forwarded_to": url,
        "fallback": "gateway_continua_simulado",
    }


@router.post("/api/node-red/emergency")
async def node_red_emergency() -> dict[str, Any]:
    """Aciona POST /tsea/api/emergency no Node-RED."""
    base = _read_node_red_url().rstrip("/")
    url = f"{base}/tsea/api/emergency"
    logger.info("Enviando emergency para Node-RED em %s", url)
    result = await _post_json(url, {"source": "gateway"})

    if result.get("ok") and result.get("status", 0) < 400:
        return {
            "ok": True,
            "node_red": True,
            "status": result.get("status"),
            "response": result.get("body"),
            "forwarded_to": url,
        }

    return {
        "ok": False,
        "node_red": False,
        "error": result.get("error", "Falha ao comunicar com Node-RED."),
        "forwarded_to": url,
    }


@router.get("/api/node-red/status")
async def node_red_status() -> dict[str, Any]:
    """Consulta GET /tsea/api/status do Node-RED."""
    base = _read_node_red_url().rstrip("/")
    url = f"{base}/tsea/api/status"
    logger.debug("Consultando status em %s", url)
    result = await _get_json(url)

    global _last_status

    if result.get("ok") and result.get("status", 0) < 400:
        body = result.get("body")
        if isinstance(body, dict):
            _last_status = body
            _last_status["ok"] = True
            _last_status["source"] = "node_red"
            _last_status["timestamp"] = _now_iso()
            _persist_runtime(_last_status)
            return _last_status

    _last_status["timestamp"] = _now_iso()
    _last_status["source"] = "cache"
    _last_status["node_red_reachable"] = False
    return _last_status


@router.get("/api/node-red/health")
async def node_red_health() -> dict[str, Any]:
    """Verifica se o Node-RED responde (ping)."""
    base = _read_node_red_url().rstrip("/")
    url = f"{base}/tsea/api/status"
    result = await _get_json(url)

    return {
        "node_red_url": base,
        "reachable": bool(result.get("ok")),
        "status_code": result.get("status", 0),
        "error": result.get("error"),
    }
