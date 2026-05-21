import { Field, fmt, Section, Table } from "../components/ui";

type ParamTab = "tanks" | "hoses" | "recipes" | "formulas" | "operators";

type ParametersPageProps = {
  allHoses: any[];
  allRecipes: any[];
  allTanks: any[];
  form: any;
  localFormulas: any[];
  localOperators: any[];
  paramTab: ParamTab;
  saveParam: () => void;
  setForm: (form: any) => void;
  setParamTab: (tab: ParamTab) => void;
};

export function ParametersPage({
  allHoses,
  allRecipes,
  allTanks,
  form,
  localFormulas,
  localOperators,
  paramTab,
  saveParam,
  setForm,
  setParamTab,
}: ParametersPageProps) {
  return (
    <div className="screen">
      <Section title="Cadastros técnicos" subtitle="Tanques, mangueiras de vácuo, receitas, fórmulas e responsáveis operacionais.">
        <div className="subtabs">
          <button className={paramTab === "tanks" ? "" : "secondary"} onClick={() => { setParamTab("tanks"); setForm({}); }}>Tanques</button>
          <button className={paramTab === "hoses" ? "" : "secondary"} onClick={() => { setParamTab("hoses"); setForm({}); }}>Mangueiras</button>
          <button className={paramTab === "recipes" ? "" : "secondary"} onClick={() => { setParamTab("recipes"); setForm({}); }}>Receitas</button>
          <button className={paramTab === "formulas" ? "" : "secondary"} onClick={() => { setParamTab("formulas"); setForm({}); }}>Fórmulas</button>
          <button className={paramTab === "operators" ? "" : "secondary"} onClick={() => { setParamTab("operators"); setForm({}); }}>Operadores</button>
        </div>

        <div className="formGrid">
          {paramTab === "tanks" && (
            <>
              <Field label="Código"><input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
              <Field label="Tipo"><input value={form.type || ""} onChange={(e) => setForm({ ...form, type: e.target.value })} /></Field>
              <Field label="Volume (L)"><input type="number" value={form.volume_liters || ""} onChange={(e) => setForm({ ...form, volume_liters: e.target.value })} /></Field>
              <Field label="Limite estrutural (mbar)"><input type="number" value={form.structural_limit_mbar || ""} onChange={(e) => setForm({ ...form, structural_limit_mbar: e.target.value })} /></Field>
            </>
          )}

          {paramTab === "hoses" && (
            <>
              <Field label="Código"><input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
              <Field label="Comprimento (m)"><input type="number" value={form.length_m || ""} onChange={(e) => setForm({ ...form, length_m: e.target.value })} /></Field>
              <Field label="Diâmetro (pol)"><input type="number" value={form.diameter_in || ""} onChange={(e) => setForm({ ...form, diameter_in: e.target.value })} /></Field>
              <Field label="Fator de perda (multiplicador)"><input type="number" value={form.loss_factor || ""} onChange={(e) => setForm({ ...form, loss_factor: e.target.value })} /></Field>
            </>
          )}

          {paramTab === "recipes" && (
            <>
              <Field label="Nome da receita"><input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Tipo de tanque"><input value={form.tank_type || ""} onChange={(e) => setForm({ ...form, tank_type: e.target.value })} /></Field>
              <Field label="Pressão final (mbar)"><input type="number" value={form.target_pressure_mbar || ""} onChange={(e) => setForm({ ...form, target_pressure_mbar: e.target.value })} /></Field>
              <Field label="Acionamento da bomba secundária"><input type="number" value={form.roots_start_pressure_mbar || ""} onChange={(e) => setForm({ ...form, roots_start_pressure_mbar: e.target.value })} /></Field>
              <Field label="Tempo máximo (s)"><input type="number" value={form.max_cycle_seconds || ""} onChange={(e) => setForm({ ...form, max_cycle_seconds: e.target.value })} /></Field>
              <Field label="Vazão mínima de óleo"><input type="number" value={form.min_oil_flow_l_min || ""} onChange={(e) => setForm({ ...form, min_oil_flow_l_min: e.target.value })} /></Field>
            </>
          )}

          {paramTab === "formulas" && (
            <>
              <Field label="Nome"><input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Variável"><input value={form.variable || ""} onChange={(e) => setForm({ ...form, variable: e.target.value })} /></Field>
              <Field label="Expressão"><input value={form.expression || ""} onChange={(e) => setForm({ ...form, expression: e.target.value })} /></Field>
              <Field label="Descrição"><input value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            </>
          )}

          {paramTab === "operators" && (
            <>
              <Field label="Nome"><input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Registro"><input value={form.registration || ""} onChange={(e) => setForm({ ...form, registration: e.target.value })} /></Field>
              <Field label="Função"><input value={form.role || ""} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
              <Field label="Estado"><input value={form.status || ""} onChange={(e) => setForm({ ...form, status: e.target.value })} /></Field>
            </>
          )}
        </div>

        <div className="commandBar">
          <button onClick={saveParam}>Cadastrar</button>
        </div>
      </Section>

      {paramTab === "tanks" && (
        <Section title="Tanques cadastrados">
          <Table columns={["Código", "Tipo", "Volume", "Limite", "Estado"]} rows={allTanks.map((tank: any) => [<b>{tank.code}</b>, tank.type || "--", fmt(tank.volume_liters, "L"), fmt(tank.structural_limit_mbar, "mbar"), tank.status || "--"])} />
        </Section>
      )}

      {paramTab === "hoses" && (
        <Section title="Mangueiras cadastradas">
          <Table columns={["Código", "Comprimento (m)", "Diâmetro (mm)", "Fator", "Estado"]} rows={allHoses.map((hose: any) => [<b>{hose.code}</b>, fmt(hose.length_m, "m"), fmt(hose.diameter_in, "pol"), fmt(hose.loss_factor), hose.status || "--"])} />
        </Section>
      )}

      {paramTab === "recipes" && (
        <Section title="Receitas cadastradas">
          <Table columns={["Nome", "Tanque", "Pressão", "bomba secundária", "Tempo", "Óleo"]} rows={allRecipes.map((recipe: any) => [<b>{recipe.name}</b>, recipe.tank_type || "--", fmt(recipe.target_pressure_mbar, "mbar"), fmt(recipe.roots_start_pressure_mbar, "mbar"), fmt(recipe.max_cycle_seconds, "s"), fmt(recipe.min_oil_flow_l_min, "L/min")])} />
        </Section>
      )}

      {paramTab === "formulas" && (
        <Section title="Fórmulas cadastradas">
          <Table columns={["Nome", "Variável", "Expressão", "Descrição"]} rows={localFormulas.map((f: any) => [<b>{f.name}</b>, f.variable, f.expression, f.description])} />
        </Section>
      )}

      {paramTab === "operators" && (
        <Section title="Operadores cadastrados">
          <Table columns={["Nome", "Registro", "Função", "Estado"]} rows={localOperators.map((op: any) => [<b>{op.name}</b>, op.registration, op.role, op.status])} />
        </Section>
      )}
    </div>
  );
}
