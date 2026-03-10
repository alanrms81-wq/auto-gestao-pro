"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6">CARREGANDO...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get("email") || "";
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  async function fazerLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      alert("ERRO NO LOGIN: " + error.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      alert("USUÁRIO NÃO ENCONTRADO.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4">
      <div className="bg-white p-8 rounded-2xl shadow w-full max-w-[420px]">
        <h1 className="text-3xl font-black text-center mb-2 text-[#0A569E]">
          AUTO GESTÃO PRÓ
        </h1>

        <p className="text-sm text-center text-[#6C757D] mb-6">
          ENTRE COM SUA CONTA
        </p>

        <form onSubmit={fazerLogin} className="space-y-4">
          <input
            type="email"
            placeholder="EMAIL"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-3 rounded w-full"
            required
          />

          <input
            type="password"
            placeholder="SENHA"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="border p-3 rounded w-full"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-[#0A569E] text-white w-full p-3 rounded-lg font-bold"
          >
            {loading ? "ENTRANDO..." : "ENTRAR"}
          </button>
        </form>

        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push("/registro")}
            className="border border-[#2F2F2F] text-[#1F1F1F] w-full p-3 rounded-lg font-semibold bg-white"
          >
            CRIAR CONTA
          </button>
        </div>
      </div>
    </div>
  );
}