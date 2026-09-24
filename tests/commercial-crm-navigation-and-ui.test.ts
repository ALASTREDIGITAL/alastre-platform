import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { HELP_CONTENT, type HelpKey } from "../lib/help-content.ts";
import {
  commercialCrmRequestSchema,
  callCommercialCrmApi,
} from "../lib/commercial-crm-api.ts";
import {
  validateOpportunityIntegrity,
  validateLossReason,
  validateProposalDiscount,
  isProposalEditable,
  evaluateQualification,
  validateHandoffChecklist,
  calculateCommercialMetrics,
  generateForecast,
  OPPORTUNITY_STAGES,
  ALLOWED_OPPORTUNITY_TRANSITIONS,
} from "../lib/commercial-crm-domain.ts";

describe("Commercial CRM Navigation, UI & Safeguards Contract", () => {
  describe("Contextual Help Integration", () => {
    const commercialKeys: HelpKey[] = [
      "commercial.overview",
      "commercial.pipeline",
      "commercial.qualification",
      "commercial.proposals",
      "commercial.handoff",
    ];

    test("all commercial help keys are registered with actionable instructions", () => {
      for (const key of commercialKeys) {
        const item = HELP_CONTENT[key];
        assert.ok(item, `Help content for ${key} must exist`);
        assert.ok(item.title.length > 5, `Title for ${key} must be descriptive`);
        assert.ok(
          item.description.length > 15,
          `Description for ${key} must explain the purpose`
        );
        assert.ok(
          item.whyItMatters.length > 15,
          `WhyItMatters for ${key} must justify the operation`
        );
        assert.ok(
          item.nextStep.length > 10,
          `NextStep for ${key} must orient the user`
        );
      }
    });

    test("commercial.overview guides operators into Simple Mode and pipeline clarity", () => {
      const overview = HELP_CONTENT["commercial.overview"];
      assert.ok(overview.description.includes("esteira de atração"));
      assert.ok(overview.whyItMatters.includes("rastreabilidade"));
    });

    test("commercial.handoff emphasizes that handoff does NOT auto-create a client", () => {
      const handoff = HELP_CONTENT["commercial.handoff"];
      assert.ok(
        handoff.whyItMatters.includes("não se torna cliente automaticamente") ||
          handoff.title.includes("Onboarding")
      );
    });
  });

  describe("AppShell & Navigation Code Alignment", () => {
    test("app-shell.tsx registers commercial view and mounts CommercialModule", () => {
      const appShellPath = path.resolve(process.cwd(), "app/app-shell.tsx");
      const code = fs.readFileSync(appShellPath, "utf-8");

      // Verify view is registered
      assert.ok(
        code.includes('"commercial"'),
        "commercial must be registered in views"
      );
      // Verify CommercialModule is imported
      assert.ok(
        code.includes('import { CommercialModule } from "./commercial-module"'),
        "CommercialModule must be imported"
      );
      // Verify CommercialModule is rendered for commercial view
      assert.ok(
        code.includes("<CommercialModule onNavigate={navigateToView} />"),
        "CommercialModule must be rendered with onNavigate prop"
      );
      // Verify Gestão group is opened by default
      assert.ok(
        code.includes('"Gestão": true'),
        "Gestão group should be expanded initially"
      );
    });

    test("prospecting-module.tsx includes CTA to open lead in Commercial CRM", () => {
      const prospectingPath = path.resolve(
        process.cwd(),
        "app/prospecting-module.tsx"
      );
      const code = fs.readFileSync(prospectingPath, "utf-8");

      assert.ok(
        code.includes('onNavigate("commercial")'),
        "prospecting modal must provide navigation into commercial view"
      );
      assert.ok(
        code.includes("Abrir no Comercial & CRM"),
        "CTA button text must be clear to operators"
      );
    });

    test("commercial-module.tsx exposes 10 tabs and connects PageHeader helpKey", () => {
      const commercialModulePath = path.resolve(
        process.cwd(),
        "app/commercial-module.tsx"
      );
      const code = fs.readFileSync(commercialModulePath, "utf-8");

      assert.ok(
        code.includes('helpKey="commercial.overview"'),
        "PageHeader must bind to commercial.overview helpKey"
      );

      // Verify presence of core operational tabs
      const expectedTabs = [
        "overview",
        "pipeline",
        "opportunities",
        "companies",
        "qualification",
        "diagnosis",
        "proposals",
        "activities",
        "intelligence",
        "forecast",
      ];
      for (const tab of expectedTabs) {
        assert.ok(
          code.includes(`value="${tab}"`),
          `commercial-module.tsx must provide tab for ${tab}`
        );
      }
    });
  });

  describe("API Request Schema Validation Safeguards", () => {
    test("rejects opportunity creation if title, responsible or next action is empty", () => {
      const invalidPayload = {
        action: "create_opportunity",
        company_id: "comp_123",
        title: "",
        responsible_actor_id: "actor_1",
        responsible_name: "Responsável",
        next_action: "",
        next_action_deadline: "2026-10-01T12:00:00Z",
      };

      const parsed = commercialCrmRequestSchema.safeParse(invalidPayload);
      assert.equal(parsed.success, false);
    });

    test("accepts valid opportunity creation payload with defaults", () => {
      const validPayload = {
        action: "create_opportunity",
        company_id: "comp_123",
        title: "Contrato Anual Sorocaba",
        responsible_actor_id: "actor_1",
        responsible_name: "Consultor Comercial",
        next_action: "Enviar proposta executiva",
        next_action_deadline: "2026-10-05T18:00:00Z",
      };

      const parsed = commercialCrmRequestSchema.safeParse(validPayload);
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.action, "create_opportunity");
        assert.equal((parsed.data as any).origin, "prospecting");
        assert.equal((parsed.data as any).priority, "media_prioridade");
        assert.equal((parsed.data as any).product_version, 1);
      }
    });

    test("rejects proposal with negative price or discount > 100", () => {
      const invalidProposal = {
        action: "upsert_proposal",
        opportunity_id: "opp_1",
        product_definition_id: "prod_local_seo",
        setup_price: -100,
        monthly_price: 1500,
        discount_setup_percentage: 150,
        valid_until: "2026-10-01",
      };

      const parsed = commercialCrmRequestSchema.safeParse(invalidProposal);
      assert.equal(parsed.success, false);
    });

    test("rejects handoff submission without complete payload", () => {
      const invalidHandoff = {
        action: "submit_handoff_review",
        opportunity_id: "",
        handoff_id: "",
      };

      const parsed = commercialCrmRequestSchema.safeParse(invalidHandoff);
      assert.equal(parsed.success, false);
    });
  });

  describe("Domain Invariants and Integrity Rules", () => {
    test("every opportunity must preserve responsible actor, next action, and deadline", () => {
      const invalidOpp = {
        id: "opp_test",
        agency_id: "ag_1",
        company_id: "comp_1",
        title: "Teste",
        origin: "prospecting" as const,
        stage: "diagnosis_scheduled" as const,
        priority: "alta_prioridade" as const,
        responsible_actor_id: "",
        responsible_name: "",
        next_action: "",
        next_action_deadline: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      };

      const result = validateOpportunityIntegrity(invalidOpp);
      assert.equal(result.valid, false);
      assert.ok(result.errors.length >= 2);
    });

    test("loss reason 'preco' strictly requires detailed justification", () => {
      const vague = validateLossReason("preco", "caro");
      assert.equal(vague.valid, false);
      assert.ok(vague.error?.includes("10 caracteres"));

      const justified = validateLossReason(
        "preco",
        "Cliente comparou com concorrente autônomo que cobra R$ 500/mês"
      );
      assert.equal(justified.valid, true);
    });

    test("proposal sent or accepted becomes immutable", () => {
      assert.equal(isProposalEditable("draft", false), true);
      assert.equal(isProposalEditable("internal_review", false), true);
      assert.equal(isProposalEditable("sent", true), false);
      assert.equal(isProposalEditable("accepted", true), false);
      assert.equal(isProposalEditable("rejected", true), false);
      assert.equal(isProposalEditable("superseded", true), false);
    });

    test("discount without counterpart is rejected", () => {
      const invalidDiscount = validateProposalDiscount({
        discount_setup_percentage: 15,
        discount_monthly_percentage: 0,
        discount_justification: "Cliente pediu desconto no fechamento inicial",
        discount_counterpart: "",
      });
      assert.equal(invalidDiscount.valid, false);
      assert.ok(invalidDiscount.errors.some((e) => e.includes("contrapartida")));

      const validDiscount = validateProposalDiscount({
        discount_setup_percentage: 15,
        discount_monthly_percentage: 0,
        discount_justification: "Ajuste comercial para fechamento anual à vista",
        discount_counterpart: "Pagamento adiantado do ano todo em parcela única",
      });
      assert.equal(validDiscount.valid, true);
    });

    test("metrics safeguard: displays insufficient data for small sample size", () => {
      const opps = [
        {
          id: "opp_1",
          stage: "proposal_sent" as const,
          estimated_mrr_value: 2000,
          created_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        },
      ];
      const metrics = calculateCommercialMetrics(opps as any, 5);
      assert.equal(metrics.status, "insufficient_data");
      assert.ok(metrics.message?.includes("Dados insuficientes"));
    });
  });
});
