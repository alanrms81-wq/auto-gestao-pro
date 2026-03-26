"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [ordem, setOrdem] = useState<OrdemServico | null>(null);
  const [produtos, setProdutos] = useState<OsProduto[]>([]);
  const [servicos, setServicos] = useState<OsServico[]>([]);

  useEffect(() => {
    async function init() {
      if (!id) {
        setLoading(false);
        return;
      }

      await carregarOS(id);
    }

    init();
  }, [id]);

  async function carregarOS(ordemId: string) {
    setLoading(true);

    const [osResp, prodResp, servResp] = await Promise.all([
      supabase
        .from("ordens_servico")
        .select("*")
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
      <div className="no-print toolbar">
        <button className="primary" onClick={() => window.print()}>
          IMPRIMIR
        </button>
        <button onClick={() => window.close()}>FECHAR</button>
      </div>

      <div className="sheet print-container">
        <header className="hero no-break">
          <div className="hero-left">
            <div className="brand-kicker">AUTO GESTÃO PRO</div>
            <h1>FICHA TÉCNICA DE EXECUÇÃO</h1>
            <p>Documento interno para oficina, técnico e conferência final.</p>
          </div>

          <div className="hero-box">
            <div className="hero-number">OS {ordem.numero || "-"}</div>
            <div><strong>ABERTURA:</strong> {formatDateTime(ordem.created_at)}</div>
            <div><strong>STATUS:</strong> {ordem.status || "-"}</div>
            <div><strong>PRAZO:</strong> {formatDate(ordem.prazo_data)}</div>
          </div>
        </header>

        <section className="block no-break">
          <div className="section-head">
            <h2>DADOS PRINCIPAIS</h2>
          </div>

          <div className="grid four">
            <div className="info-card">
              <strong>CLIENTE</strong>
              <p>{ordem.cliente_nome || "-"}</p>
            </div>

            <div className="info-card">
              <strong>VEÍCULO</strong>
              <p>{ordem.veiculo_descricao || "-"}</p>
            </div>

            <div className="info-card">
              <strong>PLACA</strong>
              <p>{ordem.placa || "-"}</p>
            </div>

            <div className="info-card">
              <strong>KM</strong>
              <p>{ordem.km || "-"}</p>
            </div>
          </div>

          <div className="grid three mt10">
            <div className="info-card">
              <strong>TÉCNICO</strong>
              <p>{ordem.tecnico_responsavel || "-"}</p>
            </div>

            <div className="info-card">
              <strong>PRAZO</strong>
              <p>{formatDate(ordem.prazo_data)}</p>
            </div>

            <div className="info-card">
              <strong>STATUS</strong>
              <p>{ordem.status || "-"}</p>
            </div>
          </div>
        </section>

        <section className="block no-break">
          <div className="section-head">
            <h2>RELATO DO CLIENTE / DEFEITO INFORMADO</h2>
          </div>
          <div className="textbox">{ordem.defeito_relatado || "-"}</div>
        </section>

        <section className="block no-break">
          <div className="section-head">
            <h2>PEÇAS / PRODUTOS PARA EXECUÇÃO</h2>
          </div>

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
                    <td className="check-cell">[ &nbsp; ]</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="block no-break">
          <div className="section-head">
            <h2>SERVIÇOS A EXECUTAR</h2>
          </div>

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
                    <td className="check-cell">[ &nbsp; ]</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="block no-break">
          <div className="section-head">
            <h2>OBSERVAÇÕES TÉCNICAS</h2>
          </div>
          <div className="textbox note-box">
            {ordem.observacoes || ""}
            <div className="write-line"></div>
            <div className="write-line"></div>
            <div className="write-line"></div>
            <div className="write-line"></div>
            <div className="write-line"></div>
          </div>
        </section>

        <section className="checklist no-break">
          <div className="section-head">
            <h2>CHECKLIST FINAL</h2>
          </div>

          <div className="checklist-grid">
            <div>[ &nbsp; ] SERVIÇO EXECUTADO</div>
            <div>[ &nbsp; ] PEÇAS CONFERIDAS</div>
            <div>[ &nbsp; ] TESTE REALIZADO</div>
            <div>[ &nbsp; ] VEÍCULO LIBERADO</div>
          </div>
        </section>

        <section className="signatures no-break">
          <div className="signature-item">
            <div className="line"></div>
            <span>ASSINATURA DO TÉCNICO</span>
          </div>

          <div className="signature-item">
            <div className="line"></div>
            <span>RESPONSÁVEL / CONFERENTE</span>
          </div>
        </section>
      </div>

      <style jsx>{`
        .page {
          background: #eef3f8;
          padding: 20px;
          font-family: Arial, sans-serif;
          color: #0f172a;
        }

        .toolbar {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 14px;
        }

        .toolbar button {
          border: 1px solid #cbd5e1;
          background: white;
          border-radius: 12px;
          padding: 10px 16px;
          font-weight: 800;
          cursor: pointer;
        }

        .toolbar button.primary {
          background: #0456a3;
          color: white;
          border-color: #0456a3;
        }

        .sheet {
          background: white;
          padding: 22px;
          max-width: 1050px;
          margin: auto;
          border-radius: 20px;
          box-shadow: 0 15px 40px rgba(15, 23, 42, 0.08);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          padding: 0 0 14px 0;
          border-bottom: 2px solid #dbe5ef;
        }

        .hero-left h1 {
          margin: 6px 0 0 0;
          font-size: 28px;
          color: #0456a3;
          line-height: 1;
        }

        .hero-left p {
          margin: 10px 0 0 0;
          font-size: 13px;
          color: #475569;
        }

        .brand-kicker {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.16em;
          color: #64748b;
        }

        .hero-box {
          min-width: 290px;
          border-radius: 14px;
          background: linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%);
          border: 1px solid #dbe5ef;
          padding: 12px 14px;
          font-size: 12px;
          line-height: 1.6;
        }

        .hero-number {
          font-size: 22px;
          font-weight: 900;
          color: #0456a3;
          margin-bottom: 4px;
        }

        .block,
        .checklist {
          margin-top: 16px;
        }

        .section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .section-head h2 {
          margin: 0;
          font-size: 12px;
          color: #334155;
          letter-spacing: 0.08em;
        }

        .grid {
          display: grid;
          gap: 10px;
        }

        .grid.three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .grid.four {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .mt10 {
          margin-top: 10px;
        }

        .info-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 12px;
          background: #fff;
          min-height: 58px;
        }

        .info-card strong {
          display: block;
          font-size: 10px;
          color: #64748b;
          margin-bottom: 5px;
        }

        .info-card p {
          margin: 0;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.3;
        }

        .textbox {
          border: 1px solid #e2e8f0;
          padding: 12px 14px;
          min-height: 58px;
          border-radius: 12px;
          background: #fff;
          white-space: pre-wrap;
          font-size: 12px;
          line-height: 1.4;
        }

        .note-box {
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
          border-radius: 12px;
          overflow: hidden;
        }

        th,
        td {
          border-bottom: 1px solid #e2e8f0;
          padding: 8px 9px;
          font-size: 12px;
          text-align: left;
          line-height: 1.25;
        }

        th {
          background: #f8fafc;
          color: #334155;
          font-size: 11px;
        }

        .check-cell {
          text-align: center;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .empty {
          text-align: center;
          color: #64748b;
          padding: 14px;
        }

        .checklist-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px 18px;
          border: 1px solid #dbe5ef;
          border-radius: 14px;
          background: linear-gradient(180deg, #fbfdff 0%, #f4f8fc 100%);
          padding: 14px;
          font-size: 12px;
          font-weight: 800;
        }

        .signatures {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 34px;
          margin-top: 30px;
        }

        .signature-item span {
          font-size: 11px;
          font-weight: 800;
          color: #475569;
        }

        .line {
          border-top: 1px solid #111827;
          margin-bottom: 6px;
          width: 100%;
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

          .hero {
            flex-direction: column;
          }

          .grid.three,
          .grid.four,
          .signatures,
          .checklist-grid {
            grid-template-columns: 1fr;
          }

          .hero-box {
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

          .hero {
            padding-bottom: 8px;
          }

          .hero-left h1 {
            font-size: 21px;
          }

          .hero-left p {
            font-size: 10px;
            margin-top: 5px;
          }

          .brand-kicker {
            font-size: 9px;
          }

          .hero-box {
            font-size: 9.5px;
            padding: 8px 9px;
            line-height: 1.35;
          }

          .hero-number {
            font-size: 16px;
            margin-bottom: 2px;
          }

          .block,
          .checklist {
            margin-top: 9px;
          }

          .section-head h2 {
            font-size: 10px;
          }

          .grid {
            gap: 5px;
          }

          .info-card {
            padding: 6px 8px;
            min-height: auto;
          }

          .info-card strong {
            font-size: 8px;
            margin-bottom: 2px;
          }

          .info-card p {
            font-size: 9px;
            line-height: 1.15;
          }

          .textbox {
            padding: 7px 8px;
            min-height: 34px;
            font-size: 9px;
            line-height: 1.2;
          }

          .note-box {
            min-height: 82px;
          }

          .write-line {
            height: 14px;
            margin-top: 2px;
          }

          th,
          td {
            padding: 4px 5px;
            font-size: 8.8px;
            line-height: 1.1;
          }

          th {
            font-size: 8.2px;
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

          .signatures {
            margin-top: 22px;
            gap: 18px;
          }

          .signature-item span {
            font-size: 8.5px;
          }

          .line {
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