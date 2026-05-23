import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Screen = "operacao" | "preparo" | "alarmes" | "registro";
type Status = "PRONTO" | "EM CICLO" | "PAUSADO" | "ATENCAO" | "BLOQUEADO" | "FINALIZADO";
type Recipe = "padrao" | "grande" | "critico";
type Hose = "MG-01" | "MG-02" | "MG-03";
type AlarmTone = "ok" | "warn" | "bad";

type TankState = {
  code: string;
  pressureTank: number;
  pressureMachine: number;
  hoseLoss: number;
  oil: number;
  oilInLiters: number;
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

type LogItem = {
  time: string;
  type: string;
  message: string;
  tone: AlarmTone;
};

const stages = [
  "PREPARO",
  "VACUO INICIAL",
  "VACUO PROFUNDO",
  "INJECAO DE OLEO",
  "ESTABILIZACAO",
  "FINALIZACAO"
];

const recipes: Record<Recipe, { label: string; target: number; oilPerTank: number; ramp: string; note: string }> = {
  padrao: {
    label: "PADRAO",
    target: 8,
    oilPerTank: 50,
    ramp: "NORMAL",
    note: "Ciclo padrao para tanques comuns."
  },
  grande: {
    label: "TANQUE GRANDE",
    target: 12,
    oilPerTank: 65,
    ramp: "MONITORADA",
    note: "Acompanhar tempo de queda e perda de carga."
  },
  critico: {
    label: "TANQUE CRITICO",
    target: 35,
    oilPerTank: 45,
    ramp: "BRANDA",
    note: "Aplicar vacuo mais conservador e acompanhamento especial."
  }
};

const hoses: Record<Hose, { label: string; length: string; lossBase: number }> = {
  "MG-01": { label: "MG-01 CURTA", length: "Curta", lossBase: 0.7 },
  "MG-02": { label: "MG-02 MEDIA", length: "Media", lossBase: 1.2 },
  "MG-03": { label: "MG-03 LONGA", length: "Longa", lossBase: 1.8 }
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

function nowTime() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function makeOperationId() {
  return `OP-IHM-${new Date().getTime().toString().slice(-6)}`;
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

function calcOilInjected(status: Status, elapsed: number, tankCount: number, recipe: Recipe, oilTankVolume: number) {
  if (status === "PRONTO" || status === "BLOQUEADO") return 0;

  const required = recipes[recipe].oilPerTank * tankCount;
  const progress = elapsed >= 90 ? Math.min(1, Math.max(0, (elapsed - 90) / 75)) : 0;

  if (status === "FINALIZADO") {
    return Math.min(oilTankVolume, required);
  }

  return Math.min(oilTankVolume, required * progress);
}

function makeTanks(
  count: number,
  status: Status,
  elapsed: number,
  recipe: Recipe,
  hose: Hose,
  oilInjectedTotal: number
): TankState[] {
  const stage = getStageIndex(status, elapsed);
  const running = status === "EM CICLO" || status === "PAUSADO" || status === "ATENCAO";
  const oilPerTank = count > 0 ? oilInjectedTotal / count : 0;

  return Array.from({ length: count }).map((_, index) => {
    const hoseLoss = hoses[hose].lossBase + index * 0.35 + (count - 1) * 0.42;

    if (status === "BLOQUEADO") {
      return {
        code: `T${index + 1}`,
        pressureMachine: 1013,
        pressureTank: 1013,
        hoseLoss,
        air: 100,
        vacuum: 0,
        oil: 0,
        oilInLiters: 0,
        status: "bad"
      };
    }

    if (!running && status !== "FINALIZADO") {
      return {
        code: `T${index + 1}`,
        pressureMachine: 1013,
        pressureTank: 1013,
        hoseLoss,
        air: 72,
        vacuum: 10,
        oil: 18,
        oilInLiters: 0,
        status: "ok"
      };
    }

    const pMachine = machinePressure(elapsed, recipe);
    const pTank = Math.max(recipes[recipe].target, pMachine + hoseLoss);

    const oilVisual = 18 + Math.min(48, (oilPerTank / Math.max(recipes[recipe].oilPerTank, 1)) * 48);
    const vacuum = Math.min(62, Math.max(10, ((1013 - pTank) / 1013) * 62));
    const air = Math.max(8, 78 - vacuum - oilVisual * 0.35);

    const attention = status === "ATENCAO" || (recipe === "critico" && stage <= 2);

    return {
      code: `T${index + 1}`,
      pressureMachine: pMachine,
      pressureTank: pTank,
      hoseLoss,
      air,
      vacuum,
      oil: oilVisual,
      oilInLiters: oilPerTank,
      status: attention ? "warn" : "ok"
    };
  });
}

function getAlarm(status: Status, recipe: Recipe, checklistOk: boolean, oilTankVolume: number, requiredOil: number) {
  if (status === "BLOQUEADO") {
    return { tone: "bad" as AlarmTone, text: "EMERGENCIA / BLOQUEIO ATIVO - verificar maquina antes de liberar." };
  }

  if (!checklistOk) {
    return { tone: "warn" as AlarmTone, text: "CHECKLIST PENDENTE - inicio do ciclo bloqueado." };
  }

  if (oilTankVolume < requiredOil) {
    return { tone: "warn" as AlarmTone, text: "VOLUME DE OLEO ABAIXO DO NECESSARIO PARA A RECEITA." };
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
  const [hose, setHose] = useState<Hose>("MG-02");
  const [operator, setOperator] = useState("OPERADOR 01");
  const [shift, setShift] = useState("MANHA");
  const [operationId, setOperationId] = useState("OP-IHM-000000");
  const [oilTankVolume, setOilTankVolume] = useState(150);
  const [lastStage, setLastStage] = useState(0);

  const [logs, setLogs] = useState<LogItem[]>([
    { time: nowTime(), type: "Sistema", message: "IHM iniciada. Aguardando preparo do ciclo.", tone: "ok" }
  ]);

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

  const requiredOil = recipes[recipe].oilPerTank * tankCount;
  const oilInjected = calcOilInjected(status, elapsed, tankCount, recipe, oilTankVolume);
  const oilRemaining = Math.max(0, oilTankVolume - oilInjected);
  const oilRunning = status === "EM CICLO" && getStageIndex(status, elapsed) >= 3 && getStageIndex(status, elapsed) <= 4;
  const oilFlow = oilRunning ? Math.max(1.2, tankCount * 1.5) : 0;

  const checklistOk = Object.values(checklist).every(Boolean);
  const stageIndex = getStageIndex(status, elapsed);
  const stage = stages[stageIndex];

  const tanks = useMemo(
    () => makeTanks(tankCount, status, elapsed, recipe, hose, oilInjected),
    [tankCount, status, elapsed, recipe, hose, oilInjected]
  );

  const avgTankPressure = tanks.reduce((sum, tank) => sum + tank.pressureTank, 0) / tanks.length;
  const avgMachinePressure = tanks.reduce((sum, tank) => sum + tank.pressureMachine, 0) / tanks.length;

  const b1Running = status === "EM CICLO" && stageIndex >= 1 && stageIndex <= 4;
  const b2Running = status === "EM CICLO" && stageIndex === 2;

  const alarm = getAlarm(status, recipe, checklistOk, oilTankVolume, requiredOil);

  function addLog(type: string, message: string, tone: AlarmTone = "ok") {
    setLogs((current) => [{ time: nowTime(), type, message, tone }, ...current].slice(0, 12));
  }

  useEffect(() => {
    if (status !== "EM CICLO") return;

    const timer = window.setInterval(() => {
      setElapsed((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status !== "EM CICLO") return;

    if (stageIndex !== lastStage) {
      setLastStage(stageIndex);
      addLog("Etapa", `Etapa atual: ${stages[stageIndex]}`, stageIndex >= 3 ? "warn" : "ok");
    }

    if (stageIndex >= 5) {
      setStatus("FINALIZADO");
      addLog("Registro", "Ciclo finalizado automaticamente.", "ok");
      setScreen("registro");
    }
  }, [stageIndex, status]);

  function startCycle() {
    if (!checklistOk) {
      setStatus("ATENCAO");
      addLog("Bloqueio", "Tentativa de inicio com checklist pendente.", "warn");
      setScreen("preparo");
      return;
    }

    if (oilTankVolume < requiredOil) {
      setStatus("ATENCAO");
      addLog("Oleo", "Volume de oleo abaixo do necessario para a receita.", "warn");
      setScreen("preparo");
      return;
    }

    const newId = makeOperationId();
    setOperationId(newId);
    setElapsed(0);
    setLastStage(0);
    setStatus("EM CICLO");
    setLogs([{ time: nowTime(), type: "Operacao", message: `Ciclo ${newId} iniciado.`, tone: "ok" }]);
    setScreen("operacao");
  }

  function pauseOrResume() {
    if (status === "EM CICLO") {
      setStatus("PAUSADO");
      addLog("Operacao", "Ciclo pausado pelo operador.", "warn");
      return;
    }

    if (status === "PAUSADO" || status === "ATENCAO") {
      if (!checklistOk) {
        setStatus("ATENCAO");
        addLog("Bloqueio", "Retomada bloqueada por checklist pendente.", "warn");
        setScreen("preparo");
        return;
      }

      setStatus("EM CICLO");
      addLog("Operacao", "Ciclo retomado.", "ok");
    }
  }

  function emergency() {
    setStatus("BLOQUEADO");
    addLog("Emergencia", "Parada/bloqueio acionado.", "bad");
    setScreen("alarmes");
  }

  function reset() {
    setStatus("PRONTO");
    setElapsed(0);
    setLastStage(0);
    setOperationId("OP-IHM-000000");
    setLogs([{ time: nowTime(), type: "Sistema", message: "Novo ciclo preparado.", tone: "ok" }]);
    setScreen("operacao");
  }

  function finishSafe() {
    if (status === "EM CICLO" || status === "PAUSADO" || status === "ATENCAO") {
      setStatus("FINALIZADO");
      addLog("Registro", "Ciclo encerrado com comando seguro.", "ok");
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
              checklist={checklist}
              elapsed={elapsed}
              finishSafe={finishSafe}
              hose={hose}
              logs={logs}
              oilFlow={oilFlow}
              oilInjected={oilInjected}
              oilRemaining={oilRemaining}
              oilRunning={oilRunning}
              oilTankVolume={oilTankVolume}
              operationId={operationId}
              pauseOrResume={pauseOrResume}
              recipe={recipe}
              requiredOil={requiredOil}
              setScreen={setScreen}
              stage={stage}
              startCycle={startCycle}
              status={status}
              tankCount={tankCount}
              tanks={tanks}
            />
          )}

          {screen === "preparo" && (
            <PrepScreen
              checklist={checklist}
              hose={hose}
              oilTankVolume={oilTankVolume}
              operator={operator}
              recipe={recipe}
              requiredOil={requiredOil}
              setChecklist={setChecklist}
              setHose={setHose}
              setOilTankVolume={setOilTankVolume}
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
            <AlarmsScreen alarm={alarm} emergency={emergency} logs={logs} reset={reset} setScreen={setScreen} status={status} />
          )}

          {screen === "registro" && (
            <RecordScreen
              avgMachinePressure={avgMachinePressure}
              avgTankPressure={avgTankPressure}
              elapsed={elapsed}
              hose={hose}
              logs={logs}
              oilInjected={oilInjected}
              oilTankVolume={oilTankVolume}
              operationId={operationId}
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
  checklist: Checklist;
  elapsed: number;
  finishSafe: () => void;
  hose: Hose;
  logs: LogItem[];
  oilFlow: number;
  oilInjected: number;
  oilRemaining: number;
  oilRunning: boolean;
  oilTankVolume: number;
  operationId: string;
  pauseOrResume: () => void;
  recipe: Recipe;
  requiredOil: number;
  setScreen: (screen: Screen) => void;
  stage: string;
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
        <TopCard label="OPERACAO" value={props.operationId} />
        <TopCard label="RECEITA" value={recipes[props.recipe].label} />
        <TopCard label="MANGUEIRA" value={props.hose} />
        <TopCard label="TEMPO" value={timeFmt(props.elapsed)} />
      </div>

      <div className={`alarm-bar ${props.alarm.tone}`}>
        {props.alarm.text}
      </div>

      <div className="valve-strip">
        <span className={props.checklist.upperValve ? "ok" : "bad"}>VALVULA SUPERIOR: {props.checklist.upperValve ? "ABERTA" : "PENDENTE"}</span>
        <span className={props.checklist.lowerValve ? "ok" : "bad"}>VALVULA INFERIOR: {props.checklist.lowerValve ? "FECHADA" : "PENDENTE"}</span>
        <span className={props.checklist.sensors ? "ok" : "bad"}>SENSORES: {props.checklist.sensors ? "COMUNICANDO" : "PENDENTE"}</span>
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
          <EventList logs={props.logs.slice(0, 3)} />
        </div>

        <OilVisual
          flow={props.oilFlow}
          injected={props.oilInjected}
          remaining={props.oilRemaining}
          required={props.requiredOil}
          running={props.oilRunning}
          tankVolume={props.oilTankVolume}
        />
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
      <small>Oleo entrando: {fmt(tank.oilInLiters, "L")}</small>
      <small>Perda mang.: {fmt(tank.hoseLoss, "mbar")}</small>
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

function OilVisual(props: { flow: number; injected: number; remaining: number; required: number; running: boolean; tankVolume: number }) {
  const percentRemaining = props.tankVolume > 0 ? Math.max(0, Math.min(100, (props.remaining / props.tankVolume) * 100)) : 0;

  return (
    <article className="oil-area">
      <div className={`oil-led ${props.running ? "on" : ""}`} />
      <div className="oil-tank">
        <div className="oil-fill" style={{ height: `${Math.max(8, percentRemaining)}%` }}>
          <strong>{props.running ? "SAINDO" : "AGD."}</strong>
        </div>
      </div>
      <h2>OLEO</h2>
      <strong>{props.running ? "INJETANDO" : "AGUARDANDO"}</strong>
      <div className="oil-metrics">
        <span>Colocado: {fmt(props.tankVolume, "L")}</span>
        <span>Necessario: {fmt(props.required, "L")}</span>
        <span>Saindo: {fmt(props.injected, "L")}</span>
        <span>Restante: {fmt(props.remaining, "L")}</span>
        <span>Vazao: {fmt(props.flow, "L/min")}</span>
        <span>Temp.: 60 C +/- 5 C</span>
      </div>
    </article>
  );
}

function PrepScreen(props: {
  checklist: Checklist;
  hose: Hose;
  oilTankVolume: number;
  operator: string;
  recipe: Recipe;
  requiredOil: number;
  setChecklist: (value: Checklist) => void;
  setHose: (value: Hose) => void;
  setOilTankVolume: (value: number) => void;
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
    ["oil", "Oleo disponivel no reservatorio"],
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

          <label>Mangueira</label>
          <select value={props.hose} onChange={(e) => props.setHose(e.target.value as Hose)}>
            <option value="MG-01">MG-01 curta</option>
            <option value="MG-02">MG-02 media</option>
            <option value="MG-03">MG-03 longa</option>
          </select>

          <label>Volume colocado no tanque de oleo (L)</label>
          <input
            min={0}
            type="number"
            value={props.oilTankVolume}
            onChange={(e) => props.setOilTankVolume(Math.max(0, Number(e.target.value) || 0))}
          />

          <p className="prep-note">Volume necessario pela receita atual: {fmt(props.requiredOil, "L")}</p>

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

function EventList({ logs }: { logs: LogItem[] }) {
  return (
    <div className="event-mini">
      <strong>EVENTOS</strong>
      {logs.length === 0 ? (
        <span>Sem eventos</span>
      ) : (
        logs.map((log, index) => (
          <span key={`${log.time}-${index}`} className={log.tone}>{log.time} - {log.message}</span>
        ))
      )}
    </div>
  );
}

function AlarmsScreen({ alarm, emergency, logs, reset, setScreen, status }: { alarm: { tone: AlarmTone; text: string }; emergency: () => void; logs: LogItem[]; reset: () => void; setScreen: (screen: Screen) => void; status: Status }) {
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
          <p>Verificar temperatura, vazao, volume colocado e volume injetado.</p>
        </article>

        <article className="alarm-card ok">
          <strong>LOG LOCAL</strong>
          <div className="event-list">
            {logs.map((log, index) => (
              <span key={`${log.time}-${index}`} className={log.tone}>{log.time} - {log.type}: {log.message}</span>
            ))}
          </div>
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
  hose: Hose;
  logs: LogItem[];
  oilInjected: number;
  oilTankVolume: number;
  operationId: string;
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
        <Info label="ID operacao" value={props.operationId} />
        <Info label="Operador" value={props.operator} />
        <Info label="Turno" value={props.shift} />
        <Info label="Tanques" value={String(props.tankCount)} />
        <Info label="Mangueira" value={props.hose} />
        <Info label="Receita" value={recipes[props.recipe].label} />
        <Info label="Tempo" value={timeFmt(props.elapsed)} />
        <Info label="Pressao tanque" value={fmt(props.avgTankPressure, "mbar")} />
        <Info label="Pressao maquina" value={fmt(props.avgMachinePressure, "mbar")} />
        <Info label="Oleo colocado" value={fmt(props.oilTankVolume, "L")} />
        <Info label="Oleo injetado" value={fmt(props.oilInjected, "L")} />
        <Info label="Status" value={props.status} />
      </div>

      <div className="record-log">
        <strong>Eventos do ciclo</strong>
        {props.logs.map((log, index) => (
          <span key={`${log.time}-${index}`} className={log.tone}>{log.time} - {log.type}: {log.message}</span>
        ))}
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