import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { AccessGate } from "./AccessGate";
import type { ManagerUser } from "./managerUsers";

type ManagerRootGateProps = {
  children: ReactNode;
};

export function ManagerRootGate({ children }: ManagerRootGateProps) {
  const [, setCurrentUser] = useState<ManagerUser | null>(null);

  const handleUserChange = useCallback((user: ManagerUser | null) => {
    setCurrentUser(user);
  }, []);

  return (
    <AccessGate onUserChange={handleUserChange}>
      {children}
    </AccessGate>
  );
}