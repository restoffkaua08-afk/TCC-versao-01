import { useMemo, useState } from "react";
import { Badge, Empty, fmt, Section, Table } from "../components/ui";

type TraceTab = "records" | "logs" | "reports";
type TraceType = "Operação" | "Simulação";
type ReportExportType = "menu" | "general" | "operations" | "simulations" | "individualType" | "individualList" | "individualConfirm";

type Filters = {
  type: "Todos" | "Operações" | "Simulações";
  status: string;
  start: string;
  end: string;
};

type TraceItem = {
  id: string;
  type: TraceType;
  title: string;
  date: string;
  user: string;
  status: string;
  tank: string;
  hose: string;
  pressureInitial: number;
  pressureFinal: number;
  pressureTarget: number;
  cycleTime: string;
  oil: string;
  risk: number;
  result: string;
  observations: string;
  events: string[];
  scenario?: string;
  pump?: string;
  diagnosis?: string;
  recommendation?: string;
  parameters?: string[];
};

type LogUser = {
  user: string;
  role: string;
  entry: string;
  exit: string;
  actions: string[];
};

type LogDay = {
  date: string;
  lastAccess: string;
  users: LogUser[];
};

const BASE_FILTERS: Filters = {
  type: "Todos",
  status: "Todos",
  start: "",
  end: "",
};

const USERS = [
  "João Martins",
  "Maria Souza",
  "Carlos Lima",
  "Admin TSEA",
];

const DEMO_OPERATIONS: TraceItem[] = [
  {
    id: "OP-0007",
    type: "Operação",
    title: "Ciclo regulador TQ-02",
    date: "2026-03-05T14:20:00",
    user: "João Martins",
    status: "Operacional",
    tank: "TQ-02",
    hose: "MG-02",
    pressureInitial: 1013,
    pressureFinal: 6.2,
    pressureTarget: 8,
    cycleTime: "55 min",
    oil: "52 L · 2,2 L/min",
    risk: 18,
    result: "Ciclo concluído dentro da faixa operacional.",
    observations: "Operação sem restrições críticas. Curva compatível com o cenário esperado.",
    events: [
      "Operação iniciada pelo operador.",
      "Bomba primária acionada.",
      "Bomba Roots liberada após faixa segura.",
      "Injeção de óleo concluída.",
    ],
  },
  {
    id: "OP-0008",
    type: "Operação",
    title: "Ciclo regulador TQ-03",
    date: "2026-03-06T09:45:00",
    user: "Maria Souza",
    status: "Atenção",
    tank: "TQ-03",
    hose: "MG-03",
    pressureInitial: 1012,
    pressureFinal: 11.8,
    pressureTarget: 8,
    cycleTime: "61 min",
    oil: "48 L · 1,8 L/min",
    risk: 63,
    result: "Ciclo concluído com acompanhamento recomendado.",
    observations: "Vazão de óleo abaixo da referência e pressão final acima do alvo.",
    events: [
      "Operação iniciada.",
      "Curva de pressão apresentou desaceleração.",
      "Sistema de óleo exigiu acompanhamento.",
      "Operação finalizada com atenção.",
    ],
  },
];

const DEMO_SIMULATIONS: TraceItem[] = [
  {
    id: "SIM-0012",
    type: "Simulação",
    title: "Atraso do óleo",
    scenario: "Atraso do óleo",
    date: "2026-03-05T15:10:00",
    user: "Maria Souza",
    status: "Atenção",
    tank: "TQ-02",
    hose: "MG-02",
    pressureInitial: 1013,
    pressureFinal: 9.4,
    pressureTarget: 8,
    cycleTime: "58 min estimados",
    oil: "Atraso de 120 s · 1,7 L/min",
    risk: 68,
    pump: "B1/B2",
    diagnosis: "Atraso no óleo aumentou a instabilidade da curva e reduziu a margem operacional.",
    recommendation: "Revisar vazão de óleo, sensor de volume e condição da mangueira antes da operação.",
    result: "Simulação aprovada com restrição.",
    observations: "Cenário útil para validar resposta do sistema em condição de óleo abaixo do ideal.",
    events: [
      "Cenário selecionado.",
      "Parâmetros de pressão carregados.",
      "Atraso do óleo aplicado.",
      "Diagnóstico gerado com atenção.",
    ],
    parameters: [
      "Pressão alvo: 8 mbar",
      "Roots: 50 mbar",
      "Vazão de óleo: 1,7 L/min",
      "Margem de erro: 8%",
    ],
  },
  {
    id: "SIM-0013",
    type: "Simulação",
    title: "Tanque com geometria crítica",
    scenario: "Tanque com geometria crítica",
    date: "2026-03-06T10:30:00",
    user: "Carlos Lima",
    status: "Crítico",
    tank: "TQ-CRIT",
    hose: "MG-02",
    pressureInitial: 1013,
    pressureFinal: 5.8,
    pressureTarget: 8,
    cycleTime: "64 min estimados",
    oil: "50 L · 2,0 L/min",
    risk: 87,
    pump: "B1",
    diagnosis: "A combinação de queda rápida de pressão e geometria crítica elevou o risco estrutural.",
    recommendation: "Bloquear execução e revisar parâmetros de rampa, geometria e limite estrutural.",
    result: "Simulação reprovada.",
    observations: "Cenário baseado em condição crítica para análise de risco estrutural.",
    events: [
      "Cenário crítico executado.",
      "Risco estrutural acima do limite.",
      "Recomendação de bloqueio gerada.",
    ],
    parameters: [
      "Diâmetro acima da referência",
      "Chapa crítica",
      "Queda de pressão rápida",
      "Risco estrutural elevado",
    ],
  },
];

const LOG_DAYS: LogDay[] = [
  {
    date: "2026-03-05",
    lastAccess: "17:42",
    users: [
      {
        user: "João Martins",
        role: "Operador",
        entry: "08:12",
        exit: "11:40",
        actions: [
          "Acessou o sistema.",
          "Iniciou operação OP-0007.",
          "Visualizou simulação SIM-0012.",
          "Exportou relatório da operação OP-0007.",
        ],
      },
      {
        user: "Maria Souza",
        role: "Supervisora",
        entry: "13:20",
        exit: "16:10",
        actions: [
          "Acessou o sistema.",
          "Criou simulação SIM-0012.",
          "Alterou parâmetro de pressão alvo.",
          "Visualizou relatório geral.",
        ],
      },
      {
        user: "Carlos Lima",
        role: "Manutenção",
        entry: "15:22",
        exit: "17:42",
        actions: [
          "Consultou perda de carga da mangueira MG-02.",
          "Visualizou detalhes de máquinas.",
          "Registrou observação técnica demonstrativa.",
        ],
      },
    ],
  },
  {
    date: "2026-03-06",
    lastAccess: "16:18",
    users: [
      {
        user: "João Martins",
        role: "Operador",
        entry: "07:58",
        exit: "12:05",
        actions: [
          "Acessou o sistema.",
          "Consultou registros de operação.",
          "Visualizou detalhes da operação OP-0008.",
        ],
      },
      {
        user: "Admin TSEA",
        role: "Administrador",
        entry: "13:30",
        exit: "16:18",
        actions: [
          "Acessou o sistema.",
          "Visualizou logs de acesso.",
          "Preparou relatório geral demonstrativo.",
        ],
      },
    ],
  },
];

function readLocalArray(key: string) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatOnlyDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("pt-BR");
}

function parsePtDate(value: string) {
  const clean = value.trim();
  if (!clean) return null;

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(clean);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function validateDateRange(filters: Filters) {
  if (!filters.start && !filters.end) return "";

  const start = filters.start ? parsePtDate(filters.start) : null;
  const end = filters.end ? parsePtDate(filters.end) : null;
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (filters.start && !start) return "Data inicial inválida. Use o formato dd/mm/aaaa.";
  if (filters.end && !end) return "Data final inválida. Use o formato dd/mm/aaaa.";
  if (start && start > today) return "A data inicial não pode ser futura.";
  if (end && end > today) return "A data final não pode ser futura.";
  if (start && end && end < start) return "A data final não pode ser menor que a data inicial.";

  return "";
}

function inDateRange(dateValue: string, filters: Filters) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return true;

  const start = filters.start ? parsePtDate(filters.start) : null;
  const end = filters.end ? parsePtDate(filters.end) : null;

  if (start && date < start) return false;

  if (end) {
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);
    if (date > endOfDay) return false;
  }

  return true;
}

function statusTone(status: string) {
  const value = status.toLowerCase();
  if (value.includes("crítico") || value.includes("abortado") || value.includes("reprov")) return "critical";
  if (value.includes("atenção") || value.includes("restrição")) return "warning";
  return "success";
}

function operationRecord(item: any, index: number): TraceItem {
  const id = String(item?.id || `OP-${String(index + 1).padStart(4, "0")}`);
  const date = item?.created_at || item?.started_at || item?.date || new Date().toISOString();
  const status = item?.status || "Operacional";

  return {
    id,
    type: "Operação",
    title: item?.name || item?.title || `Ciclo regulador ${item?.tank || item?.config?.tank_type || "TSEA"}`,
    date,
    user: item?.operator || item?.user || USERS[index % USERS.length],
    status: status === "success" ? "Operacional" : status,
    tank: item?.tank || item?.config?.tank_type || "TQ-01",
    hose: item?.hose || item?.config?.hose_id || "MG-01",
    pressureInitial: Number(item?.initial_pressure_mbar || 1013),
    pressureFinal: Number(item?.final_pressure_mbar || item?.pressure_mbar || 8),
    pressureTarget: Number(item?.target_pressure_mbar || 8),
    cycleTime: item?.cycle_time || item?.duration || "55 min",
    oil: item?.oil || `${fmt(item?.oil_volume_liters || 50, "L")} · ${fmt(item?.oil_flow_l_min || 2, "L/min")}`,
    risk: Number(item?.risk || item?.collapse_risk_pct || 18),
    result: item?.result || "Operação registrada para consulta técnica.",
    observations: item?.notes || item?.observations || "Registro operacional disponível para análise e relatório.",
    events: item?.events || [
      "Operação registrada no sistema.",
      "Parâmetros operacionais validados.",
      "Resultado disponível para rastreabilidade.",
    ],
  };
}

function simulationRecord(item: any, index: number): TraceItem {
  const id = String(item?.id || `SIM-${String(index + 1).padStart(4, "0")}`);
  const metrics = item?.metrics || {};
  const config = item?.config || {};
  const risk = Number(metrics?.max_collapse_risk_pct || item?.risk || 32);

  return {
    id,
    type: "Simulação",
    title: item?.scenario || item?.name || item?.title || "Simulação do Gêmeo Digital",
    scenario: item?.scenario || item?.name || "Cenário simulado",
    date: item?.created_at || item?.date || new Date().toISOString(),
    user: item?.operator || item?.user || USERS[(index + 1) % USERS.length],
    status: item?.status === "critical" ? "Crítico" : item?.status === "warning" ? "Atenção" : "Operacional",
    tank: config?.tank_type || item?.tank || "TQ-01",
    hose: config?.hose_id || item?.hose || "MG-01",
    pressureInitial: Number(config?.initial_pressure_mbar || 1013),
    pressureFinal: Number(metrics?.final_real_pressure_mbar || item?.pressureFinal || 8),
    pressureTarget: Number(config?.target_pressure_mbar || 8),
    cycleTime: `${fmt(metrics?.estimated_time_seconds || 900, "s")} estimados`,
    oil: `${fmt(config?.oil_flow_l_min || metrics?.oil_flow_l_min || 2, "L/min")}`,
    risk,
    pump: "B1/B2",
    diagnosis: item?.diagnosis || "Diagnóstico preparado pela simulação do Gêmeo Digital.",
    recommendation: item?.recommendation || "Revisar parâmetros conforme status da simulação.",
    result: item?.result || "Simulação registrada para consulta técnica.",
    observations: item?.notes || "Cenário disponível para comparação e relatório.",
    events: item?.events || [
      "Cenário selecionado.",
      "Parâmetros carregados.",
      "Simulação executada.",
      "Resultado registrado.",
    ],
    parameters: [
      `Pressão alvo: ${fmt(config?.target_pressure_mbar || 8, "mbar")}`,
      `Roots: ${fmt(config?.roots_start_pressure_mbar || 50, "mbar")}`,
      `Vazão de óleo: ${fmt(config?.oil_flow_l_min || 2, "L/min")}`,
      `Risco: ${fmt(risk, "%")}`,
    ],
  };
}

function periodText(filters: Filters) {
  if (filters.start || filters.end) {
    return `${filters.start || "início"} a ${filters.end || "atual"}`;
  }
  return "Todos os registros disponíveis";
}

function buildMachineTables(item: TraceItem) {
  const pumpRows = [
    ["B1", "Bomba primária", "Leybold SOGEVAC SV 630 B", "Evacuação inicial", item.type === "Operação" ? "Pronta/Ligada" : "Simulada", "96%", "Atuação principal no início do ciclo."],
    ["B2", "Bomba secundária / Roots", "Leybold RUVAC WSU 2001", "Reforço do vácuo", item.status === "Crítico" ? "Bloqueada" : "Liberada", "88%", "Acionamento condicionado à faixa segura."],
  ];

  const tankRows = [
    [item.tank, "Tanque de processo", fmt(item.pressureFinal, "mbar"), fmt(item.pressureTarget, "mbar"), item.oil, fmt(item.risk, "%"), item.status],
  ];

  const sensorRows = [
    ["Sensor de pressão", fmt(item.pressureFinal, "mbar"), "mbar", item.status, "Leitura associada ao tanque selecionado."],
    ["Sistema de óleo", item.oil, "L / L/min", item.risk >= 65 ? "Atenção" : "Operacional", "Dados usados na análise de estabilidade."],
    ["Mangueira", item.hose, "identificação", "Vinculada", "Elemento relacionado a perda de carga."],
  ];

  return { pumpRows, tankRows, sensorRows };
}

function ReportPreview({ title, countText, period }: { title: string; countText: string; period: string }) {
  return (
    <div className="trace-report-preview">
      <h4>{title}</h4>
      <p>{countText}</p>
      <p>
        <strong>Período:</strong> {period}
      </p>
      <div className="trace-report-format">
        <strong>Estrutura prevista do documento:</strong>
        <ol>
          <li>Identificação do relatório</li>
          <li>Resumo executivo</li>
          <li>Tabelas separadas por tipo de registro</li>
          <li>Máquinas, componentes e eventos relacionados</li>
          <li>Conclusão técnica</li>
        </ol>
      </div>
    </div>
  );
}

export function TraceabilityPage({
  operations = [],
  simulations = [],
}: {
  operations?: any[];
  simulations?: any[];
  alarms?: any[];
}) {
  const [active, setActive] = useState<TraceTab>("records");
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(BASE_FILTERS);
  const [reportFilters, setReportFilters] = useState<Filters>(BASE_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [reportFilterOpen, setReportFilterOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TraceItem | null>(null);
  const [machineMode, setMachineMode] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogDay | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStep, setExportStep] = useState<ReportExportType>("menu");
  const [individualKind, setIndividualKind] = useState<TraceType | null>(null);
  const [individualItem, setIndividualItem] = useState<TraceItem | null>(null);
  const [message, setMessage] = useState("");

  const traceItems = useMemo(() => {
    const localSimulations = [
      ...readLocalArray("tsea.gemeo10.history"),
      ...readLocalArray("tsea.simulationHistory.final"),
    ];

    const opItems = operations.length ? operations.map(operationRecord) : DEMO_OPERATIONS;
    const simSource = simulations.length || localSimulations.length ? [...simulations, ...localSimulations] : DEMO_SIMULATIONS;
    const simItems = simSource.map(simulationRecord);

    return [...opItems, ...simItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [operations, simulations]);

  const filteredRecords = useMemo(() => filterItems(traceItems, search, filters), [traceItems, search, filters]);
  const filteredReportRecords = useMemo(() => filterItems(traceItems, reportSearch, reportFilters), [traceItems, reportSearch, reportFilters]);

  const operationCount = traceItems.filter((item) => item.type === "Operação").length;
  const simulationCount = traceItems.filter((item) => item.type === "Simulação").length;
  const alertCount = traceItems.filter((item) => item.status === "Atenção" || item.status === "Crítico").length;
  const filtersError = validateDateRange(filters);
  const reportFiltersError = validateDateRange(reportFilters);

  function filterItems(items: TraceItem[], query: string, appliedFilters: Filters) {
    const error = validateDateRange(appliedFilters);
    if (error) return [];

    const term = query.trim().toLowerCase();

    return items
      .filter((item) => {
        if (appliedFilters.type === "Operações" && item.type !== "Operação") return false;
        if (appliedFilters.type === "Simulações" && item.type !== "Simulação") return false;
        if (appliedFilters.status !== "Todos" && item.status !== appliedFilters.status) return false;
        if (!inDateRange(item.date, appliedFilters)) return false;
        return true;
      })
      .map((item) => {
        const haystack = `${item.type} ${item.id} ${item.title} ${item.date} ${item.status} ${item.user}`.toLowerCase();
        let score = 0;

        if (!term) score = 1;
        if (item.id.toLowerCase().startsWith(term)) score += 30;
        if (item.title.toLowerCase().includes(term)) score += 20;
        if (haystack.includes(term)) score += 10;

        return { item, score };
      })
      .filter(({ score }) => !term || score > 0)
      .sort((a, b) => b.score - a.score || new Date(b.item.date).getTime() - new Date(a.item.date).getTime())
      .map(({ item }) => item);
  }

  function openDetails(item: TraceItem) {
    setSelectedItem(item);
    setMachineMode(false);
    setMessage("");
  }

  function preparedPdfMessage() {
    setMessage("Relatório preparado para exportação em PDF.");
  }

  function renderTraceabilityNavigation() {
    const tabs: { key: TraceTab; label: string; description: string }[] = [
      { key: "records", label: "Registros", description: "Operações e simulações" },
      { key: "logs", label: "Logs de Acesso", description: "Acessos e ações por dia" },
      { key: "reports", label: "Relatórios", description: "Exportação técnica" },
    ];

    return (
      <>
        {navigationOpen && (
          <div className="trace-nav-overlay" role="presentation" onClick={() => setNavigationOpen(false)} />
        )}

        <aside className={`trace-nav-drawer ${navigationOpen ? "open" : ""}`}>
          <div className="trace-nav-drawer-header">
            <div>
              <span>Rastreabilidade</span>
              <strong>Navegação rápida</strong>
            </div>
            <button className="btn ghost" onClick={() => setNavigationOpen(false)}>
              Fechar
            </button>
          </div>

          <div className="trace-nav-drawer-list">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={active === tab.key ? "active" : ""}
                onClick={() => {
                  setActive(tab.key);
                  setNavigationOpen(false);
                }}
              >
                <strong>{tab.label}</strong>
                <span>{tab.description}</span>
              </button>
            ))}
          </div>
        </aside>
      </>
    );
  }

  function renderFilterModal(kind: "records" | "reports") {
    const current = kind === "records" ? filters : reportFilters;
    const setCurrent = kind === "records" ? setFilters : setReportFilters;
    const error = validateDateRange(current);

    return (
      <div className="trace-filter-popover">
        <FieldLike label="Tipo">
          <select
            value={current.type}
            onChange={(event) => setCurrent({ ...current, type: event.target.value as Filters["type"] })}
          >
            <option>Todos</option>
            <option>Operações</option>
            <option>Simulações</option>
          </select>
        </FieldLike>

        <FieldLike label="Status">
          <select
            value={current.status}
            onChange={(event) => setCurrent({ ...current, status: event.target.value })}
          >
            <option>Todos</option>
            <option>Operacional</option>
            <option>Atenção</option>
            <option>Crítico</option>
            <option>Concluído</option>
            <option>Abortado</option>
          </select>
        </FieldLike>

        <FieldLike label="Data inicial">
          <input
            value={current.start}
            onChange={(event) => setCurrent({ ...current, start: event.target.value })}
            placeholder="dd/mm/aaaa"
          />
        </FieldLike>

        <FieldLike label="Data final">
          <input
            value={current.end}
            onChange={(event) => setCurrent({ ...current, end: event.target.value })}
            placeholder="dd/mm/aaaa"
          />
        </FieldLike>

        {error && <p className="trace-form-error">{error}</p>}

        <div className="trace-filter-actions">
          <button
            className="btn ghost"
            onClick={() => setCurrent(BASE_FILTERS)}
          >
            Limpar
          </button>
          <button
            className="btn"
            onClick={() => kind === "records" ? setFilterOpen(false) : setReportFilterOpen(false)}
          >
            Aplicar
          </button>
        </div>
      </div>
    );
  }

  function renderSearchBar(kind: "records" | "reports") {
    const isReport = kind === "reports";

    return (
      <div className="trace-search-row">
        <input
          className="trace-search-input"
          value={isReport ? reportSearch : search}
          onChange={(event) => isReport ? setReportSearch(event.target.value) : setSearch(event.target.value)}
          placeholder="Pesquisar por ID, operação, simulação, usuário, status ou data..."
        />

        <div className="trace-filter-wrap">
          <button
            className="btn ghost"
            onClick={() => isReport ? setReportFilterOpen((current) => !current) : setFilterOpen((current) => !current)}
          >
            Filtrar
          </button>

          {(isReport ? reportFilterOpen : filterOpen) && renderFilterModal(kind)}
        </div>

        {isReport && (
          <button
            className="btn success"
            onClick={() => {
              setExportOpen(true);
              setExportStep("menu");
              setIndividualKind(null);
              setIndividualItem(null);
              setMessage("");
            }}
          >
            Exportar relatório
          </button>
        )}
      </div>
    );
  }

  function renderRecordList(items: TraceItem[]) {
    if (!items.length) {
      return <Empty text="Nenhuma operação ou simulação encontrada para os filtros informados." />;
    }

    return (
      <div className="trace-result-list">
        {items.map((item) => (
          <article key={item.id} className="trace-result-card">
            <div className="trace-result-type">
              <span>{item.type}</span>
              <Badge value={statusTone(item.status)} />
            </div>

            <div className="trace-result-main">
              <strong>{item.id} · {item.title}</strong>
              <span>{formatDate(item.date)} · {item.user}</span>
            </div>

            <div className="trace-result-meta">
              <span>Status</span>
              <strong>{item.status}</strong>
            </div>

            <button className="btn ghost" onClick={() => openDetails(item)}>
              Ver
            </button>
          </article>
        ))}
      </div>
    );
  }

  function renderRecords() {
    return (
      <>
        <Section
          title="Registros"
          subtitle="Consulte somente operações e simulações registradas no sistema."
        >
          {renderSearchBar("records")}
          {filtersError && <p className="trace-form-error">{filtersError}</p>}
          {renderRecordList(filteredRecords)}
        </Section>
      </>
    );
  }

  function renderLogs() {
    return (
      <Section
        title="Logs de Acesso"
        subtitle="Logs demonstrativos preparados para futura integração com login de usuários."
      >
        <div className="trace-log-list">
          {LOG_DAYS.map((day) => {
            const actionCount = day.users.reduce((sum, user) => sum + user.actions.length, 0);

            return (
              <article className="trace-log-card" key={day.date}>
                <div>
                  <strong>{formatOnlyDate(day.date)}</strong>
                  <span>{day.users.length} usuários acessaram</span>
                </div>

                <div>
                  <span>Ações registradas</span>
                  <strong>{actionCount}</strong>
                </div>

                <div>
                  <span>Último acesso</span>
                  <strong>{day.lastAccess}</strong>
                </div>

                <button className="btn ghost" onClick={() => setSelectedLog(day)}>
                  Ver
                </button>
              </article>
            );
          })}
        </div>
      </Section>
    );
  }

  function renderReports() {
    return (
      <Section
        title="Relatórios técnicos"
        subtitle="Gere relatórios por operação, simulação ou período."
        action={
          <button
            className="btn success"
            onClick={() => {
              setExportOpen(true);
              setExportStep("menu");
              setIndividualKind(null);
              setIndividualItem(null);
              setMessage("");
            }}
          >
            Exportar relatório
          </button>
        }
      >
        {renderSearchBar("reports")}
        {reportFiltersError && <p className="trace-form-error">{reportFiltersError}</p>}
        {renderRecordList(filteredReportRecords)}
      </Section>
    );
  }

  function renderDetailsModal() {
    if (!selectedItem) return null;

    const machines = buildMachineTables(selectedItem);

    return (
      <div className="trace-modal-backdrop" role="dialog" aria-modal="true">
        <div className="trace-modal trace-modal-wide">
          <div className="trace-modal-header">
            <div>
              <span className="trace-eyebrow">{selectedItem.type}</span>
              <h3>{selectedItem.id} · {selectedItem.title}</h3>
              <p>{formatDate(selectedItem.date)} · {selectedItem.user}</p>
            </div>

            <button className="btn ghost" onClick={() => setSelectedItem(null)}>
              Fechar
            </button>
          </div>

          {!machineMode ? (
            <>
              <div className="trace-detail-grid">
                <Info label="Status" value={selectedItem.status} />
                <Info label="Tanque" value={selectedItem.tank} />
                <Info label="Mangueira" value={selectedItem.hose} />
                <Info label="Pressão inicial" value={fmt(selectedItem.pressureInitial, "mbar")} />
                <Info label="Pressão final" value={fmt(selectedItem.pressureFinal, "mbar")} />
                <Info label="Pressão alvo" value={fmt(selectedItem.pressureTarget, "mbar")} />
                <Info label="Tempo de ciclo" value={selectedItem.cycleTime} />
                <Info label="Óleo" value={selectedItem.oil} />
                <Info label="Risco estrutural" value={fmt(selectedItem.risk, "%")} />
                {selectedItem.type === "Simulação" && <Info label="Cenário" value={selectedItem.scenario || selectedItem.title} />}
                {selectedItem.type === "Simulação" && <Info label="Bomba envolvida" value={selectedItem.pump || "B1/B2"} />}
              </div>

              <div className="trace-detail-block">
                <h4>Resultado</h4>
                <p>{selectedItem.result}</p>
              </div>

              {selectedItem.diagnosis && (
                <div className="trace-detail-block">
                  <h4>Diagnóstico</h4>
                  <p>{selectedItem.diagnosis}</p>
                </div>
              )}

              {selectedItem.recommendation && (
                <div className="trace-detail-block">
                  <h4>Recomendação</h4>
                  <p>{selectedItem.recommendation}</p>
                </div>
              )}

              <div className="trace-detail-block">
                <h4>Observações</h4>
                <p>{selectedItem.observations}</p>
              </div>

              <div className="trace-detail-block">
                <h4>Eventos importantes</h4>
                <ul>
                  {selectedItem.events.map((event) => (
                    <li key={event}>{event}</li>
                  ))}
                </ul>
              </div>

              {selectedItem.parameters?.length ? (
                <div className="trace-detail-block">
                  <h4>Parâmetros usados</h4>
                  <ul>
                    {selectedItem.parameters.map((parameter) => (
                      <li key={parameter}>{parameter}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <div className="trace-machine-view">
              <button className="btn ghost" onClick={() => setMachineMode(false)}>
                Voltar aos dados
              </button>

              <h4>Máquinas e componentes vinculados</h4>

              <Table
                columns={["Código", "Equipamento", "Modelo", "Função", "Estado", "Desempenho", "Observação"]}
                rows={machines.pumpRows}
              />

              <Table
                columns={["Código", "Tipo", "Pressão atual/final", "Pressão alvo", "Volume de óleo", "Risco", "Status"]}
                rows={machines.tankRows}
              />

              <Table
                columns={["Componente", "Leitura/valor", "Unidade", "Status", "Observação"]}
                rows={machines.sensorRows}
              />
            </div>
          )}

          {message && <p className="trace-message">{message}</p>}

          <div className="trace-modal-actions">
            {!machineMode && (
              <button className="btn ghost" onClick={() => setMachineMode(true)}>
                Ver máquinas
              </button>
            )}
            <button className="btn success" onClick={preparedPdfMessage}>
              Exportar PDF
            </button>
            <button className="btn ghost" onClick={() => setSelectedItem(null)}>
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderLogModal() {
    if (!selectedLog) return null;

    return (
      <div className="trace-modal-backdrop" role="dialog" aria-modal="true">
        <div className="trace-modal trace-modal-wide">
          <div className="trace-modal-header">
            <div>
              <span className="trace-eyebrow">Logs de Acesso</span>
              <h3>{formatOnlyDate(selectedLog.date)}</h3>
              <p>{selectedLog.users.length} usuários · último acesso {selectedLog.lastAccess}</p>
            </div>

            <button className="btn ghost" onClick={() => setSelectedLog(null)}>
              Fechar
            </button>
          </div>

          <div className="trace-user-log-list">
            {selectedLog.users.map((user) => (
              <article className="trace-user-log-card" key={user.user}>
                <div>
                  <h4>{user.user}</h4>
                  <p>{user.role} · Entrada {user.entry} · Saída {user.exit}</p>
                  <strong>{user.actions.length} ações registradas</strong>
                </div>

                <ul>
                  {user.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderExportModal() {
    if (!exportOpen) return null;

    const operationsList = filteredReportRecords.filter((item) => item.type === "Operação");
    const simulationsList = filteredReportRecords.filter((item) => item.type === "Simulação");
    const period = periodText(reportFilters);

    function exportPrepared() {
      setMessage("Relatório preparado para exportação em PDF.");
    }

    function resetExport() {
      setExportStep("menu");
      setIndividualKind(null);
      setIndividualItem(null);
      setMessage("");
    }

    return (
      <div className="trace-modal-backdrop" role="dialog" aria-modal="true">
        <div className="trace-modal trace-modal-wide">
          <div className="trace-modal-header">
            <div>
              <span className="trace-eyebrow">Relatórios técnicos</span>
              <h3>Exportar relatório</h3>
              <p>Escolha o escopo do documento antes da exportação.</p>
            </div>

            <button className="btn ghost" onClick={() => setExportOpen(false)}>
              Fechar
            </button>
          </div>

          {exportStep === "menu" && (
            <div className="trace-export-options">
              <button onClick={() => setExportStep("general")}>Geral</button>
              <button onClick={() => setExportStep("operations")}>Operações</button>
              <button onClick={() => setExportStep("simulations")}>Simulações</button>
              <button onClick={() => setExportStep("individualType")}>Individual</button>
            </div>
          )}

          {exportStep === "general" && (
            <>
              <ReportPreview
                title="Relatório geral"
                countText={`Operações incluídas: ${operationsList.length} · Simulações incluídas: ${simulationsList.length} · Alertas considerados: ${alertCount}`}
                period={period}
              />
              <ModalBackExport onBack={resetExport} onExport={exportPrepared} />
            </>
          )}

          {exportStep === "operations" && (
            <>
              <ReportPreview
                title="Relatório de operações"
                countText={`Operações incluídas: ${operationsList.length}`}
                period={period}
              />
              <ModalBackExport onBack={resetExport} onExport={exportPrepared} />
            </>
          )}

          {exportStep === "simulations" && (
            <>
              <ReportPreview
                title="Relatório de simulações"
                countText={`Simulações incluídas: ${simulationsList.length}`}
                period={period}
              />
              <ModalBackExport onBack={resetExport} onExport={exportPrepared} />
            </>
          )}

          {exportStep === "individualType" && (
            <div className="trace-export-options">
              <button
                onClick={() => {
                  setIndividualKind("Operação");
                  setExportStep("individualList");
                }}
              >
                Operação específica
              </button>
              <button
                onClick={() => {
                  setIndividualKind("Simulação");
                  setExportStep("individualList");
                }}
              >
                Simulação específica
              </button>
            </div>
          )}

          {exportStep === "individualList" && individualKind && (
            <>
              <div className="trace-individual-list">
                {filteredReportRecords
                  .filter((item) => item.type === individualKind)
                  .map((item) => (
                    <article key={item.id} className="trace-individual-row">
                      <div>
                        <strong>{item.title}</strong>
                        <span>{formatDate(item.date)} · {item.id} · {item.status}</span>
                      </div>
                      <button
                        className="btn ghost"
                        onClick={() => {
                          setIndividualItem(item);
                          setExportStep("individualConfirm");
                        }}
                      >
                        Selecionar
                      </button>
                    </article>
                  ))}
              </div>

              <div className="trace-modal-actions">
                <button className="btn ghost" onClick={() => setExportStep("individualType")}>
                  Voltar
                </button>
              </div>
            </>
          )}

          {exportStep === "individualConfirm" && individualItem && (
            <>
              <ReportPreview
                title={`Relatório individual · ${individualItem.type}`}
                countText={`${individualItem.id} · ${individualItem.title} · ${individualItem.status}`}
                period={formatDate(individualItem.date)}
              />
              <ModalBackExport onBack={() => setExportStep("individualList")} onExport={exportPrepared} />
            </>
          )}

          {message && <p className="trace-message">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="trace-page">
      <Section
        title="Rastreabilidade"
        subtitle="Consulte operações, simulações, logs de acesso e relatórios técnicos do sistema."
        action={
          <button
            className="trace-nav-toggle"
            aria-label="Abrir submenus de rastreabilidade"
            title="Submenus"
            onClick={() => setNavigationOpen(true)}
          >
            ☰
          </button>
        }
      >
        {renderTraceabilityNavigation()}

        {active === "records" && renderRecords()}
        {active === "logs" && renderLogs()}
        {active === "reports" && renderReports()}
      </Section>

      {renderDetailsModal()}
      {renderLogModal()}
      {renderExportModal()}
    </div>
  );
}

function FieldLike({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="trace-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="trace-info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ModalBackExport({ onBack, onExport }: { onBack: () => void; onExport: () => void }) {
  return (
    <div className="trace-modal-actions">
      <button className="btn ghost" onClick={onBack}>Voltar</button>
      <button className="btn success" onClick={onExport}>Exportar relatório</button>
    </div>
  );
}


