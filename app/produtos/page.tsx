"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import Pagination from "@/app/components/Pagination";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type Produto = {
  id: string;
  empresa_id: string;
  nome: string;
  codigo_sku?: string | null;
  codigo_barras?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  ncm?: string | null;
  cest?: string | null;
  cfop?: string | null;
  unidade?: string | null;
  origem?: string | null;
  cst_csosn?: string | null;
  aliquota_icms?: number | null;
  aliquota_pis?: number | null;
  aliquota_cofins?: number | null;
  preco_balcao?: number | null;
  preco_instalacao?: number | null;
  preco_revenda?: number | null;
  controla_estoque?: boolean | null;
  estoque_atual?: number | null;
  estoque_minimo?: number | null;
  status?: string | null;
  foto_url?: string | null;
  created_at?: string | null;
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

function detectDelimiter(line: string) {
  const commas = (line.match(/,/g) || []).length;
  const semis = (line.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
}

function splitCsvLine(line: string, delim: string) {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delim) {
      out.push(cur.trim());
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

function normalizeKey(k: string) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function mapHeaderIndex(headers: string[]) {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    idx[normalizeKey(h)] = i;
  });
  return idx;
}

function getCell(row: string[], map: Record<string, number>, keys: string[]) {
  for (const k of keys) {
    const i = map[normalizeKey(k)];
    if (i !== undefined) return row[i] ?? "";
  }
  return "";
}

function statusClass(status: string) {
  const s = up(status);
  if (s === "ATIVO") return "status-ativo";
  if (s === "INATIVO") return "status-inativo";
  return "status-ativo";
}

export default function ProdutosPage() {
  const router = useRouter();
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const buscaTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");

  const [page, setPage] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const pageSize = 50;

  const [editingId, setEditingId] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [codigoSku, setCodigoSku] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [categoria, setCategoria] = useState("");
  const [subcategoria, setSubcategoria] = useState("");
  const [ncm, setNcm] = useState("");
  const [cest, setCest] = useState("");
  const [cfop, setCfop] = useState("5102");
  const [unidade, setUnidade] = useState("UN");
  const [origem, setOrigem] = useState("0");
  const [cstCsosn, setCstCsosn] = useState("102");
  const [aliquotaIcms, setAliquotaIcms] = useState("0");
  const [aliquotaPis, setAliquotaPis] = useState("0");
  const [aliquotaCofins, setAliquotaCofins] = useState("0");
  const [precoBalcao, setPrecoBalcao] = useState("");
  const [precoInstalacao, setPrecoInstalacao] = useState("");
  const [precoRevenda, setPrecoRevenda] = useState("");
  const [controlaEstoque, setControlaEstoque] = useState(true);
  const [estoqueAtual, setEstoqueAtual] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [status, setStatus] = useState("ATIVO");
  const [fotoUrl, setFotoUrl] = useState("");

  useEffect(() => {
    async function init() {
      const user = await getSessionUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmpresaId(user.empresa_id);
      setReady(true);
    }

    init();
  }, [router]);

  useEffect(() => {
    if (!empresaId) return;
    carregarProdutos(empresaId, buscaAplicada, page);
  }, [empresaId, page, buscaAplicada]);

  useEffect(() => {
    if (buscaTimeoutRef.current) {
      clearTimeout(buscaTimeoutRef.current);
    }

    buscaTimeoutRef.current = setTimeout(() => {
      setPage(1);
      setBuscaAplicada(busca.trim());
    }, 350);

    return () => {
      if (buscaTimeoutRef.current) {
        clearTimeout(buscaTimeoutRef.current);
      }
    };
  }, [busca]);

  async function carregarProdutos(eid?: string, buscaAtual?: string, paginaAtual?: number) {
    const empId = eid || empresaId;
    if (!empId) return;

    setLoading(true);

    const pageNumber = paginaAtual || page;
    const termoBusca = (buscaAtual ?? buscaAplicada).trim();
    const from = (pageNumber - 1) * pageSize;
    const to = from + pageSize - 1;

    let queryCount = supabase
      .from("produtos")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empId);

    let queryData = supabase.from("produtos").select("*").eq("empresa_id", empId);

    if (termoBusca) {
      const filtro = [
        `nome.ilike.%${termoBusca}%`,
        `codigo_sku.ilike.%${termoBusca}%`,
        `codigo_barras.ilike.%${termoBusca}%`,
        `categoria.ilike.%${termoBusca}%`,
        `subcategoria.ilike.%${termoBusca}%`,
        `ncm.ilike.%${termoBusca}%`,
        `cfop.ilike.%${termoBusca}%`,
      ].join(",");

      queryCount = queryCount.or(filtro);
      queryData = queryData.or(filtro);
    }

    const { count, error: countError } = await queryCount;

    if (countError) {
      alert("ERRO AO CONTAR PRODUTOS: " + countError.message);
      setLoading(false);
      return;
    }

    const { data, error } = await queryData
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      alert("ERRO AO CARREGAR PRODUTOS: " + error.message);
    } else {
      setProdutos((data || []) as Produto[]);
      setTotalRegistros(count || 0);
    }

    setLoading(false);
  }

  const total = totalRegistros;
  const ativos = produtos.filter((p) => (p.status || "ATIVO") !== "INATIVO").length;
  const estoqueTotal = produtos.reduce((acc, p) => acc + toMoney(p.estoque_atual), 0);
  const estoqueBaixo = produtos.filter(
    (p) => !!p.controla_estoque && toMoney(p.estoque_atual) <= toMoney(p.estoque_minimo)
  ).length;

  function resetForm() {
    setEditingId(null);
    setNome("");
    setCodigoSku("");
    setCodigoBarras("");
    setCategoria("");
    setSubcategoria("");
    setNcm("");
    setCest("");
    setCfop("5102");
    setUnidade("UN");
    setOrigem("0");
    setCstCsosn("102");
    setAliquotaIcms("0");
    setAliquotaPis("0");
    setAliquotaCofins("0");
    setPrecoBalcao("");
    setPrecoInstalacao("");
    setPrecoRevenda("");
    setControlaEstoque(true);
    setEstoqueAtual("");
    setEstoqueMinimo("");
    setStatus("ATIVO");
    setFotoUrl("");
  }

  async function salvarProduto() {
    if (!empresaId) return;

    if (!nome.trim()) {
      alert("PREENCHA O NOME DO PRODUTO.");
      return;
    }

    const payload = {
      empresa_id: empresaId,
      nome: up(nome.trim()),
      codigo_sku: up(codigoSku.trim()),
      codigo_barras: up(codigoBarras.trim()),
      categoria: up(categoria.trim()),
      subcategoria: up(subcategoria.trim()),
      ncm: up(ncm.trim()),
      cest: up(cest.trim()),
      cfop: up(cfop.trim() || "5102"),
      unidade: up(unidade.trim() || "UN"),
      origem: up(origem.trim() || "0"),
      cst_csosn: up(cstCsosn.trim() || "102"),
      aliquota_icms: toMoney(aliquotaIcms),
      aliquota_pis: toMoney(aliquotaPis),
      aliquota_cofins: toMoney(aliquotaCofins),
      preco_balcao: toMoney(precoBalcao),
      preco_instalacao: toMoney(precoInstalacao),
      preco_revenda: toMoney(precoRevenda),
      controla_estoque: controlaEstoque,
      estoque_atual: controlaEstoque ? toMoney(estoqueAtual) : 0,
      estoque_minimo: controlaEstoque ? toMoney(estoqueMinimo) : 0,
      status: up(status || "ATIVO"),
      foto_url: fotoUrl.trim(),
    };

    if (editingId) {
      const { error } = await supabase
        .from("produtos")
        .update(payload)
        .eq("id", editingId)
        .eq("empresa_id", empresaId);

      if (error) {
        alert("ERRO AO ATUALIZAR PRODUTO: " + error.message);
        return;
      }

      alert("PRODUTO ATUALIZADO!");
      resetForm();
      await carregarProdutos();
      return;
    }

    const { error } = await supabase.from("produtos").insert([payload]);

    if (error) {
      alert("ERRO AO CRIAR PRODUTO: " + error.message);
      return;
    }

    alert("PRODUTO CRIADO!");
    resetForm();
    setPage(1);
    setBusca("");
    setBuscaAplicada("");
    await carregarProdutos(empresaId, "", 1);
  }

  function editarProduto(p: Produto) {
    setEditingId(p.id);
    setNome(p.nome || "");
    setCodigoSku(p.codigo_sku || "");
    setCodigoBarras(p.codigo_barras || "");
    setCategoria(p.categoria || "");
    setSubcategoria(p.subcategoria || "");
    setNcm(p.ncm || "");
    setCest(p.cest || "");
    setCfop(p.cfop || "5102");
    setUnidade(p.unidade || "UN");
    setOrigem(p.origem || "0");
    setCstCsosn(p.cst_csosn || "102");
    setAliquotaIcms(String(toMoney(p.aliquota_icms)));
    setAliquotaPis(String(toMoney(p.aliquota_pis)));
    setAliquotaCofins(String(toMoney(p.aliquota_cofins)));
    setPrecoBalcao(String(toMoney(p.preco_balcao)));
    setPrecoInstalacao(String(toMoney(p.preco_instalacao)));
    setPrecoRevenda(String(toMoney(p.preco_revenda)));
    setControlaEstoque(!!p.controla_estoque);
    setEstoqueAtual(String(toMoney(p.estoque_atual)));
    setEstoqueMinimo(String(toMoney(p.estoque_minimo)));
    setStatus(p.status || "ATIVO");
    setFotoUrl(p.foto_url || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removerProduto(id: string) {
    if (!empresaId) return;
    if (!confirm("REMOVER ESTE PRODUTO?")) return;

    const { error } = await supabase
      .from("produtos")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      alert("ERRO AO REMOVER PRODUTO: " + error.message);
      return;
    }

    alert("PRODUTO REMOVIDO!");
    await carregarProdutos();
  }

  function aplicarFotoUrl() {
    setFotoUrl((v) => v.trim());
  }

  function limparFoto() {
    setFotoUrl("");
  }

  async function importarCSV(file: File) {
    if (!empresaId) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      alert("CSV VAZIO OU INVÁLIDO.");
      return;
    }

    const delim = detectDelimiter(lines[0]);
    const headers = splitCsvLine(lines[0], delim);
    const map = mapHeaderIndex(headers);

    let created = 0;
    let updated = 0;

    for (let i = 1; i < lines.length; i++) {
      const row = splitCsvLine(lines[i], delim);

      const nomeCsv = up(getCell(row, map, ["nome", "produto"]));
      if (!nomeCsv) continue;

      const skuCsv = up(
        getCell(row, map, ["sku", "codigosku", "codigo", "codigo_sku"])
      );
      const barrasCsv = up(
        getCell(row, map, ["codigobarras", "codigo_barras", "ean", "barras"])
      );
      const categoriaCsv = up(getCell(row, map, ["categoria"]));
      const subcategoriaCsv = up(getCell(row, map, ["subcategoria"]));
      const ncmCsv = up(getCell(row, map, ["ncm"]));
      const cestCsv = up(getCell(row, map, ["cest"]));
      const cfopCsv = up(getCell(row, map, ["cfop"]) || "5102");
      const unidadeCsv = up(getCell(row, map, ["unidade", "un"]) || "UN");
      const origemCsv = up(getCell(row, map, ["origem"]) || "0");
      const cstCsv = up(
        getCell(row, map, ["cstcsosn", "cst_csosn", "csosn", "cst"]) || "102"
      );

      const icmsCsv = toMoney(
        getCell(row, map, ["aliquotaicms", "aliquota_icms", "icms"])
      );
      const pisCsv = toMoney(
        getCell(row, map, ["aliquotapis", "aliquota_pis", "pis"])
      );
      const cofinsCsv = toMoney(
        getCell(row, map, ["aliquotacofins", "aliquota_cofins", "cofins"])
      );

      const precoBalcaoCsv = toMoney(
        getCell(row, map, ["precobalcao", "preco_balcao", "balcao"])
      );
      const precoInstalacaoCsv = toMoney(
        getCell(row, map, ["precoinstalacao", "preco_instalacao", "instalacao"])
      );
      const precoRevendaCsv = toMoney(
        getCell(row, map, ["precorevenda", "preco_revenda", "revenda"])
      );

      const controlaEstoqueCsv =
        up(getCell(row, map, ["controlaestoque", "controla_estoque"]) || "SIM") !== "NAO" &&
        up(getCell(row, map, ["controlaestoque", "controla_estoque"]) || "SIM") !== "NÃO" &&
        up(getCell(row, map, ["controlaestoque", "controla_estoque"]) || "SIM") !== "FALSE";

      const estoqueAtualCsv = toMoney(
        getCell(row, map, ["estoque", "estoqueatual", "estoque_atual"])
      );
      const estoqueMinimoCsv = toMoney(
        getCell(row, map, ["estoqueminimo", "estoque_minimo", "minimo"])
      );

      const statusCsv = up(getCell(row, map, ["status"]) || "ATIVO");
      const fotoUrlCsv = String(
        getCell(row, map, ["fotourl", "foto_url", "imagem", "urlimagem", "imageurl"]) || ""
      ).trim();

      const { data: existente } = await supabase
        .from("produtos")
        .select("id")
        .eq("empresa_id", empresaId)
        .or(`nome.eq.${nomeCsv},codigo_sku.eq.${skuCsv},codigo_barras.eq.${barrasCsv}`)
        .limit(1);

      const payload = {
        empresa_id: empresaId,
        nome: nomeCsv,
        codigo_sku: skuCsv,
        codigo_barras: barrasCsv,
        categoria: categoriaCsv,
        subcategoria: subcategoriaCsv,
        ncm: ncmCsv,
        cest: cestCsv,
        cfop: cfopCsv,
        unidade: unidadeCsv,
        origem: origemCsv,
        cst_csosn: cstCsv,
        aliquota_icms: icmsCsv,
        aliquota_pis: pisCsv,
        aliquota_cofins: cofinsCsv,
        preco_balcao: precoBalcaoCsv,
        preco_instalacao: precoInstalacaoCsv,
        preco_revenda: precoRevendaCsv,
        controla_estoque: controlaEstoqueCsv,
        estoque_atual: estoqueAtualCsv,
        estoque_minimo: estoqueMinimoCsv,
        status: statusCsv === "INATIVO" ? "INATIVO" : "ATIVO",
        foto_url: fotoUrlCsv,
      };

      if (existente && existente.length > 0) {
        const { error } = await supabase
          .from("produtos")
          .update(payload)
          .eq("id", existente[0].id)
          .eq("empresa_id", empresaId);

        if (!error) updated++;
      } else {
        const { error } = await supabase.from("produtos").insert([payload]);
        if (!error) created++;
      }
    }

    alert(`IMPORTAÇÃO CONCLUÍDA!\nCRIADOS: ${created}\nATUALIZADOS: ${updated}`);
    setPage(1);
    setBusca("");
    setBuscaAplicada("");
    await carregarProdutos(empresaId, "", 1);
  }

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F4F6F8]">
      <Sidebar />

      <main className="flex-1 min-w-0 p-4 md:p-6">
        <div className="mb-6 rounded-[28px] bg-gradient-to-r from-[#0456A3] to-[#0A6FD6] p-5 md:p-6 text-white shadow-[0_20px_50px_rgba(4,86,163,0.25)]">
          <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-5">
            <div className="min-w-0">
              <p className="text-[12px] font-bold tracking-[0.2em] opacity-80">
                AUTO GESTÃO PRO
              </p>
              <h1 className="mt-2 text-[28px] md:text-[34px] font-black leading-none">
                PRODUTOS
              </h1>
              <p className="mt-3 text-sm text-white/85 max-w-[700px]">
                Cadastro fiscal, controle de estoque, múltiplas tabelas de preço e gestão visual dos produtos.
              </p>
            </div>

            <div className="w-full 2xl:w-auto">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full 2xl:w-[760px]">
                <KpiMini titulo="TOTAL" valor={String(total)} />
                <KpiMini titulo="ATIVOS" valor={String(ativos)} />
                <KpiMini titulo="ESTOQUE" valor={String(estoqueTotal)} />
                <KpiMini titulo="EST. BAIXO" valor={String(estoqueBaixo)} destaque />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => csvInputRef.current?.click()}
                className="botao-header"
                type="button"
              >
                IMPORTAR CSV
              </button>

              <button
                onClick={resetForm}
                className="botao-header"
                type="button"
              >
                NOVO PRODUTO
              </button>
            </div>

            <div className="flex-1 xl:flex xl:justify-end">
              <input
                placeholder="BUSCAR PRODUTO..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="header-search"
              />
            </div>

            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importarCSV(file);
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>

        <section className="card mb-6">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                {editingId ? "EDITAR PRODUTO" : "NOVO PRODUTO"}
              </h2>
              <p className="section-subtitle">
                Cadastre dados fiscais, preços, estoque e imagem em um único fluxo.
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button onClick={salvarProduto} className="botao-azul" type="button">
                {editingId ? "SALVAR ALTERAÇÕES" : "SALVAR PRODUTO"}
              </button>

              <button onClick={resetForm} className="botao" type="button">
                LIMPAR
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                placeholder="NOME"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="campo md:col-span-2"
              />

              <input
                placeholder="SKU / CÓDIGO INTERNO"
                value={codigoSku}
                onChange={(e) => setCodigoSku(e.target.value)}
                className="campo"
              />

              <input
                placeholder="CÓDIGO DE BARRAS"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                className="campo"
              />

              <input
                placeholder="CATEGORIA"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="campo"
              />

              <input
                placeholder="SUBCATEGORIA"
                value={subcategoria}
                onChange={(e) => setSubcategoria(e.target.value)}
                className="campo"
              />

              <input
                placeholder="PREÇO BALCÃO"
                value={precoBalcao}
                onChange={(e) => setPrecoBalcao(e.target.value)}
                className="campo"
              />

              <input
                placeholder="PREÇO INSTALAÇÃO"
                value={precoInstalacao}
                onChange={(e) => setPrecoInstalacao(e.target.value)}
                className="campo"
              />

              <input
                placeholder="PREÇO REVENDA"
                value={precoRevenda}
                onChange={(e) => setPrecoRevenda(e.target.value)}
                className="campo"
              />

              <input
                placeholder="NCM"
                value={ncm}
                onChange={(e) => setNcm(e.target.value)}
                className="campo"
              />

              <input
                placeholder="CEST"
                value={cest}
                onChange={(e) => setCest(e.target.value)}
                className="campo"
              />

              <input
                placeholder="CFOP"
                value={cfop}
                onChange={(e) => setCfop(e.target.value)}
                className="campo"
              />

              <input
                placeholder="UN"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                className="campo"
              />

              <select
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                className="campo"
              >
                <option value="0">ORIGEM 0 - NACIONAL</option>
                <option value="1">ORIGEM 1 - IMPORTAÇÃO DIRETA</option>
                <option value="2">ORIGEM 2 - IMPORTAÇÃO MERCADO INTERNO</option>
                <option value="3">ORIGEM 3</option>
                <option value="4">ORIGEM 4</option>
                <option value="5">ORIGEM 5</option>
                <option value="6">ORIGEM 6</option>
                <option value="7">ORIGEM 7</option>
                <option value="8">ORIGEM 8</option>
              </select>

              <input
                placeholder="CST / CSOSN"
                value={cstCsosn}
                onChange={(e) => setCstCsosn(e.target.value)}
                className="campo"
              />

              <input
                placeholder="ALÍQUOTA ICMS"
                value={aliquotaIcms}
                onChange={(e) => setAliquotaIcms(e.target.value)}
                className="campo"
              />

              <input
                placeholder="ALÍQUOTA PIS"
                value={aliquotaPis}
                onChange={(e) => setAliquotaPis(e.target.value)}
                className="campo"
              />

              <input
                placeholder="ALÍQUOTA COFINS"
                value={aliquotaCofins}
                onChange={(e) => setAliquotaCofins(e.target.value)}
                className="campo"
              />

              <label className="campo checkbox-campo">
                <input
                  type="checkbox"
                  checked={controlaEstoque}
                  onChange={(e) => setControlaEstoque(e.target.checked)}
                />
                <span>CONTROLA ESTOQUE</span>
              </label>

              <input
                placeholder="ESTOQUE ATUAL"
                value={estoqueAtual}
                onChange={(e) => setEstoqueAtual(e.target.value)}
                className="campo"
                disabled={!controlaEstoque}
              />

              <input
                placeholder="ESTOQUE MÍNIMO"
                value={estoqueMinimo}
                onChange={(e) => setEstoqueMinimo(e.target.value)}
                className="campo"
                disabled={!controlaEstoque}
              />

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="campo"
              >
                <option value="ATIVO">ATIVO</option>
                <option value="INATIVO">INATIVO</option>
              </select>

              <input
                placeholder="URL DA FOTO"
                value={fotoUrl}
                onChange={(e) => setFotoUrl(e.target.value)}
                className="campo md:col-span-4"
              />
            </div>

            <div className="foto-card">
              <div className="foto-title">FOTO DO PRODUTO</div>

              <div className="foto-box">
                {fotoUrl ? (
                  <img
                    src={fotoUrl}
                    alt="Foto do produto"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-[#64748B] text-[14px]">SEM FOTO</span>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={aplicarFotoUrl}
                  className="botao flex-1"
                  type="button"
                >
                  APLICAR FOTO
                </button>

                <button
                  onClick={limparFoto}
                  className="botao danger-button"
                  type="button"
                >
                  X
                </button>
              </div>

              <div className="mt-4 resumo-box">
                <div className="resumo-linha">
                  <span>P. BALCÃO</span>
                  <strong>{moneyBR(toMoney(precoBalcao))}</strong>
                </div>
                <div className="resumo-linha">
                  <span>P. INSTALAÇÃO</span>
                  <strong>{moneyBR(toMoney(precoInstalacao))}</strong>
                </div>
                <div className="resumo-linha">
                  <span>P. REVENDA</span>
                  <strong>{moneyBR(toMoney(precoRevenda))}</strong>
                </div>
                <div className="resumo-linha">
                  <span>ESTOQUE</span>
                  <strong>{controlaEstoque ? toMoney(estoqueAtual) : "NÃO CONTROLA"}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">LISTA DE PRODUTOS</h2>
              <p className="section-subtitle">
                Consulte, edite e acompanhe preços, estoque e situação dos produtos.
              </p>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="tabela min-w-[1320px]">
              <thead>
                <tr>
                  <th>PRODUTO</th>
                  <th>SKU</th>
                  <th>FISCAL</th>
                  <th>P. BALCÃO</th>
                  <th>P. INSTALAÇÃO</th>
                  <th>P. REVENDA</th>
                  <th>ESTOQUE</th>
                  <th>STATUS</th>
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
                ) : produtos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty-state">
                      NENHUM PRODUTO ENCONTRADO.
                    </td>
                  </tr>
                ) : (
                  produtos.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="produto-cell">
                          <div className="produto-foto">
                            {p.foto_url ? (
                              <img
                                src={p.foto_url}
                                alt={p.nome}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] text-[#64748B]">SEM FOTO</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="font-bold text-[#0F172A] truncate">{p.nome}</div>
                            <div className="text-xs text-[#64748B]">
                              {p.categoria || "-"}
                              {p.subcategoria ? ` / ${p.subcategoria}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>{p.codigo_sku || "-"}</td>

                      <td>
                        <div className="font-medium">NCM: {p.ncm || "-"}</div>
                        <div className="text-xs text-[#64748B]">CFOP: {p.cfop || "-"}</div>
                      </td>

                      <td className="font-semibold">{moneyBR(toMoney(p.preco_balcao))}</td>
                      <td className="font-semibold">{moneyBR(toMoney(p.preco_instalacao))}</td>
                      <td className="font-semibold">{moneyBR(toMoney(p.preco_revenda))}</td>

                      <td>
                        {p.controla_estoque ? (
                          <div>
                            <div className="font-semibold">{toMoney(p.estoque_atual)}</div>
                            <div className="text-xs text-[#64748B]">
                              MÍN: {toMoney(p.estoque_minimo)}
                            </div>
                          </div>
                        ) : (
                          "NÃO CONTROLA"
                        )}
                      </td>

                      <td>
                        <span className={`status-chip ${statusClass(p.status || "ATIVO")}`}>
                          {p.status || "ATIVO"}
                        </span>
                      </td>

                      <td>
                        <div className="flex gap-2 justify-end flex-wrap">
                          <button
                            onClick={() => editarProduto(p)}
                            className="botao-mini"
                            type="button"
                          >
                            EDITAR
                          </button>

                          <button
                            onClick={() => removerProduto(p.id)}
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

          <div className="mt-5">
            <Pagination
              page={page}
              setPage={setPage}
              total={totalRegistros}
              pageSize={pageSize}
            />
          </div>
        </section>
      </main>

      <style jsx>{`
        .card {
          background: white;
          border-radius: 24px;
          padding: 20px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
          border: 1px solid #eef2f7;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 18px;
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

        .campo {
          height: 46px;
          width: 100%;
          border-radius: 12px;
          border: 1.5px solid #cbd5e1;
          background: #ffffff;
          padding: 0 12px;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: 0.2s;
        }

        .campo:focus {
          border-color: #0a6fd6;
          box-shadow: 0 0 0 4px rgba(10, 111, 214, 0.08);
        }

        .campo::placeholder {
          color: #8b929a;
        }

        .header-search {
          height: 48px;
          width: 100%;
          max-width: 460px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.12);
          padding: 0 18px;
          font-size: 15px;
          color: white;
          outline: none;
          backdrop-filter: blur(10px);
        }

        .header-search::placeholder {
          color: rgba(255, 255, 255, 0.72);
        }

        .checkbox-campo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          color: #475569;
        }

        .foto-card {
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          padding: 16px;
          background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
        }

        .foto-title {
          font-size: 13px;
          font-weight: 900;
          color: #475569;
          margin-bottom: 12px;
        }

        .foto-box {
          width: 100%;
          height: 240px;
          border-radius: 18px;
          border: 1px solid #cbd5e1;
          background: white;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
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

        .botao-azul {
          background: #0456a3;
          color: white;
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 700;
          border: none;
          box-shadow: 0 10px 20px rgba(4, 86, 163, 0.18);
        }

        .danger-button {
          min-width: 52px;
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
          white-space: nowrap;
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

        .produto-cell {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 240px;
        }

        .produto-foto {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          overflow: hidden;
          background: #eef2f7;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .status-chip {
          display: inline-flex;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 900;
        }

        .status-ativo {
          background: #dcfce7;
          color: #15803d;
        }

        .status-inativo {
          background: #fee2e2;
          color: #b91c1c;
        }

        .resumo-box {
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 16px;
          padding: 14px;
        }

        .resumo-linha {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
          font-size: 13px;
          color: #334155;
        }

        .resumo-linha:last-child {
          border-bottom: none;
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
      className={`rounded-[18px] px-4 py-3 min-w-0 ${
        destaque ? "bg-white text-[#0456A3]" : "bg-white/12 text-white border border-white/15"
      }`}
    >
      <div className="text-[10px] font-bold tracking-[0.12em] opacity-80 truncate">
        {titulo}
      </div>
      <div className="mt-1 text-[18px] font-black leading-none truncate">{valor}</div>
    </div>
  );
}