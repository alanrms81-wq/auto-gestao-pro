"use client";

import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";

export default function ImportacoesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex bg-[#F3F4F6]">
      <Sidebar />

      <main className="flex-1 p-6">
        <h1 className="text-2xl font-black text-[#6C757D] mb-6">
          IMPORTAÇÕES
        </h1>

        <div className="grid md:grid-cols-2 gap-6">

          <button
            onClick={() => router.push("/configuracoes/importacoes/clientes")}
            className="card"
          >
            IMPORTAR CLIENTES
          </button>

          <button
            onClick={() => router.push("/configuracoes/importacoes/fornecedores")}
            className="card"
          >
            IMPORTAR FORNECEDORES
          </button>

          <button
            onClick={() => router.push("/configuracoes/importacoes/produtos")}
            className="card"
          >
            IMPORTAR PRODUTOS
          </button>

          <button
            onClick={() => router.push("/configuracoes/importacoes/servicos")}
            className="card"
          >
            IMPORTAR SERVIÇOS
          </button>

        </div>
      </main>

      <style jsx>{`
        .card {
          background: white;
          border-radius: 14px;
          padding: 30px;
          font-weight: 700;
          border: 1px solid #e5e7eb;
          text-align: left;
        }

        .card:hover {
          border-color: #0456a3;
        }
      `}</style>
    </div>
  );
}