import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = "http://127.0.0.1:8000/api";

type View = "dashboard" | "operation" | "twin" | "history" | "reports" | "parameters";
type TwinTab = "scenarios" | "manual" | "result" | "assistant" | "technical";
type ParamTab = "tanks" | "hoses" | "recipes" | "formulas" | "operators";
type ReportTab = "operations" | "simulations";

const menu: { key: View; label: string; sub: string }[] = [
  { key: "dashboard", label: "Painel", sub: "Resumo operacional" },
  { key: "operation", label: "Operação", sub: "Configuração e execução" },
  { key: "twin", label: "Gêmeo Digital", sub: "Simulação operacional" },
  { key: "history", label: "Histórico", sub: "Ciclos e simulações" },
  { key: "reports", label: "Relatórios", sub: "Filtros e auditoria" },
  { key: "parameters", label: "Parâmetros", sub: "Cadastros técnicos" },
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

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function fmt(value: unknown, suffix = "") {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return "--";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix ? " " + suffix : ""}`;
}

function statusLabel(status: unknown) {
  const value = String(status || "").toLowerCase();

  const map: Record<string, string> = {
    success: "Operacional",
    warning: "Atenção",
    critical: "Crítico",
    running: "Em execução",
    paused: "Pausado",
    stopped: "Parado",
    concluido: "Concluído",
    abortado: "Abortado",
    em_andamento: "Em andamento",
    emergency: "Emergência",
    available: "Disponível",
    attention: "Atenção",
  };

  return map[value] || String(status || "--");
}

function tone(status: unknown) {
  const value = String(status || "").toLowerCase();

  if (["success", "concluido", "running", "ok", "operacional", "available"].includes(value)) return "ok";
  if (["warning", "paused", "em_andamento", "atenção", "atencao", "attention"].includes(value)) return "warn";
  if (["critical", "abortado", "emergency", "falha", "fault"].includes(value)) return "bad";

  return "neutral";
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function inPeriod(dateValue: string, period: string) {
  if (period === "all") return true;
  if (!dateValue) return false;

  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return true;

  const date = d.toISOString().slice(0, 10);

  if (period === "today") return date === todayISO();
  if (period === "week") return date >= daysAgo(7);
  if (period === "month") return date >= daysAgo(30);

  return true;
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
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
          <span>{item?.hose?.code || "Mangueira de Vácuo"}</span>
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
          <div><span>Perda na Mangueira</span><b>{fmt(item?.hose_loss_mbar, "mbar")}</b></div>
          <div><span>Sinal</span><b>{item?.status_light || "green"}</b></div>
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


const EQUIPMENT_SPECS = {
  primaryPump: {
    model: "Leybold SOGEVAC SV 630 B",
    technology: "Bomba rotativa de palhetas lubrificada a óleo",
    nominalSpeed50Hz: "640 m³/h",
    nominalSpeed60Hz: "755 m³/h",
    ultimatePressureNoGasBallast: "≤ 0,08 mbar",
    ultimatePressureGasBallast: "≤ 0,7 mbar",
    oilFilling: "20 L",
    motorPower50Hz: "15 kW",
    nominalRpm50Hz: "820 rpm",
    inlet: "DN 100 PN 10 / DN 100 ISO-K",
    role: "Bomba de apoio responsável pela evacuação inicial e sustentação do conjunto bomba secundária."
  },
  rootsPump: {
    model: "Leybold RUVAC WSU 2001",
    technology: "Bomba secundária com motor blindado refrigerado a ar",
    nominalSpeed50Hz: "2050 m³/h",
    nominalSpeed60Hz: "2460 m³/h",
    effectiveSpeedWithSogevac50Hz: "1850 m³/h",
    effectiveSpeedWithSogevac60Hz: "2100 m³/h",
    ultimatePressure: "< 4 × 10⁻² mbar",
    maxDifferentialPressure: "50 mbar",
    leakRate: "< 1 × 10⁻⁴ mbar·l/s",
    role: "Estágio de reforço usado após a pressão entrar na faixa segura de acionamento."
  }
};



function ComponentHealthPanel({ state, allTanks, allHoses }: any) {
  const tankStates = Array.isArray(state?.tank_states) ? state.tank_states : [];
  const firstTank = tankStates[0] || {};
  const avgPressure = tankStates.length
    ? tankStates.reduce((sum: number, item: any) => sum + Number(item.pressure_mbar || 0), 0) / tankStates.length
    : Number(firstTank.pressure_mbar || 0);

  const pumpRows = [
    [
      <b>Bomba primária</b>,
      EQUIPMENT_SPECS.primaryPump.model,
      state?.primary_pump?.running ? "Ligada" : "Pronta",
      "98%",
      EQUIPMENT_SPECS.primaryPump.nominalSpeed50Hz,
      EQUIPMENT_SPECS.primaryPump.role
    ],
    [
      <b>Bomba secundária</b>,
      EQUIPMENT_SPECS.rootsPump.model,
      state?.roots_pump?.running ? "Ligada" : "Intertravada",
      state?.roots_pump?.running ? "96%" : "Aguardando faixa",
      EQUIPMENT_SPECS.rootsPump.nominalSpeed50Hz,
      EQUIPMENT_SPECS.rootsPump.role
    ]
  ];

  const tankRows = (tankStates.length ? tankStates : allTanks).map((item: any, index: number) => {
    const tank = item?.tank || item;
    const pressure = Number(item?.pressure_mbar ?? item?.expected_pressure_mbar ?? 0);
    const oil = Number(item?.oil_volume_liters ?? 0);
    const risk = Number(item?.collapse_risk_pct ?? 0);

    return [
      <b>{tank?.code || item?.code || `TQ-${index + 1}`}</b>,
      tank?.type || item?.type || "Tanque de processo",
      fmt(pressure, "mbar"),
      fmt(oil, "L"),
      fmt(risk, "%"),
      risk >= 82 ? <Badge value="critical" /> : risk >= 65 ? <Badge value="warning" /> : <Badge value="success" />
    ];
  });

  const hoseRows = allHoses.map((hose: any) => [
    <b>{hose.code || `MG-${hose.id}`}</b>,
    fmt(hose.length_m, "m"),
    fmt(hose.diameter_in, "pol"),
    fmt(hose.loss_factor),
    Number(hose.loss_factor || 0) > 1 ? <Badge value="warning" /> : <Badge value="success" />,
    "Conexão entre bomba, tanque e processo de vácuo."
  ]);

  const sensorRows = (tankStates.length ? tankStates : [{ tank: { code: "TQ-SIM" }, pressure_mbar: avgPressure }]).map((item: any, index: number) => {
    const tank = item?.tank || {};
    const pressure = Number(item?.pressure_mbar ?? item?.expected_pressure_mbar ?? 0);
    const risk = Number(item?.collapse_risk_pct ?? 0);

    return [
      <b>{`SP-${tank.code || index + 1}`}</b>,
      tank.code || `Tanque ${index + 1}`,
      "Pressão",
      fmt(pressure, "mbar"),
      risk >= 82 ? "Crítico" : risk >= 65 ? "Atenção" : "Operacional",
      fmt(risk >= 82 ? 62 : risk >= 65 ? 82 : 98, "%")
    ];
  });

  return (
    <div className="componentTraceStack">
      <Section title="Rastreabilidade de máquinas e peças" subtitle="Status, desempenho e leitura dos principais componentes do processo.">
        <Table columns={["Componente", "Identificação", "Status", "Desempenho", "Leitura técnica", "Função no processo"]} rows={pumpRows} />
      </Section>

      <Section title="Tanques do processo" subtitle="Leituras numéricas dos tanques usados no ciclo.">
        <Table columns={["Tanque", "Tipo", "Pressão", "Óleo", "Risco", "Status"]} rows={tankRows} />
      </Section>

      <Section title="Mangueiras de vácuo" subtitle="Componentes de ligação entre bombas, tanque e processo.">
        <Table columns={["Mangueira", "Comprimento", "Diâmetro", "Fator de perda", "Status", "Função"]} rows={hoseRows} />
      </Section>

      <Section title="Sensores do processo" subtitle="Leituras usadas para controle, diagnóstico e rastreabilidade.">
        <Table columns={["Sensor", "Tanque", "Variável", "Leitura", "Status", "Desempenho"]} rows={sensorRows} />
      </Section>
    </div>
  );
}



function SimulationTraceability({ result, state, selectedScenario, hoses, tanks, config }: any) {
  if (!result) return null;

  const metrics = result.metrics || {};
  const timeline = result.timeline || [];
  const finalPoint = timeline[timeline.length - 1] || {};
  const selectedHose = hoses.find((hose: any) => String(hose.id) === String(config?.hose_id) || String(hose.code) === String(config?.hose_id)) || hoses[0] || {};
  const selectedTank = tanks.find((tank: any) => String(tank.type) === String(config?.tank_type) || String(tank.id) === String(config?.tank_id)) || tanks[0] || {};

  const risk = Number(metrics.max_collapse_risk_pct || metrics.collapse_risk_pct || finalPoint.collapse_risk_pct || 0);
  const finalPressure = Number(metrics.final_real_pressure_mbar ?? finalPoint.real_pressure_mbar ?? finalPoint.pressure_mbar ?? 0);
  const estimatedTime = Number(metrics.estimated_time_seconds || metrics.cycle_time_seconds || 0);
  const oilFlow = Number(config?.oil_flow_l_min || 0);
  const hoseLoss = Number(selectedHose?.loss_factor || finalPoint.hose_loss_mbar || 0);

  const simulationStatus = result.status === "success"
    ? "Ciclo simulado aprovado"
    : result.status === "warning"
      ? "Ciclo simulado aprovado com restrição"
      : "Ciclo simulado reprovado";

  const componentRows = [
    [<b>Bomba primária</b>, EQUIPMENT_SPECS.primaryPump.model, state?.primary_pump?.running ? "Ligada" : "Pronta", "98%", EQUIPMENT_SPECS.primaryPump.nominalSpeed50Hz, EQUIPMENT_SPECS.primaryPump.role],
    [<b>Bomba secundária</b>, EQUIPMENT_SPECS.rootsPump.model, finalPressure <= Number(config?.roots_start_pressure_mbar || 50) ? "Liberada" : "Bloqueada", finalPressure <= Number(config?.roots_start_pressure_mbar || 50) ? "96%" : "Aguardando faixa", EQUIPMENT_SPECS.rootsPump.nominalSpeed50Hz, "Acionamento condicionado à pressão segura."],
    [<b>Mangueira de vácuo</b>, selectedHose?.code || `MG-${config?.hose_id || "--"}`, hoseLoss > 1 ? "Perda elevada" : "Operacional", fmt(Math.max(70, 100 - hoseLoss * 12), "%"), `Fator ${fmt(hoseLoss)}`, "Perda de carga e restrição de fluxo."],
    [<b>Tanque de processo</b>, selectedTank?.code || config?.tank_type || "Tanque simulado", risk >= 82 ? "Crítico" : risk >= 65 ? "Atenção" : "Operacional", fmt(Math.max(55, 100 - risk * 0.45), "%"), fmt(risk, "%"), "Margem estrutural e pressão efetiva."],
    [<b>Sensor de pressão</b>, `SP-${selectedTank?.code || "SIM"}`, config?.simulate_sensor_failure ? "Falha simulada" : "Online", config?.simulate_sensor_failure ? "35%" : "98%", fmt(finalPressure, "mbar"), "Mede pressão do tanque e alimenta diagnóstico."],
    [<b>Sistema de óleo</b>, "Injeção de óleo", oilFlow < 1.5 ? "Vazão baixa" : "Operacional", fmt(Math.min(100, Math.max(40, oilFlow * 45)), "%"), fmt(oilFlow, "L/min"), "Afeta vedação, estabilidade da curva e proteção do conjunto."]
  ];

  const actionRows = [
    [<b>Preparação</b>, "Parâmetros carregados", selectedTank?.code || config?.tank_type || "--", selectedHose?.code || `MG-${config?.hose_id || "--"}`, "Configuração aplicada ao ciclo simulado."],
    [<b>Evacuação inicial</b>, "Bomba primária em atuação", fmt(estimatedTime * 0.35, "s"), fmt(finalPressure, "mbar"), "Redução inicial da pressão no tanque."],
    [<b>Acionamento da bomba secundária</b>, finalPressure <= Number(config?.roots_start_pressure_mbar || 50) ? "Liberado" : "Bloqueado", fmt(config?.roots_start_pressure_mbar, "mbar"), "Intertravamento", "A bomba secundária só entra em faixa segura."],
    [<b>Injeção de óleo</b>, oilFlow < 1.5 ? "Insuficiente" : "Normal", fmt(oilFlow, "L/min"), "Vedação", "Condição usada para estabilidade e risco."],
    [<b>Fechamento</b>, simulationStatus, fmt(risk, "%"), "Resultado", result.recommendation || "Sem recomendação adicional."]
  ];

  const reportRows = [
    [<b>Status final</b>, <Badge value={result.status} />, simulationStatus],
    [<b>Pressão final</b>, fmt(finalPressure, "mbar"), "Valor final calculado pela simulação."],
    [<b>Tempo estimado</b>, fmt(estimatedTime, "s"), "Duração prevista do ciclo."],
    [<b>Risco máximo</b>, fmt(risk, "%"), risk >= 82 ? "Reprovado" : risk >= 65 ? "Aprovado com restrição" : "Aprovado"],
    [<b>Cenário</b>, selectedScenario || "Manual", "Origem da simulação usada no diagnóstico."]
  ];

  return (
    <div className="traceabilityStack">
      <div className="traceHeader">
        <div>
          <h3>Rastreabilidade da simulação</h3>
          <p>Registro técnico por máquina, peça, sensor, mangueira e ação simulada.</p>
        </div>
        <Badge value={result.status} />
      </div>

      <div className="tracePanel">
        <h3>Máquinas, peças e sensores</h3>
        <Table columns={["Componente", "Identificação", "Status", "Desempenho", "Leitura", "Impacto no processo"]} rows={componentRows} />
      </div>

      <div className="tracePanel">
        <h3>Ações da operação simulada</h3>
        <Table columns={["Etapa", "Status", "Referência", "Evento", "Registro técnico"]} rows={actionRows} />
      </div>

      <div className="tracePanel">
        <h3>Relatório da simulação</h3>
        <Table columns={["Item", "Valor", "Interpretação"]} rows={reportRows} />
      </div>
    </div>
  );
}



/* TSEA_PATCH_GEMEO_RASTREABILIDADE_FINAL_START */

function tseaReadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function tseaWriteStorage(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

const TSEA_EQUIPMENT_SPECS = {
  primaryPump: {
    label: "Bomba primária",
    model: "Leybold SOGEVAC SV 630 B",
    technology: "Bomba rotativa de palhetas lubrificada a óleo",
    nominalSpeed50Hz: "640 m³/h",
    nominalSpeed60Hz: "755 m³/h",
    ultimatePressureNoGasBallast: "≤ 0,08 mbar",
    ultimatePressureGasBallast: "≤ 0,7 mbar",
    oilFilling: "20 L",
    motorPower50Hz: "15 kW",
    nominalRpm50Hz: "820 rpm",
    role: "Evacuação inicial e sustentação do conjunto de vácuo."
  },
  secondaryPump: {
    label: "Bomba secundária",
    model: "Leybold RUVAC WSU 2001",
    technology: "Bomba secundária tipo Roots com motor blindado refrigerado a ar",
    nominalSpeed50Hz: "2050 m³/h",
    nominalSpeed60Hz: "2460 m³/h",
    effectiveSpeedWithSogevac50Hz: "1850 m³/h",
    ultimatePressure: "< 4 × 10⁻² mbar",
    maxDifferentialPressure: "50 mbar",
    role: "Reforço do vácuo após entrada em faixa segura de acionamento."
  }
};

function tseaBuildSimulationResult(config: any, state: any, hoses: any[], tanks: any[], scenarioName = "Cenário manual") {
  const selectedHose = hoses.find((hose: any) => String(hose.id) === String(config?.hose_id) || String(hose.code) === String(config?.hose_id)) || hoses[0] || {};
  const selectedTank = tanks.find((tank: any) => String(tank.id) === String(config?.tank_id) || String(tank.type) === String(config?.tank_type)) || tanks[0] || {};

  const pressureTarget = Number(config?.target_pressure_mbar || config?.pressaoFinal || 6.5);
  const secondaryStart = Number(config?.roots_start_pressure_mbar || config?.secondary_start_pressure_mbar || 50);
  const oilFlow = Number(config?.oil_flow_l_min || config?.vazaoOleo || 2);
  const oilDelay = Number(config?.oil_delay_seconds || 0);
  const pumpHealth = Number(config?.pump_health_factor || 1);
  const hoseLoss = Number(selectedHose?.loss_factor || 0.8);
  const maxCycle = Number(config?.max_cycle_seconds || 900);
  const tankVolume = Number(selectedTank?.volume_liters || 1250);

  const risk = Math.max(4, Math.min(98,
    18 +
    hoseLoss * 14 +
    Math.max(0, 2 - oilFlow) * 16 +
    oilDelay * 0.18 +
    Math.max(0, 1 - pumpHealth) * 42 +
    (config?.simulate_sensor_failure ? 18 : 0) +
    (config?.simulate_hose_leak ? 24 : 0) +
    (config?.simulate_plc_loss ? 14 : 0)
  ));

  const estimatedTime = Math.round(Math.min(maxCycle, (tankVolume / 640) * 220 + hoseLoss * 42 + oilDelay * 1.6 + (1 - pumpHealth) * 180));
  const finalPressure = Math.max(pressureTarget, pressureTarget + hoseLoss * 0.7 + Math.max(0, 2 - oilFlow) * 1.8 + (config?.simulate_hose_leak ? 8 : 0));
  const margin = Number(selectedTank?.structural_limit_mbar || 35) - finalPressure;

  const status = risk >= 82 || margin < 0
    ? "critical"
    : risk >= 65
      ? "warning"
      : "success";

  const diagnosis = status === "success"
    ? "Simulação aprovada. O ciclo mantém margem operacional aceitável."
    : status === "warning"
      ? "Simulação aprovada com restrição. Existe tendência de perda, atraso ou redução de margem."
      : "Simulação reprovada. O ciclo apresenta risco elevado e não deve ser liberado sem revisão.";

  const recommendation = status === "success"
    ? "Manter parâmetros e registrar o cenário como referência operacional."
    : status === "warning"
      ? "Revisar mangueira, vazão de óleo, sensores e condição das bombas antes da execução real."
      : "Bloquear execução, revisar vedação, mangueira, bomba secundária, sensores e limites estruturais.";

  const timeline = Array.from({ length: 18 }).map((_, index) => {
    const step = index / 17;
    const pressure = Math.max(finalPressure, 1000 * Math.exp(-step * 5.5) + finalPressure);
    return {
      second: Math.round(step * estimatedTime),
      pressure_mbar: pressure,
      real_pressure_mbar: pressure + hoseLoss * step * 2.2,
      expected_pressure_mbar: Math.max(finalPressure, pressure * 0.93),
      effective_pressure_mbar: finalPressure + risk * step * 0.18,
      collapse_risk_pct: Math.round(risk * step),
      hose_loss_mbar: hoseLoss
    };
  });

  return {
    id: `SIM-${Date.now().toString(36).toUpperCase()}`,
    created_at: new Date().toISOString(),
    scenario: scenarioName,
    status,
    diagnosis,
    recommendation,
    config,
    metrics: {
      estimated_time_seconds: estimatedTime,
      final_real_pressure_mbar: finalPressure,
      max_collapse_risk_pct: risk,
      safety_margin_mbar: margin,
      oil_flow_l_min: oilFlow,
      hose_loss_factor: hoseLoss
    },
    timeline
  };
}

function TseaComponentHealthPanel({ state, allTanks, allHoses }: any) {
  const tankStates = Array.isArray(state?.tank_states) ? state.tank_states : [];
  const sourceTanks = tankStates.length ? tankStates : allTanks;

  const pumpRows = [
    [
      <b>{TSEA_EQUIPMENT_SPECS.primaryPump.label}</b>,
      TSEA_EQUIPMENT_SPECS.primaryPump.model,
      state?.primary_pump?.running ? "Ligada" : "Pronta",
      "98%",
      TSEA_EQUIPMENT_SPECS.primaryPump.nominalSpeed50Hz,
      TSEA_EQUIPMENT_SPECS.primaryPump.role
    ],
    [
      <b>{TSEA_EQUIPMENT_SPECS.secondaryPump.label}</b>,
      TSEA_EQUIPMENT_SPECS.secondaryPump.model,
      state?.roots_pump?.running ? "Ligada" : "Intertravada",
      state?.roots_pump?.running ? "96%" : "Aguardando faixa",
      TSEA_EQUIPMENT_SPECS.secondaryPump.nominalSpeed50Hz,
      TSEA_EQUIPMENT_SPECS.secondaryPump.role
    ]
  ];

  const tankRows = sourceTanks.map((item: any, index: number) => {
    const tank = item?.tank || item;
    const pressure = Number(item?.pressure_mbar ?? item?.expected_pressure_mbar ?? 0);
    const oil = Number(item?.oil_volume_liters ?? 0);
    const risk = Number(item?.collapse_risk_pct ?? 0);

    return [
      <b>{tank?.code || item?.code || `TQ-${index + 1}`}</b>,
      tank?.type || item?.type || "Tanque de processo",
      fmt(pressure, "mbar"),
      fmt(oil, "L"),
      fmt(risk, "%"),
      risk >= 82 ? <Badge value="critical" /> : risk >= 65 ? <Badge value="warning" /> : <Badge value="success" />
    ];
  });

  const hoseRows = allHoses.map((hose: any, index: number) => [
    <b>{hose.code || `MG-${index + 1}`}</b>,
    fmt(hose.length_m, "m"),
    fmt(hose.diameter_in, "pol"),
    fmt(hose.loss_factor),
    Number(hose.loss_factor || 0) > 1 ? <Badge value="warning" /> : <Badge value="success" />,
    "Conexão entre bomba, tanque e processo de vácuo."
  ]);

  const sensorRows = sourceTanks.map((item: any, index: number) => {
    const tank = item?.tank || item;
    const pressure = Number(item?.pressure_mbar ?? item?.expected_pressure_mbar ?? 0);
    const risk = Number(item?.collapse_risk_pct ?? 0);

    return [
      <b>{`SP-${tank?.code || item?.code || index + 1}`}</b>,
      tank?.code || item?.code || `Tanque ${index + 1}`,
      "Pressão",
      fmt(pressure, "mbar"),
      risk >= 82 ? "Crítico" : risk >= 65 ? "Atenção" : "Operacional",
      fmt(risk >= 82 ? 62 : risk >= 65 ? 82 : 98, "%")
    ];
  });

  return (
    <div className="componentTraceStack">
      <Section title="Rastreabilidade de máquinas e peças" subtitle="Status, desempenho e leitura dos principais componentes do processo.">
        <Table columns={["Componente", "Identificação", "Status", "Desempenho", "Leitura técnica", "Função no processo"]} rows={pumpRows} />
      </Section>

      <Section title="Tanques do processo" subtitle="Leituras numéricas dos tanques usados no ciclo.">
        <Table columns={["Tanque", "Tipo", "Pressão", "Óleo", "Risco", "Status"]} rows={tankRows} />
      </Section>

      <Section title="Mangueiras de vácuo" subtitle="Componentes de ligação entre bombas, tanque e processo.">
        <Table columns={["Mangueira", "Comprimento", "Diâmetro", "Fator de perda", "Status", "Função"]} rows={hoseRows} />
      </Section>

      <Section title="Sensores do processo" subtitle="Leituras usadas para controle, diagnóstico e rastreabilidade.">
        <Table columns={["Sensor", "Tanque", "Variável", "Leitura", "Status", "Desempenho"]} rows={sensorRows} />
      </Section>
    </div>
  );
}

function TseaSimulationTraceability({ result, state, hoses, tanks }: any) {
  if (!result) return null;

  const config = result.config || {};
  const metrics = result.metrics || {};
  const selectedHose = hoses.find((hose: any) => String(hose.id) === String(config?.hose_id) || String(hose.code) === String(config?.hose_id)) || hoses[0] || {};
  const selectedTank = tanks.find((tank: any) => String(tank.id) === String(config?.tank_id) || String(tank.type) === String(config?.tank_type)) || tanks[0] || {};

  const risk = Number(metrics.max_collapse_risk_pct || 0);
  const finalPressure = Number(metrics.final_real_pressure_mbar || 0);
  const estimatedTime = Number(metrics.estimated_time_seconds || 0);
  const oilFlow = Number(metrics.oil_flow_l_min || config?.oil_flow_l_min || 0);
  const hoseLoss = Number(metrics.hose_loss_factor || selectedHose?.loss_factor || 0);

  const simulationStatus = result.status === "success"
    ? "Ciclo simulado aprovado"
    : result.status === "warning"
      ? "Ciclo simulado aprovado com restrição"
      : "Ciclo simulado reprovado";

  const componentRows = [
    [<b>Bomba primária</b>, TSEA_EQUIPMENT_SPECS.primaryPump.model, state?.primary_pump?.running ? "Ligada" : "Pronta", "98%", TSEA_EQUIPMENT_SPECS.primaryPump.nominalSpeed50Hz, TSEA_EQUIPMENT_SPECS.primaryPump.role],
    [<b>Bomba secundária</b>, TSEA_EQUIPMENT_SPECS.secondaryPump.model, finalPressure <= Number(config?.roots_start_pressure_mbar || 50) ? "Liberada" : "Bloqueada", finalPressure <= Number(config?.roots_start_pressure_mbar || 50) ? "96%" : "Aguardando faixa", TSEA_EQUIPMENT_SPECS.secondaryPump.nominalSpeed50Hz, "Acionamento condicionado à pressão segura."],
    [<b>Mangueira de vácuo</b>, selectedHose?.code || `MG-${config?.hose_id || "--"}`, hoseLoss > 1 ? "Perda elevada" : "Operacional", fmt(Math.max(70, 100 - hoseLoss * 12), "%"), `Fator ${fmt(hoseLoss)}`, "Perda de carga e restrição de fluxo."],
    [<b>Tanque de processo</b>, selectedTank?.code || config?.tank_type || "Tanque simulado", risk >= 82 ? "Crítico" : risk >= 65 ? "Atenção" : "Operacional", fmt(Math.max(55, 100 - risk * 0.45), "%"), fmt(risk, "%"), "Margem estrutural e pressão efetiva."],
    [<b>Sensor de pressão</b>, `SP-${selectedTank?.code || "SIM"}`, config?.simulate_sensor_failure ? "Falha simulada" : "Online", config?.simulate_sensor_failure ? "35%" : "98%", fmt(finalPressure, "mbar"), "Mede pressão do tanque e alimenta diagnóstico."],
    [<b>Sistema de óleo</b>, "Injeção de óleo", oilFlow < 1.5 ? "Vazão baixa" : "Operacional", fmt(Math.min(100, Math.max(40, oilFlow * 45)), "%"), fmt(oilFlow, "L/min"), "Afeta vedação, estabilidade da curva e proteção do conjunto."]
  ];

  const actionRows = [
    [<b>Preparação</b>, "Parâmetros carregados", selectedTank?.code || config?.tank_type || "--", selectedHose?.code || `MG-${config?.hose_id || "--"}`, "Configuração aplicada ao ciclo simulado."],
    [<b>Evacuação inicial</b>, "Bomba primária em atuação", fmt(estimatedTime * 0.35, "s"), fmt(finalPressure, "mbar"), "Redução inicial da pressão no tanque."],
    [<b>Acionamento da bomba secundária</b>, finalPressure <= Number(config?.roots_start_pressure_mbar || 50) ? "Liberado" : "Bloqueado", fmt(config?.roots_start_pressure_mbar || 50, "mbar"), "Intertravamento", "A bomba secundária só entra em faixa segura."],
    [<b>Injeção de óleo</b>, oilFlow < 1.5 ? "Insuficiente" : "Normal", fmt(oilFlow, "L/min"), "Vedação", "Condição usada para estabilidade e risco."],
    [<b>Fechamento</b>, simulationStatus, fmt(risk, "%"), "Resultado", result.recommendation || "Sem recomendação adicional."]
  ];

  const reportRows = [
    [<b>Status final</b>, <Badge value={result.status} />, simulationStatus],
    [<b>Pressão final</b>, fmt(finalPressure, "mbar"), "Valor final calculado pela simulação."],
    [<b>Tempo estimado</b>, fmt(estimatedTime, "s"), "Duração prevista do ciclo."],
    [<b>Risco máximo</b>, fmt(risk, "%"), risk >= 82 ? "Reprovado" : risk >= 65 ? "Aprovado com restrição" : "Aprovado"],
    [<b>Diagnóstico</b>, result.diagnosis || "--", result.recommendation || "--"]
  ];

  return (
    <div className="traceabilityStack">
      <div className="traceHeader">
        <div>
          <h3>Rastreabilidade da simulação</h3>
          <p>Registro técnico por máquina, peça, sensor, mangueira e ação simulada.</p>
        </div>
        <Badge value={result.status} />
      </div>

      <div className="tracePanel">
        <h3>Máquinas, peças e sensores</h3>
        <Table columns={["Componente", "Identificação", "Status", "Desempenho", "Leitura", "Impacto no processo"]} rows={componentRows} />
      </div>

      <div className="tracePanel">
        <h3>Ações da operação simulada</h3>
        <Table columns={["Etapa", "Status", "Referência", "Evento", "Registro técnico"]} rows={actionRows} />
      </div>

      <div className="tracePanel">
        <h3>Relatório da simulação</h3>
        <Table columns={["Item", "Valor", "Interpretação"]} rows={reportRows} />
      </div>
    </div>
  );
}

function TseaTwinRecoveryPanel({ state, allTanks, allHoses }: any) {
  const baseScenarios = [
    {
      id: "base-seguro",
      name: "Ciclo seguro padrão",
      description: "Parâmetros conservadores para operação com margem ampliada.",
      config: { tank_type: "grande", hose_id: 1, target_pressure_mbar: 8, roots_start_pressure_mbar: 55, oil_flow_l_min: 2, max_cycle_seconds: 780, pump_health_factor: 1 }
    },
    {
      id: "base-produtivo",
      name: "Reguladores TSEA - Vácuo com óleo",
      description: "Cenário operacional padrão para reguladores com injeção de óleo.",
      config: { tank_type: "grande", hose_id: 1, target_pressure_mbar: 6.5, roots_start_pressure_mbar: 50, oil_flow_l_min: 2, max_cycle_seconds: 900, pump_health_factor: 1 }
    },
    {
      id: "base-risco",
      name: "Teste de perda na mangueira",
      description: "Cenário para avaliar perda de carga, vazão baixa e risco estrutural.",
      config: { tank_type: "extra_grande", hose_id: 3, target_pressure_mbar: 7.5, roots_start_pressure_mbar: 60, oil_flow_l_min: 1.2, oil_delay_seconds: 30, max_cycle_seconds: 1100, pump_health_factor: 0.84, simulate_hose_leak: true }
    }
  ];

  const [tab, setTab] = useState<"base" | "custom" | "create" | "result">("base");
  const [customScenarios, setCustomScenarios] = useState<any[]>(() => tseaReadStorage("tsea.customScenarios.final", []));
  const [result, setResult] = useState<any>(() => tseaReadStorage("tsea.lastSimulation.final", null));
  const [form, setForm] = useState<any>({
    name: "Novo cenário de teste",
    description: "Cenário personalizado para validação operacional.",
    tank_type: "grande",
    hose_id: 1,
    target_pressure_mbar: 6.5,
    roots_start_pressure_mbar: 50,
    oil_flow_l_min: 2,
    oil_delay_seconds: 0,
    max_cycle_seconds: 900,
    pump_health_factor: 1,
    simulate_hose_leak: false,
    simulate_sensor_failure: false,
    simulate_plc_loss: false
  });

  function persistCustom(next: any[]) {
    setCustomScenarios(next);
    tseaWriteStorage("tsea.customScenarios.final", next);
  }

  function runScenario(scenario: any) {
    const generated = tseaBuildSimulationResult(scenario.config || scenario, state, allHoses, allTanks, scenario.name || "Cenário personalizado");
    setResult(generated);
    tseaWriteStorage("tsea.lastSimulation.final", generated);

    const history = tseaReadStorage<any[]>("tsea.simulationHistory.final", []);
    tseaWriteStorage("tsea.simulationHistory.final", [generated, ...history].slice(0, 60));

    setTab("result");
  }

  function saveScenario() {
    const scenario = {
      id: `custom-${Date.now().toString(36)}`,
      name: form.name || "Cenário personalizado",
      description: form.description || "Cenário criado pelo usuário.",
      config: { ...form }
    };

    persistCustom([scenario, ...customScenarios]);
    setTab("custom");
  }

  function renderScenarioList(items: any[], emptyText: string) {
    if (!items.length) {
      return <Empty text={emptyText} />;
    }

    return (
      <div className="scenarioBoard">
        {items.map((scenario) => (
          <article className="scenarioCard" key={scenario.id}>
            <strong>{scenario.name}</strong>
            <span>{scenario.description}</span>
            <div className="scenarioMeta">
              <small>Tanque: {scenario.config?.tank_type || "--"}</small>
              <small>Mangueira: {scenario.config?.hose_id || "--"}</small>
              <small>Óleo: {fmt(scenario.config?.oil_flow_l_min, "L/min")}</small>
            </div>
            <button onClick={() => runScenario(scenario)}>Simular</button>
          </article>
        ))}
      </div>
    );
  }

  return (
    <Section title="Gêmeo Digital — cenários e testes" subtitle="Cenários base, personalizados, criação de teste e resultado com rastreabilidade completa.">
      <div className="subTabs">
        <button className={tab === "base" ? "" : "secondary"} onClick={() => setTab("base")}>Cenários base</button>
        <button className={tab === "custom" ? "" : "secondary"} onClick={() => setTab("custom")}>Cenários personalizados</button>
        <button className={tab === "create" ? "" : "secondary"} onClick={() => setTab("create")}>Criar cenário</button>
        <button className={tab === "result" ? "" : "secondary"} onClick={() => setTab("result")}>Resultado</button>
      </div>

      {tab === "base" && renderScenarioList(baseScenarios, "Nenhum cenário base disponível.")}
      {tab === "custom" && renderScenarioList(customScenarios, "Nenhum cenário personalizado salvo.")}

      {tab === "create" && (
        <div className="createScenarioBox">
          <div className="formGrid">
            <Field label="Nome do cenário">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>

            <Field label="Descrição">
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>

            <Field label="Tipo de tanque">
              <select value={form.tank_type} onChange={(e) => setForm({ ...form, tank_type: e.target.value })}>
                <option value="pequeno">Pequeno</option>
                <option value="medio">Médio</option>
                <option value="grande">Grande</option>
                <option value="extra_grande">Extra grande</option>
              </select>
            </Field>

            <Field label="Mangueira">
              <select value={form.hose_id} onChange={(e) => setForm({ ...form, hose_id: Number(e.target.value) })}>
                {allHoses.map((hose: any, index: number) => (
                  <option key={hose.id || index} value={hose.id || index + 1}>{hose.code || `MG-${index + 1}`}</option>
                ))}
              </select>
            </Field>

            <Field label="Pressão final desejada">
              <input type="number" value={form.target_pressure_mbar} onChange={(e) => setForm({ ...form, target_pressure_mbar: Number(e.target.value) })} />
            </Field>

            <Field label="Pressão da bomba secundária">
              <input type="number" value={form.roots_start_pressure_mbar} onChange={(e) => setForm({ ...form, roots_start_pressure_mbar: Number(e.target.value) })} />
            </Field>

            <Field label="Vazão de óleo">
              <input type="number" value={form.oil_flow_l_min} onChange={(e) => setForm({ ...form, oil_flow_l_min: Number(e.target.value) })} />
            </Field>

            <Field label="Saúde da bomba">
              <input type="number" step="0.01" value={form.pump_health_factor} onChange={(e) => setForm({ ...form, pump_health_factor: Number(e.target.value) })} />
            </Field>
          </div>

          <div className="checks">
            <label><input type="checkbox" checked={form.simulate_hose_leak} onChange={(e) => setForm({ ...form, simulate_hose_leak: e.target.checked })} /> Perda na mangueira</label>
            <label><input type="checkbox" checked={form.simulate_sensor_failure} onChange={(e) => setForm({ ...form, simulate_sensor_failure: e.target.checked })} /> Falha de sensor</label>
            <label><input type="checkbox" checked={form.simulate_plc_loss} onChange={(e) => setForm({ ...form, simulate_plc_loss: e.target.checked })} /> Falha de comunicação</label>
          </div>

          <div className="actions">
            <button onClick={saveScenario}>Salvar cenário</button>
            <button className="secondary" onClick={() => runScenario({ name: form.name, description: form.description, config: form })}>Simular agora</button>
          </div>
        </div>
      )}

      {tab === "result" && (
        result ? (
          <div className="resultStack">
            <div className="metrics">
              <Metric label="Status da simulação" value={<Badge value={result.status} />} detail={result.scenario} />
              <Metric label="Pressão final" value={fmt(result.metrics?.final_real_pressure_mbar, "mbar")} detail="Valor calculado" />
              <Metric label="Tempo estimado" value={fmt(result.metrics?.estimated_time_seconds, "s")} detail="Duração prevista" />
              <Metric label="Risco máximo" value={fmt(result.metrics?.max_collapse_risk_pct, "%")} detail="Margem operacional" />
            </div>

            <div className="diagnosticBox">
              <strong>{result.diagnosis}</strong>
              <span>{result.recommendation}</span>
            </div>

            <TseaSimulationTraceability result={result} state={state} hoses={allHoses} tanks={allTanks} />
          </div>
        ) : (
          <Empty text="Execute uma simulação para gerar o resultado técnico." />
        )
      )}
    </Section>
  );
}

function TseaHistoryDetailsPanel({ state, allTanks, allHoses }: any) {
  const [items, setItems] = useState<any[]>(() => tseaReadStorage("tsea.simulationHistory.final", []));
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setItems(tseaReadStorage("tsea.simulationHistory.final", []));
    }, 1500);

    return () => window.clearInterval(timer);
  }, []);

  if (!items.length) {
    return null;
  }

  return (
    <Section title="Detalhes técnicos das simulações" subtitle="Histórico local com parâmetros, resultado, componentes, ações e diagnóstico completo.">
      <Table
        columns={["ID", "Data", "Cenário", "Status", "Risco", "Pressão", "Detalhes"]}
        rows={items.map((item) => [
          <b>{item.id}</b>,
          new Date(item.created_at).toLocaleString("pt-BR"),
          item.scenario,
          <Badge value={item.status} />,
          fmt(item.metrics?.max_collapse_risk_pct, "%"),
          fmt(item.metrics?.final_real_pressure_mbar, "mbar"),
          <button className="secondary" onClick={() => setSelected(item)}>Ver detalhes</button>
        ])}
      />

      {selected && (
        <div className="detailPanel">
          <div className="traceHeader">
            <div>
              <h3>{selected.scenario}</h3>
              <p>{selected.diagnosis}</p>
            </div>
            <button className="secondary" onClick={() => setSelected(null)}>Fechar</button>
          </div>

          <TseaSimulationTraceability result={selected} state={state} hoses={allHoses} tanks={allTanks} />
        </div>
      )}
    </Section>
  );
}

/* TSEA_PATCH_GEMEO_RASTREABILIDADE_FINAL_END */


function App() {

  const [tseaDarkTheme, setTseaDarkTheme] = useState(() => localStorage.getItem("tsea.theme") === "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = tseaDarkTheme ? "dark" : "light";
    localStorage.setItem("tsea.theme", tseaDarkTheme ? "dark" : "light");

    let button = document.getElementById("tsea-theme-toggle-fixed") as HTMLButtonElement | null;

    if (!button) {
      button = document.createElement("button");
      button.id = "tsea-theme-toggle-fixed";
      button.type = "button";
      document.body.appendChild(button);
    }

    button.textContent = tseaDarkTheme ? "Claro" : "Escuro";
    button.onclick = () => setTseaDarkTheme((current) => !current);

    return () => {
      if (button) button.onclick = null;
    };
  }, [tseaDarkTheme]);


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

  const [localTanks, setLocalTanks] = useState<any[]>(() => loadLocal("tsea.localTanks", []));
  const [localHoses, setLocalHoses] = useState<any[]>(() => loadLocal("tsea.localHoses", []));
  const [localRecipes, setLocalRecipes] = useState<any[]>(() => loadLocal("tsea.localRecipes", []));
  const [localFormulas, setLocalFormulas] = useState<any[]>(() => loadLocal("tsea.localFormulas", []));
  const [localOperators, setLocalOperators] = useState<any[]>(() => loadLocal("tsea.localOperators", []));

  const [operationConfig, setOperationConfig] = useState<any>(() => loadLocal("tsea.operationConfig", {
    operator: "Operador TSEA",
    tank_id: 1,
    hose_id: 1,
    recipe_id: 1,
    target_pressure_mbar: 6.5,
    roots_start_pressure_mbar: 50,
    max_cycle_seconds: 900,
    oil_flow_l_min: 2,
    tank_type: "grande",
    notes: "",
  }));

  const [twinTab, setTwinTab] = useState<TwinTab>("scenarios");
  const [twinManual, setTwinManual] = useState<any>(() => loadLocal("tsea.twinManual", {
    tank_type: "grande",
    hose_id: 1,
    target_pressure_mbar: 6.5,
    roots_start_pressure_mbar: 50,
    oil_flow_l_min: 2,
    oil_delay_seconds: 0,
    max_cycle_seconds: 900,
    pump_health_factor: 1,
    calibration_factor: 1,
    hose_correction_enabled: true,
    oil_compensation_enabled: true,
    simulate_hose_leak: false,
    simulate_sensor_failure: false,
    simulate_plc_loss: false,
  }));

  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [selectedScenario, setSelectedScenario] = useState("");
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState("");

  const [historyTab, setHistoryTab] = useState<"operations" | "simulations">("operations");
  const [detail, setDetail] = useState<any>(null);

  const [reportTab, setReportTab] = useState<ReportTab>("operations");
  const [reportPeriod, setReportPeriod] = useState("all");

  const [paramTab, setParamTab] = useState<ParamTab>("tanks");
  const [form, setForm] = useState<any>({});

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

  useEffect(() => saveLocal("tsea.operationConfig", operationConfig), [operationConfig]);
  useEffect(() => saveLocal("tsea.twinManual", twinManual), [twinManual]);
  useEffect(() => saveLocal("tsea.localTanks", localTanks), [localTanks]);
  useEffect(() => saveLocal("tsea.localHoses", localHoses), [localHoses]);
  useEffect(() => saveLocal("tsea.localRecipes", localRecipes), [localRecipes]);
  useEffect(() => saveLocal("tsea.localFormulas", localFormulas), [localFormulas]);
  useEffect(() => saveLocal("tsea.localOperators", localOperators), [localOperators]);

  const apiTanks = Array.isArray(tanks) ? tanks : [];
  const apiHoses = Array.isArray(hoses) ? hoses : [];
  const apiRecipes = Array.isArray(recipes) ? recipes : [];

  const allTanks = [...apiTanks, ...localTanks];
  const allHoses = [...apiHoses, ...localHoses];
  const allRecipes = [...apiRecipes, ...localRecipes];

  const tanksState = state?.tank_states || [];
  const avgPressure = tanksState.reduce((sum: number, item: any) => sum + Number(item.pressure_mbar || 0), 0) / Math.max(tanksState.length, 1);
  const maxRisk = Math.max(0, ...tanksState.map((item: any) => Number(item.collapse_risk_pct || 0)));
  const currentRows = historyTab === "operations" ? operations : simulations;

  const filteredOperations = operations.filter((op: any) => inPeriod(op.created_at, reportPeriod));
  const filteredSimulations = simulations.filter((sim: any) => inPeriod(sim.created_at, reportPeriod));

  const pageTitle = useMemo(() => menu.find((item) => item.key === view)?.label || "Painel", [view]);

  function setOp(key: string, value: any) {
    setOperationConfig((current: any) => ({ ...current, [key]: value }));
  }

  function setTwin(key: string, value: any) {
    setTwinManual((current: any) => ({ ...current, [key]: value }));
  }

  async function control(action: "start" | "pause" | "stop" | "reset" | "emergency") {
    if (action === "start") {
      await safe("/operation/start", {
        method: "POST",
        body: JSON.stringify(operationConfig),
      });
    } else {
      await safe(`/operation/${action}`, { method: "POST" });
    }

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
    setTwinTab("result");

    await safe("/records/simulations", {
      method: "POST",
      body: JSON.stringify({
        name: options?.presets?.[key]?.name || "Simulação Operacional",
        config,
      }),
    });

    await refresh(false);
  }

  async function runManualSimulation() {
    const result = await request("/digital-twin/simulate", {
      method: "POST",
      body: JSON.stringify(twinManual),
    });

    setSimulationResult(result);
    setSelectedScenario("manual");
    setTwinTab("result");

    await safe("/records/simulations", {
      method: "POST",
      body: JSON.stringify({
        name: "Configuração Manual",
        config: twinManual,
      }),
    });

    await refresh(false);
  }

  function askAssistant() {
    const q = assistantQuestion.toLowerCase();
    const status = simulationResult?.status ? statusLabel(simulationResult.status) : "sem simulação executada";
    const risk = simulationResult?.metrics?.max_collapse_risk_pct;
    const pressure = simulationResult?.metrics?.final_real_pressure_mbar;

    let answer = `Estado atual: ${status}. Risco máximo: ${fmt(risk, "%")}. Pressão final: ${fmt(pressure, "mbar")}.`;

    if (q.includes("óleo") || q.includes("oleo")) {
      answer += " Verifique vazão de injeção, atraso de entrada e compensação de óleo. Baixa vazão ou atraso elevam a carga estrutural.";
    } else if (q.includes("mangueira") || q.includes("mangueira")) {
      answer += " Verifique comprimento, diâmetro e fator de perda da mangueira de vácuo. Perda elevada altera a curva esperada.";
    } else if (q.includes("roots") || q.includes("bomba")) {
      answer += " Confirme a pressão de acionamento da bomba secundária e o índice de integridade da bomba. Acionamento fora da faixa aumenta risco operacional.";
    } else if (q.includes("risco")) {
      answer += " O índice de risco deve ser comparado ao limite estrutural definido para o tanque e à margem operacional de segurança.";
    } else {
      answer += " Analise curva esperada, curva real/simulada, mangueira de vácuo, óleo e acionamento da bomba secundária antes de liberar a execução.";
    }

    setAssistantAnswer(answer);
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

  function saveParam() {
    if (paramTab === "tanks") {
      const item = {
        id: `LT-${Date.now()}`,
        code: form.code || "TQ-NOVO",
        type: form.type || "grande",
        volume_liters: Number(form.volume_liters || 0),
        structural_limit_mbar: Number(form.structural_limit_mbar || 0),
        status: form.status || "available",
      };
      setLocalTanks((list) => [...list, item]);
    }

    if (paramTab === "hoses") {
      const item = {
        id: `LH-${Date.now()}`,
        code: form.code || "MG-NOVA",
        length_m: Number(form.length_m || 0),
        diameter_in: Number(form.diameter_in || 0),
        loss_factor: Number(form.loss_factor || 0),
        status: form.status || "available",
      };
      setLocalHoses((list) => [...list, item]);
    }

    if (paramTab === "recipes") {
      const item = {
        id: `LR-${Date.now()}`,
        name: form.name || "Receita Operacional",
        tank_type: form.tank_type || "grande",
        target_pressure_mbar: Number(form.target_pressure_mbar || 6.5),
        roots_start_pressure_mbar: Number(form.roots_start_pressure_mbar || 50),
        max_cycle_seconds: Number(form.max_cycle_seconds || 900),
        min_oil_flow_l_min: Number(form.min_oil_flow_l_min || 2),
      };
      setLocalRecipes((list) => [...list, item]);
    }

    if (paramTab === "formulas") {
      const item = {
        id: `LF-${Date.now()}`,
        name: form.name || "Fórmula Operacional",
        expression: form.expression || "dP/dt = -(S/V)P",
        variable: form.variable || "Pressão",
        description: form.description || "Modelo operacional padrão",
      };
      setLocalFormulas((list) => [...list, item]);
    }

    if (paramTab === "operators") {
      const item = {
        id: `LO-${Date.now()}`,
        name: form.name || "Operador",
        registration: form.registration || "N/A",
        role: form.role || "Operação",
        status: form.status || "Ativo",
      };
      setLocalOperators((list) => [...list, item]);
    }

    setForm({});
  }

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

            <Section title="Mapa operacional" subtitle="Estado consolidado dos tanques de processo e mangueiras de vácuo.">
              <div className="tankGrid">
                {tanksState.map((item: any, index: number) => (
                  <TankCard key={item?.tank?.id || index} item={item} />
                ))}
              </div>
            </Section>

            <Section title="Unidade de bombeamento" subtitle="Bomba primária, bomba secundária, óleo e comunicação.">
              <div className="statusGrid">
                <Metric label="Bomba Primária" value={state?.primary_pump?.running ? "Ligada" : "Desligada"} detail={state?.primary_pump?.model || "SV 630 B"} status={state?.primary_pump?.running ? "success" : "neutral"} />
                <Metric label="Bomba secundária" value={state?.roots_pump?.running ? "Ligada" : "Bloqueada"} detail={state?.roots_pump?.model || "WSU 2001"} status={state?.roots_pump?.running ? "success" : "warning"} />
                <Metric label="Injeção de Óleo" value={state?.oil_injection?.enabled ? "Ativa" : "Inativa"} detail={fmt(state?.oil_injection?.target_flow_l_min, "L/min")} status={state?.oil_injection?.enabled ? "success" : "neutral"} />
                <Metric label="CLP" value={state?.plc_comm_ok ? "Comunicação normal" : "Falha de comunicação"} status={state?.plc_comm_ok ? "success" : "critical"} />
              </div>
            </Section>
          </div>
        )}

        {view === "operation" && (
          <div className="screen">
<Section title="Configuração da operação" subtitle="Parâmetros do ciclo antes da execução." action={<Badge value={state?.cycle?.status || "stopped"} />}>
              <div className="formGrid">
                <Field label="Responsável operacional">
                  <input value={operationConfig.operator} onChange={(e) => setOp("operator", e.target.value)} />
                </Field>

                <Field label="Tanque de processo">
                  <select value={operationConfig.tank_id} onChange={(e) => setOp("tank_id", e.target.value)}>
                    {allTanks.map((tank: any) => (
                      <option key={tank.id || tank.code} value={tank.id || tank.code}>{tank.code || tank.name} · {tank.type || "tipo"}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Mangueira de vácuo / mangueira">
                  <select value={operationConfig.hose_id} onChange={(e) => setOp("hose_id", e.target.value)}>
                    {allHoses.map((hose: any) => (
                      <option key={hose.id || hose.code} value={hose.id || hose.code}>{hose.code} · {fmt(hose.length_m, "m")} · fator {fmt(hose.loss_factor)}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Receita operacional">
                  <select
                    value={operationConfig.recipe_id}
                    onChange={(e) => {
                      const value = e.target.value;
                      const recipe = allRecipes.find((r: any) => String(r.id) === String(value));
                      setOperationConfig((current: any) => ({
                        ...current,
                        recipe_id: value,
                        target_pressure_mbar: recipe?.target_pressure_mbar ?? current.target_pressure_mbar,
                        roots_start_pressure_mbar: recipe?.roots_start_pressure_mbar ?? current.roots_start_pressure_mbar,
                        max_cycle_seconds: recipe?.max_cycle_seconds ?? current.max_cycle_seconds,
                        oil_flow_l_min: recipe?.min_oil_flow_l_min ?? current.oil_flow_l_min,
                        tank_type: recipe?.tank_type ?? current.tank_type,
                      }));
                    }}
                  >
                    {allRecipes.map((recipe: any) => (
                      <option key={recipe.id || recipe.name} value={recipe.id || recipe.name}>{recipe.name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Tipo de tanque">
                  <select value={operationConfig.tank_type} onChange={(e) => setOp("tank_type", e.target.value)}>
                    <option value="medio">Médio</option>
                    <option value="grande">Grande</option>
                    <option value="extra_grande">Extra grande</option>
                  </select>
                </Field>

                <Field label="Pressão final do processo">
                  <input type="number" value={operationConfig.target_pressure_mbar} onChange={(e) => setOp("target_pressure_mbar", Number(e.target.value))} />
                </Field>

                <Field label="Pressão de acionamento da bomba secundária">
                  <input type="number" value={operationConfig.roots_start_pressure_mbar} onChange={(e) => setOp("roots_start_pressure_mbar", Number(e.target.value))} />
                </Field>

                <Field label="Vazão de óleo">
                  <input type="number" value={operationConfig.oil_flow_l_min} onChange={(e) => setOp("oil_flow_l_min", Number(e.target.value))} />
                </Field>

                <Field label="Tempo máximo do ciclo">
                  <input type="number" value={operationConfig.max_cycle_seconds} onChange={(e) => setOp("max_cycle_seconds", Number(e.target.value))} />
                </Field>

                <Field label="Observação técnica">
                  <input value={operationConfig.notes} onChange={(e) => setOp("notes", e.target.value)} />
                </Field>
              </div>

              <div className="commandBar">
                <button onClick={() => control("start")}>Iniciar operação</button>
                <button className="secondary" onClick={() => control("pause")}>Pausar</button>
                <button className="secondary" onClick={() => control("stop")}>Finalizar</button>
                <button className="secondary" onClick={() => control("reset")}>Resetar</button>
                <button className="danger" onClick={() => control("emergency")}>Emergência</button>
              </div>
            </Section>

            <Section title="Operação em tempo real" subtitle="Pressão, óleo, mangueira de vácuo e risco estrutural por tanque.">
              <div className="tankGrid">
                {tanksState.map((item: any, index: number) => (
                  <TankCard key={item?.tank?.id || index} item={item} />
                ))}
              </div>
            </Section>

            <TseaComponentHealthPanel
              state={state}
              allTanks={allTanks}
              allHoses={allHoses}
            />

          </div>
        )}

        {view === "twin" && (
          <div className="screen">

            <TseaTwinRecoveryPanel
              state={state}
              allTanks={allTanks}
              allHoses={allHoses}
            />

            <Section title="Gêmeo Digital" subtitle="Cenários, configuração manual, resultado e diagnóstico.">
              <div className="subtabs">
                <button className={twinTab === "scenarios" ? "" : "secondary"} onClick={() => setTwinTab("scenarios")}>Cenários</button>
                <button className={twinTab === "manual" ? "" : "secondary"} onClick={() => setTwinTab("manual")}>Configuração</button>
                <button className={twinTab === "result" ? "" : "secondary"} onClick={() => setTwinTab("result")}>Resultado</button>
                <button className={twinTab === "assistant" ? "" : "secondary"} onClick={() => setTwinTab("assistant")}>Assistente</button>
                <button className={twinTab === "technical" ? "" : "secondary"} onClick={() => setTwinTab("technical")}>Dados Técnicos</button>
              </div>

              {twinTab === "scenarios" && (
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
              )}

              {twinTab === "manual" && (
                <div>
                  <div className="formGrid">
                    <Field label="Tipo de tanque">
                      <select value={twinManual.tank_type} onChange={(e) => setTwin("tank_type", e.target.value)}>
                        <option value="medio">Médio</option>
                        <option value="grande">Grande</option>
                        <option value="extra_grande">Extra grande</option>
                      </select>
                    </Field>

                    <Field label="Mangueira de vácuo">
                      <select value={twinManual.hose_id} onChange={(e) => setTwin("hose_id", Number(e.target.value))}>
                        {allHoses.map((hose: any) => (
                          <option key={hose.id || hose.code} value={hose.id || hose.code}>{hose.code} · {fmt(hose.length_m, "m")}</option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Pressão final">
                      <input type="number" value={twinManual.target_pressure_mbar} onChange={(e) => setTwin("target_pressure_mbar", Number(e.target.value))} />
                    </Field>

                    <Field label="Acionamento da bomba secundária">
                      <input type="number" value={twinManual.roots_start_pressure_mbar} onChange={(e) => setTwin("roots_start_pressure_mbar", Number(e.target.value))} />
                    </Field>

                    <Field label="Vazão de óleo">
                      <input type="number" value={twinManual.oil_flow_l_min} onChange={(e) => setTwin("oil_flow_l_min", Number(e.target.value))} />
                    </Field>

                    <Field label="Atraso do óleo">
                      <input type="number" value={twinManual.oil_delay_seconds} onChange={(e) => setTwin("oil_delay_seconds", Number(e.target.value))} />
                    </Field>

                    <Field label="Índice da bomba">
                      <input type="number" step="0.01" value={twinManual.pump_health_factor} onChange={(e) => setTwin("pump_health_factor", Number(e.target.value))} />
                    </Field>

                    <Field label="Fator de calibração">
                      <input type="number" step="0.001" value={twinManual.calibration_factor} onChange={(e) => setTwin("calibration_factor", Number(e.target.value))} />
                    </Field>
                  </div>

                  <div className="checkGrid">
                    <label><input type="checkbox" checked={!!twinManual.hose_correction_enabled} onChange={(e) => setTwin("hose_correction_enabled", e.target.checked)} /> Correção da mangueira</label>
                    <label><input type="checkbox" checked={!!twinManual.oil_compensation_enabled} onChange={(e) => setTwin("oil_compensation_enabled", e.target.checked)} /> Compensação de óleo</label>
                    <label><input type="checkbox" checked={!!twinManual.simulate_hose_leak} onChange={(e) => setTwin("simulate_hose_leak", e.target.checked)} /> Perda de vedação</label>
                    <label><input type="checkbox" checked={!!twinManual.simulate_sensor_failure} onChange={(e) => setTwin("simulate_sensor_failure", e.target.checked)} /> Falha de sensor</label>
                    <label><input type="checkbox" checked={!!twinManual.simulate_plc_loss} onChange={(e) => setTwin("simulate_plc_loss", e.target.checked)} /> Falha de CLP</label>
                  </div>

                  <div className="commandBar">
                    <button onClick={runManualSimulation}>Executar simulação manual</button>
                    <button className="secondary" onClick={() => download("configuracao-gemeo-digital.json", twinManual)}>Exportar configuração</button>
                  </div>
                </div>
              )}

              {twinTab === "result" && (
                !simulationResult ? (
                  <Empty text="Nenhuma simulação executada." />
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

                    <SimulationTraceability
                      result={simulationResult}
                      state={state}
                      selectedScenario={selectedScenario}
                      hoses={allHoses}
                      tanks={allTanks}
                      config={selectedScenario === "manual" ? twinManual : (allScenarios.find((scenario: any) => scenario.key === selectedScenario)?.config || twinManual)}
                    />
                  </div>
                )
              )}

              {twinTab === "assistant" && (
                <div className="assistantBox">
                  <Field label="Consulta técnica">
                    <input value={assistantQuestion} onChange={(e) => setAssistantQuestion(e.target.value)} placeholder="Ex.: por que o risco aumentou?" />
                  </Field>
                  <button onClick={askAssistant}>Analisar</button>
                  {assistantAnswer && <div className="diagnosticBox"><strong>Resposta técnica</strong><span>{assistantAnswer}</span></div>}
                </div>
              )}

              {twinTab === "technical" && (
                <div className="infoGridLarge">
                  <div><span>Modelo de pressão</span><b>dP/dt = -(S/V)P</b></div>
                  <div><span>Bomba primária</span><b>{state?.primary_pump?.model || "SV 630 B"}</b></div>
                  <div><span>Bomba secundária</span><b>{state?.roots_pump?.model || "WSU 2001"}</b></div>
                  <div><span>Pressão segura bomba secundária</span><b>{fmt(state?.roots_pump?.safe_start_pressure_mbar, "mbar")}</b></div>
                  <div><span>Mangueiras cadastradas</span><b>{allHoses.length}</b></div>
                  <div><span>Receitas cadastradas</span><b>{allRecipes.length}</b></div>
                </div>
              )}
            </Section>
          </div>
        )}

        {view === "history" && (
          <div className="screen">

            <TseaHistoryDetailsPanel
              state={state}
              allTanks={allTanks}
              allHoses={allHoses}
            />

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
                  ? ["ID", "Data", "Responsável", "Estado", "Tanque", "Mangueira", "Pressão", "Ação"]
                  : ["ID", "Data", "Nome", "Estado", "Tanque", "Mangueira", "Risco", "Ação"]}
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
                      <div><span>Mangueira</span><b>{detail.record?.hose_code || detail.record?.hose_id || "--"}</b></div>
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
            <Section title="Filtros de relatório" subtitle="Recorte operacional para análise.">
              <div className="filterRow">
                <button className={reportPeriod === "today" ? "" : "secondary"} onClick={() => setReportPeriod("today")}>Hoje</button>
                <button className={reportPeriod === "week" ? "" : "secondary"} onClick={() => setReportPeriod("week")}>Últimos 7 dias</button>
                <button className={reportPeriod === "month" ? "" : "secondary"} onClick={() => setReportPeriod("month")}>Últimos 30 dias</button>
                <button className={reportPeriod === "all" ? "" : "secondary"} onClick={() => setReportPeriod("all")}>Todos</button>
              </div>

              <div className="tabs">
                <button className={reportTab === "operations" ? "" : "secondary"} onClick={() => setReportTab("operations")}>Operações</button>
                <button className={reportTab === "simulations" ? "" : "secondary"} onClick={() => setReportTab("simulations")}>Simulações</button>
              </div>
            </Section>

            <div className="metricsGrid">
              <Metric label="Operações Filtradas" value={filteredOperations.length} />
              <Metric label="Simulações Filtradas" value={filteredSimulations.length} />
              <Metric label="Alarmes" value={report?.alarms_count ?? alarms.length} status={(report?.alarms_count || alarms.length) ? "warning" : "success"} />
              <Metric label="Pressão Média" value={fmt(report?.average_recent_pressure_mbar, "mbar")} />
            </div>

            {reportTab === "operations" && (
              <Section title="Relatório de operações" subtitle="Ciclos filtrados por período.">
                <Table
                  columns={["ID", "Data", "Responsável", "Estado", "Tanque", "Mangueira", "Pressão Final"]}
                  rows={filteredOperations.map((item: any) => [
                    <b>{item.id}</b>,
                    item.created_at || "--",
                    item.operator || "--",
                    <Badge value={item.status} />,
                    item.tank_code || item.tank_type || "--",
                    item.hose_code || item.hose_id || "--",
                    fmt(item.final_pressure_mbar, "mbar"),
                  ])}
                />
                <div className="commandBar">
                  <button onClick={() => download("relatorio-operacoes.json", filteredOperations)}>Exportar operações</button>
                </div>
              </Section>
            )}

            {reportTab === "simulations" && (
              <Section title="Relatório de simulações" subtitle="Simulações filtradas por período.">
                <Table
                  columns={["ID", "Data", "Nome", "Estado", "Tanque", "Mangueira", "Risco Máximo"]}
                  rows={filteredSimulations.map((item: any) => [
                    <b>{item.id}</b>,
                    item.created_at || "--",
                    item.name || "--",
                    <Badge value={item.status} />,
                    item.tank_type || "--",
                    item.hose_code || item.hose_id || "--",
                    fmt(item.max_collapse_risk_pct, "%"),
                  ])}
                />
                <div className="commandBar">
                  <button onClick={() => download("relatorio-simulacoes.json", filteredSimulations)}>Exportar simulações</button>
                </div>
              </Section>
            )}
          </div>
        )}

        {view === "parameters" && (
          <div className="screen">
            <Section title="Cadastros técnicos" subtitle="Tanques, mangueiras de vácuo, receitas, fórmulas e responsáveis operacionais.">
              <div className="subtabs">
                <button className={paramTab === "tanks" ? "" : "secondary"} onClick={() => { setParamTab("tanks"); setForm({}); }}>Tanques</button>
                <button className={paramTab === "hoses" ? "" : "secondary"} onClick={() => { setParamTab("hoses"); setForm({}); }}>Mangueiras</button>
                <button className={paramTab === "recipes" ? "" : "secondary"} onClick={() => { setParamTab("recipes"); setForm({}); }}>Receitas</button>
                <button className={paramTab === "formulas" ? "" : "secondary"} onClick={() => { setParamTab("formulas"); setForm({}); }}>Fórmulas</button>
                <button className={paramTab === "operators" ? "" : "secondary"} onClick={() => { setParamTab("operators"); setForm({}); }}>Operadores</button>
              </div>

              <div className="formGrid">
                {paramTab === "tanks" && (
                  <>
                    <Field label="Código"><input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
                    <Field label="Tipo"><input value={form.type || ""} onChange={(e) => setForm({ ...form, type: e.target.value })} /></Field>
                    <Field label="Volume (L)"><input type="number" value={form.volume_liters || ""} onChange={(e) => setForm({ ...form, volume_liters: e.target.value })} /></Field>
                    <Field label="Limite estrutural (mbar)"><input type="number" value={form.structural_limit_mbar || ""} onChange={(e) => setForm({ ...form, structural_limit_mbar: e.target.value })} /></Field>
                  </>
                )}

                {paramTab === "hoses" && (
                  <>
                    <Field label="Código"><input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
                    <Field label="Comprimento (m)"><input type="number" value={form.length_m || ""} onChange={(e) => setForm({ ...form, length_m: e.target.value })} /></Field>
                    <Field label="Diâmetro (pol)"><input type="number" value={form.diameter_in || ""} onChange={(e) => setForm({ ...form, diameter_in: e.target.value })} /></Field>
                    <Field label="Fator de perda"><input type="number" value={form.loss_factor || ""} onChange={(e) => setForm({ ...form, loss_factor: e.target.value })} /></Field>
                  </>
                )}

                {paramTab === "recipes" && (
                  <>
                    <Field label="Nome da receita"><input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                    <Field label="Tipo de tanque"><input value={form.tank_type || ""} onChange={(e) => setForm({ ...form, tank_type: e.target.value })} /></Field>
                    <Field label="Pressão final"><input type="number" value={form.target_pressure_mbar || ""} onChange={(e) => setForm({ ...form, target_pressure_mbar: e.target.value })} /></Field>
                    <Field label="Acionamento da bomba secundária"><input type="number" value={form.roots_start_pressure_mbar || ""} onChange={(e) => setForm({ ...form, roots_start_pressure_mbar: e.target.value })} /></Field>
                    <Field label="Tempo máximo"><input type="number" value={form.max_cycle_seconds || ""} onChange={(e) => setForm({ ...form, max_cycle_seconds: e.target.value })} /></Field>
                    <Field label="Vazão mínima de óleo"><input type="number" value={form.min_oil_flow_l_min || ""} onChange={(e) => setForm({ ...form, min_oil_flow_l_min: e.target.value })} /></Field>
                  </>
                )}

                {paramTab === "formulas" && (
                  <>
                    <Field label="Nome"><input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                    <Field label="Variável"><input value={form.variable || ""} onChange={(e) => setForm({ ...form, variable: e.target.value })} /></Field>
                    <Field label="Expressão"><input value={form.expression || ""} onChange={(e) => setForm({ ...form, expression: e.target.value })} /></Field>
                    <Field label="Descrição"><input value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
                  </>
                )}

                {paramTab === "operators" && (
                  <>
                    <Field label="Nome"><input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                    <Field label="Registro"><input value={form.registration || ""} onChange={(e) => setForm({ ...form, registration: e.target.value })} /></Field>
                    <Field label="Função"><input value={form.role || ""} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
                    <Field label="Estado"><input value={form.status || ""} onChange={(e) => setForm({ ...form, status: e.target.value })} /></Field>
                  </>
                )}
              </div>

              <div className="commandBar">
                <button onClick={saveParam}>Cadastrar</button>
              </div>
            </Section>

            {paramTab === "tanks" && (
              <Section title="Tanques cadastrados">
                <Table columns={["Código", "Tipo", "Volume", "Limite", "Estado"]} rows={allTanks.map((tank: any) => [<b>{tank.code}</b>, tank.type || "--", fmt(tank.volume_liters, "L"), fmt(tank.structural_limit_mbar, "mbar"), tank.status || "--"])} />
              </Section>
            )}

            {paramTab === "hoses" && (
              <Section title="Mangueiras cadastradas">
                <Table columns={["Código", "Comprimento", "Diâmetro", "Fator", "Estado"]} rows={allHoses.map((hose: any) => [<b>{hose.code}</b>, fmt(hose.length_m, "m"), fmt(hose.diameter_in, "pol"), fmt(hose.loss_factor), hose.status || "--"])} />
              </Section>
            )}

            {paramTab === "recipes" && (
              <Section title="Receitas cadastradas">
                <Table columns={["Nome", "Tanque", "Pressão", "bomba secundária", "Tempo", "Óleo"]} rows={allRecipes.map((recipe: any) => [<b>{recipe.name}</b>, recipe.tank_type || "--", fmt(recipe.target_pressure_mbar, "mbar"), fmt(recipe.roots_start_pressure_mbar, "mbar"), fmt(recipe.max_cycle_seconds, "s"), fmt(recipe.min_oil_flow_l_min, "L/min")])} />
              </Section>
            )}

            {paramTab === "formulas" && (
              <Section title="Fórmulas cadastradas">
                <Table columns={["Nome", "Variável", "Expressão", "Descrição"]} rows={localFormulas.map((f: any) => [<b>{f.name}</b>, f.variable, f.expression, f.description])} />
              </Section>
            )}

            {paramTab === "operators" && (
              <Section title="Operadores cadastrados">
                <Table columns={["Nome", "Registro", "Função", "Estado"]} rows={localOperators.map((op: any) => [<b>{op.name}</b>, op.registration, op.role, op.status])} />
              </Section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);