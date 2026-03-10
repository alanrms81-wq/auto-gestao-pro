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

type FornecedorPayload = {
  empresa_id: string;
  nome: string;
  telefone: string | null;
  celular: string | null;
  whatsapp: string | null;
  cpf_cnpj: string | null;
  email: string | null;
  contato: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
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

function low(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function digits(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getCaller(request);

    if (!caller?.empresa_id) {
      return NextResponse.json({ error: "NÃO AUTORIZADO." }, { status: 401 });
    }

    const body = await request.json();
    const fornecedores = Array.isArray(body?.fornecedores) ? body.fornecedores : [];

    if (!fornecedores.length) {
      return NextResponse.json({ error: "NENHUM FORNECEDOR INFORMADO." }, { status: 400 });
    }

    const admin = getAdminClient();

    const payload: FornecedorPayload[] = fornecedores
      .map((item: any): FornecedorPayload => ({
        empresa_id: caller.empresa_id,
        nome: up(item?.nome),
        telefone: digits(item?.telefone) || null,
        celular: digits(item?.celular) || null,
        whatsapp: digits(item?.whatsapp) || null,
        cpf_cnpj: digits(item?.cpf_cnpj) || null,
        email: low(item?.email) || null,
        contato: up(item?.contato) || null,
        endereco: up(item?.endereco) || null,
        numero: up(item?.numero) || null,
        bairro: up(item?.bairro) || null,
        cidade: up(item?.cidade) || null,
        uf: up(item?.uf) || null,
        cep: digits(item?.cep) || null,
        observacoes: up(item?.observacoes) || null,
        status: up(item?.status) || "ATIVO",
      }))
      .filter((item: FornecedorPayload) => item.nome);

    if (!payload.length) {
      return NextResponse.json(
        { error: "NENHUM FORNECEDOR VÁLIDO PARA IMPORTAÇÃO." },
        { status: 400 }
      );
    }

    const { error } = await admin.from("fornecedores").insert(payload);

    if (error) {
      return NextResponse.json(
        { error: "ERRO AO IMPORTAR FORNECEDORES.", detalhe: error.message },
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