"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";
import { canAccess } from "@/lib/authGuard";

type SessionUser = {
  id?: string;
  empresa_id: string;
  role?: string | null;
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
  estoque_minimo?: number | null;
  controla_estoque?: boolean | null;
  status?: string | null;
  tipo_produto?: string | null;
  unidade_medida?: string | null;
  controla_composicao?: boolean | null;
};

type ProdutoComposicao = {
  id?: string;
  produto_pai_id?: string;
  produto_item_id: string;
  quantidade: number;
  unidade_medida?: string | null;
  observacoes?: string | null;
};

type OrdemServico = {
  id: string;
  numero?: string | null;
  cliente_id?: string | null;
  cliente_nome?: string | null;
  cliente_telefone?: string | null;
  veiculo_descricao?: string | null;
  observacoes?: string | null;
  subtotal?: number | null;
  desconto?: number | null;
  total?: number | null;
  status?: string | null;
  faturado?: boolean | null;
  data_faturamento?: string | null;
  forma_pagamento?: string | null;
  created_at?: string | null;
};

type OrdemItem = {
  id: number;
  produtoId: string | null;
  nome: string;
  codigo?: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
  estoqueAtual?: number;
  controlaEstoque?: boolean;
  tipoProduto?: string;
  unidadeMedida?: string;
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
    toMoney(p.preco_instalacao) ||
    toMoney(p.preco_balcao) ||
    toMoney(p.preco_revenda) ||
    0
  );
}

function gerarNumeroInterno(data: OrdemServico[]) {
  if (!data?.length) return "OS-000001";

  let maior = 0;

  for (const item of data) {
    const m = String(item.numero || "").match(/\d+/);
    const n = m ? Number(m[0]) : 0;
    if (n > maior) maior = n;
  }

  return `OS-${String(maior + 1).padStart(6, "0")}`;
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

function normalizarTipoProduto(v?: string | null) {
  return up(v || "SIMPLES");
}

function normalizeText(v: unknown) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function tokenize(v: string) {
  return normalizeText(v)
    .split(/[\s\-_/.,;:()]+/)
    .filter(Boolean);
}

function uniqueTokens(tokens: string[]) {
  return [...new Set(tokens.filter(Boolean))];
}

function expandToken(token: string) {
  const t = normalizeText(token);

  const mapa: Record<string, string[]> = {
    VW: ["VOLKSWAGEN"],
    VOLKS: ["VOLKSWAGEN"],
    GM: ["CHEVROLET"],
    CHEV: ["CHEVROLET"],
    MERCEDES: ["MB", "MERCEDESBENZ"],
    BENZ: ["MERCEDES", "MERCEDESBENZ"],
    SAVEIRO: ["VOLKSWAGEN", "VW"],
    G5: ["GERACAO5", "GOLG5"],
    G6: ["GERACAO6", "GOLG6"],
    G7: ["GERACAO7", "GOLG7"],
  };

  return uniqueTokens([t, ...(mapa[t] || [])]);
}

function buildSearchGroups(query: string) {
  const base = tokenize(query);

  return base.map((token) => expandToken(token));
}

function matchSmart(haystack: string, query: string) {
  const h = normalizeText(haystack);
  const groups = buildSearchGroups(query);

  if (!groups.length) return true;

  // Cada palavra pesquisada precisa bater em pelo menos 1 alternativa do grupo
  return groups.every((group) => group.some((alt) => h.includes(alt)));
}

function scoreSearch(haystack: string, query: string) {
  const h = normalizeText(haystack);
  const original = normalizeText(query);
  const groups = buildSearchGroups(query);

  if (!groups.length) return 0;

  let score = 0;

  for (const group of groups) {
    if (group.some((alt) => h.includes(alt))) {
      score += 1;
    }
  }

  if (original && h.includes(original)) score += 4;

  const tokens = tokenize(query);
  for (const token of tokens) {
    if (h.startsWith(token)) score += 1;
  }

  return score;
}

export default function OrdensPage() {
  const router = useRouter();

  export default function OrdensPage()

  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceira[]>([]);
  const [taxasCartao, setTaxasCartao] = useState<TaxaCartao[]>([]);

  const [buscaHistorico, setBuscaHistorico] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [numeroOs, setNumeroOs] = useState("OS-000001");
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [clientesEncontrados, setClientesEncontrados] = useState<Cliente[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);

  const [veiculoDescricao, setVeiculoDescricao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState("ABERTA");
  const [faturado, setFaturado] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState("DINHEIRO");
  const [desconto, setDesconto] = useState("0");
  const [contaFinanceiraId, setContaFinanceiraId] = useState("");
  const [taxaCartaoId, setTaxaCartaoId] = useState("");

  const [produtoBusca, setProdutoBusca] = useState("");
  const [itens, setItens] = useState<OrdemItem[]>([]);

  const clienteBoxRef = useRef<HTMLDivElement | null>(null);
  const produtoBoxRef = useRef<HTMLDivElement | null>(null);
  const [openClientes, setOpenClientes] = useState(false);
  const [openProdutos, setOpenProdutos] = useState(false);

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

      if (!isMaster && !isAdmin && !canAccess("ORDENS")) {
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

  async function carregarBase(empId: string) {
    setLoading(true);

    const [ordensResp, produtosResp, contasResp, taxasResp] = await Promise.all([
      supabase
        .from("ordens_servico")
        .select("*")
        .eq("empresa_id", empId)
        .order("created_at", { ascending: false }),

      supabase
        .from("produtos")
        .select(
          "id,nome,codigo_sku,codigo_barras,categoria,subcategoria,preco_balcao,preco_instalacao,preco_revenda,estoque_atual,estoque_minimo,controla_estoque,status,tipo_produto,unidade_medida,controla_composicao"
        )
        .eq("empresa_id", empId)
        .order("nome"),

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

    if (ordensResp.error) {
      alert("ERRO AO CARREGAR ORDENS: " + ordensResp.error.message);
    }

    if (produtosResp.error) {
      alert("ERRO AO CARREGAR PRODUTOS: " + produtosResp.error.message);
    }

    if (contasResp.error) {
      alert("ERRO AO CARREGAR CONTAS: " + contasResp.error.message);
    }

    if (taxasResp.error) {
      alert("ERRO AO CARREGAR TAXAS: " + taxasResp.error.message);
    }

    const listaOrdens = (ordensResp.data || []) as OrdemServico[];
    const listaProdutos = (produtosResp.data || []) as Produto[];

    setOrdens(listaOrdens);
    setProdutos(listaProdutos);
    setContasFinanceiras((contasResp.data || []) as ContaFinanceira[]);
    setTaxasCartao((taxasResp.data || []) as TaxaCartao[]);
    setNumeroOs(gerarNumeroInterno(listaOrdens));
    setLoading(false);
  }

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
  const produtosEncontrados = useMemo(() => {
    const q = produtoBusca.trim();

    if (!q) return [];


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
          tipoProduto: produto.tipo_produto || "SIMPLES",
          unidadeMedida: produto.unidade_medida || "UN",
        },
      ]);

      setProdutoBusca("");
      setOpenProdutos(false);
    }

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

    function resetForm() {
      setEditingId(null);
      setNumeroOs(gerarNumeroInterno(ordens));
      setClienteBusca("");
      setClienteSelecionado(null);
      setClientesEncontrados([]);
      setVeiculoDescricao("");
      setObservacoes("");
      setStatus("ABERTA");
      setFaturado(false);
      setFormaPagamento("DINHEIRO");
      setDesconto("0");
      setContaFinanceiraId("");
      setTaxaCartaoId("");
      setProdutoBusca("");
      setItens([]);
      setOpenClientes(false);
      setOpenProdutos(false);
    }

    async function editarOrdem(ordem: OrdemServico) {
      setEditingId(ordem.id);
      setNumeroOs(ordem.numero || "");
      setClienteBusca(ordem.cliente_nome || "");
      setClienteSelecionado(
        ordem.cliente_nome
          ? {
            id: ordem.cliente_id || "",
            nome: ordem.cliente_nome || "",
            telefone: ordem.cliente_telefone || "",
          }
          : null
      );
      setVeiculoDescricao(ordem.veiculo_descricao || "");
      setObservacoes(ordem.observacoes || "");
      setStatus(ordem.status || "ABERTA");
      setFaturado(!!ordem.faturado);
      setFormaPagamento(ordem.forma_pagamento || "DINHEIRO");
      setDesconto(String(toMoney(ordem.desconto)));
      setContaFinanceiraId("");
      setTaxaCartaoId("");

      const { data, error } = await supabase
        .from("ordens_servico_itens")
        .select("*")
        .eq("ordem_servico_id", ordem.id);

      if (error) {
        alert("ERRO AO CARREGAR ITENS DA OS: " + error.message);
        return;
      }

      const itensMapeados: OrdemItem[] = (data || []).map((item: any, idx: number) => ({
        id: Date.now() + idx,
        produtoId: item.produto_id,
        nome: item.produto_nome || "",
        codigo: item.codigo || "",
        quantidade: Number(item.quantidade || 0),
        valorUnitario: Number(item.valor_unitario || 0),
        total: Number(item.total || 0),
        estoqueAtual: 0,
        controlaEstoque: true,
        tipoProduto: item.tipo_produto || "SIMPLES",
        unidadeMedida: item.unidade_medida || "UN",
      }));

      setItens(itensMapeados);
      setModalAberto(true);
    }

    async function removerOrdem(id: string) {
      if (!empresaId) return;
      if (!confirm("REMOVER ESTA ORDEM DE SERVIÇO?")) return;

      const { error } = await supabase
        .from("ordens_servico")
        .delete()
        .eq("empresa_id", empresaId)
        .eq("id", id);

      if (error) {
        alert("ERRO AO REMOVER OS: " + error.message);
        return;
      }

      alert("OS REMOVIDA!");
      await carregarBase(empresaId);
    }

    const subtotal = useMemo(() => {
      return itens.reduce((acc, item) => acc + toMoney(item.total), 0);
    }, [itens]);

    const totalGeral = useMemo(() => {
      return Math.max(0, subtotal - toMoney(desconto));
    }, [subtotal, desconto]);

    const historicoFiltrado = useMemo(() => {
      const q = normalizeText(buscaHistorico);
      if (!q) return ordens;

      return ordens.filter((o) =>
        normalizeText(
          `${o.numero || ""} ${o.cliente_nome || ""} ${o.veiculo_descricao || ""} ${o.status || ""}`
        ).includes(q)
      );
    }, [ordens, buscaHistorico]);

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

    async function buscarComposicaoProduto(produtoPaiId: string) {
      if (!empresaId) return [];

      const { data, error } = await supabase
        .from("produtos_composicao")
        .select("id,produto_pai_id,produto_item_id,quantidade,unidade_medida,observacoes")
        .eq("empresa_id", empresaId)
        .eq("produto_pai_id", produtoPaiId);

      if (error) {
        throw new Error("ERRO AO CARREGAR COMPOSIÇÃO DO PRODUTO.");
      }

      return (data || []) as ProdutoComposicao[];
    }

    async function validarEstoqueItem(item: OrdemItem) {
      if (!empresaId || !item.produtoId) return;

      const produto = produtos.find((p) => p.id === item.produtoId);

      if (!produto) {
        throw new Error(`PRODUTO NÃO ENCONTRADO: ${item.nome}`);
      }

      const tipo = normalizarTipoProduto(produto.tipo_produto);

      if (tipo !== "COMPOSTO") {
        if (produto.controla_estoque && toMoney(produto.estoque_atual) < toMoney(item.quantidade)) {
          throw new Error(`ESTOQUE INSUFICIENTE PARA ${produto.nome}.`);
        }
        return;
      }

      const composicao = await buscarComposicaoProduto(produto.id);

      if (composicao.length === 0) {
        throw new Error(`O PRODUTO COMPOSTO ${produto.nome} NÃO TEM COMPOSIÇÃO CADASTRADA.`);
      }

      const idsComponentes = composicao.map((c) => c.produto_item_id);

      const { data: componentes, error } = await supabase
        .from("produtos")
        .select("id,nome,estoque_atual,controla_estoque")
        .in("id", idsComponentes)
        .eq("empresa_id", empresaId);

      if (error) {
        throw new Error("ERRO AO VALIDAR COMPONENTES DO PRODUTO COMPOSTO.");
      }

      const mapa = new Map((componentes || []).map((p: any) => [p.id, p]));

      for (const comp of composicao) {
        const produtoComp: any = mapa.get(comp.produto_item_id);
        const qtdNecessaria = toMoney(comp.quantidade) * toMoney(item.quantidade);

        if (!produtoComp) {
          throw new Error(`COMPONENTE NÃO ENCONTRADO NA COMPOSIÇÃO DE ${produto.nome}.`);
        }

        if (!!produtoComp.controla_estoque && toMoney(produtoComp.estoque_atual) < qtdNecessaria) {
          throw new Error(
            `ESTOQUE INSUFICIENTE PARA O COMPONENTE ${produtoComp.nome} DO PRODUTO ${produto.nome}.`
          );
        }
      }
    }

    async function baixarEstoqueItem(item: OrdemItem, ordemId: string) {
      if (!empresaId || !item.produtoId) return;

      const produto = produtos.find((p) => p.id === item.produtoId);
      if (!produto) return;

      const tipo = normalizarTipoProduto(produto.tipo_produto);

      if (tipo !== "COMPOSTO") {
        if (!produto.controla_estoque) return;

        const novoEstoque = toMoney(produto.estoque_atual) - toMoney(item.quantidade);

        const { error: upError } = await supabase
          .from("produtos")
          .update({ estoque_atual: novoEstoque })
          .eq("empresa_id", empresaId)
          .eq("id", produto.id);

        if (upError) {
          throw new Error(`ERRO AO BAIXAR ESTOQUE DE ${produto.nome}.`);
        }

        await supabase.from("movimentacoes_estoque").insert([
          {
            empresa_id: empresaId,
            produto_id: produto.id,
            tipo: "SAIDA",
            quantidade: toMoney(item.quantidade),
            origem: "OS",
            origem_id: ordemId,
            observacoes: `OS ${numeroOs} - PRODUTO SIMPLES`,
          },
        ]);

        return;
      }

      const composicao = await buscarComposicaoProduto(produto.id);

      const idsComponentes = composicao.map((c) => c.produto_item_id);

      const { data: componentes, error } = await supabase
        .from("produtos")
        .select("id,nome,estoque_atual,controla_estoque")
        .in("id", idsComponentes)
        .eq("empresa_id", empresaId);

      if (error) {
        throw new Error(`ERRO AO CARREGAR COMPONENTES DE ${produto.nome}.`);
      }

      const mapa = new Map((componentes || []).map((p: any) => [p.id, p]));

      for (const comp of composicao) {
        const produtoComp: any = mapa.get(comp.produto_item_id);
        if (!produtoComp) continue;

        const qtdBaixa = toMoney(comp.quantidade) * toMoney(item.quantidade);

        if (!!produtoComp.controla_estoque) {
          const novoEstoque = toMoney(produtoComp.estoque_atual) - qtdBaixa;

          const { error: upError } = await supabase
            .from("produtos")
            .update({ estoque_atual: novoEstoque })
            .eq("empresa_id", empresaId)
            .eq("id", produtoComp.id);

          if (upError) {
            throw new Error(`ERRO AO BAIXAR COMPONENTE ${produtoComp.nome}.`);
          }
        }

        await supabase.from("movimentacoes_estoque").insert([
          {
            empresa_id: empresaId,
            produto_id: produtoComp.id,
            tipo: "SAIDA",
            quantidade: qtdBaixa,
            origem: "OS",
            origem_id: ordemId,
            observacoes: `OS ${numeroOs} - BAIXA AUTOMÁTICA POR PRODUTO COMPOSTO: ${produto.nome}`,
          },
        ]);
      }
    }

    async function salvarOS() {
      if (!empresaId) return;

      if (!veiculoDescricao.trim()) {
        alert("PREENCHA A DESCRIÇÃO DO VEÍCULO.");
        return;
      }

      if (itens.length === 0) {
        alert("ADICIONE PELO MENOS 1 ITEM.");
        return;
      }

      if (faturado && !contaFinanceiraId) {
        alert("SELECIONE A CONTA FINANCEIRA PARA FATURAR.");
        return;
      }

      if (faturado && isCartao(formaPagamento) && !taxaCartaoId) {
        alert("SELECIONE A TAXA DE CARTÃO.");
        return;
      }

      if (faturado && isCartao(formaPagamento) && !taxaCompativelComForma) {
        alert("A TAXA SELECIONADA NÃO É COMPATÍVEL COM A FORMA DE PAGAMENTO.");
        return;
      }

      if (faturado) {
        try {
          for (const item of itens) {
            await validarEstoqueItem(item);
          }
        } catch (e: any) {
          alert(e?.message || "ERRO AO VALIDAR ESTOQUE.");
          return;
        }
      }

      const payload = {
        empresa_id: empresaId,
        numero: numeroOs,
        cliente_id: clienteSelecionado?.id || null,
        cliente_nome: clienteSelecionado?.nome || null,
        cliente_telefone: clienteSelecionado?.telefone || null,
        veiculo_descricao: up(veiculoDescricao),
        observacoes: up(observacoes),
        subtotal,
        desconto: toMoney(desconto),
        total: totalGeral,
        status: up(status),
        faturado,
        data_faturamento: faturado ? agoraLocalISO() : null,
        forma_pagamento: faturado ? up(formaPagamento) : null,
      };

      let ordemId = editingId;

      if (editingId) {
        const { error } = await supabase
          .from("ordens_servico")
          .update(payload)
          .eq("empresa_id", empresaId)
          .eq("id", editingId);

        if (error) {
          alert("ERRO AO ATUALIZAR OS: " + error.message);
          return;
        }

        const { error: delError } = await supabase
          .from("ordens_servico_itens")
          .delete()
          .eq("ordem_servico_id", editingId);

        if (delError) {
          alert("OS SALVA, MAS DEU ERRO AO LIMPAR ITENS: " + delError.message);
          return;
        }
      } else {
        const { data, error } = await supabase
          .from("ordens_servico")
          .insert([payload])
          .select("id")
          .single();

        if (error || !data) {
          alert("ERRO AO CRIAR OS: " + (error?.message || ""));
          return;
        }

        ordemId = data.id;
      }

      const itensPayload = itens.map((item) => ({
        ordem_servico_id: ordemId,
        produto_id: item.produtoId,
        produto_nome: up(item.nome),
        codigo: up(item.codigo || ""),
        quantidade: toMoney(item.quantidade),
        valor_unitario: toMoney(item.valorUnitario),
        total: toMoney(item.total),
        tipo_produto: up(item.tipoProduto || "SIMPLES"),
        unidade_medida: up(item.unidadeMedida || "UN"),
      }));

      const { error: itensError } = await supabase
        .from("ordens_servico_itens")
        .insert(itensPayload);

      if (itensError) {
        alert("OS SALVA, MAS DEU ERRO AO SALVAR ITENS: " + itensError.message);
        return;
      }

      if (faturado && ordemId) {
        try {
          for (const item of itens) {
            await baixarEstoqueItem(item, ordemId);
          }
        } catch (e: any) {
          alert(e?.message || "OS SALVA, MAS DEU ERRO AO BAIXAR ESTOQUE.");
          return;
        }

        const financeiroPayload = {
          empresa_id: empresaId,
          tipo: "RECEBER",
          descricao: up(`OS ${numeroOs}`),
          cliente_id: clienteSelecionado?.id || null,
          cliente_nome: clienteSelecionado?.nome || up("CLIENTE NÃO INFORMADO"),
          documento: up(numeroOs),
          categoria: "ORDEM DE SERVICO",
          valor_original: totalGeral,
          valor_pago: isPagamentoImediato(formaPagamento) ? valorLiquidoCalculado : 0,
          desconto: 0,
          juros: 0,
          multa: 0,
          data_emissao: hojeLocalISO(),
          data_vencimento: hojeLocalISO(),
          data_pagamento: isPagamentoImediato(formaPagamento) ? hojeLocalISO() : null,
          forma_pagamento: up(formaPagamento),
          status: isPagamentoImediato(formaPagamento) ? "PAGO" : "ABERTO",
          observacoes: up(observacoes || `TÍTULO GERADO PELA OS ${numeroOs}`),
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
          alert("OS SALVA, MAS DEU ERRO NO FINANCEIRO: " + financeiroError.message);
          return;
        }

        if (isPagamentoImediato(formaPagamento) && contaFinanceiraId) {
          const conta = contasFinanceiras.find((c) => c.id === contaFinanceiraId);

          if (conta) {
            const novoSaldo = toMoney(conta.saldo_atual) + valorLiquidoCalculado;

            const { error: contaError } = await supabase
              .from("contas_financeiras")
              .update({ saldo_atual: novoSaldo })
              .eq("id", contaFinanceiraId)
              .eq("empresa_id", empresaId);

            if (contaError) {
              alert("OS SALVA, MAS DEU ERRO AO ATUALIZAR A CONTA FINANCEIRA.");
              return;
            }
          }
        }
      }

      alert(faturado ? "OS FATURADA COM SUCESSO!" : "OS SALVA COM SUCESSO!");
      setModalAberto(false);
      resetForm();
      await carregarBase(empresaId);
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
                  ORDEM DE SERVIÇO
                </h1>
                <p className="mt-3 text-sm text-white/85">
                  CLIENTE OPCIONAL, BUSCA INTELIGENTE DE PRODUTOS E FATURAMENTO INTEGRADO
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
                <KpiMini titulo="OS" valor={String(ordens.length)} />
                <KpiMini
                  titulo="ABERTAS"
                  valor={String(ordens.filter((o) => up(o.status) === "ABERTA").length)}
                />
                <KpiMini
                  titulo="FATURADAS"
                  valor={String(ordens.filter((o) => !!o.faturado).length)}
                />
                <KpiMini
                  titulo="TOTAL"
                  valor={moneyBR(
                    ordens.reduce((acc, o) => acc + toMoney(o.total), 0)
                  )}
                  destaque
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3 flex-wrap">
              <button
                onClick={() => {
                  resetForm();
                  setModalAberto(true);
                }}
                className="botao-header-primary"
                type="button"
              >
                NOVA OS
              </button>

              <input
                placeholder="BUSCAR OS..."
                value={buscaHistorico}
                onChange={(e) => setBuscaHistorico(e.target.value)}
                className="h-[48px] w-[320px] xl:w-[420px] max-w-full rounded-2xl border border-white/20 bg-white/10 px-5 text-[16px] text-white outline-none placeholder:text-white/70"
              />
            </div>
          </div>

          <section className="card">
            <div className="section-header">
              <div>
                <h2 className="section-title">ORDENS CADASTRADAS</h2>
                <p className="section-subtitle">
                  Cliente pode ficar em branco. O veículo e os itens continuam sendo obrigatórios.
                </p>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="tabela min-w-[1200px]">
                <thead>
                  <tr>
                    <th>NÚMERO</th>
                    <th>CLIENTE</th>
                    <th>VEÍCULO</th>
                    <th>STATUS</th>
                    <th>FATURADO</th>
                    <th>FORMA</th>
                    <th>TOTAL</th>
                    <th>CRIADA EM</th>
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
                  ) : historicoFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="empty-state">
                        NENHUMA OS ENCONTRADA.
                      </td>
                    </tr>
                  ) : (
                    historicoFiltrado.map((o) => (
                      <tr key={o.id}>
                        <td className="font-bold">{o.numero || "-"}</td>
                        <td>{o.cliente_nome || "SEM CLIENTE"}</td>
                        <td>{o.veiculo_descricao || "-"}</td>
                        <td>{o.status || "-"}</td>
                        <td>{o.faturado ? "SIM" : "NÃO"}</td>
                        <td>{o.forma_pagamento || "-"}</td>
                        <td className="font-bold">{moneyBR(toMoney(o.total))}</td>
                        <td>{formatDateTimeBr(o.created_at)}</td>
                        <td>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => editarOrdem(o)}
                              className="botao-mini"
                              type="button"
                            >
                              EDITAR
                            </button>

                            <button
                              onClick={() => removerOrdem(o.id)}
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

          {modalAberto && (
            <div className="modal-overlay" onClick={() => setModalAberto(false)}>
              <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div>
                    <div className="modal-kicker">AUTO GESTÃO PRO</div>
                    <h2 className="modal-title">
                      {editingId ? "EDITAR ORDEM DE SERVIÇO" : "NOVA ORDEM DE SERVIÇO"}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModalAberto(false)}
                    className="close-btn"
                  >
                    ✕
                  </button>
                </div>

                <div className="modal-scroll">
                  <div className="card-interno">
                    <h3 className="section-title mb-4">DADOS DA OS</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="label">NÚMERO</label>
                        <input className="campo" value={numeroOs} readOnly />
                      </div>

                      <div>
                        <label className="label">STATUS</label>
                        <select className="campo" value={status} onChange={(e) => setStatus(e.target.value)}>
                          <option value="ABERTA">ABERTA</option>
                          <option value="EM ANDAMENTO">EM ANDAMENTO</option>
                          <option value="FINALIZADA">FINALIZADA</option>
                          <option value="ENTREGUE">ENTREGUE</option>
                        </select>
                      </div>

                      <div className="flex items-end">
                        <label className="checkbox-box">
                          <input
                            type="checkbox"
                            checked={faturado}
                            onChange={(e) => setFaturado(e.target.checked)}
                          />
                          <span>FATURAR AGORA</span>
                        </label>
                      </div>

                      <div className="md:col-span-2 relative" ref={clienteBoxRef}>
                        <label className="label">CLIENTE (OPCIONAL)</label>
                        <input
                          className="campo"
                          placeholder="PODE DEIXAR EM BRANCO"
                          value={clienteBusca}
                          onChange={async (e) => {
                            const valor = e.target.value;
                            setClienteBusca(valor);

                            if (!valor.trim()) {
                              setClienteSelecionado(null);
                              setClientesEncontrados([]);
                              setOpenClientes(false);
                              return;
                            }

                            setOpenClientes(true);
                            await buscarClientes(valor);
                          }}
                          onFocus={async () => {
                            if (clienteBusca.trim().length >= 2) {
                              setOpenClientes(true);
                              await buscarClientes(clienteBusca);
                            }
                          }}
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
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="label">VEÍCULO / DESCRIÇÃO</label>
                        <input
                          className="campo"
                          value={veiculoDescricao}
                          onChange={(e) => setVeiculoDescricao(e.target.value)}
                          placeholder="EX.: GOL G5 PRATA PLACA XXX-0000"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="label">OBSERVAÇÕES</label>
                        <textarea
                          className="campo-textarea"
                          value={observacoes}
                          onChange={(e) => setObservacoes(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="card-interno mt-5" ref={produtoBoxRef}>
                    <h3 className="section-title mb-4">PRODUTOS DA OS</h3>

                    <div className="relative">
                      <label className="label">BUSCAR PRODUTO</label>
                      <input
                        className="campo"
                        placeholder="EX.: FECHADURA G5 ou G5 FECHADURA"
                        value={produtoBusca}
                        onChange={(e) => {
                          setProdutoBusca(e.target.value);
                          setOpenProdutos(!!e.target.value.trim());
                        }}
                        onFocus={() => {
                          if (produtoBusca.trim()) setOpenProdutos(true);
                        }}
                      />

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
                                    {toMoney(p.estoque_atual)} • {up(p.tipo_produto || "SIMPLES")}
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

                      {openProdutos && produtoBusca.trim() && produtosEncontrados.length === 0 && (
                        <div className="dropdown top-full mt-2">
                          <div className="dropdown-item text-[#B91C1C]">
                            NENHUM PRODUTO ENCONTRADO.
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 overflow-auto">
                      <table className="tabela min-w-[1300px]">
                        <thead>
                          <tr>
                            <th>PRODUTO</th>
                            <th>CÓDIGO</th>
                            <th>TIPO</th>
                            <th>UNIDADE</th>
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
                              <td className="empty-state" colSpan={9}>
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

                                <td className="font-semibold">{item.tipoProduto || "SIMPLES"}</td>
                                <td>{item.unidadeMedida || "UN"}</td>
                                <td className="font-semibold">
                                  {item.controlaEstoque ? toMoney(item.estoqueAtual) : "-"}
                                </td>

                                <td>
                                  <input
                                    type="number"
                                    min="1"
                                    step="0.0001"
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

                  {faturado && (
                    <div className="card-interno mt-5">
                      <h3 className="section-title mb-4">FATURAMENTO</h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          <label className="label">CONTA FINANCEIRA</label>
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

                        <div>
                          <label className="label">DESCONTO</label>
                          <input
                            type="number"
                            step="0.01"
                            value={desconto}
                            onChange={(e) => setDesconto(e.target.value)}
                            className="campo"
                          />
                        </div>
                      </div>

                      <div className="finance-box mt-4">
                        <div className="finance-line">
                          <span>SUBTOTAL</span>
                          <strong>{moneyBR(subtotal)}</strong>
                        </div>
                        <div className="finance-line">
                          <span>DESCONTO</span>
                          <strong>{moneyBR(toMoney(desconto))}</strong>
                        </div>
                        <div className="finance-line">
                          <span>TAXA</span>
                          <strong>{moneyBR(valorTaxaCalculado)}</strong>
                        </div>
                        <div className="finance-total">
                          <span>LÍQUIDO</span>
                          <strong>{moneyBR(valorLiquidoCalculado)}</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button onClick={salvarOS} className="botao-azul" type="button">
                    {editingId ? "SALVAR ALTERAÇÕES" : faturado ? "SALVAR E FATURAR" : "SALVAR OS"}
                  </button>

                  <button
                    onClick={() => {
                      setModalAberto(false);
                      resetForm();
                    }}
                    className="botao"
                    type="button"
                  >
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
          padding: 20px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
          border: 1px solid #eef2f7;
        }

        .card-interno {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 22px;
          padding: 18px;
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
          background: white;
          color: #0f172a;
          outline: none;
        }

        .campo:focus,
        .campo-textarea:focus,
        .campo-tabela:focus {
          border-color: #0a6fd6;
          box-shadow: 0 0 0 4px rgba(10, 111, 214, 0.08);
        }

        .campo-textarea {
          min-height: 100px;
          width: 100%;
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          padding: 12px;
          font-size: 14px;
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

        .checkbox-box {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 800;
          color: #334155;
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          padding: 12px 14px;
          height: 46px;
          background: white;
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

        .botao-header-primary {
          border: none;
          background: white;
          color: #0456a3;
          font-weight: 900;
          border-radius: 14px;
          padding: 11px 18px;
          font-size: 13px;
        }

        .botao-azul {
          border: none;
          background: #0456a3;
          color: white;
          font-weight: 900;
          border-radius: 14px;
          padding: 11px 18px;
          font-size: 13px;
        }

        .botao {
          border: 1px solid #cbd5e1;
          background: white;
          color: #1e293b;
          font-weight: 800;
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

        .finance-box {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 18px;
          padding: 16px;
        }

        .finance-line {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
          font-size: 13px;
          color: #334155;
        }

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

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 18px;
        }

        .modal-box {
          width: min(1250px, 100%);
          max-height: 92vh;
          overflow: hidden;
          border-radius: 28px;
          background: #f8fafc;
          box-shadow: 0 30px 90px rgba(15, 23, 42, 0.32);
          border: 1px solid #dbe4ee;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          padding: 18px 20px;
          background: linear-gradient(135deg, #0456a3 0%, #0a6fd6 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
        }

        .modal-kicker {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.16em;
          opacity: 0.82;
        }

        .modal-title {
          margin-top: 4px;
          font-size: 28px;
          font-weight: 900;
          line-height: 1;
        }

        .close-btn {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.24);
          background: rgba(255,255,255,0.1);
          color: white;
          font-size: 16px;
          font-weight: 900;
        }

        .modal-scroll {
          padding: 18px;
          overflow: auto;
          flex: 1;
        }

        .modal-footer {
          padding: 16px 18px 18px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          border-top: 1px solid #e5e7eb;
          background: white;
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
          className={`rounded-[18px] px-4 py-3 ${destaque ? "bg-white text-[#0456A3]" : "bg-white/12 text-white border border-white/15"
            }`}
        >
          <div className="text-[10px] font-bold tracking-[0.12em] opacity-80">{titulo}</div>
          <div className="mt-1 text-[18px] font-black leading-none">{valor}</div>
        </div>
      );
    }