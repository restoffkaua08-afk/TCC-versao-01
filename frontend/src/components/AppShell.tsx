import { useEffect, useState, type ReactNode } from "react";

export type View = "dashboard" | "operation" | "twin" | "traceability" | "parameters";

const menu: { key: View; label: string; sub: string }[] = [
  { key: "dashboard", label: "Painel", sub: "Resumo operacional" },
  { key: "operation", label: "Operação", sub: "Configuração e execução" },
  { key: "twin", label: "Gêmeo Digital", sub: "Simulação operacional" },
  { key: "traceability", label: "Rastreabilidade", sub: "Histórico, logs e relatórios" },
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

export function AppShell({
  apiOnline,
  children,
  menuOpen,
  setMenuOpen,
  setView,
  statusBadge,
  view,
}: AppShellProps) {
  const pageTitle = menu.find((item) => item.key === view)?.label || "Painel";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("tsea.mainSidebarCollapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("tsea.mainSidebarCollapsed", sidebarCollapsed ? "true" : "false");
  }, [sidebarCollapsed]);

  function handleNavigate(nextView: View) {
    setView(nextView);
    setMenuOpen(false);
  }

  return (
    <div
      className={[
        "app-shell",
        menuOpen ? "mobile-menu-open" : "",
        sidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded",
      ].join(" ")}
    >
      <aside className={`sidebar ${menuOpen ? "open" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <div className="brand-mark">T</div>

          <div className="brand-copy">
            <strong>TSEA</strong>
            <span>Supervisório Digital</span>
            <small>Vácuo · Rastreabilidade · Gêmeo Digital</small>
          </div>

          <button
            className="sidebar-collapse-toggle"
            type="button"
            aria-label={sidebarCollapsed ? "Abrir barra lateral" : "Recolher barra lateral"}
            title={sidebarCollapsed ? "Abrir menu lateral" : "Recolher menu lateral"}
            onClick={() => setSidebarCollapsed((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <nav className="nav-list" aria-label="Menu principal">
          {menu.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${view === item.key ? "active" : ""}`}
              onClick={() => handleNavigate(item.key)}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span className="nav-item-dot" />
              <span className="nav-item-text">
                <strong>{item.label}</strong>
                <small>{item.sub}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className={apiOnline ? "api-dot online" : "api-dot offline"} />
          <div>
            <strong>{apiOnline ? "API conectada" : "API desconectada"}</strong>
            <small>{apiOnline ? "Sincronização ativa" : "Operando com dados locais"}</small>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <button
          className="backdrop"
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <main className="content">
        <header className="topbar">
          <button
            className="menu-toggle"
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <span />
            <span />
            <span />
          </button>

          <div className="topbar-title">
            <span>TSEA · {pageTitle}</span>
            <h1>{pageTitle}</h1>
            <p>Supervisão técnica do processo de vácuo, rastreabilidade e validação operacional.</p>
          </div>

          <div className="topbar-status">{statusBadge}</div>
        </header>

        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
