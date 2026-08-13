import { IndustrialIcon } from "./IndustrialIcons";

type ManagerTopBarProps = {
  title: string;
  systemOk: boolean;
  onMenuClick: () => void;
  onSettingsClick: () => void;
};

export function ManagerTopBar({ title, systemOk, onMenuClick, onSettingsClick }: ManagerTopBarProps) {
  return (
    <header className="manager-topbar">
      <div className="manager-topbar__left">
        <button className="manager-topbar__menu" type="button" onClick={onMenuClick} aria-label="Abrir menu">
          <span />
          <span />
          <span />
        </button>

        <div className="manager-topbar__brand">TSEA</div>
      </div>

      <div className="manager-topbar__title">{title}</div>

      <div className="manager-topbar__actions">
        <span
          className={`manager-topbar__status ${systemOk ? "is-ok" : "is-alert"}`}
          title={systemOk ? "Sistema online" : "Sistema com pendência"}
        />

        <button className="manager-topbar__settings" type="button" onClick={onSettingsClick} aria-label="Configurações">
          <IndustrialIcon name="settings" />
        </button>
      </div>
    </header>
  );
}