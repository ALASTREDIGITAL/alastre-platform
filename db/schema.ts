import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Product Factory Drizzle Schema (SQLite/D1 mirror for Alastre Platform)
 */

export const productDefinitions = sqliteTable("product_definitions", {
  id: text("id").primaryKey(),
  agency_id: text("agency_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("draft"),
  is_immutable: integer("is_immutable", { mode: "boolean" }).notNull().default(false),
  approved_at: text("approved_at"),
  approved_by: text("approved_by"),
  metadata: text("metadata", { mode: "json" }),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const productDiscoverySessions = sqliteTable("product_discovery_sessions", {
  id: text("id").primaryKey(),
  agency_id: text("agency_id").notNull(),
  product_id: text("product_id").notNull(),
  current_round: integer("current_round").notNull().default(1),
  max_rounds: integer("max_rounds").notNull().default(3),
  status: text("status").notNull().default("in_progress"),
  notes: text("notes"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const productScopeItems = sqliteTable("product_scope_items", {
  id: text("id").primaryKey(),
  agency_id: text("agency_id").notNull(),
  product_id: text("product_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  scope_type: text("scope_type").notNull(),
  frequency: text("frequency").notNull().default("one_off"),
  delivery_type: text("delivery_type").notNull(),
  estimated_minutes: integer("estimated_minutes").notNull().default(0),
  automation_percentage: integer("automation_percentage").notNull().default(0),
  tooling_required: text("tooling_required", { mode: "json" }),
  acceptance_criteria: text("acceptance_criteria").notNull(),
  required_evidence: text("required_evidence").notNull(),
  order_index: integer("order_index").notNull().default(0),
  status: text("status").notNull().default("active"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const productOperationalSops = sqliteTable("product_operational_sops", {
  id: text("id").primaryKey(),
  agency_id: text("agency_id").notNull(),
  product_id: text("product_id").notNull(),
  scope_item_id: text("scope_item_id"),
  title: text("title").notNull(),
  trigger_condition: text("trigger_condition").notNull(),
  inputs_required: text("inputs_required", { mode: "json" }),
  step_by_step_checklist: text("step_by_step_checklist", { mode: "json" }),
  expected_output: text("expected_output").notNull(),
  common_deviations_and_fixes: text("common_deviations_and_fixes", { mode: "json" }),
  mandatory_evidence: text("mandatory_evidence").notNull(),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const productRaciAssignments = sqliteTable("product_raci_assignments", {
  id: text("id").primaryKey(),
  agency_id: text("agency_id").notNull(),
  product_id: text("product_id").notNull(),
  scope_item_id: text("scope_item_id"),
  activity_name: text("activity_name").notNull(),
  responsible: text("responsible").notNull(),
  accountable: text("accountable").notNull(),
  consulted: text("consulted", { mode: "json" }),
  informed: text("informed", { mode: "json" }),
  notes: text("notes"),
  is_future_role: integer("is_future_role", { mode: "boolean" }).notNull().default(false),
  future_role_title: text("future_role_title"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const productViabilityCheckpoints = sqliteTable("product_viability_checkpoints", {
  id: text("id").primaryKey(),
  agency_id: text("agency_id").notNull(),
  product_id: text("product_id").notNull(),
  discovery_completeness_percentage: integer("discovery_completeness_percentage").notNull().default(0),
  total_setup_minutes: integer("total_setup_minutes").notNull().default(0),
  total_monthly_minutes: integer("total_monthly_minutes").notNull().default(0),
  automatable_percentage: integer("automatable_percentage").notNull().default(0),
  blocking_gaps: text("blocking_gaps", { mode: "json" }),
  viability_score: integer("viability_score").notNull().default(0),
  result: text("result").notNull(),
  explanation: text("explanation").notNull(),
  calculated_at: text("calculated_at").notNull(),
  calculated_by: text("calculated_by"),
});
