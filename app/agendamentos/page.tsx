"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type Cliente = {
  id: string;
  nome: string;
};

type Veiculo = {
  id: string;
  cliente_id: string;
  placa?: string | null;
  marca?: string | null;
  modelo?: string | null;
  ano?: string | null;
  km_atual?: string | null;
};

type Agendamento = {
  id: string;
  empresa_id: string;
  cliente_id?: string | null;
  cliente_nome?: string | null;
  veiculo_id?: string | null;
  veiculo_descricao?: string | null;
  placa?: string | null;
  servico?: string | null;
  tecnico_responsavel?: string | null;
  data_agendamento: string;
  hora_agendamento?: string | null;
  status?: string | null;
  observacoes?: string | null;
  created_at?: string | null;
};

function up(v: any) {
  return String(v ?? "").toUpperCase();
}

function montarDescricaoVeiculo(v: Veiculo) {
  return [v.marca, v.modelo, v.ano].filter(Boolean).join(" / ");
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AgendamentosPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [veiculosCliente, setVeiculosCliente] = useState<Veiculo[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);

  const [busca, setBusca] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [clienteId, setClienteId] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [veiculoDescricao, setVeiculoDescricao] = useState("");
  const [placa, setPlaca] = useState("");
  const [servico, setServico] = useState("");
  const [tecnicoResponsavel, setTecnicoResponsavel] = useState("");
  const [dataAgendamento, setDataAgendamento] = useState(hojeISO());
  const [horaAgendamento, setHoraAgendamento] = useState("");
  const [status, setStatus] = useState("AGENDADO");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    async function init() {
      const user = await getSessionUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmpresaId(user.empresa_id);
      await carregarBase(user.empresa_id);
      setReady(true);
    }

    init();
  }, [router]);

  async function carregarBase(eid?: string) {
    const emp = eid || empresaId;
    if (!emp) return;

    setLoading(true);

    const [clientesResp, agendamentosResp] = await Promise.all([
      supabase
        .from("clientes")
        .select("id,nome")
        .eq("empresa_id", emp)
        .order("nome"),
      supabase
        .from("agendamentos")
        .select("*")
        .eq("empresa_id", emp)
        .order("data_agendamento", { ascending: true })
        .order("hora_agendamento", { ascending: true }),
    ]);

    if (clientesResp.error) {
      alert("ERRO CLIENTES: " + clientesResp.error.message);
    }

    if (agendamentosResp.error) {
      alert("ERRO AGENDAMENTOS: " + agendamentosResp.error.message);
    }

    setClientes((clientesResp.data || []) as Cliente[]);
    setAgendamentos((agendamentosResp.data || []) as Agendamento[]);
    setLoading(false);
  }

  async function carregarVeiculosCliente(idCliente: string) {
    if (!empresaId || !idCliente) {
      setVeiculosCliente([]);
      return;
    }

    const { data, error } = await supabase
      .from("veiculos")
      .select("id,cliente_id,placa,marca,modelo,ano,km_atual")
      .eq("empresa_id", empresaId)
      .eq("cliente_id", idCliente)
      .order("created_at", { ascending: false });

    if (error) {
      alert("ERRO AO CARREGAR VEÍCULOS: " + error.message);
      setVeiculosCliente([]);
      return;
    }

    setVeiculosCliente((data || []) as Veiculo[]);
  }

  const agendamentosFiltrados = useMemo(() => {
    const q = up(busca.trim());
    if (!q) return agendamentos;

    return agendamentos.filter((a) =>
      up(
        `${a.cliente_nome || ""} ${a.veiculo_descricao || ""} ${a.placa || ""} ${a.servico || ""} ${a.tecnico_responsavel || ""} ${a.status || ""}`
      ).includes(q)
    );
  }, [agendamentos, busca]);

  const resumo = useMemo(() => {
    return {
      total: agendamentos.length,
      agendados: agendamentos.filter((a) => up(a.status) === "AGENDADO").length,
      andamento: agendamentos.filter((a) => up(a.status) === "EM ANDAMENTO").length,
      concluidos: agendamentos.filter((a) => up(a.status) === "CONCLUÍDO").length,
    };
  }, [agendamentos]);

  function resetForm() {
    setEditingId(null);
    setClienteId("");
    setClienteNome("");
    setVeiculoId("");
    setVeiculoDescricao("");
    setPlaca("");
    setServico("");
    setTecnicoResponsavel("");
    setDataAgendamento(hojeISO());
    setHoraAgendamento("");
    setStatus("AGENDADO");
    setObservacoes("");
    setVeiculosCliente([]);
  }

  async function salvarAgendamento() {
    if (!empresaId) return;

    if (!clienteNome.trim()) {
      alert("SELECIONE UM CLIENTE.");
      return;
    }

    if (!servico.trim()) {
      alert("PREENCHA O SERVIÇO.");
      return;
    }

    const payload = {
      empresa_id: empresaId,
      cliente_id: clienteId || null,
      cliente_nome: up(clienteNome),
      veiculo_id: veiculoId || null,
      veiculo_descricao: up(veiculoDescricao),
      placa: up(placa),
      servico: up(servico),
      tecnico_responsavel: up(tecnicoResponsavel),
      data_agendamento: dataAgendamento,
      hora_agendamento: horaAgendamento,
      status: up(status),
      observacoes: up(observacoes),
    };

    if (editingId) {
      const { error } = await supabase
        .from("agendamentos")
        .update(payload)
        .eq("empresa_id", empresaId)
        .eq("id", editingId);

      if (error) {
        alert("ERRO AO ATUALIZAR AGENDAMENTO: " + error.message);
        return;
      }

      alert("AGENDAMENTO ATUALIZADO!");
      resetForm();
      carregarBase();
      return;
    }

    const { error } = await supabase.from("agendamentos").insert([payload]);

    if (error) {
      alert("ERRO AO CRIAR AGENDAMENTO: " + error.message);
      return;
    }

    alert("AGENDAMENTO CRIADO!");
    resetForm();
    carregarBase();
  }

  async function editarAgendamento(a: Agendamento) {
    setEditingId(a.id);
    setClienteId(a.cliente_id || "");
    setClienteNome(a.cliente_nome || "");
    setVeiculoId(a.veiculo_id || "");
    setVeiculoDescricao(a.veiculo_descricao || "");
    setPlaca(a.placa || "");
    setServico(a.servico || "");
    setTecnicoResponsavel(a.tecnico_responsavel || "");
    setDataAgendamento(a.data_agendamento || hojeISO());
    setHoraAgendamento(a.hora_agendamento || "");
    setStatus(a.status || "AGENDADO");
    setObservacoes(a.observacoes || "");

    if (a.cliente_id) {
      await carregarVeiculosCliente(a.cliente_id);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removerAgendamento(id: string) {
    if (!empresaId) return;
    if (!confirm("REMOVER ESTE AGENDAMENTO?")) return;

    const { error } = await supabase
      .from("agendamentos")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("id", id);

    if (error) {
      alert("ERRO AO REMOVER AGENDAMENTO: " + error.message);
      return;
    }

    alert("AGENDAMENTO REMOVIDO!");
    carregarBase();
  }

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F3F4F6]">
      <Sidebar />

      <main className="flex-1 min-w-0 p-6">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[26px] font-black text-[#6C757D] leading-none">
              AGENDAMENTOS
            </h1>
            <p className="text-[14px] text-[#6C757D] mt-2">
              CONTROLE DE SERVIÇOS AGENDADOS
            </p>
          </div>

          <input
            placeholder="BUSCAR AGENDAMENTO..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-[54px] w-[320px] xl:w-[380px] max-w-full rounded-2xl border border-[#2F2F2F] bg-white px-5 text-[18px] outline-none"
          />
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <CardKpi titulo="TOTAL" valor={String(resumo.total)} />
          <CardKpi titulo="AGENDADOS" valor={String(resumo.agendados)} />
          <CardKpi titulo="EM ANDAMENTO" valor={String(resumo.andamento)} />
          <CardKpi titulo="CONCLUÍDOS" valor={String(resumo.concluidos)} />
        </div>

        <section className="card mb-6">
          <h2 className="titulo mb-4">
            {editingId ? "EDITAR AGENDAMENTO" : "NOVO AGENDAMENTO"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select
              value={clienteId}
              onChange={async (e) => {
                const id = e.target.value;
                setClienteId(id);

                const c = clientes.find((x) => x.id === id);
                setClienteNome(c?.nome || "");

                setVeiculoId("");
                setVeiculoDescricao("");
                setPlaca("");

                if (id) {
                  await carregarVeiculosCliente(id);
                } else {
                  setVeiculosCliente([]);
                }
              }}
              className="campo md:col-span-2"
            >
              <option value="">SELECIONE O CLIENTE</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>

            <select
              value={veiculoId}
              onChange={(e) => {
                const id = e.target.value;
                setVeiculoId(id);

                const v = veiculosCliente.find((x) => x.id === id);
                if (v) {
                  setVeiculoDescricao(montarDescricaoVeiculo(v));
                  setPlaca(v.placa || "");
                } else {
                  setVeiculoDescricao("");
                  setPlaca("");
                }
              }}
              className="campo"
              disabled={!clienteId}
            >
              <option value="">SELECIONE O VEÍCULO</option>
              {veiculosCliente.map((v) => (
                <option key={v.id} value={v.id}>
                  {montarDescricaoVeiculo(v)} {v.placa ? `- ${v.placa}` : ""}
                </option>
              ))}
            </select>

            <input
              placeholder="PLACA"
              value={placa}
              onChange={(e) => setPlaca(e.target.value)}
              className="campo"
            />

            <input
              placeholder="SERVIÇO"
              value={servico}
              onChange={(e) => setServico(e.target.value)}
              className="campo md:col-span-2"
            />

            <input
              placeholder="TÉCNICO RESPONSÁVEL"
              value={tecnicoResponsavel}
              onChange={(e) => setTecnicoResponsavel(e.target.value)}
              className="campo"
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="campo"
            >
              <option value="AGENDADO">AGENDADO</option>
              <option value="EM ANDAMENTO">EM ANDAMENTO</option>
              <option value="CONCLUÍDO">CONCLUÍDO</option>
              <option value="CANCELADO">CANCELADO</option>
              <option value="CONVERTIDO">CONVERTIDO</option>
            </select>

            <div>
              <label className="label">DATA</label>
              <input
                type="date"
                value={dataAgendamento}
                onChange={(e) => setDataAgendamento(e.target.value)}
                className="campo"
              />
            </div>

            <div>
              <label className="label">HORA</label>
              <input
                type="time"
                value={horaAgendamento}
                onChange={(e) => setHoraAgendamento(e.target.value)}
                className="campo"
              />
            </div>

            <textarea
              placeholder="OBSERVAÇÕES"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="campo-textarea md:col-span-4"
            />
          </div>

          <div className="flex gap-3 mt-5 flex-wrap">
            <button onClick={salvarAgendamento} className="botao-azul" type="button">
              {editingId ? "ATUALIZAR AGENDAMENTO" : "SALVAR AGENDAMENTO"}
            </button>

            <button onClick={resetForm} className="botao" type="button">
              LIMPAR
            </button>
          </div>
        </section>

        <section className="card">
          <h2 className="titulo mb-4">LISTA DE AGENDAMENTOS</h2>

          <div className="overflow-auto">
            <table className="tabela min-w-[1350px]">
              <thead>
                <tr>
                  <th>DATA</th>
                  <th>HORA</th>
                  <th>CLIENTE</th>
                  <th>VEÍCULO</th>
                  <th>PLACA</th>
                  <th>SERVIÇO</th>
                  <th>TÉCNICO</th>
                  <th>STATUS</th>
                  <th>AÇÕES</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-6 text-[#6C757D]">
                      CARREGANDO...
                    </td>
                  </tr>
                ) : agendamentosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-6 text-[#6C757D]">
                      NENHUM AGENDAMENTO ENCONTRADO.
                    </td>
                  </tr>
                ) : (
                  agendamentosFiltrados.map((a) => (
                    <tr key={a.id}>
                      <td>{a.data_agendamento || "-"}</td>
                      <td>{a.hora_agendamento || "-"}</td>
                      <td>{a.cliente_nome || "-"}</td>
                      <td>{a.veiculo_descricao || "-"}</td>
                      <td>{a.placa || "-"}</td>
                      <td>{a.servico || "-"}</td>
                      <td>{a.tecnico_responsavel || "-"}</td>
                      <td>{a.status || "-"}</td>
                      <td>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => editarAgendamento(a)}
                            className="botao-mini"
                            type="button"
                          >
                            EDITAR
                          </button>

                          <button
                            onClick={() =>
                              router.push(
                                `/ordens?cliente_id=${a.cliente_id || ""}&veiculo_id=${a.veiculo_id || ""}&agendamento_id=${a.id}`
                              )
                            }
                            className="botao-mini"
                            type="button"
                          >
                            CRIAR OS
                          </button>

                          <button
                            onClick={() => removerAgendamento(a.id)}
                            className="botao-mini"
                            type="button"
                          >
                            REMOVER
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
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

        .campo-textarea {
          border: 1.5px solid #9a9a9a;
          border-radius: 10px;
          padding: 10px;
          font-size: 14px;
          width: 100%;
          min-height: 120px;
          background: white;
          color: #111827;
          resize: vertical;
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

        .botao-mini {
          border: 1px solid #2f2f2f;
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 11px;
          background: white;
          color: #1f1f1f;
          font-weight: 500;
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

function CardKpi({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="bg-white rounded-[22px] shadow-sm p-5 min-h-[110px]">
      <div className="text-[14px] font-bold text-[#6C757D]">{titulo}</div>
      <div className="mt-3 text-[24px] font-black text-[#111]">{valor}</div>
    </div>
  );
}