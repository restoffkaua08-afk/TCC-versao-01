import type { ReactNode } from "react";

export function fmt(value: unknown, suffix = "") {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return "--";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix ? " " + suffix : ""}`;
}

export function statusLabel(status: unknown) {
  const value = String(status || "").toLowerCase();

  const map: Record<string, string> = {
    success: "Operacional",
    warning: "Atenção",
    critical: "Crítico",
    running: "Em execução",
    paused: "Pausado",
    stopped: "Parado",
    concluido: "Concluído",
    abortado: "Abortado",
    em_andamento: "Em andamento",
    emergency: "Emergência",
    available: "Disponível",
    attention: "Atenção",
  };

  return map[value] || String(status || "--");
}

export function tone(status: unknown) {
  const value = String(status || "").toLowerCase();

  if (["success", "concluido", "running", "ok", "operacional", "available"].includes(value)) return "ok";
  if (["warning", "paused", "em_andamento", "atenção", "atencao", "attention"].includes(value)) return "warn";
  if (["critical", "abortado", "emergency", "falha", "fault"].includes(value)) return "bad";

  return "neutral";
}

export function Badge({ value }: { value: unknown }) {
  return <span className={`badge ${tone(value)}`}>{statusLabel(value)}</span>;
}

export function Metric({ label, value, detail, status }: { label: string; value: ReactNode; detail?: string; status?: unknown }) {
  return (
    <article className={`metric ${tone(status)}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}

export function Section({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="section">
      <div className="sectionHeader">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <strong>Sem dados disponíveis</strong>
      <span>{text}</span>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Table({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          )) : (
            <tr>
              <td colSpan={columns.length}>
                <Empty text="Nenhum registro localizado." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TankCard({ item }: { item: any }) {
  const risk = Number(item?.collapse_risk_pct || 0);
  const oil = Number(item?.oil_volume_liters || 0);
  const pressure = Number(item?.pressure_mbar || 0);

  const gasHeight = Math.max(18, Math.min(72, 74 - risk * 0.22));
  const pressureHeight = Math.max(8, Math.min(68, risk));
  const oilHeight = Math.max(5, Math.min(42, oil * 5));

  return (
    <article className={`tankCard ${risk >= 82 ? "riskHigh" : risk >= 65 ? "riskMedium" : "riskLow"}`}>
      <div className="tankTop">
        <div>
          <strong>{item?.tank?.code || "Tanque de Processo"}</strong>
          <span>{item?.hose?.code || "Mangueira de Vácuo"}</span>
        </div>
        <Badge value={risk >= 82 ? "critical" : risk >= 65 ? "warning" : "success"} />
      </div>

      <div className="tankBody">
        <div className="tankShell">
          <div className="tankFill gas" style={{ height: `${gasHeight}%` }} />
          <div className="tankFill pressure" style={{ height: `${pressureHeight}%` }} />
          <div className="tankFill oil" style={{ height: `${oilHeight}%` }} />
        </div>

        <div className="tankReadings">
          <div><span>Pressão Atual</span><b>{fmt(pressure, "mbar")}</b></div>
          <div><span>Curva Esperada</span><b>{fmt(item?.expected_pressure_mbar, "mbar")}</b></div>
          <div><span>Volume de Óleo</span><b>{fmt(item?.oil_volume_liters, "L")}</b></div>
          <div><span>Risco Estrutural</span><b>{fmt(risk, "%")}</b></div>
          <div><span>Perda na Mangueira</span><b>{fmt(item?.hose_loss_mbar, "mbar")}</b></div>
          <div><span>Sinal</span><b>{item?.status_light || "green"}</b></div>
        </div>
      </div>

      <div className="legend">
        <span><i className="gasDot" />Gás</span>
        <span><i className="pressureDot" />Pressão</span>
        <span><i className="oilDot" />Óleo</span>
      </div>
    </article>
  );
}

export function Chart({ points }: { points: any[] }) {
  if (!points?.length) {
    return <Empty text="Curva operacional indisponível para este registro." />;
  }

  const values = points.flatMap((p) => [
    Number(p.real_pressure_mbar ?? p.pressure_mbar ?? 0),
    Number(p.expected_pressure_mbar ?? 0),
    Number(p.effective_pressure_mbar ?? 0),
  ]);

  const max = Math.max(...values, 10);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);

  function line(key: string, fallback?: string) {
    return points.map((p, index) => {
      const value = Number(p[key] ?? (fallback ? p[fallback] : 0) ?? 0);
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 95 - ((value - min) / span) * 86;
      return `${x},${y}`;
    }).join(" ");
  }

  return (
    <div className="chartBox">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="95" x2="100" y2="95" className="axis" />
        <line x1="0" y1="9" x2="0" y2="95" className="axis" />
        <polyline points={line("expected_pressure_mbar")} className="expectedLine" />
        <polyline points={line("real_pressure_mbar", "pressure_mbar")} className="realLine" />
        <polyline points={line("effective_pressure_mbar")} className="riskLine" />
      </svg>

      <div className="chartLegend">
        <span><i className="realDot" />Pressão real/simulada</span>
        <span><i className="expectedDot" />Curva esperada</span>
        <span><i className="riskDot" />Carga estrutural</span>
      </div>
    </div>
  );
}
