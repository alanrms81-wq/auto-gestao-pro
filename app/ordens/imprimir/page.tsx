"use client";

import { useEffect, useMemo, useState } from "react";
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
  return new Date(v).toLocaleDateString("pt-BR");
}

export default function ImprimirOSPage() {
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
      alert(osResp.error.message);
      return;
    }

    setOrdem(osResp.data);
    setProdutos(prodResp.data || []);
    setServicos(servResp.data || []);
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

  if (loading) return <div style={{ padding: 30 }}>Carregando...</div>;
  if (!ordem) return <div style={{ padding: 30 }}>OS não encontrada.</div>;

  return (
    <div className="page">
      <div className="no-print topbar">
        <button onClick={() => window.print()}>IMPRIMIR</button>
        <button onClick={() => window.close()}>FECHAR</button>
      </div>

      <div className="sheet">
        <header className="header">
          <div>
            <h1>AUTO GESTÃO PRO</h1>
            <span>ORDEM DE SERVIÇO</span>
          </div>

          <div className="osbox">
            <div className="osnum">OS {ordem.numero}</div>
            <div>DATA: {formatDate(ordem.created_at)}</div>
            <div>STATUS: {ordem.status}</div>
          </div>
        </header>

        <section className="block">
          <h2>DADOS DO CLIENTE</h2>
          <div className="grid">
            <div>
              <strong>CLIENTE</strong>
              <p>{ordem.cliente_nome}</p>
            </div>

            <div>
              <strong>FORMA PAGAMENTO</strong>
              <p>{ordem.forma_pagamento}</p>
            </div>
          </div>
        </section>

        <section className="block">
          <h2>DADOS DO VEÍCULO</h2>

          <div className="grid">
            <div>
              <strong>VEÍCULO</strong>
              <p>{ordem.veiculo_descricao}</p>
            </div>

            <div>
              <strong>PLACA</strong>
              <p>{ordem.placa}</p>
            </div>

            <div>
              <strong>KM</strong>
              <p>{ordem.km}</p>
            </div>

            <div>
              <strong>TÉCNICO</strong>
              <p>{ordem.tecnico_responsavel}</p>
            </div>
          </div>
        </section>

        <section className="block">
          <h2>DEFEITO RELATADO</h2>
          <div className="textbox">{ordem.defeito_relatado}</div>
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
              {produtos.map((p) => (
                <tr key={p.id}>
                  <td>{p.produto_nome || p.nome}</td>
                  <td>{p.codigo}</td>
                  <td>{p.quantidade}</td>
                  <td>{moneyBR(toMoney(p.valor_unitario))}</td>
                  <td>{moneyBR(toMoney(p.subtotal))}</td>
                </tr>
              ))}
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
              {servicos.map((s) => (
                <tr key={s.id}>
                  <td>{s.descricao}</td>
                  <td>{s.quantidade}</td>
                  <td>{moneyBR(toMoney(s.valor_unitario))}</td>
                  <td>{moneyBR(toMoney(s.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="totals">
          <div>PRODUTOS: {moneyBR(subtotalProdutos)}</div>
          <div>SERVIÇOS: {moneyBR(subtotalServicos)}</div>
          <div>DESCONTO: {moneyBR(toMoney(ordem.desconto))}</div>
          <div>ACRÉSCIMO: {moneyBR(toMoney(ordem.acrescimo))}</div>
          <div className="total">
            TOTAL: {moneyBR(toMoney(ordem.total))}
          </div>
        </section>

        <section className="assinaturas">
          <div>
            <div className="linha"></div>
            <span>ASSINATURA CLIENTE</span>
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
          font-family: Arial;
        }

        .sheet {
          background: white;
          padding: 30px;
          max-width: 1100px;
          margin: auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 20px;
        }

        .osnum {
          font-size: 20px;
          font-weight: bold;
        }

        .block {
          margin-top: 25px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th,
        td {
          border-bottom: 1px solid #e2e8f0;
          padding: 8px;
          font-size: 14px;
        }

        .textbox {
          border: 1px solid #e2e8f0;
          padding: 12px;
          min-height: 80px;
        }

        .totals {
          margin-top: 20px;
          font-size: 16px;
          font-weight: bold;
        }

        .assinaturas {
          display: flex;
          justify-content: space-between;
          margin-top: 60px;
        }

        .linha {
          border-top: 1px solid black;
          width: 300px;
          margin-bottom: 5px;
        }

        .topbar button {
          margin-right: 10px;
        }

        @media print {
          .no-print {
            display: none;
          }

          .page {
            padding: 0;
            background: white;
          }
        }
      `}</style>
    </div>
  );
}