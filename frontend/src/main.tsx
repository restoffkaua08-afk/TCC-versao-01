import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = "http://127.0.0.1:8000/api";

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

function label(status: unknown) {
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
  };
  return map[value] || String(status || "--");
}

function tone(status: unknown) {
  const value = String(status || "").toLowerCase();

  if (["success", "concluido", "running", "ok"].includes(value)) return "good";
  if (["warning", "paused", "em_andamento"].includes(value)) return "warn";
  if (["critical", "abortado", "emergency"].includes(value)) return "bad";

  return "neutral";
}

function Badge({ value }: { value: unknown }) {
  return <span className={`badge ${tone(value)}`}>{label(value)}</span>;
}

function Metric({ title, value, hint, status }: { title: string; value: React.ReactNode; hint?: string; status?: unknown }) {
  return (
    <article className={`metric ${tone(status)}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}

function Section({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
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
  return <div className="empty"><strong>Sem dados</strong><span>{text}</span></div>;
}

function Table({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={index}>{row.map((cell, i) => <td key={i}>{cell}</td>)}</tr>
          )) : (
            <tr><td colSpan={columns.length}><Empty text="Nenhum registro encontrado." /></td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TankCard({ item }: { item: any }) {
  const risk = Number(item?.collapse_risk_pct || 0);
  const oil = Number(item?.oil_volume_liters || 0);

  const gasHeight = Math.max(20, Math.min(74, 78 - risk * 0.25));
  const pressureHeight = Math.max(8, Math.min(68, risk));
  const oilHeight = Math.max(6, Math.min(42, oil * 5));

  return (
    <article className={`tank-card ${risk >= 82 ? "bad" : risk >= 65 ? "warn" : "good"}`}>
      <div className="tank-head">
        <div>
          <strong>{item?.tank?.code || "Tanque de processo"}</strong>
          <span>{item?.hose?.code || "Linha de vácuo"}</span>
        </div>
        <b>{fmt(risk, "%")}</b>
      </div>

      <div className="tank-visual">
        <div className="tank-shell">
          <div className="tank-fill gas" style={{ height: `${gasHeight}%` }} />
          <div className="tank-fill pressure" style={{ height: `${pressureHeight}%` }} />
          <div className="tank-fill oil" style={{ height: `${oilHeight}%` }} />
        </div>
      </div>

      <div className="mini-grid">
        <div><span>Pressão</span><b>{fmt(item?.pressure_mbar, "mbar")}</b></div>
        <div><span>Esperada</span><b>{fmt(item?.expected_pressure_mbar, "mbar")}</b></div>
        <div><span>Óleo</span><b>{fmt(item?.oil_volume_liters, "L")}</b></div>
        <div><span>Risco</span><b>{fmt(item?.collapse_risk_pct, "%")}</b></div>
      </div>
    </article>
  );
}

function Chart({ points }: { points: any[] }) {
  if (!points?.length) return <Empty text="Execute uma simulação ou abra um registro com curva." />;

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
      const y = 96 - ((value - min) / span) * 88;
      return `${x},${y}`;
    }).join(" ");
  }

  return (
    <div className="chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" x2="100" y1="96" y2="96" className="axis" />
        <line x1="0" x2="0" y1="4" y2="96" className="axis" />
        <polyline points={line("expected_pressure_mbar")} className="expected-line" />
        <polyline points={line("real_pressure_mbar", "pressure_mbar")} className="real-line" />
        <polyline points={line("effective_pressure_mbar")} className="risk-line" />
      </svg>
    </div>
  );
}

const menu = [
  ["dashboard", "Painel Executivo", "Resumo operacional"],
  ["operation", "Operação", "Supervisão do ciclo"],
  ["twin", "Gêmeo Digital", "Simulação operacional"],
  ["history", "Histórico", "Ciclos e simulações"],
  ["reports", "Relatórios", "Indicadores"],
  ["settings", "Parâmetros", "Ativos e receitas"],
];

function App() {
  const [view, setView] = useState("dashboard");
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
  const [result, setResult] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [historyTab, setHistoryTab] = useState("operations");

  async function refresh(tick = false) {
    const health = await safe("/health");
    setApiOnline(health.ok);

    if (!health.ok) {
      setError(health.error);
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
    const id = window.setInterval(() => refresh(true), 4000);
    return () => window.clearInterval(id);
  }, []);

  const title = useMemo(() => menu.find((item) => item[0] === view)?.[1] || "Painel Executivo", [view]);

  const tanksState = state?.tank_states || [];
  const maxRisk = Math.max(0, ...tanksState.map((item: any) => Number(item.collapse_risk_pct || 0)));
  const avgPressure = tanksState.reduce((sum: number, item: any) => sum + Number(item.pressure_mbar || 0), 0) / Math.max(tanksState.length, 1);

  async function control(action: string) {
    await request(`/operation/${action}`, { method: "POST" });
    await refresh(false);
  }

  async function simulatePreset(key: string) {
    const config = options?.presets?.[key]?.config || {};
    const data = await request("/digital-twin/simulate", { method: "POST", body: JSON.stringify(config) });
    setResult(data);

    await safe("/records/simulations", {
      method: "POST",
      body: JSON.stringify({ name: options?.presets?.[key]?.name || "Simulação operacional", config }),
    });

    await refresh(false);
  }

  async function openDetail(item: any) {
    const path = historyTab === "operations" ? `/records/operations/${item.id}` : `/records/simulations/${item.id}`;
    const data = await request(path);
    setDetail(data);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>TSEA</span>
          <strong>Supervisório Digital</strong>
          <small>Vácuo · Rastreabilidade · Simulação</small>
        </div>

        <nav>
          {menu.map(([key, labelText, description]) => (
            <button key={key} className={view === key ? "active" : ""} onClick={() => setView(key)}>
              <span>{labelText}</span>
              <small>{description}</small>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <span className={`status-dot ${apiOnline ? "good" : "bad"}`} />
          <small>{apiOnline ? "API ativa em 8000" : "API sem resposta"}</small>
        </div>
      </aside>

      <main className="main">
        <header className="page-header">
          <div>
            <span className="eyebrow">TSEA · Supervisório Digital</span>
            <h1>{title}</h1>
            <p>Controle operacional, rastreabilidade técnica e simulação do processo de vácuo.</p>
          </div>
          <span className={`system-status ${apiOnline ? "good" : "bad"}`}>{apiOnline ? "API ativa" : "API inativa"}</span>
        </header>

        {error && (
          <div className="error-box">
            <strong>Falha de comunicação com a API</strong>
            <span>{error}</span>
          </div>
        )}

        {view === "dashboard" && (
          <div className="stack">
            <div className="metrics-grid">
              <Metric title="Estado do ciclo" value={state?.cycle?.status ? label(state.cycle.status) : "Parado"} status={state?.cycle?.status || "stopped"} />
              <Metric title="Pressão média" value={fmt(avgPressure, "mbar")} />
              <Metric title="Risco máximo" value={fmt(maxRisk, "%")} status={maxRisk > 82 ? "critical" : maxRisk > 65 ? "warning" : "success"} />
              <Metric title="Ciclos registrados" value={report?.cycles_count ?? operations.length} />
            </div>

            <Section title="Supervisão resumida" subtitle="Leitura dos tanques, linhas de vácuo, pressão, óleo e risco.">
              <div className="tank-grid">
                {tanksState.map((item: any, index: number) => <TankCard key={item?.tank?.id || index} item={item} />)}
              </div>
            </Section>

            <Section title="Manutenção e confiabilidade" subtitle="Ativos com maior necessidade de acompanhamento técnico.">
              <Table
                columns={["Ativo", "Risco", "Horas restantes", "Recomendação"]}
                rows={maintenance.map((item) => [
                  <b>{item.asset_code || "--"}</b>,
                  fmt(item.risk_score, "%"),
                  fmt(item.remaining_hours, "h"),
                  item.recommendation || "--",
                ])}
              />
            </Section>
          </div>
        )}

        {view === "operation" && (
          <div className="stack">
            <Section title="Comando do ciclo" subtitle="Controle operacional do processo de vácuo." action={<Badge value={state?.cycle?.status || "stopped"} />}>
              <div className="command-bar">
                <button onClick={() => control("start")}>Iniciar ciclo</button>
                <button className="secondary" onClick={() => control("pause")}>Pausar</button>
                <button className="secondary" onClick={() => control("stop")}>Finalizar</button>
                <button className="secondary" onClick={() => control("reset")}>Resetar</button>
                <button className="danger" onClick={() => control("emergency")}>Emergência</button>
              </div>
            </Section>

            <div className="metrics-grid">
              <Metric title="Bomba primária" value={state?.primary_pump?.running ? "Ligada" : "Desligada"} status={state?.primary_pump?.running ? "success" : "neutral"} hint={state?.primary_pump?.model || "SV630B"} />
              <Metric title="Bomba Roots" value={state?.roots_pump?.running ? "Ligada" : "Bloqueada"} status={state?.roots_pump?.running ? "success" : "warning"} />
              <Metric title="Injeção de óleo" value={state?.oil_injection?.enabled ? "Ativa" : "Inativa"} status={state?.oil_injection?.enabled ? "success" : "neutral"} />
              <Metric title="Comunicação CLP" value={state?.plc_comm_ok ? "Normal" : "Falha"} status={state?.plc_comm_ok ? "success" : "critical"} />
            </div>

            <Section title="Tanques de processo" subtitle="Leitura técnica por tanque.">
              <div className="tank-grid">
                {tanksState.map((item: any, index: number) => <TankCard key={item?.tank?.id || index} item={item} />)}
              </div>
            </Section>
          </div>
        )}

        {view === "twin" && (
          <div className="twin-layout">
            <Section title="Cenários de simulação" subtitle="Selecione uma condição operacional para validar.">
              <div className="scenario-list">
                {Object.entries(options?.presets || {}).map(([key, preset]: [string, any]) => (
                  <button key={key} className="scenario-item" onClick={() => simulatePreset(key)}>
                    <strong>{preset.name || key}</strong>
                    <span>{preset.description || "Cenário operacional"}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Resultado técnico" subtitle="Curva de pressão, eventos, risco e recomendação.">
              {!result ? (
                <Empty text="Selecione um cenário para executar a simulação." />
              ) : (
                <div className="result-grid">
                  <div className="metrics-grid compact">
                    <Metric title="Estado" value={label(result.status)} status={result.status} />
                    <Metric title="Tempo estimado" value={fmt(result.metrics?.estimated_time_seconds, "s")} />
                    <Metric title="Pressão final" value={fmt(result.metrics?.final_real_pressure_mbar, "mbar")} />
                    <Metric title="Risco máximo" value={fmt(result.metrics?.max_collapse_risk_pct, "%")} status={result.status} />
                  </div>

                  <Chart points={result.timeline || []} />

                  <div className="technical-note">
                    <strong>{result.diagnosis || "Diagnóstico indisponível"}</strong>
                    <span>{result.recommendation || "Sem recomendação adicional."}</span>
                  </div>
                </div>
              )}
            </Section>
          </div>
        )}

        {view === "history" && (
          <div className="stack">
            <Section title="Histórico operacional" subtitle="Consulta de ciclos e simulações." action={
              <div className="tab-actions">
                <button className={historyTab === "operations" ? "" : "secondary"} onClick={() => { setHistoryTab("operations"); setDetail(null); }}>Ciclos</button>
                <button className={historyTab === "simulations" ? "" : "secondary"} onClick={() => { setHistoryTab("simulations"); setDetail(null); }}>Simulações</button>
              </div>
            }>
              <Table
                columns={historyTab === "operations"
                  ? ["ID", "Data", "Responsável", "Estado", "Tanque", "Linha", "Pressão", "Ações"]
                  : ["ID", "Data", "Nome", "Estado", "Tanque", "Linha", "Risco", "Ações"]}
                rows={(historyTab === "operations" ? operations : simulations).map((item: any) => historyTab === "operations"
                  ? [
                      <b>{item.id}</b>,
                      item.created_at || "--",
                      item.operator || "--",
                      <Badge value={item.status} />,
                      item.tank_code || item.tank_type || "--",
                      item.hose_code || item.hose_id || "--",
                      fmt(item.final_pressure_mbar, "mbar"),
                      <button onClick={() => openDetail(item)}>Detalhes</button>,
                    ]
                  : [
                      <b>{item.id}</b>,
                      item.created_at || "--",
                      item.name || "--",
                      <Badge value={item.status} />,
                      item.tank_type || "--",
                      item.hose_code || item.hose_id || "--",
                      fmt(item.max_collapse_risk_pct, "%"),
                      <button onClick={() => openDetail(item)}>Detalhes</button>,
                    ])}
              />
            </Section>

            {detail && (
              <Section title="Detalhamento técnico" subtitle="Parâmetros, resultados e curva vinculada ao registro.">
                <div className="detail-grid">
                  <div className="detail-card">
                    <h3>Identificação</h3>
                    <div className="info-grid">
                      <div><span>ID</span><b>{detail.record?.id || "--"}</b></div>
                      <div><span>Estado</span><b><Badge value={detail.record?.status || detail.result?.status} /></b></div>
                      <div><span>Tanque</span><b>{detail.record?.tank_code || detail.record?.tank_type || "--"}</b></div>
                      <div><span>Linha</span><b>{detail.record?.hose_code || detail.record?.hose_id || "--"}</b></div>
                    </div>
                  </div>

                  <div className="detail-card wide">
                    <h3>Curva operacional</h3>
                    <Chart points={detail.chart || detail.result?.timeline || detail.simulation_reference?.timeline || []} />
                  </div>

                  <div className="detail-card wide">
                    <h3>Diagnóstico</h3>
                    <p>{detail.result?.diagnosis || detail.simulation_reference?.diagnosis || "Diagnóstico técnico não disponível."}</p>
                    <p>{detail.result?.recommendation || detail.simulation_reference?.recommendation || "Sem recomendação adicional."}</p>
                  </div>
                </div>
              </Section>
            )}
          </div>
        )}

        {view === "reports" && (
          <div className="stack">
            <div className="metrics-grid">
              <Metric title="Ciclos" value={report?.cycles_count ?? operations.length} />
              <Metric title="Simulações" value={simulations.length} />
              <Metric title="Alarmes" value={report?.alarms_count ?? alarms.length} status={(report?.alarms_count || alarms.length) ? "warning" : "success"} />
              <Metric title="Pressão média" value={fmt(report?.average_recent_pressure_mbar, "mbar")} />
            </div>

            <Section title="Relatório operacional" subtitle="Indicadores consolidados para análise técnica.">
              <div className="report-block">
                <h3>{report?.title || "Relatório Operacional TSEA"}</h3>
                <p>Dados consolidados de ciclos, alarmes, pressão média e ativos monitorados.</p>
                <button onClick={() => {
                  const blob = new Blob([JSON.stringify({ report, alarms, operations, simulations }, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "relatorio-operacional-tsea.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}>Exportar relatório</button>
              </div>
            </Section>
          </div>
        )}

        {view === "settings" && (
          <div className="stack">
            <Section title="Tanques de processo" subtitle="Ativos monitorados pelo supervisório.">
              <Table columns={["Código", "Tipo", "Volume", "Limite", "Estado"]} rows={tanks.map((tank) => [<b>{tank.code}</b>, tank.type || "--", fmt(tank.volume_liters, "L"), fmt(tank.structural_limit_mbar, "mbar"), tank.status || "--"])} />
            </Section>

            <Section title="Linhas de vácuo" subtitle="Mangueiras cadastradas e características técnicas.">
              <Table columns={["Código", "Comprimento", "Diâmetro", "Fator", "Estado"]} rows={hoses.map((hose) => [<b>{hose.code}</b>, fmt(hose.length_m, "m"), fmt(hose.diameter_in, "pol"), fmt(hose.loss_factor), hose.status || "--"])} />
            </Section>

            <Section title="Receitas operacionais" subtitle="Parâmetros-base do processo.">
              <Table columns={["Nome", "Tanque", "Pressão alvo", "Roots", "Tempo"]} rows={recipes.map((recipe) => [<b>{recipe.name}</b>, recipe.tank_type || "--", fmt(recipe.target_pressure_mbar, "mbar"), fmt(recipe.roots_start_pressure_mbar, "mbar"), fmt(recipe.max_cycle_seconds, "s")])} />
            </Section>
          </div>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
