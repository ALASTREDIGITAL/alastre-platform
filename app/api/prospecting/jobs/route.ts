import { NextResponse } from "next/server";
import { z } from "zod";
import { globalProspectingLeaseManager } from "@/lib/prospecting/prospecting-lease-manager";

export const dynamic = "force-dynamic";

const CreateOperatorJobSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2, "O nicho ou termo de busca deve conter pelo menos 2 caracteres.")
    .max(100, "O termo de busca não pode exceder 100 caracteres.")
    .regex(/^[^<>"{};]+$/, "Caracteres inválidos detectados no termo de busca."),
  city: z
    .string()
    .trim()
    .min(2, "A cidade deve conter pelo menos 2 caracteres.")
    .max(100, "O nome da cidade não pode exceder 100 caracteres.")
    .regex(/^[^<>"{};]+$/, "Caracteres inválidos detectados na cidade."),
  state: z
    .string()
    .trim()
    .min(2, "Informe a UF do estado.")
    .max(50)
    .regex(/^[^<>"{};]+$/, "Caracteres inválidos detectados no estado."),
  limit: z.coerce.number().int().min(1).max(10).default(10),
  qualificationOptions: z
    .object({
      withoutWebsite: z.boolean().optional(),
      withoutPhone: z.boolean().optional(),
      fewReviews: z.boolean().optional(),
      lowRating: z.boolean().optional(),
      incompleteInfo: z.boolean().optional(),
      unclaimedProfile: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const rawJson = await request.json().catch(() => null);
  const parsed = CreateOperatorJobSchema.safeParse(rawJson);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Parâmetros de prospecção inválidos.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  // Confirmação de disponibilidade do motor de prospecção (Requisito 2)
  const allowOfflineQueue = request.headers.get("x-allow-offline-queue") === "true";
  const health = globalProspectingLeaseManager.getSupervisorHealth();
  if (!health.online && !allowOfflineQueue && process.env.NODE_ENV !== "test") {
    return NextResponse.json(
      {
        error: "O motor de prospecção local está offline no momento.",
        message: health.message,
        suggestion: "Inicie o supervisor executando 'npm run dev:all' no terminal.",
      },
      { status: 503 }
    );
  }

  // Limite da homologação: Apenas uma execução ativa por operador
  if (globalProspectingLeaseManager.hasActiveJob()) {
    const active = globalProspectingLeaseManager.getActiveJob();
    return NextResponse.json(
      {
        error: "Já existe uma prospecção ativa em andamento no momento.",
        activeJobId: active?.id,
        activeStatus: active?.status,
      },
      { status: 409 }
    );
  }

  const { query, city, state, limit } = parsed.data;
  const location = `${city} - ${state}`;

  // Criação do job seguro na fila da homologação
  const job = globalProspectingLeaseManager.createJob({
    agency_id: "agency_homolog",
    query,
    location,
    limit: Math.min(limit, 10),
  });

  return NextResponse.json(
    {
      success: true,
      job,
      message: "Prospecção enfileirada com sucesso para o supervisor local.",
    },
    { status: 201 }
  );
}

export async function GET() {
  const activeJob = globalProspectingLeaseManager.getActiveJob();
  const allJobs = globalProspectingLeaseManager.getAllJobs();
  const supervisorHealth = globalProspectingLeaseManager.getSupervisorHealth();

  return NextResponse.json({
    activeJob,
    totalJobs: allJobs.length,
    recentJobs: allJobs.slice(-5).reverse(),
    supervisorHealth,
  });
}
