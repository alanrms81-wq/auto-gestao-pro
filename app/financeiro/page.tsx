"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type FinanceiroTitulo = {
  id: string;
  empresa_id: string;
  tipo: "RECEBER" | "PAGAR";
  descricao?: string | null;
  cliente_id?: string | null;
  cliente_nome?: string | null;
  documento?: string | null;
  categoria?: string | null;
  valor_original?: number | null;
  valor_pago?: number | null;
  desconto?: number | null;
  juros?: number | null;
  multa?: number | null;
  data_emissao?: string | null;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  status?: string | null;
  observacoes?: string | null;
  created_at?: string | null;
};

type Cliente = {
  id: string;
  nome: string;
};

function up(v: any) {
  return String(v ?? "").toUpperCase();
}

function toMoney(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function moneyBR(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function valorLiquidoTitulo(t: Partial<FinanceiroTitulo>) {
  return (
    toMoney(t.valor_original) +
    toMoney(t.juros) +
    toMoney(t.multa) -
    toMoney(t.desconto)
  );
}

function saldoAbertoTitulo(t: Partial<FinanceiroTitulo>) {
  return Math.max(0, valorLiquidoTitulo(t) - toMoney(t.valor_pago));
}

function statusFinanceiro(t: Partial<FinanceiroTitulo>) {
  const manual = up(t.status || "");

  if (manual === "CANCELADO") return "CANCELADO";

  const saldo = saldoAbertoTitulo(t);

  if (saldo <= 0) return "PAGO";
  if (toMoney(t.valor_pago) > 0) return "PARCIAL";
  if (t.data_vencimento && t.data_vencimento < hojeISO()) return "VENCIDO";
  return "ABERTO";
}

export default function FinanceiroPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [titulos, setTitulos] = useState<FinanceiroTitulo[]>([]);

  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [tipo, setTipo] = useState<"RECEBER" | "PAGAR">("RECEBER");
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valorOriginal, setValorOriginal] = useState("0");
  const [valorPago, setValorPago] = useState("0");
  const [desconto, setDesconto] = useState("0");
  const [juros, setJuros] = useState("0");
  const [multa, setMulta] = useState("0");
  const [dataEmissao, setDataEmissao] = useState(hojeISO());
  const [dataVencimento, setDataVencimento] = useState(hojeISO());
  const [dataPagamento, setDataPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [baixaId, setBaixaId] = useState<string | null>(null);
  const [baixaValor, setBaixaValor] = useState("0");
  const [baixaData, setBaixaData] = useState(hojeISO());
  const [baixaObs, setBaixaObs] = useState("");

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

  async function carregarBase(empId?: string) {
    const eid = empId || empresaId;
    if (!eid) return;

    setLoading(true);

    const [clientesResp, titulosResp] = await Promise.all([
      supabase.from("clientes").select("id,nome").eq("empresa_id", eid).order("nome"),
      supabase
        .from("financeiro_titulos")
        .select("*")
        .eq("empresa_id", eid)
        .order("data_vencimento", { ascending: true }),
    ]);

    if (clientesResp.error) {
      alert("ERRO CLIENTES: " + clientesResp.error.message);
    }

    if (titulosResp.error) {
      alert("ERRO FINANCEIRO: " + titulosResp.error.message);
    }

    setClientes((clientesResp.data || []) as Cliente[]);
    setTitulos((titulosResp.data || []) as FinanceiroTitulo[]);
    setLoading(false);
  }

  const titulosFiltrados = useMemo(() => {
    const q = up(busca.trim());

    return titulos.filter((t) => {
      const texto = up(
        `${t.tipo} ${t.descricao || ""} ${t.cliente_nome || ""} ${t.documento || ""} ${t.categoria || ""} ${statusFinanceiro(t)}`
      );

      const okBusca = !q || texto.includes(q);
      const okTipo = filtroTipo === "TODOS" || t.tipo === filtroTipo;
      const okStatus = filtroStatus === "TODOS" || statusFinanceiro(t) === filtroStatus;

      return okBusca && okTipo && okStatus;
    });
  }, [titulos, busca, filtroTipo, filtroStatus]);

  const resumo = useMemo(() => {
    const receber = titulos
      .filter((t) => t.tipo === "RECEBER")
      .filter((t) => ["ABERTO", "PARCIAL", "VENCIDO"].includes(statusFinanceiro(t)))
      .reduce((acc, t) => acc + saldoAbertoTitulo(t), 0);

    const pagar = titulos
      .filter((t) => t.tipo === "PAGAR")
      .filter((t) => ["ABERTO", "PARCIAL", "VENCIDO"].includes(statusFinanceiro(t)))
      .reduce((acc, t) => acc + saldoAbertoTitulo(t), 0);

    const recebido = titulos
      .filter((t) => t.tipo === "RECEBER")
      .reduce((acc, t) => acc + toMoney(t.valor_pago), 0);

    const vencido = titulos
      .filter((t) => t.tipo === "RECEBER")
      .filter((t) => statusFinanceiro(t) === "VENCIDO")
      .reduce((acc, t) => acc + saldoAbertoTitulo(t), 0);

    const saldoCaixa = recebido - pagar;

    return { receber, pagar, recebido, vencido, saldoCaixa };
  }, [titulos]);

  const valorLiquidoForm = useMemo(() => {
    return (
      toMoney(valorOriginal) +
      toMoney(juros) +
      toMoney(multa) -
      toMoney(desconto)
    );
  }, [valorOriginal, juros, multa, desconto]);

  const saldoForm = useMemo(() => {
    return Math.max(0, valorLiquidoForm - toMoney(valorPago));
  }, [valorLiquidoForm, valorPago]);

  function resetForm() {
    setEditingId(null);
    setTipo("RECEBER");
    setDescricao("");
    setClienteId("");
    setClienteNome("");
    setDocumento("");
    setCategoria("");
    setValorOriginal("0");
    setValorPago("0");
    setDesconto("0");
    setJuros("0");
    setMulta("0");
    setDataEmissao(hojeISO());
    setDataVencimento(hojeISO());
    setDataPagamento("");
    setObservacoes("");
  }

  function resetBaixa() {
    setBaixaId(null);
    setBaixaValor("0");
    setBaixaData(hojeISO());
    setBaixaObs("");
  }

  async function salvarTitulo() {
    if (!empresaId) return;

    if (!descricao.trim()) {
      alert("PREENCHA A DESCRIÇÃO.");
      return;
    }

    const payload = {
      empresa_id: empresaId,
      tipo,
      descricao: up(descricao),
      cliente_id: clienteId || null,
      cliente_nome: up(clienteNome),
      documento: up(documento),
      categoria: up(categoria),
      valor_original: toMoney(valorOriginal),
      valor_pago: toMoney(valorPago),
      desconto: toMoney(desconto),
      juros: toMoney(juros),
      multa: toMoney(multa),
      data_emissao: dataEmissao || null,
      data_vencimento: dataVencimento || null,
      data_pagamento: dataPagamento || null,
      status:
        saldoForm <= 0
          ? "PAGO"
          : toMoney(valorPago) > 0
          ? "PARCIAL"
          : "ABERTO",
      observacoes: up(observacoes),
    };

    if (editingId) {
      const { error } = await supabase
        .from("financeiro_titulos")
        .update(payload)
        .eq("empresa_id", empresaId)
        .eq("id", editingId);

      if (error) {
        alert("ERRO AO ATUALIZAR TÍTULO: " + error.message);
        return;
      }

      alert("TÍTULO ATUALIZADO!");
      resetForm();
      carregarBase();
      return;
    }

    const { error } = await supabase.from("financeiro_titulos").insert([payload]);

    if (error) {
      alert("ERRO AO CRIAR TÍTULO: " + error.message);
      return;
    }

    alert("TÍTULO CRIADO!");
    resetForm();
    carregarBase();
  }

  function editarTitulo(t: FinanceiroTitulo) {
    setEditingId(t.id);
    setTipo(t.tipo);
    setDescricao(t.descricao || "");
    setClienteId(t.cliente_id || "");
    setClienteNome(t.cliente_nome || "");
    setDocumento(t.documento || "");
    setCategoria(t.categoria || "");
    setValorOriginal(String(toMoney(t.valor_original)));
    setValorPago(String(toMoney(t.valor_pago)));
    setDesconto(String(toMoney(t.desconto)));
    setJuros(String(toMoney(t.juros)));
    setMulta(String(toMoney(t.multa)));
    setDataEmissao(t.data_emissao || hojeISO());
    setDataVencimento(t.data_vencimento || hojeISO());
    setDataPagamento(t.data_pagamento || "");
    setObservacoes(t.observacoes || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removerTitulo(id: string) {
    if (!empresaId) return;
    if (!confirm("REMOVER ESTE TÍTULO?")) return;

    const { error } = await supabase
      .from("financeiro_titulos")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("id", id);

    if (error) {
      alert("ERRO AO REMOVER TÍTULO: " + error.message);
      return;
    }

    alert("TÍTULO REMOVIDO!");
    if (editingId === id) resetForm();
    if (baixaId === id) resetBaixa();
    carregarBase();
  }

  function abrirBaixa(t: FinanceiroTitulo) {
    setBaixaId(t.id);
    setBaixaValor(String(saldoAbertoTitulo(t)));
    setBaixaData(hojeISO());
    setBaixaObs("");
  }

  async function registrarBaixa() {
    if (!empresaId || !baixaId) return;

    const titulo = titulos.find((t) => t.id === baixaId);
    if (!titulo) return;

    const novoValorPago = toMoney(titulo.valor_pago) + toMoney(baixaValor);
    const saldoRestante = Math.max(0, valorLiquidoTitulo(titulo) - novoValorPago);

    const { error } = await supabase
      .from("financeiro_titulos")
      .update({
        valor_pago: novoValorPago,
        data_pagamento: baixaData,
        status: saldoRestante <= 0 ? "PAGO" : "PARCIAL",
        observacoes: up(
          `${titulo.observacoes || ""}\nBAIXA: ${baixaValor} EM ${baixaData} ${baixaObs || ""}`
        ),
      })
      .eq("empresa_id", empresaId)
      .eq("id", baixaId);

    if (error) {
      alert("ERRO AO BAIXAR TÍTULO: " + error.message);
      return;
    }

    alert("BAIXA REGISTRADA!");
    resetBaixa();
    carregarBase();
  }

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F3F4F6]">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[26px] font-black text-[#6C757D] leading-none">
              FINANCEIRO
            </h1>
            <p className="text-[14px] text-[#6C757D] mt-2">
              CONTAS A RECEBER, A PAGAR, BAIXAS E CONTROLE DE SALDOS
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <input
              placeholder="BUSCAR TÍTULO..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-[54px] w-[280px] xl:w-[360px] max-w-full rounded-2xl border border-[#2F2F2F] bg-white px-5 text-[18px] outline-none"
            />

            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="h-[54px] rounded-2xl border border-[#2F2F2F] bg-white px-5 text-[16px] outline-none"
            >
              <option value="TODOS">TODOS</option>
              <option value="RECEBER">RECEBER</option>
              <option value="PAGAR">PAGAR</option>
            </select>

            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="h-[54px] rounded-2xl border border-[#2F2F2F] bg-white px-5 text-[16px] outline-none"
            >
              <option value="TODOS">TODOS OS STATUS</option>
              <option value="ABERTO">ABERTO</option>
              <option value="PARCIAL">PARCIAL</option>
              <option value="PAGO">PAGO</option>
              <option value="VENCIDO">VENCIDO</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
          <CardKpi titulo="A RECEBER" valor={moneyBR(resumo.receber)} />
          <CardKpi titulo="A PAGAR" valor={moneyBR(resumo.pagar)} />
          <CardKpi titulo="RECEBIDO" valor={moneyBR(resumo.recebido)} />
          <CardKpi titulo="VENCIDO" valor={moneyBR(resumo.vencido)} />
          <CardKpi titulo="SALDO CAIXA" valor={moneyBR(resumo.saldoCaixa)} />
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[1.3fr_0.7fr] gap-6 mb-6">
          <section className="card">
            <h2 className="titulo mb-4">
              {editingId ? "EDITAR TÍTULO" : "NOVO LANÇAMENTO"}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as "RECEBER" | "PAGAR")}
                className="campo"
              >
                <option value="RECEBER">RECEBER</option>
                <option value="PAGAR">PAGAR</option>
              </select>

              <input
                placeholder="DESCRIÇÃO"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="campo md:col-span-2"
              />

              <input
                placeholder="DOCUMENTO"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                className="campo"
              />

              <select
                value={clienteId}
                onChange={(e) => {
                  setClienteId(e.target.value);
                  const c = clientes.find((x) => x.id === e.target.value);
                  setClienteNome(c?.nome || "");
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

              <input
                placeholder="CLIENTE / FORNECEDOR"
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
                className="campo"
              />

              <input
                placeholder="CATEGORIA"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="campo"
              />

              <input
                placeholder="VALOR ORIGINAL"
                type="number"
                value={valorOriginal}
                onChange={(e) => setValorOriginal(e.target.value)}
                className="campo"
              />

              <input
                placeholder="VALOR PAGO"
                type="number"
                value={valorPago}
                onChange={(e) => setValorPago(e.target.value)}
                className="campo"
              />

              <input
                placeholder="DESCONTO"
                type="number"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                className="campo"
              />

              <input
                placeholder="JUROS"
                type="number"
                value={juros}
                onChange={(e) => setJuros(e.target.value)}
                className="campo"
              />

              <input
                placeholder="MULTA"
                type="number"
                value={multa}
                onChange={(e) => setMulta(e.target.value)}
                className="campo"
              />

              <div>
                <label className="label">EMISSÃO</label>
                <input
                  type="date"
                  value={dataEmissao}
                  onChange={(e) => setDataEmissao(e.target.value)}
                  className="campo"
                />
              </div>

              <div>
                <label className="label">VENCIMENTO</label>
                <input
                  type="date"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                  className="campo"
                />
              </div>

              <div>
                <label className="label">PAGAMENTO</label>
                <input
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
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

            <div className="grid grid-cols-3 gap-4 mt-5">
              <ResumoMini label="VALOR LÍQUIDO" value={moneyBR(valorLiquidoForm)} />
              <ResumoMini label="VALOR PAGO" value={moneyBR(toMoney(valorPago))} />
              <ResumoMini label="SALDO" value={moneyBR(saldoForm)} destaque />
            </div>

            <div className="flex gap-3 mt-5 flex-wrap">
              <button onClick={salvarTitulo} className="botao-azul" type="button">
                {editingId ? "ATUALIZAR TÍTULO" : "SALVAR TÍTULO"}
              </button>

              <button onClick={resetForm} className="botao" type="button">
                LIMPAR
              </button>
            </div>
          </section>

          <section className="card">
            <h2 className="titulo mb-4">BAIXA / PAGAMENTO</h2>

            {baixaId ? (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="label">VALOR DA BAIXA</label>
                    <input
                      className="campo"
                      type="number"
                      value={baixaValor}
                      onChange={(e) => setBaixaValor(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="label">DATA DA BAIXA</label>
                    <input
                      className="campo"
                      type="date"
                      value={baixaData}
                      onChange={(e) => setBaixaData(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="label">OBSERVAÇÃO</label>
                    <textarea
                      className="campo-textarea"
                      value={baixaObs}
                      onChange={(e) => setBaixaObs(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-5 flex-wrap">
                  <button onClick={registrarBaixa} className="botao-azul" type="button">
                    REGISTRAR BAIXA
                  </button>

                  <button onClick={resetBaixa} className="botao" type="button">
                    CANCELAR
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm text-[#6C757D]">
                SELECIONE UM TÍTULO NA TABELA E CLIQUE EM <b>BAIXAR</b>.
              </div>
            )}
          </section>
        </div>

        <section className="card">
          <h2 className="titulo mb-4">TÍTULOS FINANCEIROS</h2>

          <div className="overflow-auto">
            <table className="tabela min-w-[1500px]">
              <thead>
                <tr>
                  <th>TIPO</th>
                  <th>DESCRIÇÃO</th>
                  <th>CLIENTE</th>
                  <th>DOC</th>
                  <th>VENCIMENTO</th>
                  <th>STATUS</th>
                  <th>VALOR</th>
                  <th>PAGO</th>
                  <th>SALDO</th>
                  <th>AÇÕES</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-6 text-[#6C757D]">
                      CARREGANDO...
                    </td>
                  </tr>
                ) : titulosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-6 text-[#6C757D]">
                      NENHUM TÍTULO ENCONTRADO.
                    </td>
                  </tr>
                ) : (
                  titulosFiltrados.map((t) => (
                    <tr key={t.id}>
                      <td>{t.tipo}</td>
                      <td>{t.descricao || "-"}</td>
                      <td>{t.cliente_nome || "-"}</td>
                      <td>{t.documento || "-"}</td>
                      <td>{t.data_vencimento || "-"}</td>
                      <td>{statusFinanceiro(t)}</td>
                      <td>{moneyBR(valorLiquidoTitulo(t))}</td>
                      <td>{moneyBR(toMoney(t.valor_pago))}</td>
                      <td>{moneyBR(saldoAbertoTitulo(t))}</td>
                      <td>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => editarTitulo(t)}
                            className="botao-mini"
                            type="button"
                          >
                            EDITAR
                          </button>

                          <button
                            onClick={() => abrirBaixa(t)}
                            className="botao-mini"
                            type="button"
                          >
                            BAIXAR
                          </button>

                          <button
                            onClick={() => removerTitulo(t.id)}
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
      <div className="mt-3 text-[24px] font-black text-[#111] break-words">{valor}</div>
    </div>
  );
}

function ResumoMini({
  label,
  value,
  destaque = false,
}: {
  label: string;
  value: string;
  destaque?: boolean;
}) {
  return (
    <div className={`rounded-[16px] p-4 ${destaque ? "bg-[#EEF6FF]" : "bg-[#F8F9FB]"}`}>
      <div className="text-[12px] font-bold text-[#6C757D]">{label}</div>
      <div className={`mt-2 text-[18px] font-black ${destaque ? "text-[#0456A3]" : "text-[#111]"}`}>
        {value}
      </div>
    </div>
  );
}