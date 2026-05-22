export const API_BASE = "http://127.0.0.1:8000/api";

export async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${body}`);
  }

  return response.json();
}

export async function safeRequest<T = any>(path: string, options: RequestInit = {}) {
  try {
    const data = await request<T>(path, options);
    return { ok: true, data, error: "" };
  } catch (error) {
    return { ok: false, data: null as any, error: error instanceof Error ? error.message : String(error) };
  }
}

export const api = {
  health: () => request("/health"),
  operationState: () => request("/operation/state"),
  tick: () => request("/operation/tick", { method: "POST" }),
  start: () => request("/operation/start", { method: "POST", body: JSON.stringify({ operator: "Operador TSEA" }) }),
  pause: () => request("/operation/pause", { method: "POST" }),
  stop: () => request("/operation/stop", { method: "POST" }),
  reset: () => request("/operation/reset", { method: "POST" }),
  emergency: () => request("/operation/emergency", { method: "POST" }),
  twinOptions: () => request("/digital-twin/config-options"),
  simulate: (payload: any) => request("/digital-twin/simulate", { method: "POST", body: JSON.stringify(payload) }),
  operations: () => request("/records/operations"),
  operationDetail: (id: string) => request(`/records/operations/${id}`),
  resimulateOperation: (id: string) => request(`/records/operations/${id}/resimulate`, { method: "POST" }),
  simulations: () => request("/records/simulations"),
  simulationDetail: (id: string) => request(`/records/simulations/${id}`),
  resimulateSimulation: (id: string) => request(`/records/simulations/${id}/resimulate`, { method: "POST" }),
  convertSimulation: (id: string) => request(`/records/simulations/${id}/convert-to-operation`, { method: "POST" }),
  report: () => request("/reports/operational"),
  alarms: () => request("/alarms"),
  tanks: () => request("/tanks"),
  hoses: () => request("/hoses"),
  recipes: () => request("/recipes"),
  maintenance: () => request("/maintenance/prediction")
};
