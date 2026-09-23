import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  extractClientDnaMetadata,
  defaultGeotagMetadata,
  toDms,
  formatSexagesimal,
  stringToUcs2Bytes,
  crc32,
  createZipUint8Array,
  generateClientDossierText,
  getHyphenatedImagePrefix,
  getUnderscoreImagePrefix,
  type ClientDnaLike,
} from "../lib/geotag-domain.ts";

describe("Geotag Domain & DNA Extraction", () => {
  const mockClient: ClientDnaLike = {
    id: "client-pinheiro-123",
    name: "Pinheiro Estética Automotiva",
    slug: "pinheiro-estetica",
    dna: {
      status: "confirmed",
      business_data: {
        name: "Pinheiro Estética Automotiva",
        segment: "Estética Automotiva",
        primary_service: "Vitrificação e Polimento Técnico",
        services: ["Vitrificação de Pintura", "Polimento Técnico", "Higienização Interna", "Lavagem Detalhada"],
        city: "Diadema",
        state: "São Paulo",
        neighborhood: "Taboão",
        address: "R. dos Pessegueiros, 522 - Taboão, Diadema - SP, 09980-000",
        phone: "(11) 98765-4321",
        whatsapp: "(11) 98765-4321",
        website: "https://pinheiroestetica.com.br",
        description: "Centro especializado em estética automotiva de alto padrão em Diadema.",
        primary_keyword: "estética automotiva diadema",
        keywords: ["vitrificação diadema", "polimento automotivo sp", "estética automotiva taboão"],
        latitude: -23.68215,
        longitude: -46.61234,
      },
    },
  };

  test("extrai metadados completos a partir do DNA do cliente", () => {
    const meta = extractClientDnaMetadata(mockClient);

    assert.equal(meta.country, "Brasil");
    assert.equal(meta.countryCode, "BR");
    assert.equal(meta.state, "São Paulo");
    assert.equal(meta.city, "Diadema");
    assert.equal(meta.neighborhood, "Taboão");
    assert.equal(meta.address, "R. dos Pessegueiros, 522 - Taboão, Diadema - SP, 09980-000");
    assert.equal(meta.phone, "(11) 98765-4321");
    assert.equal(meta.website, "https://pinheiroestetica.com.br");
    assert.equal(meta.artist, "Pinheiro Estética Automotiva");
    assert.equal(meta.credit, "Alastre Digital");
    assert.ok(meta.copyright.includes("Pinheiro Estética Automotiva"));

    // Título SEO
    assert.equal(meta.title, "Vitrificação e Polimento Técnico em Diadema - Pinheiro Estética Automotiva");

    // Descrição
    assert.equal(meta.description, "Centro especializado em estética automotiva de alto padrão em Diadema.");

    // Coordenadas
    assert.equal(meta.latitude, -23.68215);
    assert.equal(meta.longitude, -46.61234);

    // Palavras-chave agregadas
    assert.ok(meta.keywords.includes("estética automotiva diadema"));
    assert.ok(meta.keywords.includes("vitrificação diadema"));
    assert.ok(meta.keywords.includes("Vitrificação de Pintura"));
    assert.ok(meta.keywords.includes("Diadema"));
    assert.ok(meta.keywords.includes("Taboão"));
    assert.ok(meta.keywords.includes("Pinheiro Estética Automotiva"));
  });

  test("gera metadados com fallback seguro para cliente sem DNA ou dados parciais", () => {
    const sparseClient: ClientDnaLike = {
      id: "sparse-1",
      name: "Bionippon",
    };

    const meta = extractClientDnaMetadata(sparseClient);
    assert.equal(meta.artist, "Bionippon");
    assert.equal(meta.title, "Bionippon");
    assert.ok(meta.description.includes("Bionippon"));
    assert.equal(meta.latitude, null);
    assert.equal(meta.longitude, null);
  });

  test("converte coordenadas decimais para sexagesimal e DMS racional", () => {
    const lat = -23.68215;
    const lng = -46.61234;

    const latDms = toDms(lat);
    assert.equal(latDms[0][0], 23);
    assert.equal(latDms[0][1], 1);
    assert.equal(latDms[1][0], 40);
    assert.equal(latDms[1][1], 1);

    const latSex = formatSexagesimal(lat, "lat");
    assert.ok(latSex.startsWith("23° 40'"));
    assert.ok(latSex.endsWith("S"));

    const lngSex = formatSexagesimal(lng, "lng");
    assert.ok(lngSex.startsWith("46° 36'"));
    assert.ok(lngSex.endsWith("W"));

    assert.equal(formatSexagesimal(null, "lat"), "--");
  });

  test("codifica strings para UCS-2 / UTF-16LE com duplo terminador nulo para Windows XP tags", () => {
    const text = "Polimento";
    const bytes = stringToUcs2Bytes(text);

    // Cada caractere gera 2 bytes + 2 bytes nulos no final
    assert.equal(bytes.length, text.length * 2 + 2);
    assert.equal(bytes[bytes.length - 1], 0);
    assert.equal(bytes[bytes.length - 2], 0);
    // 'P' = 80
    assert.equal(bytes[0], 80);
    assert.equal(bytes[1], 0);
  });

  test("calcula CRC32 e empacota arquivos em ZIP sem dependências externas", () => {
    const sampleData = new TextEncoder().encode("Conteúdo da imagem geotagada de teste");
    const checksum = crc32(sampleData);
    assert.ok(checksum > 0);

    const entries = [
      { name: "foto1-geotag.jpg", data: sampleData },
      { name: "foto2-geotag.jpg", data: sampleData },
    ];

    const zipBytes = createZipUint8Array(entries);
    assert.ok(zipBytes.length > sampleData.length * 2);

    // Valida assinatura do Local File Header: 0x50, 0x4b, 0x03, 0x04 ('PK\x03\x04')
    assert.equal(zipBytes[0], 0x50);
    assert.equal(zipBytes[1], 0x4b);
    assert.equal(zipBytes[2], 0x03);
    assert.equal(zipBytes[3], 0x04);

    // Valida presença da assinatura de fim de diretório central: 'PK\x05\x06'
    let hasEocd = false;
    for (let i = 0; i < zipBytes.length - 4; i++) {
      if (
        zipBytes[i] === 0x50 &&
        zipBytes[i + 1] === 0x4b &&
        zipBytes[i + 2] === 0x05 &&
        zipBytes[i + 3] === 0x06
      ) {
        hasEocd = true;
        break;
      }
    }
    assert.ok(hasEocd, "Arquivo ZIP gerado deve conter assinatura EOCD válida");
  });

  test("gera documento completo no padrão ClickUp e Drive com nomes com hífen e underscores", () => {
    const meta = extractClientDnaMetadata(mockClient);
    const services = mockClient.dna?.business_data?.services as string[];
    const prefix = getUnderscoreImagePrefix(mockClient.name, services);

    assert.ok(prefix.includes("Pinheiro_Estética_Automotiva"));
    assert.ok(!prefix.includes(" "));

    const dossier = generateClientDossierText(mockClient, meta);

    // Valida seções do template oficial da agência
    assert.ok(dossier.includes("### NOME DA EMPRESA"));
    assert.ok(dossier.includes("Pinheiro Estética Automotiva"));
    assert.ok(dossier.includes(prefix));
    assert.ok(dossier.includes("### ENDEREÇO"));
    assert.ok(dossier.includes("R. dos Pessegueiros, 522"));
    assert.ok(dossier.includes("### LATITUDE / LONGITUDE"));
    assert.ok(dossier.includes("-23.682150, -46.612340"));
    assert.ok(dossier.includes("### LINK GOOGLE MAPS"));
    assert.ok(dossier.includes("https://www.google.com/maps/search/?api=1&query=-23.68215,-46.61234"));
    assert.ok(dossier.includes("###  TELEFONE"));
    assert.ok(dossier.includes("(11) 98765-4321"));
    assert.ok(dossier.includes("### CATEGORIAS"));
    assert.ok(dossier.includes("Estética Automotiva"));
    assert.ok(dossier.includes("### PALAVRAS CHAVE:"));
    assert.ok(dossier.includes("#estética #automotiva #diadema"));
  });
});
