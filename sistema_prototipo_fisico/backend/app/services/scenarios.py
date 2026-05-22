from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

from app.models.domain import Recipe


@dataclass
class ScenarioDefinition:
    id: str
    name: str
    description: str
    expected_result: str
    expected_alarms: list[str]
    operator_story: str
    parameters: dict[str, Any] = field(default_factory=dict)


SCENARIOS: dict[str, ScenarioDefinition] = {
    "safe_cycle": ScenarioDefinition(
        id="safe_cycle",
        name="Operação segura",
        description="Vácuo e óleo sincronizados corretamente. A Roots só entra dentro da faixa segura.",
        expected_result="success",
        expected_alarms=[],
        operator_story="Demonstra uma operação ideal: pressão cai de forma controlada, óleo compensa o tanque e o ciclo termina sem risco crítico.",
        parameters={
            "target_pressure_mbar": 6.5,
            "roots_start_pressure_mbar": 95,
            "oil_flow_l_min": 2.2,
            "oil_delay_seconds": 45,
            "hose_loss_multiplier": 1.0,
            "leak_rate_by_tank": {1: 0.02, 2: 0.02, 3: 0.03},
            "force_roots_early": False,
            "sensor_failure_tank": None,
            "plc_failure_after_seconds": None,
        },
    ),
    "delayed_oil_collapse": ScenarioDefinition(
        id="delayed_oil_collapse",
        name="Óleo atrasado com risco estrutural",
        description="A pressão cai rapidamente, mas o óleo entra tarde e com vazão insuficiente.",
        expected_result="critical",
        expected_alarms=["OIL_FLOW_LOW", "STRUCTURAL_COLLAPSE_RISK"],
        operator_story="Mostra por que o vácuo não pode ser tratado separado da injeção de óleo. O Gêmeo Digital identifica risco estrutural antes do fim do ciclo.",
        parameters={
            "target_pressure_mbar": 6.5,
            "roots_start_pressure_mbar": 95,
            "oil_flow_l_min": 0.35,
            "oil_delay_seconds": 330,
            "hose_loss_multiplier": 1.0,
            "leak_rate_by_tank": {1: 0.02, 2: 0.02, 3: 0.02},
            "force_roots_early": False,
            "sensor_failure_tank": None,
            "plc_failure_after_seconds": None,
        },
    ),
    "early_roots_start": ScenarioDefinition(
        id="early_roots_start",
        name="Roots acionada fora da faixa segura",
        description="A Roots tenta partir antes da pressão cair para o limite seguro.",
        expected_result="critical",
        expected_alarms=["ROOTS_UNSAFE_START"],
        operator_story="Mostra o valor do intertravamento: a Roots não deve entrar quando a pressão ainda está alta.",
        parameters={
            "target_pressure_mbar": 6.5,
            "roots_start_pressure_mbar": 95,
            "oil_flow_l_min": 2.0,
            "oil_delay_seconds": 60,
            "hose_loss_multiplier": 1.0,
            "leak_rate_by_tank": {1: 0.02, 2: 0.02, 3: 0.02},
            "force_roots_early": True,
            "sensor_failure_tank": None,
            "plc_failure_after_seconds": None,
        },
    ),
    "hose_loss_high": ScenarioDefinition(
        id="hose_loss_high",
        name="Mangueira longa com perda elevada",
        description="Uma mangueira longa/estreita causa perda de carga e desvio entre real e esperado.",
        expected_result="warning",
        expected_alarms=["HOSE_LOSS_HIGH", "PRESSURE_NOT_DROPPING"],
        operator_story="Mostra que o cadastro de mangueiras ajuda a explicar por que um tanque demora mais que os outros.",
        parameters={
            "target_pressure_mbar": 6.5,
            "roots_start_pressure_mbar": 95,
            "oil_flow_l_min": 2.0,
            "oil_delay_seconds": 60,
            "hose_loss_multiplier": 2.35,
            "leak_rate_by_tank": {1: 0.02, 2: 0.02, 3: 0.04},
            "force_roots_early": False,
            "sensor_failure_tank": None,
            "plc_failure_after_seconds": None,
        },
    ),
    "tank_leak": ScenarioDefinition(
        id="tank_leak",
        name="Vazamento em um tanque",
        description="Dois tanques seguem a curva esperada, mas um tanque não acompanha.",
        expected_result="warning",
        expected_alarms=["TANK_LEAK_SUSPECTED", "TANK_DIFFERENCE_HIGH"],
        operator_story="Mostra por que medir três tanques individualmente é melhor que usar um sensor único na bomba.",
        parameters={
            "target_pressure_mbar": 6.5,
            "roots_start_pressure_mbar": 95,
            "oil_flow_l_min": 2.0,
            "oil_delay_seconds": 60,
            "hose_loss_multiplier": 1.0,
            "leak_rate_by_tank": {1: 0.02, 2: 0.02, 3: 0.85},
            "force_roots_early": False,
            "sensor_failure_tank": None,
            "plc_failure_after_seconds": None,
        },
    ),
    "sensor_failure": ScenarioDefinition(
        id="sensor_failure",
        name="Falha de sensor",
        description="Um sensor retorna leitura incoerente durante o ciclo.",
        expected_result="critical",
        expected_alarms=["SENSOR_FAILURE_SIMULATED"],
        operator_story="Mostra que o sistema precisa detectar leitura impossível ou incoerente antes de confiar no processo.",
        parameters={
            "target_pressure_mbar": 6.5,
            "roots_start_pressure_mbar": 95,
            "oil_flow_l_min": 2.0,
            "oil_delay_seconds": 60,
            "hose_loss_multiplier": 1.0,
            "leak_rate_by_tank": {1: 0.02, 2: 0.02, 3: 0.02},
            "force_roots_early": False,
            "sensor_failure_tank": 2,
            "plc_failure_after_seconds": None,
        },
    ),
}


TANKS = [
    {"id": 1, "code": "TQ-REG-01", "volume_liters": 1250.0, "structural_limit_mbar": 35.0, "hose_length_m": 10.0, "hose_factor": 0.62},
    {"id": 2, "code": "TQ-REG-02", "volume_liters": 1180.0, "structural_limit_mbar": 38.0, "hose_length_m": 14.0, "hose_factor": 0.84},
    {"id": 3, "code": "TQ-REG-03", "volume_liters": 920.0, "structural_limit_mbar": 42.0, "hose_length_m": 18.0, "hose_factor": 1.28},
]


def list_scenarios() -> list[dict[str, Any]]:
    return [
        {
            "id": item.id,
            "name": item.name,
            "description": item.description,
            "expected_result": item.expected_result,
            "expected_alarms": item.expected_alarms,
            "operator_story": item.operator_story,
            "parameters": item.parameters,
        }
        for item in SCENARIOS.values()
    ]


def get_scenario(scenario_id: str) -> dict[str, Any]:
    if scenario_id not in SCENARIOS:
        raise KeyError(f"Cenário não encontrado: {scenario_id}")
    scenario = SCENARIOS[scenario_id]
    return {
        "id": scenario.id,
        "name": scenario.name,
        "description": scenario.description,
        "expected_result": scenario.expected_result,
        "expected_alarms": scenario.expected_alarms,
        "operator_story": scenario.operator_story,
        "parameters": scenario.parameters,
    }


def _pressure_curve(t: int, initial: float, target: float, volume_liters: float, effective_speed: float, leak: float) -> float:
    # Modelo demonstrativo: curva exponencial calibrável.
    # Quanto maior a vazão efetiva e menor o volume, mais rápida a queda.
    k = max(0.0008, (effective_speed / max(volume_liters, 1)) * 0.00115)
    ideal = target + (initial - target) * math.exp(-k * t)
    leak_penalty = leak * (t / 10.0)
    return max(target, ideal + leak_penalty)


def _expected_curve(t: int, initial: float, target: float) -> float:
    return target + (initial - target) * math.exp(-0.0068 * t)


def _hose_loss(length_m: float, factor: float, multiplier: float, diameter_in: float = 2.0, usage_cycles: int = 80) -> float:
    diameter_factor = 2.0 / max(diameter_in, 0.5)
    usage_factor = 1 + usage_cycles / 1000
    return length_m * factor * diameter_factor * usage_factor * multiplier


def _risk_pct(pressure: float, oil_volume: float, structural_limit: float) -> float:
    # Pressão efetiva demonstrativa:
    # carga estrutural cresce com o vácuo e cai com compensação do óleo.
    external = 1013.25
    vacuum_load = max(0.0, external - pressure) * 0.035
    oil_compensation = oil_volume * 8.0
    effective_load = max(0.0, vacuum_load - oil_compensation)
    return min(160.0, (effective_load / max(structural_limit, 1.0)) * 100)


def run_scenario(
    scenario_id: str,
    recipe: Recipe,
    custom: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if scenario_id not in SCENARIOS:
        raise KeyError(f"Cenário não encontrado: {scenario_id}")

    scenario = SCENARIOS[scenario_id]
    params = dict(scenario.parameters)
    custom = custom or {}

    for key, value in custom.items():
        if value is not None:
            params[key] = value

    target = float(params.get("target_pressure_mbar") or recipe.target_pressure_mbar)
    roots_start_pressure = float(params.get("roots_start_pressure_mbar") or recipe.roots_start_pressure_mbar)
    oil_flow = float(params.get("oil_flow_l_min") or recipe.min_oil_flow_l_min)
    oil_delay = int(params.get("oil_delay_seconds") or 0)
    hose_multiplier = float(params.get("hose_loss_multiplier") or 1.0)
    leak_by_tank = params.get("leak_rate_by_tank") or {}
    force_roots_early = bool(params.get("force_roots_early"))
    sensor_failure_tank = params.get("sensor_failure_tank")
    plc_failure_after = params.get("plc_failure_after_seconds")

    timeline: list[dict[str, Any]] = []
    alarms: set[str] = set()
    roots_started = False
    roots_unsafe_attempt = False
    max_risk = 0.0
    final_pressures: list[float] = []
    oil_volume = 0.0

    for t in range(0, int(recipe.max_cycle_seconds) + 1, 30):
        if plc_failure_after is not None and t >= int(plc_failure_after):
            alarms.add("PLC_COMM_LOSS_SIMULATED")

        current_oil_flow = oil_flow if t >= oil_delay else 0.0
        oil_volume += current_oil_flow * (30 / 60)

        primary_speed = 840.0
        avg_pressure_estimate = _expected_curve(t, 1013.25, target)

        if force_roots_early and t >= 60 and not roots_started:
            roots_unsafe_attempt = avg_pressure_estimate > roots_start_pressure
            roots_started = True
            if roots_unsafe_attempt:
                alarms.add("ROOTS_UNSAFE_START")

        if not roots_started and avg_pressure_estimate <= roots_start_pressure:
            roots_started = True

        roots_bonus = 2.7 if roots_started and not roots_unsafe_attempt else 1.0
        effective_speed = primary_speed * roots_bonus

        tanks_step: list[dict[str, Any]] = []
        pressures = []

        for tank in TANKS:
            tank_id = tank["id"]
            leak = float(leak_by_tank.get(tank_id, leak_by_tank.get(str(tank_id), 0.02)))
            hose_loss = _hose_loss(
                length_m=tank["hose_length_m"],
                factor=tank["hose_factor"],
                multiplier=hose_multiplier,
                diameter_in=1.5 if tank_id == 3 else 2.0,
                usage_cycles=120 if tank_id == 3 else 70,
            )

            expected = _expected_curve(t, 1013.25, target)
            pressure = _pressure_curve(
                t=t,
                initial=1013.25,
                target=target,
                volume_liters=tank["volume_liters"],
                effective_speed=effective_speed,
                leak=leak,
            )

            pressure += hose_loss * 0.7

            if sensor_failure_tank == tank_id and t >= 180:
                pressure = -12.0 if (t // 30) % 2 == 0 else 2400.0
                alarms.add("SENSOR_FAILURE_SIMULATED")

            risk = _risk_pct(max(pressure, 0.1), oil_volume, tank["structural_limit_mbar"])
            max_risk = max(max_risk, risk)

            if hose_loss > 20:
                alarms.add("HOSE_LOSS_HIGH")
            if leak > 0.45:
                alarms.add("TANK_LEAK_SUSPECTED")
            if oil_flow < recipe.min_oil_flow_l_min:
                alarms.add("OIL_FLOW_LOW")
            if risk >= recipe.structural_risk_limit:
                alarms.add("STRUCTURAL_COLLAPSE_RISK")

            pressures.append(pressure)
            tanks_step.append(
                {
                    "tank_id": tank_id,
                    "tank_code": tank["code"],
                    "pressure_mbar": round(pressure, 3),
                    "expected_pressure_mbar": round(expected, 3),
                    "deviation_mbar": round(pressure - expected, 3),
                    "hose_loss_mbar": round(hose_loss, 3),
                    "oil_volume_liters": round(oil_volume, 3),
                    "oil_flow_l_min": round(current_oil_flow, 3),
                    "collapse_risk_pct": round(risk, 2),
                }
            )

        if max(pressures) - min(pressures) > recipe.max_tank_difference_mbar:
            alarms.add("TANK_DIFFERENCE_HIGH")
        if t > 240 and sum(pressures) / len(pressures) > 250:
            alarms.add("PRESSURE_NOT_DROPPING")

        timeline.append(
            {
                "t_seconds": t,
                "roots_started": roots_started,
                "oil_flow_l_min": round(current_oil_flow, 3),
                "oil_volume_liters": round(oil_volume, 3),
                "avg_pressure_mbar": round(sum(pressures) / len(pressures), 3),
                "max_risk_pct": round(max_risk, 2),
                "tanks": tanks_step,
            }
        )

        final_pressures = pressures

    status_final = "success"
    if "STRUCTURAL_COLLAPSE_RISK" in alarms or "ROOTS_UNSAFE_START" in alarms or "SENSOR_FAILURE_SIMULATED" in alarms:
        status_final = "critical"
    elif alarms:
        status_final = "warning"

    if status_final == "success":
        diagnostico = "O Gêmeo Digital identificou aderência entre a curva simulada e a curva esperada. A operação permanece segura."
        recomendacao = "Manter parâmetros atuais, registrar o ciclo e seguir monitorando pressão, óleo e alarmes."
    elif status_final == "warning":
        diagnostico = "O Gêmeo Digital detectou desvios relevantes, mas sem atingir condição crítica imediata."
        recomendacao = "Verificar mangueiras, vazamento e diferença entre tanques antes de repetir o ciclo."
    else:
        diagnostico = "O Gêmeo Digital detectou condição crítica com potencial de falha operacional ou risco estrutural."
        recomendacao = "Interromper ou bloquear o ciclo, validar óleo, Roots, sensores e condição do tanque antes de operar."

    result = {
        "scenario": get_scenario(scenario_id),
        "status_final": status_final,
        "timeline": timeline,
        "alarms": sorted(alarms),
        "diagnostico": diagnostico,
        "recomendacao": recomendacao,
        "metricas": {
            "projected_duration_seconds": int(recipe.max_cycle_seconds),
            "projected_final_pressure_mbar": round(sum(final_pressures) / max(len(final_pressures), 1), 3),
            "max_collapse_risk_pct": round(max_risk, 2),
            "roots_started": roots_started,
            "oil_delay_seconds": oil_delay,
            "oil_flow_l_min": oil_flow,
        },
    }
    return result
