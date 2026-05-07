import type { ManualOperationResult, TankState } from "../types/domain";
import { fmt } from "./ui";

type RegulatorVisualProps = {
 title: string;
 status?: string;
 pressure?: number | null;
 expected?: number | null;
 oilVolume?: number | null;
 oilFlow?: number | null;
 risk?: number | null;
 hoseLabel?: string;
 mode?: "live" | "simulation";
};

function clamp(value: number, min = 0, max = 100) {
 return Math.max(min, Math.min(max, value));
}

export function RegulatorVisual({
 title,
 status = "Aguardando",
 pressure = 1013,
 expected = 0,
 oilVolume = 0,
 oilFlow = 0,
 risk = 0,
 hoseLabel = "Sem mangueira",
 mode = "live",
}: RegulatorVisualProps) {
 const riskPct = clamp(Number(risk || 0));
 const oilPct = clamp(Number(oilVolume || 0) * 4, 6, 52);
 const pressurePct = clamp(riskPct, 8, 88);
 const gasPct = clamp(100 - oilPct - pressurePct * 0.22, 20, 76);
 const tone = riskPct > 90 ? "bad" : riskPct > 70 ? "warn" : "good";

 return (
 <article className={`regulator-card ${tone}`}>
 <div className="regulator-card-head">
 <div>
 <strong>{title}</strong>
 <span>{mode === "simulation" ? "Simulação Operacional Operacional do Gêmeo Digital" : "Operação em tempo real"}</span>
 </div>
 <small>{status}</small>
 </div>

 <div className="regulator-visual-wrap">
 <svg className="regulator-svg" viewBox="0 0 280 360" role="img" aria-label={`Regulador ${title}`}>
 <defs>
 <clipPath id={`tankClip-${title.replace(/\W/g, "")}`}>
 <rect x="55" y="68" width="170" height="235" rx="32" />
 </clipPath>
 </defs>

 <rect x="105" y="20" width="70" height="42" rx="8" className="regulator-cap" />
 <rect x="75" y="42" width="130" height="30" rx="10" className="regulator-neck" />
 <rect x="55" y="68" width="170" height="235" rx="32" className="regulator-body" />

 <g clipPath={`url(#tankClip-${title.replace(/\W/g, "")})`}>
 <rect x="55" y={68 + (235 * (1 - gasPct / 100))} width="170" height={235 * (gasPct / 100)} className="layer-gas" />
 <rect x="55" y={68 + (235 * (1 - pressurePct / 100))} width="170" height={235 * (pressurePct / 100)} className="layer-pressure" opacity="0.78" />
 <rect x="55" y={303 - (235 * (oilPct / 100))} width="170" height={235 * (oilPct / 100)} className="layer-oil" />
 </g>

 <rect x="55" y="68" width="170" height="235" rx="32" className="regulator-outline" />
 <line x1="42" x2="238" y1="303" y2="303" className="regulator-base-line" />
 <circle cx="92" cy="332" r="12" className="regulator-foot" />
 <circle cx="188" cy="332" r="12" className="regulator-foot" />
 </svg>

 <div className="regulator-legend">
 <span><i className="gas-dot" /> Ar/gás interno</span>
 <span><i className="pressure-dot" /> Carga de pressão</span>
 <span><i className="oil-dot" /> Óleo</span>
 </div>
 </div>

 <div className="regulator-metrics">
 <span><small>Pressão real</small><strong>{fmt(pressure, "mbar")}</strong></span>
 <span><small>Pressão esperada</small><strong>{fmt(expected, "mbar")}</strong></span>
 <span><small>Óleo</small><strong>{fmt(oilVolume, "L")}</strong></span>
 <span><small>Vazão</small><strong>{fmt(oilFlow, "L/min")}</strong></span>
 <span><small>Risco</small><strong>{fmt(risk, "%")}</strong></span>
 <span><small>Linha de Vácuo</small><strong>{hoseLabel}</strong></span>
 </div>
 </article>
 );
}

export function RegulatorFromTankState({ item }: { item: TankState }) {
 return (
 <RegulatorVisual
 title={item.tank.code}
 status={item.status_light}
 pressure={item.pressure_mbar}
 expected={item.expected_pressure_mbar}
 oilVolume={item.oil_volume_liters}
 oilFlow={item.oil_flow_l_min}
 risk={item.collapse_risk_pct}
 hoseLabel={item.hose?.code ?? "Sem mangueira"}
 mode="live"
 />
 );
}

export function RegulatorFromManualResult({ result }: { result: ManualOperationResult }) {
 const last = result.timeline[result.timeline.length - 1];
 return (
 <RegulatorVisual
 title={`${result.tank.label} · ${result.hose.code}`}
 status={result.status}
 pressure={last?.real_pressure_mbar}
 expected={last?.expected_pressure_mbar}
 oilVolume={last?.oil_volume_liters}
 oilFlow={result.config.oil_flow_l_min}
 risk={result.metrics.max_collapse_risk_pct}
 hoseLabel={`${result.hose.code} · ${result.hose.length_m}m`}
 mode="simulation"
 />
 );
}
