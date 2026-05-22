import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gauge,
  Menu,
  Pause,
  Play,
  Power,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Square,
  X
} from "lucide-react";
import "./styles.css";

type Screen = "inicio" | "preparacao" | "operacao" | "alarmes" | "registro";
type CycleStatus = "Pronta" | "Em operação" | "Atenção" | "Bloqueada";
type TankCondition = "Normal" | "Atenção" | "Bloqueio";

type TankData = {
  code: string;
  pressure: number;
  target: number;
  oil: number;
  air: number;
  vacuum: number;
  hoseLoss: number;
  condition: TankCondition;
};

type ChecklistState = {
  hose: boolean;
  upperValve: boolean;
  lowerValve: boolean;
  tanks: boolean;
  oil: boolean;
  emergency: boolean;
  interlocks: boolean;
  sensors: boolean;
};

type ConfirmAction = {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
};

const menuItems: { key: Screen; label: string; description: string }[] = [
  { key: "inicio", label: "Início", description: "Estado geral da máquina" },
  { key: "preparacao", label: "Preparação", description: "Configurar ciclo e liberar checklist" },
  { key: "operacao", label: "Operação", description: "Monitoramento automático do ciclo" },
  { key: "alarmes", label: "Alarmes", description: "Falhas, bloqueios e reconhecimento" },
  { key: "registro", label: "Registro", description: "Resumo final da operação" }
];

const stages = [
  "Preparação",
  "Vácuo inicial",
  "Vácuo profundo",
  "Injeção de óleo",
  "Estabilização",
  "Finalização"
];

function tone(value: string) {
  const lower = value.toLowerCase();

  if (lower.includes("bloque") || lower.includes("crítico") || lower.includes("falha") || lower.includes("emergência")) return "critical";
  if (lower.includes("atenção") || lower.includes("aguard") || lower.includes("paus") || lower.includes("rápida")) return "warning";
  if (lower.includes("operação") || lower.includes("normal") || lower.includes("pronta") || lower.includes("liberado") || lower.includes("online")) return "success";

  return "neutral";
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function stageFromElapsed(status: CycleStatus, elapsed: number) {
  if (status === "Bloqueada" || status === "Pronta") return 0;
  if (elapsed < 24) return 1;
  if (elapsed < 90) return 2;
  if (elapsed < 160) return 3;
  if (elapsed < 195) return 4;
  return 5;
}

function expectedStageTime(stage: number) {
  const map = [
    "Aguardando liberação",
    "Referência: queda inicial controlada",
    "Referência real: até ~24 min",
    "Referência real: enchimento lento ~40 min",
    "Estabilização e conferência",
    "Ciclo concluído"
  ];

  return map[stage] ?? "Em acompanhamento";
}

function makeTanks(count: number, status: CycleStatus, elapsed: number): TankData[] {
  const stage = stageFromElapsed(status, elapsed);
  const running = status === "Em operação" || status === "Atenção";
  const blocked = status === "Bloqueada";

  return Array.from({ length: count }).map((_, index) => {
    const hoseLoss = count === 1 ? 0.8 : count === 2 ? 1.7 + index * 0.2 : 2.6 + index * 0.3;

    if (blocked) {
      return {
        code: `TQ-0${index + 1}`,
        pressure: 1013,
        target: 8,
        oil: 0,
        air: 100,
        vacuum: 0,
        hoseLoss,
        condition: "Bloqueio"
      };
    }

    if (!running) {
      return {
        code: `TQ-0${index + 1}`,
        pressure: 1013,
        target: 8,
        oil: 0,
        air: 100,
        vacuum: 0,
        hoseLoss,
        condition: "Normal"
      };
    }

    const basePressure = Math.max(8 + hoseLoss, 1013 * Math.exp(-elapsed / 15) + hoseLoss);
    const oil = stage >= 3 ? Math.min(62, 10 + (elapsed - 90) * 0.36 + index * 3) : 0;
    const vacuum = Math.min(88, Math.max(12, ((1013 - basePressure) / 1013) * 86));
    const air = Math.max(8, 72 - vacuum * 0.35 - oil * 0.22);
    const condition: TankCondition = status === "Atenção" || (count === 3 && index === 2 && elapsed > 50) ? "Atenção" : "Normal";

    return {
      code: `TQ-0${index + 1}`,
      pressure: basePressure,
      target: 8,
      oil,
      air,
      vacuum,
      hoseLoss,
      condition
    };
  });
}

function App() {
  const [screen, setScreen] = useState<Screen>("inicio");
  const [menuOpen, setMenuOpen] = useState(false);
  const [tankCount, setTankCount] = useState(2);
  const [cycleStatus, setCycleStatus] = useState<CycleStatus>("Pronta");
  const [operator, setOperator] = useState("Operador 01");
  const [shift, setShift] = useState("Manhã");
  const [recipe, setRecipe] = useState("Padrão");
  const [hose, setHose] = useState("MG-02");
  const [checklist, setChecklist] = useState<ChecklistState>({
    hose: true,
    upperValve: true,
    lowerValve: true,
    tanks: true,
    oil: false,
    emergency: true,
    interlocks: true,
    sensors: true
  });
  const [b1Running, setB1Running] = useState(false);
  const [b2Running, setB2Running] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [emergency, setEmergency] = useState(false);
  const [ackAlarm, setAckAlarm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const checklistReady = Object.values(checklist).every(Boolean);
  const stageIndex = stageFromElapsed(cycleStatus, elapsed);
  const tanks = useMemo(() => makeTanks(tankCount, cycleStatus, elapsed), [tankCount, cycleStatus, elapsed]);

  const permission = checklistReady && !emergency ? "Liberado" : "Bloqueado";
  const alarmStatus = emergency ? "Emergência geral" : cycleStatus === "Atenção" ? "Atenção operacional" : "Sem alarme";
  const plcStatus = cycleStatus === "Bloqueada" ? "Bloqueado" : "Online simulado";
  const sensorStatus = checklist.sensors ? "Sensores OK" : "Falha sensor";
  const interlockStatus = checklist.interlocks && checklist.emergency ? "Liberado" : "Bloqueado";
  const rampStatus = cycleStatus === "Em operação" && elapsed < 24 ? "Rampa inicial" : cycleStatus === "Em operação" ? "Acompanhando" : "Aguardando";
  const avgPressure = tanks.reduce((sum, tank) => sum + tank.pressure, 0) / Math.max(tanks.length, 1);
  const finalStage = stageIndex >= 5;

  useEffect(() => {
    if (cycleStatus !== "Em operação" && cycleStatus !== "Atenção") return;

    const id = window.setInterval(() => {
      setElapsed((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(id);
  }, [cycleStatus]);

  useEffect(() => {
    if (cycleStatus === "Em operação" && stageIndex >= 2) setB2Running(true);

    if (cycleStatus === "Em operação" && finalStage) {
      setB1Running(false);
      setB2Running(false);
      setCycleStatus("Pronta");
      setScreen("registro");
    }
  }, [cycleStatus, stageIndex, finalStage]);

  function startCycle() {
    if (!checklistReady) {
      setCycleStatus("Atenção");
      setScreen("preparacao");
      return;
    }

    setConfirmAction({
      title: "Iniciar ciclo",
      body: "Confirmar início do ciclo? A sequência será conduzida automaticamente pelo CLP/simulação.",
      confirmLabel: "Iniciar",
      onConfirm: () => {
        setEmergency(false);
        setCycleStatus("Em operação");
        setB1Running(true);
        setB2Running(false);
        setElapsed(0);
        setAckAlarm(false);
        setScreen("operacao");
      }
    });
  }

  function emergencyStop() {
    setConfirmAction({
      title: "Emergência geral",
      body: "Acionar parada geral simulada da operação? A operação será bloqueada até reset.",
      confirmLabel: "Acionar emergência",
      danger: true,
      onConfirm: () => {
        setEmergency(true);
        setCycleStatus("Bloqueada");
        setB1Running(false);
        setB2Running(false);
        setAckAlarm(false);
        setScreen("alarmes");
      }
    });
  }

  function requestStopPump(pump: "B1" | "B2") {
    setConfirmAction({
      title: `Parada ${pump}`,
      body: `Solicitar parada individual da bomba ${pump}. Em operação real, o CLP validaria intertravamentos antes de executar.`,
      confirmLabel: `Parar ${pump}`,
      danger: true,
      onConfirm: () => {
        if (pump === "B1") setB1Running(false);
        if (pump === "B2") setB2Running(false);
        setCycleStatus("Atenção");
        setAckAlarm(false);
      }
    });
  }

  function requestPause() {
    setConfirmAction({
      title: "Solicitar pausa",
      body: "Solicitar pausa operacional ao CLP/simulação? A operação entrará em atenção.",
      confirmLabel: "Solicitar pausa",
      onConfirm: () => {
        setCycleStatus("Atenção");
        setB1Running(false);
        setB2Running(false);
      }
    });
  }

  function requestResume() {
    setConfirmAction({
      title: "Retomar ciclo",
      body: "Solicitar retomada do ciclo ao CLP/simulação?",
      confirmLabel: "Retomar",
      onConfirm: () => {
        setCycleStatus("Em operação");
        setB1Running(true);
        if (stageIndex >= 2) setB2Running(true);
      }
    });
  }

  function finishCycle() {
    setConfirmAction({
      title: "Finalizar ciclo",
      body: finalStage
        ? "Encerrar operação simulada e gerar resumo?"
        : "O ciclo ainda não chegou à finalização automática. Deseja encerrar como finalização manual simulada?",
      confirmLabel: "Finalizar",
      danger: !finalStage,
      onConfirm: () => {
        setCycleStatus("Pronta");
        setB1Running(false);
        setB2Running(false);
        setScreen("registro");
      }
    });
  }

  function resetCycle() {
    setEmergency(false);
    setCycleStatus("Pronta");
    setB1Running(false);
    setB2Running(false);
    setElapsed(0);
    setAckAlarm(false);
    setScreen("inicio");
  }

  return (
    <div className="ihm-stage">
      <div className="industrial-tablet">
        <div className="tablet-grip top-left" />
        <div className="tablet-grip top-right" />

        <HardwareButton side="left" label="PARADA B1" onClick={() => requestStopPump("B1")} />
        <HardwareButton side="right" label="PARADA B2" onClick={() => requestStopPump("B2")} />

        <div className="hardware-emergency">
          <button onClick={emergencyStop} aria-label="Emergência geral">
            <Power size={42} />
          </button>
          <span>EMERGÊNCIA</span>
        </div>

        <main className="ihm-screen">
          <header className="ihm-topbar">
            <div>
              <span className="eyebrow">TSEA IHM LOCAL</span>
              <h1>{screenTitle(screen)}</h1>
            </div>

            <div className="top-status-group">
              <StatusPill label={cycleStatus} />
              <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
                <Menu size={28} />
              </button>
            </div>
          </header>

          <section className="machine-line">
            <InfoTile label="CLP" value={plcStatus} tone={tone(plcStatus)} />
            <InfoTile label="Permissão" value={permission} tone={tone(permission)} />
            <InfoTile label="Sensores" value={sensorStatus} tone={tone(sensorStatus)} />
            <InfoTile label="Intertrav." value={interlockStatus} tone={tone(interlockStatus)} />
          </section>

          <section className="ihm-content">
            {screen === "inicio" && (
              <StartScreen
                cycleStatus={cycleStatus}
                permission={permission}
                alarmStatus={alarmStatus}
                tankCount={tankCount}
                setScreen={setScreen}
              />
            )}

            {screen === "preparacao" && (
              <PreparationScreen
                tankCount={tankCount}
                setTankCount={setTankCount}
                operator={operator}
                setOperator={setOperator}
                shift={shift}
                setShift={setShift}
                recipe={recipe}
                setRecipe={setRecipe}
                hose={hose}
                setHose={setHose}
                checklist={checklist}
                setChecklist={setChecklist}
                checklistReady={checklistReady}
                startCycle={startCycle}
                tanks={tanks}
              />
            )}

            {screen === "operacao" && (
              <OperationScreen
                tanks={tanks}
                b1Running={b1Running}
                b2Running={b2Running}
                stageIndex={stageIndex}
                cycleStatus={cycleStatus}
                elapsed={elapsed}
                rampStatus={rampStatus}
                avgPressure={avgPressure}
                requestPause={requestPause}
                requestResume={requestResume}
                finishCycle={finishCycle}
                setScreen={setScreen}
              />
            )}

            {screen === "alarmes" && (
              <AlarmsScreen
                emergency={emergency}
                cycleStatus={cycleStatus}
                ackAlarm={ackAlarm}
                setAckAlarm={setAckAlarm}
                setScreen={setScreen}
                resetCycle={resetCycle}
              />
            )}

            {screen === "registro" && (
              <RegisterScreen
                tankCount={tankCount}
                operator={operator}
                shift={shift}
                hose={hose}
                recipe={recipe}
                cycleStatus={cycleStatus}
                elapsed={elapsed}
                avgPressure={avgPressure}
                resetCycle={resetCycle}
              />
            )}
          </section>
        </main>

        {menuOpen && (
          <MenuModal screen={screen} setScreen={setScreen} close={() => setMenuOpen(false)} />
        )}

        {confirmAction && (
          <ConfirmModal action={confirmAction} close={() => setConfirmAction(null)} />
        )}
      </div>
    </div>
  );
}

function screenTitle(screen: Screen) {
  const map: Record<Screen, string> = {
    inicio: "Início operacional",
    preparacao: "Preparação do ciclo",
    operacao: "Operação em andamento",
    alarmes: "Alarmes e bloqueios",
    registro: "Registro do ciclo"
  };

  return map[screen];
}

function HardwareButton({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  return (
    <div className={`hardware-button hardware-${side}`}>
      <button onClick={onClick} aria-label={label}>
        <Square size={28} />
      </button>
      <span>{label}</span>
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return <span className={`status-pill ${tone(label)}`}>{label}</span>;
}

function InfoTile({ label, value, tone: tileTone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`info-tile ${tileTone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StartScreen({
  cycleStatus,
  permission,
  alarmStatus,
  tankCount,
  setScreen
}: {
  cycleStatus: CycleStatus;
  permission: string;
  alarmStatus: string;
  tankCount: number;
  setScreen: (screen: Screen) => void;
}) {
  return (
    <div className="start-layout">
      <section className="start-main-card">
        <span className="eyebrow">STATUS DA MÁQUINA</span>
        <h2>{cycleStatus}</h2>

        <div className="start-status-grid">
          <InfoTile label="Permissão" value={permission} tone={tone(permission)} />
          <InfoTile label="Tanques" value={`${tankCount}`} tone="neutral" />
          <InfoTile label="Alarme" value={alarmStatus} tone={tone(alarmStatus)} />
        </div>

        <p className="operator-note">
          A sequência do processo é automática. O operador prepara o ciclo, acompanha leituras, reconhece alarmes e registra a operação.
        </p>
      </section>

      <section className="start-actions">
        <button className="primary-action" onClick={() => setScreen("preparacao")}>
          <SlidersHorizontal size={32} />
          Preparar ciclo
        </button>

        <button onClick={() => setScreen("operacao")}>
          <Gauge size={32} />
          Ver operação
        </button>

        <button onClick={() => setScreen("alarmes")}>
          <ShieldAlert size={32} />
          Alarmes
        </button>
      </section>
    </div>
  );
}

function PreparationScreen(props: {
  tankCount: number;
  setTankCount: (value: number) => void;
  operator: string;
  setOperator: (value: string) => void;
  shift: string;
  setShift: (value: string) => void;
  recipe: string;
  setRecipe: (value: string) => void;
  hose: string;
  setHose: (value: string) => void;
  checklist: ChecklistState;
  setChecklist: (value: ChecklistState) => void;
  checklistReady: boolean;
  startCycle: () => void;
  tanks: TankData[];
}) {
  const checklistItems: { key: keyof ChecklistState; label: string }[] = [
    { key: "hose", label: "Mangueira conectada" },
    { key: "upperValve", label: "Válvula superior aberta" },
    { key: "lowerValve", label: "Válvula inferior fechada" },
    { key: "tanks", label: "Tanques posicionados" },
    { key: "oil", label: "Óleo disponível" },
    { key: "emergency", label: "Emergência liberada" },
    { key: "interlocks", label: "Intertravamentos liberados" },
    { key: "sensors", label: "Sensores comunicando" }
  ];

  return (
    <div className="preparation-layout">
      <section className="config-panel">
        <div className="section-title-row">
          <h2>Configuração do ciclo</h2>
          <StatusPill label={props.checklistReady ? "Liberado" : "Bloqueado"} />
        </div>

        <div className="field-grid">
          <Field label="Quantidade de tanques">
            <div className="tank-selector">
              {[1, 2, 3].map((value) => (
                <button
                  key={value}
                  className={props.tankCount === value ? "active" : ""}
                  onClick={() => props.setTankCount(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Receita">
            <select value={props.recipe} onChange={(event) => props.setRecipe(event.target.value)}>
              <option>Padrão</option>
              <option>Tanque grande</option>
              <option>Tanque crítico</option>
            </select>
          </Field>

          <Field label="Operador">
            <select value={props.operator} onChange={(event) => props.setOperator(event.target.value)}>
              <option>Operador 01</option>
              <option>Operador 02</option>
              <option>Manutenção</option>
            </select>
          </Field>

          <Field label="Turno">
            <select value={props.shift} onChange={(event) => props.setShift(event.target.value)}>
              <option>Manhã</option>
              <option>Tarde</option>
              <option>Noite</option>
            </select>
          </Field>

          <Field label="Mangueira">
            <select value={props.hose} onChange={(event) => props.setHose(event.target.value)}>
              <option>MG-01</option>
              <option>MG-02</option>
              <option>MG-03</option>
            </select>
          </Field>
        </div>

        <MiniTankLine tanks={props.tanks} />
      </section>

      <section className="checklist-panel">
        <h2>Checklist de liberação</h2>

        <div className="checklist">
          {checklistItems.map((item) => (
            <button
              key={item.key}
              className={props.checklist[item.key] ? "checked" : ""}
              onClick={() =>
                props.setChecklist({
                  ...props.checklist,
                  [item.key]: !props.checklist[item.key]
                })
              }
            >
              <CheckCircle2 size={23} />
              {item.label}
            </button>
          ))}
        </div>

        <button className="start-cycle" disabled={!props.checklistReady} onClick={props.startCycle}>
          <Play size={30} />
          Iniciar ciclo
        </button>
      </section>
    </div>
  );
}

function OperationScreen(props: {
  tanks: TankData[];
  b1Running: boolean;
  b2Running: boolean;
  stageIndex: number;
  cycleStatus: CycleStatus;
  elapsed: number;
  rampStatus: string;
  avgPressure: number;
  requestPause: () => void;
  requestResume: () => void;
  finishCycle: () => void;
  setScreen: (screen: Screen) => void;
}) {
  return (
    <div className="operation-layout">
      <section className="cycle-header-card">
        <div>
          <span className="eyebrow">CICLO EM ANDAMENTO</span>
          <h2>OP-IHM-0001</h2>
          <p>Etapa automática: {stages[props.stageIndex]} · Tempo demonstrativo: {formatTime(props.elapsed)}</p>
        </div>

        <StatusPill label={props.cycleStatus} />
      </section>

      <section className="process-strip">
        <InfoTile label="Rampa de vácuo" value={props.rampStatus} tone={tone(props.rampStatus)} />
        <InfoTile label="Pressão média" value={`${props.avgPressure.toFixed(1)} mbar`} tone="neutral" />
        <InfoTile label="Referência etapa" value={expectedStageTime(props.stageIndex)} tone="neutral" />
      </section>

      <section className={`tanks-visual-grid count-${props.tanks.length}`}>
        {props.tanks.map((tank) => (
          <TankVisual key={tank.code} tank={tank} />
        ))}
      </section>

      <section className="operation-bottom-grid">
        <PumpPanel code="B1" name="Bomba primária" running={props.b1Running} performance="96%" />
        <PumpPanel code="B2" name="Bomba Roots" running={props.b2Running} performance="88%" />

        <section className="oil-panel">
          <h3>Óleo</h3>
          <InfoTile label="Vazão" value="2,1 L/min" tone="success" />
          <InfoTile label="Volume" value="48 L" tone="success" />
          <InfoTile label="Temp." value="60 °C" tone="success" />
        </section>

        <section className="steps-panel">
          <h3>Sequência automática</h3>
          {stages.map((step, index) => (
            <div key={step} className={`step-row ${index < props.stageIndex ? "done" : index === props.stageIndex ? "active" : ""}`}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </section>

        <section className="operator-actions">
          {props.cycleStatus === "Atenção" ? (
            <button onClick={props.requestResume}>
              <Play size={23} />
              Retomar
            </button>
          ) : (
            <button onClick={props.requestPause}>
              <Pause size={23} />
              Pausar
            </button>
          )}

          <button onClick={props.finishCycle}>
            <FileText size={23} />
            Finalizar
          </button>

          <button onClick={() => props.setScreen("alarmes")}>
            <AlertTriangle size={23} />
            Alarmes
          </button>
        </section>
      </section>
    </div>
  );
}

function TankVisual({ tank }: { tank: TankData }) {
  const airHeight = Math.min(82, Math.max(14, tank.air));
  const vacuumHeight = Math.min(86, Math.max(12, tank.vacuum));
  const oilHeight = Math.min(70, Math.max(0, tank.oil));

  return (
    <article className={`tank-visual ${tone(tank.condition)}`}>
      <div className="tank-drawing">
        <div className="tank-column air" style={{ height: `${airHeight}%` }}>
          <span>AR</span>
        </div>

        <div className="tank-column vacuum" style={{ height: `${vacuumHeight}%` }}>
          <span>VÁCUO</span>
        </div>

        <div className="tank-column oil" style={{ height: `${oilHeight}%` }}>
          <span>ÓLEO</span>
        </div>

        <strong>{tank.code}</strong>
      </div>

      <div className="tank-readings">
        <Reading label="Pressão" value={`${tank.pressure.toFixed(1)} mbar`} />
        <Reading label="Alvo" value={`${tank.target.toFixed(1)} mbar`} />
        <Reading label="Óleo" value={`${tank.oil.toFixed(0)} L`} />
        <Reading label="Perda mangueira" value={`${tank.hoseLoss.toFixed(1)} mbar`} />
        <Reading label="Condição" value={tank.condition} />
      </div>
    </article>
  );
}

function PumpPanel({ code, name, running, performance }: { code: string; name: string; running: boolean; performance: string }) {
  return (
    <article className="pump-panel">
      <div className={`pump-visual ${running ? "running" : ""}`}>
        <span>{code}</span>
      </div>

      <div className="pump-data">
        <h3>{name}</h3>
        <p>Estado: {running ? "Ligada" : "Desligada"}</p>
        <p>Desempenho: {performance}</p>
        <p>CLP: Simulado</p>
      </div>
    </article>
  );
}

function AlarmsScreen(props: {
  emergency: boolean;
  cycleStatus: CycleStatus;
  ackAlarm: boolean;
  setAckAlarm: (value: boolean) => void;
  setScreen: (screen: Screen) => void;
  resetCycle: () => void;
}) {
  const alarms = [
    {
      id: "ALM-001",
      title: props.emergency ? "Emergência geral acionada" : props.cycleStatus === "Atenção" ? "Operação em atenção" : "Sem falha crítica",
      severity: props.emergency ? "Crítico" : props.cycleStatus === "Atenção" ? "Atenção" : "Normal",
      cause: props.emergency ? "Parada geral simulada foi acionada." : "Sistema sem bloqueio crítico ativo.",
      action: props.emergency ? "Inspecionar área e liberar operação somente após autorização." : "Acompanhar processo normalmente."
    },
    {
      id: "ALM-002",
      title: "Rampa inicial rápida",
      severity: "Atenção",
      cause: "Queda inicial de pressão precisa ser acompanhada.",
      action: "Verificar pressão do tanque e estabilidade da mangueira."
    }
  ];

  return (
    <div className="alarms-layout">
      <section className="alarm-list">
        {alarms.map((alarm) => (
          <article key={alarm.id} className={`alarm-card ${tone(alarm.severity)}`}>
            <div>
              <strong>{alarm.id} · {alarm.title}</strong>
              <span>{alarm.severity}</span>
            </div>
            <p>{alarm.cause}</p>
            <p><b>Ação:</b> {alarm.action}</p>
          </article>
        ))}
      </section>

      <section className="alarm-actions">
        <button onClick={() => props.setAckAlarm(true)}>
          <CheckCircle2 size={28} />
          Reconhecer
        </button>

        <button onClick={() => props.setScreen("operacao")}>
          <Gauge size={28} />
          Ver operação
        </button>

        <button onClick={props.resetCycle}>
          <RotateCcw size={28} />
          Resetar
        </button>

        {props.ackAlarm && <p className="ack-message">Alarme reconhecido.</p>}
      </section>
    </div>
  );
}

function RegisterScreen(props: {
  tankCount: number;
  operator: string;
  shift: string;
  hose: string;
  recipe: string;
  cycleStatus: CycleStatus;
  elapsed: number;
  avgPressure: number;
  resetCycle: () => void;
}) {
  return (
    <div className="register-layout">
      <section className="register-card">
        <span className="eyebrow">RESUMO</span>
        <h2>OP-IHM-0001</h2>

        <div className="summary-grid">
          <InfoTile label="Operador" value={props.operator} tone="neutral" />
          <InfoTile label="Turno" value={props.shift} tone="neutral" />
          <InfoTile label="Tanques" value={`${props.tankCount}`} tone="neutral" />
          <InfoTile label="Mangueira" value={props.hose} tone="neutral" />
          <InfoTile label="Receita" value={props.recipe} tone="neutral" />
          <InfoTile label="Tempo demo" value={formatTime(props.elapsed)} tone="neutral" />
          <InfoTile label="Pressão média" value={`${props.avgPressure.toFixed(1)} mbar`} tone="neutral" />
          <InfoTile label="Status" value={props.cycleStatus} tone={tone(props.cycleStatus)} />
        </div>
      </section>

      <section className="register-actions">
        <button>
          <ClipboardCheck size={30} />
          Salvar registro
        </button>

        <button onClick={props.resetCycle}>
          <RotateCcw size={30} />
          Novo ciclo
        </button>
      </section>
    </div>
  );
}

function MenuModal({ screen, setScreen, close }: { screen: Screen; setScreen: (screen: Screen) => void; close: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="ihm-menu-modal">
        <div className="modal-header">
          <div>
            <span className="eyebrow">MENU</span>
            <h2>Navegação da IHM</h2>
          </div>
          <button className="close-button" onClick={close} aria-label="Fechar">
            <X size={24} />
          </button>
        </div>

        <div className="menu-grid">
          {menuItems.map((item) => (
            <button
              key={item.key}
              className={screen === item.key ? "active" : ""}
              onClick={() => {
                setScreen(item.key);
                close();
              }}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ action, close }: { action: ConfirmAction; close: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="confirm-modal">
        <div className="modal-header">
          <div>
            <span className="eyebrow">{action.danger ? "AÇÃO CRÍTICA" : "CONFIRMAÇÃO"}</span>
            <h2>{action.title}</h2>
          </div>
          <button className="close-button" onClick={close} aria-label="Cancelar">
            <X size={24} />
          </button>
        </div>

        <p>{action.body}</p>

        <div className="confirm-actions">
          <button onClick={close}>Cancelar</button>
          <button
            className={action.danger ? "danger-action" : "primary-confirm"}
            onClick={() => {
              action.onConfirm();
              close();
            }}
          >
            {action.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniTankLine({ tanks }: { tanks: TankData[] }) {
  return (
    <div className="mini-tank-line">
      {tanks.map((tank) => (
        <div key={tank.code}>
          <span>{tank.code}</span>
        </div>
      ))}
    </div>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

createRoot(document.getElementById("root")!).render(<App />);