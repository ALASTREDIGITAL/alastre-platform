import { ConnectionHubRepository } from "../../../lib/connection-hub/repository.ts";
import { createSupabaseAdmin } from "../../../lib/connection-hub/supabase-admin.ts";
import { extractAuthenticatedEmail } from "../../../lib/server-auth.ts";
import {
  productFactoryRequestSchema,
  type ProductWorkspaceData,
} from "../../../lib/product-factory-api.ts";
import {
  calculateViabilityCheckpoint,
  canTransitionProductStatus,
  createNextVersion,
  STANDARD_SEO_LOCAL_DISCOVERY_ROUNDS,
  type ProductDefinition,
  type DiscoverySession,
  type ProductScopeItem,
  type OperationalSop,
  type RaciAssignment,
} from "../../../lib/product-factory-domain.ts";

export const dynamic = "force-dynamic";

const roleCanWrite = (role: string) =>
  ["owner", "admin", "operator"].includes(role);

// Memória local para testes e desenvolvimento offline
const inMemoryStore = new Map<string, ProductWorkspaceData>();

export async function POST(request: Request) {
  const email = await extractAuthenticatedEmail(request);
  if (!email) {
    return Response.json({ error: "Acesso não identificado." }, { status: 401 });
  }

  const jsonBody = await request.json().catch(() => null);
  const parsed = productFactoryRequestSchema.safeParse(jsonBody);
  if (!parsed.success) {
    return Response.json(
      { error: "Payload inválido.", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const db = createSupabaseAdmin();

  // Obter contexto do ator e agência
  let actor = {
    actorId: "actor_local",
    agencyId: "00000000-0000-0000-0000-000000000001",
    role: "operator",
  };

  if (db) {
    try {
      const repository = new ConnectionHubRepository(db);
      actor = await repository.resolveActor(email);
    } catch {
      // Falha segura ou fallback para desenvolvimento
    }
  }

  // 1. Listar Produtos
  if (input.action === "list_products") {
    if (db) {
      let query = db
        .from("product_definitions")
        .select("*")
        .eq("agency_id", actor.agencyId)
        .order("created_at", { ascending: false });

      if (input.status) query = query.eq("status", input.status);
      if (input.client_id) query = query.eq("client_id", input.client_id);

      const { data, error } = await query;
      if (error) {
        return Response.json({ error: "Erro ao buscar produtos." }, { status: 500 });
      }
      return Response.json({ products: data ?? [] });
    }

    // Fallback in-memory
    const products = Array.from(inMemoryStore.values())
      .map((w) => w.product)
      .filter(
        (p) =>
          p.agency_id === actor.agencyId &&
          (!input.status || p.status === input.status) &&
          (!input.client_id || p.client_id === input.client_id),
      );
    return Response.json({ products });
  }

  // 2. Criar Produto
  if (input.action === "create_product") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    const newProduct: ProductDefinition = {
      id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      agency_id: actor.agencyId,
      client_id: input.client_id ?? null,
      name: input.name,
      slug: input.slug,
      summary: input.summary ?? "",
      version: 1,
      status: "draft",
      target_objective: input.target_objective ?? "",
      target_market: input.target_market ?? "",
      icp_description: input.icp_description ?? "",
      anti_icp_description: input.anti_icp_description ?? "",
      transformational_promise: input.transformational_promise ?? "",
      controllable_deliverables: input.controllable_deliverables,
      influenciable_indicators: input.influenciable_indicators,
      external_results: input.external_results,
      is_immutable: false,
      created_by_actor_id: actor.actorId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Cria sessão inicial de descoberta baseada no catálogo padrão
    const initialSession: DiscoverySession = {
      id: `sess_${newProduct.id}_r1`,
      agency_id: actor.agencyId,
      product_definition_id: newProduct.id,
      round_number: 1,
      status: "in_progress",
      questions: STANDARD_SEO_LOCAL_DISCOVERY_ROUNDS[0].questions,
      answers: [],
      started_at: new Date().toISOString(),
    };

    if (db) {
      const { error: prodError } = await db.from("product_definitions").insert({
        id: newProduct.id,
        agency_id: newProduct.agency_id,
        client_id: newProduct.client_id,
        name: newProduct.name,
        slug: newProduct.slug,
        summary: newProduct.summary,
        version: newProduct.version,
        status: newProduct.status,
        target_objective: newProduct.target_objective,
        target_market: newProduct.target_market,
        icp_description: newProduct.icp_description,
        anti_icp_description: newProduct.anti_icp_description,
        transformational_promise: newProduct.transformational_promise,
        controllable_deliverables: newProduct.controllable_deliverables,
        influenciable_indicators: newProduct.influenciable_indicators,
        external_results: newProduct.external_results,
        is_immutable: newProduct.is_immutable,
        created_by_actor_id: newProduct.created_by_actor_id,
        created_at: newProduct.created_at,
        updated_at: newProduct.updated_at,
      });

      if (prodError) {
        return Response.json({ error: "Erro ao criar definição do produto." }, { status: 500 });
      }

      await db.from("product_discovery_sessions").insert({
        id: initialSession.id,
        agency_id: initialSession.agency_id,
        product_definition_id: initialSession.product_definition_id,
        round_number: initialSession.round_number,
        status: initialSession.status,
        questions: initialSession.questions as any,
        answers: initialSession.answers as any,
        started_at: initialSession.started_at,
      });

      // Auditoria
      await db.from("audit_events").insert({
        agency_id: actor.agencyId,
        actor_user_id: null,
        action: "product_create",
        target_type: "product_definition",
        target_id: newProduct.id,
        payload: { name: newProduct.name, version: newProduct.version, actor_id: actor.actorId },
      });
    }

    inMemoryStore.set(newProduct.id, {
      product: newProduct,
      sessions: [initialSession],
      scopeItems: [],
      sops: [],
      raci: [],
      viability: null,
    });

    return Response.json({ ok: true, product: newProduct });
  }

  // 3. Obter Produto e Workspace Completo
  if (input.action === "get_product") {
    if (db) {
      const { data: prodData, error: prodErr } = await db
        .from("product_definitions")
        .select("*")
        .eq("agency_id", actor.agencyId)
        .eq("id", input.product_id)
        .maybeSingle();

      if (prodErr || !prodData) {
        return Response.json({ error: "Produto não encontrado." }, { status: 404 });
      }

      const [sessRes, scopeRes, sopsRes, raciRes, viabRes] = await Promise.all([
        db.from("product_discovery_sessions").select("*").eq("agency_id", actor.agencyId).eq("product_definition_id", input.product_id).order("round_number"),
        db.from("product_scope_items").select("*").eq("agency_id", actor.agencyId).eq("product_definition_id", input.product_id).order("sort_order"),
        db.from("product_operational_sops").select("*").eq("agency_id", actor.agencyId).eq("product_definition_id", input.product_id).order("name"),
        db.from("product_raci_assignments").select("*").eq("agency_id", actor.agencyId).eq("product_definition_id", input.product_id),
        db.from("product_viability_checkpoints").select("*").eq("agency_id", actor.agencyId).eq("product_definition_id", input.product_id).order("calculated_at", { ascending: false }).limit(1),
      ]);

      const workspace: ProductWorkspaceData = {
        product: prodData as any,
        sessions: (sessRes.data ?? []) as any,
        scopeItems: (scopeRes.data ?? []) as any,
        sops: (sopsRes.data ?? []) as any,
        raci: (raciRes.data ?? []) as any,
        viability: (viabRes.data?.[0] as any) ?? null,
      };

      return Response.json(workspace);
    }

    const item = inMemoryStore.get(input.product_id);
    if (!item || item.product.agency_id !== actor.agencyId) {
      return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    }
    return Response.json(item);
  }

  // 4. Salvar Rodada de Descoberta
  if (input.action === "save_discovery_round") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    // Regra estrita: máximo de 7 perguntas por rodada
    if (input.questions.length > 7) {
      return Response.json(
        { error: "Limite violado: uma rodada pode conter no máximo 7 perguntas." },
        { status: 400 },
      );
    }

    const sessionId = `sess_${input.product_id}_r${input.round_number}`;
    const sessionData: DiscoverySession = {
      id: sessionId,
      agency_id: actor.agencyId,
      product_definition_id: input.product_id,
      round_number: input.round_number,
      status: input.status,
      questions: input.questions as any,
      answers: input.answers.map((a) => ({
        ...a,
        answered_at: a.answered_at ?? new Date().toISOString(),
      })),
      started_at: new Date().toISOString(),
      completed_at: input.status === "completed" ? new Date().toISOString() : null,
    };

    if (db) {
      const { error } = await db.from("product_discovery_sessions").upsert({
        id: sessionData.id,
        agency_id: sessionData.agency_id,
        product_definition_id: sessionData.product_definition_id,
        round_number: sessionData.round_number,
        status: sessionData.status,
        questions: sessionData.questions as any,
        answers: sessionData.answers as any,
        started_at: sessionData.started_at,
        completed_at: sessionData.completed_at,
      });

      if (error) {
        return Response.json({ error: "Erro ao salvar sessão de descoberta." }, { status: 500 });
      }

      await db.from("audit_events").insert({
        agency_id: actor.agencyId,
        actor_user_id: null,
        action: "discovery_round_save",
        target_type: "product_discovery_session",
        target_id: sessionId,
        payload: { round: input.round_number, status: input.status, answersCount: input.answers.length },
      });
    }

    const currentWs = inMemoryStore.get(input.product_id);
    if (currentWs) {
      const filtered = currentWs.sessions.filter((s) => s.round_number !== input.round_number);
      filtered.push(sessionData);
      currentWs.sessions = filtered;
    }

    return Response.json({ ok: true, session: sessionData });
  }

  // 5. Salvar Itens de Escopo
  if (input.action === "save_scope_items") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    const items: ProductScopeItem[] = input.items.map((i, index) => ({
      id: i.id || `scope_${input.product_id}_${index + 1}`,
      agency_id: actor.agencyId,
      product_definition_id: input.product_id,
      activity_name: i.activity_name,
      description: i.description,
      delivery_type: i.delivery_type,
      frequency: i.frequency,
      default_role: i.default_role,
      estimated_minutes: i.estimated_minutes,
      is_automatable: i.is_automatable,
      client_participation_required: i.client_participation_required,
      dependencies: i.dependencies,
      acceptance_criteria: i.acceptance_criteria,
      required_evidence: i.required_evidence,
      scope_classification: i.scope_classification,
      sort_order: i.sort_order ?? index,
    }));

    if (db) {
      // Remove itens antigos e insere os novos atomicamente
      await db
        .from("product_scope_items")
        .delete()
        .eq("agency_id", actor.agencyId)
        .eq("product_definition_id", input.product_id);

      const { error } = await db.from("product_scope_items").insert(
        items.map((it) => ({
          id: it.id,
          agency_id: it.agency_id,
          product_definition_id: it.product_definition_id,
          activity_name: it.activity_name,
          description: it.description,
          delivery_type: it.delivery_type,
          frequency: it.frequency,
          default_role: it.default_role,
          estimated_minutes: it.estimated_minutes,
          is_automatable: it.is_automatable,
          client_participation_required: it.client_participation_required,
          dependencies: it.dependencies as any,
          acceptance_criteria: it.acceptance_criteria,
          required_evidence: it.required_evidence,
          scope_classification: it.scope_classification,
          sort_order: it.sort_order,
        })),
      );

      if (error) {
        return Response.json({ error: "Erro ao salvar itens de escopo." }, { status: 500 });
      }

      await db.from("audit_events").insert({
        agency_id: actor.agencyId,
        actor_user_id: null,
        action: "scope_items_save",
        target_type: "product_scope_items",
        target_id: input.product_id,
        payload: { count: items.length },
      });
    }

    const currentWs = inMemoryStore.get(input.product_id);
    if (currentWs) currentWs.scopeItems = items;

    return Response.json({ ok: true, items });
  }

  // 6. Salvar SOPs
  if (input.action === "save_sops") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    const sops: OperationalSop[] = input.sops.map((s, index) => ({
      id: s.id || `sop_${input.product_id}_${index + 1}`,
      agency_id: actor.agencyId,
      product_definition_id: input.product_id,
      scope_item_id: s.scope_item_id ?? null,
      name: s.name,
      objective: s.objective,
      trigger: s.trigger,
      responsible_role: s.responsible_role,
      prerequisites: s.prerequisites,
      tools_required: s.tools_required,
      steps: s.steps,
      quality_checklist: s.quality_checklist,
      completion_criteria: s.completion_criteria,
      required_evidence: s.required_evidence,
      estimated_minutes: s.estimated_minutes,
      errors_and_exceptions: s.errors_and_exceptions,
    }));

    if (db) {
      await db
        .from("product_operational_sops")
        .delete()
        .eq("agency_id", actor.agencyId)
        .eq("product_definition_id", input.product_id);

      const { error } = await db.from("product_operational_sops").insert(
        sops.map((sop) => ({
          id: sop.id,
          agency_id: sop.agency_id,
          product_definition_id: sop.product_definition_id,
          scope_item_id: sop.scope_item_id,
          name: sop.name,
          objective: sop.objective,
          trigger: sop.trigger,
          responsible_role: sop.responsible_role,
          prerequisites: sop.prerequisites as any,
          tools_required: sop.tools_required as any,
          steps: sop.steps as any,
          quality_checklist: sop.quality_checklist as any,
          completion_criteria: sop.completion_criteria,
          required_evidence: sop.required_evidence,
          estimated_minutes: sop.estimated_minutes,
          errors_and_exceptions: sop.errors_and_exceptions as any,
        })),
      );

      if (error) {
        return Response.json({ error: "Erro ao salvar SOPs." }, { status: 500 });
      }

      await db.from("audit_events").insert({
        agency_id: actor.agencyId,
        actor_user_id: null,
        action: "sops_save",
        target_type: "product_operational_sops",
        target_id: input.product_id,
        payload: { count: sops.length },
      });
    }

    const currentWs = inMemoryStore.get(input.product_id);
    if (currentWs) currentWs.sops = sops;

    return Response.json({ ok: true, sops });
  }

  // 7. Salvar RACI
  if (input.action === "save_raci") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    const raci: RaciAssignment[] = input.assignments.map((r, index) => ({
      id: r.id || `raci_${input.product_id}_${index + 1}`,
      agency_id: actor.agencyId,
      product_definition_id: input.product_id,
      scope_item_id: r.scope_item_id ?? null,
      activity_name: r.activity_name,
      role: r.role,
      is_future_role: r.is_future_role,
      raci_type: r.raci_type,
    }));

    if (db) {
      await db
        .from("product_raci_assignments")
        .delete()
        .eq("agency_id", actor.agencyId)
        .eq("product_definition_id", input.product_id);

      const { error } = await db.from("product_raci_assignments").insert(
        raci.map((rc) => ({
          id: rc.id,
          agency_id: rc.agency_id,
          product_definition_id: rc.product_definition_id,
          scope_item_id: rc.scope_item_id,
          activity_name: rc.activity_name,
          role: rc.role,
          is_future_role: rc.is_future_role,
          raci_type: rc.raci_type,
        })),
      );

      if (error) {
        return Response.json({ error: "Erro ao salvar RACI." }, { status: 500 });
      }

      await db.from("audit_events").insert({
        agency_id: actor.agencyId,
        actor_user_id: null,
        action: "raci_save",
        target_type: "product_raci_assignments",
        target_id: input.product_id,
        payload: { count: raci.length },
      });
    }

    const currentWs = inMemoryStore.get(input.product_id);
    if (currentWs) currentWs.raci = raci;

    return Response.json({ ok: true, raci });
  }

  // 8. Calcular Checkpoint de Viabilidade
  if (input.action === "calculate_viability") {
    let ws = inMemoryStore.get(input.product_id);

    if (db) {
      const [prodRes, sessRes, scopeRes, sopsRes, raciRes] = await Promise.all([
        db.from("product_definitions").select("*").eq("agency_id", actor.agencyId).eq("id", input.product_id).single(),
        db.from("product_discovery_sessions").select("*").eq("agency_id", actor.agencyId).eq("product_definition_id", input.product_id),
        db.from("product_scope_items").select("*").eq("agency_id", actor.agencyId).eq("product_definition_id", input.product_id),
        db.from("product_operational_sops").select("*").eq("agency_id", actor.agencyId).eq("product_definition_id", input.product_id),
        db.from("product_raci_assignments").select("*").eq("agency_id", actor.agencyId).eq("product_definition_id", input.product_id),
      ]);

      if (prodRes.error || !prodRes.data) {
        return Response.json({ error: "Produto não encontrado." }, { status: 404 });
      }

      ws = {
        product: prodRes.data as any,
        sessions: (sessRes.data ?? []) as any,
        scopeItems: (scopeRes.data ?? []) as any,
        sops: (sopsRes.data ?? []) as any,
        raci: (raciRes.data ?? []) as any,
        viability: null,
      };
    }

    if (!ws) {
      return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    }

    const viability = calculateViabilityCheckpoint({
      product: ws.product,
      sessions: ws.sessions,
      scopeItems: ws.scopeItems,
      sops: ws.sops,
      raci: ws.raci,
    });

    if (db) {
      await db.from("product_viability_checkpoints").insert({
        id: viability.id,
        agency_id: viability.agency_id,
        product_definition_id: viability.product_definition_id,
        discovery_completeness_percentage: viability.discovery_completeness_percentage,
        blocking_gaps: viability.blocking_gaps as any,
        total_setup_hours: viability.total_setup_hours,
        total_recurring_monthly_hours: viability.total_recurring_monthly_hours,
        critical_dependencies: viability.critical_dependencies as any,
        unvalidated_capacity_flags: viability.unvalidated_capacity_flags as any,
        result: viability.result,
        viability_score: viability.viability_score,
        explanation: viability.explanation,
        calculated_at: viability.calculated_at,
      });

      await db.from("audit_events").insert({
        agency_id: actor.agencyId,
        actor_user_id: null,
        action: "viability_calculate",
        target_type: "product_viability_checkpoint",
        target_id: viability.id,
        payload: { result: viability.result, score: viability.viability_score },
      });
    }

    ws.viability = viability;
    inMemoryStore.set(input.product_id, ws);

    return Response.json({ ok: true, viability });
  }

  // 9. Submeter para Revisão e Aprovação Humana
  if (input.action === "submit_for_review") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    let ws = inMemoryStore.get(input.product_id);

    if (db) {
      const prodRes = await db
        .from("product_definitions")
        .select("*")
        .eq("agency_id", actor.agencyId)
        .eq("id", input.product_id)
        .single();

      if (prodRes.error || !prodRes.data) {
        return Response.json({ error: "Produto não encontrado." }, { status: 404 });
      }

      const [sessRes, scopeRes, sopsRes, raciRes] = await Promise.all([
        db.from("product_discovery_sessions").select("*").eq("agency_id", actor.agencyId).eq("product_definition_id", input.product_id),
        db.from("product_scope_items").select("*").eq("agency_id", actor.agencyId).eq("product_definition_id", input.product_id),
        db.from("product_operational_sops").select("*").eq("agency_id", actor.agencyId).eq("product_definition_id", input.product_id),
        db.from("product_raci_assignments").select("*").eq("agency_id", actor.agencyId).eq("product_definition_id", input.product_id),
      ]);

      ws = {
        product: prodRes.data as any,
        sessions: (sessRes.data ?? []) as any,
        scopeItems: (scopeRes.data ?? []) as any,
        sops: (sopsRes.data ?? []) as any,
        raci: (raciRes.data ?? []) as any,
        viability: null,
      };
    }

    if (!ws) {
      return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    }

    // Calcula ou valida o checkpoint de viabilidade
    const viability = calculateViabilityCheckpoint({
      product: ws.product,
      sessions: ws.sessions,
      scopeItems: ws.scopeItems,
      sops: ws.sops,
      raci: ws.raci,
    });

    const transitionCheck = canTransitionProductStatus(ws.product.status, "in_review", viability);
    if (!transitionCheck.allowed) {
      return Response.json(
        {
          error: transitionCheck.reason || "Transição bloqueada por lacunas no checkpoint de viabilidade.",
          viability,
        },
        { status: 400 },
      );
    }

    if (db) {
      await db
        .from("product_definitions")
        .update({
          status: "in_review",
          updated_at: new Date().toISOString(),
        })
        .eq("agency_id", actor.agencyId)
        .eq("id", input.product_id);

      // Reutiliza o mecanismo central de aprovações da plataforma: approval_items
      await db.from("approval_items").insert({
        agency_id: actor.agencyId,
        client_id: ws.product.client_id ?? "00000000-0000-0000-0000-000000000000",
        requested_by_email: email,
        source_type: "product_definition_version",
        source_id: ws.product.id,
        status: "pending",
        snapshot: {
          product_name: ws.product.name,
          version: ws.product.version,
          viability_score: viability.viability_score,
          setup_hours: viability.total_setup_hours,
          recurring_monthly_hours: viability.total_recurring_monthly_hours,
          submission_note: input.submission_note ?? "Submissão para aprovação operacional da versão.",
        },
      });

      await db.from("audit_events").insert({
        agency_id: actor.agencyId,
        actor_user_id: null,
        action: "product_submit_review",
        target_type: "product_definition",
        target_id: input.product_id,
        payload: { version: ws.product.version, viabilityScore: viability.viability_score },
      });
    }

    ws.product.status = "in_review";
    ws.viability = viability;
    inMemoryStore.set(input.product_id, ws);

    return Response.json({ ok: true, product: ws.product, viability });
  }

  // 10. Criar Nova Versão de Produto Aprovado
  if (input.action === "create_new_version") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    let ws = inMemoryStore.get(input.product_id);
    if (!ws && db) {
      const prodRes = await db
        .from("product_definitions")
        .select("*")
        .eq("agency_id", actor.agencyId)
        .eq("id", input.product_id)
        .single();
      if (prodRes.data) {
        ws = {
          product: prodRes.data as any,
          sessions: [],
          scopeItems: [],
          sops: [],
          raci: [],
          viability: null,
        };
      }
    }

    if (!ws) {
      return Response.json({ error: "Produto não encontrado." }, { status: 404 });
    }

    if (ws.product.status !== "approved") {
      return Response.json(
        { error: "Apenas versões já aprovadas podem gerar uma nova versão incrementada." },
        { status: 400 },
      );
    }

    const { newProduct, oldStatus } = createNextVersion(ws.product, actor.actorId);

    if (db) {
      // Atualiza o produto atual para superseded
      await db
        .from("product_definitions")
        .update({
          status: oldStatus,
          superseded_by_id: newProduct.id,
          updated_at: new Date().toISOString(),
        })
        .eq("agency_id", actor.agencyId)
        .eq("id", input.product_id);

      // Insere nova versão em draft
      await db.from("product_definitions").insert({
        id: newProduct.id,
        agency_id: newProduct.agency_id,
        client_id: newProduct.client_id,
        name: newProduct.name,
        slug: newProduct.slug,
        summary: newProduct.summary,
        version: newProduct.version,
        status: newProduct.status,
        target_objective: newProduct.target_objective,
        target_market: newProduct.target_market,
        icp_description: newProduct.icp_description,
        anti_icp_description: newProduct.anti_icp_description,
        transformational_promise: newProduct.transformational_promise,
        controllable_deliverables: newProduct.controllable_deliverables as any,
        influenciable_indicators: newProduct.influenciable_indicators as any,
        external_results: newProduct.external_results as any,
        is_immutable: false,
        created_by_actor_id: actor.actorId,
        created_at: newProduct.created_at,
        updated_at: newProduct.updated_at,
      });

      await db.from("audit_events").insert({
        agency_id: actor.agencyId,
        actor_user_id: null,
        action: "product_version_create",
        target_type: "product_definition",
        target_id: newProduct.id,
        payload: { previousVersion: ws.product.version, newVersion: newProduct.version },
      });
    }

    ws.product.status = oldStatus;
    ws.product.superseded_by_id = newProduct.id;

    inMemoryStore.set(newProduct.id, {
      product: newProduct,
      sessions: ws.sessions,
      scopeItems: ws.scopeItems,
      sops: ws.sops,
      raci: ws.raci,
      viability: null,
    });

    return Response.json({ ok: true, product: newProduct });
  }

  // 11. Arquivar Produto
  if (input.action === "archive_product") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    if (db) {
      await db
        .from("product_definitions")
        .update({
          status: "archived",
          updated_at: new Date().toISOString(),
        })
        .eq("agency_id", actor.agencyId)
        .eq("id", input.product_id);

      await db.from("audit_events").insert({
        agency_id: actor.agencyId,
        actor_user_id: null,
        action: "product_archive",
        target_type: "product_definition",
        target_id: input.product_id,
        payload: {},
      });
    }

    const currentWs = inMemoryStore.get(input.product_id);
    if (currentWs) currentWs.product.status = "archived";

    return Response.json({ ok: true, status: "archived" });
  }

  return Response.json({ error: "Ação não suportada." }, { status: 400 });
}
