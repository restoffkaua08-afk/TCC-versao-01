import { HardwareBridgePanel } from "./HardwareBridgePanel";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Phase =
  | "boot"
  | "inicial"
  | "preparar_receita"
  | "preparar_dados"
  | "checklist_pre"
  | "revisao"
  | "operação"
  | "finalizacao"
  | "registros_dia"
  | "alarmes";

type OperationTab = "reguladores" | "bombas" | "óleo" | "informacoes";
type Status = "PRONTO" | "EM CICLO" | "PAUSADO" | "FINALIZADO" | "BLOQUEADO";
type RecipeKey = string;
type HoseKey = string;
type AlarmSeverity = "yellow" | "red";

type ChecklistPre = {
  mangueira: boolean;
  valvulaSuperior: boolean;
  valvulaInferior: boolean;
  tanquesPosicionados: boolean;
  óleoDisponivel: boolean;
  emergênciaLiberada: boolean;
  sensoresComunicando: boolean;
  intertravamentosLiberados: boolean;
  receitaRevisada: boolean;
};

type ChecklistPos = {
  tempoOk: boolean;
  semAnomalia: boolean;
  óleoRestanteVisivel: boolean;
  pressãoFinalOk: boolean;
  bombasDesligaram: boolean;
  linhaÓleoFinalizada: boolean;
  operadorConfirmouFisico: boolean;
  alarmesRevisados: boolean;
  dadosEnviados: boolean;
  observacao?: string;
};

type Recipe = {
  id: RecipeKey;
  title: string;
  tipoTanque: string;
  tempoEstimado: number;
  pressãoAlvo: number;
  b2StartSeg: number;
  oilStartSeg: number;
  estabilizacaoSeg: number;
  óleoPorTanque: number;
  observacao: string;
};

type Hose = {
  id: HoseKey;
  descricao: string;
  perdaBase: number;
  comprimento: number;
};

type Registro = {
  id: string;
  horario: string;
  status: string;
  qtdTanques: number;
  receita: string;
  mangueira: string;
};

type AlarmInfo = {
  key: string;
  severity: AlarmSeverity;
  title: string;
  message: string;
};

// TSEA_IHM_MAINTENANCE
// A IHM não possui cadastros fixos.
// Receitas, tanques e mangueiras vêm do Gateway físico.
// Manutenção futura: manter as regras críticas também no backend.
const GATEWAY_API = "/api";
const GATEWAY_API_BASES = ["/api"];

const OPERATIONAL_LIMITS = {
  tankMin: 1,
  tankMax: 3,
  oilMinL: 0,
  oilMaxL: 300,
  oilStepL: 1,
  pressureMinMbar: 0.01,
  pressureMaxMbar: 1013,
  maxCycleSeconds: 3600,
  minCycleSeconds: 30,
  maxHoseLossMbar: 15,
};

const ALARM_TEXT = {
  gatewayOffline: {
    code: "ALM-001",
    title: "GATEWAY OFFLINE",
    message: "A IHM perdeu comunicação com o Gateway. Verifique servidor, cabo, Wi-Fi ou rede local.",
  },
  oilShortage: {
    code: "ALM-002",
    title: "ÓLEO INSUFICIENTE",
    message: "O volume informado não cobre a receita selecionada.",
  },
  sensorOffline: {
    code: "ALM-003",
    title: "SENSOR DE PRESSÃO OFFLINE",
    message: "O sensor de pressão/vácuo não está comunicando corretamente.",
  },
  emergency: {
    code: "ALM-004",
    title: "EMERGÊNCIA / PARADA CRÍTICA",
    message: "Condição crítica detectada. O ciclo deve ser bloqueado e os atuadores devem ser desligados.",
  },
  recipeInvalid: {
    code: "ALM-005",
    title: "RECEITA FORA DOS LIMITES",
    message: "A receita selecionada possui parâmetros fora do limite permitido para a demonstração.",
  },
  operationState: {
    code: "ALM-006",
    title: "ESTADO OPERACIONAL INVÁLIDO",
    message: "A operação não pode avançar no estado atual.",
  },
};

const LIMITS = {
  tankMin: 1,
  tankMax: 3,
  oilMinL: 0,
  oilMaxL: 300,
  oilStepL: 1,
};

const defaultRecipes: Recipe[] = [];

const hoses: Hose[] = [];

const checklistPreText: Record<keyof ChecklistPre, { title: string; detail: string }> = {
  mangueira: {
    title: "Mangueira de vácuo conectada",
    detail: "Conferir engate, vedação e ausência de dobra na linha.",
  },
  valvulaSuperior: {
    title: "Válvula superior liberada",
    detail: "Linha de vácuo preparada para aplicar pressão negativa no tanque.",
  },
  valvulaInferior: {
    title: "Válvula inferior fechada",
    detail: "Evita entrada indevida de óleo/ar antes da etapa correta.",
  },
  tanquesPosicionados: {
    title: "Tanques posicionados",
    detail: "Tanques/reguladores alinhados, apoiados e sem obstrução física.",
  },
  óleoDisponivel: {
    title: "Óleo disponível",
    detail: "Volume informado precisa cobrir a receita selecionada.",
  },
  emergênciaLiberada: {
    title: "Emergência liberada",
    detail: "Botão de emergência e bloqueios físicos devem estar liberados.",
  },
  sensoresComunicando: {
    title: "Sensores comunicando",
    detail: "Pressão/vácuo, Gateway e sinal do controlador devem estar online.",
  },
  intertravamentosLiberados: {
    title: "Intertravamentos liberados",
    detail: "Condições mínimas para bomba, válvulas, óleo e segurança.",
  },
  receitaRevisada: {
    title: "Receita revisada",
    detail: "Conferir pressão alvo, tempo, tanque, mangueira e operador.",
  },
};

const checklistPosText: Record<keyof Omit<ChecklistPos, "observacao">, { title: string; detail: string }> = {
  tempoOk: {
    title: "Tempo de ciclo registrado",
    detail: "Confirmar duração total apresentada pela IHM.",
  },
  semAnomalia: {
    title: "Sem anomalia visual",
    detail: "Sem ruido anormal, vazamento, oscilação crítica ou comportamento inesperado.",
  },
  óleoRestanteVisivel: {
    title: "Óleo restante conferido",
    detail: "Reservatorio e linha de óleo coerentes com a operação.",
  },
  pressãoFinalOk: {
    title: "Pressão final registrada",
    detail: "Valor final salvo para rastreabilidade e relatório.",
  },
  bombasDesligaram: {
    title: "Bombas desligadas",
    detail: "B1, B2/Roots simulada e linha de óleo em estado seguro.",
  },
  linhaÓleoFinalizada: {
    title: "Linha de óleo finalizada",
    detail: "Etapa de injeção/enchimento concluída sem alerta pendente.",
  },
  operadorConfirmouFisico: {
    title: "Conferencia física feita",
    detail: "Operador confirmou máquina, tanque, mangueira e painel.",
  },
  alarmesRevisados: {
    title: "Alarmes revisados",
    detail: "Eventos amarelos/vermelhos foram verificados antes do encerramento.",
  },
  dadosEnviados: {
    title: "Dados enviados ao Gateway",
    detail: "Registro da operação enviado para painel, histórico e relatórios.",
  },
};

const EMPTY_RECIPE: Recipe = {
  id: "__SEM_RECEITA__",
  title: "Nenhuma receita cadastrada",
  tipoTanque: "Não definido",
  tempoEstimado: 0,
  pressãoAlvo: 1013,
  b2StartSeg: 0,
  oilStartSeg: 0,
  estabilizacaoSeg: 0,
  óleoPorTanque: 0,
  observacao: "Cadastre uma receita no sistema do gerente.",
};

function fmt(v: number, u: string) {
  if (!Number.isFinite(v)) return `-- ${u}`;
  return `${v.toFixed(v >= 100 ? 1 : 2)} ${u}`;
}

function timeFmt(s: number) {
  const safe = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(safe / 60)}:${(safe % 60).toString().padStart(2, "0")}`;
}

function now() {
  return new Date().toLocaleTimeString("pt-BR");
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number) {
  return Math.round(clampNumber(value, min, max));
}

function humanStage(stage: string) {
  const key = String(stage || "").toUpperCase();

  const map: Record<string, string> = {
    PREPARO: "PREPARO",
    VACUO_INICIAL: "VÁCUO INICIAL",
    "VÁCUO_INICIAL": "VÁCUO INICIAL",
    VACUO_PROFUNDO: "VÁCUO PROFUNDO",
    "VÁCUO_PROFUNDO": "VÁCUO PROFUNDO",
    INJECAO_DE_OLEO: "INJEÇÃO DE ÓLEO",
    "INJEÇÃO_DE_ÓLEO": "INJEÇÃO DE ÓLEO",
    ESTABILIZACAO: "ESTABILIZAÇÃO",
    "ESTABILIZAÇÃO": "ESTABILIZAÇÃO",
    FINALIZACAO: "FINALIZAÇÃO",
    "FINALIZAÇÃO": "FINALIZAÇÃO",
    BLOQUEADO: "BLOQUEADO",
  };

  return map[key] || key || "PREPARO";
}

function gatewayToRecipe(raw: any): Recipe {
  const estimated = Number(raw?.estimated_seconds || raw?.max_cycle_seconds || 205);
  const oilPerTank = Number(raw?.oil_per_tank_l || raw?.óleoPorTanque || Math.max(30, Number(raw?.min_oil_flow_l_min || 2) * 25));

  return {
    id: String(raw?.id || `REC-${Date.now()}`),
    title: String(raw?.title || raw?.name || "Receita Operacional"),
    tipoTanque: String(raw?.tank_type || raw?.tipoTanque || "Comum"),
    tempoEstimado: estimated,
    pressãoAlvo: Number(raw?.target_pressure_mbar || raw?.pressãoAlvo || 8),
    b2StartSeg: Number(raw?.b2_start_seconds || 24),
    oilStartSeg: Number(raw?.oil_start_seconds || 90),
    estabilizacaoSeg: Number(raw?.stabilization_seconds || 165),
    óleoPorTanque: oilPerTank,
    observacao: String(raw?.note || raw?.observacao || "Receita recebida do Gateway"),
  };
}

function normalizeGatewayStatus(value: unknown): Status {
  const text = String(value || "").toUpperCase();

  if (text === "EM_CICLO") return "EM CICLO";
  if (text === "PAUSADO") return "PAUSADO";
  if (text === "FINALIZADO") return "FINALIZADO";
  if (text === "BLOQUEADO") return "BLOQUEADO";
  return "PRONTO";
}

function PumpCard({ name, subtitle, on, detail }: { name: string; subtitle: string; on: boolean; detail: string }) {
  return (
    <article className={`pump-card ${on ? "on" : "off"}`}>
      <div className="pump-head">
        <div className={`machine-led ${on ? "on" : "off"}`} aria-hidden="true" />

        <div>
          <strong>{name}</strong>
          <small>{subtitle}</small>
        </div>
      </div>

      <p>{detail}</p>

      <div className="pump-state-row">
        <b>{on ? "LIGADA" : "DESLIGADA"}</b>
        <small>{on ? "Sinal ativo" : "Aguardando comando"}</small>
      </div>
    </article>
  );
}

function ProcessTank({ tank, index, oilActive }: { tank: any; index: number; oilActive: boolean }) {
  const pressure = Number(tank.pressão ?? tank.pressure_mbar ?? 1013);
  const loss = Number(tank.perda ?? tank.hose_loss_mbar ?? 0);
  const oil = Number(tank.óleo ?? tank.oil_in_l ?? 0);
  const oilHeight = Math.max(4, Math.min(78, oil * 2.2));
  const vacuumHeight = Math.max(10, Math.min(84, 92 - Math.log10(Math.max(pressure, 1)) * 24));

  return (
    <article className="process-tank-card">
      <div className="tank-name">T{index + 1}</div>

      <div className="process-visual">
        <div className="vacuum-line" />
        <div className={`oil-hose ${oilActive ? "active" : ""}`}>
          {oilActive && (
            <>
              <span />
              <span />
              <span />
            </>
          )}
        </div>

        <div className="process-tank">
          <div className="vacuum-zone" style={{ height: `${vacuumHeight}%` }} />
          <div className="oil-level" style={{ height: `${oilHeight}%` }} />
        </div>
      </div>

      <div className="tank-readings">
        <span>Pressão</span><b>{fmt(pressure, "mbar")}</b>
        <span>Perda</span><b>{fmt(loss, "mbar")}</b>
        <span>Óleo</span><b>{fmt(oil, "L")}</b>
      </div>
    </article>
  );
}

function AlarmOverlay({
  alarm,
  onSilence,
  onOpenAlarms,
  onEmergencyStop,
}: {
  alarm: AlarmInfo | null;
  onSilence: () => void;
  onOpenAlarms: () => void;
  onEmergencyStop: () => void;
}) {
  if (!alarm) return null;

  return (
    <div className={`alarm-overlay ${alarm.severity}`}>
      <div className="alarm-modal">
        <h2>{alarm.title}</h2>
        <p>{alarm.message}</p>

        {alarm.severity === "red" && (
          <button className="emergency-round" onClick={onEmergencyStop}>
            PARAR TUDO
          </button>
        )}

        <div className="alarm-actions">
          <button onClick={onOpenAlarms}>VERIFICAR ALARMES</button>
          <button className="secondary" onClick={onSilence}>SILENCIAR AVISO</button>
        </div>
      </div>
    </div>
  );
}


/* IHM_ICONS_HELPER_START */
type IhmIndustrialIconType = "operation" | "register" | "tank" | "time" | "pressure" | "oil";

function IhmIndustrialIcon({ type }: { type: IhmIndustrialIconType }) {
  if (type === "operation") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17h16" />
        <path d="M6 17V9h4v8" />
        <path d="M14 17V6h4v11" />
        <path d="M10 12h4" />
        <path d="M11.2 10.6l2.3 1.4-2.3 1.4z" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (type === "register") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1z" />
        <path d="M8 8h7" />
        <path d="M8 12h6" />
        <path d="M8 16h4" />
        <path d="M18 6h1a1 1 0 0 1 1 1v13" />
      </svg>
    );
  }

  if (type === "tank") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3h10" />
        <path d="M8 6h8" />
        <path d="M8 6v12a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3V6" />
        <path d="M9 15h6" />
        <path d="M9 18h6" />
      </svg>
    );
  }

  if (type === "time") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  if (type === "pressure") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 15a8 8 0 0 1 16 0" />
        <path d="M12 15l4-5" />
        <path d="M7 18h10" />
        <circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 3h8" />
      <path d="M9 3v7.2a5 5 0 1 0 6 0V3" />
      <path d="M9 15h6" />
      <path d="M10 18h4" />
    </svg>
  );
}
/* IHM_ICONS_HELPER_END */

function App() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState<OperationTab>("reguladores");
  const [status, setStatus] = useState<Status>("PRONTO");
  const [elapsed, setElapsed] = useState(0);
  const [operationId, setOperationId] = useState("");
  const [gatewayState, setGatewayState] = useState<any>(null);
  const [gatewayOnline, setGatewayOnline] = useState(false);
  const [silencedAlarmKey, setSilencedAlarmKey] = useState("");

  const [registros, setRegistros] = useState<Registro[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("tsea_ihm_registros_dia") || "[]");
    } catch {
      return [];
    }
  });

  const [recipeId, setRecipeId] = useState<RecipeKey>("");
  const [qtdTanques, setQtdTanques] = useState(1);
  const [hoseId, setHoseId] = useState<HoseKey>("");
  const [óleoColocado, setÓleoColocado] = useState(80);

  const [checklistPre, setChecklistPre] = useState<ChecklistPre>({
    mangueira: false,
    valvulaSuperior: false,
    valvulaInferior: false,
    tanquesPosicionados: false,
    óleoDisponivel: false,
    emergênciaLiberada: true,
    sensoresComunicando: false,
    intertravamentosLiberados: false,
    receitaRevisada: false,
  });

  const [checklistPos, setChecklistPos] = useState<ChecklistPos>({
    tempoOk: false,
    semAnomalia: false,
    óleoRestanteVisivel: false,
    pressãoFinalOk: false,
    bombasDesligaram: false,
    linhaÓleoFinalizada: false,
    operadorConfirmouFisico: false,
    alarmesRevisados: false,
    dadosEnviados: false,
    observacao: "",
  });

  const [logs, setLogs] = useState<{ time: string; msg: string }[]>([]);
  const [startFeedback, setStartFeedback] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [gatewayRecipes, setGatewayRecipes] = useState<Recipe[]>([]);
  const [realHoses, setRealHoses] = useState<any[]>([]);
  const [realTanks, setRealTanks] = useState<any[]>([]);
  const [realLimits, setRealLimits] = useState<any>(null);

  const recipes = gatewayRecipes.length ? gatewayRecipes : [EMPTY_RECIPE];
  const recipe = recipes.find((r) => r.id === recipeId) || recipes[0] || EMPTY_RECIPE;
  const hosesDisponíveis: Hose[] = realHoses.map((item: any) => ({
    id: String(item.id || item.code),
    descricao: `${item.label || item.descricao || item.code} · ${item.length_m ?? "--"} m · Ø ${item.internal_diameter_mm ?? "--"} mm · Vol. ${item.internal_volume_l ?? "--"} L`,
    perdaBase: Number(item.calibrated_loss_mbar ?? item.loss_base_mbar ?? 0),
    comprimento: Number(item.length_m ?? 0),
  }));
  const hose = hosesDisponíveis.find((h) => h.id === hoseId) || hosesDisponíveis[0] || { id: "__SEM_MANGUEIRA__", descricao: "Nenhuma mangueira real cadastrada", perdaBase: 0, comprimento: 0 };

  const addLog = (msg: string) => setLogs((prev) => [{ time: now(), msg }, ...prev].slice(0, 60));
  async function gatewayPostJson(path: string, payload?: unknown) {
    const errors: string[] = [];

    for (const base of GATEWAY_API_BASES) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 7000);

      try {
        const response = await fetch(`${base}${path}`, {
          method: "POST",
          mode: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: payload === undefined ? undefined : JSON.stringify(payload),
          signal: controller.signal,
        });

        const text = await response.text();
        let data: any = null;

        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = { raw: text };
        }

        if (!response.ok) {
          throw new Error(data?.detail || data?.message || text || `HTTP ${response.status}`);
        }

        return data;
      } catch (error) {
        errors.push(`${base}${path}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        window.clearTimeout(timeout);
      }
    }

    throw new Error(errors.join(" | "));
  }


  useEffect(() => {
    if (phase === "boot") {
      const timer = window.setTimeout(() => setPhase("inicial"), 3600);
      return () => window.clearTimeout(timer);
    }
  }, [phase]);

  useEffect(() => {
    try {
      localStorage.setItem("tsea_ihm_registros_dia", JSON.stringify(registros));
    } catch {}
  }, [registros]);

  useEffect(() => {
    let active = true;

    async function carregarParâmetrosReais() {
      try {
        const response = await fetch(`${GATEWAY_API}/real/parameters`);
        if (!response.ok) throw new Error(await response.text());

        const data = await response.json();

        if (!active) return;

        setRealHoses(Array.isArray(data?.hoses) ? data.hoses : []);
        setRealTanks(Array.isArray(data?.tanks) ? data.tanks : []);
        setRealLimits(data?.limits || null);
      } catch {
        if (!active) return;

        setRealHoses([]);
        setRealTanks([]);
        setRealLimits(null);
      }
    }

    carregarParâmetrosReais();
    const timer = window.setInterval(carregarParâmetrosReais, 3000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function carregarReceitasGateway() {
      try {
        const response = await fetch(`${GATEWAY_API}/real/recipes`);
        if (!response.ok) throw new Error(await response.text());

        const data = await response.json();
        const list = Array.isArray(data) ? data.map(gatewayToRecipe) : [];

        if (active) setGatewayRecipes(list);
      } catch {
        if (active) setGatewayRecipes([]);
      }
    }

    carregarReceitasGateway();
    const timer = window.setInterval(carregarReceitasGateway, 3000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (recipes.length && !recipes.some((item) => item.id === recipeId)) {
      setRecipeId(recipes[0].id);
    }

    if (!recipes.length) {
      setRecipeId("");
    }
  }, [gatewayRecipes, recipeId, recipes]);

  useEffect(() => {
    if (realHoses.length && !realHoses.some((item: any) => String(item.id || item.code) === hoseId)) {
      setHoseId(String(realHoses[0].id || realHoses[0].code));
    }

    if (!realHoses.length) {
      setHoseId("");
    }
  }, [realHoses, hoseId]);


  useEffect(() => {
    let active = true;

    async function pollState() {
      try {
        const response = await fetch(`${GATEWAY_API}/state`);
        if (!response.ok) throw new Error(await response.text());

        const data = await response.json();
        if (!active) return;

        setGatewayOnline(true);
        setGatewayState(data);

        if (data?.operation_id) setOperationId(String(data.operation_id));
        if (data?.status) setStatus(normalizeGatewayStatus(data.status));
        if (Number.isFinite(Number(data?.elapsed_seconds))) setElapsed(Number(data.elapsed_seconds));
      } catch {
        if (active) setGatewayOnline(false);
      }
    }

    pollState();
    const timer = window.setInterval(pollState, 1000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const stageRaw = String(gatewayState?.stage || "");
  const elapsedLive = Number(gatewayState?.elapsed_seconds ?? elapsed);
  const b1Ligada = Boolean(gatewayState?.pumps?.b1) || (status === "EM CICLO" && elapsedLive < recipe.tempoEstimado);
  const b2Ligada = Boolean(gatewayState?.pumps?.b2) || (status === "EM CICLO" && elapsedLive >= recipe.b2StartSeg && elapsedLive < recipe.oilStartSeg);
  const oilLigada = Boolean(gatewayState?.pumps?.oil) || (status === "EM CICLO" && elapsedLive >= recipe.oilStartSeg);
  const etapaAtual = humanStage(stageRaw || etapaLocal());

  const pressãoMáquina = Number(
    gatewayState?.pressure_machine_mbar ??
      (status === "EM CICLO" ? Math.max(recipe.pressãoAlvo, 1013 * Math.exp(-elapsedLive / 4.8)) : 1013)
  );

  const pressãoMedia = Number(gatewayState?.pressure_avg_tank_mbar ?? pressãoMáquina + hose.perdaBase);
  const oilInjetado = Number(gatewayState?.oil?.injected_l ?? Math.min(óleoColocado, oilLigada ? Math.max(0, elapsedLive - recipe.oilStartSeg) * 0.8 : 0));
  const oilRestante = Number(gatewayState?.oil?.remaining_l ?? Math.max(0, óleoColocado - oilInjetado));
  const oilFlow = Number(gatewayState?.oil?.flow_l_min ?? (oilLigada ? qtdTanques * 1.5 : 0));

  const tanques = Array.isArray(gatewayState?.tanks) && gatewayState.tanks.length
    ? gatewayState.tanks.map((t: any, index: number) => ({
        id: t.id || `T${index + 1}`,
        pressão: Number(t.pressure_mbar || pressãoMedia),
        perda: Number(t.hose_loss_mbar || hose.perdaBase),
        óleo: Number(t.oil_in_l || 0),
        risco: Number(t.risk_pct || 0),
      }))
    : Array.from({ length: qtdTanques }).map((_, index) => ({
        id: `T${index + 1}`,
        pressão: pressãoMedia + index * 0.5,
        perda: hose.perdaBase + index * 0.2,
        óleo: oilLigada ? Math.max(0, elapsedLive - recipe.oilStartSeg) / 2 : 0,
        risco: 18,
      }));

  const allCheckedPre = Object.values(checklistPre).every((v) => v === true);
  const allCheckedPos = Object.entries(checklistPos).filter(([k]) => k !== "observacao").every(([, v]) => v === true);
  const oilNeeded = qtdTanques * recipe.óleoPorTanque;
  const receitaExcedeLimiteÓleo = recipes.length > 0 && oilNeeded > OPERATIONAL_LIMITS.oilMaxL;
  const oilInsuficiente = recipes.length > 0 && óleoColocado < oilNeeded;

  const recipeTimeInvalid = recipes.length > 0 && (
    recipe.tempoEstimado < OPERATIONAL_LIMITS.minCycleSeconds ||
    recipe.tempoEstimado > OPERATIONAL_LIMITS.maxCycleSeconds
  );

  const pressureTargetInvalid = recipes.length > 0 && (
    recipe.pressãoAlvo < OPERATIONAL_LIMITS.pressureMinMbar ||
    recipe.pressãoAlvo > OPERATIONAL_LIMITS.pressureMaxMbar
  );

  const recipeSequenceInvalid = recipes.length > 0 && (
    recipe.b2StartSeg < 0 ||
    recipe.oilStartSeg < recipe.b2StartSeg ||
    recipe.estabilizacaoSeg < recipe.oilStartSeg ||
    recipe.tempoEstimado < recipe.estabilizacaoSeg
  );

  const recipeInvalid = receitaExcedeLimiteÓleo || recipeTimeInvalid || pressureTargetInvalid || recipeSequenceInvalid;

  // Para o protótipo físico, a IHM não deve bloquear o início apenas por não existir
  // cadastro individual de tanque no Gateway. A quantidade de tanques já é informada
  // na própria IHM. O bloqueio real de parâmetro obrigatório fica na receita e mangueira.
  const parâmetrosReaisIncompletos = realHoses.length === 0;

  const gatewayBloqueado = !gatewayOnline;
  const sensorBloqueado = gatewayState?.hardware?.sensor_online === false;
  const emergencyBloqueada = status === "BLOQUEADO" || gatewayState?.hardware?.emergency === true;

  const motivosBloqueioInicio = [
    !recipes.length ? "Nenhuma receita cadastrada no Gateway." : "",
    parâmetrosReaisIncompletos ? "Nenhuma mangueira real cadastrada no Gateway." : "",
    gatewayBloqueado ? "Gateway offline." : "",
    sensorBloqueado ? "Sensor de pressão offline." : "",
    emergencyBloqueada ? "Emergência ou bloqueio crítico ativo." : "",
    recipeTimeInvalid ? "Tempo da receita fora do limite operacional." : "",
    pressureTargetInvalid ? "Pressão alvo fora da faixa permitida." : "",
    recipeSequenceInvalid ? "Sequência da receita inválida." : "",
    receitaExcedeLimiteÓleo ? "Receita exige mais óleo que o limite operacional da IHM." : "",
    oilInsuficiente ? "Óleo insuficiente para a operação." : "",
    !allCheckedPre ? "Checklist pré-operacional incompleto." : "",
  ].filter(Boolean);

  const inícioBloqueado = motivosBloqueioInicio.length > 0;

  const alarmInfo = useMemo<AlarmInfo | null>(() => {
    if (emergencyBloqueada) {
      return {
        key: "emergência",
        severity: "red",
        title: `${ALARM_TEXT.emergency.code} - ${ALARM_TEXT.emergency.title}`,
        message: ALARM_TEXT.emergency.message,
      };
    }

    if (sensorBloqueado) {
      return {
        key: "sensor_offline",
        severity: "red",
        title: `${ALARM_TEXT.sensorOffline.code} - ${ALARM_TEXT.sensorOffline.title}`,
        message: ALARM_TEXT.sensorOffline.message,
      };
    }

    if (!gatewayOnline && phase !== "boot") {
      return {
        key: "gateway_offline",
        severity: "yellow",
        title: `${ALARM_TEXT.gatewayOffline.code} - ${ALARM_TEXT.gatewayOffline.title}`,
        message: ALARM_TEXT.gatewayOffline.message,
      };
    }

    if (recipeInvalid) {
      return {
        key: "recipe_invalid",
        severity: "yellow",
        title: `${ALARM_TEXT.recipeInvalid.code} - ${ALARM_TEXT.recipeInvalid.title}`,
        message: ALARM_TEXT.recipeInvalid.message,
      };
    }

    if (oilInsuficiente) {
      return {
        key: "óleo_insuficiente",
        severity: "yellow",
        title: `${ALARM_TEXT.oilShortage.code} - ${ALARM_TEXT.oilShortage.title}`,
        message: ALARM_TEXT.oilShortage.message,
      };
    }

    return null;
  }, [emergencyBloqueada, sensorBloqueado, gatewayOnline, phase, recipeInvalid, oilInsuficiente]);

  const visibleAlarm = alarmInfo && alarmInfo.key !== silencedAlarmKey ? alarmInfo : null;
  const screenClass = visibleAlarm ? `alarm-shadow-${visibleAlarm.severity}` : "";

  function etapaLocal() {
    if (status !== "EM CICLO") return "PREPARO";
    if (elapsedLive < recipe.b2StartSeg) return "VACUO_INICIAL";
    if (elapsedLive < recipe.oilStartSeg) return "VACUO_PROFUNDO";
    if (elapsedLive < recipe.estabilizacaoSeg) return "INJECAO_DE_OLEO";
    if (elapsedLive < recipe.tempoEstimado) return "ESTABILIZAÇÃO";
    return "FINALIZAÇÃO";
  }

  async function acionarEmergência() {
    try {
      await fetch(`${GATEWAY_API}/command/emergency`, { method: "POST" });
    } catch {}

    setStatus("BLOQUEADO");
    addLog("Parada crítica acionada pela IHM.");
    setPhase("alarmes");
  }

  async function iniciarOperação() {
    if (isStarting) return;

    setIsStarting(true);
    setStartFeedback("Enviando comando de início ao Gateway...");
    addLog("Botão INICIAR pressionado.");

    try {
      if (!recipes.length || recipe.id === "__SEM_RECEITA__") {
        throw new Error("Nenhuma receita cadastrada no Gateway.");
      }

      if (gatewayBloqueado) {
        throw new Error("Gateway offline. Abra o Gateway/API em http://127.0.0.1:8020/docs.");
      }

      if (parâmetrosReaisIncompletos) {
        throw new Error("Nenhuma mangueira real cadastrada no Gateway.");
      }

      if (receitaExcedeLimiteÓleo) {
        throw new Error(`Receita exige ${oilNeeded} L, acima do limite de ${OPERATIONAL_LIMITS.oilMaxL} L da IHM.`);
      }

      if (oilInsuficiente) {
        throw new Error(`Óleo insuficiente. Necessário: ${oilNeeded} L. Informado: ${óleoColocado} L.`);
      }

      if (!allCheckedPre) {
        throw new Error("Checklist pré-operacional incompleto.");
      }

      const startPayload = {
        recipe_id: recipeId || recipe.id,
        tank_count: qtdTanques,
        hose_id: hoseId || hose.id,
        oil_reservoir_l: óleoColocado,
        operator: "OPERADOR 01",
        shift: "MANHA",
      };

      let data: any = null;

      try {
        data = await gatewayPostJson("/command/start", startPayload);
      } catch (primaryError) {
        addLog(`Falha no endpoint /command/start. Tentando rota alternativa. ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);
        data = await gatewayPostJson("/operation/start", startPayload);
      }

      const realOperationId = String(
        data?.operation_id ||
        data?.id ||
        data?.summary?.operation_id ||
        data?.cycle?.operation_id ||
        `OP-${Date.now()}`
      );

      setOperationId(realOperationId);
      setStatus("EM CICLO");
      setElapsed(0);
      setStartFeedback("Operação iniciada. Abrindo tela operacional...");
      setLogs([{ time: now(), msg: "Operação iniciada pela IHM e enviada ao Gateway." }]);

      try {
        await gatewayPostJson("/checklist/pre", {
          operation_id: realOperationId,
          items: checklistPre,
          observation: "Checklist pré-operacional confirmado na IHM.",
        });
      } catch (checklistError) {
        addLog(`Operação iniciou, mas o checklist não foi enviado: ${checklistError instanceof Error ? checklistError.message : String(checklistError)}`);
      }

      setPhase("operação");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      setStartFeedback(`Falha ao iniciar: ${message}`);
      addLog(`Falha ao iniciar: ${message}`);
      console.error("[TSEA IHM START ERROR]", error);
    } finally {
      setIsStarting(false);
    }
  }

  async function finalizarOperaçãoCompleta() {
    try {
      await fetch(`${GATEWAY_API}/checklist/final`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation_id: operationId,
          items: checklistPos,
          observation: checklistPos.observacao || "Checklist final confirmado na IHM.",
        }),
      });

      await fetch(`${GATEWAY_API}/command/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      addLog("Checklist final e STOP enviados ao Gateway.");
    } catch (error) {
      addLog(`Falha ao finalizar no Gateway: ${error instanceof Error ? error.message : String(error)}`);
    }

    registrar("CONCLUIDO");
    reiniciar();
  }

  function reiniciar() {
    setPhase("boot");
    setDrawerOpen(false);
    setStatus("PRONTO");
    setElapsed(0);
    setOperationId("");
    setLogs([]);
    setStartFeedback("");
    setIsStarting(false);
    setChecklistPre({
      mangueira: false,
      valvulaSuperior: false,
      valvulaInferior: false,
      tanquesPosicionados: false,
      óleoDisponivel: false,
      emergênciaLiberada: true,
      sensoresComunicando: false,
      intertravamentosLiberados: false,
      receitaRevisada: false,
    });
    setChecklistPos({
      tempoOk: false,
      semAnomalia: false,
      óleoRestanteVisivel: false,
      pressãoFinalOk: false,
      bombasDesligaram: false,
      linhaÓleoFinalizada: false,
      operadorConfirmouFisico: false,
      alarmesRevisados: false,
      dadosEnviados: false,
      observacao: "",
    });
    setTimeout(() => setPhase("inicial"), 800);
  }

  function registrar(statusFinal: string) {
    setRegistros((prev) => [
      {
        id: operationId || `LOCAL-${Date.now()}`,
        horario: new Date().toLocaleString(),
        status: statusFinal,
        qtdTanques,
        receita: recipe.title,
        mangueira: hose.descricao,
      },
      ...prev,
    ].slice(0, 50));
  }

  function renderMenu() {
    return (
      <div className={`drawer ${drawerOpen ? "open" : ""}`}>
        <div><button onClick={() => setDrawerOpen(false)}>FECHAR</button></div>
        <button disabled={phase !== "operação" || status !== "FINALIZADO"} onClick={() => setPhase("finalizacao")}>FINALIZAR OPERACAO</button>
        <button onClick={() => { setDrawerOpen(false); setPhase("alarmes"); }}>ALARMES</button>
        <button onClick={() => { setDrawerOpen(false); setPhase("operação"); setTab("informacoes"); }}>DIAGNOSTICO</button>
        <button disabled={phase === "operação" && status !== "FINALIZADO"} onClick={reiniciar}>INICIO</button>
      </div>
    );
  }

  function renderAlarm() {
    if (phase === "alarmes") return null;

    return (
      <AlarmOverlay
        alarm={visibleAlarm}
        onSilence={() => visibleAlarm && setSilencedAlarmKey(visibleAlarm.key)}
        onOpenAlarms={() => setPhase("alarmes")}
        onEmergencyStop={acionarEmergência}
      />
    );
  }

  if (phase === "boot") {
    return (
      <div className="boot">
        <div className="boot-title">TSEA</div>
        <div className="boot-sub">energia</div>
      </div>
    );
  }

  if (phase === "inicial") {
    return (
      <div className={`inicial ${screenClass}`}>
        {renderAlarm()}
        <div className="buttons ihm-buttons ihm-start-actions">
          <div className="ihm-start-action-group">
            <div className="ihm-start-icon" aria-hidden="true">
              <IhmIndustrialIcon type="operation" />
            </div>
            <button className="big-btn standard-btn ihm-start-button" onClick={() => setPhase("preparar_receita")}>PREPARAR OPERAÇÃO</button>
          </div>

          <div className="ihm-start-action-group">
            <div className="ihm-start-icon" aria-hidden="true">
              <IhmIndustrialIcon type="register" />
            </div>
            <button className="big-btn standard-btn ihm-start-button" onClick={() => setPhase("registros_dia")}>REGISTROS DO DIA</button>
          </div>
        </div>
        {renderMenu()}
      </div>
    );
  }

  if (phase === "registros_dia") {
    return (
      <div className={`registros-dia ${screenClass}`}>
        {renderAlarm()}
        <button className="standard-btn compact" onClick={() => setPhase("inicial")}>VOLTAR</button>
        <h2>REGISTROS DO DIA</h2>
        <ul>{registros.map((r) => <li key={r.id}>{r.horario} | {r.status} | {r.qtdTanques} tanque(s) | {r.receita}</li>)}</ul>
        {renderMenu()}
      </div>
    );
  }

  if (phase === "preparar_receita") {
    return (
      <div className={`preparo ${screenClass}`}>
        {renderAlarm()}
        <h2>ESCOLHA A RECEITA</h2>
        <div className="recipes">
          {recipes.length === 0 ? (
            <div className="oil-warning">Nenhuma receita cadastrada no Gateway. Cadastre uma receita no sistema do gerente.</div>
          ) : recipes.map((r) => (
            <button key={r.id} className={`recipe-card recipe-card-refined ${recipeId === r.id ? "selected" : ""}`} onClick={() => setRecipeId(r.id)}>
              <div className="recipe-title">{r.title}</div>

              <div className="recipe-info-grid-refined">
                <div className="recipe-info-box">
                  <span><IhmIndustrialIcon type="tank" /></span>
                  <small>Tanque</small>
                  <strong>{r.tipoTanque}</strong>
                </div>

                <div className="recipe-info-box">
                  <span><IhmIndustrialIcon type="time" /></span>
                  <small>Tempo</small>
                  <strong>{r.tempoEstimado}s</strong>
                </div>

                <div className="recipe-info-box">
                  <span><IhmIndustrialIcon type="pressure" /></span>
                  <small>Pressão alvo</small>
                  <strong>{r.pressãoAlvo} mbar</strong>
                </div>

                <div className="recipe-info-box">
                  <span><IhmIndustrialIcon type="oil" /></span>
                  <small>Óleo/tanque</small>
                  <strong>{r.óleoPorTanque} L</strong>
                </div>
              </div>

              <div className="recipe-note">{r.observacao}</div>
            </button>
          ))}
        </div>
        <button className="next-btn standard-btn compact" disabled={!recipes.length} onClick={() => setPhase("preparar_dados")}>CONTINUAR</button>
        {renderMenu()}
      </div>
    );
  }

  if (phase === "preparar_dados") {
    return (
      <div className={`preparo ${screenClass}`}>
        {renderAlarm()}
        <h2>DADOS DA OPERACAO</h2>
        <div className="form-grid">
          <div className="field"><label>Quantidade de tanques</label><input type="number" min={OPERATIONAL_LIMITS.tankMin} max={OPERATIONAL_LIMITS.tankMax} step={1} value={qtdTanques} onChange={(e) => setQtdTanques(clampInteger(Number(e.target.value), OPERATIONAL_LIMITS.tankMin, OPERATIONAL_LIMITS.tankMax))} /></div>
          <div className="field"><label>Mangueira</label><select value={hoseId} onChange={(e) => setHoseId(e.target.value as HoseKey)}>{hosesDisponíveis.map((h) => <option key={h.id} value={h.id}>{h.descricao}</option>)}</select></div>
          <div className="field"><label>Óleo no reservatório (L)</label><input type="number" min={OPERATIONAL_LIMITS.oilMinL} max={OPERATIONAL_LIMITS.oilMaxL} step={OPERATIONAL_LIMITS.oilStepL} value={óleoColocado} onChange={(e) => setÓleoColocado(clampNumber(Number(e.target.value), OPERATIONAL_LIMITS.oilMinL, OPERATIONAL_LIMITS.oilMaxL))} /></div>
          <div className={oilInsuficiente || receitaExcedeLimiteÓleo ? "oil-warning limit-box" : "oil-ok limit-box"}>
            <b>Óleo necessário: {oilNeeded} L</b>
            <span>Limite operacional da IHM: {OPERATIONAL_LIMITS.oilMinL} a {OPERATIONAL_LIMITS.oilMaxL} L.</span>
            {receitaExcedeLimiteÓleo && <span>Receita acima do limite demonstrativo. Ajuste a receita no gerente.</span>}
            {gatewayBloqueado && <span>Gateway offline: início bloqueado ate normalizar a comunicação.</span>}
          </div>
        </div>
        <button className="next-btn standard-btn compact" disabled={oilInsuficiente || receitaExcedeLimiteÓleo || !recipes.length} onClick={() => setPhase("checklist_pre")}>CONTINUAR</button>
        {renderMenu()}
      </div>
    );
  }

  if (phase === "checklist_pre") {
    return (
      <div className={`preparo ${screenClass}`}>
        {renderAlarm()}
        <h2>CHECKLIST PRE-OPERACIONAL</h2>
        <div className="checklist refined">
          {(Object.keys(checklistPreText) as (keyof ChecklistPre)[]).map((key) => (
            <label key={key}>
              <input type="checkbox" checked={checklistPre[key]} onChange={(e) => setChecklistPre((prev) => ({ ...prev, [key]: e.target.checked }))} />
              <span><b>{checklistPreText[key].title}</b><small>{checklistPreText[key].detail}</small></span>
            </label>
          ))}
        </div>
        <button className="next-btn standard-btn compact" disabled={!allCheckedPre} onClick={() => setPhase("revisao")}>CONTINUAR</button>
        {renderMenu()}
      </div>
    );
  }

  if (phase === "revisao") {
    return (
      <div className={`preparo ${screenClass}`}>
        {renderAlarm()}
        <h2>REVISAO FINAL</h2>
        <div className="resumo review-grid">
          <p><b>Receita:</b> {recipe.title}</p>
          <p><b>Tanques:</b> {qtdTanques}</p>
          <p><b>Mangueira:</b> {hose.descricao}</p>
          <p><b>Óleo colocado:</b> {óleoColocado} L</p>
          <p><b>Óleo necessário:</b> {oilNeeded} L</p>
          <p><b>Pressão alvo:</b> {recipe.pressãoAlvo} mbar</p>
          {oilInsuficiente && <p className="warn-text">Volume de óleo insuficiente para iniciar.</p>}
          {gatewayBloqueado && <p className="warn-text">Gateway offline. Início bloqueado.</p>}
          {sensorBloqueado && <p className="warn-text">Sensor de pressão offline. Início bloqueado.</p>}
          {recipeTimeInvalid && <p className="warn-text">Tempo da receita fora do limite operacional.</p>}
          {pressureTargetInvalid && <p className="warn-text">Pressão alvo fora da faixa permitida.</p>}
          {recipeSequenceInvalid && <p className="warn-text">Sequência da receita inválida: revise B2, óleo, estabilizaÃ§Ã£o e tempo final.</p>}
          {receitaExcedeLimiteÓleo && <p className="warn-text">Receita exige mais óleo que o limite demonstrativo.</p>}
          {receitaExcedeLimiteÓleo && <p className="warn-text">Receita exige mais óleo que o limite operacional da IHM.</p>}
          {gatewayBloqueado && <p className="warn-text">Gateway offline. Início bloqueado ate normalizar a comunicação.</p>}
          {parâmetrosReaisIncompletos && <p className="warn-text">Mangueira real não cadastrada. Cadastre no gerente.</p>}
          {!allCheckedPre && <p className="warn-text">Checklist pré-operacional incompleto.</p>}
        </div>

        {inícioBloqueado && (
          <div className="oil-warning limit-box">
            <b>INÍCIO BLOQUEADO</b>
            {motivosBloqueioInicio.map((motivo) => <span key={motivo}>{motivo}</span>)}
          </div>
        )}

                {startFeedback && (
          <div className={startFeedback.startsWith("Falha") ? "oil-warning limit-box" : "oil-ok limit-box"}>
            <b>{startFeedback.startsWith("Falha") ? "ERRO AO INICIAR" : "STATUS DO INÍCIO"}</b>
            <span>{startFeedback}</span>
          </div>
        )}
<div className="button-row">
          <button className="cancel-btn standard-btn compact" onClick={() => setPhase("inicial")}>CANCELAR</button>
          <button className="start-btn standard-btn compact" disabled={inícioBloqueado || isStarting} onClick={iniciarOperação}>{isStarting ? "INICIANDO..." : "INICIAR"}</button>
        </div>
        {renderMenu()}
      </div>
    );
  }

  if (phase === "operação") {
    return (
      <div className={`operação ${screenClass}`}>
        {renderAlarm()}

        <div className="topbar">
          <button className="menu-btn" onClick={() => setDrawerOpen(true)}>MENU</button>
          <div><span>STATUS</span><strong>{status}</strong></div>
          <div><span>ETAPA</span><strong>{etapaAtual}</strong></div>
          <div className={alarmInfo ? `alarm-mini ${alarmInfo.severity}` : "alarm-mini ok"}><span>ALARME</span><strong>{alarmInfo ? alarmInfo.severity.toUpperCase() : "NORMAL"}</strong></div>
          <div><span>TEMPO</span><strong>{timeFmt(elapsedLive)} / {timeFmt(recipe.tempoEstimado)}</strong></div>
        </div>

        <div className="content-area">
          {tab === "reguladores" && (
            <div className="tanks-grid animated">
              {tanques.map((t: any, index: number) => <ProcessTank key={t.id || index} tank={t} index={index} oilActive={oilLigada} />)}
            </div>
          )}

          {tab === "bombas" && (
            <div className="machines-layout machines-priority">
              <div className="pump-stack pump-stack-priority">
                <PumpCard name="B1" subtitle="Bomba primária" on={b1Ligada} detail="Evacuacao inicial do tanque e manutencao da linha de vácuo." />
                <PumpCard name="B2" subtitle="Roots simulada" on={b2Ligada} detail="Reforco de vácuo acionado somente dentro da faixa permitida." />
                <PumpCard name="OLEO" subtitle="Linha de injeção" on={oilLigada} detail="Entrada controlada de óleo conforme etapa da receita." />
              </div>

              <div className="machine-info-grid pump-info-compact">
                <article><span>Pressão geral</span><b>{fmt(pressãoMáquina, "mbar")}</b><small>Antes da perda da linha</small></article>
                <article><span>Pressão no regulador</span><b>{fmt(pressãoMedia, "mbar")}</b><small>Valor compensado no tanque</small></article>
                <article><span>Gateway</span><b>{gatewayOnline ? "ONLINE" : "OFFLINE"}</b><small>Comunicacao com gerente</small></article>
                <article><span>Seguranca</span><b>{alarmInfo?.severity === "red" ? "BLOQUEADO" : "LIBERADO"}</b><small>Intertravamento</small></article>
              </div>
            </div>
          )}

          {tab === "óleo" && (
            <div className="oil-layout oil-layout-focused">
              <article className="oil-flow-card oil-flow-main">
                <h3>Linha de injeção de óleo</h3>

                <div className="oil-inline-metrics">
                  <div><span>Reservatorio</span><b>{fmt(oilRestante, "L")}</b></div>
                  <div><span>Pressão tanque</span><b>{fmt(pressãoMedia, "mbar")}</b></div>
                  <div><span>Injetado</span><b>{fmt(oilInjetado, "L")}</b></div>
                  <div><span>Vazao</span><b>{fmt(oilFlow, "L/min")}</b></div>
                </div>

                <div className={`oil-demo-line ${oilLigada ? "active" : ""}`}>
                  <div className="pipe-reservoir oil-source-with-level">
                    <div className="pipe-reservoir-oil" style={{ height: `${Math.max(6, Math.min(92, (oilRestante / Math.max(óleoColocado, 1)) * 100))}%` }} />
                  </div>
                  <div className="pipe-hose">{oilLigada && <><span /><span /><span /><span /></>}</div>
                  <div className="pipe-tank">
                    <div className="pipe-tank-oil" style={{ height: `${Math.max(4, Math.min(80, oilInjetado / Math.max(oilNeeded, 1) * 80))}%` }} />
                  </div>
                </div>

                <p>{oilLigada ? "Injetando óleo na etapa atual" : "Linha aguardando etapa de óleo"}</p>
              </article>

              <div className="oil-metrics oil-metrics-focused">
                <article><span>Óleo inicial</span><b>{fmt(óleoColocado, "L")}</b></article>
                <article><span>Óleo necessário</span><b>{fmt(oilNeeded, "L")}</b></article>
                <article><span>Temperatura</span><b>{fmt(Number(gatewayState?.oil?.temperature_c ?? 60), "C")}</b></article>
                <article><span>Status da linha</span><b>{oilLigada ? "ATIVA" : "AGUARDANDO"}</b></article>
              </div>
            </div>
          )}

          {tab === "informacoes" && (
            <div className="info-grid">
              <div className="etapas">
                {["PREPARO", "VÁCUO INICIAL", "VÁCUO PROFUNDO", "INJEÇÃO DE ÓLEO", "ESTABILIZAÇÃO", "FINALIZAÇÃO"].map((e) => (
                  <div key={e} className={etapaAtual === e ? "active" : ""}>{e}</div>
                ))}
              </div>

              <div className="diagnostic-panel">
                <p><b>ID:</b> {operationId || "--"}</p>
                <p><b>Receita:</b> {recipe.title}</p>
                <p><b>Operador:</b> OPERADOR 01</p>
                <p><b>Tanques:</b> {qtdTanques}</p>
                <p><b>Mangueira:</b> {hose.descricao}</p>
                <p><b>Tempo:</b> {timeFmt(elapsedLive)}</p>
                <p><b>Gateway:</b> {gatewayOnline ? "Online" : "Offline"}</p>
                <p><b>Sensor pressão:</b> {sensorBloqueado ? "Falha" : "Online"}</p>
                <p><b>Emergência:</b> {emergencyBloqueada ? "Ativa/Bloqueada" : "Normal"}</p>
                <p><b>Limites:</b> {recipeInvalid ? "Receita inválida" : "Conforme"}</p>
                <p><b>Início:</b> {inícioBloqueado ? "Bloqueado" : "Liberado"}</p>
              </div>

              <div className="logs">
                {logs.length === 0 ? <div>Sem eventos locais.</div> : logs.slice(0, 12).map((l, index) => <div key={`${l.time}-${index}`}>[{l.time}] {l.msg}</div>)}
              </div>
            </div>
          )}
        </div>

        <div className="bottom-tabs">
          {(["reguladores", "bombas", "óleo", "informacoes"] as const).map((t) => (
            <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t.toUpperCase()}</button>
          ))}
        </div>

        {renderMenu()}
      </div>
    );
  }

  if (phase === "alarmes") {
    return (
      <div className={`finalizacao alarm-screen ${screenClass}`}>
        {renderAlarm()}
        <h2>ALARMES E EVENTOS</h2>

        <div className="resumo alarm-summary">
          <p><b>Status:</b> {status}</p>
          <p><b>Etapa:</b> {etapaAtual}</p>
          <p><b>Alarme:</b> {alarmInfo ? alarmInfo.title : "Sem alarme ativo"}</p>
          <p><b>Causa provÃ¡vel:</b> {alarmInfo ? alarmInfo.message : "Nenhuma condição crítica detectada."}</p>
          <p><b>AÃ§Ã£o recomendada:</b> {alarmInfo?.severity === "red" ? "Parar o ciclo, verificar bancada e reconhecer a falha." : alarmInfo ? "Verificar condição indicada e corrigir antes de iniciar." : "OperaÃ§Ã£o liberada."}</p>
          <p><b>Pressão máquina:</b> {fmt(pressãoMáquina, "mbar")}</p>
          <p><b>Pressão media:</b> {fmt(pressãoMedia, "mbar")}</p>
          <p><b>Óleo colocado:</b> {óleoColocado} L</p>
          <p><b>Óleo necessário:</b> {oilNeeded} L</p>
          <button className="emergency-inline" onClick={acionarEmergência}>PARADA CRITICA</button>
        </div>

        <div className="logs alarm-log">
          {logs.length === 0 ? <div>Sem eventos locais registrados.</div> : logs.map((l, index) => <div key={`${l.time}-${index}`}>[{l.time}] {l.msg}</div>)}
        </div>

        <button className="standard-btn compact" onClick={() => setPhase(status === "EM CICLO" ? "operação" : "inicial")}>VOLTAR</button>
        {renderMenu()}
      </div>
    );
  }

  if (phase === "finalizacao") {
    return (
      <div className={`finalizacao ${screenClass}`}>
        {renderAlarm()}
        <h2>CHECKLIST FINAL</h2>

        <div className="resumo">
          <p><b>ID:</b> {operationId}</p>
          <p><b>Receita:</b> {recipe.title}</p>
          <p><b>Tanques:</b> {qtdTanques}</p>
          <p><b>Mangueira:</b> {hose.descricao}</p>
          <p><b>Tempo:</b> {timeFmt(elapsedLive)}</p>
          <p><b>Pressão final:</b> {fmt(pressãoMedia, "mbar")}</p>
          <p><b>Óleo colocado:</b> {óleoColocado} L</p>
          <p><b>Óleo injetado:</b> {fmt(oilInjetado, "L")}</p>
        </div>

        <div className="checklist refined">
          {(Object.keys(checklistPosText) as (keyof Omit<ChecklistPos, "observacao">)[]).map((key) => (
            <label key={key}>
              <input type="checkbox" checked={Boolean(checklistPos[key])} onChange={(e) => setChecklistPos((prev) => ({ ...prev, [key]: e.target.checked }))} />
              <span><b>{checklistPosText[key].title}</b><small>{checklistPosText[key].detail}</small></span>
            </label>
          ))}
          <label className="textarea-label">
            <span><b>Observacao final</b><small>Use para registrar qualquer condicao percebida pelo operador.</small></span>
            <textarea value={checklistPos.observacao} onChange={(e) => setChecklistPos((prev) => ({ ...prev, observacao: e.target.value }))} />
          </label>
        </div>

        <button className="standard-btn compact" disabled={!allCheckedPos} onClick={finalizarOperaçãoCompleta}>FINALIZAR</button>
        {renderMenu()}
      </div>
    );
  }

  return null;
}

createRoot(document.getElementById("root")!).render(<App />);


const tseaHardwarePanelRoot_ihm = document.createElement("div");
document.body.appendChild(tseaHardwarePanelRoot_ihm);
createRoot(tseaHardwarePanelRoot_ihm).render(<HardwareBridgePanel variant="ihm" />);
