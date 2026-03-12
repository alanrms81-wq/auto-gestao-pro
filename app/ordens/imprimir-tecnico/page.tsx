"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

function toMoney(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatDateBR(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR");
}

function ImpressaoTecnicoContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [os, setOs] = useState<any>(null);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregar() {
      if (!id) {
        setErro("ID NÃO INFORMADO");
        setLoading(false);
        return;
      }

      const user = await getSessionUser();

      if (!user?.empresa_id) {
        setErro("SESSÃO INVÁLIDA");
        setLoading(false);
        return;
      }

      const [{ data: osData }, { data: prod }, { data: serv }] =
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
            .eq("ordem_servico_id", id),

          supabase
            .from("ordens_servico_servicos")
            .select("*")
            .eq("empresa_id", user.empresa_id)
            .eq("ordem_servico_id", id),
        ]);

      if (!osData) {
        setErro("OS NÃO ENCONTRADA");
        setLoading(false);
        return;
      }

      setOs(osData);
      setProdutos(prod || []);
      setServicos(serv || []);

      setLoading(false);
    }

    carregar();
  }, [id]);

  useEffect(() => {
    if (!loading && os) {
      setTimeout(() => window.print(), 500);
    }
  }, [loading, os]);

  if (loading) {
    return <div style={{ padding: 24 }}>CARREGANDO...</div>;
  }

  if (erro) {
    return <div style={{ padding: 24 }}>{erro}</div>;
  }

  return (
    <div className="page">

      <header className="header">
        <h1>FICHA TÉCNICA</h1>
        <div className="os">
          <strong>OS:</strong> {os.numero}
        </div>
      </header>

      <section className="info">
        <div><strong>CLIENTE:</strong> {os.cliente_nome}</div>
        <div><strong>VEÍCULO:</strong> {os.veiculo_descricao}</div>
        <div><strong>PLACA:</strong> {os.placa}</div>
        <div><strong>KM:</strong> {os.km}</div>
        <div><strong>TÉCNICO:</strong> {os.tecnico_responsavel}</div>
        <div><strong>DATA:</strong> {formatDateBR(os.created_at)}</div>
      </section>

      <section className="bloco">
        <h2>DEFEITO RELATADO</h2>
        <div className="box">{os.defeito_relatado || "-"}</div>
      </section>

      <section className="bloco">
        <h2>SERVIÇOS</h2>

        <table>
          <thead>
            <tr>
              <th>DESCRIÇÃO</th>
              <th>QTD</th>
            </tr>
          </thead>

          <tbody>
            {servicos.length === 0 ? (
              <tr>
                <td colSpan={2}>SEM SERVIÇOS</td>
              </tr>
            ) : (
              servicos.map((s) => (
                <tr key={s.id}>
                  <td>{s.descricao}</td>
                  <td>{toMoney(s.quantidade)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="bloco">
        <h2>PRODUTOS</h2>

        <table>
          <thead>
            <tr>
              <th>PRODUTO</th>
              <th>QTD</th>
            </tr>
          </thead>

          <tbody>
            {produtos.length === 0 ? (
              <tr>
                <td colSpan={2}>SEM PRODUTOS</td>
              </tr>
            ) : (
              produtos.map((p) => (
                <tr key={p.id}>
                  <td>{p.produto_nome || p.nome}</td>
                  <td>{toMoney(p.quantidade)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="bloco">
        <h2>DIAGNÓSTICO / PROCEDIMENTO</h2>
        <div className="box grande"></div>
      </section>

      <section className="assinaturas">
        <div>
          <div className="linha"></div>
          <span>TÉCNICO</span>
        </div>

        <div>
          <div className="linha"></div>
          <span>RESPONSÁVEL</span>
        </div>
      </section>

      <style jsx>{`
        .page{
          padding:24px;
          font-family:Arial;
        }

        .header{
          display:flex;
          justify-content:space-between;
          border-bottom:2px solid black;
          padding-bottom:10px;
          margin-bottom:20px;
        }

        .info{
          display:grid;
          grid-template-columns:repeat(2,1fr);
          gap:6px;
          margin-bottom:20px;
        }

        .bloco{
          margin-bottom:20px;
        }

        h2{
          font-size:14px;
          border-bottom:1px solid #ccc;
          padding-bottom:4px;
          margin-bottom:8px;
        }

        .box{
          border:1px solid #ccc;
          padding:10px;
          min-height:60px;
        }

        .box.grande{
          min-height:120px;
        }

        table{
          width:100%;
          border-collapse:collapse;
        }

        th,td{
          border:1px solid #ccc;
          padding:6px;
          font-size:12px;
        }

        .assinaturas{
          margin-top:60px;
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:40px;
          text-align:center;
        }

        .linha{
          border-top:1px solid black;
          height:20px;
          margin-bottom:5px;
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