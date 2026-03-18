"use client";

import { Suspense, useEffect, useState } from "react";
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
  created_at?: string | null;
};

type OsProduto = {
  id?: string;
  nome?: string | null;
  produto_nome?: string | null;
  codigo?: string | null;
  quantidade?: number | null;
};

type OsServico = {
  id?: string;
  descricao?: string | null;
  quantidade?: number | null;
};

function toMoney(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

function ImpressaoTecnicoContent() {
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
            <span>FICHA TÉCNICA DE EXECUÇÃO</span>
          </div>

          <div className="osbox">
            <div className="osnum">OS {ordem.numero || "-"}</div>
            <div>ABERTURA: {formatDateTime(ordem.created_at)}</div>
            <div>STATUS: {ordem.status || "-"}</div>
            <div>PRAZO: {formatDate(ordem.prazo_data)}</div>
          </div>
        </header>

        <section className="block compact-block no-break">
          <h2>DADOS PRINCIPAIS</h2>

          <div className="grid four compact-grid">
            <div className="cardinfo">
              <strong>CLIENTE</strong>
              <p>{ordem.cliente_nome || "-"}</p>
            </div>

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
          </div>

          <div className="grid three compact-grid mt8">
            <div className="cardinfo">
              <strong>TÉCNICO</strong>
              <p>{ordem.tecnico_responsavel || "-"}</p>
            </div>

            <div className="cardinfo">
              <strong>PRAZO</strong>
              <p>{formatDate(ordem.prazo_data)}</p>
            </div>

            <div className="cardinfo">
              <strong>STATUS</strong>
              <p>{ordem.status || "-"}</p>
            </div>
          </div>
        </section>

        <section className="block compact-block no-break">
          <h2>RELATO DO CLIENTE / DEFEITO INFORMADO</h2>
          <div className="textbox compact-text">{ordem.defeito_relatado || "-"}</div>
        </section>

        <section className="block compact-block no-break">
          <h2>PEÇAS / PRODUTOS PARA EXECUÇÃO</h2>

          <table>
            <thead>
              <tr>
                <th>PRODUTO</th>
                <th>CÓDIGO</th>
                <th>QTD</th>
                <th>CONFERIDO</th>
              </tr>
            </thead>

            <tbody>
              {produtos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty">
                    NENHUM PRODUTO LANÇADO.
                  </td>
                </tr>
              ) : (
                produtos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.produto_nome || p.nome || "-"}</td>
                    <td>{p.codigo || "-"}</td>
                    <td>{toMoney(p.quantidade)}</td>
                    <td className="checkbox-cell">[ &nbsp; ]</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="block compact-block no-break">
          <h2>SERVIÇOS A EXECUTAR</h2>

          <table>
            <thead>
              <tr>
                <th>DESCRIÇÃO</th>
                <th>QTD</th>
                <th>EXECUTADO</th>
              </tr>
            </thead>

            <tbody>
              {servicos.length === 0 ? (
                <tr>
                  <td colSpan={3} className="empty">
                    NENHUM SERVIÇO LANÇADO.
                  </td>
                </tr>
              ) : (
                servicos.map((s) => (
                  <tr key={s.id}>
                    <td>{s.descricao || "-"}</td>
                    <td>{toMoney(s.quantidade)}</td>
                    <td className="checkbox-cell">[ &nbsp; ]</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="block compact-block no-break">
          <h2>OBSERVAÇÕES TÉCNICAS</h2>
          <div className="textbox note-lines">
            {ordem.observacoes || ""}
            <div className="write-line"></div>
            <div className="write-line"></div>
            <div className="write-line"></div>
            <div className="write-line"></div>
            <div className="write-line"></div>
          </div>
        </section>

        <section className="block compact-block no-break">
          <h2>CHECKLIST FINAL</h2>

          <div className="checklist-grid">
            <div>[ &nbsp; ] SERVIÇO EXECUTADO</div>
            <div>[ &nbsp; ] PEÇAS CONFERIDAS</div>
            <div>[ &nbsp; ] TESTE REALIZADO</div>
            <div>[ &nbsp; ] VEÍCULO LIBERADO</div>
          </div>
        </section>

        <section className="assinaturas no-break">
          <div>
            <div className="linha"></div>
            <span>ASSINATURA DO TÉCNICO</span>
          </div>

          <div>
            <div className="linha"></div>
            <span>RESPONSÁVEL / CONFERENTE</span>
          </div>
        </section>
      </div>

      <style jsx>{`
        .page {
          background: #f1f5f9;
          padding: 20px;
          font-family: Arial, sans-serif;
          color: #0f172a;
        }

        .topbar {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 14px;
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
          padding: 18px;
          max-width: 1050px;
          margin: auto;
          border-radius: 18px;
          box-shadow: 0 15px 40px rgba(15, 23, 42, 0.08);
        }

        .header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 12px;
        }

        .header h1 {
          margin: 0;
          font-size: 24px;
          color: #0456a3;
          line-height: 1.1;
        }

        .header span {
          display: inline-block;
          margin-top: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          letter-spacing: 0.08em;
        }

        .osbox {
          min-width: 250px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 12px;
          background: #f8fafc;
          font-size: 12px;
          line-height: 1.5;
        }

        .osnum {
          font-size: 18px;
          font-weight: 900;
          margin-bottom: 4px;
        }

        .block {
          margin-top: 14px;
        }

        .compact-block {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .block h2 {
          font-size: 12px;
          margin: 0 0 8px 0;
          color: #334155;
          letter-spacing: 0.08em;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 4px;
        }

        .grid {
          display: grid;
          gap: 8px;
        }

        .grid.three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .grid.four {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .compact-grid {
          gap: 8px;
        }

        .cardinfo {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 10px;
          background: #fff;
          min-height: 52px;
        }

        .cardinfo strong {
          display: block;
          font-size: 10px;
          color: #64748b;
          margin-bottom: 4px;
        }

        .cardinfo p {
          margin: 0;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.25;
        }

        .textbox {
          border: 1px solid #e2e8f0;
          padding: 10px 12px;
          min-height: 54px;
          border-radius: 10px;
          background: #fff;
          white-space: pre-wrap;
          font-size: 12px;
          line-height: 1.35;
        }

        .compact-text {
          min-height: 52px;
        }

        .note-lines {
          min-height: 120px;
        }

        .write-line {
          border-bottom: 1px solid #cbd5e1;
          height: 20px;
          margin-top: 4px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #e2e8f0;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        th,
        td {
          border-bottom: 1px solid #e2e8f0;
          padding: 7px 8px;
          font-size: 12px;
          text-align: left;
          line-height: 1.2;
        }

        th {
          background: #f8fafc;
          color: #334155;
          font-size: 11px;
        }

        .checkbox-cell {
          text-align: center;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .empty {
          text-align: center;
          color: #64748b;
          padding: 12px;
        }

        .checklist-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px 18px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #f8fafc;
          padding: 12px;
          font-size: 12px;
          font-weight: 700;
        }

        .assinaturas {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 28px;
          margin-top: 24px;
        }

        .assinaturas span {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
        }

        .linha {
          border-top: 1px solid #111827;
          margin-bottom: 5px;
          width: 100%;
        }

        .mt8 {
          margin-top: 8px;
        }

        .no-break {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        @media (max-width: 900px) {
          .page {
            padding: 12px;
          }

          .sheet {
            padding: 14px;
          }

          .header {
            flex-direction: column;
          }

          .grid.three,
          .grid.four,
          .assinaturas,
          .checklist-grid {
            grid-template-columns: 1fr;
          }

          .osbox {
            min-width: 100%;
          }
        }

        @media print {
          @page {
            size: A4;
            margin: 8mm;
          }

          body {
            margin: 0;
            padding: 0;
            background: white;
          }

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

          .print-container {
            width: 100%;
            font-size: 10.5px;
            line-height: 1.15;
          }

          .header {
            padding-bottom: 8px;
            margin-bottom: 0;
          }

          .header h1 {
            font-size: 19px;
          }

          .header span {
            font-size: 10px;
            margin-top: 3px;
          }

          .osbox {
            font-size: 10px;
            padding: 7px 9px;
            line-height: 1.35;
          }

          .osnum {
            font-size: 15px;
            margin-bottom: 2px;
          }

          .block {
            margin-top: 9px;
          }

          .block h2 {
            font-size: 10px;
            margin-bottom: 4px;
            padding-bottom: 3px;
          }

          .grid,
          .compact-grid {
            gap: 5px;
          }

          .cardinfo {
            padding: 6px 8px;
            min-height: auto;
          }

          .cardinfo strong {
            font-size: 8.5px;
            margin-bottom: 2px;
          }

          .cardinfo p {
            font-size: 10px;
            line-height: 1.15;
          }

          .textbox {
            padding: 7px 8px;
            min-height: 34px;
            font-size: 10px;
            line-height: 1.2;
          }

          .note-lines {
            min-height: 80px;
          }

          .write-line {
            height: 14px;
            margin-top: 2px;
          }

          table {
            font-size: 9.5px;
          }

          th,
          td {
            padding: 4px 5px;
            font-size: 9px;
            line-height: 1.1;
          }

          th {
            font-size: 8.5px;
          }

          .empty {
            padding: 8px;
            font-size: 9px;
          }

          .checklist-grid {
            padding: 8px;
            gap: 4px 10px;
            font-size: 9px;
          }

          .assinaturas {
            margin-top: 18px;
            gap: 18px;
          }

          .assinaturas span {
            font-size: 9px;
          }

          .linha {
            margin-bottom: 4px;
          }
        }
      `}</style>
    </div>
  );
}

export default function ImprimirTecnicoPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>CARREGANDO...</div>}>
      <ImpressaoTecnicoContent />
    </Suspense>
  );
}