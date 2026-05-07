from __future__ import annotations

import math
from typing import Any


TANK_TYPES = {
    "pequeno": {
        "label": "Pequeno",
        "volume_liters": 80.0,
        "structural_limit_mbar": 18.0,
        "description": "Tanque compacto, menor volume e ciclo mais curto.",
    },
    "medio": {
        "label": "Médio",
        "volume_liters": 100.0,
        "structural_limit_mbar": 20.0,
        "description": "Tanque padrão para demonstração do processo.",
    },
    "grande": {
        "label": "Grande",
        "volume_liters": 180.0,
        "structural_limit_mbar": 26.0,
        "description": "Tanque maior, curva mais lenta e maior exigência da bomba.",
    },
    "extra_grande": {
        "label": "Extra grande",
        "volume_liters": 300.0,
        "structural_limit_mbar": 32.0,
        "description": "Tanque crítico para demonstrar ciclo longo e desgaste operacional.",
    },
}


RAMPS = {
    "suave": {"label": "Suave", "factor": 0.72},
    "normal": {"label": "Normal", "factor": 1.0},
    "rapida": {"label": "Rápida", "factor": 1.35},
    "customizada": {"label": "Customizada", "factor": 1.12},
}


DEMO_PRESETS = {
    "segura": {
        "name": "Operação segura",
        "description": "Óleo, Roots, mangueira e rampa dentro da faixa segura.",
        "config": {
            "tank_type": "medio",
            "hose_id": 1,
            "target_pressure_mbar": 0.2,
            "roots_start_pressure_mbar": 0.6,
            "stop_pressure_mbar": 0.2,
            "oil_flow_l_min": 2.0,
            "oil_delay_seconds": 2,
            "max_cycle_seconds": 1800,
            "roots_speed_hz": 65,
            "vacuum_ramp": "suave",
            "hose_correction_enabled": True,
            "oil_compensation_enabled": True,
            "selected_tank": 1,
            "deviation_alert_mbar": 10,
            "simulate_hose_leak": False,
            "simulate_sensor_failure": False,
            "simulate_plc_loss": False,
        },
    },
    "oleo_baixo": {
        "name": "Vazão de óleo insuficiente",
        "description": "Mostra risco quando o óleo não compensa a queda de pressão.",
        "config": {
            "tank_type": "medio",
            "hose_id": 1,
            "target_pressure_mbar": 0.2,
            "roots_start_pressure_mbar": 0.6,
            "stop_pressure_mbar": 0.2,
            "oil_flow_l_min": 0.8,
            "oil_delay_seconds": 5,
            "max_cycle_seconds": 1800,
            "roots_speed_hz": 70,
            "vacuum_ramp": "rapida",
            "hose_correction_enabled": True,
            "oil_compensation_enabled": True,
            "selected_tank": 1,
            "deviation_alert_mbar": 10,
            "simulate_hose_leak": False,
            "simulate_sensor_failure": False,
            "simulate_plc_loss": False,
        },
    },
    "oleo_atrasado": {
        "name": "Atraso na injeção de óleo",
        "description": "A vazão é aceitável, mas entra tarde demais e gera pico de risco.",
        "config": {
            "tank_type": "medio",
            "hose_id": 1,
            "target_pressure_mbar": 0.2,
            "roots_start_pressure_mbar": 0.6,
            "stop_pressure_mbar": 0.2,
            "oil_flow_l_min": 1.8,
            "oil_delay_seconds": 20,
            "max_cycle_seconds": 1800,
            "roots_speed_hz": 70,
            "vacuum_ramp": "rapida",
            "hose_correction_enabled": True,
            "oil_compensation_enabled": True,
            "selected_tank": 1,
            "deviation_alert_mbar": 10,
            "simulate_hose_leak": False,
            "simulate_sensor_failure": False,
            "simulate_plc_loss": False,
        },
    },
    "mangueira_longa": {
        "name": "Mangueira longa sem correção",
        "description": "Demonstra erro de leitura quando a mangueira interfere na pressão real.",
        "config": {
            "tank_type": "medio",
            "hose_id": 3,
            "target_pressure_mbar": 0.2,
            "roots_start_pressure_mbar": 0.6,
            "stop_pressure_mbar": 0.2,
            "oil_flow_l_min": 2.0,
            "oil_delay_seconds": 2,
            "max_cycle_seconds": 1800,
            "roots_speed_hz": 65,
            "vacuum_ramp": "normal",
            "hose_correction_enabled": False,
            "oil_compensation_enabled": True,
            "selected_tank": 1,
            "deviation_alert_mbar": 8,
            "simulate_hose_leak": False,
            "simulate_sensor_failure": False,
            "simulate_plc_loss": False,
        },
    },
    "vazamento": {
        "name": "Vazamento na mangueira",
        "description": "A curva real simulada diverge da esperada por perda de estanqueidade.",
        "config": {
            "tank_type": "medio",
            "hose_id": 2,
            "target_pressure_mbar": 0.2,
            "roots_start_pressure_mbar": 0.6,
            "stop_pressure_mbar": 0.2,
            "oil_flow_l_min": 2.0,
            "oil_delay_seconds": 2,
            "max_cycle_seconds": 1800,
            "roots_speed_hz": 65,
            "vacuum_ramp": "normal",
            "hose_correction_enabled": True,
            "oil_compensation_enabled": True,
            "selected_tank": 1,
            "deviation_alert_mbar": 10,
            "simulate_hose_leak": True,
            "simulate_sensor_failure": False,
            "simulate_plc_loss": False,
        },
    },
    "tanque_extra_grande": {
        "name": "Tanque extra grande com pressão muito baixa",
        "description": "Demonstra ciclo longo, maior desgaste e necessidade de otimização.",
        "config": {
            "tank_type": "extra_grande",
            "hose_id": 2,
            "target_pressure_mbar": 0.05,
            "roots_start_pressure_mbar": 0.6,
            "stop_pressure_mbar": 0.05,
            "oil_flow_l_min": 2.0,
            "oil_delay_seconds": 2,
            "max_cycle_seconds": 3600,
            "roots_speed_hz": 85,
            "vacuum_ramp": "suave",
            "hose_correction_enabled": True,
            "oil_compensation_enabled": True,
            "selected_tank": 1,
            "deviation_alert_mbar": 10,
            "simulate_hose_leak": False,
            "simulate_sensor_failure": False,
            "simulate_plc_loss": False,
        },
    },
}


def _float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _hose_loss(hose: dict[str, Any], correction_enabled: bool, leak_enabled: bool) -> float:
    length = _float(hose.get("length_m"), 5)
    diameter = max(_float(hose.get("diameter_in"), 1), 0.5)
    loss_factor = _float(hose.get("loss_factor"), 0.02)
    usage = _float(hose.get("usage_cycles"), 0)

    base = length * loss_factor * (1 / diameter) * (1 + usage / 900)
    if leak_enabled:
        base *= 3.2

    if correction_enabled:
        base *= 0.35

    return max(0.0, base)


def _expected_pressure(t: int, initial: float, target: float, ramp_factor: float, volume: float, roots_started: bool, roots_speed_hz: float) -> float:
    roots_gain = 1.0 + (roots_speed_hz / 100.0 if roots_started else 0.0)
    k = 0.0028 * ramp_factor * roots_gain * (100 / max(volume, 1))
    return target + (initial - target) * math.exp(-k * t)


def _real_pressure(expected: float, hose_loss: float, leak_enabled: bool, sensor_failure: bool, t: int) -> float:
    pressure = expected + hose_loss
    if leak_enabled:
        pressure += 0.018 * t
    if sensor_failure and t > 120:
        return 2400.0 if (t // 30) % 2 == 0 else -8.0
    return pressure


def _oil_volume(flow_l_min: float, delay_seconds: int, t: int) -> float:
    if t <= delay_seconds:
        return 0.0
    return flow_l_min * ((t - delay_seconds) / 60)


def _effective_pressure_load(real_pressure: float, oil_volume: float, oil_enabled: bool) -> float:
    atmospheric = 1013.25
    vacuum_load = max(0.0, atmospheric - max(real_pressure, 0.01)) * 0.025
    oil_compensation = oil_volume * 0.72 if oil_enabled else 0.0
    return max(0.0, vacuum_load - oil_compensation)


def run_manual_operation(config: dict[str, Any], hoses: list[dict[str, Any]]) -> dict[str, Any]:
    tank_type_key = str(config.get("tank_type") or "medio")
    tank = TANK_TYPES.get(tank_type_key, TANK_TYPES["medio"])

    ramp_key = str(config.get("vacuum_ramp") or "normal")
    ramp = RAMPS.get(ramp_key, RAMPS["normal"])

    hose_id = _int(config.get("hose_id"), 1)
    hose = next((item for item in hoses if int(item.get("id", 0)) == hose_id), hoses[0] if hoses else {
        "id": 1,
        "code": "M-01",
        "length_m": 5,
        "diameter_in": 1,
        "loss_factor": 0.02,
        "usage_cycles": 0,
        "material": "simulada",
    })

    target_pressure = _float(config.get("target_pressure_mbar"), 0.2)
    roots_start_pressure = _float(config.get("roots_start_pressure_mbar"), 0.6)
    stop_pressure = _float(config.get("stop_pressure_mbar"), target_pressure)
    oil_flow = _float(config.get("oil_flow_l_min"), 2.0)
    oil_delay = _int(config.get("oil_delay_seconds"), 2)
    max_cycle = _int(config.get("max_cycle_seconds"), 1800)
    roots_speed = _float(config.get("roots_speed_hz"), 65)
    deviation_alert = _float(config.get("deviation_alert_mbar"), 10)

    hose_correction = bool(config.get("hose_correction_enabled", True))
    oil_compensation = bool(config.get("oil_compensation_enabled", True))
    leak_enabled = bool(config.get("simulate_hose_leak", False))
    sensor_failure = bool(config.get("simulate_sensor_failure", False))
    plc_loss = bool(config.get("simulate_plc_loss", False))

    initial = 1013.25
    hose_loss = _hose_loss(hose, hose_correction, leak_enabled)
    timeline = []
    alarms = []
    roots_started = False
    final_status = "success"
    reached_target_at = None
    max_risk = 0.0
    max_effective_load = 0.0
    max_deviation = 0.0

    for t in range(0, max_cycle + 30, 30):
        expected_before_roots = _expected_pressure(t, initial, target_pressure, ramp["factor"], tank["volume_liters"], False, roots_speed)

        if not roots_started and expected_before_roots <= roots_start_pressure:
            roots_started = True

        expected = _expected_pressure(t, initial, target_pressure, ramp["factor"], tank["volume_liters"], roots_started, roots_speed)
        real = _real_pressure(expected, hose_loss, leak_enabled, sensor_failure, t)
        sensor = max(0.001, real - hose_loss) if hose_correction else max(0.001, real - (hose_loss * 1.9))

        oil_volume = _oil_volume(oil_flow, oil_delay, t)
        effective_load = _effective_pressure_load(real, oil_volume, oil_compensation)
        max_effective_load = max(max_effective_load, effective_load)

        risk = min(160.0, (effective_load / max(_float(tank["structural_limit_mbar"], 20), 1)) * 100)
        max_risk = max(max_risk, risk)

        deviation = abs(real - expected)
        max_deviation = max(max_deviation, deviation)

        if reached_target_at is None and real <= stop_pressure:
            reached_target_at = t

        timeline.append({
            "t_seconds": t,
            "expected_pressure_mbar": round(expected, 4),
            "real_pressure_mbar": round(real, 4),
            "sensor_pressure_mbar": round(sensor, 4),
            "hose_loss_mbar": round(hose_loss, 4),
            "oil_volume_liters": round(oil_volume, 4),
            "effective_pressure_mbar": round(effective_load, 4),
            "collapse_risk_pct": round(risk, 2),
            "roots_started": roots_started,
        })

    if oil_flow < 1.5:
        alarms.append({"code": "OIL_FLOW_LOW", "severity": "critical", "message": "Vazão de óleo insuficiente para compensar a rampa de vácuo."})

    if oil_delay > 10:
        alarms.append({"code": "OIL_INJECTION_DELAY", "severity": "critical", "message": "Atraso na injeção de óleo pode gerar pico de carga estrutural."})

    if max_risk >= 100:
        alarms.append({"code": "STRUCTURAL_COLLAPSE_RISK", "severity": "critical", "message": "Risco de colapso: pressão efetiva ultrapassou o limite estrutural do tanque."})
        final_status = "critical"
    elif max_risk >= 75:
        alarms.append({"code": "STRUCTURAL_RISK_ATTENTION", "severity": "warning", "message": "Risco estrutural elevado. Revisar óleo, rampa e pressão alvo."})
        final_status = "warning"

    if hose_loss > 0.25:
        alarms.append({"code": "HOSE_LOSS_HIGH", "severity": "warning", "message": "Perda de carga elevada na mangueira. A leitura do sensor pode não representar a pressão real do tanque."})
        if final_status == "success":
            final_status = "warning"

    if leak_enabled:
        alarms.append({"code": "HOSE_LEAK_SUSPECTED", "severity": "warning", "message": "Curva real simulada diverge da esperada. Possível vazamento em mangueira ou conexão."})
        if final_status == "success":
            final_status = "warning"

    if sensor_failure:
        alarms.append({"code": "SENSOR_FAILURE_SIMULATED", "severity": "critical", "message": "Falha simulada de sensor: leitura incoerente detectada."})
        final_status = "critical"

    if plc_loss:
        alarms.append({"code": "PLC_COMM_LOSS_SIMULATED", "severity": "critical", "message": "Perda simulada de comunicação com CLP. Processo deve entrar em modo seguro."})
        final_status = "critical"

    if not roots_started:
        alarms.append({"code": "ROOTS_NOT_STARTED", "severity": "warning", "message": "A pressão configurada para ligar a Roots não foi atingida dentro do tempo máximo."})
        if final_status == "success":
            final_status = "warning"

    if max_deviation > deviation_alert:
        alarms.append({"code": "REAL_EXPECTED_DEVIATION", "severity": "warning", "message": "Diferença entre curva real simulada e esperada acima do limite configurado."})
        if final_status == "success":
            final_status = "warning"

    if reached_target_at is None:
        alarms.append({"code": "TARGET_NOT_REACHED", "severity": "warning", "message": "Pressão final desejada não foi atingida dentro do tempo máximo definido."})
        if final_status == "success":
            final_status = "warning"

    if final_status == "success":
        diagnosis = "Operação simulada segura. A curva de vácuo atingiu a meta com risco estrutural controlado."
        recommendation = "Parâmetros adequados para demonstração. Manter receita e registrar ciclo."
    elif final_status == "warning":
        diagnosis = "Operação simulada com atenção. O Gêmeo Digital detectou desvios que podem afetar precisão, tempo ou manutenção."
        recommendation = "Revisar mangueira, pressão alvo, tempo máximo, rampa e compensação de óleo antes de operar."
    else:
        diagnosis = "Operação simulada crítica. O Gêmeo Digital identificou risco relevante para tanque, sensor, óleo ou comunicação."
        recommendation = "Bloquear execução real, revisar parâmetros e validar segurança com engenharia antes de iniciar o processo."

    return {
        "status": final_status,
        "config": config,
        "tank": tank,
        "hose": hose,
        "ramp": ramp,
        "timeline": timeline,
        "alarms": alarms,
        "metrics": {
            "estimated_time_seconds": reached_target_at,
            "max_effective_pressure_mbar": round(max_effective_load, 3),
            "max_collapse_risk_pct": round(max_risk, 2),
            "max_deviation_mbar": round(max_deviation, 3),
            "final_real_pressure_mbar": timeline[-1]["real_pressure_mbar"] if timeline else None,
            "final_sensor_pressure_mbar": timeline[-1]["sensor_pressure_mbar"] if timeline else None,
            "roots_started": roots_started,
        },
        "diagnosis": diagnosis,
        "recommendation": recommendation,
    }


def config_options(hoses: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "tank_types": TANK_TYPES,
        "ramps": RAMPS,
        "presets": DEMO_PRESETS,
        "hoses": hoses,
        "fields": [
            "tank_type",
            "hose_id",
            "target_pressure_mbar",
            "roots_start_pressure_mbar",
            "stop_pressure_mbar",
            "oil_flow_l_min",
            "oil_delay_seconds",
            "max_cycle_seconds",
            "roots_speed_hz",
            "vacuum_ramp",
            "hose_correction_enabled",
            "oil_compensation_enabled",
            "selected_tank",
            "deviation_alert_mbar",
            "simulate_hose_leak",
            "simulate_sensor_failure",
            "simulate_plc_loss",
        ],
    }
