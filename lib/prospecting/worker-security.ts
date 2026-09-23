import crypto from "node:crypto";

/**
 * Obtém o token secreto do worker configurado exclusivamente via variável de ambiente.
 * Se PROSPECTING_WORKER_SECRET_TOKEN não estiver configurado, a aplicação falha fechada.
 * NENHUM segredo padrão, exemplo funcional ou token estático é permitido no código.
 */
export function getExpectedWorkerToken(): string {
  const token = process.env.PROSPECTING_WORKER_SECRET_TOKEN;
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    throw new Error(
      "PROSPECTING_WORKER_SECRET_TOKEN is not configured in environment. Failing closed."
    );
  }
  return token.trim();
}

/**
 * Validação de token em tempo constante (timingSafeEqual) para proteção contra timing attacks.
 * Falha fechada imediatamente se o token esperado não estiver configurado.
 * Nunca vaza credenciais de banco ou de Supabase para o worker.
 */
export function validateWorkerToken(authHeader: string | null | undefined): boolean {
  if (!authHeader || typeof authHeader !== "string") {
    return false;
  }

  let expectedToken: string;
  try {
    expectedToken = getExpectedWorkerToken();
  } catch (err) {
    console.error("[WORKER-AUTH-FAIL-TOKEN-UNSET]", err);
    // Falha fechada: sem token configurado, nenhuma requisição é autorizada
    return false;
  }

  const parts = authHeader.trim().split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    console.error("[WORKER-AUTH-FAIL-HEADER-FORMAT]", authHeader);
    return false;
  }

  const providedToken = parts[1];
  const providedBuf = Buffer.from(providedToken, "utf8");
  const expectedBuf = Buffer.from(expectedToken, "utf8");

  if (providedBuf.length !== expectedBuf.length) {
    console.error(`[WORKER-AUTH-FAIL-LENGTH-MISMATCH] providedLen=${providedBuf.length} expectedLen=${expectedBuf.length}`);
    // Mitigação de vazamento de comprimento via tempo: executa dummy timingSafeEqual
    crypto.timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }

  const match = crypto.timingSafeEqual(providedBuf, expectedBuf);
  if (!match) {
    console.error("[WORKER-AUTH-FAIL-MISMATCH]");
  }
  return match;
}
