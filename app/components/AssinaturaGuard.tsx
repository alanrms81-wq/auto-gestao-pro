"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type SessionUser = {
  id?: string;
  empresa_id?: string | null;
  role?: string | null;
};

type AssinaturaEmpresa = {
  id: string;
  empresa_id?: string | null;
  status_assinatura?: string | null;
  bloqueado?: boolean | null;
  proximo_vencimento?: string | null;
  dias_carencia?: number | null;
};

type Props = {
  children: React.ReactNode;
};

function up(v: unknown) {
  return String(v ?? "").toUpperCase().trim();
}

function hojeISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(dateIso: string, days: number) {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function assinaturaBloqueada(a: AssinaturaEmpresa | null) {
  if (!a) return false;

  if (a.bloqueado) return true;

  const status = up(a.status_assinatura || "");
  if (status === "BLOQUEADO" || status === "CANCELADO") return true;

  if (a.proximo_vencimento) {
    const limite = addDays(a.proximo_vencimento, Number(a.dias_carencia || 0));
    if (hojeISO() > limite) return true;
  }

  return false;
}

export default function AssinaturaGuard({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [liberado, setLiberado] = useState(false);

  useEffect(() => {
    async function validar() {
      try {
        const user = (await getSessionUser()) as SessionUser | null;

        if (!user) {
          router.push("/login");
          return;
        }

        const role = String(user.role || "").toUpperCase();
        const isMaster = role === "MASTER";

        // MASTER nunca pode cair em /bloqueado
        if (isMaster) {
          if (pathname === "/bloqueado") {
            router.push("/dashboard");
            return;
          }

          setLiberado(true);
          return;
        }

        const rotasLivres = ["/login", "/registro", "/reset-password", "/bloqueado"];

        if (rotasLivres.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`))) {
          setLiberado(true);
          return;
        }

        if (!user.empresa_id) {
          router.push("/login");
          return;
        }

        const { data, error } = await supabase
          .from("assinaturas")
          .select("id,empresa_id,status_assinatura,bloqueado,proximo_vencimento,dias_carencia")
          .eq("empresa_id", user.empresa_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("Erro ao validar assinatura:", error.message);
          router.push("/bloqueado");
          return;
        }

        const bloqueado = assinaturaBloqueada((data || null) as AssinaturaEmpresa | null);

        if (bloqueado) {
          if (pathname !== "/bloqueado") {
            router.push("/bloqueado");
            return;
          }
        } else {
          if (pathname === "/bloqueado") {
            router.push("/dashboard");
            return;
          }
        }

        setLiberado(true);
      } finally {
        setLoading(false);
      }
    }

    validar();
  }, [pathname, router]);

  if (loading) {
    return <div className="p-6">VALIDANDO ASSINATURA...</div>;
  }

  if (!liberado) {
    return null;
  }

  return <>{children}</>;
}