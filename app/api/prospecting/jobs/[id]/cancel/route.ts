import { NextResponse } from "next/server";
import { globalProspectingLeaseManager } from "@/lib/prospecting/prospecting-lease-manager";

export const dynamic = "force-dynamic";

export async function POST(
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

  const cancelled = globalProspectingLeaseManager.requestCancellation(
    jobId,
    "operator_ui"
  );

  if (!cancelled) {
    return NextResponse.json(
      {
        error: "O trabalho já se encontra em estado final e não pode ser cancelado.",
        status: job.status,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Cancelamento solicitado com sucesso ao supervisor.",
    jobId,
  });
}
