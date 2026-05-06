import { Activity, Database, Factory, FileText, Gauge, RotateCcw, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "./api/client";
import { DemoBadge } from "./components/ui";
import { DigitalTwinPage } from "./pages/DigitalTwinPage";
import { OperationPage } from "./pages/OperationPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TraceabilityPage } from "./pages/TraceabilityPage";
import type {
  Alarm,
  ChatResponse,
  Hose,
  Maintenance,
  OperationState,
  OperationalReport,
  PressureReading,
  Recipe,
  SimulationResult,
  Tank,
  TraceEvent,
  VacuumCycle,
  TwinState,
} from "./types/domain";
import "./styles.css";

type Section = "Visão Geral" | "Operação" | "Rastreabilidade" | "Gêmeo Digital" | "Relatórios" | "Configurações";

const sections: Array<{ label: Section; icon: ReactNode }> = [
  { label: "Visão Geral", icon: <Gauge size={18} /> },
  { label: "Operação", icon: <Factory size={18} /> },
  { label: "Rastreabilidade", icon: <Database size={18} /> },
  { label: "Gêmeo Digital", icon: <Activity size={18} /> },
  { label: "Relatórios", icon: <FileText size={18} /> },
  { label: "Configurações", icon: <Gauge size={18} /> },
];

export default function App() {
  const [section, setSection] = useState<Section>("Visão Geral");
  const [state, setState] = useState<OperationState | null>(null);
  const [history, setHistory] = useState<PressureReading[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [twin, setTwin] = useState<TwinState | null>(null);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [traces, setTraces] = useState<TraceEvent[]>([]);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [hoses, setHoses] = useState<Hose[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [cycles, setCycles] = useState<VacuumCycle[]>([]);
  const [whatIfs, setWhatIfs] = useState<SimulationResult[]>([]);
  const [report, setReport] = useState<OperationalReport | null>(null);
  const [chatText, setChatText] = useState("Qual é o desvio entre real e esperado?");
  const [chat, setChat] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(runTick = false) {
    try {
      setError(null);
      const nextState = runTick ? await api.tick() : await api.state();
      const [historyData, alarmData, twinData, maintenanceData, traceData, tankData, hoseData, recipeData, cycleData, whatIfData, reportData] = await Promise.all([
        api.history(),
        api.alarms(),
        api.twin(),
        api.maintenance(),
        api.traces(),
        api.tanks(),
        api.hoses(),
        api.recipes(),
        api.cycles(),
        api.whatIfHistory(),
        api.report(),
      ]);
      setState(nextState);
      setHistory(historyData);
      setAlarms(alarmData);
      setTwin(twinData);
      setMaintenance(maintenanceData);
      setTraces(traceData);
      setTanks(tankData);
      setHoses(hoseData);
      setRecipes(recipeData);
      setCycles(cycleData);
      setWhatIfs(whatIfData);
      setReport(reportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao consultar a API.");
    }
  }

  useEffect(() => {
    refresh(true);
    const id = window.setInterval(() => refresh(true), 3000);
    return () => window.clearInterval(id);
  }, []);

  const activeAlarms = useMemo(() => alarms.filter((alarm) => !alarm.acknowledged), [alarms]);
  const avgPressure = useMemo(() => {
    if (!state?.tank_states.length) return undefined;
    return state.tank_states.reduce((sum, item) => sum + item.pressure_mbar, 0) / state.tank_states.length;
  }, [state]);
  const maxRisk = Math.max(...(state?.tank_states.map((item) => item.collapse_risk_pct) ?? [0]));
  const generalLight = activeAlarms.some((alarm) => alarm.severity === "critical") || maxRisk > 82 ? "red" : activeAlarms.length || maxRisk > 65 ? "yellow" : "green";

  async function control(action: "start" | "pause" | "stop" | "emergency" | "reset") {
    const result = await api[action]();
    setState("state" in result ? result.state : result);
    await refresh(false);
  }

  async function runWhatIf() {
    await api.whatIf();
    await refresh(false);
    setSection("Gêmeo Digital");
  }

  async function addTrace() {
    await api.createTrace({
      cycle_id: state?.cycle?.id,
      cycle_code: state?.cycle?.cycle_code ?? "CYC-MANUAL",
      operator: "Operador TSEA",
      action: "checagem_operacional",
      details: "Registro manual no protótipo TSEA.",
    });
    await refresh(false);
  }

  async function sendChat(event: FormEvent) {
    event.preventDefault();
    setChat(await api.chat(chatText));
  }

  return (
    <main>
      <header className="app-shell-header">
        <div>
          <span className="brand">TSEA</span>
          <h1>Supervisório de Vácuo Industrial</h1>
          <p>Tanques de reguladores · Leybold SOGEVAC SV630B · RUVAC WSU2001</p>
        </div>
        <div className="header-actions">
          <DemoBadge />
          <button type="button" className="secondary" onClick={() => refresh(true)}><RotateCcw size={17} /> Atualizar</button>
          <button type="button" className="danger" onClick={() => control("emergency")}><ShieldAlert size={17} /> Emergência</button>
        </div>
      </header>

      <nav className="main-nav" aria-label="Navegação principal">
        {sections.map((item) => (
          <button key={item.label} type="button" className={section === item.label ? "active" : ""} onClick={() => setSection(item.label)}>
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {error && <div className="error">{error}</div>}

      {section === "Visão Geral" && <OverviewPage state={state} report={report} cycles={cycles} alarms={alarms} history={history} maxRisk={maxRisk} />}
      {section === "Operação" && (
        <OperationPage
          state={state}
          history={history}
          tanks={tanks}
          avgPressure={avgPressure}
          maxRisk={maxRisk}
          activeAlarms={activeAlarms}
          generalLight={generalLight}
          onControl={control}
        />
      )}
      {section === "Rastreabilidade" && <TraceabilityPage cycles={cycles} traces={traces} alarms={alarms} onTrace={addTrace} />}
      {section === "Gêmeo Digital" && (
        <DigitalTwinPage
          twin={twin}
          state={state}
          history={history}
          tanks={tanks}
          whatIfs={whatIfs}
          maintenance={maintenance}
          maxRisk={maxRisk}
          chatText={chatText}
          setChatText={setChatText}
          chat={chat}
          onChat={sendChat}
          onRunWhatIf={runWhatIf}
        />
      )}
      {section === "Relatórios" && <ReportsPage report={report} cycles={cycles} alarms={alarms} history={history} state={state} traces={traces} />}
      {section === "Configurações" && <SettingsPage tanks={tanks} hoses={hoses} recipes={recipes} />}
    </main>
  );
}
