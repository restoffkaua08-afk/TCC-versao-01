import { useEffect, useMemo, useState } from "react";

type HardwareBridgePanelProps = {
  variant: "ihm" | "gerente";
};

type HardwareState = {
  ok?: boolean;
  mode?: string;
  state?: any;
  desired_outputs?: any;
};

async function apiRequest(path: string, options: RequestInit = {}) {
  const response = await fetch("/api" + path, {
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const text = await response.text();

  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(data?.detail || data?.message || text || `HTTP ${response.status}`);
  }

  return data;
}

function boolLabel(value: unknown) {
  return value ? "ON" : "OFF";
}

function statusClass(value: unknown) {
  return value ? "ok" : "bad";
}

export function HardwareBridgePanel({ variant }: HardwareBridgePanelProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<HardwareState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const result = await apiRequest("/hardware/state");
      setData(result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function setMode(mode: string) {
    setBusy(true);
    try {
      await apiRequest("/hardware/mode", {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function resetBridge() {
    setBusy(true);
    try {
      await apiRequest("/hardware/reset", { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const state = data?.state || {};
  const hardware = state?.hardware || {};
  const desired = data?.desired_outputs || {};
  const outputs = desired?.outputs || {};
  const ack = hardware?.last_command_ack || {};
  const mode = data?.mode || hardware?.mode || state?.mode || "SIMULADO";

  const summary = useMemo(() => {
    const plc = hardware?.plc_online !== false;
    const sensor = hardware?.sensor_online !== false;
    const emergency = hardware?.emergency === true;

    if (error) return { label: "ERRO", tone: "bad" };
    if (emergency) return { label: "EMERGENCIA", tone: "bad" };
    if (!plc || !sensor) return { label: "ATENCAO", tone: "warn" };
    if (mode !== "SIMULADO") return { label: "FISICO", tone: "ok" };

    return { label: "SIMULADO", tone: "neutral" };
  }, [error, hardware, mode]);

  return (
    <div className={`hardwareDock ${variant} ${open ? "open" : ""}`}>
      <button className={`hardwareDockButton ${summary.tone}`} onClick={() => setOpen(!open)}>
        <span>PLC</span>
        <strong>{summary.label}</strong>
      </button>

      {open && (
        <section className="hardwarePanel">
          <div className="hardwarePanelHeader">
            <div>
              <span>{variant === "ihm" ? "IHM - conexao fisica" : "Gerente - diagnostico fisico"}</span>
              <h3>PLC / ESP32 / Gateway</h3>
            </div>
            <button className="hardwareClose" onClick={() => setOpen(false)}>X</button>
          </div>

          {error && (
            <div className="hardwareError">
              <b>Falha de comunicacao</b>
              <span>{error}</span>
            </div>
          )}

          <div className="hardwareGrid">
            <article>
              <span>Modo</span>
              <strong>{mode}</strong>
            </article>

            <article className={statusClass(hardware?.plc_online !== false)}>
              <span>PLC</span>
              <strong>{hardware?.plc_online === false ? "OFFLINE" : "ONLINE"}</strong>
            </article>

            <article className={statusClass(hardware?.sensor_online !== false)}>
              <span>Sensor</span>
              <strong>{hardware?.sensor_online === false ? "OFFLINE" : "ONLINE"}</strong>
            </article>

            <article className={hardware?.emergency ? "bad" : "ok"}>
              <span>Emergencia</span>
              <strong>{hardware?.emergency ? "ATIVA" : "LIVRE"}</strong>
            </article>

            <article>
              <span>Ultimo pacote</span>
              <strong>{hardware?.last_ingest_at || "--"}</strong>
            </article>

            <article>
              <span>Comando</span>
              <strong>{desired?.command_id || "--"}</strong>
            </article>
          </div>

          <div className="hardwareOutputs">
            <h4>Saidas desejadas pelo Gateway</h4>
            <div>
              <span>B1 / bomba</span><b>{boolLabel(outputs?.pump_b1)}</b>
              <span>B2 / Roots</span><b>{boolLabel(outputs?.pump_b2)}</b>
              <span>Oleo</span><b>{boolLabel(outputs?.oil_valve)}</b>
              <span>Verde</span><b>{boolLabel(outputs?.alarm_green)}</b>
              <span>Amarelo</span><b>{boolLabel(outputs?.alarm_yellow)}</b>
              <span>Vermelho</span><b>{boolLabel(outputs?.alarm_red)}</b>
              <span>Parada</span><b>{boolLabel(outputs?.emergency_stop)}</b>
            </div>
          </div>

          <div className="hardwareOutputs">
            <h4>Confirmacao do PLC</h4>
            <div>
              <span>Recebido em</span><b>{ack?.received_at || "--"}</b>
              <span>Aplicado</span><b>{ack?.applied === true ? "SIM" : ack?.applied === false ? "NAO" : "--"}</b>
              <span>Mensagem</span><b>{ack?.message || "--"}</b>
            </div>
          </div>

          {variant === "gerente" && (
            <div className="hardwareActions">
              <button disabled={busy} onClick={() => setMode("SIMULADO")}>SIMULADO</button>
              <button disabled={busy} onClick={() => setMode("BANCADA_SEGURA")}>BANCADA SEGURA</button>
              <button disabled={busy} onClick={() => setMode("FISICO_HTTP")}>FISICO HTTP</button>
              <button disabled={busy} className="danger" onClick={resetBridge}>RESET PONTE</button>
            </div>
          )}

          <p className="hardwareNote">
            O PLC/ESP32 deve ler /api/hardware/desired-outputs e enviar leituras para /api/hardware/ingest.
          </p>
        </section>
      )}
    </div>
  );
}