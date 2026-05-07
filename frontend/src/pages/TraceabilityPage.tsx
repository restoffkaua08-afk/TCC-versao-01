import { Eye, History } from "lucide-react";

import { AlarmList } from "../components/AlarmList";
import { DataTable, fmt, Kpi, labels, PageHeader, statusText } from "../components/ui";
import type { Alarm, TraceEvent, VacuumCycle } from "../types/domain";

export function TraceabilityPage({
  cycles,
  traces,
  alarms,
  onTrace,
}: {
  cycles: VacuumCycle[];
  traces: TraceEvent[];
  alarms: Alarm[];
  onTrace: () => void;
}) {
  const lastCycle = cycles[0];
  const cycleAlarms = lastCycle ? alarms.filter((alarm) => alarm.cycle_id === lastCycle.id) : [];

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Rastreabilidade"
        title="Histórico e trilha operacional"
        subtitle="Ciclos, eventos e alarmes preservados para análise técnica e auditoria."
        actions={<button type="button" onClick={onTrace}><Eye size={16} /> Registrar evento</button>}
      />

      <section className="kpi-grid four">
        <Kpi label="Último ciclo" value={lastCycle?.cycle_code ?? "--"} hint={statusText(lastCycle?.status)} />
        <Kpi label="Pressão final" value={fmt(lastCycle?.final_pressure_mbar, "mbar")} />
        <Kpi label="Duração" value={fmt(lastCycle?.duration_seconds, "s")} />
        <Kpi label="Alarmes do ciclo" value={`${cycleAlarms.length}`} tone={cycleAlarms.length ? "warn" : "good"} />
      </section>

      <section className="grid">
        <section className="panel wide">
          <div className="panel-title">
            <div>
              <h2><History size={18} /> Ciclos de vácuo</h2>
              <p>Tabela principal de ciclos executados.</p>
            </div>
            <span>{cycles.length} registros</span>
          </div>
          <DataTable rows={cycles} labels={labels.cycle} />
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Eventos rastreáveis</h2>
              <p>Ações registradas pelo operador e pela engine.</p>
            </div>
          </div>
          <DataTable rows={traces.slice(0, 12)} labels={labels.trace} />
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Alarmes recentes</h2>
              <p>Eventos vinculados aos ciclos.</p>
            </div>
          </div>
          <AlarmList alarms={alarms} limit={8} />
        </section>
      </section>
    </section>
  );
}
