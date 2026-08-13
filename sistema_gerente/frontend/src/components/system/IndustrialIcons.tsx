import type { ReactNode, SVGProps } from "react";

export type IndustrialIconName =
  | "dashboard"
  | "operation"
  | "twin"
  | "traceability"
  | "parameters"
  | "settings"
  | "access"
  | "user"
  | "logout";

type IconProps = SVGProps<SVGSVGElement> & {
  name: IndustrialIconName;
};

function BaseIcon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.95"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IndustrialIcon({ name, ...props }: IconProps) {
  if (name === "dashboard") {
    return (
      <BaseIcon {...props}>
        <path d="M4 15.5a8 8 0 1 1 16 0" />
        <path d="M12 15.5l4-5" />
        <path d="M8.2 15.5h7.6" />
        <path d="M6.5 19h11" />
        <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
      </BaseIcon>
    );
  }

  if (name === "operation") {
    return (
      <BaseIcon {...props}>
        <path d="M4 17h16" />
        <path d="M6 17V9.5h3.5V17" />
        <path d="M14.5 17V7h3.5v10" />
        <path d="M9.5 12h5" />
        <path d="M11 10.5l2 1.5-2 1.5z" fill="currentColor" stroke="none" />
        <path d="M5 7h5" />
        <path d="M14 5h5" />
      </BaseIcon>
    );
  }

  if (name === "twin") {
    return (
      <BaseIcon {...props}>
        <path d="M12 3.5l7 4v8l-7 4-7-4v-8l7-4z" />
        <path d="M12 11.5l7-4" />
        <path d="M12 11.5v8" />
        <path d="M12 11.5l-7-4" />
        <path d="M16.5 17.2l2.5 1.5" />
        <path d="M5 18.7l2.5-1.5" />
      </BaseIcon>
    );
  }

  if (name === "traceability") {
    return (
      <BaseIcon {...props}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 8h8" />
        <path d="M8 12h4" />
        <path d="M8 16h3" />
        <path d="M14.5 14.5l1.5 1.5 3-3" />
        <path d="M9 3v3" />
        <path d="M15 3v3" />
      </BaseIcon>
    );
  }

  if (name === "parameters") {
    return (
      <BaseIcon {...props}>
        <path d="M4 7h9" />
        <path d="M17 7h3" />
        <circle cx="15" cy="7" r="2" />
        <path d="M4 12h3" />
        <path d="M11 12h9" />
        <circle cx="9" cy="12" r="2" />
        <path d="M4 17h11" />
        <path d="M19 17h1" />
        <circle cx="17" cy="17" r="2" />
      </BaseIcon>
    );
  }

  if (name === "settings") {
    return (
      <BaseIcon {...props}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.52a2 2 0 0 1-1 1.73l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.73v-.52a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </BaseIcon>
    );
  }

  if (name === "access") {
    return (
      <BaseIcon {...props}>
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <path d="M12 14v2" />
      </BaseIcon>
    );
  }

  if (name === "user") {
    return (
      <BaseIcon {...props}>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </BaseIcon>
    );
  }

  return (
    <BaseIcon {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </BaseIcon>
  );
}