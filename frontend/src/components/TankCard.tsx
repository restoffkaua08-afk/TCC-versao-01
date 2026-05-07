import type { TankState } from "../types/domain";
import { fmt } from "./ui";

export function TankCard({ item }: { item: TankState }) {
 return (
 <article className={`tank-card ${item.status_light}`}>
 <div className="tank-card-head">
 <span className={`signal ${item.status_light}`} />
 <div>
 <strong>{item.tank.code}</strong>
 <small>{item.tank.type.replace(/_/g, " ")}</small>
 </div>
 </div>
 <div className="pressure">{fmt(item.pressure_mbar, "mbar")}</div>
 <div className="tank-metrics">
 <Metric label="Pressão esperada" value={fmt(item.expected_pressure_mbar, "mbar")} />
 <Metric label="Linha de Vácuo" value={item.hose?.code ?? "--"} />
 <Metric label="Perda de carga" value={fmt(item.hose_loss_mbar, "mbar")} />
 <Metric label="Óleo" value={`${fmt(item.oil_flow_l_min, "L/min")} · ${fmt(item.oil_volume_liters, "L")}`} />
 <Metric label="Risco Estrutural" value={fmt(item.collapse_risk_pct, "%")} />
 <Metric label="Estado Operacional" value={item.status_light === "green" ? "Normal" : item.status_light === "yellow" ? "Atenção" : "Crítico"} />
 </div>
 </article>
 );
}

function Metric({ label, value }: { label: string; value: string }) {
 return <span><small>{label}</small><strong>{value}</strong></span>;
}
