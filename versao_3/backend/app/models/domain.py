from datetime import datetime

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    full_name: str
    role: str = "operator"
    active: bool = True


class Operator(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    badge_code: str = Field(index=True, unique=True)
    name: str
    shift: str = "A"
    authorization_level: str = "operacao"
    active: bool = True


class Tank(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True)
    type: str = Field(index=True)
    volume_liters: float
    structural_limit_mbar: float
    status: str = Field(default="available", index=True)
    notes: str = ""


class Hose(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True)
    length_m: float
    diameter_in: float
    material: str
    loss_factor: float
    usage_cycles: int = 0
    status: str = Field(default="available", index=True)


class Recipe(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    tank_type: str = Field(index=True)
    target_pressure_mbar: float
    roots_start_pressure_mbar: float
    max_cycle_seconds: int
    max_tank_difference_mbar: float
    min_oil_flow_l_min: float
    structural_risk_limit: float
    alarm_pressure_drop_rate: float


class VacuumCycle(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    cycle_code: str = Field(index=True, unique=True)
    operator: str = Field(index=True)
    recipe_id: int = Field(foreign_key="recipe.id")
    started_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    finished_at: datetime | None = None
    status: str = Field(default="running", index=True)
    initial_pressure_mbar: float = 1013.25
    final_pressure_mbar: float | None = None
    duration_seconds: int = 0
    notes: str = ""


class PressureReading(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    cycle_id: int = Field(foreign_key="vacuumcycle.id", index=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    tank_id: int = Field(foreign_key="tank.id", index=True)
    pressure_mbar: float
    expected_pressure_mbar: float
    oil_volume_liters: float
    oil_flow_l_min: float
    hose_loss_mbar: float
    collapse_risk_pct: float


class AlarmEvent(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    cycle_id: int | None = Field(default=None, foreign_key="vacuumcycle.id", index=True)
    tank_id: int | None = Field(default=None, foreign_key="tank.id", index=True)
    hose_id: int | None = Field(default=None, foreign_key="hose.id", index=True)
    code: str = Field(index=True)
    severity: str
    message: str
    acknowledged: bool = False


class TraceEvent(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    cycle_id: int | None = Field(default=None, foreign_key="vacuumcycle.id", index=True)
    cycle_code: str = Field(index=True)
    operator: str
    action: str
    details: str


class MaintenanceInsight(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    asset_type: str = Field(index=True)
    asset_code: str = Field(index=True)
    risk_score: float
    remaining_hours: float
    recommendation: str


class SimulationResult(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    scenario_name: str
    recipe_id: int = Field(foreign_key="recipe.id")
    tank_count: int
    projected_duration_seconds: int
    projected_final_pressure_mbar: float
    max_collapse_risk_pct: float
    roots_started: bool
    alarms: str
    summary: str
