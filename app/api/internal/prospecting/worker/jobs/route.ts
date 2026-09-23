import { NextResponse } from "next/server";
import { z } from "zod";
import { validateWorkerToken } from "@/lib/prospecting/worker-security";
import { globalProspectingLeaseManager } from "@/lib/prospecting/prospecting-lease-manager";

export const dynamic = "force-dynamic";

const CreateJobPayloadSchema = z.object({
  agency_id: z.string().default("agency_test"),
  query: z.string().min(1),
  location: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10),
});

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!validateWorkerToken(authHeader)) {
    return NextResponse.json({ error: "Unauthorized worker" }, { status: 401 });
  }

  const rawJson = await request.json().catch(() => null);
  const parsed = CreateJobPayloadSchema.safeParse(rawJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid create job payload", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const job = globalProspectingLeaseManager.createJob(parsed.data);
  return NextResponse.json({ success: true, job }, { status: 201 });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!validateWorkerToken(authHeader)) {
    return NextResponse.json({ error: "Unauthorized worker" }, { status: 401 });
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get("job_id");
  if (!jobId) {
    return NextResponse.json({ error: "job_id is required" }, { status: 400 });
  }

  const job = globalProspectingLeaseManager.getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const leads = globalProspectingLeaseManager.getLeadsForJob(jobId);
  const blockTelemetry = globalProspectingLeaseManager.getBlockTelemetry(jobId);

  return NextResponse.json({ job, leads, blockTelemetry }, { status: 200 });
}

export async function DELETE(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!validateWorkerToken(authHeader)) {
    return NextResponse.json({ error: "Unauthorized worker" }, { status: 401 });
  }

  globalProspectingLeaseManager.reset(true);
  return NextResponse.json({ success: true, message: "Test store reset" }, { status: 200 });
}
