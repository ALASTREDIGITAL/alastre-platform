import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { resolveLocalSeoDataProvider } from "../lib/local-seo-data-provider.ts";

const client = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Cliente real",
  slug: "cliente-real",
  status: "active",
  dna: {
    status: "confirmed",
    business_data: { city: "Campinas", services: ["SEO Local"] },
    source_summary: {},
  },
};

describe("LocalSeoDataProvider", () => {
  test("identifica DNA como dado interno real e parcial", () => {
    const workspace = resolveLocalSeoDataProvider({
      googleConnected: false,
    }).load(client);
    assert.equal(workspace.provenance.source, "internal");
    assert.equal(workspace.provenance.isReal, true);
    assert.equal(workspace.provenance.state, "partial");
  });

  test("não inventa dados Google durante a primeira sincronização", () => {
    const workspace = resolveLocalSeoDataProvider({
      googleConnected: true,
    }).load(client);
    assert.equal(workspace.provenance.source, "google_business_profile");
    assert.equal(workspace.provenance.state, "syncing");
    assert.equal(workspace.score.value, null);
  });
});
