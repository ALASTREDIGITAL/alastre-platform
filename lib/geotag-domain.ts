import piexif from "piexifjs";

export type ClientDnaLike = {
  id: string;
  name: string;
  slug?: string;
  dna?: {
    status?: string;
    business_data?: Record<string, unknown>;
    source_summary?: Record<string, unknown>;
  };
};

export type GeotagMetadata = {
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  country: string;
  countryCode: string;
  state: string;
  city: string;
  neighborhood: string;
  address: string;
  postalCode: string;
  title: string;
  description: string;
  keywords: string[];
  artist: string;
  captionAuthor: string;
  copyright: string;
  credit: string;
  phone: string;
  website: string;
};

export function defaultGeotagMetadata(): GeotagMetadata {
  return {
    latitude: null,
    longitude: null,
    altitude: 0,
    country: "Brasil",
    countryCode: "BR",
    state: "",
    city: "",
    neighborhood: "",
    address: "",
    postalCode: "",
    title: "",
    description: "",
    keywords: [],
    artist: "",
    captionAuthor: "Alastre Digital",
    copyright: "",
    credit: "Alastre Digital",
    phone: "",
    website: "",
  };
}

export function extractClientDnaMetadata(client: ClientDnaLike): GeotagMetadata {
  const meta = defaultGeotagMetadata();
  const name = client.name || "";
  const b = client.dna?.business_data ?? {};

  const city = String(b.city ?? (Array.isArray(b.cities) ? b.cities[0] : "") ?? "").trim();
  const state = String(b.state ?? "").trim();
  const address = String(b.address ?? "").trim();
  const neighborhood = String(b.neighborhood ?? "").trim();
  const postalCode = String(b.postal_code ?? b.cep ?? "").trim();
  const primaryService = String(b.primary_service ?? b.segment ?? "").trim();
  const phone = String(b.phone ?? b.whatsapp ?? "").trim();
  const website = String(b.website ?? "").trim();
  const description = String(b.description ?? "").trim();

  meta.country = "Brasil";
  meta.countryCode = "BR";
  meta.city = city;
  meta.state = state;
  meta.address = address;
  meta.neighborhood = neighborhood;
  meta.postalCode = postalCode;
  meta.phone = phone;
  meta.website = website;
  meta.artist = name;
  meta.captionAuthor = "Alastre Digital";
  meta.credit = "Alastre Digital";
  meta.copyright = name ? `© ${new Date().getFullYear()} ${name}. Todos os direitos reservados.` : "";

  // Title: Service + City + Name
  if (primaryService && city && name) {
    meta.title = `${primaryService} em ${city} - ${name}`;
  } else if (city && name) {
    meta.title = `${name} - ${city}`;
  } else {
    meta.title = name;
  }

  // Description
  if (description) {
    meta.description = description;
  } else if (name) {
    const parts = [
      primaryService ? `${primaryService} com excelência em ${city || "sua região"}.` : `${name} - atendimento especializado.`,
      address ? `Endereço: ${address}.` : "",
      phone ? `Contato / WhatsApp: ${phone}.` : "",
      website ? `Website: ${website}` : "",
    ].filter(Boolean);
    meta.description = parts.join(" ");
  }

  // Keywords gathering
  const gathered = new Set<string>();
  if (b.primary_keyword && typeof b.primary_keyword === "string") {
    gathered.add(b.primary_keyword.trim());
  }

  const rawKeywords = b.keywords;
  if (Array.isArray(rawKeywords)) {
    rawKeywords.forEach((k) => {
      if (typeof k === "string" && k.trim()) gathered.add(k.trim());
    });
  } else if (typeof rawKeywords === "string") {
    rawKeywords.split(/[\n,;]+/).forEach((k) => {
      if (k.trim()) gathered.add(k.trim());
    });
  }

  const rawServices = b.services;
  if (Array.isArray(rawServices)) {
    rawServices.forEach((s) => {
      if (typeof s === "string" && s.trim()) gathered.add(s.trim());
    });
  }

  if (primaryService) gathered.add(primaryService);
  if (b.segment && typeof b.segment === "string") gathered.add(b.segment.trim());
  if (city) {
    gathered.add(city);
    if (primaryService) gathered.add(`${primaryService} em ${city}`);
  }
  if (neighborhood) gathered.add(neighborhood);
  if (name) gathered.add(name);

  meta.keywords = Array.from(gathered).slice(0, 30);

  if (typeof b.latitude === "number" && typeof b.longitude === "number") {
    meta.latitude = b.latitude;
    meta.longitude = b.longitude;
  }

  return meta;
}

export function toDms(value: number): [[number, number], [number, number], [number, number]] {
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const secondsFloat = (minutesFloat - minutes) * 60;
  const seconds = Math.round(secondsFloat * 10000);
  return [
    [degrees, 1],
    [minutes, 1],
    [seconds, 10000],
  ];
}

export function formatSexagesimal(value: number | null, type: "lat" | "lng"): string {
  if (value === null || typeof value !== "number" || isNaN(value)) return "--";
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = ((minutesFloat - minutes) * 60).toFixed(2);
  const ref = type === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${degrees}° ${minutes}' ${seconds}" ${ref}`;
}

export function stringToUcs2Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes.push(code & 0xff);
    bytes.push((code >> 8) & 0xff);
  }
  // Windows XP tags require two null terminators at the end
  bytes.push(0);
  bytes.push(0);
  return bytes;
}

export function injectExifMetadata(dataUrl: string, metadata: GeotagMetadata): string {
  let exif: Record<string, Record<number, unknown>>;
  try {
    exif = piexif.load(dataUrl) as Record<string, Record<number, unknown>>;
  } catch {
    exif = {
      "0th": {},
      Exif: {},
      GPS: {},
      Interop: {},
      "1st": {},
      thumbnail: null as never,
    };
  }

  exif["0th"] ??= {};
  exif.Exif ??= {};
  exif.GPS ??= {};

  // Standard 0th tags
  if (metadata.description || metadata.title) {
    exif["0th"][piexif.ImageIFD.ImageDescription] = metadata.description || metadata.title;
  }
  if (metadata.artist) {
    exif["0th"][piexif.ImageIFD.Artist] = metadata.artist;
  }
  if (metadata.copyright) {
    exif["0th"][piexif.ImageIFD.Copyright] = metadata.copyright;
  }
  exif["0th"][piexif.ImageIFD.Software] = "Alastre Platform (GeoSetter)";

  // Windows XP Tags (XPTitle, XPComment, XPAuthor, XPKeywords, XPSubject)
  if (metadata.title) {
    exif["0th"][piexif.ImageIFD.XPTitle] = stringToUcs2Bytes(metadata.title);
    exif["0th"][piexif.ImageIFD.XPSubject] = stringToUcs2Bytes(metadata.title);
  }
  if (metadata.description) {
    exif["0th"][piexif.ImageIFD.XPComment] = stringToUcs2Bytes(metadata.description);
  }
  if (metadata.artist) {
    exif["0th"][piexif.ImageIFD.XPAuthor] = stringToUcs2Bytes(metadata.artist);
  }
  if (metadata.keywords.length > 0) {
    exif["0th"][piexif.ImageIFD.XPKeywords] = stringToUcs2Bytes(metadata.keywords.join("; "));
  }

  // GPS IFD
  if (metadata.latitude !== null && metadata.longitude !== null) {
    exif.GPS[piexif.GPSIFD.GPSLatitudeRef] = metadata.latitude >= 0 ? "N" : "S";
    exif.GPS[piexif.GPSIFD.GPSLatitude] = toDms(metadata.latitude);
    exif.GPS[piexif.GPSIFD.GPSLongitudeRef] = metadata.longitude >= 0 ? "E" : "W";
    exif.GPS[piexif.GPSIFD.GPSLongitude] = toDms(metadata.longitude);

    if (metadata.altitude !== null && !isNaN(metadata.altitude)) {
      exif.GPS[piexif.GPSIFD.GPSAltitudeRef] = metadata.altitude >= 0 ? 0 : 1;
      exif.GPS[piexif.GPSIFD.GPSAltitude] = [Math.round(Math.abs(metadata.altitude) * 100), 100];
    }
  }

  const dumped = piexif.dump(exif as never);
  return piexif.insert(dumped, dataUrl);
}

// Convert any image File to JPEG Data URL using HTML5 Canvas or FileReader
export async function fileToJpegDataUrl(file: File): Promise<string> {
  const isJpeg = /jpe?g/i.test(file.type) || /\.jpe?g$/i.test(file.name);
  if (isJpeg) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("invalid_data_url")));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  // Non-JPEG: convert via Canvas
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas_context_unavailable");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.95));
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_load_failed"));
    };
    img.src = url;
  });
}

// Helper: base64 DataURL to Uint8Array
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Zero-dependency PKZIP builder for multiple files
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0 ^ -1;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

export type ZipEntry = {
  name: string;
  data: Uint8Array;
};

export function createZipUint8Array(entries: ZipEntry[]): Uint8Array {
  const localHeaders: Uint8Array[] = [];
  const centralRecords: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // Local file header (30 bytes + name + data)
    const local = new Uint8Array(30 + nameBytes.length + size);
    const lView = new DataView(local.buffer);

    lView.setUint32(0, 0x04034b50, true); // Local file header signature
    lView.setUint16(4, 20, true); // Version needed to extract (2.0)
    lView.setUint16(6, 0, true); // General purpose bit flag
    lView.setUint16(8, 0, true); // Compression method (0 = Store)
    lView.setUint16(10, 0, true); // Last mod file time
    lView.setUint16(12, 0, true); // Last mod file date
    lView.setUint32(14, crc, true); // CRC-32
    lView.setUint32(18, size, true); // Compressed size
    lView.setUint32(22, size, true); // Uncompressed size
    lView.setUint16(26, nameBytes.length, true); // File name length
    lView.setUint16(28, 0, true); // Extra field length

    local.set(nameBytes, 30);
    local.set(entry.data, 30 + nameBytes.length);
    localHeaders.push(local);

    // Central directory header (46 bytes + name)
    const central = new Uint8Array(46 + nameBytes.length);
    const cView = new DataView(central.buffer);

    cView.setUint32(0, 0x02014b50, true); // Central directory header signature
    cView.setUint16(4, 20, true); // Version made by
    cView.setUint16(6, 20, true); // Version needed to extract
    cView.setUint16(8, 0, true); // General purpose bit flag
    cView.setUint16(10, 0, true); // Compression method (0 = Store)
    cView.setUint16(12, 0, true); // Last mod file time
    cView.setUint16(14, 0, true); // Last mod file date
    cView.setUint32(16, crc, true); // CRC-32
    cView.setUint32(20, size, true); // Compressed size
    cView.setUint32(24, size, true); // Uncompressed size
    cView.setUint16(28, nameBytes.length, true); // File name length
    cView.setUint16(30, 0, true); // Extra field length
    cView.setUint16(32, 0, true); // File comment length
    cView.setUint16(34, 0, true); // Disk number start
    cView.setUint16(36, 0, true); // Internal file attributes
    cView.setUint32(38, 0, true); // External file attributes
    cView.setUint32(42, offset, true); // Relative offset of local header

    central.set(nameBytes, 46);
    centralRecords.push(central);

    offset += local.length;
  }

  const centralSize = centralRecords.reduce((sum, r) => sum + r.length, 0);

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const eView = new DataView(eocd.buffer);
  eView.setUint32(0, 0x06054b50, true); // End of central dir signature
  eView.setUint16(4, 0, true); // Number of this disk
  eView.setUint16(6, 0, true); // Disk with start of central directory
  eView.setUint16(8, entries.length, true); // Total entries on this disk
  eView.setUint16(10, entries.length, true); // Total entries in central directory
  eView.setUint32(12, centralSize, true); // Size of central directory
  eView.setUint32(16, offset, true); // Offset of start of central directory
  eView.setUint16(20, 0, true); // ZIP file comment length

  // Combine all parts
  const totalLength = offset + centralSize + eocd.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of localHeaders) {
    result.set(part, pos);
    pos += part.length;
  }
  for (const part of centralRecords) {
    result.set(part, pos);
    pos += part.length;
  }
  result.set(eocd, pos);

  return result;
}

export function getUnderscoreImagePrefix(name: string, keywordsOrServices: string[] = []): string {
  const parts = [name, ...keywordsOrServices.slice(0, 4)];
  return parts
    .map((p) => p.trim().replace(/\s+/g, "_"))
    .filter(Boolean)
    .join("_")
    .replace(/[^\w\u00C0-\u017F_]/g, "")
    .replace(/_+/g, "_");
}

export function getHyphenatedImagePrefix(name: string, keywords: string[] = []): string {
  const topKeywords = keywords.slice(0, 3).join(" ");
  const raw = topKeywords ? `${name} ${topKeywords}` : name;
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateClientDossierText(
  client: ClientDnaLike,
  meta: GeotagMetadata
): string {
  const b = client.dna?.business_data ?? {};
  const name = client.name || meta.artist || "Cliente";

  // Principais serviços e palavras-chave
  const servicesList: string[] = Array.isArray(b.services)
    ? b.services.map(String).filter(Boolean)
    : meta.keywords.slice(0, 4);

  const titleServices = servicesList.length ? servicesList.slice(0, 4) : meta.keywords.slice(0, 3);
  const pipeTitle = titleServices.length ? `${name} | ${titleServices.join(" | ")}` : name;
  const underscoreName = getUnderscoreImagePrefix(name, titleServices);

  const fullAddress = [
    meta.address,
    meta.neighborhood,
    meta.city ? `${meta.city} - ${meta.state || "SP"}` : meta.state,
    meta.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  const lat = meta.latitude;
  const lng = meta.longitude;
  const latLngStr =
    lat !== null && lng !== null ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : "Não configurado";

  const mapsLink =
    lat !== null && lng !== null
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : meta.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          [meta.address, meta.city, meta.state].filter(Boolean).join(", ")
        )}`
      : "Não informado";

  const email = String(
    b.email ??
      (meta.website
        ? `contato@${meta.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "")}`
        : "Não informado")
  );

  const categories: string[] = [];
  if (b.primary_category) categories.push(String(b.primary_category));
  else if (b.segment) categories.push(String(b.segment));

  if (Array.isArray(b.additional_categories)) {
    b.additional_categories.forEach((c) => categories.push(String(c)));
  } else if (Array.isArray(b.secondary_categories)) {
    b.secondary_categories.forEach((c) => categories.push(String(c)));
  }

  const categoriesBlock = categories.length ? categories.join("\n") : "Não informadas";

  // Palavras-chave: lista em linhas
  const rawKeywords = meta.keywords.length ? meta.keywords : servicesList;
  const keywordsLines = rawKeywords.join("\n");

  // Hashtags: #palavra1 #palavra2 para cada termo da linha
  const hashtagLines = rawKeywords
    .map((phrase) =>
      phrase
        .split(/\s+/)
        .map((word) => `#${word.trim()}`)
        .join(" ")
    )
    .join("\n");

  return `### NOME DA EMPRESA
${pipeTitle}

${underscoreName}

### ENDEREÇO
${meta.address || fullAddress || "Não informado"}

### LATITUDE / LONGITUDE
${latLngStr}

###  TELEFONE
${meta.phone || "Não informado"}

### EMAIL
${email}

### LINK GOOGLE MAPS
${mapsLink}

### CATEGORIAS
${categoriesBlock}

### PALAVRAS CHAVE:
${keywordsLines || "Não informadas"}
${hashtagLines || "Não informadas"}
`;
}

