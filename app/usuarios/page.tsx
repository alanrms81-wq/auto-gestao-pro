"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type UsuarioEmpresa = {
  id: string;
  empresa_id: string;
  auth_user_id?: string | null;
  nome: string;
  email: string;
  senha_hash?: string | null;
  perfil: string;
  status: string;
  created_at?: string | null;
};

type Permissao = {
  id?: string;
  empresa_id?: string;
  usuario_id?: string;
  modulo: string;
  pode_ver: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
};

const MODULOS = [
  "DASHBOARD",
  "CLIENTES",
  "VEICULOS",
  "PRODUTOS",
  "SERVICOS",
  "ORDENS",
  "VENDAS",
  "FINANCEIRO",
  "ESTOQUE",
  "RELATORIOS",
  "USUARIOS",
  "CONFIGURACOES",
  "CONTAS_FINANCEIRAS",
  "TAXAS_CARTAO",
];

function up(v: unknown) {
  return String(v ?? "").toUpperCase().trim();
}

function normalizarPermissoesBase(): Permissao[] {
  return MODULOS.map((modulo) => ({
    modulo,
    pode_ver: false,
    pode_criar: false,
    pode_editar: false,
    pode_excluir: false,
  }));
}

function aplicarPerfilPadrao(perfil: string): Permissao[] {
  const base = normalizarPermissoesBase();

  const liberar = (
    modulo: string,
    ver = true,
    criar = false,
    editar = false,
    excluir = false
  ) => {
    const item = base.find((p) => p.modulo === modulo);
    if (!item) return;
    item.pode_ver = ver;
    item.pode_criar = criar;
    item.pode_editar = editar;
    item.pode_excluir = excluir;
  };

  const p = up(perfil);

  if (p === "ADMIN") {
    base.forEach((item) => {
      item.pode_ver = true;
      item.pode_criar = true;
      item.pode_editar = true;
      item.pode_excluir = true;
    });
    return base;
  }

  if (p === "GERENTE") {
    [
      "DASHBOARD",
      "CLIENTES",
      "VEICULOS",
      "PRODUTOS",
      "SERVICOS",
      "ORDENS",
      "VENDAS",
      "ESTOQUE",
      "RELATORIOS",
    ].forEach((m) => liberar(m, true, true, true, false));

    liberar("FINANCEIRO", true, false, false, false);
    liberar("USUARIOS", true, false, false, false);
    liberar("CONFIGURACOES", true, false, false, false);
    liberar("CONTAS_FINANCEIRAS", false, false, false, false);
    liberar("TAXAS_CARTAO", false, false, false, false);
    return base;
  }

  if (p === "ATENDENTE") {
    liberar("DASHBOARD", true, false, false, false);
    liberar("CLIENTES", true, true, true, false);
    liberar("VEICULOS", true, true, true, false);
    liberar("ORDENS", true, true, true, false);
    liberar("VENDAS", true, true, true, false);
    liberar("PRODUTOS", true, false, false, false);
    liberar("SERVICOS", true, false, false, false);
    return base;
  }

  if (p === "TECNICO") {
    liberar("DASHBOARD", true, false, false, false);
    liberar("ORDENS", true, true, true, false);
    liberar("CLIENTES", true, false, false, false);
    liberar("VEICULOS", true, false, false, false);
    liberar("PRODUTOS", true, false, false, false);
    liberar("SERVICOS", true, false, false, false);
    return base;
  }

  if (p === "FINANCEIRO") {
    liberar("DASHBOARD", true, false, false, false);
    liberar("FINANCEIRO", true, true, true, false);
    liberar("RELATORIOS", true, false, false, false);
    liberar("VENDAS", true, false, false, false);
    liberar("ORDENS", true, false, false, false);
    liberar("CLIENTES", true, false, false, false);
    liberar("CONTAS_FINANCEIRAS", false, false, false, false);
    liberar("TAXAS_CARTAO", false, false, false, false);
    return base;
  }

  return base;
}

export default function UsuariosPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>([]);
  const [busca, setBusca] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState("ATENDENTE");
  const [status, setStatus] = useState("ATIVO");

  const [permissoes, setPermissoes] = useState<Permissao[]>(normalizarPermissoesBase());

  useEffect(() => {
    async function init() {
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

  async function carregarBase(empId?: string) {
    const eid = empId || empresaId;
    if (!eid) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("usuarios_empresa")
      .select("*")
      .eq("empresa_id", eid)
      .order("created_at", { ascending: false });

    if (error) {
      alert("ERRO AO CARREGAR USUÁRIOS: " + error.message);
      setLoading(false);
      return;
    }

    setUsuarios((data || []) as UsuarioEmpresa[]);
    setLoading(false);
  }

  function resetForm() {
    setEditingId(null);
    setNome("");
    setEmail("");
    setPerfil("ATENDENTE");
    setStatus("ATIVO");
    setPermissoes(aplicarPerfilPadrao("ATENDENTE"));
  }

  function aplicarPerfilAutomatico(novoPerfil: string) {
    setPerfil(novoPerfil);
    setPermissoes(aplicarPerfilPadrao(novoPerfil));
  }

  function atualizarPermissao(
    modulo: string,
    campo: "pode_ver" | "pode_criar" | "pode_editar" | "pode_excluir",
    valor: boolean
  ) {
    setPermissoes((prev) =>
      prev.map((item) => {
        if (item.modulo !== modulo) return item;

        const atualizado = { ...item, [campo]: valor };

        if (campo === "pode_ver" && !valor) {
          atualizado.pode_criar = false;
          atualizado.pode_editar = false;
          atualizado.pode_excluir = false;
        }

        if (
          (campo === "pode_criar" || campo === "pode_editar" || campo === "pode_excluir") &&
          valor
        ) {
          atualizado.pode_ver = true;
        }

        return atualizado;
      })
    );
  }

  async function salvarUsuario() {
    if (!empresaId) return;

    if (!nome.trim()) {
      alert("PREENCHA O NOME.");
      return;
    }

    if (!email.trim()) {
      alert("PREENCHA O EMAIL.");
      return;
    }

    const payload = {
      empresa_id: empresaId,
      nome: up(nome),
      email: email.trim().toLowerCase(),
      perfil: up(perfil),
      status: up(status),
    };

    let usuarioId = editingId;

    if (editingId) {
      const { error } = await supabase
        .from("usuarios_empresa")
        .update(payload)
        .eq("id", editingId)
        .eq("empresa_id", empresaId);

      if (error) {
        alert("ERRO AO ATUALIZAR USUÁRIO: " + error.message);
        return;
      }

      const { error: delError } = await supabase
        .from("usuarios_permissoes")
        .delete()
        .eq("empresa_id", empresaId)
        .eq("usuario_id", editingId);

      if (delError) {
        alert("USUÁRIO SALVO, MAS ERRO AO LIMPAR PERMISSÕES: " + delError.message);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("usuarios_empresa")
        .insert([payload])
        .select("id")
        .single();

      if (error || !data) {
        alert("ERRO AO CRIAR USUÁRIO: " + (error?.message || ""));
        return;
      }

      usuarioId = data.id;
    }

    const permissoesPayload = permissoes.map((p) => ({
      empresa_id: empresaId,
      usuario_id: usuarioId,
      modulo: p.modulo,
      pode_ver: !!p.pode_ver,
      pode_criar: !!p.pode_criar,
      pode_editar: !!p.pode_editar,
      pode_excluir: !!p.pode_excluir,
    }));

    if (permissoesPayload.length > 0) {
      const { error } = await supabase
        .from("usuarios_permissoes")
        .insert(permissoesPayload);

      if (error) {
        alert("USUÁRIO SALVO, MAS ERRO AO SALVAR PERMISSÕES: " + error.message);
        return;
      }
    }

    alert(editingId ? "USUÁRIO ATUALIZADO!" : "USUÁRIO CRIADO!");
    resetForm();
    await carregarBase();
  }

  async function editarUsuario(u: UsuarioEmpresa) {
    if (!empresaId) return;

    setEditingId(u.id);
    setNome(u.nome || "");
    setEmail(u.email || "");
    setPerfil(u.perfil || "ATENDENTE");
    setStatus(u.status || "ATIVO");

    const { data, error } = await supabase
      .from("usuarios_permissoes")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("usuario_id", u.id)
      .order("modulo");

    if (error) {
      alert("ERRO AO CARREGAR PERMISSÕES: " + error.message);
      return;
    }

    const existentes = (data || []) as Permissao[];
    const base = normalizarPermissoesBase().map((item) => {
      const atual = existentes.find((p) => p.modulo === item.modulo);
      return atual
        ? {
            ...item,
            pode_ver: !!atual.pode_ver,
            pode_criar: !!atual.pode_criar,
            pode_editar: !!atual.pode_editar,
            pode_excluir: !!atual.pode_excluir,
          }
        : item;
    });

    setPermissoes(base);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removerUsuario(id: string) {
    if (!empresaId) return;
    if (!confirm("REMOVER ESTE USUÁRIO?")) return;

    const { error } = await supabase
      .from("usuarios_empresa")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      alert("ERRO AO REMOVER USUÁRIO: " + error.message);
      return;
    }

    alert("USUÁRIO REMOVIDO!");
    if (editingId === id) resetForm();
    await carregarBase();
  }

  const usuariosFiltrados = useMemo(() => {
    const q = up(busca);
    if (!q) return usuarios;

    return usuarios.filter((u) =>
      up(`${u.nome} ${u.email} ${u.perfil} ${u.status}`).includes(q)
    );
  }, [usuarios, busca]);

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
                USUÁRIOS E PERMISSÕES
              </h1>
              <p className="mt-3 text-sm text-white/85">
                CADASTRE USUÁRIOS E DEFINA ACESSO POR MÓDULO
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 min-w-0">
              <KpiMini titulo="USUÁRIOS" valor={String(usuarios.length)} />
              <KpiMini
                titulo="ATIVOS"
                valor={String(usuarios.filter((u) => up(u.status) === "ATIVO").length)}
              />
              <KpiMini titulo="PERFIS" valor="5" destaque />
            </div>
          </div>

          <div className="mt-5 flex gap-3 flex-wrap">
            <button onClick={salvarUsuario} className="botao-header-primary" type="button">
              {editingId ? "SALVAR ALTERAÇÕES" : "SALVAR USUÁRIO"}
            </button>

            <button onClick={resetForm} className="botao-header" type="button">
              NOVO USUÁRIO
            </button>

            <input
              placeholder="BUSCAR USUÁRIO..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-[48px] w-[320px] xl:w-[410px] max-w-full rounded-2xl border border-white/20 bg-white/10 px-5 text-[16px] text-white outline-none placeholder:text-white/70"
            />
          </div>
        </div>

        <section className="card mb-6">
          <div className="section-header">
            <div>
              <h2 className="section-title">
                {editingId ? "EDITAR USUÁRIO" : "NOVO USUÁRIO"}
              </h2>
              <p className="section-subtitle">
                Defina o perfil base e ajuste manualmente as permissões.
              </p>
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
              placeholder="EMAIL"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

            <div className="md:col-span-2">
              <label className="label">PERFIL BASE</label>
              <select
                value={perfil}
                onChange={(e) => aplicarPerfilAutomatico(e.target.value)}
                className="campo"
              >
                <option value="ADMIN">ADMIN</option>
                <option value="GERENTE">GERENTE</option>
                <option value="ATENDENTE">ATENDENTE</option>
                <option value="TECNICO">TÉCNICO</option>
                <option value="FINANCEIRO">FINANCEIRO</option>
              </select>
            </div>
          </div>
        </section>

        <section className="card mb-6">
          <div className="section-header">
            <div>
              <h2 className="section-title">PERMISSÕES POR MÓDULO</h2>
              <p className="section-subtitle">
                Controle o que cada usuário pode ver, criar, editar e excluir.
              </p>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="tabela min-w-[900px]">
              <thead>
                <tr>
                  <th>MÓDULO</th>
                  <th>VER</th>
                  <th>CRIAR</th>
                  <th>EDITAR</th>
                  <th>EXCLUIR</th>
                </tr>
              </thead>
              <tbody>
                {permissoes.map((p) => (
                  <tr key={p.modulo}>
                    <td className="font-bold">{p.modulo}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={p.pode_ver}
                        onChange={(e) => atualizarPermissao(p.modulo, "pode_ver", e.target.checked)}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={p.pode_criar}
                        onChange={(e) =>
                          atualizarPermissao(p.modulo, "pode_criar", e.target.checked)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={p.pode_editar}
                        onChange={(e) =>
                          atualizarPermissao(p.modulo, "pode_editar", e.target.checked)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={p.pode_excluir}
                        onChange={(e) =>
                          atualizarPermissao(p.modulo, "pode_excluir", e.target.checked)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <div>
              <h2 className="section-title">USUÁRIOS CADASTRADOS</h2>
              <p className="section-subtitle">
                Consulte, edite e remova usuários da empresa.
              </p>
            </div>
          </div>

          <div className="overflow-auto">
            <table className="tabela min-w-[1000px]">
              <thead>
                <tr>
                  <th>NOME</th>
                  <th>EMAIL</th>
                  <th>PERFIL</th>
                  <th>STATUS</th>
                  <th>CRIADO EM</th>
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
                ) : usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      NENHUM USUÁRIO ENCONTRADO.
                    </td>
                  </tr>
                ) : (
                  usuariosFiltrados.map((u) => (
                    <tr key={u.id}>
                      <td className="font-bold">{u.nome}</td>
                      <td>{u.email}</td>
                      <td>{u.perfil}</td>
                      <td>{u.status}</td>
                      <td>
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString("pt-BR")
                          : "-"}
                      </td>
                      <td>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => editarUsuario(u)}
                            className="botao-mini"
                            type="button"
                          >
                            EDITAR
                          </button>

                          <button
                            onClick={() => removerUsuario(u.id)}
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
          background: white;
          color: #0f172a;
          outline: none;
          transition: 0.2s;
        }

        .campo:focus {
          border-color: #0a6fd6;
          box-shadow: 0 0 0 4px rgba(10, 111, 214, 0.08);
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

        .botao-header-primary {
          border: none;
          background: white;
          color: #0456a3;
          font-weight: 900;
          border-radius: 14px;
          padding: 11px 18px;
          font-size: 13px;
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