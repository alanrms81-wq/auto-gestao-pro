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
      .filter((c) => up(`${c.nome} ${c.telefone || ""} ${c.email || ""} ${c.cpfCnpj || ""}`).includes(q))
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
    <div className="min-h-screen flex bg-[#F8F9FA]">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#6C757D]">VENDAS</h1>
            <div className="text-sm text-[#6C757D]">NÚMERO: {numeroVenda}</div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={imprimirPreviaFiscal}
              className="border px-4 py-2 rounded-lg hover:bg-white"
              type="button"
            >
              PRÉVIA NOTA FISCAL
            </button>

            <button
              onClick={salvarVenda}
              className="bg-[#0A569E] text-white px-4 py-2 rounded-lg"
              type="button"
            >
              SALVAR VENDA
            </button>

            <button
              onClick={limparVenda}
              className="border px-4 py-2 rounded-lg"
              type="button"
            >
              NOVA VENDA
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
                            {c.telefone || "-"} {c.cidade ? `— ${c.cidade}/${c.estado || ""}` : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
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

                <div>
                  <div className="text-xs font-bold text-[#6C757D] mb-1">STATUS</div>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "ABERTA" | "FINALIZADA" | "CANCELADA")}
                    className="border p-2 rounded w-full bg-white"
                  >
                    <option>ABERTA</option>
                    <option>FINALIZADA</option>
                    <option>CANCELADA</option>
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
                placeholder="BUSCAR PRODUTO..."
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
                            {up(p.codigoSku || p.sku || "-")} • NCM {up(p.ncm || "-")}
                          </div>
                        </div>
                        <div className="font-bold text-[#0A569E]">{moneyBR(getPrecoProduto(p))}</div>
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
                      <th className="p-2 text-left">NCM</th>
                      <th className="p-2 text-left">CFOP</th>
                      <th className="p-2 text-left">CST/CSOSN</th>
                      <th className="p-2 text-right">QTD</th>
                      <th className="p-2 text-right">V. UNIT.</th>
                      <th className="p-2 text-right">TOTAL</th>
                      <th className="p-2 text-right">AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.length === 0 ? (
                      <tr>
                        <td className="p-4 text-[#6C757D]" colSpan={9}>
                          NENHUM PRODUTO ADICIONADO.
                        </td>
                      </tr>
                    ) : (
                      itens.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-2">
                            <input value={item.nome} onChange={(e) => atualizarItem(item.id, "nome", e.target.value)} className="border p-2 rounded w-full" />
                          </td>
                          <td className="p-2">
                            <input value={item.codigo || ""} onChange={(e) => atualizarItem(item.id, "codigo", e.target.value)} className="border p-2 rounded w-full" />
                          </td>
                          <td className="p-2">
                            <input value={item.ncm || ""} onChange={(e) => atualizarItem(item.id, "ncm", e.target.value)} className="border p-2 rounded w-full" />
                          </td>
                          <td className="p-2">
                            <input value={item.cfop || ""} onChange={(e) => atualizarItem(item.id, "cfop", e.target.value)} className="border p-2 rounded w-full" />
                          </td>
                          <td className="p-2">
                            <input value={item.cstCsosn || ""} onChange={(e) => atualizarItem(item.id, "cstCsosn", e.target.value)} className="border p-2 rounded w-full" />
                          </td>
                          <td className="p-2">
                            <input type="number" min="1" value={item.quantidade} onChange={(e) => atualizarItem(item.id, "quantidade", Number(e.target.value))} className="border p-2 rounded w-24 text-right" />
                          </td>
                          <td className="p-2">
                            <input type="number" step="0.01" value={item.valorUnitario} onChange={(e) => atualizarItem(item.id, "valorUnitario", Number(e.target.value))} className="border p-2 rounded w-32 text-right" />
                          </td>
                          <td className="p-2 text-right font-bold">{moneyBR(item.total)}</td>
                          <td className="p-2 text-right">
                            <button onClick={() => removerItem(item.id)} className="border px-3 py-1 rounded" type="button">
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
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="text-sm font-bold text-[#6C757D] mb-3">CONFIG FISCAL ATIVA</div>
              <div className="space-y-2 text-sm">
                <div><b>EMPRESA:</b> {empresa.nomeFantasia || "-"}</div>
                <div><b>CNPJ:</b> {empresa.cnpj || "-"}</div>
                <div><b>AMBIENTE:</b> {empresa.ambiente}</div>
                <div><b>SÉRIE:</b> {empresa.serieNfe}</div>
                <div><b>PRÓXIMA NF:</b> {empresa.proximoNumeroNfe}</div>
                <div><b>CERTIFICADO:</b> {empresa.certificadoTipo || "-"}</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-4">
              <div className="text-sm font-bold text-[#6C757D] mb-3">TOTAIS</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>SUBTOTAL</span>
                  <b>{moneyBR(subtotal)}</b>
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
              />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
