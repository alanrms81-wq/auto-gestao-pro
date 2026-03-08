"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { canAccess, isLogged } from "@/lib/authGuard";

type Produto = {
  id: number;
  nome: string;
  codigoSku: string;
  codigoBarras: string;

  categoria: string;
  subcategoria: string;

  ncm: string;
  cest: string;
  cfop: string;
  unidade: string;
  origem: string;
  cstCsosn: string;
  aliquotaIcms: number;
  aliquotaPis: number;
  aliquotaCofins: number;

  precoBalcao: number;
  precoInstalacao: number;
  precoRevenda: number;

  controlaEstoque: boolean;
  estoqueAtual: number;
  estoqueMinimo: number;

  status: "ATIVO" | "INATIVO";

  fotoBase64?: string;
  fotoUrl?: string;
};

const LS_PRODUTOS = "produtos";

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

function getCell(row: any[], map: Record<string, number>, keys: string[]) {
  for (const k of keys) {
    const i = map[normalizeKey(k)];
    if (i !== undefined) return row[i] ?? "";
  }
  return "";
}

function getFotoSrc(produto: Produto | null, fotoBase64: string, fotoUrl: string) {
  if (produto) {
    if (produto.fotoBase64) return produto.fotoBase64;
    if (produto.fotoUrl) return produto.fotoUrl;
    return "";
  }

  if (fotoBase64) return fotoBase64;
  if (fotoUrl) return fotoUrl;
  return "";
}

export default function ProdutosPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);

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

  const [status, setStatus] = useState<"ATIVO" | "INATIVO">("ATIVO");
  const [fotoBase64, setFotoBase64] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");

  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const fotoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isLogged()) {
      router.push("/login");
      return;
    }

    if (!canAccess("PRODUTOS")) {
      alert("ACESSO NEGADO");
      router.push("/dashboard");
      return;
    }

    setProdutos(readLS<Produto[]>(LS_PRODUTOS, []));
    setReady(true);
  }, [router]);

  const produtosFiltrados = useMemo(() => {
    const q = up(busca.trim());
    if (!q) return produtos;

    return produtos.filter((p) => {
      const texto = up(
        `${p.nome} ${p.codigoSku} ${p.codigoBarras} ${p.categoria} ${p.subcategoria} ${p.ncm} ${p.cest} ${p.cfop} ${p.cstCsosn}`
      );
      return texto.includes(q);
    });
  }, [busca, produtos]);

  const totalEstoque = useMemo(() => {
    return produtos.reduce((acc, p) => acc + toMoney(p.estoqueAtual), 0);
  }, [produtos]);

  const estoqueBaixo = useMemo(() => {
    return produtos.filter(
      (p) => p.controlaEstoque && toMoney(p.estoqueAtual) <= toMoney(p.estoqueMinimo)
    ).length;
  }, [produtos]);

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
    setFotoBase64("");
    setFotoUrl("");
  }

  function salvarProduto() {
    if (!nome.trim()) {
      alert("INFORME O NOME DO PRODUTO.");
      return;
    }

    const base: Produto = {
      id: editingId || Date.now(),
      nome: up(nome),
      codigoSku: up(codigoSku),
      codigoBarras: up(codigoBarras),

      categoria: up(categoria),
      subcategoria: up(subcategoria),

      ncm: up(ncm),
      cest: up(cest),
      cfop: up(cfop || "5102"),
      unidade: up(unidade || "UN"),
      origem: up(origem || "0"),
      cstCsosn: up(cstCsosn || "102"),
      aliquotaIcms: toMoney(aliquotaIcms),
      aliquotaPis: toMoney(aliquotaPis),
      aliquotaCofins: toMoney(aliquotaCofins),

      precoBalcao: toMoney(precoBalcao),
      precoInstalacao: toMoney(precoInstalacao),
      precoRevenda: toMoney(precoRevenda),

      controlaEstoque,
      estoqueAtual: controlaEstoque ? toMoney(estoqueAtual) : 0,
      estoqueMinimo: controlaEstoque ? toMoney(estoqueMinimo) : 0,

      status,
      fotoBase64,
      fotoUrl: fotoUrl.trim(),
    };

    const lista = [...produtos];

    if (editingId) {
      const idx = lista.findIndex((p) => p.id === editingId);
      if (idx < 0) {
        alert("PRODUTO NÃO ENCONTRADO.");
        return;
      }
      lista[idx] = base;
    } else {
      lista.push(base);
    }

    writeLS(LS_PRODUTOS, lista);
    setProdutos(lista);
    resetForm();
    alert(editingId ? "PRODUTO ATUALIZADO!" : "PRODUTO CRIADO!");
  }

  function editarProduto(p: Produto) {
    setEditingId(p.id);
    setNome(p.nome || "");
    setCodigoSku(p.codigoSku || "");
    setCodigoBarras(p.codigoBarras || "");
    setCategoria(p.categoria || "");
    setSubcategoria(p.subcategoria || "");
    setNcm(p.ncm || "");
    setCest(p.cest || "");
    setCfop(p.cfop || "5102");
    setUnidade(p.unidade || "UN");
    setOrigem(p.origem || "0");
    setCstCsosn(p.cstCsosn || "102");
    setAliquotaIcms(String(toMoney(p.aliquotaIcms)));
    setAliquotaPis(String(toMoney(p.aliquotaPis)));
    setAliquotaCofins(String(toMoney(p.aliquotaCofins)));
    setPrecoBalcao(String(toMoney(p.precoBalcao)));
    setPrecoInstalacao(String(toMoney(p.precoInstalacao)));
    setPrecoRevenda(String(toMoney(p.precoRevenda)));
    setControlaEstoque(!!p.controlaEstoque);
    setEstoqueAtual(String(toMoney(p.estoqueAtual)));
    setEstoqueMinimo(String(toMoney(p.estoqueMinimo)));
    setStatus(p.status || "ATIVO");
    setFotoBase64(p.fotoBase64 || "");
    setFotoUrl(p.fotoUrl || "");
  }

  function removerProduto(id: number) {
    if (!confirm("REMOVER PRODUTO?")) return;

    const lista = produtos.filter((p) => p.id !== id);
    writeLS(LS_PRODUTOS, lista);
    setProdutos(lista);
  }

  function lerFoto(file: File) {
    const reader = new FileReader();

    reader.onload = () => {
      setFotoBase64(String(reader.result || ""));
      setFotoUrl("");
    };

    reader.readAsDataURL(file);
  }

  function importarCSV(file: File) {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        if (lines.length < 2) {
          alert("CSV VAZIO OU INVÁLIDO.");
          return;
        }

        const delim = detectDelimiter(lines[0]);
        const headers = splitCsvLine(lines[0], delim);
        const map = mapHeaderIndex(headers);

        const atuais = readLS<Produto[]>(LS_PRODUTOS, []);
        const next = [...atuais];

        let created = 0;
        let updated = 0;

        for (let i = 1; i < lines.length; i++) {
          const row = splitCsvLine(lines[i], delim);

          const nomeCsv = up(getCell(row, map, ["nome", "produto"]));
          if (!nomeCsv) continue;

          const skuCsv = up(getCell(row, map, ["sku", "codigosku", "codigo", "codigointerno"]));
          const barrasCsv = up(getCell(row, map, ["codigobarras", "barras", "ean"]));
          const categoriaCsv = up(getCell(row, map, ["categoria"]));
          const subcategoriaCsv = up(getCell(row, map, ["subcategoria"]));

          const ncmCsv = up(getCell(row, map, ["ncm"]));
          const cestCsv = up(getCell(row, map, ["cest"]));
          const cfopCsv = up(getCell(row, map, ["cfop"]) || "5102");
          const unidadeCsv = up(getCell(row, map, ["unidade", "un"]) || "UN");
          const origemCsv = up(getCell(row, map, ["origem"]) || "0");
          const cstCsosnCsv = up(getCell(row, map, ["cstcsosn", "csosn", "cst"]) || "102");
          const aliquotaIcmsCsv = toMoney(getCell(row, map, ["aliquotaicms", "icms"]));
          const aliquotaPisCsv = toMoney(getCell(row, map, ["aliquotapis", "pis"]));
          const aliquotaCofinsCsv = toMoney(getCell(row, map, ["aliquotacofins", "cofins"]));

          const precoBalcaoCsv = toMoney(getCell(row, map, ["precobalcao", "balcao"]));
          const precoInstalacaoCsv = toMoney(
            getCell(row, map, ["precoinstalacao", "instalacao"])
          );
          const precoRevendaCsv = toMoney(getCell(row, map, ["precorevenda", "revenda"]));

          const controlaEstoqueCsv =
            up(getCell(row, map, ["controlaestoque"]) || "SIM") !== "NÃO" &&
            up(getCell(row, map, ["controlaestoque"]) || "SIM") !== "NAO" &&
            up(getCell(row, map, ["controlaestoque"]) || "SIM") !== "FALSE";

          const estoqueAtualCsv = toMoney(getCell(row, map, ["estoque", "estoqueatual"]));
          const estoqueMinimoCsv = toMoney(getCell(row, map, ["estoqueminimo", "minimo"]));
          const statusCsv =
            up(getCell(row, map, ["status"]) || "ATIVO") === "INATIVO" ? "INATIVO" : "ATIVO";

          const fotoUrlCsv = String(
            getCell(row, map, ["fotourl", "foto", "imagem", "imageurl", "urlimagem"]) || ""
          ).trim();

          const idx = next.findIndex((p) => {
            if (skuCsv && up(p.codigoSku) === skuCsv) return true;
            if (barrasCsv && up(p.codigoBarras) === barrasCsv) return true;
            return up(p.nome) === nomeCsv;
          });

          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              nome: nomeCsv || next[idx].nome,
              codigoSku: skuCsv || next[idx].codigoSku,
              codigoBarras: barrasCsv || next[idx].codigoBarras,
              categoria: categoriaCsv || next[idx].categoria,
              subcategoria: subcategoriaCsv || next[idx].subcategoria,
              ncm: ncmCsv || next[idx].ncm,
              cest: cestCsv || next[idx].cest,
              cfop: cfopCsv || next[idx].cfop,
              unidade: unidadeCsv || next[idx].unidade,
              origem: origemCsv || next[idx].origem,
              cstCsosn: cstCsosnCsv || next[idx].cstCsosn,
              aliquotaIcms: aliquotaIcmsCsv || next[idx].aliquotaIcms,
              aliquotaPis: aliquotaPisCsv || next[idx].aliquotaPis,
              aliquotaCofins: aliquotaCofinsCsv || next[idx].aliquotaCofins,
              precoBalcao: precoBalcaoCsv || next[idx].precoBalcao,
              precoInstalacao: precoInstalacaoCsv || next[idx].precoInstalacao,
              precoRevenda: precoRevendaCsv || next[idx].precoRevenda,
              controlaEstoque: controlaEstoqueCsv,
              estoqueAtual: estoqueAtualCsv,
              estoqueMinimo: estoqueMinimoCsv,
              status: statusCsv,
              fotoUrl: fotoUrlCsv || next[idx].fotoUrl || "",
            };
            updated++;
          } else {
            next.push({
              id: Date.now() + i,
              nome: nomeCsv,
              codigoSku: skuCsv,
              codigoBarras: barrasCsv,
              categoria: categoriaCsv,
              subcategoria: subcategoriaCsv,
              ncm: ncmCsv,
              cest: cestCsv,
              cfop: cfopCsv,
              unidade: unidadeCsv,
              origem: origemCsv,
              cstCsosn: cstCsosnCsv,
              aliquotaIcms: aliquotaIcmsCsv,
              aliquotaPis: aliquotaPisCsv,
              aliquotaCofins: aliquotaCofinsCsv,
              precoBalcao: precoBalcaoCsv,
              precoInstalacao: precoInstalacaoCsv,
              precoRevenda: precoRevendaCsv,
              controlaEstoque: controlaEstoqueCsv,
              estoqueAtual: estoqueAtualCsv,
              estoqueMinimo: estoqueMinimoCsv,
              status: statusCsv,
              fotoBase64: "",
              fotoUrl: fotoUrlCsv,
            });
            created++;
          }
        }

        writeLS(LS_PRODUTOS, next);
        setProdutos(next);
        alert(`IMPORTAÇÃO CSV CONCLUÍDA!\nCRIADOS: ${created}\nATUALIZADOS: ${updated}`);
      } catch {
        alert("ERRO AO IMPORTAR CSV.");
      }
    };

    reader.readAsText(file, "utf-8");
  }

  const fotoPreview = getFotoSrc(null, fotoBase64, fotoUrl);

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F8F9FA]">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#6C757D]">PRODUTOS PREMIUM</h1>
            <div className="text-sm text-[#6C757D]">
              CADASTRO COMPLETO, ESTOQUE, PREÇOS E BLOCO FISCAL
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <input
              placeholder="BUSCAR PRODUTO..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="border p-2 rounded-lg w-80 max-w-full"
            />

            <button
              onClick={() => csvInputRef.current?.click()}
              className="border px-4 py-2 rounded-lg bg-white"
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">TOTAL DE PRODUTOS</div>
            <div className="text-3xl font-black mt-2">{produtos.length}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">ATIVOS</div>
            <div className="text-3xl font-black mt-2">
              {produtos.filter((p) => p.status === "ATIVO").length}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">ESTOQUE TOTAL</div>
            <div className="text-3xl font-black mt-2">{totalEstoque}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">ESTOQUE BAIXO</div>
            <div className="text-3xl font-black mt-2">{estoqueBaixo}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow mb-6">
          <div className="text-sm font-bold text-[#6C757D] mb-3">
            {editingId ? "EDITAR PRODUTO" : "NOVO PRODUTO"}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  placeholder="NOME"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="border p-2 rounded md:col-span-2"
                />

                <input
                  placeholder="SKU / CÓDIGO INTERNO"
                  value={codigoSku}
                  onChange={(e) => setCodigoSku(e.target.value)}
                  className="border p-2 rounded"
                />

                <input
                  placeholder="CÓDIGO DE BARRAS"
                  value={codigoBarras}
                  onChange={(e) => setCodigoBarras(e.target.value)}
                  className="border p-2 rounded"
                />

                <input
                  placeholder="CATEGORIA"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="border p-2 rounded"
                />

                <input
                  placeholder="SUBCATEGORIA"
                  value={subcategoria}
                  onChange={(e) => setSubcategoria(e.target.value)}
                  className="border p-2 rounded"
                />

                <input
                  placeholder="PREÇO BALCÃO"
                  value={precoBalcao}
                  onChange={(e) => setPrecoBalcao(e.target.value)}
                  className="border p-2 rounded"
                />

                <input
                  placeholder="PREÇO INSTALAÇÃO"
                  value={precoInstalacao}
                  onChange={(e) => setPrecoInstalacao(e.target.value)}
                  className="border p-2 rounded"
                />

                <input
                  placeholder="PREÇO REVENDA"
                  value={precoRevenda}
                  onChange={(e) => setPrecoRevenda(e.target.value)}
                  className="border p-2 rounded"
                />

                <input
                  placeholder="NCM"
                  value={ncm}
                  onChange={(e) => setNcm(e.target.value)}
                  className="border p-2 rounded"
                />

                <input
                  placeholder="CEST"
                  value={cest}
                  onChange={(e) => setCest(e.target.value)}
                  className="border p-2 rounded"
                />

                <input
                  placeholder="CFOP"
                  value={cfop}
                  onChange={(e) => setCfop(e.target.value)}
                  className="border p-2 rounded"
                />

                <input
                  placeholder="UNIDADE"
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  className="border p-2 rounded"
                />

                <select
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  className="border p-2 rounded bg-white"
                >
                  <option value="0">ORIGEM 0 - NACIONAL</option>
                  <option value="1">ORIGEM 1 - IMPORTAÇÃO DIRETA</option>
                  <option value="2">ORIGEM 2 - IMPORTAÇÃO MERCADO INTERNO</option>
                  <option value="3">ORIGEM 3 - NACIONAL C/ CONTEÚDO IMPORTADO &gt; 40%</option>
                  <option value="4">ORIGEM 4 - NACIONAL PRODUÇÃO BÁSICA</option>
                  <option value="5">ORIGEM 5 - NACIONAL C/ CONTEÚDO IMPORTADO ≤ 40%</option>
                  <option value="6">ORIGEM 6 - IMPORTAÇÃO DIRETA S/ SIMILAR</option>
                  <option value="7">ORIGEM 7 - IMPORTAÇÃO MERCADO INTERNO S/ SIMILAR</option>
                  <option value="8">ORIGEM 8 - NACIONAL C/ CONTEÚDO IMPORTADO &gt; 70%</option>
                </select>

                <input
                  placeholder="CST / CSOSN"
                  value={cstCsosn}
                  onChange={(e) => setCstCsosn(e.target.value)}
                  className="border p-2 rounded"
                />

                <input
                  placeholder="ALÍQUOTA ICMS"
                  value={aliquotaIcms}
                  onChange={(e) => setAliquotaIcms(e.target.value)}
                  className="border p-2 rounded"
                />

                <input
                  placeholder="ALÍQUOTA PIS"
                  value={aliquotaPis}
                  onChange={(e) => setAliquotaPis(e.target.value)}
                  className="border p-2 rounded"
                />

                <input
                  placeholder="ALÍQUOTA COFINS"
                  value={aliquotaCofins}
                  onChange={(e) => setAliquotaCofins(e.target.value)}
                  className="border p-2 rounded"
                />

                <div className="flex items-center gap-2 border rounded p-2">
                  <input
                    type="checkbox"
                    checked={controlaEstoque}
                    onChange={(e) => setControlaEstoque(e.target.checked)}
                  />
                  <span className="text-sm font-bold text-[#6C757D]">
                    CONTROLA ESTOQUE
                  </span>
                </div>

                <input
                  placeholder="ESTOQUE ATUAL"
                  value={estoqueAtual}
                  onChange={(e) => setEstoqueAtual(e.target.value)}
                  className="border p-2 rounded"
                  disabled={!controlaEstoque}
                />

                <input
                  placeholder="ESTOQUE MÍNIMO"
                  value={estoqueMinimo}
                  onChange={(e) => setEstoqueMinimo(e.target.value)}
                  className="border p-2 rounded"
                  disabled={!controlaEstoque}
                />

                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "ATIVO" | "INATIVO")}
                  className="border p-2 rounded bg-white"
                >
                  <option value="ATIVO">ATIVO</option>
                  <option value="INATIVO">INATIVO</option>
                </select>

                <input
                  placeholder="URL DA FOTO"
                  value={fotoUrl}
                  onChange={(e) => {
                    setFotoUrl(e.target.value);
                    if (e.target.value.trim()) setFotoBase64("");
                  }}
                  className="border p-2 rounded md:col-span-3"
                />
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={salvarProduto}
                  className="bg-[#0A569E] text-white px-4 py-2 rounded-lg"
                  type="button"
                >
                  {editingId ? "SALVAR ALTERAÇÕES" : "SALVAR PRODUTO"}
                </button>

                <button
                  onClick={resetForm}
                  className="border px-4 py-2 rounded-lg"
                  type="button"
                >
                  LIMPAR
                </button>
              </div>
            </div>

            <div className="xl:col-span-1">
              <div className="border rounded-2xl p-4 h-full">
                <div className="text-sm font-bold text-[#6C757D] mb-3">FOTO</div>

                <div className="aspect-square rounded-xl overflow-hidden border bg-[#F8F9FA] flex items-center justify-center">
                  {fotoPreview ? (
                    <img
                      src={fotoPreview}
                      alt="Produto"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-xs text-[#6C757D]">SEM FOTO</div>
                  )}
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => fotoInputRef.current?.click()}
                    className="border px-3 py-2 rounded-lg w-full"
                    type="button"
                  >
                    ENVIAR FOTO
                  </button>

                  <button
                    onClick={() => {
                      setFotoBase64("");
                      setFotoUrl("");
                    }}
                    className="border px-3 py-2 rounded-lg"
                    type="button"
                  >
                    X
                  </button>
                </div>

                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) lerFoto(file);
                    e.currentTarget.value = "";
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FA]">
              <tr>
                <th className="p-3 text-left">PRODUTO</th>
                <th className="p-3 text-left">SKU</th>
                <th className="p-3 text-left">FISCAL</th>
                <th className="p-3 text-left">P. BALCÃO</th>
                <th className="p-3 text-left">P. INSTALAÇÃO</th>
                <th className="p-3 text-left">P. REVENDA</th>
                <th className="p-3 text-left">ESTOQUE</th>
                <th className="p-3 text-left">STATUS</th>
                <th className="p-3 text-right">AÇÕES</th>
              </tr>
            </thead>

            <tbody>
              {produtosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-[#6C757D]">
                    NENHUM PRODUTO ENCONTRADO.
                  </td>
                </tr>
              ) : (
                produtosFiltrados.map((p) => {
                  const fotoSrc = p.fotoBase64 || p.fotoUrl || "";

                  return (
                    <tr key={p.id} className="border-b">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden border bg-[#F8F9FA] flex items-center justify-center">
                            {fotoSrc ? (
                              <img
                                src={fotoSrc}
                                alt={p.nome}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] text-[#6C757D]">SEM FOTO</span>
                            )}
                          </div>

                          <div>
                            <div className="font-bold">{p.nome}</div>
                            <div className="text-xs text-[#6C757D]">
                              {p.categoria || "-"}{p.subcategoria ? ` / ${p.subcategoria}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <div>{p.codigoSku || "-"}</div>
                        <div className="text-xs text-[#6C757D]">
                          BARRAS: {p.codigoBarras || "-"}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="text-xs">
                          <b>NCM:</b> {p.ncm || "-"}
                        </div>
                        <div className="text-xs">
                          <b>CEST:</b> {p.cest || "-"}
                        </div>
                        <div className="text-xs">
                          <b>CFOP:</b> {p.cfop || "-"} • <b>CST:</b> {p.cstCsosn || "-"}
                        </div>
                        <div className="text-xs">
                          <b>ORIGEM:</b> {p.origem || "-"} • <b>UN:</b> {p.unidade || "-"}
                        </div>
                      </td>

                      <td className="p-3">{moneyBR(toMoney(p.precoBalcao))}</td>
                      <td className="p-3">{moneyBR(toMoney(p.precoInstalacao))}</td>
                      <td className="p-3">{moneyBR(toMoney(p.precoRevenda))}</td>

                      <td className="p-3">
                        {p.controlaEstoque ? (
                          <div>
                            <div><b>{toMoney(p.estoqueAtual)}</b></div>
                            <div className="text-xs text-[#6C757D]">
                              MÍN: {toMoney(p.estoqueMinimo)}
                            </div>
                          </div>
                        ) : (
                          "NÃO CONTROLA"
                        )}
                      </td>

                      <td className="p-3">{p.status}</td>

                      <td className="p-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => editarProduto(p)}
                            className="border px-3 py-1 rounded"
                            type="button"
                          >
                            EDITAR
                          </button>

                          <button
                            onClick={() => removerProduto(p.id)}
                            className="border px-3 py-1 rounded"
                            type="button"
                          >
                            REMOVER
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 bg-white rounded-2xl shadow p-4">
          <div className="text-sm font-bold text-[#6C757D] mb-2">MODELO DE CSV</div>
          <div className="text-xs text-[#6C757D] whitespace-pre-wrap">
            nome,sku,codigo_barras,categoria,subcategoria,ncm,cest,cfop,unidade,origem,cst_csosn,aliquota_icms,aliquota_pis,aliquota_cofins,preco_balcao,preco_instalacao,preco_revenda,controla_estoque,estoque_atual,estoque_minimo,status,foto_url
            {"\n"}
            LED H4,LED001,789000000001,ILUMINACAO,FAROL,85122019,2801200,5102,UN,0,102,18,1.65,7.60,120,150,90,SIM,10,2,ATIVO,https://exemplo.com/imagem.jpg
          </div>
        </div>
      </main>
    </div>
  );
}
