import { checkPlatformHealth, getCorrelationId, logOperationalEvent } from "../../../lib/monitoring.ts";
import { resolveAuthenticatedActor } from "../../../lib/server-auth.ts";

export const dynamic = "force-dynamic";

const ALLOWED_READINESS_ROLES = new Set(["owner", "admin", "operations_lead"]);

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);
  const url = new URL(request.url);
  const isDetailRequested = url.searchParams.get("detail") === "true" || url.searchParams.get("mode") === "readiness";

  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "X-Correlation-ID": correlationId,
  };

  // Nível 1: GET /api/health público (Resposta mínima, sem detalhes de infra/banco/providers)
  if (!isDetailRequested) {
    return Response.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "0.1.0",
      },
      {
        status: 200,
        headers,
      }
    );
  }

  // Nível 2: Diagnóstico detalhado de readiness (Apenas ator autenticado com papel de liderança)
  try {
    const actorResult = await resolveAuthenticatedActor(request);

    if (!actorResult) {
      return Response.json(
        {
          status: "unauthorized",
          error: "Autenticação necessária para diagnóstico detalhado de prontidão.",
        },
        {
          status: 401,
          headers,
        }
      );
    }

    if (!ALLOWED_READINESS_ROLES.has(actorResult.actor.role)) {
      return Response.json(
        {
          status: "forbidden",
          error: "Acesso negado. O papel do usuário não possui autorização para o diagnóstico detalhado.",
        },
        {
          status: 403,
          headers,
        }
      );
    }

    const report = await checkPlatformHealth();

    logOperationalEvent({
      level: report.status === "unavailable" ? "error" : report.status === "degraded" ? "warn" : "info",
      eventType: "readiness_check_performed",
      agencyId: actorResult.actor.agencyId,
      correlationId,
      message: `Readiness check executado por ${actorResult.email} (${actorResult.actor.role}): status ${report.status}`,
    });

    const statusCode = report.status === "unavailable" ? 503 : 200;

    return Response.json(report, {
      status: statusCode,
      headers,
    });
  } catch (err: unknown) {
    logOperationalEvent({
      level: "critical",
      eventType: "readiness_check_failed",
      correlationId,
      message: "Health/readiness endpoint encontrou uma exceção não tratada",
      details: { error_type: err instanceof Error ? err.name : "UnknownError" },
    });

    return Response.json(
      {
        status: "unavailable",
        timestamp: new Date().toISOString(),
        version: "0.1.0",
        error: "Serviço temporariamente indisponível.",
      },
      {
        status: 503,
        headers,
      }
    );
  }
}
