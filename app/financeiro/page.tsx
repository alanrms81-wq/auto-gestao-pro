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
  forma_pagamento?: string | null;
  conta_financeira_id?: string | null;
  taxa_cartao_id?: string | null;
  valor_taxa?: number | null;
  valor_liquido?: number | null;
  tipo_recebimento?: string | null;
  status?: string | null;
  observacoes?: string | null;
  created_at?: string | null;
};

type Cliente = {
  id: string;
  nome: string;
  telefone?: string | null;
  celular?: string | null;
  whatsapp?: string | null;
  cpf_cnpj?: string | null;
  status?: string | null;
};

type ContaFinanceira = {
  id: string;
  nome?: string | null;
  tipo?: string | null;
  saldo_atual?: number | null;
  status?: string | null;
};

type TaxaCartao = {
  id: string;
  nome?: string | null;
  tipo_cartao?: string | null;
  bandeira?: string | null;
  taxa_percentual?: number | null;
  prazo_recebimento_dias?: number | null;
  status?: string | null;
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

function hojeISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function valorLiquidoTitulo(t: Partial<FinanceiroTitulo>) {
  const calculado =
    toMoney(t.valor_original) + toMoney(t.juros) + toMoney(t.multa) - toMoney(t.desconto);

  return t.valor_liquido != null ? toMoney(t.valor_liquido) : calculado;
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

function calcularLiquidoComTaxa(valorBruto: number, taxaPercentual: number) {
  const bruto = Number(valorBruto) || 0;
  const taxa = Number(taxaPercentual) || 0;
  const valorTaxa = bruto * (taxa / 100);
  const valorLiquido = bruto - valorTaxa;

  return { valorTaxa, valorLiquido };
}

export default function FinanceiroPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [titulos, setTitulos] = useState<FinanceiroTitulo[]>([]);
  const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceira[]>([]);
  const [taxasCartao, setTaxasCartao] = useState<TaxaCartao[]>([]);

  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroConta, setFiltroConta] = useState("TODOS");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [tipo, setTipo] = useState<"RECEBER" | "PAGAR">("RECEBER");
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteBusca, setClienteBusca] = useState("");
  const [clientesBusca, setClientesBusca] = useState<Cliente[]>([]);
  const [loadingClientesBusca, setLoadingClientesBusca] = useState(false);
  const [mostrarDropdownCliente, setMostrarDropdownCliente] = useState(false);

  const [documento, setDocumento] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valorOriginal, setValorOriginal] = useState("");
  const [valorPago, setValorPago] = useState("");
  const [desconto, setDesconto] = useState("");
  const [juros, setJuros] = useState("");
  const [multa, setMulta] = useState("");
  const [dataEmissao, setDataEmissao] = useState(hojeISO());
  const [dataVencimento, setDataVencimento] = useState(hojeISO());
  const [dataPagamento, setDataPagamento] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("DINHEIRO");
  const [contaFinanceiraId, setContaFinanceiraId] = useState("");
  const [taxaCartaoId, setTaxaCartaoId] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [baixaId, setBaixaId] = useState<string | null>(null);
  const [baixaValor, setBaixaValor] = useState("");
  const [baixaData, setBaixaData] = useState(hojeISO());
  const [baixaObs, setBaixaObs] = useState("");
  const [baixaContaFinanceiraId, setBaixaContaFinanceiraId] = useState("");

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

    const [titulosResp, contasResp, taxasResp] = await Promise.all([
      supabase
        .from("financeiro_titulos")
        .select("*")
        .eq("empresa_id", eid)
        .order("data_vencimento", { ascending: true }),

      supabase
        .from("contas_financeiras")
        .select("id,nome,tipo,saldo_atual,status")
        .eq("empresa_id", eid)
        .order("nome"),

      supabase
        .from("taxas_cartao")
        .select("id,nome,tipo_cartao,bandeira,taxa_percentual,prazo_recebimento_dias,status")
        .eq("empresa_id", eid)
        .order("nome"),
    ]);

    if (titulosResp.error) {
      alert("ERRO FINANCEIRO: " + titulosResp.error.message);
    }

    if (contasResp.error) {
      alert("ERRO AO CARREGAR CONTAS: " + contasResp.error.message);
    }

    if (taxasResp.error) {
      alert("ERRO AO CARREGAR TAXAS: " + taxasResp.error.message);
    }

    setTitulos((titulosResp.data || []) as FinanceiroTitulo[]);
    setContasFinanceiras((contasResp.data || []) as ContaFinanceira[]);
    setTaxasCartao((taxasResp.data || []) as TaxaCartao[]);
    setLoading(false);
  }

  async function buscarClientesNoBanco(termo: string) {
    if (!empresaId) return;

    const q = termo.trim();

    if (q.length < 2) {
      setClientesBusca([]);
      return;
    }

    setLoadingClientesBusca(true);

    const { data, error } = await supabase
      .from("clientes")
      .select("id,nome,telefone,celular,whatsapp,cpf_cnpj,status")
      .eq("empresa_id", empresaId)
      .or(
        [
          `nome.ilike.%${q}%`,
          `telefone.ilike.%${q}%`,
          `celular.ilike.%${q}%`,
          `whatsapp.ilike.%${q}%`,
          `cpf_cnpj.ilike.%${q}%`,
        ].join(",")
      )
      .order("nome")
      .limit(20);

    if (error) {
      alert("ERRO AO BUSCAR CLIENTES: " + error.message);
      setClientesBusca([]);
      setLoadingClientesBusca(false);
      return;
    }

    const lista = ((data || []) as Cliente[]).filter(
      (c) => up(c.status || "ATIVO") !== "INATIVO"
    );

    setClientesBusca(lista);
    setLoadingClientesBusca(false);
  }

  function selecionarCliente(c: Cliente) {
    setClienteId(c.id);
    setClienteNome(c.nome);
    setClienteBusca(c.nome);
    setClientesBusca([]);
    setMostrarDropdownCliente(false);
  }

  const taxaSelecionada = useMemo(() => {
    return taxasCartao.find((t) => t.id === taxaCartaoId) || null;
  }, [taxasCartao, taxaCartaoId]);

  const valorTaxaForm = useMemo(() => {
    if (!taxaSelecionada) return 0;
    return calcularLiquidoComTaxa(toMoney(valorOriginal), toMoney(taxaSelecionada.taxa_percentual))
      .valorTaxa;
  }, [valorOriginal, taxaSelecionada]);

  const valorLiquidoForm = useMemo(() => {
    const base =
      toMoney(valorOriginal) + toMoney(juros) + toMoney(multa) - toMoney(desconto);

    if (!taxaSelecionada) return base;

    return base - valorTaxaForm;
  }, [valorOriginal, juros, multa, desconto, taxaSelecionada, valorTaxaForm]);

  const saldoForm = useMemo(() => {
    return Math.max(0, valorLiquidoForm - toMoney(valorPago));
  }, [valorLiquidoForm, valorPago]);

  const titulosFiltrados = useMemo(() => {
    const q = up(busca.trim());

    return titulos.filter((t) => {
      const texto = up(
        `${t.tipo} ${t.descricao || ""} ${t.cliente_nome || ""} ${t.documento || ""} ${t.categoria || ""} ${statusFinanceiro(t)} ${t.forma_pagamento || ""}`
      );

      const okBusca = !q || texto.includes(q);
      const okTipo = filtroTipo === "TODOS" || t.tipo === filtroTipo;
      const okStatus = filtroStatus === "TODOS" || statusFinanceiro(t) === filtroStatus;
      const okConta =
        filtroConta === "TODOS" || String(t.conta_financeira_id || "") === filtroConta;
      const okPeriodo =
        (!dataInicio || (t.data_vencimento && t.data_vencimento >= dataInicio)) &&
        (!dataFim || (t.data_vencimento && t.data_vencimento <= dataFim));

      return okBusca && okTipo && okStatus && okConta && okPeriodo;
    });
  }, [titulos, busca, filtroTipo, filtroStatus, filtroConta, dataInicio, dataFim]);

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

  const resumoFiado = useMemo(() => {
    const mapa: Record<string, number> = {};

    titulos.forEach((t) => {
      if (t.tipo !== "RECEBER") return;
      const saldo = saldoAbertoTitulo(t);
      if (saldo <= 0) return;

      const nome = t.cliente_nome || "SEM NOME";
      mapa[nome] = (mapa[nome] || 0) + saldo;
    });

    return Object.entries(mapa)
      .map(([cliente, valor]) => ({ cliente, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [titulos]);

  function resetForm() {
    setEditingId(null);
    setTipo("RECEBER");
    setDescricao("");
    setClienteId("");
    setClienteNome("");
    setClienteBusca("");
    setClientesBusca([]);
    setMostrarDropdownCliente(false);
    setDocumento("");
    setCategoria("");
    setValorOriginal("");
    setValorPago("");
    setDesconto("");
    setJuros("");
    setMulta("");
    setDataEmissao(hojeISO());
    setDataVencimento(hojeISO());
    setDataPagamento("");
    setFormaPagamento("DINHEIRO");
    setContaFinanceiraId("");
    setTaxaCartaoId("");
    setObservacoes("");
  }

  function resetBaixa() {
    setBaixaId(null);
    setBaixaValor("");
    setBaixaData(hojeISO());
    setBaixaObs("");
    setBaixaContaFinanceiraId("");
  }

  async function salvarTitulo() {
    if (!empresaId) return;

    const clienteNomeFinal = up((clienteNome || clienteBusca).trim());

    if (!descricao.trim()) {
      alert("PREENCHA A DESCRIÇÃO.");
      return;
    }

    const payload = {
      empresa_id: empresaId,
      tipo,
      descricao: up(descricao),
      cliente_id: clienteId || null,
      cliente_nome: clienteNomeFinal || null,
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
      forma_pagamento: up(formaPagamento),
      conta_financeira_id: contaFinanceiraId || null,
      taxa_cartao_id: taxaCartaoId || null,
      valor_taxa: valorTaxaForm,
      valor_liquido: valorLiquidoForm,
      tipo_recebimento: up(formaPagamento),
      status:
        saldoForm <= 0 ? "PAGO" : toMoney(valorPago) > 0 ? "PARCIAL" : "ABERTO",
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
    setClienteBusca(t.cliente_nome || "");
    setClientesBusca([]);
    setMostrarDropdownCliente(false);
    setDocumento(t.documento || "");
    setCategoria(t.categoria || "");
    setValorOriginal(t.valor_original != null ? String(toMoney(t.valor_original)) : "");
    setValorPago(t.valor_pago != null ? String(toMoney(t.valor_pago)) : "");
    setDesconto(t.desconto != null ? String(toMoney(t.desconto)) : "");
    setJuros(t.juros != null ? String(toMoney(t.juros)) : "");
    setMulta(t.multa != null ? String(toMoney(t.multa)) : "");
    setDataEmissao(t.data_emissao || hojeISO());
    setDataVencimento(t.data_vencimento || hojeISO());
    setDataPagamento(t.data_pagamento || "");
    setFormaPagamento(t.forma_pagamento || "DINHEIRO");
    setContaFinanceiraId(t.conta_financeira_id || "");
    setTaxaCartaoId(t.taxa_cartao_id || "");
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
    setBaixaContaFinanceiraId(t.conta_financeira_id || "");
  }

  async function registrarBaixa() {
    if (!empresaId || !baixaId) return;

    const titulo = titulos.find((t) => t.id === baixaId);
    if (!titulo) return;

    const contaIdFinal = baixaContaFinanceiraId || titulo.conta_financeira_id || "";

    if (!contaIdFinal) {
      alert("SELECIONE A CONTA DA BAIXA.");
      return;
    }

    const valorDaBaixa = toMoney(baixaValor);
    const novoValorPago = toMoney(titulo.valor_pago) + valorDaBaixa;
    const saldoRestante = Math.max(0, valorLiquidoTitulo(titulo) - novoValorPago);

    const { error } = await supabase
      .from("financeiro_titulos")
      .update({
        valor_pago: novoValorPago,
        data_pagamento: baixaData,
        conta_financeira_id: contaIdFinal,
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

    if (titulo.tipo === "RECEBER") {
      const conta = contasFinanceiras.find((c) => c.id === contaIdFinal);
      if (conta) {
        const novoSaldo = toMoney(conta.saldo_atual) + valorDaBaixa;

        await supabase
          .from("contas_financeiras")
          .update({ saldo_atual: novoSaldo })
          .eq("empresa_id", empresaId)
          .eq("id", contaIdFinal);
      }
    }

    if (titulo.tipo === "PAGAR") {
      const conta = contasFinanceiras.find((c) => c.id === contaIdFinal);
      if (conta) {
        const novoSaldo = toMoney(conta.saldo_atual) - valorDaBaixa;

        await supabase
          .from("contas_financeiras")
          .update({ saldo_atual: novoSaldo })
          .eq("empresa_id", empresaId)
          .eq("id", contaIdFinal);
      }
    }

    alert("BAIXA REGISTRADA!");
    resetBaixa();
    carregarBase();
  }

  const nomeConta = (id?: string | null) =>
    contasFinanceiras.find((c) => c.id === id)?.nome || "-";

  const nomeTaxa = (id?: string | null) =>
    taxasCartao.find((t) => t.id === id)?.nome || "-";

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F3F4F6]">
      <Sidebar />

      <main className="flex-1 min-w-0 p-6">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[30px] font-black text-[#111827] leading-none">
              FINANCEIRO PREMIUM
            </h1>
            <p className="text-[14px] text-[#6C757D] mt-2">
              CONTAS, TAXAS, BAIXAS, SALDOS, FIADO E CONTROLE INTELIGENTE
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <input
              placeholder="BUSCAR TÍTULO..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-[54px] w-[260px] xl:w-[320px] max-w-full rounded-2xl border border-[#D1D5DB] bg-white px-5 text-[16px] outline-none"
            />

            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="h-[54px] rounded-2xl border border-[#D1D5DB] bg-white px-5 text-[15px] outline-none"
            >
              <option value="TODOS">TODOS</option>
              <option value="RECEBER">RECEBER</option>
              <option value="PAGAR">PAGAR</option>
            </select>

            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="h-[54px] rounded-2xl border border-[#D1D5DB] bg-white px-5 text-[15px] outline-none"
            >
              <option value="TODOS">TODOS OS STATUS</option>
              <option value="ABERTO">ABERTO</option>
              <option value="PARCIAL">PARCIAL</option>
              <option value="PAGO">PAGO</option>
              <option value="VENCIDO">VENCIDO</option>
            </select>

            <select
              value={filtroConta}
              onChange={(e) => setFiltroConta(e.target.value)}
              className="h-[54px] rounded-2xl border border-[#D1D5DB] bg-white px-5 text-[15px] outline-none"
            >
              <option value="TODOS">TODAS AS CONTAS</option>
              {contasFinanceiras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-[54px] rounded-2xl border border-[#D1D5DB] bg-white px-5 text-[15px] outline-none"
            />

            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="h-[54px] rounded-2xl border border-[#D1D5DB] bg-white px-5 text-[15px] outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
          <CardKpi
            titulo="A RECEBER"
            valor={moneyBR(resumo.receber)}
            onClick={() => {
              setFiltroTipo("RECEBER");
              setFiltroStatus("ABERTO");
            }}
          />
          <CardKpi
            titulo="A PAGAR"
            valor={moneyBR(resumo.pagar)}
            onClick={() => {
              setFiltroTipo("PAGAR");
              setFiltroStatus("ABERTO");
            }}
          />
          <CardKpi
            titulo="RECEBIDO"
            valor={moneyBR(resumo.recebido)}
            onClick={() => {
              setFiltroTipo("RECEBER");
              setFiltroStatus("PAGO");
            }}
          />
          <CardKpi
            titulo="VENCIDO"
            valor={moneyBR(resumo.vencido)}
            onClick={() => {
              setFiltroTipo("RECEBER");
              setFiltroStatus("VENCIDO");
            }}
          />
          <CardKpi
            titulo="SALDO CAIXA"
            valor={moneyBR(resumo.saldoCaixa)}
            onClick={() => {
              setFiltroTipo("TODOS");
              setFiltroStatus("TODOS");
            }}
          />
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[1.35fr_0.65fr] gap-6 mb-6">
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

              <div className="md:col-span-2 relative">
                <label className="label">CLIENTE / FORNECEDOR</label>
                <input
                  placeholder="PESQUISE O CLIENTE POR NOME, TELEFONE OU DOCUMENTO..."
                  value={clienteBusca}
                  onChange={async (e) => {
                    const valor = e.target.value;
                    setClienteBusca(valor);
                    setClienteNome(valor);

                    if (!valor.trim()) {
                      setClienteId("");
                      setClientesBusca([]);
                      setMostrarDropdownCliente(false);
                      return;
                    }

                    setMostrarDropdownCliente(true);
                    await buscarClientesNoBanco(valor);
                  }}
                  onFocus={async () => {
                    if (clienteBusca.trim().length >= 2) {
                      setMostrarDropdownCliente(true);
                      await buscarClientesNoBanco(clienteBusca);
                    }
                  }}
                  className="campo"
                />

                {loadingClientesBusca && (
                  <div className="text-xs text-[#6C757D] mt-2">BUSCANDO CLIENTES...</div>
                )}

                {mostrarDropdownCliente &&
                  clienteBusca.trim().length >= 2 &&
                  clientesBusca.length > 0 && (
                    <div className="dropdown">
                      {clientesBusca.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selecionarCliente(c)}
                          className="dropdown-item"
                        >
                          <div className="font-semibold text-[#111827]">{c.nome}</div>
                          <div className="text-xs text-[#6B7280]">
                            {c.telefone || c.celular || c.whatsapp || c.cpf_cnpj || "-"}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                {mostrarDropdownCliente &&
                  clienteBusca.trim().length >= 2 &&
                  !loadingClientesBusca &&
                  clientesBusca.length === 0 && (
                    <div className="dropdown">
                      <div className="dropdown-item text-[#B91C1C]">
                        NENHUM CLIENTE ENCONTRADO PARA: <strong>{clienteBusca}</strong>
                      </div>
                    </div>
                  )}
              </div>

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

              <div>
                <label className="label">FORMA DE PAGAMENTO</label>
                <select
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                  className="campo"
                >
                  <option>DINHEIRO</option>
                  <option>PIX</option>
                  <option>CARTÃO DE DÉBITO</option>
                  <option>CARTÃO DE CRÉDITO</option>
                  <option>BOLETO</option>
                  <option>TRANSFERÊNCIA</option>
                  <option>A PRAZO</option>
                  <option>FIADO</option>
                </select>
              </div>

              <div>
                <label className="label">CONTA</label>
                <select
                  value={contaFinanceiraId}
                  onChange={(e) => setContaFinanceiraId(e.target.value)}
                  className="campo"
                >
                  <option value="">SELECIONE A CONTA</option>
                  {contasFinanceiras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">TAXA DE CARTÃO</label>
                <select
                  value={taxaCartaoId}
                  onChange={(e) => setTaxaCartaoId(e.target.value)}
                  className="campo"
                >
                  <option value="">SEM TAXA</option>
                  {taxasCartao.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome} - {toMoney(t.taxa_percentual).toFixed(2)}%
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                placeholder="OBSERVAÇÕES"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="campo-textarea md:col-span-4"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5">
              <ResumoMini label="VALOR ORIGINAL" value={moneyBR(toMoney(valorOriginal))} />
              <ResumoMini label="VALOR TAXA" value={moneyBR(valorTaxaForm)} />
              <ResumoMini label="VALOR LÍQUIDO" value={moneyBR(valorLiquidoForm)} />
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

          <div className="space-y-6">
            <section className="card">
              <h2 className="titulo mb-4">FIADO POR CLIENTE</h2>

              {resumoFiado.length === 0 ? (
                <div className="text-sm text-[#6C757D]">NENHUM FIADO EM ABERTO.</div>
              ) : (
                <div className="space-y-2">
                  {resumoFiado.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setBusca(c.cliente);
                        setFiltroTipo("RECEBER");
                        setFiltroStatus("TODOS");
                      }}
                      className="fiado-item"
                    >
                      <span>{c.cliente}</span>
                      <strong>{moneyBR(c.valor)}</strong>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="card">
              <h2 className="titulo mb-4">AÇÕES RÁPIDAS</h2>

              <div className="grid grid-cols-1 gap-3">
                <button
                  className="botao"
                  type="button"
                  onClick={() => {
                    setFiltroTipo("RECEBER");
                    setFiltroStatus("ABERTO");
                  }}
                >
                  VER CONTAS A RECEBER
                </button>

                <button
                  className="botao"
                  type="button"
                  onClick={() => {
                    setFiltroTipo("PAGAR");
                    setFiltroStatus("ABERTO");
                  }}
                >
                  VER CONTAS A PAGAR
                </button>

                <button
                  className="botao"
                  type="button"
                  onClick={() => {
                    setFiltroTipo("RECEBER");
                    setFiltroStatus("VENCIDO");
                  }}
                >
                  VER VENCIDOS
                </button>

                <button
                  className="botao"
                  type="button"
                  onClick={() => {
                    setBusca("");
                    setFiltroTipo("TODOS");
                    setFiltroStatus("TODOS");
                    setFiltroConta("TODOS");
                    setDataInicio("");
                    setDataFim("");
                  }}
                >
                  LIMPAR FILTROS
                </button>
              </div>
            </section>
          </div>
        </div>

        <section className="card">
          <h2 className="titulo mb-4">TÍTULOS FINANCEIROS</h2>

          <div className="overflow-auto">
            <table className="tabela min-w-[1900px]">
              <thead>
                <tr>
                  <th>TIPO</th>
                  <th>DESCRIÇÃO</th>
                  <th>CLIENTE</th>
                  <th>DOC</th>
                  <th>CONTA</th>
                  <th>TAXA</th>
                  <th>VENCIMENTO</th>
                  <th>STATUS</th>
                  <th>BRUTO</th>
                  <th>TAXA R$</th>
                  <th>LÍQUIDO</th>
                  <th>PAGO</th>
                  <th>SALDO</th>
                  <th>AÇÕES</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={14} className="text-center py-6 text-[#6C757D]">
                      CARREGANDO...
                    </td>
                  </tr>
                ) : titulosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="text-center py-6 text-[#6C757D]">
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
                      <td>{nomeConta(t.conta_financeira_id)}</td>
                      <td>{nomeTaxa(t.taxa_cartao_id)}</td>
                      <td>{t.data_vencimento || "-"}</td>
                      <td>{statusFinanceiro(t)}</td>
                      <td>{moneyBR(toMoney(t.valor_original))}</td>
                      <td>{moneyBR(toMoney(t.valor_taxa))}</td>
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

        {baixaId && (
          <div className="modal-overlay" onClick={resetBaixa}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2 className="titulo mb-4">BAIXAR TÍTULO</h2>

              <div>
                <label className="label">VALOR DA BAIXA</label>
                <input
                  className="campo"
                  type="number"
                  value={baixaValor}
                  onChange={(e) => setBaixaValor(e.target.value)}
                  placeholder="VALOR DA BAIXA"
                />
              </div>

              <div className="mt-3">
                <label className="label">DATA DA BAIXA</label>
                <input
                  className="campo"
                  type="date"
                  value={baixaData}
                  onChange={(e) => setBaixaData(e.target.value)}
                />
              </div>

              <div className="mt-3">
                <label className="label">CONTA DA BAIXA</label>
                <select
                  className="campo"
                  value={baixaContaFinanceiraId}
                  onChange={(e) => setBaixaContaFinanceiraId(e.target.value)}
                >
                  <option value="">SELECIONE A CONTA</option>
                  {contasFinanceiras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3">
                <label className="label">OBSERVAÇÃO</label>
                <textarea
                  className="campo-textarea"
                  value={baixaObs}
                  onChange={(e) => setBaixaObs(e.target.value)}
                  placeholder="OBSERVAÇÃO"
                />
              </div>

              <div className="flex gap-3 mt-4 flex-wrap">
                <button className="botao-azul" onClick={registrarBaixa} type="button">
                  CONFIRMAR BAIXA
                </button>

                <button className="botao" onClick={resetBaixa} type="button">
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .card {
          background: white;
          border-radius: 24px;
          padding: 22px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
          border: 1px solid #e5e7eb;
        }

        .titulo {
          font-size: 18px;
          font-weight: 900;
          color: #111827;
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
          border: 1.5px solid #d1d5db;
          border-radius: 14px;
          padding: 0 14px;
          width: 100%;
          background: white;
          font-size: 14px;
          color: #111827;
          outline: none;
        }

        .campo:focus,
        .campo-textarea:focus {
          border-color: #0456a3;
          box-shadow: 0 0 0 4px rgba(4, 86, 163, 0.08);
        }

        .campo-textarea {
          min-height: 110px;
          width: 100%;
          border: 1.5px solid #d1d5db;
          border-radius: 14px;
          padding: 12px 14px;
          background: white;
          font-size: 14px;
          color: #111827;
          outline: none;
          resize: vertical;
        }

        .dropdown {
          position: absolute;
          z-index: 30;
          width: 100%;
          border-radius: 16px;
          border: 1px solid #dbe4ee;
          background: white;
          box-shadow: 0 18px 35px rgba(15, 23, 42, 0.12);
          max-height: 260px;
          overflow: auto;
          margin-top: 8px;
        }

        .dropdown-item {
          width: 100%;
          text-align: left;
          padding: 12px;
          border-bottom: 1px solid #eef2f7;
          background: white;
        }

        .dropdown-item:last-child {
          border-bottom: none;
        }

        .dropdown-item:hover {
          background: #f8fafc;
        }

        .botao {
          height: 46px;
          border-radius: 14px;
          border: 1px solid #d1d5db;
          background: white;
          padding: 0 16px;
          font-weight: 800;
          color: #111827;
        }

        .botao-azul {
          height: 46px;
          border-radius: 14px;
          border: none;
          background: #0456a3;
          padding: 0 16px;
          font-weight: 900;
          color: white;
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
          border-bottom: 1px solid #e5e7eb;
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

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          padding: 16px;
        }

        .modal {
          width: 100%;
          max-width: 520px;
          background: white;
          border-radius: 24px;
          padding: 22px;
          box-shadow: 0 30px 70px rgba(15, 23, 42, 0.28);
        }

        .fiado-item {
          width: 100%;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          padding: 14px 16px;
          border-radius: 16px;
          border: 1px solid #e5e7eb;
          background: #f8fafc;
          color: #111827;
          font-weight: 700;
        }

        .fiado-item:hover {
          background: #eef6ff;
        }
      `}</style>
    </div>
  );
}

function CardKpi({
  titulo,
  valor,
  onClick,
}: {
  titulo: string;
  valor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[22px] bg-white p-5 text-left shadow-sm border border-[#E5E7EB]"
    >
      <div className="text-[11px] font-black tracking-[0.12em] text-[#6B7280]">{titulo}</div>
      <div className="mt-2 text-[24px] font-black text-[#111827] break-words">{valor}</div>
    </button>
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
    <div
      className={`rounded-[18px] p-4 border ${
        destaque
          ? "bg-[#0456A3] text-white border-[#0456A3]"
          : "bg-[#F8FAFC] text-[#111827] border-[#E5E7EB]"
      }`}
    >
      <div className={`text-[10px] font-black tracking-[0.12em] ${destaque ? "text-white/80" : "text-[#64748B]"}`}>
        {label}
      </div>
      <div className="mt-2 text-[18px] font-black break-words">{value}</div>
    </div>
  );
}