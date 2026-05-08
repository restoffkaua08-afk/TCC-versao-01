import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = "http://127.0.0.1:8000/api";

type View = "dashboard" | "operation" | "twin" | "history" | "reports" | "parameters";

const menu: { key: View; label: string; sub: string }[] = [
  { key: "dashboard", label: "Painel", sub: "Resumo operacional" },
  { key: "operation", label: "Operação", sub: "Ciclo em tempo real" },
  { key: "twin", label: "Gêmeo Digital", sub: "Cenários e validação" },
  { key: "history", label: "Histórico", sub: "Ciclos e simulações" },
  { key: "reports", label: "Relatórios", sub: "Indicadores técnicos" },
  { key: "parameters", label: "Parâmetros", sub: "Tanques, linhas e receitas" },
];

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(API + path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`${response.status} - ${await response.text()}`);
  }

  return response.json();
}

async function safe(path: string, options: RequestInit = {}) {
  try {
    return { ok: true, data: await request(path, options), error: "" };
  } catch (error) {
    return { ok: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function fmt(value: unknown, suffix = "") {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return "--";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix ? " " + suffix : ""}`;
}

function statusLabel(status: unknown) {
  const value = String(status || "").toLowerCase();

  const map: Record<string, string> = {
    success: "Conforme",
    warning: "Atenção",
    critical: "Crítico",
    running: "Em execução",
    paused: "Pausado",
    stopped: "Parado",
    concluido: "Concluído",
    abortado: "Abortado",
    em_andamento: "Em andamento",
    emergency: "Emergência",
  };

  return map[value] || String(status || "--");
}

function tone(status: unknown) {
  const value = String(status || "").toLowerCase();

  if (["success", "concluido", "running", "ok", "conforme"].includes(value)) return "ok";
  if (["warning", "paused", "em_andamento", "atenção", "atencao"].includes(value)) return "warn";
  if (["critical", "abortado", "emergency", "falha"].includes(value)) return "bad";

  return "neutral";
}

function Badge({ value }: { value: unknown }) {
  return <span className={`badge ${tone(value)}`}>{statusLabel(value)}</span>;
}

function Metric({ label, value, detail, status }: { label: string; value: React.ReactNode; detail?: string; status?: unknown }) {
  return (
    <article className={`metric ${tone(status)}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}

function Section({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="section">
      <div className="sectionHeader">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <strong>Sem dados disponíveis</strong>
      <span>{text}</span>
    </div>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          )) : (
            <tr>
              <td colSpan={columns.length}>
                <Empty text="Nenhum registro localizado." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TankCard({ item }: { item: any }) {
  const risk = Number(item?.collapse_risk_pct || 0);
  const oil = Number(item?.oil_volume_liters || 0);
  const pressure = Number(item?.pressure_mbar || 0);

  const gasHeight = Math.max(18, Math.min(72, 74 - risk * 0.22));
  const pressureHeight = Math.max(8, Math.min(68, risk));
  const oilHeight = Math.max(5, Math.min(42, oil * 5));

  return (
    <article className={`tankCard ${risk >= 82 ? "riskHigh" : risk >= 65 ? "riskMedium" : "riskLow"}`}>
      <div className="tankTop">
        <div>
          <strong>{item?.tank?.code || "Tanque de Processo"}</strong>
          <span>{item?.hose?.code || "Linha de Vácuo"}</span>
        </div>
        <Badge value={risk >= 82 ? "critical" : risk >= 65 ? "warning" : "success"} />
      </div>

      <div className="tankBody">
        <div className="tankShell">
          <div className="tankFill gas" style={{ height: `${gasHeight}%` }} />
          <div className="tankFill pressure" style={{ height: `${pressureHeight}%` }} />
          <div className="tankFill oil" style={{ height: `${oilHeight}%` }} />
        </div>

        <div className="tankReadings">
          <div><span>Pressão Atual</span><b>{fmt(pressure, "mbar")}</b></div>
          <div><span>Curva Esperada</span><b>{fmt(item?.expected_pressure_mbar, "mbar")}</b></div>
          <div><span>Volume de Óleo</span><b>{fmt(item?.oil_volume_liters, "L")}</b></div>
          <div><span>Risco Estrutural</span><b>{fmt(risk, "%")}</b></div>
        </div>
      </div>

      <div className="legend">
        <span><i className="gasDot" />Gás</span>
        <span><i className="pressureDot" />Pressão</span>
        <span><i className="oilDot" />Óleo</span>
      </div>
    </article>
  );
}

function Chart({ points }: { points: any[] }) {
  if (!points?.length) {
    return <Empty text="Curva operacional indisponível para este registro." />;
  }

  const values = points.flatMap((p) => [
    Number(p.real_pressure_mbar ?? p.pressure_mbar ?? 0),
    Number(p.expected_pressure_mbar ?? 0),
    Number(p.effective_pressure_mbar ?? 0),
  ]);

  const max = Math.max(...values, 10);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);

  function line(key: string, fallback?: string) {
    return points.map((p, index) => {
      const value = Number(p[key] ?? (fallback ? p[fallback] : 0) ?? 0);
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 95 - ((value - min) / span) * 86;
      return `${x},${y}`;
    }).join(" ");
  }

  return (
    <div className="chartBox">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="95" x2="100" y2="95" className="axis" />
        <line x1="0" y1="9" x2="0" y2="95" className="axis" />
        <polyline points={line("expected_pressure_mbar")} className="expectedLine" />
        <polyline points={line("real_pressure_mbar", "pressure_mbar")} className="realLine" />
        <polyline points={line("effective_pressure_mbar")} className="riskLine" />
      </svg>

      <div className="chartLegend">
        <span><i className="realDot" />Pressão real/simulada</span>
        <span><i className="expectedDot" />Curva esperada</span>
        <span><i className="riskDot" />Carga estrutural</span>
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [error, setError] = useState("");

  const [state, setState] = useState<any>(null);
  const [options, setOptions] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [alarms, setAlarms] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [simulations, setSimulations] = useState<any[]>([]);
  const [tanks, setTanks] = useState<any[]>([]);
  const [hoses, setHoses] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);

  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [selectedScenario, setSelectedScenario] = useState("");
  const [historyTab, setHistoryTab] = useState<"operations" | "simulations">("operations");
  const [detail, setDetail] = useState<any>(null);

  async function refresh(tick = false) {
    const health = await safe("/health");
    setApiOnline(health.ok);

    if (!health.ok) {
      setError(health.error || "API indisponível.");
      return;
    }

    setError("");

    const [
      stateResult,
      optionsResult,
      reportResult,
      alarmsResult,
      maintenanceResult,
      operationsResult,
      simulationsResult,
      tanksResult,
      hosesResult,
      recipesResult,
    ] = await Promise.all([
      tick ? safe("/operation/tick", { method: "POST" }) : safe("/operation/state"),
      safe("/digital-twin/config-options"),
      safe("/reports/operational"),
      safe("/alarms"),
      safe("/maintenance/prediction"),
      safe("/records/operations"),
      safe("/records/simulations"),
      safe("/tanks"),
      safe("/hoses"),
      safe("/recipes"),
    ]);

    if (stateResult.ok) setState(stateResult.data);
    if (optionsResult.ok) setOptions(optionsResult.data);
    if (reportResult.ok) setReport(reportResult.data);
    if (alarmsResult.ok) setAlarms(alarmsResult.data || []);
    if (maintenanceResult.ok) setMaintenance(maintenanceResult.data || []);
    if (operationsResult.ok) setOperations(operationsResult.data?.items || []);
    if (simulationsResult.ok) setSimulations(simulationsResult.data?.items || []);
    if (tanksResult.ok) setTanks(tanksResult.data || []);
    if (hosesResult.ok) setHoses(hosesResult.data || []);
    if (recipesResult.ok) setRecipes(recipesResult.data || []);
  }

  useEffect(() => {
    refresh(false);
    const timer = window.setInterval(() => refresh(true), 4000);
    return () => window.clearInterval(timer);
  }, []);

  async function control(action: "start" | "pause" | "stop" | "reset" | "emergency") {
    await request(`/operation/${action}`, { method: "POST" });
    await refresh(false);
  }

  async function runScenario(key: string) {
    setSelectedScenario(key);
    const config = options?.presets?.[key]?.config || {};
    const result = await request("/digital-twin/simulate", {
      method: "POST",
      body: JSON.stringify(config),
    });

    setSimulationResult(result);

    await safe("/records/simulations", {
      method: "POST",
      body: JSON.stringify({
        name: options?.presets?.[key]?.name || "Simulação Operacional",
        config,
      }),
    });

    await refresh(false);
  }

  async function openHistoryDetail(item: any) {
    const path = historyTab === "operations"
      ? `/records/operations/${item.id}`
      : `/records/simulations/${item.id}`;

    const result = await safe(path);
    setDetail(result.data || { record: item });
  }

  function download(filename: string, payload: any) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const tanksState = state?.tank_states || [];

  const avgPressure = tanksState.reduce((sum: number, item: any) => sum + Number(item.pressure_mbar || 0), 0) / Math.max(tanksState.length, 1);
  const maxRisk = Math.max(0, ...tanksState.map((item: any) => Number(item.collapse_risk_pct || 0)));

  const pageTitle = useMemo(() => menu.find((item) => item.key === view)?.label || "Painel", [view]);

  const currentRows = historyTab === "operations" ? operations : simulations;

  return (
    <div className={`layout ${menuOpen ? "drawerOpen" : ""}`}>
      <aside className="drawer">
        <div className="brandBlock">
          <span>TSEA</span>
          <strong>Supervisório Digital</strong>
          <small>Vácuo · Rastreabilidade · Gêmeo Digital</small>
        </div>

        <nav className="navList">
          {menu.map((item) => (
            <button
              key={item.key}
              className={view === item.key ? "active" : ""}
              onClick={() => {
                setView(item.key);
                setMenuOpen(false);
              }}
            >
              <span>{item.label}</span>
              <small>{item.sub}</small>
            </button>
          ))}
        </nav>

        <div className="drawerFooter">
          <span className={`dot ${apiOnline ? "on" : "off"}`} />
          <small>{apiOnline ? "API conectada" : "API desconectada"}</small>
        </div>
      </aside>

      <div className="overlay" onClick={() => setMenuOpen(false)} />

      <main className="content">
        <header className="topbar">
          <button className="hamburger" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
            <span />
            <span />
            <span />
          </button>

          <div>
            <span className="moduleLabel">TSEA · {pageTitle}</span>
            <h1>{pageTitle}</h1>
            <p>Supervisão técnica do processo de vácuo, rastreabilidade e validação operacional.</p>
          </div>

          <Badge value={apiOnline ? "success" : "critical"} />
        </header>

        {error && (
          <div className="errorPanel">
            <strong>Falha de comunicação</strong>
            <span>{error}</span>
          </div>
        )}

        {view === "dashboard" && (
          <div className="screen">
            <div className="metricsGrid">
              <Metric label="Estado do Ciclo" value={state?.cycle?.status ? statusLabel(state.cycle.status) : "Parado"} status={state?.cycle?.status || "stopped"} />
              <Metric label="Pressão Média" value={fmt(avgPressure, "mbar")} detail="Tanques monitorados" />
              <Metric label="Risco Máximo" value={fmt(maxRisk, "%")} status={maxRisk >= 82 ? "critical" : maxRisk >= 65 ? "warning" : "success"} />
              <Metric label="Registros" value={(operations.length + simulations.length).toString()} detail="Ciclos + simulações" />
            </div>

            <Section title="Mapa operacional" subtitle="Estado consolidado dos tanques de processo e linhas de vácuo.">
              <div className="tankGrid">
                {tanksState.map((item: any, index: number) => (
                  <TankCard key={item?.tank?.id || index} item={item} />
                ))}
              </div>
            </Section>

            <Section title="Unidade de bombeamento" subtitle="Leitura funcional da bomba primária, Roots, óleo e comunicação.">
              <div className="statusGrid">
                <Metric label="Bomba Primária" value={state?.primary_pump?.running ? "Ligada" : "Desligada"} detail={state?.primary_pump?.model || "SV630B"} status={state?.primary_pump?.running ? "success" : "neutral"} />
                <Metric label="Bomba Roots" value={state?.roots_pump?.running ? "Ligada" : "Bloqueada"} detail={state?.roots_pump?.model || "WSU2001"} status={state?.roots_pump?.running ? "success" : "warning"} />
                <Metric label="Injeção de Óleo" value={state?.oil_injection?.enabled ? "Ativa" : "Inativa"} detail={fmt(state?.oil_injection?.target_flow_l_min, "L/min")} status={state?.oil_injection?.enabled ? "success" : "neutral"} />
                <Metric label="CLP" value={state?.plc_comm_ok ? "Comunicação normal" : "Falha de comunicação"} status={state?.plc_comm_ok ? "success" : "critical"} />
              </div>
            </Section>
          </div>
        )}

        {view === "operation" && (
          <div className="screen">
            <Section title="Comando do ciclo" subtitle="Controle direto do processo operacional." action={<Badge value={state?.cycle?.status || "stopped"} />}>
              <div className="commandBar">
                <button onClick={() => control("start")}>Iniciar ciclo</button>
                <button className="secondary" onClick={() => control("pause")}>Pausar</button>
                <button className="secondary" onClick={() => control("stop")}>Finalizar</button>
                <button className="secondary" onClick={() => control("reset")}>Resetar</button>
                <button className="danger" onClick={() => control("emergency")}>Emergência</button>
              </div>
            </Section>

            <Section title="Tanques em operação" subtitle="Pressão, curva esperada, óleo e risco por tanque.">
              <div className="tankGrid">
                {tanksState.map((item: any, index: number) => (
                  <TankCard key={item?.tank?.id || index} item={item} />
                ))}
              </div>
            </Section>
          </div>
        )}

        {view === "twin" && (
          <div className="twinScreen">
            <Section title="Cenários operacionais" subtitle="Validação de comportamento antes da execução.">
              <div className="scenarioGrid">
                {Object.entries(options?.presets || {}).map(([key, preset]: [string, any]) => (
                  <button
                    key={key}
                    className={`scenarioCard ${selectedScenario === key ? "selected" : ""}`}
                    onClick={() => runScenario(key)}
                  >
                    <strong>{preset.name || key}</strong>
                    <span>{preset.description || "Cenário de processo"}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Resultado da validação" subtitle="Curva de pressão, risco estrutural, eventos e recomendação técnica.">
              {!simulationResult ? (
                <Empty text="Nenhuma validação executada no ciclo atual da interface." />
              ) : (
                <div className="resultStack">
                  <div className="metricsGrid compact">
                    <Metric label="Estado" value={statusLabel(simulationResult.status)} status={simulationResult.status} />
                    <Metric label="Tempo Estimado" value={fmt(simulationResult.metrics?.estimated_time_seconds, "s")} />
                    <Metric label="Pressão Final" value={fmt(simulationResult.metrics?.final_real_pressure_mbar, "mbar")} />
                    <Metric label="Risco Máximo" value={fmt(simulationResult.metrics?.max_collapse_risk_pct, "%")} status={simulationResult.status} />
                  </div>

                  <Chart points={simulationResult.timeline || []} />

                  <div className="diagnosticBox">
                    <strong>{simulationResult.diagnosis || "Diagnóstico não informado."}</strong>
                    <span>{simulationResult.recommendation || "Sem recomendação adicional."}</span>
                  </div>
                </div>
              )}
            </Section>
          </div>
        )}

        {view === "history" && (
          <div className="screen">
            <Section
              title="Histórico operacional"
              subtitle="Ciclos executados e simulações registradas."
              action={
                <div className="tabs">
                  <button className={historyTab === "operations" ? "" : "secondary"} onClick={() => { setHistoryTab("operations"); setDetail(null); }}>Ciclos</button>
                  <button className={historyTab === "simulations" ? "" : "secondary"} onClick={() => { setHistoryTab("simulations"); setDetail(null); }}>Simulações</button>
                </div>
              }
            >
              <Table
                columns={historyTab === "operations"
                  ? ["ID", "Data", "Responsável", "Estado", "Tanque", "Linha", "Pressão", "Ação"]
                  : ["ID", "Data", "Nome", "Estado", "Tanque", "Linha", "Risco", "Ação"]}
                rows={currentRows.map((item: any) => historyTab === "operations"
                  ? [
                      <b>{item.id}</b>,
                      item.created_at || "--",
                      item.operator || "--",
                      <Badge value={item.status} />,
                      item.tank_code || item.tank_type || "--",
                      item.hose_code || item.hose_id || "--",
                      fmt(item.final_pressure_mbar, "mbar"),
                      <button onClick={() => openHistoryDetail(item)}>Detalhes</button>,
                    ]
                  : [
                      <b>{item.id}</b>,
                      item.created_at || "--",
                      item.name || "--",
                      <Badge value={item.status} />,
                      item.tank_type || "--",
                      item.hose_code || item.hose_id || "--",
                      fmt(item.max_collapse_risk_pct, "%"),
                      <button onClick={() => openHistoryDetail(item)}>Detalhes</button>,
                    ])}
              />
            </Section>

            {detail && (
              <Section title="Detalhamento técnico" subtitle="Registro operacional com parâmetros e curva associada.">
                <div className="detailGrid">
                  <div className="infoCard">
                    <h3>Identificação</h3>
                    <div className="infoGrid">
                      <div><span>ID</span><b>{detail.record?.id || "--"}</b></div>
                      <div><span>Estado</span><b><Badge value={detail.record?.status || detail.result?.status} /></b></div>
                      <div><span>Tanque</span><b>{detail.record?.tank_code || detail.record?.tank_type || "--"}</b></div>
                      <div><span>Linha</span><b>{detail.record?.hose_code || detail.record?.hose_id || "--"}</b></div>
                    </div>
                  </div>

                  <div className="infoCard wide">
                    <h3>Curva operacional</h3>
                    <Chart points={detail.chart || detail.result?.timeline || detail.simulation_reference?.timeline || []} />
                  </div>

                  <div className="infoCard wide">
                    <h3>Diagnóstico</h3>
                    <p>{detail.result?.diagnosis || detail.simulation_reference?.diagnosis || "Diagnóstico técnico não disponível para este registro."}</p>
                    <p>{detail.result?.recommendation || detail.simulation_reference?.recommendation || "Sem recomendação adicional."}</p>
                  </div>
                </div>
              </Section>
            )}
          </div>
        )}

        {view === "reports" && (
          <div className="screen">
            <div className="metricsGrid">
              <Metric label="Ciclos" value={report?.cycles_count ?? operations.length} />
              <Metric label="Simulações" value={simulations.length} />
              <Metric label="Alarmes" value={report?.alarms_count ?? alarms.length} status={(report?.alarms_count || alarms.length) ? "warning" : "success"} />
              <Metric label="Pressão Média" value={fmt(report?.average_recent_pressure_mbar, "mbar")} />
            </div>

            <Section title="Relatório técnico" subtitle="Consolidado operacional para análise e auditoria.">
              <div className="reportBox">
                <h3>{report?.title || "Relatório Operacional TSEA"}</h3>
                <p>Ciclos, simulações, alarmes e indicadores do processo de vácuo.</p>
                <button onClick={() => download("relatorio-operacional-tsea.json", { report, alarms, operations, simulations })}>Exportar relatório</button>
              </div>
            </Section>

            <Section title="Alarmes registrados" subtitle="Ocorrências técnicas retornadas pela API.">
              <Table
                columns={["Código", "Severidade", "Mensagem"]}
                rows={alarms.map((alarm: any) => [
                  alarm.code || "--",
                  <Badge value={alarm.severity} />,
                  alarm.message || "--",
                ])}
              />
            </Section>
          </div>
        )}

        {view === "parameters" && (
          <div className="screen">
            <Section title="Tanques de processo" subtitle="Cadastro técnico dos tanques utilizados.">
              <Table
                columns={["Código", "Tipo", "Volume", "Limite Estrutural", "Estado"]}
                rows={tanks.map((tank: any) => [
                  <b>{tank.code}</b>,
                  tank.type || "--",
                  fmt(tank.volume_liters, "L"),
                  fmt(tank.structural_limit_mbar, "mbar"),
                  tank.status || "--",
                ])}
              />
            </Section>

            <Section title="Linhas de vácuo" subtitle="Mangueiras cadastradas e características técnicas.">
              <Table
                columns={["Código", "Comprimento", "Diâmetro", "Fator de Perda", "Estado"]}
                rows={hoses.map((hose: any) => [
                  <b>{hose.code}</b>,
                  fmt(hose.length_m, "m"),
                  fmt(hose.diameter_in, "pol"),
                  fmt(hose.loss_factor),
                  hose.status || "--",
                ])}
              />
            </Section>

            <Section title="Receitas operacionais" subtitle="Parâmetros-base para execução de ciclos.">
              <Table
                columns={["Nome", "Tanque", "Pressão Final", "Acionamento Roots", "Tempo Máximo"]}
                rows={recipes.map((recipe: any) => [
                  <b>{recipe.name}</b>,
                  recipe.tank_type || "--",
                  fmt(recipe.target_pressure_mbar, "mbar"),
                  fmt(recipe.roots_start_pressure_mbar, "mbar"),
                  fmt(recipe.max_cycle_seconds, "s"),
                ])}
              />
            </Section>
          </div>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);