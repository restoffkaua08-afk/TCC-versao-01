import type { ComponentType } from "react";
import { Badge, Field, fmt, Section, TankCard } from "../components/ui";

type OperationPageProps = {
  ComponentHealthPanel: ComponentType<any>;
  allHoses: any[];
  allRecipes: any[];
  allTanks: any[];
  control: (action: "start" | "pause" | "stop" | "reset" | "emergency") => void;
  operationConfig: any;
  setOp: (key: string, value: any) => void;
  setOperationConfig: (updater: any) => void;
  state: any;
  tanksState: any[];
};

export function OperationPage({
  ComponentHealthPanel,
  allHoses,
  allRecipes,
  allTanks,
  control,
  operationConfig,
  setOp,
  setOperationConfig,
  state,
  tanksState,
}: OperationPageProps) {
  return (
    <div className="screen">
      <Section title="Configuração da operação" subtitle="Parâmetros do ciclo antes da execução." action={<Badge value={state?.cycle?.status || "stopped"} />}>
        <div className="formGrid">
          <Field label="Responsável operacional">
            <input value={operationConfig.operator} onChange={(e) => setOp("operator", e.target.value)} />
          </Field>

          <Field label="Tanque de processo">
            <select value={operationConfig.tank_id} onChange={(e) => setOp("tank_id", e.target.value)}>
              {allTanks.map((tank: any) => (
                <option key={tank.id || tank.code} value={tank.id || tank.code}>{tank.code || tank.name} · {tank.type || "tipo"}</option>
              ))}
            </select>
          </Field>

          <Field label="Mangueira de vácuo / mangueira">
            <select value={operationConfig.hose_id} onChange={(e) => setOp("hose_id", e.target.value)}>
              {allHoses.map((hose: any) => (
                <option key={hose.id || hose.code} value={hose.id || hose.code}>{hose.code} · {fmt(hose.length_m, "m")} · fator {fmt(hose.loss_factor)}</option>
              ))}
            </select>
          </Field>

          <Field label="Receita operacional">
            <select
              value={operationConfig.recipe_id}
              onChange={(e) => {
                const value = e.target.value;
                const recipe = allRecipes.find((r: any) => String(r.id) === String(value));
                setOperationConfig((current: any) => ({
                  ...current,
                  recipe_id: value,
                  target_pressure_mbar: recipe?.target_pressure_mbar ?? current.target_pressure_mbar,
                  roots_start_pressure_mbar: recipe?.roots_start_pressure_mbar ?? current.roots_start_pressure_mbar,
                  max_cycle_seconds: recipe?.max_cycle_seconds ?? current.max_cycle_seconds,
                  oil_flow_l_min: recipe?.min_oil_flow_l_min ?? current.oil_flow_l_min,
                  tank_type: recipe?.tank_type ?? current.tank_type,
                }));
              }}
            >
              {allRecipes.map((recipe: any) => (
                <option key={recipe.id || recipe.name} value={recipe.id || recipe.name}>{recipe.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Tipo de tanque">
            <select value={operationConfig.tank_type} onChange={(e) => setOp("tank_type", e.target.value)}>
              <option value="medio">Médio</option>
              <option value="grande">Grande</option>
              <option value="extra_grande">Extra grande</option>
            </select>
          </Field>

          <Field label="Pressão final (mbar) do processo">
            <input type="number" value={operationConfig.target_pressure_mbar} onChange={(e) => setOp("target_pressure_mbar", Number(e.target.value))} />
          </Field>

          <Field label="Pressão de acionamento (mbar) da bomba secundária">
            <input type="number" value={operationConfig.roots_start_pressure_mbar} onChange={(e) => setOp("roots_start_pressure_mbar", Number(e.target.value))} />
          </Field>

          <Field label="Vazão de óleo (L/min)">
            <input type="number" value={operationConfig.oil_flow_l_min} onChange={(e) => setOp("oil_flow_l_min", Number(e.target.value))} />
          </Field>

          <Field label="Tempo máximo (s) do ciclo">
            <input type="number" value={operationConfig.max_cycle_seconds} onChange={(e) => setOp("max_cycle_seconds", Number(e.target.value))} />
          </Field>

          <Field label="Observação técnica">
            <input value={operationConfig.notes} onChange={(e) => setOp("notes", e.target.value)} />
          </Field>
        </div>

        <div className="commandBar">
          <button onClick={() => control("start")}>Iniciar operação</button>
          <button className="secondary" onClick={() => control("pause")}>Pausar</button>
          <button className="secondary" onClick={() => control("stop")}>Finalizar</button>
          <button className="secondary" onClick={() => control("reset")}>Resetar</button>
          <button className="danger" onClick={() => control("emergency")}>Emergência</button>
        </div>
      </Section>

      <Section title="Operação em tempo real" subtitle="Pressão, óleo, mangueira de vácuo e risco estrutural por tanque.">
        <div className="tankGrid">
          {tanksState.map((item: any, index: number) => (
            <TankCard key={item?.tank?.id || index} item={item} />
          ))}
        </div>
      </Section>

      <ComponentHealthPanel
        state={state}
        allTanks={allTanks}
        allHoses={allHoses}
      />
    </div>
  );
}
