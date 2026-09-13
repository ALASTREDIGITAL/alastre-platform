"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Bot, Check, CheckCircle2, CircleDollarSign, Clock3, Gauge,
  MapPin, Search, Send, ShieldCheck, Sparkles, Target, TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DecisionState, IntegrationState } from "@/components/platform-state";
import { isArrayOf, isRecord, isRequestCancelled, isString, postGoogleAds, postPlatform } from "@/lib/platform-api";
import { isClientSummaryArray, type ClientSummary } from "./clients-module";

const defaultCities = ["Indaiatuba", "Salto", "Itu", "Porto Feliz"];
const defaultKeywords = [
  "dedetizadora em indaiatuba",
  "dedetização residencial",
  "controle de pragas",
  "descupinização",
  "dedetização de baratas",
  "controle de escorpião",
];
const isApprovalSummary=(value:unknown):value is {status:string}=>isRecord(value)&&isString(value.status);
const isApprovalList=isArrayOf(isApprovalSummary);

export function GoogleAdsModule({ clientId, onSelectClient, onBack, onOpenConnections }: { clientId:string; onSelectClient:(id:string)=>void; onBack: () => void; onOpenConnections?:()=>void }) {
  const commandKey = useRef(crypto.randomUUID());
  const [clients,setClients]=useState<ClientSummary[]>([]);
  const [tab, setTab] = useState<"analysis" | "builder">("analysis");
  const [budget, setBudget] = useState("42,85");
  const [selectedCities, setSelectedCities] = useState(defaultCities);
  const [approvalState, setApprovalState] = useState<"draft" | "saving" | "queued" | "error">("draft");
  const [savedApprovals, setSavedApprovals] = useState(0);
  const [unavailable,setUnavailable]=useState(false);
  const [loadingClients,setLoadingClients]=useState(true);

  useEffect(() => {
    const controller=new AbortController();
    void postGoogleAds({action:"list"},isApprovalList,controller.signal).then(items=>{if(!controller.signal.aborted)setSavedApprovals(items.filter(item=>item.status==="pending").length)}).catch(error=>{if(!isRequestCancelled(error))setUnavailable(true)});
    return()=>{controller.abort()};
  }, []);

  const loadClients=useCallback(async(signal?:AbortSignal)=>{setLoadingClients(true);setUnavailable(false);try{const items=await postPlatform({action:"clients"},isClientSummaryArray,signal);if(signal?.aborted)return;setClients(items);const client=items.find(item=>item.id===clientId);const data=client?.dna?.business_data??{};const values=Array.isArray(data.cities)?data.cities.map(String).filter(Boolean):data.city?[String(data.city)]:[];setSelectedCities(values.length?values:clientId==="b10a1a00-0000-4000-8000-000000000001"?defaultCities:[])}catch(error){if(isRequestCancelled(error))return;setClients([]);setUnavailable(true)}finally{if(!signal?.aborted)setLoadingClients(false)}},[clientId]);
  useEffect(()=>{const controller=new AbortController();const timer=window.setTimeout(()=>void loadClients(controller.signal),0);return()=>{window.clearTimeout(timer);controller.abort()}},[loadClients]);
  const activeClient=clients.find(client=>client.id===clientId);
  const business=activeClient?.dna?.business_data??{};
  const clientName=activeClient?.name??"Cliente";
  const segment=String(business.segment??"serviço local");
  const keywords=useMemo(()=>clientId==="b10a1a00-0000-4000-8000-000000000001"?defaultKeywords:[`${segment} em ${selectedCities[0]??"cidade"}`,`${segment} perto de mim`,`${segment} orçamento`,`${clientName} contato`],[clientId,clientName,segment,selectedCities]);

  const weeklyBudget = useMemo(() => {
    const daily = Number(budget.replace(",", ".")) || 0;
    return (daily * 7).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }, [budget]);

  function toggleCity(city: string) {
    setSelectedCities((current) =>
      current.includes(city) ? current.filter((item) => item !== city) : [...current, city],
    );
  }

  async function submitForApproval() {
    if(!activeClient){setApprovalState("error");return}
    setApprovalState("saving");
    try {
      await postGoogleAds({
        action: "submit",
        client_id: clientId,
        idempotency_key: commandKey.current,
        daily_budget: Number(budget.replace(",", ".")),
        configuration: {
          objective: "Gerar solicitações de orçamento",
          cities: selectedCities,
          keywords,
          match_types: ["phrase", "exact"],
          conversion: "form_submit_success",
          secondary_conversions: ["whatsapp_click", "phone_click"],
          display_network: false,
          search_partners: false,
          write_mode: "simulation",
        },
      },isRecord);
      setSavedApprovals((value) => value + 1);
      setApprovalState("queued");
      commandKey.current = crypto.randomUUID();
    } catch { setApprovalState("error"); setUnavailable(true); }
  }

  return (
    <div className="ads-page">
      <div className="ads-titlebar">
        <div>
          <button type="button" className="back-link" onClick={onBack}><ArrowLeft /> Visão geral</button>
          <div className="eyebrow"><Sparkles /> GOOGLE ADS · COPILOTO IA</div>
          <h1>Operação {clientName}</h1>
          <p>Analise a oportunidade e monte campanhas com o DNA comercial do cliente aplicado automaticamente.</p>
        </div>
        <div className="ads-title-actions"><select aria-label="Cliente da operação" value={activeClient?clientId:""} onChange={event=>onSelectClient(event.target.value)} disabled={clients.length===0}>{clients.length?<>{clients.map(client=><option key={client.id} value={client.id}>{client.name}</option>)}</>:<option value="">Nenhum cliente disponível</option>}</select><div className="ads-mode"><ShieldCheck /><div><strong>Modo simulação</strong><span>Nenhuma alteração será publicada</span></div></div></div>
      </div>

      {unavailable?<IntegrationState compact message="Conecte o Google Ads para consultar dados reais e preparar campanhas para aprovação." onRetry={()=>void loadClients()}/>:loadingClients?<DecisionState title="Carregando Google Ads" message="Estamos verificando clientes e conexões disponíveis."/>:!activeClient?<DecisionState icon={Search} title="Selecione um cliente para começar." message="O painel só aparece depois que houver um cliente válido e uma conexão disponível." actionLabel={onOpenConnections?"Configurar Google Ads":undefined} onAction={onOpenConnections}/>:null}

      {!unavailable&&!loadingClients&&activeClient?<><div className="demo-data-state"><Badge variant="outline">MODO DEMONSTRAÇÃO</Badge><span>Dados de exemplo para revisar o fluxo. Não representam uma conta Google Ads conectada.</span></div><section className="ads-metrics" aria-label="Resumo Google Ads de demonstração">
        <article><span className="metric-icon purple"><Gauge /></span><div><small>SAÚDE DA CONTA</small><strong>87<span>/100</span></strong><em>Boa estrutura</em></div></article>
        <article><span className="metric-icon green"><Target /></span><div><small>CONVERSÃO PRINCIPAL</small><strong className="metric-text">Formulário</strong><em>Configurada</em></div></article>
        <article><span className="metric-icon amber"><CircleDollarSign /></span><div><small>ORÇAMENTO</small><strong className="metric-text">R$ 42,85/dia</strong><em>R$ 300 por semana</em></div></article>
        <article><span className="metric-icon blue"><MapPin /></span><div><small>COBERTURA</small><strong>4<span> cidades</span></strong><em>Presença física</em></div></article>
      </section>

      <div className="ads-tabs" role="tablist">
        <button type="button" className={tab === "analysis" ? "active" : ""} onClick={() => setTab("analysis")}><Bot /> Análise da IA</button>
        <button type="button" className={tab === "builder" ? "active" : ""} onClick={() => setTab("builder")}><Search /> Criar campanha</button>
      </div>

      {tab === "analysis" ? (
        <section className="analysis-layout">
          <article className="ads-panel ai-analysis">
            <div className="panel-heading">
              <div><span className="section-kicker">DIAGNÓSTICO AUTOMÁTICO</span><h2>O que a IA encontrou</h2></div>
              <Badge variant="outline">DADOS DE EXEMPLO</Badge>
            </div>
            <div className="ai-hero">
              <div className="score-ring"><strong>87</strong><span>de 100</span></div>
              <div><Badge><Sparkles /> Análise concluída</Badge><h3>A campanha está bem direcionada para clientes residenciais.</h3><p>A estrutura respeita o orçamento e evita tráfego de empresas e condomínios. Há três oportunidades de melhoria antes da próxima otimização.</p></div>
            </div>
            <div className="insight-list">
              <div className="insight positive"><CheckCircle2 /><div><strong>Segmentação coerente</strong><span>Indaiatuba, Salto, Itu e Porto Feliz estão configuradas por presença física.</span></div><Badge>Validado</Badge></div>
              <div className="insight opportunity"><TrendingUp /><div><strong>Expandir termos de alta intenção</strong><span>Adicionar variações locais para descupinização e controle de escorpiões.</span></div><Badge variant="outline">Oportunidade</Badge></div>
              <div className="insight guarded"><ShieldCheck /><div><strong>Proteção de orçamento ativa</strong><span>Correspondência ampla, Display e parceiros de pesquisa permanecem desligados.</span></div><Badge variant="outline">Protegido</Badge></div>
            </div>
            <Button onClick={() => setTab("builder")} className="analysis-cta"><Search /> Montar campanha com estas recomendações</Button>
          </article>

          <aside className="ads-panel rule-panel">
            <span className="section-kicker">DNA APLICADO</span><h2>Regras do cliente</h2>
            <div className="rule-list">
              <div><Check /> Foco exclusivo em residências</div>
              <div><Check /> Excluir empresas e condomínios</div>
              <div><Check /> Frase e exata, sem ampla</div>
              <div><Check /> Domingo pausado</div>
              <div><Check /> WhatsApp e telefone secundários</div>
            </div>
            <div className="schedule-card"><Clock3 /><div><strong>Programação</strong><span>Seg–sex · 6h às 21h<br />Sábado · 7h às 18h</span></div></div>
          </aside>
        </section>
      ) : (
        <section className="builder-layout">
          <article className="ads-panel campaign-builder">
            <div className="panel-heading">
              <div><span className="section-kicker">NOVA CAMPANHA</span><h2>Pesquisa · {clientName}</h2></div>
              <Badge variant="outline">{approvalState === "queued" ? "Salva no Supabase" : approvalState === "saving" ? "Salvando..." : "Rascunho"}</Badge>
            </div>
            <div className="builder-steps">
              {["Estratégia", "Segmentação", "Palavras-chave", "Revisão"].map((step, index) => <div className="step done" key={step}><span>{index < 3 ? <Check /> : 4}</span><small>{step}</small></div>)}
            </div>
            <div className="form-section">
              <div className="form-heading"><span>01</span><div><strong>Estratégia e orçamento</strong><small>Definições principais da campanha</small></div></div>
              <div className="form-grid">
                <label>Objetivo<input value="Gerar solicitações de orçamento" readOnly /></label>
                <label>Orçamento diário<div className="money-input"><span>R$</span><input value={budget} onChange={(event) => setBudget(event.target.value)} inputMode="decimal" /></div><small>Estimativa semanal: {weeklyBudget}</small></label>
              </div>
            </div>
            <div className="form-section">
              <div className="form-heading"><span>02</span><div><strong>Cidades atendidas</strong><small>Segmentação por presença física</small></div></div>
              <div className="city-options">
                {selectedCities.map((city) => <button type="button" key={city} className="selected" onClick={() => toggleCity(city)}><span><Check /></span>{city}</button>)}
              </div>
            </div>
            <div className="form-section">
              <div className="form-heading"><span>03</span><div><strong>Palavras-chave sugeridas pela IA</strong><small>Somente correspondência de frase e exata</small></div></div>
              <div className="keyword-list">{keywords.map((keyword, index) => <div key={keyword}><span>{keyword}</span><Badge variant="outline">{index % 2 ? "Exata" : "Frase"}</Badge></div>)}</div>
            </div>
          </article>
          <aside className="ads-panel review-panel">
            <span className="section-kicker">REVISÃO · {savedApprovals} PENDENTE(S)</span><h2>Pronta para aprovação</h2>
            <div className="review-score"><div><strong>94%</strong><span>Aderência ao DNA</span></div><Progress value={94} /></div>
            <dl>
              <div><dt>Tipo</dt><dd>Pesquisa</dd></div><div><dt>Cidades</dt><dd>{selectedCities.length}</dd></div>
              <div><dt>Palavras-chave</dt><dd>{keywords.length}</dd></div><div><dt>Orçamento/dia</dt><dd>R$ {budget}</dd></div>
              <div><dt>Conversão</dt><dd>Formulário</dd></div>
            </dl>
            <div className="safety-note"><ShieldCheck /><span>A campanha ficará em rascunho. Nenhum anúncio ou orçamento será ativado.</span></div>
            <Button className="approval-button" disabled={approvalState === "queued" || approvalState === "saving" || selectedCities.length === 0 || !activeClient || unavailable} onClick={submitForApproval}>
              {approvalState === "queued" ? <><CheckCircle2 /> Salva no Supabase</> : approvalState === "saving" ? <><Clock3 /> Salvando...</> : <><Send /> Enviar para aprovação</>}
            </Button>
            {approvalState === "queued" && <p className="approval-success">Rascunho persistido com sucesso. Você pode fechar a página sem perder esta aprovação.</p>}
            {approvalState === "error" && <p className="approval-error">Não foi possível salvar. Revise a conexão e tente novamente.</p>}
          </aside>
        </section>
      )}</> : null}
    </div>
  );
}
