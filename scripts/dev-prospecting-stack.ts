import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { exec } from "node:child_process";

const execAsync = promisify(exec);

const PORT = 5175;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const MAX_SUPERVISOR_RESTARTS = 5;
const RESTART_WINDOW_MS = 60 * 1000; // 60 segundos

let isShuttingDown = false;
let viteProcess: ChildProcess | null = null;
let supervisorProcess: ChildProcess | null = null;
let restartHistory: number[] = [];

async function killProcessTree(pid: number | undefined): Promise<void> {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      await execAsync(`taskkill /T /F /PID ${pid}`);
    } else {
      process.kill(-pid, "SIGTERM");
    }
  } catch {
    // Processo já encerrado
  }
}

async function waitForServerReady(url: string, timeoutMs = 30000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (isShuttingDown) return false;
    try {
      const res = await fetch(`${url}/api/prospecting/supervisor/status`);
      if (res.ok || res.status === 200) {
        return true;
      }
    } catch {
      // Servidor ainda subindo
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function startSupervisor(): void {
  if (isShuttingDown) return;

  const now = Date.now();
  restartHistory = restartHistory.filter((t) => now - t < RESTART_WINDOW_MS);

  if (restartHistory.length >= MAX_SUPERVISOR_RESTARTS) {
    console.error(
      `\n[STACK-SUPERVISOR-ERROR] Limite de ${MAX_SUPERVISOR_RESTARTS} reinicializações atingido em 60s. Supervisor pausado para evitar loop de falhas. A aplicação web continua ativa.`
    );
    return;
  }

  const supervisorScript = path.resolve(
    process.cwd(),
    "scripts",
    "poc",
    "local-supervisor-daemon.ts"
  );

  console.log("\n[STACK] Iniciando Supervisor Daemon de Prospecção...");
  const proc = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsx", supervisorScript, "--daemon"],
    {
      stdio: "inherit",
      env: { ...process.env, ALASTRE_BASE_URL: BASE_URL },
      shell: process.platform === "win32",
    }
  );

  supervisorProcess = proc;

  proc.on("exit", (code, signal) => {
    if (isShuttingDown) return;

    restartHistory.push(Date.now());
    const attempt = restartHistory.length;
    console.warn(
      `\n[STACK-SUPERVISOR-WARN] Supervisor encerrou inesperadamente (código: ${code}, sinal: ${signal}). Tentativa de reinicialização ${attempt}/${MAX_SUPERVISOR_RESTARTS} em 2s...`
    );

    setTimeout(() => {
      if (!isShuttingDown) {
        startSupervisor();
      }
    }, 2000);
  });
}

async function main() {
  console.log("==========================================================");
  console.log("   ALASTRE PLATFORM - UNIFIED PROSPECTING DEV STACK      ");
  console.log("==========================================================");
  console.log(`Porta da Aplicação: ${PORT}`);
  console.log(`URL do Sistema: ${BASE_URL}`);
  console.log("Iniciando Vite e Supervisor Daemon simultaneamente...\n");

  const cleanup = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log("\n[STACK] Encerrando aplicação e supervisor graciosamente...");

    const pids = [supervisorProcess?.pid, viteProcess?.pid].filter(Boolean) as number[];
    for (const pid of pids) {
      await killProcessTree(pid);
    }
    console.log("[STACK] Todos os serviços e árvores de processos foram encerrados.");
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // 1. Inicia o servidor Vite
  console.log("[STACK] Iniciando servidor Vite...");
  const viteProc = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["vite", "--port", String(PORT)],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env },
    }
  );
  viteProcess = viteProc;

  viteProc.on("exit", (code) => {
    if (!isShuttingDown) {
      console.error(`[STACK-FATAL] Servidor Vite encerrou com código ${code}.`);
      cleanup();
    }
  });

  // 2. Aguarda o servidor estar pronto
  console.log("[STACK] Aguardando servidor web responder...");
  const ready = await waitForServerReady(BASE_URL);
  if (!ready) {
    console.error("[STACK-ERROR] Servidor web não respondeu no prazo esperado.");
    await cleanup();
    return;
  }
  console.log("[STACK] Servidor web ativo e respondendo na porta 5175!");

  // 3. Inicia o supervisor com auto-restart controlado
  startSupervisor();
}

main().catch((err) => {
  console.error("[STACK-FATAL]", err);
  process.exit(1);
});
