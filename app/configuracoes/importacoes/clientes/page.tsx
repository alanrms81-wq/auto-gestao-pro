import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type SessionUser = {
  id: string;
  empresa_id: string;
  nome?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
};

type ClienteImportado = {
  nome: string;
  telefone?: string;
  celular?: string;
  whatsapp?: string;
  cpf_cnpj?: string;
  email?: string;
  endereco?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  observacoes?: string;
  status?: string;
};

function getAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getUserClient(jwt: string) {
  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
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
    .select("id, empresa_id, nome, email, role, status")
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
    const clientes = Array.isArray(body?.clientes) ? body.clientes : [];

    if (!clientes.length) {
      return NextResponse.json(
        { error: "NENHUM CLIENTE INFORMADO." },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    const clientesValidos: ClienteImportado[] = [];
    let ignorados = 0;

    for (const item of clientes) {
      const nome = up(item?.nome);
      if (!nome) {
        ignorados++;
        continue;
      }

      clientesValidos.push({
        nome,
        telefone: digits(item?.telefone),
        celular: digits(item?.celular),
        whatsapp: digits(item?.whatsapp),
        cpf_cnpj: digits(item?.cpf_cnpj),
        email: low(item?.email),
        endereco: up(item?.endereco),
        numero: up(item?.numero),
        bairro: up(item?.bairro),
        cidade: up(item?.cidade),
        uf: up(item?.uf),
        cep: digits(item?.cep),
        observacoes: up(item?.observacoes),
        status: up(item?.status) || "ATIVO",
      });
    }

    if (!clientesValidos.length) {
      return NextResponse.json(
        { error: "NENHUM CLIENTE VÁLIDO PARA IMPORTAÇÃO." },
        { status: 400 }
      );
    }

    const payload = clientesValidos.map((item) => ({
      empresa_id: caller.empresa_id,
      nome: item.nome,
      telefone: item.telefone || null,
      celular: item.celular || null,
      whatsapp: item.whatsapp || null,
      cpf_cnpj: item.cpf_cnpj || null,
      email: item.email || null,
      endereco: item.endereco || null,
      numero: item.numero || null,
      bairro: item.bairro || null,
      cidade: item.cidade || null,
      uf: item.uf || null,
      cep: item.cep || null,
      observacoes: item.observacoes || null,
      status: item.status || "ATIVO",
    }));

    const { error } = await admin.from("clientes").insert(payload);

    if (error) {
      return NextResponse.json(
        {
          error: "ERRO AO IMPORTAR CLIENTES.",
          detalhe: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      importados: payload.length,
      ignorados,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "ERRO INTERNO.",
        detalhe: error?.message || "SEM DETALHE",
      },
      { status: 500 }
    );
  }
}