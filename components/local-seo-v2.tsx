"use client";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileSearch,
  Globe,
  Lightbulb,
  Link2,
  Link2Off,
  ListChecks,
  MessageSquare,
  PhoneCall,
  Plus,
  Route,
  Search,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Star,
  Store,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  dataOriginLabels,
  defaultCitationsCatalog,
  NO_RANKING_PROMISE_DISCLAIMER,
  profileAuditCatalog,
  unconfiguredLocalRankProvider,
  type DataOrigin,
} from "@/lib/local-seo-v2-domain";
import type {
  GoogleProfileSnapshot,
  LocalSeoSection,
  LocalSeoWorkspace,
} from "@/lib/local-seo-types";
import type { LocalSeoV2Request } from "@/lib/local-seo-v2-api";

type Ops = {
  posts: Array<Record<string, unknown>>;
  reviews: Array<Record<string, unknown>>;
  replies: Array<Record<string, unknown>>;
  opportunities: Array<Record<string, unknown>>;
};

const cards: Array<{
  section: LocalSeoSection;
  title: string;
  question: string;
  action: string;
  icon: typeof Store;
}> = [
  {
    section: "profile",
    title: "Perfil GBP",
    question: "O perfil está completo e com dados verificados?",
    action: "Revisar perfil",
    icon: Store,
  },
  {
    section: "reputation",
    title: "Reputação",
    question: "Há avaliações críticas ou sem resposta?",
    action: "Abrir reputação",
    icon: Star,
  },
  {
    section: "content",
    title: "Conteúdo Local",
    question: "Existe postagem planejada e aprovada para o mês?",
    action: "Planejar conteúdo",
    icon: CalendarDays,
  },
  {
    section: "authority",
    title: "Autoridade Local",
    question: "Como estão as palavras-chave e citações em diretórios?",
    action: "Gerenciar autoridade",
    icon: Search,
  },
  {
    section: "visibility",
    title: "Visibilidade & Conversão",
    question: "Qual o Local Score e baseline de interações?",
    action: "Ver visibilidade",
    icon: BarChart3,
  },
  {
    section: "plan",
    title: "Plano de Ação",
    question: "Quais oportunidades estão prontas para o Motor de Operações?",
    action: "Ver plano de ação",
    icon: Lightbulb,
  },
];

export function ExecutiveOverview({
  workspace,
  operations,
  googleStatus,
  onNavigate,
  onOpenConnections,
}: {
  workspace: LocalSeoWorkspace;
  operations: Ops;
  googleStatus: string;
  onNavigate: (section: LocalSeoSection) => void;
  onOpenConnections: () => void;
}) {
  return (
    <div className="seo-executive">
      <section className="seo-health-header">
        <div className="seo-health-main">
          <span className="section-kicker">ENTREGA OPERACIONAL DE SEO LOCAL</span>
          <h2>{workspace.clientName}</h2>
          <p>
            Diagnóstico explicável, plano de ação orientado a evidências e integração direta com o Motor de Operações.
          </p>
          <Button
            variant="ghost"
            className="btn-connection-link"
            onClick={onOpenConnections}
          >
            <Link2 /> Conexão Google: {googleStatus}
          </Button>
        </div>
        <dl className="seo-health-metrics">
          <div>
            <dt>Local Score</dt>
            <dd>
              {workspace.score.value !== null
                ? `${workspace.score.value}/100`
                : "Sem evidência suficiente"}
            </dd>
          </div>
          <div>
            <dt>Comprovação dos dados</dt>
            <dd>{workspace.provenance.label}</dd>
          </div>
          <div>
            <dt>Escrita no Google</dt>
            <dd style={{ color: "#f59e0b", fontWeight: 600 }}>
              Bloqueada (ALASTRE_WRITE_MODE=disabled)
            </dd>
          </div>
          <div>
            <dt>Garantia de Posição</dt>
            <dd>Isenta de promessas fictícias</dd>
          </div>
        </dl>
      </section>

      <section className="seo-executive-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          const amount =
            card.section === "reputation" || card.section === "reviews"
              ? operations.reviews.length
              : card.section === "content" || card.section === "posts"
                ? operations.posts.length
                : card.section === "plan" || card.section === "opportunities"
                  ? operations.opportunities.length
                  : null;
          return (
            <article className="panel seo-executive-card" key={card.section}>
              <div className="card-header-row">
                <span className="card-icon-bubble">
                  <Icon />
                </span>
                <small className="card-category">{card.title}</small>
              </div>
              <strong className="card-main-amount">
                {amount === null ? "N/D" : amount}
              </strong>
              <p className="card-question">{card.question}</p>
              <div className="executive-answer">
                <b>Status operacional:</b>
                <span>
                  {amount === null
                    ? "Auditado via checklist"
                    : amount
                      ? `${amount} registro(s) interno(s) operacional(is)`
                      : "Sem registros cadastrados"}
                </span>
              </div>
              <Button
                variant="ghost"
                className="btn-card-action"
                onClick={() => onNavigate(card.section)}
              >
                {card.action} <ArrowRight />
              </Button>
            </article>
          );
        })}
      </section>

      <div
        className="panel"
        style={{
          marginTop: "16px",
          padding: "16px",
          fontSize: "13px",
          borderRadius: "8px",
          background: "var(--color-bg-secondary, #1a1a1a)",
          borderLeft: "4px solid #f59e0b",
        }}
      >
        <strong>⚠️ Nota Transparente de Responsabilidade:</strong>
        <p style={{ margin: "4px 0 0 0", color: "var(--color-text-secondary, #ccc)" }}>
          {NO_RANKING_PROMISE_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}

export function SeoStartGuide({
  workspace,
  keywordCount,
  onNavigate,
}: {
  workspace: LocalSeoWorkspace;
  keywordCount: number;
  onNavigate: (section: LocalSeoSection) => void;
}) {
  const profile = workspace.profile;
  const missing = [
    !profile.name && "Nome",
    !profile.primaryCategory && "Categoria Principal",
    !profile.description && "Descrição",
    !profile.location && "Endereço / Área",
    !profile.phone && "Telefone",
    !profile.website && "Website / UTM",
  ].filter((item): item is string => Boolean(item));

  return (
    <section className="panel seo-start-guide">
      <div className="seo-guide-header">
        <div>
          <span className="section-kicker">CHECKLIST DE IMPLANTAÇÃO</span>
          <h2>Diagnóstico Inicial de SEO Local</h2>
          <p>
            Valide os dados do cliente e verifique a completude antes de iniciar publicações e otimizaciones.
          </p>
        </div>
        <span className="readiness-pill">
          {missing.length === 0 ? "Pronto para Operar" : `${missing.length} Item(ns) Pendente(s)`}
        </span>
      </div>

      <div className="seo-guide-grid">
        {[
          ["Nome", profile.name],
          ["Categoria", profile.primaryCategory],
          ["Localidade", profile.location],
          ["Telefone", profile.phone],
          ["Website", profile.website],
        ].map(([label, value]) => (
          <span
            key={String(label)}
            className={`guide-chip ${value ? "is-filled" : "is-empty"}`}
          >
            <strong>{label}:</strong>
            <small>{value || "Confirmar com o cliente"}</small>
          </span>
        ))}
      </div>

      <div className="seo-guide-actions">
        <strong>
          {missing.length} informação(ões) pendente(s) · {keywordCount} palavra(s)-chave cadastrada(s)
        </strong>
        <div className="guide-buttons">
          <Button variant="outline" onClick={() => onNavigate("profile")}>
            Completar informações do Perfil
          </Button>
          <Button onClick={() => onNavigate("authority")}>
            <Search /> Gerenciar Palavras-chave & Autoridade
          </Button>
        </div>
      </div>
    </section>
  );
}

const profileValue = (profile: GoogleProfileSnapshot, key: string): unknown =>
  ({
    name: profile.name,
    primary_category: profile.primaryCategory,
    additional_categories: profile.secondaryCategories,
    description: profile.description,
    phone: profile.phone,
    website: profile.website,
    address: profile.location,
    hours: profile.hours,
    services: profile.services,
    attributes: profile.attributes,
    photos: profile.photos,
    completeness: profile.completeness,
  }[key]);

const rankingFactorMap: Record<
  string,
  { tier: "primary" | "highlight" | "support"; label: string; tip: string }
> = {
  primary_category: {
    tier: "primary",
    label: "Fator Primário",
    tip: "Maior peso no ranking do Local Pack",
  },
  name: {
    tier: "primary",
    label: "Fator Crítico",
    tip: "Evitar keyword stuffing para prevenir suspensão",
  },
  address: {
    tier: "primary",
    label: "Fator Primário",
    tip: "Consistência NAP e proximidade geográfica",
  },
  additional_categories: {
    tier: "highlight",
    label: "Destaque",
    tip: "Captura buscas de serviços complementares",
  },
  hours: {
    tier: "highlight",
    label: "Destaque",
    tip: "Essencial para cliques e evitar clientes frustrados",
  },
  special_hours: {
    tier: "highlight",
    label: "Destaque",
    tip: "Evita reclamações em feriados e recessos",
  },
  services: {
    tier: "highlight",
    label: "Destaque",
    tip: "Indexação em buscas locais long-tail",
  },
  products: {
    tier: "highlight",
    label: "Destaque",
    tip: "Catálogo visual para aumento de conversão",
  },
  photos: {
    tier: "highlight",
    label: "Destaque",
    tip: "Aumenta cliques e visitas à rota no Maps",
  },
  logo: {
    tier: "highlight",
    label: "Destaque",
    tip: "Reconhecimento imediato de marca",
  },
  cover: {
    tier: "highlight",
    label: "Destaque",
    tip: "Primeira impressão visual no perfil",
  },
  description: {
    tier: "highlight",
    label: "Destaque",
    tip: "Até 750 caracteres com proposta de valor",
  },
  attributes: {
    tier: "support",
    label: "Suporte",
    tip: "Filtros de comodidades e acessibilidade",
  },
  phone: {
    tier: "support",
    label: "Suporte",
    tip: "Clique para ligar direto no mobile",
  },
  website: {
    tier: "support",
    label: "Suporte",
    tip: "Tráfego para landing page geolocalizada e UTMs",
  },
  links: {
    tier: "support",
    label: "Suporte",
    tip: "Links para agendamento ou pedidos",
  },
  questions: {
    tier: "support",
    label: "Suporte",
    tip: "Perguntas frequentes e prova de autoridade",
  },
  completeness: {
    tier: "support",
    label: "Métrica Global",
    tip: "Completude geral da auditoria de perfil",
  },
};

type AuditStatusType =
  | "ok"
  | "attention"
  | "critical"
  | "not_verified"
  | "not_available";

type CitationStatusType =
  | "verified"
  | "inconsistent"
  | "missing"
  | "submitted"
  | "not_applicable";

type NapStatusType =
  | "consistent"
  | "name_mismatch"
  | "address_mismatch"
  | "phone_mismatch"
  | "unverified";

export function ProfileAudit({
  workspace,
  googleConnected,
  checks = [],
  clientId,
  onSave,
  isAdvancedMode = false,
}: {
  workspace: LocalSeoWorkspace;
  googleConnected: boolean;
  checks?: Array<Record<string, unknown>>;
  clientId: string;
  onSave?: (input: LocalSeoV2Request) => Promise<void>;
  isAdvancedMode?: boolean;
}) {
  const persisted = new Map(
    checks.map((item) => [String(item.check_key), item]),
  );

  return (
    <div className="seo-operation">
      <section className="operation-head">
        <div>
          <span className="section-kicker">AUDITORIA DE ELEGIBILIDADE & RISCO</span>
          <h2>Perfil Google Business Profile (18 Pontos)</h2>
          <p>
            Diagnóstico centralizado de categorias, serviços, atributos, horários, UTMs e consistência NAP com indicação explícita da origem do dado.
          </p>
        </div>
        <span className="audit-summary">
          <ListChecks /> {checks.length} de {profileAuditCatalog.length} auditados
        </span>
      </section>

      <div className="profile-audit-grid">
        {profileAuditCatalog.map(([key, label]) => {
          const value = profileValue(workspace.profile, key);
          const saved = persisted.get(key);
          const status = String(saved?.status ?? "not_verified");
          const dataOrigin = (saved?.data_origin as DataOrigin) ?? (googleConnected ? "provider" : "manual");
          const available = Array.isArray(value)
            ? value.length > 0
            : value !== null && value !== undefined && value !== "";

          const factor = rankingFactorMap[key];

          return (
            <article className="panel profile-check" key={key}>
              <span
                className={`check-state ${status === "ok" ? "known" : "unknown"}`}
              >
                {status === "ok" ? (
                  <CheckCircle2 />
                ) : googleConnected ? (
                  <Clock3 />
                ) : (
                  <Link2Off />
                )}
              </span>
              <div className="check-body">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    flexWrap: "wrap",
                  }}
                >
                  <strong>{label}</strong>
                  {factor && (
                    <span
                      className={`readiness-pill ${factor.tier === "primary" ? "missing" : factor.tier === "highlight" ? "ready" : ""}`}
                      style={{
                        fontSize: "0.625rem",
                        padding: "1px 5px",
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                      }}
                      title={factor.tip}
                    >
                      {factor.label}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: "0.625rem",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      background: "var(--color-bg-secondary, #222)",
                      color: "var(--color-text-secondary, #aaa)",
                    }}
                  >
                    {dataOriginLabels[dataOrigin] ?? dataOrigin}
                  </span>
                </div>

                <small className="check-status-label">
                  {status.replaceAll("_", " ")}
                </small>

                {factor && (
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      color: "var(--content-secondary, #888)",
                      display: "block",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {factor.tip}
                  </span>
                )}

                <p>
                  {String(
                    saved?.evidence_note ??
                      (available
                        ? Array.isArray(value)
                          ? value.join(" · ")
                          : value
                        : "Ausência de evidência (Indisponível)."),
                  )}
                </p>

                {isAdvancedMode && saved && (
                  <div
                    style={{
                      fontSize: "0.6875rem",
                      color: "#888",
                      fontFamily: "monospace",
                      marginTop: "4px",
                    }}
                  >
                    CheckKey: {key} | Source: {String(saved.source ?? "manual")} | Checked: {saved.updated_at ? new Date(String(saved.updated_at)).toLocaleString("pt-BR") : "N/D"}
                  </div>
                )}

                {onSave && (
                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      marginTop: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <select
                      aria-label={`Estado de ${label}`}
                      className="check-select"
                      value={status}
                      onChange={(event) =>
                        void onSave({
                          action: "audit_save",
                          client_id: clientId,
                          check_key: key,
                          status: event.target.value as AuditStatusType,
                          source: "manual",
                          data_origin: dataOrigin,
                          evidence_note: available
                            ? String(
                                Array.isArray(value) ? value.join(" · ") : value,
                              )
                            : undefined,
                        })
                      }
                    >
                      <option value="not_verified">Não verificado</option>
                      <option value="not_available">Indisponível (N/D)</option>
                      <option value="ok">Conforme (OK)</option>
                      <option value="attention">Atenção</option>
                      <option value="critical">Crítico</option>
                    </select>

                    <select
                      aria-label={`Origem de ${label}`}
                      className="check-select"
                      value={dataOrigin}
                      onChange={(event) =>
                        void onSave({
                          action: "audit_save",
                          client_id: clientId,
                          check_key: key,
                          status: status as AuditStatusType,
                          source: "manual",
                          data_origin: event.target.value as DataOrigin,
                          evidence_note: saved?.evidence_note ? String(saved.evidence_note) : undefined,
                        })
                      }
                    >
                      <option value="provider">Google API</option>
                      <option value="manual">Manual (Operador)</option>
                      <option value="evidence">Evidência documental</option>
                      <option value="inference">Inferência (DNA)</option>
                      <option value="hypothesis">Hipótese</option>
                      <option value="unavailable">Indisponível</option>
                    </select>
                  </div>
                )}
              </div>
              <b className="check-badge">
                {status.toUpperCase().replaceAll("_", " ")}
              </b>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function KeywordsWorkspace({
  clientId,
  rows,
  onSave,
  workspace,
}: {
  clientId: string;
  rows: Array<Record<string, unknown>>;
  onSave?: (input: LocalSeoV2Request) => Promise<void>;
  workspace: LocalSeoWorkspace;
}) {
  const [keyword, setKeyword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const visible = rows.filter((row) => row.status !== "archived");
  const category = workspace.profile.primaryCategory?.replace(/[.]$/, "");
  const location = workspace.profile.location?.split("·")[0]?.trim();
  const automotive = category && /autom[oó]ve|est[eé]tica|limpeza/i.test(category);

  const suggestions = [
    category && location && `${category} em ${location}`,
    automotive && location && `estética automotiva em ${location}`,
    automotive && location && `polimento automotivo em ${location}`,
    automotive && location && `higienização automotiva em ${location}`,
    automotive && location && `vitrificação automotiva em ${location}`,
    ...workspace.profile.services.map((service) =>
      location ? `${service} em ${location}` : service,
    ),
  ]
    .filter((value): value is string => Boolean(value))
    .filter(
      (value, index, array) =>
        array.indexOf(value) === index &&
        !visible.some(
          (row) =>
            String(row.keyword).toLocaleLowerCase() ===
            value.toLocaleLowerCase(),
        ),
    )
    .slice(0, 8);

  async function saveSuggestions() {
    if (!onSave || !suggestions.length) return;
    setBusy(true);
    setMessage("");
    try {
      for (const value of suggestions) {
        await onSave({
          action: "keyword_save",
          client_id: clientId,
          keyword: value,
          intent: "local",
          priority: "medium",
          source: "dna",
          service: category || undefined,
          location: location || undefined,
          reason:
            "Sugestão inicial derivada da categoria, serviços e localidade presentes no DNA.",
        });
      }
      setMessage(
        `${suggestions.length} sugestões criadas para revisão humana.`,
      );
    } catch {
      setMessage("Não foi possível salvar todas as sugestões.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="seo-operation">
      <section className="operation-head">
        <div>
          <span className="section-kicker">DEMANDA & INTENÇÃO LOCAL</span>
          <h2>Palavras-Chave de Busca Local</h2>
          <p>
            Termos transacionais e comerciais organizados com indicação da origem e status de aprovação humana.
          </p>
        </div>
        {onSave && (
          <Button
            onClick={() => void saveSuggestions()}
            disabled={busy || !suggestions.length}
          >
            <Sparkles />
            {busy
              ? "Analisando..."
              : suggestions.length
                ? `Criar ${suggestions.length} sugestões do DNA`
                : "Sugestões já criadas"}
          </Button>
        )}
      </section>

      {message && <p className="form-success">{message}</p>}

      {onSave && (
        <section className="panel keyword-add-bar">
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Ex.: cirurgião dentista em Santo André"
          />
          <Button
            disabled={!keyword.trim()}
            onClick={() => {
              void onSave({
                action: "keyword_save",
                client_id: clientId,
                keyword,
                intent: "local",
                priority: "medium",
                source: "manual",
              });
              setKeyword("");
            }}
          >
            <Plus /> Adicionar
          </Button>
        </section>
      )}

      <div className="keyword-lanes">
        {["monitored", "suggested", "approved"].map((status) => (
          <section className="panel lane-card" key={status}>
            <div className="lane-header">
              <strong>
                {status === "monitored"
                  ? "Monitoradas"
                  : status === "suggested"
                    ? "Sugeridas"
                    : "Aprovadas"}
              </strong>
              <span className="lane-count">
                {visible.filter((row) => row.status === status).length}
              </span>
            </div>
            <div className="lane-list">
              {visible
                .filter((row) => row.status === status)
                .map((row) => (
                  <div className="keyword-item" key={String(row.id)}>
                    <span className="kw-text">{String(row.keyword)}</span>
                    <div className="kw-actions">
                      {onSave && status === "suggested" && (
                        <button
                          type="button"
                          className="kw-btn-approve"
                          onClick={() =>
                            void onSave({
                              action: "keyword_status",
                              client_id: clientId,
                              id: String(row.id),
                              status: "approved",
                            })
                          }
                        >
                          Aprovar
                        </button>
                      )}
                      {onSave && (
                        <button
                          type="button"
                          className="kw-btn-archive"
                          onClick={() =>
                            void onSave({
                              action: "keyword_status",
                              client_id: clientId,
                              id: String(row.id),
                              status: "archived",
                            })
                          }
                        >
                          Arquivar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              {!visible.some((row) => row.status === status) && (
                <span className="lane-empty">Nenhum termo nesta etapa</span>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function CompetitorsWorkspace({
  clientId,
  rows,
  onSave,
}: {
  clientId: string;
  rows: Array<Record<string, unknown>>;
  onSave?: (input: LocalSeoV2Request) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const active = rows.filter((row) => row.status !== "archived");

  return (
    <div className="seo-operation">
      <section className="operation-head">
        <div>
          <span className="section-kicker">CENÁRIO COMPETITIVO</span>
          <h2>Concorrentes Locais Diretos</h2>
          <p>
            Comparação com concorrentes da mesma região com base em dados observados.
          </p>
        </div>
      </section>

      {onSave && (
        <section className="panel operation-head">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome do concorrente local"
          />
          <Button
            disabled={!name.trim()}
            onClick={() => {
              void onSave({
                action: "competitor_save",
                client_id: clientId,
                name,
              });
              setName("");
            }}
          >
            <Plus /> Adicionar
          </Button>
        </section>
      )}

      {active.length === 0 ? (
        <section className="panel competitor-empty">
          <Users />
          <div>
            <h3>Nenhum concorrente cadastrado</h3>
            <p>
              Adicione concorrentes conhecidos para comparar notas, avaliações e categorização.
            </p>
          </div>
          <span className="safe-badge">Dado observado ou manual</span>
        </section>
      ) : (
        <section className="panel comparison-table">
          {active.map((row) => (
            <div className="comparison-row" key={String(row.id)}>
              <strong>{String(row.name)}</strong>
              <span>{String(row.location ?? "Local não informado")}</span>
              <b>
                {row.rating == null ? "N/D" : `${String(row.rating)} ★`}
              </b>
              {onSave && (
                <button
                  type="button"
                  className="btn-archive-comp"
                  onClick={() =>
                    void onSave({
                      action: "competitor_status",
                      client_id: clientId,
                      id: String(row.id),
                      status: "archived",
                    })
                  }
                >
                  Arquivar
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export function CitationsWorkspace({
  clientId,
  citations = [],
  onSave,
}: {
  clientId: string;
  citations: Array<Record<string, unknown>>;
  onSave?: (input: LocalSeoV2Request) => Promise<void>;
}) {
  const persisted = new Map(
    citations.map((c) => [String(c.directory_name), c]),
  );

  return (
    <div className="seo-operation">
      <section className="operation-head">
        <div>
          <span className="section-kicker">CITAÇÕES & NAP CONSISTENCY</span>
          <h2>Diretórios Locais e Autoridade de Citação</h2>
          <p>
            Monitoramento de consistência de Nome, Endereço e Telefone (NAP) nos principais guias e mapas.
          </p>
        </div>
      </section>

      <div className="profile-audit-grid">
        {defaultCitationsCatalog.map((item) => {
          const saved = persisted.get(item.directory_name);
          const status = String(saved?.status ?? "missing");
          const napStatus = String(saved?.nap_status ?? "unverified");

          return (
            <article className="panel profile-check" key={item.directory_name}>
              <span
                className={`check-state ${status === "verified" ? "known" : "unknown"}`}
              >
                {status === "verified" ? <ShieldCheck /> : <Globe />}
              </span>
              <div className="check-body">
                <strong>{item.directory_name}</strong>
                <small className="check-status-label">{item.category}</small>
                <p>
                  Status NAP:{" "}
                  <b>
                    {napStatus === "consistent"
                      ? "NAP Consistente ✓"
                      : napStatus === "name_mismatch"
                        ? "Nome Divergente ⚠️"
                        : napStatus === "address_mismatch"
                          ? "Endereço Divergente ⚠️"
                          : napStatus === "phone_mismatch"
                            ? "Telefone Divergente ⚠️"
                            : "Não verificado"}
                  </b>
                </p>

                {saved?.url && (
                  <a
                    href={String(saved.url)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--color-primary, #3b82f6)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    Ver link registrado <ExternalLink style={{ width: "12px", height: "12px" }} />
                  </a>
                )}

                {onSave && (
                  <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                    <select
                      className="check-select"
                      aria-label={`Status de ${item.directory_name}`}
                      value={status}
                      onChange={(e) =>
                        void onSave({
                          action: "citation_save",
                          client_id: clientId,
                          directory_name: item.directory_name,
                          status: e.target.value as CitationStatusType,
                          nap_status: napStatus as NapStatusType,
                          source: "manual",
                          url: saved?.url ? String(saved.url) : undefined,
                        })
                      }
                    >
                      <option value="missing">Ausente</option>
                      <option value="verified">Verificado (Conforme)</option>
                      <option value="inconsistent">Inconsistente</option>
                      <option value="submitted">Enviado</option>
                      <option value="not_applicable">Não aplicável</option>
                    </select>

                    <select
                      className="check-select"
                      aria-label={`NAP status de ${item.directory_name}`}
                      value={napStatus}
                      onChange={(e) =>
                        void onSave({
                          action: "citation_save",
                          client_id: clientId,
                          directory_name: item.directory_name,
                          status: status as CitationStatusType,
                          nap_status: e.target.value as NapStatusType,
                          source: "manual",
                          url: saved?.url ? String(saved.url) : undefined,
                        })
                      }
                    >
                      <option value="unverified">Não verificado</option>
                      <option value="consistent">NAP Consistente</option>
                      <option value="name_mismatch">Nome Divergente</option>
                      <option value="address_mismatch">Endereço Divergente</option>
                      <option value="phone_mismatch">Telefone Divergente</option>
                    </select>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function VisibilityConversionWorkspace({
  workspace,
}: {
  workspace: LocalSeoWorkspace;
}) {
  return (
    <div className="seo-operation space-y-6">
      <section className="operation-head">
        <div>
          <span className="section-kicker">MEDICÃO & EVIDÊNCIAS DE DESEMPENHO</span>
          <h2>Visibilidade e Conversão Local</h2>
          <p>
            Alastre Local Score, baseline histórico e métricas de conversão informadas com transparência.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="panel p-4 rounded-lg bg-card border border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase">
            Baseline de Entrada
          </span>
          <h3 className="text-lg font-bold text-foreground mt-1">
            Ponto de Partida Auditado
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Estado da ficha no onboarding. Serve como referência para acompanhar evoluções de perfil e reputação.
          </p>
          <div className="mt-3 text-sm font-semibold">
            Status: {workspace.provenance.label}
          </div>
        </div>

        <div className="panel p-4 rounded-lg bg-card border border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase">
            Local Pack & Posições
          </span>
          <h3 className="text-lg font-bold text-foreground mt-1">
            Ranking Google Maps
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Google Business Profile não fornece dados de posição nativamente. Posições de busca dependem de um Rank Provider configurado.
          </p>
          <div className="mt-3 text-xs font-mono bg-muted p-1.5 rounded text-muted-foreground">
            Status: {unconfiguredLocalRankProvider.status} (Provedor não configurado)
          </div>
        </div>

        <div className="panel p-4 rounded-lg bg-card border border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase">
            Heatmap / Grid Local
          </span>
          <h3 className="text-lg font-bold text-foreground mt-1">
            Grid de Geoposição
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Visualização em raio de busca para ver onde a ficha aparece nos primeiros lugares.
          </p>
          <div className="mt-3 text-xs font-medium text-amber-500">
            Grid não contratado / Indisponível para este cliente.
          </div>
        </div>
      </section>

      <section className="panel p-4 rounded-lg bg-card border border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase">
          Métricas de Conversão Coletadas / Informadas
        </span>
        <h3 className="text-base font-bold text-foreground mb-3">
          Ações Diretas dos Clientes (Insights)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-muted rounded-lg text-center">
            <PhoneCall className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-xs text-muted-foreground">Ligações</span>
            <div className="text-lg font-bold">Informado / API</div>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <Route className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-xs text-muted-foreground">Rotas no Maps</span>
            <div className="text-lg font-bold">Informado / API</div>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <Globe className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-xs text-muted-foreground">Cliques no Site</span>
            <div className="text-lg font-bold">Informado / API</div>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <MessageSquare className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-xs text-muted-foreground">WhatsApp / Formulários</span>
            <div className="text-lg font-bold">Coletado CRM</div>
          </div>
        </div>
      </section>

      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-600 dark:text-amber-400">
        <strong>⚠️ Limitações Explícitas de Responsabilidade:</strong>
        <p className="mt-1">{NO_RANKING_PROMISE_DISCLAIMER}</p>
      </div>
    </div>
  );
}

export function ActionPlanWorkspace({
  opportunities = [],
  clientId,
  onSave,
}: {
  opportunities: Array<Record<string, unknown>>;
  clientId: string;
  onSave?: (input: LocalSeoV2Request) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState("");

  const activeOpps = opportunities.filter(
    (o) => !["completed", "dismissed"].includes(String(o.status)),
  );

  async function handleCreateWorkItem(oppId: string) {
    if (!onSave) return;
    setBusyId(oppId);
    try {
      await onSave({
        action: "opportunity_create_work_item",
        client_id: clientId,
        id: oppId,
      });
    } catch {
      // Ignorar erro gracioso
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="seo-operation space-y-4">
      <section className="operation-head">
        <div>
          <span className="section-kicker">PLANO DE AÇÃO OPERACIONAL</span>
          <h2>Oportunidades & Tarefas no Motor de Operações</h2>
          <p>
            Transforme diagnósticos de SEO Local em tarefas executáveis com SLA, evidências e responsáveis no Módulo 04.
          </p>
        </div>
      </section>

      {activeOpps.length === 0 ? (
        <section className="panel competitor-empty">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <h3>Nenhuma oportunidade pendente</h3>
          <p>
            Todas as oportunidades detectadas já foram transformadas em tarefas ou concluídas.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {activeOpps.map((opp) => {
            const id = String(opp.id);
            const priority = String(opp.priority ?? "medium");
            const workItemId = opp.work_item_id ? String(opp.work_item_id) : null;
            const diagnosis = opp.diagnosis ? String(opp.diagnosis) : null;
            const recommendation = opp.recommendation ? String(opp.recommendation) : null;

            return (
              <article
                className="panel p-4 rounded-lg bg-card border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                key={id}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold uppercase ${
                        priority === "critical"
                          ? "bg-red-500/20 text-red-500"
                          : priority === "high"
                            ? "bg-amber-500/20 text-amber-500"
                            : "bg-blue-500/20 text-blue-500"
                      }`}
                    >
                      {priority}
                    </span>
                    <span className="text-xs text-muted-foreground uppercase font-medium">
                      {String(opp.category ?? "Geral")}
                    </span>
                  </div>
                  <h4 className="font-bold text-foreground text-base">
                    {String(opp.title)}
                  </h4>
                  {diagnosis ? (
                    <p className="text-xs text-muted-foreground">
                      <strong>Diagnóstico:</strong> {String(diagnosis)}
                    </p>
                  ) : null}
                  {recommendation ? (
                    <p className="text-xs text-muted-foreground">
                      <strong>Recomendação:</strong> {String(recommendation)}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  {workItemId ? (
                    <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30 px-3 py-1.5 rounded-md font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Vinculado ao Motor de Operações
                    </span>
                  ) : (
                    onSave && (
                      <Button
                        size="sm"
                        onClick={() => void handleCreateWorkItem(id)}
                        disabled={busyId === id}
                      >
                        {busyId === id ? "Vinculando..." : "Transformar em Tarefa Operacional"}
                      </Button>
                    )
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function HistoryWorkspace({
  rows = [],
}: {
  rows?: Array<Record<string, unknown>>;
}) {
  const ordered = [...rows]
    .filter((row) => row.created_at || row.updated_at || row.reviewed_at)
    .sort((a, b) =>
      String(b.updated_at ?? b.reviewed_at ?? b.created_at).localeCompare(
        String(a.updated_at ?? a.reviewed_at ?? a.created_at),
      ),
    );

  return ordered.length ? (
    <section className="panel audit-table">
      <div className="audit-head">
        <span className="section-kicker">HISTÓRICO OPERACIONAL AUDITADO</span>
        <strong>{ordered.length} evento(s) registrado(s)</strong>
      </div>
      {ordered.map((row, index) => {
        const kind = String(row.history_kind ?? "registro");
        const date = String(
          row.updated_at ?? row.reviewed_at ?? row.created_at,
        );
        const title = String(
          row.theme ??
            row.reviewer_name ??
            row.title ??
            (kind === "reply"
              ? "Resposta de avaliação"
              : "Atividade SEO Local"),
        );
        return (
          <div className="audit-row" key={String(row.id ?? index)}>
            <span className="audit-icon">
              <FileSearch />
            </span>
            <div className="audit-info">
              <strong>{title}</strong>
              <small>
                {kind.replaceAll("_", " ")} ·{" "}
                {new Date(date).toLocaleString("pt-BR")}
              </small>
            </div>
            <span className="audit-status-tag">
              {String(row.status ?? "registrado").replaceAll("_", " ")}
            </span>
          </div>
        );
      })}
    </section>
  ) : (
    <section className="panel local-empty">
      <span>
        <FileSearch />
      </span>
      <div>
        <h2>Histórico operacional limpo</h2>
        <p>
          Postagens, avaliações, respostas, pontuações e decisões humanas aparecerão aqui.
        </p>
        <small>
          <ShieldQuestion /> Registros autênticos auditáveis.
        </small>
      </div>
    </section>
  );
}
