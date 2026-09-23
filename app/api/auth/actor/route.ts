import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/connection-hub/supabase-admin";
import { extractAuthenticatedEmail } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleAuth(request);
}

export async function POST(request: Request) {
  return handleAuth(request);
}

async function handleAuth(request: Request) {
  const email = await extractAuthenticatedEmail(request);
  if (!email) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const db = createSupabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: "database_not_configured" },
      { status: 503 },
    );
  }

  try {
    const { data: actorRows, error: actorError } = await db.rpc(
      "platform_resolve_actor",
      { p_email: email },
    );

    const actor = Array.isArray(actorRows) ? actorRows[0] : actorRows;

    if (actorError || !actor || !actor.agency_id) {
      // Usuário autenticado, mas ainda sem agência vinculada (novo cliente SaaS)
      return NextResponse.json({
        authenticated: true,
        email,
        needsOnboarding: true,
      });
    }

    const { data: agency } = await db
      .from("agencies")
      .select("name, slug")
      .eq("id", actor.agency_id)
      .single();

    return NextResponse.json({
      authenticated: true,
      email,
      actorId: actor.actor_id,
      agencyId: actor.agency_id,
      agencyName: agency?.name ?? "Minha Agência",
      agencySlug: agency?.slug ?? "agencia",
      role: actor.role ?? "operator",
      needsOnboarding: false,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro ao resolver contexto da agência." },
      { status: 500 },
    );
  }
}
