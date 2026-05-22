from pydantic import BaseModel, Field


class TraceCreate(BaseModel):
    cycle_id: int | None = None
    cycle_code: str = Field(default="CYC-MANUAL", min_length=3)
    operator: str = Field(default="Operador TSEA", min_length=2)
    action: str = Field(min_length=2)
    details: str = ""


class ChatRequest(BaseModel):
    message: str = Field(min_length=2)


class WhatIfRequest(BaseModel):
    scenario_name: str = Field(default="Cenário what-if TSEA", min_length=3)
    recipe_id: int | None = None
    hose_loss_multiplier: float = Field(default=1.15, ge=0.5, le=2.5)
    leak_multiplier: float = Field(default=1.1, ge=0.0, le=3.0)


class CycleStartRequest(BaseModel):
    recipe_id: int | None = None
    operator: str = Field(default="Operador TSEA", min_length=2)


class ScenarioRunRequest(BaseModel):
    custom_notes: str = ""
    override_oil_flow_l_min: float | None = None
    override_oil_delay_seconds: int | None = None
    override_roots_start_pressure_mbar: float | None = None
    override_target_pressure_mbar: float | None = None


class AIChatRequest(BaseModel):
    message: str = Field(min_length=2)
