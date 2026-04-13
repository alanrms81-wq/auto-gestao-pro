"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type SessionUser = {
  id?: string;
  empresa_id: string;
  role?: string | null;
};

type Cliente = {
  id: string;
  codigo_cliente?: string | null;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  cpf_cnpj?: string | null;
  cidade?: string | null;
  estado?: string | null;
  status?: string | null;
};

type Veiculo = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  cliente_nome?: string | null;
  placa?: string | null;
  marca?: string | null;
  modelo?: string | null;
  ano?: string | null;
  cor?: string | null;
  combustivel?: string | null;
  km_atual?: string | null;
  chassi?: string | null;
  observacoes?: string | null;
  created_at?: string | null;
};

type Produto = {
  id: string;
  empresa_id?: string;
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

type OrdemServico = {
  id: string;
  numero?: string | null;
  cliente_id?: string | null;
  cliente_nome?: string | null;
  cliente_telefone?: string | null;
  veiculo_id?: string | null;
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

type OrdemServicoLinha = {
  id: number;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
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

function toMoney(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function moneyBR(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function formatDateTimeBr(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function normalizeText(v: unknown) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function isPagamentoImediato(formaPagamento: string) {
  const f = normalizeText(formaPagamento);
  return ["DINHEIRO", "PIX", "DEBITO", "CREDITO", "TRANSFERENCIA"].some((opt) => f.includes(opt));
}

function isCartao(formaPagamento: string) {
  const f = normalizeText(formaPagamento);
  return f.includes("CARTAO");
}

function scoreProduto(p: Produto, query: string) {
  const q = normalizeText(query);
  if (!q) return 0;

  const nome = normalizeText(p.nome);
  const sku = normalizeText(p.codigo_sku);
  const codBarras = normalizeText(p.codigo_barras);

  let score = 0;
  if (nome === q) score += 100;
  if (sku === q) score += 120;
  if (codBarras === q) score += 120;
  if (nome.includes(q)) score += 40;
  if (sku.includes(q)) score += 60;
  if (codBarras.includes(q)) score += 60;
  return score;
}

function gerarNumeroOS() {
  const d = new Date();
  return `OS-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${d.getHours()}${d.getMinutes()}${d.getSeconds()}`;
}

export default function OrdensPage() {
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

  const [numeroOs, setNumeroOs] = useState("");
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [clientesEncontrados, setClientesEncontrados] = useState<Cliente[]>([]);
  const [openClientes, setOpenClientes] = useState(false);
  const clienteBoxRef = useRef<HTMLDivElement>(null);

  const [veiculosCliente, setVeiculosCliente] = useState<Veiculo[]>([]);
  const [veiculoSelecionadoId, setVeiculoSelecionadoId] = useState("");
  const [veiculoDescricao, setVeiculoDescricao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState("ABERTA");
  const [faturado, setFaturado] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState("DINHEIRO");
  const [desconto, setDesconto] = useState("0");
  const [contaFinanceiraId, setContaFinanceiraId] = useState("");
  const [taxaCartaoId, setTaxaCartaoId] = useState("");
  const [produtoBusca, setProdutoBusca] = useState("");
  const [openProdutos, setOpenProdutos] = useState(false);
  const produtoBoxRef = useRef<HTMLDivElement>(null);

  const [itens, setItens] = useState<OrdemItem[]>([]);
  const [servicos, setServicos] = useState<OrdemServicoLinha[]>([]);

  useEffect(() => {
    async function init() {
      const user = (await getSessionUser()) as SessionUser | null;
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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (clienteBoxRef.current && !clienteBoxRef.current.contains(e.target as Node)) {
        setOpenClientes(false);
      }
      if (produtoBoxRef.current && !produtoBoxRef.current.contains(e.target as Node)) {
        setOpenProdutos(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function carregarBase(empId: string) {
    setLoading(true);
    try {
      const [ordensR, prodR, contasR, taxasR] = await Promise.all([
        supabase.from("ordens_servico").select("*").eq("empresa_id", empId).order("created_at", { ascending: false }),
        supabase.from("produtos").select("*").eq("empresa_id", empId),
        supabase.from("contas_financeiras").select("*").eq("empresa_id", empId).eq("status", "ATIVO"),
        supabase.from("taxas_cartao").select("*").eq("empresa_id", empId).eq("status", "ATIVO"),
      ]);

      setOrdens(ordensR.data || []);
      setProdutos(prodR.data || []);
      setContasFinanceiras(contasR.data || []);
      setTaxasCartao(taxasR.data || []);
    } finally {
      setLoading(false);
    }
  }

  function limparFormulario() {
    setEditingId(null);
    setNumeroOs(gerarNumeroOS());
    setClienteBusca("");
    setClienteSelecionado(null);
    setClientesEncontrados([]);
    setOpenClientes(false);
    setVeiculosCliente([]);
    setVeiculoSelecionadoId("");
    setVeiculoDescricao("");
    setObservacoes("");
    setStatus("ABERTA");
    setFaturado(false);
    setFormaPagamento("DINHEIRO");
    setDesconto("0");
    setContaFinanceiraId("");
    setTaxaCartaoId("");
    setProdutoBusca("");
    setOpenProdutos(false);
    setItens([]);
    setServicos([]);
  }

  async function buscarClientes(texto: string) {
    if (!texto.trim() || !empresaId) {
      setClientesEncontrados([]);
      return;
    }

    const { data } = await supabase
      .from("clientes")
      .select("*")
      .eq("empresa_id", empresaId)
      .ilike("nome", `%${texto}%`)
      .limit(10);

    setClientesEncontrados(data || []);
  }

  async function selecionarCliente(c: Cliente) {
    setClienteSelecionado(c);
    setClienteBusca(c.nome);
    setOpenClientes(false);

    const { data } = await supabase.from("veiculos").select("*").eq("cliente_id", c.id);
    setVeiculosCliente(data || []);
  }

  function selecionarVeiculo(id: string) {
    setVeiculoSelecionadoId(id);

    const v = veiculosCliente.find((x) => x.id === id);
    if (!v) {
      setVeiculoDescricao("");
      return;
    }

    const desc = [v.placa, v.marca, v.modelo, v.ano].filter(Boolean).join(" • ");
    setVeiculoDescricao(desc);
  }

  function adicionarProduto(p: Produto) {
    const valor = toMoney(p.preco_instalacao ?? p.preco_balcao);

    setItens((prev) => [
      ...prev,
      {
        id: Date.now() + Math.floor(Math.random() * 9999),
        produtoId: p.id,
        nome: p.nome,
        codigo: p.codigo_sku || undefined,
        quantidade: 1,
        valorUnitario: valor,
        total: valor,
        estoqueAtual: toMoney(p.estoque_atual),
        controlaEstoque: !!p.controla_estoque,
        tipoProduto: p.tipo_produto || undefined,
        unidadeMedida: p.unidade_medida || undefined,
      },
    ]);

    setOpenProdutos(false);
    setProdutoBusca("");
  }

  function removerItem(id: number) {
    setItens((prev) => prev.filter((x) => x.id !== id));
  }

  function removerServico(id: number) {
    setServicos((prev) => prev.filter((x) => x.id !== id));
  }

  function atualizarItem(index: number, campo: keyof OrdemItem, valor: unknown) {
    setItens((prev) => {
      const clone = [...prev];
      const atual = { ...clone[index] };

      if (campo === "quantidade" || campo === "valorUnitario") {
        (atual as any)[campo] = toMoney(valor);
        atual.total = toMoney(atual.quantidade) * toMoney(atual.valorUnitario);
      } else {
        (atual as any)[campo] = valor;
      }

      clone[index] = atual;
      return clone;
    });
  }

  function atualizarServico(index: number, campo: keyof OrdemServicoLinha, valor: unknown) {
    setServicos((prev) => {
      const clone = [...prev];
      const atual = { ...clone[index] };

      if (campo === "quantidade" || campo === "valorUnitario") {
        (atual as any)[campo] = toMoney(valor);
        atual.total = toMoney(atual.quantidade) * toMoney(atual.valorUnitario);
      } else {
        (atual as any)[campo] = valor;
      }

      clone[index] = atual;
      return clone;
    });
  }

  async function validarEstoqueItem(item: OrdemItem) {
    if (!empresaId) {
      throw new Error("EMPRESA NÃO IDENTIFICADA.");
    }

    if (!item.produtoId) {
      throw new Error(`ITEM SEM produto_id: ${item.nome}`);
    }

    const { data: p, error } = await supabase
      .from("produtos")
      .select("id, empresa_id, nome, estoque_atual, controla_estoque")
      .eq("id", item.produtoId)
      .eq("empresa_id", empresaId)
      .single();

    if (error || !p) {
      console.error("PRODUTO NÃO ENCONTRADO NO BANCO", { item, empresaId, error });
      throw new Error(`PRODUTO NÃO ENCONTRADO: ${item.nome}`);
    }

    if (p.controla_estoque && toMoney(p.estoque_atual) < item.quantidade) {
      throw new Error(`ESTOQUE INSUFICIENTE: ${p.nome}`);
    }
  }

  async function salvarOS() {
    if (!empresaId) {
      alert("Empresa não identificada.");
      return;
    }

    if (!clienteSelecionado) {
      alert("Selecione um cliente.");
      return;
    }

    if (itens.length === 0 && servicos.length === 0) {
      alert("Adicione ao menos uma peça ou serviço.");
      return;
    }

    setLoading(true);

    try {
      if (faturado) {
        for (const it of itens) {
          await validarEstoqueItem(it);
        }
      }

      const dados: any = {
        empresa_id: empresaId,
        numero: numeroOs || gerarNumeroOS(),
        cliente_id: clienteSelecionado.id,
        cliente_nome: clienteSelecionado.nome,
        cliente_telefone: clienteSelecionado.telefone || null,
        veiculo_id: veiculoSelecionadoId || null,
        veiculo_descricao: veiculoDescricao || null,
        observacoes: observacoes || null,
        subtotal,
        desconto: toMoney(desconto),
        total: totalGeral,
        status: faturado ? "FINALIZADA" : status,
        faturado,
        forma_pagamento: faturado ? formaPagamento : null,
        data_faturamento: faturado ? agoraLocalISO() : null,
      };

      let osId = editingId;

      if (editingId) {
        const { error } = await supabase.from("ordens_servico").update(dados).eq("id", editingId).eq("empresa_id", empresaId);
        if (error) throw error;

        await supabase.from("ordens_servico_itens").delete().eq("ordem_servico_id", editingId);
        await supabase.from("ordens_servico_servicos").delete().eq("ordem_servico_id", editingId);
      } else {
        const { data, error } = await supabase.from("ordens_servico").insert(dados).select().single();
        if (error) throw error;
        osId = data.id;
      }

      for (const it of itens) {
        if (!it.produtoId) {
          throw new Error(`Não é possível salvar item sem produto_id: ${it.nome}`);
        }

        const { error: itemErr } = await supabase.from("ordens_servico_itens").insert({
          ordem_servico_id: osId,
          produto_id: it.produtoId,
          produto_nome: it.nome,
          quantidade: it.quantidade,
          valor_unitario: it.valorUnitario,
          total: it.total,
        });

        if (itemErr) throw itemErr;

        if (faturado && it.controlaEstoque) {
          const { data: pAtual, error } = await supabase
            .from("produtos")
            .select("id, empresa_id, nome, estoque_atual")
            .eq("id", it.produtoId)
            .eq("empresa_id", empresaId)
            .single();

          if (error || !pAtual) {
            throw new Error(`PRODUTO NÃO ENCONTRADO AO BAIXAR ESTOQUE: ${it.nome}`);
          }

          const novoEstoque = toMoney(pAtual.estoque_atual) - it.quantidade;

          const { error: updErr } = await supabase
            .from("produtos")
            .update({ estoque_atual: novoEstoque })
            .eq("id", it.produtoId)
            .eq("empresa_id", empresaId);

          if (updErr) throw updErr;
        }
      }

      for (const s of servicos) {
        const { error } = await supabase.from("ordens_servico_servicos").insert({
          ordem_servico_id: osId,
          descricao: s.descricao,
          quantidade: s.quantidade,
          valor_unitario: s.valorUnitario,
          total: s.total,
        });

        if (error) throw error;
      }

      if (faturado && isPagamentoImediato(formaPagamento) && contaFinanceiraId) {
        let valorFin = totalGeral;

        if (isCartao(formaPagamento) && taxaCartaoId) {
          const t = taxasCartao.find((x) => x.id === taxaCartaoId);
          if (t) {
            valorFin = totalGeral - totalGeral * (toMoney(t.taxa_percentual) / 100);
          }
        }

        const { data: contaAtual, error: contaErr } = await supabase
          .from("contas_financeiras")
          .select("saldo_atual")
          .eq("id", contaFinanceiraId)
          .eq("empresa_id", empresaId)
          .single();

        if (contaErr) throw contaErr;

        const { error: updContaErr } = await supabase
          .from("contas_financeiras")
          .update({ saldo_atual: toMoney(contaAtual?.saldo_atual) + valorFin })
          .eq("id", contaFinanceiraId)
          .eq("empresa_id", empresaId);

        if (updContaErr) throw updContaErr;

        const { error: fluxoErr } = await supabase.from("fluxo_caixa").insert({
          empresa_id: empresaId,
          conta_id: contaFinanceiraId,
          tipo: "ENTRADA",
          valor: valorFin,
          descricao: `OS ${numeroOs || dados.numero}`,
          data_movimentacao: hojeLocalISO(),
        });

        if (fluxoErr) throw fluxoErr;
      }

      setModalAberto(false);
      await carregarBase(empresaId);
      alert("Sucesso!");
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Erro ao salvar a ordem de serviço.");
    } finally {
      setLoading(false);
    }
  }

  async function editarOrdem(o: OrdemServico) {
    if (!empresaId) return;

    setLoading(true);

    try {
      setEditingId(o.id);
      setNumeroOs(o.numero || "");
      setClienteSelecionado(
        o.cliente_id
          ? ({
              id: o.cliente_id,
              nome: o.cliente_nome || "",
              telefone: o.cliente_telefone || null,
            } as Cliente)
          : null
      );
      setClienteBusca(o.cliente_nome || "");
      setVeiculoSelecionadoId(o.veiculo_id || "");
      setVeiculoDescricao(o.veiculo_descricao || "");
      setObservacoes(o.observacoes || "");
      setStatus(o.status || "ABERTA");
      setFaturado(!!o.faturado);
      setFormaPagamento(o.forma_pagamento || "DINHEIRO");
      setDesconto(String(o.desconto || 0));
      setContaFinanceiraId("");
      setTaxaCartaoId("");

      if (o.cliente_id) {
        const { data: vData } = await supabase.from("veiculos").select("*").eq("cliente_id", o.cliente_id);
        setVeiculosCliente(vData || []);
      } else {
        setVeiculosCliente([]);
      }

      const [itR, svR] = await Promise.all([
        supabase.from("ordens_servico_itens").select("*").eq("ordem_servico_id", o.id),
        supabase.from("ordens_servico_servicos").select("*").eq("ordem_servico_id", o.id),
      ]);

      const itensReconstruidos: OrdemItem[] = (itR.data || []).map((x: any) => {
        let produto = produtos.find((p) => String(p.id).trim() === String(x.produto_id ?? "").trim());

        if (!produto && x.produto_nome) {
          produto = produtos.find((p) => normalizeText(p.nome) === normalizeText(x.produto_nome));
        }

        return {
          id: Date.now() + Math.floor(Math.random() * 99999),
          produtoId: produto?.id ?? x.produto_id ?? null,
          nome: x.produto_nome || produto?.nome || "PRODUTO",
          quantidade: toMoney(x.quantidade),
          valorUnitario: toMoney(x.valor_unitario),
          total: toMoney(x.total),
          controlaEstoque: !!produto?.controla_estoque,
          estoqueAtual: toMoney(produto?.estoque_atual),
          tipoProduto: produto?.tipo_produto || undefined,
          unidadeMedida: produto?.unidade_medida || undefined,
          codigo: produto?.codigo_sku || undefined,
        };
      });

      const servicosReconstruidos: OrdemServicoLinha[] = (svR.data || []).map((x: any) => ({
        id: Date.now() + Math.floor(Math.random() * 99999),
        descricao: x.descricao || "",
        quantidade: toMoney(x.quantidade),
        valorUnitario: toMoney(x.valor_unitario),
        total: toMoney(x.total),
      }));

      setItens(itensReconstruidos);
      setServicos(servicosReconstruidos);
      setModalAberto(true);
    } finally {
      setLoading(false);
    }
  }


  function imprimirCliente() {
    if (!editingId) {
      alert("Salve a OS antes de imprimir.");
      return;
    }
    router.push(`/ordens/imprimir-cliente?id=${editingId}`);
  }

  function imprimirTecnico() {
    if (!editingId) {
      alert("Salve a OS antes de imprimir.");
      return;
    }
    router.push(`/ordens/imprimir-tecnico?id=${editingId}`);
  }

  const subtotal = useMemo(() => {
    const totalItens = itens.reduce((a, c) => a + toMoney(c.total), 0);
    const totalServicos = servicos.reduce((a, c) => a + toMoney(c.total), 0);
    return totalItens + totalServicos;
  }, [itens, servicos]);

  const totalGeral = useMemo(() => subtotal - toMoney(desconto), [subtotal, desconto]);

  const ordensFiltradas = useMemo(() => {
    return ordens.filter((o) =>
      normalizeText(`${o.numero || ""} ${o.cliente_nome || ""} ${o.veiculo_descricao || ""}`).includes(normalizeText(buscaHistorico))
    );
  }, [ordens, buscaHistorico]);

  const prodSug = useMemo(() => {
    if (!produtoBusca.trim()) return [];
    return produtos
      .map((p) => ({ p, s: scoreProduto(p, produtoBusca) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 10)
      .map((x) => x.p);
  }, [produtoBusca, produtos]);

  const totalOrdens = ordens.length;
  const totalAbertas = ordens.filter((o) => !o.faturado).length;
  const totalFaturadas = ordens.filter((o) => !!o.faturado).length;
  const valorTotalPeriodo = ordens.reduce((acc, o) => acc + toMoney(o.total), 0);

  if (!ready) return null;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-blue-600">Oficina</p>
              <h1 className="text-3xl font-black text-slate-900 md:text-4xl">Ordens de Serviço</h1>
              <p className="mt-1 text-sm text-slate-500">Controle de peças, serviços, faturamento e baixa automática de estoque.</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                placeholder="Buscar OS, cliente ou veículo..."
                value={buscaHistorico}
                onChange={(e) => setBuscaHistorico(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 sm:w-80"
              />
              <button
                onClick={() => {
                  limparFormulario();
                  setModalAberto(true);
                }}
                className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
              >
                + Nova OS
              </button>
            </div>
          </header>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase text-slate-400">Total de OS</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{totalOrdens}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase text-slate-400">Em aberto</p>
              <p className="mt-2 text-3xl font-black text-amber-600">{totalAbertas}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase text-slate-400">Faturadas</p>
              <p className="mt-2 text-3xl font-black text-green-600">{totalFaturadas}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase text-slate-400">Valor total</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{moneyBR(valorTotalPeriodo)}</p>
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-black text-slate-900">Histórico de Ordens</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400">Número</th>
                    <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400">Cliente</th>
                    <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400">Veículo</th>
                    <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400">Data</th>
                    <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400">Total</th>
                    <th className="px-6 py-4 text-[11px] font-black uppercase text-slate-400">Status</th>
                    <th className="px-6 py-4 text-right text-[11px] font-black uppercase text-slate-400">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {ordensFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-sm font-semibold text-slate-400">
                        Nenhuma ordem encontrada.
                      </td>
                    </tr>
                  ) : (
                    ordensFiltradas.map((o) => (
                      <tr key={o.id} className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50" onClick={() => editarOrdem(o)}>
                        <td className="px-6 py-4 font-mono text-sm font-black text-blue-600">{o.numero || "-"}</td>
                        <td className="px-6 py-4 font-bold text-slate-700">{o.cliente_nome || "-"}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{o.veiculo_descricao || "-"}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{formatDateTimeBr(o.created_at)}</td>
                        <td className="px-6 py-4 text-sm font-black text-slate-900">{moneyBR(toMoney(o.total))}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase ${o.faturado ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                            {o.faturado ? "Faturada" : o.status || "Aberta"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-lg">✏️</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {modalAberto && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="flex h-[92vh] w-full max-w-7xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center justify-between bg-slate-900 px-6 py-5 text-white">
                  <div>
                    <h2 className="text-2xl font-black">{editingId ? "Editar Ordem de Serviço" : "Nova Ordem de Serviço"}</h2>
                    <p className="text-sm text-slate-300">Preencha os dados da OS, adicione peças e serviços e finalize quando quiser faturar.</p>
                  </div>
                  <button onClick={() => setModalAberto(false)} className="rounded-xl px-3 py-2 text-2xl transition hover:bg-white/10">
                    ✕
                  </button>
                </div>

                <div className="flex-1 overflow-auto bg-slate-50 p-6">
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_0.95fr]">
                    <div className="space-y-6">
                      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-5 flex items-center justify-between">
                          <h3 className="text-lg font-black text-slate-900">Dados da OS</h3>
                          <button type="button" onClick={() => setNumeroOs(gerarNumeroOS())} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
                            Gerar número
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-[11px] font-black uppercase text-slate-400">Número da OS</label>
                            <input type="text" value={numeroOs} onChange={(e) => setNumeroOs(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Ex.: OS-20260413-001" />
                          </div>

                          <div>
                            <label className="mb-2 block text-[11px] font-black uppercase text-slate-400">Status</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                              <option value="ABERTA">ABERTA</option>
                              <option value="FINALIZADA">FINALIZADA</option>
                            </select>
                          </div>

                          <div className="relative md:col-span-2" ref={clienteBoxRef}>
                            <label className="mb-2 block text-[11px] font-black uppercase text-slate-400">Cliente</label>
                            <input type="text" value={clienteBusca} onFocus={() => setOpenClientes(true)} onChange={(e) => { setClienteBusca(e.target.value); buscarClientes(e.target.value); }} placeholder="Digite o nome do cliente..." className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                            {openClientes && (
                              <div className="absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                                {clientesEncontrados.length === 0 ? (
                                  <div className="p-4 text-sm text-slate-400">Nenhum cliente encontrado.</div>
                                ) : (
                                  clientesEncontrados.map((c) => (
                                    <button key={c.id} type="button" onClick={() => selecionarCliente(c)} className="block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-blue-50">
                                      <div className="font-bold text-slate-800">{c.nome}</div>
                                      <div className="text-xs text-slate-500">{c.telefone || c.email || c.cidade || ""}</div>
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="mb-2 block text-[11px] font-black uppercase text-slate-400">Veículo</label>
                            <select value={veiculoSelecionadoId} onChange={(e) => selecionarVeiculo(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                              <option value="">Selecione um veículo</option>
                              {veiculosCliente.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {[v.placa, v.marca, v.modelo, v.ano].filter(Boolean).join(" • ")}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-[11px] font-black uppercase text-slate-400">Descrição do veículo</label>
                            <input type="text" value={veiculoDescricao} onChange={(e) => setVeiculoDescricao(e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Placa • Marca • Modelo • Ano" />
                          </div>

                          <div className="md:col-span-2">
                            <label className="mb-2 block text-[11px] font-black uppercase text-slate-400">Observações</label>
                            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" placeholder="Descreva o serviço executado, defeito relatado, peças trocadas, garantias, etc." />
                          </div>
                        </div>
                      </section>

                      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="text-lg font-black text-slate-900">Peças</h3>

                          <div className="relative w-full sm:w-80" ref={produtoBoxRef}>
                            <input type="text" placeholder="Buscar peça por nome, SKU ou código..." value={produtoBusca} onFocus={() => setOpenProdutos(true)} onChange={(e) => { setProdutoBusca(e.target.value); setOpenProdutos(true); }} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                            {openProdutos && produtoBusca.trim() && (
                              <div className="absolute right-0 z-50 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                                {prodSug.length === 0 ? (
                                  <div className="p-4 text-sm text-slate-400">Nenhum produto encontrado.</div>
                                ) : (
                                  prodSug.map((p) => (
                                    <button key={p.id} type="button" onClick={() => adicionarProduto(p)} className="block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-blue-50">
                                      <div className="font-bold text-slate-800">{p.nome}</div>
                                      <div className="text-xs text-slate-500">SKU: {p.codigo_sku || "-"} • Estoque: {toMoney(p.estoque_atual)} • {moneyBR(toMoney(p.preco_instalacao ?? p.preco_balcao))}</div>
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[720px] text-sm">
                            <thead>
                              <tr className="border-b border-slate-100 text-slate-400">
                                <th className="py-3 text-left font-black">Produto</th>
                                <th className="py-3 text-center font-black">Qtd</th>
                                <th className="py-3 text-right font-black">Unitário</th>
                                <th className="py-3 text-right font-black">Total</th>
                                <th className="py-3 text-right font-black">Ação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itens.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="py-8 text-center text-sm font-semibold text-slate-400">Nenhuma peça adicionada.</td>
                                </tr>
                              ) : (
                                itens.map((it, i) => (
                                  <tr key={it.id} className="border-b border-slate-100 last:border-b-0">
                                    <td className="py-3">
                                      <div className="font-bold text-slate-800">{it.nome}</div>
                                      <div className="text-xs text-slate-500">{it.codigo ? `SKU: ${it.codigo} • ` : ""}Estoque atual: {toMoney(it.estoqueAtual)}</div>
                                    </td>
                                    <td className="py-3">
                                      <input type="number" min="0" value={it.quantidade} onChange={(e) => atualizarItem(i, "quantidade", e.target.value)} className="mx-auto block w-24 rounded-xl border border-slate-200 px-3 py-2 text-center outline-none transition focus:border-blue-400" />
                                    </td>
                                    <td className="py-3 text-right">
                                      <input type="number" min="0" step="0.01" value={it.valorUnitario} onChange={(e) => atualizarItem(i, "valorUnitario", e.target.value)} className="ml-auto block w-32 rounded-xl border border-slate-200 px-3 py-2 text-right outline-none transition focus:border-blue-400" />
                                    </td>
                                    <td className="py-3 text-right font-black text-slate-900">{moneyBR(toMoney(it.total))}</td>
                                    <td className="py-3 text-right">
                                      <button type="button" onClick={() => removerItem(it.id)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600">
                                        Remover
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </section>

                      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-5 flex items-center justify-between">
                          <h3 className="text-lg font-black text-slate-900">Serviços</h3>
                          <button type="button" onClick={() => setServicos((prev) => [...prev, { id: Date.now() + Math.floor(Math.random() * 9999), descricao: "", quantidade: 1, valorUnitario: 0, total: 0 }])} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
                            + Adicionar serviço
                          </button>
                        </div>

                        {servicos.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm font-semibold text-slate-400">Nenhum serviço adicionado.</div>
                        ) : (
                          <div className="space-y-3">
                            {servicos.map((s, i) => (
                              <div key={s.id} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1fr_110px_140px_100px]">
                                <input type="text" placeholder="Descrição do serviço" value={s.descricao} onChange={(e) => atualizarServico(i, "descricao", e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 outline-none transition focus:border-blue-400" />
                                <input type="number" min="0" value={s.quantidade} onChange={(e) => atualizarServico(i, "quantidade", e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-center outline-none transition focus:border-blue-400" />
                                <input type="number" min="0" step="0.01" value={s.valorUnitario} onChange={(e) => atualizarServico(i, "valorUnitario", e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-right outline-none transition focus:border-blue-400" />
                                <button type="button" onClick={() => removerServico(s.id)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600">
                                  Remover
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>

                    <aside className="space-y-6">
                      <section className="rounded-3xl border-2 border-slate-300 bg-white p-6 shadow-sm">
                        <div className="mb-4 flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={faturado}
                            onChange={(e) => setFaturado(e.target.checked)}
                            className="h-5 w-5 rounded border-slate-400 accent-blue-600"
                          />
                          <label className="text-sm font-black uppercase tracking-wide text-slate-900">
                            Faturar agora e baixar estoque
                          </label>
                        </div>

                        <p className="mb-4 text-sm font-semibold text-slate-700">
                          Ative esta opção para validar estoque, registrar pagamento e baixar os produtos automaticamente.
                        </p>

                        {faturado && (
                          <div className="space-y-4">
                            <div>
                              <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-700">
                                Forma de pagamento
                              </label>
                              <select
                                value={formaPagamento}
                                onChange={(e) => setFormaPagamento(e.target.value)}
                                className="w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                              >
                                <option value="DINHEIRO">DINHEIRO</option>
                                <option value="PIX">PIX</option>
                                <option value="CARTÃO DE DÉBITO">CARTÃO DE DÉBITO</option>
                                <option value="CARTÃO DE CRÉDITO">CARTÃO DE CRÉDITO</option>
                                <option value="TRANSFERÊNCIA">TRANSFERÊNCIA</option>
                              </select>
                            </div>

                            {isPagamentoImediato(formaPagamento) && (
                              <div>
                                <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-700">
                                  Conta financeira
                                </label>
                                <select
                                  value={contaFinanceiraId}
                                  onChange={(e) => setContaFinanceiraId(e.target.value)}
                                  className="w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                >
                                  <option value="">Escolha a conta</option>
                                  {contasFinanceiras.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.nome}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {isCartao(formaPagamento) && (
                              <div>
                                <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-700">
                                  Taxa da operadora
                                </label>
                                <select
                                  value={taxaCartaoId}
                                  onChange={(e) => setTaxaCartaoId(e.target.value)}
                                  className="w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                >
                                  <option value="">Escolha a taxa</option>
                                  {taxasCartao
                                    .filter((t) => normalizeText(formaPagamento).includes(normalizeText(t.tipo_cartao)))
                                    .map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.nome} ({toMoney(t.taxa_percentual)}%)
                                      </option>
                                    ))}
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                      </section>

                      <section className="rounded-3xl border-2 border-slate-300 bg-white p-6 shadow-sm">
                        <h3 className="mb-4 text-lg font-black text-slate-900">Resumo financeiro</h3>

                        <div className="space-y-4 text-sm">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <span className="font-semibold text-slate-700">Peças</span>
                            <span className="font-black text-slate-900">
                              {moneyBR(itens.reduce((a, c) => a + toMoney(c.total), 0))}
                            </span>
                          </div>

                          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <span className="font-semibold text-slate-700">Serviços</span>
                            <span className="font-black text-slate-900">
                              {moneyBR(servicos.reduce((a, c) => a + toMoney(c.total), 0))}
                            </span>
                          </div>

                          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <span className="font-semibold text-slate-700">Subtotal</span>
                            <span className="font-black text-slate-900">{moneyBR(subtotal)}</span>
                          </div>

                          <div>
                            <label className="mb-2 block text-[11px] font-black uppercase tracking-wide text-slate-700">
                              Desconto
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={desconto}
                              onChange={(e) => setDesconto(e.target.value)}
                              className="w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-right text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                          </div>

                          <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-950 px-5 py-5">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-300">Total geral</p>
                            <p className="mt-2 text-4xl font-black text-white">{moneyBR(totalGeral)}</p>
                          </div>
                        </div>
                      </section>

                      <section className="rounded-3xl border-2 border-slate-300 bg-white p-6 shadow-sm">
                        <h3 className="mb-4 text-lg font-black text-slate-900">Checklist rápido</h3>

                        <div className="space-y-3 text-sm">
                          <div className={`rounded-2xl border-2 px-4 py-3 font-bold ${
                            clienteSelecionado
                              ? "border-green-700 bg-green-700 text-white"
                              : "border-slate-300 bg-slate-100 text-slate-800"
                          }`}>
                            {clienteSelecionado ? "✓ Cliente selecionado" : "• Selecione um cliente"}
                          </div>

                          <div className={`rounded-2xl border-2 px-4 py-3 font-bold ${
                            itens.length > 0 || servicos.length > 0
                              ? "border-green-700 bg-green-700 text-white"
                              : "border-slate-300 bg-slate-100 text-slate-800"
                          }`}>
                            {itens.length > 0 || servicos.length > 0
                              ? "✓ Itens/serviços adicionados"
                              : "• Adicione peças ou serviços"}
                          </div>

                          <div className={`rounded-2xl border-2 px-4 py-3 font-bold ${
                            !faturado || !!contaFinanceiraId || !isPagamentoImediato(formaPagamento)
                              ? "border-green-700 bg-green-700 text-white"
                              : "border-amber-600 bg-amber-600 text-white"
                          }`}>
                            {!faturado || !!contaFinanceiraId || !isPagamentoImediato(formaPagamento)
                              ? "✓ Pagamento validado"
                              : "• Escolha uma conta financeira"}
                          </div>
                        </div>
                      </section>
                    </aside>                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 bg-white p-4 sm:flex-row">
                  <button onClick={() => setModalAberto(false)} className="rounded-2xl px-6 py-3 font-black text-slate-500 transition hover:bg-slate-100">
                    Cancelar
                  </button>

                  <button onClick={salvarOS} disabled={loading} className="flex-1 rounded-2xl bg-blue-600 px-6 py-3 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70">
                    {loading ? "Salvando..." : "Salvar Ordem de Serviço"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
