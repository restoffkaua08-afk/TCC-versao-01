import { Bot, ChartLine, Play, Wrench } from "lucide-react";
import { FormEvent } from "react";

import { PressureChart } from "../components/PressureChart";
import { TwinComparison } from "../components/TwinComparison";
import { DataTable, DemoBadge, fmt, Kpi, labels, Meter, PageHeader, StatusBadge } from "../components/ui";
import type { ChatResponse, Maintenance, OperationState, PressureReading, SimulationResult, Tank, TwinState } from "../types/domain";

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
  const latestWhatIf = whatIfs[0];
  const bottleneckTone = twin?.bottleneck?.includes("risco") ? "bad" : twin?.bottleneck?.includes("mangueira") ? "warn" : "good";

  return (
    <section className="page-stack twin-page">
      <PageHeader
        eyebrow="Gêmeo Digital"
        title="Gêmeo Digital do Processo de Vácuo"
        subtitle="Comparação entre processo real simulado e comportamento esperado."
        actions={<DemoBadge />}
      />

      <section className="kpi-grid six">
        <Kpi label="Índice de saúde" value={fmt(twin?.health_index, "%")} tone={(twin?.health_index ?? 100) > 75 ? "good" : "warn"} />
        <Kpi label="Índice de estabilidade" value={fmt(twin?.stability_index, "%")} tone={(twin?.stability_index ?? 100) > 75 ? "good" : "warn"} />
        <Kpi label="Pressão esperada média" value={fmt(twin?.expected_pressure_mbar, "mbar")} />
        <Kpi label="Desvio real x esperado" value={fmt(twin?.pressure_deviation_pct, "%")} tone={(twin?.pressure_deviation_pct ?? 0) > 30 ? "bad" : (twin?.pressure_deviation_pct ?? 0) > 15 ? "warn" : "good"} />
        <Kpi label="Risco estrutural máximo" value={fmt(maxRisk, "%")} tone={maxRisk > 82 ? "bad" : maxRisk > 65 ? "warn" : "good"} />
        <Kpi label="Gargalo identificado" value={twin?.bottleneck ?? "--"} tone={bottleneckTone} />
      </section>

      <section className="grid twin-grid">
        <section className="panel twin-diagnosis">
          <div className="panel-title">
            <div>
              <h2>Diagnóstico automático</h2>
              <p>Recomendações geradas pelo Gêmeo Digital.</p>
            </div>
            <StatusBadge tone={bottleneckTone}>{twin?.bottleneck ?? "Aguardando"}</StatusBadge>
          </div>
          <Meter label="Saúde do sistema" value={twin?.health_index ?? 0} tone={(twin?.health_index ?? 100) > 75 ? "good" : "warn"} />
          <Meter label="Estabilidade" value={twin?.stability_index ?? 0} tone={(twin?.stability_index ?? 100) > 75 ? "good" : "warn"} />
          <ul className="recommendation-list">
            {(twin?.recommendations.length ? twin.recommendations : ["Operação estável. Manter acompanhamento do ciclo."]).map((item) => <li key={item}>{item}</li>)}
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
          <TwinComparison state={state} />
        </section>

        <PressureChart
          history={history}
          tanks={tanks}
          mode="real-expected"
          title="Pressão real x pressão esperada"
          subtitle="Linhas contínuas representam o real simulado; linhas tracejadas representam o esperado."
        />

        <section className="panel">
          <div className="panel-title">
            <div>
              <h2><ChartLine size={18} /> Simulação What-if</h2>
              <p>Cenário integrado de perda por mangueira e vazamento.</p>
            </div>
            <button type="button" onClick={onRunWhatIf}><Play size={16} /> Executar cenário</button>
          </div>
          {latestWhatIf ? (
            <div className="whatif-result">
              <Kpi label="Pressão final estimada" value={fmt(latestWhatIf.projected_final_pressure_mbar, "mbar")} />
              <Kpi label="Risco estimado" value={fmt(latestWhatIf.max_collapse_risk_pct, "%")} tone={latestWhatIf.max_collapse_risk_pct > 82 ? "bad" : "warn"} />
              <p><strong>Alarmes prováveis:</strong> {latestWhatIf.alarms || "Sem alarmes projetados"}</p>
              <p>{latestWhatIf.summary}</p>
            </div>
          ) : <p className="empty-state">Execute um cenário para visualizar o resultado.</p>}
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h2><Wrench size={18} /> Manutenção preditiva</h2>
              <p>Bombas Leybold e mangueiras monitoradas pelo protótipo.</p>
            </div>
            <StatusBadge>{maintenance.length} ativos</StatusBadge>
          </div>
          <DataTable rows={maintenance} labels={labels.maintenance} />
        </section>

        <section className="panel chat-panel">
          <div className="panel-title">
            <div>
              <h2><Bot size={18} /> Assistente técnico</h2>
              <p>Pergunte sobre pressão, Roots, óleo, alarmes ou manutenção.</p>
            </div>
          </div>
          <form onSubmit={onChat}>
            <input value={chatText} onChange={(event) => setChatText(event.target.value)} />
            <button type="submit">Enviar</button>
          </form>
          <p className="assistant-answer">{chat?.answer ?? "Aguardando pergunta do operador."}</p>
          <div className="chips">{chat?.suggested_actions.map((item) => <span key={item}>{item}</span>)}</div>
        </section>
      </section>
    </section>
  );
}
