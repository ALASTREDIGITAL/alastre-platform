import { z } from "zod";
const id = z.string().uuid(),
  text = (max: number) => z.string().trim().min(1).max(max),
  optionalText = (max: number) => z.string().trim().max(max).optional();
const client = z.object({ client_id: id });
export const localSeoV2Request = z.discriminatedUnion("action", [
  z.object({ action: z.literal("clients") }),
  client.extend({ action: z.literal("workspace") }),
  client.extend({
    action: z.literal("services_set"),
    services: z
      .array(
        z.enum([
          "local_seo",
          "google_ads",
          "meta_ads",
          "sites_seo",
          "reports",
          "commercial",
          "finance",
        ]),
      )
      .max(7),
  }),
  client.extend({
    action: z.literal("keyword_save"),
    id: id.optional(),
    keyword: text(180),
    intent: z.enum([
      "transactional",
      "commercial",
      "local",
      "informational",
      "brand",
    ]),
    service: optionalText(180),
    location: optionalText(180),
    priority: z.enum(["critical", "high", "medium", "low"]),
    source: z.enum(["manual", "dna", "agent_suggestion"]),
    reason: optionalText(500),
  }),
  client.extend({
    action: z.literal("keyword_status"),
    id: id,
    status: z.enum(["suggested", "approved", "monitored", "archived"]),
  }),
  client.extend({
    action: z.literal("competitor_save"),
    id: id.optional(),
    name: text(180),
    category: optionalText(180),
    location: optionalText(180),
    rating: z.number().min(0).max(5).nullable().optional(),
    review_count: z.number().int().min(0).nullable().optional(),
    website: optionalText(500),
    notes: optionalText(2000),
  }),
  client.extend({
    action: z.literal("competitor_status"),
    id: id,
    status: z.enum(["active", "archived"]),
  }),
  client.extend({
    action: z.literal("audit_save"),
    check_key: text(80),
    status: z.enum([
      "ok",
      "attention",
      "critical",
      "not_verified",
      "not_available",
    ]),
    evidence_note: optionalText(2000),
    recommendation: optionalText(2000),
    priority: z
      .enum(["critical", "high", "medium", "low"])
      .nullable()
      .optional(),
    source: z.enum(["manual", "dna_suggestion"]),
  }),
  client.extend({ action: z.literal("calculate_score") }),
  client.extend({ action: z.literal("generate_opportunities") }),
]);
export type LocalSeoV2Request = z.infer<typeof localSeoV2Request>;

export function calculatePartialScore(
  checks: Array<{ status: string; check_key: string }>,
) {
  const verified = checks.filter((check) =>
    ["ok", "attention", "critical"].includes(check.status),
  );
  if (!verified.length) return null;
  const points = verified.reduce(
    (sum, check) =>
      sum +
      (check.status === "ok" ? 100 : check.status === "attention" ? 60 : 20),
    0,
  );
  const profile = Math.round(points / verified.length);
  return {
    overall_score: profile,
    confidence: verified.length >= 12 ? ("medium" as const) : ("low" as const),
    state: "partial" as const,
    version: "v2-manual",
    pillar_scores: [
      {
        key: "profile",
        score: profile,
        confidence: verified.length >= 12 ? "medium" : "low",
        evidence_count: verified.length,
      },
    ],
    evidence_summary: {
      profile_checks: verified.map((check) => check.check_key),
    },
  };
}
export function deterministicOpportunityRules(input: {
  checks: Array<{ status: string; check_key: string }>;
  approvedKeywords: number;
  competitors: number;
}) {
  const results: Array<{
    origin: string;
    category: string;
    priority: string;
    title: string;
    diagnosis: string;
    recommendation: string;
    suggested_action: string;
    evidence: Record<string, unknown>;
  }> = [];
  const critical = input.checks.filter((check) => check.status === "critical");
  if (critical.length >= 3)
    results.push({
      origin: "rule:audit_critical_count",
      category: "profile",
      priority: "critical",
      title: "Revisar problemas críticos do Perfil",
      diagnosis: `${critical.length} verificações foram marcadas como críticas.`,
      recommendation:
        "Revisar as evidências e corrigir primeiro os itens críticos confirmados.",
      suggested_action: "open_profile",
      evidence: { check_keys: critical.map((item) => item.check_key) },
    });
  else
    for (const check of input.checks.filter(
      (item) => item.status === "attention" || item.status === "critical",
    ))
      results.push({
        origin: `rule:audit:${check.check_key}`,
        category: "profile",
        priority: check.status === "critical" ? "critical" : "high",
        title: `Revisar ${check.check_key.replaceAll("_", " ")}`,
        diagnosis: `A verificação ${check.check_key} foi marcada como ${check.status}.`,
        recommendation:
          "Revisar a evidência registrada e definir a correção adequada.",
        suggested_action: "open_profile",
        evidence: { check_key: check.check_key, status: check.status },
      });
  if (input.approvedKeywords === 0)
    results.push({
      origin: "rule:no_approved_keywords",
      category: "ranking",
      priority: "medium",
      title: "Definir palavras-chave aprovadas",
      diagnosis: "Nenhuma palavra-chave aprovada foi encontrada.",
      recommendation:
        "Revisar sugestões ou cadastrar termos reais da operação.",
      suggested_action: "open_keywords",
      evidence: { approved_keywords: 0 },
    });
  if (input.competitors === 0)
    results.push({
      origin: "rule:no_competitors",
      category: "competition",
      priority: "low",
      title: "Cadastrar concorrentes locais",
      diagnosis: "Nenhum concorrente ativo foi cadastrado.",
      recommendation:
        "Adicionar manualmente concorrentes conhecidos para iniciar comparações.",
      suggested_action: "open_competitors",
      evidence: { active_competitors: 0 },
    });
  return results;
}

export async function postLocalSeoV2(
  input: LocalSeoV2Request,
  signal?: AbortSignal,
) {
  const parsed = localSeoV2Request.safeParse(input);
  if (!parsed.success) throw new Error("Dados inválidos.");
  const response = await fetch("/api/local-seo-v2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
    signal,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== "object" || Array.isArray(data)) {
    const code = data && typeof data === "object" && "error" in data ? String(data.error) : "";
    throw new Error(response.status === 503 ? "Persistência interna indisponível." : code === "actor_forbidden" ? "Seu perfil não permite esta alteração." : "Não foi possível concluir a operação.");
  }
  return data as Record<string, unknown>;
}
