import { NextResponse } from "next/server";
import { checkPlatformHealth, getCorrelationId, logOperationalEvent } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const report = await checkPlatformHealth();
    
    logOperationalEvent({
      level: report.status === "unavailable" ? "error" : report.status === "degraded" ? "warn" : "info",
      eventType: "health_check_performed",
      correlationId,
      message: `Health check status: ${report.status}`,
      details: {
        status: report.status,
        write_mode: report.write_mode,
        database_status: report.services.database.status,
        google_provider_status: report.services.google_provider.status,
      },
    });

    const statusCode = report.status === "unavailable" ? 503 : 200;

    return NextResponse.json(report, {
      status: statusCode,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Correlation-ID": correlationId,
      },
    });
  } catch (err: unknown) {
    logOperationalEvent({
      level: "critical",
      eventType: "health_check_failed",
      correlationId,
      message: "Health check endpoint encountered an unhandled exception",
      details: { error_type: err instanceof Error ? err.name : "UnknownError" },
    });

    return NextResponse.json(
      {
        status: "unavailable",
        timestamp: new Date().toISOString(),
        version: "0.1.0",
        error: "Serviço temporariamente indisponível.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Correlation-ID": correlationId,
        },
      }
    );
  }
}
