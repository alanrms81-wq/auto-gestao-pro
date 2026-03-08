"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { canAccess, isLogged } from "@/lib/authGuard";

type Fornecedor = {
  id: number;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  inscricaoEstadual?: string;
  contato?: string;
  telefone?: string;
  celular?: string;
  whatsapp?: string;
  email?: string;

  cep?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;

  observacoes?: string;
  status: "ATIVO" | "INATIVO";
  createdAt: string;
};

const LS_FORNECEDORES = "fornecedores";

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

function onlyDigits(v: string) {
  return String(v || "").replace(/\D/g, "");
}

function maskCnpj(v: string) {
  const d = onlyDigits(v).slice(0, 14);

  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }

  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function maskCep(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
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

async function buscarFornecedorPorCnpj(cnpj: string) {
  const cnpjLimpo = onlyDigits(cnpj);

  if (cnpjLimpo.length !== 14) {
    throw new Error("CNPJ inválido");
  }

  const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
  if (!resp.ok) {
    throw new Error("Não foi possível consultar o CNPJ");
  }

  const data = await resp.json();

  return {
    razaoSocial: up(data.razao_social || ""),
    nomeFantasia: up(data.nome_fantasia || ""),
    email: String(data.email || "").trim(),
    telefone: String(data.ddd_telefone_1 || "").trim(),
    cep: maskCep(data.cep || ""),
    rua: up(data.logradouro || ""),
    numero: up(data.numero || ""),
    complemento: up(data.complemento || ""),
    bairro: up(data.bairro || ""),
    cidade: up(data.municipio || ""),
    estado: up(data.uf || ""),
  };
}

export default function FornecedoresPage() {
  const router = useRouter();
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const [ready, setReady] = useState(false);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [busca, setBusca] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);

  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [contato, setContato] = useState("");
  const [telefone, setTelefone] = useState("");
  const [celular, setCelular] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");

  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState<"ATIVO" | "INATIVO">("ATIVO");

  const [consultandoCnpj, setConsultandoCnpj] = useState(false);

  useEffect(() => {
    if (!isLogged()) {
      router.push("/login");
      return;
    }

    if (!canAccess("FORNECEDORES")) {
      alert("ACESSO NEGADO");
      router.push("/dashboard");
      return;
    }

    setFornecedores(readLS<Fornecedor[]>(LS_FORNECEDORES, []));
    setReady(true);
  }, [router]);

  const fornecedoresFiltrados = useMemo(() => {
    const q = up(busca.trim());
    if (!q) return fornecedores;

    return fornecedores.filter((f) => {
      const texto = up(
        `${f.razaoSocial} ${f.nomeFantasia || ""} ${f.cnpj} ${f.contato || ""} ${f.telefone || ""} ${f.email || ""} ${f.cidade || ""} ${f.estado || ""}`
      );
      return texto.includes(q);
    });
  }, [fornecedores, busca]);

  function resetForm() {
    setEditingId(null);
    setRazaoSocial("");
    setNomeFantasia("");
    setCnpj("");
    setInscricaoEstadual("");
    setContato("");
    setTelefone("");
    setCelular("");
    setWhatsapp("");
    setEmail("");
    setCep("");
    setRua("");
    setNumero("");
    setComplemento("");
    setBairro("");
    setCidade("");
    setEstado("");
    setObservacoes("");
    setStatus("ATIVO");
  }

  async function preencherCnpjAutomatico(cnpjValor: string) {
    const cnpjLimpo = onlyDigits(cnpjValor);
    if (cnpjLimpo.length !== 14) return;

    try {
      setConsultandoCnpj(true);
      const dados = await buscarFornecedorPorCnpj(cnpjLimpo);

      setRazaoSocial(dados.razaoSocial);
      setNomeFantasia(dados.nomeFantasia);
      setEmail(dados.email);
      setTelefone(dados.telefone);
      setCep(dados.cep);
      setRua(dados.rua);
      setNumero(dados.numero);
      setComplemento(dados.complemento);
      setBairro(dados.bairro);
      setCidade(dados.cidade);
      setEstado(dados.estado);
    } catch (e: any) {
      alert(e?.message || "NÃO FOI POSSÍVEL CONSULTAR O CNPJ.");
    } finally {
      setConsultandoCnpj(false);
    }
  }

  function salvarFornecedor() {
    const razao = up(razaoSocial.trim());
    const cnpjFinal = maskCnpj(cnpj);

    if (!razao) {
      alert("PREENCHA A RAZÃO SOCIAL.");
      return;
    }

    if (!onlyDigits(cnpjFinal)) {
      alert("PREENCHA O CNPJ.");
      return;
    }

    const lista = [...fornecedores];

    if (editingId) {
      const idx = lista.findIndex((x) => x.id === editingId);
      if (idx < 0) {
        alert("FORNECEDOR NÃO ENCONTRADO.");
        return;
      }

      const duplicado = lista.some(
        (x) => x.id !== editingId && onlyDigits(x.cnpj) === onlyDigits(cnpjFinal)
      );

      if (duplicado) {
        alert("JÁ EXISTE UM FORNECEDOR COM ESSE CNPJ.");
        return;
      }

      lista[idx] = {
        ...lista[idx],
        razaoSocial: razao,
        nomeFantasia: up(nomeFantasia.trim()),
        cnpj: cnpjFinal,
        inscricaoEstadual: up(inscricaoEstadual.trim()),
        contato: up(contato.trim()),
        telefone: telefone.trim(),
        celular: celular.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        cep: maskCep(cep),
        rua: up(rua.trim()),
        numero: up(numero.trim()),
        complemento: up(complemento.trim()),
        bairro: up(bairro.trim()),
        cidade: up(cidade.trim()),
        estado: up(estado.trim()),
        observacoes: up(observacoes.trim()),
        status,
      };

      writeLS(LS_FORNECEDORES, lista);
      setFornecedores(lista);
      resetForm();
      alert("FORNECEDOR ATUALIZADO!");
      return;
    }

    const existe = lista.some((x) => onlyDigits(x.cnpj) === onlyDigits(cnpjFinal));
    if (existe) {
      alert("JÁ EXISTE UM FORNECEDOR COM ESSE CNPJ.");
      return;
    }

    const novo: Fornecedor = {
      id: Date.now(),
      razaoSocial: razao,
      nomeFantasia: up(nomeFantasia.trim()),
      cnpj: cnpjFinal,
      inscricaoEstadual: up(inscricaoEstadual.trim()),
      contato: up(contato.trim()),
      telefone: telefone.trim(),
      celular: celular.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim(),
      cep: maskCep(cep),
      rua: up(rua.trim()),
      numero: up(numero.trim()),
      complemento: up(complemento.trim()),
      bairro: up(bairro.trim()),
      cidade: up(cidade.trim()),
      estado: up(estado.trim()),
      observacoes: up(observacoes.trim()),
      status,
      createdAt: new Date().toISOString(),
    };

    const next = [...lista, novo];
    writeLS(LS_FORNECEDORES, next);
    setFornecedores(next);
    resetForm();
    alert("FORNECEDOR CRIADO!");
  }

  function editarFornecedor(f: Fornecedor) {
    setEditingId(f.id);
    setRazaoSocial(f.razaoSocial || "");
    setNomeFantasia(f.nomeFantasia || "");
    setCnpj(f.cnpj || "");
    setInscricaoEstadual(f.inscricaoEstadual || "");
    setContato(f.contato || "");
    setTelefone(f.telefone || "");
    setCelular(f.celular || "");
    setWhatsapp(f.whatsapp || "");
    setEmail(f.email || "");
    setCep(f.cep || "");
    setRua(f.rua || "");
    setNumero(f.numero || "");
    setComplemento(f.complemento || "");
    setBairro(f.bairro || "");
    setCidade(f.cidade || "");
    setEstado(f.estado || "");
    setObservacoes(f.observacoes || "");
    setStatus(f.status || "ATIVO");
  }

  function removerFornecedor(id: number) {
    if (!confirm("REMOVER ESTE FORNECEDOR?")) return;

    const next = fornecedores.filter((x) => x.id !== id);
    writeLS(LS_FORNECEDORES, next);
    setFornecedores(next);
    alert("FORNECEDOR REMOVIDO!");
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

        const atuais = readLS<Fornecedor[]>(LS_FORNECEDORES, []);
        const next = [...atuais];

        let created = 0;
        let updated = 0;

        for (let i = 1; i < lines.length; i++) {
          const row = splitCsvLine(lines[i], delim);

          const razaoCsv = up(getCell(row, map, ["razaosocial", "razao", "nome"]));
          const fantasiaCsv = up(getCell(row, map, ["nomefantasia", "fantasia"]));
          const cnpjCsv = maskCnpj(getCell(row, map, ["cnpj"]));
          const ieCsv = up(getCell(row, map, ["ie", "inscricaoestadual"]));
          const contatoCsv = up(getCell(row, map, ["contato", "responsavel"]));
          const telefoneCsv = getCell(row, map, ["telefone", "fone"]);
          const celularCsv = getCell(row, map, ["celular"]);
          const whatsappCsv = getCell(row, map, ["whatsapp"]);
          const emailCsv = getCell(row, map, ["email", "e-mail"]);
          const cepCsv = maskCep(getCell(row, map, ["cep"]));
          const ruaCsv = up(getCell(row, map, ["rua", "logradouro", "endereco"]));
          const numeroCsv = up(getCell(row, map, ["numero", "n"]));
          const complementoCsv = up(getCell(row, map, ["complemento"]));
          const bairroCsv = up(getCell(row, map, ["bairro"]));
          const cidadeCsv = up(getCell(row, map, ["cidade", "municipio"]));
          const estadoCsv = up(getCell(row, map, ["estado", "uf"]));
          const obsCsv = up(getCell(row, map, ["observacoes", "obs"]));
          const statusCsv =
            up(getCell(row, map, ["status"]) || "ATIVO") === "INATIVO"
              ? "INATIVO"
              : "ATIVO";

          if (!razaoCsv && !onlyDigits(cnpjCsv)) continue;

          const idx = next.findIndex((f) => {
            if (onlyDigits(cnpjCsv) && onlyDigits(f.cnpj) === onlyDigits(cnpjCsv)) return true;
            return up(f.razaoSocial) === razaoCsv;
          });

          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              razaoSocial: razaoCsv || next[idx].razaoSocial,
              nomeFantasia: fantasiaCsv || next[idx].nomeFantasia,
              cnpj: cnpjCsv || next[idx].cnpj,
              inscricaoEstadual: ieCsv || next[idx].inscricaoEstadual,
              contato: contatoCsv || next[idx].contato,
              telefone: telefoneCsv || next[idx].telefone,
              celular: celularCsv || next[idx].celular,
              whatsapp: whatsappCsv || next[idx].whatsapp,
              email: emailCsv || next[idx].email,
              cep: cepCsv || next[idx].cep,
              rua: ruaCsv || next[idx].rua,
              numero: numeroCsv || next[idx].numero,
              complemento: complementoCsv || next[idx].complemento,
              bairro: bairroCsv || next[idx].bairro,
              cidade: cidadeCsv || next[idx].cidade,
              estado: estadoCsv || next[idx].estado,
              observacoes: obsCsv || next[idx].observacoes,
              status: statusCsv,
            };
            updated++;
          } else {
            next.push({
              id: Date.now() + i,
              razaoSocial: razaoCsv,
              nomeFantasia: fantasiaCsv,
              cnpj: cnpjCsv,
              inscricaoEstadual: ieCsv,
              contato: contatoCsv,
              telefone: telefoneCsv,
              celular: celularCsv,
              whatsapp: whatsappCsv,
              email: emailCsv,
              cep: cepCsv,
              rua: ruaCsv,
              numero: numeroCsv,
              complemento: complementoCsv,
              bairro: bairroCsv,
              cidade: cidadeCsv,
              estado: estadoCsv,
              observacoes: obsCsv,
              status: statusCsv,
              createdAt: new Date().toISOString(),
            });
            created++;
          }
        }

        writeLS(LS_FORNECEDORES, next);
        setFornecedores(next);

        alert(
          `IMPORTAÇÃO CONCLUÍDA!\nCRIADOS: ${created}\nATUALIZADOS: ${updated}`
        );
      } catch {
        alert("ERRO AO IMPORTAR CSV.");
      }
    };

    reader.readAsText(file, "utf-8");
  }

  const totalAtivos = useMemo(() => {
    return fornecedores.filter((f) => f.status === "ATIVO").length;
  }, [fornecedores]);

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F8F9FA]">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#6C757D]">FORNECEDORES</h1>
            <div className="text-sm text-[#6C757D]">
              CADASTRO COMPLETO COM CONSULTA AUTOMÁTICA POR CNPJ
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">TOTAL</div>
            <div className="text-3xl font-black mt-2">{fornecedores.length}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">ATIVOS</div>
            <div className="text-3xl font-black mt-2">{totalAtivos}</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-5">
            <div className="text-xs font-bold text-[#6C757D]">INATIVOS</div>
            <div className="text-3xl font-black mt-2">
              {fornecedores.length - totalAtivos}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow mb-6">
          <div className="text-sm font-bold text-[#6C757D] mb-3">
            {editingId ? "EDITAR FORNECEDOR" : "NOVO FORNECEDOR"}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              placeholder="RAZÃO SOCIAL"
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              className="border p-2 rounded md:col-span-2"
            />

            <input
              placeholder="NOME FANTASIA"
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
              className="border p-2 rounded"
            />

            <div className="flex gap-2">
              <input
                placeholder="CNPJ"
                value={cnpj}
                onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                onBlur={(e) => preencherCnpjAutomatico(e.target.value)}
                className="border p-2 rounded w-full"
              />
              <button
                type="button"
                onClick={() => preencherCnpjAutomatico(cnpj)}
                className="border px-3 rounded whitespace-nowrap"
              >
                {consultandoCnpj ? "..." : "BUSCAR"}
              </button>
            </div>

            <input
              placeholder="INSCRIÇÃO ESTADUAL"
              value={inscricaoEstadual}
              onChange={(e) => setInscricaoEstadual(e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="CONTATO"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="TELEFONE"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="CELULAR"
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="WHATSAPP"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="EMAIL"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border p-2 rounded md:col-span-2"
            />

            <input
              placeholder="CEP"
              value={cep}
              onChange={(e) => setCep(maskCep(e.target.value))}
              className="border p-2 rounded"
            />

            <input
              placeholder="RUA"
              value={rua}
              onChange={(e) => setRua(e.target.value)}
              className="border p-2 rounded md:col-span-2"
            />

            <input
              placeholder="NÚMERO"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="COMPLEMENTO"
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="BAIRRO"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="CIDADE"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="ESTADO"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
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

            <textarea
              placeholder="OBSERVAÇÕES"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="border p-2 rounded md:col-span-4 min-h-[90px]"
            />
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={salvarFornecedor}
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
                <th className="p-3 text-left">RAZÃO SOCIAL</th>
                <th className="p-3 text-left">CNPJ</th>
                <th className="p-3 text-left">CONTATO</th>
                <th className="p-3 text-left">EMAIL</th>
                <th className="p-3 text-left">CIDADE</th>
                <th className="p-3 text-left">STATUS</th>
                <th className="p-3 text-right">AÇÕES</th>
              </tr>
            </thead>

            <tbody>
              {fornecedoresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[#6C757D]">
                    NENHUM FORNECEDOR ENCONTRADO.
                  </td>
                </tr>
              ) : (
                fornecedoresFiltrados.map((f) => (
                  <tr key={f.id} className="border-b">
                    <td className="p-3">
                      <div className="font-bold">{f.razaoSocial}</div>
                      <div className="text-xs text-[#6C757D]">
                        {f.nomeFantasia || "-"}
                      </div>
                    </td>
                    <td className="p-3">{f.cnpj}</td>
                    <td className="p-3">
                      {f.contato || "-"}
                      <div className="text-xs text-[#6C757D]">{f.telefone || "-"}</div>
                    </td>
                    <td className="p-3">{f.email || "-"}</td>
                    <td className="p-3">
                      {f.cidade || "-"} {f.estado ? `/ ${f.estado}` : ""}
                    </td>
                    <td className="p-3">{f.status}</td>
                    <td className="p-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => editarFornecedor(f)}
                          className="border px-3 py-1 rounded"
                          type="button"
                        >
                          EDITAR
                        </button>

                        <button
                          onClick={() => removerFornecedor(f.id)}
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
          <div className="text-sm font-bold text-[#6C757D] mb-2">MODELO DE CSV</div>
          <div className="text-xs text-[#6C757D] whitespace-pre-wrap">
            razaosocial,nomefantasia,cnpj,inscricaoestadual,contato,telefone,celular,whatsapp,email,cep,rua,numero,complemento,bairro,cidade,estado,observacoes,status
            {"\n"}
            FORNECEDOR EXEMPLO LTDA,EXEMPLO,11222333000181,123456789,JOÃO,14999999999,14999999999,14999999999,contato@exemplo.com,01001000,RUA X,100,SALA 1,CENTRO,SÃO PAULO,SP,FORNECEDOR PADRÃO,ATIVO
          </div>
        </div>
      </main>
    </div>
  );
}
