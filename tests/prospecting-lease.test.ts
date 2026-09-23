import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  ProspectingLeaseManager,
  EXECUTION_DEADLINE_MS,
  MAX_JOB_ATTEMPTS,
} from "../lib/prospecting/prospecting-lease-manager.ts";

describe("Prospecting Lease Manager & Governance (Condições 1, 2, 3, 6, 7, 8)", () => {
  let manager: ProspectingLeaseManager;

  beforeEach(() => {
    manager = new ProspectingLeaseManager(null);
  });

  it("sets first_leased_at and immutable 5-minute execution_deadline_at on first claim", () => {
    const job = manager.createJob({
      agency_id: "agency_1",
      query: "Vidraçaria",
      location: "Sorocaba - SP",
      limit: 10,
    });

    assert.equal(job.first_leased_at, null);
    assert.equal(job.execution_deadline_at, null);
    assert.equal(job.attempt_count, 0);

    const claimRes = manager.claimJob("worker_test_1");
    assert.equal(claimRes.claimed, true);
    assert.ok(claimRes.job);

    const firstLeasedAt = claimRes.job.first_leased_at;
    const deadlineAt = claimRes.job.execution_deadline_at;
    assert.ok(firstLeasedAt);
    assert.ok(deadlineAt);

    // Prazo máximo de exatamente 5 minutos a partir do primeiro claim
    const diffMs = new Date(deadlineAt).getTime() - new Date(firstLeasedAt).getTime();
    assert.equal(diffMs, EXECUTION_DEADLINE_MS);
    assert.equal(claimRes.job.attempt_count, 1);
  });

  it("heartbeat renews operational lease but NEVER extends execution_deadline_at", () => {
    manager.createJob({
      agency_id: "agency_1",
      query: "Vidraçaria",
      location: "Sorocaba - SP",
    });

    const claimRes = manager.claimJob("worker_test_1");
    const originalDeadline = claimRes.execution_deadline_at;
    const originalOperLease = claimRes.lease_expires_at;

    // Simula passagem de tempo para o heartbeat
    const hbRes = manager.heartbeat(
      claimRes.job!.id,
      claimRes.lease_id!,
      "worker_test_1"
    );

    assert.equal(hbRes.acknowledged, true);
    // execution_deadline_at deve ser estritamente o mesmo
    assert.equal(hbRes.execution_deadline_at, originalDeadline);
    // operational lease foi renovado
    assert.ok(hbRes.lease_expires_at);
  });

  it("enforces rigid attempt_count limit (max 2 attempts) and rejects terminal states", () => {
    const job = manager.createJob({
      agency_id: "agency_1",
      query: "Vidraçaria",
      location: "Sorocaba - SP",
    });

    // 1ª tentativa
    const claim1 = manager.claimJob("worker_1");
    assert.equal(claim1.claimed, true);
    assert.equal(claim1.job?.attempt_count, 1);

    // Simula expiração do lease operacional curto para permitir retomada
    const jobRef = manager.getJob(job.id)!;
    // @ts-ignore - teste interno de expiração
    jobRef.lease_expires_at = new Date(Date.now() - 1000).toISOString();
    // @ts-ignore
    manager["jobs"].set(job.id, jobRef);

    // 2ª tentativa
    const claim2 = manager.claimJob("worker_2");
    assert.equal(claim2.claimed, true);
    assert.equal(claim2.job?.attempt_count, 2);

    // Simula nova expiração
    const jobRef2 = manager.getJob(job.id)!;
    // @ts-ignore
    jobRef2.lease_expires_at = new Date(Date.now() - 1000).toISOString();
    // @ts-ignore
    manager["jobs"].set(job.id, jobRef2);

    // 3ª tentativa DEVE ser bloqueada pelo limite rígido
    const claim3 = manager.claimJob("worker_3");
    assert.equal(claim3.claimed, false);
    const finalJob = manager.getJob(job.id)!;
    assert.equal(finalJob.status, "failed");
    assert.equal(finalJob.error_reason, "max_attempts_exceeded");
  });

  it("never allows claiming blocked, cancelled, or completed jobs", () => {
    const job1 = manager.createJob({ agency_id: "a1", query: "q1", location: "loc" });
    const job2 = manager.createJob({ agency_id: "a1", query: "q2", location: "loc" });
    const job3 = manager.createJob({ agency_id: "a1", query: "q3", location: "loc" });

    // Força estados
    // @ts-ignore
    manager["jobs"].get(job1.id)!.status = "blocked";
    // @ts-ignore
    manager["jobs"].get(job2.id)!.status = "cancelled";
    // @ts-ignore
    manager["jobs"].get(job3.id)!.status = "completed";

    const claimRes = manager.claimJob("worker_1");
    assert.equal(claimRes.claimed, false);
  });

  it("deduplicates leads via compound identity_key (job_id, identity_key) and filters DNC", () => {
    const job = manager.createJob({
      agency_id: "agency_1",
      query: "Vidraçaria",
      location: "Sorocaba - SP",
    });

    const claim = manager.claimJob("worker_1");

    // Cadastra um registro no Do Not Contact durável
    manager.addDncRecord({
      rawIdentifier: "cid:9999999999",
      scope: "agency",
      agency_id: "agency_1",
      reason: "Empresa solicitou exclusão",
    });

    const completeRes = manager.completeJob({
      worker_id: "worker_1",
      job_id: job.id,
      lease_id: claim.lease_id!,
      idempotency_key: "idem_1",
      leads: [
        {
          name: "Vidraçaria Alvorada",
          cid: "1111111111",
          phone: "(15) 3222-0000",
        },
        // Lead duplicado (mesmo CID)
        {
          name: "Vidraçaria Alvorada Filial",
          cid: "1111111111",
          phone: "(15) 3222-0000",
        },
        // Lead em DNC
        {
          name: "Vidraçaria Bloqueada",
          cid: "9999999999",
          phone: "(15) 3333-4444",
        },
        // Lead sem identidade válida (só nome) -> descartado
        {
          name: "Nome Sem Nada Mais",
        },
        // Lead válido por Place ID
        {
          name: "Vidraçaria Modelo",
          place_id: "ChIJ12345678",
          phone: "(15) 3444-5555",
        },
      ],
    });

    assert.equal(completeRes.success, true);
    assert.equal(completeRes.total_received, 5);
    assert.equal(completeRes.total_saved, 2); // Alvorada e Modelo
    assert.equal(completeRes.duplicates_discarded, 2); // Duplicado e o sem dados
    assert.equal(completeRes.dnc_filtered, 1); // Bloqueado em DNC

    const savedLeads = manager.getLeadsForJob(job.id);
    assert.equal(savedLeads.length, 2);
    assert.equal(savedLeads[0].name, "Vidraçaria Alvorada");
    assert.equal(savedLeads[1].name, "Vidraçaria Modelo");
  });

  it("records sanitized block telemetry without saving HTML or CAPTCHAs", () => {
    const job = manager.createJob({
      agency_id: "agency_1",
      query: "Vidraçaria",
      location: "Sorocaba - SP",
    });
    const claim = manager.claimJob("worker_1");

    manager.failJob({
      worker_id: "worker_1",
      job_id: job.id,
      lease_id: claim.lease_id!,
      reason: "Captcha encountered on Maps page",
      is_blocked: true,
      block_telemetry: {
        block_type: "captcha_detected",
        sanitized_url: "https://www.google.com/maps/search/Vidracaria",
        http_status: 429,
        detected_at: new Date().toISOString(),
        collector_version: "v1.18.1-549e4b5",
      },
    });

    const updated = manager.getJob(job.id)!;
    assert.equal(updated.status, "blocked");

    const telemetry = manager.getBlockTelemetry(job.id)!;
    assert.ok(telemetry);
    assert.equal(telemetry.block_type, "captcha_detected");
    assert.equal(telemetry.http_status, 429);
    // @ts-ignore - garante que não há propriedades de HTML bruto
    assert.equal(telemetry.raw_html, undefined);
    // @ts-ignore
    assert.equal(telemetry.captcha_image, undefined);
  });

  it("limits access audit to essential fields without logging operator IP", () => {
    manager.recordAuditLog({
      user_id: "user_operator_1",
      agency_id: "agency_1",
      action: "prospecting_job_created",
    });

    const logs = manager.getAuditLogs();
    assert.equal(logs.length, 1);
    assert.equal(logs[0].user_id, "user_operator_1");
    assert.equal(logs[0].agency_id, "agency_1");
    assert.equal(logs[0].action, "prospecting_job_created");
    assert.ok(logs[0].timestamp);
    // @ts-ignore - assegura que IP não existe no log
    assert.equal(logs[0].ip, undefined);
    // @ts-ignore
    assert.equal(logs[0].ip_address, undefined);
  });
});
