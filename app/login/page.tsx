"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Usuario = {
  id: number;
  usuario: string;
  nome: string;
  senha: string;
  role: "ADMIN" | "FUNCIONARIO";
  status: "ATIVO" | "INATIVO";
  privilegios?: string[];
};

const LS_USUARIOS = "usuarios";

function readUsuarios(): Usuario[] {
  try {
    const raw = localStorage.getItem(LS_USUARIOS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function seedAdmin() {
  const lista = readUsuarios();

  if (lista.length > 0) return;

  const admin: Usuario = {
    id: 1,
    usuario: "ADMIN",
    nome: "ADMINISTRADOR",
    senha: "123456",
    role: "ADMIN",
    status: "ATIVO",
    privilegios: [
      "DASHBOARD",
      "CLIENTES",
      "ORDENS",
      "PRODUTOS",
      "CATEGORIAS",
      "FORNECEDORES",
      "VENDAS",
      "FINANCEIRO",
      "USUARIOS",
    ],
  };

  localStorage.setItem(LS_USUARIOS, JSON.stringify([admin]));
}

export default function LoginPage() {
  const router = useRouter();

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");

  function login() {
    seedAdmin();

    const lista = readUsuarios();

    const u = lista.find(
      (x) =>
        x.usuario.toUpperCase() === usuario.toUpperCase() &&
        x.senha === senha
    );

    if (!u) {
      alert("USUÁRIO OU SENHA INVÁLIDOS");
      return;
    }

    if (u.status !== "ATIVO") {
      alert("USUÁRIO INATIVO");
      return;
    }

    const session = {
      ok: true,
      id: u.id,
      usuario: u.usuario,
      nome: u.nome,
      role: u.role,
      privilegios: u.privilegios || [],
    };

    localStorage.setItem("sessionUser", JSON.stringify(session));
    localStorage.setItem("agp_auth", "1");

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-96">

        <h1 className="text-2xl font-black text-[#0A569E] mb-6 text-center">
          AUTO GESTÃO PRÓ
        </h1>

        <div className="flex flex-col gap-3">

          <input
            placeholder="USUÁRIO"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value.toUpperCase())}
            className="border rounded-lg px-3 py-2"
          />

          <input
            type="password"
            placeholder="SENHA"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="border rounded-lg px-3 py-2"
          />

          <button
            onClick={login}
            className="bg-[#0A569E] text-white font-bold py-2 rounded-lg mt-2 hover:opacity-95"
          >
            ENTRAR
          </button>

        </div>

        <div className="text-xs text-center text-gray-500 mt-4">
          ADMIN / 123456
        </div>

      </div>
    </div>
  );
}
