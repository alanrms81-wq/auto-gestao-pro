"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function OrdensPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
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

    const clienteIdParam = searchParams.get("cliente_id");
    if (!clienteIdParam) return;

    carregarDadosDoAgendamento();
  }, [ready, empresaId, clientes, searchParams]);

  async function carregarBase(eid?: string) {
    const emp = eid || empresaId;
    if (!emp) return;

    setLoading(true);

    const [clientesResp, produtosResp, servicosResp, historicoResp] = await Promise.all([
      supabase
        .from("clientes")
        .select("id,nome,telefone,celular,whatsapp,cpf_cnpj")
        .eq("empresa_id", emp)
        .order("nome"),
      supabase
        .from("produtos")
        .select("id,nome,codigo_sku,preco_balcao,controla_estoque,estoque_atual")
        .eq("empresa_id", emp)
        .order("nome"),
      supabase
        .from("servicos")
        .select("id,nome,descricao,categoria,valor,tempo_estimado,observacoes,status")
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

  async function carregarDadosDoAgendamento() {
    const clienteIdParam = searchParams.get("cliente_id") || "";
    const veiculoIdParam = searchParams.get("veiculo_id") || "";
    const agendamentoIdParam = searchParams.get("agendamento_id") || "";

    if (!empresaId || !clienteIdParam) return;

    const cliente = clientes.find((c) => c.id === clienteIdParam);

    if (cliente) {
      setClienteId(cliente.id);
      setClienteNome(cliente.nome);
      setBuscaCliente(cliente.nome);
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
    const q = up(buscaCliente.trim());
    if (!q) return clientes.slice(0, 8);

    return clientes
      .filter((c) =>
        up(`${c.nome} ${c.telefone || ""} ${c.celular || ""} ${c.whatsapp || ""} ${c.cpf_cnpj || ""}`).includes(q)
      )
      .slice(0, 8);
  }, [clientes, buscaCliente]);

  const produtosFiltrados = useMemo(() => {
    const q = up(buscaProduto.trim());
    if (!q || q.length < 3) return [];

    return produtosBase
      .filter((p) => up(`${p.nome} ${p.codigo_sku || ""}`).includes(q))
      .slice(0, 8);
  }, [produtosBase, buscaProduto]);

  const servicosFiltrados = useMemo(() => {
    const q = up(buscaServico.trim());
    if (!q || q.length < 2) return [];

    return servicosBase
      .filter((s) =>
        up(`${s.nome || ""} ${s.descricao || ""} ${s.categoria || ""} ${s.tempo_estimado || ""}`).includes(q)
      )
      .slice(0, 8);
  }, [servicosBase, buscaServico]);

  const historicoFiltrado = useMemo(() => {
    const q = up(buscaHistorico.trim());
    if (!q) return historico;

    return historico.filter((item) =>
      up(
        `${item.numero || ""} ${item.cliente_nome || ""} ${item.veiculo_descricao || ""} ${item.status || ""} ${item.placa || ""}`
      ).includes(q)
    );
  }, [historico, buscaHistorico]);

  const subtotalProdutos = useMemo(() => {
    return produtosOS.reduce((acc, item) => acc + toMoney(item.quantidade) * toMoney(item.valor_unitario), 0);
  }, [produtosOS]);

  const subtotalServicos = useMemo(() => {
    return servicosOS.reduce((acc, item) => acc + toMoney(item.quantidade) * toMoney(item.valor_unitario), 0);
  }, [servicosOS]);

  const totalGeral = useMemo(() => {
    return subtotalProdutos + subtotalServicos - toMoney(desconto) + toMoney(acrescimo);
  }, [subtotalProdutos, subtotalServicos, desconto, acrescimo]);

  function novaOS() {
    setEditingId(null);
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
  }

  async function selecionarCliente(c: Cliente) {
    setClienteId(c.id);
    setClienteNome(c.nome);
    setBuscaCliente(c.nome);

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
        codigo: p.codigo_sku || "",
        quantidade: 1,
        valor_unitario: toMoney(p.preco_balcao),
        subtotal: toMoney(p.preco_balcao),
      },
    ]);
    setBuscaProduto("");
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
  }

  function atualizarProdutoOS(id: string | undefined, campo: keyof OsProduto, valor: any) {
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

  function atualizarServicoOS(id: string | undefined, campo: keyof OsServico, valor: any) {
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
      produto_nome: up(item.produto_nome || ""),
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
      const { error } = await supabase.from("ordens_servico_produtos").insert(produtosPayload);
      if (error) {
        alert("ERRO AO SALVAR PRODUTOS DA OS: " + error.message);
        return;
      }
    }

    if (servicosPayload.length > 0) {
      const { error } = await supabase.from("ordens_servico_servicos").insert(servicosPayload);
      if (error) {
        alert("ERRO AO SALVAR SERVIÇOS DA OS: " + error.message);
        return;
      }
    }

    const agendamentoIdParam = searchParams.get("agendamento_id");

    if (agendamentoIdParam && empresaId) {
      await supabase
        .from("agendamentos")
        .update({
          status: "CONVERTIDO",
        })
        .eq("empresa_id", empresaId)
        .eq("id", agendamentoIdParam);
    }

    alert(editingId ? "OS ATUALIZADA!" : "OS SALVA COM SUCESSO!");
    novaOS();
    carregarBase();
  }

  async function editarOS(item: OrdemServico) {
    if (!empresaId) return;

    setEditingId(item.id);
    setNumeroOS(item.numero || "");
    setClienteId(item.cliente_id || "");
    setClienteNome(item.cliente_nome || "");
    setBuscaCliente(item.cliente_nome || "");

    await carregarVeiculosDoCliente(item.cliente_id || "");

    setVeiculoId(item.veiculo_id || "");
    setVeiculo(item.veiculo_descricao || "");
    setPlaca(item.placa || "");
    setKm(item.km || "");

    setStatus(item.status || "ABERTA");
    setTecnico(item.tecnico_responsavel || "");
    setPrazoData(item.prazo_data || "");
    setGarantiaNumero(item.garantia_numero || "");
    setGarantiaTipo(item.garantia_tipo || "DIAS");
    setFormaPagamento(item.forma_pagamento || "DINHEIRO");
    setDefeitoRelatado(item.defeito_relatado || "");
    setObservacoes(item.observacoes || "");
    setDesconto(String(toMoney(item.desconto)));
    setAcrescimo(String(toMoney(item.acrescimo)));

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

    setProdutosOS((prodResp.data || []).map((p: any) => ({ ...p, id: p.id || makeLocalId() })));
    setServicosOS((servResp.data || []).map((s: any) => ({ ...s, id: s.id || makeLocalId() })));
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
    carregarBase();
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
    carregarBase();
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
    <div className="min-h-screen flex bg-[#F3F4F6]">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-[26px] font-black text-[#6C757D]">
              ORDEM DE SERVIÇO
            </h1>

            <p className="text-sm text-[#6C757D] mt-1">
              NÚMERO: {numeroOS}
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              className="botao"
              onClick={() => editingId && imprimirOS({ id: editingId } as OrdemServico)}
              type="button"
            >
              IMPRESSÃO DE OS
            </button>

            <button
              className="botao"
              onClick={() => editingId && imprimirTecnico({ id: editingId } as OrdemServico)}
              type="button"
            >
              IMPRESSÃO OS TÉCNICOS
            </button>

            <button className="botao-azul" onClick={salvarOS} type="button">
              SALVAR OS
            </button>

            <button className="botao" onClick={novaOS} type="button">
              NOVA OS
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-6">
            <section className="card">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 relative">
                  <label className="label">CLIENTE</label>
                  <input
                    placeholder="DIGITE O NOME, TELEFONE OU DOCUMENTO..."
                    className="campo"
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value)}
                  />

                  {buscaCliente.trim() && clientesFiltrados.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-[#D1D5DB] bg-white shadow-lg max-h-[220px] overflow-auto">
                      {clientesFiltrados.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selecionarCliente(c)}
                          className="w-full text-left px-3 py-3 border-b last:border-b-0 hover:bg-[#F3F4F6]"
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
                  <label className="label">STATUS</label>
                  <select
                    className="campo"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option>ABERTA</option>
                    <option>EM ANDAMENTO</option>
                    <option>FINALIZADA</option>
                    <option>ENTREGUE</option>
                    <option>CANCELADA</option>
                  </select>
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
                  <label className="label">TIPO</label>
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

                <div>
                  <label className="label">PLACA</label>
                  <input
                    className="campo"
                    value={placa}
                    onChange={(e) => setPlaca(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">KM</label>
                  <input
                    className="campo"
                    value={km}
                    onChange={(e) => setKm(e.target.value)}
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="label">DEFEITO RELATADO</label>
                  <textarea
                    className="campo-textarea"
                    value={defeitoRelatado}
                    onChange={(e) => setDefeitoRelatado(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="card">
              <div className="flex justify-between items-center mb-3 gap-3 flex-wrap">
                <h2 className="titulo">PRODUTOS</h2>

                <p className="text-xs text-[#6C757D]">
                  DIGITE 3 LETRAS PARA BUSCAR
                </p>
              </div>

              <div className="relative flex gap-3 mb-3">
                <input
                  placeholder="BUSCAR PRODUTO POR NOME OU CÓDIGO..."
                  className="campo"
                  value={buscaProduto}
                  onChange={(e) => setBuscaProduto(e.target.value)}
                />

                {buscaProduto.trim().length >= 3 && produtosFiltrados.length > 0 && (
                  <div className="absolute top-[48px] left-0 right-0 z-20 rounded-xl border border-[#D1D5DB] bg-white shadow-lg max-h-[220px] overflow-auto">
                    {produtosFiltrados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => adicionarProdutoDoBanco(p)}
                        className="w-full text-left px-3 py-3 border-b last:border-b-0 hover:bg-[#F3F4F6]"
                      >
                        <div className="font-semibold text-[#111827]">{p.nome}</div>
                        <div className="text-xs text-[#6B7280]">
                          {p.codigo_sku || "-"} • {moneyBR(toMoney(p.preco_balcao))}
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
                      <td colSpan={6} className="text-center py-6 text-[#6C757D]">
                        NENHUM PRODUTO ADICIONADO.
                      </td>
                    </tr>
                  ) : (
                    produtosOS.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <input
                            className="campo-tabela"
                            value={item.produto_nome || ""}
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
                        <td>{moneyBR(toMoney(item.quantidade) * toMoney(item.valor_unitario))}</td>
                        <td>
                          <button
                            className="botao-mini"
                            onClick={() => removerProdutoOS(item.id)}
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
            </section>

            <section className="card">
              <div className="flex justify-between items-center mb-3 gap-3 flex-wrap">
                <h2 className="titulo">MÃO DE OBRA / SERVIÇOS</h2>

                <button className="botao" onClick={adicionarServico} type="button">
                  ADICIONAR SERVIÇO MANUAL
                </button>
              </div>

              <div className="relative flex gap-3 mb-4">
                <input
                  placeholder="BUSCAR SERVIÇO CADASTRADO..."
                  className="campo"
                  value={buscaServico}
                  onChange={(e) => setBuscaServico(e.target.value)}
                />

                {buscaServico.trim().length >= 2 && servicosFiltrados.length > 0 && (
                  <div className="absolute top-[48px] left-0 right-0 z-20 rounded-xl border border-[#D1D5DB] bg-white shadow-lg max-h-[220px] overflow-auto">
                    {servicosFiltrados.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => adicionarServicoDoCadastro(s)}
                        className="w-full text-left px-3 py-3 border-b last:border-b-0 hover:bg-[#F3F4F6]"
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
                      <td colSpan={5} className="text-center py-6 text-[#6C757D]">
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
                        <td>{moneyBR(toMoney(item.quantidade) * toMoney(item.valor_unitario))}</td>
                        <td>
                          <button
                            className="botao-mini"
                            onClick={() => removerServicoOS(item.id)}
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
            </section>

            <section className="card">
              <h2 className="titulo mb-3">HISTÓRICO DE ORDENS DE SERVIÇO</h2>

              <input
                placeholder="BUSCAR POR NÚMERO, CLIENTE, VEÍCULO OU STATUS..."
                className="campo mb-3"
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
                      <td colSpan={8} className="text-center py-6 text-[#6C757D]">
                        NENHUMA ORDEM DE SERVIÇO ENCONTRADA.
                      </td>
                    </tr>
                  ) : (
                    historicoFiltrado.map((item) => (
                      <tr key={item.id}>
                        <td>{item.numero || "-"}</td>
                        <td>{item.created_at ? new Date(item.created_at).toLocaleDateString("pt-BR") : "-"}</td>
                        <td>{item.cliente_nome || "-"}</td>
                        <td>{item.veiculo_descricao || "-"}</td>
                        <td>{item.status || "-"}</td>
                        <td>{item.faturado ? "SIM" : "NÃO"}</td>
                        <td>{moneyBR(toMoney(item.total))}</td>
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
                            <button className="botao-mini" onClick={() => faturarOS(item)} type="button">
                              FATURAR
                            </button>
                            <button className="botao-mini" onClick={() => removerOS(item.id)} type="button">
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
            <section className="card">
              <h2 className="titulo mb-4">RESUMO DA OS</h2>

              <div className="space-y-2 text-sm text-[#1F1F1F]">
                <p><b>CLIENTE:</b> {clienteNome || "-"}</p>
                <p><b>VEÍCULO:</b> {veiculo || "-"}</p>
                <p><b>PLACA:</b> {placa || "-"}</p>
                <p><b>KM:</b> {km || "-"}</p>
                <p><b>TÉCNICO:</b> {tecnico || "-"}</p>
                <p><b>PRAZO:</b> {prazoData || "-"}</p>
                <p><b>GARANTIA:</b> {garantiaNumero ? `${garantiaNumero} ${garantiaTipo}` : "-"}</p>
                <p><b>PAGAMENTO:</b> {formaPagamento}</p>
                <p><b>STATUS:</b> {status}</p>
              </div>
            </section>

            <section className="card">
              <h2 className="titulo mb-4">TOTAIS</h2>

              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>PRODUTOS</span>
                  <span className="font-semibold">{moneyBR(subtotalProdutos)}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span>MÃO DE OBRA</span>
                  <span className="font-semibold">{moneyBR(subtotalServicos)}</span>
                </div>

                <div>
                  <label className="label">DESCONTO</label>
                  <input
                    className="campo"
                    type="number"
                    value={desconto}
                    onChange={(e) => setDesconto(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">ACRÉSCIMO</label>
                  <input
                    className="campo"
                    type="number"
                    value={acrescimo}
                    onChange={(e) => setAcrescimo(e.target.value)}
                  />
                </div>

                <div className="flex justify-between text-[16px] font-black text-[#0456A3]">
                  <span>TOTAL GERAL</span>
                  <span>{moneyBR(totalGeral)}</span>
                </div>
              </div>
            </section>

            <section className="card">
              <h2 className="titulo mb-3">OBSERVAÇÕES</h2>

              <textarea
                className="campo-textarea"
                placeholder="DESCREVA O SERVIÇO, DEFEITO, CONDIÇÕES DE ENTRADA, PEÇAS TROCADAS, ETC."
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
          min-height: 150px;
          background: white;
          color: #111827;
        }

        .campo-tabela {
          width: 100%;
          height: 36px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 0 8px;
          font-size: 13px;
          color: #111827;
          background: white;
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