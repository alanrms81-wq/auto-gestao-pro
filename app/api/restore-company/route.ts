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

type BackupPayload = {
  empresa_id: string;
  generated_at: string;
  version: number;
  tables: Record<string, any[]>;
};

const DELETE_ORDER = [
  "ordens_servico_produtos",
  "ordens_servico_servicos",
  "financeiro_titulos",
  "agendamentos",
  "ordens_servico",
  "veiculos",
  "produtos",
  "clientes",
  "empresas_config",
] as const;

const INSERT_ORDER = [
  "empresas_config",
  "clientes",
  "veiculos",
  "produtos",
  "ordens_servico",
  "ordens_servico_produtos",
  "ordens_servico_servicos",
  "financeiro_titulos",
  "agendamentos",
] as const;

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

async function insertInChunks(
  table: string,
  rows: any[],
  chunkSize = 200
) {
  const admin = getAdminClient();

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await admin.from(table).insert(chunk);

    if (error) {
      throw new Error(`Erro ao inserir em ${table}: ${error.message}`);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getCaller(request);
    if (!caller?.empresa_id) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const backupPath = String(body?.backupPath || "");

    if (!backupPath.startsWith(`empresa_${caller.empresa_id}/`)) {
      return NextResponse.json(
        { error: "Backup inválido para esta empresa." },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    const { data: file, error: downloadError } = await admin.storage
      .from("backups")
      .download(backupPath);

    if (downloadError || !file) {
      return NextResponse.json(
        { error: downloadError?.message || "Arquivo não encontrado." },
        { status: 404 }
      );
    }

    const backup = JSON.parse(await file.text()) as BackupPayload;

    if (backup.empresa_id !== caller.empresa_id) {
      return NextResponse.json(
        { error: "Este backup não pertence a esta empresa." },
        { status: 400 }
      );
    }

    // APAGA DADOS ATUAIS DESSA EMPRESA
    for (const table of DELETE_ORDER) {
      const { error } = await admin
        .from(table)
        .delete()
        .eq("empresa_id", caller.empresa_id);

      if (error) {
        throw new Error(`Erro ao limpar ${table}: ${error.message}`);
      }
    }

    // REINSERE DO BACKUP
    for (const table of INSERT_ORDER) {
      const rows = backup.tables?.[table] || [];
      if (rows.length > 0) {
        await insertInChunks(table, rows);
      }
    }

    return NextResponse.json({
      ok: true,
      empresa_id: caller.empresa_id,
      restored_from: backupPath,
      generated_at: backup.generated_at,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro interno." },
      { status: 500 }
    );
  }
}