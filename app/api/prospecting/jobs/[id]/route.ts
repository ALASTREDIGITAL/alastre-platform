import { NextResponse } from "next/server";
import { globalProspectingLeaseManager } from "@/lib/prospecting/prospecting-lease-manager";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const jobId = params?.id;

  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json(
      { error: "Identificador do trabalho não informado." },
      { status: 400 }
    );
  }

  const job = globalProspectingLeaseManager.getJob(jobId);
  if (!job) {
    return NextResponse.json(
      { error: "Trabalho de prospecção não encontrado." },
      { status: 404 }
    );
  }

  const leads = globalProspectingLeaseManager.getLeadsForJob(jobId);
  const blockTelemetry = globalProspectingLeaseManager.getBlockTelemetry(jobId);

  return NextResponse.json({
    success: true,
    job,
    leads,
    blockTelemetry,
    totalLeads: leads.length,
  });
}
