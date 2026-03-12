"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type OrdemServico = {
  id: string;
  empresa_id: string;
  numero?: string | null;
  cliente_id?: string | null;
  cliente_nome?: string | null;
  veiculo_id?: string | null;
  veiculo_descricao?: string | null;
  placa?: string | null;
  km?: string | null;
  tecnico_responsavel?: string | null;
  prazo_data?: string | null;
  garantia_numero?: string | null;
  garantia_tipo?: string | null;
  forma_pagamento?: string | null;
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
  ordem_servico_id?: string;
  produto_id?: string | null;
  nome?: string | null;
  produto_nome?: string | null;
  codigo?: string | null;
  quantidade?: number | null;
  valor_unitario?: number | null;
  subtotal?: number | null;
};

type OsServico = {
  id?: string;
  ordem_servico_id?: string;
  descricao?: string | null;
  quantidade?: number | null;
  valor_unitario?: number | null;
  subtotal?: number | null;
};

function toMoney(v: unknown) {
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
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR");
}

function formatDateTimeBR(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("pt-BR");
}

function statusLabel(status?: string | null) {
  return status || "-";
}

export default function ImprimirOSPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [empresaNome, setEmpresaNome] = useState("AUTO GESTÃO PRO");
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

      setEmpresaNome(user?.empresa_nome || user?.nome_empresa || "AUTO GESTÃO PRO");

      if (!id) {
        setLoading(false);
        return;
      }

      await carregarOS(user.empresa_id, id);
    }

    init();
  }, [router, id]);

  async function carregarOS(empresaId: string, ordemId: string) {
    setLoading(true);

    const [osResp, prodResp, servResp] = await Promise.all([
      supabase
        .from("ordens_servico")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("id", ordemId)
        .single(),

      supabase
        .from("ordens_servico_produtos")
        .select("*")
        .eq("ordem_servico_id", ordemId),

      supabase
        .from("ordens_servico_servicos")
        .select("*")
        .eq("ordem_servico_id", ordemId),
    ]);

    if (osResp.error) {
      alert("ERRO AO CARREGAR OS: " + osResp.error.message);
      setLoading(false);
      return;
    }

    if (prodResp.error) {
      alert("ERRO AO CARREGAR PRODUTOS DA OS: " + prodResp.error.message);
    }

    if (servResp.error) {
      alert("ERRO AO CARREGAR SERVIÇOS DA OS: " + servResp.error.message);
    }

    setOrdem((osResp.data || null) as OrdemServico | null);
    setProdutos((prodResp.data || []) as OsProduto[]);
    setServicos((servResp.data || []) as OsServico[]);
    setLoading(false);
  }

  const subtotalProdutos = useMemo(() => {
    if (ordem) return toMoney(ordem.subtotal_produtos);
    return produtos.reduce(
      (acc, item) => acc + toMoney(item.quantidade) * toMoney(item.valor_unitario),
      0
    );
  }, [ordem, produtos]);

  const subtotalServicos = useMemo(() => {
    if (ordem) return toMoney(ordem.subtotal_servicos);
    return servicos.reduce(
      (acc, item) => acc + toMoney(item.quantidade) * toMoney(item.valor_unitario),
      0
    );
  }, [ordem, servicos]);

  const desconto = toMoney(ordem?.desconto);
  const acrescimo = toMoney(ordem?.acrescimo);
  const total = useMemo(() => {
    if (ordem?.total !== undefined && ordem?.total !== null) {
      return toMoney(ordem.total);
    }
    return subtotalProdutos + subtotalServicos - desconto + acrescimo;
  }, [ordem, subtotalProdutos, subtotalServicos, desconto, acrescimo]);

  if (loading) {
    return <div style={{ padding: 24 }}>CARREGANDO...</div>;
  }

  if (!ordem) {
    return <div style={{ padding: 24 }}>OS NÃO ENCONTRADA.</div>;
  }

  return (
    <div className="print-page">
      <div className="no-print topbar">
        <button className="action-button primary" onClick={() => window.print()}>
          IMPRIMIR
        </button>
        <button className="action-button" onClick={() => window.close()}>
          FECHAR
        </button>
      </div>

      <div className="sheet">
        <header className="header">
          <div>
            <div className="empresa">{empresaNome}</div>
            <div className="subempresa">ORDEM DE SERVIÇO</div>
          </div>

          <div className="os-box">
            <div className="os-numero">OS {ordem.numero || "-"}</div>
            <div className="os-meta">
              <span>ABERTURA: {formatDateTimeBR(ordem.created_at)}</span>
            </div>
            <div className="os-meta">
              <span>STATUS: {statusLabel(ordem.status)}</span>
            </div>
            <div className="os-meta">
              <span>FATURADA: {ordem.faturado ? "SIM" : "NÃO"}</span>
            </div>
          </div>
        </header>

        <section className="block">
          <div className="block-title">DADOS DO CLIENTE</div>

          <div className="grid two">
            <div className="field">
              <div className="label">CLIENTE</div>
              <div className="value">{ordem.cliente_nome || "-"}</div>
            </div>

            <div className="field">
              <div className="label">FORMA DE PAGAMENTO</div>
              <div className="value">{ordem.forma_pagamento || "-"}</div>
            </div>
          </div>
        </section>

        <section className="block">
          <div className="block-title">DADOS DO VEÍCULO</div>

          <div className="grid four">
            <div className="field">
              <div className="label">VEÍCULO</div>
              <div className="value">{ordem.veiculo_descricao || "-"}</div>
            </div>

            <div className="field">
              <div className="label">PLACA</div>
              <div className="value">{ordem.placa || "-"}</div>
            </div>

            <div className="field">
              <div className="label">KM</div>
              <div className="value">{ordem.km || "-"}</div>
            </div>

            <div className="field">
              <div className="label">TÉCNICO</div>
              <div className="value">{ordem.tecnico_responsavel || "-"}</div>
            </div>
          </div>

          <div className="grid three mt16">
            <div className="field">
              <div className="label">PRAZO</div>
              <div className="value">{formatDateBR(ordem.prazo_data)}</div>
            </div>

            <div className="field">
              <div className="label">GARANTIA</div>
              <div className="value">
                {ordem.garantia_numero
                  ? `${ordem.garantia_numero} ${ordem.garantia_tipo || ""}`
                  : "-"}
              </div>
            </div>

            <div className="field">
              <div className="label">STATUS</div>
              <div className="value">{ordem.status || "-"}</div>
            </div>
          </div>
        </section>

        <section className="block">
          <div className="block-title">DEFEITO RELATADO</div>
          <div className="text-box">{ordem.defeito_relatado || "-"}</div>
        </section>

        <section className="block">
          <div className="block-title">PRODUTOS</div>

          <table className="table">
            <thead>
              <tr>
                <th>PRODUTO</th>
                <th>CÓDIGO</th>
                <th>QTD</th>
                <th>V. UNIT.</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {produtos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    NENHUM PRODUTO LANÇADO.
                  </td>
                </tr>
              ) : (
                produtos.map((item) => (
                  <tr key={item.id}>
                    <td>{item.produto_nome || item.nome || "-"}</td>
                    <td>{item.codigo || "-"}</td>
                    <td>{toMoney(item.quantidade)}</td>
                    <td>{moneyBR(toMoney(item.valor_unitario))}</td>
                    <td>{moneyBR(toMoney(item.subtotal))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="block">
          <div className="block-title">SERVIÇOS</div>

          <table className="table">
            <thead>
              <tr>
                <th>DESCRIÇÃO</th>
                <th>QTD</th>
                <th>V. UNIT.</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {servicos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty">
                    NENHUM SERVIÇO LANÇADO.
                  </td>
                </tr>
              ) : (
                servicos.map((item) => (
                  <tr key={item.id}>
                    <td>{item.descricao || "-"}</td>
                    <td>{toMoney(item.quantidade)}</td>
                    <td>{moneyBR(toMoney(item.valor_unitario))}</td>
                    <td>{moneyBR(toMoney(item.subtotal))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="block">
          <div className="block-title">OBSERVAÇÕES</div>
          <div className="text-box">{ordem.observacoes || "-"}</div>
        </section>

        <section className="block totals-block">
          <div className="totals">
            <div className="total-line">
              <span>SUBTOTAL PRODUTOS</span>
              <strong>{moneyBR(subtotalProdutos)}</strong>
            </div>

            <div className="total-line">
              <span>SUBTOTAL SERVIÇOS</span>
              <strong>{moneyBR(subtotalServicos)}</strong>
            </div>

            <div className="total-line">
              <span>DESCONTO</span>
              <strong>{moneyBR(desconto)}</strong>
            </div>

            <div className="total-line">
              <span>ACRÉSCIMO</span>
              <strong>{moneyBR(acrescimo)}</strong>
            </div>

            <div className="total-line grand">
              <span>TOTAL GERAL</span>
              <strong>{moneyBR(total)}</strong>
            </div>
          </div>
        </section>

        <section className="assinaturas">
          <div className="assinatura">
            <div className="linha" />
            <div className="assinatura-label">ASSINATURA DO CLIENTE</div>
          </div>

          <div className="assinatura">
            <div className="linha" />
            <div className="assinatura-label">RESPONSÁVEL / TÉCNICO</div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .print-page {
          background: #eef2f7;
          min-height: 100vh;
          padding: 24px;
          font-family: Arial, Helvetica, sans-serif;
          color: #111827;
        }

        .topbar {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-bottom: 20px;
        }

        .action-button {
          border: 1px solid #cbd5e1;
          background: white;
          color: #0f172a;
          border-radius: 10px;
          padding: 10px 18px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .action-button.primary {
          background: #0456a3;
          color: white;
          border-color: #0456a3;
        }

        .sheet {
          width: 100%;
          max-width: 1100px;
          margin: 0 auto;
          background: white;
          border-radius: 18px;
          padding: 28px;
          box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 18px;
          margin-bottom: 20px;
        }

        .empresa {
          font-size: 28px;
          font-weight: 900;
          color: #0456a3;
          line-height: 1;
        }

        .subempresa {
          margin-top: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #475569;
          letter-spacing: 0.08em;
        }

        .os-box {
          min-width: 280px;
          border: 1px solid #dbe4ee;
          border-radius: 14px;
          padding: 14px;
          background: #f8fafc;
        }

        .os-numero {
          font-size: 22px;
          font-weight: 900;
          color: #0f172a;
          margin-bottom: 8px;
        }

        .os-meta {
          font-size: 13px;
          color: #475569;
          margin-top: 4px;
        }

        .block {
          margin-top: 18px;
        }

        .block-title {
          font-size: 13px;
          font-weight: 900;
          color: #334155;
          letter-spacing: 0.08em;
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid #e2e8f0;
        }

        .grid {
          display: grid;
          gap: 12px;
        }

        .grid.two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .grid.three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .grid.four {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .field {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 12px;
          background: #fff;
        }

        .label {
          font-size: 11px;
          font-weight: 800;
          color: #64748b;
          margin-bottom: 6px;
        }

        .value {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          min-height: 18px;
        }

        .text-box {
          min-height: 80px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px;
          font-size: 14px;
          line-height: 1.5;
          background: #fff;
          white-space: pre-wrap;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #e2e8f0;
        }

        .table th {
          background: #f8fafc;
          color: #334155;
          font-size: 12px;
          font-weight: 900;
          text-align: left;
          padding: 10px;
          border-bottom: 1px solid #e2e8f0;
        }

        .table td {
          font-size: 13px;
          padding: 10px;
          border-bottom: 1px solid #eef2f7;
          vertical-align: top;
        }

        .empty {
          text-align: center;
          color: #64748b;
          padding: 18px;
        }

        .totals-block {
          display: flex;
          justify-content: flex-end;
        }

        .totals {
          width: 100%;
          max-width: 420px;
          border: 1px solid #dbe4ee;
          border-radius: 14px;
          padding: 14px;
          background: #f8fafc;
        }

        .total-line {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 9px 0;
          border-bottom: 1px solid #e2e8f0;
          font-size: 14px;
        }

        .total-line:last-child {
          border-bottom: none;
        }

        .total-line.grand {
          font-size: 18px;
          font-weight: 900;
          color: #0456a3;
        }

        .assinaturas {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 40px;
          margin-top: 50px;
          padding-top: 18px;
        }

        .assinatura {
          text-align: center;
        }

        .linha {
          border-top: 1px solid #111827;
          margin-bottom: 8px;
        }

        .assinatura-label {
          font-size: 12px;
          font-weight: 700;
          color: #475569;
        }

        .mt16 {
          margin-top: 16px;
        }

        @media (max-width: 900px) {
          .sheet {
            padding: 18px;
          }

          .header {
            flex-direction: column;
          }

          .os-box {
            min-width: 100%;
          }

          .grid.two,
          .grid.three,
          .grid.four,
          .assinaturas {
            grid-template-columns: 1fr;
          }
        }

        @media print {
          .print-page {
            background: white;
            padding: 0;
          }

          .no-print {
            display: none !important;
          }

          .sheet {
            max-width: 100%;
            box-shadow: none;
            border-radius: 0;
            padding: 0;
          }

          @page {
            size: A4;
            margin: 12mm;
          }
        }
      `}</style>
    </div>
  );
}