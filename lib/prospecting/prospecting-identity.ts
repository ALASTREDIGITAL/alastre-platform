import crypto from "node:crypto";

export interface RawIdentitySource {
  cid?: string | null;
  place_id?: string | null;
  maps_url?: string | null;
  phone?: string | null;
  name?: string | null;
}

/**
 * Normaliza a URL do Google Maps removendo parâmetros voláteis de rastreamento.
 */
export function normalizeCanonicalMapsUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    // Preserva host e path canônico (ex: /maps/place/...)
    // Remove query params voláteis (ex: entry, g_ep, authuser)
    parsed.searchParams.delete("entry");
    parsed.searchParams.delete("g_ep");
    parsed.searchParams.delete("authuser");
    parsed.searchParams.delete("hl");
    parsed.searchParams.delete("gl");
    // Normaliza trailing slash
    let pathname = parsed.pathname;
    if (pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    return `${parsed.protocol}//${parsed.host}${pathname}${parsed.search}`;
  } catch {
    return urlStr.trim().toLowerCase();
  }
}

/**
 * Normaliza telefone para formato numérico consistente (preferência E.164).
 */
export function normalizePhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) {
    // Número brasileiro sem DDI
    return `+55${digits}`;
  }
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

/**
 * Constrói a chave de identidade definitiva seguindo a hierarquia estrita:
 * 1. CID (cid:<val>)
 * 2. Place ID (place_id:<val>)
 * 3. Canonical Maps URL (maps_url:<normalized>)
 * 4. Telefone E.164 como fallback (phone:<e164>)
 *
 * NOTA CRÍTICA: Nome isolado JAMAIS é aceito como chave definitiva.
 */
export function buildIdentityKey(source: RawIdentitySource): string | null {
  if (source.cid && source.cid.trim().length > 0) {
    return `cid:${source.cid.trim()}`;
  }

  if (source.place_id && source.place_id.trim().length > 0) {
    return `place_id:${source.place_id.trim()}`;
  }

  if (source.maps_url && source.maps_url.trim().length > 0) {
    const rawUrl = source.maps_url.trim();
    // Tenta extrair CID se estiver presente na query do Maps
    try {
      const parsed = new URL(rawUrl);
      const urlCid = parsed.searchParams.get("cid");
      if (urlCid && urlCid.trim()) {
        return `cid:${urlCid.trim()}`;
      }
    } catch {
      // Ignora erro de parse de URL
    }

    const normalizedUrl = normalizeCanonicalMapsUrl(rawUrl);
    if (normalizedUrl.length > 0) {
      return `maps_url:${normalizedUrl}`;
    }
  }

  if (source.phone && source.phone.trim().length > 0) {
    const norm = normalizePhone(source.phone);
    if (norm.length > 5) {
      return `phone:${norm}`;
    }
  }

  // Nome isolado é rejeitado como identidade definitiva
  return null;
}

/**
 * Gera hash SHA-256 para o registro durável do Do Not Contact (DNC).
 */
export function hashDncIdentifier(rawIdentifier: string): string {
  const normalized = rawIdentifier.trim().toLowerCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}
