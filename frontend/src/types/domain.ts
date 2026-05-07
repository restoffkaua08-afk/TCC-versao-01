export type Tank = {
  id: number;
  code: string;
  type: string;
  volume_liters: number;
  structural_limit_mbar: number;
  status: string;
  notes: string;
};

export type Hose = {
  id: number;
  code: string;
  length_m: number;
  diameter_in: number;
  material: string;
  loss_factor: number;
  usage_cycles: number;
  status: string;
};

export type Recipe = {
  id: number;
  name: string;
  tank_type: string;
  target_pressure_mbar: number;
  roots_start_pressure_mbar: number;
  max_cycle_seconds: number;
  max_tank_difference_mbar: number;
  min_oil_flow_l_min: number;
  structural_risk_limit: number;
  alarm_pressure_drop_rate: number;
};

export type VacuumCycle = {
  id: number;
  cycle_code: string;
  operator: string;
  recipe_id: number;
  started_at: string;
  finished_at?: string | null;
  status: string;
  initial_pressure_mbar: number;
  final_pressure_mbar?: number | null;
  duration_seconds: number;
  notes: string;
};

export type PressureReading = {
  id: number;
  cycle_id: number;
  timestamp: string;
  tank_id: number;
  pressure_mbar: number;
  expected_pressure_mbar: number;
  oil_volume_liters: number;
  oil_flow_l_min: number;
  hose_loss_mbar: number;
  collapse_risk_pct: number;
};

export type TankState = {
  tank: Tank;
  hose?: Hose | null;
  pressure_mbar: number;
  expected_pressure_mbar: number;
  oil_volume_liters: number;
  oil_flow_l_min: number;
  hose_loss_mbar: number;
  collapse_risk_pct: number;
  status_light: "green" | "yellow" | "red" | string;
};

export type Alarm = {
  id: number;
  timestamp: string;
  cycle_id?: number | null;
  tank_id?: number | null;
  hose_id?: number | null;
  code: string;
  severity: "warning" | "critical" | string;
  message: string;
  acknowledged: boolean;
};

export type TraceEvent = {
  id: number;
  timestamp: string;
  cycle_id?: number | null;
  cycle_code: string;
  operator: string;
  action: string;
  details: string;
};

export type TwinState = {
  health_index: number;
  stability_index: number;
  expected_pressure_mbar: number;
  pressure_deviation_pct: number;
  bottleneck: string;
  recommendations: string[];
};

export type Maintenance = {
  id: number;
  asset_type: string;
  asset_code: string;
  risk_score: number;
  remaining_hours: number;
  recommendation: string;
  timestamp: string;
};

export type SimulationResult = {
  id: number;
  timestamp: string;
  scenario_name: string;
  recipe_id: number;
  tank_count: number;
  projected_duration_seconds: number;
  projected_final_pressure_mbar: number;
  max_collapse_risk_pct: number;
  roots_started: boolean;
  alarms: string;
  summary: string;
};

export type OperationState = {
  cycle?: VacuumCycle | null;
  recipe: Recipe;
  tank_states: TankState[];
  primary_pump: { model: string; running: boolean; speed_m3_h: number };
  roots_pump: { model: string; running: boolean; speed_pct: number; safe_start_pressure_mbar: number };
  oil_injection: { enabled: boolean; fault: boolean; target_flow_l_min: number };
  plc_comm_ok: boolean;
  paused: boolean;
  emergency: boolean;
  alarms_created: number;
  active_alarms: Alarm[];
};

export type ChatResponse = {
  answer: string;
  intent: string;
  suggested_actions: string[];
};

export type OperationalReport = {
  title: string;
  cycles_count: number;
  alarms_count: number;
  average_recent_pressure_mbar: number;
  max_recent_collapse_risk_pct: number;
  simulated_assets: string[];
};

export type ScenarioDefinition = {
  id: string;
  name: string;
  description: string;
  expected_result: string;
  expected_alarms: string[];
  operator_story: string;
  parameters: Record<string, unknown>;
};

export type ScenarioTankPoint = {
  tank_id: number;
  tank_code: string;
  pressure_mbar: number;
  expected_pressure_mbar: number;
  deviation_mbar: number;
  hose_loss_mbar: number;
  oil_volume_liters: number;
  oil_flow_l_min: number;
  collapse_risk_pct: number;
};

export type ScenarioTimelinePoint = {
  t_seconds: number;
  roots_started: boolean;
  oil_flow_l_min: number;
  oil_volume_liters: number;
  avg_pressure_mbar: number;
  max_risk_pct: number;
  tanks: ScenarioTankPoint[];
};

export type ScenarioRunResult = {
  simulation_id?: number;
  scenario: ScenarioDefinition;
  status_final: "success" | "warning" | "critical" | string;
  timeline: ScenarioTimelinePoint[];
  alarms: string[];
  diagnostico: string;
  recomendacao: string;
  metricas: {
    projected_duration_seconds: number;
    projected_final_pressure_mbar: number;
    max_collapse_risk_pct: number;
    roots_started: boolean;
    oil_delay_seconds: number;
    oil_flow_l_min: number;
  };
};

export type OperationConfigOptions = {
  tank_types: Record<string, { label: string; volume_liters: number; structural_limit_mbar: number; description: string }>;
  ramps: Record<string, { label: string; factor: number }>;
  presets: Record<string, { name: string; description: string; config: ManualOperationConfig }>;
  hoses: Hose[];
  fields: string[];
};

export type ManualOperationConfig = {
  tank_type: string;
  hose_id: number;
  target_pressure_mbar: number;
  roots_start_pressure_mbar: number;
  stop_pressure_mbar: number;
  oil_flow_l_min: number;
  oil_delay_seconds: number;
  max_cycle_seconds: number;
  roots_speed_hz: number;
  vacuum_ramp: string;
  hose_correction_enabled: boolean;
  oil_compensation_enabled: boolean;
  selected_tank: number;
  deviation_alert_mbar: number;
  simulate_hose_leak: boolean;
  simulate_sensor_failure: boolean;
  simulate_plc_loss: boolean;
};

export type ManualOperationResult = {
  status: "success" | "warning" | "critical" | string;
  config: ManualOperationConfig;
  tank: { label: string; volume_liters: number; structural_limit_mbar: number; description: string };
  hose: Hose;
  ramp: { label: string; factor: number };
  timeline: Array<{
    t_seconds: number;
    expected_pressure_mbar: number;
    real_pressure_mbar: number;
    sensor_pressure_mbar: number;
    hose_loss_mbar: number;
    oil_volume_liters: number;
    effective_pressure_mbar: number;
    collapse_risk_pct: number;
    roots_started: boolean;
  }>;
  alarms: Array<{ code: string; severity: string; message: string }>;
  metrics: {
    estimated_time_seconds?: number | null;
    max_effective_pressure_mbar: number;
    max_collapse_risk_pct: number;
    max_deviation_mbar: number;
    final_real_pressure_mbar?: number | null;
    final_sensor_pressure_mbar?: number | null;
    roots_started: boolean;
  };
  diagnosis: string;
  recommendation: string;
};
