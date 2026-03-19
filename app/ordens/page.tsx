"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type Produto = {
  id: string;
  nome: string;
  codigo_sku?: string;
  codigo_barras?: string;
  categoria?: string;
  subcategoria?: string;
  preco_balcao?: number;
  status?: string;
};

function normalizarTexto(texto: string) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export default function OrdensPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtosBusca, setProdutosBusca] = useState<Produto[]>([]);
  const [loadingProdutosBusca, setLoadingProdutosBusca] = useState(false);
  const [mostrarDropdownProduto, setMostrarDropdownProduto] = useState(false);

  const [produtosOS, setProdutosOS] = useState<any[]>([]);

  useEffect(() => {
    async function init() {
      const user = await getSessionUser();
      if (!user) return;
      setEmpresaId(user.empresa_id);
    }
    init();
  }, []);

  // 🔥 BUSCA DIRETA NO BANCO (SOLUÇÃO DEFINITIVA)
  async function buscarProdutosNoBanco(termo: string) {
    if (!empresaId) return;

    const q = termo.trim();

    if (!q) {
      setProdutosBusca([]);
      return;
    }

    setLoadingProdutosBusca(true);

    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .eq("empresa_id", empresaId)
      .or(
        [
          `nome.ilike.%${q}%`,
          `codigo_sku.ilike.%${q}%`,
          `codigo_barras.ilike.%${q}%`,
          `categoria.ilike.%${q}%`,
          `subcategoria.ilike.%${q}%`,
        ].join(",")
      )
      .order("nome")
      .limit(100);

    if (error) {
      alert("ERRO AO BUSCAR PRODUTOS: " + error.message);
      setProdutosBusca([]);
      setLoadingProdutosBusca(false);
      return;
    }

    const filtrados = (data || []).filter(
      (p: Produto) =>
        normalizarTexto(p.status || "ATIVO") !== "INATIVO"
    );

    setProdutosBusca(filtrados);
    setLoadingProdutosBusca(false);
  }

  function adicionarProduto(p: Produto) {
    setProdutosOS((prev) => [
      ...prev,
      {
        id: Math.random(),
        nome: p.nome,
        quantidade: 1,
        valor: p.preco_balcao || 0,
      },
    ]);

    setBuscaProduto("");
    setMostrarDropdownProduto(false);
  }

  return (
    <div className="flex min-h-screen bg-[#f4f6f8]">
      <Sidebar />

      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-6">ORDEM DE SERVIÇO</h1>

        {/* BUSCA PRODUTO */}
        <div className="relative mb-6">
          <input
            placeholder="BUSCAR PRODUTO..."
            className="w-full border p-3 rounded"
            value={buscaProduto}
            onChange={async (e) => {
              const valor = e.target.value;
              setBuscaProduto(valor);
              setMostrarDropdownProduto(true);
              await buscarProdutosNoBanco(valor);
            }}
            onFocus={async () => {
              if (buscaProduto) {
                setMostrarDropdownProduto(true);
                await buscarProdutosNoBanco(buscaProduto);
              }
            }}
          />

          {/* LOADING */}
          {loadingProdutosBusca && (
            <div className="text-xs mt-2 text-gray-500">
              BUSCANDO PRODUTOS...
            </div>
          )}

          {/* RESULTADOS */}
          {mostrarDropdownProduto &&
            buscaProduto &&
            produtosBusca.length > 0 && (
              <div className="absolute z-50 bg-white border w-full mt-2 rounded shadow max-h-60 overflow-auto">
                {produtosBusca.map((p) => (
                  <button
                    key={p.id}
                    className="block w-full text-left p-3 hover:bg-gray-100 border-b"
                    onClick={() => adicionarProduto(p)}
                  >
                    <div className="font-semibold">{p.nome}</div>
                    <div className="text-xs text-gray-500">
                      {p.codigo_sku || p.codigo_barras || "-"} •{" "}
                      R$ {p.preco_balcao || 0}
                    </div>
                  </button>
                ))}
              </div>
            )}

          {/* SEM RESULTADO */}
          {mostrarDropdownProduto &&
            buscaProduto &&
            !loadingProdutosBusca &&
            produtosBusca.length === 0 && (
              <div className="absolute z-50 bg-white border w-full mt-2 rounded shadow p-3 text-red-600">
                NENHUM PRODUTO ENCONTRADO
              </div>
            )}
        </div>

        {/* LISTA OS */}
        <table className="w-full border">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Qtd</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {produtosOS.map((p, i) => (
              <tr key={i}>
                <td>{p.nome}</td>
                <td>{p.quantidade}</td>
                <td>R$ {p.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}