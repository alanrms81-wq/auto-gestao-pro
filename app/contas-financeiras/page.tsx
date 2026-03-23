"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type SessionUser = {
  empresa_id: string;
  role?: string | null;
};

type ContaFinanceira = {
  id: string;
  empresa_id: string;
  nome: string;
  tipo?: string | null;
  banco?: string | null;
  agencia?: string | null;
  numero_conta?: string | null;
  saldo_inicial?: number | null;
  saldo_atual?: number | null;
  status?: string | null;
  observacoes?: string | null;
  created_at?: string | null;
};

function up(v: unknown) {
  return String(v ?? "").toUpperCase();
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

export default function ContasFinanceirasPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [busca, setBusca] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("CONTA CORRENTE");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [numeroConta, setNumeroConta] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [saldoAtual, setSaldoAtual] = useState("");
  const [status, setStatus] = useState("ATIVO");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    async function init() {
      const user = (await getSessionUser()) as SessionUser | null;

      if (!user) {
        router.push("/login");
        return;
      }

      const isAdmin = String(user.role || "").toUpperCase() === "ADMIN";

      if (!isAdmin) {
        router.push("/dashboard");
        return;
      }

      setEmpresaId(user.empresa_id);
      await carregarBase(user.empresa_id);
      setReady(true);
    }

    init();
  }, [router]);

  async function carregarBase(empId?: string) {
    const eid = empId || empresaId;
    if (!eid) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("contas_financeiras")
      .select("*")
      .eq("empresa_id", eid)
      .order("created_at", { ascending: false });

    if (error) {
      alert("ERRO AO CARREGAR CONTAS: " + error.message);
      setContas([]);
      setLoading(false);
      return;
    }

    setContas((data || []) as ContaFinanceira[]);
    setLoading(false);
  }

  function limparFormulario() {
    setEditingId(null);
    setNome("");
    setTipo("CONTA CORRENTE");
    setBanco("");
    setAgencia("");
    setNumeroConta("");
    setSaldoInicial("");
    setSaldoAtual("");
    setStatus("ATIVO");
    setObservacoes("");
  }

  function preencherFormulario(item: ContaFinanceira) {
    setEditingId(item.id);
    setNome(item.nome || "");
    setTipo(item.tipo || "CONTA CORRENTE");
    setBanco(item.banco || "");
    setAgencia(item.agencia || "");
    setNumeroConta(item.numero_conta || "");
    setSaldoInicial(String(toMoney(item.saldo_inicial)));
    setSaldoAtual(String(toMoney(item.saldo_atual)));
    setStatus(item.status || "ATIVO");
    setObservacoes(item.observacoes || "");
  }

  async function salvarConta() {
    if (!empresaId) return;

    if (!nome.trim()) {
      alert("PREENCHA O NOME DA CONTA.");
      return;
    }

    const payload = {
      empresa_id: empresaId,
      nome: up(nome),
      tipo: up(tipo),
      banco: up(banco),
      agencia: agencia.trim(),
      numero_conta: numeroConta.trim(),
      saldo_inicial: toMoney(saldoInicial),
      saldo_atual: saldoAtual.trim() === "" ? toMoney(saldoInicial) : toMoney(saldoAtual),
      status: up(status),
      observacoes: up(observacoes),
    };

    if (editingId) {
      const { error } = await supabase
        .from("contas_financeiras")
        .update(payload)
        .eq("empresa_id", empresaId)
        .eq("id", editingId);

      if (error) {
        alert("ERRO AO ATUALIZAR CONTA: " + error.message);
        return;
      }

      alert("CONTA ATUALIZADA!");
    } else {
      const { error } = await supabase.from("contas_financeiras").insert([payload]);

      if (error) {
        alert("ERRO AO CRIAR CONTA: " + error.message);
        return;
      }

      alert("CONTA CRIADA!");
    }

    limparFormulario();
    await carregarBase();
  }

  async function removerConta(id: string) {
    if (!empresaId) return;
    if (!confirm("REMOVER ESTA CONTA?")) return;

    const { error } = await supabase
      .from("contas_financeiras")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("id", id);

    if (error) {
      alert("ERRO AO REMOVER CONTA: " + error.message);
      return;
    }

    alert("CONTA REMOVIDA!");
    if (editingId === id) limparFormulario();
    await carregarBase();
  }

  const contasFiltradas = useMemo(() => {
    const q = up(busca.trim());
    if (!q) return contas;

    return contas.filter((item) =>
      up(
        `${item.nome || ""} ${item.tipo || ""} ${item.banco || ""} ${item.agencia || ""} ${item.numero_conta || ""} ${item.status || ""}`
      ).includes(q)
    );
  }, [contas, busca]);

  const totalContas = useMemo(() => contas.length, [contas]);

  const saldoTotal = useMemo(() => {
    return contas.reduce((acc, item) => acc + toMoney(item.saldo_atual), 0);
  }, [contas]);

  const contasAtivas = useMemo(() => {
    return contas.filter((item) => up(item.status || "") === "ATIVO").length;
  }, [contas]);

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F4F6F8]">
      <Sidebar />

      <main className="flex-1 p-4 md:p-6">
        <div className="mb-6 rounded-[28px] bg-gradient-to-r from-[#0456A3] to-[#0A6FD6] p-6 text-white shadow-[0_20px_50px_rgba(4,86,163,0.25)]">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
            <div>
              <p className="text-[12px] font-black tracking-[0.22em] opacity-80">
                AUTO GESTÃO PRO
              </p>
              <h1 className="mt-2 text-[30px] md:text-[36px] font-black leading-none">
                CONTAS FINANCEIRAS
              </h1>
              <p className="mt-3 text-sm text-white/85">
                CADASTRE CAIXA, BANCOS E CONTAS PARA CONTROLAR ENTRADAS E SALDOS.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 min-w-0">
              <KpiMini titulo="CONTAS" valor={String(totalContas)} />
              <KpiMini titulo="ATIVAS" valor={String(contasAtivas)} />
              <KpiMini titulo="SALDO TOTAL" valor={moneyBR(saldoTotal)} destaque />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
          <section className="card">
            <div className="section-header">
              <div>
                <h2 className="section-title">
                  {editingId ? "EDITAR CONTA" : "NOVA CONTA"}
                </h2>
                <p className="section-subtitle">
                  CADASTRE CAIXA, BANCOS, CARTEIRAS E SALDO INICIAL.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">NOME DA CONTA</label>
                <input
                  className="campo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="EX.: CAIXA PRINCIPAL"
                />
              </div>

              <div>
                <label className="label">TIPO</label>
                <select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  <option>CAIXA</option>
                  <option>CONTA CORRENTE</option>
                  <option>POUPANÇA</option>
                  <option>CARTEIRA DIGITAL</option>
                  <option>OUTRO</option>
                </select>
              </div>

              <div>
                <label className="label">BANCO</label>
                <input
                  className="campo"
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  placeholder="EX.: ITAÚ / NUBANK / INTER"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">AGÊNCIA</label>
                  <input
                    className="campo"
                    value={agencia}
                    onChange={(e) => setAgencia(e.target.value)}
                    placeholder="0001"
                  />
                </div>

                <div>
                  <label className="label">CONTA</label>
                  <input
                    className="campo"
                    value={numeroConta}
                    onChange={(e) => setNumeroConta(e.target.value)}
                    placeholder="12345-6"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">SALDO INICIAL</label>
                  <input
                    type="number"
                    step="0.01"
                    className="campo"
                    value={saldoInicial}
                    onChange={(e) => setSaldoInicial(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="label">SALDO ATUAL</label>
                  <input
                    type="number"
                    step="0.01"
                    className="campo"
                    value={saldoAtual}
                    onChange={(e) => setSaldoAtual(e.target.value)}
                    placeholder="SE VAZIO, USA O SALDO INICIAL"
                  />
                </div>
              </div>

              <div>
                <label className="label">STATUS</label>
                <select className="campo" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option>ATIVO</option>
                  <option>INATIVO</option>
                </select>
              </div>

              <div>
                <label className="label">OBSERVAÇÕES</label>
                <textarea
                  className="campo-textarea"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="DETALHES INTERNOS DA CONTA..."
                />
              </div>

              <div className="flex gap-3 flex-wrap">
                <button className="botao-primary" onClick={salvarConta} type="button">
                  {editingId ? "ATUALIZAR CONTA" : "SALVAR CONTA"}
                </button>

                <button className="botao" onClick={limparFormulario} type="button">
                  LIMPAR
                </button>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="section-header">
              <div>
                <h2 className="section-title">CONTAS CADASTRADAS</h2>
                <p className="section-subtitle">
                  CONSULTE SALDOS E EDITE AS CONTAS DA EMPRESA.
                </p>
              </div>
            </div>

            <input
              className="campo mb-4"
              placeholder="BUSCAR POR NOME, TIPO, BANCO, AGÊNCIA, CONTA OU STATUS..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />

            <div className="overflow-auto">
              <table className="tabela min-w-[1000px]">
                <thead>
                  <tr>
                    <th>NOME</th>
                    <th>TIPO</th>
                    <th>BANCO</th>
                    <th>AGÊNCIA / CONTA</th>
                    <th>SALDO INICIAL</th>
                    <th>SALDO ATUAL</th>
                    <th>STATUS</th>
                    <th>AÇÕES</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="empty-state">
                        CARREGANDO...
                      </td>
                    </tr>
                  ) : contasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty-state">
                        NENHUMA CONTA ENCONTRADA.
                      </td>
                    </tr>
                  ) : (
                    contasFiltradas.map((item) => (
                      <tr key={item.id}>
                        <td className="font-bold">{item.nome || "-"}</td>
                        <td>{item.tipo || "-"}</td>
                        <td>{item.banco || "-"}</td>
                        <td>
                          {(item.agencia || "-") + " / " + (item.numero_conta || "-")}
                        </td>
                        <td>{moneyBR(toMoney(item.saldo_inicial))}</td>
                        <td className="font-black">{moneyBR(toMoney(item.saldo_atual))}</td>
                        <td>{item.status || "-"}</td>
                        <td>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              className="botao-mini"
                              onClick={() => preencherFormulario(item)}
                              type="button"
                            >
                              EDITAR
                            </button>

                            <button
                              className="botao-mini danger"
                              onClick={() => removerConta(item.id)}
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
        </div>
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
          margin-bottom: 16px;
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
          background: #fff;
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
          outline: none;
          resize: vertical;
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

        .botao-primary {
          border: none;
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 13px;
          background: #0456a3;
          color: white;
          font-weight: 900;
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