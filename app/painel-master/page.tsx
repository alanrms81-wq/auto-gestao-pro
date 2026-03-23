"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Assinatura = {
  id: string;
  empresa_id: string;
  nome_empresa?: string | null;
  responsavel?: string | null;
  telefone?: string | null;
  email?: string | null;
  plano?: string | null;
  valor_mensal?: number | null;
  dia_vencimento?: number | null;
  data_ultimo_pagamento?: string | null;
  proximo_vencimento?: string | null;
  status_assinatura?: string | null;
  bloqueado?: boolean | null;
  dias_carencia?: number | null;
  observacoes?: string | null;
  created_at?: string | null;
};

type FiltroStatus =
  | "TODOS"
  | "ATIVO"
  | "TESTE"
  | "VENCIDO"
  | "CARENCIA"
  | "BLOQUEADO"
  | "CANCELADO";

function up(v: unknown) {
  return String(v ?? "").toUpperCase();
}

function moneyBR(v?: number | null) {
  return (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateBr(value?: string | null) {
  if (!value) return "-";
  const d = new Date(`${value}T00:00:00`);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
}

function addMonthsKeepingDay(baseDate: Date, monthsToAdd: number, targetDay: number) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth() + monthsToAdd;
  const dt = new Date(year, month, 1);
  const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(targetDay, lastDay));
  return dt.toISOString().slice(0, 10);
}

function statusVisual(status?: string | null, bloqueado?: boolean | null) {
  if (bloqueado) return "BLOQUEADO";
  const s = up(status || "ATIVO");
  return s || "ATIVO";
}

function statusClasses(status?: string | null, bloqueado?: boolean | null) {
  const s = statusVisual(status, bloqueado);
  if (s === "ATIVO") return "bg-green-100 text-green-700 border-green-200";
  if (s === "TESTE") return "bg-yellow-100 text-yellow-700 border-yellow-200";
  if (s === "VENCIDO") return "bg-red-100 text-red-700 border-red-200";
  if (s === "CARENCIA") return "bg-orange-100 text-orange-700 border-orange-200";
  if (s === "BLOQUEADO") return "bg-slate-900 text-white border-slate-900";
  if (s === "CANCELADO") return "bg-gray-200 text-gray-700 border-gray-300";
  return "bg-blue-100 text-blue-700 border-blue-200";
}

export default function PainelMasterPage() {
  const [dados, setDados] = useState<Assinatura[]>([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("TODOS");
  const [somenteBloqueados, setSomenteBloqueados] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [plano, setPlano] = useState("PRO");
  const [valorMensal, setValorMensal] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("10");
  const [dataUltimoPagamento, setDataUltimoPagamento] = useState("");
  const [proximoVencimento, setProximoVencimento] = useState("");
  const [statusAssinatura, setStatusAssinatura] = useState("ATIVO");
  const [bloqueado, setBloqueado] = useState(false);
  const [diasCarencia, setDiasCarencia] = useState("3");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setLoading(true);

    const { data, error } = await supabase
      .from("assinaturas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("ERRO AO CARREGAR ASSINATURAS: " + error.message);
      setDados([]);
      setLoading(false);
      return;
    }

    setDados((data || []) as Assinatura[]);
    setLoading(false);
  }

  function limparFormulario() {
    setEditingId(null);
    setEmpresaId("");
    setNomeEmpresa("");
    setResponsavel("");
    setTelefone("");
    setEmail("");
    setPlano("PRO");
    setValorMensal("");
    setDiaVencimento("10");
    setDataUltimoPagamento("");
    setProximoVencimento("");
    setStatusAssinatura("ATIVO");
    setBloqueado(false);
    setDiasCarencia("3");
    setObservacoes("");
  }

  function abrirNovo() {
    limparFormulario();
    setModalOpen(true);
  }

  function abrirEditar(item: Assinatura) {
    setEditingId(item.id);
    setEmpresaId(item.empresa_id || "");
    setNomeEmpresa(item.nome_empresa || "");
    setResponsavel(item.responsavel || "");
    setTelefone(item.telefone || "");
    setEmail(item.email || "");
    setPlano(item.plano || "PRO");
    setValorMensal(String(Number(item.valor_mensal || 0)));
    setDiaVencimento(String(Number(item.dia_vencimento || 10)));
    setDataUltimoPagamento(item.data_ultimo_pagamento || "");
    setProximoVencimento(item.proximo_vencimento || "");
    setStatusAssinatura(item.status_assinatura || "ATIVO");
    setBloqueado(!!item.bloqueado);
    setDiasCarencia(String(Number(item.dias_carencia || 3)));
    setObservacoes(item.observacoes || "");
    setModalOpen(true);
  }

  async function salvar() {
    if (!empresaId.trim()) {
      alert("PREENCHA O EMPRESA_ID.");
      return;
    }

    if (!nomeEmpresa.trim()) {
      alert("PREENCHA O NOME DA EMPRESA.");
      return;
    }

    setSaving(true);

    const payload = {
      empresa_id: empresaId.trim(),
      nome_empresa: up(nomeEmpresa.trim()),
      responsavel: up(responsavel.trim()),
      telefone: telefone.trim(),
      email: email.trim(),
      plano: up(plano),
      valor_mensal: Number(valorMensal || 0),
      dia_vencimento: Number(diaVencimento || 10),
      data_ultimo_pagamento: dataUltimoPagamento || null,
      proximo_vencimento: proximoVencimento || null,
      status_assinatura: up(statusAssinatura),
      bloqueado,
      dias_carencia: Number(diasCarencia || 3),
      observacoes: up(observacoes),
    };

    if (editingId) {
      const { error } = await supabase
        .from("assinaturas")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        alert("ERRO AO ATUALIZAR ASSINATURA: " + error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("assinaturas").insert([payload]);

      if (error) {
        alert("ERRO AO CRIAR ASSINATURA: " + error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setModalOpen(false);
    limparFormulario();
    carregar();
  }

  async function toggleBloqueio(item: Assinatura) {
    const novoBloqueio = !item.bloqueado;
    const novoStatus = novoBloqueio ? "BLOQUEADO" : "ATIVO";

    const { error } = await supabase
      .from("assinaturas")
      .update({
        bloqueado: novoBloqueio,
        status_assinatura: novoStatus,
      })
      .eq("id", item.id);

    if (error) {
      alert("ERRO AO ALTERAR BLOQUEIO: " + error.message);
      return;
    }

    carregar();
  }

  async function marcarPago(item: Assinatura) {
    const hoje = new Date();
    const dia = Number(item.dia_vencimento || 10);

    const dataUlt = hoje.toISOString().slice(0, 10);
    const prox = addMonthsKeepingDay(hoje, 1, dia);

    const { error } = await supabase
      .from("assinaturas")
      .update({
        data_ultimo_pagamento: dataUlt,
        proximo_vencimento: prox,
        status_assinatura: "ATIVO",
        bloqueado: false,
      })
      .eq("id", item.id);

    if (error) {
      alert("ERRO AO MARCAR PAGAMENTO: " + error.message);
      return;
    }

    carregar();
  }

  async function colocarTeste(item: Assinatura) {
    const { error } = await supabase
      .from("assinaturas")
      .update({
        status_assinatura: "TESTE",
        bloqueado: false,
      })
      .eq("id", item.id);

    if (error) {
      alert("ERRO AO COLOCAR EM TESTE: " + error.message);
      return;
    }

    carregar();
  }

  async function colocarVencido(item: Assinatura) {
    const { error } = await supabase
      .from("assinaturas")
      .update({
        status_assinatura: "VENCIDO",
        bloqueado: false,
      })
      .eq("id", item.id);

    if (error) {
      alert("ERRO AO MARCAR COMO VENCIDO: " + error.message);
      return;
    }

    carregar();
  }

  async function remover(item: Assinatura) {
    if (!confirm(`REMOVER A ASSINATURA DE ${item.nome_empresa}?`)) return;

    const { error } = await supabase
      .from("assinaturas")
      .delete()
      .eq("id", item.id);

    if (error) {
      alert("ERRO AO REMOVER: " + error.message);
      return;
    }

    carregar();
  }

  const dadosFiltrados = useMemo(() => {
    const q = up(busca.trim());

    return dados.filter((item) => {
      const status = statusVisual(item.status_assinatura, item.bloqueado);

      const bateBusca =
        !q ||
        up(
          `${item.nome_empresa || ""} ${item.responsavel || ""} ${item.telefone || ""} ${item.email || ""} ${item.plano || ""} ${item.empresa_id || ""}`
        ).includes(q);

      const bateStatus = filtroStatus === "TODOS" || status === filtroStatus;
      const bateBloqueado = !somenteBloqueados || !!item.bloqueado;

      return bateBusca && bateStatus && bateBloqueado;
    });
  }, [dados, busca, filtroStatus, somenteBloqueados]);

  const resumo = useMemo(() => {
    const total = dados.length;
    const ativos = dados.filter((d) => statusVisual(d.status_assinatura, d.bloqueado) === "ATIVO").length;
    const testes = dados.filter((d) => statusVisual(d.status_assinatura, d.bloqueado) === "TESTE").length;
    const vencidos = dados.filter((d) => statusVisual(d.status_assinatura, d.bloqueado) === "VENCIDO").length;
    const bloqueados = dados.filter((d) => statusVisual(d.status_assinatura, d.bloqueado) === "BLOQUEADO").length;

    const mrr = dados
      .filter((d) => ["ATIVO", "VENCIDO", "CARENCIA", "BLOQUEADO"].includes(statusVisual(d.status_assinatura, d.bloqueado)))
      .reduce((acc, d) => acc + Number(d.valor_mensal || 0), 0);

    return { total, ativos, testes, vencidos, bloqueados, mrr };
  }, [dados]);

  if (loading) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F4F6F8] p-4 md:p-6">
      <div className="mb-6 rounded-[28px] bg-gradient-to-r from-[#111827] via-[#0F172A] to-[#1E293B] p-6 text-white shadow-xl">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div>
            <p className="text-[12px] font-bold tracking-[0.22em] opacity-70">
              AUTO GESTÃO PRO
            </p>
            <h1 className="mt-3 text-[30px] md:text-[38px] font-black leading-none">
              PAINEL MASTER SAAS
            </h1>
            <p className="mt-4 max-w-[780px] text-[14px] text-white/80">
              CONTROLE TOTAL DE OFICINAS, PLANOS, ASSINATURAS, BLOQUEIO,
              TESTE, VENCIMENTO E FATURAMENTO RECORRENTE.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 min-w-0">
            <Kpi titulo="CLIENTES" valor={String(resumo.total)} />
            <Kpi titulo="ATIVOS" valor={String(resumo.ativos)} />
            <Kpi titulo="TESTE" valor={String(resumo.testes)} />
            <Kpi titulo="VENCIDOS" valor={String(resumo.vencidos)} />
            <Kpi titulo="BLOQUEADOS" valor={String(resumo.bloqueados)} />
            <Kpi titulo="MRR" valor={moneyBR(resumo.mrr)} destaque />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={abrirNovo}
            className="h-[48px] rounded-[16px] bg-white px-5 text-[13px] font-black text-[#111827]"
          >
            NOVA ASSINATURA
          </button>

          <button
            type="button"
            onClick={carregar}
            className="h-[48px] rounded-[16px] border border-white/20 bg-white/10 px-5 text-[13px] font-black text-white"
          >
            ATUALIZAR
          </button>
        </div>
      </div>

      <section className="mb-6 rounded-[24px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_220px_220px] gap-4">
          <input
            className="h-[50px] rounded-[16px] border border-[#CBD5E1] px-4 text-[14px] outline-none"
            placeholder="BUSCAR POR EMPRESA, RESPONSÁVEL, TELEFONE, E-MAIL OU EMPRESA_ID..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <select
            className="h-[50px] rounded-[16px] border border-[#CBD5E1] px-4 text-[14px] outline-none bg-white"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
          >
            <option value="TODOS">TODOS STATUS</option>
            <option value="ATIVO">ATIVO</option>
            <option value="TESTE">TESTE</option>
            <option value="VENCIDO">VENCIDO</option>
            <option value="CARENCIA">CARENCIA</option>
            <option value="BLOQUEADO">BLOQUEADO</option>
            <option value="CANCELADO">CANCELADO</option>
          </select>

          <label className="h-[50px] rounded-[16px] border border-[#CBD5E1] px-4 flex items-center gap-3 bg-white text-[14px] font-semibold text-[#334155]">
            <input
              type="checkbox"
              checked={somenteBloqueados}
              onChange={(e) => setSomenteBloqueados(e.target.checked)}
            />
            SOMENTE BLOQUEADOS
          </label>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4">
        {dadosFiltrados.length === 0 ? (
          <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-10 text-center text-[#64748B] shadow-sm">
            NENHUMA ASSINATURA ENCONTRADA.
          </div>
        ) : (
          dadosFiltrados.map((item) => {
            const status = statusVisual(item.status_assinatura, item.bloqueado);

            return (
              <section
                key={item.id}
                className="rounded-[26px] border border-[#E5E7EB] bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col 2xl:flex-row 2xl:items-start 2xl:justify-between gap-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-[22px] font-black text-[#111827] break-words">
                        {item.nome_empresa || "-"}
                      </h2>

                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black ${statusClasses(
                          item.status_assinatura,
                          item.bloqueado
                        )}`}
                      >
                        {status}
                      </span>

                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black text-blue-700">
                        {up(item.plano || "-")}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-[13px] text-[#475569]">
                      <Info label="RESPONSÁVEL" valor={item.responsavel || "-"} />
                      <Info label="TELEFONE" valor={item.telefone || "-"} />
                      <Info label="E-MAIL" valor={item.email || "-"} />
                      <Info label="EMPRESA_ID" valor={item.empresa_id || "-"} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
                    <MiniCard titulo="MENSALIDADE" valor={moneyBR(item.valor_mensal)} />
                    <MiniCard titulo="VENCE DIA" valor={String(item.dia_vencimento || "-")} />
                    <MiniCard titulo="ÚLT. PAGTO" valor={formatDateBr(item.data_ultimo_pagamento)} />
                    <MiniCard titulo="PRÓX. VENC." valor={formatDateBr(item.proximo_vencimento)} />
                  </div>
                </div>

                {item.observacoes ? (
                  <div className="mt-4 rounded-[18px] border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-[13px] text-[#475569]">
                    <span className="font-black text-[#334155]">OBS:</span> {item.observacoes}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => abrirEditar(item)}
                    className="h-[42px] rounded-[14px] border border-[#CBD5E1] bg-white px-4 text-[12px] font-black text-[#111827]"
                  >
                    EDITAR
                  </button>

                  <button
                    type="button"
                    onClick={() => marcarPago(item)}
                    className="h-[42px] rounded-[14px] bg-green-600 px-4 text-[12px] font-black text-white"
                  >
                    MARCAR PAGO
                  </button>

                  <button
                    type="button"
                    onClick={() => colocarTeste(item)}
                    className="h-[42px] rounded-[14px] bg-yellow-500 px-4 text-[12px] font-black text-white"
                  >
                    COLOCAR EM TESTE
                  </button>

                  <button
                    type="button"
                    onClick={() => colocarVencido(item)}
                    className="h-[42px] rounded-[14px] bg-orange-500 px-4 text-[12px] font-black text-white"
                  >
                    MARCAR VENCIDO
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleBloqueio(item)}
                    className={`h-[42px] rounded-[14px] px-4 text-[12px] font-black text-white ${
                      item.bloqueado ? "bg-blue-600" : "bg-red-600"
                    }`}
                  >
                    {item.bloqueado ? "DESBLOQUEAR" : "BLOQUEAR"}
                  </button>

                  <button
                    type="button"
                    onClick={() => remover(item)}
                    className="h-[42px] rounded-[14px] border border-red-200 bg-red-50 px-4 text-[12px] font-black text-red-700"
                  >
                    REMOVER
                  </button>
                </div>
              </section>
            );
          })
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 px-4 py-6 overflow-auto">
          <div className="mx-auto w-full max-w-[1080px] rounded-[28px] bg-white shadow-2xl">
            <div className="border-b border-[#E5E7EB] px-6 py-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[24px] font-black text-[#111827]">
                  {editingId ? "EDITAR ASSINATURA" : "NOVA ASSINATURA"}
                </h2>
                <p className="mt-1 text-[13px] text-[#64748B]">
                  GERENCIE PLANOS, COBRANÇA, VENCIMENTO E BLOQUEIO.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  limparFormulario();
                }}
                className="h-[42px] rounded-[14px] border border-[#CBD5E1] px-4 text-[12px] font-black text-[#111827]"
              >
                FECHAR
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Field label="EMPRESA_ID">
                <input
                  className="campo"
                  value={empresaId}
                  onChange={(e) => setEmpresaId(e.target.value)}
                  placeholder="UUID DA EMPRESA"
                />
              </Field>

              <Field label="NOME DA EMPRESA">
                <input
                  className="campo"
                  value={nomeEmpresa}
                  onChange={(e) => setNomeEmpresa(e.target.value)}
                  placeholder="NOME DA OFICINA"
                />
              </Field>

              <Field label="RESPONSÁVEL">
                <input
                  className="campo"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  placeholder="NOME DO DONO"
                />
              </Field>

              <Field label="TELEFONE">
                <input
                  className="campo"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="WHATSAPP / TELEFONE"
                />
              </Field>

              <Field label="E-MAIL">
                <input
                  className="campo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="EMAIL"
                />
              </Field>

              <Field label="PLANO">
                <select
                  className="campo bg-white"
                  value={plano}
                  onChange={(e) => setPlano(e.target.value)}
                >
                  <option>BASICO</option>
                  <option>PRO</option>
                  <option>PREMIUM</option>
                  <option>TESTE</option>
                </select>
              </Field>

              <Field label="VALOR MENSAL">
                <input
                  className="campo"
                  type="number"
                  step="0.01"
                  value={valorMensal}
                  onChange={(e) => setValorMensal(e.target.value)}
                  placeholder="0.00"
                />
              </Field>

              <Field label="DIA VENCIMENTO">
                <input
                  className="campo"
                  type="number"
                  min="1"
                  max="31"
                  value={diaVencimento}
                  onChange={(e) => setDiaVencimento(e.target.value)}
                  placeholder="10"
                />
              </Field>

              <Field label="ÚLTIMO PAGAMENTO">
                <input
                  className="campo"
                  type="date"
                  value={dataUltimoPagamento}
                  onChange={(e) => setDataUltimoPagamento(e.target.value)}
                />
              </Field>

              <Field label="PRÓXIMO VENCIMENTO">
                <input
                  className="campo"
                  type="date"
                  value={proximoVencimento}
                  onChange={(e) => setProximoVencimento(e.target.value)}
                />
              </Field>

              <Field label="STATUS">
                <select
                  className="campo bg-white"
                  value={statusAssinatura}
                  onChange={(e) => setStatusAssinatura(e.target.value)}
                >
                  <option>ATIVO</option>
                  <option>TESTE</option>
                  <option>VENCIDO</option>
                  <option>CARENCIA</option>
                  <option>BLOQUEADO</option>
                  <option>CANCELADO</option>
                </select>
              </Field>

              <Field label="DIAS CARÊNCIA">
                <input
                  className="campo"
                  type="number"
                  min="0"
                  value={diasCarencia}
                  onChange={(e) => setDiasCarencia(e.target.value)}
                  placeholder="3"
                />
              </Field>

              <div className="md:col-span-2 xl:col-span-4">
                <label className="mb-2 block text-[12px] font-black tracking-[0.08em] text-[#64748B]">
                  OBSERVAÇÕES
                </label>
                <textarea
                  className="campo-textarea"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="INFORMAÇÕES INTERNAS, ACORDO COMERCIAL, STATUS DO CLIENTE..."
                />
              </div>

              <label className="md:col-span-2 xl:col-span-4 h-[48px] rounded-[16px] border border-[#CBD5E1] bg-[#F8FAFC] px-4 flex items-center gap-3 text-[13px] font-bold text-[#334155]">
                <input
                  type="checkbox"
                  checked={bloqueado}
                  onChange={(e) => setBloqueado(e.target.checked)}
                />
                CLIENTE BLOQUEADO
              </label>
            </div>

            <div className="border-t border-[#E5E7EB] px-6 py-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={salvar}
                disabled={saving}
                className="h-[46px] rounded-[16px] bg-[#0456A3] px-5 text-[13px] font-black text-white disabled:opacity-60"
              >
                {saving ? "SALVANDO..." : editingId ? "ATUALIZAR" : "CRIAR ASSINATURA"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  limparFormulario();
                }}
                className="h-[46px] rounded-[16px] border border-[#CBD5E1] px-5 text-[13px] font-black text-[#111827]"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .campo {
          height: 48px;
          width: 100%;
          border: 1.5px solid #cbd5e1;
          border-radius: 16px;
          padding: 0 14px;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          background: white;
        }

        .campo:focus,
        .campo-textarea:focus {
          border-color: #0a6fd6;
          box-shadow: 0 0 0 4px rgba(10, 111, 214, 0.08);
        }

        .campo-textarea {
          min-height: 120px;
          width: 100%;
          border: 1.5px solid #cbd5e1;
          border-radius: 16px;
          padding: 14px;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          background: white;
          resize: vertical;
        }
      `}</style>
    </div>
  );
}

function Kpi({
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
      className={`rounded-[20px] p-4 ${
        destaque
          ? "bg-white text-[#111827]"
          : "border border-white/10 bg-white/10 text-white"
      }`}
    >
      <div className="text-[10px] font-black tracking-[0.12em] opacity-75">
        {titulo}
      </div>
      <div className="mt-2 text-[22px] font-black leading-none break-words">
        {valor}
      </div>
    </div>
  );
}

function MiniCard({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-[18px] border border-[#E2E8F0] bg-[#F8FAFC] p-4 min-w-[120px]">
      <div className="text-[10px] font-black tracking-[0.12em] text-[#64748B]">
        {titulo}
      </div>
      <div className="mt-2 text-[16px] font-black text-[#111827] break-words">
        {valor}
      </div>
    </div>
  );
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-[#FAFBFC] p-3">
      <div className="text-[10px] font-black tracking-[0.12em] text-[#64748B]">
        {label}
      </div>
      <div className="mt-1 text-[13px] font-semibold text-[#111827] break-words">
        {valor}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[12px] font-black tracking-[0.08em] text-[#64748B]">
        {label}
      </label>
      {children}
    </div>
  );
}