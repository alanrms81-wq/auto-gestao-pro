"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type OrdemServico = {
  id: string;
  numero?: string | null;
  cliente_nome?: string | null;
  veiculo_descricao?: string | null;
  placa?: string | null;
  km?: string | null;
  defeito_relatado?: string | null;
  observacoes?: string | null;
  status?: string | null;
  total?: number | null;
  created_at?: string | null;
};

type OsProduto = {
  produto_nome?: string | null;
  quantidade?: number | null;
};

type OsServico = {
  descricao?: string | null;
  quantidade?: number | null;
};

function toMoney(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function moneyBR(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateBR(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR");
}

export default function ImprimirTecnicoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [ordem, setOrdem] = useState<OrdemServico | null>(null);
  const [produtos, setProdutos] = useState<OsProduto[]>([]);
  const [servicos, setServicos] = useState<OsServico[]>([]);

  useEffect(() => {
    async function init() {
      const user = await getSessionUser();

      if (!user) {
        router.push("/login");
        return;
      }

      if (!id) {
        router.push("/ordens");
        return;
      }

      const [osResp, prodResp, servResp] = await Promise.all([
        supabase.from("ordens_servico").select("*").eq("id", id).single(),
        supabase.from("ordens_servico_produtos").select("*").eq("ordem_servico_id", id),
        supabase.from("ordens_servico_servicos").select("*").eq("ordem_servico_id", id),
      ]);

      if (osResp.error || !osResp.data) {
        alert("OS NÃO ENCONTRADA.");
        router.push("/ordens");
        return;
      }

      setOrdem(osResp.data as OrdemServico);
      setProdutos((prodResp.data || []) as OsProduto[]);
      setServicos((servResp.data || []) as OsServico[]);
      setLoading(false);
    }

    init();
  }, [id, router]);

  const totalItens = useMemo(() => produtos.length + servicos.length, [produtos, servicos]);

  if (loading) return <div style={{ padding: 24 }}>CARREGANDO...</div>;
  if (!ordem) return <div style={{ padding: 24 }}>OS NÃO ENCONTRADA.</div>;

  return (
    <div className="min-h-screen bg-[#f3f4f6] p-6 print:bg-white print:p-0">
      <div className="max-w-4xl mx-auto bg-white shadow-sm rounded-2xl p-8 print:shadow-none print:rounded-none print:max-w-none print:p-0">
        <div className="flex items-center justify-between mb-8 print:hidden">
          <button
            onClick={() => router.push("/ordens")}
            className="h-[46px] rounded-xl border border-[#2F2F2F] bg-white px-5 text-[15px] font-medium"
            type="button"
          >
            VOLTAR
          </button>

          <button
            onClick={() => window.print()}
            className="h-[46px] rounded-xl bg-[#0456A3] px-5 text-[15px] font-medium text-white"
            type="button"
          >
            IMPRIMIR
          </button>
        </div>

        <div className="border border-[#D1D5DB] rounded-2xl p-6 print:border-none print:rounded-none print:p-0">
          <div className="border-b border-[#D1D5DB] pb-5 mb-6">
            <h1 className="text-[28px] font-black text-[#111827]">ORDEM TÉCNICA</h1>
            <div className="text-sm text-[#4B5563] mt-1">
              Documento interno para execução do serviço
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <Info titulo="NÚMERO" valor={ordem.numero || "-"} />
            <Info titulo="DATA" valor={formatDateBR(ordem.created_at)} />
            <Info titulo="CLIENTE" valor={ordem.cliente_nome || "-"} />
            <Info titulo="VEÍCULO" valor={ordem.veiculo_descricao || "-"} />
            <Info titulo="PLACA" valor={ordem.placa || "-"} />
            <Info titulo="KM" valor={ordem.km || "-"} />
          </div>

          <div className="mb-6">
            <h2 className="titulo">DEFEITO RELATADO</h2>
            <div className="bloco">{ordem.defeito_relatado || "-"}</div>
          </div>

          <div className="mb-6">
            <h2 className="titulo">CHECKLIST DE PRODUTOS</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F3F4F6]">
                  <th className="th">ITEM</th>
                  <th className="th w-[100px]">QTD</th>
                  <th className="th w-[160px]">APLICADO</th>
                </tr>
              </thead>
              <tbody>
                {produtos.length === 0 ? (
                  <tr>
                    <td className="td text-center" colSpan={3}>NENHUM PRODUTO</td>
                  </tr>
                ) : (
                  produtos.map((p, i) => (
                    <tr key={i}>
                      <td className="td">{p.produto_nome || "-"}</td>
                      <td className="td">{toMoney(p.quantidade)}</td>
                      <td className="td">[   ] SIM &nbsp;&nbsp; [   ] NÃO</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mb-6">
            <h2 className="titulo">CHECKLIST DE SERVIÇOS</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F3F4F6]">
                  <th className="th">SERVIÇO</th>
                  <th className="th w-[100px]">QTD</th>
                  <th className="th w-[160px]">EXECUTADO</th>
                </tr>
              </thead>
              <tbody>
                {servicos.length === 0 ? (
                  <tr>
                    <td className="td text-center" colSpan={3}>NENHUM SERVIÇO</td>
                  </tr>
                ) : (
                  servicos.map((s, i) => (
                    <tr key={i}>
                      <td className="td">{s.descricao || "-"}</td>
                      <td className="td">{toMoney(s.quantidade)}</td>
                      <td className="td">[   ] SIM &nbsp;&nbsp; [   ] NÃO</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <Info titulo="TOTAL DE ITENS" valor={String(totalItens)} />
            <Info titulo="VALOR DA OS" valor={moneyBR(toMoney(ordem.total))} />
          </div>

          <div className="mb-6">
            <h2 className="titulo">OBSERVAÇÕES TÉCNICAS</h2>
            <div className="bloco min-h-[140px]">{ordem.observacoes || ""}</div>
          </div>

          <div className="grid grid-cols-2 gap-12 mt-14 pt-10">
            <div className="text-center">
              <div className="border-t border-[#111827] pt-2 text-sm text-[#111827]">
                ASSINATURA DO TÉCNICO
              </div>
            </div>

            <div className="text-center">
              <div className="border-t border-[#111827] pt-2 text-sm text-[#111827]">
                CONFERÊNCIA FINAL
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          html,
          body {
            background: white !important;
          }

          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      <style jsx>{`
        .titulo {
          font-size: 14px;
          font-weight: 900;
          color: #374151;
          margin-bottom: 10px;
        }

        .bloco {
          border: 1px solid #d1d5db;
          border-radius: 12px;
          padding: 14px;
          color: #111827;
          background: #fff;
          white-space: pre-wrap;
        }

        .th {
          text-align: left;
          padding: 12px;
          font-size: 12px;
          font-weight: 900;
          color: #111827;
          border: 1px solid #e5e7eb;
        }

        .td {
          padding: 12px;
          font-size: 13px;
          color: #111827;
          border: 1px solid #e5e7eb;
        }
      `}</style>
    </div>
  );
}

function Info({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="border border-[#D1D5DB] rounded-xl p-4">
      <div className="text-xs font-bold text-[#6B7280] mb-1">{titulo}</div>
      <div className="text-base font-semibold text-[#111827]">{valor}</div>
    </div>
  );
}