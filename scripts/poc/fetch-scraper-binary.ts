import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

export const PINNED_UPSTREAM_VERSION = "v1.18.1";
export const EXPECTED_SHA256 =
  "C124FAB30F12E4AAE25EF52F38EB2BEA5422ECE708B3171CA0F34BE56CF7848F";
export const OFFICIAL_DOWNLOAD_URL =
  "https://github.com/gosom/google-maps-scraper/releases/download/v1.18.1/google_maps_scraper-1.18.1-windows-amd64.exe";

export function computeFileSha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex").toUpperCase();
}

/**
 * Processo reproduzível de obtenção com versão fixada, origem oficial
 * e validação estrita de integridade via SHA-256 antes de qualquer execução.
 */
export async function ensureScraperBinary(): Promise<string> {
  const binDir = path.resolve(process.cwd(), "scripts", "poc", "bin");
  const targetBinary = path.join(binDir, "google_maps_scraper.exe");

  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  // Verifica se o binário já existe localmente com hash idêntico
  if (fs.existsSync(targetBinary)) {
    const existingHash = computeFileSha256(targetBinary);
    if (existingHash === EXPECTED_SHA256) {
      console.log(`[Segurança] Binário oficial validado: SHA-256 coincide com a versão ${PINNED_UPSTREAM_VERSION}.`);
      return targetBinary;
    }
    console.warn("[Segurança] Hash divergente encontrado. Removendo binário corrompido/antigo...");
    fs.unlinkSync(targetBinary);
  }

  console.log(`[Segurança] Baixando binário oficial fixado (${PINNED_UPSTREAM_VERSION}) de origem oficial...`);
  console.log(`            URL: ${OFFICIAL_DOWNLOAD_URL}`);

  try {
    // Utiliza curl nativo do sistema operacional
    execFileSync("curl.exe", ["-L", "-o", targetBinary, OFFICIAL_DOWNLOAD_URL], {
      stdio: "inherit",
    });
  } catch (err) {
    throw new Error(`Falha no download do binário upstream: ${err}`);
  }

  if (!fs.existsSync(targetBinary)) {
    throw new Error("Arquivo binário não foi gerado após o download.");
  }

  const downloadedHash = computeFileSha256(targetBinary);
  if (downloadedHash !== EXPECTED_SHA256) {
    fs.unlinkSync(targetBinary);
    throw new Error(
      `ALERTA DE SEGURANÇA: SHA-256 inválido! Esperado: ${EXPECTED_SHA256}, Obtido: ${downloadedHash}. Arquivo descartado imediatamente.`
    );
  }

  console.log(`[Segurança] Integridade confirmada! SHA-256: ${downloadedHash}`);
  return targetBinary;
}

if (process.argv[1] && process.argv[1].endsWith("fetch-scraper-binary.ts")) {
  ensureScraperBinary()
    .then((p) => console.log(`Binário pronto em: ${p}`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
