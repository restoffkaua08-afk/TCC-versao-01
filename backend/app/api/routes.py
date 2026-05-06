from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, desc, select

from app.core.database import get_session
from app.models.domain import AlarmEvent, Hose, MaintenanceInsight, PressureReading, Recipe, SimulationResult, Tank, TraceEvent, VacuumCycle
from app.schemas.domain import ChatRequest, CycleStartRequest, TraceCreate, WhatIfRequest
from app.services.alarms import required_alarm_catalog
from app.services.chatbot import answer
from app.services.digital_twin import build_twin_state
from app.services.maintenance import predict_maintenance
from app.services.simulation import engine

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "tsea-vacuum-api", "scope": "tanques_reguladores_tsea"}


@router.post("/operation/start")
def start_cycle(payload: CycleStartRequest, session: Session = Depends(get_session)) -> dict:
    try:
        cycle = engine.start_cycle(session, recipe_id=payload.recipe_id, operator=payload.operator)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"cycle": cycle, "state": engine.state(session)}


@router.post("/operation/tick")
def operation_tick(session: Session = Depends(get_session)) -> dict:
    return engine.tick(session)


@router.post("/simulation/tick")
def simulation_tick(session: Session = Depends(get_session)) -> dict:
    return engine.tick(session)


@router.get("/operation/state")
def operation_state(session: Session = Depends(get_session)) -> dict:
    return engine.state(session)


@router.post("/operation/pause")
def pause(session: Session = Depends(get_session)) -> dict:
    return engine.pause(session)


@router.post("/operation/stop")
def stop(session: Session = Depends(get_session)) -> dict:
    return engine.stop(session)


@router.post("/operation/emergency")
def emergency(session: Session = Depends(get_session)) -> dict:
    return engine.emergency_stop(session)


@router.post("/operation/reset")
def reset(session: Session = Depends(get_session)) -> dict:
    return engine.reset(session)


@router.get("/tanks")
def tanks(session: Session = Depends(get_session)) -> list[Tank]:
    return list(session.exec(select(Tank).order_by(Tank.code)).all())


@router.post("/tanks")
def create_tank(tank: Tank, session: Session = Depends(get_session)) -> Tank:
    session.add(tank)
    session.commit()
    session.refresh(tank)
    return tank


@router.get("/hoses")
def hoses(session: Session = Depends(get_session)) -> list[Hose]:
    return list(session.exec(select(Hose).order_by(Hose.code)).all())


@router.post("/hoses")
def create_hose(hose: Hose, session: Session = Depends(get_session)) -> Hose:
    session.add(hose)
    session.commit()
    session.refresh(hose)
    return hose


@router.get("/recipes")
def recipes(session: Session = Depends(get_session)) -> list[Recipe]:
    return list(session.exec(select(Recipe).order_by(Recipe.name)).all())


@router.post("/recipes")
def create_recipe(recipe: Recipe, session: Session = Depends(get_session)) -> Recipe:
    session.add(recipe)
    session.commit()
    session.refresh(recipe)
    return recipe


@router.get("/cycles")
def cycles(session: Session = Depends(get_session)) -> list[VacuumCycle]:
    return list(session.exec(select(VacuumCycle).order_by(desc(VacuumCycle.started_at)).limit(100)).all())


@router.get("/cycles/{cycle_id}")
def cycle_detail(cycle_id: int, session: Session = Depends(get_session)) -> dict:
    cycle = session.get(VacuumCycle, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Ciclo nao encontrado")
    readings = list(session.exec(select(PressureReading).where(PressureReading.cycle_id == cycle_id).order_by(PressureReading.timestamp)).all())
    traces = list(session.exec(select(TraceEvent).where(TraceEvent.cycle_id == cycle_id).order_by(TraceEvent.timestamp)).all())
    alarms = list(session.exec(select(AlarmEvent).where(AlarmEvent.cycle_id == cycle_id).order_by(AlarmEvent.timestamp)).all())
    return {"cycle": cycle, "readings": readings, "traces": traces, "alarms": alarms}


@router.get("/process/history")
def pressure_history(limit: int = 120, cycle_id: int | None = None, session: Session = Depends(get_session)) -> list[PressureReading]:
    statement = select(PressureReading).order_by(desc(PressureReading.timestamp)).limit(limit)
    if cycle_id:
        statement = select(PressureReading).where(PressureReading.cycle_id == cycle_id).order_by(desc(PressureReading.timestamp)).limit(limit)
    return list(session.exec(statement).all())


@router.get("/alarms")
def alarms(session: Session = Depends(get_session)) -> list[AlarmEvent]:
    return list(session.exec(select(AlarmEvent).order_by(desc(AlarmEvent.timestamp)).limit(150)).all())


@router.get("/alarms/catalog")
def alarm_catalog() -> list[dict]:
    return required_alarm_catalog()


@router.post("/alarms/{alarm_id}/ack")
def acknowledge_alarm(alarm_id: int, session: Session = Depends(get_session)) -> AlarmEvent:
    alarm = session.get(AlarmEvent, alarm_id)
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarme nao encontrado")
    alarm.acknowledged = True
    session.add(alarm)
    session.commit()
    session.refresh(alarm)
    return alarm


@router.post("/traceability")
def create_trace(payload: TraceCreate, session: Session = Depends(get_session)) -> TraceEvent:
    event = TraceEvent(**payload.model_dump())
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


@router.get("/traceability")
def traceability(cycle_id: int | None = None, session: Session = Depends(get_session)) -> list[TraceEvent]:
    statement = select(TraceEvent).order_by(desc(TraceEvent.timestamp)).limit(100)
    if cycle_id:
        statement = select(TraceEvent).where(TraceEvent.cycle_id == cycle_id).order_by(desc(TraceEvent.timestamp)).limit(100)
    return list(session.exec(statement).all())


@router.get("/digital-twin")
def digital_twin(session: Session = Depends(get_session)) -> dict:
    recipe = session.exec(select(Recipe)).first()
    if not recipe:
        raise HTTPException(status_code=400, detail="Cadastre uma receita.")
    readings = list(session.exec(select(PressureReading).order_by(desc(PressureReading.timestamp)).limit(80)).all())
    return build_twin_state(readings, recipe)


@router.post("/what-if")
def what_if(payload: WhatIfRequest, session: Session = Depends(get_session)) -> SimulationResult:
    return engine.what_if(session, payload.scenario_name, payload.recipe_id, payload.hose_loss_multiplier, payload.leak_multiplier)


@router.get("/what-if")
def what_if_history(session: Session = Depends(get_session)) -> list[SimulationResult]:
    return list(session.exec(select(SimulationResult).order_by(desc(SimulationResult.timestamp)).limit(50)).all())


@router.get("/maintenance/prediction")
def maintenance_prediction(session: Session = Depends(get_session)) -> list[MaintenanceInsight]:
    readings = list(session.exec(select(PressureReading).order_by(desc(PressureReading.timestamp)).limit(120)).all())
    hoses = list(session.exec(select(Hose)).all())
    insights = predict_maintenance(readings, hoses)
    for insight in insights:
        session.add(insight)
    session.commit()
    for insight in insights:
        session.refresh(insight)
    return insights


@router.get("/reports/operational")
def operational_report(session: Session = Depends(get_session)) -> dict:
    cycles_count = len(session.exec(select(VacuumCycle)).all())
    alarms_count = len(session.exec(select(AlarmEvent)).all())
    readings = list(session.exec(select(PressureReading).order_by(desc(PressureReading.timestamp)).limit(200)).all())
    avg_final = sum(item.pressure_mbar for item in readings) / max(len(readings), 1)
    max_risk = max([item.collapse_risk_pct for item in readings], default=0)
    return {
        "title": "Relatório operacional TSEA - Vácuo em tanques de reguladores",
        "cycles_count": cycles_count,
        "alarms_count": alarms_count,
        "average_recent_pressure_mbar": round(avg_final, 3),
        "max_recent_collapse_risk_pct": round(max_risk, 2),
        "simulated_assets": ["Leybold SOGEVAC SV630B", "Leybold RUVAC WSU2001", "até 3 tanques", "mangueiras de vácuo"],
    }


@router.post("/chatbot")
def chatbot(payload: ChatRequest, session: Session = Depends(get_session)) -> dict:
    state = engine.state(session)
    cycle = state["cycle"]
    readings = engine._latest_readings(session, cycle.id if cycle else None)
    active_alarms = list(session.exec(select(AlarmEvent).order_by(desc(AlarmEvent.timestamp)).limit(50)).all())
    return answer(payload.message, cycle, readings, active_alarms)
