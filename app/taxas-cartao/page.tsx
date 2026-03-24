"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type SessionUser = {
  id?: string;
  empresa_id: string;
  role?: string | null;
};

type UsuarioPermissao = {
  id?: string;
  empresa_id?: string;
  usuario_id?: string;
  modulo: string;
  pode_ver: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
};

type TaxaCartao = {
  id: string;
  empresa_id: string;
  nome: string;
  tipo_cartao?: string | null;
  bandeira?: string | null;
  taxa_percentual?: number | null;
  prazo_recebimento_dias?: number | null;
  status?: string | null;
  created_at?: string | null;
};

function up(v: unknown) {
  return String(v ?? "").toUpperCase();
}

function toNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function percentBR(v: number) {
  return `${v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}%`;
}

function normalizarModulo(modulo?: string | null) {
  return String(modulo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export default function TaxasCartaoPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [taxas, setTaxas] = useState<TaxaCartao[]>([]);
  const [busca, setBusca] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [tipoCartao, setTipoCartao] = useState("DEBITO");
  const [bandeira, setBandeira] = useState("");
  const [taxaPercentual, setTaxaPercentual] = useState("");
  const [prazoRecebimentoDias, setPrazoRecebimentoDias] = useState("");
  const [status, setStatus] = useState("ATIVO");

  useEffect(() => {
    async function init() {
      const user = (await getSessionUser()) as SessionUser | null;

      if (!user) {
        router.push("/login");
        return;
      }

      const role = String(user.role || "").toUpperCase();
      const isMaster = role === "MASTER";
      const isAdmin = role === "ADMIN";

      if (isMaster || isAdmin) {
        setEmpresaId(user.empresa_id);
        await carregarBase(user.empresa_id);
        setReady(true);
        return;
      }

      if (!user.id || !user.empresa_id) {
        router.push("/dashboard");
        return;
      }

      const { data: permissoes, error } = await supabase
        .from("usuarios_permissoes")
        .select("*")
        .eq("empresa_id", user.empresa_id)
        .eq("usuario_id", user.id);

      if (error) {
        router.push("/dashboard");
        return;
      }

      const podeVer = (permissoes || []).some(
        (p: UsuarioPermissao) =>
          normalizarModulo(p.modulo) === "TAXAS_CARTAO" && p.pode_ver
      );

      if (!podeVer) {
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
      .from("taxas_cartao")
      .select("*")
      .eq("empresa_id", eid)
      .order("created_at", { ascending: false });

    if (error) {
      alert("ERRO AO CARREGAR TAXAS: " + error.message);
      setTaxas([]);
      setLoading(false);
      return;
    }

    setTaxas((data || []) as TaxaCartao[]);
    setLoading(false);
  }

  function limparFormulario() {
    setEditingId(null);
    setNome("");
    setTipoCartao("DEBITO");
    setBandeira("");
    setTaxaPercentual("");
    setPrazoRecebimentoDias("");
    setStatus("ATIVO");
  }

  function preencherFormulario(item: TaxaCartao) {
    setEditingId(item.id);
    setNome(item.nome || "");
    setTipoCartao(item.tipo_cartao || "DEBITO");
    setBandeira(item.bandeira || "");
    setTaxaPercentual(String(toNumber(item.taxa_percentual)));
    setPrazoRecebimentoDias(String(toNumber(item.prazo_recebimento_dias)));
    setStatus(item.status || "ATIVO");
  }

  async function salvarTaxa() {
    if (!empresaId) return;

    if (!nome.trim()) {
      alert("PREENCHA O NOME DA TAXA.");
      return;
    }

    const percentual = toNumber(taxaPercentual);

    if (percentual < 0) {
      alert("A TAXA PERCENTUAL NÃO PODE SER NEGATIVA.");
      return;
    }

    const payload = {
      empresa_id: empresaId,
      nome: up(nome),
      tipo_cartao: up(tipoCartao),
      bandeira: up(bandeira),
      taxa_percentual: percentual,
      prazo_recebimento_dias: toNumber(prazoRecebimentoDias),
      status: up(status),
    };

    if (editingId) {
      const { error } = await supabase
        .from("taxas_cartao")
        .update(payload)
        .eq("empresa_id", empresaId)
        .eq("id", editingId);

      if (error) {
        alert("ERRO AO ATUALIZAR TAXA: " + error.message);
        return;
      }

      alert("TAXA ATUALIZADA!");
    } else {
      const { error } = await supabase.from("taxas_cartao").insert([payload]);

      if (error) {
        alert("ERRO AO CRIAR TAXA: " + error.message);
        return;
      }

      alert("TAXA CRIADA!");
    }

    limparFormulario();
    await carregarBase();
  }

  async function removerTaxa(id: string) {
    if (!empresaId) return;
    if (!confirm("REMOVER ESTA TAXA?")) return;

    const { error } = await supabase
      .from("taxas_cartao")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("id", id);

    if (error) {
      alert("ERRO AO REMOVER TAXA: " + error.message);
      return;
    }

    alert("TAXA REMOVIDA!");
    if (editingId === id) limparFormulario();
    await carregarBase();
  }

  const taxasFiltradas = useMemo(() => {
    const q = up(busca.trim());
    if (!q) return taxas;

    return taxas.filter((item) =>
      up(
        `${item.nome || ""} ${item.tipo_cartao || ""} ${item.bandeira || ""} ${
          item.status || ""
        } ${item.taxa_percentual || ""} ${item.prazo_recebimento_dias || ""}`
      ).includes(q)
    );
  }, [taxas, busca]);

  const totalTaxas = useMemo(() => taxas.length, [taxas]);

  const taxasAtivas = useMemo(() => {
    return taxas.filter((item) => up(item.status || "") === "ATIVO").length;
  }, [taxas]);

  const taxaMedia = useMemo(() => {
    if (taxas.length === 0) return 0;
    const total = taxas.reduce((acc, item) => acc + toNumber(item.taxa_percentual), 0);
    return total / taxas.length;
  }, [taxas]);

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
                TAXAS DE CARTÃO
              </h1>
              <p className="mt-3 text-sm text-white/85">
                CADASTRE DÉBITO, CRÉDITO, BANDEIRAS, TAXAS E PRAZO DE RECEBIMENTO.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 min-w-0">
              <KpiMini titulo="TAXAS" valor={String(totalTaxas)} />
              <KpiMini titulo="ATIVAS" valor={String(taxasAtivas)} />
              <KpiMini titulo="TAXA MÉDIA" valor={percentBR(taxaMedia)} destaque />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
          <section className="card">
            <div className="section-header">
              <div>
                <h2 className="section-title">
                  {editingId ? "EDITAR TAXA" : "NOVA TAXA"}
                </h2>
                <p className="section-subtitle">
                  CADASTRE AS TAXAS DE DÉBITO, CRÉDITO E BANDEIRAS.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">NOME DA TAXA</label>
                <input
                  className="campo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="EX.: CRÉDITO VISA À VISTA"
                />
              </div>

              <div>
                <label className="label">TIPO DO CARTÃO</label>
                <select
                  className="campo"
                  value={tipoCartao}
                  onChange={(e) => setTipoCartao(e.target.value)}
                >
                  <option>DEBITO</option>
                  <option>CREDITO</option>
                  <option>CREDITO PARCELADO</option>
                </select>
              </div>

              <div>
                <label className="label">BANDEIRA</label>
                <input
                  className="campo"
                  value={bandeira}
                  onChange={(e) => setBandeira(e.target.value)}
                  placeholder="EX.: VISA / MASTERCARD / ELO"
                />
              </div>

              <div>
                <label className="label">TAXA %</label>
                <input
                  type="number"
                  step="0.0001"
                  className="campo"
                  value={taxaPercentual}
                  onChange={(e) => setTaxaPercentual(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="label">PRAZO DE RECEBIMENTO (DIAS)</label>
                <input
                  type="number"
                  className="campo"
                  value={prazoRecebimentoDias}
                  onChange={(e) => setPrazoRecebimentoDias(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="label">STATUS</label>
                <select className="campo" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option>ATIVO</option>
                  <option>INATIVO</option>
                </select>
              </div>

              <div className="flex gap-3 flex-wrap">
                <button className="botao-primary" onClick={salvarTaxa} type="button">
                  {editingId ? "ATUALIZAR TAXA" : "SALVAR TAXA"}
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
                <h2 className="section-title">TAXAS CADASTRADAS</h2>
                <p className="section-subtitle">
                  CONSULTE E EDITE AS TAXAS DE CARTÃO DA EMPRESA.
                </p>
              </div>
            </div>

            <input
              className="campo mb-4"
              placeholder="BUSCAR POR NOME, TIPO, BANDEIRA, STATUS, TAXA OU PRAZO..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />

            <div className="overflow-auto">
              <table className="tabela min-w-[1000px]">
                <thead>
                  <tr>
                    <th>NOME</th>
                    <th>TIPO</th>
                    <th>BANDEIRA</th>
                    <th>TAXA</th>
                    <th>PRAZO (DIAS)</th>
                    <th>STATUS</th>
                    <th>AÇÕES</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="empty-state">
                        CARREGANDO...
                      </td>
                    </tr>
                  ) : taxasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-state">
                        NENHUMA TAXA ENCONTRADA.
                      </td>
                    </tr>
                  ) : (
                    taxasFiltradas.map((item) => (
                      <tr key={item.id}>
                        <td className="font-bold">{item.nome || "-"}</td>
                        <td>{item.tipo_cartao || "-"}</td>
                        <td>{item.bandeira || "-"}</td>
                        <td className="font-black">{percentBR(toNumber(item.taxa_percentual))}</td>
                        <td>{toNumber(item.prazo_recebimento_dias)}</td>
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
                              onClick={() => removerTaxa(item.id)}
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

        .campo:focus {
          border-color: #0a6fd6;
          box-shadow: 0 0 0 4px rgba(10, 111, 214, 0.08);
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