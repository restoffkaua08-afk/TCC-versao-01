import { fmt, Metric, Section, statusLabel, TankCard } from "../components/ui";

type DashboardPageProps = {
  avgPressure: number;
  maxRisk: number;
  operations: any[];
  simulations: any[];
  state: any;
  tanksState: any[];
};

export function DashboardPage({ avgPressure, maxRisk, operations, simulations, state, tanksState }: DashboardPageProps) {
  return (
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
          <Metric label="Comunicação" value={state?.plc_comm_ok ? "Leitura simulada normal" : "Falha na leitura simulada"} status={state?.plc_comm_ok ? "success" : "critical"} />
        </div>
      </Section>
    </div>
  );
}
