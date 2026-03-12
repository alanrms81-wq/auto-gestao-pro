"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type Cliente = {
  id: string;
  nome: string;
  telefone?: string | null;
  celular?: string | null;
  whatsapp?: string | null;
  cpf_cnpj?: string | null;
};

type Produto = {
  id: string;
  nome: string;
  codigo_sku?: string | null;
  codigo_barras?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  ncm?: string | null;
  preco_balcao?: number | null;
  controla_estoque?: boolean | null;
  estoque_atual?: number | null;
};

type ServicoBase = {
  id: string;
  nome: string;
  descricao?: string | null;
  categoria?: string | null;
  valor?: number | null;
  tempo_estimado?: string | null;
  observacoes?: string | null;
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

type OrdemServico = {
  id: string;
  empresa_id: string;
  numero?: string | null;
  cliente_id?: string | null;
  cliente_nome?: string | null;
  veiculo_id?: string | null;
  veiculo_descricao?: string | null;
  placa?: string | null;
  km?: string | null;
  tecnico_responsavel?: string | null;
  prazo_data?: string | null;
  garantia_numero?: string | null;
  garantia_tipo?: string | null;
  forma_pagamento?: string | null;
  defeito_relatado?: string | null;
  observacoes?: string | null;
  status?: string | null;
  subtotal_produtos?: number | null;
  subtotal_servicos?: number | null;
  desconto?: number | null;
  acrescimo?: number | null;
  total?: number | null;
  faturado?: boolean | null;
  data_faturamento?: string | null;
  created_at?: string | null;
};

type OsProduto = {
  id?: string;
  empresa_id?: string;
  ordem_servico_id?: string;
  produto_id?: string | null;
  produto_nome?: string | null;
  nome?: string | null;
  codigo?: string | null;
  quantidade?: number | null;
  valor_unitario?: number | null;
  subtotal?: number | null;
};

type OsServico = {
  id?: string;
  empresa_id?: string;
  ordem_servico_id?: string;
  descricao?: string | null;
  quantidade?: number | null;
  valor_unitario?: number | null;
  subtotal?: number | null;
};

function up(v: unknown) {
  return String(v ?? "").toUpperCase();
}

function normalizeText(v: unknown) {
  return String(v ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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

function gerarNumeroOS() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rnd = String(Math.floor(Math.random() * 9000) + 1000);
  return `OS-${y}${m}${day}-${rnd}`;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function makeLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function montarDescricaoVeiculo(v: Veiculo) {
  return [v.marca, v.modelo, v.ano].filter(Boolean).join(" / ");
}

function statusClass(status: string) {
  const s = up(status);
  if (s === "ABERTA") return "status-aberta";
  if (s === "EM ANDAMENTO") return "status-andamento";
  if (s === "FINALIZADA") return "status-finalizada";
  if (s === "ENTREGUE") return "status-entregue";
  if (s === "CANCELADA") return "status-cancelada";
  return "status-aberta";
}

function OrdensPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [carregandoEdicao, setCarregandoEdicao] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtosBase, setProdutosBase] = useState<Produto[]>([]);
  const [servicosBase, setServicosBase] = useState<ServicoBase[]>([]);
  const [veiculosCliente, setVeiculosCliente] = useState<Veiculo[]>([]);
  const [historico, setHistorico] = useState<OrdemServico[]>([]);

  const [buscaCliente, setBuscaCliente] = useState("");
  const [buscaProduto, setBuscaProduto] = useState("");
  const [buscaServico, setBuscaServico] = useState("");
  const [buscaHistorico, setBuscaHistorico] = useState("");

  const [mostrarDropdownCliente, setMostrarDropdownCliente] = useState(false);
  const [mostrarDropdownProduto, setMostrarDropdownProduto] = useState(false);
  const [mostrarDropdownServico, setMostrarDropdownServico] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [numeroOS, setNumeroOS] = useState(gerarNumeroOS());
  const [clienteId, setClienteId] = useState("");
  const [clienteNome, setClienteNome] = useState("");

  const [veiculoId, setVeiculoId] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [placa, setPlaca] = useState("");
  const [km, setKm] = useState("");

  const [status, setStatus] = useState("ABERTA");
  const [tecnico, setTecnico] = useState("");
  const [prazoData, setPrazoData] = useState("");
  const [garantiaNumero, setGarantiaNumero] = useState("");
  const [garantiaTipo, setGarantiaTipo] = useState("DIAS");
  const [formaPagamento, setFormaPagamento] = useState("DINHEIRO");
  const [defeitoRelatado, setDefeitoRelatado] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [desconto, setDesconto] = useState("0");
  const [acrescimo, setAcrescimo] = useState("0");

  const [produtosOS, setProdutosOS] = useState<OsProduto[]>([]);
  const [servicosOS, setServicosOS] = useState<OsServico[]>([]);

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

  useEffect(() => {
    if (!ready || !empresaId || clientes.length === 0) return;
    if (editingId) return;

    const clienteIdParam = searchParams.get("cliente_id");
    if (!clienteIdParam) return;

    carregarDadosDoAgendamento();
  }, [ready, empresaId, clientes, searchParams, editingId]);

  async function carregarBase(eid?: string) {
    const emp = eid || empresaId;
    if (!emp) return;

    setLoading(true);

    const [clientesResp, produtosResp, servicosResp, historicoResp] =
      await Promise.all([
        supabase
          .from("clientes")
          .select("id,nome,telefone,celular,whatsapp,cpf_cnpj")
          .eq("empresa_id", emp)
          .order("nome"),
        supabase
          .from("produtos")
          .select(
            "id,nome,codigo_sku,codigo_barras,categoria,subcategoria,ncm,preco_balcao,controla_estoque,estoque_atual"
          )
          .eq("empresa_id", emp)
          .order("nome"),
        supabase
          .from("servicos")
          .select(
            "id,nome,descricao,categoria,valor,tempo_estimado,observacoes,status"
          )
          .eq("empresa_id", emp)
          .eq("status", "ATIVO")
          .order("nome"),
        supabase
          .from("ordens_servico")
          .select("*")
          .eq("empresa_id", emp)
          .order("created_at", { ascending: false }),
      ]);

    if (clientesResp.error) alert("ERRO CLIENTES: " + clientesResp.error.message);
    if (produtosResp.error) alert("ERRO PRODUTOS: " + produtosResp.error.message);
    if (servicosResp.error) alert("ERRO SERVIÇOS: " + servicosResp.error.message);
    if (historicoResp.error) alert("ERRO HISTÓRICO OS: " + historicoResp.error.message);

    setClientes((clientesResp.data || []) as Cliente[]);
    setProdutosBase((produtosResp.data || []) as Produto[]);
    setServicosBase((servicosResp.data || []) as ServicoBase[]);
    setHistorico((historicoResp.data || []) as OrdemServico[]);

    setLoading(false);
  }

  async function carregarVeiculosDoCliente(idCliente: string) {
    if (!empresaId || !idCliente) {
      setVeiculosCliente([]);
      return;
    }

    const { data, error } = await supabase
      .from("veiculos")
      .select("*")
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

  function limparFormularioBase() {
    setNumeroOS(gerarNumeroOS());
    setClienteId("");
    setClienteNome("");
    setBuscaCliente("");
    setVeiculoId("");
    setVeiculo("");
    setPlaca("");
    setKm("");
    setVeiculosCliente([]);
    setStatus("ABERTA");
    setTecnico("");
    setPrazoData("");
    setGarantiaNumero("");
    setGarantiaTipo("DIAS");
    setFormaPagamento("DINHEIRO");
    setDefeitoRelatado("");
    setObservacoes("");
    setBuscaProduto("");
    setBuscaServico("");
    setDesconto("0");
    setAcrescimo("0");
    setProdutosOS([]);
    setServicosOS([]);
    setMostrarDropdownCliente(false);
    setMostrarDropdownProduto(false);
    setMostrarDropdownServico(false);
  }

  async function preencherFormularioOS(os: OrdemServico) {
    setNumeroOS(os.numero || gerarNumeroOS());
    setClienteId(os.cliente_id || "");
    setClienteNome(os.cliente_nome || "");
    setBuscaCliente(os.cliente_nome || "");
    setMostrarDropdownCliente(false);

    if (os.cliente_id) {
      await carregarVeiculosDoCliente(os.cliente_id);
    } else {
      setVeiculosCliente([]);
    }

    setVeiculoId(os.veiculo_id || "");
    setVeiculo(os.veiculo_descricao || "");
    setPlaca(os.placa || "");
    setKm(os.km || "");

    setStatus(os.status || "ABERTA");
    setTecnico(os.tecnico_responsavel || "");
    setPrazoData(os.prazo_data || "");
    setGarantiaNumero(os.garantia_numero || "");
    setGarantiaTipo(os.garantia_tipo || "DIAS");
    setFormaPagamento(os.forma_pagamento || "DINHEIRO");
    setDefeitoRelatado(os.defeito_relatado || "");
    setObservacoes(os.observacoes || "");
    setDesconto(String(toMoney(os.desconto)));
    setAcrescimo(String(toMoney(os.acrescimo)));
  }

  async function carregarDadosDoAgendamento() {
    const clienteIdParam = searchParams.get("cliente_id") || "";
    const veiculoIdParam = searchParams.get("veiculo_id") || "";
    const agendamentoIdParam = searchParams.get("agendamento_id") || "";

    if (!empresaId || !clienteIdParam) return;
    if (editingId) return;

    limparFormularioBase();

    const cliente = clientes.find((c) => c.id === clienteIdParam);

    if (cliente) {
      setClienteId(cliente.id);
      setClienteNome(cliente.nome);
      setBuscaCliente(cliente.nome);
      setMostrarDropdownCliente(false);
    }

    await carregarVeiculosDoCliente(clienteIdParam);

    if (veiculoIdParam) {
      const { data: veiculoResp, error: veiculoError } = await supabase
        .from("veiculos")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("id", veiculoIdParam)
        .single();

      if (!veiculoError && veiculoResp) {
        setVeiculoId(veiculoResp.id || "");
        setVeiculo(montarDescricaoVeiculo(veiculoResp));
        setPlaca(veiculoResp.placa || "");
        setKm(veiculoResp.km_atual || "");
      }
    }

    if (agendamentoIdParam) {
      const { data: agResp, error: agError } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("id", agendamentoIdParam)
        .single();

      if (!agError && agResp) {
        setTecnico(agResp.tecnico_responsavel || "");
        setDefeitoRelatado(agResp.servico || "");
        setObservacoes(agResp.observacoes || "");
      }
    }
  }

  const clientesFiltrados = useMemo(() => {
    const q = normalizeText(buscaCliente.trim());
    if (!q) return clientes.slice(0, 8);

    return clientes
      .filter((c) =>
        normalizeText(
          `${c.nome} ${c.telefone || ""} ${c.celular || ""} ${c.whatsapp || ""} ${c.cpf_cnpj || ""}`
        ).includes(q)
      )
      .slice(0, 8);
  }, [clientes, buscaCliente]);

  const produtosFiltrados = useMemo(() => {
    const q = normalizeText(buscaProduto.trim());

    if (!q || q.length < 2) return [];

    return produtosBase
      .filter((p) =>
        normalizeText(
          `${p.nome || ""} ${p.codigo_sku || ""} ${p.codigo_barras || ""} ${p.categoria || ""} ${p.subcategoria || ""} ${p.ncm || ""}`
        ).includes(q)
      )
      .slice(0, 20);
  }, [produtosBase, buscaProduto]);

  const servicosFiltrados = useMemo(() => {
    const q = normalizeText(buscaServico.trim());
    if (!q || q.length < 2) return [];

    return servicosBase
      .filter((s) =>
        normalizeText(
          `${s.nome || ""} ${s.descricao || ""} ${s.categoria || ""} ${s.tempo_estimado || ""}`
        ).includes(q)
      )
      .slice(0, 8);
  }, [servicosBase, buscaServico]);

  const historicoFiltrado = useMemo(() => {
    const q = normalizeText(buscaHistorico.trim());
    if (!q) return historico;

    return historico.filter((item) =>
      normalizeText(
        `${item.numero || ""} ${item.cliente_nome || ""} ${item.veiculo_descricao || ""} ${item.status || ""} ${item.placa || ""}`
      ).includes(q)
    );
  }, [historico, buscaHistorico]);

  const subtotalProdutos = useMemo(() => {
    return produtosOS.reduce(
      (acc, item) => acc + toMoney(item.quantidade) * toMoney(item.valor_unitario),
      0
    );
  }, [produtosOS]);

  const subtotalServicos = useMemo(() => {
    return servicosOS.reduce(
      (acc, item) => acc + toMoney(item.quantidade) * toMoney(item.valor_unitario),
      0
    );
  }, [servicosOS]);

  const totalGeral = useMemo(() => {
    return subtotalProdutos + subtotalServicos - toMoney(desconto) + toMoney(acrescimo);
  }, [subtotalProdutos, subtotalServicos, desconto, acrescimo]);

  function novaOS() {
    setEditingId(null);
    limparFormularioBase();
  }

  async function selecionarCliente(c: Cliente) {
    setClienteId(c.id);
    setClienteNome(c.nome);
    setBuscaCliente(c.nome);
    setMostrarDropdownCliente(false);

    setVeiculoId("");
    setVeiculo("");
    setPlaca("");
    setKm("");

    await carregarVeiculosDoCliente(c.id);
  }

  function selecionarVeiculo(id: string) {
    setVeiculoId(id);

    const v = veiculosCliente.find((item) => item.id === id);
    if (!v) return;

    setVeiculo(montarDescricaoVeiculo(v));
    setPlaca(v.placa || "");
    setKm(v.km_atual || "");
  }

  function adicionarProdutoDoBanco(p: Produto) {
    setProdutosOS((prev) => [
      ...prev,
      {
        id: makeLocalId(),
        produto_id: p.id,
        produto_nome: p.nome,
        nome: p.nome,
        codigo: p.codigo_sku || p.codigo_barras || "",
        quantidade: 1,
        valor_unitario: toMoney(p.preco_balcao),
        subtotal: toMoney(p.preco_balcao),
      },
    ]);
    setBuscaProduto("");
    setMostrarDropdownProduto(false);
  }

  function adicionarServicoDoCadastro(servico: ServicoBase) {
    setServicosOS((prev) => [
      ...prev,
      {
        id: makeLocalId(),
        descricao: servico.nome || servico.descricao || "",
        quantidade: 1,
        valor_unitario: toMoney(servico.valor),
        subtotal: toMoney(servico.valor),
      },
    ]);
    setBuscaServico("");
    setMostrarDropdownServico(false);
  }

  function atualizarProdutoOS(id: string | undefined, campo: keyof OsProduto, valor: unknown) {
    setProdutosOS((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const atualizado = {
          ...item,
          [campo]:
            campo === "quantidade" || campo === "valor_unitario"
              ? toMoney(valor)
              : valor,
        };

        atualizado.subtotal =
          toMoney(atualizado.quantidade) * toMoney(atualizado.valor_unitario);

        return atualizado;
      })
    );
  }

  function removerProdutoOS(id: string | undefined) {
    setProdutosOS((prev) => prev.filter((item) => item.id !== id));
  }

  function adicionarServico() {
    setServicosOS((prev) => [
      ...prev,
      {
        id: makeLocalId(),
        descricao: "",
        quantidade: 1,
        valor_unitario: 0,
        subtotal: 0,
      },
    ]);
  }

  function atualizarServicoOS(id: string | undefined, campo: keyof OsServico, valor: unknown) {
    setServicosOS((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const atualizado = {
          ...item,
          [campo]:
            campo === "quantidade" || campo === "valor_unitario"
              ? toMoney(valor)
              : valor,
        };

        atualizado.subtotal =
          toMoney(atualizado.quantidade) * toMoney(atualizado.valor_unitario);

        return atualizado;
      })
    );
  }

  function removerServicoOS(id: string | undefined) {
    setServicosOS((prev) => prev.filter((item) => item.id !== id));
  }

  async function salvarOS() {
    if (!empresaId) return;

    if (!clienteNome.trim()) {
      alert("SELECIONE UM CLIENTE.");
      return;
    }

    const payload = {
      empresa_id: empresaId,
      numero: up(numeroOS),
      cliente_id: clienteId || null,
      cliente_nome: up(clienteNome),
      veiculo_id: veiculoId || null,
      veiculo_descricao: up(veiculo),
      placa: up(placa),
      km: up(km),
      tecnico_responsavel: up(tecnico),
      prazo_data: prazoData || null,
      garantia_numero: up(garantiaNumero),
      garantia_tipo: up(garantiaTipo),
      forma_pagamento: up(formaPagamento),
      defeito_relatado: up(defeitoRelatado),
      observacoes: up(observacoes),
      status: up(status),
      subtotal_produtos: subtotalProdutos,
      subtotal_servicos: subtotalServicos,
      desconto: toMoney(desconto),
      acrescimo: toMoney(acrescimo),
      total: totalGeral,
      faturado: false,
    };

    let ordemId = editingId;

    if (editingId) {
      const { error } = await supabase
        .from("ordens_servico")
        .update(payload)
        .eq("id", editingId)
        .eq("empresa_id", empresaId);

      if (error) {
        alert("ERRO AO ATUALIZAR OS: " + error.message);
        return;
      }

      await supabase
        .from("ordens_servico_produtos")
        .delete()
        .eq("empresa_id", empresaId)
        .eq("ordem_servico_id", editingId);

      await supabase
        .from("ordens_servico_servicos")
        .delete()
        .eq("empresa_id", empresaId)
        .eq("ordem_servico_id", editingId);
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

    const produtosPayload = produtosOS.map((item) => ({
      empresa_id: empresaId,
      ordem_servico_id: ordemId,
      produto_id: item.produto_id || null,
      nome: up(item.produto_nome || item.nome || ""),
      produto_nome: up(item.produto_nome || item.nome || ""),
      codigo: up(item.codigo || ""),
      quantidade: toMoney(item.quantidade),
      valor_unitario: toMoney(item.valor_unitario),
      subtotal: toMoney(item.quantidade) * toMoney(item.valor_unitario),
    }));

    const servicosPayload = servicosOS
      .filter((item) => String(item.descricao || "").trim())
      .map((item) => ({
        empresa_id: empresaId,
        ordem_servico_id: ordemId,
        descricao: up(item.descricao || ""),
        quantidade: toMoney(item.quantidade),
        valor_unitario: toMoney(item.valor_unitario),
        subtotal: toMoney(item.quantidade) * toMoney(item.valor_unitario),
      }));

    if (produtosPayload.length > 0) {
      const { error } = await supabase
        .from("ordens_servico_produtos")
        .insert(produtosPayload);
      if (error) {
        alert("ERRO AO SALVAR PRODUTOS DA OS: " + error.message);
        return;
      }
    }

    if (servicosPayload.length > 0) {
      const { error } = await supabase
        .from("ordens_servico_servicos")
        .insert(servicosPayload);
      if (error) {
        alert("ERRO AO SALVAR SERVIÇOS DA OS: " + error.message);
        return;
      }
    }

    const agendamentoIdParam = searchParams.get("agendamento_id");

    if (agendamentoIdParam && !editingId && empresaId) {
      await supabase
        .from("agendamentos")
        .update({ status: "CONVERTIDO" })
        .eq("empresa_id", empresaId)
        .eq("id", agendamentoIdParam);
    }

    alert(editingId ? "OS ATUALIZADA!" : "OS SALVA COM SUCESSO!");
    novaOS();
    await carregarBase();
  }

  async function editarOS(item: OrdemServico) {
    if (!empresaId) return;

    setCarregandoEdicao(true);
    setMostrarDropdownCliente(false);
    setMostrarDropdownProduto(false);
    setMostrarDropdownServico(false);

    limparFormularioBase();
    setEditingId(item.id);

    const { data: osCompleta, error: osError } = await supabase
      .from("ordens_servico")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("id", item.id)
      .single();

    if (osError || !osCompleta) {
      alert("ERRO AO CARREGAR OS PARA EDIÇÃO: " + (osError?.message || ""));
      setEditingId(null);
      setCarregandoEdicao(false);
      return;
    }

    await preencherFormularioOS(osCompleta as OrdemServico);

    const [prodResp, servResp] = await Promise.all([
      supabase
        .from("ordens_servico_produtos")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("ordem_servico_id", item.id),
      supabase
        .from("ordens_servico_servicos")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("ordem_servico_id", item.id),
    ]);

    if (prodResp.error) {
      alert("ERRO AO CARREGAR PRODUTOS DA OS: " + prodResp.error.message);
    }

    if (servResp.error) {
      alert("ERRO AO CARREGAR SERVIÇOS DA OS: " + servResp.error.message);
    }

    setProdutosOS(
      ((prodResp.data || []) as OsProduto[]).map((p) => ({
        ...p,
        id: p.id || makeLocalId(),
        produto_nome: p.produto_nome || p.nome || "",
        nome: p.nome || p.produto_nome || "",
      }))
    );

    setServicosOS(
      ((servResp.data || []) as OsServico[]).map((s) => ({
        ...s,
        id: s.id || makeLocalId(),
      }))
    );

    setCarregandoEdicao(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removerOS(id: string) {
    if (!empresaId) return;
    if (!confirm("REMOVER ESTA OS?")) return;

    await supabase
      .from("ordens_servico_produtos")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("ordem_servico_id", id);

    await supabase
      .from("ordens_servico_servicos")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("ordem_servico_id", id);

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
    if (editingId === id) novaOS();
    await carregarBase();
  }

  async function faturarOS(item: OrdemServico) {
    if (!empresaId) return;

    if (item.faturado) {
      alert("ESSA OS JÁ ESTÁ FATURADA.");
      return;
    }

    const { error: osError } = await supabase
      .from("ordens_servico")
      .update({
        faturado: true,
        data_faturamento: hojeISO(),
      })
      .eq("empresa_id", empresaId)
      .eq("id", item.id);

    if (osError) {
      alert("ERRO AO FATURAR OS: " + osError.message);
      return;
    }

    const { error: financeiroError } = await supabase
      .from("financeiro_titulos")
      .insert([
        {
          empresa_id: empresaId,
          tipo: "RECEBER",
          descricao: up(`OS ${item.numero || ""}`),
          cliente_id: item.cliente_id || null,
          cliente_nome: up(item.cliente_nome || ""),
          documento: up(item.numero || ""),
          categoria: "ORDEM DE SERVICO",
          valor_original: toMoney(item.total),
          valor_pago: 0,
          desconto: 0,
          juros: 0,
          multa: 0,
          data_emissao: hojeISO(),
          data_vencimento: hojeISO(),
          status: "ABERTO",
          observacoes: up(`FATURAMENTO DA OS ${item.numero || ""}`),
        },
      ]);

    if (financeiroError) {
      alert("OS FATURADA, MAS HOUVE ERRO NO FINANCEIRO: " + financeiroError.message);
      return;
    }

    alert("OS FATURADA COM SUCESSO!");
    await carregarBase();
  }

  function imprimirOS(item: OrdemServico) {
    window.open(`/ordens/imprimir?id=${item.id}`, "_blank");
  }

  function imprimirTecnico(item: OrdemServico) {
    window.open(`/ordens/imprimir-tecnico?id=${item.id}`, "_blank");
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
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="pill pill-white">NÚMERO {numeroOS}</span>
                <span className={`pill ${statusClass(status)}`}>{status}</span>
                {editingId ? (
                  <span className="pill pill-warning">EDITANDO</span>
                ) : (
                  <span className="pill pill-success">NOVA</span>
                )}
                {carregandoEdicao && <span className="pill pill-white">CARREGANDO EDIÇÃO</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
              <KpiMini titulo="PRODUTOS" valor={moneyBR(subtotalProdutos)} />
              <KpiMini titulo="SERVIÇOS" valor={moneyBR(subtotalServicos)} />
              <KpiMini titulo="TOTAL" valor={moneyBR(totalGeral)} destaque />
              <KpiMini titulo="ITENS" valor={String(produtosOS.length + servicosOS.length)} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button className="botao-header-primary" onClick={salvarOS} type="button">
              SALVAR OS
            </button>

            <button className="botao-header" onClick={novaOS} type="button">
              NOVA OS
            </button>

            <button
              className="botao-header"
              onClick={() => editingId && imprimirOS({ id: editingId } as OrdemServico)}
              type="button"
            >
              IMPRIMIR OS
            </button>

            <button
              className="botao-header"
              onClick={() => editingId && imprimirTecnico({ id: editingId } as OrdemServico)}
              type="button"
            >
              IMPRIMIR TÉCNICO
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <div className="space-y-6">
            <section className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">CLIENTE E VEÍCULO</h2>
                  <p className="section-subtitle">
                    Identifique rapidamente o cliente, veículo e dados principais da OS.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 relative">
                  <label className="label">CLIENTE</label>
                  <input
                    placeholder="DIGITE NOME, TELEFONE OU DOCUMENTO..."
                    className="campo"
                    value={buscaCliente}
                    onChange={(e) => {
                      setBuscaCliente(e.target.value);
                      setMostrarDropdownCliente(true);
                    }}
                    onFocus={() => {
                      if (buscaCliente.trim()) setMostrarDropdownCliente(true);
                    }}
                  />

                  {mostrarDropdownCliente && buscaCliente.trim() && clientesFiltrados.length > 0 && (
                    <div className="dropdown">
                      {clientesFiltrados.map((c) => (
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
                </div>

                <div>
                  <label className="label">VEÍCULO</label>
                  <select
                    className="campo"
                    value={veiculoId}
                    onChange={(e) => selecionarVeiculo(e.target.value)}
                    disabled={!clienteId}
                  >
                    <option value="">SELECIONE O VEÍCULO</option>
                    {veiculosCliente.map((v) => (
                      <option key={v.id} value={v.id}>
                        {montarDescricaoVeiculo(v)} {v.placa ? `- ${v.placa}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">TÉCNICO / RESPONSÁVEL</label>
                  <input
                    placeholder="NOME DO RESPONSÁVEL"
                    className="campo"
                    value={tecnico}
                    onChange={(e) => setTecnico(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">PRAZO</label>
                  <input
                    type="date"
                    className="campo"
                    value={prazoData}
                    onChange={(e) => setPrazoData(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">FORMA DE PAGAMENTO</label>
                  <select
                    className="campo"
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                  >
                    <option>DINHEIRO</option>
                    <option>PIX</option>
                    <option>CARTÃO</option>
                    <option>BOLETO</option>
                  </select>
                </div>

                <div className="placa-card">
                  <span className="placa-label">PLACA</span>
                  <span className="placa-valor">{placa || "--- ----"}</span>
                </div>

                <div>
                  <label className="label">KM</label>
                  <input className="campo" value={km} onChange={(e) => setKm(e.target.value)} />
                </div>

                <div>
                  <label className="label">GARANTIA</label>
                  <input
                    placeholder="NÚMERO"
                    className="campo"
                    value={garantiaNumero}
                    onChange={(e) => setGarantiaNumero(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">TIPO GARANTIA</label>
                  <select
                    className="campo"
                    value={garantiaTipo}
                    onChange={(e) => setGarantiaTipo(e.target.value)}
                  >
                    <option>DIAS</option>
                    <option>MESES</option>
                    <option>ANOS</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="label">DEFEITO RELATADO</label>
                  <textarea
                    className="campo-textarea"
                    value={defeitoRelatado}
                    onChange={(e) => setDefeitoRelatado(e.target.value)}
                    placeholder="DESCREVA O RELATO DO CLIENTE, SINTOMAS, TESTES INICIAIS..."
                  />
                </div>
              </div>
            </section>

            <section className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">PRODUTOS</h2>
                  <p className="section-subtitle">
                    Busque por nome, SKU, código de barras, categoria, subcategoria ou NCM.
                  </p>
                </div>
                <div className="helper-badge">DIGITE 2 LETRAS</div>
              </div>

              <div className="relative mb-4">
                <input
                  placeholder="BUSCAR PRODUTO POR NOME, SKU, BARRAS, CATEGORIA, SUBCATEGORIA OU NCM..."
                  className="campo"
                  value={buscaProduto}
                  onChange={(e) => {
                    setBuscaProduto(e.target.value);
                    setMostrarDropdownProduto(true);
                  }}
                  onFocus={() => {
                    if (buscaProduto.trim().length >= 2) setMostrarDropdownProduto(true);
                  }}
                />

                {mostrarDropdownProduto && buscaProduto.trim().length >= 2 && produtosFiltrados.length > 0 && (
                  <div className="dropdown top-full mt-2">
                    {produtosFiltrados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => adicionarProdutoDoBanco(p)}
                        className="dropdown-item"
                      >
                        <div className="font-semibold text-[#111827]">{p.nome}</div>
                        <div className="text-xs text-[#6B7280]">
                          {p.codigo_sku || p.codigo_barras || "-"} • {p.categoria || "-"}
                          {p.subcategoria ? ` / ${p.subcategoria}` : ""} • NCM {p.ncm || "-"} •{" "}
                          {moneyBR(toMoney(p.preco_balcao))}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <table className="tabela">
                <thead>
                  <tr>
                    <th>PRODUTO</th>
                    <th>CÓDIGO</th>
                    <th>QTD</th>
                    <th>V. UNIT.</th>
                    <th>TOTAL</th>
                    <th>AÇÃO</th>
                  </tr>
                </thead>

                <tbody>
                  {produtosOS.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-state">
                        NENHUM PRODUTO ADICIONADO.
                      </td>
                    </tr>
                  ) : (
                    produtosOS.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <input
                            className="campo-tabela"
                            value={item.produto_nome || item.nome || ""}
                            onChange={(e) => atualizarProdutoOS(item.id, "produto_nome", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="campo-tabela"
                            value={item.codigo || ""}
                            onChange={(e) => atualizarProdutoOS(item.id, "codigo", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="campo-tabela"
                            type="number"
                            value={toMoney(item.quantidade)}
                            onChange={(e) => atualizarProdutoOS(item.id, "quantidade", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="campo-tabela"
                            type="number"
                            value={toMoney(item.valor_unitario)}
                            onChange={(e) => atualizarProdutoOS(item.id, "valor_unitario", e.target.value)}
                          />
                        </td>
                        <td className="font-bold text-[#0F172A]">
                          {moneyBR(toMoney(item.quantidade) * toMoney(item.valor_unitario))}
                        </td>
                        <td>
                          <button className="botao-mini danger" onClick={() => removerProdutoOS(item.id)} type="button">
                            REMOVER
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <section className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">SERVIÇOS / MÃO DE OBRA</h2>
                  <p className="section-subtitle">
                    Adicione serviços cadastrados ou lance um serviço manual.
                  </p>
                </div>

                <button className="botao" onClick={adicionarServico} type="button">
                  ADICIONAR MANUAL
                </button>
              </div>

              <div className="relative mb-4">
                <input
                  placeholder="BUSCAR SERVIÇO CADASTRADO..."
                  className="campo"
                  value={buscaServico}
                  onChange={(e) => {
                    setBuscaServico(e.target.value);
                    setMostrarDropdownServico(true);
                  }}
                  onFocus={() => {
                    if (buscaServico.trim().length >= 2) setMostrarDropdownServico(true);
                  }}
                />

                {mostrarDropdownServico && buscaServico.trim().length >= 2 && servicosFiltrados.length > 0 && (
                  <div className="dropdown top-full mt-2">
                    {servicosFiltrados.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => adicionarServicoDoCadastro(s)}
                        className="dropdown-item"
                      >
                        <div className="font-semibold text-[#111827]">{s.nome}</div>
                        <div className="text-xs text-[#6B7280]">
                          {s.categoria || "-"} • {moneyBR(toMoney(s.valor))}
                          {s.tempo_estimado ? ` • ${s.tempo_estimado}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <table className="tabela">
                <thead>
                  <tr>
                    <th>DESCRIÇÃO</th>
                    <th>QTD</th>
                    <th>V. UNIT.</th>
                    <th>TOTAL</th>
                    <th>AÇÃO</th>
                  </tr>
                </thead>

                <tbody>
                  {servicosOS.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-state">
                        NENHUM SERVIÇO ADICIONADO.
                      </td>
                    </tr>
                  ) : (
                    servicosOS.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <input
                            className="campo-tabela"
                            value={item.descricao || ""}
                            onChange={(e) => atualizarServicoOS(item.id, "descricao", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="campo-tabela"
                            type="number"
                            value={toMoney(item.quantidade)}
                            onChange={(e) => atualizarServicoOS(item.id, "quantidade", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="campo-tabela"
                            type="number"
                            value={toMoney(item.valor_unitario)}
                            onChange={(e) => atualizarServicoOS(item.id, "valor_unitario", e.target.value)}
                          />
                        </td>
                        <td className="font-bold text-[#0F172A]">
                          {moneyBR(toMoney(item.quantidade) * toMoney(item.valor_unitario))}
                        </td>
                        <td>
                          <button className="botao-mini danger" onClick={() => removerServicoOS(item.id)} type="button">
                            REMOVER
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <section className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">HISTÓRICO DE ORDENS</h2>
                  <p className="section-subtitle">
                    Consulte e reutilize ordens de serviço anteriores.
                  </p>
                </div>
              </div>

              <input
                placeholder="BUSCAR POR NÚMERO, CLIENTE, VEÍCULO OU STATUS..."
                className="campo mb-4"
                value={buscaHistorico}
                onChange={(e) => setBuscaHistorico(e.target.value)}
              />

              <table className="tabela">
                <thead>
                  <tr>
                    <th>NÚMERO</th>
                    <th>DATA</th>
                    <th>CLIENTE</th>
                    <th>VEÍCULO</th>
                    <th>STATUS</th>
                    <th>FAT.</th>
                    <th>TOTAL</th>
                    <th>AÇÕES</th>
                  </tr>
                </thead>

                <tbody>
                  {historicoFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty-state">
                        NENHUMA ORDEM DE SERVIÇO ENCONTRADA.
                      </td>
                    </tr>
                  ) : (
                    historicoFiltrado.map((item) => (
                      <tr key={item.id}>
                        <td className="font-bold">{item.numero || "-"}</td>
                        <td>
                          {item.created_at
                            ? new Date(item.created_at).toLocaleDateString("pt-BR")
                            : "-"}
                        </td>
                        <td>{item.cliente_nome || "-"}</td>
                        <td>{item.veiculo_descricao || "-"}</td>
                        <td>
                          <span className={`status-chip ${statusClass(item.status || "ABERTA")}`}>
                            {item.status || "-"}
                          </span>
                        </td>
                        <td>{item.faturado ? "SIM" : "NÃO"}</td>
                        <td className="font-bold">{moneyBR(toMoney(item.total || 0))}</td>
                        <td>
                          <div className="flex gap-1 flex-wrap">
                            <button className="botao-mini" onClick={() => editarOS(item)} type="button">
                              EDITAR
                            </button>
                            <button className="botao-mini" onClick={() => imprimirOS(item)} type="button">
                              OS
                            </button>
                            <button className="botao-mini" onClick={() => imprimirTecnico(item)} type="button">
                              TÉCNICO
                            </button>
                            <button className="botao-mini success" onClick={() => faturarOS(item)} type="button">
                              FATURAR
                            </button>
                            <button className="botao-mini danger" onClick={() => removerOS(item.id)} type="button">
                              REMOVER
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          </div>

          <div className="space-y-6">
            <section className="card sticky-card">
              <h2 className="section-title mb-4">RESUMO DA OS</h2>

              <div className="resumo-box">
                <div className="resumo-linha">
                  <span>CLIENTE</span>
                  <strong>{clienteNome || "-"}</strong>
                </div>
                <div className="resumo-linha">
                  <span>VEÍCULO</span>
                  <strong>{veiculo || "-"}</strong>
                </div>
                <div className="resumo-linha">
                  <span>PLACA</span>
                  <strong>{placa || "-"}</strong>
                </div>
                <div className="resumo-linha">
                  <span>KM</span>
                  <strong>{km || "-"}</strong>
                </div>
                <div className="resumo-linha">
                  <span>TÉCNICO</span>
                  <strong>{tecnico || "-"}</strong>
                </div>
                <div className="resumo-linha">
                  <span>PRAZO</span>
                  <strong>{prazoData || "-"}</strong>
                </div>
                <div className="resumo-linha">
                  <span>GARANTIA</span>
                  <strong>{garantiaNumero ? `${garantiaNumero} ${garantiaTipo}` : "-"}</strong>
                </div>
                <div className="resumo-linha">
                  <span>PAGAMENTO</span>
                  <strong>{formaPagamento}</strong>
                </div>
                <div className="resumo-linha">
                  <span>STATUS</span>
                  <strong>{status}</strong>
                </div>
              </div>

              <div className="mt-5">
                <label className="label">STATUS DA OS</label>
                <select className="campo" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option>ABERTA</option>
                  <option>EM ANDAMENTO</option>
                  <option>FINALIZADA</option>
                  <option>ENTREGUE</option>
                  <option>CANCELADA</option>
                </select>
              </div>
            </section>

            <section className="card">
              <h2 className="section-title mb-4">FINANCEIRO</h2>

              <div className="finance-box">
                <div className="finance-line">
                  <span>PRODUTOS</span>
                  <strong>{moneyBR(subtotalProdutos)}</strong>
                </div>
                <div className="finance-line">
                  <span>SERVIÇOS</span>
                  <strong>{moneyBR(subtotalServicos)}</strong>
                </div>

                <div className="mt-4">
                  <label className="label">DESCONTO</label>
                  <input
                    className="campo"
                    type="number"
                    value={desconto}
                    onChange={(e) => setDesconto(e.target.value)}
                  />
                </div>

                <div className="mt-3">
                  <label className="label">ACRÉSCIMO</label>
                  <input
                    className="campo"
                    type="number"
                    value={acrescimo}
                    onChange={(e) => setAcrescimo(e.target.value)}
                  />
                </div>

                <div className="finance-total">
                  <span>TOTAL GERAL</span>
                  <strong>{moneyBR(totalGeral)}</strong>
                </div>
              </div>
            </section>

            <section className="card">
              <h2 className="section-title mb-3">OBSERVAÇÕES INTERNAS</h2>

              <textarea
                className="campo-textarea"
                placeholder="DESCREVA O SERVIÇO, DEFEITO, CONDIÇÕES DE ENTRADA, PEÇAS TROCADAS, TESTES, ORIENTAÇÕES AO CLIENTE..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </section>
          </div>
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

        .botao {
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 13px;
          background: white;
          color: #1e293b;
          font-weight: 700;
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

        .dropdown {
          position: absolute;
          z-index: 20;
          width: 100%;
          border-radius: 16px;
          border: 1px solid #dbe4ee;
          background: white;
          box-shadow: 0 18px 35px rgba(15, 23, 42, 0.12);
          max-height: 240px;
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

        .pill-warning {
          background: rgba(245, 158, 11, 0.22);
          border: 1px solid rgba(253, 230, 138, 0.45);
          color: white;
        }

        .status-chip {
          display: inline-flex;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 900;
        }

        .status-aberta {
          background: #e0f2fe;
          color: #0369a1;
        }

        .status-andamento {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .status-finalizada {
          background: #dcfce7;
          color: #15803d;
        }

        .status-entregue {
          background: #e2e8f0;
          color: #334155;
        }

        .status-cancelada {
          background: #fee2e2;
          color: #b91c1c;
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

export default function OrdensPage() {
  return (
    <Suspense fallback={<div className="p-6">CARREGANDO...</div>}>
      <OrdensPageContent />
    </Suspense>
  );
}