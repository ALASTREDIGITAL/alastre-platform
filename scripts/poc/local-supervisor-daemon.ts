import fs from "node:fs/promises";
import path from "node:path";
import { ProspectingSupervisor } from "./prospecting-supervisor.ts";
import type {
  WorkerClaimResponse,
  WorkerHeartbeatResponse,
  WorkerCompleteResponse,
  WorkerFailResponse,
} from "../../lib/prospecting/types.ts";

const BASE_URL = process.env.ALASTRE_BASE_URL || "http://127.0.0.1:5175";
const WORKER_ID = `supervisor_daemon_${process.pid}`;

async function resolveWorkerToken(): Promise<string> {
  let token = process.env.PROSPECTING_WORKER_SECRET_TOKEN;
  if (!token || !token.trim()) {
    try {
      const envLocal = await fs.readFile(
        path.resolve(process.cwd(), ".env.local"),
        "utf8"
      );
      for (const line of envLocal.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("PROSPECTING_WORKER_SECRET_TOKEN=")) {
          token = trimmed.split("=")[1]?.trim();
          if (token) break;
        }
      }
    } catch {}
  }

  if (!token || !token.trim()) {
    console.error(
      "[SUPERVISOR-DAEMON-ERROR] PROSPECTING_WORKER_SECRET_TOKEN não configurado. Encerrando fail-closed."
    );
    process.exit(1);
  }
  return token.trim();
}

let isShuttingDown = false;
let currentSupervisor: ProspectingSupervisor | null = null;

export async function runSupervisorCycle(
  workerToken: string,
  supervisor: ProspectingSupervisor
): Promise<{ processed: boolean; jobId?: string; status?: string }> {
  const authHeaders = {
    Authorization: `Bearer ${workerToken}`,
    "Content-Type": "application/json",
  };

  // 1. Reivindica trabalho pendente
  let claimRes: Response;
  try {
    claimRes = await fetch(
      `${BASE_URL}/api/internal/prospecting/worker/claim`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          worker_id: WORKER_ID,
          supported_capabilities: ["local_chromium_scraper"],
        }),
      }
    );
  } catch (err) {
    // Servidor pode estar temporariamente iniciando
    return { processed: false };
  }

  if (!claimRes.ok) {
    if (claimRes.status === 401) {
      console.error(
        "[SUPERVISOR-DAEMON-AUTH-FAIL] Token rejeitado pelas rotas internas (401). Verifique o segredo."
      );
    }
    return { processed: false };
  }

  const claimData = (await claimRes.json()) as WorkerClaimResponse;
  if (!claimData.claimed || !claimData.job || !claimData.lease_id) {
    return { processed: false };
  }

  const { job, lease_id } = claimData;
  console.log(
    `[SUPERVISOR-DAEMON] Trabalho reivindicado: ID ${job.id} | Query: "${job.query}" em "${job.location}" | Limite: ${job.limit}`
  );

  let cancellationRequested = false;

  // Função de checagem periódica do heartbeat
  const checkHeartbeat = async (): Promise<boolean> => {
    try {
      const hbRes = await fetch(
        `${BASE_URL}/api/internal/prospecting/worker/heartbeat`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            worker_id: WORKER_ID,
            job_id: job.id,
            lease_id,
          }),
        }
      );
      if (hbRes.ok) {
        const hbData = (await hbRes.json()) as WorkerHeartbeatResponse;
        if (hbData.cancellation_requested) {
          cancellationRequested = true;
          return true;
        }
      }
    } catch {}
    return cancellationRequested;
  };

  // 2. Executa a raspagem com limite estrito
  const scrapeResult = await supervisor.runScrape({
    query: job.query,
    location: job.location,
    limit: Math.min(job.limit, 10),
    onHeartbeatCheck: checkHeartbeat,
  });

  // 3. Comunica resultado ao backend
  if (scrapeResult.isBlocked) {
    console.warn(
      `[SUPERVISOR-DAEMON-BLOCKED] Bloqueio ou CAPTCHA detectado para o job ${job.id}. Interrompendo sem evasão.`
    );
    await fetch(`${BASE_URL}/api/internal/prospecting/worker/fail`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        worker_id: WORKER_ID,
        job_id: job.id,
        lease_id,
        reason: "Bloqueio ou CAPTCHA detectado no Google Maps",
        is_blocked: true,
        block_telemetry: scrapeResult.blockTelemetry,
      }),
    });
    return { processed: true, jobId: job.id, status: "blocked" };
  }

  if (!scrapeResult.success) {
    const isCancelled = cancellationRequested;
    console.log(
      `[SUPERVISOR-DAEMON] Job ${job.id} finalizado com status: ${
        isCancelled ? "cancelado" : "falha"
      }`
    );
    await fetch(`${BASE_URL}/api/internal/prospecting/worker/fail`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        worker_id: WORKER_ID,
        job_id: job.id,
        lease_id,
        reason: isCancelled
          ? "Cancelamento solicitado pelo operador"
          : scrapeResult.error || "Falha na execução do coletor",
        is_blocked: false,
      }),
    });
    return {
      processed: true,
      jobId: job.id,
      status: isCancelled ? "cancelled" : "failed",
    };
  }

  // Entrega dos resultados reais factuais
  console.log(
    `[SUPERVISOR-DAEMON] Coleta bem-sucedida para o job ${job.id}. Enviando ${scrapeResult.leads.length} leads factuais...`
  );
  const completeRes = await fetch(
    `${BASE_URL}/api/internal/prospecting/worker/complete`,
    {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        worker_id: WORKER_ID,
        job_id: job.id,
        lease_id,
        idempotency_key: `idem_${job.id}_${Date.now()}`,
        leads: scrapeResult.leads,
      }),
    }
  );

  if (completeRes.ok) {
    const completeData = (await completeRes.json()) as WorkerCompleteResponse;
    console.log(
      `[SUPERVISOR-DAEMON] Concluído com sucesso! Salvos: ${completeData.total_saved} | Descartados: ${completeData.duplicates_discarded}`
    );
  }

  return { processed: true, jobId: job.id, status: "completed" };
}

async function sendHealthPing(workerToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/internal/prospecting/worker/ping`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${workerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        worker_id: WORKER_ID,
        supported_capabilities: ["local_chromium_scraper"],
        timestamp: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function start() {
  const isOnce = process.argv.includes("--once");
  const token = await resolveWorkerToken();
  const supervisor = new ProspectingSupervisor();
  currentSupervisor = supervisor;

  console.log("==========================================================");
  console.log("   ALASTRE PLATFORM - LOCAL PROSPECTING SUPERVISOR DAEMON ");
  console.log("==========================================================");
  console.log(`Endpoint Alastre: ${BASE_URL}`);
  console.log(`Modo de Operação: ${isOnce ? "Execução Única (--once)" : "Monitor Contínuo (--daemon)"}`);
  console.log(`Worker ID: ${WORKER_ID}`);
  console.log("Limite de Coleta: 10 resultados factuais no Google Maps\n");

  const cleanup = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log("\n[SUPERVISOR-DAEMON] Encerrando daemon e processos filhos...");
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Ping inicial de inicialização
  await sendHealthPing(token);

  if (isOnce) {
    const res = await runSupervisorCycle(token, supervisor);
    if (!res.processed) {
      console.log("[SUPERVISOR-DAEMON] Nenhum trabalho pendente para claim.");
      process.exit(0);
    }
    process.exit(0);
  }

  let lastPingTime = 0;

  // Modo loop contínuo
  while (!isShuttingDown) {
    try {
      const now = Date.now();
      // Envia ping de saúde a cada 3 segundos garantindo status online no frontend
      if (now - lastPingTime >= 3000) {
        await sendHealthPing(token);
        lastPingTime = now;
      }

      const res = await runSupervisorCycle(token, supervisor);
      if (!res.processed) {
        // Pausa curta antes de verificar novos trabalhos
        await new Promise((r) => setTimeout(r, 1500));
      } else {
        // Pausa de 1s após finalizar um trabalho antes do próximo claim
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error("[SUPERVISOR-DAEMON-LOOP-ERROR]", err);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

import { fileURLToPath } from "node:url";

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() ===
    fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  start().catch((err) => {
    console.error("[SUPERVISOR-DAEMON-FATAL]", err);
    process.exit(1);
  });
}
