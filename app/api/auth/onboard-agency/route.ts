import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/connection-hub/supabase-admin";
import { extractAuthenticatedEmail } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function POST(request: Request) {
  const email = await extractAuthenticatedEmail(request);
  if (!email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const db = createSupabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: "database_not_configured" },
      { status: 503 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawName = typeof body?.name === "string" ? body.name.trim() : "";
    if (rawName.length < 2 || rawName.length > 120) {
      return NextResponse.json(
        { error: "Nome da agência deve conter entre 2 e 120 caracteres." },
        { status: 400 },
      );
    }

    const baseSlug = slugify(rawName) || "agencia";
    const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    // 1. Criar a nova Agência (tenant isolado)
    const { data: agency, error: agencyError } = await db
      .from("agencies")
      .insert({
        name: rawName,
        slug: uniqueSlug,
        status: "active",
      })
      .select("id, name, slug")
      .single();

    if (agencyError || !agency) {
      return NextResponse.json(
        { error: "Não foi possível registrar a agência." },
        { status: 500 },
      );
    }

    // 2. Criar o ator com papel 'owner' para o fundador
    const { data: actor, error: actorError } = await db
      .from("agency_actors")
      .insert({
        agency_id: agency.id,
        email,
        display_name: rawName,
        role: "owner",
        active: true,
      })
      .select("id, role")
      .single();

    if (actorError || !actor) {
      return NextResponse.json(
        { error: "Falha ao vincular o operador à nova agência." },
        { status: 500 },
      );
    }

    // 3. Registrar auditoria do evento de onboarding
    await db.from("audit_events").insert({
      agency_id: agency.id,
      action: "agency_onboarded",
      target_type: "agency",
      target_id: agency.id,
      payload: {
        creator_email: email,
        actor_id: actor.id,
        agency_name: agency.name,
      },
    });

    return NextResponse.json({
      success: true,
      agencyId: agency.id,
      agencyName: agency.name,
      agencySlug: agency.slug,
      actorId: actor.id,
      role: actor.role,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro inesperado no cadastro da agência." },
      { status: 500 },
    );
  }
}
