import { supabase } from "@/lib/supabase";

export type AssinaturaStatus =
  | "ATIVO"
  | "TESTE"
  | "VENCIDO"
  | "CARENCIA"
  | "BLOQUEADO"
  | "CANCELADO";

export type AssinaturaEmpresa = {
  id: string;
  empresa_id: string;
  nome_empresa?: string | null;
  plano?: string | null;
  status_assinatura?: string | null;
  bloqueado?: boolean | null;
  proximo_vencimento?: string | null;
  dias_carencia?: number | null;
};

function up(v: unknown) {
  return String(v ?? "").toUpperCase();
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function buscarAssinaturaEmpresa(empresaId: string) {
  const { data, error } = await supabase
    .from("assinaturas")
    .select("*")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data || null) as AssinaturaEmpresa | null;
}

export function resolverStatusAssinatura(
  assinatura: AssinaturaEmpresa | null
): AssinaturaStatus {
  if (!assinatura) return "BLOQUEADO";

  const status = up(assinatura.status_assinatura);
  const bloqueado = !!assinatura.bloqueado;
  const vencimento = assinatura.proximo_vencimento || null;
  const carencia = Number(assinatura.dias_carencia || 0);
  const hoje = hojeISO();

  if (bloqueado) return "BLOQUEADO";
  if (status === "CANCELADO") return "CANCELADO";
  if (status === "TESTE") return "TESTE";
  if (status === "ATIVO" && vencimento && vencimento >= hoje) return "ATIVO";

  if (vencimento && vencimento < hoje) {
    const fimCarencia = addDays(vencimento, carencia);

    if (hoje <= fimCarencia) {
      return "CARENCIA";
    }

    return "BLOQUEADO";
  }

  if (status === "VENCIDO") return "VENCIDO";
  if (status === "CARENCIA") return "CARENCIA";
  if (status === "BLOQUEADO") return "BLOQUEADO";

  return "ATIVO";
}