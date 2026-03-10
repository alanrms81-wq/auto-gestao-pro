import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { clientes } = body;

    if (!clientes || !clientes.length) {
      return NextResponse.json(
        { error: "Nenhum cliente enviado." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("clientes")
      .insert(clientes);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sucesso: true,
      total: clientes.length
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}