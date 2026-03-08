export type Role = "ADMIN" | "FUNCIONARIO";

export type SessionUser = {
  ok: true;
  id: number;
  usuario: string;
  nome: string;
  role: Role;
  privilegios?: string[];
};

export function getSession(): SessionUser | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem("sessionUser");
    if (!raw) return null;

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isLogged() {
  const session = getSession();
  return !!session;
}

export function canAccess(privilegio: string) {
  const session = getSession();

  if (!session) return false;

  if (session.role === "ADMIN") return true;

  const privs = session.privilegios || [];

  return privs.includes(privilegio);
}
