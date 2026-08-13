import { useMemo, useState } from "react";
import { IndustrialIcon } from "./IndustrialIcons";
import type { AccessLogEntry, ManagerUser } from "./managerUsers";
import { clearManagerUser, getAccessLogs, getStoredManagerUser } from "./managerUsers";

type SettingsOverlayProps = {
  open: boolean;
  user: ManagerUser | null;
  onClose: () => void;
  onLogout: () => void;
};

type SettingsTab = "user" | "access";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function getAccessPeriod(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  }).format(date);
}

export function SettingsOverlay({ open, user, onClose, onLogout }: SettingsOverlayProps) {
  const [tab, setTab] = useState<SettingsTab>("user");

  const logs = useMemo(() => getAccessLogs(), [open]);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const activeUser = user || getStoredManagerUser();

  const selectedLog: AccessLogEntry | null = useMemo(() => {
    if (!logs.length) return null;
    return logs.find((log) => log.id === selectedLogId) || logs[0] || null;
  }, [logs, selectedLogId]);

  if (!open) return null;

  function handleLogout() {
    clearManagerUser();
    onLogout();
    window.location.reload();
  }

  return (
    <div className="manager-settings">
      <div className="manager-settings__backdrop" onClick={onClose} />

      <section className="manager-settings__panel" role="dialog" aria-modal="true">
        <aside className="manager-settings__side">
          <button
            type="button"
            className={tab === "user" ? "is-active" : ""}
            onClick={() => setTab("user")}
          >
            <IndustrialIcon name="user" />
            Usuário
          </button>

          <button
            type="button"
            className={tab === "access" ? "is-active" : ""}
            onClick={() => setTab("access")}
          >
            <IndustrialIcon name="access" />
            Acessos
          </button>
        </aside>

        <main className="manager-settings__content">
          <button className="manager-settings__close" type="button" onClick={onClose}>
            ×
          </button>

          {tab === "user" && (
            <div className="manager-user-card">
              <div className="manager-user-card__avatar">
                {activeUser?.avatarInitials || "TS"}
              </div>

              <div className="manager-user-card__info">
                <div>
                  <span>Nome</span>
                  <strong>{activeUser?.name || "Usuário não identificado"}</strong>
                </div>

                <div>
                  <span>Cargo</span>
                  <strong>{activeUser?.role || "Sem cargo"}</strong>
                </div>

                <div>
                  <span>Número de identificação</span>
                  <strong>{activeUser?.employeeId || activeUser?.accessNumber || "-"}</strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>{activeUser?.email || "-"}</strong>
                </div>

                <button className="manager-user-card__logout" type="button" onClick={handleLogout}>
                  <IndustrialIcon name="logout" />
                  Sair do perfil
                </button>
              </div>
            </div>
          )}

          {tab === "access" && (
            <div className="manager-access-layout">
              <section className="manager-access-list">
                {logs.length === 0 ? (
                  <div className="manager-access-list__empty">Nenhum acesso registrado.</div>
                ) : (
                  logs.map((log) => (
                    <article
                      key={log.id}
                      className={`manager-access-item ${selectedLog?.id === log.id ? "is-active" : ""}`}
                    >
                      <div>
                        <strong>{log.userName}</strong>
                        <span>{formatDate(log.createdAt)}</span>
                      </div>

                      <button type="button" onClick={() => setSelectedLogId(log.id)}>
                        Ver
                      </button>
                    </article>
                  ))
                )}
              </section>

              <section className="manager-access-detail">
                {selectedLog ? (
                  <>
                    <div>
                      <span>Usuário</span>
                      <strong>{selectedLog.userName}</strong>
                    </div>

                    <div>
                      <span>Número de acesso</span>
                      <strong>{selectedLog.accessNumber}</strong>
                    </div>

                    <div>
                      <span>Ação</span>
                      <strong>{selectedLog.action}</strong>
                    </div>

                    <div>
                      <span>Período</span>
                      <strong>{getAccessPeriod(selectedLog.createdAt)}</strong>
                    </div>

                    <div>
                      <span>Data e hora</span>
                      <strong>{formatDate(selectedLog.createdAt)}</strong>
                    </div>
                  </>
                ) : (
                  <div className="manager-access-detail__empty">Selecione um acesso.</div>
                )}
              </section>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}