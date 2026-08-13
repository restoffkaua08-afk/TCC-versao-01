export type ManagerUser = {
  accessNumber: string;
  password: string;
  name: string;
  role: string;
  employeeId: string;
  email: string;
  avatarInitials: string;
};

export type AccessLogEntry = {
  id: string;
  userName: string;
  accessNumber: string;
  action: string;
  view?: string;
  createdAt: string;
};

export const MANAGER_USERS: ManagerUser[] = [
  {
    accessNumber: "1001",
    password: "1234",
    name: "Kaua Restoff de Oliveira",
    role: "Administrador do Sistema",
    employeeId: "TSEA-1001",
    email: "restoffkaua@gmail.com",
    avatarInitials: "KR"
  },
  {
    accessNumber: "2001",
    password: "1234",
    name: "Operador TSEA",
    role: "Operador",
    employeeId: "TSEA-2001",
    email: "operador@tsea.local",
    avatarInitials: "OP"
  },
  {
    accessNumber: "3001",
    password: "1234",
    name: "Supervisor TSEA",
    role: "Supervisor",
    employeeId: "TSEA-3001",
    email: "supervisor@tsea.local",
    avatarInitials: "SP"
  }
];

const USER_KEY = "tsea_manager_current_user";
const LOG_KEY = "tsea_manager_access_logs";

export function getStoredManagerUser(): ManagerUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ManagerUser;
  } catch {
    return null;
  }
}

export function storeManagerUser(user: ManagerUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearManagerUser() {
  localStorage.removeItem(USER_KEY);
}

export function getAccessLogs(): AccessLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AccessLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function registerAccessLog(entry: Omit<AccessLogEntry, "id" | "createdAt">) {
  const logs = getAccessLogs();

  const next: AccessLogEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString()
  };

  localStorage.setItem(LOG_KEY, JSON.stringify([next, ...logs].slice(0, 300)));
}

export function validateManagerLogin(accessNumber: string, password: string): ManagerUser | null {
  return MANAGER_USERS.find(
    (user) => user.accessNumber === accessNumber.trim() && user.password === password
  ) || null;
}