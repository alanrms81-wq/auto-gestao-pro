"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { canAccess, isLogged } from "@/lib/authGuard";
import { getEmpresaFiscal } from "@/lib/fiscal";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type Cliente = {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  cpf_cnpj?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
};

type Produto = {
  id: string;
  nome: string;
  codigo_sku?: string | null;
  ncm?: string | null;
  cfop?: string | null;
  cest?: string | null;
  unidade?: string | null;
  origem?: string | null;
  cst_csosn?: string | null;
  aliquota_icms?: number | null;
  preco_venda?: number | null;
  preco_balcao?: number | null;
  preco_instalacao?: number | null;
  preco_revenda?: number | null;
  estoque_atual?: number | null;
  controla_estoque?: boolean | null;
  status?: string | null;
};

type VendaItem = {
  id: number;
  produtoId: string | null;
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
  id: string;
  empresa_id: string;
  numero: string;
  data_venda?: string | null;
  cliente_id?: string | null;
  cliente_nome?: string | null;
  cliente_telefone?: string | null;
  forma_pagamento?: string | null;
  status?: string | null;
  subtotal?: number | null;
  desconto?: number | null;
  total?: number | null;
  observacoes?: string | null;
  created_at?: string | null;
};

type VendaItemDB = {
  id: string;
  venda_id: string;
  produto_id?: string | null;
  produto_nome?: string | null;
  codigo?: string | null;
  ncm?: string | null;
  cfop?: string | null;
  cest?: string | null;
  unidade?: string | null;
  origem?: string | null;
  cst_csosn?: string | null;
  aliquota_icms?: number | null;
  quantidade?: number | null;
  valor_unitario?: number | null;
  total?: number | null;
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

function formatDateTimeBr(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString("pt-BR");
}

function formatDateBr(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR");
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function agoraISO() {
  return new Date().toISOString();
}

function getPrecoProduto(p: Produto) {
  return (
    toMoney(p.preco_balcao) ||
    toMoney(p.preco_venda) ||
    toMoney(p.preco_instalacao) ||
    toMoney(p.preco_revenda) ||
    0
  );
}

function statusClass(status: string) {
  const s = up(status);
  if (s === "ABERTA") return "status-aberta";
  if (s === "FINALIZADA") return "status-finalizada";
  if (s === "CANCELADA") return "status-cancelada";
  return "status-aberta";
}

function isPagamentoImediato(forma: string) {
  const f = up(forma);
  return (
    f === "DINHEIRO" ||
    f === "PIX" ||
    f === "CARTÃO DE DÉBITO" ||
    f === "CARTAO DE DEBITO" ||
    f === "TRANSFERÊNCIA" ||
    f === "TRANSFERENCIA"
  );
}

export default function VendasPage() {
  const router = useRouter();
  const empresaFiscal = getEmpresaFiscal();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [historico, setHistorico] = useState<Venda[]>([]);

  const [numeroVenda, setNumeroVenda] = useState("VD-000001");
  const [status, setStatus] = useState<"ABERTA" | "FINALIZADA" | "CANCELADA">("ABERTA");
  const [formaPagamento, setFormaPagamento] = useState("DINHEIRO");

  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);

  const [buscaProduto, setBuscaProduto] = useState("");
  const [itens, setItens] = useState<VendaItem[]>([]);

  const [desconto, setDesconto] = useState("0");
  const [observacoes, setObservacoes] = useState("");
  const [buscaHistorico, setBuscaHistorico] = useState("");

  const clienteBoxRef = useRef<HTMLDivElement | null>(null);
  const produtoBoxRef = useRef<HTMLDivElement | null>(null);

  const [openClientes, setOpenClientes] = useState(false);
  const [openProdutos, setOpenProdutos] = useState(false);

  useEffect(() => {
    async function init() {
      if (!isLogged()) {
        router.push("/login");
        return;
      }

      if (!canAccess("VENDAS")) {
        alert("ACESSO NEGADO");
        router.push("/dashboard");
        return;
      }

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

  async function gerarProximoNumero(empId: string) {
    const { data, error } = await supabase
      .from("vendas")
      .select("numero")
      .eq("empresa_id", empId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data || data.length === 0) {
      setNumeroVenda("VD-000001");
      return;
    }

    let maior = 0;
    for (const item of data) {
      const m = String(item.numero || "").match(/\d+/);
      const n = m ? Number(m[0]) : 0;
      if (n > maior) maior = n;
    }

    setNumeroVenda(`VD-${String(maior + 1).padStart(6, "0")}`);
  }

  async function carregarBase(empId?: string) {
    const eid = empId || empresaId;
    if (!eid) return;

    setLoading(true);

    const [clientesResp, produtosResp, vendasResp] = await Promise.all([
      supabase
        .from("clientes")
        .select("id,nome,telefone,email,cpf_cnpj,cidade,estado,cep,rua,numero,bairro")
        .eq("empresa_id", eid)
        .order("nome"),
      supabase
        .from("produtos")
        .select(
          "id,nome,codigo_sku,ncm,cfop,cest,unidade,origem,cst_csosn,aliquota_icms,preco_venda,preco_balcao,preco_instalacao,preco_revenda,estoque_atual,controla_estoque,status"
        )
        .eq("empresa_id", eid)
        .order("nome"),
      supabase
        .from("vendas")
        .select("*")
        .eq("empresa_id", eid)
        .order("created_at", { ascending: false }),
    ]);

    if (clientesResp.error) {
      alert("ERRO CLIENTES: " + clientesResp.error.message);
    }

    if (produtosResp.error) {
      alert("ERRO PRODUTOS: " + produtosResp.error.message);
    }

    if (vendasResp.error) {
      alert("ERRO VENDAS: " + vendasResp.error.message);
    }

    setClientes((clientesResp.data || []) as Cliente[]);
    setProdutos((produtosResp.data || []) as Produto[]);
    setHistorico((vendasResp.data || []) as Venda[]);

    await gerarProximoNumero(eid);
    setLoading(false);
  }

  const clienteSelecionado = useMemo(() => {
    return clientes.find((c) => c.id === clienteId) || null;
  }, [clientes, clienteId]);

  const clientesSugestao = useMemo(() => {
    const q = up(buscaCliente.trim());
    if (q.length < 2) return [];
    return clientes
      .filter((c) =>
        up(`${c.nome} ${c.telefone || ""} ${c.email || ""} ${c.cpf_cnpj || ""}`).includes(q)
      )
      .slice(0, 10);
  }, [clientes, buscaCliente]);

  const produtosSugestao = useMemo(() => {
    const q = up(buscaProduto.trim());
    if (q.length < 3) return [];
    return produtos
      .filter((p) => (p.status || "ATIVO") !== "INATIVO")
      .filter((p) => up(`${p.nome} ${p.codigo_sku || ""} ${p.ncm || ""}`).includes(q))
      .slice(0, 12);
  }, [produtos, buscaProduto]);

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
        `${v.numero || ""} ${v.cliente_nome || ""} ${v.cliente_telefone || ""} ${v.forma_pagamento || ""} ${v.status || ""}`
      ).includes(q)
    );
  }, [historico, buscaHistorico]);

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
        id: Date.now() + Math.floor(Math.random() * 1000),
        produtoId: p.id,
        nome: up(p.nome),
        codigo: up(p.codigo_sku || ""),
        ncm: up(p.ncm || ""),
        cfop: up(p.cfop || "5102"),
        cest: up(p.cest || ""),
        unidade: up(p.unidade || "UN"),
        origem: up(p.origem || "0"),
        cstCsosn: up(p.cst_csosn || "102"),
        aliquotaIcms: toMoney(p.aliquota_icms || 0),
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
    if (empresaId) gerarProximoNumero(empresaId);
  }

  function montarHtmlPreviaFiscal() {
    const clienteNome = clienteSelecionado?.nome || "-";
    const clienteDoc = clienteSelecionado?.cpf_cnpj || "-";
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
            Ambiente: ${empresaFiscal.ambiente} • Série: ${empresaFiscal.serieNfe} • Próximo número: ${empresaFiscal.proximoNumeroNfe}
          </div>

          <div class="box">
            <div class="grid2">
              <div>
                <div class="titulo">${empresaFiscal.razaoSocial || "-"}</div>
                <div class="sub">FANTASIA: ${empresaFiscal.nomeFantasia || "-"}</div>
                <div class="sub">CNPJ: ${empresaFiscal.cnpj || "-"}</div>
                <div class="sub">IE: ${empresaFiscal.ie || "-"}</div>
                <div class="sub">CRT: ${empresaFiscal.crt || "-"}</div>
                <div class="sub">${empresaFiscal.rua || ""}, ${empresaFiscal.numero || ""} ${empresaFiscal.bairro ? "- " + empresaFiscal.bairro : ""}</div>
                <div class="sub">${empresaFiscal.cidade || ""}/${empresaFiscal.estado || ""} CEP ${empresaFiscal.cep || ""}</div>
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
              <div class="sub">CERTIFICADO: ${empresaFiscal.certificadoTipo || "-"}</div>
              <div class="sub">CÓDIGO MUNICÍPIO IBGE: ${empresaFiscal.codigoMunicipio || "-"}</div>
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
              <div class="sub">${up(observacoes || empresaFiscal.observacoesDanfe || "-")}</div>
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

  async function salvarVenda() {
    if (!empresaId) return;

    if (!clienteSelecionado) {
      alert("SELECIONE UM CLIENTE.");
      return;
    }

    if (!itens.length) {
      alert("ADICIONE PELO MENOS UM PRODUTO.");
      return;
    }

    for (const item of itens) {
      if (!item.produtoId) continue;

      const produto = produtos.find((p) => p.id === item.produtoId);
      if (!produto) continue;

      if (produto.controla_estoque) {
        const estoqueAtual = toMoney(produto.estoque_atual);
        const qtd = toMoney(item.quantidade);

        if (qtd > estoqueAtual) {
          alert(`ESTOQUE INSUFICIENTE PARA ${item.nome}. DISPONÍVEL: ${estoqueAtual}`);
          return;
        }
      }
    }

    const vendaPayload = {
      empresa_id: empresaId,
      numero: up(numeroVenda),
      data_venda: agoraISO(),
      cliente_id: clienteSelecionado.id,
      cliente_nome: up(clienteSelecionado.nome),
      cliente_telefone: clienteSelecionado.telefone || "",
      forma_pagamento: up(formaPagamento),
      status: up(status),
      subtotal: subtotal,
      desconto: toMoney(desconto),
      total: totalGeral,
      observacoes: up(observacoes),
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

    const vendaId = vendaCriada.id as string;

    const itensPayload = itens.map((i) => ({
      venda_id: vendaId,
      produto_id: i.produtoId,
      produto_nome: up(i.nome),
      codigo: up(i.codigo || ""),
      ncm: up(i.ncm || ""),
      cfop: up(i.cfop || "5102"),
      cest: up(i.cest || ""),
      unidade: up(i.unidade || "UN"),
      origem: up(i.origem || "0"),
      cst_csosn: up(i.cstCsosn || "102"),
      aliquota_icms: toMoney(i.aliquotaIcms || 0),
      quantidade: toMoney(i.quantidade),
      valor_unitario: toMoney(i.valorUnitario),
      total: toMoney(i.total),
    }));

    const { error: itensError } = await supabase.from("venda_itens").insert(itensPayload);

    if (itensError) {
      alert("VENDA SALVA, MAS HOUVE ERRO AO SALVAR ITENS: " + itensError.message);
      return;
    }

    for (const item of itens) {
      if (!item.produtoId) continue;

      const produto = produtos.find((p) => p.id === item.produtoId);
      if (!produto || !produto.controla_estoque) continue;

      const novoEstoque = Math.max(
        0,
        toMoney(produto.estoque_atual) - toMoney(item.quantidade)
      );

      const { error: estoqueError } = await supabase
        .from("produtos")
        .update({ estoque_atual: novoEstoque })
        .eq("id", item.produtoId)
        .eq("empresa_id", empresaId);

      if (estoqueError) {
        alert(`VENDA SALVA, MAS HOUVE ERRO AO BAIXAR ESTOQUE DE ${item.nome}: ${estoqueError.message}`);
        return;
      }
    }

    const pagamentoImediato = isPagamentoImediato(formaPagamento) && status === "FINALIZADA";

    const financeiroPayload = {
      empresa_id: empresaId,
      tipo: "RECEBER",
      descricao: up(`VENDA ${numeroVenda}`),
      cliente_id: clienteSelecionado.id,
      cliente_nome: up(clienteSelecionado.nome),
      documento: up(numeroVenda),
      categoria: "VENDAS",
      valor_original: totalGeral,
      valor_pago: pagamentoImediato ? totalGeral : 0,
      desconto: 0,
      juros: 0,
      multa: 0,
      data_emissao: hojeISO(),
      data_vencimento: hojeISO(),
      data_pagamento: pagamentoImediato ? hojeISO() : null,
      forma_pagamento: up(formaPagamento),
      status: pagamentoImediato ? "PAGO" : "ABERTO",
      observacoes: up(observacoes || `TÍTULO GERADO AUTOMATICAMENTE DA VENDA ${numeroVenda}`),
    };

    const { error: financeiroError } = await supabase
      .from("financeiro_titulos")
      .insert([financeiroPayload]);

    if (financeiroError) {
      alert("VENDA SALVA, MAS HOUVE ERRO NO FINANCEIRO: " + financeiroError.message);
      return;
    }

    alert("VENDA SALVA COM ESTOQUE E FINANCEIRO!");
    await carregarBase();
    limparVenda();
  }

  async function cancelarVenda(venda: Venda) {
    if (!empresaId) return;

    if (up(venda.status || "") === "CANCELADA") {
      alert("ESSA VENDA JÁ ESTÁ CANCELADA.");
      return;
    }

    if (!confirm(`CANCELAR A VENDA ${venda.numero}? O ESTOQUE SERÁ DEVOLVIDO.`)) return;

    const { data: itensVenda, error: itensError } = await supabase
      .from("venda_itens")
      .select("*")
      .eq("venda_id", venda.id);

    if (itensError) {
      alert("ERRO AO BUSCAR ITENS DA VENDA: " + itensError.message);
      return;
    }

    for (const item of (itensVenda || []) as VendaItemDB[]) {
      if (!item.produto_id) continue;

      const { data: produtoAtual, error: prodError } = await supabase
        .from("produtos")
        .select("id,estoque_atual,controla_estoque")
        .eq("empresa_id", empresaId)
        .eq("id", item.produto_id)
        .single();

      if (prodError || !produtoAtual) continue;
      if (!produtoAtual.controla_estoque) continue;

      const novoEstoque = toMoney(produtoAtual.estoque_atual) + toMoney(item.quantidade);

      await supabase
        .from("produtos")
        .update({ estoque_atual: novoEstoque })
        .eq("empresa_id", empresaId)
        .eq("id", item.produto_id);
    }

    const { error: vendaError } = await supabase
      .from("vendas")
      .update({ status: "CANCELADA" })
      .eq("empresa_id", empresaId)
      .eq("id", venda.id);

    if (vendaError) {
      alert("ERRO AO CANCELAR VENDA: " + vendaError.message);
      return;
    }

    await supabase
      .from("financeiro_titulos")
      .update({
        status: "CANCELADO",
        observacoes: up(`TÍTULO CANCELADO AUTOMATICAMENTE DA VENDA ${venda.numero}`),
      })
      .eq("empresa_id", empresaId)
      .eq("documento", up(venda.numero));

    alert("VENDA CANCELADA E ESTOQUE DEVOLVIDO!");
    await carregarBase();
  }

  async function verItensVenda(venda: Venda) {
    const { data, error } = await supabase
      .from("venda_itens")
      .select("*")
      .eq("venda_id", venda.id);

    if (error) {
      alert("ERRO AO BUSCAR ITENS: " + error.message);
      return;
    }

    const texto = (data || [])
      .map(
        (item: any, idx: number) =>
          `${idx + 1}. ${item.produto_nome} | QTD: ${item.quantidade} | UNIT: ${moneyBR(
            toMoney(item.valor_unitario)
          )} | TOTAL: ${moneyBR(toMoney(item.total))}`
      )
      .join("\n");

    alert(texto || "SEM ITENS.");
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
                      <div className="info-value">{clienteSelecionado.cpf_cnpj || "-"}</div>
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
                              {up(p.codigo_sku || "-")} • NCM {up(p.ncm || "-")} • ESTOQUE{" "}
                              {toMoney(p.estoque_atual)}
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

            <div className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title">HISTÓRICO DE VENDAS</h2>
                  <p className="section-subtitle">
                    Consulte vendas realizadas, visualize itens e cancele quando necessário.
                  </p>
                </div>
              </div>

              <input
                value={buscaHistorico}
                onChange={(e) => setBuscaHistorico(e.target.value)}
                placeholder="BUSCAR POR NÚMERO, CLIENTE, TELEFONE, PAGAMENTO OU STATUS..."
                className="campo mb-4"
              />

              <div className="overflow-auto">
                <table className="tabela min-w-[1100px]">
                  <thead>
                    <tr>
                      <th>NÚMERO</th>
                      <th>DATA</th>
                      <th>CLIENTE</th>
                      <th>PAGAMENTO</th>
                      <th>STATUS</th>
                      <th>TOTAL</th>
                      <th>AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="empty-state">
                          CARREGANDO...
                        </td>
                      </tr>
                    ) : historicoFiltrado.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty-state">
                          NENHUMA VENDA ENCONTRADA.
                        </td>
                      </tr>
                    ) : (
                      historicoFiltrado.map((v) => (
                        <tr key={v.id}>
                          <td className="font-bold">{v.numero}</td>
                          <td>{formatDateTimeBr(v.created_at || v.data_venda)}</td>
                          <td>{v.cliente_nome || "-"}</td>
                          <td>{v.forma_pagamento || "-"}</td>
                          <td>
                            <span className={`pill ${statusClass(v.status || "ABERTA")}`}>
                              {v.status || "-"}
                            </span>
                          </td>
                          <td className="font-bold">{moneyBR(toMoney(v.total))}</td>
                          <td>
                            <div className="flex gap-2 flex-wrap">
                              <button
                                className="botao-mini"
                                onClick={() => verItensVenda(v)}
                                type="button"
                              >
                                ITENS
                              </button>
                              <button
                                className="botao-mini danger"
                                onClick={() => cancelarVenda(v)}
                                type="button"
                              >
                                CANCELAR
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
                  <strong>{empresaFiscal.ambiente}</strong>
                </div>
                <div className="resumo-linha">
                  <span>SÉRIE</span>
                  <strong>{empresaFiscal.serieNfe}</strong>
                </div>
                <div className="resumo-linha">
                  <span>PRÓXIMA NF</span>
                  <strong>{empresaFiscal.proximoNumeroNfe}</strong>
                </div>
                <div className="resumo-linha">
                  <span>CERTIFICADO</span>
                  <strong>{empresaFiscal.certificadoTipo || "-"}</strong>
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