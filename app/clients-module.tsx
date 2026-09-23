"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Archive,
  Building2,
  CheckCircle2,
  Database,
  FileSearch,
  MapPin,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DecisionState, IntegrationState } from "@/components/platform-state";
import {
  isArrayOf,
  isRecord,
  isRequestCancelled,
  isString,
  postPlatform,
  type JsonGuard,
} from "@/lib/platform-api";
import {
  clientServiceCatalog,
  type ClientServiceKey,
} from "@/lib/client-services";
import { postLocalSeoV2 } from "@/lib/local-seo-v2-api";
import { PageHeader } from "@/components/page-header";

const onboardingSteps = [
  "Dados da empresa",
  "DNA da empresa",
  "Conexões",
  "Serviços contratados",
  "Revisão",
  "Cliente pronto",
];

export type ClientSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  dna?: {
    status: string;
    business_data: Record<string, unknown>;
    source_summary: Record<string, unknown>;
  };
};
type ImportPreview = {
  name: string;
  segment: string;
  city: string;
  address: string;
  phone: string;
  rating: number | null;
  review_count: number | null;
  services: string[];
  primary_service: string;
  instagram_url: string;
  google_profile_url: string;
  diagnosis: {
    score: number;
    status: string;
    strengths: string[];
    priorities: string[];
    method: string;
  };
};
type AnalysisDraft = Record<"name"|"segment"|"primary_service"|"city"|"state"|"neighborhood"|"address"|"phone"|"whatsapp"|"website"|"instagram"|"hours"|"opening_date"|"audience"|"service_area"|"primary_keyword"|"description",string> & Record<"services"|"differentiators"|"additional_categories"|"keywords"|"missing_information"|"priorities",string[]>;
export const isClientSummary: JsonGuard<ClientSummary> = (
  value,
): value is ClientSummary =>
  isRecord(value) && isString(value.id) && isString(value.name);
export const isClientSummaryArray = isArrayOf(isClientSummary);
const isStringArray = isArrayOf(isString);
const isImportResponse = (
  value: unknown,
): value is { profile: ImportPreview } =>
  isRecord(value) &&
  isRecord(value.profile) &&
  isString(value.profile.name) &&
  isString(value.profile.segment) &&
  isString(value.profile.city) &&
  isString(value.profile.address) &&
  isString(value.profile.phone) &&
  (value.profile.rating === null || typeof value.profile.rating === "number") &&
  (value.profile.review_count === null ||
    typeof value.profile.review_count === "number") &&
  isStringArray(value.profile.services) &&
  isString(value.profile.primary_service) &&
  isString(value.profile.instagram_url) &&
  isString(value.profile.google_profile_url) &&
  isRecord(value.profile.diagnosis) &&
  typeof value.profile.diagnosis.score === "number" &&
  isString(value.profile.diagnosis.status) &&
  isStringArray(value.profile.diagnosis.strengths) &&
  isStringArray(value.profile.diagnosis.priorities) &&
  isString(value.profile.diagnosis.method);
const isAiAnalysisResponse = (value:unknown):value is {profile:ImportPreview;analysis:AnalysisDraft;mode:string} => {
  if(!isRecord(value)||!isImportResponse(value)) return false;
  const candidate=value as Record<string,unknown>;
  return isRecord(candidate.analysis)&&isString(candidate.mode);
};
const isCreatedClient = (value: unknown): value is { id: string } =>
  isRecord(value) && isString(value.id);
const isDeletedClient = (value: unknown): value is { id: string; deleted: boolean } =>
  isRecord(value) && isString(value.id) && value.deleted === true;

export function ClientsModule({
  onOpenDna,
  onOpenAgent,
  onOpenLocalSeo,
  onOpenConnections,
  onOpenJourney,
}: {
  onOpenDna: (id: string) => void;
  onOpenAgent: (id: string) => void;
  onOpenLocalSeo?: (id: string) => void;
  onOpenConnections?: () => void;
  onOpenJourney?: (id: string) => void;
}) {
  const commandKey = useRef(crypto.randomUUID());
  const previewRef = useRef<HTMLDivElement>(null);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    segment: "",
    city: "",
    primary_service: "",
    objective: "",
    gbp_url: "",
    raw_profile: "",
  });
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMessage, setAnalyzeMessage] = useState("");
  const [analysisDraft,setAnalysisDraft]=useState<AnalysisDraft|null>(null);
  const [clientView, setClientView] = useState<"active" | "archived">("active");
  const [changingClientId, setChangingClientId] = useState("");
  const [services, setServices] = useState<ClientServiceKey[]>(["local_seo"]);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setUnavailable(false);
    try {
      let items: ClientSummary[];
      try {
        items = await postPlatform(
          { action: "clients" },
          isClientSummaryArray,
          signal,
        );
      } catch {
        const data = await postLocalSeoV2({ action: "clients" }, signal),
          raw = Array.isArray(data.clients) ? data.clients : [];
        items = raw.filter(isClientSummary);
      }
      if (!signal?.aborted) setClients(items);
    } catch (error) {
      if (isRequestCancelled(error)) return;
      setClients([]);
      setUnavailable(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);
  useEffect(() => {
    try {
      const search = new URLSearchParams(window.location.search);
      if (search.get("import") === "inspector") {
        const name = search.get("name") || "";
        const segment = search.get("segment") || "";
        const rawAddress = search.get("address") || "";
        const address = rawAddress.replace(/^Endereço:\s*/i, "").trim();
        const rawPhone = search.get("phone") || "";
        const phone = rawPhone.replace(/^Telefone:\s*/i, "").trim();
        const website = search.get("website") || "";
        const cid = search.get("cid") || "";
        const placeId = search.get("place_id") || "";
        const rating = search.get("rating") ? parseFloat(search.get("rating")!) : null;
        const reviewCount = search.get("reviews_count") ? parseInt(search.get("reviews_count")!, 10) : null;
        const score = search.get("score") ? parseInt(search.get("score")!, 10) : 70;
        const claimed = search.get("claimed") === "true";
        const secCats = search.get("sec_categories") ? search.get("sec_categories")!.split(",").filter(Boolean) : [];

        let city = "";
        let state = "";
        if (address) {
          const parts = address.split("-");
          if (parts.length > 1) {
            city = parts[parts.length - 2]?.trim() || "";
            state = parts[parts.length - 1]?.trim().slice(0, 2) || "";
          }
        }

        const gbpUrl = cid
          ? `https://maps.google.com/maps?cid=${cid}`
          : placeId
          ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
          : "";

        setAdding(true);
        setForm((f) => ({
          ...f,
          name: name || f.name,
          segment: segment || f.segment,
          city: city || f.city,
          primary_service: segment || f.primary_service,
          gbp_url: gbpUrl || f.gbp_url,
          raw_profile: `Importado via Alastre Local Inspector\nEmpresa: ${name}\nCategoria: ${segment}\nEndereço: ${address}\nTelefone: ${phone}\nWebsite: ${website}\nCID: ${cid}\nPlace ID: ${placeId}\nAvaliação: ${rating ?? "N/A"} (${reviewCount ?? 0} reviews)\nReivindicado: ${claimed ? "Sim" : "Não"}\nCategorias Secundárias: ${secCats.join(", ")}`,
        }));

        setPreview({
          name: name || "Empresa Importada",
          segment: segment || "Serviços Locais",
          city: city || "Local",
          address: address || "Endereço cadastrado",
          phone: phone || "",
          rating,
          review_count: reviewCount,
          services: secCats.length > 0 ? secCats : [segment].filter(Boolean),
          primary_service: segment || "SEO Local",
          instagram_url: "",
          google_profile_url: gbpUrl,
          diagnosis: {
            score,
            status: claimed ? "reivindicado_verificado" : "nao_reivindicado",
            strengths: claimed ? ["Perfil verificado e ativo no Google"] : [],
            priorities: claimed
              ? ["Otimização de categorias secundárias e palavras-chave", "Estratégia de novas avaliações"]
              : ["Reivindicar ficha no Google imediatamente", "Regularizar dados NAP"],
            method: "alastre_local_inspector_extension",
          },
        });

        setAnalysisDraft({
          name: name || "",
          segment: segment || "",
          primary_service: segment || "",
          city: city || "",
          state: state || "",
          neighborhood: "",
          address: address || "",
          phone: phone || "",
          whatsapp: phone || "",
          website: website || "",
          instagram: "",
          hours: "",
          opening_date: "",
          audience: "Clientes locais na região de atuação.",
          service_area: city || "Local",
          primary_keyword: segment ? `${segment} em ${city}`.trim() : "",
          description: `Empresa especializada em ${segment || "serviços locais"} atendendo ${city || "a região"}.`,
          services: secCats.length > 0 ? secCats : [segment].filter(Boolean),
          differentiators: ["Atendimento personalizado", "Profissionais experientes"],
          additional_categories: secCats,
          keywords: [segment, `${segment} perto de mim`, `${segment} ${city}`].filter(Boolean),
          missing_information: claimed ? [] : ["Ficha precisa ser reivindicada"],
          priorities: claimed
            ? ["Otimização de categorias secundárias", "Aumentar volume de reviews"]
            : ["Reivindicar e verificar perfil no Google"],
        });

        setAnalyzeMessage("✓ Perfil importado com sucesso da Extensão Alastre Local Inspector. Revise os campos e confirme a criação.");
      }
    } catch {
      // Ignorar erros de URL
    }
  }, []);
  async function analyze() {
    setAnalyzing(true);
    setAnalyzeMessage("");
    try {
      const { profile: p,analysis,mode } = await postPlatform(
        { action: "analyze_onboarding_ai", raw_profile: form.raw_profile },
        isAiAnalysisResponse,
      );
      setPreview(p);
      setAnalysisDraft(analysis);
      setForm((f) => ({
        ...f,
        name: analysis.name || p.name || f.name,
        segment: analysis.segment || p.segment || f.segment,
        city: analysis.city || p.city || f.city,
        primary_service: analysis.primary_service || p.primary_service || f.primary_service,
        gbp_url: p.google_profile_url || f.gbp_url,
      }));
      setAnalyzeMessage(mode==="negocio_no_topo_gemini"?"Análise do agente Negócio no Topo concluída. Revise e edite todos os campos.":"Análise estruturada concluída; o Gemini estava indisponível. Revise os campos.");
      window.setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
    } catch {
      setAnalyzeMessage("Não consegui identificar dados de cliente nesse texto. Inclua ao menos o nome da empresa, segmento e cidade e tente novamente.");
    } finally {
      setAnalyzing(false);
    }
  }
  async function changeClientStatus(client: ClientSummary, status: "active" | "archived") {
    const verb = status === "archived" ? "arquivar" : "reativar";
    if (!window.confirm(`Deseja ${verb} ${client.name}? ${status === "archived" ? "Ele sairá da carteira ativa, mas nenhum dado será apagado." : "Ele voltará para a carteira ativa."}`)) return;
    setChangingClientId(client.id);
    setError("");
    try {
      await postPlatform(
        { action: "client_status", client_id: client.id, status },
        isClientSummary,
      );
      await load();
      setClientView(status === "archived" ? "active" : "archived");
    } catch {
      setError(`Não foi possível ${verb} o cliente agora.`);
    } finally {
      setChangingClientId("");
    }
  }
  async function purgeClient(client: ClientSummary) {
    const confirmation = window.prompt(`Esta ação apaga definitivamente os dados operacionais de ${client.name}. Para confirmar, digite exatamente o nome do cliente:`);
    if (confirmation === null) return;
    if (confirmation.trim() !== client.name) {
      setError("O nome digitado não confere. A exclusão definitiva foi cancelada.");
      return;
    }
    setChangingClientId(client.id);
    setError("");
    try {
      await postPlatform(
        { action: "client_purge", client_id: client.id, confirmation },
        isDeletedClient,
      );
      await load();
    } catch {
      setError("Não foi possível excluir definitivamente o cliente. Confirme se ele continua arquivado e tente novamente.");
    } finally {
      setChangingClientId("");
    }
  }
  async function save() {
    setSaving(true);
    setError("");
    try {
      const created = await postPlatform(
        {
          action: "onboard",
          idempotency_key: commandKey.current,
          ...form,
          services,
          analysis_draft: analysisDraft,
        },
        isCreatedClient,
      );
      commandKey.current = crypto.randomUUID();
      setAdding(false);
      setPreview(null);
      setAnalysisDraft(null);
      setServices(["local_seo"]);
      setForm({
        name: "",
        segment: "",
        city: "",
        primary_service: "",
        objective: "",
        gbp_url: "",
        raw_profile: "",
      });
      if(onOpenLocalSeo) onOpenLocalSeo(created.id); else onOpenDna(created.id);
    } catch {
      setError(
        "Não foi possível cadastrar agora. Confira os campos e a conexão.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="clients-page">
      <PageHeader
        eyebrow={<><Building2 /> CARTEIRA</>}
        title="Clientes"
        description="Organize cada empresa, seus serviços, informações e conexões em um só lugar."
        helpKey="clients.overview"
        actions={<Button onClick={() => setAdding((v) => !v)} disabled={unavailable}><Plus /> Novo cliente</Button>}
      />
      {adding && (
        <section className="panel onboarding-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">ONBOARDING INTELIGENTE</span>
              <h2>Prepare o cliente por etapas</h2>
            </div>
            <Sparkles />
          </div>
          <ol className="client-onboarding-steps">
            {onboardingSteps.map((step, index) => (
              <li key={step} className={index === 0 ? "active" : ""}>
                <span>{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <div className="import-box">
            <div className="import-heading">
              <span>
                <FileSearch />
              </span>
              <div>
                <strong>Cole as informações que você extraiu</strong>
                <small>
                  Pode incluir nome, nota, avaliações, categoria, endereço,
                  telefone, serviços e links do Google, Instagram ou site.
                </small>
              </div>
            </div>
            <Textarea
              value={form.raw_profile}
              onChange={(e) => {
                setForm({ ...form, raw_profile: e.target.value });
                setPreview(null);
                setAnalysisDraft(null);
                setAnalyzeMessage("");
              }}
              placeholder="Cole aqui todo o conteúdo do Perfil da Empresa..."
            />
            <Button
              variant="outline"
              onClick={() => void analyze()}
              disabled={analyzing || form.raw_profile.trim().length < 10}
            >
              <Sparkles />{" "}
              {analyzing
                ? "Interpretando..."
                : preview ? "Nova análise com IA" : "Analisar com Negócio no Topo"}
            </Button>
            {analyzeMessage && <p className={preview ? "form-success" : "form-error"}>{analyzeMessage}</p>}
          </div>
          {preview && (
            <div className="import-preview" ref={previewRef}>
              <div className="preview-score">
                <strong>{preview.diagnosis.score}%</strong>
                <span>Diagnóstico inicial</span>
              </div>
              <div className="preview-content">
                <div>
                  <Badge>
                    <CheckCircle2 /> Dados interpretados
                  </Badge>
                  <strong>{preview.name}</strong>
                  <span>
                    {preview.segment} · {preview.city}
                  </span>
                </div>
                <div className="preview-facts">
                  <span>
                    Nota <b>{preview.rating ?? "—"}</b>
                  </span>
                  <span>
                    Avaliações <b>{preview.review_count ?? "—"}</b>
                  </span>
                  <span>
                    Serviços <b>{preview.services.length}</b>
                  </span>
                </div>
                <p>
                  {preview.diagnosis.priorities[0]}.{" "}
                  {preview.diagnosis.priorities[1]}.
                </p>
              </div>
            </div>
          )}
          {analysisDraft&&<section className="panel ai-draft-editor"><div><span className="section-kicker">RASCUNHO EDITÁVEL · NEGÓCIO NO TOPO</span><h3>DNA e SEO sugeridos pela IA</h3><p>Edite qualquer informação antes de criar o cliente. Campos vazios continuam como não informados.</p></div><div className="onboarding-grid">{([['name','Nome'],['segment','Segmento'],['primary_service','Serviço principal'],['city','Cidade'],['state','Estado'],['neighborhood','Bairro'],['address','Endereço'],['phone','Telefone'],['whatsapp','WhatsApp'],['website','Site'],['instagram','Instagram'],['hours','Horários'],['opening_date','Data de abertura'],['service_area','Área atendida'],['primary_keyword','Palavra-chave principal']] as Array<[keyof AnalysisDraft,string]>).map(([key,label])=><label key={key}>{label}<Input value={String(analysisDraft[key]??"")} onChange={event=>{const value=event.target.value;setAnalysisDraft(current=>current?{...current,[key]:value}:current);if(key==="name"||key==="segment"||key==="city"||key==="primary_service")setForm(current=>({...current,[key]:value}))}}/></label>)}{([['audience','Público-alvo'],['description','Descrição otimizada']] as Array<[keyof AnalysisDraft,string]>).map(([key,label])=><label className="wide" key={key}>{label}<Textarea value={String(analysisDraft[key]??"")} onChange={event=>setAnalysisDraft(current=>current?{...current,[key]:event.target.value}:current)}/></label>)}{([['services','Serviços'],['differentiators','Diferenciais'],['additional_categories','Categorias adicionais'],['keywords','Palavras-chave sugeridas'],['missing_information','Informações faltantes'],['priorities','Prioridades']] as Array<[keyof AnalysisDraft,string]>).map(([key,label])=><label className="wide" key={key}>{label}<Textarea value={Array.isArray(analysisDraft[key])?(analysisDraft[key] as string[]).join("\n"):""} onChange={event=>setAnalysisDraft(current=>current?{...current,[key]:event.target.value.split("\n").map(value=>value.trim()).filter(Boolean)}:current)}/></label>)}</div></section>}
          <div className="review-label">
            <span className="section-kicker">REVISÃO HUMANA</span>
            <small>Confira e ajuste os campos antes de salvar.</small>
          </div>
          <div className="onboarding-grid">
            <label>
              Cliente
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome da empresa"
              />
            </label>
            <label>
              Segmento
              <Input
                value={form.segment}
                onChange={(e) => setForm({ ...form, segment: e.target.value })}
                placeholder="Ex.: Imobiliária"
              />
            </label>
            <label>
              Cidade principal
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Ex.: Santo André"
              />
            </label>
            <label>
              Serviço principal
              <Input
                value={form.primary_service}
                onChange={(e) =>
                  setForm({ ...form, primary_service: e.target.value })
                }
                placeholder="Ex.: Venda de imóveis"
              />
            </label>
            <label className="wide">
              Objetivo inicial
              <Input
                value={form.objective}
                onChange={(e) =>
                  setForm({ ...form, objective: e.target.value })
                }
                placeholder="Ex.: gerar leads qualificados"
              />
            </label>
            <label className="wide">
              Link do Google Meu Negócio
              <Input
                value={form.gbp_url}
                onChange={(e) => setForm({ ...form, gbp_url: e.target.value })}
                placeholder="https://..."
              />
            </label>
          </div>
          <section className="onboarding-connections">
            <div>
              <strong>Conexões</strong>
              <span>
                Google está aguardando liberação. Você pode continuar e conectar
                depois.
              </span>
            </div>
            <Button type="button" variant="outline" disabled>
              Configurar depois
            </Button>
          </section>
          <fieldset className="service-selector">
            <legend>Serviços contratados</legend>
            <p>
              Escolha os módulos que fazem sentido para este cliente. Billing
              não será alterado.
            </p>
            <div>
              {Object.entries(clientServiceCatalog).map(([key, item]) => {
                const serviceKey = key as ClientServiceKey;
                return (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={services.includes(serviceKey)}
                      onChange={(event) =>
                        setServices((current) =>
                          event.target.checked
                            ? [...current, serviceKey]
                            : current.filter((value) => value !== serviceKey),
                        )
                      }
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.description}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void save()}
              disabled={saving || !form.name || !form.segment || !form.city}
            >
              {saving ? "Salvando DNA e SEO..." : "Criar cliente e abrir plano de trabalho"}
            </Button>
          </div>
        </section>
      )}
      {unavailable ? (
        <IntegrationState compact
          message="A carteira será carregada assim que a conexão deste ambiente estiver configurada. Nenhum cliente foi removido."
          onRetry={() => void load()}
        />
      ) : (
        <>
        <div className="client-view-tabs" role="tablist" aria-label="Situação dos clientes">
          <Button variant={clientView === "active" ? "default" : "outline"} onClick={() => setClientView("active")}>Clientes ativos ({clients.filter((client) => client.status !== "archived").length})</Button>
          <Button variant={clientView === "archived" ? "default" : "outline"} onClick={() => setClientView("archived")}>Clientes inativos ({clients.filter((client) => client.status === "archived").length})</Button>
        </div>
        {error && !adding && <p className="form-error">{error}</p>}
        <section className="client-grid">
          {loading ? (
            <DecisionState title="Carregando clientes" message="Estamos organizando sua carteira." />
          ) : clients.filter((client) => clientView === "archived" ? client.status === "archived" : client.status !== "archived").length === 0 ? (
            <DecisionState icon={Building2} title="Comece adicionando seu primeiro cliente." message="O cliente será a base para organizar DNA, agentes, campanhas e resultados." actionLabel="Adicionar cliente" onAction={() => setAdding(true)} secondaryLabel={onOpenConnections ? "Ver conexões" : undefined} onSecondary={onOpenConnections} />
          ) : (
            clients.filter((client) => clientView === "archived" ? client.status === "archived" : client.status !== "archived").map((c) => {
              const b = c.dna?.business_data ?? {};
              const city = String(
                b.city ??
                  (Array.isArray(b.cities)
                    ? b.cities[0]
                    : "Local não informado"),
              );
              return (
                <article className="client-card" key={c.id}>
                  <div className="client-card-head">
                    <span className="client-symbol">
                      <Building2 />
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        c.dna?.status === "confirmed"
                          ? "status-confirmed-badge"
                          : "status-review-badge"
                      }
                    >
                      <span className="badge-dot" />
                      {c.dna?.status === "confirmed"
                        ? "DNA Confirmado"
                        : "DNA em Revisão"}
                    </Badge>
                  </div>
                  <h2>{c.name}</h2>
                  <p className="client-location">
                    <MapPin /> {city}
                  </p>
                  <div className="client-meta">
                    <span>
                      <Database /> Memória persistente
                    </span>
                    <span>
                      <Sparkles /> Agentes preparados
                    </span>
                  </div>
                  <div className="client-360">
                    <span className="client-360-label">Módulos operacionais</span>
                    <div className="client-360-buttons">
                      <button type="button" onClick={() => onOpenDna(c.id)}>DNA</button>
                      {onOpenJourney && (
                        <button
                          type="button"
                          className="featured"
                          onClick={() => onOpenJourney(c.id)}
                          title="Abrir esteira operacional e checklist deste cliente"
                        >
                          Esteira / Fluxo
                        </button>
                      )}
                      <button
                        type="button"
                        className="featured"
                        onClick={() => onOpenLocalSeo?.(c.id)}
                        disabled={!onOpenLocalSeo}
                      >
                        SEO Local
                      </button>
                      <button
                        type="button"
                        onClick={onOpenConnections}
                        disabled={!onOpenConnections}
                      >
                        Conexões
                      </button>
                    </div>
                  </div>
                  <div className="client-actions">
                    {c.status === "archived" ? (
                      <>
                        <Button
                          onClick={() => void changeClientStatus(c, "active")}
                          disabled={changingClientId === c.id}
                        >
                          <RotateCcw />{" "}
                          {changingClientId === c.id
                            ? "Processando..."
                            : "Reativar cliente"}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => void purgeClient(c)}
                          disabled={changingClientId === c.id}
                        >
                          <Trash2 /> Excluir definitivamente
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          className="btn-continue-work"
                          onClick={() => onOpenLocalSeo?.(c.id)}
                          disabled={!onOpenLocalSeo}
                        >
                          Continuar trabalho <ArrowRight />
                        </Button>
                        <Button variant="outline" onClick={() => onOpenDna(c.id)}>
                          Abrir DNA
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => onOpenAgent(c.id)}
                        >
                          Conversar com agente
                        </Button>
                        <Button
                          variant="ghost"
                          className="btn-archive"
                          onClick={() => void changeClientStatus(c, "archived")}
                          disabled={changingClientId === c.id}
                        >
                          <Archive />{" "}
                          {changingClientId === c.id
                            ? "Arquivando..."
                            : "Arquivar"}
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>
        </>
      )}
      <Button
        className="refresh-inline"
        variant="ghost"
        onClick={() => void load()}
        disabled={loading}
      >
        <RefreshCw /> Atualizar carteira
      </Button>
    </div>
  );
}
