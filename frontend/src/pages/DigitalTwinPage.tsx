import { AlertTriangle, Bot, CheckCircle2, CircuitBoard, FlaskConical, Play, ShieldAlert, Wrench } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import { PressureChart } from "../components/PressureChart";
import { TwinComparison } from "../components/TwinComparison";
import { DataTable, DemoBadge, fmt, Kpi, Meter, PageHeader, StatusBadge } from "../components/ui";
import type {
  ChatResponse,
  Maintenance,
  OperationState,
  PressureReading,
  ScenarioDefinition,
  ScenarioRunResult,
  SimulationResult,
  Tank,
  TwinState,
} from "../types/domain";

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
  onRunWhatIf,
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
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [scenarioResult, setScenarioResult] = useState<ScenarioRunResult | null>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [aiQuestion, setAiQuestion] = useState("Explique o risco do cenário atual e a ação recomendada.");
  const [aiAnswer, setAiAnswer] = useState<ChatResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    api.scenarios()
      .then(setScenarios)
      .catch((error) => setScenarioError(error instanceof Error ? error.message : "Falha ao carregar cenários."));
  }, []);

  const latestWhatIf = whatIfs[0];

  const scenarioTone = scenarioResult?.status_final === "critical"
    ? "bad"
    : scenarioResult?.status_final === "warning"
      ? "warn"
      : "good";

  const lastTimeline = scenarioResult?.timeline.at(-1);
  const flattenedTimeline = useMemo(() => {
    if (!scenarioResult) return [];
    return scenarioResult.timeline.flatMap((point) =>
      point.tanks.map((tank) => ({
        t_seconds: point.t_seconds,
        tank_id: tank.tank_id,
        pressure_mbar: tank.pressure_mbar,
        expected_pressure_mbar: tank.expected_pressure_mbar,
        collapse_risk_pct: tank.collapse_risk_pct,
        hose_loss_mbar: tank.hose_loss_mbar,
        oil_flow_l_min: tank.oil_flow_l_min,
        oil_volume_liters: tank.oil_volume_liters,
      })),
    );
  }, [scenarioResult]);

  async function runScenario(id: string) {
    setScenarioError(null);
    setRunningScenario(id);
    try {
      const result = await api.runScenario(id);
      setScenarioResult(result);
    } catch (error) {
      setScenarioError(error instanceof Error ? error.message : "Falha ao executar cenário.");
    } finally {
      setRunningScenario(null);
    }
  }

  async function askAI(event: FormEvent) {
    event.preventDefault();
    setAiLoading(true);
    try {
      const response = await api.aiChat(aiQuestion);
      setAiAnswer(response);
    } catch (error) {
      setAiAnswer({
        answer: error instanceof Error ? error.message : "Falha ao consultar assistente.",
        intent: "error",
        suggested_actions: ["Verificar backend", "Verificar chave OpenAI"],
      });
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <section className="page-stack twin-page">
      <PageHeader
        eyebrow="Inteligência do processo"
        title="Gêmeo Digital do Processo de Vácuo"
        subtitle="Compare o comportamento real simulado com o esperado e execute cenários de sucesso e falha para demonstrar o valor da solução."
        actions={<DemoBadge />}
      />

      {scenarioError && <div className="error">{scenarioError}</div>}

      <section className="grid">
        <Kpi
          label="Saúde do sistema"
          value={fmt(twin?.health_index, "%")}
          hint="Estimativa baseada em desvio, alarmes e estabilidade."
          tone={(twin?.health_index ?? 0) > 75 ? "good" : "warn"}
        />
        <Kpi
          label="Estabilidade"
          value={fmt(twin?.stability_index, "%")}
          hint="Aderência entre curva esperada e operação."
          tone={(twin?.stability_index ?? 0) > 75 ? "good" : "warn"}
        />
        <Kpi
          label="Desvio real x esperado"
          value={fmt(twin?.pressure_deviation_pct, "%")}
          hint="Diferença média da pressão."
          tone={(twin?.pressure_deviation_pct ?? 0) > 30 ? "bad" : (twin?.pressure_deviation_pct ?? 0) > 15 ? "warn" : "good"}
        />
        <Kpi
          label="Risco estrutural máximo"
          value={fmt(maxRisk, "%")}
          hint="Maior risco atual entre tanques."
          tone={maxRisk > 82 ? "bad" : maxRisk > 65 ? "warn" : "good"}
        />
      </section>

      <section className="panel wide scenario-lab">
        <div className="panel-title">
          <div>
            <h2><FlaskConical size={18} /> Cenários de demonstração</h2>
            <p>Use estes cenários para mostrar quando a operação dá certo, quando dá errado e como o Gêmeo Digital recomenda ações.</p>
          </div>
          <StatusBadge tone={scenarioTone}>{scenarioResult ? scenarioResult.status_final : "Aguardando cenário"}</StatusBadge>
        </div>

        <div className="scenario-grid">
          {scenarios.map((scenario) => {
            const tone = scenario.expected_result === "critical" ? "bad" : scenario.expected_result === "warning" ? "warn" : "good";
            return (
              <article key={scenario.id} className={`scenario-card ${tone}`}>
                <div className="scenario-card-head">
                  {tone === "good" ? <CheckCircle2 size={20} /> : tone === "warn" ? <AlertTriangle size={20} /> : <ShieldAlert size={20} />}
                  <div>
                    <strong>{scenario.name}</strong>
                    <span>{scenario.expected_result}</span>
                  </div>
                </div>
                <p>{scenario.description}</p>
                <small>{scenario.operator_story}</small>
                <div className="scenario-alarms">
                  {scenario.expected_alarms.length ? scenario.expected_alarms.map((item) => <span key={item}>{item}</span>) : <span>Sem alarmes críticos</span>}
                </div>
                <button type="button" onClick={() => runScenario(scenario.id)} disabled={runningScenario === scenario.id}>
                  <Play size={16} />
                  {runningScenario === scenario.id ? "Executando..." : "Executar cenário"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {scenarioResult && (
        <section className={`scenario-result ${scenarioTone}`}>
          <div>
            <span className="eyebrow">Resultado da simulação</span>
            <h2>{scenarioResult.scenario.name}</h2>
            <p>{scenarioResult.diagnostico}</p>
            <strong>{scenarioResult.recomendacao}</strong>
          </div>
          <div className="scenario-result-kpis">
            <Kpi label="Pressão final projetada" value={fmt(scenarioResult.metricas.projected_final_pressure_mbar, "mbar")} tone={scenarioTone} />
            <Kpi label="Risco máximo" value={fmt(scenarioResult.metricas.max_collapse_risk_pct, "%")} tone={scenarioTone} />
            <Kpi label="Óleo" value={`${fmt(scenarioResult.metricas.oil_flow_l_min, "L/min")}`} hint={`Atraso ${scenarioResult.metricas.oil_delay_seconds}s`} tone={scenarioTone} />
            <Kpi label="Roots" value={scenarioResult.metricas.roots_started ? "Partiu" : "Não partiu"} tone={scenarioTone} />
          </div>
        </section>
      )}

      <section className="grid twin-grid">
        <section className="panel twin-diagnosis">
          <div className="panel-title">
            <div>
              <h2><CircuitBoard size={18} /> Diagnóstico automático</h2>
              <p>Recomendações geradas pelo Gêmeo Digital.</p>
            </div>
            <StatusBadge tone={twin?.bottleneck?.includes("risco") ? "bad" : twin?.bottleneck?.includes("mangueira") ? "warn" : "good"}>
              {twin?.bottleneck ?? "Aguardando"}
            </StatusBadge>
          </div>

          <Meter label="Saúde" value={twin?.health_index ?? 0} tone={(twin?.health_index ?? 0) > 75 ? "good" : "warn"} />
          <Meter label="Estabilidade" value={twin?.stability_index ?? 0} tone={(twin?.stability_index ?? 0) > 75 ? "good" : "warn"} />

          <ul className="recommendation-list">
            {(twin?.recommendations.length ? twin.recommendations : ["Operação estável. Manter acompanhamento do ciclo."]).map((item) => (
              <li key={item}>{item}</li>
            ))}
            {state?.oil_injection.fault && <li>Verificar injeção de óleo antes de reiniciar o ciclo.</li>}
            {!state?.plc_comm_ok && <li>Validar comunicação com CLP e sensores de pressão.</li>}
          </ul>
        </section>

        <section className="panel twin-comparison-panel">
          <div className="panel-title">
            <div>
              <h2>Comparação por tanque</h2>
              <p>Pressão real simulada, pressão esperada e desvio.</p>
            </div>
          </div>
          <TwinComparison state={state} tanks={tanks} />
        </section>

        <section className="panel wide">
          <div className="panel-title">
            <div>
              <h2>Curva de cenário: real x esperado</h2>
              <p>Mostra a diferença entre a operação simulada e o comportamento esperado.</p>
            </div>
          </div>

          {scenarioResult ? (
            <ScenarioChart timeline={scenarioResult.timeline} />
          ) : (
            <PressureChart history={history} expected />
          )}
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h2><Play size={18} /> What-if antigo</h2>
              <p>Cenário simples legado de mangueira e vazamento.</p>
            </div>
            <button type="button" className="ghost" onClick={onRunWhatIf}>Executar</button>
          </div>

          {latestWhatIf ? (
            <div className="whatif-result">
              <Kpi label="Risco projetado" value={fmt(latestWhatIf.max_collapse_risk_pct, "%")} tone={latestWhatIf.max_collapse_risk_pct > 82 ? "bad" : "warn"} />
              <p>Alarmes prováveis: {latestWhatIf.alarms || "Sem alarmes projetados"}</p>
              <p>{latestWhatIf.summary}</p>
            </div>
          ) : (
            <p className="empty-state">Execute um cenário para visualizar o resultado.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h2><Wrench size={18} /> Manutenção preditiva</h2>
              <p>Bombas Leybold e mangueiras monitoradas pelo protótipo.</p>
            </div>
            <StatusBadge>{maintenance.length} ativos</StatusBadge>
          </div>
          <DataTable rows={maintenance.slice(0, 5)} />
        </section>

        <section className="panel chat-panel">
          <div className="panel-title">
            <div>
              <h2><Bot size={18} /> Assistente técnico com contexto</h2>
              <p>Usa OpenAI quando houver chave configurada. Sem chave, usa fallback local.</p>
            </div>
          </div>

          <form onSubmit={askAI}>
            <input value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} />
            <button type="submit" disabled={aiLoading}>{aiLoading ? "Analisando..." : "Perguntar à IA"}</button>
          </form>

          <p className="assistant-answer">{aiAnswer?.answer ?? chat?.answer ?? "Pergunte sobre risco, óleo, Roots, alarmes ou cenários."}</p>

          <form onSubmit={onChat} className="legacy-chat-form">
            <input value={chatText} onChange={(event) => setChatText(event.target.value)} />
            <button type="submit" className="ghost">Chat local</button>
          </form>

          <div className="chips">
            {(aiAnswer?.suggested_actions ?? chat?.suggested_actions ?? []).map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>
      </section>
    </section>
  );
}

function ScenarioChart({ timeline }: { timeline: ScenarioRunResult["timeline"] }) {
  const points = timeline.slice(-40);
  const tanks = [1, 2, 3];
  const colors = ["#1e5d4b", "#b97820", "#aa382f"];
  const max = Math.max(...points.flatMap((item) => item.tanks.map((tank) => tank.pressure_mbar)), 100);
  const min = Math.min(...points.flatMap((item) => item.tanks.map((tank) => tank.pressure_mbar)), 0);
  const span = Math.max(max - min, 1);

  function polyline(tankId: number, expected = false) {
    const series = points.map((item) => {
      const tank = item.tanks.find((entry) => entry.tank_id === tankId);
      return expected ? tank?.expected_pressure_mbar ?? 0 : tank?.pressure_mbar ?? 0;
    });

    return series
      .map((value, index) => {
        const x = (index / Math.max(series.length - 1, 1)) * 100;
        const y = 96 - ((value - min) / span) * 88;
        return `${x},${y}`;
      })
      .join(" ");
  }

  return (
    <div className="chart-panel scenario-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Curva de cenário">
        <line x1="0" x2="100" y1="96" y2="96" className="axis" />
        <line x1="0" x2="0" y1="4" y2="96" className="axis" />
        {[20, 40, 60, 80].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} className="grid-line" />)}
        {tanks.map((tankId, index) => (
          <g key={tankId}>
            <polyline points={polyline(tankId)} fill="none" stroke={colors[index]} strokeWidth="2.2" />
            <polyline points={polyline(tankId, true)} fill="none" stroke={colors[index]} strokeDasharray="3 3" strokeOpacity="0.48" strokeWidth="1.5" />
          </g>
        ))}
      </svg>
      <div className="legend">
        {tanks.map((tankId, index) => (
          <span key={tankId}><i style={{ background: colors[index] }} /> Tanque {tankId}: real / esperado</span>
        ))}
      </div>
    </div>
  );
}
