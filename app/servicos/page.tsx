"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";
import { useRouter } from "next/navigation";

type Servico = {
  id: string;
  empresa_id?: string | null;
  nome: string;
  descricao?: string | null;
  categoria?: string | null;
  valor?: number | null;
  tempo_estimado?: string | null;
  observacoes?: string | null;
  status?: string | null;
  created_at?: string | null;
};

function up(v: unknown) {
  return String(v || "").toUpperCase().trim();
}

function toMoney(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function moneyBR(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function ServicosPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [busca, setBusca] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valor, setValor] = useState("0");
  const [tempo, setTempo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState("ATIVO");

  useEffect(() => {
    async function init() {
      const user = await getSessionUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmpresaId(user.empresa_id);
      await carregarServicos(user.empresa_id);
      setReady(true);
    }

    init();
  }, [router]);

  async function carregarServicos(eid?: string) {
    const emp = eid || empresaId;
    if (!emp) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("servicos")
      .select("*")
      .eq("empresa_id", emp)
      .order("nome");

    if (error) {
      alert("ERRO AO CARREGAR SERVIÇOS: " + error.message);
      setLoading(false);
      return;
    }

    setServicos((data || []) as Servico[]);
    setLoading(false);
  }

  function resetForm() {
    setEditingId(null);
    setNome("");
    setDescricao("");
    setCategoria("");
    setValor("0");
    setTempo("");
    setObservacoes("");
    setStatus("ATIVO");
  }

  async function salvarServico() {
    if (!empresaId) return;

    if (!nome.trim()) {
      alert("PREENCHA O NOME DO SERVIÇO.");
      return;
    }

    const payload = {
      empresa_id: empresaId,
      nome: up(nome),
      descricao: up(descricao),
      categoria: up(categoria),
      valor: toMoney(valor),
      tempo_estimado: tempo.trim(),
      observacoes: up(observacoes),
      status: up(status),
    };

    if (editingId) {
      const { error } = await supabase
        .from("servicos")
        .update(payload)
        .eq("id", editingId)
        .eq("empresa_id", empresaId);

      if (error) {
        alert("ERRO AO ATUALIZAR SERVIÇO: " + error.message);
        return;
      }

      alert("SERVIÇO ATUALIZADO!");
    } else {
      const { error } = await supabase.from("servicos").insert([payload]);

      if (error) {
        alert("ERRO AO CRIAR SERVIÇO: " + error.message);
        return;
      }

      alert("SERVIÇO CADASTRADO!");
    }

    resetForm();
    await carregarServicos();
  }

  function editarServico(s: Servico) {
    setEditingId(s.id);
    setNome(s.nome || "");
    setDescricao(s.descricao || "");
    setCategoria(s.categoria || "");
    setValor(String(s.valor || 0));
    setTempo(s.tempo_estimado || "");
    setObservacoes(s.observacoes || "");
    setStatus(s.status || "ATIVO");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removerServico(id: string) {
    if (!empresaId) return;
    if (!confirm("REMOVER ESTE SERVIÇO?")) return;

    const { error } = await supabase
      .from("servicos")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      alert("ERRO AO REMOVER SERVIÇO: " + error.message);
      return;
    }

    alert("SERVIÇO REMOVIDO!");

    if (editingId === id) {
      resetForm();
    }

    await carregarServicos();
  }

  const servicosFiltrados = useMemo(() => {
    const q = up(busca);
    if (!q) return servicos;

    return servicos.filter((s) =>
      up(`${s.nome} ${s.categoria || ""} ${s.descricao || ""} ${s.status || ""}`).includes(q)
    );
  }, [servicos, busca]);

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F4F6F8]">
      <Sidebar />

      <main className="flex-1 p-4 md:p-6">
        <div className="mb-6 rounded-[26px] bg-gradient-to-r from-[#0456A3] to-[#0A6FD6] p-5 md:p-6 text-white shadow-lg">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
            <div>
              <p className="text-[12px] font-bold tracking-[0.2em] opacity-80">
                AUTO GESTÃO PRO
              </p>
              <h1 className="mt-2 text-[28px] md:text-[34px] font-black leading-none">
                SERVIÇOS
              </h1>
              <p className="mt-3 text-sm text-white/85">
                CADASTRO DE SERVIÇOS, MÃO DE OBRA E INSTALAÇÕES
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 min-w-0">
              <KpiMini titulo="TOTAL" valor={String(servicos.length)} />
              <KpiMini
                titulo="ATIVOS"
                valor={String(servicos.filter((s) => up(s.status) === "ATIVO").length)}
              />
              <KpiMini titulo="BUSCA" valor={busca ? "FILTRANDO" : "GERAL"} destaque />
            </div>
          </div>

          <div className="mt-5 flex gap-3 flex-wrap">
            <button onClick={salvarServico} className="botao-header-primary" type="button">
              {editingId ? "SALVAR ALTERAÇÕES" : "SALVAR SERVIÇO"}
            </button>

            <button onClick={resetForm} className="botao-header" type="button">
              NOVO SERVIÇO
            </button>

            <input
              placeholder="BUSCAR SERVIÇO..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-[48px] w-[320px] xl:w-[410px] max-w-full rounded-2xl border border-white/20 bg-white/10 px-5 text-[16px] text-white outline-none placeholder:text-white/70"
            />
          </div>
        </div>

        <section className="card mb-6">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                {editingId ? "EDITAR SERVIÇO" : "NOVO SERVIÇO"}
              </h2>
              <p className="section-subtitle">
                Cadastre serviços reutilizáveis para usar nas ordens de serviço.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              placeholder="NOME DO SERVIÇO"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="campo md:col-span-2"
            />

            <input
              placeholder="CATEGORIA"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="campo"
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="campo"
            >
              <option value="ATIVO">ATIVO</option>
              <option value="INATIVO">INATIVO</option>
            </select>

            <input
              placeholder="VALOR"
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="campo"
            />

            <input
              placeholder="TEMPO ESTIMADO"
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
              className="campo"
            />

            <textarea
              placeholder="DESCRIÇÃO"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="campo-textarea md:col-span-2"
            />

            <textarea
              placeholder="OBSERVAÇÕES"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="campo-textarea md:col-span-2"
            />
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">SERVIÇOS CADASTRADOS</h2>
              <p className="section-subtitle">
                Edite, remova e mantenha seus serviços organizados.
              </p>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="tabela min-w-[1000px]">
              <thead>
                <tr>
                  <th>NOME</th>
                  <th>CATEGORIA</th>
                  <th>VALOR</th>
                  <th>TEMPO</th>
                  <th>STATUS</th>
                  <th>AÇÕES</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      CARREGANDO...
                    </td>
                  </tr>
                ) : servicosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      NENHUM SERVIÇO ENCONTRADO.
                    </td>
                  </tr>
                ) : (
                  servicosFiltrados.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="font-bold text-[#111827]">{s.nome}</div>
                        <div className="text-xs text-[#64748B]">{s.descricao || "-"}</div>
                      </td>
                      <td>{s.categoria || "-"}</td>
                      <td className="font-bold">{moneyBR(toMoney(s.valor))}</td>
                      <td>{s.tempo_estimado || "-"}</td>
                      <td>{s.status || "ATIVO"}</td>
                      <td>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => editarServico(s)}
                            className="botao-mini"
                            type="button"
                          >
                            EDITAR
                          </button>

                          <button
                            onClick={() => removerServico(s.id)}
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
          padding: 10px 12px;
          font-size: 14px;
          width: 100%;
          min-height: 110px;
          background: white;
          color: #0f172a;
          resize: vertical;
          outline: none;
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

        .botao-mini.danger {
          border-color: #fecaca;
          background: #fef2f2;
          color: #b91c1c;
        }

        .botao-header {
          border: 1px solid rgba(255, 255, 255, 0.45);
          background: rgba(255, 255, 255, 0.12);
          color: white;
          font-weight: 800;
          border-radius: 14px;
          padding: 11px 16px;
          font-size: 13px;
          backdrop-filter: blur(10px);
        }

        .botao-header-primary {
          border: none;
          background: white;
          color: #0456a3;
          font-weight: 900;
          border-radius: 14px;
          padding: 11px 18px;
          font-size: 13px;
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