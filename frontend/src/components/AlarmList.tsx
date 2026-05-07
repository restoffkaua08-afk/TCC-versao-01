import type { Alarm } from "../types/domain";
import { Estado OperacionalBadge } from "./ui";

export function AlarmList({ alarms, limit = 6 }: { alarms: Alarm[]; limit?: number }) {
 const visible = alarms.slice(0, limit);
 if (!visible.length) return <p className="empty-state">Nenhum alarme ativo no momento.</p>;
 return (
 <div className="alarm-list">
 {visible.map((alarm) => (
 <article key={alarm.id} className={`alarm-item ${alarm.severity}`}>
 <div>
 <strong>{alarm.code}</strong>
 <span>{alarm.message}</span>
 </div>
 <Estado OperacionalBadge tone={alarm.severity === "critical" ? "bad" : "warn"}>{alarm.acknowledged ? "Reconhecido" : "Pendente"}</Estado OperacionalBadge>
 </article>
 ))}
 </div>
 );
}
