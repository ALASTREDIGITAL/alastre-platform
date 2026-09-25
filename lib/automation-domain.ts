import { z } from "zod";
import { createHash } from "node:crypto";

/**
 * Módulo 09: Integrações e Automação — Domínio e Salvaguardas Seguras
 */

export const ALASTRE_WRITE_MODE_DEFAULT = "disabled" as const;

export const providerKeys = [
  "google",
  "meta",
  "alastre_ai",
  "electronic_signature",
  "email",
] as const;
export type ProviderKey = (typeof providerKeys)[number];

export const capabilityKeys = [
  "google_business_profile",
  "google_drive",
  "google_ads",
  "google_analytics",
  "google_tag_manager",
  "meta_ads",
  "facebook_pages",
  "instagram_business",
  "ai_generation",
  "electronic_signature_signing",
  "email_notifications",
] as const;
export type CapabilityKey = (typeof capabilityKeys)[number];

export const connectionStatuses = [
  "pending",
  "connected",
  "expired",
  "revoked",
  "permission_denied",
  "unavailable",
  "degraded",
  "error",
  "disconnected",
  "attention",
] as const;
export type ConnectionStatus = (typeof connectionStatuses)[number];

export const syncStatuses = [
  "idle",
  "syncing",
  "success",
  "error",
  "degraded",
  "dead_letter",
] as const;
export type SyncStatus = (typeof syncStatuses)[number];

export const jobStatuses = [
  "pending",
  "queued",
  "running",
  "completed",
  "failed",
  "dead_letter",
  "cancelled",
] as const;
export type JobStatus = (typeof jobStatuses)[number];

export const writePlanStatuses = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "executed",
  "blocked_write_mode",
  "cancelled",
] as const;
export type WritePlanStatus = (typeof writePlanStatuses)[number];

/**
 * Allowlist estrita de domínios externos autorizados por provider (Proteção anti-SSRF).
 * Nenhuma URL enviada por usuário pode desviar deste catálogo.
 */
export const ALLOWED_PROVIDER_DOMAINS: Record<ProviderKey, string[]> = {
  google: [
    "mybusiness.googleapis.com",
    "www.googleapis.com",
    "accounts.google.com",
    "oauth2.googleapis.com",
  ],
  meta: [
    "graph.facebook.com",
    "www.facebook.com",
    "connect.facebook.net",
  ],
  alastre_ai: [
    "api.alastre.digital",
    "ai.alastre.digital",
  ],
  electronic_signature: [
    "api.docusign.com",
    "api.clicksign.com",
  ],
  email: [
    "api.sendgrid.com",
    "api.resend.com",
  ],
};

/**
 * Valida se uma URL pertence estritamente aos domínios permitidos pelo provider (SSRF Defense).
 */
export function validateExternalEndpointUrl(provider: ProviderKey, rawUrl: string): { valid: boolean; reason?: string } {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, reason: "URL vazia ou inválida" };
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, reason: "Formato de URL malformado" };
  }

  // Apenas HTTPS é permitido para chamadas externas de provider
  if (parsed.protocol !== "https:") {
    return { valid: false, reason: "Apenas protocolo HTTPS é permitido para provedores externos" };
  }

  const allowedDomains = ALLOWED_PROVIDER_DOMAINS[provider] ?? [];
  const hostname = parsed.hostname.toLowerCase();

  const isAllowed = allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  if (!isAllowed) {
    return {
      valid: false,
      reason: `Endpoint ${hostname} não está no catálogo de domínios autorizados para o provedor ${provider} (SSRF Defense)`,
    };
  }

  return { valid: true };
}

/**
 * Sanitização recursiva de campos sensíveis para evitar vazamento de tokens, segredos ou credenciais em banco, logs ou auditoria.
 */
const SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /authorization/i,
  /bearer/i,
  /key/i,
  /credential/i,
  /pkce/i,
  /refresh/i,
  /access_token/i,
];

export function sanitizeSensitiveData<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (typeof input === "string") {
    // Caso seja uma string parecendo token Bearer ou JWT
    if (input.startsWith("Bearer ") || input.startsWith("vault:") || input.length > 128) {
      return "[REDACTED_SENSITIVE_STRING]" as unknown as T;
    }
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeSensitiveData) as unknown as T;
  }
  if (typeof input === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
        sanitized[key] = "[REDACTED_SENSITIVE_VALUE]";
      } else {
        sanitized[key] = sanitizeSensitiveData(value);
      }
    }
    return sanitized as unknown as T;
  }
  return input;
}

/**
 * Calcula um hash imutável SHA-256 de 64 caracteres para o plano de escrita externa.
 */
export function computeWritePlanHash(input: {
  agencyId: string;
  clientId?: string | null;
  capability: string;
  actionType: string;
  sanitizedPlan: Record<string, unknown>;
}): string {
  const canonicalString = JSON.stringify({
    agency_id: input.agencyId,
    client_id: input.clientId ?? null,
    capability: input.capability,
    action_type: input.actionType,
    plan: input.sanitizedPlan,
  });
  return createHash("sha256").update(canonicalString, "utf8").digest("hex");
}

/**
 * Zod Schemas para as Ações da Automação
 */
const uuidSchema = z.string().refine((val) => {
  if (typeof val !== "string" || val.trim().length < 3) return false;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  const isPrefixedId = /^(plan|job|conn|actor|appr|item|agency|client|work|evid)-/i.test(val);
  return isUuid || isPrefixedId;
}, "ID inválido: deve ser um UUID v4 ou ID estruturado da plataforma");

export const AutomationSyncTriggerSchema = z.object({
  action: z.literal("sync_trigger"),
  connection_id: uuidSchema,
  capability: z.enum(capabilityKeys),
  force_full_sync: z.boolean().default(false),
});

export const AutomationEnqueueJobSchema = z.object({
  action: z.literal("enqueue_job"),
  client_id: uuidSchema.optional().nullable(),
  connection_id: uuidSchema.optional().nullable(),
  work_item_id: uuidSchema.optional().nullable(),
  evidence_id: uuidSchema.optional().nullable(),
  idempotency_key: z.string().min(8, "Chave de idempotência deve ter ao menos 8 caracteres"),
  capability: z.enum(capabilityKeys),
  action_name: z.string().min(2, "Nome da ação é obrigatório"),
  payload: z.record(z.unknown()).default({}),
  max_attempts: z.number().min(1).max(10).default(3),
  timeout_seconds: z.number().min(5).max(300).default(30),
});

export const AutomationProcessJobSchema = z.object({
  action: z.literal("process_job"),
  job_id: uuidSchema,
  simulate_outcome: z.enum(["success", "fail_retryable", "fail_fatal"]).default("success"),
  simulated_error_code: z.string().optional(),
});

export const AutomationCancelJobSchema = z.object({
  action: z.literal("cancel_job"),
  job_id: uuidSchema,
  reason: z.string().optional(),
});

export const AutomationCreateWritePlanSchema = z.object({
  action: z.literal("create_write_plan"),
  client_id: uuidSchema.optional().nullable(),
  connection_id: uuidSchema.optional().nullable(),
  work_item_id: uuidSchema.optional().nullable(),
  capability: z.enum(capabilityKeys),
  action_type: z.string().min(2, "Tipo de ação é obrigatório"),
  plan_payload: z.record(z.unknown()),
  supports_rollback: z.boolean().default(false),
  compensation_plan: z.record(z.unknown()).optional().nullable(),
});

export const AutomationApproveWritePlanSchema = z.object({
  action: z.literal("approve_write_plan"),
  plan_id: uuidSchema,
  plan_hash: z.string().length(64, "Hash do plano deve ter exatamente 64 caracteres"),
  decision_notes: z.string().optional(),
});

export const AutomationExecuteWritePlanSchema = z.object({
  action: z.literal("execute_write_plan"),
  plan_id: uuidSchema,
  plan_hash: z.string().length(64, "Hash do plano deve ter exatamente 64 caracteres"),
  approval_item_id: uuidSchema.optional().nullable(),
});

export const AutomationRecordAiUsageSchema = z.object({
  action: z.literal("record_ai_usage"),
  client_id: uuidSchema.optional().nullable(),
  capability: z.enum(capabilityKeys),
  model_name: z.string().min(2, "Modelo de IA é obrigatório"),
  tokens_input: z.number().min(0),
  tokens_output: z.number().min(0),
  estimated_cost_usd: z.number().min(0),
  sanitized_summary: z.string().min(3, "Resumo sanitizado é obrigatório"),
});

export const AutomationGetAiLimitsSchema = z.object({
  action: z.literal("get_ai_limits"),
  capability: z.enum(capabilityKeys).optional().nullable(),
});

export const AutomationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("overview") }),
  AutomationSyncTriggerSchema,
  AutomationEnqueueJobSchema,
  AutomationProcessJobSchema,
  AutomationCancelJobSchema,
  AutomationCreateWritePlanSchema,
  AutomationApproveWritePlanSchema,
  AutomationExecuteWritePlanSchema,
  AutomationRecordAiUsageSchema,
  AutomationGetAiLimitsSchema,
]);

export type AutomationActionInput = z.infer<typeof AutomationActionSchema>;

/**
 * Interfaces de dados retornado pela camada de Automação
 */
export type AutomationSyncStateRecord = {
  id: string;
  agency_id: string;
  connection_id: string;
  capability: string;
  sync_cursor: string | null;
  status: SyncStatus;
  last_synced_at: string | null;
  last_success_at: string | null;
  last_error_sanitized: string | null;
  next_sync_at: string | null;
  sync_attempts: number;
  max_attempts: number;
  backoff_seconds: number;
  created_at: string;
  updated_at: string;
};

export type AutomationJobRecord = {
  id: string;
  agency_id: string;
  client_id: string | null;
  connection_id: string | null;
  work_item_id: string | null;
  evidence_id: string | null;
  idempotency_key: string;
  capability: string;
  action_name: string;
  sanitized_payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  timeout_seconds: number;
  backoff_seconds: number;
  last_error_sanitized: string | null;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationWritePlanRecord = {
  id: string;
  agency_id: string;
  client_id: string | null;
  connection_id: string | null;
  approval_item_id: string | null;
  work_item_id: string | null;
  capability: string;
  action_type: string;
  plan_hash: string;
  sanitized_plan: Record<string, unknown>;
  status: WritePlanStatus;
  supports_rollback: boolean;
  compensation_plan: Record<string, unknown> | null;
  created_by_actor_id: string;
  approved_by_actor_id: string | null;
  approved_at: string | null;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationAiUsageLogRecord = {
  id: string;
  agency_id: string;
  client_id: string | null;
  capability: string;
  model_name: string;
  tokens_input: number;
  tokens_output: number;
  estimated_cost_usd: number;
  sanitized_summary: string;
  created_at: string;
};

export type AutomationAiLimitRecord = {
  id: string;
  agency_id: string;
  capability: string;
  monthly_token_limit: number;
  monthly_cost_limit_usd: number;
  current_monthly_tokens: number;
  current_monthly_cost_usd: number;
  last_reset_at: string;
  created_at: string;
  updated_at: string;
};
