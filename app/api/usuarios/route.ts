import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

export async function GET(req: NextRequest) {
  try {
    const empresa_id = req.nextUrl.searchParams.get("empresa_id");

    if (!empresa_id) {
      return NextResponse.json(
        { error: "empresa_id é obrigatório." },
        { status: 400 }
      );
    }

    const { data, error } = await adminSupabase
      .from("usuarios")
      .select("id, empresa_id, nome, email, role, status")
      .eq("empresa_id", empresa_id)
      .order("nome");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ usuarios: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "ERRO INTERNO." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const empresa_id = String(body.empresa_id || "").trim();
    const nome = String(body.nome || "").trim().toUpperCase();
    const email = String(body.email || "").trim().toLowerCase();
    const senha = String(body.senha || "");
    const role = String(body.role || "FUNCIONARIO").trim().toUpperCase();
    const status = String(body.status || "ATIVO").trim().toUpperCase();

    if (!empresa_id || !nome || !email || !senha) {
      return NextResponse.json(
        { error: "PREENCHA OS CAMPOS OBRIGATÓRIOS." },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } =
      await adminSupabase.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "ERRO AO CRIAR AUTH." },
        { status: 400 }
      );
    }

    const { error: usuarioError } = await adminSupabase.from("usuarios").insert([
      {
        id: authData.user.id,
        empresa_id,
        nome,
        email,
        role,
        status,
      },
    ]);

    if (usuarioError) {
      await adminSupabase.auth.admin.deleteUser(authData.user.id);

      return NextResponse.json(
        { error: usuarioError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "ERRO INTERNO." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    const id = String(body.id || "").trim();
    const empresa_id = String(body.empresa_id || "").trim();
    const status = String(body.status || "").trim().toUpperCase();

    if (!id || !empresa_id || !status) {
      return NextResponse.json(
        { error: "DADOS INVÁLIDOS." },
        { status: 400 }
      );
    }

    const { error } = await adminSupabase
      .from("usuarios")
      .update({ status })
      .eq("id", id)
      .eq("empresa_id", empresa_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "ERRO INTERNO." },
      { status: 500 }
    );
  }
}