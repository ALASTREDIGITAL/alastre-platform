import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ProspectingLeaseManager,
  QUEUE_TIMEOUT_MS,
  EXECUTION_DEADLINE_MS,
  SUPERVISOR_HEARTBEAT_THRESHOLD_MS,
} from "../lib/prospecting/prospecting-lease-manager.ts";

const TEST_STORE_PATH = path.resolve(
  process.cwd(),
  "scripts",
  "poc",
  "work",
  "test-supervisor-health-store.json"
);

function cleanupTestStore() {
  if (fs.existsSync(TEST_STORE_PATH)) {
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {}
  }
}

test("Supervisor Health: reporta offline quando nenhum batimento foi recebido", () => {
  cleanupTestStore();
  const manager = new ProspectingLeaseManager(TEST_STORE_PATH);
  const health = manager.getSupervisorHealth();

  assert.strictEqual(health.online, false);
  assert.strictEqual(health.last_heartbeat, null);
  assert.strictEqual(health.worker_id, null);
  assert.match(health.message, /offline/i);
  cleanupTestStore();
});

test("Supervisor Health: reporta online quando batimento recente é registrado", () => {
  cleanupTestStore();
  const manager = new ProspectingLeaseManager(TEST_STORE_PATH);
  manager.recordSupervisorHeartbeat("worker_daemon_test", ["local_chromium_scraper"]);

  const health = manager.getSupervisorHealth();
  assert.strictEqual(health.online, true);
  assert.strictEqual(health.worker_id, "worker_daemon_test");
  assert.ok(health.last_heartbeat);
  assert.match(health.message, /online/i);
  cleanupTestStore();
});

test("Timeout de Fila: job queued sem claim por mais de 30s é expirado para failed", () => {
  cleanupTestStore();
  const manager = new ProspectingLeaseManager(TEST_STORE_PATH);

  // Cria um job
  const job = manager.createJob({
    agency_id: "agency_timeout_test",
    query: "Vidraçaria",
    location: "Sorocaba - SP",
    limit: 10,
  });

  assert.strictEqual(job.status, "queued");
  assert.ok(job.queue_deadline_at);

  // Simula passagem de 31 segundos no queue_deadline_at
  const pastDeadline = new Date(Date.now() - 1000).toISOString();
  // Altera diretamente o campo no store simulando o tempo decorrido
  const storedJob = manager.getJob(job.id);
  assert.ok(storedJob);
  (storedJob as any).queue_deadline_at = pastDeadline;
  (manager as any).jobs.set(job.id, storedJob);
  (manager as any).saveToFile();

  // Executa a varredura
  manager.sweepExpiredJobs();

  const sweptJob = manager.getJob(job.id);
  assert.ok(sweptJob);
  assert.strictEqual(sweptJob.status, "failed");
  assert.strictEqual(sweptJob.error_reason, "supervisor_unavailable_timeout");

  // Confirma que não é considerado job ativo (libera o formulário)
  assert.strictEqual(manager.hasActiveJob("agency_timeout_test"), false);
  cleanupTestStore();
});

test("Cancelamento Imediato: cancelar job em fila altera status imediatamente para cancelled", () => {
  cleanupTestStore();
  const manager = new ProspectingLeaseManager(TEST_STORE_PATH);

  const job = manager.createJob({
    agency_id: "agency_cancel_test",
    query: "Vidraçaria",
    location: "Sorocaba - SP",
    limit: 10,
  });

  assert.strictEqual(job.status, "queued");

  // Requisito 7: Cancelar job ainda enfileirado
  const success = manager.requestCancellation(job.id, "operador_cancelou_na_fila");
  assert.strictEqual(success, true);

  const updatedJob = manager.getJob(job.id);
  assert.ok(updatedJob);
  assert.strictEqual(updatedJob.status, "cancelled");
  assert.strictEqual(updatedJob.error_reason, "operador_cancelou_na_fila");

  // Confirma que hasActiveJob retorna false no mesmo instante
  assert.strictEqual(manager.hasActiveJob("agency_cancel_test"), false);
  cleanupTestStore();
});

test("Deadline Total de 5 Minutos: job com mais de 5 minutos é encerrado com failed", () => {
  cleanupTestStore();
  const manager = new ProspectingLeaseManager(TEST_STORE_PATH);

  const job = manager.createJob({
    agency_id: "agency_deadline_test",
    query: "Vidraçaria",
    location: "Sorocaba - SP",
    limit: 10,
  });

  // Simula que o deadline de 5 minutos expirou
  const storedJob = manager.getJob(job.id);
  assert.ok(storedJob);
  storedJob.execution_deadline_at = new Date(Date.now() - 1000).toISOString();
  storedJob.status = "leased";
  (manager as any).jobs.set(job.id, storedJob);
  (manager as any).saveToFile();

  manager.sweepExpiredJobs();

  const sweptJob = manager.getJob(job.id);
  assert.ok(sweptJob);
  assert.strictEqual(sweptJob.status, "failed");
  assert.strictEqual(sweptJob.error_reason, "execution_deadline_exceeded");
  cleanupTestStore();
});
