import { AlertTriangle, ClipboardCheck, Gauge, Pause, Play, RotateCcw, Settings2, ShieldAlert, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import { AlarmList } from "../components/AlarmList";
import { PressureChart } from "../components/PressureChart";
import { TankCard } from "../components/TankCard";
import { fmt, Kpi, PageHeader, StatusBadge, statusText } from "../components/ui";
import type {
  Alarm,
  Hose,
  ManualOperationConfig,
  ManualOperationResult,
  OperationConfigOptions,
  OperationState,
  PressureReading,
  Recipe,
  Tank,
} from "../types/domain";

const defaultConfig: ManualOperationConfig = {
  tank_type: "medio",
  hose_id: 1,
  target_pressure_mbar: 0.2,
  roots_start_pressure_mbar: 0.6,
  stop_pressure_mbar: 0.2,
  oil_flow_l_min: 2,
  oil_delay_seconds: 2,
  max_cycle_seconds: 1800,
  roots_speed_hz: 65,
  vacuum_ramp: "suave",
  hose_correction_enabled: true,
  oil_compensation_enabled: true,
  selected_tank: 1,
  deviation_alert_mbar: 10,
  simulate_hose_leak: false,
  simulate_sensor_failure: false,
  simulate_plc_loss: false,
};

export function OperationPage({
  state,
  history,
  tanks,
  hoses,
  avgPressure,
  maxRisk,
  activeAlarms,
  generalLight,
  onControl,
}: {
  state: OperationState | null;
  history: PressureReading[];
  tanks: Tank[];
  hoses: Hose[];
  recipes: Recipe[];
  avgPressure?: number;
  maxRisk: number;
  activeAlarms: Alarm[];
  generalLight: string;
  onControl: (action: "start" | "pause" | "stop" | "emergency" | "reset") => void;
  onRefresh: () => void;
}) {
  const [options, setOptions] = useState<OperationConfigOptions | null>(null);
  const [config, setConfig] = useState<ManualOperationConfig>(defaultConfig);
  const [result, setResult] = useState<ManualOperationResult | null>(null);
  const [loadingSim, setLoadingSim] = useState(false);
  const [mode, setMode] = useState<"config" | "live">("config");
  const [error, setError] = useState<string | null>(null);

  const criticalAlarms = activeAlarms.filter((alarm) => alarm.severity === "critical");

  useEffect(() => {
    api.configOptions()
      .then((data) => {
        setOptions(data);
        const firstHose = data.hoses[0] ?? hoses[0];
        if (firstHose) {
          setConfig((old) => ({ ...old, hose_id: firstHose.id }));
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar opções da operação."));
  }, []);

  const currentHose = useMemo(() => {
    return (options?.hoses ?? hoses).find((hose) => hose.id === Number(config.hose_id));
  }, [config.hose_id, hoses, options]);

  function update<K extends keyof ManualOperationConfig>(key: K, value: ManualOperationConfig[K]) {
    setConfig((old) => ({ ...old, [key]: value }));
  }

  function applyPreset(id: string) {
    const preset = options?.presets?.[id];
    if (preset) {
      setConfig({
        ...defaultConfig,
        ...preset.config,
        hose_id: preset.config.hose_id || config.hose_id,
      });
      setResult(null);
    }
  }

  async function simulate() {
    setLoadingSim(true);
    setError(null);
    try {
      const response = await api.manualSimulate(config);
      setResult(response);
      setMode("config");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao simular operação.");
    } finally {
      setLoadingSim(false);
    }
  }

  const resultTone = result?.status === "critical" ? "bad" : result?.status === "warning" ? "warn" : "good";

  return (
    <section className="page-stack operation-clean">
      <PageHeader
        eyebrow="Operação"
        title="Configuração e simulação do ciclo de vácuo"
        subtitle="Defina tanque, mangueira, pressões, óleo, tempo, Roots e falhas simuladas antes de executar a operação."
        actions={
          <div className="page-actions">
            <button type="button" className={mode === "config" ? "" : "ghost"} onClick={() => setMode("config")}>
              Configurar
            </button>
            <button type="button" className={mode === "live" ? "" : "ghost"} onClick={() => setMode("live")}>
              Operação ao vivo
            </button>
          </div>
        }
      />

      {error && <div className="error">{error}</div>}

      <section className="operation-layout">
        <aside className="operation-config-card">
          <div className="panel-title">
            <div>
              <h2><Settings2 size={18} /> Parâmetros da operação</h2>
              <p>Campos necessários para prever se o ciclo será seguro.</p>
            </div>
          </div>

          <div className="preset-row">
            {options && Object.entries(options.presets).map(([id, preset]) => (
              <button key={id} type="button" className="ghost preset-button" onClick={() => applyPreset(id)}>
                {preset.name}
              </button>
            ))}
          </div>

          <div className="form-grid">
            <label>
              Tipo do tanque
              <select value={config.tank_type} onChange={(event) => update("tank_type", event.target.value)}>
                {options && Object.entries(options.tank_types).map(([key, tank]) => (
                  <option key={key} value={key}>{tank.label}</option>
                ))}
              </select>
            </label>

            <label>
              Mangueira
              <select value={config.hose_id} onChange={(event) => update("hose_id", Number(event.target.value))}>
                {(options?.hoses ?? hoses).map((hose) => (
                  <option key={hose.id} value={hose.id}>{hose.code} · {hose.length_m}m · Ø {hose.diameter_in}"</option>
                ))}
              </select>
            </label>

            <label>
              Pressão final desejada (mbar)
              <input type="number" step="0.01" value={config.target_pressure_mbar} onChange={(event) => update("target_pressure_mbar", Number(event.target.value))} />
            </label>

            <label>
              Pressão para ligar Roots (mbar)
              <input type="number" step="0.01" value={config.roots_start_pressure_mbar} onChange={(event) => update("roots_start_pressure_mbar", Number(event.target.value))} />
            </label>

            <label>
              Pressão para desligar bombas (mbar)
              <input type="number" step="0.01" value={config.stop_pressure_mbar} onChange={(event) => update("stop_pressure_mbar", Number(event.target.value))} />
            </label>

            <label>
              Vazão de óleo (L/min)
              <input type="number" step="0.1" value={config.oil_flow_l_min} onChange={(event) => update("oil_flow_l_min", Number(event.target.value))} />
            </label>

            <label>
              Atraso do óleo (s)
              <input type="number" value={config.oil_delay_seconds} onChange={(event) => update("oil_delay_seconds", Number(event.target.value))} />
            </label>

            <label>
              Tempo máximo do ciclo (s)
              <input type="number" value={config.max_cycle_seconds} onChange={(event) => update("max_cycle_seconds", Number(event.target.value))} />
            </label>

            <label>
              Velocidade da Roots (Hz)
              <input type="number" value={config.roots_speed_hz} onChange={(event) => update("roots_speed_hz", Number(event.target.value))} />
            </label>

            <label>
              Rampa de vácuo
              <select value={config.vacuum_ramp} onChange={(event) => update("vacuum_ramp", event.target.value)}>
                {options && Object.entries(options.ramps).map(([key, ramp]) => (
                  <option key={key} value={key}>{ramp.label}</option>
                ))}
              </select>
            </label>

            <label>
              Tanque específico
              <select value={config.selected_tank} onChange={(event) => update("selected_tank", Number(event.target.value))}>
                <option value={1}>Tanque 1</option>
                <option value={2}>Tanque 2</option>
                <option value={3}>Tanque 3</option>
              </select>
            </label>

            <label>
              Limite de desvio (mbar)
              <input type="number" value={config.deviation_alert_mbar} onChange={(event) => update("deviation_alert_mbar", Number(event.target.value))} />
            </label>
          </div>

          <div className="switch-grid">
            <label><input type="checkbox" checked={config.hose_correction_enabled} onChange={(event) => update("hose_correction_enabled", event.target.checked)} /> Correção da mangueira</label>
            <label><input type="checkbox" checked={config.oil_compensation_enabled} onChange={(event) => update("oil_compensation_enabled", event.target.checked)} /> Compensação de óleo</label>
            <label><input type="checkbox" checked={config.simulate_hose_leak} onChange={(event) => update("simulate_hose_leak", event.target.checked)} /> Simular vazamento</label>
            <label><input type="checkbox" checked={config.simulate_sensor_failure} onChange={(event) => update("simulate_sensor_failure", event.target.checked)} /> Falha de sensor</label>
            <label><input type="checkbox" checked={config.simulate_plc_loss} onChange={(event) => update("simulate_plc_loss", event.target.checked)} /> Perda de CLP</label>
          </div>

          <button type="button" className="simulate-main-button" onClick={simulate} disabled={loadingSim}>
            <ClipboardCheck size={18} />
            {loadingSim ? "Simulando..." : "Simular operação"}
          </button>
        </aside>

        <section className="operation-result-area">
          <section className={`operation-status ${result ? resultTone : generalLight}`}>
            <div className="status-main">
              <span className={`beacon ${result ? resultToneToLight(resultTone) : generalLight}`} />
              <div>
                <small>Status da análise</small>
                <strong>{result ? statusLabel(result.status) : statusText(state?.cycle?.status)}</strong>
                <span>{result?.diagnosis ?? state?.cycle?.cycle_code ?? "Configure os parâmetros e execute uma simulação."}</span>
              </div>
            </div>

            <div className="operation-kpis">
              <Kpi label="Pressão média" value={fmt(avgPressure, "mbar")} hint="Operação ao vivo" />
              <Kpi label="Risco projetado" value={fmt(result?.metrics.max_collapse_risk_pct ?? maxRisk, "%")} tone={(result?.metrics.max_collapse_risk_pct ?? maxRisk) > 90 ? "bad" : (result?.metrics.max_collapse_risk_pct ?? maxRisk) > 70 ? "warn" : "good"} />
              <Kpi label="Tempo estimado" value={result?.metrics.estimated_time_seconds ? fmt(result.metrics.estimated_time_seconds, "s") : "--"} hint="até atingir pressão de desligamento" />
              <Kpi label="Mangueira" value={currentHose?.code ?? "--"} hint={currentHose ? `${currentHose.length_m}m · perda ${currentHose.loss_factor}` : "não selecionada"} />
              <Kpi label="Alarmes" value={`${result?.alarms.length ?? activeAlarms.length}`} tone={(result?.alarms.length ?? activeAlarms.length) ? "warn" : "good"} />
            </div>
          </section>

          {result && (
            <section className={`manual-result-card ${resultTone}`}>
              <div>
                <span className="eyebrow">Diagnóstico do Gêmeo Digital</span>
                <h2>{statusLabel(result.status)}</h2>
                <p>{result.diagnosis}</p>
                <strong>{result.recommendation}</strong>
              </div>

              <div className="manual-result-metrics">
                <Kpi label="Pressão efetiva máxima" value={fmt(result.metrics.max_effective_pressure_mbar, "mbar")} tone={resultTone} />
                <Kpi label="Desvio máximo" value={fmt(result.metrics.max_deviation_mbar, "mbar")} tone={result.metrics.max_deviation_mbar > config.deviation_alert_mbar ? "warn" : "good"} />
                <Kpi label="Pressão final real" value={fmt(result.metrics.final_real_pressure_mbar, "mbar")} tone={resultTone} />
                <Kpi label="Pressão no sensor" value={fmt(result.metrics.final_sensor_pressure_mbar, "mbar")} tone={resultTone} />
              </div>
            </section>
          )}

          {result ? <ManualOperationChart result={result} /> : <PressureChart history={history} expected />}

          {result?.alarms.length ? (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2><AlertTriangle size={18} /> Alarmes projetados</h2>
                  <p>Gerados com base nos parâmetros configurados.</p>
                </div>
              </div>
              <div className="alarm-list">
                {result.alarms.map((alarm) => (
                  <article key={alarm.code} className={`alarm-item ${alarm.severity}`}>
                    <div>
                      <strong>{alarm.code}</strong>
                      <span>{alarm.message}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </section>
      </section>

      {mode === "live" && (
        <>
          <section className="tank-rack">
            {state?.tank_states.map((item) => <TankCard key={item.tank.id} item={item} />)}
            {!state?.tank_states.length && tanks.map((tank) => (
              <article key={tank.id} className="tank-card">
                <div className="tank-card-head"><span className="signal green" /><div><strong>{tank.code}</strong><small>{tank.type}</small></div></div>
                <div className="pressure">-- mbar</div>
              </article>
            ))}
          </section>

          <section className="operation-bottom">
            <section className="panel">
              <div className="panel-title">
                <div><h2><Gauge size={18} /> Gráfico ao vivo</h2><p>Pressão x tempo dos tanques simulados.</p></div>
              </div>
              <PressureChart history={history} expected />
            </section>

            <section className="panel">
              <div className="panel-title">
                <div><h2>Comandos</h2><p>Ações do operador para o ciclo simulado.</p></div>
                <StatusBadge>{state?.plc_comm_ok ? "CLP comunicando" : "Sem comunicação"}</StatusBadge>
              </div>
              <div className="command-row vertical">
                <button type="button" onClick={() => onControl("start")}><Play size={16} /> Iniciar ciclo</button>
                <button type="button" className="secondary" onClick={() => onControl("pause")}><Pause size={16} /> Pausar</button>
                <button type="button" className="secondary" onClick={() => onControl("stop")}><Square size={16} /> Parar</button>
                <button type="button" className="danger" onClick={() => onControl("emergency")}><ShieldAlert size={16} /> Emergência</button>
                <button type="button" className="ghost" onClick={() => onControl("reset")}><RotateCcw size={16} /> Reset</button>
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">
                <div><h2>Alarmes recentes</h2><p>Eventos críticos e pendências do processo.</p></div>
                <StatusBadge tone={criticalAlarms.length ? "bad" : "good"}>{criticalAlarms.length} críticos</StatusBadge>
              </div>
              <AlarmList alarms={activeAlarms.slice(0, 5)} />
            </section>
          </section>
        </>
      )}
    </section>
  );
}

function resultToneToLight(tone: string) {
  if (tone === "bad") return "red";
  if (tone === "warn") return "yellow";
  return "green";
}

function statusLabel(status: string) {
  if (status === "success") return "Operação segura";
  if (status === "warning") return "Operação com atenção";
  if (status === "critical") return "Operação crítica";
  return status;
}

function ManualOperationChart({ result }: { result: ManualOperationResult }) {
  const points = result.timeline;
  const max = Math.max(...points.flatMap((item) => [item.real_pressure_mbar, item.expected_pressure_mbar, item.sensor_pressure_mbar]), 10);
  const min = Math.min(...points.flatMap((item) => [item.real_pressure_mbar, item.expected_pressure_mbar, item.sensor_pressure_mbar]), 0);
  const span = Math.max(max - min, 1);

  function lineFor(key: "real_pressure_mbar" | "expected_pressure_mbar" | "sensor_pressure_mbar") {
    return points.map((item, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 96 - ((item[key] - min) / span) * 88;
      return `${x},${y}`;
    }).join(" ");
  }

  return (
    <section className="panel chart-panel">
      <div className="panel-title">
        <div>
          <h2>Curva da simulação configurada</h2>
          <p>Compara pressão esperada, pressão real simulada e leitura estimada no sensor.</p>
        </div>
      </div>

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Curva manual de operação">
        <line x1="0" x2="100" y1="96" y2="96" className="axis" />
        <line x1="0" x2="0" y1="4" y2="96" className="axis" />
        {[20, 40, 60, 80].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} className="grid-line" />)}
        <polyline points={lineFor("expected_pressure_mbar")} fill="none" stroke="#50635c" strokeDasharray="3 3" strokeWidth="1.8" />
        <polyline points={lineFor("real_pressure_mbar")} fill="none" stroke="#1e5d4b" strokeWidth="2.5" />
        <polyline points={lineFor("sensor_pressure_mbar")} fill="none" stroke="#aa382f" strokeWidth="2" />
      </svg>

      <div className="legend">
        <span><i style={{ background: "#1e5d4b" }} /> Pressão real no tanque</span>
        <span><i style={{ background: "#50635c" }} /> Pressão esperada</span>
        <span><i style={{ background: "#aa382f" }} /> Pressão estimada no sensor</span>
      </div>
    </section>
  );
}
