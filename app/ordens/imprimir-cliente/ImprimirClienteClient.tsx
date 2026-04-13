"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type OrdemServico = {
  id: string;
  numero?: string | null;
  cliente_nome?: string | null;
  cliente_telefone?: string | null;
  veiculo_descricao?: string | null;
  placa?: string | null;
  km?: string | null;
  tecnico_responsavel?: string | null;
  prazo_data?: string | null;
  status?: string | null;
  faturado?: boolean | null;
  forma_pagamento?: string | null;
  observacoes?: string | null;
  defeito_relatado?: string | null;
  created_at?: string | null;
  subtotal?: number | null;
  desconto?: number | null;
  total?: number | null;
};

type OsProduto = {
  id: string;
  ordem_servico_id?: string;
  produto_id?: string | null;
  produto_nome?: string | null;
  codigo?: string | null;
  quantidade?: number | null;
  valor_unitario?: number | null;
  total?: number | null;
  tipo_produto?: string | null;
  unidade_medida?: string | null;
};

type OsServico = {
  id: string;
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

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString("pt-BR");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR");
}

export default function ImprimirClienteClient({ id }: { id: string }) {
  const router = useRouter();

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
        .from("ordens_servico_itens")
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

  const subtotalProdutos = useMemo(
    () => produtos.reduce((acc, p) => acc + toMoney(p.total), 0),
    [produtos]
  );

  const subtotalServicos = useMemo(
    () =>
      servicos.reduce(
        (acc, s) =>
          acc + (toMoney(s.subtotal) || toMoney(s.quantidade) * toMoney(s.valor_unitario)),
        0
      ),
    [servicos]
  );

  if (loading) return <div style={{ padding: 24 }}>CARREGANDO...</div>;
  if (!ordem) return <div style={{ padding: 24 }}>OS NÃO ENCONTRADA.</div>;

  return (
    <div className="page">
      <div className="no-print topbar">
        <button className="primary" onClick={() => window.print()}>
          IMPRIMIR
        </button>
        <button onClick={() => window.close()}>FECHAR</button>
      </div>

      <div className="sheet print-container">
        <header className="header compact-block no-break">
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

        <section className="block compact-block no-break">
          <h2>DADOS PRINCIPAIS</h2>
          <div className="grid four compact-grid">
            <div className="cardinfo"><strong>CLIENTE</strong><p>{ordem.cliente_nome || "-"}</p></div>
            <div className="cardinfo"><strong>VEÍCULO</strong><p>{ordem.veiculo_descricao || "-"}</p></div>
            <div className="cardinfo"><strong>PLACA</strong><p>{ordem.placa || "-"}</p></div>
            <div className="cardinfo"><strong>KM</strong><p>{ordem.km || "-"}</p></div>
          </div>

          <div className="grid four compact-grid mt8">
            <div className="cardinfo"><strong>TÉCNICO</strong><p>{ordem.tecnico_responsavel || "-"}</p></div>
            <div className="cardinfo"><strong>PRAZO</strong><p>{formatDate(ordem.prazo_data)}</p></div>
            <div className="cardinfo"><strong>PAGAMENTO</strong><p>{ordem.forma_pagamento || "-"}</p></div>
            <div className="cardinfo"><strong>STATUS</strong><p>{ordem.status || "-"}</p></div>
          </div>
        </section>

        <section className="block compact-block no-break">
          <h2>DEFEITO RELATADO</h2>
          <div className="textbox compact-text">
            {ordem.defeito_relatado || ordem.observacoes || "-"}
          </div>
        </section>

        <section className="block compact-block no-break">
          <h2>PRODUTOS UTILIZADOS</h2>
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
                <tr><td colSpan={5} className="empty">NENHUM PRODUTO INFORMADO</td></tr>
              ) : (
                produtos.map((p, idx) => (
                  <tr key={p.id || String(idx)}>
                    <td>{p.produto_nome || "-"}</td>
                    <td>{p.codigo || "-"}</td>
                    <td>{Number(p.quantidade || 0).toLocaleString("pt-BR")}</td>
                    <td>{moneyBR(toMoney(p.valor_unitario))}</td>
                    <td>{moneyBR(toMoney(p.total))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="block compact-block no-break">
          <h2>SERVIÇOS EXECUTADOS</h2>
          <table>
            <thead>
              <tr>
                <th>SERVIÇO</th>
                <th>QTD</th>
                <th>VALOR</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {servicos.length === 0 ? (
                <tr><td colSpan={4} className="empty">NENHUM SERVIÇO INFORMADO</td></tr>
              ) : (
                servicos.map((s, idx) => (
                  <tr key={s.id || String(idx)}>
                    <td>{s.descricao || "-"}</td>
                    <td>{Number(s.quantidade || 0).toLocaleString("pt-BR")}</td>
                    <td>{moneyBR(toMoney(s.valor_unitario))}</td>
                    <td>{moneyBR(toMoney(s.subtotal) || toMoney(s.quantidade) * toMoney(s.valor_unitario))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="block compact-block no-break">
          <h2>RESUMO FINANCEIRO</h2>
          <div className="grid three compact-grid">
            <div className="cardinfo"><strong>PRODUTOS</strong><p>{moneyBR(subtotalProdutos)}</p></div>
            <div className="cardinfo"><strong>SERVIÇOS</strong><p>{moneyBR(subtotalServicos)}</p></div>
            <div className="cardinfo"><strong>TOTAL</strong><p>{moneyBR(toMoney(ordem.total) || subtotalProdutos + subtotalServicos)}</p></div>
          </div>
        </section>

        <section className="block compact-block no-break">
          <h2>OBSERVAÇÕES</h2>
          <div className="textbox">{ordem.observacoes || "-"}</div>
        </section>

        <section className="signatures no-break">
          <div className="signbox"><span>ASSINATURA DO CLIENTE</span></div>
          <div className="signbox"><span>RESPONSÁVEL PELA EMPRESA</span></div>
        </section>
      </div>

      <style jsx>{`
        .page { background: #f3f4f6; min-height: 100vh; padding: 24px; }
        .topbar { display: flex; gap: 12px; margin-bottom: 16px; }
        .topbar button { border: 1px solid #d1d5db; background: white; color: #111827; border-radius: 10px; padding: 10px 14px; font-weight: 700; cursor: pointer; }
        .topbar .primary { background: #0456a3; border-color: #0456a3; color: white; }
        .sheet { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 14mm 12mm; color: #111827; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12); }
        .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #111827; padding-bottom: 10px; }
        .header h1 { font-size: 24px; line-height: 1; margin: 0; }
        .header span { display: block; margin-top: 6px; font-size: 12px; font-weight: 700; }
        .osbox { text-align: right; font-size: 12px; line-height: 1.5; }
        .osnum { font-size: 20px; font-weight: 900; }
        .block { margin-top: 12px; border: 1px solid #d1d5db; border-radius: 12px; padding: 10px; }
        .block h2 { margin: 0 0 8px 0; font-size: 13px; font-weight: 900; letter-spacing: 0.04em; }
        .grid { display: grid; gap: 8px; }
        .grid.four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .cardinfo { border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px; min-height: 58px; }
        .cardinfo strong { display: block; font-size: 10px; margin-bottom: 4px; }
        .cardinfo p { margin: 0; font-size: 12px; font-weight: 600; word-break: break-word; }
        .textbox { border: 1px dashed #cbd5e1; border-radius: 10px; padding: 10px; min-height: 58px; font-size: 12px; line-height: 1.5; white-space: pre-wrap; }
        .compact-text { min-height: 52px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #d1d5db; padding: 7px 8px; font-size: 11px; text-align: left; }
        th { background: #f9fafb; font-weight: 900; }
        .empty { text-align: center; color: #6b7280; padding: 12px; }
        .signatures { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .signbox { height: 90px; border-bottom: 2px solid #111827; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 6px; }
        .signbox span { font-size: 11px; font-weight: 700; }
        .mt8 { margin-top: 8px; }
        .compact-block { break-inside: avoid; page-break-inside: avoid; }
        .no-break { break-inside: avoid; page-break-inside: avoid; }
        @media print {
          .page { background: white; padding: 0; }
          .no-print { display: none !important; }
          .sheet { width: 100%; min-height: auto; margin: 0; box-shadow: none; padding: 8mm; }
        }
      `}</style>
    </div>
  );
}