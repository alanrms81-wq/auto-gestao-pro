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

function statusClass(status: string) {
  const s = up(status);
  if (s === "AGENDADO") return "status-agendado";
  if (s === "EM ANDAMENTO") return "status-andamento";
  if (s === "CONCLUÍDO") return "status-concluido";
  if (s === "CANCELADO") return "status-cancelado";
  if (s === "CONVERTIDO") return "status-convertido";
  return "status-agendado";
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
    <div className="min-h-screen flex bg-[#F4F6F8]">
      <Sidebar />

      <main className="flex-1 min-w-0 p-4 md:p-6">
        <div className="mb-6 rounded-[26px] bg-gradient-to-r from-[#0456A3] to-[#0A6FD6] p-5 md:p-6 text-white shadow-lg">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
            <div>
              <p className="text-[12px] font-bold tracking-[0.2em] opacity-80">
                AUTO GESTÃO PRO
              </p>
              <h1 className="mt-2 text-[28px] md:text-[34px] font-black leading-none">
                AGENDAMENTOS
              </h1>
              <p className="mt-3 text-sm text-white/85">
                CONTROLE DE SERVIÇOS AGENDADOS COM FLUXO RÁPIDO PARA CONVERSÃO EM OS
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
              <KpiMini titulo="TOTAL" valor={String(resumo.total)} />
              <KpiMini titulo="AGENDADOS" valor={String(resumo.agendados)} />
              <KpiMini titulo="ANDAMENTO" valor={String(resumo.andamento)} />
              <KpiMini titulo="CONCLUÍDOS" valor={String(resumo.concluidos)} destaque />
            </div>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-6">
          <div className="section-intro">
            <h2 className="section-title">PAINEL DE AGENDAMENTO</h2>
            <p className="section-subtitle">
              Cadastre, edite e acompanhe os serviços marcados para a oficina.
            </p>
          </div>

          <input
            placeholder="BUSCAR AGENDAMENTO..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-[54px] w-[320px] xl:w-[380px] max-w-full rounded-2xl border border-[#CBD5E1] bg-white px-5 text-[18px] text-[#0F172A] outline-none"
          />
        </div>

        <section className="card mb-6">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                {editingId ? "EDITAR AGENDAMENTO" : "NOVO AGENDAMENTO"}
              </h2>
              <p className="section-subtitle">
                Organize cliente, veículo, horário e equipe responsável.
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button onClick={salvarAgendamento} className="botao-azul" type="button">
                {editingId ? "ATUALIZAR AGENDAMENTO" : "SALVAR AGENDAMENTO"}
              </button>

              <button onClick={resetForm} className="botao" type="button">
                LIMPAR
              </button>
            </div>
          </div>

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

            <div className="placa-card">
              <span className="placa-label">PLACA</span>
              <span className="placa-valor">{placa || "--- ----"}</span>
            </div>

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

            <div className="md:col-span-2">
              <label className="label">RESUMO DO VEÍCULO</label>
              <input
                value={veiculoDescricao}
                onChange={(e) => setVeiculoDescricao(e.target.value)}
                className="campo"
                placeholder="MARCA / MODELO / ANO"
              />
            </div>

            <textarea
              placeholder="OBSERVAÇÕES"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="campo-textarea md:col-span-4"
            />
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">LISTA DE AGENDAMENTOS</h2>
              <p className="section-subtitle">
                Acompanhe o andamento e transforme rapidamente em ordem de serviço.
              </p>
            </div>
          </div>

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
                    <td colSpan={9} className="empty-state">
                      CARREGANDO...
                    </td>
                  </tr>
                ) : agendamentosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty-state">
                      NENHUM AGENDAMENTO ENCONTRADO.
                    </td>
                  </tr>
                ) : (
                  agendamentosFiltrados.map((a) => (
                    <tr key={a.id}>
                      <td className="font-semibold">{a.data_agendamento || "-"}</td>
                      <td>{a.hora_agendamento || "-"}</td>
                      <td>{a.cliente_nome || "-"}</td>
                      <td>{a.veiculo_descricao || "-"}</td>
                      <td>{a.placa || "-"}</td>
                      <td>{a.servico || "-"}</td>
                      <td>{a.tecnico_responsavel || "-"}</td>
                      <td>
                        <span className={`status-chip ${statusClass(a.status || "AGENDADO")}`}>
                          {a.status || "-"}
                        </span>
                      </td>
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
                            className="botao-mini success"
                            type="button"
                          >
                            CRIAR OS
                          </button>

                          <button
                            onClick={() => removerAgendamento(a.id)}
                            className="botao-mini danger"
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
          border-radius: 24px;
          padding: 20px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
          border: 1px solid #eef2f7;
        }

        .section-intro {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }

        .section-title {
          font-weight: 900;
          font-size: 15px;
          color: #334155;
        }

        .section-subtitle {
          margin-top: 4px;
          font-size: 12px;
          color: #64748b;
        }

        .label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          color: #64748b;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .campo {
          height: 46px;
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          padding: 0 12px;
          font-size: 14px;
          width: 100%;
          background: white;
          color: #0f172a;
          outline: none;
          transition: 0.2s;
        }

        .campo:focus,
        .campo-textarea:focus {
          border-color: #0a6fd6;
          box-shadow: 0 0 0 4px rgba(10, 111, 214, 0.08);
        }

        .campo-textarea {
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          padding: 12px;
          font-size: 14px;
          width: 100%;
          min-height: 120px;
          background: white;
          color: #0f172a;
          resize: vertical;
          outline: none;
        }

        .botao {
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 13px;
          background: white;
          color: #1e293b;
          font-weight: 700;
        }

        .botao-azul {
          background: #0456a3;
          color: white;
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 700;
          border: none;
        }

        .botao-mini {
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 6px 10px;
          font-size: 11px;
          background: white;
          color: #1e293b;
          font-weight: 700;
        }

        .botao-mini.success {
          border-color: #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        .botao-mini.danger {
          border-color: #fecaca;
          background: #fef2f2;
          color: #b91c1c;
        }

        .tabela {
          width: 100%;
          border-collapse: collapse;
        }

        .tabela th {
          text-align: left;
          font-size: 12px;
          padding: 13px 12px;
          border-bottom: 1px solid #e2e8f0;
          color: #334155;
          font-weight: 900;
          background: #f8fafc;
        }

        .tabela td {
          font-size: 13px;
          padding: 12px;
          border-bottom: 1px solid #eef2f7;
          color: #334155;
          vertical-align: middle;
        }

        .empty-state {
          text-align: center;
          padding: 28px 12px;
          color: #64748b;
        }

        .placa-card {
          min-height: 46px;
          border: 1.5px solid #bfdbfe;
          background: #eff6ff;
          border-radius: 14px;
          padding: 8px 14px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .placa-label {
          font-size: 10px;
          font-weight: 800;
          color: #1d4ed8;
          letter-spacing: 0.12em;
        }

        .placa-valor {
          font-size: 20px;
          font-weight: 900;
          color: #0f172a;
          line-height: 1.1;
        }

        .status-chip {
          display: inline-flex;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 900;
        }

        .status-agendado {
          background: #e0f2fe;
          color: #0369a1;
        }

        .status-andamento {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .status-concluido {
          background: #dcfce7;
          color: #15803d;
        }

        .status-cancelado {
          background: #fee2e2;
          color: #b91c1c;
        }

        .status-convertido {
          background: #ede9fe;
          color: #6d28d9;
        }
      `}</style>
    </div>
  );
}

function KpiMini({
  titulo,
  valor,
  destaque = false,
}: {
  titulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-[18px] px-4 py-3 ${
        destaque ? "bg-white text-[#0456A3]" : "bg-white/12 text-white border border-white/15"
      }`}
    >
      <div className="text-[10px] font-bold tracking-[0.12em] opacity-80">{titulo}</div>
      <div className="mt-1 text-[18px] font-black leading-none">{valor}</div>
    </div>
  );
}