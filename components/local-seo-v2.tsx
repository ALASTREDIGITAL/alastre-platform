"use client";
import {useState} from "react";
import {ArrowRight,CalendarDays,CheckCircle2,Clock3,FileSearch,Lightbulb,Link2,Link2Off,ListChecks,MapPin,Plus,Search,ShieldQuestion,Sparkles,Star,Store,Users} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {profileAuditCatalog,unconfiguredLocalRankProvider} from "@/lib/local-seo-v2-domain";
import type {GoogleProfileSnapshot,LocalSeoSection,LocalSeoWorkspace} from "@/lib/local-seo-types";
import type {LocalSeoV2Request} from "@/lib/local-seo-v2-api";

type Ops={posts:Array<Record<string,unknown>>;reviews:Array<Record<string,unknown>>;replies:Array<Record<string,unknown>>;opportunities:Array<Record<string,unknown>>};
const cards:Array<{section:LocalSeoSection;title:string;question:string;action:string;icon:typeof Store}>=[
 {section:"profile",title:"Perfil Google",question:"O perfil está completo e consistente?",action:"Revisar auditoria",icon:Store},
 {section:"reviews",title:"Avaliações",question:"Há avaliações que precisam de resposta?",action:"Abrir avaliações",icon:Star},
 {section:"posts",title:"Postagens",question:"Existe conteúdo planejado para o mês?",action:"Planejar conteúdo",icon:CalendarDays},
 {section:"keywords",title:"Palavras-chave",question:"Quais buscas locais são prioritárias?",action:"Organizar palavras",icon:Search},
 {section:"competitors",title:"Concorrência",question:"Onde o cliente difere dos concorrentes?",action:"Comparar concorrentes",icon:Users},
 {section:"opportunities",title:"Oportunidades",question:"Qual ação tem maior impacto agora?",action:"Ver oportunidades",icon:Lightbulb},
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
          <span className="section-kicker">CLIENTE SELECIONADO</span>
          <h2>{workspace.clientName}</h2>
          <p>Visão executiva da presença local e das próximas ações operacionais.</p>
          <Button variant="ghost" className="btn-connection-link" onClick={onOpenConnections}>
            <Link2 /> Ver conexão Google
          </Button>
        </div>
        <dl className="seo-health-metrics">
          <div>
            <dt>Serviço SEO Local</dt>
            <dd>Em preparação</dd>
          </div>
          <div>
            <dt>Status Google</dt>
            <dd>{googleStatus}</dd>
          </div>
          <div>
            <dt>Última sincronização</dt>
            <dd>Não sincronizado</dd>
          </div>
          <div>
            <dt>Saúde dos dados</dt>
            <dd>{workspace.provenance.label}</dd>
          </div>
        </dl>
      </section>

      <section className="seo-executive-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          const amount =
            card.section === "reviews"
              ? operations.reviews.length
              : card.section === "posts"
              ? operations.posts.length
              : card.section === "opportunities"
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
                <b>Diagnóstico:</b>
                <span>
                  {amount === null
                    ? "Dados ainda insuficientes"
                    : amount
                    ? `${amount} registro(s) interno(s) disponível(is)`
                    : "Nenhum registro disponível"}
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
  const items = [
    ["Nome da empresa", profile.name],
    ["Categoria principal", profile.primaryCategory],
    ["Cidade ou região", profile.location],
    ["Telefone comercial", profile.phone],
    ["Site oficial", profile.website],
    ["Descrição comercial", profile.description],
    ["Horários confirmados", profile.hours],
    ["Serviços detalhados", profile.services.length ? profile.services.join(" · ") : null],
  ] as Array<[string, string | null]>;

  const missing = items.filter(([, value]) => !value);

  return (
    <section className="panel seo-start-guide">
      <div className="start-guide-header">
        <span className="section-kicker">CHECKLIST DE ENTRADA</span>
        <h2>O que o SEO Local precisa para operar</h2>
        <p>
          O sistema separa os fatos confirmados no DNA daqueles que ainda precisam de validação com o cliente.
        </p>
      </div>

      <div className="seo-readiness-list">
        {items.map(([label, value]) => (
          <span className={`readiness-pill ${value ? "ready" : "missing"}`} key={label}>
            {value ? <CheckCircle2 className="icon-ready" /> : <ShieldQuestion className="icon-missing" />}
            <b>{label}</b>
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
            Completar informações
          </Button>
          <Button onClick={() => onNavigate("keywords")}>
            <Search /> Analisar palavras-chave
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

const rankingFactorMap: Record<string, { tier: "primary" | "highlight" | "support"; label: string; tip: string }> = {
  primary_category: { tier: "primary", label: "Fator Primário", tip: "Maior peso no ranking do Local Pack" },
  name: { tier: "primary", label: "Fator Crítico", tip: "Evitar keyword stuffing para prevenir suspensão" },
  address: { tier: "primary", label: "Fator Primário", tip: "Consistência NAP e proximidade geográfica" },
  additional_categories: { tier: "highlight", label: "Destaque", tip: "Captura buscas de serviços complementares" },
  hours: { tier: "highlight", label: "Destaque", tip: "Essencial para cliques e evitar clientes frustrados" },
  special_hours: { tier: "highlight", label: "Destaque", tip: "Evita reclamações em feriados e recessos" },
  services: { tier: "highlight", label: "Destaque", tip: "Indexação em buscas locais long-tail" },
  products: { tier: "highlight", label: "Destaque", tip: "Catálogo visual para aumento de conversão" },
  photos: { tier: "highlight", label: "Destaque", tip: "Aumenta cliques e visitas à rota no Maps" },
  logo: { tier: "highlight", label: "Destaque", tip: "Reconhecimento imediato de marca" },
  cover: { tier: "highlight", label: "Destaque", tip: "Primeira impressão visual no perfil" },
  description: { tier: "highlight", label: "Destaque", tip: "Até 750 caracteres com proposta de valor" },
  attributes: { tier: "support", label: "Suporte", tip: "Filtros de comodidades e acessibilidade" },
  phone: { tier: "support", label: "Suporte", tip: "Clique para ligar direto no mobile" },
  website: { tier: "support", label: "Suporte", tip: "Tráfego para landing page geolocalizada" },
  links: { tier: "support", label: "Suporte", tip: "Links para agendamento ou pedidos" },
  questions: { tier: "support", label: "Suporte", tip: "Perguntas frequentes e prova de autoridade" },
  completeness: { tier: "support", label: "Métrica Global", tip: "Completude geral da auditoria de perfil" },
};

export function ProfileAudit({
  workspace,
  googleConnected,
  checks = [],
  clientId,
  onSave,
}: {
  workspace: LocalSeoWorkspace;
  googleConnected: boolean;
  checks?: Array<Record<string, unknown>>;
  clientId: string;
  onSave?: (input: LocalSeoV2Request) => Promise<void>;
}) {
  const persisted = new Map(checks.map((item) => [String(item.check_key), item]));

  return (
    <div className="seo-operation">
      <section className="operation-head">
        <div>
          <span className="section-kicker">AUDITORIA DE CONSISTÊNCIA</span>
          <h2>Perfil no Google Meu Negócio</h2>
          <p>Verificações com evidência comprovada e histórico rastreável.</p>
        </div>
        <span className="audit-summary">
          <ListChecks /> {checks.length} verificações registradas
        </span>
      </section>

      <div className="profile-audit-grid">
        {profileAuditCatalog.map(([key, label]) => {
          const value = profileValue(workspace.profile, key);
          const saved = persisted.get(key);
          const status = String(saved?.status ?? "not_verified");
          const available = Array.isArray(value)
            ? value.length > 0
            : value !== null && value !== undefined && value !== "";

          const factor = rankingFactorMap[key];

          return (
            <article className="panel profile-check" key={key}>
              <span className={`check-state ${status === "ok" ? "known" : "unknown"}`}>
                {status === "ok" ? <CheckCircle2 /> : googleConnected ? <Clock3 /> : <Link2Off />}
              </span>
              <div className="check-body">
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                  <strong>{label}</strong>
                  {factor && (
                    <span
                      className={`readiness-pill ${factor.tier === "primary" ? "missing" : factor.tier === "highlight" ? "ready" : ""}`}
                      style={{ fontSize: "0.625rem", padding: "1px 5px", textTransform: "uppercase", letterSpacing: "0.03em" }}
                      title={factor.tip}
                    >
                      {factor.label}
                    </span>
                  )}
                </div>
                <small className="check-status-label">{status.replaceAll("_", " ")}</small>
                {factor && (
                  <span style={{ fontSize: "0.6875rem", color: "var(--content-secondary)", display: "block", marginBottom: "0.25rem" }}>
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
                        : "Sem evidência registrada.")
                  )}
                </p>
                {onSave && (
                  <select
                    aria-label={`Estado de ${label}`}
                    className="check-select"
                    value={status}
                    onChange={(event) =>
                      void onSave({
                        action: "audit_save",
                        client_id: clientId,
                        check_key: key,
                        status: event.target.value as
                          | "ok"
                          | "attention"
                          | "critical"
                          | "not_verified"
                          | "not_available",
                        source: "manual",
                        evidence_note: available
                          ? String(Array.isArray(value) ? value.join(" · ") : value)
                          : undefined,
                      })
                    }
                  >
                    <option value="not_verified">Não verificado</option>
                    <option value="not_available">Indisponível</option>
                    <option value="ok">Conforme (OK)</option>
                    <option value="attention">Atenção</option>
                    <option value="critical">Crítico</option>
                  </select>
                )}
              </div>
              <b className="check-badge">{status.toUpperCase().replaceAll("_", " ")}</b>
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
      location ? `${service} em ${location}` : service
    ),
  ]
    .filter((value): value is string => Boolean(value))
    .filter(
      (value, index, array) =>
        array.indexOf(value) === index &&
        !visible.some(
          (row) => String(row.keyword).toLocaleLowerCase() === value.toLocaleLowerCase()
        )
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
          reason: "Sugestão inicial derivada da categoria, serviços e localidade presentes no DNA.",
        });
      }
      setMessage(`${suggestions.length} sugestões criadas para revisão humana.`);
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
          <span className="section-kicker">DEMANDA & BUSCA LOCAL</span>
          <h2>Palavras-chave Relevantes</h2>
          <p>Cadastre, aprove e monitore termos com intenção de busca local comprovada.</p>
        </div>
        {onSave && (
          <Button onClick={() => void saveSuggestions()} disabled={busy || !suggestions.length}>
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

      <section className="panel rank-foundation">
        <MapPin />
        <div>
          <span className="section-kicker">RANK TRACKING LOCAL</span>
          <h3>Monitoramento de posições geo-localizadas</h3>
          <p>
            Posições no mapa e no grid local exigem conexão ativa com provedor de rankeamento.
          </p>
        </div>
        <span className="rank-status-tag">{unconfiguredLocalRankProvider.status}</span>
      </section>
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
          <p>Compare referências locais baseando-se estritamente em dados auditados.</p>
        </div>
      </section>

      {onSave && (
        <section className="panel operation-head">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome do concorrente"
          />
          <Button
            disabled={!name.trim()}
            onClick={() => {
              void onSave({ action: "competitor_save", client_id: clientId, name });
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
            <p>Adicione um concorrente da região para acompanhar e comparar notas e categorias.</p>
          </div>
          <span className="safe-badge">Sem scraping não autorizado</span>
        </section>
      ) : (
        <section className="panel comparison-table">
          {active.map((row) => (
            <div className="comparison-row" key={String(row.id)}>
              <strong>{String(row.name)}</strong>
              <span>{String(row.location ?? "Local não informado")}</span>
              <b>{row.rating == null ? "N/D" : `${String(row.rating)} ★`}</b>
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

export function HistoryWorkspace({
  rows = [],
}: {
  rows?: Array<Record<string, unknown>>;
}) {
  const ordered = [...rows]
    .filter((row) => row.created_at || row.updated_at || row.reviewed_at)
    .sort((a, b) =>
      String(b.updated_at ?? b.reviewed_at ?? b.created_at).localeCompare(
        String(a.updated_at ?? a.reviewed_at ?? a.created_at)
      )
    );

  return ordered.length ? (
    <section className="panel audit-table">
      <div className="audit-head">
        <span className="section-kicker">HISTÓRICO OPERACIONAL AUDITADO</span>
        <strong>{ordered.length} evento(s) registrado(s)</strong>
      </div>
      {ordered.map((row, index) => {
        const kind = String(row.history_kind ?? "registro");
        const date = String(row.updated_at ?? row.reviewed_at ?? row.created_at);
        const title = String(
          row.theme ??
            row.reviewer_name ??
            row.title ??
            (kind === "reply" ? "Resposta de avaliação" : "Atividade SEO Local")
        );
        return (
          <div className="audit-row" key={String(row.id ?? index)}>
            <span className="audit-icon">
              <FileSearch />
            </span>
            <div className="audit-info">
              <strong>{title}</strong>
              <small>
                {kind.replaceAll("_", " ")} · {new Date(date).toLocaleString("pt-BR")}
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
          Postagens, avaliações, respostas e decisões humanas aparecerão aqui após a primeira
          operação.
        </p>
        <small>
          <ShieldQuestion /> Nenhum evento fictício ou simulação desnecessária.
        </small>
      </div>
    </section>
  );
}
