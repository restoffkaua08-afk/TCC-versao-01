import json
import math
import random
from dataclasses import dataclass
from datetime import datetime

from sqlmodel import Session, desc, select

from app.models.domain import AlarmEvent, Hose, PressureReading, Recipe, SimulationResult, Tank, TraceEvent, VacuumCycle


@dataclass
class PrimaryPumpSV630B:
    nominal_pumping_speed_m3_h: float = 630
    running: bool = False

    def start(self) -> None:
        self.running = True

    def stop(self) -> None:
        self.running = False

    def drawdown_factor(self) -> float:
        return 0.035 if self.running else 0.0


@dataclass
class RootsPumpWSU2001:
    nominal_pumping_speed_m3_h: float = 2050
    safe_start_pressure_mbar: float = 95
    running: bool = False
    speed_pct: float = 0

    def request_start(self, current_pressure_mbar: float, configured_limit_mbar: float) -> bool:
        self.safe_start_pressure_mbar = configured_limit_mbar
        if current_pressure_mbar <= configured_limit_mbar:
            self.running = True
            self.speed_pct = min(100, max(35, 100 - current_pressure_mbar / max(configured_limit_mbar, 1) * 40))
            return True
        self.running = False
        self.speed_pct = 0
        return False

    def stop(self) -> None:
        self.running = False
        self.speed_pct = 0

    def drawdown_factor(self) -> float:
        return 0.07 * (self.speed_pct / 100) if self.running else 0.0


@dataclass
class TankModel:
    tank: Tank
    pressure_mbar: float = 1013.25
    expected_pressure_mbar: float = 1013.25
    leak_rate_mbar_s: float = 0.0
    oil_volume_liters: float = 0.0

    def collapse_risk(self) -> float:
        vacuum_load = max(0, 1013.25 - self.pressure_mbar)
        structural_window = max(1, 1013.25 - self.tank.structural_limit_mbar)
        return round(min(100, (vacuum_load / structural_window) * 100), 2)


@dataclass
class HoseModel:
    hose: Hose

    def loss_mbar(self, flow_intensity: float) -> float:
        diameter_penalty = 2.0 / max(self.hose.diameter_in, 0.5)
        usage_penalty = 1 + min(0.35, self.hose.usage_cycles / 500)
        return round(self.hose.length_m * self.hose.loss_factor * diameter_penalty * usage_penalty * flow_intensity, 3)


@dataclass
class OilInjectionSystem:
    target_flow_l_min: float
    enabled: bool = True
    fault: bool = False

    def flow(self, elapsed_seconds: int) -> float:
        if not self.enabled or self.fault:
            return 0.0
        warmup = min(1, elapsed_seconds / 120)
        return round(self.target_flow_l_min * warmup * random.uniform(0.88, 1.05), 3)


@dataclass
class PressureSensor:
    tank_id: int
    failure_after_seconds: int | None = None

    def read(self, pressure_mbar: float, elapsed_seconds: int) -> tuple[float, bool]:
        failed = self.failure_after_seconds is not None and elapsed_seconds >= self.failure_after_seconds
        if failed:
            return round(pressure_mbar + random.uniform(80, 160), 3), True
        return round(max(0.1, pressure_mbar + random.uniform(-0.75, 0.75)), 3), False


class DigitalTwinEngine:
    def expected_pressure(self, initial_pressure: float, elapsed_seconds: int, recipe: Recipe, roots_running: bool) -> float:
        primary_curve = initial_pressure * math.exp(-0.0105 * elapsed_seconds)
        roots_curve = initial_pressure * math.exp(-0.018 * max(0, elapsed_seconds - 140)) if roots_running else primary_curve
        return round(max(recipe.target_pressure_mbar, min(primary_curve, roots_curve)), 3)

    def compare(self, readings: list[PressureReading], recipe: Recipe) -> dict:
        if not readings:
            return {
                "health_index": 100,
                "stability_index": 100,
                "expected_pressure_mbar": recipe.target_pressure_mbar,
                "pressure_deviation_pct": 0,
                "bottleneck": "aguardando ciclo",
                "recommendations": ["Iniciar ciclo de vácuo TSEA para calibrar o Gêmeo Digital."],
            }
        latest_by_tank: dict[int, PressureReading] = {}
        for reading in readings:
            latest_by_tank.setdefault(reading.tank_id, reading)
        deviations = [
            abs(item.pressure_mbar - item.expected_pressure_mbar) / max(item.expected_pressure_mbar, 1) * 100 for item in latest_by_tank.values()
        ]
        max_risk = max(item.collapse_risk_pct for item in latest_by_tank.values())
        avg_loss = sum(item.hose_loss_mbar for item in latest_by_tank.values()) / max(len(latest_by_tank), 1)
        deviation = sum(deviations) / max(len(deviations), 1)
        bottleneck = "mangueiras" if avg_loss > 18 else "risco estrutural" if max_risk > recipe.structural_risk_limit else "curva dentro do esperado"
        recommendations = []
        if avg_loss > 18:
            recommendations.append("Revisar comprimento/diâmetro das mangueiras conectadas antes do próximo ciclo.")
        if deviation > 25:
            recommendations.append("Comparar estanqueidade dos tanques com a curva esperada da receita.")
        if max_risk > recipe.structural_risk_limit:
            recommendations.append("Interromper ciclo se o risco estrutural continuar subindo.")
        if not recommendations:
            recommendations.append("Processo aderente ao perfil esperado para reguladores TSEA.")
        return {
            "health_index": round(max(0, 100 - deviation - avg_loss * 0.8), 2),
            "stability_index": round(max(0, 100 - deviation - max_risk * 0.25), 2),
            "expected_pressure_mbar": round(sum(item.expected_pressure_mbar for item in latest_by_tank.values()) / len(latest_by_tank), 3),
            "pressure_deviation_pct": round(deviation, 2),
            "bottleneck": bottleneck,
            "recommendations": recommendations,
        }


class VacuumProcessEngine:
    def __init__(self) -> None:
        self.primary = PrimaryPumpSV630B()
        self.roots = RootsPumpWSU2001()
        self.twin = DigitalTwinEngine()
        self.elapsed_seconds = 0
        self.active_cycle_id: int | None = None
        self.tanks: dict[int, TankModel] = {}
        self.hoses: dict[int, HoseModel] = {}
        self.tank_hose_map: dict[int, int] = {}
        self.sensors: dict[int, PressureSensor] = {}
        self.oil = OilInjectionSystem(target_flow_l_min=1.8)
        self.plc_comm_ok = True
        self.emergency = False
        self.paused = False

    def start_cycle(self, session: Session, recipe_id: int | None = None, operator: str = "Operador TSEA") -> VacuumCycle:
        recipe = self._recipe(session, recipe_id)
        tanks = list(session.exec(select(Tank).limit(3)).all())
        hoses = list(session.exec(select(Hose).limit(3)).all())
        if len(tanks) < 1 or len(hoses) < 1:
            raise ValueError("Cadastre pelo menos um tanque e uma mangueira.")

        cycle = VacuumCycle(
            cycle_code=f"TSEA-VAC-{datetime.utcnow():%Y%m%d%H%M%S}",
            operator=operator,
            recipe_id=recipe.id or 1,
            initial_pressure_mbar=1013.25,
            status="running",
            notes="Ciclo simulado de vácuo em tanques de reguladores TSEA.",
        )
        session.add(cycle)
        session.commit()
        session.refresh(cycle)

        self.active_cycle_id = cycle.id
        self.elapsed_seconds = 0
        self.primary.start()
        self.roots.stop()
        self.oil = OilInjectionSystem(target_flow_l_min=recipe.min_oil_flow_l_min)
        self.paused = False
        self.emergency = False
        self.plc_comm_ok = True
        self.tanks = {}
        self.hoses = {}
        self.tank_hose_map = {}
        self.sensors = {}
        for index, tank in enumerate(tanks):
            leak = 0.0 if index != 2 else 0.08
            self.tanks[tank.id or index + 1] = TankModel(tank=tank, leak_rate_mbar_s=leak)
            hose = hoses[min(index, len(hoses) - 1)]
            self.hoses[hose.id or index + 1] = HoseModel(hose=hose)
            self.tank_hose_map[tank.id or index + 1] = hose.id or index + 1
            self.sensors[tank.id or index + 1] = PressureSensor(tank_id=tank.id or index + 1, failure_after_seconds=690 if index == 1 else None)

        session.add(TraceEvent(cycle_id=cycle.id, cycle_code=cycle.cycle_code, operator=operator, action="cycle_started", details="Bomba primaria Leybold SOGEVAC SV630B ligada."))
        session.commit()
        return cycle

    def tick(self, session: Session) -> dict:
        cycle = self._active_cycle(session)
        recipe = self._recipe(session, cycle.recipe_id)
        if cycle.status != "running" or self.paused:
            return self.state(session)

        self.elapsed_seconds += 15
        avg_pressure = sum(t.pressure_mbar for t in self.tanks.values()) / max(len(self.tanks), 1)
        roots_safe = self.roots.request_start(avg_pressure, recipe.roots_start_pressure_mbar)
        if not roots_safe and avg_pressure <= recipe.roots_start_pressure_mbar:
            self.roots.request_start(avg_pressure, recipe.roots_start_pressure_mbar)

        if self.elapsed_seconds > 720:
            self.oil.fault = True
        if self.elapsed_seconds > 780:
            self.plc_comm_ok = False

        readings: list[PressureReading] = []
        alarms: list[AlarmEvent] = []
        tank_pressures: list[float] = []
        oil_flow = self.oil.flow(self.elapsed_seconds)
        flow_intensity = self.primary.drawdown_factor() * 10 + self.roots.drawdown_factor() * 10

        for tank_id, tank_model in self.tanks.items():
            hose_model = self.hoses[self.tank_hose_map[tank_id]]
            expected = self.twin.expected_pressure(cycle.initial_pressure_mbar, self.elapsed_seconds, recipe, self.roots.running)
            hose_loss = hose_model.loss_mbar(flow_intensity)
            pump_drop = (self.primary.drawdown_factor() + self.roots.drawdown_factor()) * tank_model.pressure_mbar
            volume_penalty = tank_model.tank.volume_liters / 18000
            next_pressure = tank_model.pressure_mbar - pump_drop + hose_loss * 0.18 + tank_model.leak_rate_mbar_s * 15 + volume_penalty
            next_pressure = max(recipe.target_pressure_mbar, next_pressure)
            tank_model.expected_pressure_mbar = expected
            tank_model.pressure_mbar = next_pressure
            tank_model.oil_volume_liters += oil_flow / 4
            sensor_value, sensor_failed = self.sensors[tank_id].read(next_pressure, self.elapsed_seconds)
            risk = tank_model.collapse_risk()
            reading = PressureReading(
                cycle_id=cycle.id or 0,
                tank_id=tank_id,
                pressure_mbar=sensor_value,
                expected_pressure_mbar=expected,
                oil_volume_liters=round(tank_model.oil_volume_liters, 3),
                oil_flow_l_min=oil_flow,
                hose_loss_mbar=hose_loss,
                collapse_risk_pct=risk,
            )
            session.add(reading)
            readings.append(reading)
            tank_pressures.append(sensor_value)
            alarms.extend(self._tank_alarms(recipe, cycle, tank_id, self.tank_hose_map[tank_id], sensor_value, expected, hose_loss, risk, sensor_failed, oil_flow))

        alarms.extend(self._cycle_alarms(recipe, cycle, tank_pressures, avg_pressure))
        for alarm in alarms:
            session.add(alarm)

        cycle.duration_seconds = self.elapsed_seconds
        cycle.final_pressure_mbar = round(sum(tank_pressures) / max(len(tank_pressures), 1), 3)
        if cycle.final_pressure_mbar <= recipe.target_pressure_mbar * 1.05 or cycle.duration_seconds >= recipe.max_cycle_seconds:
            cycle.status = "completed" if cycle.final_pressure_mbar <= recipe.target_pressure_mbar * 1.05 else "alarm"
            cycle.finished_at = datetime.utcnow()
            self.primary.stop()
            self.roots.stop()
            session.add(TraceEvent(cycle_id=cycle.id, cycle_code=cycle.cycle_code, operator=cycle.operator, action="cycle_finished", details=f"Fim automático com pressão final {cycle.final_pressure_mbar} mbar."))
        session.add(cycle)
        session.commit()
        for reading in readings:
            session.refresh(reading)
        return self.state(session, readings=readings, alarms_created=len(alarms))

    def pause(self, session: Session) -> dict:
        self.paused = True
        return self.state(session)

    def stop(self, session: Session) -> dict:
        cycle = self._active_cycle(session)
        cycle.status = "stopped"
        cycle.finished_at = datetime.utcnow()
        cycle.duration_seconds = self.elapsed_seconds
        self.primary.stop()
        self.roots.stop()
        session.add(cycle)
        session.add(TraceEvent(cycle_id=cycle.id, cycle_code=cycle.cycle_code, operator=cycle.operator, action="cycle_stopped", details="Ciclo interrompido pelo operador."))
        session.commit()
        return self.state(session)

    def emergency_stop(self, session: Session) -> dict:
        self.emergency = True
        cycle = self._active_cycle(session)
        session.add(AlarmEvent(cycle_id=cycle.id, code="EMERGENCY_STOP", severity="critical", message="Emergência acionada no painel de operação."))
        return self.stop(session)

    def reset(self, session: Session) -> dict:
        self.active_cycle_id = None
        self.elapsed_seconds = 0
        self.paused = False
        self.emergency = False
        self.primary.stop()
        self.roots.stop()
        return self.state(session)

    def state(self, session: Session, readings: list[PressureReading] | None = None, alarms_created: int = 0) -> dict:
        cycle = self._active_cycle(session, create=False)
        recipe = self._recipe(session, cycle.recipe_id if cycle else None)
        latest_readings = readings or self._latest_readings(session, cycle.id if cycle else None)
        tanks = {tank.id: tank for tank in session.exec(select(Tank)).all()}
        hoses = {hose.id: hose for hose in session.exec(select(Hose)).all()}
        tank_states = []
        for reading in latest_readings:
            tank = tanks.get(reading.tank_id)
            hose_id = self.tank_hose_map.get(reading.tank_id)
            hose = hoses.get(hose_id) if hose_id else None
            tank_states.append(
                {
                    "tank": tank,
                    "hose": hose,
                    "pressure_mbar": reading.pressure_mbar,
                    "expected_pressure_mbar": reading.expected_pressure_mbar,
                    "oil_volume_liters": reading.oil_volume_liters,
                    "oil_flow_l_min": reading.oil_flow_l_min,
                    "hose_loss_mbar": reading.hose_loss_mbar,
                    "collapse_risk_pct": reading.collapse_risk_pct,
                    "status_light": self._status_light(reading, recipe),
                }
            )
        active_alarms = list(session.exec(select(AlarmEvent).where(AlarmEvent.acknowledged == False).order_by(desc(AlarmEvent.timestamp)).limit(50)).all())  # noqa: E712
        return {
            "cycle": cycle,
            "recipe": recipe,
            "tank_states": tank_states,
            "primary_pump": {"model": "Leybold SOGEVAC SV630B", "running": self.primary.running, "speed_m3_h": self.primary.nominal_pumping_speed_m3_h},
            "roots_pump": {"model": "Leybold RUVAC WSU2001", "running": self.roots.running, "speed_pct": round(self.roots.speed_pct, 1), "safe_start_pressure_mbar": recipe.roots_start_pressure_mbar},
            "oil_injection": {"enabled": self.oil.enabled, "fault": self.oil.fault, "target_flow_l_min": recipe.min_oil_flow_l_min},
            "plc_comm_ok": self.plc_comm_ok,
            "paused": self.paused,
            "emergency": self.emergency,
            "alarms_created": alarms_created,
            "active_alarms": active_alarms,
        }

    def what_if(self, session: Session, scenario_name: str, recipe_id: int | None, hose_loss_multiplier: float, leak_multiplier: float) -> SimulationResult:
        recipe = self._recipe(session, recipe_id)
        duration = int(recipe.max_cycle_seconds * min(1.4, max(0.65, 1 + (hose_loss_multiplier - 1) * 0.22 + (leak_multiplier - 1) * 0.18)))
        final_pressure = max(recipe.target_pressure_mbar, recipe.target_pressure_mbar * hose_loss_multiplier + leak_multiplier * 2.4)
        risk = min(100, 68 + (duration / recipe.max_cycle_seconds) * 18 + max(0, leak_multiplier - 1) * 12)
        alarms = []
        if hose_loss_multiplier > 1.3:
            alarms.append("HOSE_LOSS_HIGH")
        if leak_multiplier > 1.25:
            alarms.append("TANK_LEAK_SUSPECTED")
        if risk > recipe.structural_risk_limit:
            alarms.append("STRUCTURAL_COLLAPSE_RISK")
        result = SimulationResult(
            scenario_name=scenario_name,
            recipe_id=recipe.id or 1,
            tank_count=min(3, len(session.exec(select(Tank)).all())),
            projected_duration_seconds=duration,
            projected_final_pressure_mbar=round(final_pressure, 3),
            max_collapse_risk_pct=round(risk, 2),
            roots_started=final_pressure <= recipe.roots_start_pressure_mbar,
            alarms=json.dumps(alarms),
            summary="Cenário what-if TSEA com perdas de mangueira e vazamento ajustados.",
        )
        session.add(result)
        session.commit()
        session.refresh(result)
        return result

    def _recipe(self, session: Session, recipe_id: int | None = None) -> Recipe:
        recipe = session.get(Recipe, recipe_id) if recipe_id else None
        recipe = recipe or session.exec(select(Recipe)).first()
        if not recipe:
            raise ValueError("Nenhuma receita cadastrada.")
        return recipe

    def _active_cycle(self, session: Session, create: bool = True) -> VacuumCycle | None:
        cycle = session.get(VacuumCycle, self.active_cycle_id) if self.active_cycle_id else None
        if cycle:
            return cycle
        cycle = session.exec(select(VacuumCycle).where(VacuumCycle.status == "running").order_by(desc(VacuumCycle.started_at))).first()
        if cycle:
            self.active_cycle_id = cycle.id
            return cycle
        if not create:
            return None
        return self.start_cycle(session)

    def _latest_readings(self, session: Session, cycle_id: int | None) -> list[PressureReading]:
        if not cycle_id:
            return []
        readings = list(session.exec(select(PressureReading).where(PressureReading.cycle_id == cycle_id).order_by(desc(PressureReading.timestamp)).limit(12)).all())
        latest: dict[int, PressureReading] = {}
        for reading in readings:
            latest.setdefault(reading.tank_id, reading)
        return list(latest.values())

    def _tank_alarms(
        self,
        recipe: Recipe,
        cycle: VacuumCycle,
        tank_id: int,
        hose_id: int,
        pressure: float,
        expected: float,
        hose_loss: float,
        risk: float,
        sensor_failed: bool,
        oil_flow: float,
    ) -> list[AlarmEvent]:
        alarms: list[AlarmEvent] = []
        if self.elapsed_seconds > 180 and pressure > expected * 1.35:
            alarms.append(AlarmEvent(cycle_id=cycle.id, tank_id=tank_id, code="PRESSURE_NOT_DROPPING", severity="critical", message="Pressão não caiu no tempo esperado para o tanque."))
        drop_rate = (cycle.initial_pressure_mbar - pressure) / max(self.elapsed_seconds, 1)
        if drop_rate > recipe.alarm_pressure_drop_rate:
            alarms.append(AlarmEvent(cycle_id=cycle.id, tank_id=tank_id, code="PRESSURE_DROP_TOO_FAST", severity="critical", message="Pressão caiu rápido demais; validar válvulas e integridade estrutural."))
        if pressure > expected + 26 and self.elapsed_seconds > 240:
            alarms.append(AlarmEvent(cycle_id=cycle.id, tank_id=tank_id, code="TANK_LEAK_SUSPECTED", severity="warning", message="Possível vazamento no tanque pela divergência contra a curva esperada."))
        if hose_loss > 22:
            alarms.append(AlarmEvent(cycle_id=cycle.id, tank_id=tank_id, hose_id=hose_id, code="HOSE_LOSS_HIGH", severity="warning", message="Perda de carga elevada na mangueira conectada."))
        if sensor_failed:
            alarms.append(AlarmEvent(cycle_id=cycle.id, tank_id=tank_id, code="SENSOR_FAILURE_SIMULATED", severity="critical", message="Falha de sensor simulada na leitura de pressão."))
        if self.oil.fault:
            alarms.append(AlarmEvent(cycle_id=cycle.id, tank_id=tank_id, code="OIL_INJECTION_FAILURE", severity="critical", message="Falha simulada na injeção de óleo."))
        if oil_flow < recipe.min_oil_flow_l_min and self.elapsed_seconds > 150:
            alarms.append(AlarmEvent(cycle_id=cycle.id, tank_id=tank_id, code="OIL_FLOW_LOW", severity="warning", message="Vazão de óleo abaixo do mínimo da receita."))
        if risk > recipe.structural_risk_limit:
            alarms.append(AlarmEvent(cycle_id=cycle.id, tank_id=tank_id, code="STRUCTURAL_COLLAPSE_RISK", severity="critical", message="Risco de colapso estrutural acima do limite configurado."))
        return alarms

    def _cycle_alarms(self, recipe: Recipe, cycle: VacuumCycle, pressures: list[float], avg_pressure: float) -> list[AlarmEvent]:
        alarms: list[AlarmEvent] = []
        if pressures and max(pressures) - min(pressures) > recipe.max_tank_difference_mbar:
            alarms.append(AlarmEvent(cycle_id=cycle.id, code="TANK_DIFFERENCE_HIGH", severity="warning", message="Diferença entre tanques acima do limite da receita."))
        if avg_pressure > recipe.roots_start_pressure_mbar and self.roots.running:
            alarms.append(AlarmEvent(cycle_id=cycle.id, code="ROOTS_UNSAFE_START", severity="critical", message="Bomba Roots acionada fora da faixa segura."))
        if self.elapsed_seconds > recipe.max_cycle_seconds:
            alarms.append(AlarmEvent(cycle_id=cycle.id, code="MAX_CYCLE_TIME_EXCEEDED", severity="critical", message="Tempo maximo de ciclo excedido."))
        if not self.plc_comm_ok:
            alarms.append(AlarmEvent(cycle_id=cycle.id, code="PLC_COMM_LOSS_SIMULATED", severity="critical", message="Perda de comunicação simulada com CLP."))
        if self.emergency:
            alarms.append(AlarmEvent(cycle_id=cycle.id, code="EMERGENCY_STOP", severity="critical", message="Emergência acionada."))
        return alarms

    def _status_light(self, reading: PressureReading, recipe: Recipe) -> str:
        if reading.collapse_risk_pct > recipe.structural_risk_limit or reading.pressure_mbar > reading.expected_pressure_mbar * 1.45:
            return "red"
        if reading.hose_loss_mbar > 18 or reading.oil_flow_l_min < recipe.min_oil_flow_l_min:
            return "yellow"
        return "green"


engine = VacuumProcessEngine()
