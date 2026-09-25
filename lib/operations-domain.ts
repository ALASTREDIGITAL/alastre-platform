/**
 * Módulo 04: Motor de Operações (Operations Engine Domain)
 * Regras de negócio, transições de estado, dependências, apontamento de tempo e filas operacionais.
 * Isolamento rigoroso por agency_id e client_id.
 */

export type WorkflowTemplateCategory =
  | "local_seo"
  | "google_ads"
  | "meta_ads"
  | "tracking"
  | "onboarding"
  | "general";

export type WorkflowTriggerType =
  | "manual"
  | "onboarding_activated"
  | "recurring_schedule"
  | "event_triggered";

export interface WorkflowTemplateTask {
  id: string;
  title: string;
  description: string;
  task_type: "manual" | "automated" | "hybrid" | "approval";
  frequency: "one_off" | "daily" | "weekly" | "biweekly" | "monthly" | "quarterly";
  estimated_minutes: number;
  sla_hours: number;
  requires_approval: boolean;
  evidence_required: boolean;
  acceptance_criteria: string;
  order_index: number;
  depends_on_task_ids?: string[];
  sop_reference?: string;
}

export interface WorkflowTemplate {
  id: string;
  agency_id: string;
  product_definition_id?: string | null;
  name: string;
  slug: string;
  version: number;
  category: WorkflowTemplateCategory;
  description: string;
  trigger_type: WorkflowTriggerType;
  target_service?: string | null;
  is_active: boolean;
  estimated_total_minutes: number;
  definition: WorkflowTemplateTask[];
  created_at: string;
  updated_at: string;
}

export type WorkflowType =
  | "implementation"
  | "recurring_monthly"
  | "recurring_weekly"
  | "one_off"
  | "exception";

export type WorkflowStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "in_review"
  | "completed"
  | "cancelled";

export type WorkflowPriority = "low" | "medium" | "high" | "urgent";

export interface Workflow {
  id: string;
  agency_id: string;
  client_id: string;
  unit_id?: string | null;
  service_id?: string | null;
  template_id?: string | null;
  title: string;
  workflow_type: WorkflowType;
  status: WorkflowStatus;
  priority: WorkflowPriority;
  progress_percentage: number;
  total_estimated_minutes: number;
  total_actual_minutes: number;
  blocked_reason?: string | null;
  target_start_date?: string | null;
  target_due_date?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  assigned_actor_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type TaskType = "manual" | "automated" | "hybrid" | "approval";

export type TaskFrequency =
  | "one_off"
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly";

export type WorkItemStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "blocked_by_dependency"
  | "blocked_by_client"
  | "in_review"
  | "completed"
  | "cancelled";

export type WorkItemPriority = "low" | "medium" | "high" | "urgent";

export type SlaStatus = "on_track" | "warning" | "breached";

export interface WorkItem {
  id: string;
  agency_id: string;
  client_id: string;
  workflow_id: string;
  unit_id?: string | null;
  title: string;
  description: string;
  task_type: TaskType;
  frequency: TaskFrequency;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  estimated_minutes: number;
  actual_minutes: number;
  due_date?: string | null;
  sla_hours: number;
  sla_status: SlaStatus;
  depends_on_item_ids: string[];
  assigned_actor_id?: string | null;
  assigned_actor_name?: string | null;
  requires_approval: boolean;
  approval_item_id?: string | null;
  evidence_required: boolean;
  evidence_text?: string | null;
  evidence_url?: string | null;
  acceptance_criteria: string;
  sop_reference?: string | null;
  blocked_reason?: string | null;
  client_action_required?: string | null;
  completed_at?: string | null;
  completed_by_actor_id?: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface WorkItemTimeLog {
  id: string;
  agency_id: string;
  client_id: string;
  work_item_id: string;
  actor_id: string;
  actor_name: string;
  minutes_spent: number;
  notes: string;
  logged_at: string;
  created_at: string;
}

export type ExceptionSeverity = "low" | "medium" | "high" | "critical";

export type ExceptionCategory =
  | "sla_breach"
  | "client_block"
  | "dependency_cycle"
  | "quality_failure"
  | "system_error";

export interface OperationalException {
  id: string;
  agency_id: string;
  client_id: string;
  workflow_id?: string | null;
  work_item_id?: string | null;
  severity: ExceptionSeverity;
  status: "open" | "acknowledged" | "resolved" | "ignored";
  category: ExceptionCategory;
  description: string;
  resolution_notes?: string | null;
  reported_by_actor_id: string;
  resolved_by_actor_id?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Tabela estrita de transições permitidas para work_items
 */
export const ALLOWED_WORK_ITEM_TRANSITIONS: Record<WorkItemStatus, WorkItemStatus[]> = {
  backlog: ["todo", "cancelled"],
  todo: ["in_progress", "blocked_by_dependency", "blocked_by_client", "cancelled"],
  in_progress: [
    "in_review",
    "completed",
    "blocked_by_client",
    "blocked_by_dependency",
    "todo",
    "cancelled",
  ],
  blocked_by_dependency: ["todo", "in_progress", "cancelled"],
  blocked_by_client: ["in_progress", "todo", "cancelled"],
  in_review: ["completed", "in_progress", "cancelled"],
  completed: [], // Terminal: reabertura só com SoD específico
  cancelled: [], // Terminal
};

/**
 * Validação de transição de status para Work Items
 */
export function isValidWorkItemTransition(
  currentStatus: WorkItemStatus,
  targetStatus: WorkItemStatus
): boolean {
  if (currentStatus === targetStatus) return true;
  const allowed = ALLOWED_WORK_ITEM_TRANSITIONS[currentStatus];
  return Array.isArray(allowed) && allowed.includes(targetStatus);
}

/**
 * Verifica se um Work Item pode ser iniciado com base em suas dependências
 */
export function evaluateDependencies(
  item: Pick<WorkItem, "id" | "depends_on_item_ids">,
  allWorkflowItems: Array<Pick<WorkItem, "id" | "status" | "title">>
): { allowed: boolean; blockingDependencies: string[]; blockingTitles: string[] } {
  const blockingIds: string[] = [];
  const blockingTitles: string[] = [];

  const itemMap = new Map<string, Pick<WorkItem, "id" | "status" | "title">>();
  for (const w of allWorkflowItems) {
    itemMap.set(w.id, w);
  }

  for (const depId of item.depends_on_item_ids || []) {
    const parent = itemMap.get(depId);
    if (!parent || parent.status !== "completed") {
      blockingIds.push(depId);
      blockingTitles.push(parent ? parent.title : `Tarefa ${depId}`);
    }
  }

  return {
    allowed: blockingIds.length === 0,
    blockingDependencies: blockingIds,
    blockingTitles,
  };
}

/**
 * Valida os requisitos para conclusão de um Work Item (evidências e aprovação)
 */
export function validateWorkItemCompletion(
  item: Pick<WorkItem, "evidence_required" | "requires_approval">,
  input: { evidence_text?: string | null; evidence_url?: string | null }
): { valid: boolean; requiresApproval: boolean; error?: string } {
  if (item.evidence_required) {
    const hasText = typeof input.evidence_text === "string" && input.evidence_text.trim().length > 0;
    const hasUrl = typeof input.evidence_url === "string" && input.evidence_url.trim().length > 0;
    if (!hasText && !hasUrl) {
      return {
        valid: false,
        requiresApproval: item.requires_approval,
        error: "Esta tarefa exige comprovação documental ou link de evidência para ser concluída.",
      };
    }
  }

  return {
    valid: true,
    requiresApproval: item.requires_approval,
  };
}

/**
 * Classificação e segregação das filas operacionais da agência
 */
export interface OperationalQueues {
  attentionToday: WorkItem[];
  overdue: WorkItem[];
  blocked: WorkItem[];
  inReview: WorkItem[];
  inProgress: WorkItem[];
  todo: WorkItem[];
  completedCount: number;
}

export function categorizeOperationalQueues(
  items: WorkItem[],
  referenceIsoDate: string = new Date().toISOString().slice(0, 10)
): OperationalQueues {
  const attentionToday: WorkItem[] = [];
  const overdue: WorkItem[] = [];
  const blocked: WorkItem[] = [];
  const inReview: WorkItem[] = [];
  const inProgress: WorkItem[] = [];
  const todo: WorkItem[] = [];
  let completedCount = 0;

  for (const item of items) {
    if (item.status === "completed") {
      completedCount++;
      continue;
    }
    if (item.status === "cancelled") {
      continue;
    }

    const isOverdue = item.due_date && item.due_date < referenceIsoDate;
    const isDueToday = item.due_date && item.due_date === referenceIsoDate;
    const isSlaBreached = item.sla_status === "breached";
    const isSlaWarning = item.sla_status === "warning";

    if (isOverdue) {
      overdue.push(item);
    }

    if (isDueToday || isSlaWarning || isSlaBreached) {
      attentionToday.push(item);
    }

    if (item.status === "blocked_by_dependency" || item.status === "blocked_by_client") {
      blocked.push(item);
    } else if (item.status === "in_review") {
      inReview.push(item);
    } else if (item.status === "in_progress") {
      inProgress.push(item);
    } else if (item.status === "todo" || item.status === "backlog") {
      todo.push(item);
    }
  }

  return {
    attentionToday,
    overdue,
    blocked,
    inReview,
    inProgress,
    todo,
    completedCount,
  };
}

/**
 * Métricas agregadas de Capacidade e Tempo
 */
export interface CapacityMetrics {
  totalEstimatedMinutes: number;
  totalActualMinutes: number;
  varianceMinutes: number;
  variancePercentage: number;
  efficiencyRatio: number;
  tasksCompleted: number;
  tasksPending: number;
  tasksBlocked: number;
}

export function calculateCapacityMetrics(items: WorkItem[]): CapacityMetrics {
  let totalEstimated = 0;
  let totalActual = 0;
  let completed = 0;
  let pending = 0;
  let blocked = 0;

  for (const item of items) {
    totalEstimated += item.estimated_minutes || 0;
    totalActual += item.actual_minutes || 0;

    if (item.status === "completed") {
      completed++;
    } else if (item.status === "blocked_by_dependency" || item.status === "blocked_by_client") {
      blocked++;
    } else if (item.status !== "cancelled") {
      pending++;
    }
  }

  const varianceMinutes = totalActual - totalEstimated;
  const variancePercentage =
    totalEstimated > 0 ? Math.round((varianceMinutes / totalEstimated) * 100) : 0;
  const efficiencyRatio =
    totalActual > 0 ? Math.round((totalEstimated / totalActual) * 100) / 100 : 1.0;

  return {
    totalEstimatedMinutes: totalEstimated,
    totalActualMinutes: totalActual,
    varianceMinutes,
    variancePercentage,
    efficiencyRatio,
    tasksCompleted: completed,
    tasksPending: pending,
    tasksBlocked: blocked,
  };
}

/**
 * Instanciação de Workflow a partir de um Template
 */
export function buildWorkflowFromTemplate(
  template: WorkflowTemplate,
  client: { id: string; agency_id: string; name: string },
  options: {
    unit_id?: string | null;
    service_id?: string | null;
    target_start_date?: string | null;
    target_due_date?: string | null;
    workflow_type?: WorkflowType;
    priority?: WorkflowPriority;
    assigned_actor_id?: string | null;
  }
): {
  workflow: Omit<Workflow, "id" | "created_at" | "updated_at">;
  items: Array<Omit<WorkItem, "id" | "workflow_id" | "created_at" | "updated_at">>;
} {
  const workflowType = options.workflow_type || (template.category === "onboarding" ? "implementation" : "recurring_monthly");
  const priority = options.priority || "medium";

  const workflow: Omit<Workflow, "id" | "created_at" | "updated_at"> = {
    agency_id: client.agency_id,
    client_id: client.id,
    unit_id: options.unit_id || null,
    service_id: options.service_id || null,
    template_id: template.id,
    title: `${template.name} — ${client.name}`,
    workflow_type: workflowType,
    status: "pending",
    priority,
    progress_percentage: 0,
    total_estimated_minutes: template.estimated_total_minutes || 0,
    total_actual_minutes: 0,
    blocked_reason: null,
    target_start_date: options.target_start_date || new Date().toISOString().slice(0, 10),
    target_due_date: options.target_due_date || null,
    started_at: null,
    completed_at: null,
    assigned_actor_id: options.assigned_actor_id || null,
    metadata: {
      template_slug: template.slug,
      template_version: template.version,
    },
  };

  const items: Array<Omit<WorkItem, "id" | "workflow_id" | "created_at" | "updated_at">> = template.definition.map(
    (t, idx) => ({
      agency_id: client.agency_id,
      client_id: client.id,
      unit_id: options.unit_id || null,
      title: t.title,
      description: t.description || "",
      task_type: t.task_type || "manual",
      frequency: t.frequency || "one_off",
      status: "todo",
      priority,
      estimated_minutes: t.estimated_minutes || 0,
      actual_minutes: 0,
      due_date: options.target_due_date || null,
      sla_hours: t.sla_hours || 24,
      sla_status: "on_track",
      depends_on_item_ids: t.depends_on_task_ids || [],
      assigned_actor_id: options.assigned_actor_id || null,
      assigned_actor_name: null,
      requires_approval: Boolean(t.requires_approval),
      approval_item_id: null,
      evidence_required: Boolean(t.evidence_required),
      evidence_text: null,
      evidence_url: null,
      acceptance_criteria: t.acceptance_criteria || "",
      sop_reference: t.sop_reference || null,
      blocked_reason: null,
      client_action_required: null,
      completed_at: null,
      completed_by_actor_id: null,
      order_index: typeof t.order_index === "number" ? t.order_index : idx,
    })
  );

  return { workflow, items };
}
