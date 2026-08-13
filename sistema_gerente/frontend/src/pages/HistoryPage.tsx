import type { ComponentType } from "react";

type HistoryPageProps = {
  HistoryMenu: ComponentType<any>;
  allHoses: any[];
  allTanks: any[];
  operations: any[];
  state: any;
};

export function HistoryPage({ HistoryMenu, allHoses, allTanks, operations, state }: HistoryPageProps) {
  return (
    <div className="screen">
      <HistoryMenu
        operations={operations}
        state={state}
        allTanks={allTanks}
        allHoses={allHoses}
      />
    </div>
  );
}

