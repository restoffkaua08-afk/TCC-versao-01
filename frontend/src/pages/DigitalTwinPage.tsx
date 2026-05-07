import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  Gauge,
  Settings2,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import { RegulatorFromManualResult } from "../components/RegulatorVisual";
import { TwinComparison } from "../components/TwinComparison";
import {
  DataTable,
  DemoBadge,
  fmt,
  Kpi,
  Meter,
  PageHeader,
  StatusBadge,
} from "../components/ui";
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

type TwinMenu = "cenarios" | "parametros" | "resultado" | "diagnostico" | "assistente";

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
  const [menu, setMenu] = useState<TwinMenu>("cenarios");
  const [options, setOptions] = useState<OperationConfigOptions | null>(null);
  const [config, setConfig] = useState<ManualOperationConfig>(defaultConfig);
  const [result, setResult] = useState<ManualOperationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("segura");
  const [error, setError] = useState<string | null>(null);

  const latestWhatIf = whatIfs[0];

  useEffect(() => {
    api
      .configOptions()
      .then((data) => {
        setOptions(data);
        const firstHose = data.hoses[0];
        if (firstHose) {
          setConfig((old) => ({ ...old, hose_id: firstHose.id }));
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Falha ao carregar configurações."),
      );
  }, []);

  const tone =
    result?.status === "critical"
      ? "bad"
      : result?.status === "warning"
        ? "warn"
        : "good";

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

  function update<K extends keyof ManualOperationConfig>(
    key: K,
    value: ManualOperationConfig[K],
  ) {
    setConfig((old) => ({ ...old, [key]: value }));
  }

  function applyPreset(id: string) {
    const preset = options?.presets?.[id];
    if (!preset) return;

    setSelectedPreset(id);
    setConfig({ ...defaultConfig, ...preset.config });
    setResult(null);
    setMenu("parametros");
  }

  async function simulate(nextMenu: TwinMenu = "resultado") {
    setLoading(true);
    setError(null);

    try {
      const response = await api.manualSimulate(config);
      setResult(response);
      setMenu(nextMenu);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao simular operação.");
    } finally {
      setLoading(false);
    }
  }

  const selectedPresetData = selectedPreset ? options?.presets?.[selectedPreset] : null;

  return (
    <section className="page-stack twin-console">
      <PageHeader
        eyebrow="Gêmeo Digital"
        title="Bancada de simulação do processo de vácuo"
        subtitle="Escolha um cenário, ajuste os parâmetros e veja como o sistema prevê risco, falha, pressão, óleo e recomendação antes da operação real."
        actions={<DemoBadge />}
      />

      {error && <div className="error">{error}</div>}

      <section className="twin-explain-card">
        <div>
          <strong>Como usar</strong>
          <span>
            1. Escolha um cenário pronto. 2. Revise os parâmetros. 3. Simule. 4. Veja resultado, gráfico,
            regulador visual, alarmes e recomendação.
          </span>
        </div>
        <StatusBadge tone={tone}>
          {result ? statusLabel(result.status) : "Aguardando simulação"}
        </StatusBadge>
      </section>

      <nav className="twin-step-nav">
        <button className={menu === "cenarios" ? "active" : ""} onClick={() => setMenu("cenarios")}>
          <FlaskConical size={17} />
          Cenários
        </button>
        <button className={menu === "parametros" ? "active" : ""} onClick={() => setMenu("parametros")}>
          <SlidersHorizontal size={17} />
          Parâmetros
        </button>
        <button className={menu === "resultado" ? "active" : ""} onClick={() => setMenu("resultado")}>
          <Gauge size={17} />
          Resultado
        </button>
        <button className={menu === "diagnostico" ? "active" : ""} onClick={() => setMenu("diagnostico")}>
          <ClipboardCheck size={17} />
          Diagnóstico
        </button>
        <button className={menu === "assistente" ? "active" : ""} onClick={() => setMenu("assistente")}>
          <Bot size={17} />
          Assistente
        </button>
      </nav>

      {menu === "cenarios" && (
        <section className="twin-section-card">
          <div className="section-intro">
            <span className="eyebrow">Etapa 1</span>
            <h2>Escolha um cenário pronto</h2>
            <p>
              Esses cenários servem para apresentar à TSEA situações reais: operação segura, óleo insuficiente,
              óleo atrasado, mangueira longa, vazamento e tanque crítico.
            </p>
          </div>

          <div className="scenario-menu-grid">
            {options &&
              Object.entries(options.presets).map(([id, preset]) => {
                const isActive = selectedPreset === id;
                const presetTone =
                  id.includes("oleo") || id.includes("vazamento")
                    ? "bad"
                    : id.includes("mangueira") || id.includes("tanque")
                      ? "warn"
                      : "good";

                return (
                  <button
                    key={id}
                    type="button"
                    className={`scenario-tile ${isActive ? "active" : ""} ${presetTone}`}
                    onClick={() => applyPreset(id)}
                  >
                    <strong>{preset.name}</strong>
                    <span>{preset.description}</span>
                    <small>{isActive ? "Selecionado" : "Selecionar cenário"}</small>
                  </button>
                );
              })}
          </div>

          <div className="next-action-row">
            <button type="button" onClick={() => setMenu("parametros")}>
              Continuar para parâmetros
            </button>
            <button type="button" className="secondary" onClick={() => simulate("resultado")} disabled={loading}>
              {loading ? "Simulando..." : "Simular direto"}
            </button>
          </div>
        </section>
      )}

      {menu === "parametros" && (
        <section className="twin-section-card">
          <div className="section-intro">
            <span className="eyebrow">Etapa 2</span>
            <h2>Parâmetros da simulação</h2>
            <p>
              Aqui ficam os campos que o operador ou apresentador define para testar como o processo se comportaria.
              O Gêmeo Digital usa esses dados para calcular curva, risco, óleo, perda de mangueira e alarmes.
            </p>
          </div>

          {selectedPresetData && (
            <div className="selected-preset-note">
              <strong>{selectedPresetData.name}</strong>
              <span>{selectedPresetData.description}</span>
            </div>
          )}

          <div className="parameter-layout">
            <div className="form-grid">
              <label>
                Tipo do tanque
                <select value={config.tank_type} onChange={(e) => update("tank_type", e.target.value)}>
                  {options &&
                    Object.entries(options.tank_types).map(([key, tank]) => (
                      <option key={key} value={key}>
                        {tank.label}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Mangueira
                <select value={config.hose_id} onChange={(e) => update("hose_id", Number(e.target.value))}>
                  {options?.hoses.map((hose) => (
                    <option key={hose.id} value={hose.id}>
                      {hose.code} · {hose.length_m}m · Ø {hose.diameter_in}"
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Pressão final desejada (mbar)
                <input
                  type="number"
                  step="0.01"
                  value={config.target_pressure_mbar}
                  onChange={(e) => update("target_pressure_mbar", Number(e.target.value))}
                />
              </label>

              <label>
                Pressão para ligar Roots (mbar)
                <input
                  type="number"
                  step="0.01"
                  value={config.roots_start_pressure_mbar}
                  onChange={(e) => update("roots_start_pressure_mbar", Number(e.target.value))}
                />
              </label>

              <label>
                Pressão para desligar bombas (mbar)
                <input
                  type="number"
                  step="0.01"
                  value={config.stop_pressure_mbar}
                  onChange={(e) => update("stop_pressure_mbar", Number(e.target.value))}
                />
              </label>

              <label>
                Vazão de óleo (L/min)
                <input
                  type="number"
                  step="0.1"
                  value={config.oil_flow_l_min}
                  onChange={(e) => update("oil_flow_l_min", Number(e.target.value))}
                />
              </label>

              <label>
                Atraso do óleo (s)
                <input
                  type="number"
                  value={config.oil_delay_seconds}
                  onChange={(e) => update("oil_delay_seconds", Number(e.target.value))}
                />
              </label>

              <label>
                Tempo máximo do ciclo (s)
                <input
                  type="number"
                  value={config.max_cycle_seconds}
                  onChange={(e) => update("max_cycle_seconds", Number(e.target.value))}
                />
              </label>

              <label>
                Velocidade da Roots (Hz)
                <input
                  type="number"
                  value={config.roots_speed_hz}
                  onChange={(e) => update("roots_speed_hz", Number(e.target.value))}
                />
              </label>

              <label>
                Rampa de vácuo
                <select value={config.vacuum_ramp} onChange={(e) => update("vacuum_ramp", e.target.value)}>
                  {options &&
                    Object.entries(options.ramps).map(([key, ramp]) => (
                      <option key={key} value={key}>
                        {ramp.label}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Limite de desvio (mbar)
                <input
                  type="number"
                  value={config.deviation_alert_mbar}
                  onChange={(e) => update("deviation_alert_mbar", Number(e.target.value))}
                />
              </label>

              <label>
                Tanque específico
                <select value={config.selected_tank} onChange={(e) => update("selected_tank", Number(e.target.value))}>
                  <option value={1}>Tanque 1</option>
                  <option value={2}>Tanque 2</option>
                  <option value={3}>Tanque 3</option>
                </select>
              </label>
            </div>

            <div className="simulation-switch-panel">
              <strong>Falhas e correções</strong>
              <label>
                <input
                  type="checkbox"
                  checked={config.hose_correction_enabled}
                  onChange={(e) => update("hose_correction_enabled", e.target.checked)}
                />
                Aplicar correção da mangueira
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.oil_compensation_enabled}
                  onChange={(e) => update("oil_compensation_enabled", e.target.checked)}
                />
                Ativar compensação de óleo
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.simulate_hose_leak}
                  onChange={(e) => update("simulate_hose_leak", e.target.checked)}
                />
                Simular vazamento
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.simulate_sensor_failure}
                  onChange={(e) => update("simulate_sensor_failure", e.target.checked)}
                />
                Simular falha de sensor
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.simulate_plc_loss}
                  onChange={(e) => update("simulate_plc_loss", e.target.checked)}
                />
                Simular perda de comunicação com CLP
              </label>
            </div>
          </div>

          <div className="next-action-row">
            <button type="button" onClick={() => simulate("resultado")} disabled={loading}>
              {loading ? "Simulando..." : "Simular no Gêmeo Digital"}
            </button>
            <button type="button" className="ghost" onClick={() => setMenu("cenarios")}>
              Voltar aos cenários
            </button>
          </div>
        </section>
      )}

      {menu === "resultado" && (
        <section className="twin-section-card">
          <div className="section-intro">
            <span className="eyebrow">Etapa 3</span>
            <h2>Resultado visual da simulação</h2>
            <p>
              O regulador mostra o processo em linguagem visual: azul representa ar/gás interno, vermelho representa
              carga de pressão e amarelo representa óleo.
            </p>
          </div>

          {!result ? (
            <div className="empty-twin-result">
              <strong>Nenhuma simulação executada.</strong>
              <span>Escolha um cenário ou ajuste os parâmetros e clique em simular.</span>
              <button type="button" onClick={() => setMenu("cenarios")}>
                Escolher cenário
              </button>
            </div>
          ) : (
            <>
              <section className={`manual-result-card ${tone}`}>
                <div>
                  <span className="eyebrow">Status final</span>
                  <h2>{statusLabel(result.status)}</h2>
                  <p>{result.diagnosis}</p>
                  <strong>{result.recommendation}</strong>
                </div>

                <div className="manual-result-metrics">
                  <Kpi label="Pressão efetiva" value={fmt(result.metrics.max_effective_pressure_mbar, "mbar")} tone={tone} />
                  <Kpi label="Risco estrutural" value={fmt(result.metrics.max_collapse_risk_pct, "%")} tone={tone} />
                  <Kpi label="Desvio máximo" value={fmt(result.metrics.max_deviation_mbar, "mbar")} tone={tone} />
                  <Kpi
                    label="Tempo estimado"
                    value={result.metrics.estimated_time_seconds ? fmt(result.metrics.estimated_time_seconds, "s") : "--"}
                  />
                </div>
              </section>

              <div className="result-grid">
                <RegulatorFromManualResult result={result} />

                <section className="panel">
                  <div className="panel-title">
                    <div>
                      <h2>Rampa simulada</h2>
                      <p>Pressão real no tanque, pressão esperada e leitura estimada no sensor.</p>
                    </div>
                  </div>
                  <TwinResultChart result={result} />
                </section>
              </div>
            </>
          )}
        </section>
      )}

      {menu === "diagnostico" && (
        <section className="twin-section-card">
          <div className="section-intro">
            <span className="eyebrow">Etapa 4</span>
            <h2>Diagnóstico e alarmes</h2>
            <p>Interpretação do cenário, alarmes projetados, manutenção e comparação com o ciclo atual.</p>
          </div>

          <div className="diagnostic-grid">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Alarmes projetados</h2>
                  <p>Eventos que ocorreriam com os parâmetros simulados.</p>
                </div>
                <StatusBadge tone={tone}>{result?.alarms.length ?? 0} alarmes</StatusBadge>
              </div>

              {result?.alarms.length ? (
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
              ) : (
                <p className="empty-state">Nenhum alarme projetado para a última simulação.</p>
              )}
            </section>

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Gêmeo atual</h2>
                  <p>Indicadores baseados no ciclo em tempo real, quando houver dados.</p>
                </div>
                <StatusBadge>{twin?.bottleneck ?? "Aguardando"}</StatusBadge>
              </div>

              <Meter
                label="Saúde"
                value={twin?.health_index ?? 0}
                tone={(twin?.health_index ?? 0) > 75 ? "good" : "warn"}
              />
              <Meter
                label="Estabilidade"
                value={twin?.stability_index ?? 0}
                tone={(twin?.stability_index ?? 0) > 75 ? "good" : "warn"}
              />

              <ul className="recommendation-list">
                {(twin?.recommendations.length
                  ? twin.recommendations
                  : ["Inicie um ciclo ou execute uma simulação para gerar diagnóstico."]
                ).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2>Comparação por tanque</h2>
                  <p>Operação real simulada x esperado.</p>
                </div>
              </div>
              <TwinComparison state={state} tanks={tanks} />
            </section>

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h2><Wrench size={18} /> Manutenção preditiva</h2>
                  <p>Bombas e mangueiras monitoradas pelo protótipo.</p>
                </div>
              </div>
              <DataTable rows={maintenance.slice(0, 5)} />
            </section>
          </div>
        </section>
      )}

      {menu === "assistente" && (
        <section className="twin-section-card">
          <div className="section-intro">
            <span className="eyebrow">Etapa 5</span>
            <h2>Assistente técnico</h2>
            <p>Pergunte sobre risco, óleo, Roots, pressão, mangueira ou alarmes do cenário.</p>
          </div>

          <section className="panel chat-panel">
            <form onSubmit={onChat}>
              <input value={chatText} onChange={(event) => setChatText(event.target.value)} />
              <button type="submit">
                <Bot size={16} />
                Enviar
              </button>
            </form>

            <p className="assistant-answer">
              {chat?.answer ??
                "Exemplo: explique por que o cenário de óleo atrasado é perigoso e qual ação o operador deve tomar."}
            </p>

            <div className="chips">
              {(chat?.suggested_actions ?? [
                "Verificar óleo",
                "Verificar Roots",
                "Analisar alarmes",
                "Comparar curva real x esperada",
              ]).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>

            {latestWhatIf && <small>Último what-if legado: {latestWhatIf.summary}</small>}
          </section>
        </section>
      )}
    </section>
  );
}

function statusLabel(status: string) {
  if (status === "success") return "Operação segura";
  if (status === "warning") return "Operação com atenção";
  if (status === "critical") return "Operação crítica";
  return status;
}

function TwinResultChart({ result }: { result: ManualOperationResult }) {
  const points = result.timeline;
  const max = Math.max(
    ...points.flatMap((item) => [
      item.real_pressure_mbar,
      item.expected_pressure_mbar,
      item.sensor_pressure_mbar,
      item.effective_pressure_mbar,
    ]),
    10,
  );
  const min = Math.min(
    ...points.flatMap((item) => [
      item.real_pressure_mbar,
      item.expected_pressure_mbar,
      item.sensor_pressure_mbar,
      item.effective_pressure_mbar,
    ]),
    0,
  );
  const span = Math.max(max - min, 1);

  function lineFor(
    key:
      | "real_pressure_mbar"
      | "expected_pressure_mbar"
      | "sensor_pressure_mbar"
      | "effective_pressure_mbar",
  ) {
    return points
      .map((item, index) => {
        const x = (index / Math.max(points.length - 1, 1)) * 100;
        const y = 96 - ((item[key] - min) / span) * 88;
        return `${x},${y}`;
      })
      .join(" ");
  }

  return (
    <div className="chart-panel twin-chart-clean">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Curva do Gêmeo Digital">
        <line x1="0" x2="100" y1="96" y2="96" className="axis" />
        <line x1="0" x2="0" y1="4" y2="96" className="axis" />
        {[20, 40, 60, 80].map((y) => (
          <line key={y} x1="0" x2="100" y1={y} y2={y} className="grid-line" />
        ))}

        <polyline points={lineFor("expected_pressure_mbar")} fill="none" stroke="#475569" strokeDasharray="3 3" strokeWidth="1.8" />
        <polyline points={lineFor("real_pressure_mbar")} fill="none" stroke="#1e5d4b" strokeWidth="2.7" />
        <polyline points={lineFor("sensor_pressure_mbar")} fill="none" stroke="#2563eb" strokeWidth="2" />
        <polyline points={lineFor("effective_pressure_mbar")} fill="none" stroke="#dc2626" strokeWidth="2" />
      </svg>

      <div className="legend">
        <span><i style={{ background: "#1e5d4b" }} /> Pressão real no tanque</span>
        <span><i style={{ background: "#475569" }} /> Pressão esperada</span>
        <span><i style={{ background: "#2563eb" }} /> Leitura estimada no sensor</span>
        <span><i style={{ background: "#dc2626" }} /> Pressão efetiva / risco</span>
      </div>
    </div>
  );
}
