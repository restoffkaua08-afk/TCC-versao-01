import { useEffect, useMemo, useState } from "react";
import "./TraceabilityChartsPanel.css";

const API_BASES = ["/api"];

type ChartType = "line" | "bar" | "pie" | "doughnut";
type MetricId =
  | "vacuum_ramp"
  | "operations_by_day"
  | "operation_status"
  | "cycle_time"
  | "alarms_by_type"
  | "equipment_usage"
  | "machine_performance"
  | "logs_by_severity"
  | "reports_exported"
  | "pressure_target_vs_measured"
  | "oil_injected_by_operation";

type GeneratedSheet = {
  title: string;
  metric: string;
  chart_type: string;
  period: string;
  spreadsheet_url: string;
  spreadsheet_id?: string;
  rows_sent?: number;
  generated_at?: string;
};

type GoogleStatus = {
  dependencies_available: boolean;
  client_secret_exists: boolean;
  client_secret_path: string;
  authenticated: boolean;
  redirect_uri: string;
  generated: GeneratedSheet[];
};

type GeneratedChart = {
  title: string;
  metric: MetricId | string;
  chart_type: ChartType;
  labels: string[];
  series: { name: string; data: number[] }[];
  table: any[];
  legend: { label: string; description: string }[];
  meta?: {
    source?: string;
    sample_count?: number;
    real_data?: boolean;
    empty?: boolean;
  };
};

const METRICS: {
  id: MetricId;
  label: string;
  group: string;
  allowed: ChartType[];
  recommended: ChartType;
}[] = [
  { id: "operations_by_day", label: "Operações por período", group: "Operações", allowed: ["bar", "line"], recommended: "bar" },
  { id: "operation_status", label: "Status das operações", group: "Operações", allowed: ["bar", "pie"], recommended: "pie" },
  { id: "cycle_time", label: "Tempo de ciclo", group: "Desempenho", allowed: ["bar", "line"], recommended: "line" },
  { id: "vacuum_ramp", label: "Rampa de vácuo registrada", group: "Processo", allowed: ["line"], recommended: "line" },
  { id: "alarms_by_type", label: "Alarmes por tipo", group: "Alarmes", allowed: ["bar", "pie"], recommended: "bar" },
  { id: "equipment_usage", label: "Equipamentos e parâmetros", group: "Equipamentos", allowed: ["bar"], recommended: "bar" },
  { id: "machine_performance", label: "Desempenho das máquinas", group: "Equipamentos", allowed: ["bar", "line"], recommended: "bar" },
  { id: "logs_by_severity", label: "Logs por severidade", group: "Auditoria", allowed: ["bar", "pie"], recommended: "bar" },
  { id: "reports_exported", label: "Relatórios exportados", group: "Relatórios", allowed: ["bar", "line"], recommended: "bar" },
  { id: "pressure_target_vs_measured", label: "Pressão alvo vs medida", group: "Processo", allowed: ["line", "bar"], recommended: "line" },
  { id: "oil_injected_by_operation", label: "Óleo injetado por operação", group: "Óleo", allowed: ["bar", "line"], recommended: "bar" },
];

type UiMetric = {
  id: MetricId | string;
  label: string;
  group: string;
  allowed: ChartType[];
  recommended: ChartType;
  question?: string;
};

const CHART_TYPES: ChartType[] = ["line", "bar", "pie", "doughnut"];

function normalizeChartType(value: unknown, fallback: ChartType = "bar"): ChartType {
  const raw = String(value || "").toLowerCase();

  if (CHART_TYPES.includes(raw as ChartType)) {
    return raw as ChartType;
  }

  return fallback;
}

function normalizeMetric(item: any): UiMetric {
  const recommended = normalizeChartType(item?.recommended ?? item?.recommended_chart ?? item?.chart_type, "bar");

  const rawAllowed =
    Array.isArray(item?.allowed) ? item.allowed :
    Array.isArray(item?.allowed_chart_types) ? item.allowed_chart_types :
    Array.isArray(item?.chart_types) ? item.chart_types :
    [recommended];

  const allowed = rawAllowed
    .map((value: unknown) => normalizeChartType(value, recommended))
    .filter((value: ChartType, index: number, array: ChartType[]) => array.indexOf(value) === index);

  return {
    id: item?.id || "operations_by_day",
    label: item?.label || item?.title || item?.id || "Indicador",
    group: item?.group || "Indicadores",
    allowed: allowed.length ? allowed : [recommended],
    recommended,
    question: item?.question || "",
  };
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const errors: string[] = [];

  for (const base of API_BASES) {
    try {
      const response = await fetch(base + path, {
        mode: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        ...options,
      });

      if (!response.ok) {
        const text = await response.text();

        try {
          const parsed = JSON.parse(text);
          const e = formatApiError(parsed, response.status);
          // attach detail so outer catch can detect and rethrow
          try {
            (e as any).detail = parsed?.detail ?? parsed;
            (e as any).status = response.status;
          } catch (err) {}

          throw e;
        } catch (error) {
          if (typeof error === "object" && error && "detail" in error) throw error;
          if (error instanceof Error && error.message) {
            try {
              (error as any).detail = { message: text, status: response.status };
            } catch (err) {}
            throw error;
          }

          const e = new Error(text || `Erro HTTP ${response.status}`);
          (e as any).detail = { message: text, status: response.status };
          throw e;
        }
      }

      return response.json();
    } catch (error: any) {
      const detail = error?.detail;

      if (detail) {
        throw error;
      }

      errors.push(`${base}${path} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(
    "Gateway/API não respondeu. Verifique se http://127.0.0.1:8020/docs está aberto. Detalhes: " + errors.join(" | ")
  );
}

function formatApiError(payload: any, status: number) {
  const detail = payload?.detail ?? payload?.message ?? payload?.error;

  if (detail && typeof detail === "object" && detail.auth_url) {
    return { detail };
  }

  if (typeof detail === "string") return new Error(detail);
  if (detail) return new Error(JSON.stringify(detail));

  return new Error(`Erro HTTP ${status}`);
}


function isLikeMessage(value: unknown) {
  const text = String(value || "").trim();

  if (!text) return false;

  return (
    text.startsWith("{") ||
    text.startsWith("[") ||
    text.includes("\"dependencies_available\"") ||
    text.includes("\"client_secret_exists\"") ||
    text.includes("\"redirect_uri\"") ||
    text.includes("\"authenticated\"") ||
    text.includes("\"generated\"")
  );
}


function isDebugLikeMessage(value: unknown) {
  const text = String(value || "").trim();

  if (!text) return false;

  return (
    text.startsWith("{") ||
    text.startsWith("[") ||
    text.includes("\"dependencies_available\"") ||
    text.includes("\"client_secret_exists\"") ||
    text.includes("\"redirect_uri\"") ||
    text.includes("\"authenticated\"") ||
    text.includes("\"generated\"")
  );
}

function fmt(value: unknown, suffix = "") {
  const n = Number(value);

  if (value === null || value === undefined || Number.isNaN(n)) return "--";

  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix ? " " + suffix : ""}`;
}

function scale(value: number, min: number, max: number, outMin: number, outMax: number) {
  if (max === min) return (outMin + outMax) / 2;
  return outMin + ((value - min) / (max - min)) * (outMax - outMin);
}

function pathFrom(points: { x: number; y: number }[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function cleanData(chart: GeneratedChart) {
  const values = (chart.series || []).flatMap((serie) => serie.data || []);
  const labels = chart.labels || [];

  return values
    .map((value, index) => ({
      value: Number(value),
      label: String(labels[index] ?? index + 1),
      rawIndex: index,
    }))
    .filter((item) => Number.isFinite(item.value));
}

function isEmptyChart(chart: GeneratedChart) {
  return Boolean(chart.meta?.empty) || cleanData(chart).length === 0;
}

function Axis({
  width,
  height,
  left,
  right,
  top,
  bottom,
  xLabels,
  yLabels,
}: {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  xLabels: string[];
  yLabels: string[];
}) {
  const cw = width - left - right;
  const ch = height - top - bottom;

  return (
    <g className="tc-axis">
      {Array.from({ length: 6 }, (_, index) => {
        const y = top + (ch / 5) * index;
        return (
          <g key={`y-${index}`}>
            <line x1={left} x2={left + cw} y1={y} y2={y} />
            <text x={left - 12} y={y + 4} textAnchor="end">{yLabels[index] || ""}</text>
          </g>
        );
      })}

      {Array.from({ length: 6 }, (_, index) => {
        const x = left + (cw / 5) * index;
        return (
          <g key={`x-${index}`}>
            <line x1={x} x2={x} y1={top} y2={top + ch} />
            <text x={x} y={height - 14} textAnchor="middle">{xLabels[index] || ""}</text>
          </g>
        );
      })}

      <line className="tc-axis-main" x1={left} x2={left} y1={top} y2={top + ch} />
      <line className="tc-axis-main" x1={left} x2={left + cw} y1={top + ch} y2={top + ch} />
    </g>
  );
}

function ChartSvg({ chart }: { chart: GeneratedChart }) {
  if (isEmptyChart(chart)) {
    return (
      <div className="tc-chart-empty">
        <strong>Sem registros reais</strong>
        <span>{chart.meta?.source || "Fonte indisponível"}</span>
      </div>
    );
  }

  if (chart.chart_type === "bar") return <BarSvg chart={chart} />;
  if (chart.chart_type === "pie" || chart.chart_type === "doughnut") return <PieSvg chart={chart} />;
  return <LineSvg chart={chart} />;
}


function BarSvg({ chart }: { chart: GeneratedChart }) {
  const width = 920;
  const height = 360;
  const left = 82;
  const right = 36;
  const top = 30;
  const bottom = 60;

  const data = cleanData(chart);
  const values = data.map((item) => item.value);
  const maxY = Math.max(1, ...values);
  const cw = width - left - right;
  const barW = Math.max(12, Math.min(54, cw / Math.max(data.length, 1) - 8));
  const yLabels = [maxY, maxY * 0.8, maxY * 0.6, maxY * 0.4, maxY * 0.2, 0].map((n) => fmt(n));
  const xLabels = [0, 0.2, 0.4, 0.6, 0.8, 1].map((factor) => data[Math.round((data.length - 1) * factor)]?.label || "");

  return (
    <svg className="tc-svg" viewBox={`0 0 ${width} ${height}`}>
      <Axis width={width} height={height} left={left} right={right} top={top} bottom={bottom} xLabels={xLabels} yLabels={yLabels} />
      {data.map((item, index) => {
        const x = scale(index, 0, Math.max(data.length - 1, 1), left + barW, width - right - barW);
        const y = scale(item.value, 0, maxY, height - bottom, top);
        const h = height - bottom - y;

        return (
          <g key={index}>
            <rect className="tc-bar" x={x - barW / 2} y={y} width={barW} height={Math.max(2, h)} rx={6} />
            <title>{item.label}: {fmt(item.value)}</title>
          </g>
        );
      })}
      <text className="tc-axis-title" x={width / 2} y={height - 5} textAnchor="middle">Categoria / período</text>
      <text className="tc-axis-title" x={17} y={height / 2} transform={`rotate(-90 17 ${height / 2})`} textAnchor="middle">Valor</text>
    </svg>
  );
}

function PieSvg({ chart }: { chart: GeneratedChart }) {
  const data = cleanData(chart);
  const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);

  if (!total) {
    return (
      <div className="tc-chart-empty">
        <strong>Sem valores para gráfico circular</strong>
        <span>{chart.meta?.source || "Fonte indisponível"}</span>
      </div>
    );
  }

  let acc = 0;
  const radius = 120;
  const cx = 210;
  const cy = 160;

  function point(angle: number) {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  }

  return (
    <svg className="tc-svg tc-pie-svg" viewBox="0 0 920 360">
      {data.map((item, index) => {
        const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
        acc += Math.max(0, item.value);
        const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
        const p1 = point(start);
        const p2 = point(end);
        const large = end - start > Math.PI ? 1 : 0;
        const d = `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${large} 1 ${p2.x} ${p2.y} Z`;

        return (
          <path key={index} className={`tc-pie-slice slice-${index % 8}`} d={d}>
            <title>{item.label}: {fmt(item.value)}</title>
          </path>
        );
      })}

      {chart.chart_type === "doughnut" && <circle cx={cx} cy={cy} r={62} className="tc-doughnut-hole" />}

      <g className="tc-pie-legend">
        {data.slice(0, 8).map((item, index) => (
          <g key={index} transform={`translate(420 ${60 + index * 30})`}>
            <rect className={`tc-pie-dot slice-${index % 8}`} width="14" height="14" rx="4" />
            <text x="24" y="12">{item.label} · {fmt(item.value)}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function LineSvg({ chart }: { chart: GeneratedChart }) {
  const width = 920;
  const height = 360;
  const left = 82;
  const right = 36;
  const top = 30;
  const bottom = 60;

  const data = cleanData(chart);
  const values = data.map((item) => item.value);
  const maxY = Math.max(1, ...values);
  const minY = Math.min(0, ...values);
  const points = data.map((item, index) => ({
    x: scale(index, 0, Math.max(data.length - 1, 1), left, width - right),
    y: scale(item.value, minY, maxY, height - bottom, top),
  }));

  const yLabels = [maxY, maxY * 0.8, maxY * 0.6, maxY * 0.4, maxY * 0.2, minY].map((n) => fmt(n));
  const xLabels = [0, 0.2, 0.4, 0.6, 0.8, 1].map((factor) => data[Math.round((data.length - 1) * factor)]?.label || "");

  return (
    <svg className="tc-svg" viewBox={`0 0 ${width} ${height}`}>
      <Axis width={width} height={height} left={left} right={right} top={top} bottom={bottom} xLabels={xLabels} yLabels={yLabels} />
      <path className="tc-line" d={pathFrom(points)} />
      {points.map((point, index) => (
        <circle key={index} className={index === points.length - 1 ? "tc-current-point" : "tc-point"} cx={point.x} cy={point.y} r={index === points.length - 1 ? 6.5 : 3.2} />
      ))}
      <text className="tc-axis-title" x={width / 2} y={height - 5} textAnchor="middle">Tempo / período</text>
      <text className="tc-axis-title" x={17} y={height / 2} transform={`rotate(-90 17 ${height / 2})`} textAnchor="middle">Valor</text>
    </svg>
  );
}

export function RealtimeRamp({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const result = await requestJson<any>("/charts/realtime-ramp");

        if (!active) return;

        setData(result);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    load();
    const timer = window.setInterval(load, 1000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const chart = useMemo<GeneratedChart>(() => {
    const points = Array.isArray(data?.points) ? data.points : [];
    const numeric = points.filter((point: any) => point.pressure_mbar !== null && point.pressure_mbar !== undefined);

    return {
      title: "Rampa de vácuo em tempo real",
      metric: "vacuum_ramp",
      chart_type: "line",
      labels: numeric.map((point: any) => String(point.elapsed_seconds ?? 0)),
      series: [{ name: "Pressão medida (mbar)", data: numeric.map((point: any) => Number(point.pressure_mbar)) }],
      table: points.slice(-12).reverse(),
      legend: [
        { label: "Pressão medida", description: "Valor numérico de pressão/vácuo recebido do sensor/PLC." },
      ],
      meta: data?.meta || {
        source: "state + chart_telemetry",
        sample_count: points.length,
        real_data: true,
        empty: numeric.length === 0,
      },
    };
  }, [data]);

  const current = data?.current;
  const hasNumeric = Boolean(data?.pressure_numeric_available);

  return (
    <section className={`tc-realtime ${compact ? "compact" : ""}`}>
      <div className="tc-realtime-head">
        <div>
          <span>Gráfico técnico principal</span>
          <h3>Rampa de vácuo da operação</h3>
        </div>

        <div className={`tc-mode-pill ${hasNumeric ? "ok" : "warn"}`}>
          {hasNumeric ? "PRESSÃO NUMÉRICA" : "SENSOR DIGITAL"}
        </div>
      </div>

      {error && !isLikeMessage(error) && <div className="tc-error">{error}</div>}

      <div className="tc-realtime-grid">
        <div className="tc-realtime-chart">
          <ChartSvg chart={chart} />
        </div>

        <aside className="tc-live-readings">
          <div><span>Operação</span><strong>{data?.operation_id || "--"}</strong></div>
          <div><span>Tempo</span><strong>{current?.elapsed_seconds ?? 0}s</strong></div>
          <div><span>Pressão</span><strong>{current?.pressure_display || "--"}</strong></div>
          <div><span>Etapa</span><strong>{current?.stage || "PREPARO"}</strong></div>
          <div><span>Status</span><strong>{current?.status || "PRONTO"}</strong></div>
          <div><span>OUT1 / OUT2</span><strong>{current?.hardware?.sensor_out1_npn ? "OUT1 ON" : "OUT1 OFF"} · {current?.hardware?.sensor_out2_pnp ? "OUT2 ON" : "OUT2 OFF"}</strong></div>
        </aside>
      </div>
    </section>
  );
}

export function TraceabilityChartsPanel() {
  const [metric, setMetric] = useState<MetricId>("operations_by_day");
  const [catalog, setCatalog] = useState<any | null>(null);
  const selectedMetric = useMemo<UiMetric>(() => {
    const catalogMetric = catalog && Array.isArray(catalog.metrics)
      ? catalog.metrics.find((item: any) => item.id === metric)
      : null;

    const fallbackMetric = METRICS.find((item) => item.id === metric) || METRICS[0];

    return normalizeMetric(catalogMetric || fallbackMetric);
  }, [catalog, metric]);
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [period, setPeriod] = useState("month");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState("");
  const [lastSheet, setLastSheet] = useState<GeneratedSheet | null>(null);
  const [lastFallbackBase64, setLastFallbackBase64] = useState<string | null>(null);
  const [lastFallbackFilename, setLastFallbackFilename] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMetric.allowed.includes(chartType)) {
      setChartType(selectedMetric.recommended);
    }
  }, [metric, chartType, selectedMetric]);

  async function loadStatus() {
    try {
      const result = await requestJson<GoogleStatus>("/google-sheets/status");
      setStatus(result);
    } catch (err: any) {
      setError(typeof err?.detail === "string" ? err.detail : err instanceof Error ? err.message : JSON.stringify(err));
    }
  }

  useEffect(() => {
    loadStatus();
    (async () => {
      try {
        const cat = await requestJson<any>("/charts/catalog");
        setCatalog(cat);
      } catch (err) {
        // keep fallback METRICS
      }
    })();
  }, []);

  async function openGoogleAuthAndWait() {
    setAuthenticating(true);
    setError("");

    try {
      const auth = await requestJson<{ auth_url: string }>("/google-oauth/start");
      window.open(auth.auth_url, "_blank", "width=980,height=760,noopener,noreferrer");

      setError("Autorize no Google. Quando aparecer 'Google Planilhas autorizado', volte aqui e clique novamente em Gerar no Google Planilhas.");
      window.setTimeout(loadStatus, 2500);
    } finally {
      setAuthenticating(false);
    }
  }
async function reauthorizeGoogle() {
    setError("");

    try {
      await requestJson<any>("/google-oauth/reset", { method: "POST" });
      await openGoogleAuthAndWait();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : JSON.stringify(err));
    }
  }

  async function generateSheetDirect() {
    const result = await requestJson<GeneratedSheet & { ok: boolean; generated_local?: boolean; fallback_csv_base64?: string; fallback_csv_filename?: string; fallback_html_base64?: string; fallback_html_filename?: string; fallback_xlsx_base64?: string; fallback_xlsx_filename?: string }>("/google-sheets/generate-chart", {
      method: "POST",
      body: JSON.stringify({
        metric,
        chart_type: chartType,
        period,
        title,
      }),
    });

    setLastSheet(result);
    // If backend returned a local HTML fallback (chart), open in new tab; otherwise handle CSV fallback
    if ((result as any).generated_local) {
      if ((result as any).fallback_html_base64) {
        try {
          const b64 = (result as any).fallback_html_base64 as string;
          const url = "data:text/html;base64," + b64;
          window.open(url, "_blank");
          setError("Google negou permissão; abrindo chart HTML local como fallback.");
        } catch (err) {
          console.error("Falha ao abrir HTML fallback", err);
        }
      } else if ((result as any).fallback_csv_base64) {
        try {
          const b64 = (result as any).fallback_csv_base64 as string;
          const filename = (result as any).fallback_csv_filename || `tsea_chart_fallback.csv`;
          setLastFallbackBase64(b64);
          setLastFallbackFilename(filename);

          const binary = atob(b64);
          const len = binary.length;
          const bytes = new Uint8Array(len);

          for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
          }

          const blob = new Blob([bytes], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);

          setError("Google negou permissão; arquivo CSV local gerado para apresentação.");
        } catch (err) {
          console.error("Falha ao gerar CSV local", err);
        }
      } else if ((result as any).fallback_xlsx_base64) {
        try {
          const b64 = (result as any).fallback_xlsx_base64 as string;
          const filename = (result as any).fallback_xlsx_filename || `tsea_chart_fallback.xlsx`;

          const binary = atob(b64);
          const len = binary.length;
          const bytes = new Uint8Array(len);

          for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
          }

          const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);

          setError("Google negou permissão; arquivo XLSX local gerado para apresentação.");
        } catch (err) {
          console.error("Falha ao gerar XLSX local", err);
        }
      }
    }
    await loadStatus();

    if (result.spreadsheet_url) {
      window.open(result.spreadsheet_url, "_blank", "noopener,noreferrer");
    }
  }

  async function generateOnSheets() {
    setLoading(true);
    setError("");

    try {
      const currentStatus = await requestJson<GoogleStatus>("/google-sheets/status");
      setStatus(currentStatus);

      if (!currentStatus.client_secret_exists) {
        throw new Error(`Credencial OAuth pendente. Salve o arquivo em: ${currentStatus.client_secret_path}`);
      }

      if (!currentStatus.authenticated) {
        await openGoogleAuthAndWait();
        return;
      }

      await generateSheetDirect();
    } catch (err: any) {
      const detail = err?.detail;

      // tratar 403/Google especificamente para orientar reautorização
      const status = err?.status || (detail && detail.status) || null;
      const messageText = (typeof detail === "string" && detail) || (detail && detail.message) || null;

      if (detail && typeof detail === "object" && detail.auth_url) {
        window.open(detail.auth_url, "_blank", "noopener,noreferrer");
      } else if (status === 403 || (messageText && messageText.toLowerCase().includes("google"))) {
        setError(
          "Google Planilhas negou permissão para criar a planilha.\n\nPossíveis causas:\n1. Token OAuth antigo sem escopos corretos.\n2. Conta Google errada.\n3. Google Sheets API ou Google Drive API desativada.\n4. Usuário não está na lista de teste do OAuth.\n5. É necessário reautorizar o Google.\n\nUse o botão \"Reautorizar Google\" para tentar novamente."
        );
      } else {
        setError(typeof detail === "string" ? detail : err instanceof Error ? err.message : JSON.stringify(err));
      }
    } finally {
      setLoading(false);
    }
  }

  async function viewChartPreview() {
    setError("");

    try {
      const chart = await requestJson<GeneratedChart>(`/charts/statistics?metric=${metric}&chart_type=${chartType}&period=${period}`);

      const palette = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];

      const labels = JSON.stringify(chart.labels || []);
      const values = JSON.stringify((chart.series && chart.series[0] && chart.series[0].data) || []);
      const titleJson = JSON.stringify(chart.title || title || selectedMetric.label);

      const colors = (chart.series && chart.series[0] && chart.series[0].data)
        ? JSON.stringify(((chart.series[0].data as any[]).map((_, i) => palette[i % palette.length])))
        : JSON.stringify([palette[0]]);

      const legendItems = (chart.legend || []).map((l, i) => ({ label: l.label, description: l.description || "", color: palette[i % palette.length] }));

      const legendHtml = legendItems
        .map((it) => `<div class="gc-legend-item"><span class="gc-dot" style="background:${it.color}"></span><div><strong>${it.label}</strong><div class="gc-legend-desc">${it.description}</div></div></div>`)
        .join("");

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${chart.title || "Gráfico TSEA"}</title>
  <style>
    :root{color-scheme:light}
    body{background:#ffffff;color:#0b1220;font-family:Inter,Arial,Helvetica,sans-serif;margin:0;height:100vh;}
    .header{height:64px;display:flex;align-items:center;padding:0 24px;border-bottom:1px solid #eef2f7}
    .brand{display:flex;align-items:center;gap:12px}
    .brand-logo{width:40px;height:40px;border-radius:6px;background:#0f172a;color:#fff;display:grid;place-items:center;font-weight:700}
    .brand-text{font-weight:700}
    .wrap{display:flex;gap:24px;height:calc(100vh - 64px);align-items:center;justify-content:center}
    .legend{width:260px;padding:24px}
    .gc-legend-item{display:flex;gap:12px;align-items:flex-start;padding:8px 0}
    .gc-dot{width:14px;height:14px;border-radius:50%;display:inline-block;margin-top:6px}
    .gc-legend-desc{font-size:12px;color:#526075}
    .canvas-wrap{flex:1;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{width:920px;max-width:calc(100vw - 320px);height:560px;background:#fff;border-radius:8px;box-shadow:0 6px 18px rgba(7,18,29,0.06);display:flex;flex-direction:column}
    .card-body{flex:1;display:flex;align-items:center;justify-content:center;padding:12px}
    .card-title{padding:12px 20px;border-bottom:1px solid #f1f5f9;font-weight:600}
    .gc-footer{padding:8px 20px;font-size:13px;color:#7b8794}
    @media(max-width:980px){.legend{display:none}.card{max-width:calc(100vw - 48px);height:420px}}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div class="header"><div class="brand"><div class="brand-logo">T</div><div class="brand-text">TSEA · Visualizador</div></div></div>
  <div class="wrap">
    <aside class="legend">${legendHtml}</aside>
    <div class="canvas-wrap">
      <div class="card">
        <div class="card-title">${chart.title || title || selectedMetric.label}</div>
        <div class="card-body"><canvas id="tseaChart" width="900" height="500"></canvas></div>
        <div class="gc-footer">Interaja com o gráfico: passe o mouse para detalhes. Design limpo para análise.</div>
      </div>
    </div>
  </div>
  <script>
    const labels = ${labels};
    const values = ${values};
    const colors = ${colors};

    const ctx = document.getElementById('tseaChart').getContext('2d');

    const config = {
      type: '${chart.chart_type || 'bar'}',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: '#ffffff', borderWidth: 1 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        interaction: { mode: 'index', intersect: false },
      }
    };

    const chartInstance = new Chart(ctx, config);

    // highlight on hover: enlarge point/bar on hover
    ctx.canvas.addEventListener('mousemove', (e) => {
      // Chart.js handles hover visuals via options; keep default behavior.
    });
  </script>
</body>
</html>`;

      const url = `/?preview=1&metric=${encodeURIComponent(metric)}&chart_type=${encodeURIComponent(chartType)}&period=${encodeURIComponent(period)}`;
      const w = window.open(url, '_blank');

      if (!w) {
        setError('Não foi possível abrir nova aba — verifique bloqueadores de pop-up.');
        return;
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : JSON.stringify(err));
    }
  }

  return (
    <div className="tc-root">
      <div className="tc-debug" style={{position:'fixed',left:12,bottom:12,background:'#111827',color:'#fff',padding:8,borderRadius:8,zIndex:9999,maxWidth:'380px',maxHeight:'40vh',overflow:'auto',fontSize:12}}>
        <div style={{fontWeight:900,marginBottom:6}}>DEBUG</div>
        <div style={{whiteSpace:'pre-wrap',fontFamily:'monospace',fontSize:11}}>{JSON.stringify({status: status, catalog: catalog, error: error}, null, 2)}</div>
      </div>
      <section className="tc-builder sheets-mode">
        <div className="tc-builder-header">
          <div>
            <span>Análise gerencial</span>
            <h3>Dashboard</h3>
          </div>

          <div className={`tc-mode-pill ${status?.authenticated ? "ok" : "warn"}`}>
            {status?.authenticated ? "GOOGLE AUTORIZADO" : "LOGIN GOOGLE PENDENTE"}
          </div>
        </div>

        <div className="sheets-layout oauth-mode">
          <aside className="sheets-config-card">
            <h4>Google</h4>

            <div className="sheets-status">
              <div><span>Dependências</span><strong>{status?.dependencies_available ? "OK" : "Pendente"}</strong></div>
              <div><span>Credencial OAuth</span><strong>{status?.client_secret_exists ? "Encontrada" : "Pendente"}</strong></div>
              <div><span>Conta Google</span><strong>{status?.authenticated ? "Autorizada" : "Não autorizada"}</strong></div>
              <div><span>Callback</span><strong>{status?.redirect_uri || "--"}</strong></div>
            </div>

            <button className="tc-secondary" onClick={openGoogleAuthAndWait} disabled={authenticating || !status?.client_secret_exists}>
              {authenticating ? "Aguardando Google..." : "Entrar com Google"}
            </button>
            <button className="tc-secondary" onClick={reauthorizeGoogle} disabled={!status?.client_secret_exists}>
              Reautorizar Google
            </button>
          </aside>

          <main className="sheets-generator-card">
            <h4>Dashboard</h4>

            <div className="sheets-form-grid">
              <label>
                Indicador
                <select value={metric} onChange={(event) => setMetric(event.target.value as MetricId)}>
                  {catalog && Array.isArray(catalog.metrics) ? (
                    Object.entries(
                      catalog.metrics.reduce((acc: any, item: any) => {
                        const group = item.group || "Outros";
                        acc[group] = [...(acc[group] || []), item];
                        return acc;
                      }, {} as Record<string, any>)
                    ).map(([group, items]) => (
                      <optgroup key={group} label={group}>
                        {(items as any[]).map((item: any) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </optgroup>
                    ))
                  ) : (
                    Object.entries(
                      METRICS.reduce((acc, item) => {
                        acc[item.group] = [...(acc[item.group] || []), item];
                        return acc;
                      }, {} as Record<string, typeof METRICS>)
                    ).map(([group, items]) => (
                      <optgroup key={group} label={group}>
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </optgroup>
                    ))
                  )}
                </select>
              </label>

              <label>
                Tipo de gráfico
                <select value={chartType} onChange={(event) => setChartType(event.target.value as ChartType)}>
                  {selectedMetric.allowed.includes("bar") && <option value="bar">Barras</option>}
                  {selectedMetric.allowed.includes("line") && <option value="line">Linha</option>}
                  {selectedMetric.allowed.includes("pie") && <option value="pie">Pizza/Rosca</option>}
                </select>
              </label>

              <label>
                Período
                <select value={period} onChange={(event) => setPeriod(event.target.value)}>
                  <option value="all">Todos os registros</option>
                  <option value="today">Hoje</option>
                  <option value="week">Últimos 7 dias</option>
                  <option value="month">Últimos 30 dias</option>
                </select>
              </label>

              <label>
                Título
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={selectedMetric.label} />
              </label>
            </div>

            <button className="tc-primary sheets-main-action" onClick={generateOnSheets} disabled={loading}>
              {loading ? "Gerando..." : status?.authenticated ? "Gerar no Google Planilhas" : "Entrar com Google"}
            </button>
            <button className="tc-primary sheets-main-action" style={{marginLeft:12}} onClick={viewChartPreview}>
              Visualizar gráfico
            </button>

            {error && !isLikeMessage(error) && <div className="tc-error">{error}</div>}

            {lastSheet && (
              <div className="sheets-result">
                <div>
                  <span>Última planilha</span>
                  <strong>{lastSheet.title}</strong>
                </div>
                {lastSheet.spreadsheet_url ? (
                  <a href={lastSheet.spreadsheet_url} target="_blank" rel="noreferrer">Abrir no Google Planilhas</a>
                ) : null}

                {lastFallbackBase64 ? (
                  <a
                    href={"data:text/csv;base64," + lastFallbackBase64}
                    download={lastFallbackFilename || "tsea_chart_fallback.csv"}
                    rel="noreferrer"
                  >
                    Baixar CSV de fallback
                  </a>
                ) : null}
              </div>
            )}
          </main>

          <aside className="sheets-history-card">
            <h4>Planilhas geradas</h4>

            <div className="sheets-history-list">
              {(status?.generated || []).length ? (status?.generated || []).map((item, index) => (
                <a key={`${item.spreadsheet_url}-${index}`} href={item.spreadsheet_url} target="_blank" rel="noreferrer">
                  <strong>{item.title}</strong>
                  <span>{item.chart_type.toUpperCase()} · {item.period} · {item.rows_sent || 0} linhas</span>
                </a>
              )) : (
                <div className="sheets-empty">Nenhuma planilha gerada.</div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
