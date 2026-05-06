import { Pause, Play, RotateCcw, ShieldAlert, Square } from "lucide-react";

import { AlarmList } from "../components/AlarmList";
import { PressureChart } from "../components/PressureChart";
import { TankCard } from "../components/TankCard";
import { fmt, Kpi, PageHeader, StatusBadge, statusText } from "../components/ui";
import type { Alarm, OperationState, PressureReading, Tank } from "../types/domain";

export function OperationPage({
  state,
  history,
  tanks,
  avgPressure,
  maxRisk,
  activeAlarms,
  generalLight,
  onControl,
}: {
  state: OperationState | null;
  history: PressureReading[];
  tanks: Tank[];
  avgPressure?: number;
  maxRisk: number;
  activeAlarms: Alarm[];
  generalLight: string;
  onControl: (action: "start" | "pause" | "stop" | "emergency" | "reset") => void;
}) {
  const criticalAlarms = activeAlarms.filter((alarm) => alarm.severity === "critical");

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Operação"
        title="Controle do ciclo de vácuo"
        subtitle="Monitoramento limpo dos tanques, bombas Leybold, injeção de óleo, risco estrutural e alarmes."
      />

      <section className={`operation-status ${generalLight}`}>
        <div className="status-main">
          <span className={`beacon ${generalLight}`} />
          <div>
            <small>Status do ciclo</small>
            <strong>{statusText(state?.cycle?.status)}</strong>
            <span>{state?.cycle?.cycle_code ?? "Nenhum ciclo ativo"}</span>
          </div>
        </div>
        <div className="kpi-grid operation-kpis">
          <Kpi label="Pressão média" value={fmt(avgPressure, "mbar")} />
          <Kpi label="Roots WSU2001" value={state?.roots_pump.running ? `${fmt(state.roots_pump.speed_pct, "%")}` : "Intertravada"} tone={state?.roots_pump.running ? "good" : "warn"} />
          <Kpi label="Injeção de óleo" value={state?.oil_injection.fault ? "Falha" : "Ativa"} tone={state?.oil_injection.fault ? "bad" : "good"} />
          <Kpi label="Risco máximo" value={fmt(maxRisk, "%")} tone={maxRisk > 82 ? "bad" : maxRisk > 65 ? "warn" : "good"} />
          <Kpi label="Alarmes ativos" value={`${activeAlarms.length}`} tone={activeAlarms.length ? "bad" : "good"} />
        </div>
      </section>

      <section className="tank-rack">
        {state?.tank_states.map((item) => <TankCard key={item.tank.id} item={item} />)}
      </section>

      <section className="operation-bottom">
        <PressureChart history={history} tanks={tanks} title="Pressão x tempo" subtitle="Curva simultânea dos três tanques." />
        <section className="panel command-panel">
          <div className="panel-title">
            <div>
              <h2>Comandos</h2>
              <p>Ações do operador para o ciclo simulado.</p>
            </div>
            <StatusBadge tone={state?.plc_comm_ok ? "good" : "bad"}>{state?.plc_comm_ok ? "CLP comunicando" : "Sem comunicação"}</StatusBadge>
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
            <div>
              <h2>Alarmes recentes</h2>
              <p>Eventos críticos e pendências do processo.</p>
            </div>
            <StatusBadge tone={criticalAlarms.length ? "bad" : "good"}>{criticalAlarms.length} críticos</StatusBadge>
          </div>
          <AlarmList alarms={activeAlarms} limit={5} />
        </section>
      </section>
    </section>
  );
}
