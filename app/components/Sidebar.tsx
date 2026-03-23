"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type SessionUser = {
  nome?: string | null;
  role?: string | null;
  empresa_id?: string | null;
};

type MenuItem = {
  label: string;
  href: string;
};

const MENU_PRINCIPAL: MenuItem[] = [
  { label: "DASHBOARD", href: "/dashboard" },
  { label: "CLIENTES", href: "/clientes" },
  { label: "VEÍCULOS", href: "/veiculos" },
  { label: "PRODUTOS", href: "/produtos" },
  { label: "CATEGORIAS", href: "/categorias" },
  { label: "SERVIÇOS", href: "/servicos" },
  { label: "AGENDAMENTOS", href: "/agendamentos" },
  { label: "ORDENS DE SERVIÇO", href: "/ordens" },
  { label: "VENDAS", href: "/vendas" },
  { label: "FINANCEIRO", href: "/financeiro" },
  { label: "USUÁRIOS", href: "/usuarios" },

];

const MENU_ADMIN_EMPRESA: MenuItem[] = [
  { label: "CONTAS FINANCEIRAS", href: "/contas-financeiras" },
  { label: "TAXAS DE CARTÃO", href: "/taxas-cartao" },
];

const MENU_MASTER: MenuItem[] = [
  { label: "PAINEL MASTER", href: "/painel-master" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const user = (await getSessionUser()) as SessionUser | null;
        setSessionUser(user);
      } finally {
        setLoadingUser(false);
      }
    }

    loadUser();
  }, []);

  const role = String(sessionUser?.role || "").toUpperCase();
  const isAdminEmpresa = role === "ADMIN" || role === "MASTER";
  const isMaster = role === "MASTER";

  const menuItems = useMemo(() => {
    return [
      ...MENU_PRINCIPAL,
      ...(isAdminEmpresa ? MENU_ADMIN_EMPRESA : []),
      ...(isMaster ? MENU_MASTER : []),
    ];
  }, [isAdminEmpresa, isMaster]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside
      className={`h-screen sticky top-0 border-r border-[#D8E1EA] bg-[#0456A3] text-white transition-all duration-300 ${
        collapsed ? "w-[86px]" : "w-[290px]"
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-white/15 px-4 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className={`${collapsed ? "hidden" : "block"}`}>
              <div className="text-[11px] font-black tracking-[0.18em] text-white/75">
                AUTO GESTÃO PRO
              </div>
              <div className="mt-2 text-[22px] font-black leading-none">
                MENU
              </div>
              <div className="mt-3 text-[12px] text-white/75">
                {loadingUser
                  ? "CARREGANDO..."
                  : sessionUser?.nome
                  ? `USUÁRIO: ${String(sessionUser.nome).toUpperCase()}`
                  : "USUÁRIO LOGADO"}
              </div>

              <div className="mt-2 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold">
                {isMaster ? "MASTER" : isAdminEmpresa ? "ADMIN" : "OPERADOR"}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 hover:bg-white/15"
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              <span className="text-lg font-black">{collapsed ? "»" : "«"}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-3 px-3 text-[10px] font-black tracking-[0.16em] text-white/60">
            {!collapsed ? "NAVEGAÇÃO" : "•"}
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex min-h-[48px] items-center gap-3 rounded-2xl px-3 py-3 text-[13px] font-bold transition-all ${
                    active
                      ? "bg-white text-[#0456A3] shadow-[0_8px_24px_rgba(0,0,0,0.14)]"
                      : "text-white hover:bg-white/12"
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      active ? "bg-[#0456A3]" : "bg-white/70"
                    }`}
                  />

                  {!collapsed && (
                    <span className="leading-tight">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {isAdminEmpresa && !collapsed && (
            <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-4">
              <div className="text-[11px] font-black tracking-[0.12em] text-white/70">
                ÁREA ADMIN
              </div>
              <div className="mt-2 text-[13px] font-semibold text-white">
                CONTAS E TAXAS LIBERADAS.
              </div>
            </div>
          )}

          {isMaster && !collapsed && (
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-4">
              <div className="text-[11px] font-black tracking-[0.12em] text-white/70">
                ÁREA MASTER
              </div>
              <div className="mt-2 text-[13px] font-semibold text-white">
                PAINEL MASTER LIBERADO.
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/15 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-3 text-[13px] font-black text-white hover:bg-white/15"
          >
            <span className="text-base">⎋</span>
            {!collapsed && <span>SAIR</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}