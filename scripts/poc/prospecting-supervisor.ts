import { spawn, execFile, ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { SanitizedBlockTelemetry, WorkerRawLeadItem } from "../../lib/prospecting/types.ts";

const execFileAsync = promisify(execFile);

export interface ScraperExecutionOptions {
  query: string;
  location: string;
  limit: number;
  workDir?: string;
  preserveRawPath?: string;
  onHeartbeatCheck?: () => Promise<boolean>; // retorna true se cancelamento foi solicitado
}

export interface ScraperExecutionResult {
  success: boolean;
  leads: WorkerRawLeadItem[];
  isBlocked: boolean;
  blockTelemetry?: SanitizedBlockTelemetry;
  error?: string;
  rawExitCode?: number | null;
}

const COLLECTOR_VERSION = "v1.18.1-549e4b5";

export class ProspectingSupervisor {
  private binPath: string;

  constructor(binPath?: string) {
    this.binPath =
      binPath ||
      path.resolve(process.cwd(), "scripts", "poc", "bin", "google_maps_scraper.exe");
  }

  /**
   * Encerramento cooperativo no Windows/Linux:
   * 1. Confirma se o processo já encerrou (evita confundir child.killed com processo encerrado).
   * 2. Envia sinal gracioso (taskkill /T no Windows, SIGTERM no Linux).
   * 3. Aguarda confirmação real do evento 'exit' / 'close' por até 5 segundos.
   * 4. Se não encerrar em 5s, força término de toda a árvore de processos (taskkill /F /T no Windows, SIGKILL no Linux).
   * 5. Garante que nenhum processo filho (ex: Chrome/Chromium) permaneça órfão.
   */
  public async terminateProcessGracefully(
    child: ChildProcess,
    gracePeriodMs = 800
  ): Promise<void> {
    if (!child || !child.pid) return;

    // Se o processo já emitiu código de saída, já encerrou
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    const pid = child.pid;

    return new Promise<void>((resolve) => {
      let isResolved = false;
      let forceKillTimer: NodeJS.Timeout | null = null;
      let safetyTimeout: NodeJS.Timeout | null = null;

      const finish = () => {
        if (!isResolved) {
          isResolved = true;
          if (forceKillTimer) clearTimeout(forceKillTimer);
          if (safetyTimeout) clearTimeout(safetyTimeout);
          child.removeListener("exit", onExit);
          child.removeListener("close", onExit);
          resolve();
        }
      };

      const onExit = () => {
        finish();
      };

      child.once("exit", onExit);
      child.once("close", onExit);

      // Etapa 1: Tentativa cooperativa / graciosa
      if (process.platform === "win32") {
        execFileAsync("taskkill", ["/T", "/PID", String(pid)]).catch(() => {});
      } else {
        try {
          child.kill("SIGTERM");
        } catch {}
      }

      // Etapa 2: Janela de tolerância curta antes do término forçado (/F /T)
      forceKillTimer = setTimeout(async () => {
        if (isResolved || child.exitCode !== null) return;

        if (process.platform === "win32") {
          try {
            await execFileAsync("taskkill", ["/F", "/T", "/PID", String(pid)]);
          } catch {
            // Processo pode ter saído entre a checagem e a chamada
          }
        } else {
          try {
            child.kill("SIGKILL");
          } catch {}
        }

        // Timer de segurança caso o evento demore ligeiramente no barramento do OS
        safetyTimeout = setTimeout(() => {
          finish();
        }, 1000);
      }, gracePeriodMs);
    });
  }

  /**
   * Executa a prospecção factual de forma estritamente controlada e segura.
   */
  public async runScrape(
    options: ScraperExecutionOptions
  ): Promise<ScraperExecutionResult> {
    const workDir =
      options.workDir || path.resolve(process.cwd(), "scripts", "poc", "work");
    await fs.mkdir(workDir, { recursive: true });

    const runId = `run_${Date.now()}`;
    const inputFilePath = path.join(workDir, `${runId}_input.txt`);
    const resultsFilePath = path.join(workDir, `${runId}_results.json`);

    // Busca formatada: "Vidraçaria em Sorocaba - SP"
    const fullQuery = `${options.query} em ${options.location}`;
    await fs.writeFile(inputFilePath, `${fullQuery}\n`, "utf8");

    // Argumentos seguros:
    // - Concorrência 1 (baixo impacto)
    // - depth 1
    // - Sem email (-email=false por padrão)
    // - Sem reviews (-extra-reviews=false)
    // - Sem proxies
    const args = [
      "-input",
      inputFilePath,
      "-results",
      resultsFilePath,
      "-json",
      "-depth",
      "1",
      "-c",
      "1",
      "-lang",
      "pt-BR",
      "-exit-on-inactivity",
      "1m",
    ];

    let isBlocked = false;
    let blockTelemetry: SanitizedBlockTelemetry | undefined;
    let stdoutData = "";
    let stderrData = "";

    const child = spawn(this.binPath, args, {
      cwd: workDir,
      windowsHide: true,
    });

    let cancellationInterval: NodeJS.Timeout | null = null;

    if (options.onHeartbeatCheck) {
      cancellationInterval = setInterval(async () => {
        try {
          const cancelRequested = await options.onHeartbeatCheck!();
          if (cancelRequested) {
            if (cancellationInterval) clearInterval(cancellationInterval);
            await this.terminateProcessGracefully(child);
          }
        } catch {
          // Erro de checagem ignorado
        }
      }, 5000);
    }

    const checkBlockSignals = (chunk: string) => {
      const lower = chunk.toLowerCase();
      if (
        lower.includes("captcha") ||
        lower.includes("unusual traffic") ||
        lower.includes("429 too many") ||
        lower.includes("detected unusual") ||
        lower.includes("automated queries")
      ) {
        isBlocked = true;
        blockTelemetry = {
          block_type: lower.includes("captcha")
            ? "captcha_detected"
            : lower.includes("429")
            ? "http_429"
            : "unusual_traffic",
          sanitized_url: "https://www.google.com/maps/search",
          http_status: lower.includes("429") ? 429 : null,
          detected_at: new Date().toISOString(),
          collector_version: COLLECTOR_VERSION,
        };
        // Interrompe imediatamente sem tentar contornar ou insistir
        this.terminateProcessGracefully(child).catch(() => {});
      }
    };

    child.stdout.on("data", (data) => {
      const str = data.toString();
      stdoutData += str;
      checkBlockSignals(str);
    });

    child.stderr.on("data", (data) => {
      const str = data.toString();
      stderrData += str;
      checkBlockSignals(str);
    });

    const exitCode = await new Promise<number | null>((resolve) => {
      child.on("close", (code) => {
        if (cancellationInterval) clearInterval(cancellationInterval);
        resolve(code);
      });
      child.on("error", () => {
        if (cancellationInterval) clearInterval(cancellationInterval);
        resolve(-1);
      });
    });

    if (isBlocked) {
      return {
        success: false,
        leads: [],
        isBlocked: true,
        blockTelemetry,
        error: "Google Maps blocking detected",
        rawExitCode: exitCode,
      };
    }

    // Preservação do arquivo bruto temporário para auditoria antes de qualquer limpeza (Requisito 5)
    let rawContent = "";
    try {
      rawContent = await fs.readFile(resultsFilePath, "utf8");
      const preservePath =
        options.preserveRawPath ||
        path.resolve(process.cwd(), "scripts", "poc", "output", "raw-scraper-results.json");
      const preserveDir = path.dirname(preservePath);
      await fs.mkdir(preserveDir, { recursive: true });
      await fs.writeFile(preservePath, rawContent, "utf8");
    } catch {
      // Ignora erro se resultsFilePath não foi gerado
    }

    // Lê os resultados
    let leads: WorkerRawLeadItem[] = [];
    try {
      if (!rawContent) {
        rawContent = await fs.readFile(resultsFilePath, "utf8");
      }
      leads = this.parseRawScraperJson(rawContent, options.limit);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        leads: [],
        isBlocked: false,
        error: `Failed to read scraper results: ${msg}`,
        rawExitCode: exitCode,
      };
    } finally {
      // Limpeza segura dos arquivos temporários de trabalho
      try {
        await fs.unlink(inputFilePath).catch(() => {});
        await fs.unlink(resultsFilePath).catch(() => {});
      } catch {
        // Ignora erro de limpeza
      }
    }

    return {
      success: true,
      leads,
      isBlocked: false,
      rawExitCode: exitCode,
    };
  }

  /**
   * Converte a saída do gosom scraper para os itens brutos de leads.
   * Mapeia com precisão os campos da struct Entry do Go (Requisitos 5 e 6):
   * - review_rating -> rating (número float válido 1.0 a 5.0, sem coerção arbitrária)
   * - review_count -> review_count (número inteiro não-negativo)
   */
  public parseRawScraperJson(rawContent: string, limit: number): WorkerRawLeadItem[] {
    const trimmed = rawContent.trim();
    if (!trimmed) return [];

    let parsedItems: any[] = [];

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        parsedItems = JSON.parse(trimmed);
      } catch {
        parsedItems = [];
      }
    } else {
      // Formato JSON Lines (NDJSON)
      const lines = trimmed.split("\n");
      for (const line of lines) {
        const lineTrim = line.trim();
        if (lineTrim) {
          try {
            parsedItems.push(JSON.parse(lineTrim));
          } catch {
            // Ignora linha com json inválido
          }
        }
      }
    }

    const results: WorkerRawLeadItem[] = [];

    for (const item of parsedItems) {
      if (results.length >= limit) break;
      const title = item.title || item.name;
      if (!title || typeof title !== "string" || !title.trim()) {
        continue;
      }

      // Mapeamento preciso do campo rating:
      // A struct do gosom define: ReviewRating float64 `json:"review_rating"`
      const rawRating = item.review_rating ?? item.rating ?? item.total_score;
      let rating: number | null = null;
      if (typeof rawRating === "number" && !isNaN(rawRating) && rawRating > 0 && rawRating <= 5) {
        rating = Math.round(rawRating * 10) / 10;
      } else if (typeof rawRating === "string" && rawRating.trim().length > 0) {
        const parsed = parseFloat(rawRating.replace(",", "."));
        if (!isNaN(parsed) && parsed > 0 && parsed <= 5) {
          rating = Math.round(parsed * 10) / 10;
        }
      }

      // Mapeamento preciso do campo review_count:
      // A struct do gosom define: ReviewCount int `json:"review_count"`
      const rawReviews = item.review_count ?? item.reviews;
      let reviewCount: number | null = null;
      if (typeof rawReviews === "number" && !isNaN(rawReviews) && rawReviews >= 0) {
        reviewCount = Math.floor(rawReviews);
      } else if (typeof rawReviews === "string" && rawReviews.trim().length > 0) {
        const parsed = parseInt(rawReviews.replace(/\D/g, ""), 10);
        if (!isNaN(parsed) && parsed >= 0) {
          reviewCount = parsed;
        }
      }

      // Extração rigorosa de campos factuais
      const lead: WorkerRawLeadItem = {
        name: title.trim(),
        category: item.category ? String(item.category).trim() : null,
        address: item.address ? String(item.address).trim() : null,
        phone: item.phone ? String(item.phone).trim() : null,
        website: item.web_site || item.website ? String(item.web_site || item.website).trim() : null,
        rating,
        review_count: reviewCount,
        maps_url: item.link || item.url || item.maps_url ? String(item.link || item.url || item.maps_url).trim() : null,
        place_id: item.place_id ? String(item.place_id).trim() : null,
        cid: item.cid ? String(item.cid).trim() : null,
      };

      results.push(lead);
    }

    return results;
  }
}
