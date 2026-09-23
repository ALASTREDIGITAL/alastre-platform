import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Alastre Local Inspector Extension Suite", () => {
  const extDir = path.resolve(process.cwd(), "extensions/alastre-local-inspector");

  it("valida integridade e conformidade do manifest.json V3", () => {
    const manifestPath = path.join(extDir, "manifest.json");
    assert.ok(fs.existsSync(manifestPath), "manifest.json deve existir");

    const content = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    assert.equal(content.manifest_version, 3, "Deve ser Manifest V3");
    assert.ok(content.name.includes("Alastre Local Inspector"), "Nome deve conter Alastre Local Inspector");
    assert.ok(Array.isArray(content.permissions), "Permissions deve ser array");
    assert.ok(content.permissions.includes("storage"), "Deve solicitar permissão storage");
    assert.ok(content.permissions.includes("clipboardWrite"), "Deve solicitar permissão clipboardWrite");

    // Verificar existência do service worker
    assert.equal(content.background?.service_worker, "background.js");
    assert.ok(fs.existsSync(path.join(extDir, "background.js")), "background.js deve existir");

    // Verificar content scripts
    assert.ok(Array.isArray(content.content_scripts), "Content scripts deve ser array");
    for (const cs of content.content_scripts) {
      for (const js of cs.js || []) {
        assert.ok(fs.existsSync(path.join(extDir, js)), `Arquivo de script ${js} deve existir`);
      }
      for (const css of cs.css || []) {
        assert.ok(fs.existsSync(path.join(extDir, css)), `Arquivo de estilo ${css} deve existir`);
      }
    }
  });

  it("verifica existência e assinatura válida dos ícones PNG (16, 48, 128)", () => {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    for (const size of [16, 48, 128]) {
      const iconPath = path.join(extDir, "icons", `icon-${size}.png`);
      assert.ok(fs.existsSync(iconPath), `Ícone icon-${size}.png deve existir`);

      const buffer = fs.readFileSync(iconPath);
      assert.ok(buffer.length > 50, `Ícone icon-${size}.png deve ter tamanho válido`);
      assert.equal(
        buffer.subarray(0, 8).equals(pngSignature),
        true,
        `Arquivo icon-${size}.png deve ter assinatura binária de PNG válida`
      );
    }
  });

  it("converte CID hexadecimal de URL para decimal BigInt com precisão", () => {
    // Simula a lógica de conversão do extrator
    const hexCid = "4a1b2c3d4e5f6789";
    const decimalCid = BigInt("0x" + hexCid).toString();

    assert.equal(decimalCid, "5339910424997357449");
    assert.ok(/^\d+$/.test(decimalCid), "CID deve ser string estritamente numérica");
  });

  it("calcula score preliminar e gaps críticos para perfil não reivindicado", () => {
    // Carrega o arquivo local-score.js em contexto simulado
    const code = fs.readFileSync(path.join(extDir, "scripts/local-score.js"), "utf-8");
    const mockWindow: Record<string, unknown> = {};
    const fn = new Function("window", code);
    fn(mockWindow);

    const engine = (mockWindow as any).AlastreLocalScore;
    assert.ok(engine, "AlastreLocalScore deve estar exportado no window");

    // Perfil não reivindicado, sem categorias secundárias
    const prospectProfile = {
      name: "Clínica Odontológica Sorriso",
      primaryCategory: "Dentista",
      secondaryCategories: [],
      phone: "(11) 99999-9999",
      website: null,
      isClaimed: false,
      rating: 3.8,
      reviewCount: 4,
      photosCount: 2
    };

    const evaluation = engine.evaluate(prospectProfile);

    assert.ok(evaluation.score < 60, "Perfil desestruturado deve receber score baixo");
    assert.equal(evaluation.isClaimed, false);
    assert.ok(
      evaluation.gaps.some((g: any) => g.title.includes("NÃO REIVINDICADO")),
      "Deve apontar alerta crítico de perfil não reivindicado"
    );
    assert.ok(
      evaluation.gaps.some((g: any) => g.title.includes("Categorias Secundárias")),
      "Deve apontar ausência de categorias secundárias"
    );

    // Gera pitch para WhatsApp
    const pitch = engine.generateSalesPitch(prospectProfile, evaluation);
    assert.ok(pitch.includes("Clínica Odontológica Sorriso"), "Pitch deve conter o nome da empresa");
    assert.ok(pitch.includes(`${evaluation.score}/100`), "Pitch deve conter o score estimado");
    assert.ok(pitch.includes("*Clínica Odontológica Sorriso*"), "Deve ser formatado com asteriscos para negrito no WhatsApp");
  });

  it("atribui score otimizado para perfil completo e verificado", () => {
    const code = fs.readFileSync(path.join(extDir, "scripts/local-score.js"), "utf-8");
    const mockWindow: Record<string, unknown> = {};
    new Function("window", code)(mockWindow);

    const engine = (mockWindow as any).AlastreLocalScore;

    const optimizedProfile = {
      name: "Hospital Veterinário 24h",
      primaryCategory: "Hospital veterinário",
      secondaryCategories: ["Clínica veterinária", "Pet shop", "Farmácia veterinária"],
      phone: "(41) 3333-3333",
      website: "https://hospitalvet.com.br",
      address: "Av. Principal, 1000",
      isClaimed: true,
      rating: 4.8,
      reviewCount: 180,
      photosCount: 65
    };

    const evaluation = engine.evaluate(optimizedProfile);

    assert.ok(evaluation.score >= 85, "Perfil otimizado deve atingir pontuação alta");
    assert.equal(evaluation.status, "otimizado");
    assert.equal(evaluation.gapsCount, 0, "Perfil otimizado não deve ter gaps críticos");
  });
});
