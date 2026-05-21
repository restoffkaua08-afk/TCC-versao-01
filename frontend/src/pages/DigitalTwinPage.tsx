import type { ComponentType } from "react";

type DigitalTwinPageProps = {
  DigitalTwin: ComponentType<any>;
  allHoses: any[];
  allTanks: any[];
  state: any;
};

export function DigitalTwinPage({ DigitalTwin, allHoses, allTanks, state }: DigitalTwinPageProps) {
  return (
    <div className="screen">
      <DigitalTwin
        state={state}
        allTanks={allTanks}
        allHoses={allHoses}
      />
    </div>
  );
}
