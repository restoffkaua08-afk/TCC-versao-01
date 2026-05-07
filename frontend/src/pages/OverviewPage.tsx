import { Activity, ClipboardCheck, ShieldCheck, Target, Wrench } from "lucide-react";
import type { ReactNode } from "react";

import type { Alarm, OperationState, OperationalReport, PressureReading, VacuumCycle } from "../types/domain";
import { fmt, Kpi, PageHeader, statusText } from "../components/ui";

export function OverviewPage({
  state,
  report,
  cycles,
  alarms,
  history,
  maxRisk,
}: {
  state: OperationState | null;
  report: OperationalReport | null;
  cycles: VacuumCycle[];
  alarms: Alarm[];
  history: PressureReading[];
  maxRisk: number;
}) {
  const activeAlarms = alarms.filter((alarm) => !alarm.acknowledged);
  const efficiency = history.length ? Math.max(0, 100 - (report?.average_recent_pressure_mbar ?? 0) / 12 - maxRisk * 0.18) : 100;

  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Visão Geral"
        title="Solução TSEA para controle de vácuo"
        subtitle="Resumo executivo do processo, benefícios esperados e estado atual da célula simulada."
      />

      <section className="overview-hero">
        <div>
          <span className="eyebrow">Problema resolvido</span>
          <h3>Controle visual, rastreável e seguro do vácuo em tanques de reguladores.</h3>
          <p>
            O sistema organiza pressão por tanque, intertravamento da Roots, perda por mangueira, óleo,
            alarmes e risco estrutural em uma experiência única para operação, engenharia e manutenção.
          </p>
        </div>
        <div className="hero-status-card">
          <span>Status atual</span>
          <strong>{statusText(state?.cycle?.status)}</strong>
          <small>{state?.cycle?.cycle_code ?? "Nenhum ciclo ativo"}</small>
        </div>
      </section>

      <section className="kpi-grid six">
        <Kpi label="Ciclos registrados" value={`${report?.cycles_count ?? cycles.length}`} hint="histórico operacional" />
        <Kpi label="Alarmes ativos" value={`${activeAlarms.length}`} hint="eventos pendentes" tone={activeAlarms.length ? "bad" : "good"} />
        <Kpi label="Risco máximo" value={fmt(maxRisk, "%")} hint="maior risco estrutural" tone={maxRisk > 82 ? "bad" : maxRisk > 65 ? "warn" : "good"} />
        <Kpi label="Eficiência estimada" value={fmt(efficiency, "%")} hint="índice demonstrativo" tone={efficiency > 80 ? "good" : "warn"} />
      </section>

      <section className="benefit-grid">
        <Benefit icon={<Target size={20} />} title="Mais precisão" text="Comparação contínua entre pressão real simulada e pressão esperada." />
        <Benefit icon={<ClipboardCheck size={20} />} title="Rastreabilidade" text="Ciclos, leituras, eventos e alarmes preservados para análise." />
        <Benefit icon={<ShieldCheck size={20} />} title="Segurança" text="Partida segura da Roots e alarmes para risco de colapso." />
        <Benefit icon={<Activity size={20} />} title="Menos erro humano" text="Indicadores claros para decisão do operador." />
        <Benefit icon={<Wrench size={20} />} title="Manutenção preditiva" text="Risco e horas restantes para bombas e mangueiras." />
        <Benefit icon={<ShieldCheck size={20} />} title="Prevenção de colapso" text="Risco estrutural destacado por tanque e no processo." />
      </section>
    </section>
  );
}

function Benefit({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="benefit-card">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}
