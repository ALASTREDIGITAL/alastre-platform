"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, FileCheck2, MapPin, RefreshCw, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IntegrationState } from "@/components/platform-state";
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

export function ApprovalsModule() {
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
      <div><div className="eyebrow"><ShieldCheck /> HUMAN-IN-THE-LOOP</div><h1>Central de Aprovações</h1><p>Revise decisões preparadas pela IA antes que qualquer ação avance para execução.</p></div>
      <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw /> Atualizar</Button>
    </div>
    {unavailable ? <IntegrationState compact message="A fila de aprovações será exibida quando a integração estiver conectada. Nenhuma decisão foi alterada." onRetry={() => void load()} /> : null}
    <section className="approval-summary">
      <article><Clock3 /><div><strong>{pending}</strong><span>Pendentes</span></div></article>
      <article><CheckCircle2 /><div><strong>{items.filter((item) => item.status === "approved").length}</strong><span>Aprovadas</span></div></article>
      <article><RotateCcw /><div><strong>{items.filter((item) => item.status === "changes_requested").length}</strong><span>Com ajustes</span></div></article>
    </section>
    <section className="approval-layout">
      <div className="approval-queue">
        <div className="queue-heading"><span className="section-kicker">FILA</span><Badge variant="outline">{items.length} item(ns)</Badge></div>
        {loading ? <div className="queue-empty">Carregando aprovações...</div> : items.length === 0 ? <div className="queue-empty">Nenhuma aprovação registrada.</div> : items.map((item) =>
          <button type="button" key={item.id} className={`queue-item${selected?.id === item.id ? " selected" : ""}`} onClick={() => { setSelected(item); setNote(""); }}>
            <span className="queue-icon"><FileCheck2 /></span>
            <div><strong>{item.snapshot.name ?? "Campanha Google Ads"}</strong><span>{item.clients?.name ?? "Cliente"} · {new Date(item.created_at).toLocaleDateString("pt-BR")}</span></div>
            <Badge variant="outline" className={`approval-status status-${item.status}`}>{statusLabel[item.status]}</Badge>
          </button>)}
      </div>
      <article className="approval-detail">
        {!selected ? <div className="queue-empty">Selecione um item da fila.</div> : <>
          <div className="detail-heading"><div><span className="section-kicker">{selected.source_type?.startsWith("local_seo")?"SEO LOCAL · APROVAÇÃO":selected.source_type==="tracking_publication"?"GTM E GA4 · PUBLICAÇÃO":selected.source_type==="tracking_deployment"?"GTM E GA4 · PLANO":"GOOGLE ADS · CAMPANHA"}</span><h2>{selected.snapshot.name}</h2></div><Badge className={`approval-status status-${selected.status}`}>{statusLabel[selected.status]}</Badge></div>
          {selected.source_type==="tracking_publication"?<><div className="detail-grid"><div><span>Cliente</span><strong>{selected.clients?.name??"Cliente"}</strong></div><div><span>Domínio</span><strong>{selected.snapshot.domain}</strong></div><div><span>Versão exata</span><strong>{selected.snapshot.version_path}</strong></div><div><span>Hash protegido</span><strong>{selected.snapshot.config_hash?.slice(0,16)}</strong></div></div></>:selected.source_type==="tracking_deployment"?<><div className="detail-grid"><div><span>Cliente</span><strong>{selected.clients?.name??"Cliente"}</strong></div><div><span>Domínio</span><strong>{selected.snapshot.domain}</strong></div><div><span>Plataforma</span><strong>{selected.snapshot.platform}</strong></div><div><span>Decisão</span><strong>{selected.snapshot.decision?.replaceAll("_"," ")}</strong></div></div><div className="detail-block"><h3>Alterações planejadas</h3><div className="tracking-actions">{selected.snapshot.plan?.actions?.map((action,index)=><div key={`${action.target}-${index}`}><span>{action.target.replaceAll("_"," ")}</span><strong>{action.operation.replaceAll("_"," ")}{typeof action.count==="number"?` · ${action.count}`:""}</strong></div>)}</div></div><div className="detail-block"><h3>Eventos previstos</h3><div className="approval-keywords">{selected.snapshot.plan?.desired_events?.map(event=><span key={event}>{event}</span>)}</div></div></>:<><div className="detail-grid">
            <div><span>Cliente</span><strong>{selected.clients?.name ?? "Cliente"}</strong></div>
            <div><span>Orçamento diário</span><strong>R$ {Number(selected.snapshot.daily_budget).toFixed(2).replace(".", ",")}</strong></div>
            <div><span>Objetivo</span><strong>{config?.objective ?? "Solicitações de orçamento"}</strong></div>
            <div><span>Conversão</span><strong>{config?.conversion ?? "form_submit_success"}</strong></div>
          </div>
          <div className="detail-block"><h3><MapPin /> Cidades</h3><div className="detail-chips">{config?.cities?.map((city) => <span key={city}>{city}</span>)}</div></div>
          <div className="detail-block"><h3>Palavras-chave revisadas</h3><div className="approval-keywords">{config?.keywords?.map((keyword) => <span key={keyword}>{keyword}</span>)}</div></div>
          </>}
          <div className="execution-lock"><ShieldCheck /><div><strong>Aprovação não publica a campanha</strong><span>Ela apenas libera o próximo estágio controlado. A execução externa continua bloqueada.</span></div></div>
          {selected.status === "pending" ? <div className="decision-box">
            <label>Observação da decisão<Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Opcional para aprovação; recomendado para ajustes ou rejeição." /></label>
            <div className="decision-actions">
              <Button variant="outline" onClick={() => void decide("rejected")} disabled={deciding}><XCircle /> Rejeitar</Button>
              <Button variant="outline" onClick={() => void decide("changes_requested")} disabled={deciding}><RotateCcw /> Solicitar ajustes</Button>
              <Button onClick={() => void decide("approved")} disabled={deciding}><CheckCircle2 /> {selected.source_type==="tracking_publication"?"Aprovar publicação":selected.source_type==="tracking_deployment"?"Aprovar plano":"Aprovar rascunho"}</Button>
            </div>
          </div> : selected.decision_note ? <div className="decision-note"><strong>Observação registrada</strong><span>{selected.decision_note}</span></div> : null}
        </>}
      </article>
    </section>
  </div>;
}
