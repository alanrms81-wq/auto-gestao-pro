"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import {
  buscarAssinaturaEmpresa,
  resolverStatusAssinatura,
  type AssinaturaEmpresa,
  type AssinaturaStatus,
} from "@/lib/assinaturas";

type Props = {
  children: React.ReactNode;
};

export default function AssinaturaGuard({ children }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AssinaturaStatus | null>(null);
  const [assinatura, setAssinatura] = useState<AssinaturaEmpresa | null>(null);

  useEffect(() => {
    async function validar() {
      const user = await getSessionUser();

      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const assinaturaEmpresa = await buscarAssinaturaEmpresa(user.empresa_id);
        const statusResolvido = resolverStatusAssinatura(assinaturaEmpresa);

        setAssinatura(assinaturaEmpresa);
        setStatus(statusResolvido);

        if (
          statusResolvido === "BLOQUEADO" ||
          statusResolvido === "CANCELADO"
        ) {
          router.push("/bloqueado");
          return;
        }
      } catch (error) {
        router.push("/bloqueado");
        return;
      } finally {
        setLoading(false);
      }
    }

    validar();
  }, [router]);

  if (loading) {
    return <div className="p-6">VALIDANDO ASSINATURA...</div>;
  }

  return (
    <>
      {(status === "VENCIDO" || status === "CARENCIA") && (
        <div className="mx-4 mt-4 rounded-2xl border border-[#FCD34D] bg-[#FEF3C7] p-4 text-[#92400E]">
          <div className="font-black text-sm">
            {status === "CARENCIA"
              ? "ASSINATURA EM CARÊNCIA"
              : "ASSINATURA VENCIDA"}
          </div>
          <div className="mt-1 text-sm">
            Entre em contato para regularizar a mensalidade.
          </div>
        </div>
      )}

      {children}
    </>
  );
}