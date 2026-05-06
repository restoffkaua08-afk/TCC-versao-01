import { ChartLine, ClipboardList, Gauge } from "lucide-react";
import type { ReactNode } from "react";

import { DataTable, labels, PageHeader } from "../components/ui";
import type { Hose, Recipe, Tank } from "../types/domain";

export function SettingsPage({ tanks, hoses, recipes }: { tanks: Tank[]; hoses: Hose[]; recipes: Recipe[] }) {
  return (
    <section className="page-stack">
      <PageHeader
        eyebrow="Configurações"
        title="Cadastros técnicos do processo"
        subtitle="Tanques, mangueiras e receitas usados pela simulação do processo TSEA."
      />

      <section className="grid">
        <AssetPanel title="Tanques cadastrados" icon={<Gauge size={18} />} rows={tanks} labels={labels.tank} />
        <AssetPanel title="Mangueiras cadastradas" icon={<ChartLine size={18} />} rows={hoses} labels={labels.hose} />
        <AssetPanel title="Receitas de processo" icon={<ClipboardList size={18} />} rows={recipes} labels={labels.recipe} />
      </section>
    </section>
  );
}

function AssetPanel({ title, icon, rows, labels }: { title: string; icon: ReactNode; rows: object[]; labels: Record<string, string> }) {
  return (
    <section className="panel wide">
      <div className="panel-title">
        <div>
          <h2>{icon}{title}</h2>
          <p>Cadastro preservado para operação e Gêmeo Digital.</p>
        </div>
        <span>{rows.length} registros</span>
      </div>
      <DataTable rows={rows} labels={labels} />
    </section>
  );
}
