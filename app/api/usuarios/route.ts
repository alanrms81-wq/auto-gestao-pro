import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl) {
    throw new Error("supabaseUrl is required.");
  }

  if (!serviceRoleKey) {
    throw new Error("serviceRoleKey is required.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export async function GET() {
  try {
    const adminSupabase = getAdminSupabase();

    const { data, error } = await adminSupabase
      .from("usuarios")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "ERRO INTERNO" },
      { status: 500 }
    );
  }
}