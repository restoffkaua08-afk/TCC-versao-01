import type { ReactNode } from "react";

export type View = "dashboard" | "operation" | "twin" | "traceability" | "parameters";

const menu: { key: View; label: string; sub: string }[] = [
  { key: "dashboard", label: "Painel", sub: "Resumo operacional" },
  { key: "operation", label: "Operação", sub: "Configuração e execução" },
  { key: "twin", label: "Gêmeo Digital", sub: "Simulação operacional" },
  { key: "traceability", label: "Rastreabilidade", sub: "Histórico e relatórios" },
  { key: "parameters", label: "Parâmetros", sub: "Cadastros técnicos" },
];

type AppShellProps = {
  apiOnline: boolean;
  children: ReactNode;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  setView: (view: View) => void;
  statusBadge: ReactNode;
  view: View;
};

export function AppShell({ apiOnline, children, menuOpen, setMenuOpen, setView, statusBadge, view }: AppShellProps) {
  const pageTitle = menu.find((item) => item.key === view)?.label || "Painel";

  return (
    <div className={`layout ${menuOpen ? "drawerOpen" : ""}`}>
      <aside className="drawer">
        <div className="brandBlock">
          <span>TSEA</span>
          <strong>Supervisório Digital</strong>
          <small>Vácuo · Rastreabilidade · Gêmeo Digital</small>
        </div>

        <nav className="navList">
          {menu.map((item) => (
            <button
              key={item.key}
              className={view === item.key ? "active" : ""}
              onClick={() => {
                setView(item.key);
                setMenuOpen(false);
              }}
            >
              <span>{item.label}</span>
              <small>{item.sub}</small>
            </button>
          ))}
        </nav>

        <div className="drawerFooter">
          <span className={`dot ${apiOnline ? "on" : "off"}`} />
          <small>{apiOnline ? "API conectada" : "API desconectada"}</small>
        </div>
      </aside>

      <div className="overlay" onClick={() => setMenuOpen(false)} />

      <main className="content">
        <header className="topbar">
          <button className="hamburger" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
            <span />
            <span />
            <span />
          </button>

          <div>
            <span className="moduleLabel">TSEA · {pageTitle}</span>
            <h1>{pageTitle}</h1>
            <p>Supervisão técnica do processo de vácuo, rastreabilidade e validação operacional.</p>
          </div>

          {statusBadge}
        </header>

        {children}
      </main>
    </div>
  );
}
