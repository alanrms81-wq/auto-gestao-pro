"use client";

import { useState } from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";

type Linha = Record<string, string>;

export default function ImportacaoFornecedoresPage() {
  const router = useRouter();
  const [arquivo, setArquivo] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(false);

  function processarArquivo(file: File) {
    setArquivo(file.name);

    Papa.parse<Linha>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => setLinhas(result.data || []),
      error: (error) => alert("ERRO AO LER CSV: " + error.message),
    });
  }

  async function importar() {
    if (!linhas.length) {
      alert("NENHUM FORNECEDOR PARA IMPORTAR.");
      return;
    }

    try {
      setLoading(true);

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || "";

      const fornecedores = linhas.map((row) => ({
        nome: String(row.nome || row.fornecedor || "").trim().toUpperCase(),
        telefone: String(row.telefone || "").replace(/\D/g, ""),
        celular: String(row.celular || "").replace(/\D/g, ""),
        whatsapp: String(row.whatsapp || "").replace(/\D/g, ""),
        cpf_cnpj: String(row.cpf_cnpj || row["cpf/cnpj"] || "").replace(/\D/g, ""),
        email: String(row.email || "").trim().toLowerCase(),
        cidade: String(row.cidade || "").trim().toUpperCase(),
        uf: String(row.uf || "").trim().toUpperCase(),
        observacoes: String(row.observacoes || row.obs || "").trim().toUpperCase(),
        status: "ATIVO",
      })).filter((f) => f.nome);

      const res = await fetch("/api/importacoes/fornecedores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fornecedores }),
      });

      const json = await res.json();

      if (!res.ok) {
        alert(json.error || "ERRO AO IMPORTAR FORNECEDORES.");
        return;
      }

      alert(`FORNECEDORES IMPORTADOS: ${json.total || fornecedores.length}`);
    } catch (error) {
      console.error(error);
      alert("ERRO AO IMPORTAR FORNECEDORES.");
    } finally {
      setLoading(false);
    }
  }

  function baixarModelo() {
    const csv =
      "nome,telefone,celular,whatsapp,cpf_cnpj,email,cidade,uf,observacoes\n" +
      "AUTO PECAS BRASIL,1133334444,11999998888,11999998888,12345678000199,contato@autopecas.com,SAO PAULO,SP,FORNECEDOR PRINCIPAL\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-fornecedores.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex bg-[#F3F4F6]">
      <Sidebar />
      <main className="flex-1 min-w-0 p-3 md:p-6">
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[26px] font-black text-[#6C757D]">IMPORTAÇÃO DE FORNECEDORES</h1>
            <p className="text-sm text-[#6C757D] mt-1">IMPORTE FORNECEDORES VIA CSV</p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button className="botao" onClick={() => router.push("/configuracoes/importacoes")}>VOLTAR</button>
            <button className="botao" onClick={baixarModelo}>BAIXAR MODELO</button>
          </div>
        </div>

        <section className="card mb-6">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => e.target.files?.[0] && processarArquivo(e.target.files[0])}
            className="campo"
          />
          {arquivo ? <p className="mt-3 text-sm text-[#374151]">ARQUIVO: <b>{arquivo}</b></p> : null}
        </section>

        {linhas.length > 0 && (
          <section className="card">
            <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
              <h2 className="titulo">PREVIEW</h2>
              <button className="botao-azul" onClick={importar} disabled={loading}>
                {loading ? "IMPORTANDO..." : "IMPORTAR FORNECEDORES"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="tabela min-w-[1000px]">
                <thead>
                  <tr>
                    <th>NOME</th>
                    <th>TELEFONE</th>
                    <th>CPF/CNPJ</th>
                    <th>EMAIL</th>
                    <th>CIDADE</th>
                    <th>UF</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.slice(0, 50).map((row, i) => (
                    <tr key={i}>
                      <td>{row.nome || row.fornecedor || "-"}</td>
                      <td>{row.telefone || "-"}</td>
                      <td>{row.cpf_cnpj || row["cpf/cnpj"] || "-"}</td>
                      <td>{row.email || "-"}</td>
                      <td>{row.cidade || "-"}</td>
                      <td>{row.uf || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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