import { useEffect, useMemo, useState } from "react";
import { Badge, Empty, Field, fmt, Metric, Section, Table } from "../components/ui";

type TraceSection = "records" | "logs" | "audit" | "reports" | "indicators" | "exports";
type TraceType = "Operação" | "Simulação" | "Log" | "Auditoria" | "Alerta" | "Relatório" | "Exportação" | "Parâmetro";

type DateRange = {
  period: "all" | "today" | "7" | "30" | "custom";
  start: string;
  end: string;
};

type TraceRecord = {
  id: string;
  type: TraceType;
  name: string;
  date: string;
  user: string;
  status: string;
  description: string;
  related: string;
  notes: string;
  raw?: any;
};

const USERS = [
  { name: "João Martins", role: "Operador" },
  { name: "Maria Souza", role: "Supervisora" },
  { name: "Carlos Lima", role: "Manutenção" },
  { name: "Admin TSEA", role: "Administrador" },
];

const SECTION_LABELS: { key: TraceSection; label: string }[] = [
  { key: "records", label: "Registros" },
  { key: "logs", label: "Logs de Acesso" },
  { key: "audit", label: "Auditoria" },
  { key: "reports", label: "Relatórios" },
  { key: "indicators", label: "Indicadores" },
  { key: "exports", label: "Exportações" },
];

const DEMO_LOG_DAYS = [
  {
    date: "2026-03-05T08:12:00",
    users: [
      {
        user: "João Martins",
        role: "Operador",
        entry: "08:12",
        exit: "11:40",
        actions: ["Iniciou operação OP-0007", "Executou simulação SIM-0012", "Alterou parâmetro de pressão alvo", "Exportou relatório REL-0004"],
      },
      {
        user: "Maria Souza",
        role: "Supervisora",
        entry: "13:05",
        exit: "17:20",
        actions: ["Revisou alertas críticos", "Gerou relatório geral diário", "Validou simulação de atraso do óleo"],
      },
      {
        user: "Carlos Lima",
        role: "Manutenção",
        entry: "15:22",
        exit: "16:10",
        actions: ["Consultou perda de mangueira MG-02", "Registrou observação de manutenção"],
      },
    ],
  },
  {
    date: "2026-03-06T07:58:00",
    users: [
      {
        user: "João Martins",
        role: "Operador",
        entry: "07:58",
        exit: "12:05",
        actions: ["Consultou registros de operação", "Iniciou ciclo de vácuo TQ-01", "Visualizou relatório de simulação"],
      },
      {
        user: "Admin TSEA",
        role: "Administrador",
        entry: "09:10",
        exit: "09:42",
        actions: ["Revisou permissões previstas", "Exportou rastreabilidade mensal"],
      },
    ],
  },
];

const AUDIT_ROWS = [
  ["2026-03-05T14:30:00", "João Martins", "Alterou pressão alvo", "Operação", "8 mbar", "10 mbar", "Ajuste solicitado para validação do ciclo TQ-02."],
  ["2026-03-05T15:10:00", "Maria Souza", "Executou simulação", "Gêmeo Digital", "Cenário base", "Atraso do óleo", "Teste de resposta para vazão reduzida."],
  ["2026-03-05T16:00:00", "Supervisor", "Exportou relatório geral", "Relatórios", "Pendente", "PDF preparado", "Documento diário de rastreabilidade."],
  ["2026-03-06T09:25:00", "Admin TSEA", "Atualizou parâmetro", "Parâmetros", "MG-01 perda 0,8", "MG-01 perda 0,9", "Preparado para integração com cadastro auditável."],
];

const EXPORT_ROWS = [
  ["REL-0001", "Relatório geral", "PDF", "2026-03-05T17:30:00", "Supervisor", "Dia 05/03/2026", "Exportado"],
  ["REL-0002", "Operação OP-0007", "PDF", "2026-03-06T10:15:00", "João Martins", "Operação única", "Exportado"],
  ["REL-0003", "Simulação SIM-0012", "Word", "2026-03-06T11:05:00", "Maria Souza", "Simulação única", "Exportado"],
];

const TYPE_FILTERS: Record<string, TraceType | "Todos"> = {
  Todos: "Todos",
  Operações: "Operação",
  Simulações: "Simulação",
  Logs: "Log",
  Auditoria: "Auditoria",
  Alertas: "Alerta",
  Relatórios: "Relatório",
};

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function onlyDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("pt-BR");
}

function parsePtDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function validateRange(range: DateRange) {
  if (range.period !== "custom") return "";

  const start = parsePtDate(range.start);
  const end = parsePtDate(range.end);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (!start || !end) return "Informe datas válidas no formato dd/mm/aaaa.";
  if (start > today || end > today) return "O período não pode conter data futura.";
  if (end < start) return "A data final não pode ser menor que a data inicial.";
  return "";
}

function inDateRange(dateValue: string, range: DateRange) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime()) || range.period === "all") return true;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range.period === "today") return date >= startOfToday;
  if (range.period === "7") return now.getTime() - date.getTime() <= 7 * 24 * 60 * 60 * 1000;
  if (range.period === "30") return now.getTime() - date.getTime() <= 30 * 24 * 60 * 60 * 1000;

  const start = parsePtDate(range.start);
  const end = parsePtDate(range.end);
  if (!start || !end) return true;
  end.setHours(23, 59, 59, 999);
  return date >= start && date <= end;
}

function statusBadge(status: string) {
  const value = status.toLowerCase();
  if (value.includes("crítico") || value.includes("falha") || value.includes("abortado")) return "critical";
  if (value.includes("atenção") || value.includes("espera")) return "warning";
  return "success";
}

function operationRecord(item: any, index: number): TraceRecord {
  const id = String(item?.id || `OP-${String(index + 1).padStart(4, "0")}`);
  const date = item?.created_at || item?.started_at || item?.data || new Date().toISOString();
  const status = item?.status || "concluido";
  return {
    id,
    type: "Operação",
    name: item?.name || item?.nome || `Ciclo regulador ${item?.tank || item?.config?.tank_type || "TSEA"}`,
    date,
    user: item?.operator || item?.operador || USERS[index % USERS.length].name,
    status: status === "success" ? "Operacional" : status,
    description: "Registro operacional de ciclo do processo de vácuo.",
    related: `Tanque ${item?.tank || item?.config?.tank_type || "--"} · Mangueira ${item?.hose || item?.config?.hose_id || "--"}`,
    notes: item?.notes || item?.observacoes || "Registro disponível para consulta técnica e emissão de relatório.",
    raw: item,
  };
}

function simulationRecord(item: any, index: number): TraceRecord {
  const id = String(item?.id || `SIM-${String(index + 1).padStart(4, "0")}`);
  const date = item?.created_at || item?.data || new Date().toISOString();
  return {
    id,
    type: "Simulação",
    name: item?.scenario || item?.name || item?.nome || "Simulação do Gêmeo Digital",
    date,
    user: item?.operator || USERS[(index + 1) % USERS.length].name,
    status: item?.status === "warning" ? "Atenção" : item?.status === "critical" ? "Crítico" : "Operacional",
    description: item?.diagnosis || "Simulação operacional com rastreabilidade de cenário, parâmetros e resultado.",
    related: `Risco ${fmt(item?.metrics?.max_collapse_risk_pct, "%")} · Pressão ${fmt(item?.metrics?.final_real_pressure_mbar, "mbar")}`,
    notes: item?.recommendation || "Dados preparados para comparação com operações reais.",
    raw: item,
  };
}

function buildReportHtml(title: string, period: string, records: TraceRecord[]) {
  const rows = records.map((item) => `
    <tr>
      <td>${item.type}</td>
      <td>${item.id}</td>
      <td>${item.name}</td>
      <td>${formatDate(item.date)}</td>
      <td>${item.user}</td>
      <td>${item.status}</td>
    </tr>
  `).join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1b2824; padding: 28px; line-height: 1.45; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    h2 { margin-top: 26px; font-size: 17px; border-bottom: 1px solid #bdc8c1; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #d8ded8; padding: 8px; text-align: left; font-size: 12px; }
    th { background: #f2f3ef; }
    .meta { color: #4d5a54; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta"><strong>Sistema:</strong> TSEA V-Twin Supervisório Industrial</p>
  <p class="meta"><strong>Data de emissão:</strong> ${formatDate(new Date().toISOString())}</p>
  <p class="meta"><strong>Usuário que gerou:</strong> Supervisor</p>
  <p class="meta"><strong>Período analisado:</strong> ${period}</p>
  <h2>1. Identificação do relatório</h2>
  <p>Documento técnico de rastreabilidade operacional, auditoria e documentação do processo de vácuo.</p>
  <h2>2. Resumo geral</h2>
  <p>Total de registros considerados: ${records.length}.</p>
  <h2>3. Operações registradas</h2>
  <table><thead><tr><th>Tipo</th><th>ID</th><th>Identificação</th><th>Data</th><th>Usuário</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
  <h2>4. Simulações executadas</h2>
  <p>As simulações do Gêmeo Digital são apresentadas com cenário, status e vínculo técnico quando disponíveis.</p>
  <h2>5. Alertas e eventos</h2>
  <p>Eventos de atenção e criticidade devem ser avaliados em conjunto com os parâmetros do ciclo.</p>
  <h2>6. Logs de acesso</h2>
  <p>Registros demonstrativos preparados para integração com login de usuários.</p>
  <h2>7. Auditoria e alterações</h2>
  <p>Alterações relevantes mantêm identificação de usuário, data, área afetada e valores anterior/novo.</p>
  <h2>8. Indicadores</h2>
  <p>Indicadores consolidados apoiam gestão operacional, manutenção e melhoria contínua.</p>
  <h2>9. Exportações</h2>
  <p>Exportações ficam preparadas para integração com geração real de PDF.</p>
  <h2>10. Conclusão</h2>
  <p>O conjunto de registros oferece base documental para consulta, auditoria e validação técnica do sistema TSEA.</p>
</body>
</html>`;
}

function downloadDoc(filename: string, html: string) {
  const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function TraceabilityPage({ operations = [], simulations = [], alarms = [] }: { operations: any[]; simulations: any[]; alarms: any[] }) {
  const [active, setActive] = useState<TraceSection>("records");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<TraceRecord | null>(null);
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [userFilter, setUserFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ period: "all", start: "", end: "" });
  const [reportRange, setReportRange] = useState<DateRange>({ period: "30", start: "", end: "" });
  const [reportType, setReportType] = useState("Relatório geral");
  const [reportMessage, setReportMessage] = useState("");
  const [localSimulations, setLocalSimulations] = useState<any[]>([]);
  const [expandedLogDate, setExpandedLogDate] = useState("2026-03-05");

  useEffect(() => {
    function load() {
      setLocalSimulations([
        ...loadLocal<any[]>("tsea.gemeo10.history", []),
        ...loadLocal<any[]>("tsea.simulationHistory.final", []),
      ]);
    }

    load();
    const timer = window.setInterval(load, 2000);
    return () => window.clearInterval(timer);
  }, []);

  const traceRecords = useMemo(() => {
    const opRecords = operations.map(operationRecord);
    const simSource = [...simulations, ...localSimulations];
    const simRecords = simSource.map(simulationRecord);
    const alarmRecords = alarms.map((alarm: any, index: number): TraceRecord => ({
      id: String(alarm?.id || `ALT-${String(index + 1).padStart(4, "0")}`),
      type: "Alerta",
      name: alarm?.title || alarm?.message || "Evento operacional",
      date: alarm?.created_at || alarm?.date || new Date().toISOString(),
      user: "Sistema TSEA",
      status: alarm?.severity || "Atenção",
      description: alarm?.description || alarm?.message || "Evento registrado pelo supervisório.",
      related: alarm?.area || "Processo de vácuo",
      notes: "Alerta disponível para análise operacional.",
      raw: alarm,
    }));

    const logRecords = DEMO_LOG_DAYS.flatMap((day, dayIndex) => day.users.map((user, index): TraceRecord => ({
      id: `LOG-${String(dayIndex + 1)}${String(index + 1).padStart(3, "0")}`,
      type: "Log",
      name: `Acesso de ${user.user}`,
      date: day.date,
      user: user.user,
      status: "Concluído",
      description: `${user.actions.length} ações registradas entre ${user.entry} e ${user.exit}.`,
      related: user.role,
      notes: user.actions.join("; "),
    })));

    const auditRecords = AUDIT_ROWS.map((row, index): TraceRecord => ({
      id: `AUD-${String(index + 1).padStart(4, "0")}`,
      type: "Auditoria",
      name: row[2],
      date: row[0],
      user: row[1],
      status: "Concluído",
      description: `${row[3]} alterado de ${row[4]} para ${row[5]}.`,
      related: row[3],
      notes: row[6],
    }));

    const exportRecords = EXPORT_ROWS.map((row): TraceRecord => ({
      id: row[0],
      type: "Relatório",
      name: row[1],
      date: row[3],
      user: row[4],
      status: "Exportado",
      description: `${row[1]} em formato ${row[2]}.`,
      related: row[5],
      notes: "Exportação preparada para integração com geração real de PDF.",
    }));

    return [...opRecords, ...simRecords, ...alarmRecords, ...logRecords, ...auditRecords, ...exportRecords]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [operations, simulations, localSimulations, alarms]);

  const rangeError = validateRange(dateRange);
  const reportRangeError = validateRange(reportRange);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();

    return traceRecords
      .filter((item) => TYPE_FILTERS[typeFilter] === "Todos" || item.type === TYPE_FILTERS[typeFilter])
      .filter((item) => statusFilter === "Todos" || item.status.toLowerCase().includes(statusFilter.toLowerCase()))
      .filter((item) => !userFilter || item.user.toLowerCase().includes(userFilter.toLowerCase()))
      .filter((item) => !rangeError && inDateRange(item.date, dateRange))
      .map((item) => {
        const haystack = `${item.type} ${item.id} ${item.name} ${item.user} ${item.status} ${formatDate(item.date)}`.toLowerCase();
        let score = 0;
        if (!term) score = 1;
        else if (haystack.includes(term)) score += 10;
        if (item.id.toLowerCase().startsWith(term)) score += 20;
        if (item.name.toLowerCase().includes(term)) score += 8;
        if (item.user.toLowerCase().includes(term)) score += 6;
        return { item, score };
      })
      .filter(({ score }) => !term || score > 0)
      .sort((a, b) => b.score - a.score || new Date(b.item.date).getTime() - new Date(a.item.date).getTime())
      .map(({ item }) => item);
  }, [traceRecords, search, typeFilter, statusFilter, userFilter, dateRange, rangeError]);

  const reportRecords = traceRecords.filter((item) => !reportRangeError && inDateRange(item.date, reportRange));
  const operationalCount = traceRecords.filter((item) => ["Operacional", "Concluído", "Exportado"].includes(item.status)).length;
  const warningCount = traceRecords.filter((item) => item.status.toLowerCase().includes("atenção")).length;
  const criticalCount = traceRecords.filter((item) => item.status.toLowerCase().includes("crítico")).length;

  function periodLabel(range: DateRange) {
    if (range.period === "today") return "Hoje";
    if (range.period === "7") return "Últimos 7 dias";
    if (range.period === "30") return "Últimos 30 dias";
    if (range.period === "custom") return `${range.start || "--"} a ${range.end || "--"}`;
    return "Todos os registros";
  }

  function generateReport(action: "model" | "pdf" | "doc") {
    if (reportRangeError) {
      setReportMessage(reportRangeError);
      return;
    }

    if (action === "model") {
      setReportMessage("Modelo formal exibido abaixo com identificação, resumo, tabelas e conclusão técnica.");
      return;
    }

    if (action === "pdf") {
      setReportMessage("Exportação preparada para integração com geração real de PDF.");
      return;
    }

    downloadDoc(`${reportType.replace(/\s+/g, "_")}_TSEA.doc`, buildReportHtml(reportType, periodLabel(reportRange), reportRecords));
    setReportMessage("Relatório preparado em formato Word para revisão técnica.");
  }

  function renderSearchAndFilters() {
    return (
      <div className="traceSearchBlock">
        <div className="traceSearchRow">
          <input
            className="traceSearchInput"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar por ID, operação, simulação, usuário, status ou data..."
          />
          <button className="secondary" onClick={() => setFilterOpen((current) => !current)}>Filtrar</button>
        </div>

        {filterOpen && (
          <div className="traceFilterPanel">
            <Field label="Tipo">
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                {Object.keys(TYPE_FILTERS).map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {["Todos", "Operacional", "Atenção", "Crítico", "Concluído", "Abortado", "Exportado"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Usuário">
              <input value={userFilter} onChange={(event) => setUserFilter(event.target.value)} placeholder="Nome do usuário" />
            </Field>
            <Field label="Período">
              <select value={dateRange.period} onChange={(event) => setDateRange((current) => ({ ...current, period: event.target.value as DateRange["period"] }))}>
                <option value="all">Todos</option>
                <option value="today">Hoje</option>
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="custom">Personalizado</option>
              </select>
            </Field>
            {dateRange.period === "custom" && (
              <>
                <Field label="Data inicial">
                  <input value={dateRange.start} onChange={(event) => setDateRange((current) => ({ ...current, start: event.target.value }))} placeholder="dd/mm/aaaa" />
                </Field>
                <Field label="Data final">
                  <input value={dateRange.end} onChange={(event) => setDateRange((current) => ({ ...current, end: event.target.value }))} placeholder="dd/mm/aaaa" />
                </Field>
              </>
            )}
            {rangeError && <div className="traceError">{rangeError}</div>}
          </div>
        )}
      </div>
    );
  }

  function renderRecordList(records: TraceRecord[]) {
    if (!records.length) return <Empty text="Nenhum registro encontrado para os filtros aplicados." />;

    return (
      <div className="traceResultList">
        {records.map((item) => (
          <article className={`traceResultCard ${selected?.id === item.id ? "active" : ""}`} key={`${item.type}-${item.id}`}>
            <div className="traceType">{item.type}</div>
            <b>{item.id}</b>
            <span>{item.name}</span>
            <span>{formatDate(item.date)}</span>
            <span>{item.user}</span>
            <Badge value={statusBadge(item.status)} />
            <button className="secondary" onClick={() => setSelected(selected?.id === item.id ? null : item)}>Ver</button>
          </article>
        ))}
      </div>
    );
  }

  function renderSelected() {
    if (!selected) return null;

    return (
      <div className="traceDetailPanel">
        <div className="traceDetailHeader">
          <div>
            <span>{selected.type}</span>
            <h3>{selected.id} · {selected.name}</h3>
          </div>
          <button className="secondary" onClick={() => setSelected(null)}>Fechar</button>
        </div>
        <div className="traceDetailGrid">
          <div><span>Usuário</span><b>{selected.user}</b></div>
          <div><span>Data/hora</span><b>{formatDate(selected.date)}</b></div>
          <div><span>Status</span><b>{selected.status}</b></div>
          <div><span>Dados relacionados</span><b>{selected.related}</b></div>
        </div>
        <p>{selected.description}</p>
        <small>{selected.notes}</small>
      </div>
    );
  }

  function renderRecords() {
    return (
      <>
        <Section title="Registros unificados" subtitle="Histórico, logs, auditoria e relatórios do processo.">
          <div className="traceMetricGrid">
            <Metric label="Total de registros" value={traceRecords.length} detail="Base consultável" />
            <Metric label="Operações" value={traceRecords.filter((item) => item.type === "Operação").length} detail="Ciclos registrados" status="success" />
            <Metric label="Simulações" value={traceRecords.filter((item) => item.type === "Simulação").length} detail="Gêmeo Digital" />
            <Metric label="Alertas" value={traceRecords.filter((item) => item.type === "Alerta").length} detail="Eventos técnicos" status={criticalCount ? "critical" : "warning"} />
            <Metric label="Relatórios gerados" value={traceRecords.filter((item) => item.type === "Relatório").length} detail="Exportações rastreadas" status="success" />
          </div>
          {renderSearchAndFilters()}
          {renderRecordList(filteredRecords)}
        </Section>
        {renderSelected()}
      </>
    );
  }

  function renderLogs() {
    return (
      <Section title="Logs de acesso" subtitle="Registros demonstrativos preparados para integração com login de usuários.">
        <div className="traceLogList">
          {DEMO_LOG_DAYS.map((day) => {
            const actions = day.users.reduce((sum, user) => sum + user.actions.length, 0);
            const key = day.date.slice(0, 10);
            return (
              <article className="traceLogDay" key={key}>
                <div className="traceLogSummary">
                  <b>{onlyDate(day.date)}</b>
                  <span>{day.users.length} usuários acessaram</span>
                  <span>{actions} ações registradas</span>
                  <button className="secondary" onClick={() => setExpandedLogDate(expandedLogDate === key ? "" : key)}>Ver detalhes</button>
                </div>
                {expandedLogDate === key && (
                  <div className="traceUserLogs">
                    {day.users.map((user) => (
                      <div className="traceUserLog" key={user.user}>
                        <strong>{user.user}</strong>
                        <span>{user.role} · Entrada {user.entry} · Saída {user.exit} · {user.actions.length} ações</span>
                        <ul>{user.actions.map((action) => <li key={action}>{action}</li>)}</ul>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </Section>
    );
  }

  function renderAudit() {
    return (
      <Section title="Auditoria de ações" subtitle="Mudanças relevantes com usuário, momento, área afetada e valores alterados.">
        <Table
          columns={["Data/hora", "Usuário", "Tipo de ação", "Área afetada", "Valor anterior", "Valor novo", "Observação"]}
          rows={AUDIT_ROWS.map((row) => [formatDate(row[0]), row[1], <b>{row[2]}</b>, row[3], row[4], row[5], row[6]])}
        />
      </Section>
    );
  }

  function renderReportCards() {
    const cards = [
      "Relatório de operação específica",
      "Relatório de simulação específica",
      "Relatório de todas as operações",
      "Relatório de todas as simulações",
      "Relatório geral",
    ];

    return (
      <Section title="Relatórios técnicos" subtitle="Geração visual de documentos formais com escopo e período definidos.">
        <div className="traceReportControls">
          <Field label="Tipo de relatório">
            <select value={reportType} onChange={(event) => setReportType(event.target.value)}>
              {cards.map((card) => <option key={card}>{card}</option>)}
            </select>
          </Field>
          <Field label="Período">
            <select value={reportRange.period} onChange={(event) => setReportRange((current) => ({ ...current, period: event.target.value as DateRange["period"] }))}>
              <option value="today">Hoje</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="custom">Personalizado</option>
              <option value="all">Todos</option>
            </select>
          </Field>
          {reportRange.period === "custom" && (
            <>
              <Field label="Data inicial">
                <input value={reportRange.start} onChange={(event) => setReportRange((current) => ({ ...current, start: event.target.value }))} placeholder="dd/mm/aaaa" />
              </Field>
              <Field label="Data final">
                <input value={reportRange.end} onChange={(event) => setReportRange((current) => ({ ...current, end: event.target.value }))} placeholder="dd/mm/aaaa" />
              </Field>
            </>
          )}
        </div>
        {reportRangeError && <div className="traceError">{reportRangeError}</div>}

        <div className="traceReportGrid">
          {cards.map((card) => (
            <article className={`traceReportCard ${reportType === card ? "active" : ""}`} key={card} onClick={() => setReportType(card)}>
              <strong>{card}</strong>
              <span>{card.includes("específica") ? "Pesquise e selecione um registro antes da emissão." : "Pode ser geral ou filtrado por data."}</span>
            </article>
          ))}
        </div>

        <div className="traceActions">
          <button onClick={() => generateReport("doc")}>Gerar relatório</button>
          <button className="secondary" onClick={() => generateReport("model")}>Visualizar modelo</button>
          <button className="secondary" onClick={() => generateReport("pdf")}>Preparar PDF</button>
        </div>
        {reportMessage && <div className="traceInfo">{reportMessage}</div>}

        <div className="traceReportPreview">
          <h3>{reportType}</h3>
          <p><b>Sistema:</b> TSEA V-Twin Supervisório Industrial</p>
          <p><b>Data de emissão:</b> {formatDate(new Date().toISOString())}</p>
          <p><b>Usuário que gerou:</b> Supervisor</p>
          <p><b>Período analisado:</b> {periodLabel(reportRange)}</p>
          {["Identificação do relatório", "Resumo geral", "Operações registradas", "Simulações executadas", "Alertas e eventos", "Logs de acesso", "Auditoria e alterações", "Indicadores", "Exportações", "Conclusão técnica"].map((topic, index) => (
            <div key={topic}>
              <h4>{index + 1}. {topic}</h4>
              <p>Seção formal do relatório técnico com tabela própria quando houver dados relacionados.</p>
            </div>
          ))}
        </div>
      </Section>
    );
  }

  function renderIndicators() {
    const avgRisk = traceRecords.filter((item) => item.type === "Simulação").length ? 42 : 0;
    return (
      <Section title="Indicadores" subtitle="Visão gerencial e técnica dos registros do sistema.">
        <div className="traceMetricGrid indicators">
          <Metric label="Total de operações" value={operations.length} detail="Registros reais" status="success" />
          <Metric label="Total de simulações" value={simulations.length + localSimulations.length} detail="Cenários executados" />
          <Metric label="Total de alertas" value={alarms.length} detail="Eventos técnicos" status={alarms.length ? "warning" : "success"} />
          <Metric label="Relatórios exportados" value={EXPORT_ROWS.length} detail="Documentos rastreados" status="success" />
          <Metric label="Taxa operacional" value={`${Math.round((operationalCount / Math.max(traceRecords.length, 1)) * 100)}%`} detail="Operacional/concluído" status="success" />
          <Metric label="Taxa atenção/crítico" value={`${Math.round(((warningCount + criticalCount) / Math.max(traceRecords.length, 1)) * 100)}%`} detail="Eventos com restrição" status={criticalCount ? "critical" : "warning"} />
          <Metric label="Pressão média final" value="6,5 mbar" detail="Referência consolidada" />
          <Metric label="Tempo médio de ciclo" value="900 s" detail="Estimativa operacional" />
          <Metric label="Risco médio" value={`${avgRisk}%`} detail="Simulações registradas" />
          <Metric label="Maior risco registrado" value={criticalCount ? "Crítico" : "Atenção"} detail="Pior ocorrência" status={criticalCount ? "critical" : "warning"} />
          <Metric label="Tanque com mais ocorrências" value="TQ-02" detail="Base demonstrativa" />
          <Metric label="Usuário com mais ações" value="João Martins" detail="Logs de acesso" />
        </div>
        <Table
          columns={["Indicador", "Valor", "Leitura técnica"]}
          rows={[
            ["Mangueira com maior perda", "MG-02", "Priorizar verificação de perda de carga."],
            ["Cenário mais executado", "Atraso do óleo", "Usado para validação de estabilidade do ciclo."],
            ["Área com mais auditorias", "Operação", "Alterações de pressão alvo e parâmetros de ciclo."],
          ]}
        />
      </Section>
    );
  }

  function renderExports() {
    return (
      <Section title="Exportações" subtitle="Relatórios e documentos preparados ou gerados.">
        <Table
          columns={["ID", "Tipo", "Formato", "Data de geração", "Usuário", "Período", "Status", "Ação"]}
          rows={EXPORT_ROWS.map((row) => [
            <b>{row[0]}</b>,
            row[1],
            row[2],
            formatDate(row[3]),
            row[4],
            row[5],
            <Badge value="success" />,
            <div className="traceActions inline">
              <button className="secondary" onClick={() => setReportMessage("Exportação preparada para integração com geração real de PDF.")}>Ver</button>
              <button onClick={() => setReportMessage("Exportação preparada para integração com geração real de PDF.")}>Baixar</button>
              <button className="secondary" onClick={() => setReportMessage("Relatório reenfileirado para geração visual.")}>Gerar novamente</button>
            </div>,
          ])}
        />
        {reportMessage && <div className="traceInfo">{reportMessage}</div>}
      </Section>
    );
  }

  return (
    <div className="screen traceabilityScreen">
      <Section
        title="Rastreabilidade"
        subtitle="Consulte operações, simulações, logs, auditorias e relatórios do sistema."
        action={<button className="traceMenuButton secondary" aria-label="Abrir navegação interna" onClick={() => setSidebarOpen(true)}>☰</button>}
      >
        <p className="traceLead">Histórico, logs, auditoria e relatórios do processo.</p>
      </Section>

      {active === "records" && renderRecords()}
      {active === "logs" && renderLogs()}
      {active === "audit" && renderAudit()}
      {active === "reports" && renderReportCards()}
      {active === "indicators" && renderIndicators()}
      {active === "exports" && renderExports()}

      {sidebarOpen && <div className="traceSideOverlay" onClick={() => setSidebarOpen(false)} />}
      <aside className={`traceSideNav ${sidebarOpen ? "open" : ""}`}>
        <div className="traceSideHeader">
          <div>
            <strong>Rastreabilidade</strong>
            <span>Navegação interna</span>
          </div>
          <button className="secondary" onClick={() => setSidebarOpen(false)} aria-label="Fechar navegação interna">×</button>
        </div>
        <nav>
          {SECTION_LABELS.map((item) => (
            <button
              key={item.key}
              className={active === item.key ? "active" : "secondary"}
              onClick={() => {
                setActive(item.key);
                setSidebarOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
    </div>
  );
}
