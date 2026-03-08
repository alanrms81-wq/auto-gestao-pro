"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { canAccess, isLogged } from "@/lib/authGuard";

type Role = "ADMIN" | "FUNCIONARIO";

type Privilegio =
  | "DASHBOARD"
  | "CLIENTES"
  | "ORDENS"
  | "PRODUTOS"
  | "CATEGORIAS"
  | "FORNECEDORES"
  | "VENDAS"
  | "FINANCEIRO"
  | "USUARIOS";

type Usuario = {
  id: number;
  usuario: string;
  nome: string;
  senha: string;
  role: Role;
  status: "ATIVO" | "INATIVO";
  privilegios?: Privilegio[];
};

const LS_USUARIOS = "usuarios";

const PRIVILEGIOS_LISTA: Privilegio[] = [
  "DASHBOARD",
  "CLIENTES",
  "ORDENS",
  "PRODUTOS",
  "CATEGORIAS",
  "FORNECEDORES",
  "VENDAS",
  "FINANCEIRO",
  "USUARIOS",
];

function up(v: any) {
  return String(v ?? "").toUpperCase();
}

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLS<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function seedUsuarios() {
  const lista = readLS<Usuario[]>(LS_USUARIOS, []);
  if (lista.length > 0) return;

  const admin: Usuario = {
    id: 1,
    usuario: "ADMIN",
    nome: "ADMINISTRADOR",
    senha: "123456",
    role: "ADMIN",
    status: "ATIVO",
    privilegios: [...PRIVILEGIOS_LISTA],
  };

  writeLS(LS_USUARIOS, [admin]);
}

export default function UsuariosPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [busca, setBusca] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [usuario, setUsuario] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<Role>("FUNCIONARIO");
  const [status, setStatus] = useState<"ATIVO" | "INATIVO">("ATIVO");
  const [privilegios, setPrivilegios] = useState<Privilegio[]>(["DASHBOARD"]);

  useEffect(() => {
    if (!isLogged()) {
      router.push("/login");
      return;
    }

    if (!canAccess("USUARIOS")) {
      alert("ACESSO NEGADO");
      router.push("/dashboard");
      return;
    }

    seedUsuarios();
    setUsuarios(readLS<Usuario[]>(LS_USUARIOS, []));
    setReady(true);
  }, [router]);

  const filtrados = useMemo(() => {
    const q = up(busca.trim());
    if (!q) return usuarios;

    return usuarios.filter((u) => {
      const texto = up(`${u.usuario} ${u.nome} ${u.role} ${u.status}`);
      return texto.includes(q);
    });
  }, [usuarios, busca]);

  function resetForm() {
    setEditingId(null);
    setUsuario("");
    setNome("");
    setSenha("");
    setRole("FUNCIONARIO");
    setStatus("ATIVO");
    setPrivilegios(["DASHBOARD"]);
  }

  function togglePrivilegio(p: Privilegio) {
    setPrivilegios((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function salvar() {
    const u = up(usuario.trim());
    const n = up(nome.trim());
    const s = String(senha || "");

    if (!u || !n) {
      alert("PREENCHA USUÁRIO E NOME.");
      return;
    }

    const lista = [...usuarios];

    const privilegiosFinal =
      role === "ADMIN" ? [...PRIVILEGIOS_LISTA] : [...privilegios];

    if (editingId) {
      const idx = lista.findIndex((x) => x.id === editingId);
      if (idx < 0) {
        alert("USUÁRIO NÃO ENCONTRADO.");
        return;
      }

      const duplicado = lista.some((x) => x.id !== editingId && up(x.usuario) === u);
      if (duplicado) {
        alert("JÁ EXISTE UM USUÁRIO COM ESSE LOGIN.");
        return;
      }

      lista[idx] = {
        ...lista[idx],
        usuario: u,
        nome: n,
        senha: s || lista[idx].senha,
        role,
        status,
        privilegios: privilegiosFinal,
      };

      writeLS(LS_USUARIOS, lista);
      setUsuarios(lista);
      resetForm();
      alert("USUÁRIO ATUALIZADO!");
      return;
    }

    const existe = lista.some((x) => up(x.usuario) === u);
    if (existe) {
      alert("JÁ EXISTE UM USUÁRIO COM ESSE LOGIN.");
      return;
    }

    if (!s) {
      alert("PREENCHA A SENHA.");
      return;
    }

    const novo: Usuario = {
      id: Date.now(),
      usuario: u,
      nome: n,
      senha: s,
      role,
      status,
      privilegios: privilegiosFinal,
    };

    const next = [...lista, novo];
    writeLS(LS_USUARIOS, next);
    setUsuarios(next);
    resetForm();
    alert("USUÁRIO CRIADO!");
  }

  function editar(u: Usuario) {
    setEditingId(u.id);
    setUsuario(u.usuario);
    setNome(u.nome);
    setSenha("");
    setRole(u.role);
    setStatus(u.status);
    setPrivilegios(u.privilegios || ["DASHBOARD"]);
  }

  function remover(id: number) {
    if (!confirm("REMOVER ESTE USUÁRIO?")) return;

    const next = usuarios.filter((x) => x.id !== id);
    writeLS(LS_USUARIOS, next);
    setUsuarios(next);
    alert("USUÁRIO REMOVIDO!");
  }

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F8F9FA]">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <h1 className="text-2xl font-black text-[#6C757D]">USUÁRIOS</h1>

          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="BUSCAR USUÁRIO..."
            className="border rounded-lg px-3 py-2 w-80 max-w-full"
          />
        </div>

        <div className="bg-white rounded-2xl shadow p-4 mb-4">
          <div className="text-sm font-bold text-[#6C757D] mb-3">
            {editingId ? "EDITAR USUÁRIO" : "NOVO USUÁRIO"}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <div className="text-xs font-bold text-[#6C757D] mb-1">USUÁRIO</div>
              <input
                value={usuario}
                onChange={(e) => setUsuario(up(e.target.value))}
                className="border rounded-lg px-3 py-2 w-full"
                placeholder="EX: JOAO"
              />
            </div>

            <div>
              <div className="text-xs font-bold text-[#6C757D] mb-1">NOME</div>
              <input
                value={nome}
                onChange={(e) => setNome(up(e.target.value))}
                className="border rounded-lg px-3 py-2 w-full"
                placeholder="EX: JOÃO SILVA"
              />
            </div>

            <div>
              <div className="text-xs font-bold text-[#6C757D] mb-1">
                {editingId ? "NOVA SENHA (OPCIONAL)" : "SENHA"}
              </div>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full"
                placeholder="DIGITE A SENHA"
              />
            </div>

            <div>
              <div className="text-xs font-bold text-[#6C757D] mb-1">PERFIL</div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="border rounded-lg px-3 py-2 w-full bg-white"
              >
                <option value="FUNCIONARIO">FUNCIONÁRIO</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div>
              <div className="text-xs font-bold text-[#6C757D] mb-1">STATUS</div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="border rounded-lg px-3 py-2 w-full bg-white"
              >
                <option value="ATIVO">ATIVO</option>
                <option value="INATIVO">INATIVO</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs font-bold text-[#6C757D] mb-2">PRIVILÉGIOS</div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
              {PRIVILEGIOS_LISTA.map((p) => (
                <label
                  key={p}
                  className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={role === "ADMIN" ? true : privilegios.includes(p)}
                    onChange={() => togglePrivilegio(p)}
                    disabled={role === "ADMIN"}
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>

            {role === "ADMIN" && (
              <div className="text-xs text-[#6C757D] mt-2">
                ADMIN RECEBE ACESSO TOTAL AUTOMATICAMENTE.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={salvar}
              className="bg-[#0A569E] text-white rounded-lg px-4 py-2 font-black"
            >
              {editingId ? "SALVAR ALTERAÇÕES" : "CRIAR USUÁRIO"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="border rounded-lg px-4 py-2 hover:bg-[#F8F9FA]"
            >
              LIMPAR
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FA]">
              <tr>
                <th className="p-3 text-left">USUÁRIO</th>
                <th className="p-3 text-left">NOME</th>
                <th className="p-3 text-left">PERFIL</th>
                <th className="p-3 text-left">STATUS</th>
                <th className="p-3 text-left">PRIVILÉGIOS</th>
                <th className="p-3 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[#6C757D]">
                    NENHUM USUÁRIO ENCONTRADO.
                  </td>
                </tr>
              ) : (
                filtrados.map((u) => (
                  <tr key={u.id} className="border-b">
                    <td className="p-3 font-bold">{u.usuario}</td>
                    <td className="p-3">{u.nome}</td>
                    <td className="p-3">{u.role}</td>
                    <td className="p-3">{u.status}</td>
                    <td className="p-3">
                      {u.role === "ADMIN"
                        ? "ACESSO TOTAL"
                        : (u.privilegios || []).join(", ")}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => editar(u)}
                          className="border rounded-lg px-3 py-1 hover:bg-[#F8F9FA]"
                        >
                          EDITAR
                        </button>

                        <button
                          type="button"
                          onClick={() => remover(u.id)}
                          className="border rounded-lg px-3 py-1 hover:bg-[#F8F9FA]"
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
      </main>
    </div>
  );
}
