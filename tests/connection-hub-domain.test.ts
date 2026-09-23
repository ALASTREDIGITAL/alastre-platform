import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  canBindResource,
  connectionHubRequest,
  getClientConnectionContract,
  googleCloudAdministration,
  healthCopy,
  providers,
  statusCopy,
} from "../lib/connection-hub-domain.ts";

describe("Connection Hub domain", () => {
  test("expõe catálogo sem credenciais", () => {
    const google = providers.find((p) => p.key === "google");
    assert.ok(google);
    assert.equal(google.capabilities.length, 5);
    assert.equal(google.managementMode, "platform_managed");
    assert.doesNotMatch(JSON.stringify(providers), /token|secret|api\.key/i);
  });

  test("registra somente identificadores administrativos públicos", () => {
    assert.equal(googleCloudAdministration.projectId, "alastre-platform");
    assert.equal(googleCloudAdministration.writeMode, "disabled");
  });

  test("traduz estados técnicos", () => {
    assert.equal(statusCopy.expired.label, "Reconexão necessária");
    assert.equal(statusCopy.disconnected.label, "Não conectado");
    assert.equal(healthCopy.provider_pending.label, "Aguardando liberação");
  });

  test("bloqueia binding entre tenants", () => {
    assert.equal(
      canBindResource({
        clientAgencyId: "a",
        resourceAgencyId: "b",
        resourceCapability: "google_ads",
        requestedCapability: "google_ads",
        resourceActive: true,
      }),
      false,
    );
    assert.equal(
      canBindResource({
        clientAgencyId: "a",
        resourceAgencyId: "a",
        resourceCapability: "google_ads",
        requestedCapability: "google_ads",
        resourceActive: true,
      }),
      true,
    );
  });

  test("valida contratos", () => {
    assert.equal(
      connectionHubRequest.safeParse({
        action: "connection_status",
        connection_id: "x",
      }).success,
      false,
    );
    assert.equal(
      getClientConnectionContract("client", "google_business_profile")
        .requires_status,
      "connected",
    );
  });
});
