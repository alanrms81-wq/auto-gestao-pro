"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { canAccess, isLogged } from "@/lib/authGuard";
import {
  EmpresaFiscal,
  getEmpresaFiscal,
  maskCep,
  maskCnpj,
  saveEmpresaFiscal,
} from "@/lib/fiscal";

export default function ConfigFiscalPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState<EmpresaFiscal>(getEmpresaFiscal());

  useEffect(() => {
    if (!isLogged()) {
      router.push("/login");
      return;
    }

    if (!canAccess("DASHBOARD")) {
      alert("ACESSO NEGADO");
      router.push("/dashboard");
      return;
    }

    setForm(getEmpresaFiscal());
    setReady(true);
  }, [router]);

  function setField<K extends keyof EmpresaFiscal>(key: K, value: EmpresaFiscal[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function salvar() {
    saveEmpresaFiscal(form);
    alert("CONFIGURAÇÃO FISCAL SALVA!");
  }

  if (!ready) return <div className="p-6">CARREGANDO...</div>;

  return (
    <div className="min-h-screen flex bg-[#F8F9FA]">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#6C757D]">CONFIGURAÇÃO FISCAL</h1>
          <div className="text-sm text-[#6C757D]">
            BASE PARA NF-E, DANFE E FUTURA INTEGRAÇÃO COM CERTIFICADO DIGITAL
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              placeholder="RAZÃO SOCIAL"
              value={form.razaoSocial}
              onChange={(e) => setField("razaoSocial", e.target.value)}
              className="border p-2 rounded md:col-span-2"
            />

            <input
              placeholder="NOME FANTASIA"
              value={form.nomeFantasia}
              onChange={(e) => setField("nomeFantasia", e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="CNPJ"
              value={form.cnpj}
              onChange={(e) => setField("cnpj", maskCnpj(e.target.value))}
              className="border p-2 rounded"
            />

            <input
              placeholder="IE"
              value={form.ie}
              onChange={(e) => setField("ie", e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="IM"
              value={form.im || ""}
              onChange={(e) => setField("im", e.target.value)}
              className="border p-2 rounded"
            />

            <select
              value={form.crt}
              onChange={(e) => setField("crt", e.target.value as "1" | "2" | "3")}
              className="border p-2 rounded bg-white"
            >
              <option value="1">CRT 1 - SIMPLES NACIONAL</option>
              <option value="2">CRT 2 - SIMPLES EXCESSO</option>
              <option value="3">CRT 3 - REGIME NORMAL</option>
            </select>

            <select
              value={form.ambiente}
              onChange={(e) => setField("ambiente", e.target.value as "HOMOLOGACAO" | "PRODUCAO")}
              className="border p-2 rounded bg-white"
            >
              <option value="HOMOLOGACAO">HOMOLOGAÇÃO</option>
              <option value="PRODUCAO">PRODUÇÃO</option>
            </select>

            <input
              placeholder="CEP"
              value={form.cep}
              onChange={(e) => setField("cep", maskCep(e.target.value))}
              className="border p-2 rounded"
            />

            <input
              placeholder="RUA"
              value={form.rua}
              onChange={(e) => setField("rua", e.target.value)}
              className="border p-2 rounded md:col-span-2"
            />

            <input
              placeholder="NÚMERO"
              value={form.numero}
              onChange={(e) => setField("numero", e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="COMPLEMENTO"
              value={form.complemento}
              onChange={(e) => setField("complemento", e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="BAIRRO"
              value={form.bairro}
              onChange={(e) => setField("bairro", e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="CIDADE"
              value={form.cidade}
              onChange={(e) => setField("cidade", e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="UF"
              value={form.estado}
              onChange={(e) => setField("estado", e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="CÓDIGO MUNICÍPIO IBGE"
              value={form.codigoMunicipio}
              onChange={(e) => setField("codigoMunicipio", e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="TELEFONE"
              value={form.telefone}
              onChange={(e) => setField("telefone", e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="EMAIL"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="SÉRIE NF-E"
              value={form.serieNfe}
              onChange={(e) => setField("serieNfe", e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="PRÓXIMO NÚMERO NF-E"
              value={form.proximoNumeroNfe}
              onChange={(e) => setField("proximoNumeroNfe", e.target.value)}
              className="border p-2 rounded"
            />

            <select
              value={form.certificadoTipo}
              onChange={(e) => setField("certificadoTipo", e.target.value as "A1" | "A3" | "")}
              className="border p-2 rounded bg-white"
            >
              <option value="">TIPO CERTIFICADO</option>
              <option value="A1">A1</option>
              <option value="A3">A3</option>
            </select>

            <input
              placeholder="SENHA CERTIFICADO"
              value={form.certificadoSenha || ""}
              onChange={(e) => setField("certificadoSenha", e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="CSC TOKEN"
              value={form.tokenCsc || ""}
              onChange={(e) => setField("tokenCsc", e.target.value)}
              className="border p-2 rounded"
            />

            <input
              placeholder="CSC ID"
              value={form.cscId || ""}
              onChange={(e) => setField("cscId", e.target.value)}
              className="border p-2 rounded"
            />

            <textarea
              placeholder="OBSERVAÇÕES DANFE"
              value={form.observacoesDanfe || ""}
              onChange={(e) => setField("observacoesDanfe", e.target.value)}
              className="border p-2 rounded md:col-span-4 min-h-[100px]"
            />
          </div>

          <div className="mt-4">
            <button
              onClick={salvar}
              className="bg-[#0A569E] text-white px-4 py-2 rounded-lg"
              type="button"
            >
              SALVAR CONFIGURAÇÃO FISCAL
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
