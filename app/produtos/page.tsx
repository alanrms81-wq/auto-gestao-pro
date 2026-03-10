"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
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

export default function ProdutosPage() {
  const router = useRouter();
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");
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
      await carregarProdutos(user.empresa_id);
      setReady(true);
    }

    init();
  }, [router]);

  async function carregarProdutos(eid?: string) {
    const empId = eid || empresaId;
    if (!empId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .eq("empresa_id", empId)
      .order("created_at", { ascending: false });

    if (error) {
      alert("ERRO AO CARREGAR PRODUTOS: " + error.message);
    } else {
      setProdutos((data || []) as Produto[]);
    }

    setLoading(false);
  }

  const produtosFiltrados = useMemo(() => {
    const q = up(busca.trim());
    if (!q) return produtos;

    return produtos.filter((p) =>
      up(
        `${p.nome} ${p.codigo_sku || ""} ${p.codigo_barras || ""} ${p.categoria || ""} ${p.subcategoria || ""} ${p.ncm || ""} ${p.cfop || ""}`
      ).includes(q)
    );
  }, [produtos, busca]);

  const total = useMemo(() => produtos.length, [produtos]);

  const ativos = useMemo(
    () => produtos.filter((p) => (p.status || "ATIVO") !== "INATIVO").length,
    [produtos]
  );

  const estoqueTotal = useMemo(
    () => produtos.reduce((acc, p) => acc + toMoney(p.estoque_atual), 0),
    [produtos]
  );

  const estoqueBaixo = useMemo(
    () =>
      produtos.filter(
        (p) =>
          !!p.controla_estoque &&
          toMoney(p.estoque_atual) <= toMoney(p.estoque_minimo)
      ).length,
    [produtos]
  );

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
      carregarProdutos();
      return;
    }

    const { error } = await supabase.from("produtos").insert([payload]);

    if (error) {
      alert("ERRO AO CRIAR PRODUTO: " + error.message);
      return;
    }

    alert("PRODUTO CRIADO!");
    resetForm();
    carregarProdutos();
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
    carregarProdutos();
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
        up(getCell(row, map, ["controlaestoque", "controla_estoque"]) || "SIM") !==
          "NAO" &&
        up(getCell(row, map, ["controlaestoque", "controla_estoque"]) || "SIM") !==
          "NÃO" &&
        up(getCell(row, map, ["controlaestoque", "controla_estoque"]) || "SIM") !==
          "FALSE";

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
    carregarProdutos();
  }

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F6F7F9]">
      <Sidebar />

      <main className="flex-1 min-w-0 p-6">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[26px] font-black text-[#6C757D] leading-none">
              PRODUTOS
            </h1>
            <p className="text-[14px] text-[#6C757D] mt-2">
              CADASTRO COMPLETO, ESTOQUE, PREÇOS E BLOCO FISCAL
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <input
              placeholder="BUSCAR PRODUTO..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-[54px] w-[320px] xl:w-[410px] max-w-full rounded-2xl border border-[#2F2F2F] bg-white px-5 text-[18px] outline-none"
            />

            <button
              onClick={() => csvInputRef.current?.click()}
              className="h-[54px] rounded-2xl border border-[#2F2F2F] bg-white px-6 text-[18px] font-medium"
              type="button"
            >
              IMPORTAR CSV
            </button>

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

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <CardKpi titulo="TOTAL DE PRODUTOS" valor={String(total)} />
          <CardKpi titulo="ATIVOS" valor={String(ativos)} />
          <CardKpi titulo="ESTOQUE TOTAL" valor={String(estoqueTotal)} />
          <CardKpi titulo="ESTOQUE BAIXO" valor={String(estoqueBaixo)} />
        </div>

        <section className="bg-white rounded-[24px] shadow-sm p-5 mb-6">
          <h2 className="text-[15px] font-black text-[#6C757D] mb-5">
            {editingId ? "EDITAR PRODUTO" : "NOVO PRODUTO"}
          </h2>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_250px] gap-6">
            <div>
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
                  placeholder="102"
                  value={cstCsosn}
                  onChange={(e) => setCstCsosn(e.target.value)}
                  className="campo"
                />

                <input
                  placeholder="0"
                  value={aliquotaIcms}
                  onChange={(e) => setAliquotaIcms(e.target.value)}
                  className="campo"
                />

                <input
                  placeholder="0"
                  value={aliquotaPis}
                  onChange={(e) => setAliquotaPis(e.target.value)}
                  className="campo"
                />

                <input
                  placeholder="0"
                  value={aliquotaCofins}
                  onChange={(e) => setAliquotaCofins(e.target.value)}
                  className="campo"
                />

                <label className="campo flex items-center gap-3 cursor-pointer font-bold text-[#6C757D]">
                  <input
                    type="checkbox"
                    checked={controlaEstoque}
                    onChange={(e) => setControlaEstoque(e.target.checked)}
                  />
                  CONTROLA ESTOQUE
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

              <div className="flex gap-3 mt-5">
                <button
                  onClick={salvarProduto}
                  className="h-[54px] rounded-2xl bg-[#0456A3] px-7 text-[17px] font-medium text-white"
                  type="button"
                >
                  {editingId ? "SALVAR PRODUTO" : "SALVAR PRODUTO"}
                </button>

                <button
                  onClick={resetForm}
                  className="h-[54px] rounded-2xl border border-[#2F2F2F] bg-white px-7 text-[17px] font-medium text-[#1C1C1C]"
                  type="button"
                >
                  LIMPAR
                </button>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#B7B7B7] p-4">
              <div className="text-[14px] font-black text-[#6C757D] mb-3">FOTO</div>

              <div className="w-full h-[230px] rounded-[18px] border border-[#B7B7B7] bg-[#F6F7F9] overflow-hidden flex items-center justify-center">
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
                  <span className="text-[#7B848C] text-[14px]">SEM FOTO</span>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={aplicarFotoUrl}
                  className="flex-1 h-[46px] rounded-2xl border border-[#2F2F2F] bg-white text-[15px] font-medium"
                  type="button"
                >
                  ENVIAR FOTO
                </button>

                <button
                  onClick={limparFoto}
                  className="w-[48px] h-[46px] rounded-2xl border border-[#2F2F2F] bg-white text-[20px]"
                  type="button"
                >
                  X
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-[24px] shadow-sm overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="bg-[#F3F4F6]">
                <tr>
                  <th className="px-4 py-5 text-left text-[14px] font-black text-[#1F1F1F]">
                    PRODUTO
                  </th>
                  <th className="px-4 py-5 text-left text-[14px] font-black text-[#1F1F1F]">
                    SKU
                  </th>
                  <th className="px-4 py-5 text-left text-[14px] font-black text-[#1F1F1F]">
                    FISCAL
                  </th>
                  <th className="px-4 py-5 text-left text-[14px] font-black text-[#1F1F1F]">
                    P. BALCÃO
                  </th>
                  <th className="px-4 py-5 text-left text-[14px] font-black text-[#1F1F1F]">
                    P. INSTALAÇÃO
                  </th>
                  <th className="px-4 py-5 text-left text-[14px] font-black text-[#1F1F1F]">
                    P. REVENDA
                  </th>
                  <th className="px-4 py-5 text-left text-[14px] font-black text-[#1F1F1F]">
                    ESTOQUE
                  </th>
                  <th className="px-4 py-5 text-left text-[14px] font-black text-[#1F1F1F]">
                    STATUS
                  </th>
                  <th className="px-4 py-5 text-right text-[14px] font-black text-[#1F1F1F]">
                    AÇÕES
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-[#6C757D]">
                      CARREGANDO...
                    </td>
                  </tr>
                ) : produtosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-[#6C757D]">
                      NENHUM PRODUTO ENCONTRADO.
                    </td>
                  </tr>
                ) : (
                  produtosFiltrados.map((p) => (
                    <tr key={p.id} className="border-t border-[#EFF1F4]">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#EEF2F7] border border-[#E5E7EB] flex items-center justify-center">
                            {p.foto_url ? (
                              <img
                                src={p.foto_url}
                                alt={p.nome}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] text-[#6C757D]">SEM FOTO</span>
                            )}
                          </div>

                          <div>
                            <div className="font-bold text-[#111]">{p.nome}</div>
                            <div className="text-xs text-[#6C757D]">
                              {p.categoria || "-"}
                              {p.subcategoria ? ` / ${p.subcategoria}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-[#1F1F1F]">{p.codigo_sku || "-"}</td>

                      <td className="px-4 py-4 text-[#1F1F1F]">
                        <div className="font-medium">NCM: {p.ncm || "-"}</div>
                        <div className="text-xs text-[#6C757D]">
                          CFOP: {p.cfop || "-"}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-[#1F1F1F]">
                        {moneyBR(toMoney(p.preco_balcao))}
                      </td>

                      <td className="px-4 py-4 text-[#1F1F1F]">
                        {moneyBR(toMoney(p.preco_instalacao))}
                      </td>

                      <td className="px-4 py-4 text-[#1F1F1F]">
                        {moneyBR(toMoney(p.preco_revenda))}
                      </td>

                      <td className="px-4 py-4 text-[#1F1F1F]">
                        {p.controla_estoque ? (
                          <div>
                            <div className="font-semibold">{toMoney(p.estoque_atual)}</div>
                            <div className="text-xs text-[#6C757D]">
                              MÍN: {toMoney(p.estoque_minimo)}
                            </div>
                          </div>
                        ) : (
                          "NÃO CONTROLA"
                        )}
                      </td>

                      <td className="px-4 py-4 text-[#1F1F1F]">{p.status || "ATIVO"}</td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => editarProduto(p)}
                            className="rounded-xl border border-[#2F2F2F] bg-white px-4 py-2 text-[13px] font-medium"
                            type="button"
                          >
                            EDITAR
                          </button>

                          <button
                            onClick={() => removerProduto(p.id)}
                            className="rounded-xl border border-[#2F2F2F] bg-white px-4 py-2 text-[13px] font-medium"
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
      </main>

      <style jsx>{`
        .campo {
          height: 46px;
          width: 100%;
          border-radius: 12px;
          border: 1.5px solid #9a9a9a;
          background: #ffffff;
          padding: 0 12px;
          font-size: 16px;
          color: #1f1f1f;
          outline: none;
        }

        .campo::placeholder {
          color: #8b929a;
        }
      `}</style>
    </div>
  );
}

function CardKpi({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="bg-white rounded-[22px] shadow-sm p-5 min-h-[110px]">
      <div className="text-[14px] font-bold text-[#6C757D]">{titulo}</div>
      <div className="mt-3 text-[24px] font-black text-[#111]">{valor}</div>
    </div>
  );
}