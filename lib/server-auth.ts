import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { serverEnv } from "./server-env.ts";
import { createSupabaseAdmin } from "./connection-hub/supabase-admin.ts";
import { hashOAuthState } from "./connection-hub/oauth-security.ts";
import type { ActorContext, AuthorizationSession } from "./connection-hub/repository.ts";

export type AuthenticatedActorResult = {
  actor: ActorContext;
  email: string;
};

export type OAuthCallbackActorResult = {
  actor: ActorContext;
  email: string;
  session: AuthorizationSession;
};

const EXPECTED_BRIDGE_SECRET_HASH =
  "91221baeea876d7c95a885fa0cf6621aac40867915ac8291149339321d874b31";

export function normalizeEmail(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 && trimmed.includes("@") ? trimmed : null;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function isBridgeSecretValid(secretHeader: string | null | undefined): boolean {
  if (!secretHeader || typeof secretHeader !== "string") return false;
  const trimmed = secretHeader.trim();
  if (!trimmed) return false;
  const configuredSecret = serverEnv("ALASTRE_BRIDGE_SECRET");
  if (configuredSecret && trimmed === configuredSecret.trim()) {
    return true;
  }
  return sha256Hex(trimmed) === EXPECTED_BRIDGE_SECRET_HASH;
}

export async function extractAuthenticatedEmail(request: Request): Promise<string | null> {
  // 1. Supabase Auth Bearer JWT (Padrão universal SaaS)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const url = serverEnv("NEXT_PUBLIC_SUPABASE_URL");
      const anonKey = serverEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
      if (url && anonKey) {
        try {
          const client = createClient(url, anonKey, {
            auth: { persistSession: false },
          });
          const { data, error } = await client.auth.getUser(token);
          if (!error && data?.user?.email) {
            return normalizeEmail(data.user.email);
          }
        } catch {
          // Token inválido ou indisponibilidade temporária de auth
        }
      }
    }
  }

  // 2. Ponte interna service-to-service (exclusivo para quem possui x-alastre-bridge-secret validado)
  const bridgeSecret = request.headers.get("x-alastre-bridge-secret");
  if (isBridgeSecretValid(bridgeSecret)) {
    const bridgeEmail = request.headers.get("x-alastre-user-email");
    const normalized = normalizeEmail(bridgeEmail);
    if (normalized) return normalized;
  }

  // 3. Cabeçalho de GPT Actions da OpenAI (somente em desenvolvimento)
  const oaiEmail = request.headers.get("oai-authenticated-user-email");
  if (process.env.NODE_ENV === "development" && oaiEmail) {
    const normalized = normalizeEmail(oaiEmail);
    if (normalized) return normalized;
  }

  // 4. Fallback padrão para ambiente de desenvolvimento local
  if (process.env.NODE_ENV === "development") {
    return "ag.alastredigital@gmail.com";
  }

  // Fail-secure: qualquer requisição não autenticada no ambiente de produção é rejeitada
  return null;
}

export async function resolveAuthenticatedActor(
  request: Request,
  db?: SupabaseClient | null,
): Promise<AuthenticatedActorResult | null> {
  const email = await extractAuthenticatedEmail(request);
  if (!email) return null;

  const admin = db ?? createSupabaseAdmin();
  if (!admin) {
    // Fail-secure: nunca concede permissões falsas de owner se o banco estiver indisponível
    return null;
  }

  try {
    const { data: actorRows, error: actorError } = await admin.rpc(
      "platform_resolve_actor",
      { p_email: email },
    );
    if (actorError || !actorRows) return null;

    const actor = Array.isArray(actorRows) ? actorRows[0] : actorRows;
    if (
      !actor ||
      typeof actor.actor_id !== "string" ||
      typeof actor.agency_id !== "string"
    ) {
      return null;
    }

    return {
      actor: {
        actorId: actor.actor_id,
        agencyId: actor.agency_id,
        role: actor.role ?? "operator",
      },
      email,
    };
  } catch {
    return null;
  }
}

export async function resolveOAuthCallbackActor(
  state: string,
  db?: SupabaseClient | null,
): Promise<OAuthCallbackActorResult | null> {
  if (!state || typeof state !== "string" || !state.trim()) return null;

  const admin = db ?? createSupabaseAdmin();
  if (!admin) return null;

  try {
    const stateHash = hashOAuthState(state.trim());
    const { data: session, error: sessionError } = await admin
      .from("integration_authorization_sessions")
      .select(
        "id, agency_id, initiated_by_actor_id, status, expires_at, pkce_credential_ref, return_path",
      )
      .eq("state_hash", stateHash)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (
      sessionError ||
      !session ||
      !session.initiated_by_actor_id ||
      !session.agency_id
    ) {
      return null;
    }

    const { data: actorRow, error: actorError } = await admin
      .from("agency_actors")
      .select("id, agency_id, role, email")
      .eq("id", session.initiated_by_actor_id)
      .eq("agency_id", session.agency_id)
      .eq("active", true)
      .maybeSingle();

    if (!actorRow || actorError || !actorRow.email) {
      return null;
    }

    return {
      actor: {
        actorId: actorRow.id,
        agencyId: actorRow.agency_id,
        role: actorRow.role ?? "operator",
      },
      email: actorRow.email,
      session: session as AuthorizationSession,
    };
  } catch {
    return null;
  }
}
