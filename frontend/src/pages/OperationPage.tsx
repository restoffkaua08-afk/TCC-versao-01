import { Gauge, Pause, Play, RotateCcw, ShieldAlert, Square } from "lucide-react";

import { AlarmList } from "../components/AlarmList";
import { PressureChart } from "../components/PressureChart";
import { RegulatorFromTankState } from "../components/RegulatorVisual";
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
        eyebrow="Operação em tempo real"
        title="Supervisão do ciclo de vácuo"
        subtitle="Esta tela acompanha o processo ao vivo. As simulações hipotéticas ficam no menu Gêmeo Digital."
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

        <div className="operation-kpis">
          <Kpi label="Pressão média" value={fmt(avgPressure, "mbar")} hint="Média dos tanques" />
          <Kpi label="Bomba primária" value={state?.primary_pump.running ? "Ligada" : "Desligada"} hint="Leybold SOGEVAC SV630B" />
          <Kpi label="Roots" value={state?.roots_pump.running ? "Ligada" : "Bloqueada"} hint={`Partida: ${fmt(state?.roots_pump.safe_start_pressure_mbar, "mbar")}`} />
          <Kpi label="Óleo" value={state?.oil_injection.fault ? "Falha" : "Normal"} hint={`Meta: ${fmt(state?.oil_injection.target_flow_l_min, "L/min")}`} tone={state?.oil_injection.fault ? "bad" : "good"} />
          <Kpi label="Risco máximo" value={fmt(maxRisk, "%")} tone={maxRisk > 82 ? "bad" : maxRisk > 65 ? "warn" : "good"} />
        </div>
      </section>

      <section className="operator-guide">
        <strong>Como ler esta tela</strong>
        <span>O desenho do regulador mostra visualmente a distribuição do processo: azul representa ar/gás interno, vermelho representa carga de pressão e amarelo representa óleo. Os números abaixo detalham pressão, óleo, risco e mangueira.</span>
      </section>

      <section className="regulator-grid">
        {state?.tank_states.map((item) => <RegulatorFromTankState key={item.tank.id} item={item} />)}
        {!state?.tank_states.length && tanks.slice(0, 3).map((tank) => (
          <article key={tank.id} className="regulator-card">
            <div className="regulator-card-head">
              <div><strong>{tank.code}</strong><span>{tank.type}</span></div>
              <small>Aguardando</small>
            </div>
            <div className="empty-regulator">Inicie um ciclo para visualizar o regulador.</div>
          </article>
        ))}
      </section>

      <section className="operation-bottom">
        <section className="panel">
          <div className="panel-title">
            <div><h2><Gauge size={18} /> Rampa de vácuo</h2><p>Pressão real x pressão esperada durante o ciclo.</p></div>
          </div>
          <PressureChart history={history} />
        </section>

        <section className="panel">
          <div className="panel-title">
            <div><h2>Comandos do ciclo</h2><p>Controle da operação simulada em tempo real.</p></div>
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
            <div><h2>Alarmes recentes</h2><p>Eventos críticos e pendências.</p></div>
            <StatusBadge tone={criticalAlarms.length ? "bad" : "good"}>{criticalAlarms.length} críticos</StatusBadge>
          </div>
          <AlarmList alarms={activeAlarms.slice(0, 5)} />
        </section>
      </section>
    </section>
  );
}
