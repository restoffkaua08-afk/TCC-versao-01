import type {
 Alarm,
 ChatResponse,
 Hose,
 Maintenance,
 ManualOperationConfig,
 ManualOperationResult,
 OperationConfigOptions,
 OperationState,
 OperationalReport,
 PressureReading,
 Recipe,
 SimulationResult,
 Tank,
 TraceEvent,
 VacuumCycle,
 TwinState,
} from "../types/domain";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
 const response = await fetch(`${API_URL}${path}`, {
 headers: {
 "Content-Type": "application/json",
 ...options?.headers,
 },
 ...options,
 });

 if (!response.ok) {
 throw new Error(`API ${response.status}: ${await response.text()}`);
 }

 return response.json() as Promise<T>;
}

export const api = {
 start: () =>
 request<{ cycle: VacuumCycle; state: OperationState }>("/operation/start", {
 method: "POST",
 body: JSON.stringify({ operator: "Responsável Operacional TSEA" }),
 }),

 tick: () => request<OperationState>("/operation/tick", { method: "POST" }),
 state: () => request<OperationState>("/operation/state"),
 pause: () => request<OperationState>("/operation/pause", { method: "POST" }),
 stop: () => request<OperationState>("/operation/stop", { method: "POST" }),
 emergency: () => request<OperationState>("/operation/emergency", { method: "POST" }),
 reset: () => request<OperationState>("/operation/reset", { method: "POST" }),

 configOptions: () => request<OperationConfigOptions>("/operation/config-options"),
 manualSimulate: (payload: ManualOperationConfig) =>
 request<ManualOperationResult>("/operation/manual-simulate", {
 method: "POST",
 body: JSON.stringify(payload),
 }),

 tanks: () => request<Tank[]>("/tanks"),
 hoses: () => request<Hose[]>("/hoses"),
 recipes: () => request<Recipe[]>("/recipes"),
 cycles: () => request<VacuumCycle[]>("/cycles"),

 cycleDetail: (id: number) =>
 request<{
 cycle: VacuumCycle;
 readings: PressureReading[];
 traces: TraceEvent[];
 alarms: Alarm[];
 }>(`/cycles/${id}`),

 history: () => request<PressureReading[]>("/process/history?limit=180"),
 alarms: () => request<Alarm[]>("/alarms"),
 acknowledge: (id: number) =>
 request<Alarm>(`/alarms/${id}/ack`, { method: "POST" }),

 twin: () => request<TwinState>("/digital-twin"),
 maintenance: () => request<Maintenance[]>("/maintenance/prediction"),
 traces: () => request<TraceEvent[]>("/traceability"),

 createTrace: (payload: Omit<TraceEvent, "id" | "timestamp">) =>
 request<TraceEvent>("/traceability", {
 method: "POST",
 body: JSON.stringify(payload),
 }),

 whatIf: (
 payload = {
 scenario_name: "Perda de Carga por Linha de Vácuo com vazamento leve",
 hose_loss_multiplier: 1.35,
 leak_multiplier: 1.2,
 },
 ) =>
 request<SimulationResult>("/what-if", {
 method: "POST",
 body: JSON.stringify(payload),
 }),

 whatIfHistory: () => request<SimulationResult[]>("/what-if"),

 report: () => request<OperationalReport>("/reports/operational"),

 chat: (message: string) =>
 request<ChatResponse>("/chatbot", {
 method: "POST",
 body: JSON.stringify({ message }),
 }),
};
