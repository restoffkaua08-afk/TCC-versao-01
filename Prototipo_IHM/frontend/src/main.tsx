import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Screen = "operacao" | "preparo" | "alarmes" | "registro";
type Status = "PRONTO" | "EM CICLO" | "PAUSADO" | "ATENCAO" | "BLOQUEADO" | "FINALIZADO";
type Recipe = "padrao" | "grande" | "critico";
type AlarmTone = "ok" | "warn" | "bad";

type TankState = {
  code: string;
  pressureTank: number;
  pressureMachine: number;
  hoseLoss: number;
  oil: number;
  vacuum: number;
  air: number;
  status: AlarmTone;
};

type Checklist = {
  hose: boolean;
  upperValve: boolean;
  lowerValve: boolean;
  tanks: boolean;
  oil: boolean;
  emergency: boolean;
  sensors: boolean;
  interlocks: boolean;
};

const stages = [
  "PREPARO",
  "VACUO INICIAL",
  "VACUO PROFUNDO",
  "INJECAO DE OLEO",
  "ESTABILIZACAO",
  "FINALIZACAO"
];

const recipes: Record<Recipe, { label: string; target: number; oilTarget: number; ramp: string; note: string }> = {
  padrao: {
    label: "PADRAO",
    target: 8,
    oilTarget: 50,
    ramp: "NORMAL",
    note: "Ciclo padrao para tanques comuns."
  },
  grande: {
    label: "TANQUE GRANDE",
    target: 12,
    oilTarget: 65,
    ramp: "MONITORADA",
    note: "Acompanhar tempo de queda e perda de carga."
  },
  critico: {
    label: "TANQUE CRITICO",
    target: 35,
    oilTarget: 45,
    ramp: "BRANDA",
    note: "Aplicar vacuo mais conservador e acompanhamento especial."
  }
};

function fmt(value: number, unit: string) {
  if (!Number.isFinite(value)) return `-- ${unit}`;
  return `${value.toFixed(value >= 100 ? 1 : 2)} ${unit}`;
}

function timeFmt(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getStageIndex(status: Status, elapsed: number) {
  if (status === "PRONTO" || status === "BLOQUEADO") return 0;
  if (status === "FINALIZADO") return 5;
  if (elapsed < 24) return 1;
  if (elapsed < 90) return 2;
  if (elapsed < 165) return 3;
  if (elapsed < 205) return 4;
  return 5;
}

function machinePressure(elapsed: number, recipe: Recipe) {
  const target = recipes[recipe].target;

  if (elapsed <= 0) return 1013;
  if (elapsed < 24) return Math.max(6, 1013 * Math.exp(-elapsed / 4.7));
  if (elapsed < 90) return Math.max(target, 75 * Math.exp(-(elapsed - 24) / 23));
  return target;
}

function makeTanks(count: number, status: Status, elapsed: number, recipe: Recipe): TankState[] {
  const stage = getStageIndex(status, elapsed);
  const running = status === "EM CICLO" || status === "PAUSADO" || status === "ATENCAO";

  return Array.from({ length: count }).map((_, index) => {
    const hoseLoss = 0.7 + index * 0.35 + (count - 1) * 0.42;

    if (status === "BLOQUEADO") {
      return {
        code: `T${index + 1}`,
        pressureMachine: 1013,
        pressureTank: 1013,
        hoseLoss,
        air: 100,
        vacuum: 0,
        oil: 0,
        status: "bad"
      };
    }

    if (!running) {
      return {
        code: `T${index + 1}`,
        pressureMachine: 1013,
        pressureTank: 1013,
        hoseLoss,
        air: 72,
        vacuum: 10,
        oil: 18,
        status: "ok"
      };
    }

    const pMachine = machinePressure(elapsed, recipe);
    const pTank = Math.max(recipes[recipe].target, pMachine + hoseLoss);

    const oilProgress = stage >= 3 ? Math.min(1, Math.max(0, (elapsed - 90) / 75)) : 0;
    const oil = 18 + oilProgress * 48;
    const vacuum = Math.min(62, Math.max(10, ((1013 - pTank) / 1013) * 62));
    const air = Math.max(8, 78 - vacuum - oil * 0.35);

    const attention = status === "ATENCAO" || (recipe === "critico" && stage <= 2);

    return {
      code: `T${index + 1}`,
      pressureMachine: pMachine,
      pressureTank: pTank,
      hoseLoss,
      air,
      vacuum,
      oil,
      status: attention ? "warn" : "ok"
    };
  });
}

function getAlarm(status: Status, recipe: Recipe, checklistOk: boolean) {
  if (status === "BLOQUEADO") {
    return { tone: "bad" as AlarmTone, text: "EMERGENCIA / BLOQUEIO ATIVO - verificar maquina antes de liberar." };
  }

  if (!checklistOk) {
    return { tone: "warn" as AlarmTone, text: "CHECKLIST PENDENTE - inicio do ciclo bloqueado." };
  }

  if (status === "ATENCAO") {
    return { tone: "warn" as AlarmTone, text: "ATENCAO OPERACIONAL - acompanhar pressao, bombas e oleo." };
  }

  if (recipe === "critico" && status === "EM CICLO") {
    return { tone: "warn" as AlarmTone, text: "TANQUE CRITICO - rampa branda e acompanhamento especial." };
  }

  return { tone: "ok" as AlarmTone, text: "SEM ALARME ATIVO" };
}

function App() {
  const [screen, setScreen] = useState<Screen>("operacao");
  const [status, setStatus] = useState<Status>("PRONTO");
  const [elapsed, setElapsed] = useState(0);
  const [tankCount, setTankCount] = useState(3);
  const [recipe, setRecipe] = useState<Recipe>("padrao");
  const [operator, setOperator] = useState("OPERADOR 01");
  const [shift, setShift] = useState("MANHA");

  const [checklist, setChecklist] = useState<Checklist>({
    hose: false,
    upperValve: false,
    lowerValve: false,
    tanks: false,
    oil: false,
    emergency: true,
    sensors: false,
    interlocks: false
  });

  const checklistOk = Object.values(checklist).every(Boolean);
  const stageIndex = getStageIndex(status, elapsed);
  const stage = stages[stageIndex];
  const tanks = useMemo(() => makeTanks(tankCount, status, elapsed, recipe), [tankCount, status, elapsed, recipe]);

  const avgTankPressure = tanks.reduce((sum, tank) => sum + tank.pressureTank, 0) / tanks.length;
  const avgMachinePressure = tanks.reduce((sum, tank) => sum + tank.pressureMachine, 0) / tanks.length;

  const b1Running = status === "EM CICLO" && stageIndex >= 1 && stageIndex <= 4;
  const b2Running = status === "EM CICLO" && stageIndex === 2;
  const oilRunning = status === "EM CICLO" && stageIndex >= 3 && stageIndex <= 4;

  const alarm = getAlarm(status, recipe, checklistOk);

  useEffect(() => {
    if (status !== "EM CICLO") return;

    const timer = window.setInterval(() => {
      setElapsed((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status === "EM CICLO" && stageIndex >= 5) {
      setStatus("FINALIZADO");
      setScreen("registro");
    }
  }, [stageIndex, status]);

  function startCycle() {
    if (!checklistOk) {
      setStatus("ATENCAO");
      setScreen("preparo");
      return;
    }

    setElapsed(0);
    setStatus("EM CICLO");
    setScreen("operacao");
  }

  function pauseOrResume() {
    if (status === "EM CICLO") {
      setStatus("PAUSADO");
      return;
    }

    if (status === "PAUSADO" || status === "ATENCAO") {
      if (!checklistOk) {
        setStatus("ATENCAO");
        setScreen("preparo");
        return;
      }

      setStatus("EM CICLO");
    }
  }

  function emergency() {
    setStatus("BLOQUEADO");
    setScreen("alarmes");
  }

  function reset() {
    setStatus("PRONTO");
    setElapsed(0);
    setScreen("operacao");
  }

  function finishSafe() {
    if (status === "EM CICLO" || status === "PAUSADO" || status === "ATENCAO") {
      setStatus("FINALIZADO");
      setScreen("registro");
    }
  }

  return (
    <div className="ihm-page">
      <div className="ihm-device">
        <div className="device-groove g1" />
        <div className="device-groove g2" />
        <div className="device-groove g3" />
        <div className="device-groove gr1" />
        <div className="device-groove gr2" />
        <div className="device-groove gr3" />

        <button className="side-light green" onClick={() => setScreen("operacao")} aria-label="pronto ou em ciclo" />
        <span className="side-caption left">PRONTO / EM CICLO</span>

        <button className="side-light red" onClick={emergency} aria-label="parada ou bloqueio" />
        <span className="side-caption right">PARADA / BLOQUEIO</span>

        <main className="ihm-screen">
          {screen === "operacao" && (
            <OperationScreen
              alarm={alarm}
              avgMachinePressure={avgMachinePressure}
              avgTankPressure={avgTankPressure}
              b1Running={b1Running}
              b2Running={b2Running}
              elapsed={elapsed}
              finishSafe={finishSafe}
              oilRunning={oilRunning}
              pauseOrResume={pauseOrResume}
              recipe={recipe}
              reset={reset}
              setScreen={setScreen}
              stage={stage}
              stageIndex={stageIndex}
              startCycle={startCycle}
              status={status}
              tankCount={tankCount}
              tanks={tanks}
            />
          )}

          {screen === "preparo" && (
            <PrepScreen
              checklist={checklist}
              operator={operator}
              recipe={recipe}
              setChecklist={setChecklist}
              setOperator={setOperator}
              setRecipe={setRecipe}
              setScreen={setScreen}
              setShift={setShift}
              setTankCount={setTankCount}
              shift={shift}
              startCycle={startCycle}
              tankCount={tankCount}
            />
          )}

          {screen === "alarmes" && (
            <AlarmsScreen alarm={alarm} emergency={emergency} reset={reset} setScreen={setScreen} status={status} />
          )}

          {screen === "registro" && (
            <RecordScreen
              avgMachinePressure={avgMachinePressure}
              avgTankPressure={avgTankPressure}
              elapsed={elapsed}
              operator={operator}
              recipe={recipe}
              reset={reset}
              setScreen={setScreen}
              shift={shift}
              status={status}
              tankCount={tankCount}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function OperationScreen(props: {
  alarm: { tone: AlarmTone; text: string };
  avgMachinePressure: number;
  avgTankPressure: number;
  b1Running: boolean;
  b2Running: boolean;
  elapsed: number;
  finishSafe: () => void;
  oilRunning: boolean;
  pauseOrResume: () => void;
  recipe: Recipe;
  reset: () => void;
  setScreen: (screen: Screen) => void;
  stage: string;
  stageIndex: number;
  startCycle: () => void;
  status: Status;
  tankCount: number;
  tanks: TankState[];
}) {
  const actionLabel = props.status === "EM CICLO" ? "PAUSAR" : props.status === "PAUSADO" ? "RETOMAR" : "INICIAR";

  return (
    <section className="operation-layout">
      <div className="top-cards">
        <TopCard label="PRESSAO TANQUE" value={fmt(props.avgTankPressure, "mbar")} highlight />
        <TopCard label="PRESSAO MAQUINA" value={fmt(props.avgMachinePressure, "mbar")} highlight />
        <TopCard label="ETAPA" value={props.stage} highlight />
        <TopCard label="ALARME" value={props.alarm.tone === "ok" ? "NORMAL" : props.alarm.tone === "warn" ? "ATENCAO" : "BLOQUEIO"} tone={props.alarm.tone} />
        <TopCard label="RECEITA" value={recipes[props.recipe].label} />
        <TopCard label="RAMPA" value={recipes[props.recipe].ramp} />
        <TopCard label="TANQUES" value={String(props.tankCount)} />
        <TopCard label="TEMPO" value={timeFmt(props.elapsed)} />
      </div>

      <div className={`alarm-bar ${props.alarm.tone}`}>
        {props.alarm.text}
      </div>

      <div className="process-area">
        <div className={`tanks-area tanks-${props.tankCount}`}>
          {props.tanks.map((tank) => (
            <TankVisual key={tank.code} tank={tank} />
          ))}
        </div>

        <div className="machines-area">
          <PumpVisual label="B1" title="BOMBA PRIMARIA" running={props.b1Running} />
          <PumpVisual label="B2" title="BOMBA ROOTS" running={props.b2Running} />
        </div>

        <OilVisual running={props.oilRunning} stageIndex={props.stageIndex} />
      </div>

      <div className="bottom-buttons">
        <button onClick={() => props.setScreen("preparo")}><span>01</span><strong>PREPARO</strong></button>
        <button onClick={props.status === "PRONTO" || props.status === "FINALIZADO" ? props.startCycle : props.pauseOrResume}><span>02</span><strong>{actionLabel}</strong></button>
        <button onClick={props.finishSafe} disabled={props.status === "PRONTO" || props.status === "FINALIZADO" || props.status === "BLOQUEADO"}><span>03</span><strong>ENCERRAR</strong></button>
        <button onClick={() => props.setScreen("alarmes")}><span>04</span><strong>ALARMES</strong></button>
        <button onClick={() => props.setScreen("registro")}><span>05</span><strong>REGISTRO</strong></button>
      </div>
    </section>
  );
}

function TopCard({ label, value, highlight = false, tone = "ok" }: { label: string; value: string; highlight?: boolean; tone?: AlarmTone }) {
  return (
    <div className={`top-card ${highlight ? "highlight" : ""} ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TankVisual({ tank }: { tank: TankState }) {
  return (
    <article className="tank-block">
      <h2>{tank.code}</h2>

      <div className="tank-cylinder">
        <div className="tank-segment air" style={{ height: `${tank.air}%` }}>
          <span>AR</span>
        </div>
        <div className="tank-segment vacuum" style={{ height: `${tank.vacuum}%` }}>
          <span>VACUO</span>
        </div>
        <div className="tank-segment oil" style={{ height: `${tank.oil}%` }}>
          <span>OLEO</span>
        </div>
      </div>

      <div className={`tank-status ${tank.status}`} />
      <strong className="tank-pressure">{fmt(tank.pressureTank, "mbar")}</strong>
      <span className={`tank-label ${tank.status}`}>{tank.status === "ok" ? "OK" : tank.status === "warn" ? "ATENCAO" : "BLOQUEADO"}</span>
      <small>Perda: {fmt(tank.hoseLoss, "mbar")}</small>
    </article>
  );
}

function PumpVisual({ label, title, running }: { label: string; title: string; running: boolean }) {
  return (
    <article className="pump-row">
      <div className={`pump-led ${running ? "on" : ""}`} />
      <div className="pump-icon">
        <div className="pump-motor" />
        <div className="pump-lines">
          <i />
          <i />
          <i />
        </div>
      </div>
      <div>
        <h2>{label}</h2>
        <strong>{running ? "LIGADA" : "AGUARDANDO"}</strong>
        <span>{title}</span>
      </div>
    </article>
  );
}

function OilVisual({ running, stageIndex }: { running: boolean; stageIndex: number }) {
  const oilLevel = stageIndex >= 3 ? 62 : 38;

  return (
    <article className="oil-area">
      <div className={`oil-led ${running ? "on" : ""}`} />
      <div className="oil-tank">
        <div className="oil-fill" style={{ height: `${oilLevel}%` }}>
          <strong>{running ? "INJ." : "AGD."}</strong>
        </div>
      </div>
      <h2>OLEO</h2>
      <strong>{running ? "INJETANDO" : "AGUARDANDO"}</strong>
      <span>60 C +/- 5 C</span>
    </article>
  );
}

function PrepScreen(props: {
  checklist: Checklist;
  operator: string;
  recipe: Recipe;
  setChecklist: (value: Checklist) => void;
  setOperator: (value: string) => void;
  setRecipe: (value: Recipe) => void;
  setScreen: (screen: Screen) => void;
  setShift: (value: string) => void;
  setTankCount: (value: number) => void;
  shift: string;
  startCycle: () => void;
  tankCount: number;
}) {
  const checks: Array<[keyof Checklist, string]> = [
    ["hose", "Mangueiras conectadas"],
    ["upperValve", "Valvula superior aberta"],
    ["lowerValve", "Valvula inferior fechada"],
    ["tanks", "Tanques posicionados"],
    ["oil", "Oleo disponivel"],
    ["emergency", "Emergencia liberada"],
    ["sensors", "Sensores comunicando"],
    ["interlocks", "Intertravamentos liberados"]
  ];

  return (
    <section className="simple-screen">
      <header>
        <div>
          <h1>PREPARO DO CICLO</h1>
          <p>Confirmar condicoes minimas antes de liberar a operacao.</p>
        </div>
        <button onClick={() => props.setScreen("operacao")}>VOLTAR</button>
      </header>

      <div className="prep-grid">
        <div className="prep-card">
          <h2>Configuracao</h2>

          <label>Quantidade de tanques</label>
          <div className="select-row">
            {[1, 2, 3].map((n) => (
              <button key={n} className={props.tankCount === n ? "selected" : ""} onClick={() => props.setTankCount(n)}>
                {n}
              </button>
            ))}
          </div>

          <label>Receita</label>
          <select value={props.recipe} onChange={(e) => props.setRecipe(e.target.value as Recipe)}>
            <option value="padrao">Padrao</option>
            <option value="grande">Tanque grande</option>
            <option value="critico">Tanque critico</option>
          </select>

          <label>Operador</label>
          <select value={props.operator} onChange={(e) => props.setOperator(e.target.value)}>
            <option>OPERADOR 01</option>
            <option>OPERADOR 02</option>
            <option>MANUTENCAO</option>
          </select>

          <label>Turno</label>
          <select value={props.shift} onChange={(e) => props.setShift(e.target.value)}>
            <option>MANHA</option>
            <option>TARDE</option>
            <option>NOITE</option>
          </select>

          <button className="start-button" onClick={props.startCycle}>INICIAR CICLO</button>
        </div>

        <div className="prep-card">
          <h2>Checklist de liberacao</h2>
          {checks.map(([key, label]) => (
            <button
              key={key}
              className={`check-line ${props.checklist[key] ? "checked" : ""}`}
              onClick={() => props.setChecklist({ ...props.checklist, [key]: !props.checklist[key] })}
            >
              <span>{props.checklist[key] ? "OK" : "!"}</span>
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function AlarmsScreen({ alarm, emergency, reset, setScreen, status }: { alarm: { tone: AlarmTone; text: string }; emergency: () => void; reset: () => void; setScreen: (screen: Screen) => void; status: Status }) {
  return (
    <section className="simple-screen">
      <header>
        <div>
          <h1>ALARMES</h1>
          <p>Eventos que exigem atencao ou bloqueio operacional.</p>
        </div>
        <button onClick={() => setScreen("operacao")}>VOLTAR</button>
      </header>

      <div className="alarm-list">
        <article className={`alarm-card ${alarm.tone}`}>
          <strong>ALM-001 - Estado atual</strong>
          <span>{alarm.text}</span>
          <p>{status === "BLOQUEADO" ? "Inspecionar a operacao antes de liberar novo ciclo." : "Sem bloqueio critico ativo."}</p>
        </article>

        <article className="alarm-card warn">
          <strong>ALM-002 - Rampa de vacuo</strong>
          <span>Monitoramento preventivo</span>
          <p>Acompanhar queda inicial de pressao e diferenca entre maquina e tanque.</p>
        </article>

        <article className="alarm-card warn">
          <strong>ALM-003 - Oleo</strong>
          <span>Monitoramento de processo</span>
          <p>Verificar temperatura, vazao e volume durante a etapa de injecao.</p>
        </article>
      </div>

      <div className="command-row">
        <button onClick={reset}>RESETAR</button>
        <button className="danger" onClick={emergency}>EMERGENCIA</button>
      </div>
    </section>
  );
}

function RecordScreen(props: {
  avgMachinePressure: number;
  avgTankPressure: number;
  elapsed: number;
  operator: string;
  recipe: Recipe;
  reset: () => void;
  setScreen: (screen: Screen) => void;
  shift: string;
  status: Status;
  tankCount: number;
}) {
  const finalizado = props.status === "FINALIZADO";

  return (
    <section className="simple-screen">
      <header>
        <div>
          <h1>REGISTRO DO CICLO</h1>
          <p>{finalizado ? "Resumo final do ciclo." : "Registro parcial da operacao atual."}</p>
        </div>
        <button onClick={() => props.setScreen("operacao")}>VOLTAR</button>
      </header>

      <div className="record-grid">
        <Info label="Operador" value={props.operator} />
        <Info label="Turno" value={props.shift} />
        <Info label="Tanques" value={String(props.tankCount)} />
        <Info label="Receita" value={recipes[props.recipe].label} />
        <Info label="Tempo" value={timeFmt(props.elapsed)} />
        <Info label="Pressao tanque" value={fmt(props.avgTankPressure, "mbar")} />
        <Info label="Pressao maquina" value={fmt(props.avgMachinePressure, "mbar")} />
        <Info label="Status" value={props.status} />
        <Info label="Registro" value={finalizado ? "Ciclo finalizado" : "Parcial / em andamento"} />
      </div>

      <div className="command-row">
        <button onClick={props.reset}>NOVO CICLO</button>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);