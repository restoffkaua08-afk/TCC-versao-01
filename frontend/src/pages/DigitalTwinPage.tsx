import {
 AlertTriangle,
 Bot,
 CheckCircle2,
 ClipboardCheck,
 FlaskConical,
 Gauge,
 HelpCircle,
 SlidersHorizontal,
 Wrench,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import { RegulatorFromManualResult } from "../components/RegulatorVisual";
import { TwinComparison } from "../components/TwinComparison";
import {
 DataTable,
 DemoBadge,
 fmt,
 Kpi,
 Meter,
 PageHeader,
 StatusBadge,
} from "../components/ui";
import type {
 ChatResponse,
 Maintenance,
 ManualOperationConfig,
 ManualOperationResult,
 OperationConfigOptions,
 OperationState,
 PressureReading,
 SimulationResult,
 Tank,
 TwinState,
} from "../types/domain";

type TwinMenu = "cenarios" | "parametros" | "resultado" | "diagnostico" | "assistente";

const defaultConfig: ManualOperationConfig = {
 tank_type: "medio",
 hose_id: 1,
 target_pressure_mbar: 0.2,
 roots_start_pressure_mbar: 0.6,
 stop_pressure_mbar: 0.2,
 oil_flow_l_min: 2,
 oil_delay_seconds: 2,
 max_cycle_seconds: 1800,
 roots_speed_hz: 65,
 vacuum_ramp: "suave",
 hose_correction_enabled: true,
 oil_compensation_enabled: true,
 selected_tank: 1,
 deviation_alert_mbar: 10,
 simulate_hose_leak: false,
 simulate_sensor_failure: false,
 simulate_plc_loss: false,
};

export function DigitalTwinPage({
 twin,
 state,
 history,
 tanks,
 whatIfs,
 maintenance,
 maxRisk,
 chatText,
 setChatText,
 chat,
 onChat,
}: {
 twin: TwinState | null;
 state: OperationState | null;
 history: PressureReading[];
 tanks: Tank[];
 whatIfs: SimulationResult[];
 maintenance: Maintenance[];
 maxRisk: number;
 chatText: string;
 setChatText: (value: string) => void;
 chat: ChatResponse | null;
 onChat: (event: FormEvent) => void;
 onRunWhatIf: () => void;
}) {
 const [menu, setMenu] = useState<TwinMenu>("cenarios");
 const [options, setOptions] = useState<OperationConfigOptions | null>(null);
 const [config, setConfig] = useState<ManualOperationConfig>(defaultConfig);
 const [result, setResult] = useState<ManualOperationResult | null>(null);
 const [loading, setLoading] = useState(false);
 const [selectedPreset, setSelectedPreset] = useState<string>("segura");
 const [error, setError] = useState<string | null>(null);
 const [localQuestion, setLocalQuestion] = useState("Explique essa simulação em linguagem simples para o operador.");
 const [localAnswer, setLocalAnswer] = useState<string>("");

 const latestWhatIf = whatIfs[0];

 useEffect(() => {
 api
 .configOptions()
 .then((data) => {
 setOptions(data);
 const firstHose = data.hoses[0];
 if (firstHose) {
 setConfig((old) => ({ ...old, hose_id: firstHose.id }));
 }
 })
 .catch((err) =>
 setError(err instanceof Error ? err.message : "Falha ao carregar configurações."),
 );
 }, []);

 const tone =
 result?.status === "critical"
 ? "bad"
 : result?.status === "warning"
 ? "warn"
 : "good";

 function update<K extends keyof ManualOperationConfig>(
 key: K,
 value: ManualOperationConfig[K],
 ) {
 setConfig((old) => ({ ...old, [key]: value }));
 }

 function applyPreset(id: string) {
 const preset = options?.presets?.[id];
 if (!preset) return;

 setSelectedPreset(id);
 setConfig({ ...defaultConfig, ...preset.config });
 setResult(null);
 setLocalAnswer("");
 setMenu("parametros");
 }

 async function simulate(nextMenu: TwinMenu = "resultado") {
 setLoading(true);
 setError(null);

 try {
 const response = await api.manualSimulate(config);
 setResult(response);
 setLocalAnswer(buildAssistantAnswer(localQuestion, response));
 setMenu(nextMenu);
 } catch (err) {
 setError(err instanceof Error ? err.message : "Falha ao simular operação.");
 } finally {
 setLoading(false);
 }
 }

 function askLocalAssistant(event: FormEvent) {
 event.preventDefault();
 setLocalAnswer(buildAssistantAnswer(localQuestion, result));
 }

 const selectedPresetData = selectedPreset ? options?.presets?.[selectedPreset] : null;
 const interpretation = buildInterpretation(result);

 return (
 <section className="page-stack twin-console">
 <PageHeader
 eyebrow="Gêmeo Digital"
 title="Bancada de simulação do processo de vácuo"
 subtitle="Escolha um cenário, ajuste os parâmetros e veja se a operação seria segura, arriscada ou crítica antes de executar na fábrica."
 actions={<DemoBadge />}
 />

 {error && <div className="error">{error}</div>}

 <section className="twin-explain-card">
 <div>
 <strong>Leitura simples da tela</strong>
 <span>
 Cenários simulam situações hipotéticas. Resultado mostra o que aconteceria. Diagnóstico explica o motivo.
 Assistente traduz a simulação para linguagem de operador.
 </span>
 </div>
 <StatusBadge tone={tone}>
 {result ? statusLabel(result.status) : "Aguardando simulação"}
 </StatusBadge>
 </section>

 <nav className="twin-step-nav">
 <button className={menu === "cenarios" ? "active" : ""} onClick={() => setMenu("cenarios")}>
 <FlaskConical size={17} />
 Cenários
 </button>
 <button className={menu === "parametros" ? "active" : ""} onClick={() => setMenu("parametros")}>
 <SlidersHorizontal size={17} />
 Parâmetros
 </button>
 <button className={menu === "resultado" ? "active" : ""} onClick={() => setMenu("resultado")}>
 <Gauge size={17} />
 Resultado
 </button>
 <button className={menu === "diagnostico" ? "active" : ""} onClick={() => setMenu("diagnostico")}>
 <ClipboardCheck size={17} />
 Diagnóstico
 </button>
 <button className={menu === "assistente" ? "active" : ""} onClick={() => setMenu("assistente")}>
 <Bot size={17} />
 Assistente
 </button>
 </nav>

 {menu === "cenarios" && (
 <section className="twin-section-card">
 <div className="section-intro">
 <span className="eyebrow">Etapa 1</span>
 <h2>Escolha um cenário para demonstrar</h2>
 <p>
 Use estes cenários para mostrar à TSEA quando a operação é segura e quando o Gêmeo Digital antecipa problemas
 como óleo insuficiente, atraso, perda de mangueira, vazamento ou ciclo longo.
 </p>
 </div>

 <div className="scenario-menu-grid">
 {options &&
 Object.entries(options.presets).map(([id, preset]) => {
 const isActive = selectedPreset === id;
 const presetTone =
 id.includes("oleo") || id.includes("vazamento")
 ? "bad"
 : id.includes("mangueira") || id.includes("tanque")
 ? "warn"
 : "good";

 return (
 <button
 key={id}
 type="button"
 className={`scenario-tile ${isActive ? "active" : ""} ${presetTone}`}
 onClick={() => applyPreset(id)}
 >
 <strong>{preset.name}</strong>
 <span>{preset.description}</span>
 <small>{isActive ? "Selecionado" : "Selecionar cenário"}</small>
 </button>
 );
 })}
 </div>

 <div className="next-action-row">
 <button type="button" onClick={() => setMenu("parametros")}>
 Continuar para parâmetros
 </button>
 <button type="button" className="secondary" onClick={() => simulate("resultado")} disabled={loading}>
 {loading ? "Simulando..." : "Simular direto"}
 </button>
 </div>
 </section>
 )}

 {menu === "parametros" && (
 <section className="twin-section-card">
 <div className="section-intro">
 <span className="eyebrow">Etapa 2</span>
 <h2>Parâmetros usados na simulação</h2>
 <p>
 Estes campos representam o que influencia o ciclo: tanque, mangueira, pressão final, Roots, óleo, tempo,
 rampa e possíveis falhas. O Gêmeo Digital usa tudo isso para prever risco.
 </p>
 </div>

 {selectedPresetData && (
 <div className="selected-preset-note">
 <strong>{selectedPresetData.name}</strong>
 <span>{selectedPresetData.description}</span>
 </div>
 )}

 <div className="parameter-layout">
 <div className="form-grid">
 <label>
 Categoria do tanque
 <select value={config.tank_type} onChange={(e) => update("tank_type", e.target.value)}>
 {options &&
 Object.entries(options.tank_types).map(([key, tank]) => (
 <option key={key} value={key}>
 {tank.label}
 </option>
 ))}
 </select>
 </label>

 <label>
 Linha de Vácuo
 <select value={config.hose_id} onChange={(e) => update("hose_id", Number(e.target.value))}>
 {options?.hoses.map((hose) => (
 <option key={hose.id} value={hose.id}>
 {hose.code} · {hose.length_m}m · Ø {hose.diameter_in}"
 </option>
 ))}
 </select>
 </label>

 <label>
 Pressão Final do Processo desejada (mbar)
 <input type="number" step="0.01" value={config.target_pressure_mbar} onChange={(e) => update("target_pressure_mbar", Number(e.target.value))} />
 </label>

 <label>
 Pressão para ligar Roots (mbar)
 <input type="number" step="0.01" value={config.roots_start_pressure_mbar} onChange={(e) => update("roots_start_pressure_mbar", Number(e.target.value))} />
 </label>

 <label>
 Pressão para desligar bombas (mbar)
 <input type="number" step="0.01" value={config.stop_pressure_mbar} onChange={(e) => update("stop_pressure_mbar", Number(e.target.value))} />
 </label>

 <label>
 Vazão de Injeção de Óleo (L/min)
 <input type="number" step="0.1" value={config.oil_flow_l_min} onChange={(e) => update("oil_flow_l_min", Number(e.target.value))} />
 </label>

 <label>
 Atraso da Injeção de Óleo (s)
 <input type="number" value={config.oil_delay_seconds} onChange={(e) => update("oil_delay_seconds", Number(e.target.value))} />
 </label>

 <label>
 Tempo máximo do ciclo (s)
 <input type="number" value={config.max_cycle_seconds} onChange={(e) => update("max_cycle_seconds", Number(e.target.value))} />
 </label>

 <label>
 Velocidade da Roots (Hz)
 <input type="number" value={config.roots_speed_hz} onChange={(e) => update("roots_speed_hz", Number(e.target.value))} />
 </label>

 <label>
 Rampa de vácuo
 <select value={config.vacuum_ramp} onChange={(e) => update("vacuum_ramp", e.target.value)}>
 {options &&
 Object.entries(options.ramps).map(([key, ramp]) => (
 <option key={key} value={key}>
 {ramp.label}
 </option>
 ))}
 </select>
 </label>

 <label>
 Limite de desvio (mbar)
 <input type="number" value={config.deviation_alert_mbar} onChange={(e) => update("deviation_alert_mbar", Number(e.target.value))} />
 </label>

 <label>
 Tanque de Processo de Processo de Processo específico
 <select value={config.selected_tank} onChange={(e) => update("selected_tank", Number(e.target.value))}>
 <option value={1}>Tanque de Processo de Processo de Processo 1</option>
 <option value={2}>Tanque de Processo de Processo de Processo 2</option>
 <option value={3}>Tanque de Processo de Processo de Processo 3</option>
 </select>
 </label>
 </div>

 <div className="simulation-switch-panel">
 <strong>Falhas e correções</strong>

 <label>
 <input type="checkbox" checked={config.hose_correction_enabled} onChange={(e) => update("hose_correction_enabled", e.target.checked)} />
 Aplicar correção da mangueira
 </label>

 <label>
 <input type="checkbox" checked={config.oil_compensation_enabled} onChange={(e) => update("oil_compensation_enabled", e.target.checked)} />
 Ativar compensação de óleo
 </label>

 <label>
 <input type="checkbox" checked={config.simulate_hose_leak} onChange={(e) => update("simulate_hose_leak", e.target.checked)} />
 Simular vazamento
 </label>

 <label>
 <input type="checkbox" checked={config.simulate_sensor_failure} onChange={(e) => update("simulate_sensor_failure", e.target.checked)} />
 Simular falha de sensor
 </label>

 <label>
 <input type="checkbox" checked={config.simulate_plc_loss} onChange={(e) => update("simulate_plc_loss", e.target.checked)} />
 Simular perda de comunicação com CLP
 </label>
 </div>
 </div>

 <div className="next-action-row">
 <button type="button" onClick={() => simulate("resultado")} disabled={loading}>
 {loading ? "Simulando..." : "Simular no Gêmeo Digital"}
 </button>
 <button type="button" className="ghost" onClick={() => setMenu("cenarios")}>
 Voltar aos cenários
 </button>
 </div>
 </section>
 )}

 {menu === "resultado" && (
 <section className="twin-section-card result-readable-section">
 <div className="section-intro">
 <span className="eyebrow">Etapa 3</span>
 <h2>Resultado da simulação</h2>
 <p>
 Esta área resume o resultado sem excesso de dados. Primeiro veja o status geral; depois confira o regulador,
 os indicadores e a curva simplificada.
 </p>
 </div>

 {!result ? (
 <div className="empty-twin-result">
 <strong>Nenhuma simulação executada.</strong>
 <span>Escolha um cenário ou ajuste os parâmetros e clique em simular.</span>
 <button type="button" onClick={() => setMenu("cenarios")}>
 Escolher cenário
 </button>
 </div>
 ) : (
 <>
 <section className={`result-summary-hero ${tone}`}>
 <div>
 <span className="eyebrow">Estado Operacional final</span>
 <h2>{statusLabel(result.status)}</h2>
 <p>{interpretation.main}</p>
 <strong>{interpretation.action}</strong>
 </div>

 <div className="result-summary-kpis">
 <Kpi label="Risco estrutural" value={fmt(result.metrics.max_collapse_risk_pct, "%")} tone={tone} />
 <Kpi label="Pressão efetiva" value={fmt(result.metrics.max_effective_pressure_mbar, "mbar")} tone={tone} />
 <Kpi label="Desvio máximo" value={fmt(result.metrics.max_deviation_mbar, "mbar")} tone={tone} />
 <Kpi
 label="Tempo estimado"
 value={result.metrics.estimated_time_seconds ? fmt(result.metrics.estimated_time_seconds, "s") : "--"}
 />
 </div>
 </section>

 <div className="result-grid readable-result-grid">
 <RegulatorFromManualResult result={result} />

 <section className="panel">
 <div className="panel-title">
 <div>
 <h2>Rampa simplificada</h2>
 <p>
 Abrir Detalhesde: pressão real no tanque. Cinza: pressão esperada. Abrir Detalhesmelho: carga estrutural/risco.
 </p>
 </div>
 </div>
 <TwinResultChart result={result} />
 </section>
 </div>

 <section className="result-explanation-grid">
 <article>
 <strong>O que o gráfico mostra?</strong>
 <span>
 Se a linha verde fica distante da cinza, o processo real simulado está fugindo do comportamento esperado.
 </span>
 </article>
 <article>
 <strong>Quando fica perigoso?</strong>
 <span>
 Quando a carga estrutural sobe demais, geralmente por óleo insuficiente, óleo atrasado ou vácuo agressivo.
 </span>
 </article>
 <article>
 <strong>O que o operador deve observar?</strong>
 <span>
 Risco estrutural, atraso do óleo, partida da Roots e diferença entre pressão real e esperada.
 </span>
 </article>
 </section>
 </>
 )}
 </section>
 )}

 {menu === "diagnostico" && (
 <section className="twin-section-card">
 <div className="section-intro">
 <span className="eyebrow">Etapa 4</span>
 <h2>Diagnóstico explicado</h2>
 <p>
 Esta tela traduz a simulação em causa provável, impacto no processo e ação recomendada.
 </p>
 </div>

 <div className="diagnosis-explain-grid">
 <article className={`diagnosis-card ${tone}`}>
 <HelpCircle size={22} />
 <strong>O que aconteceu?</strong>
 <p>{result ? interpretation.whatHappened : "Execute uma simulação para gerar uma leitura do processo."}</p>
 </article>

 <article className={`diagnosis-card ${tone}`}>
 <AlertTriangle size={22} />
 <strong>Por que isso importa?</strong>
 <p>{result ? interpretation.whyItMatters : "O diagnóstico depende dos parâmetros escolhidos no Gêmeo Digital."}</p>
 </article>

 <article className={`diagnosis-card ${tone}`}>
 <CheckCircle2 size={22} />
 <strong>O que fazer?</strong>
 <p>{result ? interpretation.action : "Escolha um cenário e simule para receber recomendação."}</p>
 </article>
 </div>

 <div className="diagnostic-grid">
 <section className="panel">
 <div className="panel-title">
 <div>
 <h2>Alarmes projetados</h2>
 <p>Eventos que aconteceriam com os parâmetros simulados.</p>
 </div>
 <StatusBadge tone={tone}>{result?.alarms.length ?? 0} alarmes</StatusBadge>
 </div>

 {result?.alarms.length ? (
 <div className="alarm-list">
 {result.alarms.map((alarm) => (
 <article key={alarm.code} className={`alarm-item ${alarm.severity}`}>
 <div>
 <strong>{translateAlarm(alarm.code)}</strong>
 <span>{alarm.message}</span>
 </div>
 </article>
 ))}
 </div>
 ) : (
 <p className="empty-state">Nenhum alarme projetado para a última simulação.</p>
 )}
 </section>

 <section className="panel">
 <div className="panel-title">
 <div>
 <h2>Gêmeo atual</h2>
 <p>Indicadores baseados no ciclo em tempo real, quando houver dados.</p>
 </div>
 <StatusBadge>{twin?.bottleneck ?? "Aguardando"}</StatusBadge>
 </div>

 <Meter label="Saúde" value={twin?.health_index ?? 0} tone={(twin?.health_index ?? 0) > 75 ? "good" : "warn"} />
 <Meter label="Estabilidade" value={twin?.stability_index ?? 0} tone={(twin?.stability_index ?? 0) > 75 ? "good" : "warn"} />

 <ul className="recommendation-list">
 {(twin?.recommendations.length
 ? twin.recommendations
 : ["Inicie um ciclo ou execute uma simulação para gerar diagnóstico."]
 ).map((item) => (
 <li key={item}>{item}</li>
 ))}
 </ul>
 </section>

 <section className="panel">
 <div className="panel-title">
 <div>
 <h2>Comparação por tanque</h2>
 <p>Operação real simulada x esperado.</p>
 </div>
 </div>
 <TwinComparison state={state} />
 </section>

 <section className="panel">
 <div className="panel-title">
 <div>
 <h2><Wrench size={18} /> Manutenção preditiva</h2>
 <p>Bombas e mangueiras monitoradas pelo sistema.</p>
 </div>
 </div>
 <DataTable rows={maintenance.slice(0, 5)} />
 </section>
 </div>
 </section>
 )}

 {menu === "assistente" && (
 <section className="twin-section-card">
 <div className="section-intro">
 <span className="eyebrow">Etapa 5</span>
 <h2>Assistente da simulação</h2>
 <p>
 O assistente abaixo funciona mesmo sem API externa. Ele responde usando o resultado da última simulação.
 </p>
 </div>

 <section className="panel chat-panel improved-assistant">
 <form onSubmit={askLocalAssistant}>
 <input value={localQuestion} onChange={(event) => setLocalQuestion(event.target.value)} />
 <button type="submit">
 <Bot size={16} />
 Analisar simulação
 </button>
 </form>

 <p className="assistant-answer">
 {localAnswer ||
 "Execute uma simulação e pergunte algo como: por que esse cenário é perigoso? O que o operador deve fazer?"}
 </p>

 <div className="assistant-shortcuts">
 <button
 type="button"
 className="ghost"
 onClick={() => {
 const question = "Explique o risco desta simulação.";
 setLocalQuestion(question);
 setLocalAnswer(buildAssistantAnswer(question, result));
 }}
 >
 Explicar risco
 </button>
 <button
 type="button"
 className="ghost"
 onClick={() => {
 const question = "O que o operador deve fazer?";
 setLocalQuestion(question);
 setLocalAnswer(buildAssistantAnswer(question, result));
 }}
 >
 Ação recomendada
 </button>
 <button
 type="button"
 className="ghost"
 onClick={() => {
 const question = "Explique para apresentação da TSEA.";
 setLocalQuestion(question);
 setLocalAnswer(buildAssistantAnswer(question, result));
 }}
 >
 Fala para apresentação
 </button>
 </div>

 <details className="legacy-chat-details">
 <summary>Chat local antigo</summary>
 <form onSubmit={onChat}>
 <input value={chatText} onChange={(event) => setChatText(event.target.value)} />
 <button type="submit">Enviar</button>
 </form>
 <p>{chat?.answer ?? "Sem resposta do chat antigo."}</p>
 </details>

 {latestWhatIf && <small>Último what-if legado: {latestWhatIf.summary}</small>}
 </section>
 </section>
 )}
 </section>
 );
}

function statusLabel(status: string) {
 if (status === "success") return "Ciclo Operacional Estável";
 if (status === "warning") return "Operação com atenção";
 if (status === "critical") return "Operação crítica";
 return status;
}

function translateAlarm(code: string) {
 const map: Record<string, string> = {
 OIL_FLOW_LOW: "Vazão de Injeção de Baixa Vazão de Óleo",
 OIL_INJECTION_DELAY: "Atraso na injeção de óleo",
 STRUCTURAL_COLLAPSE_RISK: "Risco Estrutural estrutural",
 STRUCTURAL_RISK_ATTENTION: "Atenção ao risco estrutural",
 HOSE_LOSS_HIGH: "Perda elevada na mangueira",
 HOSE_LEAK_SUSPECTED: "Possível vazamento",
 SENSOR_FAILURE_SIMULATED: "Falha simulada de sensor",
 PLC_COMM_LOSS_SIMULATED: "Perda de comunicação com CLP",
 ROOTS_NOT_STARTED: "Roots não entrou na faixa esperada",
 REAL_EXPECTED_DEVIATION: "Desvio entre real e esperado",
 TARGET_NOT_REACHED: "Pressão alvo não atingida",
 };

 return map[code] ?? code;
}

function buildInterpretation(result: ManualOperationResult | null) {
 if (!result) {
 return {
 main: "Nenhuma simulação foi executada ainda.",
 whatHappened: "Aguardando parâmetros e simulação.",
 whyItMatters: "Sem resultado, ainda não há risco calculado.",
 action: "Escolha um cenário e clique em simular.",
 };
 }

 const alarms = result.alarms.map((alarm) => alarm.code);
 const risk = result.metrics.max_collapse_risk_pct;
 const deviation = result.metrics.max_deviation_mbar;

 if (result.status === "success") {
 return {
 main: "O ciclo simulado ficou dentro da faixa segura. A pressão caiu conforme esperado e a compensação de óleo foi suficiente.",
 whatHappened: "O tanque atingiu o comportamento previsto pelo modelo. A diferença entre real e esperado permaneceu controlada.",
 whyItMatters: "Isso mostra que a receita escolhida, a mangueira e a vazão de óleo estão adequadas para uma operação estável.",
 action: "Manter os parâmetros, registrar o ciclo e usar este cenário como referência de operação segura.",
 };
 }

 if (alarms.includes("STRUCTURAL_COLLAPSE_RISK")) {
 return {
 main: "O cenário indica risco crítico de colapso estrutural. A carga efetiva ultrapassou o limite seguro definido para o tanque.",
 whatHappened: "A queda de pressão gerou uma carga elevada nas paredes do tanque, e o óleo não compensou o esforço a tempo.",
 whyItMatters: `O risco máximo chegou a ${risk.toFixed(1)}%. Isso representa uma condição que não deveria ser executada em operação real sem revisão técnica.`,
 action: "Reduzir a rampa de vácuo, aumentar a vazão de óleo, diminuir atraso de injeção e validar a receita com engenharia.",
 };
 }

 if (alarms.includes("OIL_FLOW_LOW") || alarms.includes("OIL_INJECTION_DELAY")) {
 return {
 main: "O problema principal está na injeção de óleo. O óleo está insuficiente ou atrasado em relação à queda de pressão.",
 whatHappened: "O vácuo evoluiu mais rápido do que a compensação de óleo, criando uma região de risco no tanque.",
 whyItMatters: "Esse é um dos pontos mais críticos do processo, porque o óleo ajuda a reduzir a carga efetiva sobre o tanque.",
 action: "Ajustar vazão de óleo, reduzir atraso de início e usar rampa mais suave antes de liberar o ciclo.",
 };
 }

 if (alarms.includes("HOSE_LOSS_HIGH") || alarms.includes("HOSE_LEAK_SUSPECTED")) {
 return {
 main: "O cenário indica problema relacionado à mangueira ou conexão.",
 whatHappened: `A diferença entre curva real e esperada chegou a ${deviation.toFixed(2)} mbar, sugerindo perda de carga ou vazamento.`,
 whyItMatters: "Se a mangueira distorce a leitura, o operador pode achar que o tanque atingiu o vácuo certo quando ainda não atingiu.",
 action: "Trocar por mangueira mais curta, aplicar correção, inspecionar conexão e repetir simulação.",
 };
 }

 return {
 main: "O cenário exige atenção. O Gêmeo Digital encontrou desvios que podem afetar segurança, qualidade ou tempo de ciclo.",
 whatHappened: result.diagnosis,
 whyItMatters: "Mesmo sem colapso crítico, desvios de pressão e tempo podem indicar perda de eficiência ou risco operacional.",
 action: result.recommendation,
 };
}

function buildAssistantAnswer(question: string, result: ManualOperationResult | null) {
 if (!result) {
 return "Ainda não há uma simulação para analisar. Primeiro escolha um cenário, ajuste os parâmetros e clique em simular no Gêmeo Digital.";
 }

 const text = question.toLowerCase();
 const info = buildInterpretation(result);

 if (text.includes("apresentação") || text.includes("tsea")) {
 return `Para apresentar à TSEA: este cenário mostra que o Gêmeo Digital consegue prever o comportamento do processo antes da operação real. Resultado: ${statusLabel(result.status)}. ${info.main} A recomendação é: ${info.action}`;
 }

 if (text.includes("risco") || text.includes("perigoso") || text.includes("colapso")) {
 return `${info.whyItMatters} O risco estrutural máximo calculado foi de ${result.metrics.max_collapse_risk_pct.toFixed(1)}%. ${info.action}`;
 }

 if (text.includes("operador") || text.includes("fazer") || text.includes("ação")) {
 return `Ação recomendada para o operador: ${info.action}`;
 }

 if (text.includes("óleo") || text.includes("oleo")) {
 return `Nesta simulação, a vazão de óleo configurada foi ${result.config.oil_flow_l_min} L/min e o atraso foi ${result.config.oil_delay_seconds}s. ${info.main}`;
 }

 if (text.includes("mangueira")) {
 return `A mangueira usada foi ${result.hose.code}, com ${result.hose.length_m}m. A perda simulada contribuiu para um desvio máximo de ${result.metrics.max_deviation_mbar.toFixed(2)} mbar. ${info.action}`;
 }

 return `${info.main} ${info.whyItMatters} ${info.action}`;
}

function TwinResultChart({ result }: { result: ManualOperationResult }) {
 const points = result.timeline;
 const max = Math.max(
 ...points.flatMap((item) => [
 item.real_pressure_mbar,
 item.expected_pressure_mbar,
 item.effective_pressure_mbar,
 ]),
 10,
 );
 const min = Math.min(
 ...points.flatMap((item) => [
 item.real_pressure_mbar,
 item.expected_pressure_mbar,
 item.effective_pressure_mbar,
 ]),
 0,
 );
 const span = Math.max(max - min, 1);

 function lineFor(
 key: "real_pressure_mbar" | "expected_pressure_mbar" | "effective_pressure_mbar",
 ) {
 return points
 .map((item, index) => {
 const x = (index / Math.max(points.length - 1, 1)) * 100;
 const y = 96 - ((item[key] - min) / span) * 88;
 return `${x},${y}`;
 })
 .join(" ");
 }

 return (
 <div className="chart-panel twin-chart-clean">
 <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Curva do Gêmeo Digital">
 <line x1="0" x2="100" y1="96" y2="96" className="axis" />
 <line x1="0" x2="0" y1="4" y2="96" className="axis" />
 {[20, 40, 60, 80].map((y) => (
 <line key={y} x1="0" x2="100" y1={y} y2={y} className="grid-line" />
 ))}

 <polyline points={lineFor("expected_pressure_mbar")} fill="none" stroke="#475569" strokeDasharray="4 4" strokeWidth="1.8" />
 <polyline points={lineFor("real_pressure_mbar")} fill="none" stroke="#1e5d4b" strokeWidth="2.8" />
 <polyline points={lineFor("effective_pressure_mbar")} fill="none" stroke="#dc2626" strokeWidth="2.1" />
 </svg>

 <div className="legend readable-legend">
 <span><i style={{ background: "#1e5d4b" }} /> Pressão real no tanque</span>
 <span><i style={{ background: "#475569" }} /> Pressão esperada</span>
 <span><i style={{ background: "#dc2626" }} /> Carga estrutural / risco</span>
 </div>
 </div>
 );
}
