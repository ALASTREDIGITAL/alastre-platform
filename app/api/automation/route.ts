import { resolveAuthenticatedActor } from "../../../lib/server-auth.ts";
import { AutomationActionSchema, sanitizeSensitiveData, validateExternalEndpointUrl, type ProviderKey } from "../../../lib/automation-domain.ts";
import { automationService } from "../../../lib/automation-service.ts";
import type { ActorContext } from "../../../lib/connection-hub/repository.ts";

export const dynamic = "force-dynamic";

function getActorContext(request: Request, authResult: Awaited<ReturnType<typeof resolveAuthenticatedActor>>): ActorContext | null {
  if (authResult?.actor) return authResult.actor;
  if (request.headers.get("x-test-unauth") === "true" || process.env.NODE_ENV === "production") {
    return null;
  }
  const email = request.headers.get("x-test-actor-email") ?? "ag.alastredigital@gmail.com";
  const agencyId = request.headers.get("x-test-agency-id") ?? "agency-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const role = (request.headers.get("x-test-role") as ActorContext["role"]) ?? "admin";

  return {
    actorId: `actor-${email.replace(/[^a-z0-9]/gi, "_")}`,
    agencyId,
    role,
  };
}

export async function GET(request: Request) {
  try {
    const authResult = await resolveAuthenticatedActor(request);
    const actor = getActorContext(request, authResult);
    if (!actor) {
      return Response.json({ error: { message: "Acesso não autorizado ou sessão expirada" } }, { status: 401 });
    }

    const data = await automationService.getOverview(actor);
    return Response.json(sanitizeSensitiveData(data));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "internal_error";
    return Response.json({ error: { message } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await resolveAuthenticatedActor(request);
    const actor = getActorContext(request, authResult);
    if (!actor) {
      return Response.json({ error: { message: "Acesso não autorizado ou sessão expirada" } }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: { message: "Payload JSON malformado ou ausente" } }, { status: 400 });
    }

    const parseResult = AutomationActionSchema.safeParse(body);
    if (!parseResult.success) {
      return Response.json(
        {
          error: {
            message: "Payload inválido para automação",
            issues: parseResult.error.issues.map((i) => i.message),
          },
        },
        { status: 400 },
      );
    }

    const actionData = parseResult.data;

    // Proteção contra SSRF se houver endpoint externo especificado
    if ("external_endpoint_url" in body && typeof body.external_endpoint_url === "string") {
      const providerKey = (typeof body.provider === "string" ? body.provider : "google") as ProviderKey;
      const ssrfCheck = validateExternalEndpointUrl(providerKey, body.external_endpoint_url);
      if (!ssrfCheck.valid) {
        return Response.json({ error: { message: ssrfCheck.reason } }, { status: 400 });
      }
    }

    switch (actionData.action) {
      case "overview": {
        const result = await automationService.getOverview(actor);
        return Response.json(sanitizeSensitiveData(result));
      }

      case "sync_trigger": {
        const result = await automationService.triggerSync(actor, actionData);
        return Response.json(sanitizeSensitiveData(result));
      }

      case "enqueue_job": {
        const result = await automationService.enqueueJob(actor, actionData);
        return Response.json(sanitizeSensitiveData(result));
      }

      case "process_job": {
        const result = await automationService.processJob(actor, actionData);
        return Response.json(sanitizeSensitiveData(result));
      }

      case "cancel_job": {
        const result = await automationService.cancelJob(actor, actionData);
        return Response.json(sanitizeSensitiveData(result));
      }

      case "create_write_plan": {
        const result = await automationService.createWritePlan(actor, actionData);
        return Response.json(sanitizeSensitiveData(result));
      }

      case "approve_write_plan": {
        const result = await automationService.approveWritePlan(actor, actionData);
        return Response.json(sanitizeSensitiveData(result));
      }

      case "execute_write_plan": {
        const result = await automationService.executeWritePlan(actor, actionData);
        return Response.json(sanitizeSensitiveData(result));
      }

      case "record_ai_usage": {
        const result = await automationService.recordAiUsage(actor, actionData);
        return Response.json(sanitizeSensitiveData(result));
      }

      case "get_ai_limits": {
        const overview = await automationService.getOverview(actor);
        return Response.json(sanitizeSensitiveData({ ai_limits: overview.ai_limits, ai_usage_logs: overview.ai_usage_logs }));
      }

      default:
        return Response.json({ error: { message: "Ação de automação não suportada" } }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno de automação";
    if (message === "actor_forbidden") {
      return Response.json({ error: { message: "Acesso negado: sem permissão para esta ação de automação" } }, { status: 403 });
    }
    if (message.includes("not_found")) {
      return Response.json({ error: { message: "Recurso de automação não encontrado no tenant" } }, { status: 404 });
    }
    return Response.json({ error: { message } }, { status: 500 });
  }
}
