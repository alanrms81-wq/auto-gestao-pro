"use client";

import { useState } from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Linha = Record<string, string>;

type ProdutoImportado = {
  nome: string;
  codigo_sku: string;
  codigo_barras: string;
  ncm: string;
  marca: string;
  fornecedor: string;
  categoria: string;
  unidade: string;
  origem: string;
  preco_balcao: number;
  preco_custo: number;
  estoque_atual: number;
  localizacao: string;
  observacoes: string;
  status: string;
};

type ApiResponse = {
  ok?: boolean;
  total?: number;
  error?: string;
  detalhe?: string;
};

function up(v: unknown) {
  return String(v ?? "").trim().toUpperCase();
}

function digits(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

function toMoney(v: unknown) {
  const texto = String(v ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const n = Number(texto);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown) {
  const texto = String(v ?? "").replace(/[^\d.-]/g, "");
  const n = Number(texto);
  return Number.isFinite(n) ? n : 0;
}

export default function ImportacaoProdutosPage() {
  const router = useRouter();

  const [arquivo, setArquivo] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [produtos, setProdutos] = useState<ProdutoImportado[]>([]);
  const [loading, setLoading] = useState(false);

  function processarArquivo(file: File) {
    setArquivo(file.name);

    Papa.parse<Linha>(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      complete: (result) => {
        const dados = (result.data || []).filter((row) =>
          Object.values(row || {}).some((v) => String(v || "").trim() !== "")
        );

        setLinhas(dados);

        const produtosConvertidos: ProdutoImportado[] = dados
          .map((row) => ({
            nome: up(
              row["Descrição"] ||
                row["DESCRIÇÃO"] ||
                row["descricao"] ||
                row["Descrição do produto"] ||
                row["Nome"] ||
                row["nome"] ||
                row["Produto"] ||
                row["produto"] ||
                ""
            ),

            codigo_sku: up(
              row["Código"] ||
                row["CÓDIGO"] ||
                row["codigo"] ||
                row["SKU"] ||
                row["sku"] ||
                ""
            ),

            codigo_barras: digits(
              row["GTIN"] ||
                row["EAN"] ||
                row["Código de barras"] ||
                row["CÓDIGO DE BARRAS"] ||
                row["codigo_barras"] ||
                ""
            ),

            ncm: digits(
              row["NCM"] ||
                row["ncm"] ||
                ""
            ),

            marca: up(
              row["Marca"] ||
                row["marca"] ||
                ""
            ),

            fornecedor: up(
              row["Fornecedor"] ||
                row["fornecedor"] ||
                row["Fabricante principal"] ||
                ""
            ),

            categoria: up(
              row["Categoria do produto"] ||
                row["CATEGORIA DO PRODUTO"] ||
                row["Grupo de produtos"] ||
                row["GRUPO DE PRODUTOS"] ||
                row["Categoria"] ||
                row["categoria"] ||
                ""
            ),

            unidade: up(
              row["Unidade"] ||
                row["unidade"] ||
                "UN"
            ),

            origem: up(
              row["Origem"] ||
                row["origem"] ||
                ""
            ),

            preco_balcao: toMoney(
              row["Preço"] ||
                row["PREÇO"] ||
                row["Preco"] ||
                row["preco"] ||
                row["Preço de venda"] ||
                row["preco_venda"] ||
                0
            ),

            preco_custo: toMoney(
              row["Preço de custo"] ||
                row["PREÇO DE CUSTO"] ||
                row["Custo"] ||
                row["custo"] ||
                row["preco_custo"] ||
                0
            ),

            estoque_atual: toInt(
              row["Estoque"] ||
                row["ESTOQUE"] ||
                row["estoque"] ||
                row["Quantidade"] ||
                row["quantidade"] ||
                0
            ),

            localizacao: up(
              row["Localização"] ||
                row["LOCALIZAÇÃO"] ||
                row["localizacao"] ||
                row["Localização no estoque"] ||
                ""
            ),

            observacoes: up(
              row["Observações"] ||
                row["OBSERVAÇÕES"] ||
                row["observacoes"] ||
                row["Observacao"] ||
                row["observacao"] ||
                ""
            ),

            status: "ATIVO",
          }))
          .filter((item) => item.nome);

        setProdutos(produtosConvertidos);
      },
      error: (error) => {
        alert("ERRO AO LER CSV: " + error.message);
      },
    });
  }

  async function importar() {
    if (!produtos.length) {
      alert("NENHUM PRODUTO PARA IMPORTAR.");
      return;
    }

    try {
      setLoading(true);

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || "";

      if (!token) {
        alert("SESSÃO INVÁLIDA. FAÇA LOGIN NOVAMENTE.");
        router.push("/login");
        return;
      }

      const res = await fetch("/api/importacoes/produtos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ produtos }),
      });

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        alert(
          `${json.error || "ERRO AO IMPORTAR PRODUTOS."}${
            json.detalhe ? "\n\nDETALHE: " + json.detalhe : ""
          }`
        );
        return;
      }

      alert(`PRODUTOS IMPORTADOS: ${json.total || produtos.length}`);
    } catch (error) {
      console.error(error);
      alert("ERRO AO IMPORTAR PRODUTOS.");
    } finally {
      setLoading(false);
    }
  }

  function baixarModelo() {
    const csv =
      "Código;Descrição;Preço;Estoque;Fornecedor;Marca;Categoria do produto;NCM;GTIN;Unidade\n" +
      "FO123;FILTRO DE OLEO;25,90;10;AUTO PECAS BRASIL;BOSCH;MOTOR;84212300;7890000000011;UN\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-produtos-bling.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex bg-[#F3F4F6]">
      <Sidebar />

      <main className="flex-1 min-w-0 p-3 md:p-6">
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[26px] font-black text-[#6C757D]">
              IMPORTAÇÃO DE PRODUTOS
            </h1>
            <p className="text-sm text-[#6C757D] mt-1">
              IMPORTE PRODUTOS VIA CSV DO BLING, EXCEL OU OUTRO SISTEMA
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              className="botao"
              onClick={() => router.push("/configuracoes/importacoes")}
              type="button"
            >
              VOLTAR
            </button>

            <button className="botao" onClick={baixarModelo} type="button">
              BAIXAR MODELO
            </button>
          </div>
        </div>

        <section className="card mb-6">
          <input
            type="file"
            accept=".csv"
            onChange={(e) =>
              e.target.files?.[0] && processarArquivo(e.target.files[0])
            }
            className="campo"
          />

          {arquivo ? (
            <p className="mt-3 text-sm text-[#374151]">
              ARQUIVO: <b>{arquivo}</b>
            </p>
          ) : null}

          {linhas.length > 0 ? (
            <p className="mt-2 text-sm text-[#374151]">
              LINHAS LIDAS: <b>{linhas.length}</b> | PRODUTOS VÁLIDOS: <b>{produtos.length}</b>
            </p>
          ) : null}
        </section>

        {produtos.length > 0 && (
          <section className="card">
            <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
              <h2 className="titulo">PREVIEW DA IMPORTAÇÃO</h2>

              <button
                className="botao-azul"
                onClick={importar}
                disabled={loading}
                type="button"
              >
                {loading ? "IMPORTANDO..." : "IMPORTAR PRODUTOS"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="tabela min-w-[1500px]">
                <thead>
                  <tr>
                    <th>NOME</th>
                    <th>CÓDIGO</th>
                    <th>GTIN/EAN</th>
                    <th>NCM</th>
                    <th>MARCA</th>
                    <th>FORNECEDOR</th>
                    <th>CATEGORIA</th>
                    <th>UNIDADE</th>
                    <th>PREÇO VENDA</th>
                    <th>PREÇO CUSTO</th>
                    <th>ESTOQUE</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.slice(0, 100).map((item, i) => (
                    <tr key={`${item.codigo_sku}-${i}`}>
                      <td>{item.nome || "-"}</td>
                      <td>{item.codigo_sku || "-"}</td>
                      <td>{item.codigo_barras || "-"}</td>
                      <td>{item.ncm || "-"}</td>
                      <td>{item.marca || "-"}</td>
                      <td>{item.fornecedor || "-"}</td>
                      <td>{item.categoria || "-"}</td>
                      <td>{item.unidade || "-"}</td>
                      <td>
                        {item.preco_balcao.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </td>
                      <td>
                        {item.preco_custo.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </td>
                      <td>{item.estoque_atual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {produtos.length > 100 ? (
              <p className="text-xs text-[#6C757D] mt-3">
                MOSTRANDO OS PRIMEIROS 100 ITENS DE {produtos.length}.
              </p>
            ) : null}
          </section>
        )}

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

          .botao {
            border: 1px solid #2f2f2f;
            border-radius: 10px;
            padding: 10px 16px;
            font-size: 13px;
            background: white;
            color: #1f1f1f;
            font-weight: 500;
          }

          .botao-azul {
            background: #0456a3;
            color: white;
            border-radius: 10px;
            padding: 10px 16px;
            font-size: 13px;
            font-weight: 600;
            border: none;
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
          }
        `}</style>
      </main>
    </div>
  );
}