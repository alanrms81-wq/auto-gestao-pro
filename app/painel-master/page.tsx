"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Assinatura = {
  id: string;
  empresa_id: string;
  nome_empresa: string;
  responsavel: string;
  telefone: string;
  email: string;
  plano: string;
  valor_mensal: number;
  proximo_vencimento: string;
  status_assinatura: string;
  bloqueado: boolean;
};

export default function PainelMaster() {
  const [dados, setDados] = useState<Assinatura[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const { data, error } = await supabase
      .from("assinaturas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Erro ao carregar");
      return;
    }

    setDados(data || []);
    setLoading(false);
  }

  async function toggleBloqueio(id: string, atual: boolean) {
    await supabase
      .from("assinaturas")
      .update({ bloqueado: !atual })
      .eq("id", id);

    carregar();
  }

  function statusColor(status: string) {
    status = status.toUpperCase();

    if (status === "ATIVO") return "bg-green-100 text-green-700";
    if (status === "VENCIDO") return "bg-red-100 text-red-700";
    if (status === "TESTE") return "bg-yellow-100 text-yellow-700";

    return "bg-gray-100 text-gray-700";
  }

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-black mb-6">
        PAINEL MASTER (SaaS)
      </h1>

      <div className="grid gap-4">
        {dados.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl p-5 shadow border"
          >
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold">
                  {item.nome_empresa}
                </h2>
                <p className="text-sm text-gray-500">
                  {item.responsavel}
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${statusColor(
                    item.status_assinatura
                  )}`}
                >
                  {item.status_assinatura}
                </span>

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                  {item.plano}
                </span>

                {item.bloqueado && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-black text-white">
                    BLOQUEADO
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
              <div>
                <b>📞</b> {item.telefone}
              </div>

              <div>
                <b>📧</b> {item.email}
              </div>

              <div>
                <b>💰</b> R$ {item.valor_mensal}
              </div>

              <div>
                <b>📅</b> {item.proximo_vencimento}
              </div>
            </div>

            <div className="flex gap-3 mt-5 flex-wrap">
              <button
                onClick={() => toggleBloqueio(item.id, item.bloqueado)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold"
              >
                {item.bloqueado ? "DESBLOQUEAR" : "BLOQUEAR"}
              </button>

              <button
                onClick={() => alert("Em breve: editar")}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold"
              >
                EDITAR
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}