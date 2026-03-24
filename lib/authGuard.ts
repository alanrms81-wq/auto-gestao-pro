"use client";

type Permissao = {
  modulo?: string;
  pode_ver?: boolean;
  pode_criar?: boolean;
  pode_editar?: boolean;
  pode_excluir?: boolean;
};

type UsuarioCache = {
  id?: string;
  nome?: string | null;
  email?: string | null;
  role?: string | null;
  perfil?: string | null;
  empresa_id?: string | null;
  permissoes?: Permissao[] | Record<string, boolean>;
};

function normalizarTexto(v: unknown) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getCachedUser(): UsuarioCache | null {
  const candidatos = [
    "sessionUser",
    "session_user",
    "user",
    "usuario",
    "usuario_logado",
    "auth_user",
  ];

  for (const key of candidatos) {
    const data = readJson<UsuarioCache>(key);
    if (data) return data;
  }

  return null;
}

export function isLogged() {
  const user = getCachedUser();
  return !!user;
}

export function getRole() {
  const user = getCachedUser();
  return normalizarTexto(user?.role || user?.perfil || "");
}

export function isMaster() {
  return getRole() === "MASTER";
}

export function isAdmin() {
  const role = getRole();
  return role === "ADMIN" || role === "MASTER";
}

export function canAccess(modulo: string) {
  const user = getCachedUser();

  if (!user) return false;

  const role = normalizarTexto(user.role || user.perfil || "");

  // MASTER entra em tudo
  if (role === "MASTER") return true;

  // ADMIN entra em tudo da empresa
  if (role === "ADMIN") return true;

  const moduloNormalizado = normalizarTexto(modulo);

  // caso permissoes venha como array
  if (Array.isArray(user.permissoes)) {
    const permissao = user.permissoes.find(
      (p) => normalizarTexto(p.modulo) === moduloNormalizado
    );

    return !!permissao?.pode_ver;
  }

  // caso permissoes venha como objeto
  if (user.permissoes && typeof user.permissoes === "object") {
    const mapa = user.permissoes as Record<string, boolean>;
    return !!mapa[moduloNormalizado];
  }

  return false;
}