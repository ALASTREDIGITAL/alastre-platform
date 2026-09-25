import { resolveAuthenticatedActor } from "../../../lib/server-auth.ts";
import { hasModulePermission } from "../../../lib/permissions.ts";
import {
  OperationsApiActionSchema,
  type OperationsApiAction,
} from "../../../lib/operations-api.ts";
import {
  buildWorkflowFromTemplate,
  categorizeOperationalQueues,
  calculateCapacityMetrics,
  evaluateDependencies,
  validateWorkItemCompletion,
  isValidWorkItemTransition,
  type Workflow,
  type WorkItem,
  type WorkflowTemplate,
  type WorkItemTimeLog,
  type OperationalException,
} from "../../../lib/operations-domain.ts";
import { createSupabaseAdmin } from "../../../lib/connection-hub/supabase-admin.ts";

/**
 * Armazenamento em memória para testes offline e desenvolvimento local.
 * Em produção, qualquer tentativa de cair em memória é terminantemente bloqueada (503).
 */
export const operationsMemoryStore = {
  templates: [] as WorkflowTemplate[],
  workflows: [] as Workflow[],
  workItems: [] as WorkItem[],
  timeLogs: [] as WorkItemTimeLog[],
  exceptions: [] as OperationalException[],
  auditEvents: [] as Array<{
    agency_id: string;
    client_id?: string | null;
    action: string;
    target_type: string;
    target_id: string;
    payload: Record<string, unknown>;
  }>,
  clear() {
    this.templates = [];
    this.workflows = [];
    this.workItems = [];
    this.timeLogs = [];
    this.exceptions = [];
    this.auditEvents = [];
  },
};

// Seed de Templates Canônicos para desenvolvimento/testes
const DEFAULT_CANONICAL_TEMPLATES: Array<Omit<WorkflowTemplate, "agency_id">> = [
  {
    id: "a0000000-0000-0000-0000-000000000001",
    product_definition_id: null,
    name: "Implantação Inicial de SEO Local",
    slug: "implantacao-seo-local",
    version: 1,
    category: "local_seo",
    description: "Setup completo de perfil Google Meu Negócio, auditoria NAP e plano de palavras-chave.",
    trigger_type: "onboarding_activated",
    target_service: "local_seo",
    is_active: true,
    estimated_total_minutes: 360,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    definition: [
      {
        id: "task-01",
        title: "Conferência de Acesso ao Perfil Google",
        description: "Validar conexão no Connection Hub e permissões de gerenciamento.",
        task_type: "manual",
        frequency: "one_off",
        estimated_minutes: 30,
        sla_hours: 24,
        requires_approval: false,
        evidence_required: true,
        acceptance_criteria: "Conexão ativa confirmada sem erros de escopo.",
        order_index: 0,
      },
      {
        id: "task-02",
        title: "Auditoria Completa de Dados NAP e Categorias",
        description: "Revisar nome, endereço, telefone, categoria primária e secundárias.",
        task_type: "manual",
        frequency: "one_off",
        estimated_minutes: 60,
        sla_hours: 48,
        requires_approval: false,
        evidence_required: true,
        acceptance_criteria: "Checklist de 18 pontos preenchido.",
        order_index: 1,
        depends_on_task_ids: ["task-01"],
      },
      {
        id: "task-03",
        title: "Otimização de Horários, Descrição e Serviços",
        description: "Inserir termos prioritários do DNA e catálogo de serviços na ficha.",
        task_type: "hybrid",
        frequency: "one_off",
        estimated_minutes: 90,
        sla_hours: 48,
        requires_approval: true,
        evidence_required: true,
        acceptance_criteria: "Descrição aprovada e publicada no rascunho de homologação.",
        order_index: 2,
        depends_on_task_ids: ["task-02"],
      },
      {
        id: "task-04",
        title: "Publicação do Primeiro Post e Lote de Fotos Reais",
        description: "Submeter post de abertura com CTA verificado e upload de fotos da fachada.",
        task_type: "manual",
        frequency: "one_off",
        estimated_minutes: 60,
        sla_hours: 72,
        requires_approval: true,
        evidence_required: true,
        acceptance_criteria: "Fotos e texto validados sem infração de diretrizes.",
        order_index: 3,
        depends_on_task_ids: ["task-03"],
      },
    ],
  },
  {
    id: "a0000000-0000-0000-0000-000000000002",
    product_definition_id: null,
    name: "Recorrência Mensal — SEO Local & Reputação",
    slug: "recorrencia-seo-local",
    version: 1,
    category: "local_seo",
    description: "Ciclo mensal de postagens, monitoramento de avaliações e verificação de posicionamento.",
    trigger_type: "recurring_schedule",
    target_service: "local_seo",
    is_active: true,
    estimated_total_minutes: 240,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    definition: [
      {
        id: "rec-01",
        title: "Monitoramento e Elaboração de Respostas a Avaliações",
        description: "Análise de sentimento das novas avaliações e rascunhos de resposta com tom do DNA.",
        task_type: "hybrid",
        frequency: "weekly",
        estimated_minutes: 60,
        sla_hours: 24,
        requires_approval: true,
        evidence_required: true,
        acceptance_criteria: "100% das novas avaliações com resposta proposta.",
        order_index: 0,
      },
      {
        id: "rec-02",
        title: "Planejamento e Agendamento de Postagens Mensais",
        description: "Criação de 4 posts locais com temas sazonais e CTAs direcionados.",
        task_type: "hybrid",
        frequency: "monthly",
        estimated_minutes: 120,
        sla_hours: 48,
        requires_approval: true,
        evidence_required: true,
        acceptance_criteria: "4 postagens aprovadas na Central de Aprovações.",
        order_index: 1,
      },
      {
        id: "rec-03",
        title: "Medição de Rank Tracker Local e Oportunidades",
        description: "Auditoria de ranking geográfico e identificação de lacunas de concorrentes.",
        task_type: "manual",
        frequency: "monthly",
        estimated_minutes: 60,
        sla_hours: 72,
        requires_approval: false,
        evidence_required: false,
        acceptance_criteria: "Relatório de posicionamento atualizado.",
        order_index: 2,
      },
    ],
  },
];

export async function POST(req: Request) {
  try {
    const admin = createSupabaseAdmin();
    const isProduction = process.env.NODE_ENV === "production";

    // 1. Resolução segura de autenticação
    const authResult = await resolveAuthenticatedActor(req, admin || undefined);
    if (!authResult) {
      if (admin) {
        return Response.json(
          { error: "Acesso não autorizado ou sessão expirada." },
          { status: 403 }
        );
      }
      if (isProduction) {
        return Response.json(
          { error: "Banco de dados indisponível em produção." },
          { status: 503 }
        );
      }
    }

    const actor = authResult?.actor ?? {
      actorId: "test-actor-id",
      agencyId: "00000000-0000-0000-0000-000000000001",
      role: "owner" as const,
    };
    const actorEmail = authResult?.email ?? "operador@alastre.com";

    const agencyId = actor.agencyId;

    // 2. Validação do Payload com Zod
    const body = await req.json().catch(() => null);
    const parsed = OperationsApiActionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Payload de requisição inválido.",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const payload: OperationsApiAction = parsed.data;

    if (!admin && isProduction) {
      return Response.json(
        { error: "Armazenamento em memória não é permitido em ambiente de produção." },
        { status: 503 }
      );
    }

    // 3. Roteamento de Ações
    switch (payload.action) {
      // -----------------------------------------------------------------------
      // LIST_WORKSPACE
      // -----------------------------------------------------------------------
      case "list_workspace": {
        if (!hasModulePermission(actor.role, "operations", "view")) {
          return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
        }

        if (admin) {
          // Busca em banco de dados
          let wfQuery = admin
            .from("workflows")
            .select("*")
            .eq("agency_id", agencyId)
            .order("created_at", { ascending: false });

          if (payload.client_id) {
            wfQuery = wfQuery.eq("client_id", payload.client_id);
          }
          if (payload.workflow_id) {
            wfQuery = wfQuery.eq("id", payload.workflow_id);
          }

          let itemsQuery = admin
            .from("work_items")
            .select("*")
            .eq("agency_id", agencyId)
            .order("order_index", { ascending: true });

          if (payload.client_id) {
            itemsQuery = itemsQuery.eq("client_id", payload.client_id);
          }
          if (payload.workflow_id) {
            itemsQuery = itemsQuery.eq("workflow_id", payload.workflow_id);
          }
          if (payload.assigned_actor_id) {
            itemsQuery = itemsQuery.eq("assigned_actor_id", payload.assigned_actor_id);
          }

          const templatesQuery = admin
            .from("workflow_templates")
            .select("*")
            .eq("agency_id", agencyId)
            .eq("is_active", true)
            .order("name", { ascending: true });

          const exceptionsQuery = admin
            .from("operational_exceptions")
            .select("*")
            .eq("agency_id", agencyId)
            .eq("status", "open")
            .order("created_at", { ascending: false });

          const [wfRes, itemsRes, tplRes, excRes] = await Promise.all([
            wfQuery,
            itemsQuery,
            templatesQuery,
            exceptionsQuery,
          ]);

          const workflows: Workflow[] = (wfRes.data as Workflow[]) || [];
          const workItems: WorkItem[] = (itemsRes.data as WorkItem[]) || [];
          const templates: WorkflowTemplate[] = (tplRes.data as WorkflowTemplate[]) || [];
          const exceptions: OperationalException[] = (excRes.data as OperationalException[]) || [];

          const queues = categorizeOperationalQueues(workItems);
          const capacity = calculateCapacityMetrics(workItems);

          return Response.json({
            success: true,
            workflows,
            workItems,
            templates,
            exceptions,
            queues,
            capacity,
          });
        }

        // Fallback em memória para ambiente de testes / dev
        const filteredWf = operationsMemoryStore.workflows.filter(
          (w) =>
            w.agency_id === agencyId &&
            (!payload.client_id || w.client_id === payload.client_id) &&
            (!payload.workflow_id || w.id === payload.workflow_id)
        );

        const filteredItems = operationsMemoryStore.workItems.filter(
          (i) =>
            i.agency_id === agencyId &&
            (!payload.client_id || i.client_id === payload.client_id) &&
            (!payload.workflow_id || i.workflow_id === payload.workflow_id) &&
            (!payload.assigned_actor_id || i.assigned_actor_id === payload.assigned_actor_id)
        );

        const availableTemplates = operationsMemoryStore.templates.length > 0
          ? operationsMemoryStore.templates.filter((t) => t.agency_id === agencyId)
          : DEFAULT_CANONICAL_TEMPLATES.map((t) => ({ ...t, agency_id: agencyId }));

        const filteredExceptions = operationsMemoryStore.exceptions.filter(
          (e) => e.agency_id === agencyId && e.status === "open"
        );

        const queues = categorizeOperationalQueues(filteredItems);
        const capacity = calculateCapacityMetrics(filteredItems);

        return Response.json({
          success: true,
          workflows: filteredWf,
          workItems: filteredItems,
          templates: availableTemplates,
          exceptions: filteredExceptions,
          queues,
          capacity,
        });
      }

      // -----------------------------------------------------------------------
      // CREATE_WORKFLOW
      // -----------------------------------------------------------------------
      case "create_workflow": {
        if (!hasModulePermission(actor.role, "operations", "create")) {
          return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
        }

        let template: WorkflowTemplate | null = null;
        if (payload.template_id) {
          if (admin) {
            const { data } = await admin
              .from("workflow_templates")
              .select("*")
              .eq("id", payload.template_id)
              .eq("agency_id", agencyId)
              .single();
            template = (data as WorkflowTemplate) || null;
          } else {
            template =
              operationsMemoryStore.templates.find(
                (t) => t.id === payload.template_id && t.agency_id === agencyId
              ) ||
              DEFAULT_CANONICAL_TEMPLATES.find((t) => t.id === payload.template_id)
                ? ({
                    ...DEFAULT_CANONICAL_TEMPLATES.find((t) => t.id === payload.template_id)!,
                    agency_id: agencyId,
                  } as WorkflowTemplate)
                : null;
          }
        }

        const now = new Date().toISOString();
        const workflowId = crypto.randomUUID();

        let newWorkflow: Workflow;
        let initialItems: WorkItem[] = [];

        if (template) {
          const built = buildWorkflowFromTemplate(
            template,
            { id: payload.client_id, agency_id: agencyId, name: payload.title },
            {
              unit_id: payload.unit_id,
              service_id: payload.service_id,
              workflow_type: payload.workflow_type,
              priority: payload.priority,
              target_start_date: payload.target_start_date,
              target_due_date: payload.target_due_date,
              assigned_actor_id: payload.assigned_actor_id,
            }
          );
          newWorkflow = {
            ...built.workflow,
            id: workflowId,
            title: payload.title,
            created_at: now,
            updated_at: now,
          };
          initialItems = built.items.map((it) => ({
            ...it,
            id: crypto.randomUUID(),
            workflow_id: workflowId,
            created_at: now,
            updated_at: now,
          }));
        } else {
          newWorkflow = {
            id: workflowId,
            agency_id: agencyId,
            client_id: payload.client_id,
            unit_id: payload.unit_id || null,
            service_id: payload.service_id || null,
            template_id: null,
            title: payload.title,
            workflow_type: payload.workflow_type,
            status: "pending",
            priority: payload.priority,
            progress_percentage: 0,
            total_estimated_minutes: 0,
            total_actual_minutes: 0,
            blocked_reason: null,
            target_start_date: payload.target_start_date || now.slice(0, 10),
            target_due_date: payload.target_due_date || null,
            started_at: null,
            completed_at: null,
            assigned_actor_id: payload.assigned_actor_id || null,
            metadata: payload.metadata || {},
            created_at: now,
            updated_at: now,
          };
        }

        if (admin) {
          const { error: wfErr } = await admin.from("workflows").insert(newWorkflow);
          if (wfErr) {
            return Response.json({ error: wfErr.message }, { status: 500 });
          }

          if (initialItems.length > 0) {
            const { error: itErr } = await admin.from("work_items").insert(initialItems);
            if (itErr) {
              return Response.json({ error: itErr.message }, { status: 500 });
            }
          }

          await admin.from("audit_events").insert({
            agency_id: agencyId,
            client_id: payload.client_id,
            action: "operations_workflow_created",
            target_type: "workflow",
            target_id: workflowId,
            payload: { title: payload.title, type: payload.workflow_type },
          });
        } else {
          operationsMemoryStore.workflows.push(newWorkflow);
          operationsMemoryStore.workItems.push(...initialItems);
          operationsMemoryStore.auditEvents.push({
            agency_id: agencyId,
            client_id: payload.client_id,
            action: "operations_workflow_created",
            target_type: "workflow",
            target_id: workflowId,
            payload: { title: payload.title, type: payload.workflow_type },
          });
        }

        return Response.json(
          {
            success: true,
            workflow: newWorkflow,
            createdItemsCount: initialItems.length,
          },
          { status: 201 }
        );
      }

      // -----------------------------------------------------------------------
      // CREATE_WORK_ITEM
      // -----------------------------------------------------------------------
      case "create_work_item": {
        if (!hasModulePermission(actor.role, "operations", "create")) {
          return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
        }

        const now = new Date().toISOString();
        const itemId = crypto.randomUUID();

        const newItem: WorkItem = {
          id: itemId,
          agency_id: agencyId,
          client_id: payload.client_id,
          workflow_id: payload.workflow_id,
          unit_id: payload.unit_id || null,
          title: payload.title,
          description: payload.description,
          task_type: payload.task_type,
          frequency: payload.frequency,
          status: "todo",
          priority: payload.priority,
          estimated_minutes: payload.estimated_minutes,
          actual_minutes: 0,
          due_date: payload.due_date || null,
          sla_hours: payload.sla_hours,
          sla_status: "on_track",
          depends_on_item_ids: payload.depends_on_item_ids,
          assigned_actor_id: payload.assigned_actor_id || null,
          assigned_actor_name: payload.assigned_actor_name || null,
          requires_approval: payload.requires_approval,
          approval_item_id: null,
          evidence_required: payload.evidence_required,
          evidence_text: null,
          evidence_url: null,
          acceptance_criteria: payload.acceptance_criteria,
          sop_reference: payload.sop_reference || null,
          blocked_reason: null,
          client_action_required: null,
          completed_at: null,
          completed_by_actor_id: null,
          order_index: 99,
          created_at: now,
          updated_at: now,
        };

        if (admin) {
          const { error: insErr } = await admin.from("work_items").insert(newItem);
          if (insErr) {
            return Response.json({ error: insErr.message }, { status: 500 });
          }

          // Atualiza total_estimated_minutes do workflow
          const { data: currentWf } = await admin
            .from("workflows")
            .select("total_estimated_minutes")
            .eq("id", payload.workflow_id)
            .single();
          if (currentWf) {
            await admin
              .from("workflows")
              .update({
                total_estimated_minutes: (currentWf.total_estimated_minutes || 0) + payload.estimated_minutes,
                updated_at: new Date().toISOString(),
              })
              .eq("id", payload.workflow_id);
          }

          await admin.from("audit_events").insert({
            agency_id: agencyId,
            client_id: payload.client_id,
            action: "operations_work_item_created",
            target_type: "work_item",
            target_id: itemId,
            payload: { title: payload.title, workflow_id: payload.workflow_id },
          });
        } else {
          operationsMemoryStore.workItems.push(newItem);
          const wf = operationsMemoryStore.workflows.find((w) => w.id === payload.workflow_id);
          if (wf) {
            wf.total_estimated_minutes += payload.estimated_minutes;
            wf.updated_at = now;
          }
        }

        return Response.json({ success: true, item: newItem }, { status: 201 });
      }

      // -----------------------------------------------------------------------
      // START_TASK
      // -----------------------------------------------------------------------
      case "start_task": {
        if (!hasModulePermission(actor.role, "operations", "edit")) {
          return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
        }

        if (admin) {
          // Executa RPC transacional no PostgreSQL
          const { data, error } = await admin.rpc("operation_start_task", {
            p_agency_id: agencyId,
            p_work_item_id: payload.work_item_id,
            p_actor_id: actorEmail,
          });

          if (error) {
            if (error.code === "P0002") {
              return Response.json({ error: "Tarefa não encontrada." }, { status: 404 });
            }
            if (error.message.includes("dependencies_not_satisfied")) {
              return Response.json(
                {
                  error: "A tarefa possui dependências que ainda não foram concluídas.",
                  code: "dependencies_not_satisfied",
                },
                { status: 409 }
              );
            }
            return Response.json({ error: error.message }, { status: 400 });
          }

          return Response.json({ success: true, result: data });
        }

        // Validação em memória
        const item = operationsMemoryStore.workItems.find(
          (i) => i.id === payload.work_item_id && i.agency_id === agencyId
        );
        if (!item) {
          return Response.json({ error: "Tarefa não encontrada." }, { status: 404 });
        }

        const relatedItems = operationsMemoryStore.workItems.filter(
          (i) => i.workflow_id === item.workflow_id && i.agency_id === agencyId
        );

        const depCheck = evaluateDependencies(item, relatedItems);
        if (!depCheck.allowed) {
          item.status = "blocked_by_dependency";
          item.blocked_reason = `Dependências pendentes: ${depCheck.blockingTitles.join(", ")}`;
          item.updated_at = new Date().toISOString();
          return Response.json(
            {
              error: "A tarefa possui dependências que ainda não foram concluídas.",
              blockingDependencies: depCheck.blockingDependencies,
              blockingTitles: depCheck.blockingTitles,
            },
            { status: 409 }
          );
        }

        if (!isValidWorkItemTransition(item.status, "in_progress")) {
          return Response.json(
            { error: `Transição inválida de ${item.status} para in_progress.` },
            { status: 400 }
          );
        }

        item.status = "in_progress";
        item.blocked_reason = null;
        item.updated_at = new Date().toISOString();

        const parentWf = operationsMemoryStore.workflows.find((w) => w.id === item.workflow_id);
        if (parentWf && parentWf.status === "pending") {
          parentWf.status = "in_progress";
          parentWf.started_at = parentWf.started_at || new Date().toISOString();
          parentWf.updated_at = new Date().toISOString();
        }

        return Response.json({ success: true, item });
      }

      // -----------------------------------------------------------------------
      // COMPLETE_TASK
      // -----------------------------------------------------------------------
      case "complete_task": {
        if (!hasModulePermission(actor.role, "operations", "edit")) {
          return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
        }

        if (admin) {
          const { data, error } = await admin.rpc("operation_complete_task", {
            p_agency_id: agencyId,
            p_work_item_id: payload.work_item_id,
            p_actor_id: actorEmail,
            p_evidence_text: payload.evidence_text || null,
            p_evidence_url: payload.evidence_url || null,
          });

          if (error) {
            if (error.code === "P0002") {
              return Response.json({ error: "Tarefa não encontrada." }, { status: 404 });
            }
            if (error.message.includes("evidence_required_for_completion")) {
              return Response.json(
                {
                  error: "Esta tarefa exige comprovação documental ou link de evidência.",
                  code: "evidence_required",
                },
                { status: 400 }
              );
            }
            return Response.json({ error: error.message }, { status: 400 });
          }

          return Response.json({ success: true, result: data });
        }

        // Validação em memória
        const item = operationsMemoryStore.workItems.find(
          (i) => i.id === payload.work_item_id && i.agency_id === agencyId
        );
        if (!item) {
          return Response.json({ error: "Tarefa não encontrada." }, { status: 404 });
        }

        const compCheck = validateWorkItemCompletion(item, {
          evidence_text: payload.evidence_text,
          evidence_url: payload.evidence_url,
        });

        if (!compCheck.valid) {
          return Response.json({ error: compCheck.error }, { status: 400 });
        }

        const now = new Date().toISOString();

        // Se requer aprovação humana, avança para in_review
        if (compCheck.requiresApproval) {
          item.status = "in_review";
          item.evidence_text = payload.evidence_text || item.evidence_text;
          item.evidence_url = payload.evidence_url || item.evidence_url;
          item.updated_at = now;
          return Response.json({
            success: true,
            status: "in_review",
            message: "Tarefa submetida para aprovação humana da liderança.",
            item,
          });
        }

        // Se não requer aprovação, conclui diretamente
        item.status = "completed";
        item.completed_at = now;
        item.completed_by_actor_id = actorEmail;
        item.evidence_text = payload.evidence_text || item.evidence_text;
        item.evidence_url = payload.evidence_url || item.evidence_url;
        item.updated_at = now;

        // Recalcula progresso do workflow pai
        const siblings = operationsMemoryStore.workItems.filter(
          (i) => i.workflow_id === item.workflow_id && i.agency_id === agencyId
        );
        const completedCount = siblings.filter((i) => i.status === "completed").length;
        const newProgress = Math.round((completedCount / siblings.length) * 100);

        const parentWf = operationsMemoryStore.workflows.find((w) => w.id === item.workflow_id);
        if (parentWf) {
          parentWf.progress_percentage = newProgress;
          if (completedCount === siblings.length) {
            parentWf.status = "completed";
            parentWf.completed_at = now;
          }
          parentWf.updated_at = now;
        }

        return Response.json({
          success: true,
          status: "completed",
          progress_percentage: newProgress,
          item,
        });
      }

      // -----------------------------------------------------------------------
      // BLOCK_TASK
      // -----------------------------------------------------------------------
      case "block_task": {
        if (!hasModulePermission(actor.role, "operations", "edit")) {
          return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
        }

        const targetStatus =
          payload.block_type === "client_action"
            ? "blocked_by_client"
            : "blocked_by_dependency";

        if (admin) {
          const { data, error } = await admin
            .from("work_items")
            .update({
              status: targetStatus,
              blocked_reason: payload.blocked_reason,
              client_action_required: payload.client_action_required || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payload.work_item_id)
            .eq("agency_id", agencyId)
            .select();

          if (error || !data || data.length === 0) {
            return Response.json({ error: "Tarefa não encontrada ou não modificada." }, { status: 404 });
          }

          return Response.json({ success: true, item: data[0] });
        }

        const item = operationsMemoryStore.workItems.find(
          (i) => i.id === payload.work_item_id && i.agency_id === agencyId
        );
        if (!item) {
          return Response.json({ error: "Tarefa não encontrada." }, { status: 404 });
        }

        item.status = targetStatus;
        item.blocked_reason = payload.blocked_reason;
        item.client_action_required = payload.client_action_required || null;
        item.updated_at = new Date().toISOString();

        return Response.json({ success: true, item });
      }

      // -----------------------------------------------------------------------
      // UNBLOCK_TASK
      // -----------------------------------------------------------------------
      case "unblock_task": {
        if (!hasModulePermission(actor.role, "operations", "edit")) {
          return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
        }

        if (admin) {
          const { data, error } = await admin
            .from("work_items")
            .update({
              status: "todo",
              blocked_reason: null,
              client_action_required: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payload.work_item_id)
            .eq("agency_id", agencyId)
            .select();

          if (error || !data || data.length === 0) {
            return Response.json({ error: "Tarefa não encontrada." }, { status: 404 });
          }

          return Response.json({ success: true, item: data[0] });
        }

        const item = operationsMemoryStore.workItems.find(
          (i) => i.id === payload.work_item_id && i.agency_id === agencyId
        );
        if (!item) {
          return Response.json({ error: "Tarefa não encontrada." }, { status: 404 });
        }

        item.status = "todo";
        item.blocked_reason = null;
        item.client_action_required = null;
        item.updated_at = new Date().toISOString();

        return Response.json({ success: true, item });
      }

      // -----------------------------------------------------------------------
      // LOG_TIME
      // -----------------------------------------------------------------------
      case "log_time": {
        if (!hasModulePermission(actor.role, "operations", "edit")) {
          return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
        }

        if (admin) {
          const { data, error } = await admin.rpc("operation_log_time", {
            p_agency_id: agencyId,
            p_client_id: payload.client_id,
            p_work_item_id: payload.work_item_id,
            p_actor_id: actorEmail,
            p_actor_name: actorEmail.split("@")[0],
            p_minutes: payload.minutes_spent,
            p_notes: payload.notes,
          });

          if (error) {
            if (error.code === "P0002") {
              return Response.json({ error: "Tarefa não encontrada." }, { status: 404 });
            }
            return Response.json({ error: error.message }, { status: 400 });
          }

          return Response.json({ success: true, result: data });
        }

        const item = operationsMemoryStore.workItems.find(
          (i) => i.id === payload.work_item_id && i.agency_id === agencyId
        );
        if (!item) {
          return Response.json({ error: "Tarefa não encontrada." }, { status: 404 });
        }

        const now = new Date().toISOString();
        const timeLog: WorkItemTimeLog = {
          id: crypto.randomUUID(),
          agency_id: agencyId,
          client_id: payload.client_id,
          work_item_id: payload.work_item_id,
          actor_id: actorEmail,
          actor_name: actorEmail.split("@")[0],
          minutes_spent: payload.minutes_spent,
          notes: payload.notes,
          logged_at: now,
          created_at: now,
        };

        operationsMemoryStore.timeLogs.push(timeLog);
        item.actual_minutes += payload.minutes_spent;
        item.updated_at = now;

        const parentWf = operationsMemoryStore.workflows.find((w) => w.id === item.workflow_id);
        if (parentWf) {
          parentWf.total_actual_minutes += payload.minutes_spent;
          parentWf.updated_at = now;
        }

        return Response.json({
          success: true,
          timeLog,
          totalActualMinutes: item.actual_minutes,
        });
      }

      // -----------------------------------------------------------------------
      // SAVE_TEMPLATE
      // -----------------------------------------------------------------------
      case "save_template": {
        if (!["owner", "admin", "operations_lead"].includes(actor.role)) {
          return Response.json(
            { error: "Apenas administradores e liderança operacional podem gerenciar templates." },
            { status: 403 }
          );
        }

        const now = new Date().toISOString();
        const templateId = crypto.randomUUID();

        const template: WorkflowTemplate = {
          id: templateId,
          agency_id: agencyId,
          name: payload.name,
          slug: payload.slug,
          version: payload.version,
          category: payload.category,
          description: payload.description,
          trigger_type: payload.trigger_type,
          target_service: payload.target_service || null,
          is_active: true,
          estimated_total_minutes: payload.estimated_total_minutes,
          definition: payload.definition,
          created_at: now,
          updated_at: now,
        };

        if (admin) {
          const { error } = await admin.from("workflow_templates").upsert(template);
          if (error) {
            return Response.json({ error: error.message }, { status: 500 });
          }
        } else {
          operationsMemoryStore.templates.push(template);
        }

        return Response.json({ success: true, template }, { status: 201 });
      }

      // -----------------------------------------------------------------------
      // REPORT_EXCEPTION
      // -----------------------------------------------------------------------
      case "report_exception": {
        const now = new Date().toISOString();
        const exceptionId = crypto.randomUUID();

        const exception: OperationalException = {
          id: exceptionId,
          agency_id: agencyId,
          client_id: payload.client_id,
          workflow_id: payload.workflow_id || null,
          work_item_id: payload.work_item_id || null,
          severity: payload.severity,
          status: "open",
          category: payload.category,
          description: payload.description,
          resolution_notes: null,
          reported_by_actor_id: actorEmail,
          resolved_by_actor_id: null,
          resolved_at: null,
          created_at: now,
          updated_at: now,
        };

        if (admin) {
          const { error } = await admin.from("operational_exceptions").insert(exception);
          if (error) {
            return Response.json({ error: error.message }, { status: 500 });
          }
        } else {
          operationsMemoryStore.exceptions.push(exception);
        }

        return Response.json({ success: true, exception }, { status: 201 });
      }

      // -----------------------------------------------------------------------
      // RESOLVE_EXCEPTION
      // -----------------------------------------------------------------------
      case "resolve_exception": {
        if (!["owner", "admin", "operations_lead"].includes(actor.role)) {
          return Response.json({ error: "Permissão insuficiente." }, { status: 403 });
        }

        const now = new Date().toISOString();

        if (admin) {
          const { data, error } = await admin
            .from("operational_exceptions")
            .update({
              status: "resolved",
              resolution_notes: payload.resolution_notes,
              resolved_by_actor_id: actorEmail,
              resolved_at: now,
              updated_at: now,
            })
            .eq("id", payload.exception_id)
            .eq("agency_id", agencyId)
            .select();

          if (error || !data || data.length === 0) {
            return Response.json({ error: "Exceção não encontrada." }, { status: 404 });
          }

          return Response.json({ success: true, exception: data[0] });
        }

        const exc = operationsMemoryStore.exceptions.find(
          (e) => e.id === payload.exception_id && e.agency_id === agencyId
        );
        if (!exc) {
          return Response.json({ error: "Exceção não encontrada." }, { status: 404 });
        }

        exc.status = "resolved";
        exc.resolution_notes = payload.resolution_notes;
        exc.resolved_by_actor_id = actorEmail;
        exc.resolved_at = now;
        exc.updated_at = now;

        return Response.json({ success: true, exception: exc });
      }

      default:
        return Response.json({ error: "Ação não suportada." }, { status: 400 });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Erro interno no servidor.";
    return Response.json({ error: errorMsg }, { status: 500 });
  }
}
