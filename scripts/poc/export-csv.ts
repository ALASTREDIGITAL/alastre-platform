import fs from "node:fs";
import { detectOpportunities } from "../../lib/prospecting/opportunity-detector.ts";

async function main() {
  const res = await fetch(
    "http://127.0.0.1:5175/api/prospecting/jobs/job_e7f94b0b-1ab0-4a05-8aa1-d4546dd3ae6d"
  );
  const data = await res.json();
  const leads = data.leads;

  const headers = [
    "Nome",
    "Categoria",
    "Endereço",
    "Telefone",
    "Website",
    "Nota Google",
    "Total Avaliações",
    "Oportunidades",
    "URL Google Maps",
    "Evidência",
    "Momento da Coleta",
  ];

  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = leads.map((l: any) => {
    const oppList: string[] = [];
    const opps = detectOpportunities(l);
    if (opps.withoutWebsite) oppList.push("Sem website");
    if (opps.withoutPhone) oppList.push("Sem telefone");
    if (opps.fewReviews) oppList.push("Poucas avaliações (<=10)");
    if (opps.lowRating) oppList.push("Nota baixa (<4.5)");
    if (opps.incompleteInfo) oppList.push("Cadastro incompleto");

    return [
      escapeCell(l.name),
      escapeCell(l.category ?? "Não localizado"),
      escapeCell(l.address ?? "Não localizado"),
      escapeCell(l.phone ?? "Não localizado"),
      escapeCell(l.website ?? "Não localizado"),
      escapeCell(l.rating !== null ? l.rating : "Não informada"),
      escapeCell(l.review_count !== null ? l.review_count : "Não informada"),
      escapeCell(oppList.join("; ") || "Perfil estruturado"),
      escapeCell(l.maps_url ?? ""),
      escapeCell("Coleta pública Google Maps"),
      escapeCell(l.created_at || new Date().toISOString()),
    ].join(",");
  });

  const csv = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  fs.writeFileSync(
    "scripts/poc/output/prospeccao_pet_shop_sorocaba.csv",
    csv,
    "utf8"
  );
  console.log("CSV EXPORTED SUCCESSFULLY!");
}

main().catch(console.error);
