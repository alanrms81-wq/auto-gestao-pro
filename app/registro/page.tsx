"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type RegistroResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  detalhe?: string;
  etapa?: string;
};

export default function RegistroPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefoneEmpresa, setTelefoneEmpresa] = useState("");
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  useEffect(() => {
    async function prepareRegistro() {
      try {
        const { data } = await supabase.auth.getSession();

        // Se já existir sessão aberta, encerra antes de registrar
        // para não cair no dashboard da empresa que já está logada.
        if (data.session) {
          await supabase.auth.signOut();
        }
      } finally {
        setCheckingSession(false);
      }
    }

    prepareRegistro();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!nomeEmpresa.trim()) {
      alert("PREENCHA O NOME DA EMPRESA.");
      return;
    }

    if (!nomeUsuario.trim()) {
      alert("PREENCHA O NOME DO RESPONSÁVEL.");
      return;
    }

    if (!email.trim()) {
      alert("PREENCHA O E-MAIL.");
      return;
    }

    if (!senha.trim()) {
      alert("PREENCHA A SENHA.");
      return;
    }

    if (senha.length < 6) {
      alert("A SENHA DEVE TER PELO MENOS 6 CARACTERES.");
      return;
    }

    if (senha !== confirmarSenha) {
      alert("AS SENHAS NÃO CONFEREM.");
      return;
    }

    try {
      setLoading(true);

      // Garante novamente que não existe sessão reaproveitada
      await supabase.auth.signOut();

      const res = await fetch("/api/registro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nomeEmpresa: nomeEmpresa.trim(),
          cnpj: cnpj.trim(),
          telefoneEmpresa: telefoneEmpresa.trim(),
          nomeUsuario: nomeUsuario.trim(),
          email: email.trim(),
          senha: senha.trim(),
        }),
      });

      const json: RegistroResponse = await res.json();

      if (!res.ok) {
        alert(
          `${json.error || "ERRO AO CRIAR CONTA."}${
            json.detalhe ? "\n\nDETALHE: " + json.detalhe : ""
          }${json.etapa ? "\nETAPA: " + json.etapa : ""}`
        );
        return;
      }

      const loginResult = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha.trim(),
      });

      if (loginResult.error) {
        alert("SOLICITAÇÃO CRIADA, MAS HOUVE ERRO NO LOGIN AUTOMÁTICO.");
        router.push("/login");
        return;
      }

      alert("EMPRESA CRIADA COM SUCESSO!");
      router.push("/dashboard");
    } catch (error) {
      console.error(error);
      alert("ERRO AO CRIAR CONTA.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-6">
        <div className="w-full max-w-[520px] bg-white rounded-[24px] shadow-sm p-8 text-center">
          <h1 className="text-[28px] font-black text-[#0456A3]">
            PREPARANDO REGISTRO
          </h1>
          <p className="text-[#6C757D] mt-3">
            AGUARDE UM INSTANTE...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-6">
      <div className="w-full max-w-[760px] bg-white rounded-[24px] shadow-sm p-8">
        <div className="mb-8">
          <h1 className="text-[32px] font-black text-[#0456A3]">
            AUTO GESTÃO PRÓ
          </h1>

          <p className="text-[#6C757D] mt-2">
            REGISTRE SUA EMPRESA PARA INICIAR O USO DO SISTEMA
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label">NOME DA EMPRESA</label>
            <input
              className="campo"
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
              placeholder="OFICINA DO JOÃO"
            />
          </div>

          <div>
            <label className="label">CNPJ</label>
            <input
              className="campo"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div>
            <label className="label">TELEFONE</label>
            <input
              className="campo"
              value={telefoneEmpresa}
              onChange={(e) => setTelefoneEmpresa(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="md:col-span-2">
            <label className="label">NOME DO RESPONSÁVEL</label>
            <input
              className="campo"
              value={nomeUsuario}
              onChange={(e) => setNomeUsuario(e.target.value)}
              placeholder="NOME COMPLETO"
            />
          </div>

          <div className="md:col-span-2">
            <label className="label">E-MAIL</label>
            <input
              type="email"
              className="campo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@empresa.com"
            />
          </div>

          <div>
            <label className="label">SENHA</label>
            <input
              type="password"
              className="campo"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="MÍNIMO 6 CARACTERES"
            />
          </div>

          <div>
            <label className="label">CONFIRMAR SENHA</label>
            <input
              type="password"
              className="campo"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              placeholder="REPITA A SENHA"
            />
          </div>

          <div className="md:col-span-2 rounded-[16px] border border-[#DBEAFE] bg-[#EFF6FF] p-4 text-[13px] text-[#1D4ED8]">
            AO REGISTRAR, SUA EMPRESA PODE SER CRIADA COM ACESSO INICIAL E
            ACOMPANHAMENTO COMERCIAL POSTERIOR.
          </div>

          <div className="md:col-span-2 flex gap-3 mt-2 flex-wrap">
            <button
              type="submit"
              className="botao-azul"
              disabled={loading}
            >
              {loading ? "PROCESSANDO..." : "REGISTRAR EMPRESA"}
            </button>

            <button
              type="button"
              className="botao"
              onClick={() => router.push("/login")}
            >
              IR PARA LOGIN
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .label {
          font-size: 12px;
          font-weight: 800;
          color: #6c757d;
          margin-bottom: 6px;
          display: block;
        }

        .campo {
          height: 46px;
          border: 1.5px solid #9a9a9a;
          border-radius: 12px;
          padding: 0 12px;
          width: 100%;
          font-size: 14px;
          background: white;
          color: #111827;
          outline: none;
        }

        .campo:focus {
          border-color: #0456a3;
          box-shadow: 0 0 0 4px rgba(4, 86, 163, 0.08);
        }

        .botao {
          border: 1px solid #2f2f2f;
          border-radius: 12px;
          padding: 12px 18px;
          font-weight: 600;
          background: white;
          color: #1f1f1f;
        }

        .botao-azul {
          background: #0456a3;
          color: white;
          border-radius: 12px;
          padding: 12px 18px;
          font-weight: 700;
          border: none;
        }

        .botao:disabled,
        .botao-azul:disabled {
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
}