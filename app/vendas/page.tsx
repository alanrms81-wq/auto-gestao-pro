"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { canAccess } from "@/lib/authGuard";
import { getEmpresaFiscal } from "@/lib/fiscal";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

/* =========================
   TIPOS
========================= */

type SessionUser = {
  id?: string;
  empresa_id: string;
  role?: string | null;
  nome?: string | null;
};

type Cliente = {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  cpf_cnpj?: string | null;
  cidade?: string | null;
  estado?: string | null;
  status?: string | null;
};

type Produto = {
  id: string;
  nome: string;
  codigo_sku?: string | null;
  codigo_barras?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  preco_balcao?: number | null;
  preco_instalacao?: number | null;
  preco_revenda?: number | null;
  estoque_atual?: number | null;
  controla_estoque?: boolean | null;
  status?: string | null;
};

type Venda = {
  id: string;
  numero?: string | null;
  cliente_nome?: string | null;
  forma_pagamento?: string | null;
  total?: number | null;
  created_at?: string | null;
  status?: string | null;
};

type VendaItem = {
  id: number;
  produtoId: string | null;
  nome: string;
  codigo?: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
  estoqueAtual?: number;
  controlaEstoque?: boolean;
};

type ContaFinanceira = {
  id: string;
  nome?: string | null;
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

/* =========================
   HELPERS
========================= */

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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function hojeLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function agoraLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function formatDateTimeBr(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}

function getPrecoPadraoProduto(p: Produto) {
  return (
    toMoney(p.preco_balcao) ||
    toMoney(p.preco_instalacao) ||
    toMoney(p.preco_revenda) ||
    0
  );
}

function gerarNumeroInterno(data: Venda[]) {
  if (!data?.length) return "VD-000001";

  let maior = 0;

  for (const item of data) {
    const m = String(item.numero || "").match(/\d+/);
    const n = m ? Number(m[0]) : 0;
    if (n > maior) maior = n;
  }

  return `VD-${String(maior + 1).padStart(6, "0")}`;
}

function isPagamentoImediato(formaPagamento: string) {
  const f = up(formaPagamento);

  return (
    f === "DINHEIRO" ||
    f === "PIX" ||
    f === "CARTÃO DE DÉBITO" ||
    f === "CARTAO DE DÉBITO" ||
    f === "CARTAO DE DEBITO" ||
    f === "CARTÃO DE CRÉDITO" ||
    f === "CARTAO DE CRÉDITO" ||
    f === "CARTAO DE CREDITO" ||
    f === "TRANSFERÊNCIA" ||
    f === "TRANSFERENCIA"
  );
}

function isCartao(formaPagamento: string) {
  const f = up(formaPagamento);
  return f.includes("CARTÃO") || f.includes("CARTAO");
}

function getFinanceiroStatus(formaPagamento: string) {
  return isPagamentoImediato(formaPagamento) ? "PAGO" : "ABERTO";
}

function calcularLiquidoComTaxa(valorBruto: number, taxaPercentual: number) {
  const bruto = Number(valorBruto) || 0;
  const taxa = Number(taxaPercentual) || 0;

  const valorTaxa = bruto * (taxa / 100);
  const valorLiquido = bruto - valorTaxa;

  return {
    valorTaxa,
    valorLiquido,
  };
}

/* =========================
   COMPONENTE
========================= */

export default function VendasPage() {
  const router = useRouter();
  const empresaFiscal = getEmpresaFiscal();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [numeroVenda, setNumeroVenda] = useState("VD-000001");
  const [formaPagamento, setFormaPagamento] = useState("DINHEIRO");
  const [desconto, setDesconto] = useState("0");
  const [observacoes, setObservacoes] = useState("");

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [historico, setHistorico] = useState<Venda[]>([]);

  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [clientesEncontrados, setClientesEncontrados] = useState<Cliente[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);

  const [produtoBusca, setProdutoBusca] = useState("");
  const [produtosEncontrados, setProdutosEncontrados] = useState<Produto[]>([]);
  const [buscandoProdutos, setBuscandoProdutos] = useState(false);

  const [itens, setItens] = useState<VendaItem[]>([]);
  const [buscaHistorico, setBuscaHistorico] = useState("");

  const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceira[]>([]);
  const [taxasCartao, setTaxasCartao] = useState<TaxaCartao[]>([]);
  const [contaFinanceiraId, setContaFinanceiraId] = useState("");
  const [taxaCartaoId, setTaxaCartaoId] = useState("");

  const clienteBoxRef = useRef<HTMLDivElement | null>(null);
  const produtoBoxRef = useRef<HTMLDivElement | null>(null);

  const [openClientes, setOpenClientes] = useState(false);
  const [openProdutos, setOpenProdutos] = useState(false);

  /* =========================
     INIT / ACESSO
  ========================= */

  useEffect(() => {
    async function init() {
      const user = (await getSessionUser()) as SessionUser | null;

      if (!user) {
        router.push("/login");
        return;
      }

      const isAdmin = String(user.role || "").toUpperCase() === "ADMIN";

      if (!isAdmin && !canAccess("VENDAS")) {
        alert("ACESSO NEGADO");
        router.push("/dashboard");
        return;
      }

      setEmpresaId(user.empresa_id);
      await carregarBase(user.empresa_id);
      setReady(true);
    }

    init();
  }, [router]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;

      if (clienteBoxRef.current && !clienteBoxRef.current.contains(target)) {
        setOpenClientes(false);
      }

      if (produtoBoxRef.current && !produtoBoxRef.current.contains(target)) {
        setOpenProdutos(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  /* =========================
     CARREGAMENTO BASE
  ========================= */

  async function carregarBase(empId: string) {
    setLoading(true);

    const [produtosResp, vendasResp, contasResp, taxasResp] = await Promise.all([
      supabase
        .from("produtos")
        .select(
          "id,nome,codigo_sku,codigo_barras,categoria,subcategoria,preco_balcao,preco_instalacao,preco_revenda,estoque_atual,controla_estoque,status"
        )
        .eq("empresa_id", empId)
        .order("nome"),

      supabase
        .from("vendas")
        .select("id,numero,cliente_nome,forma_pagamento,total,created_at,status")
        .eq("empresa_id", empId)
        .order("created_at", { ascending: false }),

      supabase
        .from("contas_financeiras")
        .select("id,nome,saldo_atual,status")
        .eq("empresa_id", empId)
        .eq("status", "ATIVO")
        .order("nome"),

      supabase
        .from("taxas_cartao")
        .select("id,nome,tipo_cartao,bandeira,taxa_percentual,prazo_recebimento_dias,status")
        .eq("empresa_id", empId)
        .eq("status", "ATIVO")
        .order("nome"),
    ]);

    if (produtosResp.error) {
      alert("ERRO AO CARREGAR PRODUTOS: " + produtosResp.error.message);
    }

    if (vendasResp.error) {
      alert("ERRO AO CARREGAR VENDAS: " + vendasResp.error.message);
    }

    if (contasResp.error) {
      alert("ERRO AO CARREGAR CONTAS FINANCEIRAS: " + contasResp.error.message);
    }

    if (taxasResp.error) {
      alert("ERRO AO CARREGAR TAXAS DE CARTÃO: " + taxasResp.error.message);
    }

    const listaProdutos = (produtosResp.data || []) as Produto[];
    const listaVendas = (vendasResp.data || []) as Venda[];
    const listaContas = (contasResp.data || []) as ContaFinanceira[];
    const listaTaxas = (taxasResp.data || []) as TaxaCartao[];

    setProdutos(listaProdutos);
    setHistorico(listaVendas);
    setContasFinanceiras(listaContas);
    setTaxasCartao(listaTaxas);
    setNumeroVenda(gerarNumeroInterno(listaVendas));
    setLoading(false);
  }

  /* =========================
     BUSCA CLIENTE
  ========================= */

  async function buscarClientes(termo: string) {
    if (!empresaId) return;

    const q = termo.trim();

    if (q.length < 2) {
      setClientesEncontrados([]);
      return;
    }

    setBuscandoClientes(true);

    const { data, error } = await supabase
      .from("clientes")
      .select("id,nome,telefone,email,cpf_cnpj,cidade,estado,status")
      .eq("empresa_id", empresaId)
      .or(
        [
          `nome.ilike.%${q}%`,
          `telefone.ilike.%${q}%`,
          `email.ilike.%${q}%`,
          `cpf_cnpj.ilike.%${q}%`,
          `cidade.ilike.%${q}%`,
        ].join(",")
      )
      .order("nome")
      .limit(20);

    if (error) {
      alert("ERRO AO BUSCAR CLIENTES: " + error.message);
      setClientesEncontrados([]);
      setBuscandoClientes(false);
      return;
    }

    const lista = ((data || []) as Cliente[]).filter(
      (c) => up(c.status || "ATIVO") !== "INATIVO"
    );

    setClientesEncontrados(lista);
    setBuscandoClientes(false);
  }

  function selecionarCliente(cliente: Cliente) {
    setClienteSelecionado(cliente);
    setClienteBusca(cliente.nome);
    setClientesEncontrados([]);
    setOpenClientes(false);
  }

  /* =========================
     BUSCA PRODUTO
  ========================= */

  async function buscarProdutos(termo: string) {
    if (!empresaId) return;

    const q = termo.trim();

    if (q.length < 2) {
      setProdutosEncontrados([]);
      return;
    }

    setBuscandoProdutos(true);

    const { data, error } = await supabase
      .from("produtos")
      .select(
        "id,nome,codigo_sku,codigo_barras,categoria,subcategoria,preco_balcao,preco_instalacao,preco_revenda,estoque_atual,controla_estoque,status"
      )
      .eq("empresa_id", empresaId)
      .or(
        [
          `nome.ilike.%${q}%`,
          `codigo_sku.ilike.%${q}%`,
          `codigo_barras.ilike.%${q}%`,
          `categoria.ilike.%${q}%`,
          `subcategoria.ilike.%${q}%`,
        ].join(",")
      )
      .order("nome")
      .limit(40);

    if (error) {
      alert("ERRO AO BUSCAR PRODUTOS: " + error.message);
      setProdutosEncontrados([]);
      setBuscandoProdutos(false);
      return;
    }

    const lista = ((data || []) as Produto[]).filter(
      (p) => up(p.status || "ATIVO") !== "INATIVO"
    );

    setProdutosEncontrados(lista);
    setBuscandoProdutos(false);
  }

  function adicionarProduto(produto: Produto) {
    const preco = getPrecoPadraoProduto(produto);

    setItens((prev) => [
      ...prev,
      {
        id: Date.now() + Math.floor(Math.random() * 1000),
        produtoId: produto.id,
        nome: produto.nome,
        codigo: produto.codigo_sku || produto.codigo_barras || "",
        quantidade: 1,
        valorUnitario: preco,
        total: preco,
        estoqueAtual: toMoney(produto.estoque_atual),
        controlaEstoque: !!produto.controla_estoque,
      },
    ]);

    setProdutoBusca("");
    setProdutosEncontrados([]);
    setOpenProdutos(false);
  }

  /* =========================
     ITENS
  ========================= */

  function atualizarItem(
    id: number,
    campo: "quantidade" | "valorUnitario" | "nome" | "codigo",
    valor: string | number
  ) {
    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const next = {
          ...item,
          [campo]:
            campo === "quantidade" || campo === "valorUnitario"
              ? Number(valor)
              : String(valor),
        };

        next.total = toMoney(next.quantidade) * toMoney(next.valorUnitario);
        return next;
      })
    );
  }

  function removerItem(id: number) {
    setItens((prev) => prev.filter((item) => item.id !== id));
  }

  function limparVenda() {
    setFormaPagamento("DINHEIRO");
    setDesconto("0");
    setObservacoes("");
    setClienteBusca("");
    setClienteSelecionado(null);
    setClientesEncontrados([]);
    setProdutoBusca("");
    setProdutosEncontrados([]);
    setItens([]);
    setOpenClientes(false);
    setOpenProdutos(false);
    setNumeroVenda(gerarNumeroInterno(historico));
    setContaFinanceiraId("");
    setTaxaCartaoId("");
  }

  /* =========================
     TOTAIS
  ========================= */

  const subtotal = useMemo(() => {
    return itens.reduce((acc, item) => acc + toMoney(item.total), 0);
  }, [itens]);

  const totalGeral = useMemo(() => {
    return Math.max(0, subtotal - toMoney(desconto));
  }, [subtotal, desconto]);

  const historicoFiltrado = useMemo(() => {
    const q = up(buscaHistorico.trim());
    if (!q) return historico;

    return historico.filter((v) =>
      up(
        `${v.numero || ""} ${v.cliente_nome || ""} ${v.forma_pagamento || ""} ${v.status || ""}`
      ).includes(q)
    );
  }, [historico, buscaHistorico]);

  const pagamentoImediato = useMemo(() => {
    return isPagamentoImediato(formaPagamento);
  }, [formaPagamento]);

  const statusFinanceiroAtual = useMemo(() => {
    return getFinanceiroStatus(formaPagamento);
  }, [formaPagamento]);

  const taxaSelecionada = useMemo(() => {
    return taxasCartao.find((t) => t.id === taxaCartaoId) || null;
  }, [taxasCartao, taxaCartaoId]);

  const taxaCompativelComForma = useMemo(() => {
    if (!isCartao(formaPagamento)) return true;
    if (!taxaSelecionada) return false;

    const forma = up(formaPagamento);
    const tipoTaxa = up(taxaSelecionada.tipo_cartao || "");

    if (forma.includes("DÉBITO") || forma.includes("DEBITO")) {
      return tipoTaxa === "DEBITO";
    }

    if (forma.includes("CRÉDITO") || forma.includes("CREDITO")) {
      return tipoTaxa === "CREDITO" || tipoTaxa === "CREDITO PARCELADO";
    }

    return true;
  }, [formaPagamento, taxaSelecionada]);

  const { valorTaxaCalculado, valorLiquidoCalculado } = useMemo(() => {
    if (!isCartao(formaPagamento) || !taxaSelecionada || !taxaCompativelComForma) {
      return {
        valorTaxaCalculado: 0,
        valorLiquidoCalculado: totalGeral,
      };
    }

    const calc = calcularLiquidoComTaxa(
      totalGeral,
      Number(taxaSelecionada.taxa_percentual || 0)
    );

    return {
      valorTaxaCalculado: calc.valorTaxa,
      valorLiquidoCalculado: calc.valorLiquido,
    };
  }, [formaPagamento, taxaSelecionada, taxaCompativelComForma, totalGeral]);

  const taxasFiltradasPorForma = useMemo(() => {
    if (!isCartao(formaPagamento)) return taxasCartao;

    const forma = up(formaPagamento);

    return taxasCartao.filter((taxa) => {
      const tipo = up(taxa.tipo_cartao || "");

      if (forma.includes("DÉBITO") || forma.includes("DEBITO")) {
        return tipo === "DEBITO";
      }

      if (forma.includes("CRÉDITO") || forma.includes("CREDITO")) {
        return tipo === "CREDITO" || tipo === "CREDITO PARCELADO";
      }

      return true;
    });
  }, [formaPagamento, taxasCartao]);

  /* =========================
     SALVAR
  ========================= */

  async function salvarVenda() {
    if (!empresaId) return;

    if (!clienteSelecionado) {
      alert("SELECIONE UM CLIENTE.");
      return;
    }

    if (!itens.length) {
      alert("ADICIONE PELO MENOS UM ITEM.");
      return;
    }

    if (!contaFinanceiraId) {
      alert("SELECIONE A CONTA FINANCEIRA.");
      return;
    }

    if (isCartao(formaPagamento) && !taxaCartaoId) {
      alert("SELECIONE A TAXA DE CARTÃO.");
      return;
    }

    if (isCartao(formaPagamento) && !taxaCompativelComForma) {
      alert("A TAXA SELECIONADA NÃO É COMPATÍVEL COM A FORMA DE PAGAMENTO.");
      return;
    }

    for (const item of itens) {
      if (item.controlaEstoque && toMoney(item.quantidade) > toMoney(item.estoqueAtual)) {
        alert(`ESTOQUE INSUFICIENTE PARA ${item.nome}.`);
        return;
      }
    }

    const vendaPayload = {
      empresa_id: empresaId,
      numero: numeroVenda,
      cliente_id: clienteSelecionado.id,
      cliente_nome: up(clienteSelecionado.nome),
      cliente_telefone: clienteSelecionado.telefone || "",
      forma_pagamento: up(formaPagamento),
      subtotal,
      desconto: toMoney(desconto),
      total: totalGeral,
      observacoes: up(observacoes),
      data_venda: agoraLocalISO(),
      status: "FINALIZADA",
    };

    const { data: vendaCriada, error: vendaError } = await supabase
      .from("vendas")
      .insert([vendaPayload])
      .select("id")
      .single();

    if (vendaError || !vendaCriada) {
      alert("ERRO AO SALVAR VENDA: " + (vendaError?.message || ""));
      return;
    }

    const itensPayload = itens.map((item) => ({
      venda_id: vendaCriada.id,
      produto_id: item.produtoId,
      produto_nome: up(item.nome),
      codigo: up(item.codigo || ""),
      quantidade: toMoney(item.quantidade),
      valor_unitario: toMoney(item.valorUnitario),
      total: toMoney(item.total),
    }));

    const { error: itensError } = await supabase.from("venda_itens").insert(itensPayload);

    if (itensError) {
      alert("VENDA SALVA, MAS DEU ERRO AO SALVAR ITENS: " + itensError.message);
      return;
    }

    for (const item of itens) {
      if (!item.produtoId || !item.controlaEstoque) continue;

      const novoEstoque = Math.max(0, toMoney(item.estoqueAtual) - toMoney(item.quantidade));

      const { error: estoqueError } = await supabase
        .from("produtos")
        .update({ estoque_atual: novoEstoque })
        .eq("id", item.produtoId)
        .eq("empresa_id", empresaId);

      if (estoqueError) {
        alert("VENDA SALVA, MAS DEU ERRO AO BAIXAR ESTOQUE.");
        return;
      }
    }

    const financeiroPayload = {
      empresa_id: empresaId,
      tipo: "RECEBER",
      descricao: up(`VENDA ${numeroVenda}`),
      cliente_id: clienteSelecionado.id,
      cliente_nome: up(clienteSelecionado.nome),
      documento: up(numeroVenda),
      categoria: "VENDAS",
      valor_original: totalGeral,
      valor_pago: pagamentoImediato ? valorLiquidoCalculado : 0,
      desconto: 0,
      juros: 0,
      multa: 0,
      data_emissao: hojeLocalISO(),
      data_vencimento: hojeLocalISO(),
      data_pagamento: pagamentoImediato ? hojeLocalISO() : null,
      forma_pagamento: up(formaPagamento),
      status: pagamentoImediato ? "PAGO" : "ABERTO",
      observacoes: up(observacoes || `TÍTULO GERADO PELA VENDA ${numeroVenda}`),
      conta_financeira_id: contaFinanceiraId || null,
      taxa_cartao_id: taxaCartaoId || null,
      valor_taxa: valorTaxaCalculado,
      valor_liquido: valorLiquidoCalculado,
      tipo_recebimento: up(formaPagamento),
    };

    const { error: financeiroError } = await supabase
      .from("financeiro_titulos")
      .insert([financeiroPayload]);

    if (financeiroError) {
      alert("VENDA SALVA, MAS DEU ERRO NO FINANCEIRO: " + financeiroError.message);
      return;
    }

    if (pagamentoImediato && contaFinanceiraId) {
      const conta = contasFinanceiras.find((c) => c.id === contaFinanceiraId);

      if (conta) {
        const novoSaldo = toMoney(conta.saldo_atual) + valorLiquidoCalculado;

        const { error: contaError } = await supabase
          .from("contas_financeiras")
          .update({ saldo_atual: novoSaldo })
          .eq("id", contaFinanceiraId)
          .eq("empresa_id", empresaId);

        if (contaError) {
          alert("VENDA SALVA, MAS DEU ERRO AO ATUALIZAR A CONTA FINANCEIRA.");
          return;
        }
      }
    }

    alert(
      pagamentoImediato
        ? "VENDA SALVA COMO PAGA, COM TAXA E CONTA FINANCEIRA!"
        : "VENDA SALVA COMO PENDENTE NO FINANCEIRO!"
    );

    await carregarBase(empresaId);
    limparVenda();
  }

  /* =========================
     PRÉVIA
  ========================= */

  function imprimirPreviaFiscal() {
    if (!itens.length) {
      alert("ADICIONE PRODUTOS PARA IMPRIMIR.");
      return;
    }

    const clienteNome = clienteSelecionado?.nome || "-";
    const contaNome =
      contasFinanceiras.find((c) => c.id === contaFinanceiraId)?.nome || "-";
    const taxaNome = taxaSelecionada?.nome || "-";

    const itensRows = itens
      .map(
        (item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${item.codigo || "-"}</td>
            <td>${item.nome}</td>
            <td>${item.quantidade}</td>
            <td>${moneyBR(item.valorUnitario)}</td>
            <td>${moneyBR(item.total)}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <html>
        <head>
          <title>PRÉVIA VENDA ${numeroVenda}</title>
          <style>
            body{font-family:Arial,sans-serif;padding:20px;color:#111}
            .box{border:1px solid #222;padding:10px;margin-bottom:10px}
            .titulo{font-size:18px;font-weight:700}
            .sub{font-size:12px;color:#444}
            table{width:100%;border-collapse:collapse;margin-top:10px}
            th,td{border:1px solid #222;padding:6px;font-size:12px}
            th{background:#f3f3f3}
            .linha{display:flex;justify-content:space-between;padding:4px 0}
            .final{font-size:18px;font-weight:700;border-top:2px solid #111;padding-top:8px}
          </style>
        </head>
        <body>
          <div class="box">
            <div class="titulo">${empresaFiscal.nomeFantasia || "EMPRESA"}</div>
            <div class="sub">VENDA ${numeroVenda}</div>
            <div class="sub">CLIENTE: ${clienteNome}</div>
            <div class="sub">FORMA DE PAGAMENTO: ${formaPagamento}</div>
            <div class="sub">CONTA: ${contaNome}</div>
            <div class="sub">TAXA: ${taxaNome}</div>
            <div class="sub">STATUS FINANCEIRO: ${pagamentoImediato ? "PAGO" : "ABERTO"}</div>
            <div class="sub">EMISSÃO: ${formatDateTimeBr(new Date().toISOString())}</div>
          </div>

          <div class="box">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>CÓDIGO</th>
                  <th>PRODUTO</th>
                  <th>QTD</th>
                  <th>UNIT</th>
                  <th>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${itensRows}
              </tbody>
            </table>
          </div>

          <div class="box">
            <div class="linha"><span>SUBTOTAL</span><strong>${moneyBR(subtotal)}</strong></div>
            <div class="linha"><span>DESCONTO</span><strong>${moneyBR(toMoney(desconto))}</strong></div>
            <div class="linha"><span>TAXA</span><strong>${moneyBR(valorTaxaCalculado)}</strong></div>
            <div class="linha final"><span>TOTAL LÍQUIDO</span><strong>${moneyBR(valorLiquidoCalculado)}</strong></div>
          </div>

          <script>window.onload=function(){window.print();}</script>
        </body>
      </html>
    `;

    const w = window.open("", "_blank", "width=1100,height=850");
    if (!w) {
      alert("LIBERE POPUP PARA IMPRIMIR.");
      return;
    }

    w.document.open();
    w.document.write(html);
    w.document.close();
  }

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
                VENDAS PREMIUM
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="pill pill-white">NÚMERO {numeroVenda}</span>
                <span className="pill pill-success">{formaPagamento}</span>
                <span className={`pill ${pagamentoImediato ? "pill-paid" : "pill-open"}`}>
                  {statusFinanceiroAtual}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
              <KpiMini titulo="ITENS" valor={String(itens.length)} />
              <KpiMini titulo="SUBTOTAL" valor={moneyBR(subtotal)} />
              <KpiMini titulo="TAXA" valor={moneyBR(valorTaxaCalculado)} />
              <KpiMini titulo="LÍQUIDO" value={moneyBR(valorLiquidoCalculado)} destaque />
            </div>
          </div>

          <div className="mt-5 flex gap-3 flex-wrap">
            <button onClick={imprimirPreviaFiscal} className="botao-header" type="button">
              IMPRIMIR PRÉVIA
            </button>

            <button onClick={salvarVenda} className="botao-header-primary" type="button">
              SALVAR VENDA
            </button>

            <button onClick={limparVenda} className="botao-header" type="button">
              NOVA VENDA
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <section className="space-y-6">
            <div className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">CLIENTE E PAGAMENTO</h2>
                  <p className="section-subtitle">
                    Busque o cliente e defina a forma de pagamento.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 relative" ref={clienteBoxRef}>
                  <label className="label">CLIENTE</label>
                  <input
                    value={clienteBusca}
                    onChange={async (e) => {
                      const valor = e.target.value;
                      setClienteBusca(valor);
                      setOpenClientes(true);
                      await buscarClientes(valor);
                    }}
                    onFocus={async () => {
                      setOpenClientes(true);
                      if (clienteBusca.trim().length >= 2) {
                        await buscarClientes(clienteBusca);
                      }
                    }}
                    placeholder="NOME, TELEFONE, E-MAIL, DOCUMENTO..."
                    className="campo"
                  />

                  {buscandoClientes && (
                    <div className="text-xs text-[#64748B] mt-2">BUSCANDO CLIENTES...</div>
                  )}

                  {openClientes && clientesEncontrados.length > 0 && (
                    <div className="dropdown">
                      {clientesEncontrados.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selecionarCliente(c)}
                          className="dropdown-item"
                        >
                          <div className="font-bold text-[#0F172A]">{c.nome}</div>
                          <div className="text-xs text-[#64748B]">
                            {c.telefone || "-"} {c.email ? `• ${c.email}` : ""}
                          </div>
                          <div className="text-xs text-[#64748B]">
                            {c.cpf_cnpj || "-"} {c.cidade ? `• ${c.cidade}/${c.estado || ""}` : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {openClientes &&
                    clienteBusca.trim().length >= 2 &&
                    !buscandoClientes &&
                    clientesEncontrados.length === 0 && (
                      <div className="dropdown">
                        <div className="dropdown-item text-[#B91C1C]">
                          NENHUM CLIENTE ENCONTRADO.
                        </div>
                      </div>
                    )}
                </div>

                <div>
                  <label className="label">FORMA DE PAGAMENTO</label>
                  <select
                    value={formaPagamento}
                    onChange={(e) => {
                      const novaForma = e.target.value;
                      setFormaPagamento(novaForma);

                      if (!isCartao(novaForma)) {
                        setTaxaCartaoId("");
                      }
                    }}
                    className="campo bg-white"
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
              </div>

              {clienteSelecionado && (
                <div className="mt-4 rounded-[16px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="info-label">CLIENTE</span>
                      <div className="info-value">{clienteSelecionado.nome}</div>
                    </div>
                    <div>
                      <span className="info-label">TELEFONE</span>
                      <div className="info-value">{clienteSelecionado.telefone || "-"}</div>
                    </div>
                    <div>
                      <span className="info-label">DOCUMENTO</span>
                      <div className="info-value">{clienteSelecionado.cpf_cnpj || "-"}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="label">CONTA FINANCEIRA</label>
                  <select
                    value={contaFinanceiraId}
                    onChange={(e) => setContaFinanceiraId(e.target.value)}
                    className="campo bg-white"
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
                    className="campo bg-white"
                    disabled={!isCartao(formaPagamento)}
                  >
                    <option value="">
                      {isCartao(formaPagamento) ? "SELECIONE A TAXA" : "NÃO SE APLICA"}
                    </option>
                    {taxasFiltradasPorForma.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome} - {toMoney(t.taxa_percentual).toFixed(2)}%
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <div
                  className={`rounded-[16px] px-4 py-3 text-sm font-bold ${
                    pagamentoImediato
                      ? "bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]"
                      : "bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]"
                  }`}
                >
                  {pagamentoImediato
                    ? "ESSA VENDA CAIRÁ COMO PAGA NO FINANCEIRO."
                    : "ESSA VENDA CAIRÁ COMO PENDENTE / EM ABERTO NO FINANCEIRO."}
                </div>
              </div>
            </div>

            <div className="card" ref={produtoBoxRef}>
              <div className="section-header">
                <div>
                  <h2 className="section-title">PRODUTOS</h2>
                  <p className="section-subtitle">
                    Busque por nome, SKU, código de barras, categoria ou subcategoria.
                  </p>
                </div>
                <div className="helper-badge">DIGITE 2 LETRAS</div>
              </div>

              <div className="relative">
                <input
                  value={produtoBusca}
                  onChange={async (e) => {
                    const valor = e.target.value;
                    setProdutoBusca(valor);
                    setOpenProdutos(true);
                    await buscarProdutos(valor);
                  }}
                  onFocus={async () => {
                    setOpenProdutos(true);
                    if (produtoBusca.trim().length >= 2) {
                      await buscarProdutos(produtoBusca);
                    }
                  }}
                  placeholder="BUSCAR PRODUTO..."
                  className="campo"
                />

                {buscandoProdutos && (
                  <div className="text-xs text-[#64748B] mt-2">BUSCANDO PRODUTOS...</div>
                )}

                {openProdutos && produtosEncontrados.length > 0 && (
                  <div className="dropdown top-full mt-2">
                    {produtosEncontrados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => adicionarProduto(p)}
                        className="dropdown-item"
                      >
                        <div className="flex justify-between gap-4">
                          <div>
                            <div className="font-bold text-[#0F172A]">{up(p.nome)}</div>
                            <div className="text-xs text-[#64748B]">
                              {up(p.codigo_sku || p.codigo_barras || "-")} • ESTOQUE{" "}
                              {toMoney(p.estoque_atual)}
                            </div>
                            <div className="text-xs text-[#64748B] mt-1">
                              {up(p.categoria || "-")}
                              {p.subcategoria ? ` / ${up(p.subcategoria)}` : ""}
                            </div>
                          </div>

                          <div className="font-black text-[#0456A3]">
                            {moneyBR(getPrecoPadraoProduto(p))}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {openProdutos &&
                  produtoBusca.trim().length >= 2 &&
                  !buscandoProdutos &&
                  produtosEncontrados.length === 0 && (
                    <div className="dropdown top-full mt-2">
                      <div className="dropdown-item text-[#B91C1C]">
                        NENHUM PRODUTO ENCONTRADO.
                      </div>
                    </div>
                  )}
              </div>

              <div className="mt-4 overflow-auto">
                <table className="tabela min-w-[1200px]">
                  <thead>
                    <tr>
                      <th>PRODUTO</th>
                      <th>CÓDIGO</th>
                      <th>ESTOQUE</th>
                      <th>QTD</th>
                      <th>V. UNIT.</th>
                      <th>TOTAL</th>
                      <th>AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.length === 0 ? (
                      <tr>
                        <td className="empty-state" colSpan={7}>
                          NENHUM ITEM ADICIONADO.
                        </td>
                      </tr>
                    ) : (
                      itens.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <input
                              value={item.nome}
                              onChange={(e) => atualizarItem(item.id, "nome", e.target.value)}
                              className="campo-tabela"
                            />
                          </td>

                          <td>
                            <input
                              value={item.codigo || ""}
                              onChange={(e) => atualizarItem(item.id, "codigo", e.target.value)}
                              className="campo-tabela"
                            />
                          </td>

                          <td className="font-semibold">
                            {item.controlaEstoque ? toMoney(item.estoqueAtual) : "-"}
                          </td>

                          <td>
                            <input
                              type="number"
                              min="1"
                              value={item.quantidade}
                              onChange={(e) =>
                                atualizarItem(item.id, "quantidade", Number(e.target.value))
                              }
                              className="campo-tabela text-right"
                            />
                          </td>

                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={item.valorUnitario}
                              onChange={(e) =>
                                atualizarItem(item.id, "valorUnitario", Number(e.target.value))
                              }
                              className="campo-tabela text-right"
                            />
                          </td>

                          <td className="font-black text-right text-[#0F172A]">
                            {moneyBR(item.total)}
                          </td>

                          <td className="text-right">
                            <button
                              onClick={() => removerItem(item.id)}
                              className="botao-mini danger"
                              type="button"
                            >
                              REMOVER
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">HISTÓRICO DE VENDAS</h2>
                  <p className="section-subtitle">
                    Consulte as últimas vendas realizadas.
                  </p>
                </div>
              </div>

              <input
                value={buscaHistorico}
                onChange={(e) => setBuscaHistorico(e.target.value)}
                placeholder="NÚMERO, CLIENTE, PAGAMENTO OU STATUS..."
                className="campo mb-4"
              />

              <div className="overflow-auto">
                <table className="tabela min-w-[900px]">
                  <thead>
                    <tr>
                      <th>NÚMERO</th>
                      <th>DATA</th>
                      <th>CLIENTE</th>
                      <th>PAGAMENTO</th>
                      <th>STATUS</th>
                      <th>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="empty-state">
                          CARREGANDO...
                        </td>
                      </tr>
                    ) : historicoFiltrado.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty-state">
                          NENHUMA VENDA ENCONTRADA.
                        </td>
                      </tr>
                    ) : (
                      historicoFiltrado.map((v) => (
                        <tr key={v.id}>
                          <td className="font-bold">{v.numero || "-"}</td>
                          <td>{formatDateTimeBr(v.created_at)}</td>
                          <td>{v.cliente_nome || "-"}</td>
                          <td>{v.forma_pagamento || "-"}</td>
                          <td>{v.status || "-"}</td>
                          <td className="font-bold">{moneyBR(toMoney(v.total))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="card sticky-card">
              <h2 className="section-title mb-4">CONFIGURAÇÃO FISCAL</h2>

              <div className="resumo-box">
                <div className="resumo-linha">
                  <span>EMPRESA</span>
                  <strong>{empresaFiscal.nomeFantasia || "-"}</strong>
                </div>
                <div className="resumo-linha">
                  <span>CNPJ</span>
                  <strong>{empresaFiscal.cnpj || "-"}</strong>
                </div>
                <div className="resumo-linha">
                  <span>AMBIENTE</span>
                  <strong>{empresaFiscal.ambiente || "-"}</strong>
                </div>
                <div className="resumo-linha">
                  <span>SÉRIE</span>
                  <strong>{empresaFiscal.serieNfe || "-"}</strong>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="section-title mb-4">FINANCEIRO INTEGRADO</h2>

              <div className="finance-box">
                <div className="finance-line">
                  <span>SUBTOTAL</span>
                  <strong>{moneyBR(subtotal)}</strong>
                </div>

                <div className="mt-4">
                  <label className="label">DESCONTO</label>
                  <input
                    type="number"
                    step="0.01"
                    value={desconto}
                    onChange={(e) => setDesconto(e.target.value)}
                    className="campo text-right"
                  />
                </div>

                <div className="finance-line mt-4">
                  <span>FORMA</span>
                  <strong>{formaPagamento}</strong>
                </div>

                <div className="finance-line">
                  <span>CONTA</span>
                  <strong>
                    {contasFinanceiras.find((c) => c.id === contaFinanceiraId)?.nome || "-"}
                  </strong>
                </div>

                <div className="finance-line">
                  <span>TAXA</span>
                  <strong>{moneyBR(valorTaxaCalculado)}</strong>
                </div>

                <div className="finance-line">
                  <span>VALOR LÍQUIDO</span>
                  <strong>{moneyBR(valorLiquidoCalculado)}</strong>
                </div>

                <div className="finance-line">
                  <span>STATUS FINANCEIRO</span>
                  <strong>{statusFinanceiroAtual}</strong>
                </div>

                <div className="finance-line">
                  <span>ENTRADA HOJE</span>
                  <strong>{pagamentoImediato ? moneyBR(valorLiquidoCalculado) : moneyBR(0)}</strong>
                </div>

                <div className="finance-line">
                  <span>FICA A RECEBER</span>
                  <strong>{pagamentoImediato ? moneyBR(0) : moneyBR(valorLiquidoCalculado)}</strong>
                </div>

                <div className="finance-total">
                  <span>TOTAL FINAL</span>
                  <strong>{moneyBR(valorLiquidoCalculado)}</strong>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="section-title mb-3">OBSERVAÇÕES</h2>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="campo-textarea"
                placeholder="CONDIÇÕES, OBSERVAÇÕES, DETALHES DA VENDA..."
              />
            </div>
          </aside>
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

        .sticky-card {
          position: sticky;
          top: 20px;
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
        .campo-textarea:focus,
        .campo-tabela:focus {
          border-color: #0a6fd6;
          box-shadow: 0 0 0 4px rgba(10, 111, 214, 0.08);
        }

        .campo-textarea {
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          padding: 12px;
          font-size: 14px;
          width: 100%;
          min-height: 140px;
          background: white;
          color: #0f172a;
          outline: none;
          resize: vertical;
        }

        .campo-tabela {
          width: 100%;
          height: 38px;
          border: 1px solid #dbe4ee;
          border-radius: 10px;
          padding: 0 8px;
          font-size: 13px;
          color: #111827;
          background: white;
          outline: none;
        }

        .dropdown {
          position: absolute;
          z-index: 20;
          width: 100%;
          border-radius: 16px;
          border: 1px solid #dbe4ee;
          background: white;
          box-shadow: 0 18px 35px rgba(15, 23, 42, 0.12);
          max-height: 260px;
          overflow: auto;
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

        .helper-badge {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 800;
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

        .pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .pill-white {
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.28);
          color: white;
        }

        .pill-success {
          background: rgba(34, 197, 94, 0.18);
          border: 1px solid rgba(187, 247, 208, 0.5);
          color: white;
        }

        .pill-paid {
          background: rgba(34, 197, 94, 0.18);
          border: 1px solid rgba(187, 247, 208, 0.5);
          color: white;
        }

        .pill-open {
          background: rgba(245, 158, 11, 0.22);
          border: 1px solid rgba(253, 230, 138, 0.5);
          color: white;
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

        .resumo-box,
        .finance-box {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 18px;
          padding: 16px;
        }

        .resumo-linha,
        .finance-line {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
          font-size: 13px;
          color: #334155;
        }

        .resumo-linha:last-child,
        .finance-line:last-child {
          border-bottom: none;
        }

        .finance-total {
          margin-top: 16px;
          border-radius: 16px;
          background: linear-gradient(135deg, #0456a3 0%, #0a6fd6 100%);
          color: white;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 16px;
          font-weight: 900;
        }

        .info-label {
          display: block;
          font-size: 10px;
          font-weight: 800;
          color: #64748b;
          letter-spacing: 0.12em;
        }

        .info-value {
          margin-top: 4px;
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }

        @media (max-width: 1279px) {
          .sticky-card {
            position: static;
          }
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