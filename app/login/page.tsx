"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function fazerLogin(e: React.FormEvent) {
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
      <div className="bg-white p-8 rounded-2xl shadow w-full max-w-[380px]">
        <h1 className="text-2xl font-black text-center mb-2 text-[#0A569E]">
          AUTO GESTÃO PRO
        </h1>
        <p className="text-sm text-center text-[#6C757D] mb-6">
          Login com Supabase
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
      </div>
    </div>
  );
}