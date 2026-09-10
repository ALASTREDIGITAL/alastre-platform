import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const foundation = await readFile(`${root}/supabase/migrations/20260904151205_marco_1_client_dna_agent_workspace.sql`, "utf8");
const stabilization = await readFile(`${root}/supabase/migrations/20260908162515_security_stabilization.sql`, "utf8");
const gateway = await readFile(`${root}/supabase/migrations/20260908211215_ai_gateway_cost_controls.sql`, "utf8");
const runtime = await readFile(`${root}/supabase/migrations/20260908212509_ai_gateway_runtime.sql`, "utf8");
const tracking = await readFile(`${root}/supabase/migrations/20260909212000_tracking_provisioning_domain.sql`, "utf8");
const discovery = await readFile(`${root}/supabase/migrations/20260909223000_tracking_discovery_reconciliation.sql`, "utf8");
const trackingApproval = await readFile(`${root}/supabase/migrations/20260909214555_tracking_approval_planning.sql`, "utf8");
const trackingCandidate = await readFile(`${root}/supabase/migrations/20260910124500_tracking_candidate_pipeline.sql`, "utf8");
const trackingCandidateIndexes = await readFile(`${root}/supabase/migrations/20260910131500_tracking_candidate_foreign_key_indexes.sql`, "utf8");
const trackingResourceSelection = await readFile(`${root}/supabase/migrations/20260910133500_tracking_resource_selection.sql`, "utf8");
const trackingLivePreflight = await readFile(`${root}/supabase/migrations/20260910174500_tracking_live_preflight.sql`, "utf8");
const trackingWorkspaceExecution = await readFile(`${root}/supabase/migrations/20260910181500_tracking_approved_workspace_execution.sql`, "utf8");
const trackingExecutionIndex = await readFile(`${root}/supabase/migrations/20260910182500_tracking_execution_agency_index.sql`, "utf8");
const trackingCompleteLifecycle = await readFile(`${root}/supabase/migrations/20260910193000_tracking_complete_lifecycle.sql`, "utf8");
const trackingMissingStack = await readFile(`${root}/supabase/migrations/20260910194500_tracking_missing_stack_creation.sql`, "utf8");

test("a fresh database can reconstruct DNA and agent memory", () => {
  for (const table of ["client_dna_profiles", "client_intelligence_sources", "agent_threads", "agent_messages"]) {
    assert.match(foundation, new RegExp(`create table public\\.${table}`));
    assert.match(foundation, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

test("tracking candidates require approval, exact hash and preview validation", () => {
  assert.match(trackingCandidate, /create table public\.tracking_candidate_artifacts/);
  assert.match(trackingCandidate, /enable row level security/);
  for (const command of ["platform_prepare_tracking_candidate", "platform_tracking_execution_gate", "platform_record_tracking_application"]) {
    assert.match(trackingCandidate, new RegExp(`create or replace function public\\.${command}`));
    assert.match(trackingCandidate, new RegExp(`revoke all on function public\\.${command}[^;]+ from public,anon,authenticated`));
  }
  assert.match(trackingCandidate, /v_a\.status='approved'/);
  assert.match(trackingCandidate, /config_hash=p_config_hash/);
  assert.match(trackingCandidate, /'publish',false/g);
});

test("tracking candidate foreign keys have supporting indexes", () => {
  assert.match(trackingCandidateIndexes, /tracking_candidate_agency_idx[\s\S]*\(agency_id\)/);
  assert.match(trackingCandidateIndexes, /tracking_candidate_profile_idx[\s\S]*\(profile_id\)/);
  assert.match(trackingCandidateIndexes, /tracking_candidate_actor_idx[\s\S]*\(created_by_actor_id\)/);
});

test("tracking resource selection is tenant-scoped, idempotent and cannot publish", () => {
  assert.match(trackingResourceSelection, /create table public\.tracking_resource_candidates/);
  assert.match(trackingResourceSelection, /enable row level security/);
  assert.match(trackingResourceSelection, /agency_id=v_actor\.agency_id and client_id=p_client_id and profile_id=v_profile\.id/);
  assert.match(trackingResourceSelection, /pg_advisory_xact_lock/);
  assert.match(trackingResourceSelection, /command_type='tracking_resource_selection'/);
  assert.match(trackingResourceSelection, /'external_writes',false/);
  for (const command of ["platform_record_tracking_resource_candidates", "platform_select_tracking_resources"]) {
    assert.match(trackingResourceSelection, new RegExp(`revoke all on function public\\.${command}[^;]+ from public,anon,authenticated`));
    assert.match(trackingResourceSelection, new RegExp(`grant execute on function public\\.${command}[^;]+ to service_role`));
  }
});

test("live tracking preflight is hash-bound, read-only and service-role only", () => {
  assert.match(trackingLivePreflight, /config_hash=p_config_hash/);
  assert.match(trackingLivePreflight, /command_type='tracking_live_preflight'/);
  assert.match(trackingLivePreflight, /pg_advisory_xact_lock/);
  assert.match(trackingLivePreflight, /'external_writes',false/g);
  for (const command of ["platform_tracking_preflight_context", "platform_record_tracking_preflight"]) {
    assert.match(trackingLivePreflight, new RegExp(`revoke all on function public\\.${command}[^;]+ from public,anon,authenticated`));
  }
});

test("workspace execution requires exact approval and can never publish", () => {
  assert.match(trackingWorkspaceExecution, /platform_tracking_execution_gate\(p_actor_id,p_deployment_id,p_config_hash\)/);
  assert.match(trackingWorkspaceExecution, /publish_allowed',false/);
  assert.match(trackingWorkspaceExecution, /'published',false/g);
  assert.match(trackingWorkspaceExecution, /status='provisioning'/);
  for(const command of ["platform_begin_tracking_workspace_execution","platform_record_tracking_workspace_execution"]){assert.match(trackingWorkspaceExecution,new RegExp(`revoke all on function public\\.${command}[^;]+ from public,anon,authenticated`))}
});

test("workspace execution agency foreign key has a supporting index",()=>{assert.match(trackingExecutionIndex,/tracking_execution_runs_agency_idx[\s\S]*\(agency_id\)/)});

test("tracking publication requires a second hash-bound approval",()=>{
  assert.match(trackingCompleteLifecycle,/tracking_publication/);
  assert.match(trackingCompleteLifecycle,/platform_request_tracking_publish_approval/);
  assert.match(trackingCompleteLifecycle,/platform_begin_tracking_publish/);
  assert.match(trackingCompleteLifecycle,/snapshot->>'config_hash'<>v_run\.config_hash/);
  assert.match(trackingCompleteLifecycle,/snapshot->>'version_path'<>v_run\.version_path/);
  assert.match(trackingCompleteLifecycle,/platform_record_tracking_production_validation/);
  for(const command of ["platform_record_tracking_staging","platform_request_tracking_publish_approval","platform_begin_tracking_publish","platform_record_tracking_publication","platform_record_tracking_production_validation"]){assert.match(trackingCompleteLifecycle,new RegExp(`revoke all on function public\\.${command}[^;]+ from public,anon,authenticated`))}
});

test("missing GTM and GA4 resources can only be created after approval",()=>{
  assert.match(trackingMissingStack,/platform_tracking_resource_creation_gate/);
  assert.match(trackingMissingStack,/v_a\.status<>'approved'/);
  assert.match(trackingMissingStack,/p_gtm_account!~'\^accounts\/\[0-9\]\+\$'/);
  assert.match(trackingMissingStack,/platform_record_created_tracking_stack/);
  assert.match(trackingMissingStack,/tracking_missing_stack_created/);
  for(const command of ["platform_tracking_resource_creation_gate","platform_record_created_tracking_stack"]){assert.match(trackingMissingStack,new RegExp(`revoke all on function public\\.${command}[^;]+ from public,anon,authenticated`))}
});

test("tracking change plan is deterministic, validated and approval-backed", () => {
  for (const command of ["platform_build_tracking_change_plan", "platform_request_tracking_approval"]) {
    assert.match(trackingApproval, new RegExp(`create or replace function public\\.${command}`));
    assert.match(trackingApproval, new RegExp(`revoke all on function public\\.${command}[^;]+ from public, anon, authenticated`));
    assert.match(trackingApproval, new RegExp(`grant execute on function public\\.${command}[^;]+ to service_role`));
  }
  assert.match(trackingApproval, /pg_advisory_xact_lock/);
  assert.match(trackingApproval, /duplicate_events/);
  assert.match(trackingApproval, /recursion_guard/);
  assert.match(trackingApproval, /'external_writes',false/g);
  assert.match(trackingApproval, /source_type='tracking_deployment'/);
});

test("tracking discovery reconciliation validates tenant context and cannot write externally", () => {
  assert.match(discovery, /platform_record_tracking_discovery/);
  assert.match(discovery, /agency_id=v_actor\.agency_id and client_id=p_client_id/);
  assert.match(discovery, /'external_writes',false/);
  assert.match(discovery, /revoke all on function public\.platform_record_tracking_discovery[^;]+ from public, anon, authenticated/);
});

test("tracking provisioning is tenant-scoped, idempotent and service-role only", () => {
  for (const table of ["tracking_templates", "tracking_profiles", "tracking_resources", "tracking_deployments", "tracking_validations"]) {
    assert.match(tracking, new RegExp(`create table public\\.${table}`));
    assert.match(tracking, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  for (const command of ["platform_tracking_workspace", "platform_prepare_tracking_plan"]) {
    assert.match(tracking, new RegExp(`create or replace function public\\.${command}`));
    assert.match(tracking, new RegExp(`revoke all on function public\\.${command}[^;]+ from public, anon, authenticated`));
  }
  assert.match(tracking, /pg_advisory_xact_lock/);
  assert.match(tracking, /'external_writes',false/);
});

test("transactional commands are service-role only", () => {
  for (const command of ["platform_onboard_client", "platform_record_conversation", "platform_submit_google_ads", "platform_decide_approval"]) {
    assert.match(stabilization, new RegExp(`create or replace function public\\.${command}`));
    assert.match(stabilization, new RegExp(`revoke all on function public\\.${command}[^;]+ from public, anon, authenticated`));
    assert.match(stabilization, new RegExp(`grant execute on function public\\.${command}[^;]+ to service_role`));
  }
});

test("idempotent commands persist receipts under an agency scope", () => {
  assert.match(stabilization, /primary key \(agency_id, idempotency_key\)/);
  assert.match(stabilization, /pg_advisory_xact_lock/g);
  assert.match(stabilization, /platform_command_receipts/g);
});

test("AI usage and cost policies are isolated behind the service role", () => {
  for (const table of ["ai_cost_policies", "ai_usage_events"]) {
    assert.match(gateway, new RegExp(`create table public\\.${table}`));
    assert.match(gateway, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(gateway, /enabled boolean not null default false/);
  assert.match(gateway, /grant execute on function public\.platform_record_ai_usage[^;]+ to service_role/);
});

test("AI runtime checks budget and records provider-aware conversations", () => {
  for (const command of ["platform_ai_budget_status", "platform_record_conversation_v2"]) {
    assert.match(runtime, new RegExp(`create or replace function public\\.${command}`));
    assert.match(runtime, new RegExp(`revoke all on function public\\.${command}[^;]+ from public, anon, authenticated`));
    assert.match(runtime, new RegExp(`grant execute on function public\\.${command}[^;]+ to service_role`));
  }
  assert.match(runtime, /created_at>=date_trunc\('month',now\(\)\)/);
});
