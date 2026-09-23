import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildIdentityKey,
  normalizeCanonicalMapsUrl,
  normalizePhone,
  hashDncIdentifier,
} from "../lib/prospecting/prospecting-identity.ts";

describe("Prospecting Identity & Normalization Rules (Condição 3 e 7)", () => {
  it("prioritizes CID over Place ID, URL and Phone", () => {
    const key = buildIdentityKey({
      cid: "1234567890123456789",
      place_id: "ChIJN1t_tDeuEmsRUsoyG83frY4",
      maps_url: "https://www.google.com/maps/place/Vidracaria",
      phone: "(15) 3232-1234",
      name: "Vidraçaria Real",
    });
    assert.equal(key, "cid:1234567890123456789");
  });

  it("prioritizes Place ID when CID is absent", () => {
    const key = buildIdentityKey({
      place_id: "ChIJN1t_tDeuEmsRUsoyG83frY4",
      maps_url: "https://www.google.com/maps/place/Vidracaria",
      phone: "(15) 3232-1234",
      name: "Vidraçaria Real",
    });
    assert.equal(key, "place_id:ChIJN1t_tDeuEmsRUsoyG83frY4");
  });

  it("extracts CID from Google Maps URL if present", () => {
    const key = buildIdentityKey({
      maps_url: "https://www.google.com/maps?cid=9876543210987654321&hl=pt",
      phone: "(15) 3232-1234",
      name: "Vidraçaria Modelo",
    });
    assert.equal(key, "cid:9876543210987654321");
  });

  it("uses canonical Maps URL when CID and Place ID are absent", () => {
    const key = buildIdentityKey({
      maps_url: "https://www.google.com/maps/place/Vidracaria+Silva/@-23.50,47.45?entry=ttu&authuser=0",
      phone: "(15) 3232-1234",
      name: "Vidraçaria Silva",
    });
    assert.equal(
      key,
      "maps_url:https://www.google.com/maps/place/Vidracaria+Silva/@-23.50,47.45"
    );
  });

  it("falls back to normalized E.164 phone when online identifiers are absent", () => {
    const key = buildIdentityKey({
      phone: "(15) 99887-1122",
      name: "Vidraçaria Offline",
    });
    assert.equal(key, "phone:+5515998871122");
  });

  it("REJECTS business when only name is present (nome isolado não pode ser definitivo)", () => {
    const key = buildIdentityKey({
      name: "Vidraçaria Fantasma Sem Dados",
    });
    assert.equal(key, null, "Nome isolado jamais pode ser aceito como identidade definitiva");
  });

  it("produces deterministic SHA-256 hash for Do Not Contact records", () => {
    const hash1 = hashDncIdentifier("+5515998871122");
    const hash2 = hashDncIdentifier(" +5515998871122 ");
    assert.equal(hash1.length, 64);
    assert.equal(hash1, hash2);
  });
});
