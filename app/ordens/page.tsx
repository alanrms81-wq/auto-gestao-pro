"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

/* =========================
   HELPERS
========================= */

function moneyBR(v: number) {
  return (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function isPagamentoImediato(f: string) {
  const v = (f || "").toUpperCase();

  return (
    v.includes("DINHEIRO") ||
    v.includes("PIX") ||
    v.includes("CARTÃO") ||
    v.includes("CARTAO") ||
    v.includes("TRANSFER")
  );
}

function getStatusFinanceiro(f: string) {
  return isPagamentoImediato(f) ? "PAGO" : "ABERTO";
}

/* =========================
   COMPONENTE
========================= */

export default function OSPage() {
  const router = useRouter();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const [ordens, setOrdens] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const [cliente, setCliente] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("DINHEIRO");
  const [total, setTotal] = useState(0);

  /* =========================
     INIT
  ========================= */

  useEffect(() => {
    async function init() {
      const user = await getSessionUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmpresaId(user.empresa_id);
      await carregarOrdens(user.empresa_id);
      setReady(true);
    }

    init();
  }, []);

  async function carregarOrdens(empId: string) {
    const { data } = await supabase
      .from("ordens_servico")
      .select("*")
      .eq("empresa_id", empId)
      .order("created_at", { ascending: false });

    setOrdens(data || []);
  }

  /* =========================
     AÇÕES
  ========================= */

  function novaOS() {
    setEditing(null);
    setCliente("");
    setFormaPagamento("DINHEIRO");
    setTotal(0);
    setModalOpen(true);
  }

  function editarOS(o: any) {
    setEditing(o);
    setCliente(o.cliente_nome || "");
    setFormaPagamento(o.forma_pagamento || "DINHEIRO");
    setTotal(o.total || 0);
    setModalOpen(true);
  }

  async function salvarOS() {
    if (!empresaId) return;

    if (!cliente) return alert("Digite o cliente");

    if (editing) {
      await supabase
        .from("ordens_servico")
        .update({
          cliente_nome: cliente,
          forma_pagamento: formaPagamento,
          total,
        })
        .eq("id", editing.id);
    } else {
      await supabase.from("ordens_servico").insert([
        {
          empresa_id: empresaId,
          cliente_nome: cliente,
          forma_pagamento: formaPagamento,
          total,
          status: "ABERTA",
        },
      ]);
    }

    setModalOpen(false);
    await carregarOrdens(empresaId);
  }

  /* =========================
     FATURAMENTO (SaaS)
  ========================= */

  async function faturarOS(os: any) {
    if (!empresaId) return;

    if (os.faturado) {
      alert("Já faturada");
      return;
    }

    const pagamentoImediato = isPagamentoImediato(os.forma_pagamento);

    // FINANCEIRO
    await supabase.from("financeiro_titulos").insert([
      {
        empresa_id: empresaId,
        tipo: "RECEBER",
        descricao: `OS ${os.numero || ""}`,
        cliente_nome: os.cliente_nome,
        valor_original: os.total,
        valor_pago: pagamentoImediato ? os.total : 0,
        data_emissao: hojeISO(),
        data_vencimento: hojeISO(),
        data_pagamento: pagamentoImediato ? hojeISO() : null,
        status: getStatusFinanceiro(os.forma_pagamento),
      },
    ]);

    // MARCAR FATURADA
    await supabase
      .from("ordens_servico")
      .update({
        faturado: true,
        data_faturamento: hojeISO(),
      })
      .eq("id", os.id);

    alert("Faturado com sucesso!");
    await carregarOrdens(empresaId);
  }

  function imprimir(id: string) {
    window.open(`/ordens/imprimir?id=${id}`);
  }

  function imprimirTecnico(id: string) {
    window.open(`/ordens/imprimir-tecnico?id=${id}`);
  }

  if (!ready) return <div className="p-6">Carregando...</div>;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="flex justify-between mb-6">
          <h1 className="text-2xl font-bold">Ordens de Serviço</h1>

          <button
            onClick={novaOS}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl"
          >
            Nova OS
          </button>
        </div>

        {/* LISTA */}
        <div className="bg-white rounded-xl shadow">
          <table className="w-full">
            <thead className="bg-gray-50 text-sm">
              <tr>
                <th className="p-3">Cliente</th>
                <th>Total</th>
                <th>Status</th>
                <th>Financeiro</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {ordens.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="p-3">{o.cliente_nome}</td>
                  <td>{moneyBR(o.total)}</td>
                  <td>{o.status}</td>

                  <td>
                    {o.faturado ? "FATURADO" : "PENDENTE"}
                  </td>

                  <td className="flex gap-2 p-2">
                    <button onClick={() => editarOS(o)}>Editar</button>

                    <button onClick={() => faturarOS(o)}>
                      {o.faturado ? "Faturada" : "Faturar"}
                    </button>

                    <button onClick={() => imprimir(o.id)}>OS</button>
                    <button onClick={() => imprimirTecnico(o.id)}>
                      Técnico
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* MODAL */}
        {modalOpen && (
          <div className="modal-bg" onClick={() => setModalOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editing ? "Editar OS" : "Nova OS"}</h2>
                <button onClick={() => setModalOpen(false)}>X</button>
              </div>

              <div className="modal-body">
                <input
                  placeholder="Cliente"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                />

                <input
                  type="number"
                  placeholder="Total"
                  value={total}
                  onChange={(e) => setTotal(Number(e.target.value))}
                />

                <select
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                >
                  <option>DINHEIRO</option>
                  <option>PIX</option>
                  <option>CARTÃO</option>
                  <option>BOLETO</option>
                  <option>FIADO</option>
                </select>

                <div>
                  Financeiro:{" "}
                  <strong>{getStatusFinanceiro(formaPagamento)}</strong>
                </div>
              </div>

              <div className="modal-footer">
                <button onClick={salvarOS}>Salvar</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .modal-bg {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal {
          background: white;
          width: 500px;
          border-radius: 20px;
        }

        .modal-header {
          background: #0a6fd6;
          color: white;
          padding: 15px;
          display: flex;
          justify-content: space-between;
        }

        .modal-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .modal-footer {
          padding: 15px;
          text-align: right;
        }

        input,
        select {
          padding: 10px;
          border-radius: 10px;
          border: 1px solid #ddd;
        }
      `}</style>
    </div>
  );
}