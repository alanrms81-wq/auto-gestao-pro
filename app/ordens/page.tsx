"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Produto = {
  id: string;
  nome: string;
  codigo_sku: string;
  preco_balcao: number | null;
};

type Servico = {
  id: string;
  nome: string;
  valor: number | null;
};

type ProdutoOS = {
  id: string;
  nome: string;
  codigo: string;
  quantidade: number;
  valor: number;
};

type ServicoOS = {
  id: string;
  descricao: string;
  quantidade: number;
  valor: number;
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function moneyBR(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function OrdensPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);

  const [buscaProduto, setBuscaProduto] = useState("");
  const [buscaServico, setBuscaServico] = useState("");

  const [produtosOS, setProdutosOS] = useState<ProdutoOS[]>([]);
  const [servicosOS, setServicosOS] = useState<ServicoOS[]>([]);

  useEffect(() => {
    carregarBase();
  }, []);

  async function carregarBase() {
    const { data: produtosData } = await supabase
      .from("produtos")
      .select("id,nome,codigo_sku,preco_balcao")
      .order("nome");

    const { data: servicosData } = await supabase
      .from("servicos")
      .select("id,nome,valor")
      .order("nome");

    setProdutos((produtosData || []) as Produto[]);
    setServicos((servicosData || []) as Servico[]);
  }

  const produtosFiltrados = useMemo(() => {
    const q = buscaProduto.trim().toLowerCase();
    if (q.length < 2) return [];

    return produtos
      .filter(
        (p) =>
          (p.nome || "").toLowerCase().includes(q) ||
          (p.codigo_sku || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [buscaProduto, produtos]);

  const servicosFiltrados = useMemo(() => {
    const q = buscaServico.trim().toLowerCase();
    if (q.length < 2) return [];

    return servicos
      .filter((s) => (s.nome || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [buscaServico, servicos]);

  function adicionarProduto(p: Produto) {
    setProdutosOS((prev) => [
      ...prev,
      {
        id: makeId(),
        nome: p.nome || "",
        codigo: p.codigo_sku || "",
        quantidade: 1,
        valor: Number(p.preco_balcao || 0),
      },
    ]);

    setBuscaProduto("");
  }

  function adicionarServico(s: Servico) {
    setServicosOS((prev) => [
      ...prev,
      {
        id: makeId(),
        descricao: s.nome || "",
        quantidade: 1,
        valor: Number(s.valor || 0),
      },
    ]);

    setBuscaServico("");
  }

  function atualizarProduto(id: string, campo: "quantidade" | "valor", valor: number) {
    setProdutosOS((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [campo]: Number.isFinite(valor) ? valor : 0 } : item
      )
    );
  }

  function atualizarServico(id: string, campo: "quantidade" | "valor", valor: number) {
    setServicosOS((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [campo]: Number.isFinite(valor) ? valor : 0 } : item
      )
    );
  }

  function removerProduto(id: string) {
    setProdutosOS((prev) => prev.filter((item) => item.id !== id));
  }

  function removerServico(id: string) {
    setServicosOS((prev) => prev.filter((item) => item.id !== id));
  }

  const totalProdutos = produtosOS.reduce(
    (acc, item) => acc + item.quantidade * item.valor,
    0
  );

  const totalServicos = servicosOS.reduce(
    (acc, item) => acc + item.quantidade * item.valor,
    0
  );

  const totalGeral = totalProdutos + totalServicos;

  return (
    <div className="min-h-screen flex bg-[#F3F4F6]">
      <Sidebar />

      <main className="flex-1 min-w-0 p-3 md:p-6 space-y-6">
        <section className="card">
          <div className="flex justify-between items-center mb-3 gap-3 flex-wrap">
            <h2 className="titulo">PRODUTOS</h2>
            <span className="texto-ajuda">DIGITE 3 LETRAS PARA BUSCAR</span>
          </div>

          <div className="relative mb-4">
            <input
              placeholder="BUSCAR PRODUTO POR NOME OU CÓDIGO..."
              className="campo"
              value={buscaProduto}
              onChange={(e) => setBuscaProduto(e.target.value)}
            />

            {produtosFiltrados.length > 0 && (
              <div className="lista-busca">
                {produtosFiltrados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => adicionarProduto(p)}
                    className="item-busca"
                  >
                    <div className="item-busca-titulo">{p.nome}</div>
                    <div className="item-busca-sub">
                      {p.codigo_sku || "-"} • {moneyBR(Number(p.preco_balcao || 0))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <table className="tabela">
            <thead>
              <tr>
                <th>PRODUTO</th>
                <th>CÓDIGO</th>
                <th>QTD</th>
                <th>V. UNIT.</th>
                <th>TOTAL</th>
                <th>AÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {produtosOS.length === 0 ? (
                <tr>
                  <td colSpan={6} className="vazio">
                    NENHUM PRODUTO ADICIONADO.
                  </td>
                </tr>
              ) : (
                produtosOS.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td>{p.codigo}</td>
                    <td>
                      <input
                        type="number"
                        className="campo-tabela"
                        value={p.quantidade}
                        onChange={(e) =>
                          atualizarProduto(p.id, "quantidade", Number(e.target.value))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="campo-tabela"
                        value={p.valor}
                        onChange={(e) =>
                          atualizarProduto(p.id, "valor", Number(e.target.value))
                        }
                      />
                    </td>
                    <td>{moneyBR(p.quantidade * p.valor)}</td>
                    <td>
                      <button
                        type="button"
                        className="botao-mini"
                        onClick={() => removerProduto(p.id)}
                      >
                        REMOVER
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="card">
          <div className="flex justify-between items-center mb-3 gap-3 flex-wrap">
            <h2 className="titulo">MÃO DE OBRA / SERVIÇOS</h2>
          </div>

          <div className="relative mb-4">
            <input
              placeholder="BUSCAR SERVIÇO..."
              className="campo"
              value={buscaServico}
              onChange={(e) => setBuscaServico(e.target.value)}
            />

            {servicosFiltrados.length > 0 && (
              <div className="lista-busca">
                {servicosFiltrados.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => adicionarServico(s)}
                    className="item-busca"
                  >
                    <div className="item-busca-titulo">{s.nome}</div>
                    <div className="item-busca-sub">
                      {moneyBR(Number(s.valor || 0))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <table className="tabela">
            <thead>
              <tr>
                <th>DESCRIÇÃO</th>
                <th>QTD</th>
                <th>V. UNIT.</th>
                <th>TOTAL</th>
                <th>AÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {servicosOS.length === 0 ? (
                <tr>
                  <td colSpan={5} className="vazio">
                    NENHUM SERVIÇO ADICIONADO.
                  </td>
                </tr>
              ) : (
                servicosOS.map((s) => (
                  <tr key={s.id}>
                    <td>{s.descricao}</td>
                    <td>
                      <input
                        type="number"
                        className="campo-tabela"
                        value={s.quantidade}
                        onChange={(e) =>
                          atualizarServico(s.id, "quantidade", Number(e.target.value))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="campo-tabela"
                        value={s.valor}
                        onChange={(e) =>
                          atualizarServico(s.id, "valor", Number(e.target.value))
                        }
                      />
                    </td>
                    <td>{moneyBR(s.quantidade * s.valor)}</td>
                    <td>
                      <button
                        type="button"
                        className="botao-mini"
                        onClick={() => removerServico(s.id)}
                      >
                        REMOVER
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2 className="titulo mb-3">TOTAL DA ORDEM</h2>

          <div className="totais">
            <p>Produtos: {moneyBR(totalProdutos)}</p>
            <p>Serviços: {moneyBR(totalServicos)}</p>
            <h3>TOTAL GERAL: {moneyBR(totalGeral)}</h3>
          </div>
        </section>
      </main>

      <style jsx>{`
        .card {
          background: white;
          border-radius: 20px;
          padding: 18px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .titulo {
          font-weight: 900;
          font-size: 14px;
          color: #6c757d;
        }

        .texto-ajuda {
          font-size: 12px;
          color: #6c757d;
          font-weight: 700;
        }

        .campo {
          height: 44px;
          border: 1.5px solid #9a9a9a;
          border-radius: 10px;
          padding: 0 12px;
          font-size: 14px;
          width: 100%;
          background: white;
          color: #111827;
        }

        .campo-tabela {
          width: 100%;
          height: 42px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          padding: 0 10px;
          font-size: 14px;
          color: #111827;
          background: white;
        }

        .botao-mini {
          border: 1px solid #2f2f2f;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 12px;
          background: white;
          color: #1f1f1f;
          font-weight: 500;
        }

        .tabela {
          width: 100%;
          border-collapse: collapse;
        }

        .tabela th {
          text-align: left;
          font-size: 12px;
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
          color: #111827;
          font-weight: 900;
        }

        .tabela td {
          font-size: 13px;
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
          color: #1f2937;
          vertical-align: middle;
        }

        .vazio {
          text-align: center;
          padding: 24px;
          color: #6c757d;
        }

        .lista-busca {
          position: absolute;
          top: 48px;
          left: 0;
          right: 0;
          z-index: 20;
          border-radius: 14px;
          border: 1px solid #d1d5db;
          background: white;
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
          max-height: 240px;
          overflow: auto;
        }

        .item-busca {
          width: 100%;
          text-align: left;
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
          background: white;
        }

        .item-busca:last-child {
          border-bottom: none;
        }

        .item-busca:hover {
          background: #f3f4f6;
        }

        .item-busca-titulo {
          font-weight: 700;
          color: #111827;
        }

        .item-busca-sub {
          font-size: 12px;
          color: #6b7280;
          margin-top: 2px;
        }

        .totais p {
          font-size: 14px;
          color: #1f2937;
          margin-bottom: 6px;
        }

        .totais h3 {
          margin-top: 10px;
          font-size: 22px;
          font-weight: 900;
          color: #111827;
        }
      `}</style>
    </div>
  );
}