import { FormEvent, ReactNode, useEffect, useState } from "react";
import type { ManagerUser } from "./managerUsers";
import {
  getStoredManagerUser,
  registerAccessLog,
  storeManagerUser,
  validateManagerLogin
} from "./managerUsers";

type AccessGateProps = {
  children: ReactNode;
  onUserChange: (user: ManagerUser | null) => void;
};

type Stage = "boot" | "login" | "post-login" | "system";

export function AccessGate({ children, onUserChange }: AccessGateProps) {
  const [stage, setStage] = useState<Stage>("boot");
  const [accessNumber, setAccessNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = getStoredManagerUser();

    const timer = window.setTimeout(() => {
      if (stored) {
        onUserChange(stored);
        setStage("system");
      } else {
        setStage("login");
      }
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [onUserChange]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const user = validateManagerLogin(accessNumber, password);

    if (!user) {
      setError("Acesso inválido");
      return;
    }

    setError("");
    storeManagerUser(user);
    registerAccessLog({
      userName: user.name,
      accessNumber: user.accessNumber,
      action: "Login no Sistema Gerente"
    });

    onUserChange(user);
    setStage("post-login");

    window.setTimeout(() => {
      setStage("system");
    }, 3000);
  }

  if (stage === "boot" || stage === "post-login") {
    return (
      <div className="manager-splash">
        <div className="manager-splash__mark">
          <strong>TSEA</strong>
          <span>energia</span>
        </div>
      </div>
    );
  }

  if (stage === "login") {
    return (
      <main className="manager-login">
        <form className="manager-login__card" onSubmit={handleSubmit}>
          <h1>TSEA</h1>

          <input
            value={accessNumber}
            onChange={(event) => setAccessNumber(event.target.value)}
            placeholder="Número de acesso"
            autoComplete="username"
            autoFocus
          />

          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Senha"
            type="password"
            autoComplete="current-password"
          />

          {error && <span className="manager-login__error">{error}</span>}

          <button type="submit">Entrar</button>
        </form>
      </main>
    );
  }

  return <>{children}</>;
}