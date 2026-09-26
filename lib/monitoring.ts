import { randomUUID } from "node:crypto";
import { type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "./server-env.ts";
import { createSupabaseAdmin } from "./connection-hub/supabase-admin.ts";

/**
 * Frente 2: Monitoramento, Observabilidade e Operação Segura
 * Implementação interna sem dependência de serviços externos.
 */

export type HealthStatus = "ok" | "degraded" | "unavailable";

export type ComponentHealth = {
  status: "ready" | "degraded" | "unavailable" | "unconfigured" | "pending_provider_approval";
  details?: string;
};

export type PlatformHealthReport = {
  status: HealthStatus;
  timestamp: string;
  version: string;
  write_mode: "disabled" | "enabled";
  environment: "homologation" | "production" | "development";
  services: {
    database: ComponentHealth;
    auth: ComponentHealth;
    google_ads_bridge: ComponentHealth;
    google_provider: ComponentHealth;
  };
};

export type LogLevel = "info" | "warn" | "error" | "critical";

export type StructuredLogEvent = {
  level: LogLevel;
  eventType: string;
  agencyId?: string;
  clientId?: string;
  correlationId?: string;
  message: string;
  details?: unknown;
};

const SENSITIVE_KEYS_REGEX = /(?:password|secret|token|bearer|authorization|jwt|credential|cookie|api[_-]?key|private[_-]?key|credit[_-]?card)/i;

/**
 * Sanitiza recursivamente qualquer objeto ou payload para evitar vazamento
 * de segredos, tokens ou dados sensíveis nos logs operacionais.
 */
export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    // Esconde Bearer tokens soltos em strings de log
    if (data.startsWith("Bearer ") || data.startsWith("bearer ")) {
      return "[REDACTED_BEARER_TOKEN]";
    }
    // Esconde tokens JWT (eyJ...)
    if (data.length > 30 && /^eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(data)) {
      return "[REDACTED_JWT_TOKEN]";
    }
    return data;
  }

  if (typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS_REGEX.test(key)) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = sanitizeLogData(value);
    }
  }

  return sanitized;
}

const SAFE_CORRELATION_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Extrai ou gera um ID de correlação seguro para rastreamento de requisições.
 * Valida o formato e limita o tamanho máximo a 64 caracteres.
 */
export function getCorrelationId(request?: Request | null): string {
  if (request) {
    const existing = request.headers.get("x-correlation-id") || request.headers.get("x-request-id");
    if (existing) {
      const trimmed = existing.trim();
      if (trimmed.length > 0 && trimmed.length <= 64 && SAFE_CORRELATION_ID_REGEX.test(trimmed)) {
        return trimmed;
      }
    }
  }
  return randomUUID();
}

/**
 * Registra eventos operacionais em formato JSON estruturado e sanitizado.
 */
export function logOperationalEvent(event: StructuredLogEvent): Record<string, unknown> {
  const sanitizedDetails = event.details !== undefined ? sanitizeLogData(event.details) : undefined;
  
  const logPayload = {
    timestamp: new Date().toISOString(),
    level: event.level,
    event_type: event.eventType,
    message: event.message,
    agency_id: event.agencyId || null,
    client_id: event.clientId || null,
    correlation_id: event.correlationId || randomUUID(),
    details: sanitizedDetails,
  };

  const jsonString = JSON.stringify(logPayload);
  if (event.level === "error" || event.level === "critical") {
    console.error(jsonString);
  } else if (event.level === "warn") {
    console.warn(jsonString);
  } else {
    console.log(jsonString);
  }

  return logPayload;
}

/**
 * Avalia o estado de saúde e prontidão da plataforma sem expor URLs internas ou segredos.
 */
export async function checkPlatformHealth(dbClient?: SupabaseClient | null): Promise<PlatformHealthReport> {
  const timestamp = new Date().toISOString();
  const writeMode = (serverEnv("ALASTRE_WRITE_MODE") === "enabled" ? "enabled" : "disabled") as "disabled" | "enabled";
  const nodeEnv = process.env.NODE_ENV || "development";
  const environment = nodeEnv === "production" ? "production" : nodeEnv === "test" ? "homologation" : "homologation";

  // Check 1: Banco de Dados
  let dbStatus: ComponentHealth = { status: "unconfigured", details: "Supabase URL/Key ausentes" };
  const admin = dbClient ?? createSupabaseAdmin();
  if (admin) {
    try {
      // Query rápida e segura
      const { error } = await admin.rpc("platform_resolve_actor", { p_email: "healthcheck@alastre.internal" });
      if (!error) {
        dbStatus = { status: "ready" };
      } else {
        dbStatus = { status: "degraded", details: "RPC de autenticação retornou falha tratada" };
      }
    } catch {
      dbStatus = { status: "unavailable", details: "Conexão com o banco de dados falhou" };
    }
  }

  // Check 2: Auth Service
  const supabaseUrl = serverEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnon = serverEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const authStatus: ComponentHealth = supabaseUrl && supabaseAnon
    ? { status: "ready" }
    : { status: "unconfigured", details: "Variáveis públicas de autenticação ausentes" };

  // Check 3: Google Ads Bridge
  const bridgeUrl = serverEnv("SUPABASE_GOOGLE_ADS_BRIDGE_URL");
  const bridgeSecret = serverEnv("ALASTRE_BRIDGE_SECRET");
  const bridgeStatus: ComponentHealth = bridgeUrl && bridgeSecret
    ? { status: "ready" }
    : { status: "unconfigured", details: "Bridge URL ou secret não configurados no ambiente local" };

  // Check 4: Google Provider Availability
  const rawGoogleAvailability = serverEnv("GOOGLE_PROVIDER_AVAILABILITY");
  let googleStatus: ComponentHealth = { status: "unconfigured", details: "Variável GOOGLE_PROVIDER_AVAILABILITY não definida" };
  if (rawGoogleAvailability === "pending_provider_approval") {
    googleStatus = { status: "pending_provider_approval", details: "Aguardando aprovação das APIs GBP pelo Google" };
  } else if (rawGoogleAvailability === "ready_for_oauth") {
    googleStatus = { status: "ready" };
  }

  // Determinação do status consolidado
  let overallStatus: HealthStatus = "ok";
  if (dbStatus.status === "unavailable") {
    overallStatus = "unavailable";
  } else if (dbStatus.status === "degraded" || bridgeStatus.status === "unconfigured" || googleStatus.status === "pending_provider_approval") {
    overallStatus = "degraded";
  }

  return {
    status: overallStatus,
    timestamp,
    version: "0.1.0",
    write_mode: writeMode,
    environment,
    services: {
      database: dbStatus,
      auth: authStatus,
      google_ads_bridge: bridgeStatus,
      google_provider: googleStatus,
    },
  };
}
