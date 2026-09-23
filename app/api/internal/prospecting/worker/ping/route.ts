import { NextResponse } from "next/server";
import { validateWorkerToken } from "@/lib/prospecting/worker-security";
import { WorkerPingRequestSchema } from "@/lib/prospecting/types";
import { globalProspectingLeaseManager } from "@/lib/prospecting/prospecting-lease-manager";

export const dynamic = "force-dynamic";

const MAX_PAYLOAD_BYTES = 64 * 1024; // 64KB

/**
 * Endpoint de ping periódico de saúde do supervisor worker (Requisitos 1 e 2).
 * Permite que o daemon notifique que está online e saudável a cada 3-5 segundos.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!validateWorkerToken(authHeader)) {
    return NextResponse.json({ error: "Unauthorized worker" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const rawJson = await request.json().catch(() => null);
  const parsed = WorkerPingRequestSchema.safeParse(rawJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid ping request payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { worker_id, supported_capabilities } = parsed.data;
  globalProspectingLeaseManager.recordSupervisorHeartbeat(
    worker_id,
    supported_capabilities || []
  );

  return NextResponse.json(
    {
      acknowledged: true,
      worker_id,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
