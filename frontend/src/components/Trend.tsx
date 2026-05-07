import type { PressureReading, Tank } from "../types/domain";

type TrendProps = {
 history: PressureReading[];
 title?: string;
 subtitle?: string;
 tanks?: Tank[];
};

const colors = ["#1f6b55", "#b34332", "#b27a21"];

export function Trend({ history, title = "Pressão x tempo", subtitle, tanks = [] }: TrendProps) {
 const points = [...history].reverse().slice(-90);
 const max = Math.max(...points.map((item) => item.pressure_mbar), 20);
 const min = Math.min(...points.map((item) => item.pressure_mbar), 0);
 const span = Math.max(max - min, 1);
 const tankIds = Array.from(new Set(points.map((item) => item.tank_id))).slice(0, 3);

 function tankLabel(tankId: number) {
 return tanks.find((tank) => tank.id === tankId)?.code ?? `Tanque de Processo ${tankId}`;
 }

 function lineFor(tankId: number) {
 const tankPoints = points.filter((item) => item.tank_id === tankId);
 return tankPoints
 .map((item, index) => {
 const x = (index / Math.max(tankPoints.length - 1, 1)) * 100;
 const y = 96 - ((item.pressure_mbar - min) / span) * 88;
 return `${x},${y}`;
 })
 .join(" ");
 }

 return (
 <section className="panel trend operation-chart">
 <div className="panel-title">
 <div>
 <h2>{title}</h2>
 {subtitle && <p>{subtitle}</p>}
 </div>
 <span>{points.length} leituras</span>
 </div>
 <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Gráfico de pressão por tanque">
 <line x1="0" x2="100" y1="96" y2="96" className="axis" />
 <line x1="0" x2="0" y1="4" y2="96" className="axis" />
 {tankIds.map((tankId, index) => (
 <polyline key={tankId} points={lineFor(tankId)} fill="none" stroke={colors[index]} strokeWidth="2.2" />
 ))}
 </svg>
 <div className="legend">
 {tankIds.length === 0 && <span>Aguardando leituras do ciclo</span>}
 {tankIds.map((tankId, index) => (
 <span key={tankId}><i style={{ background: colors[index] }} /> {tankLabel(tankId)}</span>
 ))}
 </div>
 </section>
 );
}
