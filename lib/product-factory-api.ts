import { z } from "zod";
import type {
  ProductDefinition,
  DiscoverySession,
  ProductScopeItem,
  OperationalSop,
  RaciAssignment,
  ViabilityCheckpoint,
} from "./product-factory-domain.ts";

const id = z.string().trim().min(1).max(120);
const optionalId = z.string().trim().min(1).max(120).optional();
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const productInformationClassificationSchema = z.enum([
  "fact",
  "evidence",
  "inference",
  "hypothesis",
  "gap",
]);

export const productStatusSchema = z.enum([
  "draft",
  "in_review",
  "approved",
  "superseded",
  "archived",
]);

export const deliveryTypeSchema = z.enum(["setup", "recurring"]);

export const scopeClassificationSchema = z.enum([
  "included",
  "not_included",
  "optional",
  "upsell",
]);

export const activityFrequencySchema = z.enum([
  "once",
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "on_demand",
]);

export const raciRoleSchema = z.enum([
  "client",
  "client_service",
  "analyst",
  "specialist",
  "manager",
  "automation_ai",
]);

export const raciTypeSchema = z.enum(["R", "A", "C", "I"]);

// Esquemas de Ações de API
export const productFactoryRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list_products"),
    client_id: optionalId,
    status: productStatusSchema.optional(),
  }),
  z.object({
    action: z.literal("get_product"),
    product_id: id,
  }),
  z.object({
    action: z.literal("create_product"),
    client_id: optionalId,
    name: text(160),
    slug: text(160),
    summary: optionalText(1000),
    target_objective: optionalText(500),
    target_market: optionalText(500),
    icp_description: optionalText(1000),
    anti_icp_description: optionalText(1000),
    transformational_promise: optionalText(1000),
    controllable_deliverables: z.array(z.string().trim().min(1).max(250)).default([]),
    influenciable_indicators: z.array(z.string().trim().min(1).max(250)).default([]),
    external_results: z.array(z.string().trim().min(1).max(250)).default([]),
  }),
  z.object({
    action: z.literal("update_product"),
    product_id: id,
    name: text(160).optional(),
    summary: optionalText(1000),
    target_objective: optionalText(500),
    target_market: optionalText(500),
    icp_description: optionalText(1000),
    anti_icp_description: optionalText(1000),
    transformational_promise: optionalText(1000),
    controllable_deliverables: z.array(z.string().trim().min(1).max(250)).optional(),
    influenciable_indicators: z.array(z.string().trim().min(1).max(250)).optional(),
    external_results: z.array(z.string().trim().min(1).max(250)).optional(),
  }),
  z.object({
    action: z.literal("save_discovery_round"),
    product_id: id,
    round_number: z.number().int().min(1).max(20),
    status: z.enum(["in_progress", "completed", "abandoned"]),
    questions: z.array(
      z.object({
        id: id,
        category: z.enum([
          "operations",
          "objective",
          "market",
          "icp",
          "anti_icp",
          "capacity",
          "constraints",
        ]),
        question_text: text(500),
        explanation: optionalText(1000).default(""),
        is_required: z.boolean().default(true),
        expected_type: z.enum(["text", "number", "boolean", "list"]).default("text"),
      }),
    ).max(7), // Garantia estrita de no máximo 7 perguntas por rodada
    answers: z.array(
      z.object({
        question_id: id,
        answer_text: z.string().trim(),
        classification: productInformationClassificationSchema,
        confidence: z.enum(["high", "medium", "low", "none"]),
        is_blocking_gap: z.boolean(),
        gap_notes: optionalText(1000),
        answered_at: z.string().optional(),
      }),
    ),
  }),
  z.object({
    action: z.literal("save_scope_items"),
    product_id: id,
    items: z.array(
      z.object({
        id: optionalId,
        activity_name: text(200),
        description: optionalText(1000).default(""),
        delivery_type: deliveryTypeSchema,
        frequency: activityFrequencySchema,
        default_role: raciRoleSchema,
        estimated_minutes: z.number().int().min(0).max(100000),
        is_automatable: z.boolean().default(false),
        client_participation_required: z.boolean().default(false),
        dependencies: z.array(z.string().trim()).default([]),
        acceptance_criteria: optionalText(1000).default(""),
        required_evidence: optionalText(1000).default(""),
        scope_classification: scopeClassificationSchema,
        sort_order: z.number().int().default(0),
      }),
    ),
  }),
  z.object({
    action: z.literal("save_sops"),
    product_id: id,
    sops: z.array(
      z.object({
        id: optionalId,
        scope_item_id: optionalId,
        name: text(200),
        objective: optionalText(1000).default(""),
        trigger: optionalText(500).default(""),
        responsible_role: raciRoleSchema,
        prerequisites: z.array(z.string().trim()).default([]),
        tools_required: z.array(z.string().trim()).default([]),
        steps: z.array(
          z.object({
            order: z.number().int(),
            title: text(200),
            instruction: text(2000),
          }),
        ).default([]),
        quality_checklist: z.array(z.string().trim()).default([]),
        completion_criteria: optionalText(1000).default(""),
        required_evidence: optionalText(1000).default(""),
        estimated_minutes: z.number().int().min(0).default(0),
        errors_and_exceptions: z.array(z.string().trim()).default([]),
      }),
    ),
  }),
  z.object({
    action: z.literal("save_raci"),
    product_id: id,
    assignments: z.array(
      z.object({
        id: optionalId,
        scope_item_id: optionalId,
        activity_name: text(200),
        role: raciRoleSchema,
        is_future_role: z.boolean().default(false),
        raci_type: raciTypeSchema,
      }),
    ),
  }),
  z.object({
    action: z.literal("calculate_viability"),
    product_id: id,
  }),
  z.object({
    action: z.literal("submit_for_review"),
    product_id: id,
    submission_note: optionalText(1000),
  }),
  z.object({
    action: z.literal("create_new_version"),
    product_id: id,
  }),
  z.object({
    action: z.literal("archive_product"),
    product_id: id,
  }),
]);

export type ProductFactoryRequest = z.infer<typeof productFactoryRequestSchema>;

export interface ProductWorkspaceData {
  product: ProductDefinition;
  sessions: DiscoverySession[];
  scopeItems: ProductScopeItem[];
  sops: OperationalSop[];
  raci: RaciAssignment[];
  viability: ViabilityCheckpoint | null;
}

/**
 * Cliente seguro de frontend para chamadas à API da Fábrica de Produtos
 */
export async function callProductFactoryApi<T = unknown>(
  payload: ProductFactoryRequest,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api/product-factory", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  const raw = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    throw new Error("Resposta inválida do servidor.");
  }

  if (!response.ok) {
    const errorMsg = typeof json?.error === "string" ? json.error : "Falha na operação da Fábrica de Produtos.";
    throw new Error(errorMsg);
  }

  return json as unknown as T;
}
