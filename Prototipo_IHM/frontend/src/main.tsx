import { useMemo, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Gauge,
  Lock,
  Menu,
  Pause,
  Play,
  Power,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Square,
  Wrench,
  X
} from "lucide-react";
import "./styles.css";

type Screen = "inicio" | "preparacao" | "operacao" | "alarmes" | "registro";
type CycleStatus = "Pronta" | "Em preparação" | "Em operação" | "Atenção" | "Bloqueada";
type OperationMode = "Automático" | "Manual";
type ControlMode = "Local" | "Remoto";

type TankData = {
  code: string;
  pressure: number;
  target: number;
  oil: number;
  condition: "Normal" | "Atenção" | "Bloqueio";
};

type ChecklistState = {
  hose: boolean;
  upperValve: boolean;
  lowerValve: boolean;
  tanks: boolean;
  oil: boolean;
  emergency: boolean;
  interlocks: boolean;
};

type ConfirmAction = {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
};

const menuItems: { key: Screen; label: string; description: string }[] = [
  { key: "inicio", label: "Início", description: "Estado geral e liberação" },
  { key: "preparacao", label: "Preparação", description: "Receita, tanques e checklist" },
  { key: "operacao", label: "Operação", description: "Acompanhamento do ciclo" },
  { key: "alarmes", label: "Alarmes", description: "Eventos e reconhecimento" },
  { key: "registro", label: "Registro", description: "Resumo final do ciclo" }
];

const stageList = [
  "Preparação",
  "Vácuo inicial",
  "Vácuo profundo",
  "Enchimento de óleo",
  "Estabilização",
  "Finalização"
];

function clampTankCount(value: number) {
  return Math.max(1, Math.min(3, Math.round(value)));
}

function tone(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("bloque") || lower.includes("crítico") || lower.includes("falha") || lower.includes("parada")) return "critical";
  if (lower.includes("atenção") || lower.includes("manual") || lower.includes("aguard")) return "warning";
  if (lower.includes("operação") || lower.includes("normal") || lower.includes("ok") || lower.includes("pronta") || lower.includes("liberado")) return "success";
  return "neutral";
}

function makeTanks(count: number, running: boolean, blocked: boolean): TankData[] {
  return Array.from({ length: count }).map((_, index) => {
    if (blocked) {
      return {
        code: `TQ-0${index + 1}`,
        pressure: 1013,
        target: 8,
        oil: 0,
        condition: "Bloqueio"
      };
    }

    const pressure = running ? 8.2 + index * 0.6 : 1013;
    const oil = running ? 42 + index * 4 : 0;
    const condition = running && index === 2 ? "Atenção" : "Normal";

    return {
      code: `TQ-0${index + 1}`,
      pressure,
      target: 8,
      oil,
      condition
    };
  });
}

function App() {
  const [screen, setScreen] = useState<Screen>("inicio");
  const [menuOpen, setMenuOpen] = useState(false);
  const [tankCount, setTankCount] = useState(2);
  const [cycleStatus, setCycleStatus] = useState<CycleStatus>("Pronta");
  const [operator, setOperator] = useState("João Martins");
  const [shift, setShift] = useState("Manhã");
  const [recipe, setRecipe] = useState("Receita padrão");
  const [hose, setHose] = useState("MG-02");
  const [operationMode, setOperationMode] = useState<OperationMode>("Automático");
  const [controlMode, setControlMode] = useState<ControlMode>("Local");
  const [checklist, setChecklist] = useState<ChecklistState>({
    hose: true,
    upperValve: true,
    lowerValve: true,
    tanks: true,
    oil: false,
    emergency: true,
    interlocks: true
  });
  const [b1Running, setB1Running] = useState(false);
  const [b2Running, setB2Running] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [emergency, setEmergency] = useState(false);
  const [ackAlarm, setAckAlarm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const checklistReady = Object.values(checklist).every(Boolean);
  const running = cycleStatus === "Em operação" || cycleStatus === "Atenção";
  const blocked = cycleStatus === "Bloqueada";
  const tanks = useMemo(() => makeTanks(tankCount, running, blocked), [tankCount, running, blocked]);
  const activeAlarm = emergency ? "Emergência geral acionada" : cycleStatus === "Atenção" ? "Operação em atenção" : "Sem alarme ativo";
  const permission = checklistReady && !emergency ? "Liberado" : "Bloqueado";

  function requestStartCycle() {
    if (!checklistReady) {
      setCycleStatus("Atenção");
      setScreen("preparacao");
      return;
    }

    setConfirmAction({
      title: "Iniciar ciclo",
      body: "Confirmar início do ciclo com a configuração atual e checklist liberado?",
      confirmLabel: "Iniciar ciclo",
      onConfirm: () => {
        setEmergency(false);
        setAckAlarm(false);
        setCycleStatus("Em operação");
        setB1Running(true);
        setB2Running(false);
        setStageIndex(1);
        setScreen("operacao");
      }
    });
  }

  function requestEmergency() {
    setConfirmAction({
      title: "Emergência geral",
      body: "Acionar bloqueio geral da operação? Este comando simula a parada completa do ciclo.",
      confirmLabel: "Acionar emergência",
      danger: true,
      onConfirm: () => {
        setEmergency(true);
        setCycleStatus("Bloqueada");
        setB1Running(false);
        setB2Running(false);
        setStageIndex(0);
        setAckAlarm(false);
        setScreen("alarmes");
      }
    });
  }

  function requestStopPump(pump: "B1" | "B2") {
    setConfirmAction({
      title: `Parada ${pump}`,
      body: `Solicitar parada individual da bomba ${pump}. Em operação real, o PLC validaria intertravamentos antes de executar.`,
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

  function resetCycle() {
    setEmergency(false);
    setCycleStatus("Pronta");
    setB1Running(false);
    setB2Running(false);
    setStageIndex(0);
    setAckAlarm(false);
    setScreen("inicio");
  }

  function finishCycle() {
    setCycleStatus("Pronta");
    setB1Running(false);
    setB2Running(false);
    setStageIndex(5);
    setScreen("registro");
  }

  function advanceStage() {
    setStageIndex((current) => {
      const next = Math.min(current + 1, stageList.length - 1);
      if (next >= 2) setB2Running(true);
      return next;
    });
  }

  function renderMenu() {
    if (!menuOpen) return null;

    return (
      <div className="modal-backdrop">
        <div className="ihm-menu-modal">
          <div className="modal-header">
            <div>
              <span className="eyebrow">NAVEGAÇÃO DA IHM</span>
              <h2>Menu operacional</h2>
            </div>
            <button className="close-button" onClick={() => setMenuOpen(false)} aria-label="Fechar menu">
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
                  setMenuOpen(false);
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

  function renderConfirm() {
    if (!confirmAction) return null;

    return (
      <div className="modal-backdrop">
        <div className="confirm-modal">
          <div className="modal-header">
            <div>
              <span className="eyebrow">{confirmAction.danger ? "AÇÃO CRÍTICA" : "CONFIRMAÇÃO"}</span>
              <h2>{confirmAction.title}</h2>
            </div>
            <button className="close-button" onClick={() => setConfirmAction(null)} aria-label="Cancelar">
              <X size={24} />
            </button>
          </div>

          <p>{confirmAction.body}</p>

          <div className="confirm-actions">
            <button onClick={() => setConfirmAction(null)}>Cancelar</button>
            <button
              className={confirmAction.danger ? "danger-action" : "primary-confirm"}
              onClick={() => {
                confirmAction.onConfirm();
                setConfirmAction(null);
              }}
            >
              {confirmAction.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ihm-stage">
      <div className="industrial-tablet">
        <div className="tablet-grip top-left" />
        <div className="tablet-grip top-right" />

        <HardwareButton side="left" label="PARADA B1" onClick={() => requestStopPump("B1")} />
        <HardwareButton side="right" label="PARADA B2" onClick={() => requestStopPump("B2")} />

        <div className="hardware-emergency">
          <button onClick={requestEmergency} aria-label="Emergência geral">
            <Power size={42} />
          </button>
          <span>EMERGÊNCIA GERAL</span>
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
                <Menu size={26} />
              </button>
            </div>
          </header>

          <section className="machine-line">
            <InfoTile label="PLC" value="Simulado online" tone="success" />
            <InfoTile label="Controle" value={controlMode} tone={tone(controlMode)} />
            <InfoTile label="Modo" value={operationMode} tone={tone(operationMode)} />
            <InfoTile label="Permissão" value={permission} tone={tone(permission)} />
          </section>

          <section className="ihm-content">
            {screen === "inicio" && (
              <StartScreen
                cycleStatus={cycleStatus}
                tankCount={tankCount}
                activeAlarm={activeAlarm}
                permission={permission}
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
                operationMode={operationMode}
                setOperationMode={setOperationMode}
                controlMode={controlMode}
                setControlMode={setControlMode}
                checklist={checklist}
                setChecklist={setChecklist}
                checklistReady={checklistReady}
                requestStartCycle={requestStartCycle}
                tanks={tanks}
              />
            )}

            {screen === "operacao" && (
              <OperationScreen
                tanks={tanks}
                b1Running={b1Running}
                b2Running={b2Running}
                stageIndex={stageIndex}
                setCycleStatus={setCycleStatus}
                setScreen={setScreen}
                advanceStage={advanceStage}
                finishCycle={finishCycle}
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
                operationMode={operationMode}
                resetCycle={resetCycle}
              />
            )}
          </section>
        </main>

        {renderMenu()}
        {renderConfirm()}
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
  tankCount,
  activeAlarm,
  permission,
  setScreen
}: {
  cycleStatus: CycleStatus;
  tankCount: number;
  activeAlarm: string;
  permission: string;
  setScreen: (screen: Screen) => void;
}) {
  return (
    <div className="start-layout">
      <section className="hero-panel">
        <span className="eyebrow">ESTADO GERAL DA MÁQUINA</span>
        <h2>{cycleStatus}</h2>
        <p>Interface local para operação do ciclo de vácuo e óleo, com foco em segurança, liberação e acompanhamento rápido.</p>

        <div className="quick-status">
          <InfoTile label="Tanques" value={`${tankCount}`} tone="neutral" />
          <InfoTile label="Permissão" value={permission} tone={tone(permission)} />
          <InfoTile label="Alarme ativo" value={activeAlarm} tone={tone(activeAlarm)} />
        </div>
      </section>

      <section className="action-panel">
        <button className="primary-action" onClick={() => setScreen("preparacao")}>
          <SlidersHorizontal size={34} />
          Novo ciclo
        </button>

        <button className="secondary-action" onClick={() => setScreen("operacao")}>
          <Gauge size={34} />
          Ver operação
        </button>

        <button className="secondary-action" onClick={() => setScreen("alarmes")}>
          <ShieldAlert size={34} />
          Alarmes
        </button>

        <button className="secondary-action" onClick={() => setScreen("registro")}>
          <FileText size={34} />
          Registro
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
  operationMode: OperationMode;
  setOperationMode: (value: OperationMode) => void;
  controlMode: ControlMode;
  setControlMode: (value: ControlMode) => void;
  checklist: ChecklistState;
  setChecklist: (value: ChecklistState) => void;
  checklistReady: boolean;
  requestStartCycle: () => void;
  tanks: TankData[];
}) {
  const checklistItems: { key: keyof ChecklistState; label: string }[] = [
    { key: "hose", label: "Mangueira conectada" },
    { key: "upperValve", label: "Válvula superior aberta" },
    { key: "lowerValve", label: "Válvula inferior fechada" },
    { key: "tanks", label: "Tanques posicionados" },
    { key: "oil", label: "Óleo disponível" },
    { key: "emergency", label: "Emergência liberada" },
    { key: "interlocks", label: "Intertravamentos liberados" }
  ];

  return (
    <div className="preparation-layout">
      <section className="config-panel">
        <h2>Configuração do ciclo</h2>

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
              <option>Receita padrão</option>
              <option>Tanque grande</option>
              <option>Tanque crítico</option>
            </select>
          </Field>

          <Field label="Operador">
            <select value={props.operator} onChange={(event) => props.setOperator(event.target.value)}>
              <option>João Martins</option>
              <option>Maria Souza</option>
              <option>Carlos Lima</option>
              <option>Admin TSEA</option>
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

          <Field label="Modo de operação">
            <select value={props.operationMode} onChange={(event) => props.setOperationMode(event.target.value as OperationMode)}>
              <option>Automático</option>
              <option>Manual</option>
            </select>
          </Field>

          <Field label="Controle">
            <select value={props.controlMode} onChange={(event) => props.setControlMode(event.target.value as ControlMode)}>
              <option>Local</option>
              <option>Remoto</option>
            </select>
          </Field>
        </div>

        <MiniTankLine tanks={props.tanks} />
      </section>

      <section className="checklist-panel">
        <div className="checklist-title">
          <h2>Checklist de liberação</h2>
          <StatusPill label={props.checklistReady ? "Liberado" : "Bloqueado"} />
        </div>

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
              <CheckCircle2 size={24} />
              {item.label}
            </button>
          ))}
        </div>

        <button className="start-cycle" disabled={!props.checklistReady} onClick={props.requestStartCycle}>
          <Play size={32} />
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
  setCycleStatus: (value: CycleStatus) => void;
  setScreen: (screen: Screen) => void;
  advanceStage: () => void;
  finishCycle: () => void;
}) {
  return (
    <div className="operation-layout">
      <section className="cycle-header-card">
        <div>
          <span className="eyebrow">CICLO EM ANDAMENTO</span>
          <h2>OP-IHM-0001</h2>
          <p>Etapa atual: {stageList[props.stageIndex]} · Tempo: 00:07:32</p>
        </div>

        <StatusPill label="Em operação" />
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
          <h3>Sistema de óleo</h3>
          <InfoTile label="Vazão" value="2,1 L/min" tone="success" />
          <InfoTile label="Volume" value="48 L" tone="success" />
          <InfoTile label="Temperatura" value="60 °C" tone="success" />
        </section>

        <section className="steps-panel">
          <h3>Etapas</h3>
          {stageList.map((step, index) => (
            <div key={step} className={`step-row ${index < props.stageIndex ? "done" : index === props.stageIndex ? "active" : ""}`}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </section>

        <section className="operator-actions">
          <button onClick={() => props.setCycleStatus("Atenção")}>
            <Pause size={24} />
            Pausar ciclo
          </button>
          <button onClick={props.advanceStage}>
            <Play size={24} />
            Avançar etapa
          </button>
          <button onClick={props.finishCycle}>
            <FileText size={24} />
            Finalizar ciclo
          </button>
          <button onClick={() => props.setScreen("alarmes")}>
            <AlertTriangle size={24} />
            Alarmes
          </button>
        </section>
      </section>
    </div>
  );
}

function TankVisual({ tank }: { tank: TankData }) {
  return (
    <article className={`tank-visual ${tone(tank.condition)}`}>
      <div className="tank-drawing">
        <div className="tank-liquid" style={{ height: `${Math.min(70, tank.oil)}%` }} />
        <div className="tank-vacuum" style={{ height: `${Math.max(16, 78 - tank.pressure)}%` }} />
        <span>{tank.code}</span>
      </div>

      <div className="tank-readings">
        <Reading label="Pressão" value={`${tank.pressure.toFixed(1)} mbar`} />
        <Reading label="Alvo" value={`${tank.target.toFixed(1)} mbar`} />
        <Reading label="Óleo" value={`${tank.oil.toFixed(0)} L`} />
        <Reading label="Condição" value={tank.condition} />
      </div>
    </article>
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

function PumpPanel({ code, name, running, performance }: { code: string; name: string; running: boolean; performance: string }) {
  return (
    <article className="pump-panel">
      <div className={`pump-visual ${running ? "running" : ""}`}>
        <span>{code}</span>
      </div>

      <div>
        <h3>{name}</h3>
        <p>Estado: {running ? "Ligada" : "Desligada"}</p>
        <p>Desempenho: {performance}</p>
        <p>Conexão: PLC simulado</p>
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
      time: "14:26",
      cause: props.emergency ? "Botão de emergência foi acionado." : props.cycleStatus === "Atenção" ? "Comando de parada/pausa ou condição de atenção." : "Sistema sem falha crítica ativa.",
      action: props.emergency ? "Inspecionar área, liberar emergência e reiniciar somente após autorização." : "Verificar operação e confirmar condição."
    },
    {
      id: "ALM-002",
      title: "Atraso no óleo",
      severity: "Atenção",
      time: "14:31",
      cause: "Vazão abaixo da referência esperada.",
      action: "Verificar linha de óleo, volume estimado e condição da mangueira."
    }
  ];

  return (
    <div className="alarms-layout">
      <section className="alarm-list">
        {alarms.map((alarm) => (
          <article key={alarm.id} className={`alarm-card ${tone(alarm.severity)}`}>
            <div>
              <strong>{alarm.id} · {alarm.title}</strong>
              <span>{alarm.severity} · {alarm.time}</span>
            </div>
            <p>{alarm.cause}</p>
            <p><b>Ação sugerida:</b> {alarm.action}</p>
          </article>
        ))}
      </section>

      <section className="alarm-actions">
        <button onClick={() => props.setAckAlarm(true)}>
          <CheckCircle2 size={28} />
          Reconhecer alarme
        </button>

        <button onClick={() => props.setScreen("operacao")}>
          <Gauge size={28} />
          Ver operação
        </button>

        <button onClick={props.resetCycle}>
          <RotateCcw size={28} />
          Resetar ciclo
        </button>

        {props.ackAlarm && <p className="ack-message">Alarme reconhecido pelo operador.</p>}
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
  operationMode: OperationMode;
  resetCycle: () => void;
}) {
  return (
    <div className="register-layout">
      <section className="register-card">
        <span className="eyebrow">RESUMO DO CICLO</span>
        <h2>OP-IHM-0001</h2>

        <div className="summary-grid">
          <InfoTile label="Operador" value={props.operator} tone="neutral" />
          <InfoTile label="Turno" value={props.shift} tone="neutral" />
          <InfoTile label="Tanques" value={`${props.tankCount}`} tone="neutral" />
          <InfoTile label="Mangueira" value={props.hose} tone="neutral" />
          <InfoTile label="Receita" value={props.recipe} tone="neutral" />
          <InfoTile label="Modo" value={props.operationMode} tone={tone(props.operationMode)} />
          <InfoTile label="Status final" value={props.cycleStatus} tone={tone(props.cycleStatus)} />
        </div>
      </section>

      <section className="register-actions">
        <button>
          <FileText size={30} />
          Salvar registro
        </button>

        <button>
          <Wrench size={30} />
          Enviar ao supervisório
        </button>

        <button onClick={props.resetCycle}>
          <RotateCcw size={30} />
          Novo ciclo
        </button>
      </section>
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