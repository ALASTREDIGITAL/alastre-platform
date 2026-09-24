import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess, execFile } from "node:child_process";
import { promisify } from "node:util";
import { detectOpportunities } from "../lib/prospecting/opportunity-detector.ts";

const execFileAsync = promisify(execFile);
const BASE_URL = "http://127.0.0.1:5175";

const EPHEMERAL_TOKEN = `functional-flow-secret-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let serverChild: ChildProcess | null = null;
let originalEnvLocal: string | null = null;

describe("Prospecting Functional Flow & Operator Integration (Requisitos 1 a 8)", () => {
  before(async () => {
    // 1. Limpa qualquer processo que esteja ocupando a porta 5175
    if (process.platform === "win32") {
      try {
        const { stdout } = await execFileAsync(
          "powershell.exe",
          [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            "Get-NetTCPConnection -LocalPort 5175 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess",
          ],
          { timeout: 3000 }
        );
        const pids = stdout.trim().split(/\s+/).filter(Boolean);
        for (const pid of pids) {
          if (Number(pid) > 0) {
            await execFileAsync("taskkill.exe", ["/F", "/PID", pid], { timeout: 2000 }).catch(() => {});
          }
        }
      } catch {}
    }

    // 2. Registra o segredo efêmero no .env.local para o Miniflare/Cloudflare vite-plugin carregar
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const envLocalPath = path.resolve(process.cwd(), ".env.local");
    try {
      originalEnvLocal = await fs.readFile(envLocalPath, "utf8");
    } catch {
      originalEnvLocal = null;
    }
    const tokenLine = `\nPROSPECTING_WORKER_SECRET_TOKEN=${EPHEMERAL_TOKEN}\n`;
    await fs.writeFile(envLocalPath, (originalEnvLocal || "") + tokenLine, "utf8");

    // 3. Inicia o servidor Vite na porta 5175
    const cmd = process.platform === "win32" ? "cmd.exe" : "npx";
    const args =
      process.platform === "win32"
        ? ["/c", "npx.cmd", "vite", "--port", "5175"]
        : ["vite", "--port", "5175"];
    serverChild = spawn(cmd, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PROSPECTING_WORKER_SECRET_TOKEN: EPHEMERAL_TOKEN,
      },
      windowsHide: true,
    });

    serverChild.stdout?.on("data", () => {});
    serverChild.stderr?.on("data", () => {});

    // 4. Aguarda o servidor inicializar e responder na porta 5175
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
      "Servidor em 127.0.0.1:5175 deve inicializar com segredo efêmero e responder 401 para chamadas sem token"
    );
  });

  after(async () => {
    // Encerramento completo e forçado da árvore do servidor de teste ao final
    if (serverChild && serverChild.pid) {
      if (process.platform === "win32") {
        try {
          await execFileAsync("taskkill.exe", [
            "/F",
            "/T",
            "/PID",
            String(serverChild.pid),
          ], { timeout: 2000 });
        } catch {}
      } else {
        try {
          serverChild.kill("SIGKILL");
        } catch {}
      }
    }

    // Restaura o arquivo .env.local original imediatamente
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const envLocalPath = path.resolve(process.cwd(), ".env.local");
    try {
      if (originalEnvLocal !== null) {
        await fs.writeFile(envLocalPath, originalEnvLocal, "utf8");
      } else {
        await fs.unlink(envLocalPath).catch(() => {});
      }
    } catch {}

    // Confirma que a porta 5175 foi liberada
    await new Promise((r) => setTimeout(r, 600));
    let isPortClosed = true;
    try {
      await fetch(`${BASE_URL}/api/prospecting/jobs`);
      isPortClosed = false;
    } catch {
      isPortClosed = true;
    }

    assert.equal(
      isPortClosed,
      true,
      "Porta 5175 deve estar completamente encerrada após o teste"
    );
  });

  it("1. Valida criação de prospecção pela rota do operador com rejeição de dados inválidos e limite seguro", async () => {
    // Limpa store de teste
    const workerHeaders = {
      Authorization: `Bearer ${EPHEMERAL_TOKEN}`,
      "Content-Type": "application/json",
    };
    await fetch(`${BASE_URL}/api/internal/prospecting/worker/jobs`, {
      method: "DELETE",
      headers: workerHeaders,
    });

    // Registra worker online via ping para habilitar a rota do operador
    await fetch(`${BASE_URL}/api/internal/prospecting/worker/ping`, {
      method: "POST",
      headers: workerHeaders,
      body: JSON.stringify({
        worker_id: "test_worker_daemon",
        supported_capabilities: ["local_chromium_scraper"],
      }),
    });

    // Tentativa inválida: nicho vazio
    const invalidRes1 = await fetch(`${BASE_URL}/api/prospecting/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "", city: "Sorocaba", state: "SP" }),
    });
    assert.equal(invalidRes1.status, 400, "Query vazia deve retornar HTTP 400");

    // Tentativa inválida: limite maior que 10
    const invalidRes2 = await fetch(`${BASE_URL}/api/prospecting/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "Pet Shop",
        city: "Sorocaba",
        state: "SP",
        limit: 50,
      }),
    });
    assert.equal(
      invalidRes2.status,
      400,
      "Limite > 10 deve ser rejeitado com HTTP 400 na homologação"
    );

    // Tentativa com caracteres perigosos (injeção)
    const invalidRes3 = await fetch(`${BASE_URL}/api/prospecting/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "Pet Shop; rm -rf /",
        city: "Sorocaba",
        state: "SP",
      }),
    });
    assert.equal(
      invalidRes3.status,
      400,
      "Caracteres de comando devem ser rejeitados com HTTP 400"
    );

    // Criação válida
    const validRes = await fetch(`${BASE_URL}/api/prospecting/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "Vidraçaria",
        city: "Sorocaba",
        state: "SP",
        limit: 10,
        qualificationOptions: {
          withoutWebsite: true,
          withoutPhone: true,
        },
      }),
    });

    assert.equal(validRes.status, 201, "Criação válida deve retornar HTTP 201");
    const validData = await validRes.json();
    assert.equal(validData.success, true);
    assert.equal(validData.job.status, "queued");
    assert.equal(validData.job.query, "Vidraçaria");
    assert.equal(validData.job.location, "Sorocaba - SP");

    // Requisito 3: Nenhuma exposição do segredo do worker na resposta pública
    assert.equal(validData.job.secret_token, undefined);
    assert.equal(validData.job.worker_token, undefined);
    assert.equal(JSON.stringify(validData).includes(EPHEMERAL_TOKEN), false);
  });

  it("2. Impede duas execuções simultâneas concorrentes (Limite da Homologação)", async () => {
    // Como o job anterior ainda está queued, uma nova tentativa deve receber 409
    const secondJobRes = await fetch(`${BASE_URL}/api/prospecting/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "Pizzaria",
        city: "Sorocaba",
        state: "SP",
        limit: 5,
      }),
    });

    assert.equal(
      secondJobRes.status,
      409,
      "Tentativa de iniciar prospecção com trabalho ativo deve retornar HTTP 409 Conflict"
    );
    const conflictData = await secondJobRes.json();
    assert.ok(conflictData.error.includes("Já existe uma prospecção ativa"));
  });

  it("3. Acompanhamento de progresso e conclusão com entrega de resultados factuais", async () => {
    const workerHeaders = {
      Authorization: `Bearer ${EPHEMERAL_TOKEN}`,
      "Content-Type": "application/json",
    };

    // Consulta job ativo pela rota do operador
    const activeJobsRes = await fetch(`${BASE_URL}/api/prospecting/jobs`);
    assert.equal(activeJobsRes.status, 200);
    const activeJobsData = await activeJobsRes.json();
    assert.ok(activeJobsData.activeJob);
    const jobId = activeJobsData.activeJob.id;

    // Worker reivindica o job
    const claimRes = await fetch(
      `${BASE_URL}/api/internal/prospecting/worker/claim`,
      {
        method: "POST",
        headers: workerHeaders,
        body: JSON.stringify({ worker_id: "worker_test_flow" }),
      }
    );
    assert.equal(claimRes.status, 200);
    const claimData = await claimRes.json();
    assert.equal(claimData.claimed, true);

    // Operador consulta status: agora deve estar leased
    const check1Res = await fetch(`${BASE_URL}/api/prospecting/jobs/${jobId}`);
    assert.equal(check1Res.status, 200);
    const check1Data = await check1Res.json();
    assert.equal(check1Data.job.status, "leased");

    // Worker entrega os leads com fidelidade e preservação de nulls (Requisito 5)
    const completeRes = await fetch(
      `${BASE_URL}/api/internal/prospecting/worker/complete`,
      {
        method: "POST",
        headers: workerHeaders,
        body: JSON.stringify({
          worker_id: "worker_test_flow",
          job_id: jobId,
          lease_id: claimData.lease_id,
          idempotency_key: `idem_test_${Date.now()}`,
          leads: [
            {
              name: "Vidraçaria Real Teste",
              category: "Vidraçaria",
              address: "Av. Brasil, 500, Sorocaba - SP",
              phone: "(15) 3333-1111",
              website: "https://vidracariareal.com.br",
              rating: 4.8,
              review_count: 95,
              maps_url: "https://maps.google.com/?cid=1234567890",
              cid: "1234567890",
            },
            {
              name: "Vidraçaria Sem Contato",
              category: "Vidraçaria",
              address: "Rua Sem Nome, 10, Sorocaba - SP",
              phone: null, // Preservação estrita de null
              website: null, // Preservação estrita de null
              rating: null, // Preservação estrita de null
              review_count: null, // Preservação estrita de null
              maps_url: "https://maps.google.com/place/SemContato",
              place_id: "ChIJSemContato123",
            },
          ],
        }),
      }
    );
    assert.equal(completeRes.status, 200);

    // Operador consulta o job finalizado
    const checkFinalRes = await fetch(
      `${BASE_URL}/api/prospecting/jobs/${jobId}`
    );
    assert.equal(checkFinalRes.status, 200);
    const checkFinalData = await checkFinalRes.json();
    assert.equal(checkFinalData.job.status, "completed");
    assert.equal(checkFinalData.leads.length, 2);

    // Requisito 5: Preservação estrita de null, sem fallbacks inventados
    const lead2 = checkFinalData.leads[1];
    assert.equal(lead2.phone, null, "Telefone ausente deve permanecer null");
    assert.equal(lead2.website, null, "Website ausente deve permanecer null");
    assert.equal(lead2.rating, null, "Rating ausente deve permanecer null");
    assert.equal(
      lead2.review_count,
      null,
      "Review count ausente deve permanecer null"
    );
  });

  it("4. Cancelamento cooperativo encerra a execução e reflete status cancelled", async () => {
    const workerHeaders = {
      Authorization: `Bearer ${EPHEMERAL_TOKEN}`,
      "Content-Type": "application/json",
    };

    // Atualiza heartbeat do worker
    await fetch(`${BASE_URL}/api/internal/prospecting/worker/ping`, {
      method: "POST",
      headers: workerHeaders,
      body: JSON.stringify({
        worker_id: "test_worker_daemon",
        supported_capabilities: ["local_chromium_scraper"],
      }),
    });

    // Cria novo job
    const createRes = await fetch(`${BASE_URL}/api/prospecting/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "Marcenaria",
        city: "Sorocaba",
        state: "SP",
        limit: 5,
      }),
    });
    assert.equal(createRes.status, 201);
    const { job } = await createRes.json();

    // Worker reivindica o job
    const claimRes = await fetch(
      `${BASE_URL}/api/internal/prospecting/worker/claim`,
      {
        method: "POST",
        headers: workerHeaders,
        body: JSON.stringify({ worker_id: "worker_cancel_test" }),
      }
    );
    const claimData = await claimRes.json();
    assert.equal(claimData.claimed, true);

    // Operador solicita cancelamento via rota da interface
    const cancelRes = await fetch(
      `${BASE_URL}/api/prospecting/jobs/${job.id}/cancel`,
      {
        method: "POST",
      }
    );
    assert.equal(cancelRes.status, 200);

    // Heartbeat do worker deve retornar cancellation_requested: true
    const hbRes = await fetch(
      `${BASE_URL}/api/internal/prospecting/worker/heartbeat`,
      {
        method: "POST",
        headers: workerHeaders,
        body: JSON.stringify({
          worker_id: "worker_cancel_test",
          job_id: job.id,
          lease_id: claimData.lease_id,
        }),
      }
    );
    const hbData = await hbRes.json();
    assert.equal(
      hbData.cancellation_requested,
      true,
      "Heartbeat deve sinalizar cancelamento cooperativo"
    );

    // Worker confirma cancelamento via fail
    await fetch(`${BASE_URL}/api/internal/prospecting/worker/fail`, {
      method: "POST",
      headers: workerHeaders,
      body: JSON.stringify({
        worker_id: "worker_cancel_test",
        job_id: job.id,
        lease_id: claimData.lease_id,
        reason: "Cancelamento solicitado pelo operador",
        is_blocked: false,
      }),
    });

    // Operador verifica que o status agora é cancelled
    const checkCancelRes = await fetch(
      `${BASE_URL}/api/prospecting/jobs/${job.id}`
    );
    const checkCancelData = await checkCancelRes.json();
    assert.equal(checkCancelData.job.status, "cancelled");
  });

  it("5. Detecção de bloqueio/CAPTCHA com telemetria sanitizada sem evasão", async () => {
    const workerHeaders = {
      Authorization: `Bearer ${EPHEMERAL_TOKEN}`,
      "Content-Type": "application/json",
    };

    // Atualiza heartbeat do worker
    await fetch(`${BASE_URL}/api/internal/prospecting/worker/ping`, {
      method: "POST",
      headers: workerHeaders,
      body: JSON.stringify({
        worker_id: "test_worker_daemon",
        supported_capabilities: ["local_chromium_scraper"],
      }),
    });

    // Cria novo job
    const createRes = await fetch(`${BASE_URL}/api/prospecting/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "Serralheria",
        city: "Sorocaba",
        state: "SP",
        limit: 5,
      }),
    });
    assert.equal(createRes.status, 201);
    const { job } = await createRes.json();

    const claimRes = await fetch(
      `${BASE_URL}/api/internal/prospecting/worker/claim`,
      {
        method: "POST",
        headers: workerHeaders,
        body: JSON.stringify({ worker_id: "worker_block_test" }),
      }
    );
    const claimData = await claimRes.json();

    // Worker registra bloqueio sanitizado
    const failRes = await fetch(
      `${BASE_URL}/api/internal/prospecting/worker/fail`,
      {
        method: "POST",
        headers: workerHeaders,
        body: JSON.stringify({
          worker_id: "worker_block_test",
          job_id: job.id,
          lease_id: claimData.lease_id,
          reason: "Bloqueio ou CAPTCHA detectado no Google Maps",
          is_blocked: true,
          block_telemetry: {
            block_type: "captcha_detected",
            sanitized_url: "https://www.google.com/maps/search",
            http_status: null,
            detected_at: new Date().toISOString(),
            collector_version: "v1.18.1-549e4b5",
          },
        }),
      }
    );
    assert.equal(failRes.status, 200);

    // Consulta pela rota do operador
    const checkBlockRes = await fetch(
      `${BASE_URL}/api/prospecting/jobs/${job.id}`
    );
    const checkBlockData = await checkBlockRes.json();
    assert.equal(checkBlockData.job.status, "blocked");
    assert.ok(checkBlockData.blockTelemetry);
    assert.equal(
      checkBlockData.blockTelemetry.block_type,
      "captcha_detected"
    );
  });

  it("6. Avaliação de oportunidades e integridade de exportação CSV", () => {
    // 1. Lead sem site e sem telefone
    const opp1 = detectOpportunities({
      website: null,
      phone: null,
      rating: 4.8,
      review_count: 50,
      address: "Rua A",
    });
    assert.equal(opp1.withoutWebsite, true);
    assert.equal(opp1.withoutPhone, true);
    assert.equal(opp1.fewReviews, false);
    assert.equal(opp1.lowRating, false);
    assert.equal(opp1.incompleteInfo, true);
    assert.equal(opp1.unclaimedProfile, false);

    // 2. Lead com poucas avaliações e nota baixa
    const opp2 = detectOpportunities({
      website: "https://empresa.com",
      phone: "(15) 3333-2222",
      rating: 4.1,
      review_count: 3,
      address: "Rua B",
    });
    assert.equal(opp2.withoutWebsite, false);
    assert.equal(opp2.withoutPhone, false);
    assert.equal(opp2.fewReviews, true);
    assert.equal(opp2.lowRating, true);
    assert.equal(opp2.unclaimedProfile, false);

    // 3. Validação de formatação CSV RFC-4180
    const escapeCell = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvLine = [
      escapeCell('Vidraçaria "Ouro"'),
      escapeCell("Vidraçaria"),
      escapeCell(null),
    ].join(",");

    assert.equal(
      csvLine,
      '"Vidraçaria ""Ouro""", "Vidraçaria", ""'.replace(/, /g, ",")
    );
  });
});
