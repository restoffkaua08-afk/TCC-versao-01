import { Badge, fmt, Metric, Section, statusLabel } from "../components/ui";

type DashboardPageProps = {
  avgPressure: number;
  maxRisk: number;
  operations: any[];
  simulations: any[];
  state: any;
  tanksState: any[];
};

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

function processNote(risk: number, pressure: number, expected: number) {
  if (risk >= 82) return "Revisar limite estrutural e tendência de pressão.";
  if (risk >= 65) return "Monitorar estabilidade do ciclo e perda de carga.";
  if (pressure <= expected * 1.08) return "Processo dentro da faixa esperada.";
  return "Aguardando aproximação da curva esperada.";
}

function TankProcessCard({ item, index }: { item: any; index: number }) {
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
          <div><span>Estado do processo</span><b>{processNote(risk, pressure, expected || pressure)}</b></div>
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
  const sensorStatus = state?.plc_comm_ok ? "Simulado" : "Aguardando";
  const communication = state?.plc_comm_ok ? "Leitura simulada normal" : "Indisponível";
  const oilEnabled = state?.oil_injection?.enabled;

  return (
    <article className="sensorOilCard">
      <div className="sideCardHeader">
        <div>
          <strong>Sensores e Óleo</strong>
          <span>Leituras consolidadas do processo</span>
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

export function DashboardPage({ avgPressure, maxRisk, operations, simulations, state, tanksState }: DashboardPageProps) {
  return (
    <div className="screen dashboardScreen">
      <div className="metricsGrid dashboardMetrics">
        <Metric label="Estado do Ciclo" value={state?.cycle?.status ? statusLabel(state.cycle.status) : "Parado"} status={state?.cycle?.status || "stopped"} />
        <Metric label="Pressão Média" value={fmt(avgPressure, "mbar")} detail="Tanques monitorados" />
        <Metric label="Risco Máximo" value={fmt(maxRisk, "%")} status={maxRisk >= 82 ? "critical" : maxRisk >= 65 ? "warning" : "success"} />
        <Metric label="Registros" value={(operations.length + simulations.length).toString()} detail="Ciclos + simulações" />
      </div>

      <div className="dashboardWorkArea">
        <Section title="Mapa operacional" subtitle="Tanques de processo organizados por pressão, óleo, risco e mangueira vinculada.">
          <div className="dashboardTankList">
            {tanksState.map((item: any, index: number) => (
              <TankProcessCard key={item?.tank?.id || index} item={item} index={index} />
            ))}
          </div>
        </Section>

        <aside className="dashboardSide">
          <PumpCard
            title="Bomba Primária"
            code="B1"
            model={state?.primary_pump?.model || "Leybold SOGEVAC SV 630 B"}
            running={Boolean(state?.primary_pump?.running)}
            performance={state?.primary_pump?.health_pct ?? 98}
          />
          <PumpCard
            title="Bomba Secundária / Roots"
            code="B2"
            model={state?.roots_pump?.model || "Leybold RUVAC WSU 2001"}
            running={Boolean(state?.roots_pump?.running)}
            blocked={!state?.roots_pump?.running}
            performance={state?.roots_pump?.health_pct ?? (state?.roots_pump?.running ? 96 : 0)}
          />
          <SensorsOilCard state={state} tanksState={tanksState} />
        </aside>
      </div>
    </div>
  );
}
