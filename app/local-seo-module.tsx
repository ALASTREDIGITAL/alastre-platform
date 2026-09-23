"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Compass,
  History,
  Lightbulb,
  Link2Off,
  MapPinned,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Store,
  Target,
  Unplug,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntegrationState } from "@/components/platform-state";
import { LocalScore } from "@/components/local-score";
import {
  OpportunityOperations,
  PostOperations,
  ReviewOperationsAi,
} from "@/components/local-seo-operations";
import { ReviewAuditDashboard } from "@/components/review-audit-dashboard";
import { BEM_FEITO_REDES_DEMO_SNAPSHOT } from "@/lib/local-seo-report-engine";
import { inferCategoryFromName, type BusinessProfileSnapshot } from "@/lib/review-audit-analyzer";
import {
  CompetitorsWorkspace,
  ExecutiveOverview,
  HistoryWorkspace,
  KeywordsWorkspace,
  ProfileAudit,
  SeoStartGuide,
} from "@/components/local-seo-v2";
import { type ClientSummary } from "./clients-module";
import { resolveLocalSeoDataProvider } from "@/lib/local-seo-data-provider";
import type { LocalSeoSection } from "@/lib/local-seo-types";
import { isRequestCancelled, postPlatform } from "@/lib/platform-api";
import { isClientSummaryArray } from "./clients-module";
import { postLocalSeo } from "@/lib/local-seo-api";
import { postLocalSeoV2 } from "@/lib/local-seo-v2-api";
import { PageHeader } from "@/components/page-header";
import {
  clientServiceCatalog,
  type ClientServiceKey,
} from "@/lib/client-services";

type V2Data = {
  services: Array<Record<string, unknown>>;
  keywords: Array<Record<string, unknown>>;
  competitors: Array<Record<string, unknown>>;
  checks: Array<Record<string, unknown>>;
  scores: Array<Record<string, unknown>>;
  opportunities: Array<Record<string, unknown>>;
};
const emptyV2: V2Data = {
  services: [],
  keywords: [],
  competitors: [],
  checks: [],
  scores: [],
  opportunities: [],
};

const sections: Array<{
  id: LocalSeoSection;
  label: string;
  icon: typeof Store;
}> = [
  { id: "overview", label: "Visão geral", icon: Compass },
  { id: "profile", label: "Perfil Google", icon: Store },
  { id: "score", label: "Local Score", icon: Target },
  { id: "reviews", label: "Avaliações", icon: Star },
  { id: "posts", label: "Postagens", icon: CalendarDays },
  { id: "keywords", label: "Palavras-chave", icon: Search },
  { id: "competitors", label: "Concorrentes", icon: Users },
  { id: "opportunities", label: "Oportunidades", icon: Lightbulb },
  { id: "history", label: "Histórico", icon: History },
];
function EmptyArea({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Store;
  title: string;
  description: string;
}) {
  return (
    <section className="panel local-empty">
      <span>
        <Icon />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
        <small>
          <Link2Off /> Integração pendente · nenhuma ação externa disponível
        </small>
      </div>
    </section>
  );
}

export function LocalSeoModule({
  clientId,
  onSelectClient,
  onOpenConnections,
}: {
  clientId: string;
  onSelectClient: (id: string) => void;
  onOpenConnections: () => void;
}) {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [section, setSection] = useState<LocalSeoSection>("overview");
  const [reviewsSubTab, setReviewsSubTab] = useState<"audit" | "operations">("audit");
  const [autoOpenReport, setAutoOpenReport] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      const cName = search.get("client_name");
      const auditSession = search.get("audit_session");
      if (cName || auditSession) {
        // Redireciona imediatamente para o módulo dedicado de Pré-Análise
        const targetParams = new URLSearchParams(search);
        targetParams.set("view", "pre-audit");
        window.location.href = `/?${targetParams.toString()}`;
        return;
      }

      const sec = search.get("section");
      if (sec === "reviews" || sec === "reviews-audit") {
        setSection("reviews");
        setReviewsSubTab("audit");
      }
      if (search.get("open_report") === "true" || search.get("report") === "true") {
        setSection("reviews");
        setReviewsSubTab("audit");
        setAutoOpenReport(true);
      }
    }
  }, []);

  const [operations, setOperations] = useState<{
    posts: Array<Record<string, unknown>>;
    reviews: Array<Record<string, unknown>>;
    replies: Array<Record<string, unknown>>;
    opportunities: Array<Record<string, unknown>>;
  }>({ posts: [], reviews: [], replies: [], opportunities: [] });
  const [gbpConnection, setGbpConnection] = useState<
    | "loading"
    | "connected"
    | "not_connected"
    | "not_configured"
    | "provider_pending"
  >("loading");
  const [v2, setV2] = useState<V2Data>(emptyV2);
  const [v2Error, setV2Error] = useState("");
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setUnavailable(false);
      try {
        let raw: unknown[];
        try {
          raw = await postPlatform({ action: "clients" }, isClientSummaryArray, signal);
        } catch {
          const data = await postLocalSeoV2({ action: "clients" }, signal);
          raw = Array.isArray(data.clients) ? data.clients : [];
        }
        const list = raw.filter(
          (item): item is ClientSummary =>
            !!item &&
            typeof item === "object" &&
            typeof (item as Record<string, unknown>).id === "string" &&
            typeof (item as Record<string, unknown>).name === "string",
        );
        if (signal?.aborted) return;
        setClients(list);
        if (list.length && !list.some((item) => item.id === clientId))
          onSelectClient(list[0].id);
      } catch (error) {
        if (isRequestCancelled(error)) return;
        setClients([]);
        setUnavailable(true);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [clientId, onSelectClient],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);
  const loadOperations = useCallback(
    async (signal?: AbortSignal) => {
      if (!clientId) return;
      try {
        const data = await postLocalSeo(
          { action: "local_seo_workspace", client_id: clientId },
          signal,
        );
        if (signal?.aborted) return;
        setOperations({
          posts: Array.isArray(data.posts)
            ? (data.posts as Array<Record<string, unknown>>)
            : [],
          reviews: Array.isArray(data.reviews)
            ? (data.reviews as Array<Record<string, unknown>>)
            : [],
          replies: Array.isArray(data.replies)
            ? (data.replies as Array<Record<string, unknown>>)
            : [],
          opportunities: Array.isArray(data.opportunities)
            ? (data.opportunities as Array<Record<string, unknown>>)
            : [],
        });
      } catch {
        if (!signal?.aborted)
          setOperations({
            posts: [],
            reviews: [],
            replies: [],
            opportunities: [],
          });
      }
    },
    [clientId],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => void loadOperations(controller.signal),
      0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadOperations]);
  const loadV2 = useCallback(
    async (signal?: AbortSignal) => {
      if (!clientId) {
        setV2(emptyV2);
        return;
      }
      try {
        const data = await postLocalSeoV2(
          { action: "workspace", client_id: clientId },
          signal,
        );
        if (signal?.aborted) return;
        const rows = (key: keyof V2Data) =>
          Array.isArray(data[key])
            ? (data[key] as Array<Record<string, unknown>>)
            : [];
        setV2({
          services: rows("services"),
          keywords: rows("keywords"),
          competitors: rows("competitors"),
          checks: rows("checks"),
          scores: rows("scores"),
          opportunities: rows("opportunities"),
        });
        setV2Error("");
      } catch (error) {
        if (!isRequestCancelled(error) && !signal?.aborted) {
          setV2(emptyV2);
          const message = error instanceof Error ? error.message : "";
          setV2Error(
            message === "Persistência interna indisponível."
              ? ""
              : message || "Dados operacionais indisponíveis.",
          );
        }
      }
    },
    [clientId],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadV2(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadV2]);
  const mutateV2 = useCallback(
    async (input: Parameters<typeof postLocalSeoV2>[0]) => {
      setV2Error("");
      try {
        await postLocalSeoV2(input);
        await loadV2();
      } catch (error) {
        setV2Error(
          error instanceof Error ? error.message : "Não foi possível salvar.",
        );
      }
    },
    [loadV2],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (!clientId) {
        setGbpConnection("not_connected");
        return;
      }
      void fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "client_connection",
          client_id: clientId,
          capability: "google_business_profile",
        }),
        signal: controller.signal,
      })
        .then(async (response) => ({
          ok: response.ok,
          data: (await response.json().catch(() => null)) as {
            connected?: unknown;
            provider_availability?: unknown;
          } | null,
        }))
        .then(({ ok, data }) => {
          if (!controller.signal.aborted)
            setGbpConnection(
              ok && data?.connected === true
                ? "connected"
                : data?.provider_availability === "pending_provider_approval"
                  ? "provider_pending"
                  : ok
                    ? "not_connected"
                    : "not_configured",
            );
        })
        .catch(() => {
          if (!controller.signal.aborted) setGbpConnection("not_configured");
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [clientId]);
  const client = clients.find((item) => item.id === clientId) ?? null;
  const workspace = useMemo(() => {
    if (!client) return null;
    const base = resolveLocalSeoDataProvider({
      googleConnected: gbpConnection === "connected",
    }).load(client);

    const verifiedChecks = v2.checks.filter((c) =>
      ["ok", "attention", "critical"].includes(String(c.status)),
    );
    const latestSnapshot = v2.scores[0] as
      | {
          overall_score?: number;
          confidence?: "high" | "medium" | "low" | "none";
          state?: string;
          version?: string;
          calculated_at?: string;
        }
      | undefined;

    if (verifiedChecks.length > 0 || latestSnapshot) {
      const okChecks = v2.checks.filter((c) => c.status === "ok");
      const attentionChecks = v2.checks.filter((c) => c.status === "attention");
      const criticalChecks = v2.checks.filter((c) => c.status === "critical");

      const profileScore =
        latestSnapshot?.overall_score ??
        Math.round(
          (okChecks.length * 100 +
            attentionChecks.length * 60 +
            criticalChecks.length * 20) /
            verifiedChecks.length,
        );

      const confidence: "medium" | "low" =
        verifiedChecks.length >= 12 ? "medium" : "low";

      const updatedPillars = base.score.pillars.map((pillar) => {
        if (pillar.key === "profile") {
          return {
            ...pillar,
            score: profileScore,
            state: "partial" as const,
            confidence,
            signals: [
              ...pillar.signals,
              ...okChecks.map(
                (c) => `Item OK: ${String(c.check_key).replace(/_/g, " ")}`,
              ),
            ],
            issues: [
              ...criticalChecks.map(
                (c) => `Crítico: ${String(c.check_key).replace(/_/g, " ")}`,
              ),
              ...attentionChecks.map(
                (c) => `Atenção: ${String(c.check_key).replace(/_/g, " ")}`,
              ),
            ],
            recommendation:
              criticalChecks.length > 0
                ? `${criticalChecks.length} item(ns) crítico(s) na auditoria exigem correção.`
                : attentionChecks.length > 0
                  ? `${attentionChecks.length} item(ns) demandam atenção na auditoria.`
                  : "Perfil auditado com evidências satisfatórias.",
            likelyImpact:
              "Aumenta a consistência e relevância do Perfil nos resultados locais.",
          };
        }
        return pillar;
      });

      return {
        ...base,
        score: {
          value: profileScore,
          state: "partial" as const,
          version: latestSnapshot?.version ?? "v2-manual",
          pillars: updatedPillars,
        },
        provenance: {
          ...base.provenance,
          state: "partial" as const,
          label: "Dados parciais auditados",
          detail: `${verifiedChecks.length} verificações manuais registradas e validadas.`,
        },
      };
    }

    return base;
  }, [client, gbpConnection, v2.checks, v2.scores]);
  const activeServices = v2.services
    .filter((row) => row.status === "active")
    .map((row) => String(row.service_key) as ClientServiceKey);
  const servicesPanel =
    workspace && section === "overview" ? (
      <section className="panel service-selector">
        <div>
          <span className="section-kicker">SERVIÇOS DO CLIENTE</span>
          <h2>Módulos habilitados</h2>
          <p>
            Marque ou desmarque serviços e a carteira refletirá a configuração
            salva.
          </p>
        </div>
        <div>
          {Object.entries(clientServiceCatalog).map(([key, item]) => {
            const serviceKey = key as ClientServiceKey,
              active = activeServices.includes(serviceKey);
            return (
              <Button
                key={key}
                variant={active ? "default" : "outline"}
                onClick={() =>
                  void mutateV2({
                    action: "services_set",
                    client_id: clientId,
                    services: active
                      ? activeServices.filter((value) => value !== serviceKey)
                      : [...activeServices, serviceKey],
                  })
                }
              >
                {active ? "✓ " : ""}
                {item.name}
              </Button>
            );
          })}
        </div>
      </section>
    ) : null;
  return (
    <div className="local-seo-page">
      <PageHeader
        eyebrow={
          <>
            <MapPinned /> PRESENÇA LOCAL
          </>
        }
        title="SEO Local"
        description="Gerencie a presença do cliente no Google, organize melhorias e acompanhe oportunidades em linguagem simples."
        helpKey="local_seo.overview"
        actions={
          <label className="client-picker">
            <span>Cliente</span>
            <select
              value={clientId}
              onChange={(e) => onSelectClient(e.target.value)}
              disabled={!clients.length}
            >
              {clients.length ? (
                clients.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))
              ) : (
                <option value="">Sem clientes</option>
              )}
            </select>
          </label>
        }
      />
      {unavailable ? (
        <section className="seo-primary-state" aria-labelledby="seo-state-title">
          <span className="seo-state-icon"><Unplug /></span>
          <div><span className="section-kicker">STATUS PRINCIPAL</span><h2 id="seo-state-title">Google ainda não conectado</h2><p>Conecte uma fonte para acompanhar o perfil, as avaliações, a visibilidade e as oportunidades do cliente. Nenhum resultado será inventado enquanto os dados não estiverem disponíveis.</p></div>
          <Button onClick={onOpenConnections}>Conectar Google <ArrowRight /></Button>
          <button className="retry-link" type="button" onClick={() => void load()}>Tentar novamente</button>
        </section>
      ) : <>
      <nav className="local-tabs local-tabs-primary" aria-label="Áreas de SEO Local">
        {sections.map((item) => {
          const Icon = item.icon;
          let countBadge: number | null = null;
          if (item.id === "profile") {
            countBadge = v2.checks.filter((c) => c.status === "ok").length;
          } else if (item.id === "reviews") {
            countBadge = operations.reviews.length;
          } else if (item.id === "posts") {
            countBadge = operations.posts.length;
          } else if (item.id === "keywords") {
            countBadge = v2.keywords.filter((k) => k.status !== "archived").length;
          } else if (item.id === "competitors") {
            countBadge = v2.competitors.filter((c) => c.status !== "archived").length;
          } else if (item.id === "opportunities") {
            countBadge = v2.opportunities.filter((o) => !["completed", "dismissed"].includes(String(o.status))).length;
          }
          return (
            <button
              type="button"
              key={item.id}
              className={section === item.id ? "is-active" : ""}
              onClick={() => setSection(item.id)}
            >
              <Icon />
              <span>{item.label}</span>
              {typeof countBadge === "number" && countBadge > 0 ? (
                <span
                  style={{
                    marginLeft: "4px",
                    fontSize: "11px",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    background: "var(--color-bg-secondary, #333)",
                    color: "var(--color-text-secondary, #ccc)",
                  }}
                >
                  {countBadge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
      {clientId && (
        <div className="data-state-bar" aria-live="polite">
          <strong>
            {workspace?.provenance.label ?? "Dados insuficientes"}
          </strong>
          <span>
            {workspace?.provenance.detail ??
              "Selecione um cliente para consultar a origem dos dados."}
          </span>
          <small>
            Registros internos: {operations.posts.length} postagens ·{" "}
            {operations.reviews.length} avaliações ·{" "}
            {operations.opportunities.length} oportunidades
          </small>
        </div>
      )}
      {!unavailable && v2Error && (
        <IntegrationState
          compact
          message={v2Error}
          onRetry={() => void loadV2()}
        />
      )}
      {servicesPanel}
      {loading ? (
        <div className="empty-state">Carregando contexto do cliente...</div>
      ) : !workspace ? (
        <EmptyArea
          icon={Building2}
          title="Nenhum cliente disponível"
          description="Cadastre ou conecte um cliente para iniciar o workspace de SEO Local."
        />
      ) : section === "overview" ? (
        <>
          <SeoStartGuide workspace={workspace} keywordCount={v2.keywords.filter((row) => row.status !== "archived").length} onNavigate={setSection} />
          <ExecutiveOverview
            workspace={workspace}
            operations={{ ...operations, opportunities: v2.opportunities }}
            googleStatus={
              gbpConnection === "connected"
                ? "Conectado"
                : gbpConnection === "provider_pending"
                  ? "Aguardando liberação"
                  : "Não conectado"
            }
            onNavigate={setSection}
            onOpenConnections={onOpenConnections}
          />
        </>
      ) : section === "score" ? (
        <div className="seo-operation">
          <section className="operation-head">
            <div>
              <span className="section-kicker">ALASTRE LOCAL SCORE</span>
              <h2>Saúde do Posicionamento Local</h2>
              <p>
                Diagnóstico explicável ponderado em 7 pilares fundamentais, com
                transparência total de evidências.
              </p>
            </div>
            <Button
              onClick={() =>
                void mutateV2({ action: "calculate_score", client_id: clientId })
              }
            >
              <Sparkles /> Recalcular score com evidências
            </Button>
          </section>
          <LocalScore workspace={workspace} />
          {v2.scores.length > 0 && (
            <section className="panel" style={{ marginTop: "16px" }}>
              <div
                className="audit-head"
                style={{
                  marginBottom: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span className="section-kicker">EVOLUÇÃO DO SCORE</span>
                  <h3 style={{ margin: "4px 0" }}>Histórico de Snapshots</h3>
                </div>
                <small>{v2.scores.length} cálculo(s) registrado(s)</small>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {v2.scores.slice(0, 5).map((snap, idx) => (
                  <div
                    key={String(snap.id ?? idx)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      background: "var(--color-bg-secondary, #1a1a1a)",
                      borderRadius: "6px",
                      fontSize: "13px",
                    }}
                  >
                    <div>
                      <strong>
                        Nota {String(snap.overall_score ?? "N/D")}/100
                      </strong>
                      <span
                        style={{
                          marginLeft: "8px",
                          color: "var(--color-text-secondary, #888)",
                        }}
                      >
                        {String(snap.version ?? "v2")} · Confiança{" "}
                        {String(snap.confidence ?? "low")}
                      </span>
                    </div>
                    <small
                      style={{ color: "var(--color-text-secondary, #888)" }}
                    >
                      {snap.calculated_at
                        ? new Date(String(snap.calculated_at)).toLocaleString(
                            "pt-BR",
                          )
                        : "Data não registrada"}
                    </small>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : section === "profile" ? (
        <ProfileAudit
          workspace={workspace}
          googleConnected={gbpConnection === "connected"}
          checks={v2.checks}
          clientId={clientId}
          onSave={mutateV2}
        />
      ) : section === "reviews" ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <span className="section-kicker">CENTRAL DE AVALIAÇÕES & REPUTAÇÃO</span>
              <h2 className="text-lg font-bold text-foreground">Avaliações do Google</h2>
            </div>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setReviewsSubTab("audit")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  reviewsSubTab === "audit"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                📊 Análise & Auditoria (GBPCheck)
              </button>
              <button
                type="button"
                onClick={() => setReviewsSubTab("operations")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  reviewsSubTab === "operations"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                💬 Respostas Assistidas por IA
              </button>
            </div>
          </div>

          {reviewsSubTab === "audit" ? (
            <ReviewAuditDashboard
              initialOpenReport={autoOpenReport}
              isDemoMode={Boolean(autoOpenReport)}
              initialSnapshot={
                autoOpenReport
                  ? BEM_FEITO_REDES_DEMO_SNAPSHOT
                  : {
                      name: workspace.clientName,
                      category: workspace.profile?.primaryCategory || "Empresa Local",
                      rating: typeof (workspace.profile as any)?.rating === "number" ? (workspace.profile as any).rating : 0,
                      reviewsCount: operations.reviews.length,
                      address: workspace.profile?.location || undefined,
                      phone: workspace.profile?.phone || undefined,
                      website: workspace.profile?.website || undefined,
                    }
              }
              initialReviews={
                operations.reviews.length > 0
                  ? operations.reviews.map((r) => {
                      const reply = operations.replies.find((rep) => rep.review_id === r.id);
                      return {
                        id: String(r.id),
                        author: String(r.reviewer_name || "Cliente Google"),
                        rating: Number(r.rating || 5),
                        date: r.reviewed_at ? String(r.reviewed_at) : undefined,
                        text: String(r.review_text || ""),
                        ownerReply: reply ? { text: String(reply.body || "") } : undefined,
                        isLocalGuide: Boolean(r.source_payload && (r.source_payload as any).is_local_guide),
                      };
                    })
                  : undefined
              }
              onImportAsClient={(snap) => {
                if (typeof window !== "undefined") {
                  const params = new URLSearchParams({
                    import: "inspector",
                    name: snap.name,
                    segment: snap.category || "",
                    address: snap.address || "",
                    phone: snap.phone || "",
                    website: snap.website || "",
                    rating: String(snap.rating),
                    reviews_count: String(snap.reviewsCount),
                  });
                  window.location.href = `/?view=clients&${params.toString()}`;
                }
              }}
            />
          ) : (
            <ReviewOperationsAi
              clientId={clientId}
              rows={operations.reviews}
              replies={operations.replies}
              onChanged={() => void loadOperations()}
            />
          )}
        </div>
      ) : section === "posts" ? (
        <PostOperations
          clientId={clientId}
          clientName={workspace.clientName}
          canCreate
          rows={operations.posts}
          onChanged={() => void loadOperations()}
        />
      ) : section === "keywords" ? (
        <KeywordsWorkspace
          clientId={clientId}
          rows={v2.keywords}
          onSave={mutateV2}
          workspace={workspace}
        />
      ) : section === "competitors" ? (
        <CompetitorsWorkspace
          clientId={clientId}
          rows={v2.competitors}
          onSave={mutateV2}
        />
      ) : section === "opportunities" ? (
        <OpportunityOperations
          rows={v2.opportunities}
          clientId={clientId}
          onNavigate={setSection}
          onGenerate={() =>
            mutateV2({
              action: "generate_opportunities",
              client_id: clientId,
            })
          }
          onStatusChange={async (id, status) => {
            await mutateV2({
              action: "opportunity_status",
              client_id: clientId,
              id,
              status,
            });
          }}
        />
      ) : (
        <HistoryWorkspace
          rows={[
            ...operations.posts.map((row) => ({
              ...row,
              history_kind: "postagem",
            })),
            ...operations.reviews.map((row) => ({
              ...row,
              history_kind: "avaliação",
            })),
            ...operations.replies.map((row) => ({
              ...row,
              history_kind: "resposta",
            })),
            ...v2.opportunities.map((row) => ({
              ...row,
              history_kind: "oportunidade",
            })),
            ...v2.scores.map((row) => ({
              ...row,
              history_kind: "score",
              title: `Score calculado: ${row.overall_score}/100`,
              created_at: row.calculated_at,
            })),
            ...v2.checks.map((row) => ({
              ...row,
              history_kind: "auditoria_perfil",
              title: `Verificação: ${String(row.check_key).replace(/_/g, " ")} (${row.status})`,
              created_at: row.updated_at ?? row.checked_at,
            })),
          ]}
        />
      )}
      <Button
        className="refresh-inline"
        variant="ghost"
        onClick={() => void load()}
        disabled={loading}
      >
        <RefreshCw /> Atualizar contexto
      </Button>
      </>}
    </div>
  );
}
