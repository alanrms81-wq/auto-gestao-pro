"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Role = "ADMIN" | "FUNCIONARIO";

type Privilegio =
  | "DASHBOARD"
  | "CLIENTES"
  | "ORDENS"
  | "PRODUTOS"
  | "CATEGORIAS"
  | "FORNECEDORES"
  | "VENDAS"
  | "FINANCEIRO"
  | "USUARIOS";

type SessionUser = {
  ok: true;
  id: number;
  usuario: string;
  nome: string;
  role: Role;
  privilegios?: Privilegio[];
};

const MENU = [
  { label: "DASHBOARD", href: "/dashboard", privilegio: "DASHBOARD" as Privilegio },
  { label: "CLIENTES", href: "/clientes", privilegio: "CLIENTES" as Privilegio },
  { label: "ORDEM DE SERVIÇO", href: "/ordens", privilegio: "ORDENS" as Privilegio },
  { label: "PRODUTOS", href: "/produtos", privilegio: "PRODUTOS" as Privilegio },
  { label: "CATEGORIAS", href: "/categorias", privilegio: "CATEGORIAS" as Privilegio },
  { label: "FORNECEDORES", href: "/fornecedores", privilegio: "FORNECEDORES" as Privilegio },
  { label: "VENDAS", href: "/vendas", privilegio: "VENDAS" as Privilegio },
  { label: "FINANCEIRO", href: "/financeiro", privilegio: "FINANCEIRO" as Privilegio },
  { label: "USUÁRIOS", href: "/usuarios", privilegio: "USUARIOS" as Privilegio },
];

function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem("sessionUser");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function canAccess(user: SessionUser | null, privilegio: Privilegio) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;

  const privs = user.privilegios || [];
  return privs.includes(privilegio);
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const session = getSessionUser();

  const menuVisivel = MENU.filter((item) =>
    canAccess(session, item.privilegio)
  );

  function sair() {
    localStorage.removeItem("sessionUser");
    localStorage.removeItem("agp_auth");
    router.push("/login");
  }

  return (
    <aside className="w-64 min-h-screen bg-[#0A569E] text-white p-4 flex flex-col">
      <div className="text-xl font-black mb-2">AUTO GESTÃO PRÓ</div>

      <div className="text-xs opacity-85 mb-6">
        <div>{session?.nome || "SEM SESSÃO"}</div>
        <div className="opacity-70">{session?.role || "-"}</div>
      </div>

      <nav className="flex flex-col gap-2 flex-1">
        {menuVisivel.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "px-4 py-2 rounded-lg font-semibold transition",
                active
                  ? "bg-white text-[#0A569E]"
                  : "hover:bg-white/15 text-white",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={sair}
        className="mt-4 w-full bg-white text-[#0A569E] font-black rounded-lg px-4 py-2 hover:opacity-95"
      >
        SAIR
      </button>

      <div className="mt-3 text-[11px] opacity-80">
        <div>VERSÃO PREMIUM</div>
        <div>LOCALSTORAGE</div>
      </div>
    </aside>
  );
}
