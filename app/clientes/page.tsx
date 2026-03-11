"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import Pagination from "@/app/components/Pagination";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type Cliente = {
  id: string;
  empresa_id: string;
  nome: string;
  telefone?: string | null;
  celular?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  cpf_cnpj?: string | null;
  cep?: string | null;
  rua?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  observacoes?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type Veiculo = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  cliente_nome?: string | null;
  placa?: string | null;
  marca?: string | null;
  modelo?: string | null;
  ano?: string | null;
  cor?: string | null;
  combustivel?: string | null;
  km_atual?: string | null;
  chassi?: string | null;
  observacoes?: string | null;
  created_at?: string | null;
};

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

function maskCpfCnpj(v: string) {
  const d = onlyDigits(v);

  if (d.length <= 11) {
    const x = d.slice(0, 11);
    if (x.length <= 3) return x;
    if (x.length <= 6) return `${x.slice(0, 3)}.${x.slice(3)}`;
    if (x.length <= 9) return `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6)}`;
    return `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6, 9)}-${x.slice(9)}`;
  }

  const x = d.slice(0, 14);
  if (x.length <= 2) return x;
  if (x.length <= 5) return `${x.slice(0, 2)}.${x.slice(2)}`;
  if (x.length <= 8) return `${x.slice(0, 2)}.${x.slice(2, 5)}.${x.slice(5)}`;
  if (x.length <= 12) {
    return `${x.slice(0, 2)}.${x.slice(2, 5)}.${x.slice(5, 8)}/${x.slice(8)}`;
  }
  return `${x.slice(0, 2)}.${x.slice(2, 5)}.${x.slice(5, 8)}/${x.slice(8, 12)}-${x.slice(12)}`;
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

export default function ClientesPage() {
  const router = useRouter();
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const buscaTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");

  const [page, setPage] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const pageSize = 50;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string | null>(null);
  const [clienteSelecionadoNome, setClienteSelecionadoNome] = useState<string>("");

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [celular, setCelular] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState("ATIVO");
  const [consultandoCep, setConsultandoCep] = useState(false);

  const [editingVeiculoId, setEditingVeiculoId] = useState<string | null>(null);
  const [placa, setPlaca] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [cor, setCor] = useState("");
  const [combustivel, setCombustivel] = useState("");
  const [kmAtual, setKmAtual] = useState("");
  const [chassi, setChassi] = useState("");
  const [observacoesVeiculo, setObservacoesVeiculo] = useState("");

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
    carregarClientes(empresaId, buscaAplicada, page);
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

  async function carregarClientes(empId?: string, buscaAtual?: string, paginaAtual?: number) {
    const eid = empId || empresaId;
    if (!eid) return;

    setLoading(true);

    const pageNumber = paginaAtual || page;
    const termoBusca = (buscaAtual ?? buscaAplicada).trim();
    const from = (pageNumber - 1) * pageSize;
    const to = from + pageSize - 1;

    let queryCount = supabase
      .from("clientes")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", eid);

    let queryData = supabase
      .from("clientes")
      .select("*")
      .eq("empresa_id", eid);

    if (termoBusca) {
      const filtro = [
        `nome.ilike.%${termoBusca}%`,
        `telefone.ilike.%${termoBusca}%`,
        `celular.ilike.%${termoBusca}%`,
        `whatsapp.ilike.%${termoBusca}%`,
        `email.ilike.%${termoBusca}%`,
        `cpf_cnpj.ilike.%${termoBusca}%`,
        `cidade.ilike.%${termoBusca}%`,
        `estado.ilike.%${termoBusca}%`,
      ].join(",");

      queryCount = queryCount.or(filtro);
      queryData = queryData.or(filtro);
    }

    const { count, error: countError } = await queryCount;

    if (countError) {
      alert("ERRO AO CONTAR CLIENTES: " + countError.message);
      setLoading(false);
      return;
    }

    const { data, error } = await queryData
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      alert("ERRO AO CARREGAR CLIENTES: " + error.message);
    } else {
      setClientes((data || []) as Cliente[]);
      setTotalRegistros(count || 0);
    }

    setLoading(false);
  }

  async function carregarVeiculosCliente(clienteId: string) {
    if (!empresaId) return;

    const { data, error } = await supabase
      .from("veiculos")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });

    if (error) {
      alert("ERRO AO CARREGAR VEÍCULOS: " + error.message);
      return;
    }

    setVeiculos((data || []) as Veiculo[]);
  }

  const total = totalRegistros;
  const ativos = clientes.filter((c) => (c.status || "ATIVO") !== "INATIVO").length;
  const inativos = Math.max(0, totalRegistros - ativos);
  const totalVeiculos = veiculos.length;

  function resetForm() {
    setEditingId(null);
    setNome("");
    setTelefone("");
    setCelular("");
    setWhatsapp("");
    setEmail("");
    setCpfCnpj("");
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

  function resetVeiculoForm() {
    setEditingVeiculoId(null);
    setPlaca("");
    setMarca("");
    setModelo("");
    setAno("");
    setCor("");
    setCombustivel("");
    setKmAtual("");
    setChassi("");
    setObservacoesVeiculo("");
  }

  async function buscarCepAutomatico(cepValor: string) {
    const cepLimpo = onlyDigits(cepValor);
    if (cepLimpo.length !== 8) return;

    try {
      setConsultandoCep(true);
      const resp = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await resp.json();

      if (data.erro) {
        alert("CEP NÃO ENCONTRADO.");
        return;
      }

      setRua(up(data.logradouro || ""));
      setBairro(up(data.bairro || ""));
      setCidade(up(data.localidade || ""));
      setEstado(up(data.uf || ""));
      setComplemento(up(data.complemento || ""));
    } catch {
      alert("ERRO AO CONSULTAR CEP.");
    } finally {
      setConsultandoCep(false);
    }
  }

  async function salvarCliente() {
    if (!empresaId) return;

    if (!nome.trim()) {
      alert("PREENCHA O NOME.");
      return;
    }

    const payload = {
      empresa_id: empresaId,
      nome: up(nome.trim()),
      telefone: telefone.trim(),
      celular: celular.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim().toLowerCase(),
      cpf_cnpj: maskCpfCnpj(cpfCnpj),
      cep: maskCep(cep),
      rua: up(rua.trim()),
      numero: up(numero.trim()),
      complemento: up(complemento.trim()),
      bairro: up(bairro.trim()),
      cidade: up(cidade.trim()),
      estado: up(estado.trim()),
      observacoes: up(observacoes.trim()),
      status: up(status),
    };

    if (editingId) {
      const { error } = await supabase
        .from("clientes")
        .update(payload)
        .eq("id", editingId)
        .eq("empresa_id", empresaId);

      if (error) {
        alert("ERRO AO ATUALIZAR CLIENTE: " + error.message);
        return;
      }

      alert("CLIENTE ATUALIZADO!");
      await carregarClientes();
      return;
    }

    const { data, error } = await supabase
      .from("clientes")
      .insert([payload])
      .select("id,nome")
      .single();

    if (error) {
      alert("ERRO AO CRIAR CLIENTE: " + error.message);
      return;
    }

    alert("CLIENTE CRIADO!");
    resetForm();
    setPage(1);
    setBusca("");
    setBuscaAplicada("");
    await carregarClientes(empresaId, "", 1);

    if (data?.id) {
      setClienteSelecionadoId(data.id);
      setClienteSelecionadoNome(data.nome || "");
      setVeiculos([]);
    }
  }

  function editarCliente(c: Cliente) {
    setEditingId(c.id);
    setClienteSelecionadoId(c.id);
    setClienteSelecionadoNome(c.nome || "");

    setNome(c.nome || "");
    setTelefone(c.telefone || "");
    setCelular(c.celular || "");
    setWhatsapp(c.whatsapp || "");
    setEmail(c.email || "");
    setCpfCnpj(c.cpf_cnpj || "");
    setCep(c.cep || "");
    setRua(c.rua || "");
    setNumero(c.numero || "");
    setComplemento(c.complemento || "");
    setBairro(c.bairro || "");
    setCidade(c.cidade || "");
    setEstado(c.estado || "");
    setObservacoes(c.observacoes || "");
    setStatus(c.status || "ATIVO");

    carregarVeiculosCliente(c.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removerCliente(id: string) {
    if (!empresaId) return;
    if (!confirm("REMOVER ESTE CLIENTE?")) return;

    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      alert("ERRO AO REMOVER CLIENTE: " + error.message);
      return;
    }

    alert("CLIENTE REMOVIDO!");
    if (clienteSelecionadoId === id) {
      setClienteSelecionadoId(null);
      setClienteSelecionadoNome("");
      setVeiculos([]);
      resetVeiculoForm();
    }

    await carregarClientes();
  }

  function selecionarClienteParaVeiculos(c: Cliente) {
    setClienteSelecionadoId(c.id);
    setClienteSelecionadoNome(c.nome || "");
    resetVeiculoForm();
    carregarVeiculosCliente(c.id);
  }

  async function salvarVeiculo() {
    if (!empresaId) return;
    if (!clienteSelecionadoId) {
      alert("SELECIONE OU SALVE UM CLIENTE PRIMEIRO.");
      return;
    }

    if (!placa.trim() && !modelo.trim()) {
      alert("PREENCHA AO MENOS PLACA OU MODELO.");
      return;
    }

    const payload = {
      empresa_id: empresaId,
      cliente_id: clienteSelecionadoId,
      cliente_nome: up(clienteSelecionadoNome),
      placa: up(placa.trim()),
      marca: up(marca.trim()),
      modelo: up(modelo.trim()),
      ano: up(ano.trim()),
      cor: up(cor.trim()),
      combustivel: up(combustivel.trim()),
      km_atual: up(kmAtual.trim()),
      chassi: up(chassi.trim()),
      observacoes: up(observacoesVeiculo.trim()),
    };

    if (editingVeiculoId) {
      const { error } = await supabase
        .from("veiculos")
        .update(payload)
        .eq("id", editingVeiculoId)
        .eq("empresa_id", empresaId);

      if (error) {
        alert("ERRO AO ATUALIZAR VEÍCULO: " + error.message);
        return;
      }

      alert("VEÍCULO ATUALIZADO!");
      resetVeiculoForm();
      await carregarVeiculosCliente(clienteSelecionadoId);
      return;
    }

    const { error } = await supabase.from("veiculos").insert([payload]);

    if (error) {
      alert("ERRO AO CRIAR VEÍCULO: " + error.message);
      return;
    }

    alert("VEÍCULO CADASTRADO!");
    resetVeiculoForm();
    await carregarVeiculosCliente(clienteSelecionadoId);
  }

  function editarVeiculo(v: Veiculo) {
    setEditingVeiculoId(v.id);
    setPlaca(v.placa || "");
    setMarca(v.marca || "");
    setModelo(v.modelo || "");
    setAno(v.ano || "");
    setCor(v.cor || "");
    setCombustivel(v.combustivel || "");
    setKmAtual(v.km_atual || "");
    setChassi(v.chassi || "");
    setObservacoesVeiculo(v.observacoes || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removerVeiculo(id: string) {
    if (!empresaId || !clienteSelecionadoId) return;
    if (!confirm("REMOVER ESTE VEÍCULO?")) return;

    const { error } = await supabase
      .from("veiculos")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      alert("ERRO AO REMOVER VEÍCULO: " + error.message);
      return;
    }

    alert("VEÍCULO REMOVIDO!");
    await carregarVeiculosCliente(clienteSelecionadoId);
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

      const nomeCsv = up(getCell(row, map, ["nome", "cliente"]));
      const telefoneCsv = getCell(row, map, ["telefone", "fone"]);
      const celularCsv = getCell(row, map, ["celular"]);
      const whatsappCsv = getCell(row, map, ["whatsapp"]);
      const emailCsv = getCell(row, map, ["email", "e-mail"]).toLowerCase();
      const cpfCnpjCsv = maskCpfCnpj(
        getCell(row, map, ["cpfcnpj", "cpf_cnpj", "documento", "cpf", "cnpj"])
      );
      const cepCsv = maskCep(getCell(row, map, ["cep"]));
      const ruaCsv = up(getCell(row, map, ["rua", "logradouro", "endereco"]));
      const numeroCsv = up(getCell(row, map, ["numero", "n"]));
      const complementoCsv = up(getCell(row, map, ["complemento"]));
      const bairroCsv = up(getCell(row, map, ["bairro"]));
      const cidadeCsv = up(getCell(row, map, ["cidade", "municipio"]));
      const estadoCsv = up(getCell(row, map, ["estado", "uf"]));
      const obsCsv = up(getCell(row, map, ["observacoes", "obs"]));
      const statusCsv = up(getCell(row, map, ["status"]) || "ATIVO");

      if (!nomeCsv) continue;

      const { data: existente } = await supabase
        .from("clientes")
        .select("id")
        .eq("empresa_id", empresaId)
        .or(`nome.eq.${nomeCsv},cpf_cnpj.eq.${cpfCnpjCsv}`)
        .limit(1);

      const payload = {
        empresa_id: empresaId,
        nome: nomeCsv,
        telefone: telefoneCsv,
        celular: celularCsv,
        whatsapp: whatsappCsv,
        email: emailCsv,
        cpf_cnpj: cpfCnpjCsv,
        cep: cepCsv,
        rua: ruaCsv,
        numero: numeroCsv,
        complemento: complementoCsv,
        bairro: bairroCsv,
        cidade: cidadeCsv,
        estado: estadoCsv,
        observacoes: obsCsv,
        status: statusCsv === "INATIVO" ? "INATIVO" : "ATIVO",
      };

      if (existente && existente.length > 0) {
        const { error } = await supabase
          .from("clientes")
          .update(payload)
          .eq("id", existente[0].id)
          .eq("empresa_id", empresaId);

        if (!error) updated++;
      } else {
        const { error } = await supabase.from("clientes").insert([payload]);
        if (!error) created++;
      }
    }

    alert(`IMPORTAÇÃO CONCLUÍDA!\nCRIADOS: ${created}\nATUALIZADOS: ${updated}`);
    setPage(1);
    setBusca("");
    setBuscaAplicada("");
    await carregarClientes(empresaId, "", 1);
  }

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

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
                CLIENTES
              </h1>
              <p className="mt-3 text-sm text-white/85">
                CADASTRO DE CLIENTES E VEÍCULOS COM BUSCA RÁPIDA E FLUXO ORGANIZADO
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
              <KpiMini titulo="TOTAL" valor={String(total)} />
              <KpiMini titulo="ATIVOS" valor={String(ativos)} />
              <KpiMini titulo="INATIVOS" valor={String(inativos)} />
              <KpiMini titulo="VEÍCULOS" valor={String(totalVeiculos)} destaque />
            </div>
          </div>

          <div className="mt-5 flex gap-3 flex-wrap">
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
              NOVO CLIENTE
            </button>

            <input
              placeholder="BUSCAR CLIENTE..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-[48px] w-[320px] xl:w-[410px] max-w-full rounded-2xl border border-white/20 bg-white/10 px-5 text-[16px] text-white outline-none placeholder:text-white/70"
            />

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
                {editingId ? "EDITAR CLIENTE" : "NOVO CLIENTE"}
              </h2>
              <p className="section-subtitle">
                Cadastre os dados do cliente, endereço e observações em um só fluxo.
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button onClick={salvarCliente} className="botao-azul" type="button">
                {editingId ? "SALVAR ALTERAÇÕES" : "SALVAR CLIENTE"}
              </button>

              <button onClick={resetForm} className="botao" type="button">
                LIMPAR
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              placeholder="NOME"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="campo md:col-span-2"
            />

            <input
              placeholder="CPF / CNPJ"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(maskCpfCnpj(e.target.value))}
              className="campo"
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
              className="campo"
            />

            <div className="md:col-span-1 flex gap-2">
              <input
                placeholder="CEP"
                value={cep}
                onChange={(e) => setCep(maskCep(e.target.value))}
                onBlur={(e) => buscarCepAutomatico(e.target.value)}
                className="campo flex-1"
              />
              <button
                type="button"
                onClick={() => buscarCepAutomatico(cep)}
                className="botao-secundario min-w-[96px]"
              >
                {consultandoCep ? "..." : "BUSCAR"}
              </button>
            </div>

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

            <textarea
              placeholder="OBSERVAÇÕES"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="campo-textarea md:col-span-4"
            />
          </div>
        </section>

        <section className="card mb-6">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                VEÍCULOS DO CLIENTE {clienteSelecionadoNome ? `- ${clienteSelecionadoNome}` : ""}
              </h2>
              <p className="section-subtitle">
                Vincule veículos ao cliente selecionado e mantenha o histórico organizado.
              </p>
            </div>

            {!clienteSelecionadoId && (
              <span className="helper-badge">
                SELECIONE UM CLIENTE NO HISTÓRICO PARA CADASTRAR VEÍCULOS
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              placeholder="PLACA"
              value={placa}
              onChange={(e) => setPlaca(e.target.value)}
              className="campo"
              disabled={!clienteSelecionadoId}
            />

            <input
              placeholder="MARCA"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              className="campo"
              disabled={!clienteSelecionadoId}
            />

            <input
              placeholder="MODELO"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              className="campo"
              disabled={!clienteSelecionadoId}
            />

            <input
              placeholder="ANO"
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              className="campo"
              disabled={!clienteSelecionadoId}
            />

            <input
              placeholder="COR"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              className="campo"
              disabled={!clienteSelecionadoId}
            />

            <input
              placeholder="COMBUSTÍVEL"
              value={combustivel}
              onChange={(e) => setCombustivel(e.target.value)}
              className="campo"
              disabled={!clienteSelecionadoId}
            />

            <input
              placeholder="KM ATUAL"
              value={kmAtual}
              onChange={(e) => setKmAtual(e.target.value)}
              className="campo"
              disabled={!clienteSelecionadoId}
            />

            <input
              placeholder="CHASSI"
              value={chassi}
              onChange={(e) => setChassi(e.target.value)}
              className="campo"
              disabled={!clienteSelecionadoId}
            />

            <textarea
              placeholder="OBSERVAÇÕES DO VEÍCULO"
              value={observacoesVeiculo}
              onChange={(e) => setObservacoesVeiculo(e.target.value)}
              className="campo-textarea md:col-span-4"
              disabled={!clienteSelecionadoId}
            />
          </div>

          <div className="flex gap-3 mt-5 flex-wrap">
            <button
              onClick={salvarVeiculo}
              className="botao-azul"
              type="button"
              disabled={!clienteSelecionadoId}
            >
              {editingVeiculoId ? "SALVAR VEÍCULO" : "ADICIONAR VEÍCULO"}
            </button>

            <button onClick={resetVeiculoForm} className="botao" type="button">
              LIMPAR
            </button>
          </div>

          <div className="overflow-auto mt-6">
            <table className="tabela min-w-[980px]">
              <thead>
                <tr>
                  <th>PLACA</th>
                  <th>MARCA</th>
                  <th>MODELO</th>
                  <th>ANO</th>
                  <th>COR</th>
                  <th>COMBUSTÍVEL</th>
                  <th>KM</th>
                  <th>AÇÕES</th>
                </tr>
              </thead>

              <tbody>
                {!clienteSelecionadoId ? (
                  <tr>
                    <td colSpan={8} className="empty-state">
                      SELECIONE UM CLIENTE PARA VER OS VEÍCULOS.
                    </td>
                  </tr>
                ) : veiculos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-state">
                      NENHUM VEÍCULO CADASTRADO.
                    </td>
                  </tr>
                ) : (
                  veiculos.map((v) => (
                    <tr key={v.id}>
                      <td className="font-bold">{v.placa || "-"}</td>
                      <td>{v.marca || "-"}</td>
                      <td>{v.modelo || "-"}</td>
                      <td>{v.ano || "-"}</td>
                      <td>{v.cor || "-"}</td>
                      <td>{v.combustivel || "-"}</td>
                      <td>{v.km_atual || "-"}</td>
                      <td>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => editarVeiculo(v)}
                            className="botao-mini"
                            type="button"
                          >
                            EDITAR
                          </button>

                          <button
                            onClick={() => removerVeiculo(v.id)}
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

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">HISTÓRICO DE CLIENTES</h2>
              <p className="section-subtitle">
                Busque, edite, selecione veículos e mantenha a base organizada.
              </p>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="tabela min-w-[1100px]">
              <thead>
                <tr>
                  <th>CLIENTE</th>
                  <th>CONTATO</th>
                  <th>DOCUMENTO</th>
                  <th>ENDEREÇO</th>
                  <th>STATUS</th>
                  <th>AÇÕES</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      CARREGANDO...
                    </td>
                  </tr>
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      NENHUM CLIENTE ENCONTRADO.
                    </td>
                  </tr>
                ) : (
                  clientes.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="font-bold text-[#111]">{c.nome}</div>
                        <div className="text-xs text-[#64748B]">{c.email || "-"}</div>
                      </td>

                      <td>
                        <div>{c.telefone || "-"}</div>
                        <div className="text-xs text-[#64748B]">
                          {c.celular || c.whatsapp || "-"}
                        </div>
                      </td>

                      <td>{c.cpf_cnpj || "-"}</td>

                      <td>
                        <div>
                          {[c.rua, c.numero].filter(Boolean).join(", ") || "-"}
                        </div>
                        <div className="text-xs text-[#64748B]">
                          {[c.bairro, c.cidade, c.estado].filter(Boolean).join(" / ") || "-"}
                        </div>
                      </td>

                      <td>
                        <span className={`status-chip ${statusClass(c.status || "ATIVO")}`}>
                          {c.status || "ATIVO"}
                        </span>
                      </td>

                      <td>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => editarCliente(c)}
                            className="botao-mini"
                            type="button"
                          >
                            EDITAR
                          </button>

                          <button
                            onClick={() => selecionarClienteParaVeiculos(c)}
                            className="botao-mini"
                            type="button"
                          >
                            VEÍCULOS
                          </button>

                          <button
                            onClick={() => removerCliente(c.id)}
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
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          padding: 0 12px;
          font-size: 14px;
          width: 100%;
          background: white;
          color: #0f172a;
          outline: none;
          transition: 0.2s;
        }

        .campo:focus,
        .campo-textarea:focus {
          border-color: #0a6fd6;
          box-shadow: 0 0 0 4px rgba(10, 111, 214, 0.08);
        }

        .campo-textarea {
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          padding: 10px 12px;
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

        .botao-secundario {
          height: 46px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 0 16px;
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

        .helper-badge {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          border-radius: 999px;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 800;
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
      className={`rounded-[18px] px-4 py-3 ${
        destaque ? "bg-white text-[#0456A3]" : "bg-white/12 text-white border border-white/15"
      }`}
    >
      <div className="text-[10px] font-bold tracking-[0.12em] opacity-80">{titulo}</div>
      <div className="mt-1 text-[18px] font-black leading-none">{valor}</div>
    </div>
  );
}