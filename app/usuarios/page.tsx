"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { getSessionUser } from "@/lib/session";

type Usuario = {
  id: string;
  empresa_id: string;
  nome: string;
  email: string;
  role?: string | null;
  status?: string | null;
};

export default function UsuariosPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [usuarioLogadoRole, setUsuarioLogadoRole] = useState<string>("");

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState("FUNCIONARIO");
  const [status, setStatus] = useState("ATIVO");

  async function carregarUsuarios(empId: string) {
    setLoading(true);

    const resp = await fetch(`/api/usuarios?empresa_id=${empId}`);
    const data = await resp.json();

    if (!resp.ok) {
      alert(data.error || "ERRO AO CARREGAR USUÁRIOS.");
      setLoading(false);
      return;
    }

    setUsuarios(data.usuarios || []);
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      const user = await getSessionUser();

      if (!user) {
        router.push("/login");
        return;
      }

      if ((user.role || "").toUpperCase() !== "ADMIN") {
        alert("APENAS ADMIN PODE GERENCIAR FUNCIONÁRIOS.");
        router.push("/dashboard");
        return;
      }

      setEmpresaId(user.empresa_id);
      setUsuarioLogadoRole((user.role || "").toUpperCase());

      await carregarUsuarios(user.empresa_id);
      setReady(true);
    }

    init();
  }, [router]);

  async function criarFuncionario(e: React.FormEvent) {
    e.preventDefault();

    if (!empresaId) return;

    if (!nome.trim() || !email.trim() || !senha.trim()) {
      alert("PREENCHA NOME, EMAIL E SENHA.");
      return;
    }

    const resp = await fetch("/api/usuarios", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        empresa_id: empresaId,
        nome,
        email,
        senha,
        role,
        status,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      alert(data.error || "ERRO AO CRIAR FUNCIONÁRIO.");
      return;
    }

    alert("FUNCIONÁRIO CRIADO COM SUCESSO!");
    setNome("");
    setEmail("");
    setSenha("");
    setRole("FUNCIONARIO");
    setStatus("ATIVO");
    await carregarUsuarios(empresaId);
  }

  async function alterarStatus(usuarioId: string, novoStatus: string) {
    const resp = await fetch("/api/usuarios", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: usuarioId,
        status: novoStatus,
        empresa_id: empresaId,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      alert(data.error || "ERRO AO ALTERAR STATUS.");
      return;
    }

    await carregarUsuarios(empresaId!);
  }

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F8F9FA]">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#6C757D]">FUNCIONÁRIOS</h1>
          <p className="text-sm text-[#6C757D]">
            CADASTRO DE USUÁRIOS DA EMPRESA
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 mb-6">
          <h2 className="text-sm font-bold text-[#6C757D] mb-4">
            NOVO FUNCIONÁRIO
          </h2>

          <form
            onSubmit={criarFuncionario}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3"
          >
            <input
              placeholder="NOME"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="border p-3 rounded"
            />

            <input
              type="email"
              placeholder="EMAIL"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border p-3 rounded"
            />

            <input
              type="password"
              placeholder="SENHA"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="border p-3 rounded"
            />

            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="border p-3 rounded bg-white"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="FINANCEIRO">FINANCEIRO</option>
              <option value="VENDEDOR">VENDEDOR</option>
              <option value="TECNICO">TECNICO</option>
              <option value="FUNCIONARIO">FUNCIONARIO</option>
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border p-3 rounded bg-white"
            >
              <option value="ATIVO">ATIVO</option>
              <option value="INATIVO">INATIVO</option>
            </select>

            <button
              type="submit"
              className="bg-[#0A569E] text-white px-4 py-3 rounded-lg font-bold md:col-span-2 xl:col-span-5"
            >
              CRIAR FUNCIONÁRIO
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FA]">
              <tr>
                <th className="p-3 text-left">NOME</th>
                <th className="p-3 text-left">EMAIL</th>
                <th className="p-3 text-left">PERFIL</th>
                <th className="p-3 text-left">STATUS</th>
                <th className="p-3 text-right">AÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-[#6C757D]">
                    CARREGANDO...
                  </td>
                </tr>
              ) : usuarios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-[#6C757D]">
                    NENHUM FUNCIONÁRIO CADASTRADO.
                  </td>
                </tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id} className="border-b">
                    <td className="p-3 font-bold">{u.nome}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.role || "-"}</td>
                    <td className="p-3">{u.status || "-"}</td>
                    <td className="p-3 text-right">
                      {u.status === "ATIVO" ? (
                        <button
                          onClick={() => alterarStatus(u.id, "INATIVO")}
                          className="border px-3 py-1 rounded"
                          type="button"
                        >
                          INATIVAR
                        </button>
                      ) : (
                        <button
                          onClick={() => alterarStatus(u.id, "ATIVO")}
                          className="border px-3 py-1 rounded"
                          type="button"
                        >
                          ATIVAR
                        </button>
                      )}
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