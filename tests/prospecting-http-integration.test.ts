import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess, execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const BASE_URL = "http://127.0.0.1:5176";

let EPHEMERAL_TOKEN = process.env.PROSPECTING_WORKER_SECRET_TOKEN || "";
let serverChild: ChildProcess | null = null;

describe("Prospecting HTTP Integrated Routes with Ephemeral Secret (Requisitos 2 e 5)", () => {
  before(async () => {
    // 1. Limpa qualquer processo que esteja ocupando a porta 5176
    if (process.platform === "win32") {
      try {
        const { stdout } = await execFileAsync(
          "cmd.exe",
          ["/c", "netstat -ano | findstr :5176"],
          { timeout: 3000 }
        );
        const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (Number(pid) > 0) {
            await execFileAsync("taskkill.exe", ["/F", "/PID", pid], { timeout: 2000 }).catch(() => {});
          }
        }
      } catch {}
    }

    // 2. Lê o segredo configurado sem alterar o .env.local em disco
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    if (!EPHEMERAL_TOKEN) {
      try {
        const envLocalPath = path.resolve(process.cwd(), ".env.local");
        const envContent = await fs.readFile(envLocalPath, "utf8");
        const matches = [...envContent.matchAll(/PROSPECTING_WORKER_SECRET_TOKEN=([^\r\n]+)/g)];
        if (matches.length > 0) {
          EPHEMERAL_TOKEN = matches[matches.length - 1][1].trim();
        }
      } catch {}
    }
    if (!EPHEMERAL_TOKEN) {
      EPHEMERAL_TOKEN = "alastre-homolog-token-live-session";
    }

    // 3. Inicia o servidor Vite na porta 5176 diretamente pelo runtime node
    const viteBin = path.resolve(process.cwd(), "node_modules", "vite", "bin", "vite.js");
    serverChild = spawn(process.execPath, [viteBin, "--port", "5176", "--force"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        WRANGLER_LOG_PATH: ".wrangler/wrangler.log",
        PROSPECTING_WORKER_SECRET_TOKEN: EPHEMERAL_TOKEN,
      },
      windowsHide: true,
    });

    serverChild.stdout?.on("data", () => {});
    serverChild.stderr?.on("data", () => {});

    // 4. Aguarda o servidor inicializar e responder na porta 5176
    let ready = false;
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch(`${BASE_URL}/api/internal/prospecting/worker/jobs`);
        if (res.status === 401) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 800));
    }

    assert.ok(
      ready,
      "Servidor em 127.0.0.1:5176 deve inicializar com segredo efêmero e responder 401 para chamadas sem token"
    );
  });

  after(async () => {
    // Encerramento completo e forçado da árvore do servidor de teste ao final
    if (serverChild && serverChild.pid) {
      if (process.platform === "win32") {
        try {
          await execFileAsync("taskkill.exe", ["/F", "/T", "/PID", String(serverChild.pid)], { timeout: 2000 });
        } catch {}
      } else {
        try {
          serverChild.kill("SIGKILL");
        } catch {}
      }
    }

    // Confirma que a porta 5176 foi liberada
    await new Promise((r) => setTimeout(r, 600));
    let isPortClosed = true;
    try {
      await fetch(`${BASE_URL}/api/internal/prospecting/worker/jobs`);
      isPortClosed = false;
    } catch {
      isPortClosed = true;
    }

    assert.equal(isPortClosed, true, "Porta 5176 deve estar completamente encerrada após o teste");
  });

  it("proves fail-closed security and full 4-route lifecycle using the ephemeral secret", async () => {
    // 1. Verificação fail-closed: token inválido deve receber 401
    const invalidAuthRes = await fetch(`${BASE_URL}/api/internal/prospecting/worker/jobs`, {
      method: "POST",
      headers: {
        Authorization: "Bearer token-invalido-inexistente",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "teste" }),
    });
    assert.equal(invalidAuthRes.status, 401, "Token inválido deve ser rejeitado com HTTP 401");

    // Headers com o token efêmero legítimo
    const authHeaders = {
      Authorization: `Bearer ${EPHEMERAL_TOKEN}`,
      "Content-Type": "application/json",
    };

    // Reseta store de teste
    await fetch(`${BASE_URL}/api/internal/prospecting/worker/jobs`, {
      method: "DELETE",
      headers: authHeaders,
    });

    // =========================================================================
    // 2. Criação do Job via Rota Interna (simulando orquestrador)
    // =========================================================================
    const createJobRes = await fetch(`${BASE_URL}/api/internal/prospecting/worker/jobs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        agency_id: "agency_test_ephemeral",
        query: "Vidraçaria",
        location: "Sorocaba - SP",
        limit: 5,
      }),
    });

    assert.equal(createJobRes.status, 201, "Criação de job deve retornar HTTP 201");
    const createJobData = await createJobRes.json();
    assert.equal(createJobData.success, true);
    assert.ok(createJobData.job);
    assert.equal(createJobData.job.status, "queued");

    const jobId = createJobData.job.id;

    // =========================================================================
    // 3. Rota 1: POST /api/internal/prospecting/worker/claim
    // =========================================================================
    const claimRes = await fetch(`${BASE_URL}/api/internal/prospecting/worker/claim`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        worker_id: "worker_ephemeral_01",
      }),
    });

    assert.equal(claimRes.status, 200, "Claim HTTP status deve ser 200");
    const claimData = await claimRes.json();
    assert.equal(claimData.claimed, true, "Job deve ser reivindicado com sucesso");
    assert.ok(claimData.lease_id, "Deve retornar lease_id");
    assert.ok(claimData.job.first_leased_at, "Deve registrar first_leased_at no job");
    assert.ok(claimData.execution_deadline_at, "Deve registrar deadline imutável de 5 min");
    assert.ok(claimData.lease_expires_at, "Deve registrar lease operacional curto");
    assert.equal(claimData.job.id, jobId);

    const leaseId = claimData.lease_id;

    // =========================================================================
    // 4. Rota 2: POST /api/internal/prospecting/worker/heartbeat
    // =========================================================================
    const hbRes = await fetch(`${BASE_URL}/api/internal/prospecting/worker/heartbeat`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        worker_id: "worker_ephemeral_01",
        job_id: jobId,
        lease_id: leaseId,
      }),
    });

    assert.equal(hbRes.status, 200, "Heartbeat HTTP status deve ser 200");
    const hbData = await hbRes.json();
    assert.equal(hbData.acknowledged, true);
    assert.equal(hbData.cancellation_requested, false);
    assert.ok(hbData.lease_expires_at, "Heartbeat deve renovar lease operacional curto");
    assert.equal(
      hbData.execution_deadline_at,
      claimData.execution_deadline_at,
      "Heartbeat NUNCA estende o deadline imutável"
    );

    // =========================================================================
    // 5. Rota 3: POST /api/internal/prospecting/worker/complete
    // =========================================================================
    const completeRes = await fetch(`${BASE_URL}/api/internal/prospecting/worker/complete`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        worker_id: "worker_ephemeral_01",
        job_id: jobId,
        lease_id: leaseId,
        idempotency_key: `idem_ephemeral_${Date.now()}`,
        leads: [
          {
            name: "Vidraçaria Real Ephemeral",
            category: "Vidraçaria",
            address: "Av. Sorocaba, 100",
            phone: "(15) 3232-0001",
            cid: "7777777777777777",
            rating: 4.9,
            review_count: 80,
            maps_url: "https://www.google.com/maps?cid=7777777777777777",
          },
          {
            name: "Vidraçaria Sem Avaliações",
            category: "Vidraçaria",
            address: "Rua das Flores, 200",
            phone: null,
            place_id: "ChIJsemavaliacoes001",
            rating: null,
            review_count: null,
            maps_url: "https://www.google.com/maps/place/SemAvaliacoes",
          },
        ],
      }),
    });

    assert.equal(completeRes.status, 200, "Complete HTTP status deve ser 200");
    const completeData = await completeRes.json();
    assert.equal(completeData.success, true);
    assert.equal(completeData.total_received, 2);
    assert.equal(completeData.total_saved, 2);

    // Validação de persistência via API
    const verifyJobRes = await fetch(`${BASE_URL}/api/internal/prospecting/worker/jobs?job_id=${jobId}`, {
      headers: authHeaders,
    });
    assert.equal(verifyJobRes.status, 200);
    const verifyJobData = await verifyJobRes.json();
    assert.equal(verifyJobData.job.status, "completed");
    assert.equal(verifyJobData.leads.length, 2);
    assert.equal(verifyJobData.leads[0].name, "Vidraçaria Real Ephemeral");
    assert.equal(verifyJobData.leads[0].rating, 4.9);
    assert.equal(verifyJobData.leads[1].rating, null, "Rating ausente deve permanecer null");
    assert.equal(verifyJobData.leads[1].phone, null, "Telefone ausente deve permanecer null");

    // =========================================================================
    // 6. Rota 4: POST /api/internal/prospecting/worker/fail (Bloqueio sanitizado)
    // =========================================================================
    const createJob2Res = await fetch(`${BASE_URL}/api/internal/prospecting/worker/jobs`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        agency_id: "agency_test_ephemeral",
        query: "Vidraçaria Bloqueio",
        location: "Sorocaba - SP",
      }),
    });
    const createJob2Data = await createJob2Res.json();
    const job2Id = createJob2Data.job.id;

    // Claim do job 2
    const claim2Res = await fetch(`${BASE_URL}/api/internal/prospecting/worker/claim`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ worker_id: "worker_ephemeral_01" }),
    });
    const claim2Data = await claim2Res.json();
    assert.equal(claim2Data.claimed, true);

    // Fail com telemetria sanitizada
    const failRes = await fetch(`${BASE_URL}/api/internal/prospecting/worker/fail`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        worker_id: "worker_ephemeral_01",
        job_id: job2Id,
        lease_id: claim2Data.lease_id,
        reason: "Simulação de 429 no Google Maps",
        is_blocked: true,
        block_telemetry: {
          block_type: "http_429",
          sanitized_url: "https://www.google.com/maps/search/vidracaria",
          http_status: 429,
          detected_at: new Date().toISOString(),
          collector_version: "v1.18.1-549e4b5",
        },
      }),
    });

    assert.equal(failRes.status, 200, "Fail HTTP status deve ser 200");
    const failData = await failRes.json();
    assert.equal(failData.acknowledged, true);
    assert.equal(failData.status, "blocked");

    // Validação da telemetria sanitizada via GET
    const verifyJob2Res = await fetch(`${BASE_URL}/api/internal/prospecting/worker/jobs?job_id=${job2Id}`, {
      headers: authHeaders,
    });
    const verifyJob2Data = await verifyJob2Res.json();
    assert.equal(verifyJob2Data.job.status, "blocked");
    assert.ok(verifyJob2Data.blockTelemetry);
    assert.equal(verifyJob2Data.blockTelemetry.block_type, "http_429");
  });
});
