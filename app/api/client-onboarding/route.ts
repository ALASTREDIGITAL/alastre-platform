import { createSupabaseAdmin } from "../../../lib/connection-hub/supabase-admin.ts";
import { extractAuthenticatedEmail, resolveAuthenticatedActor } from "../../../lib/server-auth.ts";
import {
  canWriteOnboarding,
  canCancelOnboarding,
  canUnblockOnboarding,
  validateActivationApprovalPermission,
} from "../../../lib/permissions.ts";
import {
  clientOnboardingRequestSchema,
  type OnboardingWorkspaceData,
} from "../../../lib/client-onboarding-api.ts";
import {
  calculateActivationChecklist,
  generateDefaultRequirements,
  validateBaselineData,
  generateImplementationPlanFromProduct,
  type ClientOnboarding,
  type ClientUnit,
  type OnboardingRequirement,
  type OnboardingBaseline,
  type ImplementationPlan,
  type OnboardingDecision,
  type OnboardingStage,
} from "../../../lib/client-onboarding-domain.ts";

import { getCriticalPendingFields } from "../../../lib/dna-domain.ts";

export const dynamic = "force-dynamic";

export const VALID_PRE_ACTIVATION_SERVICE_STATUSES = ["pending", "active"] as const;

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

// Armazenamento em memória para testes e ambiente isolado
interface InMemoryOnboardingDb {
  onboardings: Map<string, ClientOnboarding>;
  units: Map<string, ClientUnit[]>;
  requirements: Map<string, OnboardingRequirement[]>;
  baselines: Map<string, OnboardingBaseline[]>;
  plans: Map<string, ImplementationPlan>;
  decisions: Map<string, OnboardingDecision[]>;
  clients: Map<string, { id: string; agency_id: string; name: string; slug: string; status: string }>;
  clientServices: Map<string, Array<{ id: string; agency_id: string; client_id: string; service_key: string; status: string }>>;
  dnaProfiles: Map<string, { client_id: string; agency_id: string; status: string; business_data: Record<string, unknown> }>;
  approvalItems: Map<string, { id: string; agency_id: string; client_id: string; source_type: string; source_id: string; status: string }>;
}

export const memoryStore: InMemoryOnboardingDb = {
  onboardings: new Map(),
  units: new Map(),
  requirements: new Map(),
  baselines: new Map(),
  plans: new Map(),
  decisions: new Map(),
  clients: new Map(),
  clientServices: new Map(),
  dnaProfiles: new Map(),
  approvalItems: new Map(),
};

export async function POST(request: Request) {
  const email = await extractAuthenticatedEmail(request);
  if (!email) {
    return Response.json({ error: "Acesso não identificado." }, { status: 401 });
  }

  const jsonBody = await request.json().catch(() => null);
  const parsed = clientOnboardingRequestSchema.safeParse(jsonBody);
  if (!parsed.success) {
    return Response.json(
      { error: "Payload inválido.", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const db = createSupabaseAdmin();
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && !db) {
    return Response.json(
      { error: "Serviço temporariamente indisponível. Configuração de banco de dados ausente." },
      { status: 503 }
    );
  }

  let actor: { actorId: string; agencyId: string; role: string };

  if (db) {
    const resolved = await resolveAuthenticatedActor(request, db);
    if (!resolved || !resolved.actor) {
      return Response.json(
        { error: "Acesso não autorizado para esta agência." },
        { status: 403 }
      );
    }
    actor = resolved.actor;
  } else {
    if (isProduction) {
      return Response.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
    }
    const testAgencyId =
      request.headers.get("x-alastre-agency-id") ||
      request.headers.get("x-alastre-test-agency-id") ||
      "a1a57e00-0000-4000-8000-000000000001";
    const testActorId = request.headers.get("x-alastre-test-actor-id") || "actor_dev";
    const testRole = request.headers.get("x-alastre-test-role") || "operator";
    actor = {
      actorId: testActorId,
      agencyId: testAgencyId,
      role: testRole,
    };
  }

  // Em ambiente de teste/desenvolvimento (não produção), permite chavear a agência ou papel para testes multi-tenant
  if (!isProduction) {
    const testAgencyId = request.headers.get("x-alastre-agency-id");
    if (testAgencyId) {
      actor.agencyId = testAgencyId;
    }
    const testRole = request.headers.get("x-alastre-test-role");
    if (testRole) {
      actor.role = testRole;
    }
  }

  const agencyId = actor.agencyId;

  // 1. Listar Onboardings
  if (input.action === "list_onboardings") {
    if (db) {
      let query = db
        .from("client_onboardings")
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false });

      if (input.status) {
        query = query.eq("status", input.status);
      }

      const { data, error } = await query;
      if (error) {
        return Response.json({ error: "Erro ao consultar onboardings da agência." }, { status: 500 });
      }

      const formatted: ClientOnboarding[] = (data || []).map((row: any) => ({
        id: row.id,
        agencyId: row.agency_id,
        clientId: row.client_id,
        opportunityId: row.opportunity_id,
        salesHandoffId: row.sales_handoff_id,
        proposalId: row.proposal_id,
        productDefinitionId: row.product_definition_id,
        productVersion: row.product_version,
        status: row.status as OnboardingStage,
        currentStage: row.current_stage as OnboardingStage,
        divergenceReason: row.divergence_reason,
        blockingReason: row.blocking_reason,
        commercialScopeSnapshot: row.commercial_scope_snapshot || {},
        createdByActorId: row.created_by_actor_id,
        assignedOperatorActorId: row.assigned_operator_actor_id,
        idempotencyKey: row.idempotency_key,
        activatedAt: row.activated_at,
        activatedByActorId: row.activated_by_actor_id,
        activationApprovalId: row.activation_approval_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return Response.json({ onboardings: formatted });
    }

    // Memória local
    let list = Array.from(memoryStore.onboardings.values()).filter(
      (o) => o.agencyId === agencyId
    );
    if (input.status) {
      list = list.filter((o) => o.status === input.status);
    }
    return Response.json({ onboardings: list });
  }

  // 2. Iniciar Onboarding a partir de Handoff
  if (input.action === "start_from_handoff") {
    const { salesHandoffId, idempotencyKey } = input;

    // Idempotência: verificar se já existe onboarding para esse handoff
    if (db) {
      const { data: existing } = await db
        .from("client_onboardings")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("sales_handoff_id", salesHandoffId)
        .maybeSingle();

      if (existing) {
        return Response.json({
          success: true,
          message: "Onboarding já existente recuperado com sucesso.",
          onboardingId: existing.id,
        });
      }

      // Buscar handoff para validação
      const { data: handoff, error: handoffErr } = await db
        .from("commercial_sales_handoffs")
        .select("*, commercial_opportunities(*), commercial_proposals(*)")
        .eq("agency_id", agencyId)
        .eq("id", salesHandoffId)
        .maybeSingle();

      if (handoffErr || !handoff) {
        return Response.json({ error: "Handoff comercial não encontrado na agência." }, { status: 404 });
      }

      // REGRA: Apenas handoff 'approved_for_onboarding' pode iniciar onboarding
      if (handoff.status !== "approved_for_onboarding") {
        return Response.json(
          { error: `Handoff comercial deve possuir status 'approved_for_onboarding' (atual: '${handoff.status}').` },
          { status: 400 }
        );
      }

      const opp = handoff.commercial_opportunities || {};
      const prop = handoff.commercial_proposals || {};
      const onboardingId = `onb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const { data: inserted, error: insertErr } = await db
        .from("client_onboardings")
        .insert({
          id: onboardingId,
          agency_id: agencyId,
          opportunity_id: handoff.opportunity_id,
          sales_handoff_id: handoff.id,
          proposal_id: handoff.proposal_id,
          product_definition_id: prop.product_definition_id || opp.product_definition_id,
          product_version: prop.product_version || opp.product_version || 1,
          status: "awaiting_commercial_review",
          current_stage: "awaiting_commercial_review",
          commercial_scope_snapshot: {
            handoffChecklist: handoff.checklist,
            promisesMade: handoff.promises_made,
            clientExpectations: handoff.client_expectations,
            operationalRisks: handoff.operational_risks,
            setupPrice: prop.setup_price,
            monthlyPrice: prop.monthly_price,
            selectedScope: prop.selected_scope_items,
          },
          created_by_actor_id: actor.actorId,
          idempotency_key: idempotencyKey || null,
        })
        .select()
        .single();

      if (insertErr || !inserted) {
        return Response.json({ error: "Falha ao criar registro de onboarding." }, { status: 500 });
      }

      // Gerar requisitos padrão
      const defaultReqs = generateDefaultRequirements({
        agencyId,
        onboardingId,
      });

      const reqRows = defaultReqs.map((r, i) => ({
        id: `req-${onboardingId}-${i + 1}`,
        agency_id: r.agencyId,
        onboarding_id: r.onboardingId,
        category: r.category,
        title: r.title,
        description: r.description,
        responsible: r.responsible,
        is_required: r.isRequired,
        blocks_activation: r.blocksActivation,
        status: r.status,
        notes: r.notes,
      }));

      await db.from("client_onboarding_requirements").insert(reqRows);

      // Auditoria
      await db.from("audit_events").insert({
        agency_id: agencyId,
        action: "client_onboarding_started",
        target_type: "client_onboarding",
        target_id: onboardingId,
        payload: {
          sales_handoff_id: salesHandoffId,
          opportunity_id: handoff.opportunity_id,
          proposal_id: handoff.proposal_id,
        },
      });

      return Response.json({
        success: true,
        onboardingId,
      });
    }

    // Memória local
    const existing = Array.from(memoryStore.onboardings.values()).find(
      (o) => o.agencyId === agencyId && o.salesHandoffId === salesHandoffId
    );
    if (existing) {
      return Response.json({
        success: true,
        message: "Onboarding já existente recuperado com sucesso.",
        onboardingId: existing.id,
      });
    }

    const onboardingId = `onb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newOnboarding: ClientOnboarding = {
      id: onboardingId,
      agencyId,
      opportunityId: "opp-mock-01",
      salesHandoffId,
      proposalId: "prop-mock-01",
      productDefinitionId: "prod-seo-local-canonical",
      productVersion: 1,
      status: "awaiting_commercial_review",
      currentStage: "awaiting_commercial_review",
      commercialScopeSnapshot: {},
      createdByActorId: actor.actorId,
      idempotencyKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    memoryStore.onboardings.set(onboardingId, newOnboarding);

    const defaultReqs = generateDefaultRequirements({ agencyId, onboardingId }).map((r, i) => ({
      ...r,
      id: `req-${onboardingId}-${i + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    memoryStore.requirements.set(onboardingId, defaultReqs);

    return Response.json({
      success: true,
      onboardingId,
    });
  }

  // 3. Obter Workspace de Onboarding
  if (input.action === "get_onboarding_workspace") {
    const { onboardingId } = input;

    if (db) {
      const { data: onb, error: onbErr } = await db
        .from("client_onboardings")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("id", onboardingId)
        .maybeSingle();

      if (onbErr || !onb) {
        return Response.json({ error: "Onboarding não encontrado ou não pertencente à agência." }, { status: 404 });
      }

      // Carregar entidades relacionadas
      const [
        unitsRes,
        reqsRes,
        baselinesRes,
        plansRes,
        decisionsRes,
        clientRes,
        handoffRes,
        propRes,
        prodRes,
        servicesRes,
        dnaRes,
      ] = await Promise.all([
        db.from("client_units").select("*").eq("agency_id", agencyId).eq("onboarding_id", onboardingId),
        db.from("client_onboarding_requirements").select("*").eq("agency_id", agencyId).eq("onboarding_id", onboardingId).order("created_at"),
        db.from("client_onboarding_baselines").select("*").eq("agency_id", agencyId).eq("onboarding_id", onboardingId).order("version", { ascending: false }).limit(1).maybeSingle(),
        db.from("client_onboarding_plans").select("*").eq("agency_id", agencyId).eq("onboarding_id", onboardingId).maybeSingle(),
        db.from("client_onboarding_decisions").select("*").eq("agency_id", agencyId).eq("onboarding_id", onboardingId).order("decided_at", { ascending: false }),
        onb.client_id ? db.from("clients").select("*").eq("agency_id", agencyId).eq("id", onb.client_id).maybeSingle() : Promise.resolve({ data: null }),
        db.from("commercial_sales_handoffs").select("*, commercial_companies(*)").eq("agency_id", agencyId).eq("id", onb.sales_handoff_id).maybeSingle(),
        db.from("commercial_proposals").select("*").eq("agency_id", agencyId).eq("id", onb.proposal_id).maybeSingle(),
        db.from("product_definitions").select("*").eq("agency_id", agencyId).eq("id", onb.product_definition_id).maybeSingle(),
        onb.client_id
          ? db.from("client_services").select("id, status, service_key").eq("agency_id", agencyId).eq("client_id", onb.client_id).in("status", ["pending", "active"])
          : Promise.resolve({ data: [] }),
        onb.client_id
          ? db.from("client_dna_profiles").select("status, business_data").eq("agency_id", agencyId).eq("client_id", onb.client_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const units: ClientUnit[] = (unitsRes.data || []).map((u: any) => ({
        id: u.id,
        agencyId: u.agency_id,
        clientId: u.client_id,
        onboardingId: u.onboarding_id,
        name: u.name,
        unitType: u.unit_type,
        isPhysicalStore: u.is_physical_store,
        hasServiceArea: u.has_service_area,
        serviceRadiusKm: u.service_radius_km ? Number(u.service_radius_km) : undefined,
        status: u.status,
        phone: u.phone,
        email: u.email,
        addressStreet: u.address_street,
        addressNumber: u.address_number,
        addressComplement: u.address_complement,
        neighborhood: u.neighborhood,
        city: u.city,
        stateUf: u.state_uf,
        postalCode: u.postal_code,
        latitude: u.latitude ? Number(u.latitude) : undefined,
        longitude: u.longitude ? Number(u.longitude) : undefined,
        businessHours: u.business_hours || {},
        gbpPlaceId: u.gbp_place_id,
        gbpLocationId: u.gbp_location_id,
        gbpCid: u.gbp_cid,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      }));

      const requirements: OnboardingRequirement[] = (reqsRes.data || []).map((r: any) => ({
        id: r.id,
        agencyId: r.agency_id,
        onboardingId: r.onboarding_id,
        clientId: r.client_id,
        unitId: r.unit_id,
        category: r.category,
        title: r.title,
        description: r.description,
        responsible: r.responsible,
        isRequired: r.is_required,
        blocksActivation: r.blocks_activation,
        status: r.status,
        deadline: r.deadline,
        evidenceText: r.evidence_text,
        evidenceUrl: r.evidence_url,
        notes: r.notes || "",
        waivedReason: r.waived_reason,
        verifiedByActorId: r.verified_by_actor_id,
        verifiedAt: r.verified_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      const rawBase = baselinesRes.data;
      const baseline: OnboardingBaseline | null = rawBase
        ? {
            id: rawBase.id,
            agencyId: rawBase.agency_id,
            onboardingId: rawBase.onboarding_id,
            clientId: rawBase.client_id,
            unitId: rawBase.unit_id,
            version: rawBase.version,
            source: rawBase.source,
            profileCompletenessScore: rawBase.profile_completeness_score,
            currentRating: rawBase.current_rating ? Number(rawBase.current_rating) : null,
            currentReviewCount: rawBase.current_review_count,
            unansweredReviewsCount: rawBase.unanswered_reviews_count,
            rankingVisibilityNotes: rawBase.ranking_visibility_notes || "",
            contentAudit: rawBase.content_audit || {},
            trackedKeywords: rawBase.tracked_keywords || [],
            knownCompetitors: rawBase.known_competitors || [],
            availableConversions: rawBase.available_conversions || {},
            collectionLimitations: rawBase.collection_limitations || [],
            unavailableDataPoints: rawBase.unavailable_data_points || [],
            establishedByActorId: rawBase.established_by_actor_id,
            establishedAt: rawBase.established_at,
            createdAt: rawBase.created_at,
          }
        : null;

      const rawPlan = plansRes.data;
      const plan: ImplementationPlan | null = rawPlan
        ? {
            id: rawPlan.id,
            agencyId: rawPlan.agency_id,
            onboardingId: rawPlan.onboarding_id,
            clientId: rawPlan.client_id,
            productDefinitionId: rawPlan.product_definition_id,
            productVersion: rawPlan.product_version,
            status: rawPlan.status,
            items: rawPlan.items || [],
            totalSetupMinutes: rawPlan.total_setup_minutes || 0,
            totalRecurringMonthlyMinutes: rawPlan.total_recurring_monthly_minutes || 0,
            targetStartDate: rawPlan.target_start_date,
            targetActivationDate: rawPlan.target_activation_date,
            plannedByActorId: rawPlan.planned_by_actor_id,
            createdAt: rawPlan.created_at,
            updatedAt: rawPlan.updated_at,
          }
        : null;

      const decisions: OnboardingDecision[] = (decisionsRes.data || []).map((d: any) => ({
        id: d.id,
        agencyId: d.agency_id,
        onboardingId: d.onboarding_id,
        decisionType: d.decision_type,
        actorId: d.actor_id,
        actorName: d.actor_name,
        actorRole: d.actor_role,
        reason: d.reason,
        metadata: d.metadata || {},
        decidedAt: d.decided_at,
      }));

      // Calcular checklist de ativação com serviços e DNA reais
      const pendingReqAccesses = requirements.filter(
        (r) => r.category === "access_credentials" && r.isRequired && r.status !== "verified" && r.status !== "waived"
      ).length;

      const validServices = (servicesRes.data || []).filter((s: any) => ["pending", "active"].includes(s.status));
      const dnaData = dnaRes.data;
      const isDnaConfirmed = Boolean(
        dnaData &&
        dnaData.status === "confirmed" &&
        getCriticalPendingFields(dnaData.business_data || {}).length === 0
      );

      const readiness = calculateActivationChecklist({
        isSalesVerified: ["awaiting_operations_review", "awaiting_client_information", "collecting_access", "building_dna", "establishing_baseline", "planning_implementation", "ready_for_activation", "active"].includes(onb.status) && !onb.divergence_reason,
        hasValidClient: Boolean(onb.client_id),
        unitsCount: units.length,
        enabledServicesCount: validServices.length,
        isDnaMinimumConfirmed: isDnaConfirmed,
        pendingRequiredAccesses: pendingReqAccesses,
        hasBaseline: Boolean(baseline),
        hasImplementationPlan: Boolean(plan),
        hasAssignedResponsible: Boolean(onb.assigned_operator_actor_id || onb.created_by_actor_id),
        hasOpenBlockers: onb.status === "blocked",
        isHumanApprovalRecorded: onb.status === "active" || Boolean(onb.activated_at),
      });

      const companyData = handoffRes.data?.commercial_companies;

      const workspace: OnboardingWorkspaceData = {
        onboarding: {
          id: onb.id,
          agencyId: onb.agency_id,
          clientId: onb.client_id,
          opportunityId: onb.opportunity_id,
          salesHandoffId: onb.sales_handoff_id,
          proposalId: onb.proposal_id,
          productDefinitionId: onb.product_definition_id,
          productVersion: onb.product_version,
          status: onb.status as OnboardingStage,
          currentStage: onb.current_stage as OnboardingStage,
          divergenceReason: onb.divergence_reason,
          blockingReason: onb.blocking_reason,
          commercialScopeSnapshot: onb.commercial_scope_snapshot || {},
          createdByActorId: onb.created_by_actor_id,
          assignedOperatorActorId: onb.assigned_operator_actor_id,
          idempotencyKey: onb.idempotency_key,
          activatedAt: onb.activated_at,
          activatedByActorId: onb.activated_by_actor_id,
          activationApprovalId: onb.activation_approval_id,
          createdAt: onb.created_at,
          updatedAt: onb.updated_at,
        },
        client: clientRes.data
          ? {
              id: clientRes.data.id,
              name: clientRes.data.name,
              slug: clientRes.data.slug,
              status: clientRes.data.status,
            }
          : null,
        company: companyData
          ? {
              id: companyData.id,
              name: companyData.name,
              segment: companyData.segment,
              city: companyData.city,
              stateUf: companyData.state_uf,
              phone: companyData.phone,
              rating: companyData.rating ? String(companyData.rating) : undefined,
              reviewCount: companyData.review_count,
              mapsUrl: companyData.maps_url,
              placeId: companyData.place_id,
            }
          : null,
        units,
        requirements,
        baseline,
        plan,
        decisions,
        readiness,
        salesHandoff: handoffRes.data
          ? {
              id: handoffRes.data.id,
              status: handoffRes.data.status,
              promisesMade: handoffRes.data.promises_made,
              clientExpectations: handoffRes.data.client_expectations,
              operationalRisks: handoffRes.data.operational_risks,
              criticalDependencies: handoffRes.data.critical_dependencies,
              missingData: handoffRes.data.missing_data,
              checklist: handoffRes.data.checklist || {},
            }
          : null,
        proposal: propRes.data
          ? {
              id: propRes.data.id,
              version: propRes.data.version,
              status: propRes.data.status,
              setupPrice: String(propRes.data.setup_price),
              monthlyPrice: String(propRes.data.monthly_price),
              selectedScopeItems: propRes.data.selected_scope_items || [],
            }
          : null,
        product: prodRes.data
          ? {
              id: prodRes.data.id,
              name: prodRes.data.name,
              slug: prodRes.data.slug,
              version: prodRes.data.version,
              status: prodRes.data.status,
            }
          : null,
      };

      return Response.json(workspace);
    }

    // Memória local
    const onb = memoryStore.onboardings.get(onboardingId);
    if (!onb || onb.agencyId !== agencyId) {
      return Response.json({ error: "Onboarding não encontrado ou não pertencente à agência." }, { status: 404 });
    }

    const units = memoryStore.units.get(onboardingId) || [];
    const requirements = memoryStore.requirements.get(onboardingId) || [];
    const baseline = (memoryStore.baselines.get(onboardingId) || [])[0] || null;
    const plan = memoryStore.plans.get(onboardingId) || null;
    const decisions = memoryStore.decisions.get(onboardingId) || [];

    const client = onb.clientId ? memoryStore.clients.get(onb.clientId) : null;
    const services = onb.clientId ? (memoryStore.clientServices.get(onb.clientId) || []) : [];
    const validServices = services.filter((s) => s.agency_id === agencyId && ["pending", "active"].includes(s.status));
    const dnaProfile = onb.clientId ? memoryStore.dnaProfiles.get(onb.clientId) : null;
    const isDnaConfirmed = Boolean(
      dnaProfile &&
      dnaProfile.agency_id === agencyId &&
      dnaProfile.status === "confirmed" &&
      getCriticalPendingFields(dnaProfile.business_data || {}).length === 0
    );

    const pendingReqAccesses = requirements.filter(
      (r) => r.category === "access_credentials" && r.isRequired && r.status !== "verified" && r.status !== "waived"
    ).length;

    const readiness = calculateActivationChecklist({
      isSalesVerified: ["awaiting_operations_review", "awaiting_client_information", "collecting_access", "building_dna", "establishing_baseline", "planning_implementation", "ready_for_activation", "active"].includes(onb.status) && !onb.divergenceReason,
      hasValidClient: Boolean(onb.clientId),
      unitsCount: units.length,
      enabledServicesCount: validServices.length,
      isDnaMinimumConfirmed: isDnaConfirmed,
      pendingRequiredAccesses: pendingReqAccesses,
      hasBaseline: Boolean(baseline),
      hasImplementationPlan: Boolean(plan),
      hasAssignedResponsible: true,
      hasOpenBlockers: onb.status === "blocked",
      isHumanApprovalRecorded: onb.status === "active",
    });

    const workspace: OnboardingWorkspaceData = {
      onboarding: onb,
      client: client || null,
      units,
      requirements,
      baseline,
      plan,
      decisions,
      readiness,
      company: {
        id: "comp-local-01",
        name: "Empresa Local Exemplo",
        segment: "Saúde e Odontologia",
        city: "Sorocaba",
        stateUf: "SP",
      },
      product: {
        id: onb.productDefinitionId,
        name: "SEO Local e Google Business Profile",
        slug: "seo-local-gbp",
        version: onb.productVersion,
        status: "approved",
      },
    };

    return Response.json(workspace);
  }

  // 4. Conferência da Venda (Revisão Comercial)
  if (input.action === "review_sales") {
    const { onboardingId, decision, divergenceReason, notes } = input;

    if (decision === "diverged") {
      const reason = divergenceReason || "Divergência identificada durante a conferência comercial da venda.";

      if (db) {
        await db
          .from("client_onboardings")
          .update({
            status: "blocked",
            current_stage: "blocked",
            divergence_reason: reason,
            blocking_reason: reason,
            updated_at: new Date().toISOString(),
          })
          .eq("agency_id", agencyId)
          .eq("id", onboardingId);

        await db.from("client_onboarding_decisions").insert({
          id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          agency_id: agencyId,
          onboarding_id: onboardingId,
          decision_type: "commercial_review_diverged",
          actor_id: actor.actorId,
          actor_name: email,
          actor_role: actor.role,
          reason,
          metadata: { notes },
        });

        await db.from("audit_events").insert({
          agency_id: agencyId,
          action: "client_onboarding_divergence_recorded",
          target_type: "client_onboarding",
          target_id: onboardingId,
          payload: { reason, notes },
        });
      }

      const onb = memoryStore.onboardings.get(onboardingId);
      if (onb && onb.agencyId === agencyId) {
        onb.status = "blocked";
        onb.currentStage = "blocked";
        onb.divergenceReason = reason;
        onb.blockingReason = reason;
      }

      return Response.json({
        success: true,
        status: "blocked",
        divergenceReason: reason,
      });
    }

    // Aprovado
    if (db) {
      await db
        .from("client_onboardings")
        .update({
          status: "awaiting_operations_review",
          current_stage: "awaiting_operations_review",
          divergence_reason: null,
          blocking_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("agency_id", agencyId)
        .eq("id", onboardingId);

      await db.from("client_onboarding_decisions").insert({
        id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        agency_id: agencyId,
        onboarding_id: onboardingId,
        decision_type: "commercial_review_approved",
        actor_id: actor.actorId,
        actor_name: email,
        actor_role: actor.role,
        reason: "Venda conferida e aprovada sem divergências de escopo.",
        metadata: { notes },
      });

      await db.from("audit_events").insert({
        agency_id: agencyId,
        action: "client_onboarding_sales_approved",
        target_type: "client_onboarding",
        target_id: onboardingId,
        payload: { notes },
      });
    }

    const onb = memoryStore.onboardings.get(onboardingId);
    if (onb && onb.agencyId === agencyId) {
      onb.status = "awaiting_operations_review";
      onb.currentStage = "awaiting_operations_review";
      onb.divergenceReason = undefined;
      onb.blockingReason = undefined;
    }

    return Response.json({
      success: true,
      status: "awaiting_operations_review",
    });
  }

  // 5. Registrar Divergência
  if (input.action === "record_divergence") {
    const { onboardingId, reason, issues } = input;

    if (db) {
      await db
        .from("client_onboardings")
        .update({
          status: "blocked",
          current_stage: "blocked",
          divergence_reason: reason,
          blocking_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("agency_id", agencyId)
        .eq("id", onboardingId);

      await db.from("client_onboarding_decisions").insert({
        id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        agency_id: agencyId,
        onboarding_id: onboardingId,
        decision_type: "onboarding_blocked",
        actor_id: actor.actorId,
        actor_name: email,
        actor_role: actor.role,
        reason,
        metadata: { issues },
      });

      await db.from("audit_events").insert({
        agency_id: agencyId,
        action: "client_onboarding_blocked",
        target_type: "client_onboarding",
        target_id: onboardingId,
        payload: { reason, issues },
      });
    }

    const onb = memoryStore.onboardings.get(onboardingId);
    if (onb && onb.agencyId === agencyId) {
      onb.status = "blocked";
      onb.currentStage = "blocked";
      onb.divergenceReason = reason;
      onb.blockingReason = reason;
    }

    return Response.json({
      success: true,
      status: "blocked",
      divergenceReason: reason,
    });
  }

  // 6. Criação Transacional e Idempotente de Cliente Operacional (Entrega 03.3)
  if (input.action === "create_or_link_client_transactional") {
    const { onboardingId, clientName, unitName, unitCity, unitStateUf } = input;

    if (db) {
      // 1. Buscar onboarding
      const { data: onb, error: onbErr } = await db
        .from("client_onboardings")
        .select("*, commercial_sales_handoffs(*, commercial_companies(*))")
        .eq("agency_id", agencyId)
        .eq("id", onboardingId)
        .maybeSingle();

      if (onbErr || !onb) {
        return Response.json({ error: "Onboarding não encontrado na agência." }, { status: 404 });
      }

      // Idempotência: se já tiver client_id, retorna sucesso
      if (onb.client_id) {
        return Response.json({
          success: true,
          message: "Cliente já criado e vinculado a este onboarding.",
          clientId: onb.client_id,
        });
      }

      const company = onb.commercial_sales_handoffs?.commercial_companies;
      const targetName = clientName || company?.name || "Cliente Alastre";
      const baseSlug = slugify(targetName);
      const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

      let createdClientId: string | null = null;
      let createdUnitId: string | null = null;

      try {
        // Passo A: Criar cliente em public.clients
        const { data: clientRow, error: clientErr } = await db
          .from("clients")
          .insert({
            agency_id: agencyId,
            name: targetName,
            slug: uniqueSlug,
            status: "onboarding",
          })
          .select()
          .single();

        if (clientErr || !clientRow) {
          throw new Error(`Falha ao criar cliente: ${clientErr?.message || "erro desconhecido"}`);
        }
        createdClientId = clientRow.id;

        // Passo B: Criar unidade sede em public.client_units
        const uId = `unit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const { error: unitErr } = await db.from("client_units").insert({
          id: uId,
          agency_id: agencyId,
          client_id: createdClientId,
          onboarding_id: onboardingId,
          name: unitName || `${targetName} - Sede`,
          unit_type: "headquarters",
          is_physical_store: true,
          city: unitCity || company?.city || "Sorocaba",
          state_uf: unitStateUf || company?.state_uf || "SP",
          status: "active",
        });

        if (unitErr) {
          throw new Error(`Falha ao criar unidade inicial: ${unitErr.message}`);
        }
        createdUnitId = uId;

        // Passo C: Habilitar serviço principal em public.client_services
        const { error: servErr } = await db.from("client_services").insert({
          agency_id: agencyId,
          client_id: createdClientId,
          service_key: "local_seo",
          status: "pending",
        });

        if (servErr) {
          throw new Error(`Falha ao habilitar serviços do cliente: ${servErr.message}`);
        }

        // Passo D: Inicializar DNA em public.client_dna_profiles
        const { error: dnaErr } = await db.from("client_dna_profiles").insert({
          agency_id: agencyId,
          client_id: createdClientId,
          status: "draft",
          business_data: {
            company_name: targetName,
            segment: company?.segment || "",
            city: unitCity || company?.city || "Sorocaba",
            state_uf: unitStateUf || company?.state_uf || "SP",
            phone: company?.phone || "",
          },
        });

        if (dnaErr) {
          throw new Error(`Falha ao inicializar DNA do cliente: ${dnaErr.message}`);
        }

        // Passo E: Atualizar onboarding com client_id e transicionar estágio
        const nextStage: OnboardingStage = "awaiting_client_information";
        const { error: updateOnbErr } = await db
          .from("client_onboardings")
          .update({
            client_id: createdClientId,
            status: nextStage,
            current_stage: nextStage,
            updated_at: new Date().toISOString(),
          })
          .eq("agency_id", agencyId)
          .eq("id", onboardingId);

        if (updateOnbErr) {
          throw new Error(`Falha ao vincular cliente ao onboarding: ${updateOnbErr.message}`);
        }

        // Passo F: Atualizar requisitos com client_id e unit_id
        await db
          .from("client_onboarding_requirements")
          .update({
            client_id: createdClientId,
            unit_id: createdUnitId,
          })
          .eq("agency_id", agencyId)
          .eq("onboarding_id", onboardingId);

        // Passo G: Registrar auditoria transacional
        await db.from("audit_events").insert({
          agency_id: agencyId,
          client_id: createdClientId,
          action: "client_onboarding_client_created",
          target_type: "client",
          target_id: createdClientId,
          payload: {
            onboarding_id: onboardingId,
            unit_id: createdUnitId,
            client_name: targetName,
          },
        });

        return Response.json({
          success: true,
          clientId: createdClientId,
          unitId: createdUnitId,
          status: nextStage,
        });
      } catch (err: unknown) {
        // Rollback defensivo: se falhar, elimina registros órfãos criados nesta transação
        if (createdClientId) {
          try {
            await db.from("client_dna_profiles").delete().eq("agency_id", agencyId).eq("client_id", createdClientId);
            await db.from("client_services").delete().eq("agency_id", agencyId).eq("client_id", createdClientId);
            await db.from("client_units").delete().eq("agency_id", agencyId).eq("client_id", createdClientId);
            await db.from("clients").delete().eq("agency_id", agencyId).eq("id", createdClientId);
          } catch {}
        }
        return Response.json(
          { error: err instanceof Error ? err.message : "Erro na criação transacional do cliente." },
          { status: 500 }
        );
      }
    }

    // Memória local
    const onb = memoryStore.onboardings.get(onboardingId);
    if (!onb || onb.agencyId !== agencyId) {
      return Response.json({ error: "Onboarding não encontrado na agência." }, { status: 404 });
    }

    const cId = `client-${Date.now()}`;
    const targetName = clientName || "Empresa Local Exemplo";
    memoryStore.clients.set(cId, {
      id: cId,
      agency_id: agencyId,
      name: targetName,
      slug: slugify(targetName),
      status: "onboarding",
    });

    const uId = `unit-${Date.now()}`;
    const newUnit: ClientUnit = {
      id: uId,
      agencyId,
      clientId: cId,
      onboardingId,
      name: unitName || `${targetName} - Sede`,
      unitType: "headquarters",
      isPhysicalStore: true,
      hasServiceArea: false,
      status: "active",
      city: unitCity || "Sorocaba",
      stateUf: unitStateUf || "SP",
      businessHours: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryStore.units.set(onboardingId, [newUnit]);

    memoryStore.clientServices.set(cId, [
      {
        id: `svc-${Date.now()}`,
        agency_id: agencyId,
        client_id: cId,
        service_key: "local_seo",
        status: "pending",
      },
    ]);

    memoryStore.dnaProfiles.set(cId, {
      client_id: cId,
      agency_id: agencyId,
      status: "draft",
      business_data: {
        company_name: targetName,
        segment: "",
        city: unitCity || "Sorocaba",
        state_uf: unitStateUf || "SP",
      },
    });

    onb.clientId = cId;
    onb.status = "awaiting_client_information";
    onb.currentStage = "awaiting_client_information";

    return Response.json({
      success: true,
      clientId: cId,
      unitId: uId,
      status: onb.status,
    });
  }

  // 7. Cadastrar ou Atualizar Unidade (Entrega 03.4)
  if (input.action === "upsert_unit") {
    const { onboardingId, unitId, name, unitType, isPhysicalStore, hasServiceArea, serviceRadiusKm, phone, email: unitEmail, addressStreet, addressNumber, addressComplement, neighborhood, city, stateUf, postalCode, latitude, longitude, businessHours, gbpPlaceId, gbpLocationId, gbpCid } = input;

    if (db) {
      const { data: onb } = await db
        .from("client_onboardings")
        .select("client_id")
        .eq("agency_id", agencyId)
        .eq("id", onboardingId)
        .maybeSingle();

      if (!onb || !onb.client_id) {
        return Response.json({ error: "Onboarding deve possuir cliente vinculado antes de cadastrar unidades." }, { status: 400 });
      }

      const targetUnitId = unitId || `unit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const { data: savedUnit, error: unitErr } = await db
        .from("client_units")
        .upsert({
          id: targetUnitId,
          agency_id: agencyId,
          client_id: onb.client_id,
          onboarding_id: onboardingId,
          name,
          unit_type: unitType,
          is_physical_store: isPhysicalStore,
          has_service_area: hasServiceArea,
          service_radius_km: serviceRadiusKm || null,
          phone: phone || null,
          email: unitEmail || null,
          address_street: addressStreet || null,
          address_number: addressNumber || null,
          address_complement: addressComplement || null,
          neighborhood: neighborhood || null,
          city,
          state_uf: stateUf,
          postal_code: postalCode || null,
          latitude: latitude || null,
          longitude: longitude || null,
          business_hours: businessHours || {},
          gbp_place_id: gbpPlaceId || null,
          gbp_location_id: gbpLocationId || null,
          gbp_cid: gbpCid || null,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (unitErr || !savedUnit) {
        return Response.json({ error: `Falha ao salvar unidade: ${unitErr?.message}` }, { status: 500 });
      }

      return Response.json({ success: true, unit: savedUnit });
    }

    // Memória local
    const onb = memoryStore.onboardings.get(onboardingId);
    if (!onb || !onb.clientId) {
      return Response.json({ error: "Onboarding deve possuir cliente vinculado antes de cadastrar unidades." }, { status: 400 });
    }

    const targetUnitId = unitId || `unit-${Date.now()}`;
    const unitList = memoryStore.units.get(onboardingId) || [];
    const newUnit: ClientUnit = {
      id: targetUnitId,
      agencyId,
      clientId: onb.clientId,
      onboardingId,
      name,
      unitType,
      isPhysicalStore,
      hasServiceArea,
      serviceRadiusKm,
      status: "active",
      phone,
      email: unitEmail,
      city,
      stateUf,
      businessHours: businessHours || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingIdx = unitList.findIndex((u) => u.id === targetUnitId);
    if (existingIdx >= 0) unitList[existingIdx] = newUnit;
    else unitList.push(newUnit);
    memoryStore.units.set(onboardingId, unitList);

    return Response.json({ success: true, unit: newUnit });
  }

  // 8. Atualizar Requisito de Coleta (Entrega 03.5)
  if (input.action === "update_requirement") {
    const { onboardingId, requirementId, status, evidenceText, evidenceUrl, notes, waivedReason } = input;

    if (status === "waived" && (!waivedReason || waivedReason.trim().length < 5)) {
      return Response.json({ error: "Para dispensar um requisito, forneça uma justificativa formal com ao menos 5 caracteres." }, { status: 400 });
    }

    if (db) {
      const updateData: Record<string, unknown> = {
        status,
        evidence_text: evidenceText || null,
        evidence_url: evidenceUrl || null,
        notes: notes || "",
        waived_reason: waivedReason || null,
        updated_at: new Date().toISOString(),
      };

      if (status === "verified") {
        updateData.verified_by_actor_id = actor.actorId;
        updateData.verified_at = new Date().toISOString();
      }

      const { data: updatedReq, error: reqErr } = await db
        .from("client_onboarding_requirements")
        .update(updateData)
        .eq("agency_id", agencyId)
        .eq("onboarding_id", onboardingId)
        .eq("id", requirementId)
        .select()
        .single();

      if (reqErr || !updatedReq) {
        return Response.json({ error: `Falha ao atualizar requisito: ${reqErr?.message}` }, { status: 500 });
      }

      return Response.json({ success: true, requirement: updatedReq });
    }

    // Memória local
    const reqList = memoryStore.requirements.get(onboardingId) || [];
    const target = reqList.find((r) => r.id === requirementId);
    if (!target) {
      return Response.json({ error: "Requisito não encontrado." }, { status: 404 });
    }

    target.status = status;
    target.evidenceText = evidenceText;
    target.evidenceUrl = evidenceUrl;
    target.notes = notes || target.notes;
    target.waivedReason = waivedReason;
    if (status === "verified") {
      target.verifiedByActorId = actor.actorId;
      target.verifiedAt = new Date().toISOString();
    }
    target.updatedAt = new Date().toISOString();

    return Response.json({ success: true, requirement: target });
  }

  // 9. Atualizar DNA (Entrega 03.7)
  if (input.action === "update_dna") {
    const { onboardingId, facts, status } = input;

    if (db) {
      const { data: onb } = await db
        .from("client_onboardings")
        .select("client_id")
        .eq("agency_id", agencyId)
        .eq("id", onboardingId)
        .maybeSingle();

      if (!onb || !onb.client_id) {
        return Response.json({ error: "Cliente não vinculado ao onboarding." }, { status: 400 });
      }

      await db
        .from("client_dna_profiles")
        .update({
          business_data: facts,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("agency_id", agencyId)
        .eq("client_id", onb.client_id);

      return Response.json({ success: true, status });
    }

    // Memória local
    const onb = memoryStore.onboardings.get(onboardingId);
    if (!onb || onb.agencyId !== agencyId) {
      return Response.json({ error: "Onboarding não encontrado na agência." }, { status: 404 });
    }
    if (!onb.clientId) {
      return Response.json({ error: "Cliente não vinculado ao onboarding." }, { status: 400 });
    }

    const existingDna = memoryStore.dnaProfiles.get(onb.clientId);
    memoryStore.dnaProfiles.set(onb.clientId, {
      client_id: onb.clientId,
      agency_id: agencyId,
      status: status || existingDna?.status || "draft",
      business_data: facts || existingDna?.business_data || {},
    });

    return Response.json({ success: true, status });
  }

  // 10. Registrar Acesso / Conexão (Entrega 03.6)
  if (input.action === "record_access_binding") {
    const { onboardingId, capability, externalResourceId, notes } = input;

    if (db) {
      // Atualizar requisito de acesso
      await db
        .from("client_onboarding_requirements")
        .update({
          status: "verified",
          evidence_text: `Capability '${capability}' conectada via Connection Hub (${externalResourceId || "recurso vinculado"}).`,
          notes: notes || "",
          verified_by_actor_id: actor.actorId,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("agency_id", agencyId)
        .eq("onboarding_id", onboardingId)
        .eq("category", "access_credentials");

      await db.from("audit_events").insert({
        agency_id: agencyId,
        action: "client_onboarding_access_bound",
        target_type: "client_onboarding",
        target_id: onboardingId,
        payload: { capability, externalResourceId, notes },
      });

      return Response.json({ success: true, capability });
    }

    return Response.json({ success: true, capability });
  }

  // 11. Salvar Baseline (Entrega 03.8)
  if (input.action === "save_baseline") {
    const {
      onboardingId,
      profileCompletenessScore,
      currentRating,
      currentReviewCount,
      unansweredReviewsCount,
      rankingVisibilityNotes,
      contentAudit,
      trackedKeywords,
      knownCompetitors,
      availableConversions,
      collectionLimitations,
      unavailableDataPoints,
    } = input;

    // REGRA: Proíbe zeros inventados e exige limitações explícitas
    const validation = validateBaselineData({
      source: "manual_audit",
      currentRating,
      currentReviewCount,
      collectionLimitations,
    });

    if (!validation.valid) {
      return Response.json({ error: validation.warnings[0] }, { status: 400 });
    }

    if (db) {
      const { data: onb } = await db
        .from("client_onboardings")
        .select("client_id")
        .eq("agency_id", agencyId)
        .eq("id", onboardingId)
        .maybeSingle();

      if (!onb || !onb.client_id) {
        return Response.json({ error: "Cliente não vinculado ao onboarding." }, { status: 400 });
      }

      const baselineId = `base-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const { data: baseline, error: baseErr } = await db
        .from("client_onboarding_baselines")
        .insert({
          id: baselineId,
          agency_id: agencyId,
          onboarding_id: onboardingId,
          client_id: onb.client_id,
          version: 1,
          source: "manual_audit",
          profile_completeness_score: profileCompletenessScore || null,
          current_rating: currentRating || null,
          current_review_count: currentReviewCount || null,
          unanswered_reviews_count: unansweredReviewsCount || null,
          ranking_visibility_notes: rankingVisibilityNotes,
          content_audit: contentAudit,
          tracked_keywords: trackedKeywords,
          known_competitors: knownCompetitors,
          available_conversions: availableConversions,
          collection_limitations: collectionLimitations,
          unavailable_data_points: unavailableDataPoints,
          established_by_actor_id: actor.actorId,
        })
        .select()
        .single();

      if (baseErr || !baseline) {
        return Response.json({ error: `Falha ao salvar baseline: ${baseErr?.message}` }, { status: 500 });
      }

      // Avançar estágio se apropriado
      await db
        .from("client_onboardings")
        .update({
          status: "planning_implementation",
          current_stage: "planning_implementation",
          updated_at: new Date().toISOString(),
        })
        .eq("agency_id", agencyId)
        .eq("id", onboardingId);

      return Response.json({ success: true, baseline });
    }

    // Memória local
    const onb = memoryStore.onboardings.get(onboardingId);
    if (!onb || !onb.clientId) {
      return Response.json({ error: "Cliente não vinculado ao onboarding." }, { status: 400 });
    }

    const baselineId = `base-${Date.now()}`;
    const newBaseline: OnboardingBaseline = {
      id: baselineId,
      agencyId,
      onboardingId,
      clientId: onb.clientId,
      version: 1,
      source: "manual_audit",
      profileCompletenessScore: profileCompletenessScore || null,
      currentRating: currentRating || null,
      currentReviewCount: currentReviewCount || null,
      unansweredReviewsCount: unansweredReviewsCount || null,
      rankingVisibilityNotes: rankingVisibilityNotes || "",
      contentAudit: contentAudit as any,
      trackedKeywords: trackedKeywords || [],
      knownCompetitors: knownCompetitors || [],
      availableConversions: availableConversions || {},
      collectionLimitations: collectionLimitations || [],
      unavailableDataPoints: unavailableDataPoints || [],
      establishedByActorId: actor.actorId,
      establishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    memoryStore.baselines.set(onboardingId, [newBaseline]);
    onb.status = "planning_implementation";
    onb.currentStage = "planning_implementation";

    return Response.json({ success: true, baseline: newBaseline });
  }

  // 12. Gerar Plano de Implantação (Entrega 03.9)
  if (input.action === "generate_plan") {
    const { onboardingId, targetStartDate } = input;

    if (db) {
      const { data: onb } = await db
        .from("client_onboardings")
        .select("*, product_definitions(*)")
        .eq("agency_id", agencyId)
        .eq("id", onboardingId)
        .maybeSingle();

      if (!onb || !onb.client_id) {
        return Response.json({ error: "Cliente não vinculado ao onboarding." }, { status: 400 });
      }

      // Buscar itens de escopo do produto aprovado
      const { data: scopeItems } = await db
        .from("product_scope_items")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("product_definition_id", onb.product_definition_id)
        .order("sort_order");

      const itemsToMap = (scopeItems || []).map((s: any) => ({
        id: s.id,
        activityName: s.activity_name,
        description: s.description || "",
        deliveryType: s.delivery_type,
        frequency: s.frequency,
        defaultRole: s.default_role,
        estimatedMinutes: s.estimated_minutes,
        isAutomatable: s.is_automatable,
        clientParticipationRequired: s.client_participation_required,
        dependencies: s.dependencies || [],
        acceptanceCriteria: s.acceptance_criteria || "",
        requiredEvidence: s.required_evidence || "",
      }));

      const planResult = generateImplementationPlanFromProduct({
        scopeItems: itemsToMap,
        targetStartDate: targetStartDate || new Date().toISOString().split("T")[0],
      });

      const planId = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const { data: plan, error: planErr } = await db
        .from("client_onboarding_plans")
        .upsert({
          id: planId,
          agency_id: agencyId,
          onboarding_id: onboardingId,
          client_id: onb.client_id,
          product_definition_id: onb.product_definition_id,
          product_version: onb.product_version,
          status: "ready",
          items: planResult.items,
          total_setup_minutes: planResult.totalSetupMinutes,
          total_recurring_monthly_minutes: planResult.totalRecurringMonthlyMinutes,
          target_start_date: targetStartDate || null,
          planned_by_actor_id: actor.actorId,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (planErr || !plan) {
        return Response.json({ error: `Falha ao gerar plano: ${planErr?.message}` }, { status: 500 });
      }

      // Avançar para ready_for_activation se apropriado
      await db
        .from("client_onboardings")
        .update({
          status: "ready_for_activation",
          current_stage: "ready_for_activation",
          updated_at: new Date().toISOString(),
        })
        .eq("agency_id", agencyId)
        .eq("id", onboardingId);

      return Response.json({ success: true, plan });
    }

    // Memória local
    const onb = memoryStore.onboardings.get(onboardingId);
    if (!onb || !onb.clientId) {
      return Response.json({ error: "Cliente não vinculado ao onboarding." }, { status: 400 });
    }

    const defaultScope = [
      {
        id: "scope-canonical-1",
        activityName: "Configuração e Auditoria 18 Itens Perfil Google",
        description: "Verificação completa da ficha do Perfil da Empresa",
        deliveryType: "setup" as const,
        frequency: "once" as const,
        defaultRole: "analyst",
        estimatedMinutes: 60,
        isAutomatable: true,
        clientParticipationRequired: false,
        dependencies: [],
        acceptanceCriteria: "Ficha auditada e atributos preenchidos",
        requiredEvidence: "Relatório de auditoria salvo",
      },
      {
        id: "scope-canonical-2",
        activityName: "Gestão Mensal de 12 Postagens e Avaliações",
        description: "Rotina recorrente de conteúdo e moderação de reputação",
        deliveryType: "recurring" as const,
        frequency: "monthly" as const,
        defaultRole: "specialist",
        estimatedMinutes: 180,
        isAutomatable: false,
        clientParticipationRequired: true,
        dependencies: ["scope-canonical-1"],
        acceptanceCriteria: "Postagens publicadas e avaliações respondidas",
        requiredEvidence: "Relatório mensal emitido",
      },
    ];

    const planResult = generateImplementationPlanFromProduct({
      scopeItems: defaultScope,
      targetStartDate: targetStartDate || "2026-10-01",
    });

    const planId = `plan-${Date.now()}`;
    const newPlan: ImplementationPlan = {
      id: planId,
      agencyId,
      onboardingId,
      clientId: onb.clientId,
      productDefinitionId: onb.productDefinitionId,
      productVersion: onb.productVersion,
      status: "ready",
      items: planResult.items,
      totalSetupMinutes: planResult.totalSetupMinutes,
      totalRecurringMonthlyMinutes: planResult.totalRecurringMonthlyMinutes,
      targetStartDate,
      plannedByActorId: actor.actorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    memoryStore.plans.set(onboardingId, newPlan);
    onb.status = "ready_for_activation";
    onb.currentStage = "ready_for_activation";

    return Response.json({ success: true, plan: newPlan });
  }

  // 13. Calcular Prontidão de Ativação
  if (input.action === "calculate_readiness") {
    const { onboardingId } = input;

    if (db) {
      const { data: onb } = await db
        .from("client_onboardings")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("id", onboardingId)
        .maybeSingle();

      if (!onb) {
        return Response.json({ error: "Onboarding não encontrado." }, { status: 404 });
      }

      const [unitsRes, reqsRes, baselinesRes, plansRes, servicesRes, dnaRes] = await Promise.all([
        db.from("client_units").select("id").eq("agency_id", agencyId).eq("onboarding_id", onboardingId),
        db.from("client_onboarding_requirements").select("*").eq("agency_id", agencyId).eq("onboarding_id", onboardingId),
        db.from("client_onboarding_baselines").select("id").eq("agency_id", agencyId).eq("onboarding_id", onboardingId).limit(1),
        db.from("client_onboarding_plans").select("id").eq("agency_id", agencyId).eq("onboarding_id", onboardingId).limit(1),
        onb.client_id
          ? db.from("client_services").select("id, status").eq("agency_id", agencyId).eq("client_id", onb.client_id).in("status", ["pending", "active"])
          : Promise.resolve({ data: [] }),
        onb.client_id
          ? db.from("client_dna_profiles").select("status, business_data").eq("agency_id", agencyId).eq("client_id", onb.client_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const reqs = reqsRes.data || [];
      const pendingAccesses = reqs.filter(
        (r: any) => r.category === "access_credentials" && r.is_required && r.status !== "verified" && r.status !== "waived"
      ).length;

      const validServices = (servicesRes.data || []).filter((s: any) => ["pending", "active"].includes(s.status));
      const dnaData = dnaRes.data;
      const isDnaConfirmed = Boolean(
        dnaData &&
        dnaData.status === "confirmed" &&
        getCriticalPendingFields(dnaData.business_data || {}).length === 0
      );

      const readiness = calculateActivationChecklist({
        isSalesVerified: ["awaiting_operations_review", "awaiting_client_information", "collecting_access", "building_dna", "establishing_baseline", "planning_implementation", "ready_for_activation", "active"].includes(onb.status) && !onb.divergence_reason,
        hasValidClient: Boolean(onb.client_id),
        unitsCount: (unitsRes.data || []).length,
        enabledServicesCount: validServices.length,
        isDnaMinimumConfirmed: isDnaConfirmed,
        pendingRequiredAccesses: pendingAccesses,
        hasBaseline: (baselinesRes.data || []).length > 0,
        hasImplementationPlan: (plansRes.data || []).length > 0,
        hasAssignedResponsible: Boolean(onb.assigned_operator_actor_id || onb.created_by_actor_id),
        hasOpenBlockers: onb.status === "blocked",
        isHumanApprovalRecorded: onb.status === "active" || Boolean(onb.activated_at),
      });

      return Response.json({ readiness });
    }

    const onb = memoryStore.onboardings.get(onboardingId);
    if (!onb || onb.agencyId !== agencyId) return Response.json({ error: "Onboarding não encontrado." }, { status: 404 });

    const services = onb.clientId ? (memoryStore.clientServices.get(onb.clientId) || []) : [];
    const validServices = services.filter((s) => s.agency_id === agencyId && ["pending", "active"].includes(s.status));
    const dnaProfile = onb.clientId ? memoryStore.dnaProfiles.get(onb.clientId) : null;
    const isDnaConfirmed = Boolean(
      dnaProfile &&
      dnaProfile.agency_id === agencyId &&
      dnaProfile.status === "confirmed" &&
      getCriticalPendingFields(dnaProfile.business_data || {}).length === 0
    );

    const reqs = memoryStore.requirements.get(onboardingId) || [];
    const pendingAccesses = reqs.filter(
      (r) => r.category === "access_credentials" && r.isRequired && r.status !== "verified" && r.status !== "waived"
    ).length;

    const readiness = calculateActivationChecklist({
      isSalesVerified: ["awaiting_operations_review", "awaiting_client_information", "collecting_access", "building_dna", "establishing_baseline", "planning_implementation", "ready_for_activation", "active"].includes(onb.status) && !onb.divergenceReason,
      hasValidClient: Boolean(onb.clientId),
      unitsCount: (memoryStore.units.get(onboardingId) || []).length,
      enabledServicesCount: validServices.length,
      isDnaMinimumConfirmed: isDnaConfirmed,
      pendingRequiredAccesses: pendingAccesses,
      hasBaseline: (memoryStore.baselines.get(onboardingId) || []).length > 0,
      hasImplementationPlan: Boolean(memoryStore.plans.get(onboardingId)),
      hasAssignedResponsible: Boolean(onb.assignedOperatorActorId || onb.createdByActorId),
      hasOpenBlockers: onb.status === "blocked",
      isHumanApprovalRecorded: onb.status === "active",
    });

    return Response.json({ readiness });
  }

  // 14. Submeter para Ativação (Approval Gate)
  if (input.action === "submit_activation") {
    if (!canWriteOnboarding(actor.role)) {
      return Response.json({ error: "Permissão insuficiente para submeter ativação." }, { status: 403 });
    }

    const { onboardingId, notes } = input;

    if (db) {
      const { data: onb, error: onbLookupErr } = await db
        .from("client_onboardings")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("id", onboardingId)
        .maybeSingle();

      if (onbLookupErr || !onb) {
        return Response.json({ error: "Onboarding não encontrado ou não pertencente à agência." }, { status: 404 });
      }

      if (!onb.client_id) {
        return Response.json({ error: "Onboarding deve possuir cliente válido antes de submeter ativação." }, { status: 400 });
      }

      // Criar item na Central de Aprovações
      const { data: approvalItem, error: appErr } = await db
        .from("approval_items")
        .insert({
          agency_id: agencyId,
          client_id: onb.client_id,
          source_type: "client_onboarding_activation",
          source_id: onboardingId,
          requested_by_email: email,
          status: "pending",
          snapshot: {
            onboardingId,
            clientId: onb.client_id,
            productDefinitionId: onb.product_definition_id,
            notes,
          },
        })
        .select()
        .single();

      if (appErr || !approvalItem) {
        return Response.json({ error: `Falha ao registrar aprovação: ${appErr?.message}` }, { status: 500 });
      }

      const { data: updatedOnb, error: updateErr } = await db
        .from("client_onboardings")
        .update({
          activation_approval_id: approvalItem.id,
          status: "ready_for_activation",
          current_stage: "ready_for_activation",
          updated_at: new Date().toISOString(),
        })
        .eq("agency_id", agencyId)
        .eq("id", onboardingId)
        .select();

      if (updateErr || !updatedOnb || updatedOnb.length === 0) {
        return Response.json({ error: "Falha ao atualizar status de ativação do onboarding." }, { status: 404 });
      }

      const { error: auditErr } = await db.from("audit_events").insert({
        agency_id: agencyId,
        client_id: onb.client_id,
        action: "client_onboarding_activation_submitted",
        target_type: "approval_item",
        target_id: approvalItem.id,
        payload: { onboardingId, notes },
      });

      if (auditErr) {
        return Response.json({ error: "Falha ao registrar auditoria da submissão de ativação." }, { status: 500 });
      }

      return Response.json({ success: true, approvalId: approvalItem.id });
    }

    // Memória local
    const onb = memoryStore.onboardings.get(onboardingId);
    if (!onb || onb.agencyId !== agencyId) {
      return Response.json({ error: "Onboarding não encontrado ou não pertencente à agência." }, { status: 404 });
    }
    if (!onb.clientId) {
      return Response.json({ error: "Onboarding deve possuir cliente válido antes de submeter ativação." }, { status: 400 });
    }

    const appLocalId = `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    memoryStore.approvalItems.set(appLocalId, {
      id: appLocalId,
      agency_id: agencyId,
      client_id: onb.clientId,
      source_type: "client_onboarding_activation",
      source_id: onboardingId,
      status: "pending",
    });

    onb.activationApprovalId = appLocalId;
    onb.status = "ready_for_activation";
    onb.currentStage = "ready_for_activation";

    return Response.json({ success: true, approvalId: appLocalId });
  }

  // 15. Aprovar Ativação Operacional (Hardening de Segurança e Ativação Atômica)
  if (input.action === "approve_activation") {
    // 1. Autorização por Função (RBAC) & Segregação de Funções (SoD)
    const permCheck = validateActivationApprovalPermission({
      actorRole: actor.role,
      actorId: actor.actorId,
    });
    if (!permCheck.allowed) {
      return Response.json(
        { error: permCheck.reason || "Permissão insuficiente para aprovar ativação de clientes." },
        { status: 403 }
      );
    }

    const { onboardingId, notes } = input;

    if (db) {
      // 2. Busca o onboarding da agência autenticada
      const { data: onb, error: onbErr } = await db
        .from("client_onboardings")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("id", onboardingId)
        .maybeSingle();

      if (onbErr || !onb) {
        return Response.json({ error: "Onboarding não encontrado ou não pertencente à agência autenticada." }, { status: 404 });
      }

      if (onb.status === "active") {
        return Response.json({ error: "Onboarding já se encontra ativado." }, { status: 409 });
      }

      if (onb.status === "blocked" || onb.status === "cancelled") {
        return Response.json({ error: "Onboarding bloqueado ou cancelado não pode ser ativado." }, { status: 409 });
      }

      if (!onb.client_id) {
        return Response.json({ error: "Onboarding deve possuir cliente válido para ativação." }, { status: 400 });
      }

      // 3. Validação estrita do item de aprovação pendente (Requirement 5)
      let approvalQuery = db
        .from("approval_items")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("source_type", "client_onboarding_activation")
        .eq("source_id", onboardingId)
        .eq("status", "pending");

      if (onb.activation_approval_id) {
        approvalQuery = approvalQuery.eq("id", onb.activation_approval_id);
      }

      const { data: pendingApproval, error: appErr } = await approvalQuery.maybeSingle();
      if (appErr || !pendingApproval) {
        return Response.json(
          { error: "Item de aprovação formal de ativação pendente não encontrado para este onboarding." },
          { status: 409 }
        );
      }

      // 4. Recálculo dos 11 critérios de prontidão a partir do estado fresco do banco (Requirement 3)
      const [unitsRes, reqsRes, baselinesRes, plansRes, servicesRes, dnaRes] = await Promise.all([
        db.from("client_units").select("id").eq("agency_id", agencyId).eq("onboarding_id", onboardingId),
        db.from("client_onboarding_requirements").select("*").eq("agency_id", agencyId).eq("onboarding_id", onboardingId),
        db.from("client_onboarding_baselines").select("id").eq("agency_id", agencyId).eq("onboarding_id", onboardingId).limit(1),
        db.from("client_onboarding_plans").select("id").eq("agency_id", agencyId).eq("onboarding_id", onboardingId).limit(1),
        db.from("client_services").select("id, status").eq("agency_id", agencyId).eq("client_id", onb.client_id).in("status", ["pending", "active"]),
        db.from("client_dna_profiles").select("status, business_data").eq("agency_id", agencyId).eq("client_id", onb.client_id).maybeSingle(),
      ]);

      const unitsList = unitsRes.data || [];
      const reqsList = reqsRes.data || [];
      const baselinesList = baselinesRes.data || [];
      const plansList = plansRes.data || [];

      const pendingAccesses = reqsList.filter(
        (r: any) => r.category === "access_credentials" && r.is_required && r.status !== "verified" && r.status !== "waived"
      ).length;

      const pendingRequiredReqs = reqsList.filter(
        (r: any) => r.is_required && r.status !== "verified" && r.status !== "waived"
      );

      const validServices = (servicesRes.data || []).filter((s: any) => ["pending", "active"].includes(s.status));
      const dnaData = dnaRes.data;
      const isDnaConfirmed = Boolean(
        dnaData &&
        dnaData.status === "confirmed" &&
        getCriticalPendingFields(dnaData.business_data || {}).length === 0
      );

      const readiness = calculateActivationChecklist({
        isSalesVerified: ["awaiting_operations_review", "awaiting_client_information", "collecting_access", "building_dna", "establishing_baseline", "planning_implementation", "ready_for_activation"].includes(onb.status) && !onb.divergence_reason,
        hasValidClient: Boolean(onb.client_id),
        unitsCount: unitsList.length,
        enabledServicesCount: validServices.length,
        isDnaMinimumConfirmed: isDnaConfirmed,
        pendingRequiredAccesses: pendingAccesses,
        hasBaseline: baselinesList.length > 0,
        hasImplementationPlan: plansList.length > 0,
        hasAssignedResponsible: Boolean(onb.assigned_operator_actor_id || onb.created_by_actor_id),
        hasOpenBlockers: onb.status === "blocked" || onb.status === "cancelled" || Boolean(onb.blocking_reason),
        isHumanApprovalRecorded: false,
      });

      const missingCriteria = readiness.items
        .filter((i) => i.key !== "human_approval_recorded" && !i.fulfilled)
        .map((i) => i.label);

      if (pendingRequiredReqs.length > 0) {
        for (const r of pendingRequiredReqs) {
          const msg = `Requisito obrigatório pendente: ${r.title}`;
          if (!missingCriteria.includes(msg)) missingCriteria.push(msg);
        }
      }

      // Se qualquer critério falhar: não altera nenhum registro e retorna 409
      if (missingCriteria.length > 0) {
        return Response.json(
          {
            error: "Critérios de ativação pendentes. Impossível ativar o cliente.",
            missingCriteria,
            score: readiness.score,
          },
          { status: 409 }
        );
      }

      // 5. Ativação Realmente Atômica via RPC transacional do PostgreSQL (Requirement 4)
      const { data: rpcResult, error: rpcErr } = await db.rpc(
        "onboarding_activate_client",
        {
          p_agency_id: agencyId,
          p_onboarding_id: onboardingId,
          p_actor_id: actor.actorId,
          p_approval_id: pendingApproval.id,
          p_notes: notes || null,
        }
      );

      if (rpcErr) {
        if (rpcErr.code === "23505" || rpcErr.message?.includes("already_active")) {
          return Response.json({ error: "Onboarding já se encontra ativado." }, { status: 409 });
        }
        if (rpcErr.code === "P0002" || rpcErr.message?.includes("not_found")) {
          return Response.json({ error: "Registro não encontrado ou item de aprovação não está pendente." }, { status: 409 });
        }
        return Response.json({ error: `Falha na ativação atômica: ${rpcErr.message}` }, { status: 500 });
      }

      return Response.json({
        success: true,
        status: "active",
        activatedAt: rpcResult?.activated_at || new Date().toISOString(),
        onboardingId,
        clientId: onb.client_id,
        approvalId: pendingApproval.id,
      });
    }

    // Memória local para testes e desenvolvimento offline
    const onb = memoryStore.onboardings.get(onboardingId);
    if (!onb || onb.agencyId !== agencyId) {
      return Response.json({ error: "Onboarding não encontrado ou não pertencente à agência." }, { status: 404 });
    }
    if (onb.status === "active") {
      return Response.json({ error: "Onboarding já se encontra ativado." }, { status: 409 });
    }
    if (onb.status === "blocked" || onb.status === "cancelled") {
      return Response.json({ error: "Onboarding bloqueado ou cancelado não pode ser ativado." }, { status: 409 });
    }
    if (!onb.clientId) {
      return Response.json({ error: "Onboarding deve possuir cliente válido para ativação." }, { status: 400 });
    }

    const unitsList = memoryStore.units.get(onboardingId) || [];
    const reqsList = memoryStore.requirements.get(onboardingId) || [];
    const baselinesList = memoryStore.baselines.get(onboardingId) || [];
    const hasPlan = Boolean(memoryStore.plans.get(onboardingId));

    // Busca o item de aprovação
    const pendingApproval = onb.activationApprovalId
      ? memoryStore.approvalItems.get(onb.activationApprovalId)
      : Array.from(memoryStore.approvalItems.values()).find(
          (a) =>
            a.agency_id === agencyId &&
            a.source_type === "client_onboarding_activation" &&
            a.source_id === onboardingId &&
            a.status === "pending"
        );

    if (!pendingApproval || pendingApproval.status !== "pending") {
      return Response.json(
        { error: "Item de aprovação formal de ativação pendente não encontrado para este onboarding." },
        { status: 409 }
      );
    }

    const pendingAccesses = reqsList.filter(
      (r) => r.category === "access_credentials" && r.isRequired && r.status !== "verified" && r.status !== "waived"
    ).length;
    const pendingRequiredReqs = reqsList.filter(
      (r) => r.isRequired && r.status !== "verified" && r.status !== "waived"
    );

    const validServices = (memoryStore.clientServices.get(onb.clientId) || []).filter(
      (s) => s.agency_id === agencyId && ["pending", "active"].includes(s.status)
    );
    const dnaProfile = memoryStore.dnaProfiles.get(onb.clientId);
    const isDnaConfirmed = Boolean(
      dnaProfile &&
      dnaProfile.agency_id === agencyId &&
      dnaProfile.status === "confirmed" &&
      getCriticalPendingFields(dnaProfile.business_data || {}).length === 0
    );

    const readiness = calculateActivationChecklist({
      isSalesVerified: ["awaiting_operations_review", "awaiting_client_information", "collecting_access", "building_dna", "establishing_baseline", "planning_implementation", "ready_for_activation"].includes(onb.status) && !onb.divergenceReason,
      hasValidClient: Boolean(onb.clientId),
      unitsCount: unitsList.length,
      enabledServicesCount: validServices.length,
      isDnaMinimumConfirmed: isDnaConfirmed,
      pendingRequiredAccesses: pendingAccesses,
      hasBaseline: baselinesList.length > 0,
      hasImplementationPlan: hasPlan,
      hasAssignedResponsible: Boolean(onb.assignedOperatorActorId || onb.createdByActorId),
      hasOpenBlockers: Boolean(onb.blockingReason),
      isHumanApprovalRecorded: false,
    });

    const missingCriteria = readiness.items
      .filter((i) => i.key !== "human_approval_recorded" && !i.fulfilled)
      .map((i) => i.label);

    if (pendingRequiredReqs.length > 0) {
      for (const r of pendingRequiredReqs) {
        const msg = `Requisito obrigatório pendente: ${r.title}`;
        if (!missingCriteria.includes(msg)) missingCriteria.push(msg);
      }
    }

    if (missingCriteria.length > 0) {
      return Response.json(
        {
          error: "Critérios de ativação pendentes. Impossível ativar o cliente.",
          missingCriteria,
          score: readiness.score,
        },
        { status: 409 }
      );
    }

    // Ativação atômica em memória
    const activatedAt = new Date().toISOString();
    onb.status = "active";
    onb.currentStage = "active";
    onb.activatedAt = activatedAt;
    onb.activatedByActorId = actor.actorId;
    onb.activationApprovalId = pendingApproval.id;
    pendingApproval.status = "approved";

    const client = memoryStore.clients.get(onb.clientId);
    if (client) client.status = "active";

    const servs = memoryStore.clientServices.get(onb.clientId);
    if (servs) {
      for (const s of servs) s.status = "active";
    }

    return Response.json({
      success: true,
      status: "active",
      activatedAt,
      onboardingId,
      clientId: onb.clientId,
      approvalId: pendingApproval.id,
    });
  }

  // 16. Bloquear, Cancelar ou Desbloquear Onboarding (RBAC e Validação de Afetação)
  if (input.action === "block_or_cancel") {
    const { onboardingId, operation, reason } = input;

    if (operation === "cancel" && !canCancelOnboarding(actor.role)) {
      return Response.json(
        { error: "Apenas owner, admin ou operations_lead podem cancelar o onboarding." },
        { status: 403 }
      );
    }
    if (operation === "unblock" && !canUnblockOnboarding(actor.role)) {
      return Response.json(
        { error: "Apenas owner, admin ou operations_lead podem desbloquear o onboarding." },
        { status: 403 }
      );
    }
    if (operation === "block" && !canWriteOnboarding(actor.role)) {
      return Response.json(
        { error: "Permissão insuficiente para bloquear o onboarding." },
        { status: 403 }
      );
    }

    const targetStatus: OnboardingStage =
      operation === "block"
        ? "blocked"
        : operation === "cancel"
        ? "cancelled"
        : "awaiting_operations_review";

    if (db) {
      const { data: updatedRows, error: upErr } = await db
        .from("client_onboardings")
        .update({
          status: targetStatus,
          current_stage: targetStatus,
          blocking_reason: operation === "unblock" ? null : reason,
          updated_at: new Date().toISOString(),
        })
        .eq("agency_id", agencyId)
        .eq("id", onboardingId)
        .select();

      if (upErr) {
        return Response.json({ error: "Erro ao atualizar status do onboarding." }, { status: 500 });
      }
      if (!updatedRows || updatedRows.length === 0) {
        return Response.json(
          { error: "Onboarding não encontrado ou não pertencente à agência." },
          { status: 404 }
        );
      }

      const { error: decErr } = await db.from("client_onboarding_decisions").insert({
        id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        agency_id: agencyId,
        onboarding_id: onboardingId,
        decision_type:
          operation === "block"
            ? "onboarding_blocked"
            : operation === "cancel"
            ? "onboarding_cancelled"
            : "onboarding_unblocked",
        actor_id: actor.actorId,
        actor_name: email,
        actor_role: actor.role,
        reason,
      });

      if (decErr) {
        return Response.json({ error: "Falha ao registrar decisão." }, { status: 500 });
      }

      return Response.json({ success: true, status: targetStatus });
    }

    const onb = memoryStore.onboardings.get(onboardingId);
    if (!onb || onb.agencyId !== agencyId) {
      return Response.json(
        { error: "Onboarding não encontrado ou não pertencente à agência." },
        { status: 404 }
      );
    }

    onb.status = targetStatus;
    onb.currentStage = targetStatus;
    onb.blockingReason = operation === "unblock" ? undefined : reason;

    return Response.json({ success: true, status: targetStatus });
  }

  return Response.json({ error: "Ação não suportada." }, { status: 400 });
}
