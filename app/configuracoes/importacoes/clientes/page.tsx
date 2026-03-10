"use client";

import { useState } from "react";
import Papa, { ParseResult } from "papaparse";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";

type ApiResponse = {
  ok?: boolean;
  total?: number;
  error?: string;
  detalhe?: string;
};

type ClienteImportado = {
  nome: string;
  telefone: string;
  celular: string;
  whatsapp: string;
  cpf_cnpj: string;
  email: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  observacoes: string;
  status: string;
};

function normalizarTexto(v: unknown) {
  return String(v ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\t/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function up(v: unknown) {
  return String(v ?? "").trim().toUpperCase();
}

function digits(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

function detectarDelimitador(texto: string) {
  const primeiraLinha = texto.split(/\r?\n/)[0] || "";
  const qtdPontoVirgula = (primeiraLinha.match(/;/g) || []).length;
  const qtdVirgula = (primeiraLinha.match(/,/g) || []).length;
  return qtdPontoVirgula >= qtdVirgula ? ";" : ",";
}

function normalizarRow(row: Record<string, unknown>) {
  const novo: Record<string, string> = {};

  for (const [chave, valor] of Object.entries(row || {})) {
    novo[normalizarTexto(chave)] = String(valor ?? "").trim();
  }

  return novo;
}

function pick(row: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const chave = normalizarTexto(alias);
    if (row[chave] !== undefined && row[chave] !== "") {
      return row[chave];
    }
  }
  return "";
}

function converterClientes(rows: Record<string, string>[]) {
  return rows
    .map((row) => ({
      nome: up(
        pick(row, [
          "nome",
          "cliente",
          "nome do cliente",
          "razao social",
          "razão social",
        ])
      ),
      telefone: digits(pick(row, ["telefone", "fone", "tel"])),
      celular: digits(pick(row, ["celular", "cel"])),
      whatsapp: digits(pick(row, ["whatsapp", "whats", "zap"])),
      cpf_cnpj: digits(
        pick(row, ["cpf_cnpj", "cpf/cnpj", "cpf", "cnpj", "documento"])
      ),
      email: String(
        pick(row, ["email", "e-mail", "correio eletronico", "correio eletrônico"])
      )
        .trim()
        .toLowerCase(),
      endereco: up(pick(row, ["endereco", "endereço", "logradouro", "rua"])),
      numero: up(pick(row, ["numero", "número", "num"])),
      bairro: up(pick(row, ["bairro"])),
      cidade: up(pick(row, ["cidade", "municipio", "município"])),
      uf: up(pick(row, ["uf", "estado"])),
      cep: digits(pick(row, ["cep"])),
      observacoes: up(
        pick(row, ["observacoes", "observação", "obs", "observacoes gerais"])
      ),
      status: "ATIVO",
    }))
    .filter((item) => item.nome);
}

export default function ImportacaoClientesPage() {
  const router = useRouter();

  const [arquivo, setArquivo] = useState("");
  const [linhasLidas, setLinhasLidas] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [clientes, setClientes] = useState<ClienteImportado[]>([]);
  const [loading, setLoading] = useState(false);

  async function processarArquivo(file: File) {
    setArquivo(file.name);

    const texto = await file.text();
    const delimiter = detectarDelimitador(texto);

    Papa.parse<Record<string, unknown>>(texto, {
      header: true,
      skipEmptyLines: "greedy",
      delimiter,
      transformHeader: (header: string) =>
        String(header ?? "").replace(/^\uFEFF/, "").replace(/\t/g, "").trim(),
      complete: (result: ParseResult<Record<string, unknown>>) => {
        const dadosOriginais = (result.data || []).filter((row) =>
          Object.values(row || {}).some((v) => String(v ?? "").trim() !== "")
        );

        const dadosNormalizados = dadosOriginais.map((row) => normalizarRow(row));

        setLinhasLidas(dadosNormalizados.length);
        setHeaders(Object.keys(dadosNormalizados[0] || {}));

        const clientesConvertidos = converterClientes(dadosNormalizados);
        setClientes(clientesConvertidos);
      },
      error: (error: Error) => {
        alert("ERRO AO LER CSV: " + error.message);
      },
    });
  }

  async function importar() {
    if (!clientes.length) {
      alert("NENHUM CLIENTE PARA IMPORTAR.");
      return;
    }

    try {
      setLoading(true);

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || "";

      const res = await fetch("/api/importacoes/clientes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clientes }),
      });

      const json: ApiResponse = await res.json();

      if (!res.ok) {
        alert(
          `${json.error || "ERRO AO IMPORTAR CLIENTES."}${
            json.detalhe ? "\n\nDETALHE: " + json.detalhe : ""
          }`
        );
        return;
      }

      alert(`CLIENTES IMPORTADOS: ${json.total || clientes.length}`);
    } catch (error) {
      console.error(error);
      alert("ERRO AO IMPORTAR CLIENTES.");
    } finally {
      setLoading(false);
    }
  }

  function baixarModelo() {
    const csv =
      "Nome;Telefone;Celular;WhatsApp;CPF/CNPJ;Email;Endereco;Numero;Bairro;Cidade;UF;CEP;Observacoes\n" +
      "JOAO DA SILVA;1133334444;11999998888;11999998888;12345678900;joao@email.com;RUA A;100;CENTRO;SAO PAULO;SP;01001000;CLIENTE VIP\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-clientes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex bg-[#F3F4F6]">
      <Sidebar />
      <main className="flex-1 min-w-0 p-3 md:p-6">
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[26px] font-black text-[#6C757D]">IMPORTAÇÃO DE CLIENTES</h1>
            <p className="text-sm text-[#6C757D] mt-1">IMPORTE CLIENTES VIA CSV</p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button className="botao" onClick={() => router.push("/configuracoes/importacoes")} type="button">
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
            onChange={(e) => e.target.files?.[0] && processarArquivo(e.target.files[0])}
            className="campo"
          />

          {arquivo ? (
            <p className="mt-3 text-sm text-[#374151]">ARQUIVO: <b>{arquivo}</b></p>
          ) : null}

          {linhasLidas > 0 ? (
            <div className="mt-2 text-sm text-[#374151] space-y-1">
              <p>LINHAS LIDAS: <b>{linhasLidas}</b></p>
              <p>CLIENTES VÁLIDOS: <b>{clientes.length}</b></p>
              <p className="break-all">HEADERS DETECTADOS: <b>{headers.join(" | ")}</b></p>
            </div>
          ) : null}
        </section>

        {clientes.length > 0 && (
          <section className="card">
            <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
              <h2 className="titulo">PREVIEW DA IMPORTAÇÃO</h2>
              <button className="botao-azul" onClick={importar} disabled={loading} type="button">
                {loading ? "IMPORTANDO..." : "IMPORTAR CLIENTES"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="tabela min-w-[1200px]">
                <thead>
                  <tr>
                    <th>NOME</th>
                    <th>TELEFONE</th>
                    <th>CELULAR</th>
                    <th>WHATSAPP</th>
                    <th>CPF/CNPJ</th>
                    <th>EMAIL</th>
                    <th>CIDADE</th>
                    <th>UF</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.slice(0, 100).map((item, i) => (
                    <tr key={`${item.cpf_cnpj}-${i}`}>
                      <td>{item.nome || "-"}</td>
                      <td>{item.telefone || "-"}</td>
                      <td>{item.celular || "-"}</td>
                      <td>{item.whatsapp || "-"}</td>
                      <td>{item.cpf_cnpj || "-"}</td>
                      <td>{item.email || "-"}</td>
                      <td>{item.cidade || "-"}</td>
                      <td>{item.uf || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <style jsx>{`
          .card { background: white; border-radius: 20px; padding: 18px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
          .titulo { font-weight: 900; font-size: 14px; color: #6c757d; }
          .campo { height: 44px; border: 1.5px solid #9a9a9a; border-radius: 10px; padding: 0 12px; font-size: 14px; width: 100%; background: white; color: #111827; }
          .botao { border: 1px solid #2f2f2f; border-radius: 10px; padding: 10px 16px; font-size: 13px; background: white; color: #1f1f1f; font-weight: 500; }
          .botao-azul { background: #0456a3; color: white; border-radius: 10px; padding: 10px 16px; font-size: 13px; font-weight: 600; border: none; }
          .tabela { width: 100%; border-collapse: collapse; }
          .tabela th { text-align: left; font-size: 12px; padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827; font-weight: 900; }
          .tabela td { font-size: 13px; padding: 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937; }
        `}</style>
      </main>
    </div>
  );
}