import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import { Badge, Field, fmt, Metric, Section, statusLabel, Table } from "../components/ui";

type OperationAction = "start" | "pause" | "stop" | "reset" | "emergency";
type OperationTab = "ihm" | "info" | "config";
type ConfigMode = "choice" | "recipe" | "recipe-detail" | "recipe-edit" | "manual" | "review";

type OperationPageProps = {
  ComponentHealthPanel: ComponentType<any>;
  allHoses: any[];
  allRecipes: any[];
  allTanks: any[];
  control: (action: OperationAction) => void;
  operationConfig: any;
  setOp: (key: string, value: any) => void;
  setOperationConfig: (updater: any) => void;
  state: any;
  tanksState: any[];
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


function riskStatus(risk: number) {
  if (risk >= 82) return "critical";
  if (risk >= 65) return "warning";
  return "success";
}

function signalLabel(value: unknown) {
  const signal = String(value || "").toLowerCase();
  if (["green", "success", "ok", "operacional"].includes(signal)) return "Operacional";
  if (["yellow", "warning", "attention", "atenção", "atencao"].includes(signal)) return "Atenção";
  if (["red", "critical", "emergency", "falha"].includes(signal)) return "Crítico";
  return String(value || "--");
}

function signalTone(value: unknown) {
  const signal = String(value || "").toLowerCase();
  if (["green", "success", "ok", "operacional"].includes(signal)) return "ok";
  if (["yellow", "warning", "attention", "atenção", "atencao"].includes(signal)) return "warn";
  if (["red", "critical", "emergency", "falha"].includes(signal)) return "bad";
  return "neutral";
}

function processNote(risk: number, cycleStatus: unknown) {
  if (String(cycleStatus || "").toLowerCase() === "running") return "Ciclo em execução com leitura simulada.";
  if (risk >= 82) return "Risco crítico. Revisar parâmetros antes de liberar.";
  if (risk >= 65) return "Atenção operacional. Monitorar tendência.";
  return "Condição operacional dentro da faixa.";
}

function TankProcessCard({ item, index, cycleStatus }: { item: any; index: number; cycleStatus: unknown }) {
  const tank = item?.tank || {};
  const hose = item?.hose || {};
  const risk = Number(item?.collapse_risk_pct || 0);
  const pressure = Number(item?.pressure_mbar || 0);
  const expected = Number(item?.expected_pressure_mbar || 0);
  const oil = Number(item?.oil_volume_liters || 0);
  const status = riskStatus(risk);
  const gasHeight = Math.max(16, Math.min(70, 74 - risk * 0.22));
  const pressureHeight = Math.max(8, Math.min(66, risk));
  const oilHeight = Math.max(5, Math.min(40, oil * 5));

  return (
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
            <strong>{tank?.code || `Tanque ${index + 1}`}</strong>
            <span>{tank?.type || "Tanque de processo"}</span>
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
          <div><span>Mangueira vinculada</span><b>{hose?.code || "--"}</b></div>
          <div><span>Sinal operacional</span><b><i className={`signalDot ${signalTone(item?.status_light)}`} />{signalLabel(item?.status_light)}</b></div>
          <div><span>Estado do ciclo</span><b>{processNote(risk, cycleStatus)}</b></div>
        </div>
      </div>
    </article>
  );
}

function PumpCard({ title, code, model, running, blocked, performance }: { title: string; code: string; model: string; running: boolean; blocked?: boolean; performance: unknown }) {
  const stateLabel = running ? "Ligada" : blocked ? "Bloqueada" : "Desligada";
  const connection = running ? "Conectada" : blocked ? "Em espera" : "Em espera";
  const status = running ? "success" : blocked ? "warning" : "neutral";

  return (
    <article className="pumpCard">
      <div className="pumpGraphic" aria-hidden="true">
        <div className="pumpMotor">{code}</div>
        <div className="pumpBody" />
        <div className="pumpBase" />
      </div>

      <div className="pumpInfo">
        <div className="pumpHeader">
          <strong>{title}</strong>
          <Badge value={status} />
        </div>
        <span>{model}</span>
        <div className="pumpReadings">
          <div><span>Estado</span><b>{stateLabel}</b></div>
          <div><span>Desempenho</span><b>{fmt(performance, "%")}</b></div>
          <div><span>Conexão</span><b>{connection}</b></div>
        </div>
      </div>
    </article>
  );
}

function SensorsOilCard({ state, tanksState }: { state: any; tanksState: any[] }) {
  const firstTank = tanksState[0] || {};
  const avgOil = tanksState.reduce((sum: number, item: any) => sum + Number(item?.oil_volume_liters || 0), 0) / Math.max(tanksState.length, 1);
  const oilEnabled = state?.oil_injection?.enabled;
  const sensorStatus = state?.plc_comm_ok ? "Simulado" : "Aguardando";
  const communication = state?.plc_comm_ok ? "Leitura simulada normal" : "Indisponível";

  return (
    <article className="sensorOilCard">
      <div className="sideCardHeader">
        <div>
          <strong>Sensores e Óleo</strong>
          <span>Leituras consolidadas da operação</span>
        </div>
        <Badge value={oilEnabled ? "success" : "neutral"} />
      </div>

      <div className="sensorOilGroup">
        <h3>Sensores</h3>
        <div className="sideReadings">
          <div><span>Sensor de pressão</span><b>SP-{firstTank?.tank?.code || "SIM"}</b></div>
          <div><span>Status do sensor</span><b>{sensorStatus}</b></div>
          <div><span>Última leitura</span><b>{fmt(firstTank?.pressure_mbar, "mbar")}</b></div>
          <div><span>Comunicação</span><b>{communication}</b></div>
        </div>
      </div>

      <div className="sensorOilGroup">
        <h3>Óleo</h3>
        <div className="sideReadings">
          <div><span>Vazão de óleo</span><b>{fmt(state?.oil_injection?.current_flow_l_min ?? state?.oil_injection?.target_flow_l_min, "L/min")}</b></div>
          <div><span>Volume estimado</span><b>{fmt(avgOil, "L")}</b></div>
          <div><span>Atraso do óleo</span><b>Aguardando</b></div>
          <div><span>Status</span><b>{oilEnabled ? "Ativo" : "Inativo"}</b></div>
        </div>
      </div>
    </article>
  );
}

function SummaryCards({ state, avgPressure, maxRisk, operationConfig }: any) {
  return (
    <div className="metricsGrid dashboardMetrics">
      <Metric label="Estado do ciclo" value={state?.cycle?.status ? statusLabel(state.cycle.status) : "Parado"} status={state?.cycle?.status || "stopped"} />
      <Metric label="Pressão média" value={fmt(avgPressure, "mbar")} detail="Tanques monitorados" />
      <Metric label="Risco máximo" value={fmt(maxRisk, "%")} status={maxRisk >= 82 ? "critical" : maxRisk >= 65 ? "warning" : "success"} />
      <Metric label="Tempo máximo" value={fmt(operationConfig?.max_cycle_seconds, "s")} detail="Limite configurado" />
    </div>
  );
}

function RecipeDetails({ recipe }: { recipe: any }) {
  if (!recipe) return <div className="operationEmpty">Selecione uma receita para ver os detalhes.</div>;

  return (
    <div className="operationRecipeDetails">
      <div><span>Receita</span><b>{recipe.name || recipe.code || "--"}</b></div>
      <div><span>Pressão alvo</span><b>{fmt(recipe.target_pressure_mbar, "mbar")}</b></div>
      <div><span>Acionamento Roots</span><b>{fmt(recipe.roots_start_pressure_mbar, "mbar")}</b></div>
      <div><span>Tempo estimado</span><b>{fmt(recipe.max_cycle_seconds, "s")}</b></div>
      <div><span>Vazão de óleo</span><b>{fmt(recipe.min_oil_flow_l_min, "L/min")}</b></div>
      <div><span>Tanque</span><b>{recipe.tank_type || "--"}</b></div>
      <div><span>Margem de erro</span><b>{fmt(recipe.max_tank_difference_mbar ?? recipe.structural_risk_limit, recipe.max_tank_difference_mbar ? "mbar" : "%")}</b></div>
      <div><span>Observações</span><b>{recipe.notes || "Parâmetros recebidos do cadastro."}</b></div>
    </div>
  );
}

export function OperationPage({
  ComponentHealthPanel,
  allHoses,
  allRecipes,
  allTanks,
  control,
  operationConfig,
  setOp,
  setOperationConfig,
  state,
  tanksState,
}: OperationPageProps) {
  const [tab, setTab] = useState<OperationTab>("ihm");
  const [operationSubmenuOpen, setOperationSubmenuOpen] = useState(false); const [configOpen, setConfigOpen] = useState(false);
  const [configMode, setConfigMode] = useState<ConfigMode>("choice");
  const [selectedRecipeId, setSelectedRecipeId] = useState<any>(operationConfig.recipe_id || allRecipes[0]?.id || "");
  const [recipeDraft, setRecipeDraft] = useState<any>({});
  const [manualStep, setManualStep] = useState(1);

  const activeTankCount = clampTankCount(operationConfig?.tank_count ?? tanksState.length ?? 1);
  const visibleTanksState = Array.isArray(tanksState) ? tanksState.slice(0, activeTankCount) : [];
  const operationVisualTanks = visibleTanksState.length
    ? visibleTanksState
    : Array.from({ length: activeTankCount }).map((_, index) => ({
        tank: allTanks?.[index] || { code: `TQ-${index + 1}`, type: "Tanque de processo" },
        hose: allHoses?.[index] || allHoses?.[0],
        pressure_mbar: operationConfig?.target_pressure_mbar ?? 0,
        expected_pressure_mbar: operationConfig?.target_pressure_mbar ?? 0,
        oil_volume_liters: operationConfig?.estimated_oil_volume_liters ?? 0,
        collapse_risk_pct: 0,
        status_light: "green",
      }));
  const avgPressure = operationVisualTanks.reduce((sum: number, item: any) => sum + Number(item?.pressure_mbar || 0), 0) / Math.max(operationVisualTanks.length, 1);
  const maxRisk = Math.max(0, ...operationVisualTanks.map((item: any) => Number(item?.collapse_risk_pct || 0)));
  const selectedRecipe = useMemo(
    () => allRecipes.find((recipe: any) => String(recipe.id || recipe.name) === String(selectedRecipeId)) || allRecipes[0],
    [allRecipes, selectedRecipeId]
  );

  function openConfig(mode: ConfigMode = "choice") {
    setTab("config");
    setConfigMode(mode);
    setConfigOpen(true);
  }

  function closeConfig() {
    setConfigOpen(false);
    setConfigMode("choice");
    setManualStep(1);
  }

  function applyRecipe(recipe: any) {
    if (!recipe) return;
    setOperationConfig((current: any) => ({
      ...current,
      recipe_id: recipe.id || recipe.name || current.recipe_id,
      target_pressure_mbar: recipe.target_pressure_mbar ?? current.target_pressure_mbar,
      roots_start_pressure_mbar: recipe.roots_start_pressure_mbar ?? current.roots_start_pressure_mbar,
      max_cycle_seconds: recipe.max_cycle_seconds ?? current.max_cycle_seconds,
      oil_flow_l_min: recipe.min_oil_flow_l_min ?? recipe.oil_flow_l_min ?? current.oil_flow_l_min,
      tank_type: recipe.tank_type ?? current.tank_type,
      tank_count: clampTankCount(recipe.tank_count ?? current.tank_count ?? 1),
    }));
    closeConfig();
  }

  function applyRecipeDraft() {
    applyRecipe({
      ...selectedRecipe,
      ...recipeDraft,
      target_pressure_mbar: Number(recipeDraft.target_pressure_mbar ?? selectedRecipe?.target_pressure_mbar),
      roots_start_pressure_mbar: Number(recipeDraft.roots_start_pressure_mbar ?? selectedRecipe?.roots_start_pressure_mbar),
      max_cycle_seconds: Number(recipeDraft.max_cycle_seconds ?? selectedRecipe?.max_cycle_seconds),
      min_oil_flow_l_min: Number(recipeDraft.min_oil_flow_l_min ?? selectedRecipe?.min_oil_flow_l_min),
    });
  }

  function handleTab(next: OperationTab) {
    setTab(next);
    if (next === "config") openConfig("choice");
  }

  function renderIhm() {
    return (
      <>
        <SummaryCards state={state} avgPressure={avgPressure} maxRisk={maxRisk} operationConfig={operationConfig} />

        <div className="operationCommandBar">
          <button onClick={() => control("start")}>Iniciar operação</button>
          <button className="secondary" onClick={() => control("pause")}>Pausar</button>
          <button className="secondary" onClick={() => control("stop")}>Finalizar</button>
          <button className="secondary" onClick={() => control("reset")}>Resetar</button>
          <button className="danger" onClick={() => control("emergency")}>Emergência</button>
        </div>

        <div className="dashboardWorkArea operationIhmArea">
          <Section title="IHM da operação" subtitle="Tanques, pressão, óleo, risco e mangueira vinculada em tempo real.">
            <div className="dashboardTankList">
              <TankQuantityStrip count={activeTankCount} label="Tanques configurados na operação" />
        {operationVisualTanks.map((item: any, index: number) => (
                <TankProcessCard key={item?.tank?.id || index} item={item} index={index} cycleStatus={state?.cycle?.status} />
              ))}
            </div>
          </Section>

          <aside className="dashboardSide">
            <PumpCard
              title="Bomba Primária"
              code="B1"
              model={state?.primary_pump?.model || "Leybold SOGEVAC SV 630 B"}
              running={Boolean(state?.primary_pump?.running)}
              performance={state?.primary_pump?.health_pct ?? 96}
            />
            <PumpCard
              title="Bomba Secundária / Roots"
              code="B2"
              model={state?.roots_pump?.model || "Leybold RUVAC WSU 2001"}
              running={Boolean(state?.roots_pump?.running)}
              blocked={!state?.roots_pump?.running}
              performance={state?.roots_pump?.health_pct ?? (state?.roots_pump?.running ? 94 : 0)}
            />
            <SensorsOilCard state={state} tanksState={operationVisualTanks} />
          </aside>
        </div>
      </>
    );
  }

  function renderInfo() {
    const firstTank = tanksState[0] || {};
    const avgOil = operationVisualTanks.reduce((sum: number, item: any) => sum + Number(item?.oil_volume_liters || 0), 0) / Math.max(operationVisualTanks.length, 1);

    const machineRows = [
      ["B1", "Bomba primária", state?.primary_pump?.model || "Leybold SOGEVAC SV 630 B", "Evacuação inicial", state?.primary_pump?.running ? "Ligada" : "Desligada", fmt(state?.primary_pump?.health_pct ?? 96, "%"), state?.primary_pump?.running ? "Conectada" : "Em espera"],
      ["B2", "Bomba Roots", state?.roots_pump?.model || "Leybold RUVAC WSU 2001", "Reforço do vácuo", state?.roots_pump?.running ? "Ligada" : "Bloqueada", fmt(state?.roots_pump?.health_pct ?? 94, "%"), state?.roots_pump?.running ? "Conectada" : "Em espera"],
    ];

    const tankRows = operationVisualTanks.map((item: any, index: number) => [
      item?.tank?.code || `TQ-${index + 1}`,
      item?.tank?.type || "Tanque de processo",
      fmt(item?.pressure_mbar, "mbar"),
      fmt(item?.expected_pressure_mbar, "mbar"),
      fmt(item?.oil_volume_liters, "L"),
      item?.hose?.code || "--",
      `SP-${item?.tank?.code || index + 1}`,
      <Badge value={riskStatus(Number(item?.collapse_risk_pct || 0))} />,
    ]);

    const sensorRows = operationVisualTanks.map((item: any, index: number) => [
      `SP-${item?.tank?.code || index + 1}`,
      "Pressão",
      fmt(item?.pressure_mbar, "mbar"),
      "mbar",
      state?.plc_comm_ok ? "Leitura simulada normal" : "Indisponível",
      "Atual",
      <Badge value={state?.plc_comm_ok ? "success" : "warning"} />,
    ]);

    const oilRows = [
      ["Vazão de óleo", fmt(state?.oil_injection?.current_flow_l_min ?? state?.oil_injection?.target_flow_l_min), "L/min", state?.oil_injection?.enabled ? "Ativo" : "Inativo", "Referência da lubrificação do ciclo."],
      ["Volume estimado", fmt(avgOil), "L", avgOil > 0 ? "Operacional" : "Aguardando", "Média calculada pelos tanques monitorados."],
      ["Atraso do óleo", "--", "s", "Aguardando", "Sem atraso informado nos dados atuais."],
      ["Estado da lubrificação", state?.oil_injection?.enabled ? "Habilitada" : "Desabilitada", "--", state?.oil_injection?.enabled ? "Operacional" : "Em espera", "Condição atual da injeção de óleo."],
      ["Condição de vedação", maxRisk >= 82 ? "Crítica" : maxRisk >= 65 ? "Atenção" : "Normal", "--", maxRisk >= 82 ? "Crítico" : maxRisk >= 65 ? "Atenção" : "Operacional", "Derivada do risco estrutural máximo."],
    ];

    const traceRows = [
    ["Quantidade de tanques", "Operação", activeTankCount, "tanques", "Configurado", "Define quantos tanques participam do ciclo."],
      ["Preparação", "Receita / operador", fmt(operationConfig?.target_pressure_mbar, "mbar"), state?.cycle?.status || "Parado", "Configurado", "Parâmetros carregados para a operação."],
      ["Evacuação inicial", "Bomba primária", "Pressão decrescente", fmt(avgPressure, "mbar"), state?.primary_pump?.running ? "Em execução" : "Em espera", "Bomba primária sustenta a redução inicial."],
      ["Acionamento da bomba Roots", "Bomba secundária", fmt(operationConfig?.roots_start_pressure_mbar, "mbar"), fmt(avgPressure, "mbar"), state?.roots_pump?.running ? "Liberado" : "Bloqueado", "Liberação depende da faixa de pressão."],
      ["Estabilização", "Tanques / óleo", fmt(operationConfig?.oil_flow_l_min, "L/min"), fmt(firstTank?.oil_volume_liters, "L"), maxRisk >= 65 ? "Atenção" : "Normal", "Acompanhar óleo, mangueira e tendência."],
      ["Finalização", "Ciclo", fmt(operationConfig?.max_cycle_seconds, "s"), state?.cycle?.status || "--", "Aguardando", "Encerramento conforme pressão alvo e tempo."],
    ];

    return (
      <div className="operationInfoStack">
        <Section title="Máquinas/Bombas" subtitle="Estado técnico dos principais equipamentos da operação.">
          <Table columns={["Código", "Equipamento", "Modelo", "Função no processo", "Estado", "Desempenho", "Conexão"]} rows={machineRows} />
        </Section>
        <Section title="Tanques" subtitle="Leituras por tanque, mangueira, óleo e status operacional.">
          <Table columns={["Código", "Tipo", "Pressão atual", "Pressão alvo", "Óleo", "Mangueira", "Sensor", "Status"]} rows={tankRows} />
        </Section>
        <Section title="Sensores" subtitle="Monitoramento das leituras e comunicação simulada do processo.">
          <Table columns={["Código", "Tipo", "Leitura atual", "Unidade", "Comunicação", "Última atualização", "Status"]} rows={sensorRows} />
        </Section>
        <Section title="Sistema de óleo" subtitle="Condição de lubrificação, vazão, volume e vedação.">
          <Table columns={["Parâmetro", "Valor", "Unidade", "Status", "Observação"]} rows={oilRows} />
        </Section>
        <Section title="Rastreabilidade do ciclo" subtitle="Etapas do ciclo com referência esperada e condição atual.">
          <Table columns={["Etapa", "Componente", "Valor esperado", "Valor atual/simulado", "Situação", "Observação"]} rows={traceRows} />
        </Section>

        <ComponentHealthPanel state={state} allTanks={allTanks} allHoses={allHoses} />
      </div>
    );
  }

  function renderManualStep() {
    const steps = ["Dados gerais", "Pressão", "Tempo e ciclo", "Óleo", "Segurança", "Revisar"];

    return (
      <div className="operationWizard">
        <div className="operationSteps">
          {steps.map((label, index) => (
            <button key={label} className={manualStep === index + 1 ? "" : "secondary"} onClick={() => setManualStep(index + 1)}>
              {index + 1}. {label}
            </button>
          ))}
        </div>

        {manualStep === 1 && (
          <div className="operationStepPanel">
            <h3>Dados gerais</h3>
            <p>Identifique a operação e selecione os principais recursos.</p>
            <div className="formGrid">
              <Field label="Identificação da operação"><input value={operationConfig.operation_id || ""} onChange={(e) => setOp("operation_id", e.target.value)} placeholder="OP-TSEA" /></Field>
              <Field label="Operador"><input value={operationConfig.operator} onChange={(e) => setOp("operator", e.target.value)} /></Field>
              <Field label="Tanque"><select value={operationConfig.tank_id} onChange={(e) => setOp("tank_id", e.target.value)}>{allTanks.map((tank: any) => <option key={tank.id || tank.code} value={tank.id || tank.code}>{tank.code || tank.name} · {tank.type || "tipo"}</option>)}</select></Field>
              <Field label="Mangueira"><select value={operationConfig.hose_id} onChange={(e) => setOp("hose_id", e.target.value)}>{allHoses.map((hose: any) => <option key={hose.id || hose.code} value={hose.id || hose.code}>{hose.code} · {fmt(hose.length_m, "m")}</option>)}</select></Field>
              <Field label="Receita de referência"><select value={operationConfig.recipe_id} onChange={(e) => setOp("recipe_id", e.target.value)}>{allRecipes.map((recipe: any) => <option key={recipe.id || recipe.name} value={recipe.id || recipe.name}>{recipe.name}</option>)}</select></Field>

<Field label="Quantidade de tanques (1 a 3)">
  <input
    type="number"
    min={1}
    max={3}
    step={1}
    value={activeTankCount}
    onChange={(e) => setOp("tank_count", clampTankCount(e.target.value))}
  />
</Field>

            </div>
          </div>
        )}

        {manualStep === 2 && (
          <div className="operationStepPanel">
            <h3>Pressão</h3>
            <p>Defina as referências de pressão e margem da operação.</p>
            <div className="formGrid">
              <Field label="Pressão inicial"><input type="number" value={operationConfig.initial_pressure_mbar || ""} onChange={(e) => setOp("initial_pressure_mbar", Number(e.target.value))} /></Field>
              <Field label="Pressão final alvo"><input type="number" value={operationConfig.target_pressure_mbar} onChange={(e) => setOp("target_pressure_mbar", Number(e.target.value))} /></Field>
              <Field label="Pressão para acionar Roots"><input type="number" value={operationConfig.roots_start_pressure_mbar} onChange={(e) => setOp("roots_start_pressure_mbar", Number(e.target.value))} /></Field>
              <Field label="Margem de erro permitida"><input type="number" value={operationConfig.allowed_error_mbar || ""} onChange={(e) => setOp("allowed_error_mbar", Number(e.target.value))} /></Field>
            </div>
          </div>
        )}

        {manualStep === 3 && (
          <div className="operationStepPanel">
            <h3>Tempo e ciclo</h3>
            <p>Organize limites de duração, estabilização e atraso permitido.</p>
            <div className="formGrid">
              <Field label="Tempo estimado"><input type="number" value={operationConfig.estimated_time_seconds || ""} onChange={(e) => setOp("estimated_time_seconds", Number(e.target.value))} /></Field>
              <Field label="Tempo máximo permitido"><input type="number" value={operationConfig.max_cycle_seconds} onChange={(e) => setOp("max_cycle_seconds", Number(e.target.value))} /></Field>
              <Field label="Tempo de estabilização"><input type="number" value={operationConfig.stabilization_seconds || ""} onChange={(e) => setOp("stabilization_seconds", Number(e.target.value))} /></Field>
              <Field label="Atraso permitido do óleo"><input type="number" value={operationConfig.oil_delay_seconds || ""} onChange={(e) => setOp("oil_delay_seconds", Number(e.target.value))} /></Field>
            </div>
          </div>
        )}

        {manualStep === 4 && (
          <div className="operationStepPanel">
            <h3>Óleo</h3>
            <p>Defina vazão, volume estimado e condição esperada do óleo.</p>
            <div className="formGrid">
              <Field label="Vazão de óleo"><input type="number" value={operationConfig.oil_flow_l_min} onChange={(e) => setOp("oil_flow_l_min", Number(e.target.value))} /></Field>
              <Field label="Volume estimado"><input type="number" value={operationConfig.estimated_oil_volume_liters || ""} onChange={(e) => setOp("estimated_oil_volume_liters", Number(e.target.value))} /></Field>
              <Field label="Status esperado do óleo"><input value={operationConfig.expected_oil_status || ""} onChange={(e) => setOp("expected_oil_status", e.target.value)} /></Field>
            </div>
          </div>
        )}

        {manualStep === 5 && (
          <div className="operationStepPanel">
            <h3>Segurança e validação</h3>
            <p>Registre critérios de bloqueio e observações antes de iniciar.</p>
            <div className="checkGrid">
              <label><input type="checkbox" checked={Boolean(operationConfig.allow_pre_simulation)} onChange={(e) => setOp("allow_pre_simulation", e.target.checked)} /> Permitir simulação antes da operação</label>
              <label><input type="checkbox" checked={Boolean(operationConfig.block_on_sensor_failure)} onChange={(e) => setOp("block_on_sensor_failure", e.target.checked)} /> Bloquear se sensor falhar</label>
              <label><input type="checkbox" checked={Boolean(operationConfig.block_on_critical_risk)} onChange={(e) => setOp("block_on_critical_risk", e.target.checked)} /> Bloquear se risco for crítico</label>
            </div>
            <Field label="Observações do operador"><input value={operationConfig.notes} onChange={(e) => setOp("notes", e.target.value)} /></Field>
          </div>
        )}

        {manualStep === 6 && (
          <div className="operationStepPanel">
            <h3>Revisar e iniciar</h3>
            <p>Confira os principais dados antes de confirmar ou iniciar a operação.</p>
            <div className="operationReviewGrid">
              <div><span>Operador</span><b>{operationConfig.operator || "--"}</b></div>
              <div><span>Tanque</span><b>{operationConfig.tank_id || "--"}</b></div>
              <div><span>Mangueira</span><b>{operationConfig.hose_id || "--"}</b></div>
              <div><span>Pressão alvo</span><b>{fmt(operationConfig.target_pressure_mbar, "mbar")}</b></div>
              <div><span>Roots</span><b>{fmt(operationConfig.roots_start_pressure_mbar, "mbar")}</b></div>
              <div><span>Óleo</span><b>{fmt(operationConfig.oil_flow_l_min, "L/min")}</b></div>
            </div>
          </div>
        )}

        <div className="modalActions">
          <button className="secondary" onClick={() => setManualStep(Math.max(1, manualStep - 1))}>Voltar</button>
          <button className="secondary" onClick={closeConfig}>Cancelar</button>
          <button onClick={() => setManualStep(Math.min(6, manualStep + 1))}>Confirmar</button>
          <button onClick={() => control("start")}>Iniciar operação</button>
        </div>
      </div>
    );
  }

  function renderConfigModal() {
    if (!configOpen) return null;

    return (
      <div className="operationModalOverlay" role="dialog" aria-modal="true">
        <div className="operationModal">
          <div className="operationModalHeader">
            <div>
              <strong>Configuração da operação</strong>
              <span>Escolha uma receita cadastrada ou configure manualmente em etapas.</span>
            </div>
            <button className="secondary" onClick={closeConfig}>Fechar</button>
          </div>

          {configMode === "choice" && (
            <div className="operationConfigChoice">
              <button onClick={() => setConfigMode("recipe")}>Executar receita</button>
              <button onClick={() => setConfigMode("manual")}>Executar operação manualmente</button>
            </div>
          )}

          {configMode === "recipe" && (
            <div className="operationRecipeList">
              <h3>Receitas cadastradas</h3>
              <div className="operationRecipeGrid">
                {allRecipes.map((recipe: any) => (
                  <button
                    key={recipe.id || recipe.name}
                    className={String(selectedRecipeId) === String(recipe.id || recipe.name) ? "" : "secondary"}
                    onClick={() => {
                      setSelectedRecipeId(recipe.id || recipe.name);
                      setConfigMode("recipe-detail");
                    }}
                  >
                    {recipe.name || recipe.code || "Receita operacional"}
                  </button>
                ))}
              </div>
              <div className="modalActions">
                <button className="secondary" onClick={() => setConfigMode("choice")}>Voltar</button>
              </div>
            </div>
          )}

          {configMode === "recipe-detail" && (
            <>
              <RecipeDetails recipe={selectedRecipe} />
              <div className="modalActions">
                <button className="secondary" onClick={() => setConfigMode("choice")}>Voltar</button>
                <button onClick={() => applyRecipe(selectedRecipe)}>Confirmar</button>
                <button className="secondary" onClick={() => {
                  setRecipeDraft({ ...selectedRecipe });
                  setConfigMode("recipe-edit");
                }}>Editar</button>
              </div>
            </>
          )}

          {configMode === "recipe-edit" && (
            <div className="operationStepPanel">
              <h3>Editar receita antes de confirmar</h3>
              <p>Ajuste os parâmetros para preencher a operação atual.</p>
              <div className="formGrid">
                <Field label="Nome da receita"><input value={recipeDraft.name || ""} onChange={(e) => setRecipeDraft({ ...recipeDraft, name: e.target.value })} /></Field>
                <Field label="Pressão alvo"><input type="number" value={recipeDraft.target_pressure_mbar || ""} onChange={(e) => setRecipeDraft({ ...recipeDraft, target_pressure_mbar: e.target.value })} /></Field>
                <Field label="Acionamento Roots"><input type="number" value={recipeDraft.roots_start_pressure_mbar || ""} onChange={(e) => setRecipeDraft({ ...recipeDraft, roots_start_pressure_mbar: e.target.value })} /></Field>
                <Field label="Tempo estimado"><input type="number" value={recipeDraft.max_cycle_seconds || ""} onChange={(e) => setRecipeDraft({ ...recipeDraft, max_cycle_seconds: e.target.value })} /></Field>
                <Field label="Vazão de óleo"><input type="number" value={recipeDraft.min_oil_flow_l_min || ""} onChange={(e) => setRecipeDraft({ ...recipeDraft, min_oil_flow_l_min: e.target.value })} /></Field>
              </div>
              <div className="modalActions">
                <button className="secondary" onClick={() => setConfigMode("recipe-detail")}>Voltar</button>
                <button onClick={applyRecipeDraft}>Confirmar</button>
              </div>
            </div>
          )}

          {(configMode === "manual" || configMode === "review") && renderManualStep()}
        </div>
      </div>
    );
  }

  
  /* TSEA_PAGE_SUBMENU_DRAWER_START:renderOperationSubmenuDrawer */
  function renderOperationSubmenuDrawer() {
    const submenuItems: { key: any; label: string; description: string }[] = [
      { key: "ihm" as any, label: "IHM", description: "Visão operacional e acionamentos" },
      { key: "info" as any, label: "Informações", description: "Dados técnicos e rastreabilidade" },
      { key: "config" as any, label: "Configuração", description: "Configuração guiada do ciclo" }
    ];

    return (
      <div className="page-subnav-shell">
        <button
          className="page-subnav-toggle"
          type="button"
          aria-label="Abrir submenus de Operação"
          title="Submenus"
          onClick={() => setOperationSubmenuOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>

        {operationSubmenuOpen && (
          <div
            className="page-subnav-overlay"
            role="presentation"
            onClick={() => setOperationSubmenuOpen(false)}
          />
        )}

        <aside className={`page-subnav-drawer ${operationSubmenuOpen ? "open" : ""}`}>
          <div className="page-subnav-drawer-header">
            <div>
              <span>Operação</span>
              <strong>Navegação rápida</strong>
            </div>

            <button className="btn ghost" type="button" onClick={() => setOperationSubmenuOpen(false)}>
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
                  handleTab(item.key);
                  setOperationSubmenuOpen(false);
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
  /* TSEA_PAGE_SUBMENU_DRAWER_END:renderOperationSubmenuDrawer */

return (
    <div className="screen operationScreen">
      {renderOperationSubmenuDrawer()}

      {tab === "ihm" && renderIhm()}
      {tab === "info" && renderInfo()}
      {tab === "config" && (
        <Section title="Configuração guiada" subtitle="Use a janela para executar uma receita ou configurar manualmente.">
          <div className="operationConfigSummary">
            <div><span>Receita atual</span><b>{operationConfig.recipe_id || "--"}</b></div>
            <div><span>Pressão alvo</span><b>{fmt(operationConfig.target_pressure_mbar, "mbar")}</b></div>
            <div><span>Roots</span><b>{fmt(operationConfig.roots_start_pressure_mbar, "mbar")}</b></div>
            <div><span>Óleo</span><b>{fmt(operationConfig.oil_flow_l_min, "L/min")}</b></div>
          </div>
          <div className="commandBar">
            <button onClick={() => openConfig("choice")}>Abrir configuração</button>
          </div>
        </Section>
      )}

      {renderConfigModal()}
    </div>
  );
}
