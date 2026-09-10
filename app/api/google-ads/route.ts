import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")
    ?? (process.env.NODE_ENV === "development" ? "ag.alastredigital@gmail.com" : null);
  const functionUrl = process.env.SUPABASE_GOOGLE_ADS_BRIDGE_URL;
  const bridgeSecret = process.env.ALASTRE_BRIDGE_SECRET;

  if (!email) return NextResponse.json({ error: "Acesso não identificado." }, { status: 401 });
  if (!functionUrl || !bridgeSecret) return NextResponse.json({ error: "Integração indisponível." }, { status: 503 });

  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-alastre-user-email": email,
      "x-alastre-bridge-secret": bridgeSecret,
      "x-alastre-write-mode": process.env.ALASTRE_WRITE_MODE ?? "disabled",
    },
    body: await request.text(),
  });
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
