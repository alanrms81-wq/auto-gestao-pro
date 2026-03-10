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

type ProdutoImportado = {
  nome: string;
  codigo_sku?: string;
  preco_balcao?: number;
  estoque_atual?: number;
  categoria?: string;
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

function toMoney(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown) {
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
    const produtos = Array.isArray(body?.produtos) ? body.produtos : [];

    if (!produtos.length) {
      return NextResponse.json(
        { error: "NENHUM PRODUTO INFORMADO." },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    const produtosValidos: ProdutoImportado[] = [];
    let ignorados = 0;

    for (const item of produtos) {
      const nome = up(item?.nome);
      if (!nome) {
        ignorados++;
        continue;
      }

      produtosValidos.push({
        nome,
        codigo_sku: up(item?.codigo_sku),
        preco_balcao: toMoney(item?.preco_balcao),
        estoque_atual: toInt(item?.estoque_atual),
        categoria: up(item?.categoria),
        status: up(item?.status) || "ATIVO",
      });
    }

    if (!produtosValidos.length) {
      return NextResponse.json(
        { error: "NENHUM PRODUTO VÁLIDO PARA IMPORTAÇÃO." },
        { status: 400 }
      );
    }

    const payload = produtosValidos.map((item) => ({
      empresa_id: caller.empresa_id,
      tipo: "PRODUTO",
      nome: item.nome,
      codigo_sku: item.codigo_sku || null,
      preco_balcao: item.preco_balcao || 0,
      controla_estoque: true,
      estoque_atual: item.estoque_atual || 0,
      categoria: item.categoria || null,
      status: item.status || "ATIVO",
    }));

    const { error } = await admin.from("produtos").insert(payload);

    if (error) {
      return NextResponse.json(
        {
          error: "ERRO AO IMPORTAR PRODUTOS.",
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
