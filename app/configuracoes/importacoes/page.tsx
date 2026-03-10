"use client";

import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";

export default function ImportacoesPage() {
  const router = useRouter();

  const itens = [
    {
      titulo: "IMPORTAR CLIENTES",
      descricao: "Importe clientes via CSV (Bling, Tiny ou Excel).",
      rota: "/configuracoes/importacoes/clientes",
    },
    {
      titulo: "IMPORTAR FORNECEDORES",
      descricao: "Importe fornecedores de forma rápida por planilha.",
      rota: "/configuracoes/importacoes/fornecedores",
    },
    {
      titulo: "IMPORTAR PRODUTOS",
      descricao: "Importe produtos com preço, estoque e categoria.",
      rota: "/configuracoes/importacoes/produtos",
    },
    {
      titulo: "IMPORTAR SERVIÇOS",
      descricao: "Importe serviços ou mão de obra por CSV.",
      rota: "/configuracoes/importacoes/servicos",
    },
  ];

  return (
    <div className="min-h-screen flex bg-[#F3F4F6]">
      <Sidebar />

      <main className="flex-1 min-w-0 p-3 md:p-6">
        <div className="mb-8">
          <h1 className="text-[26px] font-black text-[#6C757D]">
            IMPORTAÇÕES
          </h1>

          <p className="text-sm text-[#6C757D] mt-1">
            IMPORTE DADOS DE OUTROS SISTEMAS OU PLANILHAS CSV
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
          {itens.map((item) => (
            <div
              key={item.titulo}
              className="card cursor-pointer hover:shadow-md transition"
              onClick={() => router.push(item.rota)}
            >
              <h2 className="titulo mb-2">{item.titulo}</h2>

              <p className="descricao">
                {item.descricao}
              </p>

              <button
                className="botao-azul mt-4"
                type="button"
                onClick={() => router.push(item.rota)}
              >
                ABRIR IMPORTAÇÃO
              </button>
            </div>
          ))}
        </div>
      </main>

      <style jsx>{`
        .card {
          background: white;
          border-radius: 20px;
          padding: 22px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .titulo {
          font-weight: 900;
          font-size: 15px;
          color: #6c757d;
        }

        .descricao {
          font-size: 13px;
          color: #374151;
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
      `}</style>
    </div>
  );
}