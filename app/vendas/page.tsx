"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { canAccess, isLogged } from "@/lib/authGuard";
import { getEmpresaFiscal } from "@/lib/fiscal";

type Cliente = {
  id: number;
  nome: string;
  telefone?: string;
  email?: string;
  cpfCnpj?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
};

type Produto = {
  id: number;
  nome: string;
  sku?: string;
  codigoSku?: string;
  ncm?: string;
  cfop?: string;
  cest?: string;
  unidade?: string;
  origem?: string;
  cstCsosn?: string;
  aliquotaIcms?: number;
  preco?: number;
  precoVenda?: number;
  precoBalcao?: number;
  precoInstalacao?: number;
  precoRevenda?: number;
  estoqueAtual?: number;
  controlaEstoque?: boolean;
  status?: "ATIVO" | "INATIVO";
};

type VendaItem = {
  id: number;
  produtoId: number | null;
  nome: string;
  codigo?: string;
  ncm?: string;
  cfop?: string;
  cest?: string;
  unidade?: string;
  origem?: string;
  cstCsosn?: string;
  aliquotaIcms?: number;
  quantidade: number;
  valorUnitario: number;
  total: number;
};

type Venda = {
  id: number;
  numero: string;
  dataISO: string;
  clienteId: number | null;
  clienteNome: string;
  clienteTelefone?: string;
  formaPagamento: string;
  status: "ABERTA" | "FINALIZADA" | "CANCELADA";
  itens: VendaItem[];
  subtotal: number;
  desconto: number;
  total: number;
  observacoes?: string;
};

const LS_CLIENTES = "clientes";
const LS_PRODUTOS = "produtos";
const LS_VENDAS = "vendas";

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

function nextVendaNumero() {
  const lista = readLS<Venda[]>(LS_VENDAS, []);
  if (!lista.length) return "VD-000001";

  let maior = 0;
  for (const item of lista) {
    const m = String(item.numero || "").match(/\d+/);
    const n = m ? Number(m[0]) : 0;
    if (n > maior) maior = n;
  }

  return `VD-${String(maior + 1).padStart(6, "0")}`;
}

function getPrecoProduto(p: Produto) {
  return (
    toMoney(p.precoBalcao) ||
    toMoney(p.precoVenda) ||
    toMoney(p.precoInstalacao) ||
    toMoney(p.precoRevenda) ||
    toMoney(p.preco) ||
    0
  );
}

function formatDateTimeBr(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("pt-BR");
}

function statusClass(status: string) {
  const s = up(status);
  if (s === "ABERTA") return "status-aberta";
  if (s === "FINALIZADA") return "status-finalizada";
  if (s === "CANCELADA") return "status-cancelada";
  return "status-aberta";
}

export default function VendasPage() {
  const router = useRouter();
  const empresa = getEmpresaFiscal();

  const [ready, setReady] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const [numeroVenda, setNumeroVenda] = useState(nextVendaNumero());
  const [status, setStatus] = useState<"ABERTA" | "FINALIZADA" | "CANCELADA">("ABERTA");
  const [formaPagamento, setFormaPagamento] = useState("DINHEIRO");

  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteId, setClienteId] = useState<number | null>(null);

  const [buscaProduto, setBuscaProduto] = useState("");
  const [itens, setItens] = useState<VendaItem[]>([]);

  const [desconto, setDesconto] = useState("0");
  const [observacoes, setObservacoes] = useState("");

  const clienteBoxRef = useRef<HTMLDivElement | null>(null);
  const produtoBoxRef = useRef<HTMLDivElement | null>(null);

  const [openClientes, setOpenClientes] = useState(false);
  const [openProdutos, setOpenProdutos] = useState(false);

  useEffect(() => {
    if (!isLogged()) {
      router.push("/login");
      return;
    }

    if (!canAccess("VENDAS")) {
      alert("ACESSO NEGADO");
      router.push("/dashboard");
      return;
    }

    setClientes(readLS<Cliente[]>(LS_CLIENTES, []));
    setProdutos(readLS<Produto[]>(LS_PRODUTOS, []));
    setReady(true);
  }, [router]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (clienteBoxRef.current && !clienteBoxRef.current.contains(target)) setOpenClientes(false);
      if (produtoBoxRef.current && !produtoBoxRef.current.contains(target)) setOpenProdutos(false);
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const clienteSelecionado = useMemo(() => {
    return clientes.find((c) => c.id === clienteId) || null;
  }, [clientes, clienteId]);

  const clientesSugestao = useMemo(() => {
    const q = up(buscaCliente.trim());
    if (q.length < 2) return [];
    return clientes
      .filter((c) =>
        up(`${c.nome} ${c.telefone || ""} ${c.email || ""} ${c.cpfCnpj || ""}`).includes(q)
      )
      .slice(0, 10);
  }, [clientes, buscaCliente]);

  const produtosSugestao = useMemo(() => {
    const q = up(buscaProduto.trim());
    if (q.length < 3) return [];
    return produtos
      .filter((p) => (p.status || "ATIVO") !== "INATIVO")
      .filter((p) => up(`${p.nome} ${p.sku || ""} ${p.codigoSku || ""} ${p.ncm || ""}`).includes(q))
      .slice(0, 12);
  }, [produtos, buscaProduto]);

  const subtotal = useMemo(() => {
    return itens.reduce((acc, item) => acc + toMoney(item.total), 0);
  }, [itens]);

  const totalGeral = useMemo(() => {
    return Math.max(0, subtotal - toMoney(desconto));
  }, [subtotal, desconto]);

  function selecionarCliente(c: Cliente) {
    setClienteId(c.id);
    setBuscaCliente(c.nome);
    setOpenClientes(false);
  }

  function adicionarProduto(p: Produto) {
    const preco = getPrecoProduto(p);

    setItens((prev) => [
      ...prev,
      {
        id: Date.now(),
        produtoId: p.id,
        nome: up(p.nome),
        codigo: up(p.codigoSku || p.sku || ""),
        ncm: up(p.ncm || ""),
        cfop: up(p.cfop || "5102"),
        cest: up(p.cest || ""),
        unidade: up(p.unidade || "UN"),
        origem: up(p.origem || "0"),
        cstCsosn: up(p.cstCsosn || "102"),
        aliquotaIcms: toMoney(p.aliquotaIcms || 0),
        quantidade: 1,
        valorUnitario: preco,
        total: preco,
      },
    ]);

    setBuscaProduto("");
    setOpenProdutos(false);
  }

  function atualizarItem(
    id: number,
    campo:
      | "nome"
      | "codigo"
      | "ncm"
      | "cfop"
      | "cest"
      | "unidade"
      | "origem"
      | "cstCsosn"
      | "aliquotaIcms"
      | "quantidade"
      | "valorUnitario",
    valor: string | number
  ) {
    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const next = {
          ...item,
          [campo]:
            campo === "quantidade" || campo === "valorUnitario" || campo === "aliquotaIcms"
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
    setNumeroVenda(nextVendaNumero());
    setStatus("ABERTA");
    setFormaPagamento("DINHEIRO");
    setBuscaCliente("");
    setClienteId(null);
    setBuscaProduto("");
    setItens([]);
    setDesconto("0");
    setObservacoes("");
    setOpenClientes(false);
    setOpenProdutos(false);
  }

  function montarHtmlPreviaFiscal() {
    const clienteNome = clienteSelecionado?.nome || "-";
    const clienteDoc = clienteSelecionado?.cpfCnpj || "-";
    const clienteEndereco = clienteSelecionado
      ? `${clienteSelecionado.rua || ""}${clienteSelecionado.numero ? ", " + clienteSelecionado.numero : ""}${clienteSelecionado.bairro ? " - " + clienteSelecionado.bairro : ""}${clienteSelecionado.cidade ? " - " + clienteSelecionado.cidade : ""}${clienteSelecionado.estado ? "/" + clienteSelecionado.estado : ""}`
      : "-";

    const itensRows = itens
      .map((item, idx) => {
        return `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td>${item.codigo || "-"}</td>
            <td>${item.nome}</td>
            <td>${item.ncm || "-"}</td>
            <td>${item.cfop || "-"}</td>
            <td>${item.cstCsosn || "-"}</td>
            <td style="text-align:center;">${item.unidade || "UN"}</td>
            <td style="text-align:right;">${item.quantidade}</td>
            <td style="text-align:right;">${moneyBR(item.valorUnitario)}</td>
            <td style="text-align:right;">${moneyBR(item.total)}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <html>
        <head>
          <title>PRÉVIA NF ${numeroVenda}</title>
          <style>
            body{font-family:Arial,sans-serif;padding:18px;color:#111}
            .box{border:1px solid #222;padding:10px;margin-bottom:8px}
            .titulo{font-size:18px;font-weight:700}
            .sub{font-size:11px;color:#444}
            .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
            table{width:100%;border-collapse:collapse;margin-top:8px}
            th,td{border:1px solid #222;padding:6px;font-size:10px;vertical-align:top}
            th{background:#f3f3f3}
            .totais{margin-top:10px;margin-left:auto;width:320px}
            .linha{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}
            .final{font-size:16px;font-weight:700;border-top:2px solid #111;padding-top:6px}
            .obs{min-height:70px}
            .alerta{background:#fff3cd;border:1px solid #e0b100;padding:8px;font-size:11px;margin-bottom:10px}
          </style>
        </head>
        <body>
          <div class="alerta">
            <b>PRÉVIA FISCAL / ESTRUTURA PRONTA PARA FUTURA NF-E</b><br/>
            Ambiente: ${empresa.ambiente} • Série: ${empresa.serieNfe} • Próximo número: ${empresa.proximoNumeroNfe}
          </div>

          <div class="box">
            <div class="grid2">
              <div>
                <div class="titulo">${empresa.razaoSocial || "-"}</div>
                <div class="sub">FANTASIA: ${empresa.nomeFantasia || "-"}</div>
                <div class="sub">CNPJ: ${empresa.cnpj || "-"}</div>
                <div class="sub">IE: ${empresa.ie || "-"}</div>
                <div class="sub">CRT: ${empresa.crt || "-"}</div>
                <div class="sub">${empresa.rua || ""}, ${empresa.numero || ""} ${empresa.bairro ? "- " + empresa.bairro : ""}</div>
                <div class="sub">${empresa.cidade || ""}/${empresa.estado || ""} CEP ${empresa.cep || ""}</div>
              </div>

              <div style="text-align:right;">
                <div class="titulo">PRÉVIA DE NOTA FISCAL</div>
                <div class="sub">NÚMERO INTERNO: ${numeroVenda}</div>
                <div class="sub">EMISSÃO: ${formatDateTimeBr(new Date().toISOString())}</div>
                <div class="sub">CHAVE DE ACESSO: ______________________________________________</div>
                <div class="sub">PROTOCOLO SEFAZ: ______________________________________________</div>
              </div>
            </div>
          </div>

          <div class="grid2">
            <div class="box">
              <b>DESTINATÁRIO</b><br/>
              <div class="sub">NOME: ${clienteNome}</div>
              <div class="sub">DOCUMENTO: ${clienteDoc}</div>
              <div class="sub">ENDEREÇO: ${clienteEndereco}</div>
            </div>

            <div class="box">
              <b>DADOS FISCAIS</b><br/>
              <div class="sub">NATUREZA DA OPERAÇÃO: VENDA DE MERCADORIA</div>
              <div class="sub">FORMA DE PAGAMENTO: ${up(formaPagamento)}</div>
              <div class="sub">CERTIFICADO: ${empresa.certificadoTipo || "-"}</div>
              <div class="sub">CÓDIGO MUNICÍPIO IBGE: ${empresa.codigoMunicipio || "-"}</div>
            </div>
          </div>

          <div class="box">
            <b>ITENS</b>
            <table>
              <thead>
                <tr>
                  <th>ITEM</th>
                  <th>CÓDIGO</th>
                  <th>DESCRIÇÃO</th>
                  <th>NCM</th>
                  <th>CFOP</th>
                  <th>CST/CSOSN</th>
                  <th>UN</th>
                  <th>QTD</th>
                  <th>VLR UNIT</th>
                  <th>VLR TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${itensRows || `<tr><td colspan="10">SEM ITENS</td></tr>`}
              </tbody>
            </table>
          </div>

          <div class="grid2">
            <div class="box obs">
              <b>OBSERVAÇÕES</b><br/>
              <div class="sub">${up(observacoes || empresa.observacoesDanfe || "-")}</div>
            </div>

            <div class="box">
              <b>TOTAIS</b>
              <div class="totais">
                <div class="linha"><span>SUBTOTAL</span><b>${moneyBR(subtotal)}</b></div>
                <div class="linha"><span>DESCONTO</span><b>${moneyBR(toMoney(desconto))}</b></div>
                <div class="linha final"><span>VALOR TOTAL DA NOTA</span><b>${moneyBR(totalGeral)}</b></div>
              </div>
            </div>
          </div>

          <script>window.onload=function(){window.print();}</script>
        </body>
      </html>
    `;
  }

  function imprimirPreviaFiscal() {
    if (!itens.length) {
      alert("ADICIONE PRODUTOS PARA IMPRIMIR.");
      return;
    }

    const w = window.open("", "_blank", "width=1100,height=850");
    if (!w) {
      alert("LIBERE POPUP PARA IMPRIMIR.");
      return;
    }

    w.document.open();
    w.document.write(montarHtmlPreviaFiscal());
    w.document.close();
  }

  function salvarVenda() {
    if (!clienteSelecionado) {
      alert("SELECIONE UM CLIENTE.");
      return;
    }

    if (!itens.length) {
      alert("ADICIONE PELO MENOS UM PRODUTO.");
      return;
    }

    const nova: Venda = {
      id: Date.now(),
      numero: numeroVenda,
      dataISO: new Date().toISOString(),
      clienteId: clienteSelecionado.id,
      clienteNome: clienteSelecionado.nome,
      clienteTelefone: clienteSelecionado.telefone || "",
      formaPagamento: up(formaPagamento),
      status,
      itens: itens.map((i) => ({
        ...i,
        nome: up(i.nome),
        codigo: up(i.codigo || ""),
        ncm: up(i.ncm || ""),
        cfop: up(i.cfop || "5102"),
        cest: up(i.cest || ""),
        unidade: up(i.unidade || "UN"),
        origem: up(i.origem || "0"),
        cstCsosn: up(i.cstCsosn || "102"),
        aliquotaIcms: toMoney(i.aliquotaIcms || 0),
        quantidade: toMoney(i.quantidade),
        valorUnitario: toMoney(i.valorUnitario),
        total: toMoney(i.total),
      })),
      subtotal,
      desconto: toMoney(desconto),
      total: totalGeral,
      observacoes: up(observacoes),
    };

    const lista = readLS<Venda[]>(LS_VENDAS, []);
    writeLS(LS_VENDAS, [...lista, nova]);

    alert("VENDA SALVA!");
    limparVenda();
  }

  if (!ready) return <div className="p-6">CARREGANDO...</div>;

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
                VENDAS
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="pill pill-white">NÚMERO {numeroVenda}</span>
                <span className={`pill ${statusClass(status)}`}>{status}</span>
                <span className="pill pill-success">{formaPagamento}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
              <KpiMini titulo="ITENS" valor={String(itens.length)} />
              <KpiMini titulo="SUBTOTAL" valor={moneyBR(subtotal)} />
              <KpiMini titulo="DESCONTO" valor={moneyBR(toMoney(desconto))} />
              <KpiMini titulo="TOTAL" valor={moneyBR(totalGeral)} destaque />
            </div>
          </div>

          <div className="mt-5 flex gap-3 flex-wrap">
            <button
              onClick={imprimirPreviaFiscal}
              className="botao-header"
              type="button"
            >
              PRÉVIA NOTA FISCAL
            </button>

            <button
              onClick={salvarVenda}
              className="botao-header-primary"
              type="button"
            >
              SALVAR VENDA
            </button>

            <button
              onClick={limparVenda}
              className="botao-header"
              type="button"
            >
              NOVA VENDA
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <section className="space-y-6">
            <div className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">CLIENTE E CONDIÇÕES DA VENDA</h2>
                  <p className="section-subtitle">
                    Selecione o cliente e defina forma de pagamento e status.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 relative" ref={clienteBoxRef}>
                  <label className="label">CLIENTE</label>
                  <input
                    value={buscaCliente}
                    onChange={(e) => {
                      setBuscaCliente(e.target.value);
                      setOpenClientes(true);
                    }}
                    onFocus={() => setOpenClientes(true)}
                    placeholder="DIGITE O NOME, TELEFONE OU DOCUMENTO..."
                    className="campo"
                  />

                  {openClientes && clientesSugestao.length > 0 && (
                    <div className="dropdown">
                      {clientesSugestao.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selecionarCliente(c)}
                          className="dropdown-item"
                        >
                          <div className="font-bold text-[#0F172A]">{c.nome}</div>
                          <div className="text-xs text-[#64748B]">
                            {c.telefone || "-"}{" "}
                            {c.cidade ? `— ${c.cidade}/${c.estado || ""}` : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">FORMA DE PAGAMENTO</label>
                  <select
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                    className="campo bg-white"
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

                <div>
                  <label className="label">STATUS</label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as "ABERTA" | "FINALIZADA" | "CANCELADA")
                    }
                    className="campo bg-white"
                  >
                    <option>ABERTA</option>
                    <option>FINALIZADA</option>
                    <option>CANCELADA</option>
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
                      <div className="info-value">{clienteSelecionado.cpfCnpj || "-"}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="card" ref={produtoBoxRef}>
              <div className="section-header">
                <div>
                  <h2 className="section-title">PRODUTOS</h2>
                  <p className="section-subtitle">
                    Busque por nome, código ou NCM e adicione os itens da venda.
                  </p>
                </div>
                <div className="helper-badge">DIGITE 3 LETRAS</div>
              </div>

              <div className="relative">
                <input
                  value={buscaProduto}
                  onChange={(e) => {
                    setBuscaProduto(e.target.value);
                    setOpenProdutos(true);
                  }}
                  onFocus={() => setOpenProdutos(true)}
                  placeholder="BUSCAR PRODUTO..."
                  className="campo"
                />

                {openProdutos && produtosSugestao.length > 0 && (
                  <div className="dropdown top-full mt-2">
                    {produtosSugestao.map((p) => (
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
                              {up(p.codigoSku || p.sku || "-")} • NCM {up(p.ncm || "-")}
                            </div>
                          </div>
                          <div className="font-black text-[#0456A3]">
                            {moneyBR(getPrecoProduto(p))}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 overflow-auto">
                <table className="tabela min-w-[1200px]">
                  <thead>
                    <tr>
                      <th>PRODUTO</th>
                      <th>CÓDIGO</th>
                      <th>NCM</th>
                      <th>CFOP</th>
                      <th>CST/CSOSN</th>
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
                          NENHUM PRODUTO ADICIONADO.
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
                          <td>
                            <input
                              value={item.ncm || ""}
                              onChange={(e) => atualizarItem(item.id, "ncm", e.target.value)}
                              className="campo-tabela"
                            />
                          </td>
                          <td>
                            <input
                              value={item.cfop || ""}
                              onChange={(e) => atualizarItem(item.id, "cfop", e.target.value)}
                              className="campo-tabela"
                            />
                          </td>
                          <td>
                            <input
                              value={item.cstCsosn || ""}
                              onChange={(e) => atualizarItem(item.id, "cstCsosn", e.target.value)}
                              className="campo-tabela"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              value={item.quantidade}
                              onChange={(e) => atualizarItem(item.id, "quantidade", Number(e.target.value))}
                              className="campo-tabela text-right"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={item.valorUnitario}
                              onChange={(e) => atualizarItem(item.id, "valorUnitario", Number(e.target.value))}
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
          </section>

          <aside className="space-y-6">
            <div className="card sticky-card">
              <h2 className="section-title mb-4">CONFIGURAÇÃO FISCAL</h2>

              <div className="resumo-box">
                <div className="resumo-linha">
                  <span>EMPRESA</span>
                  <strong>{empresa.nomeFantasia || "-"}</strong>
                </div>
                <div className="resumo-linha">
                  <span>CNPJ</span>
                  <strong>{empresa.cnpj || "-"}</strong>
                </div>
                <div className="resumo-linha">
                  <span>AMBIENTE</span>
                  <strong>{empresa.ambiente}</strong>
                </div>
                <div className="resumo-linha">
                  <span>SÉRIE</span>
                  <strong>{empresa.serieNfe}</strong>
                </div>
                <div className="resumo-linha">
                  <span>PRÓXIMA NF</span>
                  <strong>{empresa.proximoNumeroNfe}</strong>
                </div>
                <div className="resumo-linha">
                  <span>CERTIFICADO</span>
                  <strong>{empresa.certificadoTipo || "-"}</strong>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="section-title mb-4">TOTAIS</h2>

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

                <div className="finance-total">
                  <span>TOTAL GERAL</span>
                  <strong>{moneyBR(totalGeral)}</strong>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="section-title mb-3">OBSERVAÇÕES</h2>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="campo-textarea"
                placeholder="INFORMAÇÕES COMPLEMENTARES, CONDIÇÕES COMERCIAIS, OBSERVAÇÕES FISCAIS..."
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
          min-height: 150px;
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

        .status-aberta {
          background: #e0f2fe;
          color: #0369a1;
        }

        .status-finalizada {
          background: #dcfce7;
          color: #15803d;
        }

        .status-cancelada {
          background: #fee2e2;
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