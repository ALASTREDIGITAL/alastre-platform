import { ConnectionHubRepository } from "../../../lib/connection-hub/repository.ts";
import { createSupabaseAdmin } from "../../../lib/connection-hub/supabase-admin.ts";
import { extractAuthenticatedEmail } from "../../../lib/server-auth.ts";
import {
  commercialCrmRequestSchema,
  type OpportunityWorkspaceData,
  type ProspectCompany,
  type ProspectContact,
  type CommercialOpportunity,
} from "../../../lib/commercial-crm-api.ts";
import {
  canTransitionOpportunity,
  calculatePrioritization,
  evaluateQualification,
  validateDiagnosisCompleteness,
  validateProposalDiscount,
  isProposalEditable,
  validateLossReason,
  validateHandoffChecklist,
  calculateCommercialMetrics,
  generateForecast,
  validateOpportunityIntegrity,
  type CommercialProposal,
  type FollowUpActivity,
  type SalesHandoff,
  type CommercialDiagnosis,
  type QualificationAssessment,
  type PrioritizationAssessment,
} from "../../../lib/commercial-crm-domain.ts";
import { buildIdentityKey } from "../../../lib/prospecting/prospecting-identity.ts";

export const dynamic = "force-dynamic";

const roleCanWrite = (role: string) =>
  ["owner", "admin", "operator"].includes(role);

// Memória local em camadas para testes automatizados e fallback de desenvolvimento
interface InMemoryCommercialDb {
  companies: Map<string, ProspectCompany>;
  contacts: Map<string, ProspectContact[]>;
  opportunities: Map<string, CommercialOpportunity>;
  prioritizations: Map<string, PrioritizationAssessment>;
  qualifications: Map<string, QualificationAssessment>;
  diagnoses: Map<string, CommercialDiagnosis>;
  proposals: Map<string, CommercialProposal[]>;
  activities: Map<string, FollowUpActivity[]>;
  handoffs: Map<string, SalesHandoff>;
}

const memoryStore: InMemoryCommercialDb = {
  companies: new Map(),
  contacts: new Map(),
  opportunities: new Map(),
  prioritizations: new Map(),
  qualifications: new Map(),
  diagnoses: new Map(),
  proposals: new Map(),
  activities: new Map(),
  handoffs: new Map(),
};

export async function POST(request: Request) {
  const email = await extractAuthenticatedEmail(request);
  if (!email) {
    return Response.json({ error: "Acesso não identificado." }, { status: 401 });
  }

  const jsonBody = await request.json().catch(() => null);
  const parsed = commercialCrmRequestSchema.safeParse(jsonBody);
  if (!parsed.success) {
    return Response.json(
      { error: "Payload inválido.", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const db = createSupabaseAdmin();

  // Contexto de ator e tenant (agência)
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
      // Fallback seguro de desenvolvimento
    }
  }

  const agencyId = actor.agencyId;

  // 1. Listar Empresas
  if (input.action === "list_companies") {
    if (db) {
      let query = db
        .from("commercial_companies")
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false });

      if (input.segment) query = query.ilike("segment", `%${input.segment}%`);
      if (input.city) query = query.ilike("city", `%${input.city}%`);
      if (input.search) query = query.ilike("name", `%${input.search}%`);

      const { data, error } = await query;
      if (error) {
        return Response.json({ error: "Erro ao consultar empresas da agência." }, { status: 500 });
      }
      return Response.json({ companies: data });
    }

    // Memória local
    let list = Array.from(memoryStore.companies.values()).filter(
      (c) => c.agency_id === agencyId
    );
    if (input.segment) list = list.filter((c) => c.segment?.toLowerCase().includes(input.segment!.toLowerCase()));
    if (input.city) list = list.filter((c) => c.city?.toLowerCase().includes(input.city!.toLowerCase()));
    if (input.search) list = list.filter((c) => c.name.toLowerCase().includes(input.search!.toLowerCase()));
    return Response.json({ companies: list });
  }

  // 2. Obter Empresa
  if (input.action === "get_company") {
    if (db) {
      const { data, error } = await db
        .from("commercial_companies")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("id", input.company_id)
        .maybeSingle();

      if (error || !data) {
        return Response.json({ error: "Empresa não encontrada ou não pertencente à agência." }, { status: 404 });
      }
      return Response.json({ company: data });
    }

    const company = memoryStore.companies.get(input.company_id);
    if (!company || company.agency_id !== agencyId) {
      return Response.json({ error: "Empresa não encontrada ou não pertencente à agência." }, { status: 404 });
    }
    return Response.json({ company });
  }

  // 3. Criar ou Atualizar Empresa (com deduplicação por identity_key)
  if (input.action === "create_or_update_company") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    const raw = input.company;
    const identityKey =
      raw.identity_key ||
      buildIdentityKey({
        cid: raw.cid,
        place_id: raw.place_id,
        maps_url: raw.maps_url,
        phone: raw.phone,
        name: raw.name,
      }) ||
      `company:${Date.now()}`;

    const companyId = raw.id || `comp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const companyRecord: ProspectCompany = {
      id: companyId,
      agency_id: agencyId,
      name: raw.name.trim(),
      trade_name: raw.trade_name || null,
      segment: raw.segment || null,
      city: raw.city || null,
      state_uf: raw.state_uf || null,
      website: raw.website || null,
      phone: raw.phone || null,
      identity_key: identityKey,
      maps_url: raw.maps_url || null,
      place_id: raw.place_id || null,
      cid: raw.cid || null,
      rating: raw.rating ?? null,
      review_count: raw.review_count ?? null,
      observed_profile_quality: raw.observed_profile_quality || "incomplete",
      units_count: raw.units_count || 1,
      notes: raw.notes || "",
      created_at: now,
      updated_at: now,
    };

    if (db) {
      // Upsert respeitando unique(agency_id, identity_key)
      const { data, error } = await db
        .from("commercial_companies")
        .upsert(companyRecord, { onConflict: "agency_id, identity_key" })
        .select()
        .single();

      if (error) {
        return Response.json({ error: "Erro ao salvar empresa no banco.", details: error.message }, { status: 500 });
      }

      return Response.json({ company: data });
    }

    // Memória local com deduplicação por identity_key
    const existing = Array.from(memoryStore.companies.values()).find(
      (c) => c.agency_id === agencyId && c.identity_key === identityKey
    );
    if (existing) {
      const updated = { ...existing, ...companyRecord, id: existing.id, updated_at: now };
      memoryStore.companies.set(existing.id, updated);
      return Response.json({ company: updated });
    }

    memoryStore.companies.set(companyId, companyRecord);
    return Response.json({ company: companyRecord });
  }

  // 4. Listar Oportunidades
  if (input.action === "list_opportunities") {
    if (db) {
      let query = db
        .from("commercial_opportunities")
        .select("*")
        .eq("agency_id", agencyId)
        .order("last_activity_at", { ascending: false });

      if (input.stage) query = query.eq("stage", input.stage);
      if (input.priority) query = query.eq("priority", input.priority);
      if (input.responsible_actor_id) query = query.eq("responsible_actor_id", input.responsible_actor_id);
      if (input.search) query = query.ilike("title", `%${input.search}%`);

      const { data, error } = await query;
      if (error) {
        return Response.json({ error: "Erro ao consultar oportunidades." }, { status: 500 });
      }
      return Response.json({ opportunities: data });
    }

    let list = Array.from(memoryStore.opportunities.values()).filter(
      (o) => o.agency_id === agencyId
    );
    if (input.stage) list = list.filter((o) => o.stage === input.stage);
    if (input.priority) list = list.filter((o) => o.priority === input.priority);
    if (input.responsible_actor_id) list = list.filter((o) => o.responsible_actor_id === input.responsible_actor_id);
    if (input.search) list = list.filter((o) => o.title.toLowerCase().includes(input.search!.toLowerCase()));
    return Response.json({ opportunities: list });
  }

  // 5. Obter Workspace da Oportunidade
  if (input.action === "get_opportunity_workspace") {
    if (db) {
      const { data: opp, error: oppErr } = await db
        .from("commercial_opportunities")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("id", input.opportunity_id)
        .maybeSingle();

      if (oppErr || !opp) {
        return Response.json({ error: "Oportunidade não encontrada ou não pertencente à agência." }, { status: 404 });
      }

      const [compRes, contRes, priRes, qualRes, diagRes, propRes, actRes, handRes] = await Promise.all([
        db.from("commercial_companies").select("*").eq("agency_id", agencyId).eq("id", opp.company_id).maybeSingle(),
        db.from("commercial_contacts").select("*").eq("agency_id", agencyId).eq("company_id", opp.company_id),
        db.from("commercial_assessments").select("*").eq("agency_id", agencyId).eq("opportunity_id", opp.id).eq("type", "prioritization").maybeSingle(),
        db.from("commercial_assessments").select("*").eq("agency_id", agencyId).eq("opportunity_id", opp.id).eq("type", "qualification").maybeSingle(),
        db.from("commercial_diagnoses").select("*").eq("agency_id", agencyId).eq("opportunity_id", opp.id).maybeSingle(),
        db.from("commercial_proposals").select("*").eq("agency_id", agencyId).eq("opportunity_id", opp.id).order("version", { ascending: false }),
        db.from("commercial_activities").select("*").eq("agency_id", agencyId).eq("opportunity_id", opp.id).order("deadline", { ascending: true }),
        db.from("commercial_sales_handoffs").select("*").eq("agency_id", agencyId).eq("opportunity_id", opp.id).maybeSingle(),
      ]);

      const workspace: OpportunityWorkspaceData = {
        opportunity: opp,
        company: compRes.data || { id: opp.company_id, agency_id: agencyId, name: "Empresa", identity_key: "na", observed_profile_quality: "incomplete", units_count: 1, notes: "", created_at: "", updated_at: "" },
        contacts: contRes.data || [],
        prioritization: priRes.data || null,
        qualification: qualRes.data || null,
        diagnosis: diagRes.data || null,
        proposals: propRes.data || [],
        activities: actRes.data || [],
        handoff: handRes.data || null,
      };

      return Response.json({ workspace });
    }

    const opp = memoryStore.opportunities.get(input.opportunity_id);
    if (!opp || opp.agency_id !== agencyId) {
      return Response.json({ error: "Oportunidade não encontrada ou não pertencente à agência." }, { status: 404 });
    }

    const comp = memoryStore.companies.get(opp.company_id) || {
      id: opp.company_id,
      agency_id: agencyId,
      name: "Empresa Local",
      identity_key: "local",
      observed_profile_quality: "incomplete",
      units_count: 1,
      notes: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const workspace: OpportunityWorkspaceData = {
      opportunity: opp,
      company: comp,
      contacts: memoryStore.contacts.get(opp.company_id) || [],
      prioritization: memoryStore.prioritizations.get(opp.id) || null,
      qualification: memoryStore.qualifications.get(opp.id) || null,
      diagnosis: memoryStore.diagnoses.get(opp.id) || null,
      proposals: memoryStore.proposals.get(opp.id) || [],
      activities: memoryStore.activities.get(opp.id) || [],
      handoff: memoryStore.handoffs.get(opp.id) || null,
    };

    return Response.json({ workspace });
  }

  // 6. Criar Oportunidade
  if (input.action === "create_opportunity") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    // Validação de integridade
    const val = validateOpportunityIntegrity({
      title: input.title,
      responsible_actor_id: input.responsible_actor_id,
      next_action: input.next_action,
      next_action_deadline: input.next_action_deadline,
      stage: "new",
    });
    if (!val.valid) {
      return Response.json({ error: "Dados incompletos para oportunidade.", details: val.errors }, { status: 400 });
    }

    const oppId = `opp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const oppRecord: CommercialOpportunity = {
      id: oppId,
      agency_id: agencyId,
      company_id: input.company_id,
      title: input.title.trim(),
      stage: "new",
      priority: input.priority,
      origin: input.origin,
      product_definition_id: input.product_definition_id || null,
      product_version: input.product_version || 1,
      responsible_actor_id: input.responsible_actor_id,
      responsible_name: input.responsible_name,
      last_activity_at: now,
      next_action: input.next_action.trim(),
      next_action_deadline: input.next_action_deadline,
      estimated_setup_value: null,
      estimated_mrr_value: null,
      blocking_reason: null,
      closed_at: null,
      loss_reason_code: null,
      loss_reason_details: null,
      created_at: now,
      updated_at: now,
    };

    if (db) {
      const { data, error } = await db
        .from("commercial_opportunities")
        .insert(oppRecord)
        .select()
        .single();

      if (error) {
        return Response.json({ error: "Erro ao cadastrar oportunidade.", details: error.message }, { status: 500 });
      }

      try {
        await db.from("audit_events").insert({
          agency_id: agencyId,
          action: "commercial_opportunity_created",
          target_type: "commercial_opportunity",
          target_id: oppId,
          actor_user_id: actor.actorId,
          payload: { title: oppRecord.title, origin: oppRecord.origin, company_id: oppRecord.company_id },
          correlation_id: `corr_${Date.now()}`,
        });
      } catch {}

      return Response.json({ opportunity: data });
    }

    memoryStore.opportunities.set(oppId, oppRecord);
    return Response.json({ opportunity: oppRecord });
  }

  // 7. Atualizar Estágio da Oportunidade
  if (input.action === "update_opportunity_stage") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    // Busca oportunidade existente
    let existingOpp: CommercialOpportunity | null = null;
    if (db) {
      const { data } = await db
        .from("commercial_opportunities")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("id", input.opportunity_id)
        .maybeSingle();
      existingOpp = data;
    } else {
      existingOpp = memoryStore.opportunities.get(input.opportunity_id) || null;
    }

    if (!existingOpp || existingOpp.agency_id !== agencyId) {
      return Response.json({ error: "Oportunidade não encontrada ou não pertencente à agência." }, { status: 404 });
    }

    // Validação de transição de estágio
    if (!canTransitionOpportunity(existingOpp.stage, input.target_stage)) {
      return Response.json(
        {
          error: `Transição inválida: não é permitido mudar de '${existingOpp.stage}' para '${input.target_stage}'.`,
        },
        { status: 400 }
      );
    }

    // Se estágio for closed_lost, valida motivo de perda
    if (input.target_stage === "closed_lost") {
      if (!input.loss_reason_code) {
        return Response.json({ error: "Motivo de perda é obrigatório ao encerrar como perdido." }, { status: 400 });
      }
      const lossVal = validateLossReason(input.loss_reason_code, input.loss_reason_details);
      if (!lossVal.valid) {
        return Response.json({ error: lossVal.error }, { status: 400 });
      }
    }

    // Validação de integridade de próxima ação e prazo
    const integrity = validateOpportunityIntegrity({
      title: existingOpp.title,
      responsible_actor_id: input.responsible_actor_id || existingOpp.responsible_actor_id,
      next_action: input.next_action,
      next_action_deadline: input.next_action_deadline,
      stage: input.target_stage,
      estimated_setup_value: existingOpp.estimated_setup_value,
      estimated_mrr_value: existingOpp.estimated_mrr_value,
    });
    if (!integrity.valid) {
      return Response.json({ error: "Salvaguardas de oportunidade violadas.", details: integrity.errors }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updatedOpp: CommercialOpportunity = {
      ...existingOpp,
      stage: input.target_stage,
      next_action: input.next_action.trim(),
      next_action_deadline: input.next_action_deadline,
      responsible_actor_id: input.responsible_actor_id || existingOpp.responsible_actor_id,
      loss_reason_code: input.target_stage === "closed_lost" ? input.loss_reason_code || null : null,
      loss_reason_details: input.target_stage === "closed_lost" ? input.loss_reason_details || null : null,
      blocking_reason: input.blocking_reason || null,
      closed_at: input.target_stage === "closed_won" || input.target_stage === "closed_lost" ? now : null,
      last_activity_at: now,
      updated_at: now,
    };

    if (db) {
      const { data, error } = await db
        .from("commercial_opportunities")
        .update(updatedOpp)
        .eq("agency_id", agencyId)
        .eq("id", input.opportunity_id)
        .select()
        .single();

      if (error) {
        return Response.json({ error: "Erro ao atualizar estágio da oportunidade." }, { status: 500 });
      }

      try {
        await db.from("audit_events").insert({
          agency_id: agencyId,
          action: "commercial_opportunity_stage_changed",
          target_type: "commercial_opportunity",
          target_id: input.opportunity_id,
          actor_user_id: actor.actorId,
          payload: { previous_stage: existingOpp.stage, new_stage: input.target_stage },
          correlation_id: `corr_${Date.now()}`,
        });
      } catch {}

      return Response.json({ opportunity: data });
    }

    memoryStore.opportunities.set(input.opportunity_id, updatedOpp);
    return Response.json({ opportunity: updatedOpp });
  }

  // 8. Salvar Priorização
  if (input.action === "save_prioritization") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    const calculated = calculatePrioritization(input.input);
    const assessmentId = `pri_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const record: PrioritizationAssessment = {
      id: assessmentId,
      agency_id: agencyId,
      opportunity_id: input.opportunity_id,
      fit: calculated.fit,
      intent: calculated.intent,
      opportunity: calculated.opportunity,
      priority: calculated.priority,
      explanation: calculated.explanation,
      assessed_by_actor_id: actor.actorId,
      assessed_at: now,
    };

    if (db) {
      await db.from("commercial_assessments").upsert({
        id: assessmentId,
        agency_id: agencyId,
        opportunity_id: input.opportunity_id,
        type: "prioritization",
        fit_score: calculated.fit.score,
        intent_score: calculated.intent.score,
        opportunity_score: calculated.opportunity.score,
        priority_result: calculated.priority,
        explanation: calculated.explanation,
        dimensions: { fit: calculated.fit, intent: calculated.intent, opportunity: calculated.opportunity },
        assessed_by_actor_id: actor.actorId,
        assessed_at: now,
      });

      // Atualiza a prioridade na oportunidade
      await db
        .from("commercial_opportunities")
        .update({ priority: calculated.priority, last_activity_at: now, updated_at: now })
        .eq("agency_id", agencyId)
        .eq("id", input.opportunity_id);

      return Response.json({ prioritization: record });
    }

    memoryStore.prioritizations.set(input.opportunity_id, record);
    const opp = memoryStore.opportunities.get(input.opportunity_id);
    if (opp) {
      opp.priority = calculated.priority;
      opp.last_activity_at = now;
    }
    return Response.json({ prioritization: record });
  }

  // 9. Salvar Qualificação
  if (input.action === "save_qualification") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    const evaluated = evaluateQualification(
      input.dimensions,
      input.evidences,
      input.hypotheses,
      input.gaps,
      actor.actorId
    );

    const assessmentId = `qual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const record: QualificationAssessment = {
      id: assessmentId,
      agency_id: agencyId,
      opportunity_id: input.opportunity_id,
      dimensions: input.dimensions,
      result: evaluated.result,
      evidences: input.evidences,
      hypotheses: input.hypotheses,
      gaps: input.gaps,
      responsible_actor_id: actor.actorId,
      evaluated_at: now,
      explanation: evaluated.explanation,
    };

    if (db) {
      await db.from("commercial_assessments").upsert({
        id: assessmentId,
        agency_id: agencyId,
        opportunity_id: input.opportunity_id,
        type: "qualification",
        qualification_result: evaluated.result,
        dimensions: input.dimensions,
        evidences: input.evidences,
        hypotheses: input.hypotheses,
        gaps: input.gaps,
        explanation: evaluated.explanation,
        assessed_by_actor_id: actor.actorId,
        assessed_at: now,
      });

      return Response.json({ qualification: record });
    }

    memoryStore.qualifications.set(input.opportunity_id, record);
    return Response.json({ qualification: record });
  }

  // 10. Salvar Diagnóstico Comercial
  if (input.action === "save_diagnosis") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    const diagnosisId = `diag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const record: CommercialDiagnosis = {
      id: diagnosisId,
      agency_id: agencyId,
      opportunity_id: input.opportunity_id,
      step_answers: input.step_answers,
      evidences: input.evidences,
      expectations: input.expectations,
      red_flags: input.red_flags,
      risks: input.risks,
      decision: input.decision,
      next_steps: input.next_steps,
      conducted_by_actor_id: actor.actorId,
      conducted_at: now,
    };

    if (db) {
      await db.from("commercial_diagnoses").upsert(record);
      return Response.json({ diagnosis: record });
    }

    memoryStore.diagnoses.set(input.opportunity_id, record);
    return Response.json({ diagnosis: record });
  }

  // 11. Salvar ou Atualizar Proposta (vinculada a Produto Aprovado da Fábrica)
  if (input.action === "upsert_proposal") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    // Regra mandatória: Nenhum preço ou escopo pode ser criado fora de uma definição aprovada da Fábrica de Produtos
    if (db) {
      const { data: prod, error: prodErr } = await db
        .from("product_definitions")
        .select("id, status, version")
        .eq("agency_id", agencyId)
        .eq("id", input.product_definition_id)
        .maybeSingle();

      if (prodErr || !prod) {
        return Response.json({ error: "Produto da Fábrica de Produtos não encontrado ou não pertencente à agência." }, { status: 404 });
      }

      if (prod.status !== "approved") {
        return Response.json(
          {
            error: `O produto '${input.product_definition_id}' está com status '${prod.status}'. Propostas comerciais exigem produtos formalmente com status 'approved'.`,
          },
          { status: 400 }
        );
      }
    }

    // Validação de desconto
    const discountVal = validateProposalDiscount({
      discount_setup_percentage: input.discount_setup_percentage,
      discount_monthly_percentage: input.discount_monthly_percentage,
      discount_justification: input.discount_justification,
      discount_counterpart: input.discount_counterpart,
    });
    if (!discountVal.valid) {
      return Response.json({ error: "Regra de desconto violada.", details: discountVal.errors }, { status: 400 });
    }

    const proposalId = input.proposal_id || `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const proposalRecord: CommercialProposal = {
      id: proposalId,
      agency_id: agencyId,
      opportunity_id: input.opportunity_id,
      product_definition_id: input.product_definition_id,
      product_version: input.product_version,
      version: 1,
      status: "draft",
      is_immutable: false,
      setup_price: input.setup_price,
      monthly_price: input.monthly_price,
      discount_setup_percentage: input.discount_setup_percentage,
      discount_monthly_percentage: input.discount_monthly_percentage,
      discount_justification: input.discount_justification || null,
      discount_counterpart: input.discount_counterpart || null,
      scope_adjustments: input.scope_adjustments,
      selected_scope_items: input.selected_scope_items,
      payment_terms: input.payment_terms,
      valid_until: input.valid_until,
      dependencies: input.dependencies,
      expectations: input.expectations,
      risks: input.risks,
      sent_at: null,
      decided_at: null,
      created_by_actor_id: actor.actorId,
      created_at: now,
      updated_at: now,
    };

    if (db) {
      const { data, error } = await db
        .from("commercial_proposals")
        .upsert(proposalRecord)
        .select()
        .single();

      if (error) {
        return Response.json({ error: "Erro ao salvar proposta.", details: error.message }, { status: 500 });
      }

      // Atualiza valores financeiros estimados na oportunidade
      await db
        .from("commercial_opportunities")
        .update({
          estimated_setup_value: input.setup_price,
          estimated_mrr_value: input.monthly_price,
          product_definition_id: input.product_definition_id,
          product_version: input.product_version,
          last_activity_at: now,
          updated_at: now,
        })
        .eq("agency_id", agencyId)
        .eq("id", input.opportunity_id);

      return Response.json({ proposal: data });
    }

    const currentProposals = memoryStore.proposals.get(input.opportunity_id) || [];
    currentProposals.push(proposalRecord);
    memoryStore.proposals.set(input.opportunity_id, currentProposals);

    // Atualiza oportunidade com valores estimados
    const opp = memoryStore.opportunities.get(input.opportunity_id);
    if (opp) {
      opp.estimated_setup_value = input.setup_price;
      opp.estimated_mrr_value = input.monthly_price;
      opp.product_definition_id = input.product_definition_id;
      opp.product_version = input.product_version;
      opp.last_activity_at = now;
    }

    return Response.json({ proposal: proposalRecord });
  }

  // 12. Enviar Proposta (torna imutável e atualiza oportunidade)
  if (input.action === "send_proposal") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    const now = new Date().toISOString();

    if (db) {
      const { data: prop, error: propErr } = await db
        .from("commercial_proposals")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("id", input.proposal_id)
        .maybeSingle();

      if (propErr || !prop) {
        return Response.json({ error: "Proposta não encontrada." }, { status: 404 });
      }

      // Torna imutável
      const { data: updatedProp, error: upErr } = await db
        .from("commercial_proposals")
        .update({ status: "sent", is_immutable: true, sent_at: now, updated_at: now })
        .eq("agency_id", agencyId)
        .eq("id", input.proposal_id)
        .select()
        .single();

      if (upErr) {
        return Response.json({ error: "Erro ao formalizar envio da proposta." }, { status: 500 });
      }

      // Atualiza estágio da oportunidade para proposal_sent
      await db
        .from("commercial_opportunities")
        .update({ stage: "proposal_sent", last_activity_at: now, updated_at: now })
        .eq("agency_id", agencyId)
        .eq("id", input.opportunity_id);

      return Response.json({ proposal: updatedProp });
    }

    const oppProposals = memoryStore.proposals.get(input.opportunity_id) || [];
    const target = oppProposals.find((p) => p.id === input.proposal_id);
    if (!target) {
      return Response.json({ error: "Proposta não encontrada." }, { status: 404 });
    }

    target.status = "sent";
    target.is_immutable = true;
    target.sent_at = now;
    target.updated_at = now;

    const opp = memoryStore.opportunities.get(input.opportunity_id);
    if (opp) {
      opp.stage = "proposal_sent";
      opp.last_activity_at = now;
    }

    return Response.json({ proposal: target });
  }

  // 14. Upsert de Atividade / Follow-up
  if (input.action === "upsert_activity") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    const activityId = input.activity_id || `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const activityRecord: FollowUpActivity = {
      id: activityId,
      agency_id: agencyId,
      opportunity_id: input.opportunity_id,
      cadence: input.cadence,
      title: input.title.trim(),
      objective: input.objective.trim(),
      status: "pending",
      deadline: input.deadline,
      completed_at: null,
      actor_id: input.actor_id,
      notes: input.notes,
      created_at: now,
    };

    if (db) {
      const { data, error } = await db
        .from("commercial_activities")
        .upsert(activityRecord)
        .select()
        .single();

      if (error) {
        return Response.json({ error: "Erro ao salvar atividade." }, { status: 500 });
      }

      // Atualiza próxima ação da oportunidade
      await db
        .from("commercial_opportunities")
        .update({
          next_action: input.title.trim(),
          next_action_deadline: input.deadline,
          last_activity_at: now,
          updated_at: now,
        })
        .eq("agency_id", agencyId)
        .eq("id", input.opportunity_id);

      return Response.json({ activity: data });
    }

    const oppActivities = memoryStore.activities.get(input.opportunity_id) || [];
    oppActivities.push(activityRecord);
    memoryStore.activities.set(input.opportunity_id, oppActivities);

    const opp = memoryStore.opportunities.get(input.opportunity_id);
    if (opp) {
      opp.next_action = input.title.trim();
      opp.next_action_deadline = input.deadline;
      opp.last_activity_at = now;
    }

    return Response.json({ activity: activityRecord });
  }

  // 15. Concluir Atividade
  if (input.action === "complete_activity") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    const now = new Date().toISOString();
    if (db) {
      const { data, error } = await db
        .from("commercial_activities")
        .update({ status: "completed", completed_at: now, notes: input.notes })
        .eq("agency_id", agencyId)
        .eq("id", input.activity_id)
        .select()
        .single();

      if (error) {
        return Response.json({ error: "Erro ao concluir atividade." }, { status: 500 });
      }
      return Response.json({ activity: data });
    }

    // Memória local
    for (const activities of memoryStore.activities.values()) {
      const act = activities.find((a) => a.id === input.activity_id);
      if (act && act.agency_id === agencyId) {
        act.status = "completed";
        act.completed_at = now;
        act.notes = input.notes || act.notes;
        return Response.json({ activity: act });
      }
    }

    return Response.json({ error: "Atividade não encontrada." }, { status: 404 });
  }

  // 16. Salvar Handoff de Vendas
  if (input.action === "save_handoff") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    const now = new Date().toISOString();
    const handoffId = `hand_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Busca empresa da oportunidade
    let companyId = "";
    if (db) {
      const { data: opp } = await db
        .from("commercial_opportunities")
        .select("company_id")
        .eq("agency_id", agencyId)
        .eq("id", input.opportunity_id)
        .maybeSingle();
      companyId = opp?.company_id || "";
    } else {
      companyId = memoryStore.opportunities.get(input.opportunity_id)?.company_id || "";
    }

    const handoffRecord: SalesHandoff = {
      id: handoffId,
      agency_id: agencyId,
      opportunity_id: input.opportunity_id,
      company_id: companyId,
      proposal_id: input.proposal_id,
      status: "draft",
      checklist: input.checklist,
      promises_made: input.promises_made,
      client_expectations: input.client_expectations,
      operational_risks: input.operational_risks,
      critical_dependencies: input.critical_dependencies,
      missing_data: input.missing_data,
      operations_reviewer_actor_id: null,
      operations_notes: null,
      submitted_at: null,
      reviewed_at: null,
      created_at: now,
      updated_at: now,
    };

    if (db) {
      const { data, error } = await db
        .from("commercial_sales_handoffs")
        .upsert(handoffRecord, { onConflict: "agency_id, opportunity_id" })
        .select()
        .single();

      if (error) {
        return Response.json({ error: "Erro ao salvar handoff." }, { status: 500 });
      }
      return Response.json({ handoff: data });
    }

    memoryStore.handoffs.set(input.opportunity_id, handoffRecord);
    return Response.json({ handoff: handoffRecord });
  }

  // 17. Submeter Handoff para Revisão Operacional
  if (input.action === "submit_handoff_review") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
    }

    const now = new Date().toISOString();
    if (db) {
      const { data: handoff, error } = await db
        .from("commercial_sales_handoffs")
        .update({ status: "operations_review", submitted_at: now, updated_at: now })
        .eq("agency_id", agencyId)
        .eq("id", input.handoff_id)
        .select()
        .single();

      if (error) {
        return Response.json({ error: "Erro ao submeter handoff para operações." }, { status: 500 });
      }
      return Response.json({ handoff });
    }

    const hand = memoryStore.handoffs.get(input.opportunity_id);
    if (hand) {
      hand.status = "operations_review";
      hand.submitted_at = now;
      hand.updated_at = now;
      return Response.json({ handoff: hand });
    }

    return Response.json({ error: "Handoff não encontrado." }, { status: 404 });
  }

  // 18. Avaliar Handoff (Operações)
  if (input.action === "review_handoff") {
    if (!roleCanWrite(actor.role)) {
      return Response.json({ error: "Apenas administradores ou operadores podem aprovar o handoff." }, { status: 403 });
    }

    const now = new Date().toISOString();
    if (db) {
      const { data: handoff, error } = await db
        .from("commercial_sales_handoffs")
        .update({
          status: input.decision,
          operations_notes: input.operations_notes,
          operations_reviewer_actor_id: actor.actorId,
          reviewed_at: now,
          updated_at: now,
        })
        .eq("agency_id", agencyId)
        .eq("id", input.handoff_id)
        .select()
        .single();

      if (error) {
        return Response.json({ error: "Erro ao registrar avaliação de operações." }, { status: 500 });
      }

      // REGRA MANDATÓRIA: Mesmo aprovado para onboarding, NÃO cria cliente automaticamente aqui.
      // O onboarding (Módulo 03) receberá o handoff aprovado para fazer a conferência humana e ativação.

      return Response.json({ handoff });
    }

    // Memória local
    for (const hand of memoryStore.handoffs.values()) {
      if (hand.id === input.handoff_id && hand.agency_id === agencyId) {
        hand.status = input.decision;
        hand.operations_notes = input.operations_notes;
        hand.operations_reviewer_actor_id = actor.actorId;
        hand.reviewed_at = now;
        hand.updated_at = now;
        return Response.json({ handoff: hand });
      }
    }

    return Response.json({ error: "Handoff não encontrado." }, { status: 404 });
  }

  // 19. Métricas e Previsão Comercial (Forecast)
  if (input.action === "get_metrics_and_forecast") {
    let oppsList: CommercialOpportunity[] = [];
    let companiesCount = 0;

    if (db) {
      const [oppRes, compRes] = await Promise.all([
        db.from("commercial_opportunities").select("*").eq("agency_id", agencyId),
        db.from("commercial_companies").select("id", { count: "exact" }).eq("agency_id", agencyId),
      ]);
      oppsList = oppRes.data || [];
      companiesCount = compRes.count || 0;
    } else {
      oppsList = Array.from(memoryStore.opportunities.values()).filter((o) => o.agency_id === agencyId);
      companiesCount = Array.from(memoryStore.companies.values()).filter((c) => c.agency_id === agencyId).length;
    }

    const metrics = calculateCommercialMetrics(oppsList, companiesCount);
    const forecast = generateForecast(oppsList);

    return Response.json({
      metrics,
      forecast,
    });
  }

  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
