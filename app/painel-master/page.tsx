"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Assinatura = {
  id: string;
  nome_empresa: string;
  responsavel?: string;
  telefone?: string;
  plano?: string;
  valor_mensal?: number;
  proximo_vencimento?: string;
  status_assinatura?: string;
  bloqueado?: boolean;
};

function money(v: number = 0) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function PainelMaster() {
  const [dados, setDados] = useState<Assinatura[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setLoading(true);

    const { data } = await supabase
      .from("assinaturas")
      .select("*")
      .order("created_at", { ascending: false });

    setDados(data || []);
    setLoading(false);
  }

  async function marcarPago(a: Assinatura) {
    const hoje = new Date();
    const proximo = new Date();
    proximo.setMonth(proximo.getMonth() + 1);

    await supabase
      .from("assinaturas")
      .update({
        data_ultimo_pagamento: hoje.toISOString(),
        proximo_vencimento: proximo.toISOString(),
        status_assinatura: "ATIVO",
        bloqueado: false,
      })
      .eq("id", a.id);

    carregar();
  }

  async function bloquear(a: Assinatura) {
    await supabase
      .from("assinaturas")
      .update({
        bloqueado: true,
        status_assinatura: "BLOQUEADO",
      })
      .eq("id", a.id);

    carregar();
  }

  async function desbloquear(a: Assinatura) {
    await supabase
      .from("assinaturas")
      .update({
        bloqueado: false,
        status_assinatura: "ATIVO",
      })
      .eq("id", a.id);

    carregar();
  }

  const resumo = useMemo(() => {
    const ativos = dados.filter((d) => d.status_assinatura === "ATIVO").length;
    const bloqueados = dados.filter((d) => d.bloqueado).length;
    const total = dados.length;
    const faturamento = dados.reduce(
      (acc, d) => acc + (d.valor_mensal || 0),
      0
    );

    return { ativos, bloqueados, total, faturamento };
  }, [dados]);

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Painel Master SaaS</h1>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card titulo="Clientes" valor={resumo.total} />
        <Card titulo="Ativos" valor={resumo.ativos} />
        <Card titulo="Bloqueados" valor={resumo.bloqueados} />
        <Card titulo="MRR" valor={money(resumo.faturamento)} />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2">Empresa</th>
              <th>Responsável</th>
              <th>Plano</th>
              <th>Valor</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-4 text-center">
                  Carregando...
                </td>
              </tr>
            ) : (
              dados.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-2 font-bold">{a.nome_empresa}</td>
                  <td>{a.responsavel}</td>
                  <td>{a.plano}</td>
                  <td>{money(a.valor_mensal)}</td>
                  <td>{a.proximo_vencimento?.slice(0, 10)}</td>
                  <td>
                    <span
                      className={`px-2 py-1 rounded text-white text-xs ${
                        a.bloqueado
                          ? "bg-red-500"
                          : "bg-green-500"
                      }`}
                    >
                      {a.status_assinatura}
                    </span>
                  </td>

                  <td className="flex gap-2 p-2">
                    <button
                      onClick={() => marcarPago(a)}
                      className="bg-green-600 text-white px-2 py-1 rounded"
                    >
                      Pago
                    </button>

                    {!a.bloqueado ? (
                      <button
                        onClick={() => bloquear(a)}
                        className="bg-red-600 text-white px-2 py-1 rounded"
                      >
                        Bloquear
                      </button>
                    ) : (
                      <button
                        onClick={() => desbloquear(a)}
                        className="bg-blue-600 text-white px-2 py-1 rounded"
                      >
                        Desbloquear
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ titulo, valor }: any) {
  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <div className="text-gray-500 text-sm">{titulo}</div>
      <div className="text-2xl font-bold mt-2">{valor}</div>
    </div>
  );
}