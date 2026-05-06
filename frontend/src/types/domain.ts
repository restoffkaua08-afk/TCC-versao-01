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
