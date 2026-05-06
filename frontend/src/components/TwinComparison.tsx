import type { OperationState } from "../types/domain";
import { fmt, StatusBadge } from "./ui";

export function TwinComparison({ state }: { state: OperationState | null }) {
  const rows = state?.tank_states.map((item) => {
    const deviation = item.pressure_mbar - item.expected_pressure_mbar;
    const deviationPct = Math.abs(deviation) / Math.max(item.expected_pressure_mbar, 1) * 100;
    const tone = deviationPct > 30 ? "bad" : deviationPct > 15 ? "warn" : "good";
    return {
      tank: item.tank.code,
      real: item.pressure_mbar,
      expected: item.expected_pressure_mbar,
      deviation,
      deviationPct,
      tone,
    };
  }) ?? [];

  if (!rows.length) return <p className="empty-state">Aguardando leituras para comparar os tanques.</p>;

  return (
    <section className="comparison-list">
      {rows.map((row) => (
        <article key={row.tank} className={`comparison-card ${row.tone}`}>
          <div>
            <strong>{row.tank}</strong>
            <StatusBadge tone={row.tone}>{row.tone === "good" ? "Aderente" : row.tone === "warn" ? "Atenção" : "Crítico"}</StatusBadge>
          </div>
          <dl>
            <div><dt>Real</dt><dd>{fmt(row.real, "mbar")}</dd></div>
            <div><dt>Esperada</dt><dd>{fmt(row.expected, "mbar")}</dd></div>
            <div><dt>Desvio</dt><dd>{fmt(row.deviation, "mbar")}</dd></div>
            <div><dt>Desvio %</dt><dd>{fmt(row.deviationPct, "%")}</dd></div>
          </dl>
        </article>
      ))}
    </section>
  );
}
