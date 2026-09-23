"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, FileCheck2, FileText, Globe, Layers, MapPin, RefreshCw, RotateCcw, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DecisionState, IntegrationState } from "@/components/platform-state";
import { isArrayOf, isRecord, isRequestCancelled, isString, postGoogleAds } from "@/lib/platform-api";

type Approval = {
  id: string;
  status: "pending" | "approved" | "rejected" | "changes_requested" | "cancelled";
  created_at: string;
  requested_by_email: string;
  decision_note: string | null;
  source_type?: "google_ads_campaign" | "tracking_deployment" | "tracking_publication" | "local_seo_post" | "local_seo_review_response" | "local_seo_opportunity_action";
  clients?: { name?: string } | null;
  snapshot: {
    name?: string;
    daily_budget?: number | string;
    configuration?: { cities?: string[]; keywords?: string[]; conversion?: string; objective?: string };
    domain?: string;
    platform?: string;
    decision?: string;
    config_hash?: string;
    version_path?: string;
    theme?: string;
    body?: string;
    title?: string;
    diagnosis?: string;
    review_text?: string;
    locality?: string;
    service?: string;
    primary_keyword?: string;
    related_keywords?: string[];
    cta?: string;
    origin?: string;
    plan?: { actions?: Array<{target:string;operation:string;count?:number}>; desired_events?: string[] };
  };
};

const statusLabel = {
  pending: "Pendente", approved: "Aprovada", rejected: "Rejeitada",
  changes_requested: "Ajustes solicitados", cancelled: "Cancelada",
};
const approvalStatuses=["pending","approved","rejected","changes_requested","cancelled"] as const;
const isApproval=(value:unknown):value is Approval=>isRecord(value)&&isString(value.id)&&isString(value.status)&&approvalStatuses.includes(value.status as Approval["status"])&&isString(value.created_at)&&isRecord(value.snapshot);
const isApprovalArray=isArrayOf(isApproval);

export function ApprovalsModule({onOpenConnections}:{onOpenConnections?:()=>void}) {
  const [items, setItems] = useState<Approval[]>([]);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setUnavailable(false);
    try {
      const data = await postGoogleAds({ action: "list" }, isApprovalArray, signal);
      if (signal?.aborted) return;
      setItems(data);
      setSelected((current) => data.find((item) => item.id === current?.id) ?? data[0] ?? null);
    } catch (error) {
      if (isRequestCancelled(error)) return;
      setItems([]);
      setSelected(null);
      setUnavailable(true);
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  async function decide(decision: "approved" | "rejected" | "changes_requested") {
    if (!selected) return;
    setDeciding(true);
    try {
      await postGoogleAds({ action: "decide", approval_id: selected.id, decision, note }, isRecord);
      setNote("");
      await load();
    } catch { setUnavailable(true); }
    finally { setDeciding(false); }
  }

  const pending = items.filter((item) => item.status === "pending").length;
  const config = selected?.snapshot.configuration;

  return <div className="approval-page">
    <div className="approval-title">
      <div>
        <div className="eyebrow"><ShieldCheck /> OPERAÇÃO SEGURA · HUMAN-IN-THE-LOOP</div>
        <h1>Central de Aprovações</h1>
        <p>Revise decisões preparadas pela IA antes que qualquer ação avance para execução.</p>
      </div>
      <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} /> Atualizar</Button>
    </div>
    {unavailable ? <IntegrationState compact message="A fila aparecerá quando os serviços necessários estiverem conectados. Nenhuma decisão foi alterada." onRetry={() => void load()} /> : loading ? <DecisionState title="Carregando decisões" message="Estamos verificando se algo precisa da sua atenção." /> : items.length === 0 ? <DecisionState icon={CheckCircle2} title="Nenhuma decisão aguardando você." message="Os itens aparecerão aqui depois que os agentes prepararem uma ação para sua revisão." actionLabel={onOpenConnections ? "Configurar conexões" : undefined} onAction={onOpenConnections} /> : null}
    {!unavailable && !loading && items.length > 0 ? <>
    <section className="approval-summary">
      <article className="pending">
        <div className="stat-icon"><Clock3 /></div>
        <div className="stat-content">
          <strong>{pending}</strong>
          <span>Aguardando Decisão</span>
        </div>
      </article>
      <article className="approved">
        <div className="stat-icon"><CheckCircle2 /></div>
        <div className="stat-content">
          <strong>{items.filter((item) => item.status === "approved").length}</strong>
          <span>Aprovadas com Sucesso</span>
        </div>
      </article>
      <article className="changes">
        <div className="stat-icon"><RotateCcw /></div>
        <div className="stat-content">
          <strong>{items.filter((item) => item.status === "changes_requested").length}</strong>
          <span>Com Ajustes Solicitados</span>
        </div>
      </article>
    </section>
    <section className="approval-layout">
      <div className="approval-queue">
        <div className="queue-heading">
          <div className="queue-heading-title">
            <span className="section-kicker">FILA DE DECISÕES</span>
            <Badge variant="outline">{items.length} {items.length === 1 ? "item" : "itens"}</Badge>
          </div>
        </div>
        {loading ? <div className="queue-empty">Carregando aprovações...</div> : items.length === 0 ? <div className="queue-empty">Nenhuma aprovação registrada.</div> : items.map((item) => {
          const isLocalSeo = item.source_type?.startsWith("local_seo");
          const isTracking = item.source_type?.startsWith("tracking");
          const itemTitle = item.snapshot.name ?? item.snapshot.theme ?? item.snapshot.title ?? (item.source_type === "local_seo_review_response" ? "Resposta de avaliação" : item.source_type?.startsWith("local_seo") ? "Publicação SEO Local" : "Campanha Google Ads");
          return (
            <button
              type="button"
              key={item.id}
              className={`queue-item${selected?.id === item.id ? " selected" : ""}`}
              onClick={() => { setSelected(item); setNote(""); }}
            >
              <span className="queue-icon">
                {isLocalSeo ? <MapPin /> : isTracking ? <Globe /> : <FileCheck2 />}
              </span>
              <div>
                <strong>{itemTitle}</strong>
                <span>{item.clients?.name ?? "Cliente"} · {new Date(item.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
              <Badge variant="outline" className={`approval-status status-${item.status}`}>{statusLabel[item.status]}</Badge>
            </button>
          );
        })}
      </div>
      <article className="approval-detail">
        {!selected ? <div className="queue-empty">Selecione um item da fila para visualizar os detalhes.</div> : <>
          <div className="detail-heading">
            <div>
              <span className="detail-kicker-pill">
                {selected.source_type === "local_seo_post"
                  ? "SEO LOCAL · POSTAGEM"
                  : selected.source_type === "local_seo_review_response"
                  ? "SEO LOCAL · RESPOSTA DE AVALIAÇÃO"
                  : selected.source_type === "local_seo_opportunity_action"
                  ? "SEO LOCAL · OPORTUNIDADE"
                  : selected.source_type === "tracking_publication"
                  ? "GTM E GA4 · PUBLICAÇÃO"
                  : selected.source_type === "tracking_deployment"
                  ? "GTM E GA4 · PLANO"
                  : "GOOGLE ADS · CAMPANHA"}
              </span>
              <h2>
                {selected.snapshot.name ??
                  selected.snapshot.theme ??
                  selected.snapshot.title ??
                  (selected.source_type === "local_seo_review_response"
                    ? "Resposta de avaliação"
                    : "Rascunho para aprovação")}
              </h2>
            </div>
            <Badge className={`approval-status status-${selected.status}`}>{statusLabel[selected.status]}</Badge>
          </div>

          {selected.source_type === "tracking_publication" ? (
            <div className="detail-grid">
              <div><span>Cliente</span><strong>{selected.clients?.name ?? "Cliente"}</strong></div>
              <div><span>Domínio</span><strong>{selected.snapshot.domain}</strong></div>
              <div><span>Versão exata</span><strong>{selected.snapshot.version_path}</strong></div>
              <div><span>Hash protegido</span><strong>{selected.snapshot.config_hash?.slice(0, 16)}</strong></div>
            </div>
          ) : selected.source_type === "tracking_deployment" ? (
            <>
              <div className="detail-grid">
                <div><span>Cliente</span><strong>{selected.clients?.name ?? "Cliente"}</strong></div>
                <div><span>Domínio</span><strong>{selected.snapshot.domain}</strong></div>
                <div><span>Plataforma</span><strong>{selected.snapshot.platform}</strong></div>
                <div><span>Decisão</span><strong>{selected.snapshot.decision?.replaceAll("_", " ")}</strong></div>
              </div>
              <div className="detail-block">
                <h3>Alterações planejadas</h3>
                <div className="tracking-actions">
                  {selected.snapshot.plan?.actions?.map((action, index) => (
                    <div key={`${action.target}-${index}`}>
                      <span>{action.target.replaceAll("_", " ")}</span>
                      <strong>{action.operation.replaceAll("_", " ")}{typeof action.count === "number" ? ` · ${action.count}` : ""}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="detail-block">
                <h3>Eventos previstos</h3>
                <div className="approval-keywords">
                  {selected.snapshot.plan?.desired_events?.map((event) => <span key={event}>{event}</span>)}
                </div>
              </div>
            </>
          ) : selected.source_type === "local_seo_post" ? (
            <>
              <div className="detail-grid">
                <div><span>Cliente</span><strong>{selected.clients?.name ?? "Cliente"}</strong></div>
                <div><span>Localidade / Praça</span><strong>{selected.snapshot.locality ?? "Matriz / Geral"}</strong></div>
                <div><span>Serviço / Foco</span><strong>{selected.snapshot.service ?? "Institucional"}</strong></div>
                <div><span>Palavra-chave foco</span><strong>{selected.snapshot.primary_keyword ?? "Não especificada"}</strong></div>
              </div>
              <div className="detail-block">
                <h3><FileText /> Conteúdo sugerido para publicação</h3>
                <div className="post-preview-card">
                  {selected.snapshot.theme && <strong className="post-preview-theme">{selected.snapshot.theme}</strong>}
                  <p className="post-preview-body">{selected.snapshot.body ?? "Sem texto cadastrado."}</p>
                  {selected.snapshot.cta && (
                    <div className="post-preview-cta">
                      <span className="cta-label">Chamada para ação (CTA):</span>
                      <strong>{selected.snapshot.cta}</strong>
                    </div>
                  )}
                </div>
              </div>
              {selected.snapshot.related_keywords && selected.snapshot.related_keywords.length > 0 && (
                <div className="detail-block">
                  <h3>Palavras-chave relacionadas</h3>
                  <div className="approval-keywords">
                    {selected.snapshot.related_keywords.map((kw) => (
                      <span key={kw}>{kw}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : selected.source_type === "local_seo_review_response" ? (
            <>
              <div className="detail-grid">
                <div><span>Cliente</span><strong>{selected.clients?.name ?? "Cliente"}</strong></div>
                <div><span>Tipo de ação</span><strong>Resposta a avaliação Google</strong></div>
              </div>
              {selected.snapshot.review_text && (
                <div className="detail-block">
                  <h3>Avaliação recebida do cliente</h3>
                  <div className="post-preview-card">
                    <p className="post-preview-body">“{selected.snapshot.review_text}”</p>
                  </div>
                </div>
              )}
              <div className="detail-block">
                <h3><Sparkles /> Resposta sugerida pela IA</h3>
                <div className="post-preview-card">
                  <p className="post-preview-body">{selected.snapshot.body ?? "Sem resposta definida."}</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="detail-grid">
                <div><span>Cliente</span><strong>{selected.clients?.name ?? "Cliente"}</strong></div>
                <div>
                  <span>Orçamento diário</span>
                  <strong>
                    {selected.snapshot.daily_budget != null && !isNaN(Number(selected.snapshot.daily_budget)) && Number(selected.snapshot.daily_budget) > 0
                      ? `R$ ${Number(selected.snapshot.daily_budget).toFixed(2).replace(".", ",")}`
                      : "A definir"}
                  </strong>
                </div>
                <div><span>Objetivo</span><strong>{config?.objective ?? "Solicitações de orçamento"}</strong></div>
                <div><span>Conversão</span><strong>{config?.conversion ?? "form_submit_success"}</strong></div>
              </div>
              {config?.cities && config.cities.length > 0 && (
                <div className="detail-block">
                  <h3><MapPin /> Cidades alvo</h3>
                  <div className="detail-chips">
                    {config.cities.map((city) => <span key={city}>{city}</span>)}
                  </div>
                </div>
              )}
              {config?.keywords && config.keywords.length > 0 && (
                <div className="detail-block">
                  <h3>Palavras-chave revisadas</h3>
                  <div className="approval-keywords">
                    {config.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="execution-lock">
            <ShieldCheck />
            <div>
              <strong>Aprovação segura (Human-in-the-loop)</strong>
              <span>A aprovação humana apenas libera o próximo estágio operacional interno. Nenhuma ação externa é publicada sem autorização explícita.</span>
            </div>
          </div>

          {selected.status === "pending" ? (
            <div className="decision-box">
              <label>
                Observação ou instrução técnica
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Opcional para aprovação; recomendado para orientar ajustes ou justificar rejeição."
                />
              </label>
              <div className="decision-actions">
                <Button variant="outline" onClick={() => void decide("rejected")} disabled={deciding}>
                  <XCircle /> Rejeitar
                </Button>
                <Button variant="outline" onClick={() => void decide("changes_requested")} disabled={deciding}>
                  <RotateCcw /> Solicitar ajustes
                </Button>
                <Button onClick={() => void decide("approved")} disabled={deciding} className="btn-approve-hero">
                  <CheckCircle2 /> {selected.source_type === "tracking_publication" ? "Aprovar publicação" : selected.source_type === "tracking_deployment" ? "Aprovar plano" : selected.source_type?.startsWith("local_seo") ? "Aprovar publicação SEO" : "Aprovar rascunho"}
                </Button>
              </div>
            </div>
          ) : selected.decision_note ? (
            <div className="decision-note">
              <strong>Observação registrada</strong>
              <span>{selected.decision_note}</span>
            </div>
          ) : null}
        </>}
      </article>
    </section></> : null}
  </div>;
}
