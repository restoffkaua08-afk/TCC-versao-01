import type { PressureReading, Tank } from "../types/domain";

type PressureChartProps = {
 history: PressureReading[];
 tanks?: Tank[];
 mode?: "real" | "real-expected";
 title?: string;
 subtitle?: string;
};

const realColors = ["#1f6b55", "#b04535", "#a87924"];
const expectedColors = ["#6db69f", "#d69083", "#d2ae6e"];

export function PressureChart({ history, tanks = [], mode = "real", title = "Pressão x tempo", subtitle }: PressureChartProps) {
 const points = [...history].reverse().slice(-120);
 const values = points.flatMap((item) => mode === "real-expected" ? [item.pressure_mbar, item.expected_pressure_mbar] : [item.pressure_mbar]);
 const max = Math.max(...values, 20);
 const min = Math.min(...values, 0);
 const span = Math.max(max - min, 1);
 const tankIds = Array.from(new Set(points.map((item) => item.tank_id))).slice(0, 3);

 function tankLabel(tankId: number) {
 return tanks.find((tank) => tank.id === tankId)?.code ?? `Tanque de Processo de Processo de Processo ${tankId}`;
 }

 function lineFor(tankId: number, field: "pressure_mbar" | "expected_pressure_mbar") {
 const tankPoints = points.filter((item) => item.tank_id === tankId);
 return tankPoints
 .map((item, index) => {
 const x = (index / Math.max(tankPoints.length - 1, 1)) * 100;
 const y = 96 - ((item[field] - min) / span) * 88;
 return `${x},${y}`;
 })
 .join(" ");
 }

 return (
 <section className="panel chart-panel">
 <div className="panel-title">
 <div>
 <h2>{title}</h2>
 {subtitle && <p>{subtitle}</p>}
 </div>
 <span>{points.length} leituras</span>
 </div>
 <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Gráfico de pressão real e esperada por tanque">
 <line x1="0" x2="100" y1="96" y2="96" className="axis" />
 <line x1="0" x2="0" y1="4" y2="96" className="axis" />
 {[25, 50, 75].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} className="grid-line" />)}
 {tankIds.map((tankId, index) => (
 <g key={tankId}>
 {mode === "real-expected" && (
 <polyline points={lineFor(tankId, "expected_pressure_mbar")} fill="none" stroke={expectedColors[index]} strokeDasharray="3 2" strokeWidth="1.7" />
 )}
 <polyline points={lineFor(tankId, "pressure_mbar")} fill="none" stroke={realColors[index]} strokeWidth="2.4" />
 </g>
 ))}
 </svg>
 <div className="legend">
 {tankIds.length === 0 && <span>Aguardando leituras do ciclo</span>}
 {tankIds.map((tankId, index) => (
 <span key={tankId}><i style={{ background: realColors[index] }} /> {tankLabel(tankId)} real</span>
 ))}
 {mode === "real-expected" && tankIds.map((tankId, index) => (
 <span key={`expected-${tankId}`}><i className="dashed" style={{ background: expectedColors[index] }} /> {tankLabel(tankId)} esperado</span>
 ))}
 </div>
 </section>
 );
}
