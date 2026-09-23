export type ApiErrorKind = "unavailable" | "network" | "invalid_payload" | "request" | "cancelled";

export class PlatformApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PlatformApiError";
  }
}

export type JsonGuard<T> = (value: unknown) => value is T;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isArrayOf<T>(guard: JsonGuard<T>): JsonGuard<T[]> {
  return (value): value is T[] => Array.isArray(value) && value.every(guard);
}

import { createSupabaseBrowserClient } from "./supabase";

export const isObject: JsonGuard<Record<string, unknown>> = isRecord;

async function getAuthHeader(): Promise<string | null> {
  try {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) return `Bearer ${token}`;
    }
  } catch {
    // Ignore in SSR/tests/unconfigured environments
  }
  return null;
}

async function postJson<T>(url: string, body: Record<string, unknown>, guard: JsonGuard<T>, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const auth = await getAuthHeader();
    if (auth) headers["Authorization"] = auth;

    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      throw new PlatformApiError("Solicitação cancelada.", "cancelled");
    }
    throw new PlatformApiError("Não foi possível conectar ao serviço.", "network");
  }

  const raw = await response.text();
  let payload: unknown;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    throw new PlatformApiError("O serviço retornou uma resposta inválida.", "invalid_payload", response.status);
  }

  if (!response.ok) {
    const message = isRecord(payload) && isString(payload.error) ? payload.error : "Não foi possível concluir a solicitação.";
    throw new PlatformApiError(message, response.status === 503 ? "unavailable" : "request", response.status);
  }

  if (!guard(payload)) {
    throw new PlatformApiError("O serviço retornou dados em formato inesperado.", "invalid_payload", response.status);
  }

  return payload;
}

export function postPlatform<T>(body: Record<string, unknown>, guard: JsonGuard<T>, signal?: AbortSignal): Promise<T> {
  return postJson("/api/platform", body, guard, signal);
}

export function postGoogleAds<T>(body: Record<string, unknown>, guard: JsonGuard<T>, signal?: AbortSignal): Promise<T> {
  return postJson("/api/google-ads", body, guard, signal);
}

export function isIntegrationUnavailable(error: unknown): boolean {
  return error instanceof PlatformApiError && error.kind === "unavailable";
}

export function isRequestCancelled(error: unknown): boolean {
  return error instanceof PlatformApiError && error.kind === "cancelled";
}
