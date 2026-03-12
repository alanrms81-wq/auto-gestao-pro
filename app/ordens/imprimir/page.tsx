"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  empresa_id?: string;
  ordem_servico_id?: string;
  produto_id?: string | null;
  produto_nome?: string | null;
  nome?: string | null;
  codigo?: string | null;
  quantidade?: number | null;
  valor_unitario?: number | null;
  subtotal?: number | null;
};

type OsServico = {
  id?: string;
  empresa_id?: string;
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
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR");
}

function formatDateTimeBR(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString("pt-BR");
}

function ImpressaoOSContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [ordem, setOrdem] = useState<OrdemServico | null>(null);
  const [produtos, setProdutos] = useState<OsProduto[]>([]);
  const [servicos, setServicos] = useState<OsServico[]>([]);
  const [empresaNome, setEmpresaNome] = useState("");

  useEffect(() => {
    async function carregar() {
      try {
        setLoading(true);
        setErro("");

        if (!id) {
          setErro("ID DA OS NÃO INFORMADO.");
          setLoading(false);
          return;
        }

        const user = await getSessionUser();

        if (!user?.empresa_id) {
          setErro("SESSÃO INVÁLIDA.");
          setLoading(false);
          return;
        }

        setEmpresaNome(user.nome || "");

        const [{ data: osData, error: osError }, { data: prodData, error: prodError }, { data: servData, error: servError }] =
          await Promise.all([
            supabase
              .from("ordens_servico")
              .select("*")
              .eq("empresa_id", user.empresa_id)
              .eq("id", id)
              .single(),
            supabase
              .from("ordens_servico_produtos")
              .select("*")
              .eq("empresa_id", user.empresa_id)
              .eq("ordem_servico_id", id)
              .order("created_at", { ascending: true }),
            supabase
              .from("ordens_servico_servicos")
              .select("*")
              .eq("empresa_id", user.empresa_id)
              .eq("ordem_servico_id", id)
              .order("created_at", { ascending: true }),
          ]);

        if (osError || !osData) {
          setErro("OS NÃO ENCONTRADA.");
          setLoading(false);
          return;
        }

        if (prodError) {
          setErro("ERRO AO CARREGAR PRODUTOS DA OS: " + prodError.message);
          setLoading(false);
          return;
        }

        if (servError) {
          setErro("ERRO AO CARREGAR SERVIÇOS DA OS: " + servError.message);
          setLoading(false);
          return;
        }

        setOrdem(osData as OrdemServico);
        setProdutos((prodData || []) as OsProduto[]);
        setServicos((servData || []) as OsServico[]);
      } catch (e: any) {
        setErro(e?.message || "ERRO AO CARREGAR IMPRESSÃO.");
      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, [id]);

  useEffect(() => {
    if (!loading && ordem && !erro) {
      const t = setTimeout(() => {
        window.print();
      }, 500);

      return () => clearTimeout(t);
    }
  }, [loading, ordem, erro]);

  const subtotalProdutos = useMemo(() => {
    if (ordem) return toMoney(ordem.subtotal_produtos);
    return produtos.reduce((acc, item) => acc + toMoney(item.subtotal), 0);
  }, [ordem, produtos]);

  const subtotalServicos = useMemo(() => {
    if (ordem) return toMoney(ordem.subtotal_servicos);
    return servicos.reduce((acc, item) => acc + toMoney(item.subtotal), 0);
  }, [ordem, servicos]);

  const desconto = toMoney(ordem?.desconto);
  const acrescimo = toMoney(ordem?.acrescimo);
  const total = toMoney(ordem?.total);

  if (loading) {
    return <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>CARREGANDO...</div>;
  }

  if (erro || !ordem) {
    return (
      <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <h1>IMPRESSÃO OS</h1>
        <p>{erro || "OS NÃO ENCONTRADA."}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="print-actions no-print">
        <button onClick={() => window.print()}>IMPRIMIR</button>
        <button onClick={() => window.close()}>FECHAR</button>
      </div>

      <header className="header">
        <div>
          <div className="empresa">ORDEM DE SERVIÇO</div>
          <div className="empresa-sub">{empresaNome || "AUTO GESTÃO PRO"}</div>
        </div>

        <div className="header-box">
          <div><strong>NÚMERO:</strong> {ordem.numero || "-"}</div>
          <div><strong>DATA:</strong> {formatDateTimeBR(ordem.created_at)}</div>
          <div><strong>STATUS:</strong> {ordem.status || "-"}</div>
        </div>
      </header>

      <section className="card">
        <h2>DADOS DO CLIENTE</h2>
        <div className="grid">
          <div><strong>CLIENTE:</strong> {ordem.cliente_nome || "-"}</div>
          <div><strong>VEÍCULO:</strong> {ordem.veiculo_descricao || "-"}</div>
          <div><strong>PLACA:</strong> {ordem.placa || "-"}</div>
          <div><strong>KM:</strong> {ordem.km || "-"}</div>
          <div><strong>TÉCNICO:</strong> {ordem.tecnico_responsavel || "-"}</div>
          <div><strong>PRAZO:</strong> {formatDateBR(ordem.prazo_data)}</div>
          <div><strong>GARANTIA:</strong> {ordem.garantia_numero ? `${ordem.garantia_numero} ${ordem.garantia_tipo || ""}` : "-"}</div>
          <div><strong>PAGAMENTO:</strong> {ordem.forma_pagamento || "-"}</div>
        </div>
      </section>

      <section className="card">
        <h2>DEFEITO RELATADO</h2>
        <div className="bloco-texto">{ordem.defeito_relatado || "-"}</div>
      </section>

      <section className="card">
        <h2>PRODUTOS</h2>
        <table>
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
                <td colSpan={5} className="empty">SEM PRODUTOS</td>
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

      <section className="card">
        <h2>SERVIÇOS</h2>
        <table>
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
                <td colSpan={4} className="empty">SEM SERVIÇOS</td>
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

      <section className="card">
        <h2>OBSERVAÇÕES</h2>
        <div className="bloco-texto">{ordem.observacoes || "-"}</div>
      </section>

      <section className="totais">
        <div className="totais-box">
          <div className="linha-total">
            <span>SUBTOTAL PRODUTOS</span>
            <strong>{moneyBR(subtotalProdutos)}</strong>
          </div>
          <div className="linha-total">
            <span>SUBTOTAL SERVIÇOS</span>
            <strong>{moneyBR(subtotalServicos)}</strong>
          </div>
          <div className="linha-total">
            <span>DESCONTO</span>
            <strong>{moneyBR(desconto)}</strong>
          </div>
          <div className="linha-total">
            <span>ACRÉSCIMO</span>
            <strong>{moneyBR(acrescimo)}</strong>
          </div>
          <div className="linha-total final">
            <span>TOTAL GERAL</span>
            <strong>{moneyBR(total)}</strong>
          </div>
        </div>
      </section>

      <section className="assinaturas">
        <div className="assinatura">
          <div className="linha-assinatura" />
          <span>ASSINATURA DO CLIENTE</span>
        </div>
        <div className="assinatura">
          <div className="linha-assinatura" />
          <span>RESPONSÁVEL / TÉCNICO</span>
        </div>
      </section>

      <style jsx>{`
        .page {
          padding: 24px;
          font-family: Arial, sans-serif;
          color: #111827;
          background: #fff;
        }

        .print-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .print-actions button {
          border: 1px solid #d1d5db;
          background: #fff;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
        }

        .header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 2px solid #111827;
          padding-bottom: 16px;
          margin-bottom: 20px;
        }

        .empresa {
          font-size: 28px;
          font-weight: 900;
        }

        .empresa-sub {
          margin-top: 4px;
          font-size: 14px;
          color: #4b5563;
        }

        .header-box {
          text-align: right;
          font-size: 13px;
          line-height: 1.7;
        }

        .card {
          margin-bottom: 16px;
        }

        .card h2 {
          font-size: 14px;
          font-weight: 900;
          margin-bottom: 8px;
          border-bottom: 1px solid #d1d5db;
          padding-bottom: 6px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px 16px;
          font-size: 13px;
        }

        .bloco-texto {
          min-height: 60px;
          border: 1px solid #d1d5db;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          white-space: pre-wrap;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        th, td {
          border: 1px solid #d1d5db;
          padding: 8px;
          text-align: left;
          vertical-align: top;
        }

        th {
          background: #f3f4f6;
          font-weight: 900;
        }

        .empty {
          text-align: center;
          color: #6b7280;
        }

        .totais {
          display: flex;
          justify-content: flex-end;
          margin-top: 20px;
        }

        .totais-box {
          width: 360px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          padding: 12px;
        }

        .linha-total {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
          font-size: 13px;
        }

        .linha-total.final {
          font-size: 16px;
          font-weight: 900;
          border-bottom: none;
        }

        .assinaturas {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-top: 48px;
        }

        .assinatura {
          text-align: center;
          font-size: 12px;
        }

        .linha-assinatura {
          border-top: 1px solid #111827;
          margin-bottom: 8px;
          height: 24px;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          .page {
            padding: 0;
          }

          body {
            background: #fff;
          }
        }
      `}</style>
    </div>
  );
}

export default function ImprimirOSPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>CARREGANDO...</div>}>
      <ImpressaoOSContent />
    </Suspense>
  );
}