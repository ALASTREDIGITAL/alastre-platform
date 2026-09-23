import { NextResponse } from "next/server";
import { validateWorkerToken } from "@/lib/prospecting/worker-security";
import { WorkerClaimRequestSchema } from "@/lib/prospecting/types";
import { globalProspectingLeaseManager } from "@/lib/prospecting/prospecting-lease-manager";

export const dynamic = "force-dynamic";

const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1MB

export async function POST(request: Request) {
  // Validação segura de token em tempo constante (sem credenciais Supabase expostas)
  const authHeader = request.headers.get("authorization");
  if (!validateWorkerToken(authHeader)) {
    return NextResponse.json({ error: "Unauthorized worker" }, { status: 401 });
  }

  // Limite de tamanho de payload
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const rawJson = await request.json().catch(() => null);
  const parsed = WorkerClaimRequestSchema.safeParse(rawJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid claim request payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { worker_id } = parsed.data;
  const result = globalProspectingLeaseManager.claimJob(worker_id);

  return NextResponse.json(result, { status: 200 });
}
