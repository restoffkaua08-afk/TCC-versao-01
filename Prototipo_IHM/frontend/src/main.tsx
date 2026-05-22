import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  Menu,
  Pause,
  Play,
  Power,
  RotateCcw,
  ShieldAlert,
  Square,
  X
} from "lucide-react";
import "./styles.css";

type Screen = "operacao" | "preparo" | "alarmes" | "registro";
type Status = "PRONTA" | "EM OPERAÇÃO" | "PAUSADA" | "ATENÇÃO" | "BLOQUEADA" | "CONCLUÍDA";
type Recipe = "padrao" | "grande" | "critico";
type Hose = "MG-01" | "MG-02" | "MG-03";

type Tank = {
  code: string;
  machinePressure: number;
  tankPressure: number;
  hoseLoss: number;
  oil: number;
  air: number;
  vacuum: number;
  status: "NORMAL" | "ATENÇÃO" | "BLOQUEIO";
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

type Confirm = {
  title: string;
  text: string;
  label: string;
  danger?: boolean;
  action: () => void;
};

const stages = [
  "PREPARAÇÃO",
  "VÁCUO INICIAL",
  "VÁCUO PROFUNDO",
  "INJEÇÃO DE ÓLEO",
  "ESTABILIZAÇÃO",
  "FINALIZAÇÃO"
];

const recipes: Record<Recipe, { label: string; target: number; oilTarget: number; ramp: string }> = {
  padrao: { label: "PADRÃO", target: 8, oilTarget: 50, ramp: "RAMPA PADRÃO" },
  grande: { label: "TANQUE GRANDE", target: 12, oilTarget: 65, ramp: "RAMPA MONITORADA" },
  critico: { label: "TANQUE CRÍTICO", target: 35, oilTarget: 45, ramp: "VÁCUO BRANDO" }
};

function tone(value: string) {
  const v = value.toLowerCase();

  if (v.includes("bloque") || v.includes("emerg") || v.includes("falha") || v.includes("crít")) return "danger";
  if (v.includes("aten") || v.includes("paus") || v.includes("monitorada") || v.includes("brando") || v.includes("pendente")) return "warn";
  if (v.includes("operação") || v.includes("normal") || v.includes("pronta") || v.includes("liber") || v.includes("ok") || v.includes("conclu")) return "ok";

  return "info";
}

function formatTime(seconds: number) {
  const min = Math.floor(seconds / 60).toString().padStart(2, "0");
  const sec = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function getStage(status: Status, elapsed: number) {
  if (status === "PRONTA" || status === "BLOQUEADA") return 0;
  if (status === "CONCLUÍDA") return 5;
  if (elapsed < 24) return 1;
  if (elapsed < 90) return 2;
  if (elapsed < 160) return 3;
  if (elapsed < 195) return 4;
  return 5;
}

function machinePressure(elapsed: number, target: number) {
  if (elapsed < 24) return Math.max(target, 1013 * Math.exp(-elapsed / 8));
  if (elapsed < 90) return Math.max(target, 75 * Math.exp(-(elapsed - 24) / 20));
  return target;
}

function hoseLoss(hose: Hose, tankCount: number, index: number) {
  const base = hose === "MG-01" ? 0.8 : hose === "MG-02" ? 1.5 : 2.2;
  return base + (tankCount - 1) * 0.7 + index * 0.3;
}

function buildTanks(tankCount: number, status: Status, elapsed: number, recipe: Recipe, hose: Hose): Tank[] {
  const profile = recipes[recipe];
  const stage = getStage(status, elapsed);
  const running = status === "EM OPERAÇÃO" || status === "PAUSADA" || status === "ATENÇÃO";

  return Array.from({ length: tankCount }).map((_, index) => {
    const loss = hoseLoss(hose, tankCount, index);

    if (status === "BLOQUEADA") {
      return {
        code: `TQ-0${index + 1}`,
        machinePressure: 1013,
        tankPressure: 1013,
        hoseLoss: loss,
        oil: 0,
        air: 100,
        vacuum: 0,
        status: "BLOQUEIO"
      };
    }

    if (!running) {
      return {
        code: `TQ-0${index + 1}`,
        machinePressure: 1013,
        tankPressure: 1013,
        hoseLoss: loss,
        oil: 0,
        air: 100,
        vacuum: 0,
        status: "NORMAL"
      };
    }

    const pMachine = machinePressure(elapsed, profile.target);
    const pTank = pMachine + loss;
    const oilProgress = stage >= 3 ? Math.min(1, Math.max(0, (elapsed - 90) / 70)) : 0;
    const oil = profile.oilTarget * oilProgress;
    const vacuum = Math.min(88, Math.max(0, ((1013 - pTank) / 1013) * 88));
    const air = Math.max(8, 76 - vacuum * 0.38 - oilProgress * 30);

    const attention =
      status === "ATENÇÃO" ||
      (recipe === "critico" && elapsed < 30) ||
      (tankCount === 3 && index === 2 && elapsed > 45);

    return {
      code: `TQ-0${index + 1}`,
      machinePressure: pMachine,
      tankPressure: pTank,
      hoseLoss: loss,
      oil,
      air,
      vacuum,
      status: attention ? "ATENÇÃO" : "NORMAL"
    };
  });
}

function App() {
  const [screen, setScreen] = useState<Screen>("operacao");
  const [status, setStatus] = useState<Status>("PRONTA");
  const [elapsed, setElapsed] = useState(0);
  const [tankCount, setTankCount] = useState(2);
  const [recipe, setRecipe] = useState<Recipe>("padrao");
  const [hose, setHose] = useState<Hose>("MG-02");
  const [operator, setOperator] = useState("OPERADOR 01");
  const [shift, setShift] = useState("MANHÃ");
  const [menuOpen, setMenuOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const [checklist, setChecklist] = useState<Checklist>({
    hose: true,
    upperValve: true,
    lowerValve: true,
    tanks: true,
    oil: false,
    emergency: true,
    sensors: true,
    interlocks: true
  });

  const ready = Object.values(checklist).every(Boolean);
  const stage = getStage(status, elapsed);
  const tanks = useMemo(() => buildTanks(tankCount, status, elapsed, recipe, hose), [tankCount, status, elapsed, recipe, hose]);

  const avgTankPressure = tanks.reduce((acc, tank) => acc + tank.tankPressure, 0) / tanks.length;
  const avgMachinePressure = tanks.reduce((acc, tank) => acc + tank.machinePressure, 0) / tanks.length;

  const b1 = status === "EM OPERAÇÃO" && stage >= 1 && stage <= 4;
  const b2 = status === "EM OPERAÇÃO" && stage === 2;

  const permission = ready && status !== "BLOQUEADA" ? "LIBERADO" : "BLOQUEADO";
  const alarm = getActiveAlarm(status, ready, recipe, stage);
  const ramp = status === "EM OPERAÇÃO" && stage === 1 ? recipes[recipe].ramp : status === "EM OPERAÇÃO" ? "MONITORANDO" : "AGUARDANDO";
  const oilActive = stage >= 3 && status === "EM OPERAÇÃO";

  useEffect(() => {
    if (status !== "EM OPERAÇÃO") return;

    const timer = window.setInterval(() => {
      setElapsed((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status === "EM OPERAÇÃO" && stage >= 5) {
      setStatus("CONCLUÍDA");
      setScreen("registro");
    }
  }, [stage, status]);

  function ask(config: Confirm) {
    setConfirm(config);
  }

  function startCycle() {
    if (!ready) {
      setStatus("ATENÇÃO");
      setScreen("preparo");
      return;
    }

    ask({
      title: "INICIAR CICLO",
      text: "Confirmar início do ciclo? A sequência será automática pelo CLP/simulação.",
      label: "INICIAR",
      action: () => {
        setElapsed(0);
        setStatus("EM OPERAÇÃO");
        setAck(false);
        setScreen("operacao");
      }
    });
  }

  function pauseCycle() {
    ask({
      title: "SOLICITAR PAUSA",
      text: "Solicitar pausa operacional ao CLP/simulação? As bombas entram em estado seguro simulado.",
      label: "PAUSAR",
      action: () => setStatus("PAUSADA")
    });
  }

  function resumeCycle() {
    ask({
      title: "RETOMAR CICLO",
      text: "Solicitar retomada operacional ao CLP/simulação?",
      label: "RETOMAR",
      action: () => setStatus("EM OPERAÇÃO")
    });
  }

  function emergencyStop() {
    ask({
      title: "EMERGÊNCIA GERAL",
      text: "Acionar bloqueio geral simulado da operação?",
      label: "ACIONAR",
      danger: true,
      action: () => {
        setStatus("BLOQUEADA");
        setScreen("alarmes");
      }
    });
  }

  function pumpStop(pump: "B1" | "B2") {
    ask({
      title: `PARADA ${pump}`,
      text: `Solicitar parada individual da ${pump}? Em operação real, o CLP validaria os intertravamentos.`,
      label: `PARAR ${pump}`,
      danger: true,
      action: () => {
        setStatus("ATENÇÃO");
        setScreen("alarmes");
      }
    });
  }

  function resetCycle() {
    ask({
      title: "RESETAR CICLO",
      text: "Resetar operação simulada e voltar para estado pronto?",
      label: "RESETAR",
      action: () => {
        setStatus("PRONTA");
        setElapsed(0);
        setAck(false);
        setScreen("operacao");
      }
    });
  }

  function safeEndCycle() {
    ask({
      title: "ENCERRAR SEGURO",
      text:
        status === "CONCLUÍDA"
          ? "Salvar resumo da operação concluída?"
          : "O ciclo ainda não está concluído. Esta ação representa uma interrupção controlada simulada, não uma finalização normal.",
      label: "CONFIRMAR",
      danger: status !== "CONCLUÍDA",
      action: () => {
        setStatus("CONCLUÍDA");
        setScreen("registro");
      }
    });
  }

  return (
    <div className="scene">
      <div className="device">
        <div className="grip grip-left" />
        <div className="grip grip-right" />

        <button className="round-button green-button" aria-label="Indicador pronto">
          <span />
        </button>

        <button className="round-button red-button" onClick={emergencyStop} aria-label="Bloqueio">
          <span />
        </button>

        <div className="side-label side-left">PRONTO</div>
        <div className="side-label side-right">BLOQUEIO</div>

        <main className="screen">
          <header className="screen-header">
            <div>
              <strong>TSEA · IHM LOCAL</strong>
              <span>PROCESSO DE VÁCUO E ÓLEO</span>
            </div>

            <button className="menu-button" onClick={() => setMenuOpen(true)}>
              <Menu size={21} />
              MENU
            </button>
          </header>

          <section className="status-row">
            <StatusBox label="STATUS" value={status} />
            <StatusBox label="PERMISSÃO" value={permission} />
            <StatusBox label="ETAPA" value={stages[stage]} />
            <StatusBox label="RECEITA" value={recipes[recipe].label} />
          </section>

          <section className={`alarm-strip ${tone(alarm)}`}>
            <AlertTriangle size={20} />
            <strong>{alarm}</strong>
          </section>

          {screen === "operacao" && (
            <section className="operation-screen">
              <div className="process-panel">
                <div className="panel-title">
                  <div>
                    <small>CICLO</small>
                    <h1>OP-IHM-0001</h1>
                  </div>
                  <div className="clock">{formatTime(elapsed)}</div>
                </div>

                <div className="kpi-row">
                  <Kpi label="Pressão tanque" value={`${avgTankPressure.toFixed(1)} mbar`} />
                  <Kpi label="Pressão máquina" value={`${avgMachinePressure.toFixed(1)} mbar`} />
                  <Kpi label="Rampa" value={ramp} />
                  <Kpi label="Tanques" value={`${tankCount}`} />
                </div>

                <div className="valve-row">
                  <ValveBox label="Válvula superior" value={checklist.upperValve ? "ABERTA" : "FECHADA"} />
                  <ValveBox label="Válvula inferior" value={checklist.lowerValve ? "FECHADA" : "ABERTA"} />
                  <ValveBox label="Linha vácuo" value={stage >= 1 && stage <= 2 ? "ATIVA" : "AGUARDANDO"} />
                  <ValveBox label="Linha óleo" value={oilActive ? "INJETANDO" : "AGUARDANDO"} />
                </div>

                <div className={`tank-grid tank-grid-${tankCount}`}>
                  {tanks.map((tank) => (
                    <TankCard key={tank.code} tank={tank} />
                  ))}
                </div>
              </div>

              <div className="command-panel">
                <ActionButton label="PREPARO" icon={<ClipboardCheck size={22} />} onClick={() => setScreen("preparo")} />
                {status === "PAUSADA" || status === "ATENÇÃO" ? (
                  <ActionButton label="RETOMAR" icon={<Play size={22} />} onClick={resumeCycle} />
                ) : (
                  <ActionButton label="PAUSAR" icon={<Pause size={22} />} onClick={pauseCycle} />
                )}
                <ActionButton label="INICIAR" icon={<Play size={22} />} onClick={startCycle} primary />
                <ActionButton label="ALARMES" icon={<ShieldAlert size={22} />} onClick={() => setScreen("alarmes")} />
                <ActionButton label="ENCERRAR SEGURO" icon={<Square size={22} />} onClick={safeEndCycle} />
                <ActionButton label="RESET" icon={<RotateCcw size={22} />} onClick={resetCycle} />
              </div>

              <div className="bottom-panel">
                <PumpCard code="B1" name="Bomba primária" running={b1} />
                <PumpCard code="B2" name="Bomba Roots" running={b2} />
                <OilCard active={oilActive} />
                <StageCard stage={stage} />
              </div>
            </section>
          )}

          {screen === "preparo" && (
            <section className="prep-screen">
              <div className="setup-card">
                <div className="panel-title">
                  <div>
                    <small>PREPARAÇÃO</small>
                    <h1>Configuração do ciclo</h1>
                  </div>
                  <StatusPill value={ready ? "LIBERADO" : "BLOQUEADO"} />
                </div>

                <div className="form-grid">
                  <label>
                    <span>Quantidade de tanques</span>
                    <div className="tank-select">
                      {[1, 2, 3].map((value) => (
                        <button key={value} className={tankCount === value ? "selected" : ""} onClick={() => setTankCount(value)}>
                          {value}
                        </button>
                      ))}
                    </div>
                  </label>

                  <label>
                    <span>Receita</span>
                    <select value={recipe} onChange={(event) => setRecipe(event.target.value as Recipe)}>
                      <option value="padrao">Padrão</option>
                      <option value="grande">Tanque grande</option>
                      <option value="critico">Tanque crítico</option>
                    </select>
                  </label>

                  <label>
                    <span>Mangueira</span>
                    <select value={hose} onChange={(event) => setHose(event.target.value as Hose)}>
                      <option value="MG-01">MG-01</option>
                      <option value="MG-02">MG-02</option>
                      <option value="MG-03">MG-03</option>
                    </select>
                  </label>

                  <label>
                    <span>Operador</span>
                    <select value={operator} onChange={(event) => setOperator(event.target.value)}>
                      <option>OPERADOR 01</option>
                      <option>OPERADOR 02</option>
                      <option>MANUTENÇÃO</option>
                    </select>
                  </label>

                  <label>
                    <span>Turno</span>
                    <select value={shift} onChange={(event) => setShift(event.target.value)}>
                      <option>MANHÃ</option>
                      <option>TARDE</option>
                      <option>NOITE</option>
                    </select>
                  </label>
                </div>

                <button className="start-cycle" disabled={!ready} onClick={startCycle}>
                  <Play size={24} />
                  INICIAR CICLO
                </button>
              </div>

              <div className="check-card">
                <small>CHECKLIST DE LIBERAÇÃO</small>
                <CheckItem label="Mangueira conectada" checked={checklist.hose} onClick={() => setChecklist({ ...checklist, hose: !checklist.hose })} />
                <CheckItem label="Válvula superior aberta" checked={checklist.upperValve} onClick={() => setChecklist({ ...checklist, upperValve: !checklist.upperValve })} />
                <CheckItem label="Válvula inferior fechada" checked={checklist.lowerValve} onClick={() => setChecklist({ ...checklist, lowerValve: !checklist.lowerValve })} />
                <CheckItem label="Tanques posicionados" checked={checklist.tanks} onClick={() => setChecklist({ ...checklist, tanks: !checklist.tanks })} />
                <CheckItem label="Óleo disponível" checked={checklist.oil} onClick={() => setChecklist({ ...checklist, oil: !checklist.oil })} />
                <CheckItem label="Emergência liberada" checked={checklist.emergency} onClick={() => setChecklist({ ...checklist, emergency: !checklist.emergency })} />
                <CheckItem label="Sensores comunicando" checked={checklist.sensors} onClick={() => setChecklist({ ...checklist, sensors: !checklist.sensors })} />
                <CheckItem label="Intertravamentos liberados" checked={checklist.interlocks} onClick={() => setChecklist({ ...checklist, interlocks: !checklist.interlocks })} />
              </div>
            </section>
          )}

          {screen === "alarmes" && (
            <section className="alarm-screen">
              <div className="alarm-list">
                <AlarmCard
                  code="ALM-001"
                  title={status === "BLOQUEADA" ? "Emergência geral acionada" : "Rampa inicial de vácuo"}
                  severity={status === "BLOQUEADA" ? "CRÍTICO" : "ATENÇÃO"}
                  action={status === "BLOQUEADA" ? "Inspecionar área e liberar somente após autorização." : "Acompanhar pressão no tanque, mangueira e bomba primária."}
                />
                <AlarmCard
                  code="ALM-002"
                  title="Perda de carga na mangueira"
                  severity="ATENÇÃO"
                  action="Comparar pressão da máquina com pressão estimada no tanque."
                />
                <AlarmCard
                  code="ALM-003"
                  title="Sistema de óleo"
                  severity={oilActive ? "NORMAL" : "ATENÇÃO"}
                  action={oilActive ? "Óleo em injeção monitorada." : "Verificar liberação e disponibilidade de óleo antes do ciclo."}
                />
              </div>

              <div className="alarm-actions">
                <ActionButton label="RECONHECER" icon={<CheckCircle2 size={22} />} onClick={() => setAck(true)} primary />
                <ActionButton label="OPERAÇÃO" icon={<Gauge size={22} />} onClick={() => setScreen("operacao")} />
                <ActionButton label="RESET" icon={<RotateCcw size={22} />} onClick={resetCycle} />
                {ack && <strong className="ack">ALARME RECONHECIDO</strong>}
              </div>
            </section>
          )}

          {screen === "registro" && (
            <section className="record-screen">
              <div className="record-card">
                <small>REGISTRO DO CICLO</small>
                <h1>OP-IHM-0001</h1>

                <div className="record-grid">
                  <Kpi label="Operador" value={operator} />
                  <Kpi label="Turno" value={shift} />
                  <Kpi label="Tanques" value={`${tankCount}`} />
                  <Kpi label="Receita" value={recipes[recipe].label} />
                  <Kpi label="Mangueira" value={hose} />
                  <Kpi label="Tempo demo" value={formatTime(elapsed)} />
                  <Kpi label="Pressão média" value={`${avgTankPressure.toFixed(1)} mbar`} />
                  <Kpi label="Status" value={status} />
                </div>
              </div>

              <div className="record-actions">
                <ActionButton label="SALVAR" icon={<ClipboardCheck size={22} />} onClick={() => null} primary />
                <ActionButton label="NOVO CICLO" icon={<RotateCcw size={22} />} onClick={resetCycle} />
              </div>
            </section>
          )}
        </main>

        <button className="emergency-button" onClick={emergencyStop}>
          <Power size={30} />
          EMERGÊNCIA
        </button>

        <button className="pump-stop stop-left" onClick={() => pumpStop("B1")}>
          <Square size={19} />
          PARADA B1
        </button>

        <button className="pump-stop stop-right" onClick={() => pumpStop("B2")}>
          <Square size={19} />
          PARADA B2
        </button>

        {menuOpen && (
          <Modal title="MENU DA IHM" close={() => setMenuOpen(false)}>
            <div className="menu-grid">
              <ActionButton label="OPERAÇÃO" icon={<Gauge size={22} />} onClick={() => { setScreen("operacao"); setMenuOpen(false); }} />
              <ActionButton label="PREPARO" icon={<ClipboardCheck size={22} />} onClick={() => { setScreen("preparo"); setMenuOpen(false); }} />
              <ActionButton label="ALARMES" icon={<ShieldAlert size={22} />} onClick={() => { setScreen("alarmes"); setMenuOpen(false); }} />
              <ActionButton label="REGISTRO" icon={<ClipboardCheck size={22} />} onClick={() => { setScreen("registro"); setMenuOpen(false); }} />
            </div>
          </Modal>
        )}

        {confirm && (
          <Modal title={confirm.title} close={() => setConfirm(null)}>
            <p className="confirm-text">{confirm.text}</p>
            <div className="confirm-actions">
              <button onClick={() => setConfirm(null)}>CANCELAR</button>
              <button
                className={confirm.danger ? "danger-action" : "confirm-action"}
                onClick={() => {
                  confirm.action();
                  setConfirm(null);
                }}
              >
                {confirm.label}
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

function getActiveAlarm(status: Status, ready: boolean, recipe: Recipe, stage: number) {
  if (status === "BLOQUEADA") return "EMERGÊNCIA ACIONADA — OPERAÇÃO BLOQUEADA";
  if (!ready) return "CHECKLIST PENDENTE — INÍCIO BLOQUEADO";
  if (status === "ATENÇÃO") return "ATENÇÃO OPERACIONAL — VERIFICAR PROCESSO";
  if (recipe === "critico" && stage === 1) return "ATENÇÃO: TANQUE CRÍTICO COM VÁCUO BRANDO";
  return "SEM ALARME ATIVO";
}

function StatusBox({ label, value }: { label: string; value: string }) {
  return (
    <div className={`status-box ${tone(value)}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  return <span className={`status-pill ${tone(value)}`}>{value}</span>;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ValveBox({ label, value }: { label: string; value: string }) {
  return (
    <div className={`valve-box ${tone(value)}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActionButton({ label, icon, onClick, primary }: { label: string; icon: ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button className={`action-button ${primary ? "primary" : ""}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function TankCard({ tank }: { tank: Tank }) {
  return (
    <article className={`tank-card ${tone(tank.status)}`}>
      <div className="tank-visual">
        <div className="tank-bar air" style={{ height: `${Math.max(10, tank.air)}%` }}>
          <span>AR</span>
        </div>
        <div className="tank-bar vacuum" style={{ height: `${Math.max(8, tank.vacuum)}%` }}>
          <span>VÁCUO</span>
        </div>
        <div className="tank-bar oil" style={{ height: `${Math.max(0, tank.oil)}%` }}>
          <span>ÓLEO</span>
        </div>
        <strong>{tank.code}</strong>
      </div>

      <div className="tank-data">
        <Kpi label="P. tanque" value={`${tank.tankPressure.toFixed(1)} mbar`} />
        <Kpi label="P. máquina" value={`${tank.machinePressure.toFixed(1)} mbar`} />
        <Kpi label="Perda mang." value={`${tank.hoseLoss.toFixed(1)} mbar`} />
        <Kpi label="Óleo" value={`${tank.oil.toFixed(0)} L`} />
        <Kpi label="Estado" value={tank.status} />
      </div>
    </article>
  );
}

function PumpCard({ code, name, running }: { code: string; name: string; running: boolean }) {
  return (
    <article className="pump-card">
      <div className={`pump-icon ${running ? "on" : ""}`}>{code}</div>
      <div>
        <h3>{name}</h3>
        <p>{running ? "LIGADA" : "DESLIGADA"}</p>
        <p>CLP SIMULADO</p>
      </div>
    </article>
  );
}

function OilCard({ active }: { active: boolean }) {
  return (
    <article className={`oil-card ${active ? "oil-active" : ""}`}>
      <h3>SISTEMA DE ÓLEO</h3>
      <Kpi label="Vazão" value={active ? "2,1 L/min" : "0,0 L/min"} />
      <Kpi label="Temp." value="60 °C" />
      <Kpi label="Estado" value={active ? "INJETANDO" : "AGUARDANDO"} />
    </article>
  );
}

function StageCard({ stage }: { stage: number }) {
  return (
    <article className="stage-card">
      <h3>SEQUÊNCIA AUTOMÁTICA</h3>
      {stages.map((item, index) => (
        <div key={item} className={`stage-line ${index < stage ? "done" : index === stage ? "active" : ""}`}>
          <span>{index + 1}</span>
          <strong>{item}</strong>
        </div>
      ))}
    </article>
  );
}

function CheckItem({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button className={`check-item ${checked ? "checked" : ""}`} onClick={onClick}>
      <CheckCircle2 size={20} />
      {label}
    </button>
  );
}

function AlarmCard({ code, title, severity, action }: { code: string; title: string; severity: string; action: string }) {
  return (
    <article className={`alarm-card ${tone(severity)}`}>
      <strong>{code} · {title}</strong>
      <span>{severity}</span>
      <p>{action}</p>
    </article>
  );
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <header>
          <h2>{title}</h2>
          <button onClick={close}>
            <X size={22} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);