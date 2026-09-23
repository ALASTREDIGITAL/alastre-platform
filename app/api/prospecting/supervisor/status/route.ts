import { NextResponse } from "next/server";
import { globalProspectingLeaseManager } from "@/lib/prospecting/prospecting-lease-manager";

export const dynamic = "force-dynamic";

/**
 * Health check real do motor de prospecção (Requisitos 1, 2 e 3).
 * Retorna se o supervisor local está online com heartbeat recente,
 * tempo decorrido desde o último sinal e mensagem contextual.
 */
export async function GET() {
  const health = globalProspectingLeaseManager.getSupervisorHealth();
  return NextResponse.json(health, { status: 200 });
}
