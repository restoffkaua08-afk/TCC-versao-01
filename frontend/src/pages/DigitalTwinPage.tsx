import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import { Badge, Chart, Empty, Field, fmt, Metric, Section, Table } from "../components/ui";

type TwinTab = "scenarios" | "simulation" | "result" | "history" | "technical";
type ScenarioMode = "view" | "edit" | "create";

type DigitalTwinPageProps = {
  DigitalTwin: ComponentType<any>;
  allHoses: any[];
  allTanks: any[];
  state: any;
};


function clampTankCount(value: unknown) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 1;
  return Math.max(1, Math.min(3, Math.round(numeric)));
}

function TankQuantityStrip({ count, label = "Tanques configurados" }: { count: number; label?: string }) {
  const normalized = clampTankCount(count);

  return (
    <div className="tank-count-strip">
      <div>
        <span>{label}</span>
        <strong>{normalized} {normalized === 1 ? "tanque" : "tanques"}</strong>
      </div>

      <div className="tank-count-icons" aria-label="Quantidade de tanques">
        {Array.from({ length: normalized }).map((_, index) => (
          <span key={index}>T{index + 1}</span>
        ))}
      </div>
    </div>
  );
}


const DEFAULT_SCENARIO_FORM = {
  name: "Novo cenário de teste",
  description: "Cenário personalizado para validação operacional.",
  category: "Personalizado",
  expected_risk_level: "Operacional",
  notes: "",
  tank_type: "grande",
  tank_id: 1,
  hose_id: 1, tank_count: 1, recipe: "",
  operator: "Operador TSEA",
  initial_pressure_mbar: 1013,
  target_pressure_mbar: 6.5,
  secondary_start_pressure_mbar: 50,
  allowed_error_mbar: 5,
  oil_flow_l_min: 2,
  estimated_oil_volume_liters: 0,
  oil_delay_seconds: 0,
  primary_pump_health: 1,
  secondary_pump_health: 1,
  hose_loss_factor: 0.8,
  simulate_sensor_failure: false,
  simulate_hose_leak: false,
  simulate_timeout: false,
  simulate_pump_wear: false,
  max_cycle_seconds: 900,
};

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

function scenarioConfig(scenario: any) {
  return { ...scenario, ...(scenario?.config || {}) };
}

function riskTone(value: unknown) {
  const text = String(value || "").toLowerCase();
  if (["critical", "crítico", "critico", "alto", "falha"].includes(text)) return "critical";
  if (["warning", "atenção", "atencao", "médio", "medio", "restrição"].includes(text)) return "warning";
  return "success";
}

function statusFromRisk(risk: number) {
  if (risk >= 82) return "critical";
  if (risk >= 65) return "warning";
  return "success";
}

function statusText(status: unknown) {
  const value = String(status || "").toLowerCase();
  if (value === "success") return "Operacional";
  if (value === "warning") return "Atenção";
  if (value === "critical") return "Crítico";
  return String(status || "--");
}

function scenarioRows(scenario: any) {
  const config = scenarioConfig(scenario);
  return [
    ["Nome da simulação", scenario?.name || config.name || "--"],
    ["Descrição", scenario?.description || config.description || "--"],
    ["Categoria", scenario?.category || scenario?.tag || config.category || "--"],
    ["Nível de risco esperado", scenario?.expected_risk_level || config.expected_risk_level || "--"],
    ["Tanque", config.tank_type || config.tank_id || "--"],
    ["Quantidade de tanques", `${clampTankCount(config.tank_count ?? 1)} ${clampTankCount(config.tank_count ?? 1) === 1 ? "tanque" : "tanques"}`],
    ["Mangueira", config.hose_id || "--"],
    ["Receita", config.recipe || "--"],
    ["Pressão inicial", fmt(config.initial_pressure_mbar, "mbar")],
    ["Pressão alvo", fmt(config.target_pressure_mbar, "mbar")],
    ["Pressão para acionar bomba Roots", fmt(config.secondary_start_pressure_mbar, "mbar")],
    ["Margem de erro", fmt(config.allowed_error_mbar, "mbar")],
    ["Vazão de óleo", fmt(config.oil_flow_l_min, "L/min")],
    ["Volume estimado", fmt(config.estimated_oil_volume_liters, "L")],
    ["Atraso do óleo", fmt(config.oil_delay_seconds, "s")],
    ["Condição da bomba", fmt((config.primary_pump_health ?? 1) * 100, "%")],
    ["Perda na mangueira", fmt(config.hose_loss_factor, "fator")],
    ["Falha de sensor", config.simulate_sensor_failure ? "Sim" : "Não"],
    ["Vazamento simulado", config.simulate_hose_leak ? "Sim" : "Não"],
    ["Tempo de ciclo", fmt(config.max_cycle_seconds, "s")],
    ["Observações", config.notes || "--"],
  ];
}

function buildPrintableScenario(scenario: any) {
  const rows = scenarioRows(scenario)
    .map(([key, value]) => `<tr><th>${String(key)}</th><td>${String(value)}</td></tr>`)
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Operação do Gêmeo Digital TSEA</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1f2d27; padding: 24px; }
    h1 { margin: 0 0 10px; }
    h2 { margin: 0 0 22px; font-size: 16px; color: #476058; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d9e1dc; padding: 10px; text-align: left; }
    th { width: 260px; background: #eef3ef; }
  </style>
</head>
<body>
  <h1>Operação do Gêmeo Digital TSEA</h1>
  <h2>Nome da simulação: ${scenario?.name || "--"}</h2>
  <table>${rows}</table>
</body>
</html>`;
}

function MiniField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="twinInfoCell">
      <span>{label}</span>
      <b>{String(value ?? "--")}</b>
    </div>
  );
}

export function DigitalTwinPage({ DigitalTwin, allHoses, allTanks, state }: DigitalTwinPageProps) {
  const baseScenarios = useMemo(() => [
    {
      id: "base-seguro",
      name: "Ciclo seguro padrão",
      description: "Validação conservadora para operação com margem ampliada.",
      category: "Conservador",
      expected_risk_level: "Operacional",
      status: "Disponível",
      last_run: "",
      config: {
        ...DEFAULT_SCENARIO_FORM,
        tank_type: "grande",
        tank_id: allTanks?.[0]?.id || 1,
        hose_id: allHoses?.[0]?.id || 1,
        target_pressure_mbar: 8,
        secondary_start_pressure_mbar: 55,
        oil_flow_l_min: 2,
        max_cycle_seconds: 780,
      },
    },
    {
      id: "base-produtivo",
      name: "Reguladores TSEA com óleo",
      description: "Ciclo operacional padrão para reguladores com injeção de óleo.",
      category: "Produção",
      expected_risk_level: "Operacional",
      status: "Disponível",
      last_run: "",
      config: {
        ...DEFAULT_SCENARIO_FORM,
        tank_type: "grande",
        tank_id: allTanks?.[0]?.id || 1,
        hose_id: allHoses?.[0]?.id || 1,
        target_pressure_mbar: 6.5,
        secondary_start_pressure_mbar: 50,
        oil_flow_l_min: 2,
        max_cycle_seconds: 900,
      },
    },
    {
      id: "base-mangueira",
      name: "Teste de perda na mangueira",
      description: "Avalia perda de carga, vazão baixa e impacto no tempo de ciclo.",
      category: "Risco",
      expected_risk_level: "Atenção",
      status: "Disponível",
      last_run: "",
      config: {
        ...DEFAULT_SCENARIO_FORM,
        tank_type: "extra_grande",
        tank_id: allTanks?.[0]?.id || 1,
        hose_id: allHoses?.[2]?.id || allHoses?.[0]?.id || 1,
        target_pressure_mbar: 7.5,
        secondary_start_pressure_mbar: 60,
        oil_flow_l_min: 1.3,
        oil_delay_seconds: 25,
        max_cycle_seconds: 1100,
        primary_pump_health: 0.88,
        secondary_pump_health: 0.9,
        hose_loss_factor: 1.28,
        simulate_hose_leak: true,
      },
    },
    {
      id: "base-sensor",
      name: "Falha de sensor de pressão",
      description: "Verifica impacto de leitura instável no diagnóstico do ciclo.",
      category: "Validação",
      expected_risk_level: "Crítico",
      status: "Disponível",
      last_run: "",
      config: {
        ...DEFAULT_SCENARIO_FORM,
        tank_type: "grande",
        tank_id: allTanks?.[0]?.id || 1,
        hose_id: allHoses?.[1]?.id || allHoses?.[0]?.id || 1,
        target_pressure_mbar: 7,
        secondary_start_pressure_mbar: 50,
        oil_flow_l_min: 2,
        oil_delay_seconds: 5,
        max_cycle_seconds: 920,
        primary_pump_health: 0.96,
        secondary_pump_health: 0.94,
        simulate_sensor_failure: true,
      },
    },
  ], [allHoses, allTanks]);

  const [tab, setTab] = useState<TwinTab>("scenarios");
  const [twinSubmenuOpen, setTwinSubmenuOpen] = useState(false); const [customScenarios, setCustomScenarios] = useState<any[]>(() => loadLocal("tsea.gemeo10.customScenarios", []));
  const [history, setHistory] = useState<any[]>(() => loadLocal("tsea.gemeo10.history", []));
  const [result, setResult] = useState<any>(() => loadLocal("tsea.gemeo10.lastResult", null));
  const [selectedScenario, setSelectedScenario] = useState<any>(null);
  const [modalMode, setModalMode] = useState<ScenarioMode | null>(null);
  const [scenarioForm, setScenarioForm] = useState<any>(() => loadLocal("tsea.gemeo10.form", DEFAULT_SCENARIO_FORM));
  const [createStep, setCreateStep] = useState(1);
  const [historyDetail, setHistoryDetail] = useState<any>(null);

  const allScenarios = [...baseScenarios, ...customScenarios];

  function findHose(config: any) {
    return allHoses?.find((hose: any) => String(hose.id) === String(config?.hose_id) || String(hose.code) === String(config?.hose_id)) || allHoses?.[0] || {};
  }

  function findTank(config: any) {
    return allTanks?.find((tank: any) => String(tank.id) === String(config?.tank_id) || String(tank.type) === String(config?.tank_type)) || allTanks?.[0] || {};
  }

  function buildSimulation(scenario: any) {
    const config = scenarioConfig(scenario);
    const hose = findHose(config);
    const tank = findTank(config);
    const tankVolume = Number(tank?.volume_liters || 1250);
    const tankCount = clampTankCount(config?.tank_count ?? 1);
    const totalTankVolume = tankVolume * tankCount;
    const structuralLimit = Number(tank?.structural_limit_mbar || 35);
    const hoseLoss = Number(config?.hose_loss_factor ?? hose?.loss_factor ?? 0.8);
    const targetPressure = Number(config?.target_pressure_mbar || 6.5);
    const secondaryStart = Number(config?.secondary_start_pressure_mbar || 50);
    const oilFlow = Number(config?.oil_flow_l_min || 2);
    const oilDelay = Number(config?.oil_delay_seconds || 0);
    const maxCycle = Number(config?.max_cycle_seconds || 900);
    const primaryHealth = Number(config?.primary_pump_health || 1);
    const secondaryHealth = Number(config?.secondary_pump_health || 1);
    const pumpWear = config?.simulate_pump_wear ? 18 : 0;
    const timeoutRisk = config?.simulate_timeout ? 14 : 0;
    const hoseRisk = hoseLoss * 13;
    const oilRisk = Math.max(0, 2 - oilFlow) * 18;
    const delayRisk = oilDelay * 0.2;
    const pumpRisk = (1 - primaryHealth) * 34 + (1 - secondaryHealth) * 28 + pumpWear;
    const failureRisk = (config?.simulate_hose_leak ? 22 : 0) + (config?.simulate_sensor_failure ? 18 : 0) + timeoutRisk;
    const multiTankRisk = (tankCount - 1) * 5;
    const risk = Math.max(4, Math.min(98, 16 + hoseRisk + oilRisk + delayRisk + pumpRisk + failureRisk + multiTankRisk));
    const estimatedTime = Math.round(Math.min(maxCycle, (totalTankVolume / 640) * 225 + hoseLoss * 44 + oilDelay * 1.7 + pumpRisk * 3 + timeoutRisk * 5));
    const finalPressure = Math.max(targetPressure, targetPressure + hoseLoss * 0.7 + oilRisk * 0.08 + (config?.simulate_hose_leak ? 8 : 0));
    const safetyMargin = structuralLimit - finalPressure;
    const status = risk >= 82 || safetyMargin < 0 ? "critical" : risk >= 65 ? "warning" : "success";
    const diagnosis = status === "success"
      ? "Simulação aprovada com margem operacional aceitável."
      : status === "warning"
        ? "Simulação aprovada com restrição técnica."
        : "Simulação reprovada por risco operacional elevado.";
    const recommendation = status === "success"
      ? "Manter parâmetros e registrar o cenário como referência."
      : status === "warning"
        ? "Revisar mangueira, óleo, sensores e saúde das bombas antes da execução."
        : "Bloquear execução e revisar parâmetros críticos antes de liberar.";

    const timeline = Array.from({ length: 22 }).map((_, index) => {
      const step = index / 21;
      const expected = Math.max(finalPressure, 1013 * Math.exp(-step * 5.4) + targetPressure);
      const simulated = expected + hoseLoss * step * 3 + (config?.simulate_hose_leak ? step * 12 : 0);
      return {
        second: Math.round(step * estimatedTime),
        expected_pressure_mbar: expected,
        real_pressure_mbar: simulated,
        pressure_mbar: simulated,
        effective_pressure_mbar: finalPressure + risk * step * 0.18,
        collapse_risk_pct: Math.round(risk * step),
      };
    });

    const alerts = [
      risk >= 82 ? ["Risco estrutural elevado", "Crítica", "Margem estrutural reduzida", "Bloquear e revisar configuração."] : null,
      risk >= 65 && risk < 82 ? ["Tendência de atenção", "Atenção", "Perda, óleo ou bomba fora da faixa ideal", "Revisar antes de liberar operação."] : null,
      config?.simulate_sensor_failure ? ["Leitura de sensor instável", "Crítica", "Falha simulada de sensor", "Validar sensor e redundância."] : null,
      config?.simulate_hose_leak ? ["Perda na mangueira", "Atenção", "Vazamento simulado", "Inspecionar vedação e conexão."] : null,
    ].filter(Boolean) as any[];

    return {
      id: `SIM-${Date.now().toString(36).toUpperCase()}`,
      created_at: new Date().toISOString(),
      scenario: scenario?.name || config.name || "Cenário manual",
      description: scenario?.description || config.description || "",
      status,
      diagnosis,
      recommendation,
      config,
      metrics: {
        estimated_time_seconds: estimatedTime,
        final_real_pressure_mbar: finalPressure,
        max_collapse_risk_pct: risk,
        safety_margin_mbar: safetyMargin,
        oil_flow_l_min: oilFlow,
        hose_loss_factor: hoseLoss,
      tank_count: tankCount,
      },
      timeline,
      alerts,
      tank,
      hose,
    };
  }

  function persistCustom(next: any[]) {
    setCustomScenarios(next);
    saveLocal("tsea.gemeo10.customScenarios", next);
  }

  function persistResult(next: any) {
    const nextHistory = [next, ...history].slice(0, 80);
    setResult(next);
    setHistory(nextHistory);
    saveLocal("tsea.gemeo10.lastResult", next);
    saveLocal("tsea.gemeo10.history", nextHistory);
  }

  function runScenario(scenario: any) {
    setSelectedScenario(scenario);
    const next = buildSimulation(scenario);
    persistResult(next);
    setTab("simulation");
  }

  function saveScenario(simulate = false) {
    const scenario = {
      id: scenarioForm.id || `CUSTOM-${Date.now().toString(36).toUpperCase()}`,
      name: scenarioForm.name || "Cenário personalizado",
      description: scenarioForm.description || "Cenário criado pelo usuário.",
      category: scenarioForm.category || "Personalizado",
      expected_risk_level: scenarioForm.expected_risk_level || "Operacional",
      status: "Disponível",
      last_run: "",
      config: { ...scenarioForm },
    };
    const next = [scenario, ...customScenarios.filter((item) => item.id !== scenario.id)];
    persistCustom(next);
    saveLocal("tsea.gemeo10.form", scenarioForm);
    setModalMode(null);
    setCreateStep(1);
    setSelectedScenario(scenario);
    if (simulate) runScenario(scenario);
  }

  function copyScenario(scenario: any) {
    const copy = {
      ...scenario,
      id: `CUSTOM-${Date.now().toString(36).toUpperCase()}`,
      name: `${scenario.name || "Cenário"} - cópia`,
      status: "Disponível",
      last_run: "",
      config: { ...scenarioConfig(scenario), name: `${scenario.name || "Cenário"} - cópia` },
    };
    persistCustom([copy, ...customScenarios]);
  }

  function editScenario(scenario: any) {
    const editableId = String(scenario.id || "").startsWith("base-") ? "" : scenario.id;
    setScenarioForm({ ...DEFAULT_SCENARIO_FORM, ...scenarioConfig(scenario), id: editableId, name: scenario.name, description: scenario.description, category: scenario.category || scenario.tag, expected_risk_level: scenario.expected_risk_level });
    setSelectedScenario(scenario);
    setModalMode("edit");
    setCreateStep(1);
  }

  function downloadScenarioDocument(scenario: any) {
    const html = buildPrintableScenario(scenario);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${String(scenario?.name || "cenario").replace(/[^\w-]+/g, "_")}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function openScenario(scenario: any) {
    setSelectedScenario(scenario);
    setModalMode("view");
  }

  function renderScenarioCard(scenario: any) {
    const lastRun = history.find((item: any) => item.scenario === scenario.name)?.created_at || scenario.last_run;
    return (
      <article className="twinScenarioProCard" key={scenario.id}>
        <div className="twinScenarioCardHeader">
          <div>
            <strong>{scenario.name}</strong>
            <span>{scenario.description || "--"}</span>
          </div>
          <Badge value={riskTone(scenario.expected_risk_level)} />
        </div>
        <div className="twinScenarioCardGrid">
          <MiniField label="Categoria" value={scenario.category || scenario.tag || "Base"} />
          <MiniField label="Risco esperado" value={scenario.expected_risk_level || "--"} />
          <MiniField label="Status" value={scenario.status || "Disponível"} />
          <MiniField label="Última execução" value={lastRun ? new Date(lastRun).toLocaleString("pt-BR") : "--"} />
        </div>
        <div className="twinScenarioActions">
          <button onClick={() => runScenario(scenario)}>Simular</button>
          <button className="secondary" onClick={() => openScenario(scenario)}>Ver</button>
        </div>
      </article>
    );
  }

  function renderSimulationVisual(target: any) {
    const config = scenarioConfig(target || selectedScenario || {});
    const tank = target?.tank || findTank(config);
    const hose = target?.hose || findHose(config);
    const risk = Number(target?.metrics?.max_collapse_risk_pct || 0);
    const pressure = Number(target?.metrics?.final_real_pressure_mbar || config.target_pressure_mbar || 0);
    const expected = Number(config.target_pressure_mbar || pressure || 0);
    const oil = Number(config.estimated_oil_volume_liters || target?.metrics?.oil_flow_l_min || config.oil_flow_l_min || 0);
    const status = statusFromRisk(risk);
    const gasHeight = Math.max(16, Math.min(70, 74 - risk * 0.22));
    const pressureHeight = Math.max(8, Math.min(66, risk || 18));
    const oilHeight = Math.max(5, Math.min(40, oil * 5));
    const primaryRunning = Boolean(target);
    const secondaryRunning = Boolean(target && pressure <= Number(config.secondary_start_pressure_mbar || 50));

    return (
      <Section title="Visual operacional da simulação" subtitle="Representação visual dos tanques e bombas considerados no cenário simulado.">
        <div className="dashboardWorkArea twinSimulationVisual">
          <div className="dashboardTankList">
            <article className={`dashboardTankCard ${status}`}>
              <div className="dashboardTankVisual">
                <div className="industrialTankShell" aria-hidden="true">
                  <div className="tankFill gas" style={{ height: `${gasHeight}%` }} />
                  <div className="tankFill pressure" style={{ height: `${pressureHeight}%` }} />
                  <div className="tankFill oil" style={{ height: `${oilHeight}%` }} />
                </div>
                <div className="dashboardTankLegend">
                  <span><i className="gasDot" />Gás</span>
                  <span><i className="pressureDot" />Pressão</span>
                  <span><i className="oilDot" />Óleo</span>
                </div>
              </div>

              <div className="dashboardTankInfo">
                <div className="dashboardTankHeader">
                  <div>
                    <strong>{tank?.code || config.tank_type || "Tanque simulado"}</strong>
                    <span>{tank?.type || "Cenário do Gêmeo Digital"}</span>
                  </div>
                  <Badge value={status} />
                </div>

                <div className="dashboardReadings">
                  <div><span>Pressão atual</span><b>{fmt(pressure, "mbar")}</b></div>
                  <div><span>Pressão alvo</span><b>{fmt(expected, "mbar")}</b></div>
                  <div><span>Volume de óleo</span><b>{fmt(oil, "L")}</b></div>
                  <div><span>Risco estrutural</span><b>{fmt(risk, "%")}</b></div>
                </div>

                <div className="dashboardTankFooter">
                  <div><span>Mangueira vinculada</span><b>{hose?.code || config.hose_id || "--"}</b></div>
                  <div><span>Sinal operacional</span><b><i className={`signalDot ${status === "success" ? "ok" : status === "warning" ? "warn" : "bad"}`} />{statusText(status)}</b></div>
                  <div><span>Estado do cenário</span><b>{target ? "Simulado" : "Aguardando simulação"}</b></div>
                </div>
              </div>
            </article>
          </div>

          <aside className="dashboardSide">
            <article className="pumpCard">
              <div className="pumpGraphic" aria-hidden="true">
                <div className="pumpMotor">B1</div>
                <div className="pumpBody" />
                <div className="pumpBase" />
              </div>
              <div className="pumpInfo">
                <div className="pumpHeader">
                  <strong>Bomba Primária</strong>
                  <Badge value={primaryRunning ? "success" : "neutral"} />
                </div>
                <span>Leybold SOGEVAC SV 630 B</span>
                <div className="pumpReadings">
                  <div><span>Estado</span><b>{primaryRunning ? "Ligada" : "Em espera"}</b></div>
                  <div><span>Desempenho</span><b>{fmt((config.primary_pump_health ?? 1) * 100, "%")}</b></div>
                  <div><span>Conexão</span><b>{primaryRunning ? "Conectada" : "Em espera"}</b></div>
                </div>
              </div>
            </article>

            <article className="pumpCard">
              <div className="pumpGraphic" aria-hidden="true">
                <div className="pumpMotor">B2</div>
                <div className="pumpBody" />
                <div className="pumpBase" />
              </div>
              <div className="pumpInfo">
                <div className="pumpHeader">
                  <strong>Bomba Secundária / Roots</strong>
                  <Badge value={secondaryRunning ? "success" : "warning"} />
                </div>
                <span>Leybold RUVAC WSU 2001</span>
                <div className="pumpReadings">
                  <div><span>Estado</span><b>{secondaryRunning ? "Ligada" : "Bloqueada"}</b></div>
                  <div><span>Desempenho</span><b>{fmt((config.secondary_pump_health ?? 1) * 100, "%")}</b></div>
                  <div><span>Conexão</span><b>{secondaryRunning ? "Conectada" : "Em espera"}</b></div>
                </div>
              </div>
            </article>

            <article className="sensorOilCard">
              <div className="sideCardHeader">
                <div>
                  <strong>Sensores e Óleo</strong>
                  <span>Condições consideradas na simulação</span>
                </div>
                <Badge value={target ? "success" : "neutral"} />
              </div>
              <div className="sensorOilGroup">
                <h3>Sensores</h3>
                <div className="sideReadings">
                  <div><span>Sensor de pressão</span><b>SP-{tank?.code || "SIM"}</b></div>
                  <div><span>Status do sensor</span><b>{config.simulate_sensor_failure ? "Falha simulada" : "Simulado"}</b></div>
                  <div><span>Última leitura</span><b>{fmt(pressure, "mbar")}</b></div>
                  <div><span>Comunicação</span><b>Simulado</b></div>
                </div>
              </div>
              <div className="sensorOilGroup">
                <h3>Óleo</h3>
                <div className="sideReadings">
                  <div><span>Vazão de óleo</span><b>{fmt(config.oil_flow_l_min, "L/min")}</b></div>
                  <div><span>Volume estimado</span><b>{fmt(oil, "L")}</b></div>
                  <div><span>Atraso do óleo</span><b>{fmt(config.oil_delay_seconds, "s")}</b></div>
                  <div><span>Status</span><b>{Number(config.oil_flow_l_min || 0) > 0 ? "Ativo" : "Aguardando"}</b></div>
                </div>
              </div>
            </article>
          </aside>
        </div>
      </Section>
    );
  }

  function renderScenarioModal() {
    if (!modalMode) return null;
    const scenario = selectedScenario || scenarioForm;

    return (
      <div className="operationModalOverlay" role="dialog" aria-modal="true">
        <div className="operationModal twinScenarioModal">
          <div className="operationModalHeader">
            <div>
              <strong>{modalMode === "view" ? "Dados do cenário" : modalMode === "edit" ? "Editar cenário" : "Criar cenário"}</strong>
              <span>Especificações e parâmetros para simulação do Gêmeo Digital.</span>
            </div>
            <button className="secondary" onClick={() => setModalMode(null)}>Fechar</button>
          </div>

          {modalMode === "view" && (
            <>
              <Table columns={["Campo", "Valor"]} rows={scenarioRows(scenario)} />
              <div className="modalActions">
                <button onClick={() => runScenario(scenario)}>Simular</button>
                <button className="secondary" onClick={() => copyScenario(scenario)}>Fazer cópia</button>
                <button className="secondary" onClick={() => editScenario(scenario)}>Editar</button>
                <button className="secondary" onClick={() => downloadScenarioDocument(scenario)}>Baixar PDF</button>
                <button className="secondary" onClick={() => setModalMode(null)}>Fechar</button>
              </div>
            </>
          )}

          {(modalMode === "create" || modalMode === "edit") && renderScenarioWizard()}
        </div>
      </div>
    );
  }

  function renderScenarioWizard() {
    const steps = ["Identificação", "Processo", "Pressão", "Óleo", "Condições", "Revisar"];

    return (
      <div className="operationWizard">
        <div className="operationSteps">
          {steps.map((label, index) => (
            <button key={label} className={createStep === index + 1 ? "" : "secondary"} onClick={() => setCreateStep(index + 1)}>
              {index + 1}. {label}
            </button>
          ))}
        </div>

        {createStep === 1 && (
          <div className="operationStepPanel">
            <h3>Identificação do cenário</h3>
            <p>Defina nome, categoria, risco esperado e observações do cenário.</p>
            <div className="formGrid">
              <Field label="Nome do cenário"><input value={scenarioForm.name || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, name: e.target.value })} /></Field>
              <Field label="Descrição"><input value={scenarioForm.description || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, description: e.target.value })} /></Field>
              <Field label="Categoria/tipo"><input value={scenarioForm.category || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, category: e.target.value })} /></Field>
              <Field label="Nível de risco esperado"><select value={scenarioForm.expected_risk_level || "Operacional"} onChange={(e) => setScenarioForm({ ...scenarioForm, expected_risk_level: e.target.value })}><option>Operacional</option><option>Atenção</option><option>Crítico</option></select></Field>
              <Field label="Observações"><input value={scenarioForm.notes || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, notes: e.target.value })} /></Field>
            </div>
          </div>
        )}

        {createStep === 2 && (
          <div className="operationStepPanel">
            <h3>Processo</h3>
            <p>Selecione tanque, mangueira, receita de referência e responsável.</p>
            <div className="formGrid">
              <Field label="Tanque"><select value={scenarioForm.tank_id || allTanks?.[0]?.id || 1} onChange={(e) => setScenarioForm({ ...scenarioForm, tank_id: e.target.value })}>{(allTanks || []).map((tank: any, index: number) => <option key={tank.id || index} value={tank.id || index + 1}>{tank.code || `TQ-${index + 1}`}</option>)}</select></Field>
              <Field label="Tipo de tanque"><input value={scenarioForm.tank_type || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, tank_type: e.target.value })} /></Field>

<Field label="Quantidade de tanques (1 a 3)">
  <input
    type="number"
    min={1}
    max={3}
    step={1}
    value={clampTankCount(scenarioForm.tank_count ?? 1)}
    onChange={(e) => setScenarioForm({ ...scenarioForm, tank_count: clampTankCount(e.target.value) })}
  />
</Field>

              <Field label="Mangueira"><select value={scenarioForm.hose_id || allHoses?.[0]?.id || 1} onChange={(e) => setScenarioForm({ ...scenarioForm, hose_id: e.target.value })}>{(allHoses || []).map((hose: any, index: number) => <option key={hose.id || index} value={hose.id || index + 1}>{hose.code || `MG-${index + 1}`}</option>)}</select></Field>
              <Field label="Receita"><input value={scenarioForm.recipe || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, recipe: e.target.value })} /></Field>
              <Field label="Operador/responsável"><input value={scenarioForm.operator || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, operator: e.target.value })} /></Field>
            </div>
          </div>
        )}

        {createStep === 3 && (
          <div className="operationStepPanel">
            <h3>Pressão</h3>
            <p>Configure pressão inicial, alvo, Roots e margem de erro.</p>
            <div className="formGrid">
              <Field label="Pressão inicial"><input type="number" value={scenarioForm.initial_pressure_mbar || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, initial_pressure_mbar: Number(e.target.value) })} /></Field>
              <Field label="Pressão alvo"><input type="number" value={scenarioForm.target_pressure_mbar || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, target_pressure_mbar: Number(e.target.value) })} /></Field>
              <Field label="Pressão para acionar Roots"><input type="number" value={scenarioForm.secondary_start_pressure_mbar || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, secondary_start_pressure_mbar: Number(e.target.value) })} /></Field>
              <Field label="Margem de erro"><input type="number" value={scenarioForm.allowed_error_mbar || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, allowed_error_mbar: Number(e.target.value) })} /></Field>
            </div>
          </div>
        )}

        {createStep === 4 && (
          <div className="operationStepPanel">
            <h3>Óleo</h3>
            <p>Informe vazão, volume estimado e atraso do óleo.</p>
            <div className="formGrid">
              <Field label="Vazão de óleo"><input type="number" value={scenarioForm.oil_flow_l_min || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, oil_flow_l_min: Number(e.target.value) })} /></Field>
              <Field label="Volume estimado"><input type="number" value={scenarioForm.estimated_oil_volume_liters || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, estimated_oil_volume_liters: Number(e.target.value) })} /></Field>
              <Field label="Atraso do óleo"><input type="number" value={scenarioForm.oil_delay_seconds || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, oil_delay_seconds: Number(e.target.value) })} /></Field>
            </div>
          </div>
        )}

        {createStep === 5 && (
          <div className="operationStepPanel">
            <h3>Condições simuladas</h3>
            <p>Defina perdas, falhas simuladas e degradações para o teste.</p>
            <div className="formGrid">
              <Field label="Saúde da bomba primária"><input type="number" step="0.01" value={scenarioForm.primary_pump_health || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, primary_pump_health: Number(e.target.value) })} /></Field>
              <Field label="Saúde da bomba secundária"><input type="number" step="0.01" value={scenarioForm.secondary_pump_health || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, secondary_pump_health: Number(e.target.value) })} /></Field>
              <Field label="Perda na mangueira"><input type="number" step="0.01" value={scenarioForm.hose_loss_factor || ""} onChange={(e) => setScenarioForm({ ...scenarioForm, hose_loss_factor: Number(e.target.value) })} /></Field>
            </div>
            <div className="checkGrid">
              <label><input type="checkbox" checked={Boolean(scenarioForm.simulate_sensor_failure)} onChange={(e) => setScenarioForm({ ...scenarioForm, simulate_sensor_failure: e.target.checked })} /> Falha de sensor simulada</label>
              <label><input type="checkbox" checked={Boolean(scenarioForm.simulate_hose_leak)} onChange={(e) => setScenarioForm({ ...scenarioForm, simulate_hose_leak: e.target.checked })} /> Vazamento simulado</label>
              <label><input type="checkbox" checked={Boolean(scenarioForm.simulate_timeout)} onChange={(e) => setScenarioForm({ ...scenarioForm, simulate_timeout: e.target.checked })} /> Ciclo fora do tempo</label>
              <label><input type="checkbox" checked={Boolean(scenarioForm.simulate_pump_wear)} onChange={(e) => setScenarioForm({ ...scenarioForm, simulate_pump_wear: e.target.checked })} /> Desgaste de bomba</label>
            </div>
          </div>
        )}

        {createStep === 6 && (
          <div className="operationStepPanel">
            <h3>Revisar e salvar</h3>
            <p>Confira os dados antes de salvar ou simular.</p>
            <div className="operationReviewGrid">
              {scenarioRows({ ...scenarioForm, config: scenarioForm }).slice(0, 12).map(([key, value]) => <MiniField key={key} label={String(key)} value={value} />)}
            </div>
          </div>
        )}

        <div className="modalActions">
          <button className="secondary" onClick={() => setCreateStep(Math.max(1, createStep - 1))}>Voltar</button>
          <button onClick={() => setCreateStep(Math.min(6, createStep + 1))}>Próximo</button>
          <button onClick={() => saveScenario(false)}>Salvar cenário</button>
          <button onClick={() => saveScenario(true)}>Salvar e simular</button>
          <button className="secondary" onClick={() => setModalMode(null)}>Cancelar</button>
        </div>
      </div>
    );
  }

  function renderScenarios() {
    return (
      <Section title="Cenários de simulação" subtitle="Escolha, visualize ou crie cenários para análise do Gêmeo Digital." action={<button onClick={() => { setScenarioForm(DEFAULT_SCENARIO_FORM); setCreateStep(1); setModalMode("create"); }}>Criar cenário</button>}>
        <div className="twinScenarioProGrid">
          {allScenarios.map(renderScenarioCard)}
        </div>
      </Section>
    );
  }

  function renderSimulation() { const target = result; const tankCount = clampTankCount(scenarioConfig(target)?.tank_count ?? target?.metrics?.tank_count ?? scenarioConfig(selectedScenario)?.tank_count ?? scenarioForm?.tank_count ?? 1); const componentRows = [
    ["Quantidade de tanques", `${tankCount}`, "Escopo da simulação", "Configurado", `${tankCount} ${tankCount === 1 ? "tanque" : "tanques"}`, "Define quantos tanques participam do cenário."],
      ["Bomba primária", "Leybold SOGEVAC SV 630 B", "Evacuação inicial", "Operacional", "640 m³/h", "Base de cálculo do ciclo."],
      ["Bomba Roots", "Leybold RUVAC WSU 2001", "Reforço do vácuo", target?.metrics?.final_real_pressure_mbar <= scenarioConfig(target)?.secondary_start_pressure_mbar ? "Liberada" : "Condicionada", fmt(scenarioConfig(target)?.secondary_start_pressure_mbar, "mbar"), "Entrada depende da faixa segura."],
      ["Mangueira", target?.hose?.code || scenarioConfig(target)?.hose_id || "--", "Perda de carga", Number(target?.metrics?.hose_loss_factor || 0) > 1 ? "Atenção" : "Operacional", fmt(target?.metrics?.hose_loss_factor), "Impacta tempo e estabilidade."],
      ["Tanque", target?.tank?.code || scenarioConfig(target)?.tank_type || "--", "Volume e margem", statusText(target?.status), fmt(target?.metrics?.safety_margin_mbar, "mbar"), "Margem estrutural estimada."],
    ];
    const actionRows = [
    ["Escopo do cenário", "Quantidade de tanques", `${tankCount}`, "Configurado", "Número de tanques usado na simulação."],
      ["Preparação", fmt(scenarioConfig(target)?.target_pressure_mbar, "mbar"), target?.scenario || "--", target ? "Concluída" : "Aguardando", "Parâmetros do cenário carregados."],
      ["Evacuação inicial", "Pressão decrescente", fmt(target?.metrics?.final_real_pressure_mbar, "mbar"), target ? "Simulada" : "Aguardando", "Cálculo baseado em tanque, bomba e perda."],
      ["Acionamento Roots", fmt(scenarioConfig(target)?.secondary_start_pressure_mbar, "mbar"), fmt(target?.metrics?.final_real_pressure_mbar, "mbar"), target ? "Avaliada" : "Aguardando", "Verifica entrada em faixa segura."],
      ["Injeção de óleo", fmt(scenarioConfig(target)?.oil_flow_l_min, "L/min"), fmt(target?.metrics?.oil_flow_l_min, "L/min"), target ? "Simulada" : "Aguardando", "Afeta vedação e estabilidade."],
    ];
    const monitorRows = [
    ["Quantidade de tanques", `${tankCount}`, `${tankCount}`, "un.", "Configurado"],
      ["Pressão alvo", fmt(scenarioConfig(target)?.target_pressure_mbar, "mbar"), fmt(target?.metrics?.final_real_pressure_mbar, "mbar"), "mbar", target ? statusText(target.status) : "--"],
      ["Tempo de ciclo", fmt(scenarioConfig(target)?.max_cycle_seconds, "s"), fmt(target?.metrics?.estimated_time_seconds, "s"), "s", "Calculado"],
      ["Óleo", fmt(scenarioConfig(target)?.oil_flow_l_min, "L/min"), fmt(target?.metrics?.oil_flow_l_min, "L/min"), "L/min", "Simulado"],
      ["Risco", scenarioConfig(target)?.expected_risk_level || "--", fmt(target?.metrics?.max_collapse_risk_pct, "%"), "%", target ? statusText(target.status) : "--"],
    ];
    const alertRows = target?.alerts?.length ? target.alerts : [["Sem alerta ativo", "Operacional", "Parâmetros dentro da faixa", "Registrar simulação."]];

    return (
      <div className="twinTabStack">
        <Section title="Simulação selecionada" subtitle="Análise técnica do cenário executado.">
          {target ? (
            <div className="twinSimulationSummary">
              <Metric label="Cenário" value={target.scenario} detail={target.description || "Simulação executada"} />
              <Metric label="Status" value={<Badge value={target.status} />} detail={statusText(target.status)} />
              <Metric label="Tanque" value={target?.tank?.code || scenarioConfig(target)?.tank_type || "--"} detail="Tanque usado" />
              <Metric label="Mangueira" value={target?.hose?.code || scenarioConfig(target)?.hose_id || "--"} detail="Mangueira usada" />
            </div>
          ) : (
            <Empty text="Nenhuma simulação executada ainda. Escolha um cenário e execute uma simulação." />
          )}
        </Section>

        <Section title="Componentes simulados" subtitle="Componentes avaliados pelo cenário.">
          <Table columns={["Componente", "Identificação", "Função", "Estado", "Leitura/valor", "Observação"]} rows={componentRows} />
        </Section>
        <Section title="Etapas simuladas" subtitle="Evolução prevista do ciclo e situação por etapa.">
          <Table columns={["Etapa", "Valor esperado", "Valor simulado", "Situação", "Observação"]} rows={actionRows} />
        </Section>
        <Section title="Monitoramento de pressão e óleo" subtitle="Parâmetros principais calculados pela simulação.">
          <Table columns={["Parâmetro", "Valor esperado", "Valor simulado", "Unidade", "Situação"]} rows={monitorRows} />
        </Section>
        <Section title="Alertas gerados" subtitle="Alertas técnicos derivados do cenário executado.">
          <Table columns={["Alerta", "Severidade", "Causa provável", "Ação sugerida"]} rows={alertRows} />
        </Section>
        {<TankQuantityStrip count={tankCount} label="Tanques configurados na simulação" />}
      {renderSimulationVisual(target)}
      </div>
    );
  }

  function renderResult() {
    if (!result) return <Empty text="Nenhuma simulação executada ainda. Escolha um cenário e execute uma simulação." />;

    return (
      <div className="twinTabStack">
        <div className="metricsGrid dashboardMetrics">
          <Metric label="Status final" value={<Badge value={result.status} />} detail={statusText(result.status)} />
          <Metric label="Risco estimado" value={fmt(result.metrics?.max_collapse_risk_pct, "%")} detail="Avaliação estrutural" />
          <Metric label="Pressão final" value={fmt(result.metrics?.final_real_pressure_mbar, "mbar")} detail="Simulada" />
          <Metric label="Tempo estimado" value={fmt(result.metrics?.estimated_time_seconds, "s")} detail="Duração prevista" />
        </div>
        <div className="diagnosticBox">
          <strong>{result.diagnosis}</strong>
          <span>{result.recommendation}</span>
        </div>
        <Chart points={result.timeline || []} />
      </div>
    );
  }

  function renderHistory() {
    return (
      <Section title="Histórico de simulações" subtitle="Registros locais das simulações executadas neste navegador.">
        {history.length ? (
          <Table
            columns={["Data/hora", "Cenário", "Tanque", "Pressão final", "Risco", "Status", "Recomendação", "Detalhes"]}
            rows={history.map((item: any) => [
              new Date(item.created_at).toLocaleString("pt-BR"),
              item.scenario,
              item?.tank?.code || scenarioConfig(item)?.tank_type || "--",
              fmt(item.metrics?.final_real_pressure_mbar, "mbar"),
              fmt(item.metrics?.max_collapse_risk_pct, "%"),
              <Badge value={item.status} />,
              item.recommendation || "--",
              <button className="secondary" onClick={() => setHistoryDetail(item)}>Ver detalhes</button>,
            ])}
          />
        ) : (
          <Empty text="Nenhuma simulação registrada ainda." />
        )}

        {historyDetail && (
          <div className="operationModalOverlay" role="dialog" aria-modal="true">
            <div className="operationModal twinScenarioModal">
              <div className="operationModalHeader">
                <div>
                  <strong>{historyDetail.scenario}</strong>
                  <span>{historyDetail.diagnosis}</span>
                </div>
                <button className="secondary" onClick={() => setHistoryDetail(null)}>Fechar</button>
              </div>
              <Table columns={["Campo", "Valor"]} rows={scenarioRows(historyDetail)} />
              <Table
                columns={["Alerta", "Severidade", "Causa provável", "Ação sugerida"]}
                rows={historyDetail.alerts?.length ? historyDetail.alerts : [["Sem alerta ativo", "Operacional", "Parâmetros dentro da faixa", "Registrar simulação."]]}
              />
              <Chart points={historyDetail.timeline || []} />
            </div>
          </div>
        )}
      </Section>
    );
  }

  function renderTechnical() {
    return (
      <div className="twinTechnicalGrid">
        <Section title="Bombas" subtitle="Referências técnicas usadas no Gêmeo Digital.">
          <Table
            columns={["Sistema", "Modelo", "Dado técnico", "Função"]}
            rows={[
              ["Bomba primária", "Leybold SOGEVAC SV 630 B", "640 m³/h em 50 Hz · <= 0,08 mbar · 20 L óleo · 15 kW", "Evacuação inicial e sustentação do vácuo."],
              ["Bomba secundária", "Leybold RUVAC WSU 2001", "2050 m³/h em 50 Hz · < 4 x 10^-2 mbar · diferencial máximo 50 mbar", "Reforçar o vácuo após atingir faixa segura."],
            ]}
          />
        </Section>
        <Section title="Unidades" subtitle="Unidades exibidas nas telas e relatórios.">
          <Table
            columns={["Grandeza", "Unidade"]}
            rows={[
              ["Pressão", "mbar"],
              ["Tempo", "segundos"],
              ["Volume", "litros"],
              ["Vazão", "L/min"],
              ["Risco", "%"],
              ["Comprimento de mangueira", "metros"],
            ]}
          />
        </Section>
        <Section title="Margem e classificação" subtitle="Critério simples para interpretar desvios.">
          <Table
            columns={["Item", "Descrição"]}
            rows={[
              ["Fórmula", "desvio (%) = |valor medido - valor esperado| / valor esperado x 100"],
              ["Operacional", "Dentro da margem aceitável."],
              ["Atenção", "Desvio intermediário."],
              ["Crítico", "Desvio alto."],
            ]}
          />
        </Section>
      </div>
    );
  }

  
  /* TSEA_PAGE_SUBMENU_DRAWER_START:renderTwinSubmenuDrawer */
  function renderTwinSubmenuDrawer() {
    const submenuItems: { key: any; label: string; description: string }[] = [
      { key: "scenarios" as any, label: "Cenários", description: "Criar e escolher cenários" },
      { key: "simulation" as any, label: "Simulação", description: "Visual e componentes simulados" },
      { key: "result" as any, label: "Resultado", description: "Diagnóstico da simulação" },
      { key: "history" as any, label: "Histórico", description: "Execuções registradas" },
      { key: "technical" as any, label: "Dados Técnicos", description: "Parâmetros e fórmulas" }
    ];

    return (
      <div className="page-subnav-shell">
        <button
          className="page-subnav-toggle"
          type="button"
          aria-label="Abrir submenus de Gêmeo Digital"
          title="Submenus"
          onClick={() => setTwinSubmenuOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>

        {twinSubmenuOpen && (
          <div
            className="page-subnav-overlay"
            role="presentation"
            onClick={() => setTwinSubmenuOpen(false)}
          />
        )}

        <aside className={`page-subnav-drawer ${twinSubmenuOpen ? "open" : ""}`}>
          <div className="page-subnav-drawer-header">
            <div>
              <span>Gêmeo Digital</span>
              <strong>Navegação rápida</strong>
            </div>

            <button className="btn ghost" type="button" onClick={() => setTwinSubmenuOpen(false)}>
              Fechar
            </button>
          </div>

          <div className="page-subnav-drawer-list">
            {submenuItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={tab === item.key ? "active" : ""}
                onClick={() => {
                  setTab(item.key);
                  setTwinSubmenuOpen(false);
                }}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    );
  }
  /* TSEA_PAGE_SUBMENU_DRAWER_END:renderTwinSubmenuDrawer */

return (
    <div className="screen twinWorkspace">
      {renderTwinSubmenuDrawer()}

      {tab === "scenarios" && renderScenarios()}
      {tab === "simulation" && renderSimulation()}
      {tab === "result" && renderResult()}
      {tab === "history" && renderHistory()}
      {tab === "technical" && renderTechnical()}
      {renderScenarioModal()}
    </div>
  );
}

