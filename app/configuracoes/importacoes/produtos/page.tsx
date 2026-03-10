"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";

type LinhaCSV = Record<string, string>;

type ProdutoPreview = {
  nome: string;
  codigo_sku: string;
  preco_balcao: number;
  estoque_atual: number;
  categoria: string;
  status: string;
};

type ImportResponse = {
  ok?: boolean;
  error?: string;
  detalhe?: string;
  importados?: number;
  ignorados?: number;
};

const MAPA_CAMPOS = {
  nome: [
    "nome",
    "produto",
    "nome do produto",
    "descricao",
    "descrição",
    "descrição do produto",
  ],
  codigo_sku: [
    "codigo",
    "código",
    "sku",
    "codigo sku",
    "código sku",
    "cod",
    "referencia",
    "referência",
  ],
  preco_balcao: [
    "preco",
    "preço",
    "preco venda",
    "preço de venda",
    "preco de venda",
    "valor",
    "valor venda",
    "preco unitario",
    "preço unitário",
  ],
  estoque_atual: [
    "estoque",
    "estoque atual",
    "quantidade",
    "qtd",
    "saldo",
  ],
  categoria: [
    "categoria",
    "grupo",
    "departamento",
    "secao",
    "seção",
  ],
};

function normalizarTexto(valor: string) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function detectarColuna(headersOriginais: string[], aliases: string[]) {
  const mapa = headersOriginais.map((h) => ({
    original: h,
    normalizado: normalizarTexto(h),
  }));

  for (const alias of aliases) {
    const aliasNorm = normalizarTexto(alias);
    const encontrada = mapa.find((h) => h.normalizado === aliasNorm);
    if (encontrada) return encontrada.original;
  }

  for (const alias of aliases) {
    const aliasNorm = normalizarTexto(alias);
    const encontrada = mapa.find((h) => h.normalizado.includes(aliasNorm));
    if (encontrada) return encontrada.original;
  }

  return "";
}

function toMoney(value: unknown) {
  const texto = String(value ?? "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function toInt(value: unknown) {
  const texto = String(value ?? "").replace(/[^\d.-]/g, "");
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function converterLinhas(data: LinhaCSV[]) {
  if (!data.length) {
    return {
      produtos: [] as ProdutoPreview[],
      colunas: {
        nome: "",
        codigo_sku: "",
        preco_balcao: "",
        estoque_atual: "",
        categoria: "",
      },
    };
  }

  const headers = Object.keys(data[0] || {});

  const colNome = detectarColuna(headers, MAPA_CAMPOS.nome);
  const colCodigo = detectarColuna(headers, MAPA_CAMPOS.codigo_sku);
  const colPreco = detectarColuna(headers, MAPA_CAMPOS.preco_balcao);
  const colEstoque = detectarColuna(headers, MAPA_CAMPOS.estoque_atual);
  const colCategoria = detectarColuna(headers, MAPA_CAMPOS.categoria);

  const produtos = data.map((row) => ({
    nome: String(row[colNome] || "").trim().toUpperCase(),
    codigo_sku: String(row[colCodigo] || "").trim().toUpperCase(),
    preco_balcao: toMoney(row[colPreco]),
    estoque_atual: toInt(row[colEstoque]),
    categoria: String(row[colCategoria] || "").trim().toUpperCase(),
    status: "ATIVO",
  }));

  return {
    produtos,
    colunas: {
      nome: colNome,
      codigo_sku: colCodigo,
      preco_balcao: colPreco,
      estoque_atual: colEstoque,
      categoria: colCategoria,
    },
  };
}

export default function ImportacaoProdutosPage() {
  const router = useRouter();

  const [nomeArquivo, setNomeArquivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [csvRaw, setCsvRaw] = useState<LinhaCSV[]>([]);
  const [produtosPreview, setProdutosPreview] = useState<ProdutoPreview[]>([]);
  const [mensagem, setMensagem] = useState("");

  const [colunaNome, setColunaNome] = useState("");
  const [colunaCodigo, setColunaCodigo] = useState("");
  const [colunaPreco, setColunaPreco] = useState("");
  const [colunaEstoque, setColunaEstoque] = useState("");
  const [colunaCategoria, setColunaCategoria] = useState("");

  const headersDisponiveis = useMemo(() => {
    return csvRaw.length ? Object.keys(csvRaw[0]) : [];
  }, [csvRaw]);

  function atualizarPreviewManual(
    data: LinhaCSV[],
    overrides?: Partial<Record<string, string>>
  ) {
    const colNome = overrides?.nome ?? colunaNome;
    const colCodigo = overrides?.codigo_sku ?? colunaCodigo;
    const colPreco = overrides?.preco_balcao ?? colunaPreco;
    const colEstoque = overrides?.estoque_atual ?? colunaEstoque;
    const colCategoria = overrides?.categoria ?? colunaCategoria;

    const produtos = data.map((row) => ({
      nome: String(row[colNome] || "").trim().toUpperCase(),
      codigo_sku: String(row[colCodigo] || "").trim().toUpperCase(),
      preco_balcao: toMoney(row[colPreco]),
      estoque_atual: toInt(row[colEstoque]),
      categoria: String(row[colCategoria] || "").trim().toUpperCase(),
      status: "ATIVO",
    }));

    setProdutosPreview(produtos);
  }

  function processarArquivo(file: File) {
    setMensagem("");
    setNomeArquivo(file.name);

    Papa.parse<LinhaCSV>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const linhas = (result.data || []).filter((row) =>
          Object.values(row || {}).some((v) => String(v || "").trim() !== "")
        );

        setCsvRaw(linhas);

        const convertido = converterLinhas(linhas);

        setColunaNome(convertido.colunas.nome);
        setColunaCodigo(convertido.colunas.codigo_sku);
        setColunaPreco(convertido.colunas.preco_balcao);
        setColunaEstoque(convertido.colunas.estoque_atual);
        setColunaCategoria(convertido.colunas.categoria);

        setProdutosPreview(convertido.produtos);
      },
      error: (error) => {
        alert("ERRO AO LER CSV: " + error.message);
      },
    });
  }

  async function importarProdutos() {
    if (!produtosPreview.length) {
      alert("NENHUM PRODUTO PARA IMPORTAR.");
      return;
    }

    try {
      setLoading(true);
      setMensagem("");

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || "";

      if (!token) {
        alert("SESSÃO INVÁLIDA. FAÇA LOGIN NOVAMENTE.");
        router.push("/login");
        return;
      }

      const payload = produtosPreview.filter((p) => p.nome);

      const res = await fetch("/api/importacoes/produtos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ produtos: payload }),
      });

      const json: ImportResponse = await res.json();

      if (!res.ok) {
        alert(
          `${json.error || "ERRO AO IMPORTAR PRODUTOS."}${
            json.detalhe ? "\n\nDETALHE: " + json.detalhe : ""
          }`
        );
        return;
      }

      setMensagem(
        `IMPORTAÇÃO CONCLUÍDA! IMPORTADOS: ${json.importados || 0} | IGNORADOS: ${json.ignorados || 0}`
      );
    } catch (error) {
      console.error(error);
      alert("ERRO AO IMPORTAR PRODUTOS.");
    } finally {
      setLoading(false);
    }
  }

  function baixarModeloCSV() {
    const conteudo =
      "nome,codigo_sku,preco_balcao,estoque_atual,categoria\n" +
      "FILTRO DE ÓLEO,FO123,25.90,10,MOTOR\n" +
      "VELA NGK,VNGK01,35.00,8,IGNICAO\n" +
      "BATERIA 60AH,BAT60,420.00,3,ELETRICA\n";

    const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "modelo-importacao-produtos.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex bg-[#F3F4F6]">
      <Sidebar />

      <main className="flex-1 min-w-0 p-3 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[26px] font-black text-[#6C757D]">
              IMPORTAÇÃO DE PRODUTOS
            </h1>
            <p className="text-sm text-[#6C757D] mt-1">
              IMPORTE CSV DO BLING, TINY, EXCEL OU PLANILHA MANUAL
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => router.push("/configuracoes/importacoes")}
              className="botao"
            >
              VOLTAR
            </button>

            <button
              type="button"
              onClick={baixarModeloCSV}
              className="botao"
            >
              BAIXAR MODELO CSV
            </button>
          </div>
        </div>

        <section className="card mb-6">
          <h2 className="titulo mb-4">UPLOAD DO ARQUIVO</h2>

          <div className="flex flex-col gap-4">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processarArquivo(file);
              }}
              className="campo"
            />

            {nomeArquivo ? (
              <p className="text-sm text-[#374151]">
                ARQUIVO: <b>{nomeArquivo}</b>
              </p>
            ) : null}
          </div>
        </section>

        {csvRaw.length > 0 && (
          <section className="card mb-6">
            <h2 className="titulo mb-4">MAPEAMENTO DE COLUNAS</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <div>
                <label className="label">NOME</label>
                <select
                  className="campo"
                  value={colunaNome}
                  onChange={(e) => {
                    setColunaNome(e.target.value);
                    atualizarPreviewManual(csvRaw, { nome: e.target.value });
                  }}
                >
                  <option value="">SELECIONE</option>
                  {headersDisponiveis.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">CÓDIGO</label>
                <select
                  className="campo"
                  value={colunaCodigo}
                  onChange={(e) => {
                    setColunaCodigo(e.target.value);
                    atualizarPreviewManual(csvRaw, { codigo_sku: e.target.value });
                  }}
                >
                  <option value="">SELECIONE</option>
                  {headersDisponiveis.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">PREÇO</label>
                <select
                  className="campo"
                  value={colunaPreco}
                  onChange={(e) => {
                    setColunaPreco(e.target.value);
                    atualizarPreviewManual(csvRaw, { preco_balcao: e.target.value });
                  }}
                >
                  <option value="">SELECIONE</option>
                  {headersDisponiveis.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">ESTOQUE</label>
                <select
                  className="campo"
                  value={colunaEstoque}
                  onChange={(e) => {
                    setColunaEstoque(e.target.value);
                    atualizarPreviewManual(csvRaw, { estoque_atual: e.target.value });
                  }}
                >
                  <option value="">SELECIONE</option>
                  {headersDisponiveis.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">CATEGORIA</label>
                <select
                  className="campo"
                  value={colunaCategoria}
                  onChange={(e) => {
                    setColunaCategoria(e.target.value);
                    atualizarPreviewManual(csvRaw, { categoria: e.target.value });
                  }}
                >
                  <option value="">SELECIONE</option>
                  {headersDisponiveis.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        )}

        {produtosPreview.length > 0 && (
          <section className="card">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <h2 className="titulo">PREVIEW DA IMPORTAÇÃO</h2>

              <button
                type="button"
                onClick={importarProdutos}
                disabled={loading}
                className="botao-azul"
              >
                {loading ? "IMPORTANDO..." : "IMPORTAR PRODUTOS"}
              </button>
            </div>

            {mensagem ? (
              <div className="mb-4 rounded-xl bg-[#E8F3FF] border border-[#B6D4FE] p-3 text-sm text-[#0A569E] font-semibold">
                {mensagem}
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="tabela min-w-[900px]">
                <thead>
                  <tr>
                    <th>NOME</th>
                    <th>CÓDIGO</th>
                    <th>PREÇO</th>
                    <th>ESTOQUE</th>
                    <th>CATEGORIA</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosPreview.slice(0, 100).map((item, index) => (
                    <tr key={`${item.codigo_sku}-${index}`}>
                      <td>{item.nome || "-"}</td>
                      <td>{item.codigo_sku || "-"}</td>
                      <td>
                        {item.preco_balcao.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </td>
                      <td>{item.estoque_atual}</td>
                      <td>{item.categoria || "-"}</td>
                      <td>{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {produtosPreview.length > 100 ? (
              <p className="text-xs text-[#6C757D] mt-3">
                MOSTRANDO OS PRIMEIROS 100 ITENS DE {produtosPreview.length}.
              </p>
            ) : null}
          </section>
        )}
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

        .label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          color: #6c757d;
          margin-bottom: 6px;
          text-transform: uppercase;
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
          vertical-align: middle;
        }
      `}</style>
    </div>
  );
}