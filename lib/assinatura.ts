import { supabase } from "@/lib/supabase";

export type AssinaturaEmpresa = {
  id?: string;
  empresa_id: string;
  nome_empresa?: string;
  responsavel?: string;
  telefone?: string;
  email?: string;
  plano?: string;
  valor_mensal?: number;
  dia_vencimento?: number;
  proximo_vencimento?: string;
  status_assinatura?: string;
  bloqueado?: boolean;
  dias_carencia?: number;
};

export type AssinaturaStatus =
  | "ATIVO"
  | "CARENCIA"
  | "VENCIDO"
  | "BLOQUEADO"
  | "CANCELADO";

export async function buscarAssinaturaEmpresa(
  empresaId: string
): Promise<AssinaturaEmpresa | null> {
  const { data, error } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error) {
    console.error("ERRO AO BUSCAR ASSINATURA:", error.message);
    return null;
  }

  return data as AssinaturaEmpresa;
}

export function resolverStatusAssinatura(
  assinatura: AssinaturaEmpresa | null
): AssinaturaStatus {
  if (!assinatura) return "CANCELADO";

  if (assinatura.bloqueado) return "BLOQUEADO";

  const status = String(assinatura.status_assinatura || "").toUpperCase();

  if (status === "CANCELADO") return "CANCELADO";
  if (status === "TESTE") return "CARENCIA";

  const hoje = new Date().toISOString().slice(0, 10);
  const vencimento = assinatura.proximo_vencimento;

  if (!vencimento) return "ATIVO";

  if (vencimento < hoje) return "VENCIDO";

  return "ATIVO";
}