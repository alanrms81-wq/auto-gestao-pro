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

function statusClass(status: string) {
  return up(status) === "INATIVO" ? "status-inativo" : "status-ativo";
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
        `${f.razaoSocial} ${f.nomeFantasia || ""} ${f.cnpj} ${f.contato || ""} ${f.telefone || ""} ${f.celular || ""} ${f.whatsapp || ""} ${f.email || ""} ${f.cidade || ""} ${f.estado || ""}`
      );
      return texto.includes(q);
    });
  }, [fornecedores, busca]);

  const total = fornecedores.length;
  const totalAtivos = useMemo(
    () => fornecedores.filter((f) => f.status === "ATIVO").length,
    [fornecedores]
  );
  const totalInativos = total - totalAtivos;

  const ultimoCadastro = useMemo(() => {
    if (!fornecedores.length) return "-";

    const ordenados = [...fornecedores].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return ordenados[0]?.razaoSocial || "-";
  }, [fornecedores]);

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
    window.scrollTo({ top: 0, behavior: "smooth" });
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

        alert(`IMPORTAÇÃO CONCLUÍDA!\nCRIADOS: ${created}\nATUALIZADOS: ${updated}`);
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
    <div className="min-h-screen flex bg-[#F4F6F8]">
      <Sidebar />

      <main className="flex-1 min-w-0 p-4 md:p-6">
        <div className="mb-6 rounded-[26px] bg-gradient-to-r from-[#0456A3] to-[#0A6FD6] p-5 md:p-6 text-white shadow-lg">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
            <div>
              <p className="text-[12px] font-bold tracking-[0.2em] opacity-80">
                AUTO GESTÃO PRO
              </p>
              <h1 className="mt-2 text-[28px] md:text-[34px] font-black leading-none">
                FORNECEDORES
              </h1>
              <p className="mt-3 text-sm text-white/85 max-w-[760px]">
                Cadastro completo de fornecedores com consulta automática por CNPJ, importação em CSV e controle de status.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
              <KpiMini titulo="TOTAL" valor={String(total)} />
              <KpiMini titulo="ATIVOS" valor={String(totalAtivos)} />
              <KpiMini titulo="INATIVOS" valor={String(totalInativos)} />
              <KpiMini titulo="ÚLTIMO" valor={ultimoCadastro} destaque />
            </div>
          </div>

          <div className="mt-5 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
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
                NOVO FORNECEDOR
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

            <input
              placeholder="BUSCAR FORNECEDOR..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="header-search"
            />
          </div>
        </div>

        <section className="card mb-6">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                {editingId ? "EDITAR FORNECEDOR" : "NOVO FORNECEDOR"}
              </h2>
              <p className="section-subtitle">
                Mantenha os dados comerciais, fiscais e de endereço organizados.
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={salvarFornecedor}
                className="botao-azul"
                type="button"
              >
                {editingId ? "SALVAR ALTERAÇÕES" : "SALVAR FORNECEDOR"}
              </button>

              <button onClick={resetForm} className="botao" type="button">
                LIMPAR
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                placeholder="RAZÃO SOCIAL"
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                className="campo md:col-span-2"
              />

              <input
                placeholder="NOME FANTASIA"
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                className="campo"
              />

              <div className="flex gap-2">
                <input
                  placeholder="CNPJ"
                  value={cnpj}
                  onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                  onBlur={(e) => preencherCnpjAutomatico(e.target.value)}
                  className="campo flex-1"
                />
                <button
                  type="button"
                  onClick={() => preencherCnpjAutomatico(cnpj)}
                  className="botao h-[46px] whitespace-nowrap"
                >
                  {consultandoCnpj ? "..." : "BUSCAR"}
                </button>
              </div>

              <input
                placeholder="INSCRIÇÃO ESTADUAL"
                value={inscricaoEstadual}
                onChange={(e) => setInscricaoEstadual(e.target.value)}
                className="campo"
              />

              <input
                placeholder="CONTATO"
                value={contato}
                onChange={(e) => setContato(e.target.value)}
                className="campo"
              />

              <input
                placeholder="TELEFONE"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="campo"
              />

              <input
                placeholder="CELULAR"
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
                className="campo"
              />

              <input
                placeholder="WHATSAPP"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="campo"
              />

              <input
                placeholder="EMAIL"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="campo md:col-span-2"
              />

              <input
                placeholder="CEP"
                value={cep}
                onChange={(e) => setCep(maskCep(e.target.value))}
                className="campo"
              />

              <input
                placeholder="RUA"
                value={rua}
                onChange={(e) => setRua(e.target.value)}
                className="campo md:col-span-2"
              />

              <input
                placeholder="NÚMERO"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="campo"
              />

              <input
                placeholder="COMPLEMENTO"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                className="campo"
              />

              <input
                placeholder="BAIRRO"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                className="campo"
              />

              <input
                placeholder="CIDADE"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="campo"
              />

              <input
                placeholder="ESTADO"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="campo"
              />

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "ATIVO" | "INATIVO")}
                className="campo"
              >
                <option value="ATIVO">ATIVO</option>
                <option value="INATIVO">INATIVO</option>
              </select>

              <textarea
                placeholder="OBSERVAÇÕES"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="campo-textarea md:col-span-4"
              />
            </div>

            <div className="side-box">
              <div className="side-title">RESUMO DO CADASTRO</div>

              <div className="resumo-box">
                <div className="resumo-linha">
                  <span>RAZÃO SOCIAL</span>
                  <strong>{razaoSocial || "-"}</strong>
                </div>
                <div className="resumo-linha">
                  <span>FANTASIA</span>
                  <strong>{nomeFantasia || "-"}</strong>
                </div>
                <div className="resumo-linha">
                  <span>CNPJ</span>
                  <strong>{cnpj || "-"}</strong>
                </div>
                <div className="resumo-linha">
                  <span>CONTATO</span>
                  <strong>{contato || telefone || celular || whatsapp || "-"}</strong>
                </div>
                <div className="resumo-linha">
                  <span>CIDADE</span>
                  <strong>
                    {cidade || "-"} {estado ? `/ ${estado}` : ""}
                  </strong>
                </div>
                <div className="resumo-linha">
                  <span>STATUS</span>
                  <strong>{status}</strong>
                </div>
              </div>

              <div className="mt-4 modelo-box">
                <div className="modelo-title">MODELO DE CSV</div>
                <div className="modelo-text">
                  razaosocial,nomefantasia,cnpj,inscricaoestadual,contato,telefone,celular,whatsapp,email,cep,rua,numero,complemento,bairro,cidade,estado,observacoes,status
                  {"\n"}
                  FORNECEDOR EXEMPLO LTDA,EXEMPLO,11222333000181,123456789,JOÃO,14999999999,14999999999,14999999999,contato@exemplo.com,01001000,RUA X,100,SALA 1,CENTRO,SÃO PAULO,SP,FORNECEDOR PADRÃO,ATIVO
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">LISTA DE FORNECEDORES</h2>
              <p className="section-subtitle">
                Consulte, edite e organize seus fornecedores por status e localização.
              </p>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="tabela min-w-[1150px]">
              <thead>
                <tr>
                  <th>RAZÃO SOCIAL</th>
                  <th>CNPJ</th>
                  <th>CONTATO</th>
                  <th>EMAIL</th>
                  <th>CIDADE</th>
                  <th>STATUS</th>
                  <th>AÇÕES</th>
                </tr>
              </thead>

              <tbody>
                {fornecedoresFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      NENHUM FORNECEDOR ENCONTRADO.
                    </td>
                  </tr>
                ) : (
                  fornecedoresFiltrados.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <div className="font-bold text-[#0F172A]">{f.razaoSocial}</div>
                        <div className="text-xs text-[#64748B]">
                          {f.nomeFantasia || "-"}
                        </div>
                      </td>

                      <td>{f.cnpj}</td>

                      <td>
                        <div>{f.contato || "-"}</div>
                        <div className="text-xs text-[#64748B]">
                          {f.telefone || f.celular || f.whatsapp || "-"}
                        </div>
                      </td>

                      <td>{f.email || "-"}</td>

                      <td>
                        {f.cidade || "-"} {f.estado ? `/ ${f.estado}` : ""}
                      </td>

                      <td>
                        <span className={`status-chip ${statusClass(f.status)}`}>
                          {f.status}
                        </span>
                      </td>

                      <td>
                        <div className="flex gap-2 justify-end flex-wrap">
                          <button
                            onClick={() => editarFornecedor(f)}
                            className="botao-mini"
                            type="button"
                          >
                            EDITAR
                          </button>

                          <button
                            onClick={() => removerFornecedor(f.id)}
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

        .campo:focus,
        .campo-textarea:focus {
          border-color: #0a6fd6;
          box-shadow: 0 0 0 4px rgba(10, 111, 214, 0.08);
        }

        .campo::placeholder,
        .campo-textarea::placeholder {
          color: #94a3b8;
        }

        .campo-textarea {
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          padding: 12px;
          font-size: 14px;
          width: 100%;
          min-height: 110px;
          background: white;
          color: #0f172a;
          resize: vertical;
          outline: none;
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

        .header-search {
          height: 48px;
          width: 100%;
          max-width: 420px;
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

        .side-box {
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          padding: 16px;
          background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
        }

        .side-title {
          font-size: 13px;
          font-weight: 900;
          color: #475569;
          margin-bottom: 12px;
        }

        .resumo-box {
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 18px;
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

        .modelo-box {
          border: 1px dashed #cbd5e1;
          border-radius: 16px;
          padding: 12px;
          background: #f8fafc;
        }

        .modelo-title {
          font-size: 12px;
          font-weight: 900;
          color: #475569;
          margin-bottom: 8px;
        }

        .modelo-text {
          font-size: 11px;
          color: #64748b;
          white-space: pre-wrap;
          line-height: 1.5;
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
      <div className="mt-1 text-[18px] font-black leading-none truncate">
        {valor}
      </div>
    </div>
  );
}