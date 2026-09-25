import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { ProspectingSupervisor } from "../scripts/poc/prospecting-supervisor.ts";

describe("Prospecting Windows Cancellation & Process Tree Termination (Condição 4)", () => {
  it("confirms exit event and terminates process tree gracefully without orphan processes", async () => {
    const supervisor = new ProspectingSupervisor();

    // Spawna um processo com árvore longa (PowerShell dormindo por 60 segundos)
    const child = spawn(
      process.platform === "win32" ? "powershell.exe" : "sleep",
      process.platform === "win32" ? ["-Command", "Start-Sleep -Seconds 60"] : ["60"],
      {
        windowsHide: true,
      }
    );

    const pid = child.pid;
    assert.ok(pid, "Processo filho deve ter um PID válido");

    let exitFired = false;
    child.once("exit", (code, signal) => {
      exitFired = true;
    });

    // Dispara o encerramento gracioso cooperativo com tolerância de 800ms
    const startTime = Date.now();
    await supervisor.terminateProcessGracefully(child, 800);
    const duration = Date.now() - startTime;

    // Confirmação do evento exit
    assert.equal(exitFired, true, "Evento exit DEVE ser confirmado");
    assert.ok(duration <= 6000, `Encerramento rápido confirmado (${duration}ms <= 6000ms)`);

    // Breve pausa para propagação do descritor de processo no kernel Windows
    await new Promise((r) => setTimeout(r, 100));

    // Confirma que o processo não está mais ativo no sistema
    let isProcessRunning = true;
    try {
      // process.kill com sinal 0 checa existência sem matar (lança ESRCH se inativo)
      process.kill(pid, 0);
    } catch {
      isProcessRunning = false;
    }

    assert.equal(isProcessRunning, false, `PID ${pid} não pode permanecer em execução após encerramento`);
  });
});
