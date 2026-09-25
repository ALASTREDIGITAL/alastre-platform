import { z } from "zod";

/**
 * Módulo 04: Schemas Zod de API do Motor de Operações (Operations Engine API)
 * Validação rigorosa na fronteira HTTP com união discriminada por `action`.
 */

export const TaskTypeSchema = z.enum(["manual", "automated", "hybrid", "approval"]);
export const TaskFrequencySchema = z.enum([
  "one_off",
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
]);
export const WorkItemStatusSchema = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "blocked_by_dependency",
  "blocked_by_client",
  "in_review",
  "completed",
  "cancelled",
]);
export const WorkItemPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const WorkflowTypeSchema = z.enum([
  "implementation",
  "recurring_monthly",
  "recurring_weekly",
  "one_off",
  "exception",
]);
export const WorkflowStatusSchema = z.enum([
  "pending",
  "in_progress",
  "blocked",
  "in_review",
  "completed",
  "cancelled",
]);

// 1. Listar Workspace Operacional
export const ListOperationsWorkspaceSchema = z.object({
  action: z.literal("list_workspace"),
  client_id: z.string().uuid().optional(),
  workflow_id: z.string().uuid().optional(),
  status_filter: z.string().optional(),
  assigned_actor_id: z.string().optional(),
});

// 2. Criar Workflow
export const CreateWorkflowSchema = z.object({
  action: z.literal("create_workflow"),
  client_id: z.string().uuid(),
  unit_id: z.string().uuid().optional().nullable(),
  service_id: z.string().uuid().optional().nullable(),
  template_id: z.string().uuid().optional().nullable(),
  title: z.string().min(3).max(180),
  workflow_type: WorkflowTypeSchema.default("implementation"),
  priority: WorkItemPrioritySchema.default("medium"),
  target_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  target_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  assigned_actor_id: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

// 3. Criar Work Item
export const CreateWorkItemSchema = z.object({
  action: z.literal("create_work_item"),
  client_id: z.string().uuid(),
  workflow_id: z.string().uuid(),
  unit_id: z.string().uuid().optional().nullable(),
  title: z.string().min(3).max(180),
  description: z.string().max(2000).default(""),
  task_type: TaskTypeSchema.default("manual"),
  frequency: TaskFrequencySchema.default("one_off"),
  priority: WorkItemPrioritySchema.default("medium"),
  estimated_minutes: z.number().int().min(0).default(0),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  sla_hours: z.number().int().min(1).default(24),
  depends_on_item_ids: z.array(z.string().uuid()).default([]),
  assigned_actor_id: z.string().optional().nullable(),
  assigned_actor_name: z.string().optional().nullable(),
  requires_approval: z.boolean().default(false),
  evidence_required: z.boolean().default(false),
  acceptance_criteria: z.string().max(1000).default(""),
  sop_reference: z.string().max(200).optional().nullable(),
});

// 4. Iniciar Tarefa (validação de dependências)
export const StartWorkItemSchema = z.object({
  action: z.literal("start_task"),
  work_item_id: z.string().uuid(),
});

// 5. Concluir Tarefa / Submeter para Aprovação
export const CompleteWorkItemSchema = z.object({
  action: z.literal("complete_task"),
  work_item_id: z.string().uuid(),
  evidence_text: z.string().max(3000).optional().nullable(),
  evidence_url: z.string().url().max(1000).optional().nullable(),
});

// 6. Bloquear Tarefa (impedimento ou pendência com cliente)
export const BlockWorkItemSchema = z.object({
  action: z.literal("block_task"),
  work_item_id: z.string().uuid(),
  blocked_reason: z.string().min(5).max(1000),
  block_type: z.enum(["client_action", "technical_dependency"]),
  client_action_required: z.string().max(1000).optional().nullable(),
});

// 7. Desbloquear Tarefa
export const UnblockWorkItemSchema = z.object({
  action: z.literal("unblock_task"),
  work_item_id: z.string().uuid(),
  resolution_notes: z.string().max(1000).default(""),
});

// 8. Apontamento de Tempo
export const LogWorkTimeSchema = z.object({
  action: z.literal("log_time"),
  client_id: z.string().uuid(),
  work_item_id: z.string().uuid(),
  minutes_spent: z.number().int().positive().max(1440),
  notes: z.string().max(1000).default(""),
});

// 9. Criar ou Salvar Template de Workflow
export const SaveWorkflowTemplateSchema = z.object({
  action: z.literal("save_template"),
  name: z.string().min(3).max(160),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  version: z.number().int().min(1).default(1),
  category: z.enum(["local_seo", "google_ads", "meta_ads", "tracking", "onboarding", "general"]),
  description: z.string().max(1000).default(""),
  trigger_type: z.enum(["manual", "onboarding_activated", "recurring_schedule", "event_triggered"]).default("manual"),
  target_service: z.string().max(60).optional().nullable(),
  estimated_total_minutes: z.number().int().min(0).default(0),
  definition: z.array(
    z.object({
      id: z.string(),
      title: z.string().min(3).max(180),
      description: z.string().default(""),
      task_type: TaskTypeSchema.default("manual"),
      frequency: TaskFrequencySchema.default("one_off"),
      estimated_minutes: z.number().int().min(0).default(0),
      sla_hours: z.number().int().min(1).default(24),
      requires_approval: z.boolean().default(false),
      evidence_required: z.boolean().default(false),
      acceptance_criteria: z.string().default(""),
      order_index: z.number().int().default(0),
      depends_on_task_ids: z.array(z.string()).default([]),
      sop_reference: z.string().optional(),
    })
  ),
});

// 10. Registrar Exceção Operacional
export const ReportExceptionSchema = z.object({
  action: z.literal("report_exception"),
  client_id: z.string().uuid(),
  workflow_id: z.string().uuid().optional().nullable(),
  work_item_id: z.string().uuid().optional().nullable(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  category: z.enum(["sla_breach", "client_block", "dependency_cycle", "quality_failure", "system_error"]),
  description: z.string().min(5).max(2000),
});

// 11. Resolver Exceção Operacional
export const ResolveExceptionSchema = z.object({
  action: z.literal("resolve_exception"),
  exception_id: z.string().uuid(),
  resolution_notes: z.string().min(5).max(2000),
});

// União Discriminada de Ações da API do Motor de Operações
export const OperationsApiActionSchema = z.discriminatedUnion("action", [
  ListOperationsWorkspaceSchema,
  CreateWorkflowSchema,
  CreateWorkItemSchema,
  StartWorkItemSchema,
  CompleteWorkItemSchema,
  BlockWorkItemSchema,
  UnblockWorkItemSchema,
  LogWorkTimeSchema,
  SaveWorkflowTemplateSchema,
  ReportExceptionSchema,
  ResolveExceptionSchema,
]);

export type OperationsApiAction = z.infer<typeof OperationsApiActionSchema>;
