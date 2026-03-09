import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const cronSecret = process.env.CRON_SECRET!;

const TABLES = [
  "clientes",
  "veiculos",
  "produtos",
  "ordens_servico",
  "ordens_servico_produtos",
  "ordens_servico_servicos",
  "financeiro_titulos",
  "agendamentos",
  "empresas_config",
] as const;

type SessionUser = {
  id: string;
  empresa_id: string;
  nome?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
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

async function buildCompanyBackup(empresaId: string) {
  const admin = getAdminClient();
  const tables: Record<string, any[]> = {};

  for (const table of TABLES) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .eq("empresa_id", empresaId);

    if (error) {
      throw new Error(`Erro ao ler ${table}: ${error.message}`);
    }

    tables[table] = data || [];
  }

  return {
    empresa_id: empresaId,
    generated_at: new Date().toISOString(),
    version: 1,
    tables,
  };
}

function backupFileName() {
  return `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
}

function companyFolder(empresaId: string) {
  return `empresa_${empresaId}`;
}

async function saveBackupToStorage(empresaId: string, payload: unknown) {
  const admin = getAdminClient();
  const folder = companyFolder(empresaId);
  const path = `${folder}/${backupFileName()}`;
  const body = Buffer.from(JSON.stringify(payload, null, 2), "utf8");

  const { error } = await admin.storage
    .from("backups")
    .upload(path, body, {
      contentType: "application/json",
      upsert: false,
    });

  if (error) {
    throw new Error(`Erro ao salvar backup: ${error.message}`);
  }

  return path;
}

async function listCompanyBackups(empresaId: string) {
  const admin = getAdminClient();
  const folder = companyFolder(empresaId);

  const { data, error } = await admin.storage
    .from("backups")
    .list(folder, {
      limit: 100,
    });

  if (error) {
    throw new Error(`Erro ao listar backups: ${error.message}`);
  }

  return (data || [])
    .filter((item) => item.name.endsWith(".json"))
    .sort((a, b) => b.name.localeCompare(a.name))
    .map((item) => ({
      name: item.name,
      path: `${folder}/${item.name}`,
      updated_at: item.updated_at,
      created_at: item.created_at,
      metadata: item.metadata,
    }));
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");

    // LISTAGEM MANUAL
    if (mode === "list") {
      const caller = await getCaller(request);
      if (!caller?.empresa_id) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
      }

      const backups = await listCompanyBackups(caller.empresa_id);
      return NextResponse.json({ backups });
    }

    // DOWNLOAD MANUAL
    if (mode === "download") {
      const caller = await getCaller(request);
      if (!caller?.empresa_id) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
      }

      const path = url.searchParams.get("path") || "";
      if (!path.startsWith(companyFolder(caller.empresa_id) + "/")) {
        return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
      }

      const admin = getAdminClient();
      const { data, error } = await admin.storage.from("backups").download(path);

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message || "Arquivo não encontrado." },
          { status: 404 }
        );
      }

      const text = await data.text();

      return new NextResponse(text, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${path.split("/").pop()}"`,
        },
      });
    }

    // CRON AUTOMÁTICO
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const admin = getAdminClient();
    const { data: empresasRows, error: empresasError } = await admin
      .from("usuarios")
      .select("empresa_id")
      .not("empresa_id", "is", null);

    if (empresasError) {
      return NextResponse.json(
        { error: empresasError.message },
        { status: 500 }
      );
    }

    const empresaIds = Array.from(
      new Set((empresasRows || []).map((r: any) => r.empresa_id).filter(Boolean))
    );

    const result: Array<{ empresa_id: string; ok: boolean; path?: string; error?: string }> = [];

    for (const empresaId of empresaIds) {
      try {
        const payload = await buildCompanyBackup(empresaId);
        const path = await saveBackupToStorage(empresaId, payload);
        result.push({ empresa_id: empresaId, ok: true, path });
      } catch (err: any) {
        result.push({
          empresa_id: empresaId,
          ok: false,
          error: err?.message || "Erro desconhecido",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      total_empresas: empresaIds.length,
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro interno." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getCaller(request);
    if (!caller?.empresa_id) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const payload = await buildCompanyBackup(caller.empresa_id);
    const path = await saveBackupToStorage(caller.empresa_id, payload);

    return NextResponse.json({
      ok: true,
      empresa_id: caller.empresa_id,
      path,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro interno." },
      { status: 500 }
    );
  }
}