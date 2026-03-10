import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type SessionUser = {
  id: string;
  empresa_id: string;
  status?: string | null;
};

type ServicoPayload = {
  empresa_id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  valor: number;
  tempo_estimado: string | null;
  observacoes: string | null;
  status: string;
};

function getAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getUserClient(jwt: string) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getCaller(request: NextRequest): Promise<SessionUser | null> {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;

  const jwt = authHeader.replace("Bearer ", "").trim();
  if (!jwt) return null;

  const userClient = getUserClient(jwt);
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(jwt);

  if (userError || !user?.id) return null;

  const { data: usuario, error: usuarioError } = await userClient
    .from("usuarios")
    .select("id, empresa_id, status")
    .eq("id", user.id)
    .single();

  if (usuarioError || !usuario) return null;
  if ((usuario.status || "ATIVO") !== "ATIVO") return null;

  return usuario as SessionUser;
}

function up(v: unknown) {
  return String(v ?? "").trim().toUpperCase();
}

function toMoney(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getCaller(request);

    if (!caller?.empresa_id) {
      return NextResponse.json({ error: "NÃO AUTORIZADO." }, { status: 401 });
    }

    const body = await request.json();
    const servicos = Array.isArray(body?.servicos) ? body.servicos : [];

    if (!servicos.length) {
      return NextResponse.json({ error: "NENHUM SERVIÇO INFORMADO." }, { status: 400 });
    }

    const admin = getAdminClient();

    const payload: ServicoPayload[] = servicos
      .map((item: any): ServicoPayload => ({
        empresa_id: caller.empresa_id,
        nome: up(item?.nome),
        descricao: up(item?.descricao) || null,
        categoria: up(item?.categoria) || null,
        valor: toMoney(item?.valor),
        tempo_estimado: up(item?.tempo_estimado) || null,
        observacoes: up(item?.observacoes) || null,
        status: up(item?.status) || "ATIVO",
      }))
      .filter((item: ServicoPayload) => item.nome);

    if (!payload.length) {
      return NextResponse.json(
        { error: "NENHUM SERVIÇO VÁLIDO PARA IMPORTAÇÃO." },
        { status: 400 }
      );
    }

    const { error } = await admin.from("servicos").insert(payload);

    if (error) {
      return NextResponse.json(
        { error: "ERRO AO IMPORTAR SERVIÇOS.", detalhe: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, total: payload.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: "ERRO INTERNO.", detalhe: error?.message || "SEM DETALHE" },
      { status: 500 }
    );
  }
}