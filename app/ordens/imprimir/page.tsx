"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type OrdemServico = {
  id: string;
  empresa_id: string;
  numero?: string | null;
  cliente_nome?: string | null;
  veiculo_descricao?: string | null;
  placa?: string | null;
  km?: string | null;
  tecnico_responsavel?: string | null;
  prazo_data?: string | null;
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
  created_at?: string | null;
};

type OsProduto = {
  id?: string;
  nome?: string | null;
  produto_nome?: string | null;
  codigo?: string | null;
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

function formatDate(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR");
}

function formatDateTime(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("pt-BR");
}

function ImpressaoOSContent() {
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
    return produtos.reduce(
      (acc, p) => acc + toMoney(p.quantidade) * toMoney(p.valor_unitario),
      0
    );
  }, [produtos]);

  const subtotalServicos = useMemo(() => {
    return servicos.reduce(
      (acc, s) => acc + toMoney(s.quantidade) * toMoney(s.valor_unitario),
      0
    );
  }, [servicos]);

  if (loading) return <div style={{ padding: 30 }}>CARREGANDO...</div>;
  if (!ordem) return <div style={{ padding: 30 }}>OS NÃO ENCONTRADA.</div>;

  return (
    <div className="page">
      <div className="no-print topbar">
        <button className="primary" onClick={() => window.print()}>
          IMPRIMIR
        </button>
        <button onClick={() => window.close()}>FECHAR</button>
      </div>

      <div className="sheet">
        <header className="header">
          <div>
            <h1>AUTO GESTÃO PRO</h1>
            <span>ORDEM DE SERVIÇO</span>
          </div>

          <div className="osbox">
            <div className="osnum">OS {ordem.numero || "-"}</div>
            <div>ABERTURA: {formatDateTime(ordem.created_at)}</div>
            <div>STATUS: {ordem.status || "-"}</div>
            <div>FATURADA: {ordem.faturado ? "SIM" : "NÃO"}</div>
          </div>
        </header>

        <section className="block">
          <h2>DADOS DO CLIENTE</h2>
          <div className="grid two">
            <div className="cardinfo">
              <strong>CLIENTE</strong>
              <p>{ordem.cliente_nome || "-"}</p>
            </div>

            <div className="cardinfo">
              <strong>FORMA DE PAGAMENTO</strong>
              <p>{ordem.forma_pagamento || "-"}</p>
            </div>
          </div>
        </section>

        <section className="block">
          <h2>DADOS DO VEÍCULO</h2>

          <div className="grid four">
            <div className="cardinfo">
              <strong>VEÍCULO</strong>
              <p>{ordem.veiculo_descricao || "-"}</p>
            </div>

            <div className="cardinfo">
              <strong>PLACA</strong>
              <p>{ordem.placa || "-"}</p>
            </div>

            <div className="cardinfo">
              <strong>KM</strong>
              <p>{ordem.km || "-"}</p>
            </div>

            <div className="cardinfo">
              <strong>TÉCNICO</strong>
              <p>{ordem.tecnico_responsavel || "-"}</p>
            </div>
          </div>

          <div className="grid three mt16">
            <div className="cardinfo">
              <strong>PRAZO</strong>
              <p>{formatDate(ordem.prazo_data)}</p>
            </div>

            <div className="cardinfo">
              <strong>STATUS</strong>
              <p>{ordem.status || "-"}</p>
            </div>

            <div className="cardinfo">
              <strong>TOTAL</strong>
              <p>{moneyBR(toMoney(ordem.total))}</p>
            </div>
          </div>
        </section>

        <section className="block">
          <h2>DEFEITO RELATADO</h2>
          <div className="textbox">{ordem.defeito_relatado || "-"}</div>
        </section>

        <section className="block">
          <h2>PRODUTOS</h2>

          <table>
            <thead>
              <tr>
                <th>PRODUTO</th>
                <th>CÓDIGO</th>
                <th>QTD</th>
                <th>VALOR</th>
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
                produtos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.produto_nome || p.nome || "-"}</td>
                    <td>{p.codigo || "-"}</td>
                    <td>{toMoney(p.quantidade)}</td>
                    <td>{moneyBR(toMoney(p.valor_unitario))}</td>
                    <td>{moneyBR(toMoney(p.subtotal))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="block">
          <h2>SERVIÇOS</h2>

          <table>
            <thead>
              <tr>
                <th>DESCRIÇÃO</th>
                <th>QTD</th>
                <th>VALOR</th>
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
                servicos.map((s) => (
                  <tr key={s.id}>
                    <td>{s.descricao || "-"}</td>
                    <td>{toMoney(s.quantidade)}</td>
                    <td>{moneyBR(toMoney(s.valor_unitario))}</td>
                    <td>{moneyBR(toMoney(s.subtotal))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="block">
          <h2>OBSERVAÇÕES</h2>
          <div className="textbox">{ordem.observacoes || "-"}</div>
        </section>

        <section className="totals">
          <div>PRODUTOS: {moneyBR(subtotalProdutos)}</div>
          <div>SERVIÇOS: {moneyBR(subtotalServicos)}</div>
          <div>DESCONTO: {moneyBR(toMoney(ordem.desconto))}</div>
          <div>ACRÉSCIMO: {moneyBR(toMoney(ordem.acrescimo))}</div>
          <div className="total">TOTAL: {moneyBR(toMoney(ordem.total))}</div>
        </section>

        <section className="assinaturas">
          <div>
            <div className="linha"></div>
            <span>ASSINATURA DO CLIENTE</span>
          </div>

          <div>
            <div className="linha"></div>
            <span>RESPONSÁVEL</span>
          </div>
        </section>
      </div>

      <style jsx>{`
        .page {
          background: #f1f5f9;
          padding: 30px;
          font-family: Arial, sans-serif;
          color: #0f172a;
        }

        .topbar {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 20px;
        }

        .topbar button {
          border: 1px solid #cbd5e1;
          background: white;
          border-radius: 10px;
          padding: 10px 16px;
          font-weight: 700;
          cursor: pointer;
        }

        .topbar button.primary {
          background: #0456a3;
          color: white;
          border-color: #0456a3;
        }

        .sheet {
          background: white;
          padding: 30px;
          max-width: 1100px;
          margin: auto;
          border-radius: 18px;
          box-shadow: 0 15px 40px rgba(15, 23, 42, 0.08);
        }

        .header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 20px;
        }

        .header h1 {
          margin: 0;
          font-size: 28px;
          color: #0456a3;
        }

        .header span {
          display: inline-block;
          margin-top: 8px;
          font-size: 13px;
          font-weight: 700;
          color: #475569;
          letter-spacing: 0.08em;
        }

        .osbox {
          min-width: 280px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 14px;
          background: #f8fafc;
          font-size: 13px;
          line-height: 1.7;
        }

        .osnum {
          font-size: 22px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .block {
          margin-top: 24px;
        }

        .block h2 {
          font-size: 13px;
          margin: 0 0 10px 0;
          color: #334155;
          letter-spacing: 0.08em;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 6px;
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

        .cardinfo {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px;
          background: #fff;
        }

        .cardinfo strong {
          display: block;
          font-size: 11px;
          color: #64748b;
          margin-bottom: 6px;
        }

        .cardinfo p {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
        }

        .textbox {
          border: 1px solid #e2e8f0;
          padding: 14px;
          min-height: 80px;
          border-radius: 12px;
          background: #fff;
          white-space: pre-wrap;
          font-size: 14px;
          line-height: 1.5;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #e2e8f0;
        }

        th,
        td {
          border-bottom: 1px solid #e2e8f0;
          padding: 10px;
          font-size: 13px;
          text-align: left;
        }

        th {
          background: #f8fafc;
          color: #334155;
          font-size: 12px;
        }

        .empty {
          text-align: center;
          color: #64748b;
          padding: 18px;
        }

        .totals {
          margin-top: 24px;
          margin-left: auto;
          max-width: 360px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px;
          background: #f8fafc;
          font-size: 14px;
          line-height: 1.9;
          font-weight: 700;
        }

        .totals .total {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 2px solid #cbd5e1;
          font-size: 18px;
          color: #0456a3;
        }

        .assinaturas {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 40px;
          margin-top: 60px;
        }

        .assinaturas span {
          font-size: 12px;
          font-weight: 700;
          color: #475569;
        }

        .linha {
          border-top: 1px solid #111827;
          margin-bottom: 6px;
          width: 100%;
        }

        .mt16 {
          margin-top: 16px;
        }

        @media (max-width: 900px) {
          .page {
            padding: 14px;
          }

          .sheet {
            padding: 18px;
          }

          .header {
            flex-direction: column;
          }

          .grid.two,
          .grid.three,
          .grid.four,
          .assinaturas {
            grid-template-columns: 1fr;
          }

          .osbox {
            min-width: 100%;
          }
        }

        @media print {
          .no-print {
            display: none !important;
          }

          .page {
            padding: 0;
            background: white;
          }

          .sheet {
            box-shadow: none;
            border-radius: 0;
            max-width: 100%;
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

export default function ImprimirOSPage() {
  return (
    <Suspense fallback={<div style={{ padding: 30 }}>CARREGANDO...</div>}>
      <ImpressaoOSContent />
    </Suspense>
  );
}