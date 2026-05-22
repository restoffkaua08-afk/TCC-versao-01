import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type View = "painel" | "operacao" | "rastreabilidade" | "parametros";
type Status = "PRONTO" | "EM OPERAÇÃO" | "PAUSADO" | "ATENÇÃO" | "EMERGÊNCIA" | "FINALIZADO";
type LightState = "VERDE" | "AMARELO" | "VERMELHO";
type EquipmentState = "Desligado" | "Ligado" | "Bloqueado";

type LogEntry = {
  id: string;
  time: string;
  type: string;
  message: string;
};

type RampSample = {
  second: number;
  sensorPressure: number;
  tankPressure: number;
  pump: EquipmentState;
  lamp: EquipmentState;
  status: Status;
};

type OperationRecord = {
  id: string;
  startedAt: string;
  finishedAt: string;
  totalTime: number;
  status: Status;
  minSensorPressure: number;
  minTankPressure: number;
  sampleCount: number;
  logs: LogEntry[];
  ramp: RampSample[];
};

const storageKey = "tsea_v2_physical_records";

function nowTime() {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function nowDateTime() {
  return new Date().toLocaleString("pt-BR");
}

function formatTime(seconds: number) {
  const min = Math.floor(seconds / 60).toString().padStart(2, "0");
  const sec = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function safeId(prefix: string) {
  return `${prefix}-${new Date().getTime().toString().slice(-6)}`;
}

function calcHoseLoss(lengthMeters: number, diameterMm: number, factor: number) {
  const diameterSafe = Math.max(diameterMm, 1);
  return Number(((lengthMeters / diameterSafe) * factor * 10).toFixed(2));
}

function pressureCurve(seconds: number, target: number, pumpOn: boolean) {
  if (!pumpOn) return 1013;
  const pressure = 1013 * Math.exp(-seconds / 18);
  return Number(Math.max(target, pressure).toFixed(2));
}

function getStage(seconds: number, status: Status) {
  if (status === "PRONTO") return "Preparação";
  if (status === "EMERGÊNCIA") return "Emergência";
  if (status === "FINALIZADO") return "Finalização";
  if (seconds < 10) return "Preparação";
  if (seconds < 24) return "Evacuação inicial";
  if (seconds < 60) return "Acionamento B2 simulada";
  if (seconds < 95) return "Estabilização";
  return "Finalização";
}

function loadRecords(): OperationRecord[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "[]") as OperationRecord[];
  } catch {
    return [];
  }
}

function saveRecords(records: OperationRecord[]) {
  localStorage.setItem(storageKey, JSON.stringify(records));
}

function App() {
  const [view, setView] = useState<View>("painel");
  const [status, setStatus] = useState<Status>("PRONTO");
  const [elapsed, setElapsed] = useState(0);
  const [sensorConnected, setSensorConnected] = useState(true);
  const [plcConnected, setPlcConnected] = useState(true);
  const [pumpState, setPumpState] = useState<EquipmentState>("Desligado");
  const [lampState, setLampState] = useState<EquipmentState>("Desligado");
  const [targetPressure, setTargetPressure] = useState(6.5);
  const [lampTriggerPressure, setLampTriggerPressure] = useState(80);
  const [alarmPressureLimit, setAlarmPressureLimit] = useState(120);
  const [hoseLength, setHoseLength] = useState(2);
  const [hoseDiameter, setHoseDiameter] = useState(10);
  const [hoseFactor, setHoseFactor] = useState(0.35);
  const [operator, setOperator] = useState("Operador 01");
  const [cycleId, setCycleId] = useState("OP-PROT-0001");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [ramp, setRamp] = useState<RampSample[]>([]);
  const [records, setRecords] = useState<OperationRecord[]>(loadRecords);

  const hoseLoss = useMemo(
    () => calcHoseLoss(hoseLength, hoseDiameter, hoseFactor),
    [hoseLength, hoseDiameter, hoseFactor]
  );

  const sensorPressure = pressureCurve(elapsed, targetPressure, pumpState === "Ligado");
  const tankPressure = Number(Math.max(targetPressure, sensorPressure - hoseLoss).toFixed(2));
  const stage = getStage(elapsed, status);

  const lightState: LightState =
    status === "EMERGÊNCIA" || pumpState === "Bloqueado"
      ? "VERMELHO"
      : status === "ATENÇÃO" || !sensorConnected || !plcConnected
        ? "AMARELO"
        : "VERDE";

  const connectionState = sensorConnected && plcConnected ? "Conectado" : "Atenção";
  const performance = useMemo(() => {
    if (elapsed === 0 || pumpState !== "Ligado") return 100;
    const expectedTime = 24;
    if (sensorPressure > targetPressure * 1.8) return Math.max(40, Math.round((expectedTime / Math.max(elapsed, 1)) * 100));
    return 100;
  }, [elapsed, pumpState, sensorPressure, targetPressure]);

  function addLog(type: string, message: string) {
    setLogs((current) => [
      {
        id: safeId("LOG"),
        time: nowTime(),
        type,
        message
      },
      ...current
    ]);
  }

  function startCycle() {
    if (!sensorConnected || !plcConnected) {
      setStatus("ATENÇÃO");
      addLog("Bloqueio", "Tentativa de início com sensor ou PLC desconectado.");
      return;
    }

    setCycleId(safeId("OP-PROT"));
    setElapsed(0);
    setRamp([]);
    setLogs([]);
    setStatus("EM OPERAÇÃO");
    setPumpState("Ligado");
    setLampState("Desligado");

    setTimeout(() => {
      addLog("Sistema", "Ciclo iniciado. Bomba primária ligada.");
    }, 0);
  }

  function pauseCycle() {
    setStatus("PAUSADO");
    setPumpState("Desligado");
    setLampState("Desligado");
    addLog("Operação", "Ciclo pausado pelo operador.");
  }

  function resumeCycle() {
    if (!sensorConnected || !plcConnected) {
      setStatus("ATENÇÃO");
      addLog("Bloqueio", "Retomada bloqueada por falha de conexão.");
      return;
    }

    setStatus("EM OPERAÇÃO");
    setPumpState("Ligado");
    addLog("Operação", "Ciclo retomado pelo operador.");
  }

  function emergencyStop() {
    setStatus("EMERGÊNCIA");
    setPumpState("Bloqueado");
    setLampState("Bloqueado");
    addLog("Emergência", "Parada de emergência acionada. Operação bloqueada.");
  }

  function resetCycle() {
    setStatus("PRONTO");
    setElapsed(0);
    setPumpState("Desligado");
    setLampState("Desligado");
    setRamp([]);
    setLogs([]);
  }

  function finishCycle() {
    const record: OperationRecord = {
      id: cycleId,
      startedAt: "Registrado no protótipo",
      finishedAt: nowDateTime(),
      totalTime: elapsed,
      status: "FINALIZADO",
      minSensorPressure: ramp.length ? Math.min(...ramp.map((item) => item.sensorPressure)) : sensorPressure,
      minTankPressure: ramp.length ? Math.min(...ramp.map((item) => item.tankPressure)) : tankPressure,
      sampleCount: ramp.length,
      logs,
      ramp
    };

    const updated = [record, ...records];
    setRecords(updated);
    saveRecords(updated);

    setStatus("FINALIZADO");
    setPumpState("Desligado");
    setLampState("Desligado");
    addLog("Registro", "Operação finalizada e salva na rastreabilidade.");
    setView("rastreabilidade");
  }

  function clearRecords() {
    setRecords([]);
    saveRecords([]);
    addLog("Sistema", "Registros locais da versão do protótipo foram limpos.");
  }

  useEffect(() => {
    if (status !== "EM OPERAÇÃO") return;

    const timer = window.setInterval(() => {
      setElapsed((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status !== "EM OPERAÇÃO") return;

    if (sensorPressure <= lampTriggerPressure && lampState === "Desligado") {
      setLampState("Ligado");
      addLog("Automação", "Lâmpada B2 simulada acionada automaticamente pelo limite de pressão.");
    }

    if (elapsed > 14 && sensorPressure > alarmPressureLimit) {
      setStatus("ATENÇÃO");
      addLog("Alarme", "Pressão demorou mais que o esperado para cair. Verificar bomba, mangueira ou vedação.");
    }

    if (elapsed > 100 && sensorPressure <= targetPressure * 1.4) {
      finishCycle();
    }
  }, [elapsed, status, sensorPressure, lampState, lampTriggerPressure, alarmPressureLimit, targetPressure]);

  useEffect(() => {
    if (status !== "EM OPERAÇÃO") return;
    if (elapsed === 0) return;
    if (elapsed % 3 !== 0) return;

    setRamp((current) => [
      ...current,
      {
        second: elapsed,
        sensorPressure,
        tankPressure,
        pump: pumpState,
        lamp: lampState,
        status
      }
    ]);
  }, [elapsed, status, sensorPressure, tankPressure, pumpState, lampState]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span>TSEA V-Twin</span>
          <strong>Protótipo Físico</strong>
        </div>

        <nav>
          <button className={view === "painel" ? "active" : ""} onClick={() => setView("painel")}>Painel</button>
          <button className={view === "operacao" ? "active" : ""} onClick={() => setView("operacao")}>Operação</button>
          <button className={view === "rastreabilidade" ? "active" : ""} onClick={() => setView("rastreabilidade")}>Rastreabilidade</button>
          <button className={view === "parametros" ? "active" : ""} onClick={() => setView("parametros")}>Parâmetros</button>
        </nav>

        <div className={`tower tower-${lightState.toLowerCase()}`}>
          <span />
          <strong>Farol: {lightState}</strong>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span>VERSÃO 2 · SISTEMA DO PROTÓTIPO FÍSICO</span>
            <h1>{viewTitle(view)}</h1>
          </div>

          <div className="top-actions">
            <button onClick={startCycle}>Iniciar</button>
            {status === "PAUSADO" || status === "ATENÇÃO" ? (
              <button onClick={resumeCycle}>Retomar</button>
            ) : (
              <button onClick={pauseCycle}>Pausar</button>
            )}
            <button className="danger" onClick={emergencyStop}>Emergência</button>
          </div>
        </header>

        <section className="status-grid">
          <StatusCard label="Status" value={status} tone={tone(status)} />
          <StatusCard label="Etapa" value={stage} tone="neutral" />
          <StatusCard label="Conexão" value={connectionState} tone={connectionState === "Conectado" ? "ok" : "warn"} />
          <StatusCard label="Tempo" value={formatTime(elapsed)} tone="neutral" />
        </section>

        {view === "painel" && (
          <section className="grid panel-grid">
            <div className="card large">
              <div className="card-title">
                <div>
                  <span>CÂMARA / TANQUE DE DEMONSTRAÇÃO</span>
                  <h2>TQ-PROT-01</h2>
                </div>
                <Badge tone={tone(status)}>{status}</Badge>
              </div>

              <div className="tank-demo">
                <div className="tank-visual">
                  <div className="fill air" style={{ height: `${Math.max(12, 80 - elapsed * 0.35)}%` }}>AR</div>
                  <div className="fill vacuum" style={{ height: `${Math.min(82, elapsed * 0.8)}%` }}>VÁCUO</div>
                </div>

                <div className="readings">
                  <Info label="Pressão sensor" value={`${sensorPressure.toFixed(2)} mbar`} />
                  <Info label="Perda mangueira" value={`${hoseLoss.toFixed(2)} mbar`} />
                  <Info label="Pressão estimada no tanque" value={`${tankPressure.toFixed(2)} mbar`} />
                  <Info label="Amostras da rampa" value={`${ramp.length}`} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">
                <span>Equipamentos</span>
              </div>
              <Equipment label="Bomba primária" code="B1" state={pumpState} connection={plcConnected ? "Conectada" : "Indisponível"} performance={`${performance}%`} />
              <Equipment label="Lâmpada / B2 simulada" code="B2" state={lampState} connection={plcConnected ? "Conectada" : "Indisponível"} performance="Simulação" />
              <Equipment label="Sensor de pressão" code="S1" state={sensorConnected ? "Ligado" : "Bloqueado"} connection={sensorConnected ? "Conectado" : "Indisponível"} performance={`${sensorPressure.toFixed(1)} mbar`} />
            </div>

            <div className="card">
              <div className="card-title">
                <span>Últimos logs</span>
              </div>
              <LogList logs={logs.slice(0, 6)} />
            </div>
          </section>
        )}

        {view === "operacao" && (
          <section className="grid operation-grid">
            <div className="card large">
              <div className="card-title">
                <div>
                  <span>OPERAÇÃO DO PROTÓTIPO</span>
                  <h2>{cycleId}</h2>
                </div>
                <Badge tone={tone(status)}>{status}</Badge>
              </div>

              <div className="operation-actions">
                <button onClick={startCycle}>Iniciar ciclo</button>
                <button onClick={pauseCycle}>Pausar</button>
                <button onClick={resumeCycle}>Retomar</button>
                <button onClick={finishCycle}>Finalizar e salvar</button>
                <button onClick={resetCycle}>Resetar</button>
                <button className="danger" onClick={emergencyStop}>Parada de emergência</button>
              </div>

              <div className="cycle-steps">
                {["Preparação", "Evacuação inicial", "B2 simulada", "Estabilização", "Finalização"].map((item) => (
                  <div key={item} className={stage === item ? "current" : ""}>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">
                <span>Rampa de vácuo</span>
              </div>
              <RampChart samples={ramp} />
              <p className="hint">Amostragem automática de 3 em 3 segundos.</p>
            </div>

            <div className="card large">
              <div className="card-title">
                <span>Tabela da rampa</span>
              </div>
              <RampTable samples={ramp} />
            </div>
          </section>
        )}

        {view === "rastreabilidade" && (
          <section className="grid trace-grid">
            <div className="card large">
              <div className="card-title">
                <div>
                  <span>REGISTROS DO PROTÓTIPO</span>
                  <h2>Operações salvas</h2>
                </div>
                <button onClick={clearRecords}>Limpar registros</button>
              </div>

              <div className="records">
                {records.length === 0 ? (
                  <p className="empty">Nenhuma operação registrada nesta versão do protótipo.</p>
                ) : (
                  records.map((record) => (
                    <details key={record.id} className="record">
                      <summary>
                        <strong>{record.id}</strong>
                        <span>{record.finishedAt}</span>
                        <span>{record.sampleCount} amostras</span>
                      </summary>

                      <div className="record-data">
                        <Info label="Tempo total" value={formatTime(record.totalTime)} />
                        <Info label="Menor pressão sensor" value={`${record.minSensorPressure.toFixed(2)} mbar`} />
                        <Info label="Menor pressão tanque" value={`${record.minTankPressure.toFixed(2)} mbar`} />
                        <Info label="Status" value={record.status} />
                      </div>

                      <RampTable samples={record.ramp} />
                    </details>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-title">
                <span>Logs atuais</span>
              </div>
              <LogList logs={logs} />
            </div>
          </section>
        )}

        {view === "parametros" && (
          <section className="grid params-grid">
            <div className="card large">
              <div className="card-title">
                <span>Parâmetros do protótipo físico</span>
              </div>

              <div className="form-grid">
                <Field label="Operador">
                  <input value={operator} onChange={(event) => setOperator(event.target.value)} />
                </Field>

                <Field label="Pressão alvo da demonstração (mbar)">
                  <input type="number" value={targetPressure} onChange={(event) => setTargetPressure(Number(event.target.value))} />
                </Field>

                <Field label="Pressão para acionar lâmpada/B2 (mbar)">
                  <input type="number" value={lampTriggerPressure} onChange={(event) => setLampTriggerPressure(Number(event.target.value))} />
                </Field>

                <Field label="Limite de alarme de pressão (mbar)">
                  <input type="number" value={alarmPressureLimit} onChange={(event) => setAlarmPressureLimit(Number(event.target.value))} />
                </Field>

                <Field label="Comprimento da mangueira (m)">
                  <input type="number" value={hoseLength} onChange={(event) => setHoseLength(Number(event.target.value))} />
                </Field>

                <Field label="Diâmetro interno da mangueira (mm)">
                  <input type="number" value={hoseDiameter} onChange={(event) => setHoseDiameter(Number(event.target.value))} />
                </Field>

                <Field label="Fator de perda demonstrativo">
                  <input type="number" step="0.01" value={hoseFactor} onChange={(event) => setHoseFactor(Number(event.target.value))} />
                </Field>
              </div>
            </div>

            <div className="card">
              <div className="card-title">
                <span>Conexões simuladas</span>
              </div>

              <Toggle label="PLC / Kit IoT conectado" checked={plcConnected} onChange={setPlcConnected} />
              <Toggle label="Sensor de pressão conectado" checked={sensorConnected} onChange={setSensorConnected} />

              <div className="note">
                <strong>Fora do escopo desta versão:</strong>
                <p>Óleo real, múltiplos tanques e linha industrial completa. Esses itens permanecem na versão oficial completa.</p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function viewTitle(view: View) {
  const map: Record<View, string> = {
    painel: "Painel do protótipo",
    operacao: "Operação física demonstrativa",
    rastreabilidade: "Rastreabilidade do protótipo",
    parametros: "Parâmetros"
  };

  return map[view];
}

function tone(value: string) {
  const v = value.toLowerCase();
  if (v.includes("emerg") || v.includes("bloque") || v.includes("vermelho")) return "danger";
  if (v.includes("aten") || v.includes("paus") || v.includes("amarelo")) return "warn";
  if (v.includes("pronto") || v.includes("operação") || v.includes("ligado") || v.includes("conectado") || v.includes("verde") || v.includes("finalizado")) return "ok";
  return "neutral";
}

function StatusCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`status-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Equipment({ label, code, state, connection, performance }: { label: string; code: string; state: string; connection: string; performance: string }) {
  return (
    <div className="equipment">
      <div className={`equipment-icon ${tone(state)}`}>{code}</div>
      <div>
        <strong>{label}</strong>
        <span>Estado: {state}</span>
        <span>Conexão: {connection}</span>
        <span>Desempenho: {performance}</span>
      </div>
    </div>
  );
}

function LogList({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) {
    return <p className="empty">Nenhum log registrado ainda.</p>;
  }

  return (
    <div className="logs">
      {logs.map((log) => (
        <div key={log.id} className="log">
          <span>{log.time}</span>
          <strong>{log.type}</strong>
          <p>{log.message}</p>
        </div>
      ))}
    </div>
  );
}

function RampChart({ samples }: { samples: RampSample[] }) {
  if (samples.length < 2) {
    return <div className="chart-empty">A rampa aparecerá após as primeiras amostras.</div>;
  }

  const width = 520;
  const height = 180;
  const maxTime = Math.max(...samples.map((sample) => sample.second), 1);
  const maxPressure = Math.max(...samples.map((sample) => sample.sensorPressure), 1013);

  const points = samples
    .map((sample) => {
      const x = (sample.second / maxTime) * width;
      const y = height - (sample.sensorPressure / maxPressure) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Rampa de vácuo">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="4" />
      {samples.map((sample) => {
        const x = (sample.second / maxTime) * width;
        const y = height - (sample.sensorPressure / maxPressure) * height;
        return <circle key={sample.second} cx={x} cy={y} r="4" />;
      })}
    </svg>
  );
}

function RampTable({ samples }: { samples: RampSample[] }) {
  if (samples.length === 0) {
    return <p className="empty">Sem amostras registradas.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tempo</th>
            <th>Sensor</th>
            <th>Tanque calc.</th>
            <th>Bomba</th>
            <th>B2 simulada</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {samples.map((sample) => (
            <tr key={sample.second}>
              <td>{sample.second}s</td>
              <td>{sample.sensorPressure.toFixed(2)} mbar</td>
              <td>{sample.tankPressure.toFixed(2)} mbar</td>
              <td>{sample.pump}</td>
              <td>{sample.lamp}</td>
              <td>{sample.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button className={`toggle ${checked ? "checked" : ""}`} onClick={() => onChange(!checked)}>
      <span>{checked ? "ON" : "OFF"}</span>
      {label}
    </button>
  );
}

createRoot(document.getElementById("root")!).render(<App />);