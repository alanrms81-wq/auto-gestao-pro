"use client";

import { useRouter } from "next/navigation";

export default function BloqueadoPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center p-6">
      <div className="w-full max-w-[720px] rounded-[32px] bg-white border border-[#E5E7EB] shadow-[0_20px_60px_rgba(15,23,42,0.12)] overflow-hidden">
        <div className="bg-gradient-to-r from-[#991B1B] to-[#DC2626] px-8 py-8 text-white">
          <p className="text-[12px] font-bold tracking-[0.22em] opacity-80">
            AUTO GESTÃO PRO
          </p>

          <h1 className="mt-3 text-[34px] md:text-[40px] font-black leading-none">
            ACESSO BLOQUEADO
          </h1>

          <p className="mt-4 text-[15px] md:text-[16px] text-white/90 max-w-[520px]">
            Sua assinatura está bloqueada, cancelada ou precisa de regularização
            para continuar utilizando o sistema.
          </p>
        </div>

        <div className="px-8 py-8 md:px-10 md:py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <InfoCard
              titulo="STATUS"
              valor="BLOQUEADO"
              destaque
            />
            <InfoCard
              titulo="AÇÃO"
              valor="REGULARIZAR"
            />
            <InfoCard
              titulo="SUPORTE"
              valor="CONTATAR"
            />
          </div>

          <div className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] p-5">
            <h2 className="text-[16px] font-black text-[#991B1B]">
              O QUE ISSO SIGNIFICA?
            </h2>

            <div className="mt-4 space-y-3 text-[14px] text-[#7F1D1D]">
              <p>
                O acesso desta empresa foi interrompido por status de assinatura.
              </p>
              <p>
                Isso pode acontecer por inadimplência, cancelamento do plano ou
                término do período de teste sem conversão.
              </p>
              <p>
                Após a regularização, o acesso pode ser reativado normalmente.
              </p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="h-[54px] rounded-[18px] border border-[#D1D5DB] bg-white text-[#111827] font-black text-[14px] hover:bg-[#F9FAFB] transition"
            >
              VOLTAR PARA LOGIN
            </button>

            <a
              href="https://wa.me/"
              target="_blank"
              rel="noreferrer"
              className="h-[54px] rounded-[18px] bg-gradient-to-r from-[#0456A3] to-[#0A6FD6] text-white font-black text-[14px] flex items-center justify-center hover:opacity-95 transition"
            >
              FALAR COM SUPORTE
            </a>
          </div>

          <div className="mt-8 rounded-[20px] bg-[#F8FAFC] border border-[#E2E8F0] p-5">
            <div className="text-[12px] font-black tracking-[0.15em] text-[#64748B]">
              ORIENTAÇÃO
            </div>
            <p className="mt-3 text-[14px] text-[#475569] leading-relaxed">
              Se você é o responsável pela oficina, entre em contato com o
              administrador do sistema para verificar mensalidade, renovação,
              período de teste ou reativação do acesso.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  titulo,
  valor,
  destaque = false,
}: {
  titulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-[22px] p-5 border ${
        destaque
          ? "bg-[#FEF2F2] border-[#FECACA]"
          : "bg-[#F8FAFC] border-[#E2E8F0]"
      }`}
    >
      <div className="text-[11px] font-black tracking-[0.12em] text-[#64748B]">
        {titulo}
      </div>
      <div
        className={`mt-2 text-[20px] font-black leading-none ${
          destaque ? "text-[#B91C1C]" : "text-[#111827]"
        }`}
      >
        {valor}
      </div>
    </div>
  );
}