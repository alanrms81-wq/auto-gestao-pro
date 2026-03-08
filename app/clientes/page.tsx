"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import { canAccess, isLogged } from "@/lib/authGuard";

type Cliente = {
  id: number;
  nome: string;
  telefone: string;
  email?: string;
  cpfCnpj?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  observacoes?: string;
  status: "ATIVO" | "INATIVO";
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

type Ordem = {
  id: number;
  numero?: string;
  clienteId?: number | null;
  clienteNome?: string;
  veiculoId?: number | null;
  status?: string;
  total?: number;
  dataISO?: string;
  createdAt?: string;
  observacoes?: string;
};

const LS_CLIENTES = "clientes";
const LS_VEICULOS = "veiculos";
const LS_ORDENS_A = "ordens";
const LS_ORDENS_B = "ordensServico";

function up(v: any) {
  return String(v ?? "").toUpperCase();
}

function onlyDigits(v: string) {
  return String(v || "").replace(/\D/g, "");
}

function maskCep(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
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

async function buscarCep(cep: string) {
  const cepLimpo = onlyDigits(cep);
  if (cepLimpo.length !== 8) {
    throw new Error("CEP inválido");
  }

  const resp = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
  if (!resp.ok) throw new Error("Erro ao consultar CEP");

  const data = await resp.json();
  if (data.erro) throw new Error("CEP não encontrado");

  return {
    rua: up(data.logradouro || ""),
    bairro: up(data.bairro || ""),
    cidade: up(data.localidade || ""),
    estado: up(data.uf || ""),
  };
}

export default function ClientesPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [ready, setReady] = useState(false);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [ordens, setOrdens] = useState<Ordem[]>([]);

  const [busca, setBusca] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<number | null>(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");

  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState<"ATIVO" | "INATIVO">("ATIVO");
  const [consultandoCep, setConsultandoCep] = useState(false);

  const [editingVeiculoId, setEditingVeiculoId] = useState<number | null>(null);
  const [placa, setPlaca] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [cor, setCor] = useState("");
  const [combustivel, setCombustivel] = useState("");
  const [km, setKm] = useState("");
  const [chassi, setChassi] = useState("");
  const [obsVeiculo, setObsVeiculo] = useState("");
  const [statusVeiculo, setStatusVeiculo] = useState<"ATIVO" | "INATIVO">("ATIVO");

  useEffect(() => {
    if (!isLogged()) {
      router.push("/login");
      return;
    }

    if (!canAccess("CLIENTES")) {
      alert("ACESSO NEGADO");
      router.push("/dashboard");
      return;
    }

    const c = readLS<Cliente[]>(LS_CLIENTES, []);
    const v = readLS<Veiculo[]>(LS_VEICULOS, []);
    const oA = readLS<Ordem[]>(LS_ORDENS_A, []);
    const oB = readLS<Ordem[]>(LS_ORDENS_B, []);

    setClientes(c);
    setVeiculos(v);
    setOrdens(oA.length ? oA : oB);
    setReady(true);
  }, [router]);

  const clientesFiltrados = useMemo(() => {
    const q = up(busca.trim());
    if (!q) return clientes;

    return clientes.filter((c) => {
      const texto = up(
        `${c.nome} ${c.telefone} ${c.email || ""} ${c.cpfCnpj || ""} ${c.cidade || ""} ${c.estado || ""}`
      );
      return texto.includes(q);
    });
  }, [clientes, busca]);

  const clienteSelecionado = useMemo(() => {
    if (!clienteSelecionadoId) return null;
    return clientes.find((c) => c.id === clienteSelecionadoId) || null;
  }, [clienteSelecionadoId, clientes]);

  const veiculosDoCliente = useMemo(() => {
    if (!clienteSelecionadoId) return [];
    return veiculos.filter((v) => v.clienteId === clienteSelecionadoId);
  }, [veiculos, clienteSelecionadoId]);

  const ordensDoCliente = useMemo(() => {
    if (!clienteSelecionado) return [];
    return ordens
      .filter((o) => {
        if (o.clienteId && o.clienteId === clienteSelecionado.id) return true;
        if (o.clienteNome && up(o.clienteNome) === up(clienteSelecionado.nome)) return true;
        return false;
      })
      .sort((a, b) => {
        const da = new Date(a.dataISO || a.createdAt || 0).getTime();
        const db = new Date(b.dataISO || b.createdAt || 0).getTime();
        return db - da;
      });
  }, [ordens, clienteSelecionado]);

  function resetForm() {
    setEditingId(null);
    setNome("");
    setTelefone("");
    setEmail("");
    setCpfCnpj("");
    setCep("");
    setRua("");
    setNumero("");
    setBairro("");
    setCidade("");
    setEstado("");
    setObservacoes("");
    setStatus("ATIVO");
  }

  function resetVeiculoForm() {
    setEditingVeiculoId(null);
    setPlaca("");
    setMarca("");
    setModelo("");
    setAno("");
    setCor("");
    setCombustivel("");
    setKm("");
    setChassi("");
    setObsVeiculo("");
    setStatusVeiculo("ATIVO");
  }

  async function preencherCepAutomatico(cepValor: string) {
    const cepLimpo = onlyDigits(cepValor);
    if (cepLimpo.length !== 8) return;

    try {
      setConsultandoCep(true);
      const dados = await buscarCep(cepLimpo);
      setRua(dados.rua);
      setBairro(dados.bairro);
      setCidade(dados.cidade);
      setEstado(dados.estado);
    } catch (e: any) {
      alert(e?.message || "NÃO FOI POSSÍVEL CONSULTAR O CEP.");
    } finally {
      setConsultandoCep(false);
    }
  }

  function salvarCliente() {
    if (!nome.trim()) {
      alert("PREENCHA O NOME.");
      return;
    }

    const lista = [...clientes];

    if (editingId) {
      const idx = lista.findIndex((x) => x.id === editingId);
      if (idx < 0) {
        alert("CLIENTE NÃO ENCONTRADO.");
        return;
      }

      lista[idx] = {
        ...lista[idx],
        nome: up(nome),
        telefone,
        email: email.trim(),
        cpfCnpj: up(cpfCnpj),
        cep: maskCep(cep),
        rua: up(rua),
        numero: up(numero),
        bairro: up(bairro),
        cidade: up(cidade),
        estado: up(estado),
        observacoes: up(observacoes),
        status,
      };

      writeLS(LS_CLIENTES, lista);
      setClientes(lista);
      setClienteSelecionadoId(lista[idx].id);
      resetForm();
      alert("CLIENTE ATUALIZADO!");
      return;
    }

    const novo: Cliente = {
      id: Date.now(),
      nome: up(nome),
      telefone,
      email: email.trim(),
      cpfCnpj: up(cpfCnpj),
      cep: maskCep(cep),
      rua: up(rua),
      numero: up(numero),
      bairro: up(bairro),
      cidade: up(cidade),
      estado: up(estado),
      observacoes: up(observacoes),
      status,
    };

    const next = [...lista, novo];
    writeLS(LS_CLIENTES, next);
    setClientes(next);
    setClienteSelecionadoId(novo.id);
    resetForm();
    alert("CLIENTE CRIADO!");
  }

  function editarCliente(c: Cliente) {
    setEditingId(c.id);
    setClienteSelecionadoId(c.id);
    setNome(c.nome || "");
    setTelefone(c.telefone || "");
    setEmail(c.email || "");
    setCpfCnpj(c.cpfCnpj || "");
    setCep(c.cep || "");
    setRua(c.rua || "");
    setNumero(c.numero || "");
    setBairro(c.bairro || "");
    setCidade(c.cidade || "");
    setEstado(c.estado || "");
    setObservacoes(c.observacoes || "");
    setStatus(c.status || "ATIVO");
  }

  function removerCliente(id: number) {
    if (!confirm("REMOVER CLIENTE?")) return;

    const nextClientes = clientes.filter((c) => c.id !== id);
    const nextVeiculos = veiculos.filter((v) => v.clienteId !== id);

    writeLS(LS_CLIENTES, nextClientes);
    writeLS(LS_VEICULOS, nextVeiculos);

    setClientes(nextClientes);
    setVeiculos(nextVeiculos);

    if (clienteSelecionadoId === id) {
      setClienteSelecionadoId(null);
      resetVeiculoForm();
    }
  }

  function salvarVeiculo() {
    if (!clienteSelecionadoId) {
      alert("SELECIONE UM CLIENTE PRIMEIRO.");
      return;
    }

    if (!placa.trim() && !modelo.trim()) {
      alert("PREENCHA PLACA OU MODELO.");
      return;
    }

    const lista = [...veiculos];

    if (editingVeiculoId) {
      const idx = lista.findIndex((x) => x.id === editingVeiculoId);
      if (idx < 0) {
        alert("VEÍCULO NÃO ENCONTRADO.");
        return;
      }

      lista[idx] = {
        ...lista[idx],
        clienteId: clienteSelecionadoId,
        placa: up(placa),
        marca: up(marca),
        modelo: up(modelo),
        ano: up(ano),
        cor: up(cor),
        combustivel: up(combustivel),
        km: km.trim(),
        chassi: up(chassi),
        observacoes: up(obsVeiculo),
        status: statusVeiculo,
      };

      writeLS(LS_VEICULOS, lista);
      setVeiculos(lista);
      resetVeiculoForm();
      alert("VEÍCULO ATUALIZADO!");
      return;
    }

    const novo: Veiculo = {
      id: Date.now(),
      clienteId: clienteSelecionadoId,
      placa: up(placa),
      marca: up(marca),
      modelo: up(modelo),
      ano: up(ano),
      cor: up(cor),
      combustivel: up(combustivel),
      km: km.trim(),
      chassi: up(chassi),
      observacoes: up(obsVeiculo),
      status: statusVeiculo,
    };

    const next = [...lista, novo];
    writeLS(LS_VEICULOS, next);
    setVeiculos(next);
    resetVeiculoForm();
    alert("VEÍCULO ADICIONADO!");
  }

  function editarVeiculo(v: Veiculo) {
    setEditingVeiculoId(v.id);
    setPlaca(v.placa || "");
    setMarca(v.marca || "");
    setModelo(v.modelo || "");
    setAno(v.ano || "");
    setCor(v.cor || "");
    setCombustivel(v.combustivel || "");
    setKm(v.km || "");
    setChassi(v.chassi || "");
    setObsVeiculo(v.observacoes || "");
    setStatusVeiculo((v.status || "ATIVO") as "ATIVO" | "INATIVO");
  }

  function removerVeiculo(id: number) {
    if (!confirm("REMOVER VEÍCULO?")) return;
    const next = veiculos.filter((v) => v.id !== id);
    writeLS(LS_VEICULOS, next);
    setVeiculos(next);
  }

  function importarCSVInteligente(file: File) {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        if (lines.length < 2) {
          alert("CSV VAZIO OU INVÁLIDO");
          return;
        }

        const delim = detectDelimiter(lines[0]);
        const headers = splitCsvLine(lines[0], delim);
        const map = mapHeaderIndex(headers);

        const atuais = readLS<Cliente[]>(LS_CLIENTES, []);
        const next = [...atuais];

        let created = 0;
        let updated = 0;

        for (let i = 1; i < lines.length; i++) {
          const row = splitCsvLine(lines[i], delim);

          const nomeCsv = up(getCell(row, map, ["nome", "cliente", "razaosocial"]));
          if (!nomeCsv) continue;

          const telefoneCsv = getCell(row, map, ["telefone", "celular", "fone"]);
          const emailCsv = getCell(row, map, ["email", "e-mail"]);
          const cpfCnpjCsv = up(getCell(row, map, ["cpfcnpj", "cpf", "cnpj"]));
          const cepCsv = maskCep(getCell(row, map, ["cep"]));
          const ruaCsv = up(getCell(row, map, ["rua", "logradouro", "endereco"]));
          const numeroCsv = up(getCell(row, map, ["numero", "n"]));
          const bairroCsv = up(getCell(row, map, ["bairro"]));
          const cidadeCsv = up(getCell(row, map, ["cidade"]));
          const estadoCsv = up(getCell(row, map, ["estado", "uf"]));
          const observacoesCsv = up(getCell(row, map, ["observacoes", "obs"]));
          const statusCsv =
            up(getCell(row, map, ["status"]) || "ATIVO") === "INATIVO" ? "INATIVO" : "ATIVO";

          const idx = next.findIndex((c) => {
            if (cpfCnpjCsv && up(c.cpfCnpj || "") === cpfCnpjCsv) return true;
            if (emailCsv && String(c.email || "").toLowerCase() === String(emailCsv).toLowerCase()) return true;
            if (telefoneCsv && onlyDigits(c.telefone || "") === onlyDigits(telefoneCsv)) return true;
            if (up(c.nome) === nomeCsv) return true;
            return false;
          });

          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              nome: nomeCsv || next[idx].nome,
              telefone: telefoneCsv || next[idx].telefone,
              email: emailCsv || next[idx].email,
              cpfCnpj: cpfCnpjCsv || next[idx].cpfCnpj,
              cep: cepCsv || next[idx].cep,
              rua: ruaCsv || next[idx].rua,
              numero: numeroCsv || next[idx].numero,
              bairro: bairroCsv || next[idx].bairro,
              cidade: cidadeCsv || next[idx].cidade,
              estado: estadoCsv || next[idx].estado,
              observacoes: observacoesCsv || next[idx].observacoes,
              status: statusCsv,
            };
            updated++;
          } else {
            next.push({
              id: Date.now() + i,
              nome: nomeCsv,
              telefone: telefoneCsv,
              email: emailCsv,
              cpfCnpj: cpfCnpjCsv,
              cep: cepCsv,
              rua: ruaCsv,
              numero: numeroCsv,
              bairro: bairroCsv,
              cidade: cidadeCsv,
              estado: estadoCsv,
              observacoes: observacoesCsv,
              status: statusCsv,
            });
            created++;
          }
        }

        writeLS(LS_CLIENTES, next);
        setClientes(next);

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
    <div className="min-h-screen flex bg-[#F8F9FA]">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 mb-6">
          <h1 className="text-2xl font-black text-[#6C757D]">CLIENTES</h1>

          <div className="flex gap-2 flex-wrap">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="BUSCAR CLIENTE..."
              className="border px-3 py-2 rounded-lg"
            />

            <button
              onClick={() => fileRef.current?.click()}
              className="border px-4 py-2 rounded-lg hover:bg-[#F8F9FA]"
            >
              IMPORTAR CSV
            </button>

            <input
              type="file"
              ref={fileRef}
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importarCSVInteligente(file);
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
          <section className="2xl:col-span-2 space-y-6">
            <div className="bg-white p-4 rounded-2xl shadow">
              <div className="text-sm font-bold text-[#6C757D] mb-3">
                {editingId ? "EDITAR CLIENTE" : "NOVO CLIENTE"}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  placeholder="NOME"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="border p-2 rounded md:col-span-2"
                />

                <input
                  placeholder="TELEFONE"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="border p-2 rounded"
                />

                <input
                  placeholder="EMAIL"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border p-2 rounded"
                />

                <input
                  placeholder="CPF / CNPJ"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  className="border p-2 rounded"
                />

                <div className="flex gap-2">
                  <input
                    placeholder="CEP"
                    value={cep}
                    onChange={(e) => setCep(maskCep(e.target.value))}
                    onBlur={(e) => preencherCepAutomatico(e.target.value)}
                    className="border p-2 rounded w-full"
                  />
                  <button
                    type="button"
                    onClick={() => preencherCepAutomatico(cep)}
                    className="border px-3 rounded whitespace-nowrap"
                  >
                    {consultandoCep ? "..." : "CEP"}
                  </button>
                </div>

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

                <input
                  placeholder="OBSERVAÇÕES"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="border p-2 rounded md:col-span-4"
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={salvarCliente}
                  className="bg-[#0A569E] text-white px-4 py-2 rounded"
                >
                  {editingId ? "SALVAR ALTERAÇÕES" : "SALVAR CLIENTE"}
                </button>

                <button
                  onClick={resetForm}
                  className="border px-4 py-2 rounded"
                >
                  LIMPAR
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left">NOME</th>
                    <th className="p-3 text-left">TELEFONE</th>
                    <th className="p-3 text-left">EMAIL</th>
                    <th className="p-3 text-left">CIDADE</th>
                    <th className="p-3 text-left">CEP</th>
                    <th className="p-3 text-right">AÇÕES</th>
                  </tr>
                </thead>

                <tbody>
                  {clientesFiltrados.length === 0 ? (
                    <tr>
                      <td className="p-6 text-center" colSpan={6}>
                        NENHUM CLIENTE CADASTRADO
                      </td>
                    </tr>
                  ) : (
                    clientesFiltrados.map((c) => (
                      <tr
                        key={c.id}
                        className={[
                          "border-b cursor-pointer",
                          clienteSelecionadoId === c.id ? "bg-blue-50" : "",
                        ].join(" ")}
                        onClick={() => setClienteSelecionadoId(c.id)}
                      >
                        <td className="p-3 font-semibold">{c.nome}</td>
                        <td className="p-3">{c.telefone || "-"}</td>
                        <td className="p-3">{c.email || "-"}</td>
                        <td className="p-3">{c.cidade || "-"}</td>
                        <td className="p-3">{c.cep || "-"}</td>

                        <td className="p-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                editarCliente(c);
                              }}
                              className="border px-3 py-1 rounded"
                            >
                              EDITAR
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removerCliente(c.id);
                              }}
                              className="border px-3 py-1 rounded"
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

            <div className="bg-white rounded-2xl shadow p-4">
              <div className="text-sm font-bold text-[#6C757D] mb-2">
                MODELO DE CSV
              </div>
              <div className="text-xs text-[#6C757D] whitespace-pre-wrap">
                nome,telefone,email,cpfCnpj,cep,rua,numero,bairro,cidade,estado,observacoes,status
                {"\n"}
                JOÃO SILVA,14999999999,joao@email.com,12345678900,17200000,RUA A,100,CENTRO,JAÚ,SP,CLIENTE NOVO,ATIVO
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="text-sm font-bold text-[#6C757D] mb-2">
                CLIENTE SELECIONADO
              </div>

              {!clienteSelecionado ? (
                <div className="text-sm text-[#6C757D]">
                  SELECIONE UM CLIENTE NA LISTA.
                </div>
              ) : (
                <div className="space-y-1 text-sm">
                  <div><b>NOME:</b> {clienteSelecionado.nome}</div>
                  <div><b>TELEFONE:</b> {clienteSelecionado.telefone || "-"}</div>
                  <div><b>E-MAIL:</b> {clienteSelecionado.email || "-"}</div>
                  <div><b>CPF/CNPJ:</b> {clienteSelecionado.cpfCnpj || "-"}</div>
                  <div>
                    <b>ENDEREÇO:</b>{" "}
                    {`${clienteSelecionado.rua || "-"}${clienteSelecionado.numero ? `, ${clienteSelecionado.numero}` : ""} — ${clienteSelecionado.bairro || "-"} — ${clienteSelecionado.cidade || "-"} / ${clienteSelecionado.estado || "-"}`}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-[#6C757D]">VEÍCULOS</div>
                {clienteSelecionado && (
                  <div className="text-xs text-[#6C757D]">
                    {veiculosDoCliente.length} veículo(s)
                  </div>
                )}
              </div>

              {clienteSelecionado ? (
                <>
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      placeholder="PLACA"
                      value={placa}
                      onChange={(e) => setPlaca(e.target.value)}
                      className="border p-2 rounded"
                    />
                    <input
                      placeholder="MARCA"
                      value={marca}
                      onChange={(e) => setMarca(e.target.value)}
                      className="border p-2 rounded"
                    />
                    <input
                      placeholder="MODELO"
                      value={modelo}
                      onChange={(e) => setModelo(e.target.value)}
                      className="border p-2 rounded"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="ANO"
                        value={ano}
                        onChange={(e) => setAno(e.target.value)}
                        className="border p-2 rounded"
                      />
                      <input
                        placeholder="COR"
                        value={cor}
                        onChange={(e) => setCor(e.target.value)}
                        className="border p-2 rounded"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="COMBUSTÍVEL"
                        value={combustivel}
                        onChange={(e) => setCombustivel(e.target.value)}
                        className="border p-2 rounded"
                      />
                      <input
                        placeholder="KM"
                        value={km}
                        onChange={(e) => setKm(e.target.value)}
                        className="border p-2 rounded"
                      />
                    </div>
                    <input
                      placeholder="CHASSI"
                      value={chassi}
                      onChange={(e) => setChassi(e.target.value)}
                      className="border p-2 rounded"
                    />
                    <input
                      placeholder="OBSERVAÇÕES DO VEÍCULO"
                      value={obsVeiculo}
                      onChange={(e) => setObsVeiculo(e.target.value)}
                      className="border p-2 rounded"
                    />
                    <select
                      value={statusVeiculo}
                      onChange={(e) => setStatusVeiculo(e.target.value as "ATIVO" | "INATIVO")}
                      className="border p-2 rounded bg-white"
                    >
                      <option value="ATIVO">ATIVO</option>
                      <option value="INATIVO">INATIVO</option>
                    </select>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={salvarVeiculo}
                      className="bg-[#0A569E] text-white px-4 py-2 rounded"
                    >
                      {editingVeiculoId ? "SALVAR VEÍCULO" : "ADICIONAR VEÍCULO"}
                    </button>

                    <button
                      onClick={resetVeiculoForm}
                      className="border px-4 py-2 rounded"
                    >
                      LIMPAR
                    </button>
                  </div>

                  <div className="mt-4 space-y-2">
                    {veiculosDoCliente.length === 0 ? (
                      <div className="text-sm text-[#6C757D]">
                        NENHUM VEÍCULO VINCULADO.
                      </div>
                    ) : (
                      veiculosDoCliente.map((v) => (
                        <div
                          key={v.id}
                          className="border rounded-xl p-3 text-sm"
                        >
                          <div className="font-bold">
                            {up(v.marca || "")} {up(v.modelo || "")} {v.placa ? `— ${up(v.placa)}` : ""}
                          </div>
                          <div className="text-[#6C757D] mt-1">
                            ANO: {v.ano || "-"} | COR: {v.cor || "-"} | KM: {v.km || "-"}
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => editarVeiculo(v)}
                              className="border px-3 py-1 rounded"
                            >
                              EDITAR
                            </button>
                            <button
                              onClick={() => removerVeiculo(v.id)}
                              className="border px-3 py-1 rounded"
                            >
                              REMOVER
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="text-sm text-[#6C757D]">
                  SELECIONE UM CLIENTE PARA GERENCIAR VEÍCULOS.
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-[#6C757D]">HISTÓRICO DE OS</div>
                {clienteSelecionado && (
                  <div className="text-xs text-[#6C757D]">
                    {ordensDoCliente.length} registro(s)
                  </div>
                )}
              </div>

              {!clienteSelecionado ? (
                <div className="text-sm text-[#6C757D]">
                  SELECIONE UM CLIENTE PARA VER O HISTÓRICO.
                </div>
              ) : ordensDoCliente.length === 0 ? (
                <div className="text-sm text-[#6C757D]">
                  NENHUMA ORDEM DE SERVIÇO ENCONTRADA.
                </div>
              ) : (
                <div className="space-y-2">
                  {ordensDoCliente.map((o) => (
                    <div key={o.id} className="border rounded-xl p-3 text-sm">
                      <div className="font-bold">
                        {o.numero || `OS #${o.id}`}
                      </div>
                      <div className="text-[#6C757D] mt-1">
                        STATUS: {up(o.status || "-")}
                      </div>
                      <div className="text-[#6C757D]">
                        DATA: {o.dataISO || o.createdAt ? new Date(o.dataISO || o.createdAt || "").toLocaleString() : "-"}
                      </div>
                      <div className="text-[#6C757D]">
                        TOTAL: R$ {toMoney(o.total).toFixed(2)}
                      </div>
                      {o.observacoes ? (
                        <div className="mt-1 text-[#6C757D]">
                          OBS: {o.observacoes}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
