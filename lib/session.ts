import { supabase } from "@/lib/supabase";

export type SessionUser = {
  id: string;
  empresa_id: string;
  nome: string;
  email: string;
  role?: string | null;
  status?: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user?.id) return null;

  const authUserId = data.user.id;

  const { data: usuario, error: usuarioError } = await supabase
    .from("usuarios")
    .select("id, empresa_id, nome, email, role, status")
    .eq("id", authUserId)
    .single();

  if (usuarioError || !usuario) {
    console.error("ERRO SESSION USUARIO:", usuarioError);
    return null;
  }

  if ((usuario.status || "ATIVO") !== "ATIVO") {
    return null;
  }

  return usuario as SessionUser;
}

export async function getEmpresaId(): Promise<string | null> {
  const user = await getSessionUser();
  return user?.empresa_id || null;
}