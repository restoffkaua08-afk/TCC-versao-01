export function fmt(value: unknown, suffix = ""): string {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return "--";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix ? " " + suffix : ""}`;
}

export function fmtDate(value: unknown): string {
  if (!value) return "--";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pt-BR");
}

export function statusLabel(status: unknown): string {
  const value = String(status || "").toLowerCase();

  const labels: Record<string, string> = {
    success: "Conforme",
    warning: "Atenção",
    critical: "Crítico",
    running: "Em execução",
    paused: "Pausado",
    stopped: "Parado",
    concluido: "Concluído",
    abortado: "Abortado",
    em_andamento: "Em andamento"
  };

  return labels[value] || String(status || "--");
}

export function tone(status: unknown): "good" | "warn" | "bad" | "neutral" {
  const value = String(status || "").toLowerCase();
  if (["success", "concluido", "ok", "running", "conforme"].includes(value)) return "good";
  if (["warning", "paused", "em_andamento", "atencao", "atenção"].includes(value)) return "warn";
  if (["critical", "abortado", "emergency", "critico", "crítico"].includes(value)) return "bad";
  return "neutral";
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
