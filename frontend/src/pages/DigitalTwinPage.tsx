import { AlertTriangle, Bot, ClipboardCheck, FlaskConical, Gauge, Wrench } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import { PressureChart } from "../components/PressureChart";
import { RegulatorFromManualResult } from "../components/RegulatorVisual";
import { TwinComparison } from "../components/TwinComparison";
import { DataTable, DemoBadge, fmt, Kpi, Meter, PageHeader, StatusBadge } from "../components/ui";
import type {
  ChatResponse,
  Maintenance,
  ManualOperationConfig,
  ManualOperationResult,
  OperationConfigOptions,
  OperationState,
  PressureReading,
  SimulationResult,
  Tank,
  TwinState,
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

export function DigitalTwinPage({
  twin,
  state,
  history,
  tanks,
  whatIfs,
  maintenance,
  maxRisk,
  chatText,
  setChatText,
  chat,
  onChat,
}: {
  twin: TwinState | null;
  state: OperationState | null;
  history: PressureReading[];
  tanks: Tank[];
  whatIfs: SimulationResult[];
  maintenance: Maintenance[];
  maxRisk: number;
  chatText: string;
  setChatText: (value: string) => void;
  chat: ChatResponse | null;
  onChat: (event: FormEvent) => void;
  onRunWhatIf: () => void;
}) {
  const [options, setOptions] = useState<OperationConfigOptions | null>(null);
  const [config, setConfig] = useState<ManualOperationConfig>(defaultConfig);
  const [result, setResult] = useState<ManualOperationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestWhatIf = whatIfs[0];

  useEffect(() => {
    api.configOptions()
      .then((data) => {
        setOptions(data);
        const firstHose = data.hoses[0];
        if (firstHose) setConfig((old) => ({ ...old, hose_id: firstHose.id }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar configurações."));
  }, []);

  const tone = result?.status === "critical" ? "bad" : result?.status === "warning" ? "warn" : "good";

  const resultHistory = useMemo(() => {
    if (!result) return history;
    return result.timeline.map((point, index) => ({
      id: index + 1,
      cycle_id: 0,
      timestamp: String(point.t_seconds),
      tank_id: 1,
      pressure_mbar: point.real_pressure_mbar,
      expected_pressure_mbar: point.expected_pressure_mbar,
      oil_volume_liters: point.oil_volume_liters,
      oil_flow_l_min: result.config.oil_flow_l_min,
      hose_loss_mbar: point.hose_loss_mbar,
      collapse_risk_pct: point.collapse_risk_pct,
    }));
  }, [history, result]);

  function update<K extends keyof ManualOperationConfig>(key: K, value: ManualOperationConfig[K]) {
    setConfig((old) => ({ ...old, [key]: value }));
  }

  function applyPreset(id: string) {
    const preset = options?.presets?.[id];
    if (!preset) return;
    setConfig({ ...defaultConfig, ...preset.config });
    setResult(null);
  }

  async function simulate() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.manualSimulate(config);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao simular operação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page-stack twin-workbench">
      <PageHeader
        eyebrow="Gêmeo Digital"
        title="Simulação inteligente do processo"
        subtitle="Configure uma operação hipotética e veja se ela é segura, crítica ou exige atenção antes de acontecer na fábrica."
        actions={<DemoBadge />}
      />

      {error && <div className="error">{error}</div>}

      <section className="operator-guide">
        <strong>O que esta tela faz?</strong>
        <span>Esta é a bancada de simulação. Aqui você escolhe tanque, mangueira, pressão, óleo, Roots e falhas. O Gêmeo Digital calcula curva, risco, alarmes e recomendações.</span>
      </section>

      <section className="twin-layout">
        <aside className="simulation-control-panel">
          <div className="panel-title">
            <div>
              <h2><FlaskConical size={18} /> Cenários prontos</h2>
              <p>Escolha um cenário para demonstrar sucesso ou falha.</p>
            </div>
          </div>

          <div className="preset-grid">
            {options && Object.entries(options.presets).map(([id, preset]) => (
              <button key={id} type="button" className="preset-card" onClick={() => applyPreset(id)}>
                <strong>{preset.name}</strong>
                <span>{preset.description}</span>
              </button>
            ))}
          </div>

          <div className="panel-title compact-title">
            <div>
              <h2><ClipboardCheck size={18} /> Parâmetros</h2>
              <p>Campos usados no cálculo da simulação.</p>
            </div>
          </div>

          <div className="form-grid">
            <label>Tipo do tanque
              <select value={config.tank_type} onChange={(e) => update("tank_type", e.target.value)}>
                {options && Object.entries(options.tank_types).map(([key, tank]) => <option key={key} value={key}>{tank.label}</option>)}
              </select>
            </label>

            <label>Mangueira
              <select value={config.hose_id} onChange={(e) => update("hose_id", Number(e.target.value))}>
                {options?.hoses.map((hose) => <option key={hose.id} value={hose.id}>{hose.code} · {hose.length_m}m</option>)}
              </select>
            </label>

            <label>Pressão final desejada (mbar)
              <input type="number" step="0.01" value={config.target_pressure_mbar} onChange={(e) => update("target_pressure_mbar", Number(e.target.value))} />
            </label>

            <label>Pressão para ligar Roots (mbar)
              <input type="number" step="0.01" value={config.roots_start_pressure_mbar} onChange={(e) => update("roots_start_pressure_mbar", Number(e.target.value))} />
            </label>

            <label>Pressão para desligar bombas (mbar)
              <input type="number" step="0.01" value={config.stop_pressure_mbar} onChange={(e) => update("stop_pressure_mbar", Number(e.target.value))} />
            </label>

            <label>Vazão de óleo (L/min)
              <input type="number" step="0.1" value={config.oil_flow_l_min} onChange={(e) => update("oil_flow_l_min", Number(e.target.value))} />
            </label>

            <label>Atraso do óleo (s)
              <input type="number" value={config.oil_delay_seconds} onChange={(e) => update("oil_delay_seconds", Number(e.target.value))} />
            </label>

            <label>Tempo máximo (s)
              <input type="number" value={config.max_cycle_seconds} onChange={(e) => update("max_cycle_seconds", Number(e.target.value))} />
            </label>

            <label>Velocidade Roots (Hz)
              <input type="number" value={config.roots_speed_hz} onChange={(e) => update("roots_speed_hz", Number(e.target.value))} />
            </label>

            <label>Rampa de vácuo
              <select value={config.vacuum_ramp} onChange={(e) => update("vacuum_ramp", e.target.value)}>
                {options && Object.entries(options.ramps).map(([key, ramp]) => <option key={key} value={key}>{ramp.label}</option>)}
              </select>
            </label>

            <label>Limite de desvio (mbar)
              <input type="number" value={config.deviation_alert_mbar} onChange={(e) => update("deviation_alert_mbar", Number(e.target.value))} />
            </label>

            <label>Tanque específico
              <select value={config.selected_tank} onChange={(e) => update("selected_tank", Number(e.target.value))}>
                <option value={1}>Tanque 1</option>
                <option value={2}>Tanque 2</option>
                <option value={3}>Tanque 3</option>
              </select>
            </label>
          </div>

          <div className="switch-grid">
            <label><input type="checkbox" checked={config.hose_correction_enabled} onChange={(e) => update("hose_correction_enabled", e.target.checked)} /> Correção da mangueira</label>
            <label><input type="checkbox" checked={config.oil_compensation_enabled} onChange={(e) => update("oil_compensation_enabled", e.target.checked)} /> Compensação de óleo</label>
            <label><input type="checkbox" checked={config.simulate_hose_leak} onChange={(e) => update("simulate_hose_leak", e.target.checked)} /> Simular vazamento</label>
            <label><input type="checkbox" checked={config.simulate_sensor_failure} onChange={(e) => update("simulate_sensor_failure", e.target.checked)} /> Falha de sensor</label>
            <label><input type="checkbox" checked={config.simulate_plc_loss} onChange={(e) => update("simulate_plc_loss", e.target.checked)} /> Perda de comunicação com CLP</label>
          </div>

          <button type="button" className="simulate-main-button" onClick={simulate} disabled={loading}>
            {loading ? "Simulando..." : "Simular no Gêmeo Digital"}
          </button>
        </aside>

        <section className="simulation-result-panel">
          <section className={`manual-result-card ${tone}`}>
            <div>
              <span className="eyebrow">Resultado da simulação</span>
              <h2>{result ? statusLabel(result.status) : "Aguardando simulação"}</h2>
              <p>{result?.diagnosis ?? "Escolha um cenário pronto ou configure os campos manualmente para o Gêmeo Digital analisar."}</p>
              {result && <strong>{result.recommendation}</strong>}
            </div>

            <div className="manual-result-metrics">
              <Kpi label="Pressão efetiva" value={fmt(result?.metrics.max_effective_pressure_mbar, "mbar")} tone={tone} />
              <Kpi label="Risco" value={fmt(result?.metrics.max_collapse_risk_pct, "%")} tone={tone} />
              <Kpi label="Desvio" value={fmt(result?.metrics.max_deviation_mbar, "mbar")} tone={tone} />
              <Kpi label="Tempo estimado" value={result?.metrics.estimated_time_seconds ? fmt(result.metrics.estimated_time_seconds, "s") : "--"} />
            </div>
          </section>

          {result && <RegulatorFromManualResult result={result} />}

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2><Gauge size={18} /> Rampa simulada</h2>
                <p>Pressão real no tanque, pressão esperada e leitura estimada no sensor.</p>
              </div>
            </div>
            <PressureChart history={resultHistory} expected />
          </section>

          {result?.alarms.length ? (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2><AlertTriangle size={18} /> Alarmes projetados</h2>
                  <p>Eventos que ocorreriam com os parâmetros definidos.</p>
                </div>
                <StatusBadge tone={tone}>{result.alarms.length} alarmes</StatusBadge>
              </div>
              <div className="alarm-list">
                {result.alarms.map((alarm) => (
                  <article key={alarm.code} className={`alarm-item ${alarm.severity}`}>
                    <div><strong>{alarm.code}</strong><span>{alarm.message}</span></div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </section>
      </section>

      <section className="grid twin-grid">
        <section className="panel">
          <div className="panel-title">
            <div><h2>Diagnóstico automático atual</h2><p>Baseado no ciclo em tempo real, quando houver dados.</p></div>
            <StatusBadge>{twin?.bottleneck ?? "Aguardando"}</StatusBadge>
          </div>
          <Meter label="Saúde" value={twin?.health_index ?? 0} tone={(twin?.health_index ?? 0) > 75 ? "good" : "warn"} />
          <Meter label="Estabilidade" value={twin?.stability_index ?? 0} tone={(twin?.stability_index ?? 0) > 75 ? "good" : "warn"} />
          <ul className="recommendation-list">
            {(twin?.recommendations.length ? twin.recommendations : ["Inicie um ciclo ou execute uma simulação para gerar diagnóstico."]).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div><h2>Comparação por tanque</h2><p>Operação real simulada x esperado.</p></div>
          </div>
          <TwinComparison state={state} tanks={tanks} />
        </section>

        <section className="panel">
          <div className="panel-title">
            <div><h2><Wrench size={18} /> Manutenção preditiva</h2><p>Bombas e mangueiras monitoradas.</p></div>
          </div>
          <DataTable rows={maintenance.slice(0, 5)} />
        </section>

        <section className="panel chat-panel">
          <div className="panel-title">
            <div><h2><Bot size={18} /> Assistente técnico</h2><p>Pergunte sobre risco, óleo, Roots, pressão ou alarmes.</p></div>
          </div>
          <form onSubmit={onChat}>
            <input value={chatText} onChange={(event) => setChatText(event.target.value)} />
            <button type="submit">Enviar</button>
          </form>
          <p className="assistant-answer">{chat?.answer ?? "Aguardando pergunta do operador."}</p>
          <div className="chips">{chat?.suggested_actions.map((item) => <span key={item}>{item}</span>)}</div>
          {latestWhatIf && <small>Último what-if: {latestWhatIf.summary}</small>}
        </section>
      </section>
    </section>
  );
}

function statusLabel(status: string) {
  if (status === "success") return "Operação segura";
  if (status === "warning") return "Operação com atenção";
  if (status === "critical") return "Operação crítica";
  return status;
}
