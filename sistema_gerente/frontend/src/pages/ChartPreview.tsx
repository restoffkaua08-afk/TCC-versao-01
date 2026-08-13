import { useEffect, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

const API = "http://127.0.0.1:8020/api";

function parseQuery() {
  const params = new URLSearchParams(window.location.search);
  return {
    metric: params.get("metric") || "operations_by_day",
    chart_type: params.get("chart_type") || "bar",
    period: params.get("period") || "all",
  };
}

export function ChartPreview() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [data, setData] = useState<any | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const q = parseQuery();
    const url = `${API}/charts/statistics?metric=${encodeURIComponent(q.metric)}&chart_type=${encodeURIComponent(q.chart_type)}&period=${encodeURIComponent(q.period)}`;

    fetch(url)
      .then((r) => r.json())
      .then((json) => setData(json))
      .catch((err) => setData({ error: String(err) }));
  }, []);

  useEffect(() => {
    if (!data || !canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    if (data.error) return;

    const labels = data.labels || [];
    const series = data.series || [];

    const colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"];

    const datasets = series.map((s: any, i: number) => ({
      label: s.name || `Série ${i + 1}`,
      data: s.data || [],
      backgroundColor: Array.isArray(s.data) ? s.data.map((_: any, idx: number) => colors[idx % colors.length]) : colors[i % colors.length],
      borderColor: colors[i % colors.length],
      borderWidth: 1,
    }));

    const ctx = canvasRef.current.getContext("2d");

    chartRef.current = new Chart(ctx as CanvasRenderingContext2D, {
      type: data.chart_type || "bar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
      },
    });
  }, [data]);

  if (!data) {
    return <div style={{ padding: 24 }}>Carregando visualização...</div>;
  }

  if (data.error) {
    return <div style={{ padding: 24, color: "#b91c1c" }}>Erro: {String(data.error)}</div>;
  }

  return (
    <div style={{ background: "#fff", height: "100vh", padding: 12, boxSizing: "border-box" }}>
      <header style={{ height: 64, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 6, background: "#0f172a", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>T</div>
        <div style={{ fontWeight: 700 }}>{data.title || "Visualizador TSEA"}</div>
      </header>

      <div style={{ display: "flex", gap: 24, padding: 12, height: `calc(100vh - 64px)` }}>
        <aside style={{ width: 260, overflow: "auto" }}>
          {(data.legend || []).map((l: any, i: number) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: 8, background: "#1f77b4", marginTop: 6 }} />
              <div>
                <div style={{ fontWeight: 700 }}>{l.label}</div>
                <div style={{ fontSize: 12, color: "#526075" }}>{l.description}</div>
              </div>
            </div>
          ))}
        </aside>

        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "920px", maxWidth: "calc(100vw - 320px)", height: 560 }}>
            <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9", fontWeight: 600 }}>{data.title}</div>
            <div style={{ height: 480, position: "relative" }}>
              <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default ChartPreview;
