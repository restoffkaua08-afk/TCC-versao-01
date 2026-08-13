import type { ComponentType } from "react";

type ReportsPageProps = {
  ReportsMenu: ComponentType<any>;
  allHoses: any[];
  allTanks: any[];
  operations: any[];
  state: any;
};

export function ReportsPage({ ReportsMenu, allHoses, allTanks, operations, state }: ReportsPageProps) {
  return (
    <div className="screen">
      <ReportsMenu
        operations={operations}
        state={state}
        allTanks={allTanks}
        allHoses={allHoses}
      />
    </div>
  );
}
