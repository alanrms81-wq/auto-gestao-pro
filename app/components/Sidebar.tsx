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
  { label: "CONTAS FINANCEIRAS", href: "/contas-financeiras", modulo: "CONTAS_FINANCEIRAS", icon: Landmark },
  { label: "TAXAS DE CARTÃO", href: "/taxas-cartao", modulo: "TAXAS_CARTAO", icon: CreditCard },
];

const MENU_MASTER: MenuItem[] = [
  { label: "PAINEL MASTER", href: "/painel-master", icon: Shield },
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

        const { data } = await supabase
          .from("usuarios_permissoes")
          .select("*")
          .eq("empresa_id", user.empresa_id)
          .eq("usuario_id", user.id);

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
    return !!permissoesMap.get(normalizarModulo(modulo))?.pode_ver;
  }

  const menuItems = useMemo(() => {
    return [
      ...MENU_PRINCIPAL.filter((i) => podeVerModulo(i.modulo)),
      ...MENU_ADMIN_EMPRESA.filter((i) => podeVerModulo(i.modulo)),
      ...(isMaster ? MENU_MASTER : []),
    ];
  }, [isMaster, permissoesMap]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside
      className={`sidebar-fixa sticky top-0 h-screen border-r border-white/10 bg-[#0456A3] text-white transition-all ${
        collapsed ? "w-[90px]" : "w-[300px]"
      }`}
    >
      <div className="flex h-full flex-col">

        {/* HEADER */}
        <div className="border-b border-white/15 px-4 py-5 flex justify-between items-start">
          {!collapsed && (
            <div>
              <div className="text-xs font-black text-white/70">AUTO GESTÃO PRO</div>
              <div className="text-xl font-black mt-1">MENU</div>
            </div>
          )}

          <button
            onClick={() => setCollapsed((v) => !v)}
            className="h-10 w-10 flex items-center justify-center bg-white/10 rounded-xl"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* MENU */}
        <div className="flex-1 px-3 py-4 space-y-1">
          {menuItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  background: active ? "#fff" : "transparent",
                  color: active ? "#0456A3" : "#fff",
                }}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl font-bold transition ${
                  collapsed ? "justify-center" : ""
                } ${active ? "shadow-md" : "hover:bg-white/10"}`}
              >
                <Icon size={18} />

                {!collapsed && (
                  <span style={{ color: active ? "#0456A3" : "#fff" }}>
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="p-3 border-t border-white/15">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-white/10 py-3 rounded-xl font-bold"
          >
            <LogOut size={16} />
            {!collapsed && "SAIR"}
          </button>
        </div>

        {/* 🔥 BLINDAGEM FINAL (ESSA É A CHAVE DO BUG) */}
        <style jsx>{`
          .sidebar-fixa :global(a),
          .sidebar-fixa :global(a:visited),
          .sidebar-fixa :global(a:active),
          .sidebar-fixa :global(a:focus) {
            color: inherit !important;
            text-decoration: none !important;
          }

          .sidebar-fixa :global(span),
          .sidebar-fixa :global(svg),
          .sidebar-fixa :global(div) {
            color: inherit !important;
          }
        `}</style>

      </div>
    </aside>
  );
}