import { NextResponse } from "next/server";
import { validateWorkerToken } from "@/lib/prospecting/worker-security";
import { WorkerHeartbeatRequestSchema } from "@/lib/prospecting/types";
import { globalProspectingLeaseManager } from "@/lib/prospecting/prospecting-lease-manager";

export const dynamic = "force-dynamic";

const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1MB

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
  const parsed = WorkerHeartbeatRequestSchema.safeParse(rawJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid heartbeat payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { job_id, lease_id, worker_id } = parsed.data;
  const result = globalProspectingLeaseManager.heartbeat(job_id, lease_id, worker_id);

  return NextResponse.json(result, { status: 200 });
}
