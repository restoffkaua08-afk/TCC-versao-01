import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Phase = 
  | "boot" 
  | "inicial" 
  | "preparar_receita" 
  | "preparar_dados" 
  | "checklist_pre" 
  | "revisao" 
  | "operacao" 
  | "finalizacao" 
  | "registros_dia";

type OperationTab = "reguladores" | "bombas" | "oleo" | "informacoes";
type Status = "PRONTO" | "EM CICLO" | "PAUSADO" | "FINALIZADO" | "BLOQUEADO";
type RecipeKey = "PAD-001" | "GRA-002" | "CRI-003";
type HoseKey = "MG-01" | "MG-02" | "MG-03";

type ChecklistPre = {
  mangueira: boolean;
  valvulaSuperior: boolean;
  valvulaInferior: boolean;
  tanquesPosicionados: boolean;
  oleoDisponivel: boolean;
  emergenciaLiberada: boolean;
  sensoresComunicando: boolean;
  intertravamentosLiberados: boolean;
};

type ChecklistPos = {
  tempoOk: boolean;
  semAnomalia: boolean;
  oleoRestanteVisivel: boolean;
  pressaoFinalOk: boolean;
  bombasDesligaram: boolean;
  linhaOleoFinalizada: boolean;
  operadorConfirmouFisico: boolean;
  observacao?: string;
};

type Recipe = {
  id: RecipeKey;
  title: string;
  tipoTanque: string;
  tempoEstimado: number;
  pressaoAlvo: number;
  b2StartSeg: number;
  oilStartSeg: number;
  estabilizacaoSeg: number;
  observacao: string;
};

type Hose = { id: HoseKey; descricao: string; perdaBase: number };
type Registro = { id: string; horario: string; status: string; qtdTanques: number; receita: string; mangueira: string };

const recipes: Recipe[] = [
  { id: "PAD-001", title: "Operacao Padrao", tipoTanque: "Comum", tempoEstimado: 205, pressaoAlvo: 8, b2StartSeg: 24, oilStartSeg: 90, estabilizacaoSeg: 165, observacao: "Ciclo padrao" },
  { id: "GRA-002", title: "Tanque Grande", tipoTanque: "Grande", tempoEstimado: 225, pressaoAlvo: 12, b2StartSeg: 32, oilStartSeg: 100, estabilizacaoSeg: 178, observacao: "Acompanhar rampa" },
  { id: "CRI-003", title: "Tanque Critico", tipoTanque: "Critico", tempoEstimado: 255, pressaoAlvo: 35, b2StartSeg: 45, oilStartSeg: 120, estabilizacaoSeg: 195, observacao: "Vacuo conservador" }
];

const hoses: Hose[] = [
  { id: "MG-01", descricao: "Curta (5m)", perdaBase: 0.7 },
  { id: "MG-02", descricao: "Media (8m)", perdaBase: 1.2 },
  { id: "MG-03", descricao: "Longa (12m)", perdaBase: 1.8 }
];

function fmt(v: number, u: string) { return `${v.toFixed(v>=100?1:2)} ${u}`; }
function timeFmt(s: number) { return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`; }
function now() { return new Date().toLocaleTimeString("pt-BR"); }

function App() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState<OperationTab>("reguladores");
  const [status, setStatus] = useState<Status>("PRONTO");
  const [elapsed, setElapsed] = useState(0);
  const [operationId, setOperationId] = useState("");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [recipeId, setRecipeId] = useState<RecipeKey>("PAD-001");
  const [qtdTanques, setQtdTanques] = useState(3);
  const [hoseId, setHoseId] = useState<HoseKey>("MG-02");
  const [oleoColocado, setOleoColocado] = useState(150);
  const [checklistPre, setChecklistPre] = useState<ChecklistPre>({
    mangueira: false, valvulaSuperior: false, valvulaInferior: false, tanquesPosicionados: false,
    oleoDisponivel: false, emergenciaLiberada: true, sensoresComunicando: false, intertravamentosLiberados: false
  });
  const [checklistPos, setChecklistPos] = useState<ChecklistPos>({
    tempoOk: false, semAnomalia: false, oleoRestanteVisivel: false, pressaoFinalOk: false,
    bombasDesligaram: false, linhaOleoFinalizada: false, operadorConfirmouFisico: false, observacao: ""
  });
  const [logs, setLogs] = useState<{time:string; msg:string}[]>([]);

  const recipe = recipes.find(r=>r.id===recipeId)!;
  const hose = hoses.find(h=>h.id===hoseId)!;

  useEffect(() => {
    if (phase==="boot") setTimeout(()=>setPhase("inicial"), 2000);
  }, [phase]);

  useEffect(() => {
    if (phase!=="operacao" || status!=="EM CICLO") return;
    const iv = setInterval(() => {
      setElapsed(prev => {
        if (prev >= recipe.tempoEstimado) {
          setStatus("FINALIZADO");
          addLog("Ciclo finalizado");
          return prev;
        }
        return prev+1;
      });
    }, 1000);
    return ()=>clearInterval(iv);
  }, [phase, status, recipe.tempoEstimado]);

  const addLog = (msg:string) => setLogs(prev => [{time:now(), msg}, ...prev].slice(0,40));

  const reiniciar = () => {
    setPhase("boot");
    setDrawerOpen(false);
    setStatus("PRONTO");
    setElapsed(0);
    setOperationId("");
    setLogs([]);
    setChecklistPre({
      mangueira: false, valvulaSuperior: false, valvulaInferior: false, tanquesPosicionados: false,
      oleoDisponivel: false, emergenciaLiberada: true, sensoresComunicando: false, intertravamentosLiberados: false
    });
    setChecklistPos({
      tempoOk: false, semAnomalia: false, oleoRestanteVisivel: false, pressaoFinalOk: false,
      bombasDesligaram: false, linhaOleoFinalizada: false, operadorConfirmouFisico: false, observacao: ""
    });
    setTimeout(()=>setPhase("inicial"), 800);
  };

  const registrar = (statusFinal:string) => {
    setRegistros(prev => [{
      id: operationId, horario: new Date().toLocaleString(), status: statusFinal,
      qtdTanques, receita: recipe.title, mangueira: hose.descricao
    }, ...prev].slice(0,50));
  };

  const etapa = () => {
    if (status!=="EM CICLO") return "Preparo";
    if (elapsed < recipe.b2StartSeg) return "VACUO INICIAL";
    if (elapsed < recipe.oilStartSeg) return "VACUO PROFUNDO";
    if (elapsed < recipe.estabilizacaoSeg) return "INJECAO DE OLEO";
    if (elapsed < recipe.tempoEstimado) return "ESTABILIZACAO";
    return "FINALIZACAO";
  };

  const b2Ligada = status==="EM CICLO" && elapsed >= recipe.b2StartSeg;
  const oilLigada = status==="EM CICLO" && elapsed >= recipe.oilStartSeg;
  const pressaoMaquina = status==="EM CICLO" ? Math.max(recipe.pressaoAlvo, 1013 * Math.exp(-elapsed/4.8)) : 1013;
  const pressaoMedia = pressaoMaquina + hose.perdaBase;
  const tanques = Array.from({length: qtdTanques}).map((_,i)=>({
    id:`T${i+1}`, pressao: pressaoMedia + i*0.5, perda: hose.perdaBase + i*0.2, oleo: oilLigada ? (elapsed-recipe.oilStartSeg)/2 : 0
  }));
  const oilInjetado = Math.min(oleoColocado, oilLigada ? (elapsed-recipe.oilStartSeg)*0.8 : 0);
  const oilRestante = Math.max(0, oleoColocado - oilInjetado);
  const allCheckedPre = Object.values(checklistPre).every(v=>v===true);
  const allCheckedPos = Object.entries(checklistPos).filter(([k])=>k!=="observacao").every(([,v])=>v===true);

  const menu = () => (
    <div className={`drawer ${drawerOpen?"open":""}`}>
      <div><button onClick={()=>setDrawerOpen(false)}>✕</button></div>
      <button disabled={phase!=="operacao" || status!=="FINALIZADO"} onClick={()=>setPhase("finalizacao")}>FINALIZAR OPERACAO</button>
      <button>ALARMES (sim)</button>
      <button disabled={phase==="operacao" && status!=="FINALIZADO"} onClick={reiniciar}>INICIO</button>
    </div>
  );

  if (phase==="boot") return <div className="boot"><div className="boot-title">TSEA</div><div className="boot-sub">V-TWIN</div></div>;
  if (phase==="inicial") return (
    <div className="inicial">
      <div className="buttons">
        <button className="big-btn" onClick={()=>setPhase("preparar_receita")}>PREPARAR OPERACAO</button>
        <button className="big-btn" onClick={()=>setPhase("registros_dia")}>REGISTROS DO DIA</button>
      </div>
      {menu()}
    </div>
  );
  if (phase==="registros_dia") return (
    <div className="registros-dia">
      <button onClick={()=>setPhase("inicial")}>← VOLTAR</button>
      <h2>REGISTROS DO DIA</h2>
      <ul>{registros.map(r=><li key={r.id}>{r.horario} | {r.status} | {r.qtdTanques} tanque(s)</li>)}</ul>
      {menu()}
    </div>
  );
  if (phase==="preparar_receita") return (
    <div className="preparo">
      <h2>ESCOLHA A RECEITA</h2>
      <div className="recipes">
        {recipes.map(r=>(<div key={r.id} className={`recipe-card ${recipeId===r.id?"selected":""}`} onClick={()=>setRecipeId(r.id)}>
          <div className="recipe-title">{r.title}</div>
          <div>Tanque: {r.tipoTanque}</div>
          <div>Tempo: {r.tempoEstimado}s</div>
          <div>Pressao alvo: {r.pressaoAlvo} mbar</div>
          <div className="recipe-note">{r.observacao}</div>
        </div>))}
      </div>
      <button className="next-btn" onClick={()=>setPhase("preparar_dados")}>CONTINUAR</button>
      {menu()}
    </div>
  );
  if (phase==="preparar_dados") return (
    <div className="preparo">
      <h2>DADOS DA OPERACAO</h2>
      <div className="field"><label>Quantidade de tanques</label><input type="number" min={1} max={3} value={qtdTanques} onChange={e=>setQtdTanques(Number(e.target.value))}/></div>
      <div className="field"><label>Mangueira</label><select value={hoseId} onChange={e=>setHoseId(e.target.value as HoseKey)}>{hoses.map(h=><option key={h.id} value={h.id}>{h.descricao}</option>)}</select></div>
      <div className="field"><label>Oleo no reservatorio (L)</label><input type="number" value={oleoColocado} onChange={e=>setOleoColocado(Number(e.target.value))}/></div>
      <button className="next-btn" onClick={()=>setPhase("checklist_pre")}>CONTINUAR</button>
      {menu()}
    </div>
  );
  if (phase==="checklist_pre") return (
    <div className="preparo">
      <h2>CHECKLIST PRE-OPERACIONAL</h2>
      <div className="checklist">
        {Object.entries(checklistPre).map(([k,v])=><label key={k}><input type="checkbox" checked={v} onChange={e=>setChecklistPre(prev=>({...prev,[k]:e.target.checked}))}/> {k.toUpperCase()}</label>)}
      </div>
      <button className="next-btn" disabled={!allCheckedPre} onClick={()=>setPhase("revisao")}>CONTINUAR</button>
      {menu()}
    </div>
  );
  if (phase==="revisao") return (
    <div className="preparo">
      <h2>REVISAO FINAL</h2>
      <div className="resumo">
        <p>Receita: {recipe.title}</p><p>Tanques: {qtdTanques}</p><p>Mangueira: {hose.descricao}</p><p>Oleo: {oleoColocado} L</p>
      </div>
      <button className="cancel-btn" onClick={()=>setPhase("inicial")}>CANCELAR</button>
      <button className="start-btn" onClick={()=>{setOperationId(`OP-${Date.now()}`); setStatus("EM CICLO"); setElapsed(0); setLogs([]); setPhase("operacao");}}>INICIAR</button>
      {menu()}
    </div>
  );
  if (phase==="operacao") return (
    <div className="operacao">
      <div className="topbar"><button className="menu-btn" onClick={()=>setDrawerOpen(true)}>☰</button><div>{status}</div><div>{timeFmt(elapsed)} / {timeFmt(recipe.tempoEstimado)}</div></div>
      <div className="content-area">
        {tab==="reguladores" && <div className="tanks-grid">{tanques.map(t=><div key={t.id} className="tank-card"><div>{t.id}</div><div>{fmt(t.pressao,"mbar")}</div><div>Perda: {fmt(t.perda,"mbar")}</div><div>Oleo: {fmt(t.oleo,"L")}</div><div className="ok">OK</div></div>)}</div>}
        {tab==="bombas" && <div className="bombas-grid"><div>B1 PRIMARIA: {status==="EM CICLO"?"LIGADA":"DESLIGADA"}</div><div>B2 ROOTS: {b2Ligada?"LIGADA":"AGUARDANDO"}</div><div>PRESSAO MAQUINA: {fmt(pressaoMaquina,"mbar")}</div><div>PRESSAO MEDIA: {fmt(pressaoMedia,"mbar")}</div><div>SENSOR: COMUNICANDO</div><div>VACUO: ATIVO</div></div>}
        {tab==="oleo" && <div className="oleo-grid"><div>RESERVATORIO: {oleoColocado} L</div><div>SAINDO: {fmt(oilInjetado,"L")}</div><div>RESTANTE: {fmt(oilRestante,"L")}</div><div>VAZAO: {oilLigada?"NORMAL":"AGUARDANDO"}</div><div>TEMP: 60°C</div><div>LINHA: CONECTADA</div><div>OLEO POR TANQUE:</div>{tanques.map(t=><div key={t.id}>{t.id}: {fmt(t.oleo,"L")}</div>)}</div>}
        {tab==="informacoes" && <div className="info-grid"><div className="etapas">{["Preparo","VACUO INICIAL","VACUO PROFUNDO","INJECAO DE OLEO","ESTABILIZACAO","FINALIZACAO"].map(e=><div key={e} className={etapa()===e?"active":(elapsed>recipe.b2StartSeg&&e==="VACUO INICIAL"?"done":(elapsed>recipe.oilStartSeg&&e==="VACUO PROFUNDO"?"done":(elapsed>recipe.estabilizacaoSeg&&e==="INJECAO DE OLEO"?"done":(elapsed>=recipe.tempoEstimado&&e==="ESTABILIZACAO"?"done":""))))}>{e}</div>)}</div><div><p>ID: {operationId}</p><p>Receita: {recipe.title}</p><p>Operador: OPERADOR 01</p><p>Tanques: {qtdTanques}</p><p>Mangueira: {hose.descricao}</p><p>Tempo: {timeFmt(elapsed)}</p></div><div className="logs">{logs.slice(0,8).map(l=><div key={l.time}>[{l.time}] {l.msg}</div>)}</div></div>}
      </div>
      <div className="bottom-tabs">
        {(["reguladores","bombas","oleo","informacoes"] as const).map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t.toUpperCase()}</button>)}
      </div>
      {menu()}
    </div>
  );
  if (phase==="finalizacao") return (
    <div className="finalizacao">
      <h2>CHECKLIST FINAL</h2>
      <div className="resumo"><p>ID: {operationId}</p><p>Receita: {recipe.title}</p><p>Tanques: {qtdTanques}</p><p>Mangueira: {hose.descricao}</p><p>Tempo: {timeFmt(elapsed)}</p><p>Pressao final: ~{fmt(pressaoMedia,"mbar")}</p><p>Oleo colocado: {oleoColocado} L</p><p>Oleo injetado: ~{Math.min(oleoColocado,qtdTanques*50)} L</p></div>
      <div className="checklist">
        {Object.entries(checklistPos).map(([k,v])=>k!=="observacao"&&<label key={k}><input type="checkbox" checked={v as boolean} onChange={e=>setChecklistPos(prev=>({...prev,[k]:e.target.checked}))}/> {k.toUpperCase()}</label>)}
        <label>Observacao:</label><textarea value={checklistPos.observacao} onChange={e=>setChecklistPos(prev=>({...prev,observacao:e.target.value}))}/>
      </div>
      <button disabled={!allCheckedPos} onClick={()=>{registrar("CONCLUIDO"); reiniciar();}}>FINALIZAR</button>
      {menu()}
    </div>
  );
  return null;
}
createRoot(document.getElementById("root")!).render(<App />);