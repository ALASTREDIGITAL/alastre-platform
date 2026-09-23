import { NextResponse } from "next/server";
import { validateWorkerToken } from "@/lib/prospecting/worker-security";
import { WorkerCompleteRequestSchema } from "@/lib/prospecting/types";
import { globalProspectingLeaseManager } from "@/lib/prospecting/prospecting-lease-manager";

export const dynamic = "force-dynamic";

const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2MB para batch de leads

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
  const parsed = WorkerCompleteRequestSchema.safeParse(rawJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid completion payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const result = globalProspectingLeaseManager.completeJob(parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Completion failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
