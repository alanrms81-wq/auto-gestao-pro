"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type OrdemServico = {
  id: string;
  empresa_id?: string | null;
  numero?: string | null;
  cliente_nome?: string | null;
  veiculo_descricao?: string | null;
  placa?: string | null;
  km?: string | null;
  defeito_relatado?: string | null;
  observacoes?: string | null;
  status?: string | null;
  subtotal_produtos?: number | null;
  subtotal_servicos?: number | null;
  desconto?: number | null;
  acrescimo?: number | null;
  total?: number | null;
  faturado?: boolean | null;
  data_faturamento?: string | null;
  created_at?: string | null;
};

type OsProduto = {
  id?: string;
  produto_nome?: string | null;
  quantidade?: number | null;
  valor_unitario?: number | null;
  subtotal?: number | null;
};

type OsServico = {
  id?: string;
  descricao?: string | null;
  quantidade?: number | null;
  valor_unitario?: number | null;
  subtotal?: number | null;
};

type EmpresaConfig = {
  id?: string;
  empresa_id?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  inscricao_estadual?: string | null;
  telefone?: string | null;
  email?: string | null;
  site?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  logo_url?: string | null;
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

function formatDateTimeBR(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString("pt-BR");
}

function montarEnderecoEmpresa(empresa: EmpresaConfig | null) {
  if (!empresa) return "-";

  const linha1 = [empresa.endereco, empresa.numero].filter(Boolean).join(", ");
  const linha2 = [empresa.bairro, empresa.cidade, empresa.estado].filter(Boolean).join(" - ");
  const linha3 = empresa.cep ? `CEP: ${empresa.cep}` : "";

  return [linha1, linha2, linha3].filter(Boolean).join(" • ");
}

export default function ImprimirOSPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [ordem, setOrdem] = useState<OrdemServico | null>(null);
  const [produtos, setProdutos] = useState<OsProduto[]>([]);
  const [servicos, setServicos] = useState<OsServico[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);

  useEffect(() => {
    async function init() {
      const user = await getSessionUser();

      if (!user) {
        router.push("/login");
        return;
      }

      if (!id) {
        alert("OS NÃO INFORMADA.");
        router.push("/ordens");
        return;
      }

      const [osResp, prodResp, servResp, empResp] = await Promise.all([
        supabase.from("ordens_servico").select("*").eq("id", id).single(),
        supabase
          .from("ordens_servico_produtos")
          .select("*")
          .eq("ordem_servico_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("ordens_servico_servicos")
          .select("*")
          .eq("ordem_servico_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("empresas_config")
          .select("*")
          .eq("empresa_id", user.empresa_id)
          .single(),
      ]);

      if (osResp.error || !osResp.data) {
        alert("ERRO AO CARREGAR OS.");
        router.push("/ordens");
        return;
      }

      setOrdem(osResp.data as OrdemServico);
      setProdutos((prodResp.data || []) as OsProduto[]);
      setServicos((servResp.data || []) as OsServico[]);
      setEmpresa((empResp.data || null) as EmpresaConfig | null);
      setLoading(false);
    }

    init();
  }, [id, router]);

  const subtotalProdutos = useMemo(() => {
    return produtos.reduce((acc, p) => acc + toMoney(p.subtotal), 0);
  }, [produtos]);

  const subtotalServicos = useMemo(() => {
    return servicos.reduce((acc, s) => acc + toMoney(s.subtotal), 0);
  }, [servicos]);

  if (loading) {
    return <div style={{ padding: 24 }}>CARREGANDO...</div>;
  }

  if (!ordem) {
    return <div style={{ padding: 24 }}>OS NÃO ENCONTRADA.</div>;
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] p-6 print:bg-white print:p-0">
      <div className="max-w-5xl mx-auto bg-white shadow-sm rounded-2xl p-8 print:shadow-none print:rounded-none print:max-w-none print:p-0">
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
          <div className="flex items-start justify-between gap-6 border-b border-[#D1D5DB] pb-6 mb-6">
            <div className="flex items-start gap-4">
              {empresa?.logo_url ? (
                <img
                  src={empresa.logo_url}
                  alt="Logo da empresa"
                  className="h-[72px] w-auto object-contain border border-[#E5E7EB] rounded-xl p-2 bg-white"
                />
              ) : (
                <div className="h-[72px] w-[110px] border border-[#D1D5DB] rounded-xl flex items-center justify-center text-[12px] text-[#6B7280] font-semibold">
                  SEM LOGO
                </div>
              )}

              <div>
                <div className="text-[24px] font-black text-[#111827] leading-tight">
                  {empresa?.nome_fantasia || empresa?.razao_social || "EMPRESA"}
                </div>

                {empresa?.razao_social &&
                  empresa?.nome_fantasia &&
                  empresa.razao_social !== empresa.nome_fantasia && (
                    <div className="text-[13px] text-[#4B5563] mt-1">
                      {empresa.razao_social}
                    </div>
                  )}

                <div className="text-[13px] text-[#374151] mt-2">
                  <b>CNPJ:</b> {empresa?.cnpj || "-"}
                </div>

                {empresa?.inscricao_estadual && (
                  <div className="text-[13px] text-[#374151]">
                    <b>I.E.:</b> {empresa.inscricao_estadual}
                  </div>
                )}

                <div className="text-[13px] text-[#374151]">
                  <b>Telefone:</b> {empresa?.telefone || "-"}
                </div>

                {empresa?.email && (
                  <div className="text-[13px] text-[#374151]">
                    <b>E-mail:</b> {empresa.email}
                  </div>
                )}

                {empresa?.site && (
                  <div className="text-[13px] text-[#374151]">
                    <b>Site:</b> {empresa.site}
                  </div>
                )}

                <div className="text-[13px] text-[#374151] mt-1">
                  <b>Endereço:</b> {montarEnderecoEmpresa(empresa)}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[13px] font-bold text-[#6B7280] uppercase tracking-wide">
                Ordem de Serviço
              </div>

              <div className="text-[32px] font-black text-[#111827] leading-none mt-2">
                {ordem.numero || "-"}
              </div>

              <div className="text-[13px] text-[#4B5563] mt-3">
                <b>Data:</b> {formatDateBR(ordem.created_at)}
              </div>

              <div className="text-[13px] text-[#4B5563]">
                <b>Status:</b> {ordem.status || "-"}
              </div>

              <div className="text-[13px] text-[#4B5563]">
                <b>Emitido em:</b> {formatDateTimeBR(ordem.created_at)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <Info titulo="CLIENTE" valor={ordem.cliente_nome || "-"} />
            <Info titulo="VEÍCULO" valor={ordem.veiculo_descricao || "-"} />
            <Info titulo="PLACA" valor={ordem.placa || "-"} />
            <Info titulo="KM" valor={ordem.km || "-"} />
          </div>

          <div className="mb-6">
            <h2 className="titulo-bloco">DEFEITO RELATADO</h2>
            <div className="bloco-texto">{ordem.defeito_relatado || "-"}</div>
          </div>

          <div className="mb-6">
            <h2 className="titulo-bloco">PRODUTOS APLICADOS</h2>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F3F4F6]">
                  <th className="th">PRODUTO</th>
                  <th className="th w-[90px]">QTD</th>
                  <th className="th w-[140px]">VALOR UNIT.</th>
                  <th className="th w-[140px]">SUBTOTAL</th>
                </tr>
              </thead>
              <tbody>
                {produtos.length === 0 ? (
                  <tr>
                    <td className="td text-center" colSpan={4}>
                      NENHUM PRODUTO
                    </td>
                  </tr>
                ) : (
                  produtos.map((p, i) => (
                    <tr key={i}>
                      <td className="td">{p.produto_nome || "-"}</td>
                      <td className="td">{toMoney(p.quantidade)}</td>
                      <td className="td">{moneyBR(toMoney(p.valor_unitario))}</td>
                      <td className="td">{moneyBR(toMoney(p.subtotal))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mb-6">
            <h2 className="titulo-bloco">SERVIÇOS EXECUTADOS</h2>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F3F4F6]">
                  <th className="th">DESCRIÇÃO</th>
                  <th className="th w-[90px]">QTD</th>
                  <th className="th w-[140px]">VALOR UNIT.</th>
                  <th className="th w-[140px]">SUBTOTAL</th>
                </tr>
              </thead>
              <tbody>
                {servicos.length === 0 ? (
                  <tr>
                    <td className="td text-center" colSpan={4}>
                      NENHUM SERVIÇO
                    </td>
                  </tr>
                ) : (
                  servicos.map((s, i) => (
                    <tr key={i}>
                      <td className="td">{s.descricao || "-"}</td>
                      <td className="td">{toMoney(s.quantidade)}</td>
                      <td className="td">{moneyBR(toMoney(s.valor_unitario))}</td>
                      <td className="td">{moneyBR(toMoney(s.subtotal))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-[1.3fr_0.7fr] gap-6 mb-6">
            <div>
              <h2 className="titulo-bloco">OBSERVAÇÕES</h2>
              <div className="bloco-texto min-h-[130px]">{ordem.observacoes || "-"}</div>
            </div>

            <div>
              <h2 className="titulo-bloco">RESUMO FINANCEIRO</h2>
              <div className="border border-[#D1D5DB] rounded-xl overflow-hidden">
                <LinhaTotal label="SUBTOTAL PRODUTOS" valor={moneyBR(subtotalProdutos)} />
                <LinhaTotal label="SUBTOTAL SERVIÇOS" valor={moneyBR(subtotalServicos)} />
                <LinhaTotal
                  label="DESCONTO"
                  valor={moneyBR(toMoney(ordem.desconto))}
                />
                <LinhaTotal
                  label="ACRÉSCIMO"
                  valor={moneyBR(toMoney(ordem.acrescimo))}
                />
                <LinhaTotal
                  label="TOTAL GERAL"
                  valor={moneyBR(toMoney(ordem.total))}
                  destaque
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mt-14 pt-10">
            <div className="text-center">
              <div className="border-t border-[#111827] pt-2 text-sm text-[#111827]">
                ASSINATURA DO CLIENTE
              </div>
            </div>

            <div className="text-center">
              <div className="border-t border-[#111827] pt-2 text-sm text-[#111827]">
                ASSINATURA DO RESPONSÁVEL
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
        .titulo-bloco {
          font-size: 14px;
          font-weight: 900;
          color: #374151;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .bloco-texto {
          border: 1px solid #d1d5db;
          border-radius: 12px;
          padding: 14px;
          color: #111827;
          background: #fff;
          white-space: pre-wrap;
          line-height: 1.5;
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
          vertical-align: top;
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

function LinhaTotal({
  label,
  valor,
  destaque = false,
}: {
  label: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 border-b last:border-b-0 ${
        destaque ? "bg-[#EFF6FF]" : "bg-white"
      }`}
    >
      <span className={`text-sm ${destaque ? "font-black" : "font-medium"} text-[#111827]`}>
        {label}
      </span>
      <span className={`text-sm ${destaque ? "font-black" : "font-semibold"} text-[#111827]`}>
        {valor}
      </span>
    </div>
  );
}