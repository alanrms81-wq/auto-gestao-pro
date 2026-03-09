"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const EMPRESA_ID = "79e90772-e4be-42a2-a481-815c3c88d30b";

export default function TestePage() {
  const [status, setStatus] = useState("Testando conexão...");
  const [clientes, setClientes] = useState<any[]>([]);

  useEffect(() => {
    async function testar() {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("empresa_id", EMPRESA_ID);

      if (error) {
        setStatus("Erro: " + error.message);
      } else {
        setClientes(data || []);
        setStatus("Supabase multiempresa funcionando");
      }
    }

    testar();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "Arial" }}>
      <h1>Teste Supabase</h1>
      <p>{status}</p>

      <h2>Clientes da empresa</h2>

      {clientes.length === 0 ? (
        <p>Nenhum cliente encontrado.</p>
      ) : (
        <ul>
          {clientes.map((c) => (
            <li key={c.id}>
              {c.nome} - {c.telefone || "-"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}