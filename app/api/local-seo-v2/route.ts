import { NextResponse } from "next/server";
import { ConnectionHubRepository } from "@/lib/connection-hub/repository";
import { createSupabaseAdmin } from "@/lib/connection-hub/supabase-admin";
import {
  calculatePartialScore,
  deterministicOpportunityRules,
  localSeoV2Request,
} from "@/lib/local-seo-v2-api";

export const dynamic = "force-dynamic";
const roleCanWrite = (role: string) =>
  ["owner", "admin", "operator"].includes(role);
export async function POST(request: Request) {
  const email =
    request.headers.get("oai-authenticated-user-email") ??
    (process.env.NODE_ENV === "development"
      ? "ag.alastredigital@gmail.com"
      : null);
  if (!email)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = localSeoV2Request.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const db = createSupabaseAdmin();
  if (!db)
    return NextResponse.json(
      { error: "persistence_not_configured" },
      { status: 503 },
    );
  try {
    const repository = new ConnectionHubRepository(db),
      actor = await repository.resolveActor(email),
      input = parsed.data;
    if (input.action === "clients") {
      const result = await db.from("clients").select("id,name,status,city,state,vertical").eq("agency_id", actor.agencyId).order("name");
      if (result.error) throw new Error("clients_load_failed");
      return NextResponse.json({ clients: result.data ?? [] });
    }
    const client = await db
      .from("clients")
      .select("id")
      .eq("agency_id", actor.agencyId)
      .eq("id", input.client_id)
      .maybeSingle();
    if (client.error || !client.data)
      return NextResponse.json({ error: "client_not_found" }, { status: 404 });
    if (input.action === "workspace") {
      const results = await Promise.all([
        db
          .from("client_services")
          .select("*")
          .eq("agency_id", actor.agencyId)
          .eq("client_id", input.client_id),
        db
          .from("local_seo_keywords")
          .select("*")
          .eq("agency_id", actor.agencyId)
          .eq("client_id", input.client_id)
          .order("updated_at", { ascending: false }),
        db
          .from("local_seo_competitors")
          .select("*")
          .eq("agency_id", actor.agencyId)
          .eq("client_id", input.client_id)
          .order("last_updated_at", { ascending: false }),
        db
          .from("local_seo_profile_checks")
          .select("*")
          .eq("agency_id", actor.agencyId)
          .eq("client_id", input.client_id),
        db
          .from("local_seo_score_snapshots")
          .select("*")
          .eq("agency_id", actor.agencyId)
          .eq("client_id", input.client_id)
          .order("calculated_at", { ascending: false })
          .limit(20),
        db
          .from("local_seo_opportunities")
          .select("*")
          .eq("agency_id", actor.agencyId)
          .eq("client_id", input.client_id)
          .order("detected_at", { ascending: false }),
      ]);
      if (results.some((result) => result.error))
        throw new Error("workspace_failed");
      return NextResponse.json({
        services: results[0].data ?? [],
        keywords: results[1].data ?? [],
        competitors: results[2].data ?? [],
        checks: results[3].data ?? [],
        scores: results[4].data ?? [],
        opportunities: results[5].data ?? [],
      });
    }
    if (!roleCanWrite(actor.role))
      return NextResponse.json({ error: "actor_forbidden" }, { status: 403 });
    if (input.action === "services_set") {
      const rows = input.services.map((service_key) => ({
        agency_id: actor.agencyId,
        client_id: input.client_id,
        service_key,
        status: "active",
        configured_by_user_id: null,
      }));
      const disabled = await db
        .from("client_services")
        .update({ status: "inactive", updated_at: new Date().toISOString() })
        .eq("agency_id", actor.agencyId)
        .eq("client_id", input.client_id);
      if (disabled.error) throw new Error("services_update_failed");
      if (rows.length) {
        const saved = await db
          .from("client_services")
          .upsert(rows, { onConflict: "client_id,service_key" });
        if (saved.error) throw new Error("services_update_failed");
      }
      await repository.audit(
        actor,
        "services.updated",
        "client",
        input.client_id,
        { enabled: input.services },
      );
      return NextResponse.json({ services: input.services });
    }
    if (input.action === "keyword_save") {
      const values = {
        agency_id: actor.agencyId,
        client_id: input.client_id,
        keyword: input.keyword,
        intent: input.intent,
        service: input.service || null,
        location: input.location || null,
        priority: input.priority,
        source: input.source,
        reason: input.reason || null,
        updated_at: new Date().toISOString(),
      };
      const result = input.id
        ? await db
            .from("local_seo_keywords")
            .update(values)
            .eq("agency_id", actor.agencyId)
            .eq("client_id", input.client_id)
            .eq("id", input.id)
            .select()
            .single()
        : await db
            .from("local_seo_keywords")
            .insert({ ...values, status: "suggested" })
            .select()
            .single();
      if (result.error) throw new Error("keyword_save_failed");
      await repository.audit(
        actor,
        input.id ? "keyword.updated" : "keyword.created",
        "local_seo_keyword",
        result.data.id,
        { source: input.source },
      );
      return NextResponse.json({ item: result.data });
    }
    if (input.action === "keyword_status") {
      const result = await db
        .from("local_seo_keywords")
        .update({ status: input.status, updated_at: new Date().toISOString() })
        .eq("agency_id", actor.agencyId)
        .eq("client_id", input.client_id)
        .eq("id", input.id)
        .select()
        .single();
      if (result.error) throw new Error("keyword_update_failed");
      await repository.audit(
        actor,
        input.status === "approved"
          ? "keyword.approved"
          : input.status === "archived"
            ? "keyword.archived"
            : "keyword.updated",
        "local_seo_keyword",
        input.id,
        { status: input.status },
      );
      return NextResponse.json({ item: result.data });
    }
    if (input.action === "competitor_save") {
      const values = {
        agency_id: actor.agencyId,
        client_id: input.client_id,
        name: input.name,
        category: input.category || null,
        location: input.location || null,
        rating: input.rating ?? null,
        review_count: input.review_count ?? null,
        website: input.website || null,
        notes: input.notes || null,
        source: "manual",
        status: "active",
        last_updated_at: new Date().toISOString(),
      };
      const result = input.id
        ? await db
            .from("local_seo_competitors")
            .update(values)
            .eq("agency_id", actor.agencyId)
            .eq("client_id", input.client_id)
            .eq("id", input.id)
            .select()
            .single()
        : await db
            .from("local_seo_competitors")
            .insert(values)
            .select()
            .single();
      if (result.error) throw new Error("competitor_save_failed");
      await repository.audit(
        actor,
        input.id ? "competitor.updated" : "competitor.created",
        "local_seo_competitor",
        result.data.id,
        {},
      );
      return NextResponse.json({ item: result.data });
    }
    if (input.action === "competitor_status") {
      const result = await db
        .from("local_seo_competitors")
        .update({
          status: input.status,
          last_updated_at: new Date().toISOString(),
        })
        .eq("agency_id", actor.agencyId)
        .eq("client_id", input.client_id)
        .eq("id", input.id)
        .select()
        .single();
      if (result.error) throw new Error("competitor_update_failed");
      await repository.audit(
        actor,
        "competitor.updated",
        "local_seo_competitor",
        input.id,
        { status: input.status },
      );
      return NextResponse.json({ item: result.data });
    }
    if (input.action === "audit_save") {
      const values = {
        agency_id: actor.agencyId,
        client_id: input.client_id,
        check_key: input.check_key,
        status: input.status,
        evidence_note: input.evidence_note || null,
        recommendation: input.recommendation || null,
        priority: input.priority ?? null,
        responsible_actor_id: actor.actorId,
        source: input.source,
        checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const result = await db
        .from("local_seo_profile_checks")
        .upsert(values, { onConflict: "client_id,check_key" })
        .select()
        .single();
      if (result.error) throw new Error("audit_save_failed");
      await repository.audit(
        actor,
        "audit_item.updated",
        "local_seo_profile_check",
        result.data.id,
        {
          check_key: input.check_key,
          status: input.status,
          source: input.source,
        },
      );
      return NextResponse.json({ item: result.data });
    }
    const [checksResult, keywordsResult, competitorsResult] = await Promise.all(
      [
        db
          .from("local_seo_profile_checks")
          .select("check_key,status")
          .eq("agency_id", actor.agencyId)
          .eq("client_id", input.client_id),
        db
          .from("local_seo_keywords")
          .select("id", { count: "exact", head: true })
          .eq("agency_id", actor.agencyId)
          .eq("client_id", input.client_id)
          .eq("status", "approved"),
        db
          .from("local_seo_competitors")
          .select("id", { count: "exact", head: true })
          .eq("agency_id", actor.agencyId)
          .eq("client_id", input.client_id)
          .eq("status", "active"),
      ],
    );
    if (checksResult.error || keywordsResult.error || competitorsResult.error)
      throw new Error("evidence_load_failed");
    if (input.action === "calculate_score") {
      const score = calculatePartialScore(checksResult.data ?? []);
      if (!score)
        return NextResponse.json({
          score: null,
          reason: "insufficient_evidence",
        });
      const result = await db
        .from("local_seo_score_snapshots")
        .insert({
          agency_id: actor.agencyId,
          client_id: input.client_id,
          ...score,
        })
        .select()
        .single();
      if (result.error) throw new Error("score_save_failed");
      await repository.audit(
        actor,
        "score.calculated",
        "local_seo_score_snapshot",
        result.data.id,
        { version: score.version, confidence: score.confidence },
      );
      return NextResponse.json({ score: result.data });
    }
    const rules = deterministicOpportunityRules({
        checks: checksResult.data ?? [],
        approvedKeywords: keywordsResult.count ?? 0,
        competitors: competitorsResult.count ?? 0,
      }),
      created = [];
    for (const rule of rules) {
      const exists = await db
        .from("local_seo_opportunities")
        .select("id")
        .eq("agency_id", actor.agencyId)
        .eq("client_id", input.client_id)
        .eq("origin", rule.origin)
        .eq("title", rule.title)
        .not("status", "in", "(completed,dismissed)")
        .maybeSingle();
      if (exists.error) throw new Error("opportunity_lookup_failed");
      if (exists.data) continue;
      const saved = await db
        .from("local_seo_opportunities")
        .insert({
          agency_id: actor.agencyId,
          client_id: input.client_id,
          ...rule,
          status: "detected",
          created_by_actor_id: actor.actorId,
          updated_by_actor_id: actor.actorId,
        })
        .select()
        .single();
      if (saved.error) throw new Error("opportunity_save_failed");
      created.push(saved.data);
      await repository.audit(
        actor,
        "opportunity.generated",
        "local_seo_opportunity",
        saved.data.id,
        {
          origin: rule.origin,
          category: rule.category,
          priority: rule.priority,
        },
      );
    }
    return NextResponse.json({ created });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "internal_error" },
      { status: 503 },
    );
  }
}
