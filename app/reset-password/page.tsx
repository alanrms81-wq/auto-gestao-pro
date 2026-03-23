"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        alert("LINK INVÁLIDO OU EXPIRADO.");
        router.push("/login");
        return;
      }

      setReady(true);
    }

    checkSession();
  }, [router]);

  async function handleUpdatePassword() {
    if (!password || !confirmPassword) {
      alert("PREENCHA OS DOIS CAMPOS.");
      return;
    }

    if (password !== confirmPassword) {
      alert("AS SENHAS NÃO CONFEREM.");
      return;
    }

    if (password.length < 6) {
      alert("A SENHA DEVE TER PELO MENOS 6 CARACTERES.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setSaving(false);

    if (error) {
      alert("ERRO AO ATUALIZAR SENHA: " + error.message);
      return;
    }

    alert("SENHA ALTERADA COM SUCESSO!");
    router.push("/login");
  }

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F6F8] p-4">
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-lg border border-[#E5E7EB]">
        <h1 className="text-[28px] font-black text-[#111827]">NOVA SENHA</h1>
        <p className="text-[14px] text-[#6B7280] mt-2">
          DIGITE SUA NOVA SENHA PARA ENTRAR NO SISTEMA.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-[12px] font-bold text-[#6B7280] mb-2">
              NOVA SENHA
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-[48px] w-full rounded-[14px] border border-[#D1D5DB] px-4 outline-none"
              placeholder="DIGITE A NOVA SENHA"
            />
          </div>

          <div>
            <label className="block text-[12px] font-bold text-[#6B7280] mb-2">
              CONFIRMAR SENHA
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-[48px] w-full rounded-[14px] border border-[#D1D5DB] px-4 outline-none"
              placeholder="REPITA A NOVA SENHA"
            />
          </div>

          <button
            type="button"
            onClick={handleUpdatePassword}
            disabled={saving}
            className="h-[48px] w-full rounded-[14px] bg-[#0456A3] text-white font-black"
          >
            {saving ? "SALVANDO..." : "ALTERAR SENHA"}
          </button>
        </div>
      </div>
    </div>
  );
}