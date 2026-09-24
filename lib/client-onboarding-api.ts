import { z } from "zod";
import type {
  ClientOnboarding,
  ClientUnit,
  OnboardingRequirement,
  OnboardingBaseline,
  ImplementationPlan,
  OnboardingDecision,
  ActivationReadiness,
} from "./client-onboarding-domain";

// ==============================================================================
// Schemas Zod de Validação
// ==============================================================================

export const listOnboardingsSchema = z.object({
  action: z.literal("list_onboardings"),
  status: z.string().optional(),
});

export const getOnboardingWorkspaceSchema = z.object({
  action: z.literal("get_onboarding_workspace"),
  onboardingId: z.string().min(2),
});

export const startFromHandoffSchema = z.object({
  action: z.literal("start_from_handoff"),
  salesHandoffId: z.string().min(2),
  idempotencyKey: z.string().optional(),
});

export const reviewSalesSchema = z.object({
  action: z.literal("review_sales"),
  onboardingId: z.string().min(2),
  decision: z.enum(["approved", "diverged"]),
  divergenceReason: z.string().optional(),
  notes: z.string().optional(),
});

export const recordDivergenceSchema = z.object({
  action: z.literal("record_divergence"),
  onboardingId: z.string().min(2),
  reason: z.string().min(5),
  issues: z.array(z.string()).optional(),
});

export const createOrLinkClientTransactionalSchema = z.object({
  action: z.literal("create_or_link_client_transactional"),
  onboardingId: z.string().min(2),
  clientName: z.string().min(2).max(160).optional(),
  unitName: z.string().min(2).max(160).optional(),
  unitCity: z.string().min(2).max(100).optional(),
  unitStateUf: z.string().length(2).optional(),
  idempotencyKey: z.string().optional(),
});

export const upsertUnitSchema = z.object({
  action: z.literal("upsert_unit"),
  onboardingId: z.string().min(2),
  unitId: z.string().optional(),
  name: z.string().min(2).max(160),
  unitType: z.enum(["headquarters", "branch", "service_area_hub"]).default("headquarters"),
  isPhysicalStore: z.boolean().default(true),
  hasServiceArea: z.boolean().default(false),
  serviceRadiusKm: z.number().nonnegative().optional(),
  status: z.enum(["active", "pending_verification", "suspended", "inactive"]).optional().default("active"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  addressStreet: z.string().optional(),
  addressNumber: z.string().optional(),
  addressComplement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().min(2),
  stateUf: z.string().length(2),
  postalCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  businessHours: z.record(z.any()).optional(),
  gbpPlaceId: z.string().optional(),
  gbpLocationId: z.string().optional(),
  gbpCid: z.string().optional(),
});

export const baseUpdateRequirementSchema = z.object({
  action: z.literal("update_requirement"),
  onboardingId: z.string().min(2),
  requirementId: z.string().min(2),
  status: z.enum(["pending", "submitted", "verified", "waived"]),
  evidenceText: z.string().optional(),
  evidenceUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
  waivedReason: z.string().optional(),
});

export const updateRequirementSchema = baseUpdateRequirementSchema.refine(
  (data) => {
    if (data.status === "waived") {
      return typeof data.waivedReason === "string" && data.waivedReason.trim().length >= 5;
    }
    return true;
  },
  {
    message: "Para dispensar um requisito, forneça uma justificativa formal com ao menos 5 caracteres.",
    path: ["waivedReason"],
  }
);

export const updateDnaSchema = z.object({
  action: z.literal("update_dna"),
  onboardingId: z.string().min(2),
  facts: z.record(z.any()),
  status: z.enum(["draft", "confirmed", "needs_review"]).default("confirmed"),
});

export const recordAccessBindingSchema = z.object({
  action: z.literal("record_access_binding"),
  onboardingId: z.string().min(2),
  capability: z.string().min(2),
  externalResourceId: z.string().optional(),
  notes: z.string().optional(),
});

export const saveBaselineSchema = z.object({
  action: z.literal("save_baseline"),
  onboardingId: z.string().min(2),
  profileCompletenessScore: z.number().int().min(0).max(100).optional().nullable(),
  currentRating: z.number().min(0).max(5).optional().nullable(),
  currentReviewCount: z.number().int().nonnegative().optional().nullable(),
  unansweredReviewsCount: z.number().int().nonnegative().optional().nullable(),
  rankingVisibilityNotes: z.string().optional().default(""),
  contentAudit: z.record(z.any()).optional().default({}),
  trackedKeywords: z.array(z.any()).optional().default([]),
  knownCompetitors: z.array(z.any()).optional().default([]),
  availableConversions: z.record(z.any()).optional().default({}),
  collectionLimitations: z.array(z.string()).optional().default([]),
  unavailableDataPoints: z.array(z.string()).optional().default([]),
});

export const generatePlanSchema = z.object({
  action: z.literal("generate_plan"),
  onboardingId: z.string().min(2),
  targetStartDate: z.string().optional(),
});

export const calculateReadinessSchema = z.object({
  action: z.literal("calculate_readiness"),
  onboardingId: z.string().min(2),
});

export const submitActivationSchema = z.object({
  action: z.literal("submit_activation"),
  onboardingId: z.string().min(2),
  notes: z.string().optional(),
});

export const approveActivationSchema = z.object({
  action: z.literal("approve_activation"),
  onboardingId: z.string().min(2),
  notes: z.string().optional(),
});

export const blockOrCancelSchema = z.object({
  action: z.literal("block_or_cancel"),
  onboardingId: z.string().min(2),
  operation: z.enum(["block", "cancel", "unblock"]),
  reason: z.string().min(5),
});

export const clientOnboardingRequestSchema = z
  .discriminatedUnion("action", [
    listOnboardingsSchema,
    getOnboardingWorkspaceSchema,
    startFromHandoffSchema,
    reviewSalesSchema,
    recordDivergenceSchema,
    createOrLinkClientTransactionalSchema,
    upsertUnitSchema,
    baseUpdateRequirementSchema,
    updateDnaSchema,
    recordAccessBindingSchema,
    saveBaselineSchema,
    generatePlanSchema,
    calculateReadinessSchema,
    submitActivationSchema,
    approveActivationSchema,
    blockOrCancelSchema,
  ])
  .superRefine((data, ctx) => {
    if (data.action === "update_requirement" && data.status === "waived") {
      if (!data.waivedReason || data.waivedReason.trim().length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Para dispensar um requisito, forneça uma justificativa formal com ao menos 5 caracteres.",
          path: ["waivedReason"],
        });
      }
    }
  });

export type ClientOnboardingRequest = z.infer<typeof clientOnboardingRequestSchema>;

// ==============================================================================
// Resposta do Workspace
// ==============================================================================

export type OnboardingWorkspaceData = {
  onboarding: ClientOnboarding;
  client?: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
  company?: {
    id: string;
    name: string;
    segment?: string;
    city?: string;
    stateUf?: string;
    phone?: string;
    rating?: string;
    reviewCount?: number;
    mapsUrl?: string;
    placeId?: string;
  } | null;
  units: ClientUnit[];
  requirements: OnboardingRequirement[];
  baseline: OnboardingBaseline | null;
  plan: ImplementationPlan | null;
  decisions: OnboardingDecision[];
  readiness: ActivationReadiness;
  salesHandoff?: {
    id: string;
    status: string;
    promisesMade: string;
    clientExpectations: string;
    operationalRisks: string;
    criticalDependencies: string;
    missingData: string;
    checklist: Record<string, unknown>;
  } | null;
  proposal?: {
    id: string;
    version: number;
    status: string;
    setupPrice: string;
    monthlyPrice: string;
    selectedScopeItems: unknown[];
  } | null;
  product?: {
    id: string;
    name: string;
    slug: string;
    version: number;
    status: string;
  } | null;
};

// ==============================================================================
// Cliente de API Tipado
// ==============================================================================

export async function callClientOnboardingApi<T = unknown>(
  payload: ClientOnboardingRequest,
  options?: { signal?: AbortSignal }
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch("/api/client-onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: options?.signal,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        error: json?.error || `Erro HTTP ${res.status} ao processar onboarding`,
      };
    }

    return {
      success: true,
      data: json as T,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return { success: false, error: "Operação cancelada" };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido de conexão",
    };
  }
}
