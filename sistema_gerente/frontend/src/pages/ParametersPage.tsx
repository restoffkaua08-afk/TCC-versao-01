
import { useEffect, useMemo, useState } from "react";
import { Field, fmt, Section, Table } from "../components/ui";

// TSEA_PARAMETERS_MAINTENANCE
// Esta tela cadastra somente dados reais da demonstração.
// Limites de segurança ficam no backend em app/real_bridge.py.
const API = "http://127.0.0.1:8020/api";

type LocalTab = "recipes" | "tanks" | "hoses" | "formulas";

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(API + path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

function numberOrUndefined(value: unknown) {
  if (value === "" || value === undefined || value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asPayload(form: any) {
  return Object.fromEntries(
    Object.entries(form).filter(([, value]) => value !== "" && value !== undefined && value !== null)
  );
}

function calcHoseVolume(lengthM: unknown, diameterMm: unknown) {
  const length = numberValue(lengthM);
  const diameter = numberValue(diameterMm) / 1000;

  if (!length || !diameter) return 0;

  return Math.PI * ((diameter ** 2) / 4) * length * 1000;
}

export function ParametersPage(_: any) {
  const [tab, setTab] = useState<LocalTab>("recipes");
  const [form, setForm] = useState<any>({});
  const [parameters, setParameters] = useState<any>({ recipes: [], tanks: [], hoses: [], limits: {}, formulas: {} });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const limits = parameters?.limits || {};
  const hoseVolume = useMemo(() => calcHoseVolume(form.length_m, form.internal_diameter_mm), [form.length_m, form.internal_diameter_mm]);

  async function load() {
    try {
      const data = await request("/real/parameters");
      setParameters(data || { recipes: [], tanks: [], hoses: [], limits: {}, formulas: {} });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 2000);

    return () => window.clearInterval(timer);
  }, []);

  async function save() {
    setLoading(true);
    setMessage("");

    try {
      if (tab === "recipes") {
        await request("/real/recipes", {
          method: "POST",
          body: JSON.stringify(asPayload({
            id: form.id || form.name,
            title: form.title || form.name,
            name: form.name || form.title,
            tank_type: form.tank_type,
            estimated_seconds: numberOrUndefined(form.estimated_seconds || form.max_cycle_seconds),
            max_cycle_seconds: numberOrUndefined(form.estimated_seconds || form.max_cycle_seconds),
            target_pressure_mbar: numberOrUndefined(form.target_pressure_mbar),
            roots_start_pressure_mbar: numberOrUndefined(form.roots_start_pressure_mbar),
            b2_start_seconds: numberOrUndefined(form.b2_start_seconds),
            oil_start_seconds: numberOrUndefined(form.oil_start_seconds),
            stabilization_seconds: numberOrUndefined(form.stabilization_seconds),
            oil_per_tank_l: numberOrUndefined(form.oil_per_tank_l),
            note: form.note,
          })),
        });
      }

      if (tab === "tanks") {
        await request("/real/tanks", {
          method: "POST",
          body: JSON.stringify(asPayload({
            id: form.code,
            code: form.code,
            name: form.name,
            type: form.type,
            volume_liters: numberOrUndefined(form.volume_liters),
            diameter_mm: numberOrUndefined(form.diameter_mm),
            height_mm: numberOrUndefined(form.height_mm),
            wall_thickness_mm: numberOrUndefined(form.wall_thickness_mm),
            structural_limit_mbar: numberOrUndefined(form.structural_limit_mbar),
            note: form.note,
          })),
        });
      }

      if (tab === "hoses") {
        await request("/real/hoses", {
          method: "POST",
          body: JSON.stringify(asPayload({
            id: form.code,
            code: form.code,
            label: form.label,
            length_m: numberOrUndefined(form.length_m),
            internal_diameter_mm: numberOrUndefined(form.internal_diameter_mm),
            calibrated_loss_mbar: numberOrUndefined(form.calibrated_loss_mbar),
            note: form.note,
          })),
        });
      }

      setForm({});
      setMessage("Salvo com sucesso.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function remove(type: "recipes" | "tanks" | "hoses", id: string) {
    if (!confirm("Excluir este cadastro?")) return;

    setLoading(true);
    setMessage("");

    try {
      await request("/real/" + type + "/" + encodeURIComponent(id), { method: "DELETE" });
      setMessage("Cadastro excluído.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function clearAll() {
    if (!confirm("Limpar receitas, tanques, mangueiras, históricos, logs e registros?")) return;
    if (!confirm("Confirmar limpeza total da demonstração?")) return;

    setLoading(true);
    setMessage("");

    try {
      await request("/real/admin/clear-data", { method: "POST", body: "{}" });
      localStorage.clear();
      setForm({});
      setParameters({ recipes: [], tanks: [], hoses: [], limits: limits || {}, formulas: {} });
      setMessage("Base limpa. Cadastre tudo do zero.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen realParamsScreen">
      <Section
        title="Parâmetros reais do protótipo físico"
        subtitle="Cadastre apenas dados reais. Os limites são fixos no código e o Gateway bloqueia valores fora da faixa."
        action={<button className="danger" onClick={clearAll} disabled={loading}>Limpar tudo</button>}
      >
        <div className="subtabs">
          <button className={tab === "recipes" ? "" : "secondary"} onClick={() => { setTab("recipes"); setForm({}); }}>Receitas</button>
          <button className={tab === "tanks" ? "" : "secondary"} onClick={() => { setTab("tanks"); setForm({}); }}>Tanques</button>
          <button className={tab === "hoses" ? "" : "secondary"} onClick={() => { setTab("hoses"); setForm({}); }}>Mangueiras</button>
          <button className={tab === "formulas" ? "" : "secondary"} onClick={() => { setTab("formulas"); setForm({}); }}>Fórmulas</button>
        </div>

        {message && <div className="paramMessage">{message}</div>}

        {tab === "recipes" && (
          <div className="formGrid">
            <Field label="ID da receita"><input value={form.id || ""} onChange={(e) => setForm({ ...form, id: e.target.value })} /></Field>
            <Field label="Nome"><input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Tipo de tanque"><input value={form.tank_type || ""} onChange={(e) => setForm({ ...form, tank_type: e.target.value })} /></Field>
            <Field label="Tempo total (s)"><input type="number" min={limits.cycle_min_seconds || 30} max={limits.cycle_max_seconds || 3600} value={form.estimated_seconds || ""} onChange={(e) => setForm({ ...form, estimated_seconds: e.target.value })} /></Field>
            <Field label="Pressão alvo (mbar)"><input type="number" min={limits.pressure_min_mbar || 0.01} max={limits.pressure_max_mbar || 1013} value={form.target_pressure_mbar || ""} onChange={(e) => setForm({ ...form, target_pressure_mbar: e.target.value })} /></Field>
            <Field label="Pressão para liberar B2 (mbar)"><input type="number" min={limits.pressure_min_mbar || 0.01} max={limits.pressure_max_mbar || 1013} value={form.roots_start_pressure_mbar || ""} onChange={(e) => setForm({ ...form, roots_start_pressure_mbar: e.target.value })} /></Field>
            <Field label="Início B2 (s)"><input type="number" min={0} max={form.estimated_seconds || limits.cycle_max_seconds || 3600} value={form.b2_start_seconds || ""} onChange={(e) => setForm({ ...form, b2_start_seconds: e.target.value })} /></Field>
            <Field label="Início óleo (s)"><input type="number" min={0} max={form.estimated_seconds || limits.cycle_max_seconds || 3600} value={form.oil_start_seconds || ""} onChange={(e) => setForm({ ...form, oil_start_seconds: e.target.value })} /></Field>
            <Field label="Estabilização (s)"><input type="number" min={0} max={form.estimated_seconds || limits.cycle_max_seconds || 3600} value={form.stabilization_seconds || ""} onChange={(e) => setForm({ ...form, stabilization_seconds: e.target.value })} /></Field>
            <Field label="Óleo por tanque (L)"><input type="number" min={limits.oil_min_l || 0} max={limits.oil_max_l || 300} value={form.oil_per_tank_l || ""} onChange={(e) => setForm({ ...form, oil_per_tank_l: e.target.value })} /></Field>
          </div>
        )}

        {tab === "tanks" && (
          <div className="formGrid">
            <Field label="Código"><input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="Nome"><input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Tipo"><input value={form.type || ""} onChange={(e) => setForm({ ...form, type: e.target.value })} /></Field>
            <Field label="Volume real (L)"><input type="number" min={limits.tank_volume_min_l || 0.1} max={limits.tank_volume_max_l || 5000} value={form.volume_liters || ""} onChange={(e) => setForm({ ...form, volume_liters: e.target.value })} /></Field>
            <Field label="Diâmetro externo (mm)"><input type="number" min={limits.tank_diameter_min_mm || 50} max={limits.tank_diameter_max_mm || 3000} value={form.diameter_mm || ""} onChange={(e) => setForm({ ...form, diameter_mm: e.target.value })} /></Field>
            <Field label="Altura (mm)"><input type="number" min={limits.tank_height_min_mm || 50} max={limits.tank_height_max_mm || 6000} value={form.height_mm || ""} onChange={(e) => setForm({ ...form, height_mm: e.target.value })} /></Field>
            <Field label="Espessura da chapa (mm)"><input type="number" min={limits.wall_thickness_min_mm || 0.5} max={limits.wall_thickness_max_mm || 50} value={form.wall_thickness_mm || ""} onChange={(e) => setForm({ ...form, wall_thickness_mm: e.target.value })} /></Field>
            <Field label="Limite estrutural (mbar)"><input type="number" min={limits.pressure_min_mbar || 0.01} max={limits.pressure_max_mbar || 1013} value={form.structural_limit_mbar || ""} onChange={(e) => setForm({ ...form, structural_limit_mbar: e.target.value })} /></Field>
          </div>
        )}

        {tab === "hoses" && (
          <div className="formGrid">
            <Field label="Código"><input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="Descrição"><input value={form.label || ""} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field>
            <Field label="Comprimento real (m)"><input type="number" min={limits.hose_length_min_m || 0.1} max={limits.hose_length_max_m || 30} value={form.length_m || ""} onChange={(e) => setForm({ ...form, length_m: e.target.value })} /></Field>
            <Field label="Diâmetro interno real (mm)"><input type="number" min={limits.hose_diameter_min_mm || 2} max={limits.hose_diameter_max_mm || 80} value={form.internal_diameter_mm || ""} onChange={(e) => setForm({ ...form, internal_diameter_mm: e.target.value })} /></Field>
            <Field label="Perda calibrada inicial (mbar)"><input type="number" min={limits.calibrated_loss_min_mbar || 0} max={limits.calibrated_loss_max_mbar || 200} value={form.calibrated_loss_mbar || ""} onChange={(e) => setForm({ ...form, calibrated_loss_mbar: e.target.value })} /></Field>
            <div className="calcBox">
              <span>Volume interno calculado</span>
              <b>{fmt(hoseVolume, "L")}</b>
              <small>V = π × (D² / 4) × L</small>
            </div>
          </div>
        )}

        {tab === "formulas" && (
          <div className="formulaPanel">
            <article><b>Volume interno da mangueira</b><code>V = π × (D² / 4) × L</code><span>D em metros, L em metros, resultado em m³ convertido para litros.</span></article>
            <article><b>Pressão estimada no tanque</b><code>P_tanque = P_sensor + ΔP_linha</code><span>O sensor manda pressão real da bomba/máquina. A perda da linha vem da calibração por ensaio.</span></article>
            <article><b>Velocidade efetiva de bombeamento</b><code>1 / Sefetivo = 1 / Sbomba + 1 / Cmangueira</code><span>Será usada quando houver desempenho real da bomba e dados de condutância.</span></article>
          </div>
        )}

        {tab !== "formulas" && (
          <div className="commandBar">
            <button onClick={save} disabled={loading}>{loading ? "Salvando..." : "Salvar cadastro real"}</button>
          </div>
        )}
      </Section>

      {tab === "recipes" && (
        <Section title="Receitas cadastradas">
          <Table
            columns={["Receita", "Tanque", "Pressão alvo", "Liberação B2", "Tempo", "Óleo/tanque", "Ações"]}
            rows={(parameters.recipes || []).map((recipe: any) => [
              <b>{recipe.title || recipe.name || recipe.id}</b>,
              recipe.tank_type || "--",
              fmt(recipe.target_pressure_mbar, "mbar"),
              fmt(recipe.roots_start_pressure_mbar, "mbar"),
              fmt(recipe.estimated_seconds || recipe.max_cycle_seconds, "s"),
              fmt(recipe.oil_per_tank_l, "L"),
              <button className="danger small" onClick={() => remove("recipes", recipe.id)}>Excluir</button>
            ])}
          />
        </Section>
      )}

      {tab === "tanks" && (
        <Section title="Tanques/reguladores cadastrados">
          <Table
            columns={["Código", "Tipo", "Volume", "Diâmetro", "Altura", "Chapa", "Limite", "Ações"]}
            rows={(parameters.tanks || []).map((tank: any) => [
              <b>{tank.code}</b>,
              tank.type || "--",
              fmt(tank.volume_liters, "L"),
              fmt(tank.diameter_mm, "mm"),
              fmt(tank.height_mm, "mm"),
              fmt(tank.wall_thickness_mm, "mm"),
              fmt(tank.structural_limit_mbar, "mbar"),
              <button className="danger small" onClick={() => remove("tanks", tank.id || tank.code)}>Excluir</button>
            ])}
          />
        </Section>
      )}

      {tab === "hoses" && (
        <Section title="Mangueiras cadastradas">
          <Table
            columns={["Código", "Descrição", "Comprimento", "Diâmetro interno", "Volume interno", "Perda calibrada", "Ações"]}
            rows={(parameters.hoses || []).map((hose: any) => [
              <b>{hose.code}</b>,
              hose.label || hose.descricao || "--",
              fmt(hose.length_m, "m"),
              fmt(hose.internal_diameter_mm, "mm"),
              fmt(hose.internal_volume_l, "L"),
              fmt(hose.calibrated_loss_mbar, "mbar"),
              <button className="danger small" onClick={() => remove("hoses", hose.id || hose.code)}>Excluir</button>
            ])}
          />
        </Section>
      )}
    </div>
  );
}
