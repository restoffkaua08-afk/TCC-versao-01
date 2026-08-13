import { useEffect, useState, type ReactNode } from "react";
import "./system/managerSystem.css";
import { IndustrialIcon, type IndustrialIconName } from "./system/IndustrialIcons";
import { ManagerTopBar } from "./system/ManagerTopBar";
import { SettingsOverlay } from "./system/SettingsOverlay";

export type View = "dashboard" | "operation" | "twin" | "traceability" | "parameters";

const menu: { key: View; label: string; sub: string; icon: IndustrialIconName }[] = [
  { key: "dashboard", label: "Painel", sub: "Resumo operacional", icon: "dashboard" },
  { key: "operation", label: "Operação", sub: "Configuração e execução", icon: "operation" },
  { key: "twin", label: "Gêmeo Digital", sub: "Simulação operacional", icon: "twin" },
  { key: "traceability", label: "Rastreabilidade", sub: "Histórico, logs e relatórios", icon: "traceability" },
  { key: "parameters", label: "Parâmetros", sub: "Cadastros técnicos", icon: "parameters" },
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

  const [settingsOpen, setSettingsOpen] = useState(false);

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
      <ManagerTopBar
        title={pageTitle}
        systemOk={apiOnline}
        onMenuClick={() => setMenuOpen(true)}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      <SettingsOverlay
        open={settingsOpen}
        user={null}
        onClose={() => setSettingsOpen(false)}
        onLogout={() => setSettingsOpen(false)}
      />

      <aside className={`sidebar ${menuOpen ? "open" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <div className="brand-mark">T</div>

          <div className="brand-copy">
            <strong>TSEA</strong>
            <span>Supervisório Digital</span>
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
              <span className="nav-item-icon"><IndustrialIcon name={item.icon} /></span>
              <span className="nav-item-text">
                <strong>{item.label}</strong>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className={apiOnline ? "api-dot online" : "api-dot offline"} />
          <div>
            <strong>{apiOnline ? "API conectada" : "API desconectada"}</strong>
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
        <header className="topbar legacy-topbar">
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
          </div>

          <div className="topbar-status">{statusBadge}</div>
        </header>

        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
