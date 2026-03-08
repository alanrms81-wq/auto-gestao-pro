"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { canAccess, isLogged } from "@/lib/authGuard";

type Cliente = {
  id: number;
  nome: string;
  telefone?: string;
  email?: string;
  cpfCnpj?: string;
  cidade?: string;
  estado?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
};

type Veiculo = {
  id: number;
  clienteId: number;
  placa?: string;
  marca?: string;
  modelo?: string;
  ano?: string;
  cor?: string;
  combustivel?: string;
  km?: string;
  chassi?: string;
  observacoes?: string;
  status?: "ATIVO" | "INATIVO";
};

type Produto = {
  id: number;
  nome: string;
  sku?: string;
  codigoSku?: string;
  preco?: number;
  precoVenda?: number;
  precoBalcao?: number;
  precoInstalacao?: number;
  precoRevenda?: number;
  estoqueAtual?: number;
  controlaEstoque?: boolean;
  status?: "ATIVO" | "INATIVO";
};

type OsProdutoItem = {
  id: number;
  produtoId: number | null;
  nome: string;
  codigo?: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
};

type OsServicoItem = {
  id: number;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
};

type OrdemServico = {
  id: number;
  numero: string;
  dataISO: string;
  clienteId: number | null;
  clienteNome: string;
  clienteTelefone?: string;
  veiculoId: number | null;
  veiculoDescricao: string;
  tecnico: string;
  prazo?: string;
  status: "ABERTA" | "EM ANDAMENTO" | "FINALIZADA" | "ENTREGUE";
  garantiaNumero?: string;
  garantiaTipo?: "DIAS" | "MESES";
  formaPagamento: string;
  produtos: OsProdutoItem[];
  servicos: OsServicoItem[];
  subtotalProdutos: number;
  subtotalServicos: number;
  desconto: number;
  total: number;
  observacoes?: string;
  faturado?: boolean;
  dataFaturamento?: string;
  financeiroGeradoId?: number | null;
  estoqueBaixado?: boolean;
};

type FinanceiroTitulo = {
  id: number;
  tipo: "RECEBER" | "PAGAR";
  descricao: string;
  categoria: string;
  clienteId?: number | null;
  clienteNome?: string;
  documento?: string;
  formaPagamento?: string;
  valorOriginal: number;
  valorPago: number;
  desconto: number;
  juros: number;
  multa: number;
  dataEmissao?: string;
  dataVencimento?: string;
  dataPagamento?: string;
  status: string;
  observacoes?: string;
  createdAt: string;
};

type FluxoLancamento = {
  id: number;
  tipo: "ENTRADA" | "SAIDA";
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  origem?: string;
  observacoes?: string;
};

const LS_CLIENTES = "clientes";
const LS_VEICULOS = "veiculos";
const LS_PRODUTOS = "produtos";
const LS_ORDENS = "ordensServico";
const LS_TITULOS = "financeiro_titulos";
const LS_FLUXO = "financeiro_lancamentos";

function up(v: any) {
  return String(v ?? "").toUpperCase();
}

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLS<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
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

function nextOsNumero(lista?: OrdemServico[]) {
  const base = lista || readLS<OrdemServico[]>(LS_ORDENS, []);
  if (!base.length) return "OS-000001";

  let maior = 0;
  for (const item of base) {
    const m = String(item.numero || "").match(/\d+/);
    const n = m ? Number(m[0]) : 0;
    if (n > maior) maior = n;
  }

  return `OS-${String(maior + 1).padStart(6, "0")}`;
}

function getPrecoProduto(p: Produto) {
  return (
    toMoney(p.precoInstalacao) ||
    toMoney(p.precoBalcao) ||
    toMoney(p.precoVenda) ||
    toMoney(p.precoRevenda) ||
    toMoney(p.preco) ||
    0
  );
}

function pagamentoImediato(fp: string) {
  const x = up(fp);
  return (
    x === "DINHEIRO" ||
    x === "PIX" ||
    x === "CARTÃO DE DÉBITO" ||
    x === "CARTAO DE DEBITO"
  );
}

export default function OrdensPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [historico, setHistorico] = useState<OrdemServico[]>([]);

  const [editingId, setEditingId] = useState<number | null>(null);

  const [numeroOs, setNumeroOs] = useState("");
  const [status, setStatus] = useState<
    "ABERTA" | "EM ANDAMENTO" | "FINALIZADA" | "ENTREGUE"
  >("ABERTA");

  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteId, setClienteId] = useState<number | null>(null);

  const [buscaVeiculo, setBuscaVeiculo] = useState("");
  const [veiculoId, setVeiculoId] = useState<number | null>(null);

  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtosItens, setProdutosItens] = useState<OsProdutoItem[]>([]);
  const [servicosItens, setServicosItens] = useState<OsServicoItem[]>([]);

  const [tecnico, setTecnico] = useState("");
  const [prazo, setPrazo] = useState("");
  const [garantiaNumero, setGarantiaNumero] = useState("");
  const [garantiaTipo, setGarantiaTipo] = useState<"DIAS" | "MESES">("DIAS");
  const [formaPagamento, setFormaPagamento] = useState("DINHEIRO");
  const [desconto, setDesconto] = useState("0");
  const [observacoes, setObservacoes] = useState("");

  const [buscaHistorico, setBuscaHistorico] = useState("");

  const clienteBoxRef = useRef<HTMLDivElement | null>(null);
  const veiculoBoxRef = useRef<HTMLDivElement | null>(null);
  const produtoBoxRef = useRef<HTMLDivElement | null>(null);

  const [openClientes, setOpenClientes] = useState(false);
  const [openVeiculos, setOpenVeiculos] = useState(false);
  const [openProdutos, setOpenProdutos] = useState(false);

  useEffect(() => {
    if (!isLogged()) {
      router.push("/login");
      return;
    }

    if (!canAccess("ORDENS")) {
      alert("ACESSO NEGADO");
      router.push("/dashboard");
      return;
    }

    carregarBase();
    setReady(true);
  }, [router]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (clienteBoxRef.current && !clienteBoxRef.current.contains(target)) {
        setOpenClientes(false);
      }
      if (veiculoBoxRef.current && !veiculoBoxRef.current.contains(target)) {
        setOpenVeiculos(false);
      }
      if (produtoBoxRef.current && !produtoBoxRef.current.contains(target)) {
        setOpenProdutos(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function carregarBase() {
    const listaOs = readLS<OrdemServico[]>(LS_ORDENS, []);
    setClientes(readLS<Cliente[]>(LS_CLIENTES, []));
    setVeiculos(readLS<Veiculo[]>(LS_VEICULOS, []));
    setProdutos(readLS<Produto[]>(LS_PRODUTOS, []));
    setHistorico(listaOs);
    setNumeroOs(nextOsNumero(listaOs));
  }

  const clienteSelecionado = useMemo(() => {
    return clientes.find((c) => c.id === clienteId) || null;
  }, [clientes, clienteId]);

  const veiculosDoCliente = useMemo(() => {
    if (!clienteId) return [];
    return veiculos.filter((v) => v.clienteId === clienteId);
  }, [veiculos, clienteId]);

  const veiculoSelecionado = useMemo(() => {
    return veiculos.find((v) => v.id === veiculoId) || null;
  }, [veiculos, veiculoId]);

  const clientesSugestao = useMemo(() => {
    const q = up(buscaCliente.trim());
    if (q.length < 2) return [];

    return clientes
      .filter((c) => {
        const texto = up(
          `${c.nome} ${c.telefone || ""} ${c.email || ""} ${c.cpfCnpj || ""}`
        );
        return texto.includes(q);
      })
      .slice(0, 10);
  }, [clientes, buscaCliente]);

  const veiculosSugestao = useMemo(() => {
    const q = up(buscaVeiculo.trim());
    const base = veiculosDoCliente;

    if (!q) return base.slice(0, 10);

    return base
      .filter((v) => {
        const texto = up(
          `${v.placa || ""} ${v.marca || ""} ${v.modelo || ""} ${v.ano || ""}`
        );
        return texto.includes(q);
      })
      .slice(0, 10);
  }, [veiculosDoCliente, buscaVeiculo]);

  const produtosSugestao = useMemo(() => {
    const q = up(buscaProduto.trim());
    if (q.length < 3) return [];

    return produtos
      .filter((p) => (p.status || "ATIVO") !== "INATIVO")
      .filter((p) => {
        const texto = up(`${p.nome} ${p.sku || ""} ${p.codigoSku || ""}`);
        return texto.includes(q);
      })
      .slice(0, 12);
  }, [produtos, buscaProduto]);

  const subtotalProdutos = useMemo(
    () => produtosItens.reduce((acc, item) => acc + toMoney(item.total), 0),
    [produtosItens]
  );

  const subtotalServicos = useMemo(
    () => servicosItens.reduce((acc, item) => acc + toMoney(item.total), 0),
    [servicosItens]
  );

  const totalGeral = useMemo(
    () => Math.max(0, subtotalProdutos + subtotalServicos - toMoney(desconto)),
    [subtotalProdutos, subtotalServicos, desconto]
  );

  const historicoFiltrado = useMemo(() => {
    const q = up(buscaHistorico.trim());

    return [...historico]
      .sort((a, b) => (b.dataISO || "").localeCompare(a.dataISO || ""))
      .filter((os) => {
        if (!q) return true;
        const texto = up(
          `${os.numero} ${os.clienteNome} ${os.veiculoDescricao} ${os.status} ${os.tecnico || ""}`
        );
        return texto.includes(q);
      });
  }, [historico, buscaHistorico]);

  function selecionarCliente(c: Cliente) {
    setClienteId(c.id);
    setBuscaCliente(c.nome);
    setOpenClientes(false);
    setVeiculoId(null);
    setBuscaVeiculo("");
  }

  function selecionarVeiculo(v: Veiculo) {
    setVeiculoId(v.id);
    setBuscaVeiculo(
      up(`${v.marca || ""} ${v.modelo || ""} ${v.placa ? `- ${v.placa}` : ""}`)
    );
    setOpenVeiculos(false);
  }

  function adicionarProduto(p: Produto) {
    const preco = getPrecoProduto(p);

    const item: OsProdutoItem = {
      id: Date.now(),
      produtoId: p.id,
      nome: up(p.nome),
      codigo: up(p.codigoSku || p.sku || ""),
      quantidade: 1,
      valorUnitario: preco,
      total: preco,
    };

    setProdutosItens((prev) => [...prev, item]);
    setBuscaProduto("");
    setOpenProdutos(false);
  }

  function atualizarProdutoItem(
    id: number,
    campo: "nome" | "codigo" | "quantidade" | "valorUnitario",
    valor: string | number
  ) {
    setProdutosItens((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const next = {
          ...item,
          [campo]:
            campo === "nome" || campo === "codigo" ? String(valor) : Number(valor),
        };

        next.total = toMoney(next.quantidade) * toMoney(next.valorUnitario);
        return next;
      })
    );
  }

  function removerProdutoItem(id: number) {
    setProdutosItens((prev) => prev.filter((item) => item.id !== id));
  }

  function adicionarServico() {
    const item: OsServicoItem = {
      id: Date.now(),
      descricao: "",
      quantidade: 1,
      valorUnitario: 0,
      total: 0,
    };

    setServicosItens((prev) => [...prev, item]);
  }

  function atualizarServicoItem(
    id: number,
    campo: "descricao" | "quantidade" | "valorUnitario",
    valor: string | number
  ) {
    setServicosItens((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const next = {
          ...item,
          [campo]: campo === "descricao" ? String(valor) : Number(valor),
        };

        next.total = toMoney(next.quantidade) * toMoney(next.valorUnitario);
        return next;
      })
    );
  }

  function removerServicoItem(id: number) {
    setServicosItens((prev) => prev.filter((item) => item.id !== id));
  }

  function limparOs() {
    const listaOs = readLS<OrdemServico[]>(LS_ORDENS, []);
    setEditingId(null);
    setNumeroOs(nextOsNumero(listaOs));
    setStatus("ABERTA");
    setBuscaCliente("");
    setClienteId(null);
    setBuscaVeiculo("");
    setVeiculoId(null);
    setBuscaProduto("");
    setProdutosItens([]);
    setServicosItens([]);
    setTecnico("");
    setPrazo("");
    setGarantiaNumero("");
    setGarantiaTipo("DIAS");
    setFormaPagamento("DINHEIRO");
    setDesconto("0");
    setObservacoes("");
  }

  function salvarOs() {
    if (!clienteSelecionado) {
      alert("SELECIONE UM CLIENTE.");
      return;
    }

    if (!veiculoSelecionado) {
      alert("SELECIONE UM VEÍCULO.");
      return;
    }

    if (!produtosItens.length && !servicosItens.length) {
      alert("ADICIONE PRODUTOS OU MÃO DE OBRA.");
      return;
    }

    const listaOs = readLS<OrdemServico[]>(LS_ORDENS, []);
    const osAntiga = editingId ? listaOs.find((x) => x.id === editingId) : null;

    const nova: OrdemServico = {
      id: editingId || Date.now(),
      numero: numeroOs,
      dataISO: osAntiga?.dataISO || new Date().toISOString(),
      clienteId: clienteSelecionado.id,
      clienteNome: clienteSelecionado.nome,
      clienteTelefone: clienteSelecionado.telefone || "",
      veiculoId: veiculoSelecionado.id,
      veiculoDescricao: up(
        `${veiculoSelecionado.marca || ""} ${veiculoSelecionado.modelo || ""} ${
          veiculoSelecionado.placa ? `- ${veiculoSelecionado.placa}` : ""
        }`
      ),
      tecnico: up(tecnico),
      prazo,
      status,
      garantiaNumero,
      garantiaTipo,
      formaPagamento: up(formaPagamento),
      produtos: produtosItens.map((p) => ({
        ...p,
        nome: up(p.nome),
        codigo: up(p.codigo || ""),
        quantidade: toMoney(p.quantidade),
        valorUnitario: toMoney(p.valorUnitario),
        total: toMoney(p.total),
      })),
      servicos: servicosItens.map((s) => ({
        ...s,
        descricao: up(s.descricao),
        quantidade: toMoney(s.quantidade),
        valorUnitario: toMoney(s.valorUnitario),
        total: toMoney(s.total),
      })),
      subtotalProdutos,
      subtotalServicos,
      desconto: toMoney(desconto),
      total: totalGeral,
      observacoes: up(observacoes),
      faturado: osAntiga?.faturado || false,
      dataFaturamento: osAntiga?.dataFaturamento || "",
      financeiroGeradoId: osAntiga?.financeiroGeradoId || null,
      estoqueBaixado: osAntiga?.estoqueBaixado || false,
    };

    const next = editingId
      ? listaOs.map((x) => (x.id === editingId ? nova : x))
      : [...listaOs, nova];

    writeLS(LS_ORDENS, next);
    setHistorico(next);
    alert(editingId ? "ORDEM DE SERVIÇO ATUALIZADA!" : "ORDEM DE SERVIÇO SALVA!");
    limparOs();
  }

  function carregarOs(os: OrdemServico) {
    setEditingId(os.id);
    setNumeroOs(os.numero);
    setStatus(os.status);
    setClienteId(os.clienteId);
    setBuscaCliente(os.clienteNome || "");
    setVeiculoId(os.veiculoId);
    setBuscaVeiculo(os.veiculoDescricao || "");
    setProdutosItens(os.produtos || []);
    setServicosItens(os.servicos || []);
    setTecnico(os.tecnico || "");
    setPrazo(os.prazo || "");
    setGarantiaNumero(os.garantiaNumero || "");
    setGarantiaTipo(os.garantiaTipo || "DIAS");
    setFormaPagamento(os.formaPagamento || "DINHEIRO");
    setDesconto(String(toMoney(os.desconto)));
    setObservacoes(os.observacoes || "");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removerOs(id: number) {
    const listaOs = readLS<OrdemServico[]>(LS_ORDENS, []);
    const alvo = listaOs.find((x) => x.id === id);

    if (alvo?.faturado) {
      alert("ESSA OS JÁ FOI FATURADA. REMOVA MANUALMENTE O FINANCEIRO ANTES, SE NECESSÁRIO.");
      return;
    }

    if (!confirm("REMOVER ESTA ORDEM DE SERVIÇO?")) return;

    const next = listaOs.filter((x) => x.id !== id);
    writeLS(LS_ORDENS, next);
    setHistorico(next);

    if (editingId === id) {
      limparOs();
    }

    alert("ORDEM DE SERVIÇO REMOVIDA!");
  }

  function montarHtmlImpressao(modoTecnico: boolean, os?: OrdemServico) {
    const base = os || {
      numero: numeroOs,
      clienteNome: clienteSelecionado?.nome || "-",
      clienteTelefone: clienteSelecionado?.telefone || "-",
      veiculoDescricao: veiculoSelecionado
        ? up(
            `${veiculoSelecionado.marca || ""} ${veiculoSelecionado.modelo || ""} ${
              veiculoSelecionado.placa ? `- ${veiculoSelecionado.placa}` : ""
            }`
          )
        : "-",
      status,
      tecnico: up(tecnico || "-"),
      prazo,
      garantiaNumero,
      garantiaTipo,
      formaPagamento: up(formaPagamento),
      produtos: produtosItens,
      servicos: servicosItens,
      subtotalProdutos,
      subtotalServicos,
      desconto: toMoney(desconto),
      total: totalGeral,
      observacoes: up(observacoes || "-"),
      faturado: false,
    };

    const produtosRows = (base.produtos || [])
      .map((item: OsProdutoItem) => {
        return `
          <tr>
            <td>${item.nome}</td>
            <td>${item.codigo || "-"}</td>
            <td style="text-align:right;">${item.quantidade}</td>
            ${
              modoTecnico
                ? ""
                : `<td style="text-align:right;">${moneyBR(item.valorUnitario)}</td>
                   <td style="text-align:right;">${moneyBR(item.total)}</td>`
            }
          </tr>
        `;
      })
      .join("");

    const servicosRows = (base.servicos || [])
      .map((item: OsServicoItem) => {
        return `
          <tr>
            <td>${item.descricao || "-"}</td>
            <td style="text-align:right;">${item.quantidade}</td>
            ${
              modoTecnico
                ? ""
                : `<td style="text-align:right;">${moneyBR(item.valorUnitario)}</td>
                   <td style="text-align:right;">${moneyBR(item.total)}</td>`
            }
          </tr>
        `;
      })
      .join("");

    return `
      <html>
        <head>
          <title>${base.numero}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1,h2,h3 { margin: 0 0 10px 0; }
            .topo { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0A569E; padding-bottom:12px; margin-bottom:18px; }
            .tag { background:#0A569E; color:#fff; padding:8px 14px; border-radius:999px; font-weight:bold; font-size:12px; }
            .bloco { border:1px solid #ddd; border-radius:12px; padding:12px; margin-bottom:14px; }
            .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
            .muted { color:#666; font-size:12px; }
            table { width:100%; border-collapse:collapse; margin-top:8px; }
            th,td { border-bottom:1px solid #eee; padding:8px; font-size:12px; text-align:left; }
            th { background:#f5f5f5; }
            .totais { width:320px; margin-left:auto; margin-top:14px; }
            .linha-total { display:flex; justify-content:space-between; padding:6px 0; font-size:13px; }
            .final { font-weight:900; font-size:16px; border-top:2px solid #111; margin-top:6px; padding-top:8px; }
            .assinaturas { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:40px; }
            .assinatura { border-top:1px solid #999; padding-top:8px; text-align:center; font-size:12px; }
          </style>
        </head>
        <body>
          <div class="topo">
            <div>
              <h1>AUTO GESTÃO PRÓ</h1>
              <div class="muted">ORDEM DE SERVIÇO</div>
            </div>
            <div style="text-align:right;">
              <div class="tag">${modoTecnico ? "IMPRESSÃO TÉCNICOS" : "ORDEM DE SERVIÇO"}</div>
              <div style="margin-top:10px;font-weight:bold;">${base.numero}</div>
              <div class="muted">${new Date().toLocaleString("pt-BR")}</div>
            </div>
          </div>

          <div class="bloco grid-2">
            <div>
              <div class="muted">CLIENTE</div>
              <div><b>${base.clienteNome || "-"}</b></div>
              <div>Telefone: ${base.clienteTelefone || "-"}</div>
            </div>
            <div>
              <div class="muted">VEÍCULO</div>
              <div><b>${base.veiculoDescricao || "-"}</b></div>
              <div>Status: ${base.status || "-"}</div>
              <div>Técnico: ${base.tecnico || "-"}</div>
            </div>
          </div>

          <div class="bloco grid-2">
            <div><div class="muted">PRAZO</div><div>${base.prazo || "-"}</div></div>
            <div><div class="muted">GARANTIA</div><div>${base.garantiaNumero || "-"} ${base.garantiaNumero ? base.garantiaTipo || "" : ""}</div></div>
          </div>

          <div class="bloco">
            <h3>PRODUTOS</h3>
            <table>
              <thead>
                <tr>
                  <th>DESCRIÇÃO</th>
                  <th>CÓDIGO</th>
                  <th style="text-align:right;">QTD</th>
                  ${
                    modoTecnico
                      ? ""
                      : '<th style="text-align:right;">V. UNIT.</th><th style="text-align:right;">TOTAL</th>'
                  }
                </tr>
              </thead>
              <tbody>
                ${produtosRows || '<tr><td colspan="5">NENHUM PRODUTO</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="bloco">
            <h3>MÃO DE OBRA / SERVIÇOS</h3>
            <table>
              <thead>
                <tr>
                  <th>DESCRIÇÃO</th>
                  <th style="text-align:right;">QTD</th>
                  ${
                    modoTecnico
                      ? ""
                      : '<th style="text-align:right;">V. UNIT.</th><th style="text-align:right;">TOTAL</th>'
                  }
                </tr>
              </thead>
              <tbody>
                ${servicosRows || '<tr><td colspan="4">NENHUM SERVIÇO</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="bloco">
            <h3>OBSERVAÇÕES</h3>
            <div>${base.observacoes || "-"}</div>
          </div>

          ${
            modoTecnico
              ? ""
              : `
            <div class="totais">
              <div class="linha-total"><span>SUBTOTAL PRODUTOS</span><b>${moneyBR(toMoney(base.subtotalProdutos || 0))}</b></div>
              <div class="linha-total"><span>SUBTOTAL MÃO DE OBRA</span><b>${moneyBR(toMoney(base.subtotalServicos || 0))}</b></div>
              <div class="linha-total"><span>DESCONTO</span><b>${moneyBR(toMoney(base.desconto || 0))}</b></div>
              <div class="linha-total final"><span>TOTAL GERAL</span><b>${moneyBR(toMoney(base.total || 0))}</b></div>
            </div>
          `
          }

          <div class="assinaturas">
            <div class="assinatura">ASSINATURA DO CLIENTE</div>
            <div class="assinatura">ASSINATURA DO RESPONSÁVEL</div>
          </div>

          <script>window.onload = function(){ window.print(); }</script>
        </body>
      </html>
    `;
  }

  function imprimirOs(modoTecnico: boolean, os?: OrdemServico) {
    const base = os || null;

    if (!base && !clienteSelecionado) {
      alert("SELECIONE UM CLIENTE.");
      return;
    }

    if (!base && !veiculoSelecionado) {
      alert("SELECIONE UM VEÍCULO.");
      return;
    }

    if (!base && !produtosItens.length && !servicosItens.length) {
      alert("ADICIONE PRODUTOS OU SERVIÇOS.");
      return;
    }

    const w = window.open("", "_blank", "width=1000,height=900");
    if (!w) {
      alert("LIBERE POPUP PARA IMPRIMIR.");
      return;
    }

    w.document.open();
    w.document.write(montarHtmlImpressao(modoTecnico, os));
    w.document.close();
  }

  function faturarOs(id: number) {
    const listaOs = readLS<OrdemServico[]>(LS_ORDENS, []);
    const listaProdutos = readLS<Produto[]>(LS_PRODUTOS, []);
    const titulos = readLS<FinanceiroTitulo[]>(LS_TITULOS, []);
    const fluxo = readLS<FluxoLancamento[]>(LS_FLUXO, []);

    const os = listaOs.find((x) => x.id === id);

    if (!os) {
      alert("OS NÃO ENCONTRADA.");
      return;
    }

    if (os.faturado) {
      alert("ESSA OS JÁ FOI FATURADA.");
      return;
    }

    const produtosAtualizados = listaProdutos.map((p) => {
      const item = os.produtos.find((i) => i.produtoId === p.id);
      if (!item) return p;
      if (!p.controlaEstoque) return p;

      return {
        ...p,
        estoqueAtual: Math.max(
          0,
          toMoney(p.estoqueAtual) - toMoney(item.quantidade)
        ),
      };
    });

    writeLS(LS_PRODUTOS, produtosAtualizados);

    const ehPagoNaHora = pagamentoImediato(os.formaPagamento);
    const tituloId = Date.now() + 100;

    const titulo: FinanceiroTitulo = {
      id: tituloId,
      tipo: "RECEBER",
      descricao: up(`OS ${os.numero}`),
      categoria: "ORDEM DE SERVIÇO",
      clienteId: os.clienteId,
      clienteNome: os.clienteNome,
      documento: os.numero,
      formaPagamento: os.formaPagamento,
      valorOriginal: toMoney(os.total),
      valorPago: ehPagoNaHora ? toMoney(os.total) : 0,
      desconto: 0,
      juros: 0,
      multa: 0,
      dataEmissao: new Date().toISOString().slice(0, 10),
      dataVencimento: os.prazo || new Date().toISOString().slice(0, 10),
      dataPagamento: ehPagoNaHora ? new Date().toISOString().slice(0, 10) : "",
      status: ehPagoNaHora ? "PAGO" : "ABERTO",
      observacoes: os.observacoes || "",
      createdAt: new Date().toISOString(),
    };

    writeLS(LS_TITULOS, [...titulos, titulo]);

    if (ehPagoNaHora) {
      const lancamento: FluxoLancamento = {
        id: Date.now() + 200,
        tipo: "ENTRADA",
        descricao: up(`RECEBIMENTO OS ${os.numero}`),
        categoria: "ORDEM DE SERVIÇO",
        valor: toMoney(os.total),
        data: new Date().toISOString().slice(0, 10),
        origem: "OS",
        observacoes: up(os.clienteNome),
      };

      writeLS(LS_FLUXO, [...fluxo, lancamento]);
    }

    const nextOs = listaOs.map((x) =>
      x.id === id
        ? {
            ...x,
            status: "ENTREGUE" as const,
            faturado: true,
            estoqueBaixado: true,
            dataFaturamento: new Date().toISOString(),
            financeiroGeradoId: tituloId,
          }
        : x
    );

    writeLS(LS_ORDENS, nextOs);
    setHistorico(nextOs);
    setProdutos(produtosAtualizados);

    if (editingId === id) {
      setStatus("ENTREGUE");
    }

    alert("OS ENTREGUE E FATURADA COM SUCESSO!");
  }

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F8F9FA]">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#6C757D]">
              ORDEM DE SERVIÇO
            </h1>
            <div className="text-sm text-[#6C757D]">
              NÚMERO: {numeroOs} {editingId ? "• MODO EDIÇÃO" : ""}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => imprimirOs(false)}
              className="border px-4 py-2 rounded-lg hover:bg-white"
              type="button"
            >
              IMPRESSÃO DE OS
            </button>

            <button
              onClick={() => imprimirOs(true)}
              className="border px-4 py-2 rounded-lg hover:bg-white"
              type="button"
            >
              IMPRESSÃO OS TÉCNICOS
            </button>

            <button
              onClick={salvarOs}
              className="bg-[#0A569E] text-white px-4 py-2 rounded-lg"
              type="button"
            >
              {editingId ? "ATUALIZAR OS" : "SALVAR OS"}
            </button>

            <button
              onClick={limparOs}
              className="border px-4 py-2 rounded-lg"
              type="button"
            >
              NOVA OS
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
          <section className="2xl:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2" ref={clienteBoxRef}>
                  <div className="text-xs font-bold text-[#6C757D] mb-1">CLIENTE</div>
                  <input
                    value={buscaCliente}
                    onChange={(e) => {
                      setBuscaCliente(e.target.value);
                      setOpenClientes(true);
                    }}
                    onFocus={() => setOpenClientes(true)}
                    placeholder="DIGITE O NOME, TELEFONE OU DOCUMENTO..."
                    className="border p-2 rounded w-full"
                  />

                  {openClientes && clientesSugestao.length > 0 && (
                    <div className="border rounded-lg bg-white mt-1 max-h-60 overflow-auto">
                      {clientesSugestao.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selecionarCliente(c)}
                          className="w-full text-left px-3 py-2 hover:bg-[#F8F9FA] border-b last:border-b-0"
                        >
                          <div className="font-bold">{c.nome}</div>
                          <div className="text-xs text-[#6C757D]">
                            {c.telefone || "-"}{" "}
                            {c.cidade ? `— ${c.cidade}/${c.estado || ""}` : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div ref={veiculoBoxRef}>
                  <div className="text-xs font-bold text-[#6C757D] mb-1">VEÍCULO</div>
                  <input
                    value={buscaVeiculo}
                    onChange={(e) => {
                      setBuscaVeiculo(e.target.value);
                      setOpenVeiculos(true);
                    }}
                    onFocus={() => setOpenVeiculos(true)}
                    placeholder="PLACA, MARCA, MODELO..."
                    className="border p-2 rounded w-full"
                    disabled={!clienteId}
                  />

                  {openVeiculos && veiculosSugestao.length > 0 && (
                    <div className="border rounded-lg bg-white mt-1 max-h-60 overflow-auto">
                      {veiculosSugestao.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => selecionarVeiculo(v)}
                          className="w-full text-left px-3 py-2 hover:bg-[#F8F9FA] border-b last:border-b-0"
                        >
                          <div className="font-bold">
                            {up(v.marca || "")} {up(v.modelo || "")}
                          </div>
                          <div className="text-xs text-[#6C757D]">
                            {up(v.placa || "-")} {v.ano ? `— ${v.ano}` : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs font-bold text-[#6C757D] mb-1">STATUS</div>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(
                        e.target.value as
                          | "ABERTA"
                          | "EM ANDAMENTO"
                          | "FINALIZADA"
                          | "ENTREGUE"
                      )
                    }
                    className="border p-2 rounded w-full bg-white"
                  >
                    <option>ABERTA</option>
                    <option>EM ANDAMENTO</option>
                    <option>FINALIZADA</option>
                    <option>ENTREGUE</option>
                  </select>
                </div>

                <div>
                  <div className="text-xs font-bold text-[#6C757D] mb-1">TÉCNICO / RESPONSÁVEL</div>
                  <input
                    value={tecnico}
                    onChange={(e) => setTecnico(e.target.value)}
                    className="border p-2 rounded w-full"
                    placeholder="NOME DO RESPONSÁVEL"
                  />
                </div>

                <div>
                  <div className="text-xs font-bold text-[#6C757D] mb-1">PRAZO</div>
                  <input
                    type="date"
                    value={prazo}
                    onChange={(e) => setPrazo(e.target.value)}
                    className="border p-2 rounded w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs font-bold text-[#6C757D] mb-1">GARANTIA</div>
                    <input
                      value={garantiaNumero}
                      onChange={(e) => setGarantiaNumero(e.target.value)}
                      className="border p-2 rounded w-full"
                      placeholder="NÚMERO"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#6C757D] mb-1">TIPO</div>
                    <select
                      value={garantiaTipo}
                      onChange={(e) => setGarantiaTipo(e.target.value as "DIAS" | "MESES")}
                      className="border p-2 rounded w-full bg-white"
                    >
                      <option value="DIAS">DIAS</option>
                      <option value="MESES">MESES</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-[#6C757D] mb-1">FORMA DE PAGAMENTO</div>
                  <select
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                    className="border p-2 rounded w-full bg-white"
                  >
                    <option>DINHEIRO</option>
                    <option>PIX</option>
                    <option>CARTÃO DE DÉBITO</option>
                    <option>CARTÃO DE CRÉDITO</option>
                    <option>BOLETO</option>
                    <option>TRANSFERÊNCIA</option>
                    <option>A PRAZO</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-4" ref={produtoBoxRef}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-[#6C757D]">PRODUTOS</div>
                <div className="text-xs text-[#6C757D]">DIGITE 3 LETRAS PARA BUSCAR</div>
              </div>

              <input
                value={buscaProduto}
                onChange={(e) => {
                  setBuscaProduto(e.target.value);
                  setOpenProdutos(true);
                }}
                onFocus={() => setOpenProdutos(true)}
                placeholder="BUSCAR PRODUTO POR NOME OU CÓDIGO..."
                className="border p-2 rounded w-full"
              />

              {openProdutos && produtosSugestao.length > 0 && (
                <div className="border rounded-lg bg-white mt-2 max-h-72 overflow-auto">
                  {produtosSugestao.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => adicionarProduto(p)}
                      className="w-full text-left px-3 py-2 hover:bg-[#F8F9FA] border-b last:border-b-0"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <div className="font-bold">{up(p.nome)}</div>
                          <div className="text-xs text-[#6C757D]">
                            {up(p.codigoSku || p.sku || "-")}{" "}
                            {p.controlaEstoque ? `— ESTOQUE: ${toMoney(p.estoqueAtual)}` : ""}
                          </div>
                        </div>
                        <div className="font-bold text-[#0A569E]">
                          {moneyBR(getPrecoProduto(p))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F8F9FA]">
                    <tr>
                      <th className="p-2 text-left">PRODUTO</th>
                      <th className="p-2 text-left">CÓDIGO</th>
                      <th className="p-2 text-right">QTD</th>
                      <th className="p-2 text-right">V. UNIT.</th>
                      <th className="p-2 text-right">TOTAL</th>
                      <th className="p-2 text-right">AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtosItens.length === 0 ? (
                      <tr>
                        <td className="p-4 text-[#6C757D]" colSpan={6}>
                          NENHUM PRODUTO ADICIONADO.
                        </td>
                      </tr>
                    ) : (
                      produtosItens.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-2">
                            <input
                              value={item.nome}
                              onChange={(e) =>
                                atualizarProdutoItem(item.id, "nome", e.target.value)
                              }
                              className="border p-2 rounded w-full"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              value={item.codigo || ""}
                              onChange={(e) =>
                                atualizarProdutoItem(item.id, "codigo", e.target.value)
                              }
                              className="border p-2 rounded w-full"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantidade}
                              onChange={(e) =>
                                atualizarProdutoItem(
                                  item.id,
                                  "quantidade",
                                  Number(e.target.value)
                                )
                              }
                              className="border p-2 rounded w-24 text-right"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.valorUnitario}
                              onChange={(e) =>
                                atualizarProdutoItem(
                                  item.id,
                                  "valorUnitario",
                                  Number(e.target.value)
                                )
                              }
                              className="border p-2 rounded w-32 text-right"
                            />
                          </td>
                          <td className="p-2 text-right font-bold">
                            {moneyBR(item.total)}
                          </td>
                          <td className="p-2 text-right">
                            <button
                              onClick={() => removerProdutoItem(item.id)}
                              className="border px-3 py-1 rounded"
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

            <div className="bg-white rounded-2xl shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-[#6C757D]">MÃO DE OBRA / SERVIÇOS</div>
                <button
                  onClick={adicionarServico}
                  className="border px-4 py-2 rounded-lg"
                  type="button"
                >
                  ADICIONAR SERVIÇO
                </button>
              </div>

              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F8F9FA]">
                    <tr>
                      <th className="p-2 text-left">DESCRIÇÃO</th>
                      <th className="p-2 text-right">QTD</th>
                      <th className="p-2 text-right">V. UNIT.</th>
                      <th className="p-2 text-right">TOTAL</th>
                      <th className="p-2 text-right">AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicosItens.length === 0 ? (
                      <tr>
                        <td className="p-4 text-[#6C757D]" colSpan={5}>
                          NENHUM SERVIÇO ADICIONADO.
                        </td>
                      </tr>
                    ) : (
                      servicosItens.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-2">
                            <input
                              value={item.descricao}
                              onChange={(e) =>
                                atualizarServicoItem(item.id, "descricao", e.target.value)
                              }
                              className="border p-2 rounded w-full"
                              placeholder="EX: TROCA DE ÓLEO, INSTALAÇÃO, DIAGNÓSTICO..."
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantidade}
                              onChange={(e) =>
                                atualizarServicoItem(
                                  item.id,
                                  "quantidade",
                                  Number(e.target.value)
                                )
                              }
                              className="border p-2 rounded w-24 text-right"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.valorUnitario}
                              onChange={(e) =>
                                atualizarServicoItem(
                                  item.id,
                                  "valorUnitario",
                                  Number(e.target.value)
                                )
                              }
                              className="border p-2 rounded w-32 text-right"
                            />
                          </td>
                          <td className="p-2 text-right font-bold">
                            {moneyBR(item.total)}
                          </td>
                          <td className="p-2 text-right">
                            <button
                              onClick={() => removerServicoItem(item.id)}
                              className="border px-3 py-1 rounded"
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

            <div className="bg-white rounded-2xl shadow p-4">
              <div className="text-sm font-bold text-[#6C757D] mb-3">
                HISTÓRICO DE ORDENS DE SERVIÇO
              </div>

              <input
                value={buscaHistorico}
                onChange={(e) => setBuscaHistorico(e.target.value)}
                className="border p-2 rounded w-full mb-4"
                placeholder="BUSCAR POR NÚMERO, CLIENTE, VEÍCULO OU STATUS..."
              />

              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F8F9FA]">
                    <tr>
                      <th className="p-2 text-left">NÚMERO</th>
                      <th className="p-2 text-left">DATA</th>
                      <th className="p-2 text-left">CLIENTE</th>
                      <th className="p-2 text-left">VEÍCULO</th>
                      <th className="p-2 text-left">STATUS</th>
                      <th className="p-2 text-left">FAT.</th>
                      <th className="p-2 text-right">TOTAL</th>
                      <th className="p-2 text-right">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoFiltrado.length === 0 ? (
                      <tr>
                        <td className="p-4 text-[#6C757D]" colSpan={8}>
                          NENHUMA ORDEM DE SERVIÇO ENCONTRADA.
                        </td>
                      </tr>
                    ) : (
                      historicoFiltrado.map((os) => (
                        <tr key={os.id} className="border-b">
                          <td className="p-2 font-bold">{os.numero}</td>
                          <td className="p-2">
                            {os.dataISO
                              ? new Date(os.dataISO).toLocaleString("pt-BR")
                              : "-"}
                          </td>
                          <td className="p-2">{os.clienteNome || "-"}</td>
                          <td className="p-2">{os.veiculoDescricao || "-"}</td>
                          <td className="p-2">{os.status || "-"}</td>
                          <td className="p-2">
                            {os.faturado ? (
                              <span className="text-green-700 font-bold">SIM</span>
                            ) : (
                              <span className="text-orange-600 font-bold">NÃO</span>
                            )}
                          </td>
                          <td className="p-2 text-right font-bold">
                            {moneyBR(toMoney(os.total))}
                          </td>
                          <td className="p-2 text-right">
                            <div className="flex justify-end gap-2 flex-wrap">
                              <button
                                onClick={() => carregarOs(os)}
                                className="border px-3 py-1 rounded"
                                type="button"
                              >
                                ABRIR
                              </button>

                              <button
                                onClick={() => imprimirOs(false, os)}
                                className="border px-3 py-1 rounded"
                                type="button"
                              >
                                IMPRIMIR
                              </button>

                              <button
                                onClick={() => imprimirOs(true, os)}
                                className="border px-3 py-1 rounded"
                                type="button"
                              >
                                TÉCNICOS
                              </button>

                              {!os.faturado && (
                                <button
                                  onClick={() => faturarOs(os.id)}
                                  className="border px-3 py-1 rounded bg-[#0A569E] text-white"
                                  type="button"
                                >
                                  ENTREGAR E FATURAR
                                </button>
                              )}

                              <button
                                onClick={() => removerOs(os.id)}
                                className="border px-3 py-1 rounded"
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
            </div>
          </section>

          <aside className="space-y-6">
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="text-sm font-bold text-[#6C757D] mb-3">RESUMO DA OS</div>

              <div className="space-y-2 text-sm">
                <div><b>CLIENTE:</b> {clienteSelecionado?.nome || "-"}</div>
                <div>
                  <b>VEÍCULO:</b>{" "}
                  {veiculoSelecionado
                    ? up(
                        `${veiculoSelecionado.marca || ""} ${veiculoSelecionado.modelo || ""} ${
                          veiculoSelecionado.placa ? `- ${veiculoSelecionado.placa}` : ""
                        }`
                      )
                    : "-"}
                </div>
                <div><b>TÉCNICO:</b> {up(tecnico || "-")}</div>
                <div><b>PRAZO:</b> {prazo || "-"}</div>
                <div><b>GARANTIA:</b> {garantiaNumero ? `${garantiaNumero} ${garantiaTipo}` : "-"}</div>
                <div><b>PAGAMENTO:</b> {up(formaPagamento)}</div>
                <div><b>STATUS:</b> {status}</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-4">
              <div className="text-sm font-bold text-[#6C757D] mb-3">TOTAIS</div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>PRODUTOS</span>
                  <b>{moneyBR(subtotalProdutos)}</b>
                </div>

                <div className="flex justify-between text-sm">
                  <span>MÃO DE OBRA</span>
                  <b>{moneyBR(subtotalServicos)}</b>
                </div>

                <div className="pt-2">
                  <div className="text-xs font-bold text-[#6C757D] mb-1">DESCONTO</div>
                  <input
                    type="number"
                    step="0.01"
                    value={desconto}
                    onChange={(e) => setDesconto(e.target.value)}
                    className="border p-2 rounded w-full text-right"
                  />
                </div>

                <div className="flex justify-between text-base pt-3 border-t mt-3">
                  <span className="font-bold">TOTAL GERAL</span>
                  <b className="text-[#0A569E]">{moneyBR(totalGeral)}</b>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-4">
              <div className="text-sm font-bold text-[#6C757D] mb-2">OBSERVAÇÕES</div>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="border p-2 rounded w-full min-h-[140px]"
                placeholder="DESCREVA O SERVIÇO, DEFEITO, CONDIÇÕES DE ENTRADA, PEÇAS TROCADAS, ETC."
              />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
