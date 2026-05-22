import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CheckCircle2, FileText, Gauge, Menu, Play, Power, RotateCcw, ShieldAlert, SlidersHorizontal, Square, Wrench, X } from "lucide-react";
import "./styles.css";
const menuItems = [
    { key: "inicio", label: "Início", description: "Estado geral da máquina" },
    { key: "preparacao", label: "Preparação", description: "Configurar ciclo e checklist" },
    { key: "operacao", label: "Operação", description: "Acompanhar vácuo, óleo e bombas" },
    { key: "alarmes", label: "Alarmes", description: "Eventos e reconhecimento" },
    { key: "registro", label: "Registro", description: "Resumo final do ciclo" }
];
function clampTankCount(value) {
    return Math.max(1, Math.min(3, Math.round(value)));
}
function statusClass(status) {
    const lower = status.toLowerCase();
    if (lower.includes("crítico") || lower.includes("bloqueada"))
        return "critical";
    if (lower.includes("atenção"))
        return "warning";
    if (lower.includes("operação") || lower.includes("ok") || lower.includes("pronta"))
        return "success";
    return "neutral";
}
function makeTanks(count, cycleRunning) {
    return Array.from({ length: count }).map((_, index) => {
        const pressure = cycleRunning ? 8.2 + index * 0.7 : 1013;
        const oil = cycleRunning ? 42 + index * 4 : 0;
        const risk = cycleRunning ? 18 + index * 8 : 0;
        return {
            code: `TQ-0${index + 1}`,
            pressure,
            target: 8,
            oil,
            risk,
            status: risk >= 70 ? "Crítico" : risk >= 45 ? "Atenção" : "OK"
        };
    });
}
function App() {
    const [screen, setScreen] = useState("inicio");
    const [menuOpen, setMenuOpen] = useState(false);
    const [tankCount, setTankCount] = useState(2);
    const [cycleStatus, setCycleStatus] = useState("Pronta");
    const [operator, setOperator] = useState("João Martins");
    const [shift, setShift] = useState("Manhã");
    const [recipe, setRecipe] = useState("Receita padrão");
    const [hose, setHose] = useState("MG-02");
    const [checklist, setChecklist] = useState({
        hose: true,
        upperValve: true,
        lowerValve: true,
        tanks: true,
        oil: false,
        emergency: true
    });
    const [b1Running, setB1Running] = useState(true);
    const [b2Running, setB2Running] = useState(false);
    const [emergency, setEmergency] = useState(false);
    const [ackAlarm, setAckAlarm] = useState(false);
    const cycleRunning = cycleStatus === "Em operação" || cycleStatus === "Atenção";
    const tanks = useMemo(() => makeTanks(tankCount, cycleRunning), [tankCount, cycleRunning]);
    const checklistReady = Object.values(checklist).every(Boolean);
    function startCycle() {
        if (!checklistReady) {
            setCycleStatus("Atenção");
            setScreen("preparacao");
            return;
        }
        setEmergency(false);
        setCycleStatus("Em operação");
        setB1Running(true);
        setB2Running(false);
        setScreen("operacao");
    }
    function emergencyStop() {
        setEmergency(true);
        setCycleStatus("Bloqueada");
        setB1Running(false);
        setB2Running(false);
        setScreen("alarmes");
    }
    function resetCycle() {
        setEmergency(false);
        setCycleStatus("Pronta");
        setB1Running(false);
        setB2Running(false);
        setAckAlarm(false);
        setScreen("inicio");
    }
    function stopPump(pump) {
        if (pump === "B1")
            setB1Running(false);
        if (pump === "B2")
            setB2Running(false);
        setCycleStatus("Atenção");
    }
    return (_jsx("div", { className: "ihm-stage", children: _jsxs("div", { className: "industrial-tablet", children: [_jsx("div", { className: "tablet-grip top-left" }), _jsx("div", { className: "tablet-grip top-right" }), _jsxs("div", { className: "hardware-button hardware-left", children: [_jsx("button", { onClick: () => stopPump("B1"), "aria-label": "Parar bomba B1", children: _jsx(Square, { size: 28 }) }), _jsx("span", { children: "PARAR B1" })] }), _jsxs("div", { className: "hardware-button hardware-right", children: [_jsx("button", { onClick: () => stopPump("B2"), "aria-label": "Parar bomba B2", children: _jsx(Square, { size: 28 }) }), _jsx("span", { children: "PARAR B2" })] }), _jsxs("div", { className: "hardware-emergency", children: [_jsx("button", { onClick: emergencyStop, "aria-label": "Emerg\u00EAncia geral", children: _jsx(Power, { size: 42 }) }), _jsx("span", { children: "EMERG\u00CANCIA GERAL" })] }), _jsxs("main", { className: "ihm-screen", children: [_jsxs("header", { className: "ihm-topbar", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "TSEA IHM LOCAL" }), _jsx("h1", { children: screenTitle(screen) })] }), _jsxs("div", { className: "top-status-group", children: [_jsx(StatusPill, { label: cycleStatus }), _jsx("button", { className: "menu-button", onClick: () => setMenuOpen(true), "aria-label": "Abrir menu", children: _jsx(Menu, { size: 26 }) })] })] }), _jsxs("section", { className: "machine-line", children: [_jsx(InfoTile, { label: "PLC", value: "Simulado online", tone: "success" }), _jsx(InfoTile, { label: "Supervis\u00F3rio", value: "Aguardando integra\u00E7\u00E3o", tone: "neutral" }), _jsx(InfoTile, { label: "Operador", value: operator, tone: "neutral" }), _jsx(InfoTile, { label: "Turno", value: shift, tone: "neutral" })] }), _jsxs("section", { className: "ihm-content", children: [screen === "inicio" && (_jsx(StartScreen, { cycleStatus: cycleStatus, tankCount: tankCount, startCycle: startCycle, setScreen: setScreen })), screen === "preparacao" && (_jsx(PreparationScreen, { tankCount: tankCount, setTankCount: setTankCount, operator: operator, setOperator: setOperator, shift: shift, setShift: setShift, recipe: recipe, setRecipe: setRecipe, hose: hose, setHose: setHose, checklist: checklist, setChecklist: setChecklist, checklistReady: checklistReady, startCycle: startCycle, tanks: tanks })), screen === "operacao" && (_jsx(OperationScreen, { tanks: tanks, b1Running: b1Running, b2Running: b2Running, setB1Running: setB1Running, setB2Running: setB2Running, setCycleStatus: setCycleStatus, setScreen: setScreen })), screen === "alarmes" && (_jsx(AlarmsScreen, { emergency: emergency, ackAlarm: ackAlarm, setAckAlarm: setAckAlarm, setScreen: setScreen, resetCycle: resetCycle })), screen === "registro" && (_jsx(RegisterScreen, { tankCount: tankCount, operator: operator, shift: shift, hose: hose, recipe: recipe, cycleStatus: cycleStatus, resetCycle: resetCycle }))] }), _jsxs("footer", { className: "ihm-footer", children: [_jsx("button", { onClick: () => setScreen("inicio"), children: "In\u00EDcio" }), _jsx("button", { onClick: () => setScreen("preparacao"), children: "Prepara\u00E7\u00E3o" }), _jsx("button", { onClick: () => setScreen("operacao"), children: "Opera\u00E7\u00E3o" }), _jsx("button", { onClick: () => setScreen("alarmes"), children: "Alarmes" }), _jsx("button", { onClick: () => setScreen("registro"), children: "Registro" })] })] }), menuOpen && (_jsx("div", { className: "modal-backdrop", children: _jsxs("div", { className: "ihm-menu-modal", children: [_jsxs("div", { className: "modal-header", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "NAVEGA\u00C7\u00C3O DA IHM" }), _jsx("h2", { children: "Menu operacional" })] }), _jsx("button", { className: "close-button", onClick: () => setMenuOpen(false), "aria-label": "Fechar menu", children: _jsx(X, { size: 24 }) })] }), _jsx("div", { className: "menu-grid", children: menuItems.map((item) => (_jsxs("button", { className: screen === item.key ? "active" : "", onClick: () => {
                                        setScreen(item.key);
                                        setMenuOpen(false);
                                    }, children: [_jsx("strong", { children: item.label }), _jsx("span", { children: item.description })] }, item.key))) })] }) }))] }) }));
}
function screenTitle(screen) {
    const map = {
        inicio: "Início da máquina",
        preparacao: "Preparação do ciclo",
        operacao: "Operação em andamento",
        alarmes: "Alarmes e bloqueios",
        registro: "Registro do ciclo"
    };
    return map[screen];
}
function StatusPill({ label }) {
    return _jsx("span", { className: `status-pill ${statusClass(label)}`, children: label });
}
function InfoTile({ label, value, tone }) {
    return (_jsxs("div", { className: `info-tile ${tone}`, children: [_jsx("span", { children: label }), _jsx("strong", { children: value })] }));
}
function StartScreen({ cycleStatus, tankCount, startCycle, setScreen }) {
    return (_jsxs("div", { className: "start-layout", children: [_jsxs("section", { className: "hero-panel", children: [_jsx("span", { className: "eyebrow", children: "ESTADO GERAL" }), _jsxs("h2", { children: ["M\u00E1quina ", cycleStatus.toLowerCase()] }), _jsx("p", { children: "IHM local preparada para opera\u00E7\u00E3o de v\u00E1cuo, controle visual das bombas e acompanhamento dos tanques." }), _jsxs("div", { className: "quick-status", children: [_jsx(InfoTile, { label: "Tanques selecionados", value: `${tankCount}`, tone: "neutral" }), _jsx(InfoTile, { label: "\u00DAltimo ciclo", value: "IHM-OP-0001", tone: "neutral" }), _jsx(InfoTile, { label: "Modo", value: "Simulado", tone: "warning" })] })] }), _jsxs("section", { className: "action-panel", children: [_jsxs("button", { className: "primary-action", onClick: () => setScreen("preparacao"), children: [_jsx(SlidersHorizontal, { size: 34 }), "Novo ciclo"] }), _jsxs("button", { className: "secondary-action", onClick: startCycle, children: [_jsx(Play, { size: 34 }), "Iniciar direto"] }), _jsxs("button", { className: "secondary-action", onClick: () => setScreen("alarmes"), children: [_jsx(ShieldAlert, { size: 34 }), "Alarmes"] }), _jsxs("button", { className: "secondary-action", onClick: () => setScreen("registro"), children: [_jsx(FileText, { size: 34 }), "Registro"] })] })] }));
}
function PreparationScreen(props) {
    const checklistItems = [
        { key: "hose", label: "Mangueira conectada" },
        { key: "upperValve", label: "Válvula superior aberta" },
        { key: "lowerValve", label: "Válvula inferior fechada" },
        { key: "tanks", label: "Tanques posicionados" },
        { key: "oil", label: "Óleo disponível" },
        { key: "emergency", label: "Emergência liberada" }
    ];
    return (_jsxs("div", { className: "preparation-layout", children: [_jsxs("section", { className: "config-panel", children: [_jsx("h2", { children: "Configura\u00E7\u00E3o r\u00E1pida" }), _jsxs("div", { className: "field-grid", children: [_jsx(Field, { label: "Quantidade de tanques", children: _jsx("div", { className: "tank-selector", children: [1, 2, 3].map((value) => (_jsx("button", { className: props.tankCount === value ? "active" : "", onClick: () => props.setTankCount(value), children: value }, value))) }) }), _jsx(Field, { label: "Receita", children: _jsxs("select", { value: props.recipe, onChange: (event) => props.setRecipe(event.target.value), children: [_jsx("option", { children: "Receita padr\u00E3o" }), _jsx("option", { children: "Tanque grande" }), _jsx("option", { children: "Tanque cr\u00EDtico" })] }) }), _jsx(Field, { label: "Operador", children: _jsxs("select", { value: props.operator, onChange: (event) => props.setOperator(event.target.value), children: [_jsx("option", { children: "Jo\u00E3o Martins" }), _jsx("option", { children: "Maria Souza" }), _jsx("option", { children: "Carlos Lima" }), _jsx("option", { children: "Admin TSEA" })] }) }), _jsx(Field, { label: "Turno", children: _jsxs("select", { value: props.shift, onChange: (event) => props.setShift(event.target.value), children: [_jsx("option", { children: "Manh\u00E3" }), _jsx("option", { children: "Tarde" }), _jsx("option", { children: "Noite" })] }) }), _jsx(Field, { label: "Mangueira", children: _jsxs("select", { value: props.hose, onChange: (event) => props.setHose(event.target.value), children: [_jsx("option", { children: "MG-01" }), _jsx("option", { children: "MG-02" }), _jsx("option", { children: "MG-03" })] }) })] }), _jsx(MiniTankLine, { tanks: props.tanks })] }), _jsxs("section", { className: "checklist-panel", children: [_jsx("h2", { children: "Checklist de libera\u00E7\u00E3o" }), _jsx("div", { className: "checklist", children: checklistItems.map((item) => (_jsxs("button", { className: props.checklist[item.key] ? "checked" : "", onClick: () => props.setChecklist({
                                ...props.checklist,
                                [item.key]: !props.checklist[item.key]
                            }), children: [_jsx(CheckCircle2, { size: 24 }), item.label] }, item.key))) }), _jsxs("button", { className: "start-cycle", disabled: !props.checklistReady, onClick: props.startCycle, children: [_jsx(Play, { size: 32 }), "Iniciar ciclo"] })] })] }));
}
function OperationScreen(props) {
    return (_jsxs("div", { className: "operation-layout", children: [_jsxs("section", { className: "cycle-header-card", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "CICLO EM ANDAMENTO" }), _jsx("h2", { children: "OP-IHM-0001" }), _jsx("p", { children: "Etapa atual: v\u00E1cuo inicial \u00B7 Tempo: 00:07:32" })] }), _jsx(StatusPill, { label: "Em opera\u00E7\u00E3o" })] }), _jsx("section", { className: `tanks-visual-grid count-${props.tanks.length}`, children: props.tanks.map((tank) => (_jsx(TankVisual, { tank: tank }, tank.code))) }), _jsxs("section", { className: "operation-bottom-grid", children: [_jsx(PumpPanel, { code: "B1", name: "Bomba prim\u00E1ria", running: props.b1Running, performance: "96%", onStart: () => props.setB1Running(true), onStop: () => props.setB1Running(false) }), _jsx(PumpPanel, { code: "B2", name: "Bomba Roots", running: props.b2Running, performance: "88%", onStart: () => props.setB2Running(true), onStop: () => props.setB2Running(false) }), _jsxs("section", { className: "steps-panel", children: [_jsx("h3", { children: "Etapas do ciclo" }), ["Preparação", "Vácuo inicial", "Vácuo profundo", "Enchimento de óleo", "Estabilização", "Finalização"].map((step, index) => (_jsxs("div", { className: `step-row ${index < 1 ? "done" : index === 1 ? "active" : ""}`, children: [_jsx("span", { children: index + 1 }), _jsx("strong", { children: step })] }, step)))] }), _jsxs("section", { className: "operator-actions", children: [_jsx("button", { onClick: () => props.setCycleStatus("Atenção"), children: "Pausar" }), _jsx("button", { onClick: () => props.setB2Running(true), children: "Avan\u00E7ar etapa" }), _jsx("button", { onClick: () => props.setScreen("registro"), children: "Finalizar" })] })] })] }));
}
function TankVisual({ tank }) {
    return (_jsxs("article", { className: `tank-visual ${statusClass(tank.status)}`, children: [_jsxs("div", { className: "tank-drawing", children: [_jsx("div", { className: "tank-liquid", style: { height: `${Math.min(68, tank.oil)}%` } }), _jsx("div", { className: "tank-pressure", style: { height: `${Math.min(80, tank.risk + 20)}%` } }), _jsx("span", { children: tank.code })] }), _jsxs("div", { className: "tank-readings", children: [_jsx(Reading, { label: "Press\u00E3o", value: `${tank.pressure.toFixed(1)} mbar` }), _jsx(Reading, { label: "Alvo", value: `${tank.target.toFixed(1)} mbar` }), _jsx(Reading, { label: "\u00D3leo", value: `${tank.oil.toFixed(0)} L` }), _jsx(Reading, { label: "Risco", value: `${tank.risk}%` }), _jsx(Reading, { label: "Status", value: tank.status })] })] }));
}
function Reading({ label, value }) {
    return (_jsxs("div", { children: [_jsx("span", { children: label }), _jsx("strong", { children: value })] }));
}
function MiniTankLine({ tanks }) {
    return (_jsx("div", { className: "mini-tank-line", children: tanks.map((tank) => (_jsx("div", { children: _jsx("span", { children: tank.code }) }, tank.code))) }));
}
function PumpPanel(props) {
    return (_jsxs("article", { className: "pump-panel", children: [_jsx("div", { className: "pump-visual", children: _jsx("span", { children: props.code }) }), _jsxs("div", { children: [_jsx("h3", { children: props.name }), _jsxs("p", { children: ["Estado: ", props.running ? "Ligada" : "Desligada"] }), _jsxs("p", { children: ["Desempenho: ", props.performance] }), _jsx("p", { children: "Conex\u00E3o: PLC simulado" })] }), _jsxs("div", { className: "pump-actions", children: [_jsx("button", { onClick: props.onStart, children: "Ligar" }), _jsx("button", { onClick: props.onStop, children: "Parar" })] })] }));
}
function AlarmsScreen(props) {
    const alarms = [
        {
            id: "ALM-001",
            title: props.emergency ? "Emergência geral acionada" : "Pressão acima do esperado",
            severity: props.emergency ? "Crítico" : "Atenção",
            time: "14:26",
            cause: props.emergency ? "Botão físico de emergência foi acionado." : "Possível perda na mangueira ou bomba abaixo do desempenho.",
            action: props.emergency ? "Verificar área, liberar emergência e reiniciar ciclo somente após inspeção." : "Verificar conexão e acompanhar curva de pressão."
        },
        {
            id: "ALM-002",
            title: "Atraso no óleo",
            severity: "Atenção",
            time: "14:31",
            cause: "Vazão abaixo da referência esperada.",
            action: "Verificar linha de óleo e volume estimado."
        }
    ];
    return (_jsxs("div", { className: "alarms-layout", children: [_jsx("section", { className: "alarm-list", children: alarms.map((alarm) => (_jsxs("article", { className: `alarm-card ${statusClass(alarm.severity)}`, children: [_jsxs("div", { children: [_jsxs("strong", { children: [alarm.id, " \u00B7 ", alarm.title] }), _jsxs("span", { children: [alarm.severity, " \u00B7 ", alarm.time] })] }), _jsx("p", { children: alarm.cause }), _jsxs("p", { children: [_jsx("b", { children: "A\u00E7\u00E3o sugerida:" }), " ", alarm.action] })] }, alarm.id))) }), _jsxs("section", { className: "alarm-actions", children: [_jsxs("button", { onClick: () => props.setAckAlarm(true), children: [_jsx(CheckCircle2, { size: 28 }), "Reconhecer alarme"] }), _jsxs("button", { onClick: () => props.setScreen("operacao"), children: [_jsx(Gauge, { size: 28 }), "Ver opera\u00E7\u00E3o"] }), _jsxs("button", { onClick: props.resetCycle, children: [_jsx(RotateCcw, { size: 28 }), "Resetar ciclo"] }), props.ackAlarm && _jsx("p", { className: "ack-message", children: "Alarme reconhecido pelo operador." })] })] }));
}
function RegisterScreen(props) {
    return (_jsxs("div", { className: "register-layout", children: [_jsxs("section", { className: "register-card", children: [_jsx("span", { className: "eyebrow", children: "RESUMO DO CICLO" }), _jsx("h2", { children: "OP-IHM-0001" }), _jsxs("div", { className: "summary-grid", children: [_jsx(InfoTile, { label: "Operador", value: props.operator, tone: "neutral" }), _jsx(InfoTile, { label: "Turno", value: props.shift, tone: "neutral" }), _jsx(InfoTile, { label: "Tanques", value: `${props.tankCount}`, tone: "neutral" }), _jsx(InfoTile, { label: "Mangueira", value: props.hose, tone: "neutral" }), _jsx(InfoTile, { label: "Receita", value: props.recipe, tone: "neutral" }), _jsx(InfoTile, { label: "Status final", value: props.cycleStatus, tone: statusClass(props.cycleStatus) })] })] }), _jsxs("section", { className: "register-actions", children: [_jsxs("button", { children: [_jsx(FileText, { size: 30 }), "Salvar registro"] }), _jsxs("button", { children: [_jsx(Wrench, { size: 30 }), "Enviar ao supervis\u00F3rio"] }), _jsxs("button", { onClick: props.resetCycle, children: [_jsx(RotateCcw, { size: 30 }), "Novo ciclo"] })] })] }));
}
function Field({ label, children }) {
    return (_jsxs("label", { className: "field", children: [_jsx("span", { children: label }), children] }));
}
createRoot(document.getElementById("root")).render(_jsx(App, {}));
