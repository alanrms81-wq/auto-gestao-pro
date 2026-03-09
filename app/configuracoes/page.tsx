"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSessionUser } from "@/lib/session";

type EmpresaConfig = {
  id?: string;
  empresa_id?: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  inscricao_estadual?: string | null;
  telefone?: string | null;
  email?: string | null;
  site?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  logo_url?: string | null;
};

function up(v: any) {
  return String(v ?? "").toUpperCase();
}

function maskCnpj(v: string) {
  const d = String(v || "").replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function maskCep(v: string) {
  const d = String(v || "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export default function ConfiguracoesPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [registroId, setRegistroId] = useState<string | null>(null);

  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [site, setSite] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    async function init() {
      const user = await getSessionUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmpresaId(user.empresa_id);
      await carregarConfiguracoes(user.empresa_id);
      setReady(true);
    }

    init();
  }, [router]);

  async function carregarConfiguracoes(eid: string) {
    setLoading(true);

    const { data, error } = await supabase
      .from("empresas_config")
      .select("*")
      .eq("empresa_id", eid)
      .maybeSingle();

    if (error) {
      alert("ERRO AO CARREGAR CONFIGURAÇÕES: " + error.message);
      setLoading(false);
      return;
    }

    if (data) {
      const cfg = data as EmpresaConfig;
      setRegistroId(cfg.id || null);
      setRazaoSocial(cfg.razao_social || "");
      setNomeFantasia(cfg.nome_fantasia || "");
      setCnpj(cfg.cnpj || "");
      setInscricaoEstadual(cfg.inscricao_estadual || "");
      setTelefone(cfg.telefone || "");
      setEmail(cfg.email || "");
      setSite(cfg.site || "");
      setEndereco(cfg.endereco || "");
      setNumero(cfg.numero || "");
      setBairro(cfg.bairro || "");
      setCidade(cfg.cidade || "");
      setEstado(cfg.estado || "");
      setCep(cfg.cep || "");
      setLogoUrl(cfg.logo_url || "");
    }

    setLoading(false);
  }

  async function buscarCep() {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      alert("CEP INVÁLIDO.");
      return;
    }

    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await resp.json();

      if (data.erro) {
        alert("CEP NÃO ENCONTRADO.");
        return;
      }

      setEndereco(up(data.logradouro || ""));
      setBairro(up(data.bairro || ""));
      setCidade(up(data.localidade || ""));
      setEstado(up(data.uf || ""));
    } catch {
      alert("ERRO AO CONSULTAR CEP.");
    }
  }

  async function salvarConfiguracoes() {
    if (!empresaId) return;

    if (!nomeFantasia.trim()) {
      alert("PREENCHA O NOME FANTASIA.");
      return;
    }

    const payload = {
      empresa_id: empresaId,
      razao_social: up(razaoSocial),
      nome_fantasia: up(nomeFantasia),
      cnpj: maskCnpj(cnpj),
      inscricao_estadual: up(inscricaoEstadual),
      telefone: telefone.trim(),
      email: email.trim().toLowerCase(),
      site: site.trim(),
      endereco: up(endereco),
      numero: up(numero),
      bairro: up(bairro),
      cidade: up(cidade),
      estado: up(estado),
      cep: maskCep(cep),
      logo_url: logoUrl.trim(),
    };

    if (registroId) {
      const { error } = await supabase
        .from("empresas_config")
        .update(payload)
        .eq("id", registroId)
        .eq("empresa_id", empresaId);

      if (error) {
        alert("ERRO AO ATUALIZAR CONFIGURAÇÕES: " + error.message);
        return;
      }

      alert("CONFIGURAÇÕES ATUALIZADAS!");
      return;
    }

    const { data, error } = await supabase
      .from("empresas_config")
      .insert([payload])
      .select("id")
      .single();

    if (error) {
      alert("ERRO AO SALVAR CONFIGURAÇÕES: " + error.message);
      return;
    }

    setRegistroId(data.id);
    alert("CONFIGURAÇÕES SALVAS!");
  }

  if (!ready) {
    return <div className="p-6">CARREGANDO...</div>;
  }

  return (
    <div className="min-h-screen flex bg-[#F3F4F6]">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-[26px] font-black text-[#6C757D]">
              CONFIGURAÇÕES
            </h1>

            <p className="text-sm text-[#6C757D] mt-1">
              DADOS DA EMPRESA, LOGO E CONFIGURAÇÕES FISCAIS BÁSICAS
            </p>
          </div>

          <div className="flex gap-3">
            <button className="botao-azul" onClick={salvarConfiguracoes} type="button">
              SALVAR CONFIGURAÇÕES
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            <section className="card">
              <h2 className="titulo mb-4">DADOS DA EMPRESA</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">RAZÃO SOCIAL</label>
                  <input
                    className="campo"
                    value={razaoSocial}
                    onChange={(e) => setRazaoSocial(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">NOME FANTASIA</label>
                  <input
                    className="campo"
                    value={nomeFantasia}
                    onChange={(e) => setNomeFantasia(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">CNPJ</label>
                  <input
                    className="campo"
                    value={cnpj}
                    onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                  />
                </div>

                <div>
                  <label className="label">INSCRIÇÃO ESTADUAL</label>
                  <input
                    className="campo"
                    value={inscricaoEstadual}
                    onChange={(e) => setInscricaoEstadual(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">TELEFONE</label>
                  <input
                    className="campo"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">E-MAIL</label>
                  <input
                    className="campo"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="label">SITE</label>
                  <input
                    className="campo"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="card">
              <h2 className="titulo mb-4">ENDEREÇO</h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1 flex gap-2">
                  <div className="w-full">
                    <label className="label">CEP</label>
                    <input
                      className="campo"
                      value={cep}
                      onChange={(e) => setCep(maskCep(e.target.value))}
                    />
                  </div>

                  <button
                    className="botao mt-[28px] h-[44px]"
                    onClick={buscarCep}
                    type="button"
                  >
                    BUSCAR
                  </button>
                </div>

                <div className="md:col-span-2">
                  <label className="label">ENDEREÇO</label>
                  <input
                    className="campo"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">NÚMERO</label>
                  <input
                    className="campo"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">BAIRRO</label>
                  <input
                    className="campo"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">CIDADE</label>
                  <input
                    className="campo"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">ESTADO</label>
                  <input
                    className="campo"
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="card">
              <h2 className="titulo mb-4">CONFIGURAÇÕES FISCAIS BÁSICAS</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">CNPJ</label>
                  <input
                    className="campo"
                    value={cnpj}
                    onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                  />
                </div>

                <div>
                  <label className="label">INSCRIÇÃO ESTADUAL</label>
                  <input
                    className="campo"
                    value={inscricaoEstadual}
                    onChange={(e) => setInscricaoEstadual(e.target.value)}
                  />
                </div>
              </div>

              <p className="text-sm text-[#6C757D] mt-4">
                Depois podemos expandir esta área com regime tributário, série NF-e, ambiente e certificado digital.
              </p>
            </section>
          </div>

          <div className="space-y-6">
            <section className="card">
              <h2 className="titulo mb-4">LOGO DA EMPRESA</h2>

              <div className="rounded-[16px] border border-[#D1D5DB] bg-[#F9FAFB] p-4">
                <div className="h-[220px] rounded-[12px] border border-[#D1D5DB] bg-white flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo da empresa"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-sm text-[#6B7280]">SEM LOGO</span>
                  )}
                </div>

                <div className="mt-4">
                  <label className="label">LINK EXTERNO DA LOGO</label>
                  <input
                    className="campo"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </section>

            <section className="card">
              <h2 className="titulo mb-4">PRÉ-VISUALIZAÇÃO</h2>

              <div className="space-y-2 text-sm text-[#1F1F1F]">
                <p><b>NOME:</b> {nomeFantasia || "-"}</p>
                <p><b>CNPJ:</b> {cnpj || "-"}</p>
                <p><b>TELEFONE:</b> {telefone || "-"}</p>
                <p><b>E-MAIL:</b> {email || "-"}</p>
                <p><b>CIDADE:</b> {cidade || "-"}</p>
                <p><b>ESTADO:</b> {estado || "-"}</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <style jsx>{`
        .card {
          background: white;
          border-radius: 20px;
          padding: 18px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .titulo {
          font-weight: 900;
          font-size: 14px;
          color: #6c757d;
        }

        .label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          color: #6c757d;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .campo {
          height: 44px;
          border: 1.5px solid #9a9a9a;
          border-radius: 10px;
          padding: 0 12px;
          font-size: 14px;
          width: 100%;
          background: white;
          color: #111827;
        }

        .botao {
          border: 1px solid #2f2f2f;
          border-radius: 10px;
          padding: 10px 16px;
          font-size: 13px;
          background: white;
          color: #1f1f1f;
          font-weight: 500;
          white-space: nowrap;
        }

        .botao-azul {
          background: #0456a3;
          color: white;
          border-radius: 10px;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 600;
          border: none;
        }
      `}</style>
    </div>
  );
}