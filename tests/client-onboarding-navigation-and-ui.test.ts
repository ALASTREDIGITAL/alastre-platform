import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { HELP_CONTENT, type HelpKey } from "../lib/help-content.ts";
import {
  clientOnboardingRequestSchema,
  callClientOnboardingApi,
} from "../lib/client-onboarding-api.ts";
import {
  calculateActivationChecklist,
  validateSalesConference,
  validateBaselineData,
  generateDefaultRequirements,
  generateImplementationPlanFromProduct,
  ONBOARDING_STAGES,
  ALLOWED_ONBOARDING_TRANSITIONS,
} from "../lib/client-onboarding-domain.ts";

describe("Client Onboarding Navigation, UI & Safeguards Contract", () => {
  describe("Contextual Help Integration", () => {
    const onboardingKeys: HelpKey[] = [
      "client_onboarding.overview",
      "client_onboarding.sales_scope",
      "client_onboarding.company_units",
      "client_onboarding.requirements",
      "client_onboarding.baseline",
      "client_onboarding.plan",
      "client_onboarding.readiness",
    ];

    test("all client onboarding help keys are registered with actionable instructions", () => {
      for (const key of onboardingKeys) {
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

    test("client_onboarding.overview emphasizes converting approved handoff into operational client", () => {
      const overview = HELP_CONTENT["client_onboarding.overview"];
      assert.ok(overview.description.includes("venda aprovada"));
      assert.ok(overview.whyItMatters.includes("baseline factual"));
    });

    test("client_onboarding.sales_scope emphasizes preventing invalid commercial promises", () => {
      const scope = HELP_CONTENT["client_onboarding.sales_scope"];
      assert.ok(scope.description.includes("Fábrica de Produtos"));
      assert.ok(scope.whyItMatters.includes("promessas"));
    });
  });

  describe("AppShell & Navigation Code Alignment", () => {
    test("app-shell.tsx registers client-onboarding view and mounts ClientOnboardingModule", () => {
      const appShellPath = path.resolve(process.cwd(), "app/app-shell.tsx");
      const code = fs.readFileSync(appShellPath, "utf-8");

      // Verify view is registered
      assert.ok(
        code.includes('"client-onboarding"'),
        "client-onboarding must be registered in views"
      );
      // Verify ClientOnboardingModule is imported
      assert.ok(
        code.includes('import { ClientOnboardingModule } from "./client-onboarding-module"'),
        "ClientOnboardingModule must be imported"
      );
      // Verify ClientOnboardingModule is rendered for client-onboarding view
      assert.ok(
        code.includes("<ClientOnboardingModule onNavigate={navigateToView} />"),
        "ClientOnboardingModule must be rendered with onNavigate prop"
      );
      // Verify Nav item in Clientes group
      assert.ok(
        code.includes('{ label: "Onboarding de Clientes", icon: UserCheck, view: "client-onboarding", featured: true }'),
        "Onboarding de Clientes nav item must be present under Clientes group"
      );
    });

    test("client-onboarding-module.tsx exposes the 10 operational tabs and handles Simple/Advanced modes", () => {
      const onboardingModulePath = path.resolve(
        process.cwd(),
        "app/client-onboarding-module.tsx"
      );
      const code = fs.readFileSync(onboardingModulePath, "utf-8");

      // Verify presence of all 10 operational tabs
      const expectedTabs = [
        "overview",
        "sales_scope",
        "company_units",
        "information_collection",
        "access_connections",
        "dna_construction",
        "baseline_setup",
        "implementation_plan",
        "readiness_checklist",
        "history_decisions",
      ];
      for (const tab of expectedTabs) {
        assert.ok(
          code.includes(`value="${tab}"`),
          `client-onboarding-module.tsx must provide tab for ${tab}`
        );
      }

      // Verify Simple / Advanced mode toggle
      assert.ok(code.includes("Modo Simples"), "Must contain Modo Simples toggle");
      assert.ok(code.includes("Modo Avançado"), "Must contain Modo Avançado toggle");

      // Verify core operational handlers exist
      assert.ok(code.includes("handleStartFromHandoff"), "Must have handoff start handler");
      assert.ok(code.includes("handleReviewSales"), "Must have sales review handler");
      assert.ok(code.includes("handleRecordDivergence"), "Must have divergence handler");
      assert.ok(code.includes("handleCreateClientTransactional"), "Must have transactional client creation handler");
      assert.ok(code.includes("handleUpsertUnit"), "Must have unit upsert handler");
      assert.ok(code.includes("handleSaveRequirementAction"), "Must have requirement verification/waiver handler");
      assert.ok(code.includes("handleSaveBaseline"), "Must have baseline save handler");
      assert.ok(code.includes("handleGeneratePlan"), "Must have implementation plan generator");
      assert.ok(code.includes("handleSubmitActivation"), "Must have activation submit handler");
      assert.ok(code.includes("handleApproveActivation"), "Must have activation approval handler");
    });
  });

  describe("API Request Schema Validation Safeguards", () => {
    test("rejects handoff initiation if salesHandoffId is empty", () => {
      const invalid = { action: "start_from_handoff", salesHandoffId: "" };
      const parsed = clientOnboardingRequestSchema.safeParse(invalid);
      assert.equal(parsed.success, false);
    });

    test("rejects transactional client creation without clientName or unitName", () => {
      const invalid = {
        action: "create_or_link_client_transactional",
        onboardingId: "ob_123",
        clientName: "",
        unitName: "",
      };
      const parsed = clientOnboardingRequestSchema.safeParse(invalid);
      assert.equal(parsed.success, false);
    });

    test("rejects divergence record without reason", () => {
      const invalid = {
        action: "record_divergence",
        onboardingId: "ob_123",
        reason: "",
      };
      const parsed = clientOnboardingRequestSchema.safeParse(invalid);
      assert.equal(parsed.success, false);
    });

    test("rejects requirement waiver without reason", () => {
      const invalid = {
        action: "update_requirement",
        onboardingId: "ob_123",
        requirementId: "req_1",
        status: "waived",
        waivedReason: "",
      };
      const parsed = clientOnboardingRequestSchema.safeParse(invalid);
      assert.equal(parsed.success, false);
    });

    test("accepts valid unit upsert payload with coverage radius", () => {
      const valid = {
        action: "upsert_unit",
        onboardingId: "ob_123",
        name: "Sede Campolim",
        unitType: "headquarters" as const,
        isPhysicalStore: true,
        hasServiceArea: true,
        serviceRadiusKm: 25,
        city: "Sorocaba",
        stateUf: "SP",
      };
      const parsed = clientOnboardingRequestSchema.safeParse(valid);
      assert.equal(parsed.success, true);
    });
  });
});
