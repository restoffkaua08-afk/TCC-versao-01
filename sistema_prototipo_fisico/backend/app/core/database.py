from sqlmodel import Session, SQLModel, create_engine, select

from app.core.config import get_settings
from app.models.domain import (
    AlarmEvent,
    Hose,
    MaintenanceInsight,
    Operator,
    PressureReading,
    Recipe,
    SimulationResult,
    Tank,
    TraceEvent,
    User,
    VacuumCycle,
)

settings = get_settings()
engine = create_engine(settings.database_url, echo=False, connect_args={"check_same_thread": False})


def seed_reference_data(session: Session) -> None:
    if not session.exec(select(Operator)).first():
        session.add(Operator(badge_code="TSEA-OP-001", name="Operador TSEA", shift="A", authorization_level="lider"))

    if not session.exec(select(Tank)).first():
        session.add_all(
            [
                Tank(code="TQ-REG-01", type="regulador_grande", volume_liters=1250, structural_limit_mbar=35, status="available", notes="Tanque principal para reguladores grandes."),
                Tank(code="TQ-REG-02", type="regulador_grande", volume_liters=1180, structural_limit_mbar=38, status="available", notes="Tanque pareado para ciclo simultaneo."),
                Tank(code="TQ-REG-03", type="regulador_medio", volume_liters=920, structural_limit_mbar=42, status="available", notes="Tanque auxiliar para ate tres linhas."),
            ]
        )

    if not session.exec(select(Hose)).first():
        session.add_all(
            [
                Hose(code="MG-VAC-10M-A", length_m=10, diameter_in=2.0, material="borracha_vácuo_reforçada", loss_factor=0.62, usage_cycles=42, status="available"),
                Hose(code="MG-VAC-14M-B", length_m=14, diameter_in=2.0, material="borracha_vácuo_reforçada", loss_factor=0.84, usage_cycles=78, status="available"),
                Hose(code="MG-VAC-18M-C", length_m=18, diameter_in=1.5, material="borracha_vácuo_reforçada", loss_factor=1.28, usage_cycles=121, status="attention"),
            ]
        )

    if not session.exec(select(Recipe)).first():
        session.add(
            Recipe(
                name="Reguladores TSEA - Vácuo com óleo",
                tank_type="regulador_grande",
                target_pressure_mbar=6.5,
                roots_start_pressure_mbar=95,
                max_cycle_seconds=900,
                max_tank_difference_mbar=18,
                min_oil_flow_l_min=1.8,
                structural_risk_limit=82,
                alarm_pressure_drop_rate=52,
            )
        )

    if not session.exec(select(User)).first():
        session.add(User(username="operador.tsea", full_name="Operador TSEA", role="operator", active=True))

    session.commit()


def init_db() -> None:
    _ = (AlarmEvent, MaintenanceInsight, PressureReading, SimulationResult, TraceEvent, VacuumCycle)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed_reference_data(session)


def get_session():
    with Session(engine) as session:
        yield session
