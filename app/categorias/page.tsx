"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { canAccess, isLogged } from "@/lib/authGuard";

type CategoriaItem = {
  id: number;
  categoria: string;
  subcategoria: string;
  descricao?: string;
  status: "ATIVO" | "INATIVO";
  createdAt: string;
};

const LS_CATEGORIAS = "categorias_subcategorias";

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

export default function CategoriasPage() {
  const router = useRouter();
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const [ready, setReady] = useState(false);
  const [itens, setItens] = useState<CategoriaItem[]>([]);
  const [busca, setBusca] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [categoria, setCategoria] = useState("");
  const [subcategoria, setSubcategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState<"ATIVO" | "INATIVO">("ATIVO");

  useEffect(() => {
    if (!isLogged()) {
      router.push("/login");
      return;
    }

    if (!canAccess("CATEGORIAS")) {
      alert("ACESSO NEGADO");
      router.push("/dashboard");
      return;
    }

    setItens(readLS<CategoriaItem[]>(LS_CATEGORIAS, []));
    setReady(true);
  }, [router]);

  const itensFiltrados = useMemo(() => {
    const q = up(busca.trim());
    if (!q) return itens;

    return itens.filter((item) => {
      const texto = up(
        `${item.categoria} ${item.subcategoria} ${item.descricao || ""} ${item.status}`
      );
      return texto.includes(q);
    });
  }, [itens, busca]);

  const totalCategorias = useMemo(() => {
    return new Set(itens.map((i) => up(i.categoria))).size;
  }, [itens]);

  const totalSubcategorias = useMemo(() => itens.length, [itens]);

  const totalAtivos = useMemo(() => {
    return itens.filter((i) => i.status === "ATIVO").length;
  }, [itens]);

  function resetForm() {
    setEditingId(null);
    setCategoria("");
    setSubcategoria("");
    setDescricao("");
    setStatus("ATIVO");
  }

  function salvarItem() {
    const cat = up(categoria.trim());
    const sub = up(subcategoria.trim());

    if (!cat) {
      alert("PREENCHA A CATEGORIA.");
      return;
    }

    if (!sub) {
      alert("PREENCHA A SUBCATEGORIA.");
      return;
    }

    const lista = [...itens];

    if (editingId) {
      const idx = lista.findIndex((x) => x.id === editingId);
      if (idx < 0) {
        alert("ITEM NÃO ENCONTRADO.");
        return;
      }

      const duplicado = lista.some(
        (x) =>
          x.id !== editingId &&
          up(x.categoria) === cat &&
          up(x.subcategoria) === sub
      );

      if (duplicado) {
        alert("JÁ EXISTE ESTA CATEGORIA / SUBCATEGORIA.");
        return;
      }

      lista[idx] = {
        ...lista[idx],
        categoria: cat,
        subcategoria: sub,
        descricao: up(descricao.trim()),
        status,
      };

      writeLS(LS_CATEGORIAS, lista);
      setItens(lista);
      resetForm();
      alert("ITEM ATUALIZADO!");
      return;
    }

    const existe = lista.some(
      (x) => up(x.categoria) === cat && up(x.subcategoria) === sub
    );

    if (existe) {
      alert("JÁ EXISTE ESTA CATEGORIA / SUBCATEGORIA.");
      return;
    }

    const novo: CategoriaItem = {
      id: Date.now(),
      categoria: cat,
      subcategoria: sub,
      descricao: up(descricao.trim()),
      status,
      createdAt: new Date().toISOString(),
    };

    const next = [...lista, novo];
    writeLS(LS_CATEGORIAS, next);
    setItens(next);
    resetForm();
    alert("ITEM CRIADO!");
  }

  function editarItem(item: CategoriaItem) {
    setEditingId(item.id);
    setCategoria(item.categoria || "");
    setSubcategoria(item.subcategoria || "");
    setDescricao(item.descricao || "");
    setStatus(item.status || "ATIVO");
  }

  function removerItem(id: number) {
    if (!confirm("REMOVER ESTE ITEM?")) return;

    const next = itens.filter((x) => x.id !== id);
    writeLS(LS_CATEGORIAS, next);
    setItens(next);
    alert("ITEM REMOVIDO!");
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

        const atuais = readLS<CategoriaItem[]>(LS_CATEGORIAS, []);
        const next = [...atuais];

        let created = 0;
        let updated = 0;

        for (let i = 1; i < lines.length; i++) {
          const row = splitCsvLine(lines[i], delim);

          const categoriaCsv = up(
            getCell(row, map, ["categoria", "grupo", "family"])
          );
          const subcategoriaCsv = up(
            getCell(row, map, ["subcategoria", "subgrupo", "subcategory"])
          );
          const descricaoCsv = up(
            getCell(row, map, ["descricao", "descrição", "obs", "observacoes"])
          );
          const statusCsv =
            up(getCell(row, map, ["status"]) || "ATIVO") === "INATIVO"
              ? "INATIVO"
              : "ATIVO";

          if (!categoriaCsv || !subcategoriaCsv) continue;

          const idx = next.findIndex(
            (x) =>
              up(x.categoria) === categoriaCsv &&
              up(x.subcategoria) === subcategoriaCsv
          );

          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              categoria: categoriaCsv,
              subcategoria: subcategoriaCsv,
              descricao: descricaoCsv || next[idx].descricao || "",
              status: statusCsv,
            };
            updated++;
          } else {
            next.push({
              id: Date.now() + i,
              categoria: categoriaCsv,
              subcategoria: subcategoriaCsv,
              descricao: descricaoCsv,
              status: statusCsv,
              createdAt: new Date().toISOString(),
            });
            created++;
          }
        }

        writeLS(LS_CATEGORIAS, next);
        setItens(next);

        alert(
          `IMPORTAÇÃO CONCLUÍDA!\nCRIADOS: ${created}\nATUALIZADOS: ${updated}`
        );
      } catch {
        alert("ERRO AO IMPORTAR CSV.");
      }
    };

    reader.readAsText(file, "utf-8");
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
              CATEGORIAS E SUBCATEGORIAS
            </h1>
            <div className="text-sm text-[#6C757D]">
              CADASTRO E IMPORTAÇÃO PROFISSIONAL
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <input
              placeholder="BUSCAR..."
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

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">CATEGORIAS</div>
            <div className="text-3xl font-black mt-2">{totalCategorias}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">SUBCATEGORIAS</div>
            <div className="text-3xl font-black mt-2">{totalSubcategorias}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">ATIVOS</div>
            <div className="text-3xl font-black mt-2">{totalAtivos}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">INATIVOS</div>
            <div className="text-3xl font-black mt-2">
              {itens.length - totalAtivos}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow mb-6">
          <div className="text-sm font-bold text-[#6C757D] mb-3">
            {editingId ? "EDITAR ITEM" : "NOVO ITEM"}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
              placeholder="DESCRIÇÃO"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="border p-2 rounded"
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "ATIVO" | "INATIVO")}
              className="border p-2 rounded bg-white"
            >
              <option value="ATIVO">ATIVO</option>
              <option value="INATIVO">INATIVO</option>
            </select>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={salvarItem}
              className="bg-[#0A569E] text-white px-4 py-2 rounded-lg"
              type="button"
            >
              {editingId ? "SALVAR ALTERAÇÕES" : "SALVAR"}
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

        <div className="bg-white rounded-2xl shadow overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FA]">
              <tr>
                <th className="p-3 text-left">CATEGORIA</th>
                <th className="p-3 text-left">SUBCATEGORIA</th>
                <th className="p-3 text-left">DESCRIÇÃO</th>
                <th className="p-3 text-left">STATUS</th>
                <th className="p-3 text-left">CRIADO EM</th>
                <th className="p-3 text-right">AÇÕES</th>
              </tr>
            </thead>

            <tbody>
              {itensFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[#6C757D]">
                    NENHUM ITEM ENCONTRADO.
                  </td>
                </tr>
              ) : (
                itensFiltrados.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-3 font-bold">{item.categoria}</td>
                    <td className="p-3">{item.subcategoria}</td>
                    <td className="p-3">{item.descricao || "-"}</td>
                    <td className="p-3">{item.status}</td>
                    <td className="p-3">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleString("pt-BR")
                        : "-"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => editarItem(item)}
                          className="border px-3 py-1 rounded"
                          type="button"
                        >
                          EDITAR
                        </button>

                        <button
                          onClick={() => removerItem(item.id)}
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

        <div className="mt-4 bg-white rounded-2xl shadow p-4">
          <div className="text-sm font-bold text-[#6C757D] mb-2">
            MODELO DE CSV
          </div>

          <div className="text-xs text-[#6C757D] whitespace-pre-wrap">
            categoria,subcategoria,descricao,status
            {"\n"}
            ILUMINAÇÃO,FAROL,LÂMPADAS E ACESSÓRIOS,ATIVO
            {"\n"}
            SENSORES,RÉ,SENSORES DE ESTACIONAMENTO,ATIVO
          </div>
        </div>
      </main>
    </div>
  );
}
