import { z } from "zod";
import type {
  QualityEvidence,
  QualityChecklistTemplate,
  QualityChecklistRun,
  QualityNonConformity,
  QualityAuditHistoryEntry,
} from "./quality-domain.ts";

/**
 * Zod Schemas para Ações da API de Qualidade e Evidências
 */
export const CreateEvidenceSchema = z.object({
  action: z.literal("create_evidence"),
  work_item_id: z.string().uuid("ID do item de trabalho inválido"),
  client_id: z.string().uuid().optional().nullable(),
  unit_id: z.string().optional().nullable(),
  service_id: z.string().uuid().optional().nullable(),
  delivery_item_type: z.string().optional().nullable(),
  delivery_item_id: z.string().optional().nullable(),
  evidence_type: z.enum([
    "before_after",
    "screenshot",
    "url",
    "external_id",
    "sanitized_payload",
    "manual_confirmation",
    "automated_validation",
    "collection_limitation",
  ]),
  origin: z.enum(["manual", "automated", "provider", "system"]).default("manual"),
  verifiable_reference: z.string().min(1, "Referência verificável é obrigatória"),
  before_reference: z.string().optional().nullable(),
  after_reference: z.string().optional().nullable(),
  sanitized_metadata: z.record(z.unknown()).default({}),
  limitation_note: z.string().optional().nullable(),
});

export const VerifyEvidenceSchema = z.object({
  action: z.literal("verify_evidence"),
  evidence_id: z.string().uuid("ID da evidência inválido"),
  verification_status: z.enum(["verified", "rejected", "dispensed"]),
  reason: z.string().optional().default(""),
});

export const CreateChecklistTemplateSchema = z.object({
  action: z.literal("create_checklist_template"),
  title: z.string().min(3).max(180),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.enum(["local_seo", "google_ads", "meta_ads", "tracking", "onboarding", "general"]).default("general"),
  risk_level: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  items: z.array(
    z.object({
      id: z.string(),
      criterion: z.string(),
      criticality: z.enum(["low", "medium", "high", "critical"]),
      is_mandatory: z.boolean(),
      required_evidence_type: z
        .enum([
          "before_after",
          "screenshot",
          "url",
          "external_id",
          "sanitized_payload",
          "manual_confirmation",
          "automated_validation",
          "collection_limitation",
        ])
        .optional()
        .nullable(),
      description: z.string().optional(),
    }),
  ),
});

export const RunChecklistSchema = z.object({
  action: z.literal("run_checklist"),
  work_item_id: z.string().uuid(),
  client_id: z.string().uuid().optional().nullable(),
  template_id: z.string().uuid().optional().nullable(),
  risk_level: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  criteria_results: z.array(
    z.object({
      id: z.string(),
      criterion: z.string(),
      criticality: z.enum(["low", "medium", "high", "critical"]),
      is_mandatory: z.boolean(),
      required_evidence_type: z.string().optional().nullable(),
      evidence_id: z.string().uuid().optional().nullable(),
      result: z.enum(["pending", "passed", "failed", "waived"]),
      executed_by_actor_id: z.string().optional().nullable(),
      reviewed_by_actor_id: z.string().optional().nullable(),
      verified_by_actor_id: z.string().optional().nullable(),
      waived_justification: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }),
  ),
  waived_justification: z.string().optional().nullable(),
});

export const OpenNonConformitySchema = z.object({
  action: z.literal("open_non_conformity"),
  client_id: z.string().uuid("ID do cliente é obrigatório"),
  work_item_id: z.string().uuid().optional().nullable(),
  workflow_id: z.string().uuid().optional().nullable(),
  evidence_id: z.string().uuid().optional().nullable(),
  title: z.string().min(3).max(200),
  severity: z.enum(["low", "medium", "high", "critical"]),
  root_cause: z.string().default(""),
  impact: z.string().default(""),
  assigned_actor_id: z.string().optional().nullable(),
});

export const ResolveNonConformitySchema = z.object({
  action: z.literal("resolve_non_conformity"),
  non_conformity_id: z.string().uuid(),
  resolution_status: z.enum(["resolved", "waived"]),
  reason: z.string().min(3, "Justificativa é obrigatória"),
});

export const CreateCorrectiveActionSchema = z.object({
  action: z.literal("create_corrective_action"),
  non_conformity_id: z.string().uuid(),
  title: z.string().min(3).max(180),
  description: z.string().default(""),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("high"),
  assigned_actor_id: z.string().optional().nullable(),
});

export const FetchWorkspaceSchema = z.object({
  action: z.literal("fetch_workspace"),
  client_id: z.string().uuid().optional(),
  work_item_id: z.string().uuid().optional(),
});

export const QualityApiActionSchema = z.discriminatedUnion("action", [
  CreateEvidenceSchema,
  VerifyEvidenceSchema,
  CreateChecklistTemplateSchema,
  RunChecklistSchema,
  OpenNonConformitySchema,
  ResolveNonConformitySchema,
  CreateCorrectiveActionSchema,
  FetchWorkspaceSchema,
]);

export type QualityApiAction = z.infer<typeof QualityApiActionSchema>;

/**
 * Armazenamento em memória para desenvolvimento e suíte de testes unitários.
 */
export const qualityMemoryStore = {
  evidences: [] as QualityEvidence[],
  checklistTemplates: [] as QualityChecklistTemplate[],
  checklistRuns: [] as QualityChecklistRun[],
  nonConformities: [] as QualityNonConformity[],
  auditHistory: [] as QualityAuditHistoryEntry[],
  clear() {
    this.evidences = [];
    this.checklistTemplates = [];
    this.checklistRuns = [];
    this.nonConformities = [];
    this.auditHistory = [];
  },
};

// Seed de Templates Canônicos de Checklist de Qualidade
export const DEFAULT_CANONICAL_CHECKLIST_TEMPLATES: Array<
  Omit<QualityChecklistTemplate, "agency_id">
> = [
  {
    id: "qtmpl-00000000-0000-0000-0000-000000000001",
    title: "Checklist de Publicação em SEO Local",
    slug: "checklist-post-seo-local",
    category: "local_seo",
    risk_level: "high",
    version: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      {
        id: "c-01",
        criterion: "Validação de Telefone e Dados Pessoais na Imagem/Texto",
        criticality: "critical",
        is_mandatory: true,
        required_evidence_type: "sanitized_payload",
        description: "Garantir que a postagem não inclua números de telefone no corpo de acordo com as regras anti-suspensão do Google.",
      },
      {
        id: "c-02",
        criterion: "Alinhamento com as Diretrizes do DNA da Marca",
        criticality: "high",
        is_mandatory: true,
        required_evidence_type: "screenshot",
        description: "Conferir tom de voz, CTA oficial e imagens sem violação de direitos autorais.",
      },
      {
        id: "c-03",
        criterion: "Evidência de Pré-visualização ou Captura",
        criticality: "medium",
        is_mandatory: true,
        required_evidence_type: "before_after",
        description: "Registrar captura antes/depois do perfil atualizado.",
      },
    ],
  },
  {
    id: "qtmpl-00000000-0000-0000-0000-000000000002",
    title: "Checklist de Configuração de GA4 / GTM (Tracking)",
    slug: "checklist-tracking-gtm-ga4",
    category: "tracking",
    risk_level: "critical",
    version: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      {
        id: "ct-01",
        criterion: "Validação em Modo Debug/Preview do Tag Assistant",
        criticality: "critical",
        is_mandatory: true,
        required_evidence_type: "url",
        description: "Garantir disparo de conversões sem duplicação no container.",
      },
      {
        id: "ct-02",
        criterion: "Segregação de Chaves de API e Segredos no Servidor",
        criticality: "critical",
        is_mandatory: true,
        required_evidence_type: "sanitized_payload",
        description: "Nenhum segredo de Measurement Protocol exposto no browser.",
      },
    ],
  },
];
