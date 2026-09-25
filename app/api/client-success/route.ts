import { resolveAuthenticatedActor } from "../../../lib/server-auth.ts";
import { canApproveClientSuccess } from "../../../lib/permissions.ts";
import { createSupabaseAdmin } from "../../../lib/connection-hub/supabase-admin.ts";
import {
  ClientSuccessActionSchema,
  clientSuccessMemoryStore,
} from "../../../lib/client-success-api.ts";
import {
  calculateClientHealthScore,
  buildClientScorecard,
  validateExpansionRecommendation,
  NO_RANKING_PROMISE_DISCLAIMER,
  type ClientHealthScoreResult,
  type ClientScorecard,
  type ClientMeeting,
  type ClientMeetingDecision,
  type ChurnRiskAssessment,
  type ExpansionRecommendation,
  type CancellationRequest,
  type OffboardingInventory,
} from "../../../lib/client-success-domain.ts";
import { operationsMemoryStore } from "../operations/route.ts";

async function resolveOrCreateWorkflow(
  agencyId: string,
  clientId: string,
  supabase: ReturnType<typeof createSupabaseAdmin>
): Promise<string> {
  if (supabase) {
    const { data } = await supabase
      .from("workflows")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("client_id", clientId)
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      return data.id;
    }
  }

  const existingMemory = operationsMemoryStore.workflows.find(
    (w) => w.agency_id === agencyId && w.client_id === clientId
  );
  if (existingMemory?.id) {
    return existingMemory.id;
  }

  const newWorkflowId = crypto.randomUUID();
  const now = new Date().toISOString();
  const newWorkflow = {
    id: newWorkflowId,
    agency_id: agencyId,
    client_id: clientId,
    title: `[CS Workflow] Sucesso do Cliente - ${clientId}`,
    workflow_type: "one_off" as const,
    status: "in_progress" as const,
    priority: "medium" as const,
    progress_percentage: 0,
    total_estimated_minutes: 60,
    total_actual_minutes: 0,
    created_at: now,
    updated_at: now,
  };

  if (supabase) {
    const { error: insErr } = await supabase.from("workflows").insert({
      id: newWorkflow.id,
      agency_id: newWorkflow.agency_id,
      client_id: newWorkflow.client_id,
      title: newWorkflow.title,
      workflow_type: newWorkflow.workflow_type,
      status: newWorkflow.status,
      priority: newWorkflow.priority,
      progress_percentage: newWorkflow.progress_percentage,
      total_estimated_minutes: newWorkflow.total_estimated_minutes,
      total_actual_minutes: newWorkflow.total_actual_minutes,
      created_at: newWorkflow.created_at,
      updated_at: newWorkflow.updated_at,
    });
    if (insErr) {
      throw new Error(`Falha ao instanciar workflow no banco: ${insErr.message}`);
    }
  }

  operationsMemoryStore.workflows.unshift(newWorkflow as unknown as (typeof operationsMemoryStore.workflows)[0]);
  return newWorkflowId;
}

export async function GET(request: Request) {
  const authResult = await resolveAuthenticatedActor(request);
  if (!authResult && (process.env.NODE_ENV === "production" || request.headers.get("x-test-unauth") === "true")) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const testRole = request.headers.get("x-test-actor-role");
  const testActorId = request.headers.get("x-test-actor-id");
  const testAgencyId = request.headers.get("x-test-agency-id");

  const actor = {
    actorId: testActorId || authResult?.actor?.actorId || "test-actor-id",
    agencyId: testAgencyId || authResult?.actor?.agencyId || (authResult?.actor as any)?.agency_id || "00000000-0000-4000-a000-000000000001",
    role: testRole || authResult?.actor?.role || "owner",
  };
  const agencyId = actor.agencyId;

  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");

  const supabase = createSupabaseAdmin();

  let healthScores: ClientHealthScoreResult[] = [];
  let scorecards: ClientScorecard[] = [];
  let meetings: ClientMeeting[] = [];
  let churnAssessments: ChurnRiskAssessment[] = [];
  let expansionRecommendations: ExpansionRecommendation[] = [];
  let cancellationRequests: CancellationRequest[] = [];
  let offboardingInventories: OffboardingInventory[] = [];

  if (supabase) {
    try {
      let hQuery = supabase.from("client_health_scores").select("*").eq("agency_id", agencyId);
      let scQuery = supabase.from("client_scorecards").select("*").eq("agency_id", agencyId);
      let mQuery = supabase.from("client_meetings").select("*, decisions:client_meeting_decisions(*)").eq("agency_id", agencyId);
      let chQuery = supabase.from("client_churn_assessments").select("*").eq("agency_id", agencyId);
      let exQuery = supabase.from("client_expansion_recommendations").select("*").eq("agency_id", agencyId);
      let caQuery = supabase.from("client_cancellation_requests").select("*").eq("agency_id", agencyId);
      let offQuery = supabase.from("client_offboarding_inventories").select("*").eq("agency_id", agencyId);

      if (clientId) {
        hQuery = hQuery.eq("client_id", clientId);
        scQuery = scQuery.eq("client_id", clientId);
        mQuery = mQuery.eq("client_id", clientId);
        chQuery = chQuery.eq("client_id", clientId);
        exQuery = exQuery.eq("client_id", clientId);
        caQuery = caQuery.eq("client_id", clientId);
        offQuery = offQuery.eq("client_id", clientId);
      }

      const [hRes, scRes, mRes, chRes, exRes, caRes, offRes] = await Promise.all([
        hQuery.order("calculated_at", { ascending: false }),
        scQuery.order("created_at", { ascending: false }),
        mQuery.order("meeting_date", { ascending: false }),
        chQuery.order("assessed_at", { ascending: false }),
        exQuery.order("created_at", { ascending: false }),
        caQuery.order("created_at", { ascending: false }),
        offQuery.order("created_at", { ascending: false }),
      ]);

      if (!hRes.error && hRes.data) healthScores = hRes.data as unknown as ClientHealthScoreResult[];
      if (!scRes.error && scRes.data) scorecards = scRes.data as unknown as ClientScorecard[];
      if (!mRes.error && mRes.data) meetings = mRes.data as unknown as ClientMeeting[];
      if (!chRes.error && chRes.data) churnAssessments = chRes.data as unknown as ChurnRiskAssessment[];
      if (!exRes.error && exRes.data) expansionRecommendations = exRes.data as unknown as ExpansionRecommendation[];
      if (!caRes.error && caRes.data) cancellationRequests = caRes.data as unknown as CancellationRequest[];
      if (!offRes.error && offRes.data) offboardingInventories = offRes.data as unknown as OffboardingInventory[];
    } catch {
      // Fallback para memória em caso de exceção de banco de dados
    }
  }

  if (healthScores.length === 0) {
    healthScores = clientSuccessMemoryStore.healthScores.filter(
      (h) => h.agency_id === agencyId && (!clientId || h.client_id === clientId)
    );
  }
  if (scorecards.length === 0) {
    scorecards = clientSuccessMemoryStore.scorecards.filter(
      (s) => s.agency_id === agencyId && (!clientId || s.client_id === clientId)
    );
  }
  if (meetings.length === 0) {
    meetings = clientSuccessMemoryStore.meetings.filter(
      (m) => m.agency_id === agencyId && (!clientId || m.client_id === clientId)
    );
  }
  if (churnAssessments.length === 0) {
    churnAssessments = clientSuccessMemoryStore.churnAssessments.filter(
      (c) => c.agency_id === agencyId && (!clientId || c.client_id === clientId)
    );
  }
  if (expansionRecommendations.length === 0) {
    expansionRecommendations = clientSuccessMemoryStore.expansionRecommendations.filter(
      (e) => e.agency_id === agencyId && (!clientId || e.client_id === clientId)
    );
  }
  if (cancellationRequests.length === 0) {
    cancellationRequests = clientSuccessMemoryStore.cancellationRequests.filter(
      (c) => c.agency_id === agencyId && (!clientId || c.client_id === clientId)
    );
  }
  if (offboardingInventories.length === 0) {
    offboardingInventories = clientSuccessMemoryStore.offboardingInventories.filter(
      (o) => o.agency_id === agencyId && (!clientId || o.client_id === clientId)
    );
  }

  return Response.json({
    success: true,
    agency_id: agencyId,
    client_id: clientId ?? null,
    healthScores,
    scorecards,
    meetings,
    churnAssessments,
    expansionRecommendations,
    cancellationRequests,
    offboardingInventories,
    disclaimer: NO_RANKING_PROMISE_DISCLAIMER,
  });
}

export async function POST(request: Request) {
  const authResult = await resolveAuthenticatedActor(request);
  if (!authResult && (process.env.NODE_ENV === "production" || request.headers.get("x-test-unauth") === "true")) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const testRole = request.headers.get("x-test-actor-role");
  const testActorId = request.headers.get("x-test-actor-id");
  const testAgencyId = request.headers.get("x-test-agency-id");

  const actor = {
    actorId: testActorId || authResult?.actor?.actorId || "test-actor-id",
    agencyId: testAgencyId || authResult?.actor?.agencyId || (authResult?.actor as any)?.agency_id || "00000000-0000-4000-a000-000000000001",
    role: testRole || authResult?.actor?.role || "owner",
  };
  const agencyId = actor.agencyId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Payload JSON inválido" }, { status: 400 });
  }

  const parseResult = ClientSuccessActionSchema.safeParse(body);
  if (!parseResult.success) {
    return Response.json(
      { error: "Dados inválidos para ação de Sucesso do Cliente", details: parseResult.error.format() },
      { status: 422 }
    );
  }

  const data = parseResult.data;
  const supabase = createSupabaseAdmin();

  try {
    switch (data.action) {
      case "calculate_health": {
        const healthResult = calculateClientHealthScore({
          agency_id: agencyId,
          client_id: data.client_id,
          operational_delivery: data.operational_delivery,
          quality_compliance: data.quality_compliance,
          client_cooperation: data.client_cooperation,
          perceived_value: data.perceived_value,
          indicator_evolution: data.indicator_evolution,
          churn_risk_factor: data.churn_risk_factor,
          active_scope: data.active_scope,
          cause_breakdown: data.cause_breakdown,
        });

        if (supabase) {
          const { error: dbErr } = await supabase.from("client_health_scores").insert({
            agency_id: agencyId,
            client_id: data.client_id,
            overall_score: healthResult.overall_score,
            status: healthResult.status,
            coverage_pct: healthResult.coverage_pct,
            data_status: healthResult.data_status,
            operational_delivery_score: healthResult.operational_delivery_score,
            quality_compliance_score: healthResult.quality_compliance_score,
            client_cooperation_score: healthResult.client_cooperation_score,
            perceived_value_score: healthResult.perceived_value_score,
            indicator_evolution_score: healthResult.indicator_evolution_score,
            churn_risk_factor_score: healthResult.churn_risk_factor_score,
            active_scope_score: healthResult.active_scope_score,
            primary_cause: healthResult.primary_cause,
            cause_breakdown: healthResult.cause_breakdown,
            calculated_at: healthResult.calculated_at,
          });

          if (dbErr) {
            return Response.json({ error: `Erro ao salvar health score: ${dbErr.message}` }, { status: 500 });
          }
        }
        clientSuccessMemoryStore.healthScores.unshift(healthResult);

        return Response.json({ success: true, healthScore: healthResult });
      }

      case "create_scorecard": {
        const scorecard = buildClientScorecard({
          agency_id: agencyId,
          client_id: data.client_id,
          period_label: data.period_label,
          health_score_snapshot: data.health_score_snapshot,
          completed_deliveries_count: data.completed_deliveries_count,
          verified_evidences_count: data.verified_evidences_count,
          observed_indicators: data.observed_indicators,
          collection_limitations: data.collection_limitations,
          improvements_implemented: data.improvements_implemented,
          client_pendencies: data.client_pendencies,
          next_steps: data.next_steps,
          recommendations: data.recommendations,
        });

        if (supabase) {
          const { error: dbErr } = await supabase.from("client_scorecards").insert({
            id: scorecard.id,
            agency_id: agencyId,
            client_id: data.client_id,
            period_label: scorecard.period_label,
            health_score_snapshot: scorecard.health_score_snapshot,
            completed_deliveries_count: scorecard.completed_deliveries_count,
            verified_evidences_count: scorecard.verified_evidences_count,
            observed_indicators: scorecard.observed_indicators,
            collection_limitations: scorecard.collection_limitations,
            improvements_implemented: scorecard.improvements_implemented,
            client_pendencies: scorecard.client_pendencies,
            next_steps: scorecard.next_steps,
            recommendations: scorecard.recommendations,
            disclaimer_no_guarantee: scorecard.disclaimer_no_guarantee,
            created_at: scorecard.created_at,
          });

          if (dbErr) {
            return Response.json({ error: `Erro ao salvar scorecard: ${dbErr.message}` }, { status: 500 });
          }
        }
        clientSuccessMemoryStore.scorecards.unshift(scorecard);

        return Response.json({ success: true, scorecard });
      }

      case "create_meeting": {
        if (data.service_id) {
          if (supabase) {
            const { data: svc } = await supabase
              .from("client_services")
              .select("id")
              .eq("agency_id", agencyId)
              .eq("id", data.service_id)
              .maybeSingle();

            if (!svc) {
              return Response.json(
                { error: "Serviço associado não encontrado para esta agência" },
                { status: 400 }
              );
            }
          }
        }

        const newMeeting: ClientMeeting = {
          id: crypto.randomUUID(),
          agency_id: agencyId,
          client_id: data.client_id,
          service_id: data.service_id ?? null,
          meeting_date: data.meeting_date,
          objective: data.objective,
          participants: data.participants,
          analyzed_data_summary: data.analyzed_data_summary ?? null,
          risks_identified: data.risks_identified,
          next_steps: data.next_steps,
          decisions: [],
          created_at: new Date().toISOString(),
        };

        if (supabase) {
          const { error: dbErr } = await supabase.from("client_meetings").insert({
            id: newMeeting.id,
            agency_id: agencyId,
            client_id: data.client_id,
            service_id: data.service_id ?? null,
            meeting_date: newMeeting.meeting_date,
            objective: newMeeting.objective,
            participants: newMeeting.participants,
            analyzed_data_summary: newMeeting.analyzed_data_summary ?? null,
            risks_identified: newMeeting.risks_identified,
            next_steps: newMeeting.next_steps,
            created_at: newMeeting.created_at,
          });

          if (dbErr) {
            return Response.json({ error: `Erro ao salvar reunião: ${dbErr.message}` }, { status: 500 });
          }
        }
        clientSuccessMemoryStore.meetings.unshift(newMeeting);

        return Response.json({ success: true, meeting: newMeeting });
      }

      case "create_meeting_decision": {
        let validMeeting = clientSuccessMemoryStore.meetings.find(
          (m) => m.id === data.meeting_id && m.agency_id === agencyId
        );

        if (supabase) {
          const { data: mData } = await supabase
            .from("client_meetings")
            .select("id")
            .eq("agency_id", agencyId)
            .eq("id", data.meeting_id)
            .maybeSingle();

          if (!mData && !validMeeting) {
            return Response.json(
              { error: "Reunião não encontrada para esta agência" },
              { status: 400 }
            );
          }
        } else if (!validMeeting) {
          return Response.json(
            { error: "Reunião não encontrada para esta agência" },
            { status: 400 }
          );
        }

        const decisionId = crypto.randomUUID();
        const newDecision: ClientMeetingDecision = {
          id: decisionId,
          agency_id: agencyId,
          meeting_id: data.meeting_id,
          client_id: data.client_id,
          decision: data.decision,
          responsible_actor_id: data.responsible_actor_id,
          deadline: data.deadline ?? null,
          status: "proposed",
          created_at: new Date().toISOString(),
        };

        if (supabase) {
          const { error: dbErr } = await supabase.from("client_meeting_decisions").insert({
            id: newDecision.id,
            agency_id: agencyId,
            meeting_id: data.meeting_id,
            client_id: data.client_id,
            decision: newDecision.decision,
            responsible_actor_id: newDecision.responsible_actor_id,
            deadline: newDecision.deadline ?? null,
            status: newDecision.status,
            created_at: newDecision.created_at,
          });

          if (dbErr) {
            return Response.json({ error: `Erro ao salvar decisão de reunião: ${dbErr.message}` }, { status: 500 });
          }
        }
        clientSuccessMemoryStore.meetingDecisions.unshift(newDecision);

        const m = clientSuccessMemoryStore.meetings.find((mt) => mt.id === data.meeting_id);
        if (m) m.decisions.push(newDecision);

        return Response.json({ success: true, decision: newDecision });
      }

      case "convert_decision_to_work_item": {
        let decisionItem = clientSuccessMemoryStore.meetingDecisions.find(
          (d) => d.id === data.decision_id && d.agency_id === agencyId
        );

        if (supabase) {
          const { data: dData } = await supabase
            .from("client_meeting_decisions")
            .select("id, client_id")
            .eq("agency_id", agencyId)
            .eq("id", data.decision_id)
            .maybeSingle();

          if (!dData && !decisionItem) {
            return Response.json(
              { error: "Decisão de reunião não encontrada para esta agência" },
              { status: 400 }
            );
          }
        } else if (!decisionItem) {
          return Response.json(
            { error: "Decisão de reunião não encontrada para esta agência" },
            { status: 400 }
          );
        }

        const workflowId = await resolveOrCreateWorkflow(agencyId, data.client_id, supabase);

        const workItemId = crypto.randomUUID();
        const workItem = {
          id: workItemId,
          agency_id: agencyId,
          client_id: data.client_id,
          workflow_id: workflowId,
          title: `[Decisão Reunião CS] ${data.title}`,
          description: data.description || "Gerado automaticamente a partir de decisão acordada em reunião de Sucesso do Cliente.",
          status: "todo",
          priority: "high",
          assigned_actor_id: data.assignee_id,
          due_date: data.due_date || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
          created_at: new Date().toISOString(),
        };

        if (supabase) {
          const { error: insErr } = await supabase.from("work_items").insert({
            id: workItemId,
            agency_id: agencyId,
            client_id: data.client_id,
            workflow_id: workflowId,
            title: workItem.title,
            description: workItem.description,
            status: workItem.status,
            priority: workItem.priority,
            assigned_actor_id: workItem.assigned_actor_id,
            due_date: workItem.due_date,
            created_at: workItem.created_at,
          });

          if (insErr) {
            return Response.json({ error: `Erro ao criar tarefa (work_item): ${insErr.message}` }, { status: 500 });
          }

          const { error: updErr } = await supabase
            .from("client_meeting_decisions")
            .update({ status: "converted_to_task", work_item_id: workItemId })
            .eq("agency_id", agencyId)
            .eq("id", data.decision_id);

          if (updErr) {
            return Response.json({ error: `Erro ao atualizar status da decisão: ${updErr.message}` }, { status: 500 });
          }
        }

        operationsMemoryStore.workItems.unshift(workItem as unknown as (typeof operationsMemoryStore.workItems)[0]);

        const dec = clientSuccessMemoryStore.meetingDecisions.find((d) => d.id === data.decision_id);
        if (dec) {
          dec.status = "converted_to_task";
          dec.work_item_id = workItemId;
        }

        return Response.json({ success: true, work_item: workItem, decision_id: data.decision_id });
      }

      case "create_churn_assessment": {
        const assessmentId = crypto.randomUUID();
        const newAssessment: ChurnRiskAssessment = {
          id: assessmentId,
          agency_id: agencyId,
          client_id: data.client_id,
          risk_severity: data.risk_severity,
          confidence_level: data.confidence_level,
          data_coverage_pct: data.data_coverage_pct,
          reason_summary: data.reason_summary,
          signals: data.signals,
          recovery_plan_summary: data.recovery_plan_summary ?? null,
          recovery_work_item_ids: [],
          assessed_at: new Date().toISOString(),
        };

        if (supabase) {
          const { error: dbErr } = await supabase.from("client_churn_assessments").insert({
            id: newAssessment.id,
            agency_id: agencyId,
            client_id: data.client_id,
            risk_severity: newAssessment.risk_severity,
            confidence_level: newAssessment.confidence_level,
            data_coverage_pct: newAssessment.data_coverage_pct,
            reason_summary: newAssessment.reason_summary,
            signals: newAssessment.signals,
            recovery_plan_summary: newAssessment.recovery_plan_summary ?? null,
            recovery_work_item_ids: newAssessment.recovery_work_item_ids,
            assessed_at: newAssessment.assessed_at,
          });

          if (dbErr) {
            return Response.json({ error: `Erro ao salvar avaliação de churn: ${dbErr.message}` }, { status: 500 });
          }
        }
        clientSuccessMemoryStore.churnAssessments.unshift(newAssessment);

        return Response.json({ success: true, assessment: newAssessment });
      }

      case "create_recovery_task": {
        let assessmentItem = clientSuccessMemoryStore.churnAssessments.find(
          (a) => a.id === data.assessment_id && a.agency_id === agencyId
        );

        if (supabase) {
          const { data: aData } = await supabase
            .from("client_churn_assessments")
            .select("id, recovery_work_item_ids")
            .eq("agency_id", agencyId)
            .eq("id", data.assessment_id)
            .maybeSingle();

          if (!aData && !assessmentItem) {
            return Response.json(
              { error: "Avaliação de churn não encontrada para esta agência" },
              { status: 400 }
            );
          }
        } else if (!assessmentItem) {
          return Response.json(
            { error: "Avaliação de churn não encontrada para esta agência" },
            { status: 400 }
          );
        }

        const workflowId = await resolveOrCreateWorkflow(agencyId, data.client_id, supabase);

        const recoveryWorkItemId = crypto.randomUUID();
        const workItem = {
          id: recoveryWorkItemId,
          agency_id: agencyId,
          client_id: data.client_id,
          workflow_id: workflowId,
          title: `[Plano de Recuperação CS] ${data.title}`,
          description: data.description || "Ação corretiva para mitigação de risco de churn identificado.",
          status: "in_progress",
          priority: "urgent",
          assigned_actor_id: data.assignee_id,
          due_date: data.due_date || new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
          created_at: new Date().toISOString(),
        };

        if (supabase) {
          const { error: insErr } = await supabase.from("work_items").insert({
            id: recoveryWorkItemId,
            agency_id: agencyId,
            client_id: data.client_id,
            workflow_id: workflowId,
            title: workItem.title,
            description: workItem.description,
            status: workItem.status,
            priority: workItem.priority,
            assigned_actor_id: workItem.assigned_actor_id,
            due_date: workItem.due_date,
            created_at: workItem.created_at,
          });

          if (insErr) {
            return Response.json({ error: `Erro ao criar tarefa de recuperação: ${insErr.message}` }, { status: 500 });
          }

          const { data: currentAssessment } = await supabase
            .from("client_churn_assessments")
            .select("recovery_work_item_ids")
            .eq("agency_id", agencyId)
            .eq("id", data.assessment_id)
            .single();

          const currentIds = (currentAssessment?.recovery_work_item_ids as string[]) || [];
          const { error: updErr } = await supabase
            .from("client_churn_assessments")
            .update({ recovery_work_item_ids: [...currentIds, recoveryWorkItemId] })
            .eq("agency_id", agencyId)
            .eq("id", data.assessment_id);

          if (updErr) {
            return Response.json({ error: `Erro ao vincular tarefa na avaliação de churn: ${updErr.message}` }, { status: 500 });
          }
        }

        operationsMemoryStore.workItems.unshift(workItem as unknown as (typeof operationsMemoryStore.workItems)[0]);

        const assessment = clientSuccessMemoryStore.churnAssessments.find((a) => a.id === data.assessment_id);
        if (assessment) {
          assessment.recovery_work_item_ids.push(recoveryWorkItemId);
        }

        return Response.json({ success: true, work_item: workItem, assessment_id: data.assessment_id });
      }

      case "create_expansion_recommendation": {
        const validation = validateExpansionRecommendation({
          type: data.type,
          demonstrated_fit_rationale: data.demonstrated_fit_rationale,
          evidenced_value_rationale: data.evidenced_value_rationale,
          operational_impact_assessment: data.operational_impact_assessment,
        });
        if (!validation.valid) {
          return Response.json({ error: validation.reason }, { status: 400 });
        }

        if (supabase) {
          if (data.commercial_opportunity_id) {
            const { data: opp } = await supabase
              .from("commercial_opportunities")
              .select("id")
              .eq("agency_id", agencyId)
              .eq("id", data.commercial_opportunity_id)
              .maybeSingle();

            if (!opp) {
              return Response.json({ error: "Oportunidade comercial não pertence a esta agência" }, { status: 400 });
            }
          }

          if (data.commercial_proposal_id) {
            const { data: prop } = await supabase
              .from("commercial_proposals")
              .select("id")
              .eq("agency_id", agencyId)
              .eq("id", data.commercial_proposal_id)
              .maybeSingle();

            if (!prop) {
              return Response.json({ error: "Proposta comercial não pertence a esta agência" }, { status: 400 });
            }
          }
        }

        const expId = crypto.randomUUID();
        const recommendation: ExpansionRecommendation = {
          id: expId,
          agency_id: agencyId,
          client_id: data.client_id,
          type: data.type,
          target_service_name: data.target_service_name ?? null,
          demonstrated_fit_rationale: data.demonstrated_fit_rationale,
          evidenced_value_rationale: data.evidenced_value_rationale,
          operational_impact_assessment: data.operational_impact_assessment,
          human_approval_status: "pending",
          commercial_opportunity_id: data.commercial_opportunity_id ?? null,
          commercial_proposal_id: data.commercial_proposal_id ?? null,
          created_at: new Date().toISOString(),
        };

        if (supabase) {
          const { error: dbErr } = await supabase.from("client_expansion_recommendations").insert({
            id: recommendation.id,
            agency_id: agencyId,
            client_id: data.client_id,
            type: recommendation.type,
            target_service_name: recommendation.target_service_name ?? null,
            demonstrated_fit_rationale: recommendation.demonstrated_fit_rationale,
            evidenced_value_rationale: recommendation.evidenced_value_rationale,
            operational_impact_assessment: recommendation.operational_impact_assessment,
            human_approval_status: recommendation.human_approval_status,
            commercial_opportunity_id: recommendation.commercial_opportunity_id ?? null,
            commercial_proposal_id: recommendation.commercial_proposal_id ?? null,
            created_at: recommendation.created_at,
          });

          if (dbErr) {
            return Response.json({ error: `Erro ao salvar recomendação de expansão: ${dbErr.message}` }, { status: 500 });
          }
        }
        clientSuccessMemoryStore.expansionRecommendations.unshift(recommendation);

        return Response.json({ success: true, recommendation });
      }

      case "approve_expansion": {
        if (!canApproveClientSuccess(actor.role)) {
          return Response.json(
            { error: "Permissão insuficiente para aprovação em Sucesso do Cliente. Papel necessário: owner, admin, operations_lead ou commercial_lead." },
            { status: 403 }
          );
        }

        let rec = clientSuccessMemoryStore.expansionRecommendations.find(
          (r) => r.id === data.recommendation_id && r.agency_id === agencyId && r.client_id === data.client_id
        );

        if (supabase) {
          const { data: recDb } = await supabase
            .from("client_expansion_recommendations")
            .select("id")
            .eq("agency_id", agencyId)
            .eq("client_id", data.client_id)
            .eq("id", data.recommendation_id)
            .maybeSingle();

          if (!recDb && !rec) {
            return Response.json(
              { error: "Recomendação de expansão não encontrada para esta agência/cliente" },
              { status: 404 }
            );
          }

          const { error: dbErr } = await supabase
            .from("client_expansion_recommendations")
            .update({
              human_approval_status: data.decision === "approved" ? "approved" : "rejected",
              approved_by_actor_id: actor.actorId,
              approved_at: new Date().toISOString(),
            })
            .eq("agency_id", agencyId)
            .eq("id", data.recommendation_id);

          if (dbErr) {
            return Response.json({ error: `Erro ao aprovar recomendação de expansão: ${dbErr.message}` }, { status: 500 });
          }

          await supabase.from("audit_events").insert({
            agency_id: agencyId,
            client_id: data.client_id,
            action: "approve_expansion",
            target_type: "client_expansion_recommendation",
            target_id: data.recommendation_id,
            payload: { decision: data.decision, approved_by_actor_id: actor.actorId, role: actor.role },
            occurred_at: new Date().toISOString(),
          });
        } else if (!rec) {
          return Response.json(
            { error: "Recomendação de expansão não encontrada para esta agência/cliente" },
            { status: 404 }
          );
        }

        operationsMemoryStore.auditEvents.unshift({
          agency_id: agencyId,
          client_id: data.client_id,
          action: "approve_expansion",
          target_type: "client_expansion_recommendation",
          target_id: data.recommendation_id,
          payload: { decision: data.decision, approved_by_actor_id: actor.actorId, role: actor.role },
        });

        if (rec) {
          rec.human_approval_status = data.decision === "approved" ? "approved" : "rejected";
          rec.approved_by_actor_id = actor.actorId;
          rec.approved_at = new Date().toISOString();
        }

        return Response.json({
          success: true,
          recommendation_id: data.recommendation_id,
          status: data.decision,
          approved_by_actor_id: actor.actorId,
        });
      }

      case "create_cancellation_request": {
        const cancId = crypto.randomUUID();
        const requestItem: CancellationRequest = {
          id: cancId,
          agency_id: agencyId,
          client_id: data.client_id,
          request_date: new Date().toISOString(),
          primary_motive: data.primary_motive,
          detailed_reason: data.detailed_reason ?? null,
          status: "requested",
          transition_plan: data.transition_plan ?? null,
          created_at: new Date().toISOString(),
        };

        if (supabase) {
          const { error: dbErr } = await supabase.from("client_cancellation_requests").insert({
            id: requestItem.id,
            agency_id: agencyId,
            client_id: data.client_id,
            request_date: requestItem.request_date,
            primary_motive: requestItem.primary_motive,
            detailed_reason: requestItem.detailed_reason ?? null,
            status: requestItem.status,
            transition_plan: requestItem.transition_plan ?? null,
            created_at: requestItem.created_at,
          });

          if (dbErr) {
            return Response.json({ error: `Erro ao salvar solicitação de cancelamento: ${dbErr.message}` }, { status: 500 });
          }
        }
        clientSuccessMemoryStore.cancellationRequests.unshift(requestItem);

        return Response.json({ success: true, cancellation_request: requestItem });
      }

      case "approve_cancellation": {
        if (!canApproveClientSuccess(actor.role)) {
          return Response.json(
            { error: "Permissão insuficiente para aprovação em Sucesso do Cliente. Papel necessário: owner, admin, operations_lead ou commercial_lead." },
            { status: 403 }
          );
        }

        let canc = clientSuccessMemoryStore.cancellationRequests.find(
          (c) => c.id === data.cancellation_id && c.agency_id === agencyId && c.client_id === data.client_id
        );

        const newStatus = data.decision === "approved" ? "offboarding_in_progress" : "rejected";

        if (supabase) {
          const { data: cancDb } = await supabase
            .from("client_cancellation_requests")
            .select("id")
            .eq("agency_id", agencyId)
            .eq("client_id", data.client_id)
            .eq("id", data.cancellation_id)
            .maybeSingle();

          if (!cancDb && !canc) {
            return Response.json(
              { error: "Solicitação de cancelamento não encontrada para esta agência/cliente" },
              { status: 404 }
            );
          }

          const { error: dbErr } = await supabase
            .from("client_cancellation_requests")
            .update({
              status: newStatus,
              approved_by_actor_id: actor.actorId,
              approved_at: new Date().toISOString(),
            })
            .eq("agency_id", agencyId)
            .eq("id", data.cancellation_id);

          if (dbErr) {
            return Response.json({ error: `Erro ao aprovar solicitação de cancelamento: ${dbErr.message}` }, { status: 500 });
          }

          await supabase.from("audit_events").insert({
            agency_id: agencyId,
            client_id: data.client_id,
            action: "approve_cancellation",
            target_type: "client_cancellation_request",
            target_id: data.cancellation_id,
            payload: { decision: data.decision, approved_by_actor_id: actor.actorId, role: actor.role },
            occurred_at: new Date().toISOString(),
          });
        } else if (!canc) {
          return Response.json(
            { error: "Solicitação de cancelamento não encontrada para esta agência/cliente" },
            { status: 404 }
          );
        }

        operationsMemoryStore.auditEvents.unshift({
          agency_id: agencyId,
          client_id: data.client_id,
          action: "approve_cancellation",
          target_type: "client_cancellation_request",
          target_id: data.cancellation_id,
          payload: { decision: data.decision, approved_by_actor_id: actor.actorId, role: actor.role },
        });

        if (canc) {
          canc.status = newStatus;
          canc.approved_by_actor_id = actor.actorId;
          canc.approved_at = new Date().toISOString();
        }

        return Response.json({
          success: true,
          cancellation_id: data.cancellation_id,
          status: newStatus,
          approved_by_actor_id: actor.actorId,
        });
      }

      case "create_offboarding_inventory": {
        let cancRequest = clientSuccessMemoryStore.cancellationRequests.find(
          (c) => c.id === data.cancellation_request_id && c.agency_id === agencyId
        );

        if (supabase) {
          const { data: cDb } = await supabase
            .from("client_cancellation_requests")
            .select("id")
            .eq("agency_id", agencyId)
            .eq("id", data.cancellation_request_id)
            .maybeSingle();

          if (!cDb && !cancRequest) {
            return Response.json(
              { error: "Solicitação de cancelamento não encontrada para esta agência" },
              { status: 400 }
            );
          }
        } else if (!cancRequest) {
          return Response.json(
            { error: "Solicitação de cancelamento não encontrada para esta agência" },
            { status: 400 }
          );
        }

        const invId = crypto.randomUUID();
        const inventory: OffboardingInventory = {
          id: invId,
          agency_id: agencyId,
          cancellation_request_id: data.cancellation_request_id,
          client_id: data.client_id,
          access_items: data.access_items,
          offboarding_work_item_ids: [],
          data_export_status: "not_requested",
          retention_policy_note: data.retention_policy_note,
          final_client_status: "offboarding_in_progress",
          created_at: new Date().toISOString(),
        };

        if (supabase) {
          const { error: dbErr } = await supabase.from("client_offboarding_inventories").insert({
            id: inventory.id,
            agency_id: agencyId,
            cancellation_request_id: data.cancellation_request_id,
            client_id: data.client_id,
            access_items: inventory.access_items,
            offboarding_work_item_ids: inventory.offboarding_work_item_ids,
            data_export_status: inventory.data_export_status,
            retention_policy_note: inventory.retention_policy_note,
            final_client_status: inventory.final_client_status,
            created_at: inventory.created_at,
          });

          if (dbErr) {
            return Response.json({ error: `Erro ao salvar inventário de offboarding: ${dbErr.message}` }, { status: 500 });
          }
        }
        clientSuccessMemoryStore.offboardingInventories.unshift(inventory);

        return Response.json({ success: true, inventory });
      }

      case "create_offboarding_task": {
        let invItem = clientSuccessMemoryStore.offboardingInventories.find(
          (i) => i.id === data.inventory_id && i.agency_id === agencyId
        );

        if (supabase) {
          const { data: iDb } = await supabase
            .from("client_offboarding_inventories")
            .select("id, offboarding_work_item_ids")
            .eq("agency_id", agencyId)
            .eq("id", data.inventory_id)
            .maybeSingle();

          if (!iDb && !invItem) {
            return Response.json(
              { error: "Inventário de offboarding não encontrado para esta agência" },
              { status: 400 }
            );
          }
        } else if (!invItem) {
          return Response.json(
            { error: "Inventário de offboarding não encontrado para esta agência" },
            { status: 400 }
          );
        }

        const workflowId = await resolveOrCreateWorkflow(agencyId, data.client_id, supabase);

        const offWorkItemId = crypto.randomUUID();
        const workItem = {
          id: offWorkItemId,
          agency_id: agencyId,
          client_id: data.client_id,
          workflow_id: workflowId,
          title: `[Offboarding CS] ${data.title}`,
          description: data.description || "Tarefa operacional de offboarding e revogação interna de acessos.",
          status: "todo",
          priority: "high",
          assigned_actor_id: data.assignee_id,
          due_date: data.due_date || new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
          created_at: new Date().toISOString(),
        };

        if (supabase) {
          const { error: insErr } = await supabase.from("work_items").insert({
            id: offWorkItemId,
            agency_id: agencyId,
            client_id: data.client_id,
            workflow_id: workflowId,
            title: workItem.title,
            description: workItem.description,
            status: workItem.status,
            priority: workItem.priority,
            assigned_actor_id: workItem.assigned_actor_id,
            due_date: workItem.due_date,
            created_at: workItem.created_at,
          });

          if (insErr) {
            return Response.json({ error: `Erro ao criar tarefa de offboarding: ${insErr.message}` }, { status: 500 });
          }

          const { data: currentInv } = await supabase
            .from("client_offboarding_inventories")
            .select("offboarding_work_item_ids")
            .eq("agency_id", agencyId)
            .eq("id", data.inventory_id)
            .single();

          const currentIds = (currentInv?.offboarding_work_item_ids as string[]) || [];
          const { error: updErr } = await supabase
            .from("client_offboarding_inventories")
            .update({ offboarding_work_item_ids: [...currentIds, offWorkItemId] })
            .eq("agency_id", agencyId)
            .eq("id", data.inventory_id);

          if (updErr) {
            return Response.json({ error: `Erro ao vincular tarefa no inventário de offboarding: ${updErr.message}` }, { status: 500 });
          }
        }

        operationsMemoryStore.workItems.unshift(workItem as unknown as (typeof operationsMemoryStore.workItems)[0]);

        const inventory = clientSuccessMemoryStore.offboardingInventories.find((i) => i.id === data.inventory_id);
        if (inventory) {
          inventory.offboarding_work_item_ids.push(offWorkItemId);
        }

        return Response.json({ success: true, work_item: workItem, inventory_id: data.inventory_id });
      }

      default:
        return Response.json({ error: "Ação não suportada" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno ao processar requisição";
    return Response.json({ error: message }, { status: 500 });
  }
}
