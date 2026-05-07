import type { Alarm, OperationState, OperationalReport, PressureReading, TraceEvent, VacuumCycle } from "../types/domain";
import { DataTable, fmt, Kpi, labels, PageHeader } from "../components/ui";

export function ReportsPage({
  report,
  cycles,
  alarms,
  history,
  state,
  traces,
}: {
  report: OperationalReport | null;
  cycles: VacuumCycle[];
  alarms: Alarm[];
  history: PressureReading[];
  state: OperationState | null;
  traces: TraceEvent[];
}) {
  const avgCycleTime = cycles.length ? cycles.reduce((sum, cycle) => sum + cycle.duration_seconds, 0) / cycles.length : 0;
  const avgRisk = history.length ? history.reduce((sum, item) => sum + item.collapse_risk_pct, 0) / history.length : 0;
  const hoseLosses = (state?.tank_states ?? [])
    .map((item) => ({ mangueira: item.hose?.code ?? "Sem mangueira", perda_mbar: item.hose_loss_mbar }))
    .sort((a, b) => b.perda_mbar - a.perda_mbar);

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Relatórios"
        title="Dashboard gerencial TSEA"
        subtitle="Indicadores executivos, impactos esperados e dados recentes do processo."
      />

      <section className="kpi-grid four">
        <Kpi label="Total de ciclos" value={`${report?.cycles_count ?? cycles.length}`} />
        <Kpi label="Alarmes do período" value={`${report?.alarms_count ?? alarms.length}`} tone={alarms.length ? "warn" : "good"} />
        <Kpi label="Tempo médio de ciclo" value={fmt(avgCycleTime, "s")} />
        <Kpi label="Risco médio" value={fmt(avgRisk, "%")} tone={avgRisk > 65 ? "warn" : "good"} />
      </section>

      <section className="grid">
        <section className="panel executive-summary">
          <div className="panel-title">
            <div>
              <h2>Resumo executivo</h2>
              <p>Mensagem para apresentação da solução.</p>
            </div>
          </div>
          <p className="big">A solução centraliza operação, rastreabilidade, Gêmeo Digital e manutenção preditiva em uma interface industrial limpa para reduzir incerteza operacional.</p>
          <ul className="impact-list">
            <li>Mais previsibilidade no ciclo de vácuo.</li>
            <li>Menor risco de partida indevida da Roots.</li>
            <li>Melhor identificação de vazamento e perda de carga.</li>
            <li>Base técnica para manutenção de bombas e mangueiras.</li>
          </ul>
        </section>
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Mangueiras com maior perda</h2>
              <p>Perda de carga atual por linha.</p>
            </div>
          </div>
          <DataTable rows={hoseLosses} />
        </section>
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Ativos simulados</h2>
              <p>Escopo demonstrado para TSEA.</p>
            </div>
          </div>
          <ul className="impact-list">
            {(report?.simulated_assets ?? []).map((asset) => <li key={asset}>{asset}</li>)}
          </ul>
        </section>
        <section className="panel wide">
          <div className="panel-title">
            <div>
              <h2>Eventos recentes</h2>
              <p>Base operacional para relatório e auditoria.</p>
            </div>
          </div>
          <DataTable rows={traces.slice(0, 12)} labels={labels.trace} />
        </section>
      </section>
    </section>
  );
}
