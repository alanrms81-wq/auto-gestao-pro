import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "FALTAM VARIÁVEIS DE AMBIENTE DO SUPABASE." },
        { status: 500 }
      );
    }

    const body = await req.json();

    const nomeEmpresa = String(body.nomeEmpresa || "").trim();
    const cnpj = String(body.cnpj || "").trim();
    const telefoneEmpresa = String(body.telefoneEmpresa || "").trim();
    const nomeUsuario = String(body.nomeUsuario || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const senha = String(body.senha || "");

    if (!nomeEmpresa || !nomeUsuario || !email || !senha) {
      return NextResponse.json(
        { error: "PREENCHA OS CAMPOS OBRIGATÓRIOS." },
        { status: 400 }
      );
    }

    const { data: existeAuth } = await adminSupabase.auth.admin.listUsers();
    const jaExiste = existeAuth?.users?.some(
      (u) => (u.email || "").toLowerCase() === email
    );

    if (jaExiste) {
      return NextResponse.json(
        { error: "JÁ EXISTE UM USUÁRIO AUTH COM ESSE E-MAIL." },
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
        { error: "ERRO AO CRIAR USUÁRIO AUTH: " + (authError?.message || "") },
        { status: 400 }
      );
    }

    const { data: empresa, error: empresaError } = await adminSupabase
      .from("empresas")
      .insert([
        {
          nome: nomeEmpresa.toUpperCase(),
          email,
          telefone: telefoneEmpresa,
          cnpj,
        },
      ])
      .select("id")
      .single();

    if (empresaError || !empresa) {
      await adminSupabase.auth.admin.deleteUser(authData.user.id);

      return NextResponse.json(
        { error: "ERRO AO CRIAR EMPRESA: " + (empresaError?.message || "") },
        { status: 400 }
      );
    }

    const { error: usuarioError } = await adminSupabase.from("usuarios").insert([
      {
        id: authData.user.id,
        empresa_id: empresa.id,
        nome: nomeUsuario.toUpperCase(),
        email,
        role: "ADMIN",
        status: "ATIVO",
      },
    ]);

    if (usuarioError) {
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      await adminSupabase.from("empresas").delete().eq("id", empresa.id);

      return NextResponse.json(
        { error: "ERRO AO CRIAR USUÁRIO ERP: " + usuarioError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "CONTA CRIADA COM SUCESSO.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "ERRO INTERNO." },
      { status: 500 }
    );
  }
}