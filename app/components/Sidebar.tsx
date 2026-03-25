"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  FolderTree,
  Wrench,
  CalendarDays,
  FileText,
  ShoppingCart,
  Wallet,
  UserCog,
  Landmark,
  CreditCard,
  Shield,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type SessionUser = {
  id?: string;
  nome?: string | null;
  role?: string | null;
  empresa_id?: string | null;
};

type MenuItem = {
  label: string;
  href: string;
  modulo?: string;
  icon: any;
};

type UsuarioPermissao = {
  id?: string;
  empresa_id?: string;
  usuario_id?: string;
  modulo: string;
  pode_ver: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
};

const MENU_PRINCIPAL: MenuItem[] = [
  { label: "DASHBOARD", href: "/dashboard", modulo: "DASHBOARD", icon: LayoutDashboard },
  { label: "CLIENTES", href: "/clientes", modulo: "CLIENTES", icon: Users },
  { label: "PRODUTOS", href: "/produtos", modulo: "PRODUTOS", icon: Package },
  { label: "CATEGORIAS", href: "/categorias", modulo: "CATEGORIAS", icon: FolderTree },
  { label: "SERVIÇOS", href: "/servicos", modulo: "SERVICOS", icon: Wrench },
  { label: "AGENDAMENTOS", href: "/agendamentos", modulo: "AGENDAMENTOS", icon: CalendarDays },
  { label: "ORDENS DE SERVIÇO", href: "/ordens", modulo: "ORDENS", icon: FileText },
  { label: "VENDAS", href: "/vendas", modulo: "VENDAS", icon: ShoppingCart },
  { label: "FINANCEIRO", href: "/financeiro", modulo: "FINANCEIRO", icon: Wallet },
  { label: "USUÁRIOS", href: "/usuarios", modulo: "USUARIOS", icon: UserCog },
];

const MENU_ADMIN_EMPRESA: MenuItem[] = [
  {
    label: "CONTAS FINANCEIRAS",
    href: "/contas-financeiras",
    modulo: "CONTAS_FINANCEIRAS",
    icon: Landmark,
  },
  {
    label: "TAXAS DE CARTÃO",
    href: "/taxas-cartao",
    modulo: "TAXAS_CARTAO",
    icon: CreditCard,
  },
];

const MENU_MASTER: MenuItem[] = [
  {
    label: "PAINEL MASTER",
    href: "/painel-master",
    icon: Shield,
  },
];

function normalizarModulo(modulo?: string | null) {
  return String(modulo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [permissoesUsuario, setPermissoesUsuario] = useState<UsuarioPermissao[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    async function loadUserAndPermissions() {
      try {
        const user = (await getSessionUser()) as SessionUser | null;
        setSessionUser(user);

        if (!user?.id || !user?.empresa_id) {
          setPermissoesUsuario([]);
          return;
        }

        const role = String(user.role || "").toUpperCase();

        if (role === "MASTER" || role === "ADMIN") {
          setPermissoesUsuario([]);
          return;
        }

        const { data, error } = await supabase
          .from("usuarios_permissoes")
          .select("*")
          .eq("empresa_id", user.empresa_id)
          .eq("usuario_id", user.id);

        if (error) {
          console.error("Erro ao carregar permissões do usuário:", error.message);
          setPermissoesUsuario([]);
          return;
        }

        setPermissoesUsuario((data || []) as UsuarioPermissao[]);
      } finally {
        setLoadingUser(false);
      }
    }

    loadUserAndPermissions();
  }, []);

  const role = String(sessionUser?.role || "").toUpperCase();
  const isMaster = role === "MASTER";
  const isAdminEmpresa = role === "ADMIN" || role === "MASTER";

  const permissoesMap = useMemo(() => {
    const map = new Map<string, UsuarioPermissao>();

    for (const permissao of permissoesUsuario) {
      map.set(normalizarModulo(permissao.modulo), permissao);
    }

    return map;
  }, [permissoesUsuario]);

  function podeVerModulo(modulo?: string) {
    if (!modulo) return true;
    if (isMaster || isAdminEmpresa) return true;

    const permissao = permissoesMap.get(normalizarModulo(modulo));
    return !!permissao?.pode_ver;
  }

  const menuItems = useMemo(() => {
    const principais = MENU_PRINCIPAL.filter((item) => podeVerModulo(item.modulo));
    const adminEmpresa = MENU_ADMIN_EMPRESA.filter((item) => podeVerModulo(item.modulo));
    const master = isMaster ? MENU_MASTER : [];

    return [...principais, ...adminEmpresa, ...master];
  }, [isMaster, permissoesMap]);

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
      className={`sticky top-0 h-screen shrink-0 border-r border-white/10 bg-gradient-to-b from-[#0456A3] via-[#0456A3] to-[#03427D] text-white shadow-[8px_0_30px_rgba(2,24,43,0.12)] transition-all duration-300 ${
        collapsed ? "w-[92px]" : "w-[300px]"
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-white/15 px-4 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className={collapsed ? "hidden" : "block"}>
              <div className="text-[11px] font-black tracking-[0.18em] text-white/70">
                AUTO GESTÃO PRO
              </div>

              <div className="mt-2 text-[24px] font-black leading-none text-white">
                MENU
              </div>

              <div className="mt-3 text-[12px] text-white/80">
                {loadingUser
                  ? "CARREGANDO..."
                  : sessionUser?.nome
                  ? `USUÁRIO: ${String(sessionUser.nome).toUpperCase()}`
                  : "USUÁRIO LOGADO"}
              </div>

              <div className="mt-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black tracking-[0.08em] text-white">
                {isMaster ? "MASTER" : isAdminEmpresa ? "ADMIN" : "OPERADOR"}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/20"
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-3 px-3 text-[10px] font-black tracking-[0.16em] text-white/65">
            {!collapsed ? "NAVEGAÇÃO" : "•"}
          </div>

          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex min-h-[50px] items-center gap-3 rounded-2xl px-3 py-3 text-[13px] font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/20 ${
                    active
                      ? "bg-white text-[#0456A3] shadow-[0_10px_28px_rgba(0,0,0,0.16)]"
                      : "text-white hover:bg-white/12 hover:text-white"
                  } ${collapsed ? "justify-center px-2" : ""}`}
                  title={collapsed ? item.label : undefined}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
                      active
                        ? "bg-[#0456A3]/10 text-[#0456A3]"
                        : "bg-white/10 text-white group-hover:bg-white/15"
                    }`}
                  >
                    <Icon size={18} className="text-current" />
                  </div>

                  {!collapsed && (
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <span className="truncate leading-tight text-current">{item.label}</span>

                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          active ? "bg-[#0456A3]" : "bg-white/50"
                        }`}
                      />
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>

          {isAdminEmpresa && !collapsed && (
            <div className="mt-6 rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-[11px] font-black tracking-[0.12em] text-white/70">
                ÁREA ADMIN
              </div>
              <div className="mt-2 text-[13px] font-semibold text-white">
                USUÁRIOS, CONTAS E TAXAS LIBERADOS.
              </div>
            </div>
          )}

          {isMaster && !collapsed && (
            <div className="mt-4 rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
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
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-3 text-[13px] font-black text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            <LogOut size={17} />
            {!collapsed && <span>SAIR</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}