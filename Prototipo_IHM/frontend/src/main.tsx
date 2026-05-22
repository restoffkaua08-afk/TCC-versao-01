import { useMemo, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  CheckCircle2,
  FileText,
  Gauge,
  Menu,
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

type TankData = {
  code: string;
  pressure: number;
  target: number;
  oil: number;
  risk: number;
  status: "OK" | "Atenção" | "Crítico";
};

type ChecklistState = {
  hose: boolean;
  upperValve: boolean;
  lowerValve: boolean;
  tanks: boolean;
  oil: boolean;
  emergency: boolean;
};

const menuItems: { key: Screen; label: string; description: string }[] = [
  { key: "inicio", label: "Início", description: "Estado geral da máquina" },
  { key: "preparacao", label: "Preparação", description: "Configurar ciclo e checklist" },
  { key: "operacao", label: "Operação", description: "Acompanhar vácuo, óleo e bombas" },
  { key: "alarmes", label: "Alarmes", description: "Eventos e reconhecimento" },
  { key: "registro", label: "Registro", description: "Resumo final do ciclo" }
];

function clampTankCount(value: number) {
  return Math.max(1, Math.min(3, Math.round(value)));
}

function statusClass(status: string) {
  const lower = status.toLowerCase();
  if (lower.includes("crítico") || lower.includes("bloqueada")) return "critical";
  if (lower.includes("atenção")) return "warning";
  if (lower.includes("operação") || lower.includes("ok") || lower.includes("pronta")) return "success";
  return "neutral";
}

function makeTanks(count: number, cycleRunning: boolean): TankData[] {
  return Array.from({ length: count }).map((_, index) => {
    const pressure = cycleRunning ? 8.2 + index * 0.7 : 1013;
    const oil = cycleRunning ? 42 + index * 4 : 0;
    const risk = cycleRunning ? 18 + index * 8 : 0;

    return {
      code: `TQ-0${index + 1}`,
      pressure,
      target: 8,
      oil,
      risk,
      status: risk >= 70 ? "Crítico" : risk >= 45 ? "Atenção" : "OK"
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
  const [checklist, setChecklist] = useState<ChecklistState>({
    hose: true,
    upperValve: true,
    lowerValve: true,
    tanks: true,
    oil: false,
    emergency: true
  });
  const [b1Running, setB1Running] = useState(true);
  const [b2Running, setB2Running] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [ackAlarm, setAckAlarm] = useState(false);

  const cycleRunning = cycleStatus === "Em operação" || cycleStatus === "Atenção";
  const tanks = useMemo(() => makeTanks(tankCount, cycleRunning), [tankCount, cycleRunning]);
  const checklistReady = Object.values(checklist).every(Boolean);

  function startCycle() {
    if (!checklistReady) {
      setCycleStatus("Atenção");
      setScreen("preparacao");
      return;
    }

    setEmergency(false);
    setCycleStatus("Em operação");
    setB1Running(true);
    setB2Running(false);
    setScreen("operacao");
  }

  function emergencyStop() {
    setEmergency(true);
    setCycleStatus("Bloqueada");
    setB1Running(false);
    setB2Running(false);
    setScreen("alarmes");
  }

  function resetCycle() {
    setEmergency(false);
    setCycleStatus("Pronta");
    setB1Running(false);
    setB2Running(false);
    setAckAlarm(false);
    setScreen("inicio");
  }

  function stopPump(pump: "B1" | "B2") {
    if (pump === "B1") setB1Running(false);
    if (pump === "B2") setB2Running(false);
    setCycleStatus("Atenção");
  }

  return (
    <div className="ihm-stage">
      <div className="industrial-tablet">
        <div className="tablet-grip top-left" />
        <div className="tablet-grip top-right" />

        <div className="hardware-button hardware-left">
          <button onClick={() => stopPump("B1")} aria-label="Parar bomba B1">
            <Square size={28} />
          </button>
          <span>PARAR B1</span>
        </div>

        <div className="hardware-button hardware-right">
          <button onClick={() => stopPump("B2")} aria-label="Parar bomba B2">
            <Square size={28} />
          </button>
          <span>PARAR B2</span>
        </div>

        <div className="hardware-emergency">
          <button onClick={emergencyStop} aria-label="Emergência geral">
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
            <InfoTile label="Supervisório" value="Aguardando integração" tone="neutral" />
            <InfoTile label="Operador" value={operator} tone="neutral" />
            <InfoTile label="Turno" value={shift} tone="neutral" />
          </section>

          <section className="ihm-content">
            {screen === "inicio" && (
              <StartScreen
                cycleStatus={cycleStatus}
                tankCount={tankCount}
                startCycle={startCycle}
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
                setB1Running={setB1Running}
                setB2Running={setB2Running}
                setCycleStatus={setCycleStatus}
                setScreen={setScreen}
              />
            )}

            {screen === "alarmes" && (
              <AlarmsScreen
                emergency={emergency}
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
                resetCycle={resetCycle}
              />
            )}
          </section>

          <footer className="ihm-footer">
            <button onClick={() => setScreen("inicio")}>Início</button>
            <button onClick={() => setScreen("preparacao")}>Preparação</button>
            <button onClick={() => setScreen("operacao")}>Operação</button>
            <button onClick={() => setScreen("alarmes")}>Alarmes</button>
            <button onClick={() => setScreen("registro")}>Registro</button>
          </footer>
        </main>

        {menuOpen && (
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
        )}
      </div>
    </div>
  );
}

function screenTitle(screen: Screen) {
  const map: Record<Screen, string> = {
    inicio: "Início da máquina",
    preparacao: "Preparação do ciclo",
    operacao: "Operação em andamento",
    alarmes: "Alarmes e bloqueios",
    registro: "Registro do ciclo"
  };

  return map[screen];
}

function StatusPill({ label }: { label: string }) {
  return <span className={`status-pill ${statusClass(label)}`}>{label}</span>;
}

function InfoTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`info-tile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StartScreen({
  cycleStatus,
  tankCount,
  startCycle,
  setScreen
}: {
  cycleStatus: CycleStatus;
  tankCount: number;
  startCycle: () => void;
  setScreen: (screen: Screen) => void;
}) {
  return (
    <div className="start-layout">
      <section className="hero-panel">
        <span className="eyebrow">ESTADO GERAL</span>
        <h2>Máquina {cycleStatus.toLowerCase()}</h2>
        <p>IHM local preparada para operação de vácuo, controle visual das bombas e acompanhamento dos tanques.</p>

        <div className="quick-status">
          <InfoTile label="Tanques selecionados" value={`${tankCount}`} tone="neutral" />
          <InfoTile label="Último ciclo" value="IHM-OP-0001" tone="neutral" />
          <InfoTile label="Modo" value="Simulado" tone="warning" />
        </div>
      </section>

      <section className="action-panel">
        <button className="primary-action" onClick={() => setScreen("preparacao")}>
          <SlidersHorizontal size={34} />
          Novo ciclo
        </button>

        <button className="secondary-action" onClick={startCycle}>
          <Play size={34} />
          Iniciar direto
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
    { key: "emergency", label: "Emergência liberada" }
  ];

  return (
    <div className="preparation-layout">
      <section className="config-panel">
        <h2>Configuração rápida</h2>

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
              <CheckCircle2 size={24} />
              {item.label}
            </button>
          ))}
        </div>

        <button className="start-cycle" disabled={!props.checklistReady} onClick={props.startCycle}>
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
  setB1Running: (value: boolean) => void;
  setB2Running: (value: boolean) => void;
  setCycleStatus: (value: CycleStatus) => void;
  setScreen: (screen: Screen) => void;
}) {
  return (
    <div className="operation-layout">
      <section className="cycle-header-card">
        <div>
          <span className="eyebrow">CICLO EM ANDAMENTO</span>
          <h2>OP-IHM-0001</h2>
          <p>Etapa atual: vácuo inicial · Tempo: 00:07:32</p>
        </div>

        <StatusPill label="Em operação" />
      </section>

      <section className={`tanks-visual-grid count-${props.tanks.length}`}>
        {props.tanks.map((tank) => (
          <TankVisual key={tank.code} tank={tank} />
        ))}
      </section>

      <section className="operation-bottom-grid">
        <PumpPanel
          code="B1"
          name="Bomba primária"
          running={props.b1Running}
          performance="96%"
          onStart={() => props.setB1Running(true)}
          onStop={() => props.setB1Running(false)}
        />

        <PumpPanel
          code="B2"
          name="Bomba Roots"
          running={props.b2Running}
          performance="88%"
          onStart={() => props.setB2Running(true)}
          onStop={() => props.setB2Running(false)}
        />

        <section className="steps-panel">
          <h3>Etapas do ciclo</h3>
          {["Preparação", "Vácuo inicial", "Vácuo profundo", "Enchimento de óleo", "Estabilização", "Finalização"].map((step, index) => (
            <div key={step} className={`step-row ${index < 1 ? "done" : index === 1 ? "active" : ""}`}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </section>

        <section className="operator-actions">
          <button onClick={() => props.setCycleStatus("Atenção")}>Pausar</button>
          <button onClick={() => props.setB2Running(true)}>Avançar etapa</button>
          <button onClick={() => props.setScreen("registro")}>Finalizar</button>
        </section>
      </section>
    </div>
  );
}

function TankVisual({ tank }: { tank: TankData }) {
  return (
    <article className={`tank-visual ${statusClass(tank.status)}`}>
      <div className="tank-drawing">
        <div className="tank-liquid" style={{ height: `${Math.min(68, tank.oil)}%` }} />
        <div className="tank-pressure" style={{ height: `${Math.min(80, tank.risk + 20)}%` }} />
        <span>{tank.code}</span>
      </div>

      <div className="tank-readings">
        <Reading label="Pressão" value={`${tank.pressure.toFixed(1)} mbar`} />
        <Reading label="Alvo" value={`${tank.target.toFixed(1)} mbar`} />
        <Reading label="Óleo" value={`${tank.oil.toFixed(0)} L`} />
        <Reading label="Risco" value={`${tank.risk}%`} />
        <Reading label="Status" value={tank.status} />
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

function PumpPanel(props: {
  code: string;
  name: string;
  running: boolean;
  performance: string;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <article className="pump-panel">
      <div className="pump-visual">
        <span>{props.code}</span>
      </div>

      <div>
        <h3>{props.name}</h3>
        <p>Estado: {props.running ? "Ligada" : "Desligada"}</p>
        <p>Desempenho: {props.performance}</p>
        <p>Conexão: PLC simulado</p>
      </div>

      <div className="pump-actions">
        <button onClick={props.onStart}>Ligar</button>
        <button onClick={props.onStop}>Parar</button>
      </div>
    </article>
  );
}

function AlarmsScreen(props: {
  emergency: boolean;
  ackAlarm: boolean;
  setAckAlarm: (value: boolean) => void;
  setScreen: (screen: Screen) => void;
  resetCycle: () => void;
}) {
  const alarms = [
    {
      id: "ALM-001",
      title: props.emergency ? "Emergência geral acionada" : "Pressão acima do esperado",
      severity: props.emergency ? "Crítico" : "Atenção",
      time: "14:26",
      cause: props.emergency ? "Botão físico de emergência foi acionado." : "Possível perda na mangueira ou bomba abaixo do desempenho.",
      action: props.emergency ? "Verificar área, liberar emergência e reiniciar ciclo somente após inspeção." : "Verificar conexão e acompanhar curva de pressão."
    },
    {
      id: "ALM-002",
      title: "Atraso no óleo",
      severity: "Atenção",
      time: "14:31",
      cause: "Vazão abaixo da referência esperada.",
      action: "Verificar linha de óleo e volume estimado."
    }
  ];

  return (
    <div className="alarms-layout">
      <section className="alarm-list">
        {alarms.map((alarm) => (
          <article key={alarm.id} className={`alarm-card ${statusClass(alarm.severity)}`}>
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
          <InfoTile label="Status final" value={props.cycleStatus} tone={statusClass(props.cycleStatus)} />
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
