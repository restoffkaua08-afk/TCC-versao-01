import type { ReactNode } from "react";

export type Tone = "neutral" | "good" | "warn" | "bad";

export function fmt(value?: number | null, suffix = "") {
 return value === undefined || value === null || Number.isNaN(value)
 ? "--"
 : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${suffix}`.trim();
}

export function statusText(value?: string | null) {
 const map: Record<string, string> = {
 running: "Em operação",
 completed: "Concluído",
 alarm: "Em alarme",
 stopped: "Parado",
 available: "Disponível",
 attention: "Atenção",
 };
 return value ? map[value] ?? value : "Aguardando";
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle: string; actions?: ReactNode }) {
 return (
 <section className="page-header">
 <div>
 <p>{eyebrow}</p>
 <h2>{title}</h2>
 <span>{subtitle}</span>
 </div>
 {actions && <div className="page-actions">{actions}</div>}
 </section>
 );
}

export function Kpi({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: Tone }) {
 return (
 <article className={`kpi-card ${tone}`}>
 <span>{label}</span>
 <strong>{value}</strong>
 {hint && <small>{hint}</small>}
 </article>
 );
}

export function StatusBadge({ tone = "neutral", children }: { tone?: Tone | string; children: ReactNode }) {
 return <span className={`status-badge ${tone}`}>{children}</span>;
}

export function DemoBadge() {
}

export function Meter({ label, value, tone = "neutral" }: { label: string; value: number; tone?: Tone }) {
 return (
 <label className={`meter ${tone}`}>
 <span>{label}</span>
 <progress max="100" value={value} />
 <strong>{fmt(value, "%")}</strong>
 </label>
 );
}

export function DataTable({ rows, labels = {} }: { rows: object[]; labels?: Record<string, string> }) {
 if (!rows.length) return <p className="empty-state">Sem registros.</p>;
 const keys = Object.keys(rows[0]).slice(0, 8);
 return (
 <div className="table-wrap">
 <table>
 <thead>
 <tr>{keys.map((key) => <th key={key}>{labels[key] ?? key}</th>)}</tr>
 </thead>
 <tbody>
 {rows.map((row, index) => (
 <tr key={index}>
 {keys.map((key) => <td key={key}>{formatCell((row as Record<string, unknown>)[key])}</td>)}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
}

function formatCell(value: unknown) {
 if (value === null || value === undefined) return "--";
 if (typeof value === "object") {
 const record = value as Record<string, unknown>;
 return String(record.code ?? record.name ?? record.model ?? record.asset_code ?? JSON.stringify(value));
 }
 if (typeof value === "number") return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
 if (typeof value === "boolean") return value ? "Sim" : "Não";
 return String(value);
}

export const labels = {
 cycle: {
 cycle_code: "Código",
 operator: "Responsável Operacional",
 status: "Estado Operacional",
 started_at: "Início",
 finished_at: "Fim",
 final_pressure_mbar: "Pressão Final do Processo",
 duration_seconds: "Duração (s)",
 },
 trace: {
 cycle_code: "Ciclo",
 operator: "Responsável Operacional",
 action: "Ação",
 details: "Detalhes",
 timestamp: "Data/hora",
 },
 tank: {
 code: "Código",
 type: "Categoria",
 volume_liters: "Volume (L)",
 structural_limit_mbar: "Limite estrutural",
 status: "Estado Operacional",
 notes: "Observações",
 },
 hose: {
 code: "Código",
 length_m: "Comprimento",
 diameter_in: "Diâmetro",
 material: "Material",
 loss_factor: "Fator de perda",
 usage_cycles: "Ciclos",
 status: "Estado Operacional",
 },
 recipe: {
 name: "Receita",
 tank_type: "Categoria",
 target_pressure_mbar: "Pressão alvo",
 roots_start_pressure_mbar: "Partida Roots",
 max_cycle_seconds: "Tempo máximo",
 min_oil_flow_l_min: "Vazão óleo",
 },
 maintenance: {
 asset_type: "Categoria",
 asset_code: "Ativo",
 risk_score: "Risco",
 remaining_hours: "Horas restantes",
 recommendation: "Recomendação",
 },
 whatIf: {
 scenario_name: "Cenário",
 projected_duration_seconds: "Duração",
 projected_final_pressure_mbar: "Pressão Final do Processo",
 max_collapse_risk_pct: "Risco",
 roots_started: "Roots",
 alarms: "Alarmes",
 },
};
