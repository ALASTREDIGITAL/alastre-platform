"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Database,
  FileSearch,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IntegrationState } from "@/components/platform-state";
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
const isCreatedClient = (value: unknown): value is { id: string } =>
  isRecord(value) && isString(value.id);

export function ClientsModule({
  onOpenDna,
  onOpenAgent,
  onOpenLocalSeo,
  onOpenConnections,
}: {
  onOpenDna: (id: string) => void;
  onOpenAgent: (id: string) => void;
  onOpenLocalSeo?: (id: string) => void;
  onOpenConnections?: () => void;
}) {
  const commandKey = useRef(crypto.randomUUID());
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
  async function analyze() {
    setAnalyzing(true);
    setError("");
    try {
      const { profile: p } = await postPlatform(
        { action: "analyze_import", raw_profile: form.raw_profile },
        isImportResponse,
      );
      setPreview(p);
      setForm((f) => ({
        ...f,
        name: p.name || f.name,
        segment: p.segment || f.segment,
        city: p.city || f.city,
        primary_service: p.primary_service || f.primary_service,
        gbp_url: p.google_profile_url || f.gbp_url,
      }));
    } catch {
      setError(
        "Não foi possível interpretar os dados agora. Tente novamente quando a integração estiver conectada.",
      );
    } finally {
      setAnalyzing(false);
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
        },
        isCreatedClient,
      );
      commandKey.current = crypto.randomUUID();
      setAdding(false);
      setPreview(null);
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
      onOpenDna(created.id);
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
                : "Interpretar e preencher automaticamente"}
            </Button>
          </div>
          {preview && (
            <div className="import-preview">
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
              {saving ? "Salvando..." : "Criar cliente e diagnóstico"}
            </Button>
          </div>
        </section>
      )}
      {unavailable ? (
        <IntegrationState
          message="A carteira será carregada assim que a conexão deste ambiente estiver configurada. Nenhum cliente foi removido."
          onRetry={() => void load()}
        />
      ) : (
        <section className="client-grid">
          {loading ? (
            <div className="empty-state">Carregando clientes...</div>
          ) : clients.length === 0 ? (
            <div className="empty-state">
              Nenhum cliente cadastrado nesta carteira.
            </div>
          ) : (
            clients.map((c) => {
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
                    <Badge variant="outline">
                      {c.dna?.status === "confirmed"
                        ? "DNA confirmado"
                        : "DNA em revisão"}
                    </Badge>
                  </div>
                  <h2>{c.name}</h2>
                  <p>
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
                    <strong>Cliente 360</strong>
                    <button onClick={() => onOpenDna(c.id)}>DNA</button>
                    <button
                      className="featured"
                      onClick={() => onOpenLocalSeo?.(c.id)}
                      disabled={!onOpenLocalSeo}
                    >
                      SEO Local
                    </button>
                    <button
                      onClick={onOpenConnections}
                      disabled={!onOpenConnections}
                    >
                      Conexões
                    </button>
                    <span>Outros módulos disponíveis</span>
                  </div>
                  <div className="client-actions">
                    <Button variant="outline" onClick={() => onOpenDna(c.id)}>
                      Abrir DNA
                    </Button>
                    <Button onClick={() => onOpenAgent(c.id)}>
                      Conversar <ArrowRight />
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </section>
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
