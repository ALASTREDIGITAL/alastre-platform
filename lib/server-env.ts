import "server-only";

const cfWorkers = await import("cloudflare:workers").catch(() => null);
const cfEnv = cfWorkers?.env as Record<string, unknown> | undefined;

export function serverEnv(name: string): string | undefined {
  const workerValue = cfEnv?.[name];
  if (typeof workerValue === "string" && workerValue.trim()) return workerValue.trim();
  const nodeValue = process.env[name];
  return typeof nodeValue === "string" && nodeValue.trim() ? nodeValue.trim() : undefined;
}
