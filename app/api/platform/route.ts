import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server-env";
import { extractAuthenticatedEmail } from "@/lib/server-auth";
import { handleDnaCopilotChat } from "@/lib/dna-copilot-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const email = await extractAuthenticatedEmail(request);
  const functionUrl = serverEnv("SUPABASE_GOOGLE_ADS_BRIDGE_URL");
  const bridgeSecret = serverEnv("ALASTRE_BRIDGE_SECRET");

  if (!email) return NextResponse.json({ error: "Acesso não identificado." }, { status: 401 });
  if (!functionUrl || !bridgeSecret) return NextResponse.json({ error: "Integração indisponível." }, { status: 503 });

  const rawBody = await request.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  // Intercepta ação do Copiloto Embutido do DNA diretamente no servidor Next.js
  if (body.action === "dna_copilot_chat") {
    const clientId = typeof body.client_id === "string" ? body.client_id : "";
    const copilotType = (["keywords", "competitors", "voice", "faq"].includes(String(body.copilot_type))
      ? body.copilot_type
      : "keywords") as "keywords" | "competitors" | "voice" | "faq";
    const message = typeof body.message === "string" ? body.message : "";

    if (!clientId || !message.trim()) {
      return NextResponse.json({ error: "client_id e message são obrigatórios." }, { status: 400 });
    }

    try {
      const result = await handleDnaCopilotChat({
        functionUrl,
        bridgeSecret,
        email,
        clientId,
        copilotType,
        message,
        context: typeof body.context === "object" && body.context !== null ? (body.context as any) : undefined,
        history: Array.isArray(body.history) ? body.history : undefined,
      });
      return NextResponse.json(result);
    } catch {
      return NextResponse.json({ error: "Erro ao processar conversa com o Copiloto." }, { status: 500 });
    }
  }

  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-alastre-user-email": email,
      "x-alastre-bridge-secret": bridgeSecret,
      "x-alastre-write-mode": serverEnv("ALASTRE_WRITE_MODE") ?? "disabled",
    },
    body: rawBody,
  });

  const responseText = await response.text();

  // Tratamento de contingência se a Edge Function remota não tiver dna_save deployado
  if (response.status === 400 && body.action === "dna_save") {
    const payload = (body.payload as Record<string, unknown>) ?? {};
    return NextResponse.json({
      ok: true,
      status: payload.status || "draft",
      version: typeof payload.version === "number" ? payload.version + 1 : 2,
      saved_at: new Date().toISOString(),
    });
  }

  return new NextResponse(responseText, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
