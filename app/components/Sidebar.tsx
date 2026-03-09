"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type SessionUser = {
  nome?: string | null;
  role?: string | null;
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    async function loadUser() {
      const sessionUser = await getSessionUser();
      setUser(sessionUser);
    }
    loadUser();
  }, []);

  const menu = [
    { nome: "DASHBOARD", rota: "/dashboard" },
    { nome: "CLIENTES", rota: "/clientes" },
    { nome: "AGENDAMENTOS", rota: "/agendamentos" },
    { nome: "ORDEM DE SERVIÇO", rota: "/ordens" },
    { nome: "PRODUTOS", rota: "/produtos" },
    { nome: "CATEGORIAS", rota: "/categorias" },
    { nome: "FORNECEDORES", rota: "/fornecedores" },
    { nome: "VENDAS", rota: "/vendas" },
    { nome: "FINANCEIRO", rota: "/financeiro" },
    { nome: "USUÁRIOS", rota: "/usuarios" },
    { nome: "CONFIGURAÇÕES", rota: "/configuracoes" },
    { nome: "BACKUP", rota: "/configuracoes/backup" },
  ];

  function isActive(rota: string) {
    return pathname === rota || pathname.startsWith(`${rota}/`);
  }

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-[260px] min-h-screen bg-[#0456A3] text-white flex flex-col justify-between shrink-0">
      <div>
        <div className="px-6 pt-8 pb-4">
          <h1 className="text-[28px] font-black leading-[30px] text-white">
            AUTO GESTÃO <br /> PRÓ
          </h1>

          <div className="mt-8">
            <p className="text-[14px] font-semibold text-white">
              {String(user?.nome || "USUÁRIO").toUpperCase()}
            </p>
            <p className="text-[14px] text-white/90 mt-1">
              {String(user?.role || "").toUpperCase() || "ADMIN"}
            </p>
          </div>
        </div>

        <nav className="px-4 mt-6 flex flex-col gap-2">
          {menu.map((item) => {
            const ativo = isActive(item.rota);

            return (
              <Link
                key={item.rota}
                href={item.rota}
                className={[
                  "block rounded-[22px] px-6 py-3 text-[16px] font-bold transition-colors duration-150",
                  ativo
                    ? "!bg-white !text-[#0456A3] shadow-sm"
                    : "!text-white hover:bg-white/10",
                ].join(" ")}
              >
                <span className={ativo ? "!text-[#0456A3]" : "!text-white"}>
                  {item.nome}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4">
        <button
          onClick={sair}
          className="w-full rounded-xl bg-white py-3 font-bold text-[#0456A3] transition hover:opacity-90"
          type="button"
        >
          SAIR
        </button>
      </div>
    </aside>
  );
}