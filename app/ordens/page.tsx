"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Produto = {
  id: string;
  nome: string;
  codigo_sku: string;
  preco_balcao: number;
};

type Servico = {
  id: string;
  nome: string;
  valor: number;
};

type ItemProduto = {
  id: string;
  nome: string;
  codigo: string;
  quantidade: number;
  valor: number;
};

type ItemServico = {
  id: string;
  descricao: string;
  quantidade: number;
  valor: number;
};

export default function OrdensPage() {

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);

  const [buscaProduto, setBuscaProduto] = useState("");
  const [buscaServico, setBuscaServico] = useState("");

  const [produtosOS, setProdutosOS] = useState<ItemProduto[]>([]);
  const [servicosOS, setServicosOS] = useState<ItemServico[]>([]);

  function makeId() {
    return Math.random().toString(36).substring(2, 9);
  }

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

    setProdutos(produtosData || []);
    setServicos(servicosData || []);
  }

  const produtosFiltrados = useMemo(() => {
    if (buscaProduto.length < 2) return [];
    return produtos
      .filter(p =>
        (p.nome || "").toLowerCase().includes(buscaProduto.toLowerCase()) ||
        (p.codigo_sku || "").toLowerCase().includes(buscaProduto.toLowerCase())
      )
      .slice(0, 6);
  }, [buscaProduto, produtos]);

  const servicosFiltrados = useMemo(() => {
    if (buscaServico.length < 2) return [];
    return servicos
      .filter(s =>
        (s.nome || "").toLowerCase().includes(buscaServico.toLowerCase())
      )
      .slice(0, 6);
  }, [buscaServico, servicos]);

  function adicionarProduto(p: Produto) {

    setProdutosOS(prev => [
      ...prev,
      {
        id: makeId(),
        nome: p.nome,
        codigo: p.codigo_sku,
        quantidade: 1,
        valor: p.preco_balcao || 0
      }
    ]);

    setBuscaProduto("");
  }

  function adicionarServico(s: Servico) {

    setServicosOS(prev => [
      ...prev,
      {
        id: makeId(),
        descricao: s.nome,
        quantidade: 1,
        valor: s.valor || 0
      }
    ]);

    setBuscaServico("");
  }

  function atualizarProduto(id: string, campo: string, valor: any) {

    setProdutosOS(prev =>
      prev.map(p =>
        p.id === id ? { ...p, [campo]: valor } : p
      )
    );
  }

  function atualizarServico(id: string, campo: string, valor: any) {

    setServicosOS(prev =>
      prev.map(s =>
        s.id === id ? { ...s, [campo]: valor } : s
      )
    );
  }

  function removerProduto(id: string) {
    setProdutosOS(prev => prev.filter(p => p.id !== id));
  }

  function removerServico(id: string) {
    setServicosOS(prev => prev.filter(s => s.id !== id));
  }

  function totalProdutos() {
    return produtosOS.reduce((acc, p) => acc + p.quantidade * p.valor, 0);
  }

  function totalServicos() {
    return servicosOS.reduce((acc, s) => acc + s.quantidade * s.valor, 0);
  }

  return (
    <div className="flex min-h-screen bg-[#EEF2F7]">

      <Sidebar />

      <main className="flex-1 p-6">

        {/* PRODUTOS */}

        <section className="card">

          <div className="flex justify-between mb-4">

            <h2 className="titulo">PRODUTOS</h2>

            <span className="text-sm text-gray-500">
              DIGITE 3 LETRAS PARA BUSCAR
            </span>

          </div>

          <input
            placeholder="BUSCAR PRODUTO POR NOME OU CÓDIGO..."
            className="campo mb-4"
            value={buscaProduto}
            onChange={(e) => setBuscaProduto(e.target.value)}
          />

          {produtosFiltrados.length > 0 && (

            <div className="lista-busca">

              {produtosFiltrados.map(p => (

                <button
                  key={p.id}
                  onClick={() => adicionarProduto(p)}
                  className="item-busca"
                >
                  {p.nome} • {p.codigo_sku}
                </button>

              ))}

            </div>

          )}

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

              {produtosOS.map(p => (

                <tr key={p.id}>

                  <td>{p.nome}</td>

                  <td>{p.codigo}</td>

                  <td>
                    <input
                      type="number"
                      value={p.quantidade}
                      onChange={(e) =>
                        atualizarProduto(p.id, "quantidade", Number(e.target.value))
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={p.valor}
                      onChange={(e) =>
                        atualizarProduto(p.id, "valor", Number(e.target.value))
                      }
                    />
                  </td>

                  <td>
                    R$ {(p.quantidade * p.valor).toFixed(2)}
                  </td>

                  <td>
                    <button onClick={() => removerProduto(p.id)}>
                      REMOVER
                    </button>
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </section>


        {/* SERVIÇOS */}

        <section className="card mt-6">

          <div className="flex justify-between mb-4">

            <h2 className="titulo">MÃO DE OBRA / SERVIÇOS</h2>

          </div>

          <input
            placeholder="BUSCAR SERVIÇO..."
            className="campo mb-4"
            value={buscaServico}
            onChange={(e) => setBuscaServico(e.target.value)}
          />

          {servicosFiltrados.length > 0 && (

            <div className="lista-busca">

              {servicosFiltrados.map(s => (

                <button
                  key={s.id}
                  onClick={() => adicionarServico(s)}
                  className="item-busca"
                >
                  {s.nome}
                </button>

              ))}

            </div>

          )}

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

              {servicosOS.map(s => (

                <tr key={s.id}>

                  <td>{s.descricao}</td>

                  <td>
                    <input
                      type="number"
                      value={s.quantidade}
                      onChange={(e) =>
                        atualizarServico(s.id, "quantidade", Number(e.target.value))
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={s.valor}
                      onChange={(e) =>
                        atualizarServico(s.id, "valor", Number(e.target.value))
                      }
                    />
                  </td>

                  <td>
                    R$ {(s.quantidade * s.valor).toFixed(2)}
                  </td>

                  <td>
                    <button onClick={() => removerServico(s.id)}>
                      REMOVER
                    </button>
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </section>

        {/* TOTAL */}

        <section className="card mt-6">

          <h2 className="titulo mb-3">TOTAL DA ORDEM</h2>

          <p>Produtos: R$ {totalProdutos().toFixed(2)}</p>
          <p>Serviços: R$ {totalServicos().toFixed(2)}</p>

          <h3 className="mt-2 font-bold text-lg">
            TOTAL GERAL: R$ {(totalProdutos() + totalServicos()).toFixed(2)}
          </h3>

        </section>

      </main>

    </div>
  );
}