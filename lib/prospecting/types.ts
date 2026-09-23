import { z } from "zod";

export const ProspectingJobStatusSchema = z.enum([
  "queued",
  "leased",
  "completed",
  "blocked",
  "cancelled",
  "cancellation_requested",
  "failed",
]);
export type ProspectingJobStatus = z.infer<typeof ProspectingJobStatusSchema>;

export const ProspectingJobSchema = z.object({
  id: z.string(),
  agency_id: z.string(),
  query: z.string().min(1),
  location: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10),
  status: ProspectingJobStatusSchema,
  attempt_count: z.number().int().min(0).default(0),
  first_leased_at: z.string().nullable().default(null),
  queue_deadline_at: z.string().nullable().default(null),
  execution_deadline_at: z.string().nullable().default(null),
  lease_id: z.string().nullable().default(null),
  leased_at: z.string().nullable().default(null),
  lease_expires_at: z.string().nullable().default(null),
  heartbeat_at: z.string().nullable().default(null),
  worker_id: z.string().nullable().default(null),
  idempotency_key: z.string().nullable().default(null),
  error_reason: z.string().nullable().default(null),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ProspectingJob = z.infer<typeof ProspectingJobSchema>;

export const WorkerPingRequestSchema = z.object({
  worker_id: z.string().min(1),
  supported_capabilities: z.array(z.string()).optional(),
  timestamp: z.string().optional(),
});
export type WorkerPingRequest = z.infer<typeof WorkerPingRequestSchema>;

export const SupervisorStatusResponseSchema = z.object({
  online: z.boolean(),
  last_heartbeat: z.string().nullable(),
  seconds_since_heartbeat: z.number().nullable(),
  worker_id: z.string().nullable(),
  message: z.string(),
});
export type SupervisorStatusResponse = z.infer<typeof SupervisorStatusResponseSchema>;

export const ProspectingLeadSchema = z.object({
  id: z.string(),
  job_id: z.string(),
  identity_key: z.string().min(1),
  name: z.string().min(1),
  category: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  rating: z.number().nullable(),
  review_count: z.number().int().nullable(),
  maps_url: z.string().nullable(),
  place_id: z.string().nullable(),
  cid: z.string().nullable(),
  created_at: z.string(),
});
export type ProspectingLead = z.infer<typeof ProspectingLeadSchema>;

export const BlockTypeSchema = z.enum([
  "http_429",
  "captcha_detected",
  "unusual_traffic",
  "ip_forbidden",
  "blocked_other",
]);
export type BlockType = z.infer<typeof BlockTypeSchema>;

export const SanitizedBlockTelemetrySchema = z.object({
  block_type: BlockTypeSchema,
  sanitized_url: z.string(),
  http_status: z.number().int().nullable(),
  detected_at: z.string(),
  collector_version: z.string(),
});
export type SanitizedBlockTelemetry = z.infer<typeof SanitizedBlockTelemetrySchema>;

export const DncScopeSchema = z.enum(["agency", "global"]);
export type DncScope = z.infer<typeof DncScopeSchema>;

export const DncRecordSchema = z.object({
  identity_hash: z.string().length(64), // sha256 hex
  scope: DncScopeSchema,
  agency_id: z.string().nullable(),
  reason: z.string(),
  created_at: z.string(),
});
export type DncRecord = z.infer<typeof DncRecordSchema>;

export const AccessAuditLogSchema = z.object({
  user_id: z.string(),
  agency_id: z.string(),
  action: z.string(),
  timestamp: z.string(),
});
export type AccessAuditLog = z.infer<typeof AccessAuditLogSchema>;

// Worker API Schemas
export const WorkerClaimRequestSchema = z.object({
  worker_id: z.string().min(1),
  supported_capabilities: z.array(z.string()).optional(),
});
export type WorkerClaimRequest = z.infer<typeof WorkerClaimRequestSchema>;

export const WorkerClaimResponseSchema = z.object({
  claimed: z.boolean(),
  job: ProspectingJobSchema.nullable(),
  lease_id: z.string().nullable(),
  lease_expires_at: z.string().nullable(),
  execution_deadline_at: z.string().nullable(),
  message: z.string().optional(),
});
export type WorkerClaimResponse = z.infer<typeof WorkerClaimResponseSchema>;

export const WorkerHeartbeatRequestSchema = z.object({
  worker_id: z.string().min(1),
  job_id: z.string().min(1),
  lease_id: z.string().min(1),
});
export type WorkerHeartbeatRequest = z.infer<typeof WorkerHeartbeatRequestSchema>;

export const WorkerHeartbeatResponseSchema = z.object({
  acknowledged: z.boolean(),
  lease_expires_at: z.string().nullable(),
  execution_deadline_at: z.string().nullable(),
  cancellation_requested: z.boolean(),
  status: ProspectingJobStatusSchema,
});
export type WorkerHeartbeatResponse = z.infer<typeof WorkerHeartbeatResponseSchema>;

export const WorkerRawLeadItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().nullish(),
  address: z.string().nullish(),
  phone: z.string().nullish(),
  website: z.string().nullish(),
  rating: z.number().nullish(),
  review_count: z.number().int().nullish(),
  maps_url: z.string().nullish(),
  place_id: z.string().nullish(),
  cid: z.string().nullish(),
});
export type WorkerRawLeadItem = z.infer<typeof WorkerRawLeadItemSchema>;

export const WorkerCompleteRequestSchema = z.object({
  worker_id: z.string().min(1),
  job_id: z.string().min(1),
  lease_id: z.string().min(1),
  idempotency_key: z.string().min(1),
  leads: z.array(WorkerRawLeadItemSchema).max(50),
});
export type WorkerCompleteRequest = z.infer<typeof WorkerCompleteRequestSchema>;

export const WorkerCompleteResponseSchema = z.object({
  success: z.boolean(),
  total_received: z.number(),
  total_saved: z.number(),
  duplicates_discarded: z.number(),
  dnc_filtered: z.number(),
});
export type WorkerCompleteResponse = z.infer<typeof WorkerCompleteResponseSchema>;

export const WorkerFailRequestSchema = z.object({
  worker_id: z.string().min(1),
  job_id: z.string().min(1),
  lease_id: z.string().min(1),
  reason: z.string().min(1),
  is_blocked: z.boolean().default(false),
  block_telemetry: SanitizedBlockTelemetrySchema.optional(),
});
export type WorkerFailRequest = z.infer<typeof WorkerFailRequestSchema>;

export const WorkerFailResponseSchema = z.object({
  acknowledged: z.boolean(),
  status: ProspectingJobStatusSchema,
});
export type WorkerFailResponse = z.infer<typeof WorkerFailResponseSchema>;
