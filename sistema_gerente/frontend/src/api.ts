export const API_BASE = "/api";

async function parseApiError(response: Response): Promise<string> {
  const text = await response.text();

  if (!text) return `Erro HTTP ${response.status}`;

  try {
    const parsed = JSON.parse(text);
    const detail = parsed?.detail ?? parsed?.message ?? parsed?.error ?? parsed;

    if (typeof detail === "string") return detail;
    if (detail?.message) return String(detail.message);

    return JSON.stringify(detail);
  } catch {
    return text;
  }
}

export async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(API_BASE + path, {
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
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
  start: (payload: any = {}) =>
    request("/operation/start", {
      method: "POST",
      body: JSON.stringify({
        recipe_id: payload.recipe_id || "RC-01",
        hose_id: payload.hose_id || "MG-01",
        tank_count: payload.tank_count || 1,
        oil_reservoir_l: payload.oil_reservoir_l || 80,
        operator: payload.operator || "Operador TSEA",
        shift: payload.shift || "MANHA",
      }),
    }),
  pause: () => request("/operation/pause", { method: "POST" }),
  stop: () => request("/operation/stop", { method: "POST" }),
  reset: () => request("/operation/reset", { method: "POST" }),
  emergency: () => request("/operation/emergency", { method: "POST" }),
  twinOptions: () => request("/digital-twin/config-options"),
  simulate: (payload: any) => request("/digital-twin/simulate", { method: "POST", body: JSON.stringify(payload) }),
  operations: () => request("/records/operations"),
  operationDetail: (id: string) => request(`/records/operations/${id}`),
  report: () => request("/reports/operational"),
  alarms: () => request("/alarms"),
  tanks: () => request("/tanks"),
  hoses: () => request("/hoses"),
  recipes: () => request("/recipes"),
  maintenance: () => request("/maintenance/prediction"),
};
