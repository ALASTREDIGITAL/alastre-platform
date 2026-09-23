"use client";
import {useState} from "react";
import {AlertTriangle,ArrowRight,Bot,CalendarDays,CheckCircle2,ChevronRight,ExternalLink,Eye,FileEdit,Filter,Globe,LayoutGrid,Lightbulb,Link2Off,List,MessageSquareText,Plus,Search,Share2,ShieldCheck,Sparkles,Star,Store,Tag,Ticket,Users} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import type {LocalSeoSection} from "@/lib/local-seo-types";
import {getReviewSentiment} from "@/lib/local-seo-types";
import {postLocalSeo} from "@/lib/local-seo-api";
import {validateGbpPostContent} from "@/lib/local-seo-domain";

type SeoRow=Record<string,unknown>&{id?:string;status?:string;theme?:string;title?:string;review_text?:string;body?:string;review_id?:string;post_type?:string;cta_action?:string};
function OperationMessage({value}:{value:string}){return value?<p className="operation-message" role="status">{value}</p>:null}

export function DataLegend(){return <div className="data-legend"><span><i className="real"/>Dado real</span><span><i className="derived"/>Derivado do DNA</span><span><i className="missing"/>Indisponível</span></div>}
export function DailySeoQueue(){return <section className="panel daily-queue"><div className="panel-heading"><div><span className="section-kicker">ATENÇÃO HOJE</span><h2>Fila de trabalho SEO Local</h2></div><Filter/></div><div className="queue-toolbar"><button className="is-active">Todos os clientes</button><button>Prioridade</button><button>Tipo</button><button>Status</button></div><div className="queue-zero"><Search/><div><strong>Nenhuma tarefa calculada</strong><p>A fila consolidará avaliações, postagens, oportunidades, ranking, perfil e aprovações de toda a carteira.</p></div></div><div className="queue-types"><span><MessageSquareText/>Avaliações <b>—</b></span><span><CalendarDays/>Conteúdos <b>—</b></span><span><Lightbulb/>Oportunidades <b>—</b></span><span><CheckCircle2/>Aprovações <b>—</b></span></div></section>}

const postStages=["Ideia","Rascunho","Revisão","Aguardando aprovação","Aprovado","Pronto para publicação"];
const ctaLabels:Record<string,string>={NONE:"Sem botão de ação",LEARN_MORE:"Saiba mais",CALL:"Ligar agora",BOOK:"Agendar",ORDER:"Fazer pedido",SHOP:"Comprar",SIGN_UP:"Cadastre-se"};

export function PostOperations({clientId,clientName,canCreate,rows=[],onChanged}:{clientId?:string;clientName?:string;canCreate:boolean;rows?:SeoRow[];onChanged?:()=>void}){
  const [creating,setCreating]=useState(false);
  const [creationMode,setCreationMode]=useState<"manual"|"ai">("manual");
  const [view,setView]=useState<"list"|"calendar">("list");
  const [postType,setPostType]=useState<"standard"|"offer"|"event">("standard");
  const [theme,setTheme]=useState("");
  const [objective,setObjective]=useState("SEO Local");
  const [body,setBody]=useState("");
  const [ctaAction,setCtaAction]=useState<string>("NONE");
  const [ctaUrl,setCtaUrl]=useState("");
  const [channels,setChannels]=useState<string[]>(["gbp"]);
  const [offerTitle,setOfferTitle]=useState("");
  const [couponCode,setCouponCode]=useState("");
  const [offerTerms,setOfferTerms]=useState("");
  const [eventTitle,setEventTitle]=useState("");
  const [startDate,setStartDate]=useState("");
  const [endDate,setEndDate]=useState("");
  const [previewTab,setPreviewTab]=useState<"gbp"|"social">("gbp");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  const compliance=validateGbpPostContent(body);

  function toggleChannel(ch:string){
    setChannels((prev)=>prev.includes(ch)?(prev.length>1?prev.filter((c)=>c!==ch):prev):[...prev,ch]);
  }

  async function generate(){
    if(!clientId||!theme.trim())return;
    setBusy(true);
    setMessage("");
    try{
      const result=await postLocalSeo({action:"local_seo_post_generate",client_id:clientId,payload:{theme,objective}});
      setBody(String(result.text??""));
      setMessage("Sugestão gerada com IA. Revise antes de salvar.");
    }catch(error){
      setMessage(error instanceof Error?error.message:"Não foi possível gerar a sugestão.");
    }finally{
      setBusy(false);
    }
  }

  async function save(){
    if(!clientId)return;
    setBusy(true);
    setMessage("");
    try{
      await postLocalSeo({
        action:"local_seo_post_save",
        client_id:clientId,
        payload:{
          theme,
          objective,
          body,
          post_type:postType,
          cta_action:ctaAction as any,
          cta_url:ctaUrl||undefined,
          channels:channels as any,
          offer_title:postType==="offer"?offerTitle||undefined:undefined,
          coupon_code:postType==="offer"?couponCode||undefined:undefined,
          offer_terms:postType==="offer"?offerTerms||undefined:undefined,
          event_title:postType==="event"?eventTitle||undefined:undefined,
          start_date:startDate||undefined,
          end_date:endDate||undefined,
          related_keywords:[],
          origin:creationMode==="ai"?"agent":"human"
        }
      });
      setCreating(false);
      setTheme("");
      setBody("");
      setCtaAction("NONE");
      setCtaUrl("");
      setOfferTitle("");
      setCouponCode("");
      setOfferTerms("");
      setEventTitle("");
      setStartDate("");
      setEndDate("");
      setMessage("Rascunho salvo com sucesso.");
      onChanged?.();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Não foi possível salvar.");
    }finally{
      setBusy(false);
    }
  }

  async function approval(row:SeoRow){
    if(!clientId||!row.id)return;
    setBusy(true);
    try{
      await postLocalSeo({action:"local_seo_post_transition",client_id:clientId,id:row.id,status:"waiting_approval"});
      setMessage("Enviado para aprovação, sem publicação externa.");
      onChanged?.();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Operação indisponível.");
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="seo-operation">
      <section className="operation-head">
        <div>
          <span className="section-kicker">PLANEJAMENTO EDITORIAL & MULTICANAL</span>
          <h2>Postagens do Google e Redes Sociais</h2>
          <p>Criação, regras de conformidade do Google e esteira de aprovação sem publicação direta.</p>
        </div>
        <div className="operation-actions">
          <Button variant="outline" disabled><Sparkles/>Planejar mês com IA</Button>
          <Button onClick={()=>setCreating(true)} disabled={!canCreate}><Plus/>Nova postagem</Button>
        </div>
      </section>

      <div className="editorial-summary">
        {[
          {label:"Atualizações",count:rows.filter((r)=>!r.post_type||r.post_type==="standard").length},
          {label:"Ofertas",count:rows.filter((r)=>r.post_type==="offer").length},
          {label:"Eventos",count:rows.filter((r)=>r.post_type==="event").length},
          {label:"Aguardando aprovação",count:rows.filter((r)=>r.status==="waiting_approval").length},
          {label:"Prontas",count:rows.filter((r)=>r.status==="ready_to_publish").length}
        ].map((item)=>(
          <div key={item.label}>
            <strong>{item.count>0?item.count:"0"}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="view-switch">
        <button className={view==="list"?"is-active":""} onClick={()=>setView("list")}><List/>Lista</button>
        <button className={view==="calendar"?"is-active":""} onClick={()=>setView("calendar")}><LayoutGrid/>Calendário</button>
      </div>

      <OperationMessage value={message}/>

      {creating&&(
        <section className="panel post-editor" style={{display:"grid",gap:"1.25rem"}}>
          <div className="editor-head">
            <div>
              <span className="section-kicker">NOVA POSTAGEM · {clientName}</span>
              <h2>Editor Estratégico de Postagem</h2>
            </div>
            <span><ShieldCheck/>Somente interno</span>
          </div>

          <div style={{display:"flex",gap:"0.75rem",flexWrap:"wrap",alignItems:"center"}}>
            <div className="creation-mode" style={{margin:0}}>
              <button type="button" className={creationMode==="ai"?"active":""} onClick={()=>setCreationMode("ai")}><Sparkles/>Gerar com IA</button>
              <button type="button" className={creationMode==="manual"?"active":""} onClick={()=>setCreationMode("manual")}><FileEdit/>Criar manualmente</button>
            </div>

            <div style={{display:"flex",gap:"0.4rem",alignItems:"center",marginLeft:"auto"}}>
              <span style={{fontSize:"0.8125rem",color:"var(--content-secondary)"}}>Canais:</span>
              <button type="button" onClick={()=>toggleChannel("gbp")} className={`readiness-pill ${channels.includes("gbp")?"ready":"missing"}`} style={{cursor:"pointer",padding:"0.25rem 0.6rem"}}>
                <Store style={{width:14,height:14}}/> Google
              </button>
              <button type="button" onClick={()=>toggleChannel("instagram")} className={`readiness-pill ${channels.includes("instagram")?"ready":"missing"}`} style={{cursor:"pointer",padding:"0.25rem 0.6rem"}}>
                <Share2 style={{width:14,height:14}}/> Instagram
              </button>
              <button type="button" onClick={()=>toggleChannel("facebook")} className={`readiness-pill ${channels.includes("facebook")?"ready":"missing"}`} style={{cursor:"pointer",padding:"0.25rem 0.6rem"}}>
                <Globe style={{width:14,height:14}}/> Facebook
              </button>
            </div>
          </div>

          <div style={{display:"flex",gap:"0.5rem",borderBottom:"1px solid var(--line)",paddingBottom:"0.75rem"}}>
            <button
              type="button"
              className={postType==="standard"?"is-active":""}
              onClick={()=>setPostType("standard")}
              style={{
                padding:"0.45rem 0.85rem",
                borderRadius:"0.5rem",
                border:"1px solid var(--line)",
                background:postType==="standard"?"var(--brand-soft)":"transparent",
                color:postType==="standard"?"var(--brand)":"var(--content-primary)",
                fontWeight:postType==="standard"?700:500,
                fontSize:"0.875rem",
                cursor:"pointer",
                display:"inline-flex",
                alignItems:"center",
                gap:"0.4rem"
              }}
            >
              <Store style={{width:14,height:14}}/> Novidade / Atualização
            </button>
            <button
              type="button"
              className={postType==="offer"?"is-active":""}
              onClick={()=>setPostType("offer")}
              style={{
                padding:"0.45rem 0.85rem",
                borderRadius:"0.5rem",
                border:"1px solid var(--line)",
                background:postType==="offer"?"var(--brand-soft)":"transparent",
                color:postType==="offer"?"var(--brand)":"var(--content-primary)",
                fontWeight:postType==="offer"?700:500,
                fontSize:"0.875rem",
                cursor:"pointer",
                display:"inline-flex",
                alignItems:"center",
                gap:"0.4rem"
              }}
            >
              <Tag style={{width:14,height:14}}/> Oferta Especial
            </button>
            <button
              type="button"
              className={postType==="event"?"is-active":""}
              onClick={()=>setPostType("event")}
              style={{
                padding:"0.45rem 0.85rem",
                borderRadius:"0.5rem",
                border:"1px solid var(--line)",
                background:postType==="event"?"var(--brand-soft)":"transparent",
                color:postType==="event"?"var(--brand)":"var(--content-primary)",
                fontWeight:postType==="event"?700:500,
                fontSize:"0.875rem",
                cursor:"pointer",
                display:"inline-flex",
                alignItems:"center",
                gap:"0.4rem"
              }}
            >
              <Ticket style={{width:14,height:14}}/> Evento
            </button>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"minmax(0, 1fr) 340px",gap:"1.25rem",alignItems:"start"}}>
            <div className="post-form" style={{display:"grid",gap:"0.85rem"}}>
              {postType==="offer"&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem",padding:"0.75rem",borderRadius:"0.5rem",background:"var(--surface-2)"}}>
                  <label style={{gridColumn:"1 / -1"}}>
                    Título da Oferta *
                    <Input value={offerTitle} onChange={(e)=>setOfferTitle(e.target.value)} placeholder="Ex.: 20% OFF na Primeira Limpeza Dental"/>
                  </label>
                  <label>
                    Código do Cupom (opcional)
                    <Input value={couponCode} onChange={(e)=>setCouponCode(e.target.value)} placeholder="Ex.: PROMO20"/>
                  </label>
                  <label>
                    Termos & Condições
                    <Input value={offerTerms} onChange={(e)=>setOfferTerms(e.target.value)} placeholder="Ex.: Válido de seg a sex"/>
                  </label>
                  <label>
                    Início da Oferta
                    <Input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)}/>
                  </label>
                  <label>
                    Fim da Oferta
                    <Input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)}/>
                  </label>
                </div>
              )}

              {postType==="event"&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem",padding:"0.75rem",borderRadius:"0.5rem",background:"var(--surface-2)"}}>
                  <label style={{gridColumn:"1 / -1"}}>
                    Título do Evento *
                    <Input value={eventTitle} onChange={(e)=>setEventTitle(e.target.value)} placeholder="Ex.: Workshop de Clareamento Dental ao Vivo"/>
                  </label>
                  <label>
                    Data de Início
                    <Input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)}/>
                  </label>
                  <label>
                    Data de Término
                    <Input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)}/>
                  </label>
                </div>
              )}

              <div style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:"0.75rem"}}>
                <label>
                  Objetivo
                  <select value={objective} onChange={(e)=>setObjective(e.target.value)}>
                    {["SEO Local","Oferta","Autoridade","Informativo","Prova social","Produto/serviço","Institucional","Sazonal"].map((item)=>(
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Tema do Conteúdo
                  <Input value={theme} onChange={(e)=>setTheme(e.target.value)} placeholder="Ex.: Cuidados preventivos no inverno em Campinas"/>
                </label>
              </div>

              <label className="wide">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.25rem"}}>
                  <span>Texto da Mensagem</span>
                  <div style={{display:"flex",gap:"0.4rem",alignItems:"center",fontSize:"0.75rem"}}>
                    <span style={{color:compliance.idealLength?"var(--success)":compliance.length>300?"var(--warning)":"var(--content-secondary)",fontWeight:600}}>
                      {compliance.length}/1500 caracteres
                    </span>
                    {compliance.idealLength&&(
                      <span style={{color:"var(--success)",display:"inline-flex",alignItems:"center",gap:"0.2rem"}}>
                        <CheckCircle2 style={{width:12,height:12}}/> Faixa ideal Google (150-300)
                      </span>
                    )}
                  </div>
                </div>
                <Textarea
                  rows={5}
                  value={body}
                  onChange={(e)=>setBody(e.target.value)}
                  placeholder={creationMode==="ai"?"A sugestão gerada pela IA será editável e usará apenas o DNA confirmado.":"Use fatos e diferenciais confirmados no DNA do cliente."}
                />
              </label>

              {compliance.warnings.length>0&&(
                <div style={{padding:"0.6rem 0.85rem",borderRadius:"0.5rem",background:"color-mix(in srgb, var(--warning) 15%, transparent)",border:"1px solid var(--warning)",display:"flex",gap:"0.5rem",alignItems:"flex-start",fontSize:"0.8125rem",color:"var(--content-primary)"}}>
                  <AlertTriangle style={{width:16,height:16,color:"var(--warning)",flexShrink:0,marginTop:2}}/>
                  <div>
                    {compliance.warnings.map((w,idx)=>(
                      <p key={idx} style={{margin:"0 0 0.25rem 0"}}>{w}</p>
                    ))}
                  </div>
                </div>
              )}

              <div style={{display:"grid",gridTemplateColumns:ctaAction!=="NONE"&&ctaAction!=="CALL"?"180px 1fr":"1fr",gap:"0.75rem",padding:"0.75rem",borderRadius:"0.5rem",background:"var(--surface-2)"}}>
                <label>
                  Botão de Ação (CTA)
                  <select value={ctaAction} onChange={(e)=>setCtaAction(e.target.value)}>
                    {Object.entries(ctaLabels).map(([actKey,actLabel])=>(
                      <option key={actKey} value={actKey}>
                        {actLabel}
                      </option>
                    ))}
                  </select>
                </label>
                {ctaAction!=="NONE"&&ctaAction!=="CALL"&&(
                  <label>
                    Link de Destino (URL) *
                    <Input value={ctaUrl} onChange={(e)=>setCtaUrl(e.target.value)} placeholder="https://seusite.com.br/contato"/>
                  </label>
                )}
              </div>
            </div>

            <div style={{border:"1px solid var(--line)",borderRadius:"0.75rem",background:"var(--surface-1)",padding:"1rem",boxShadow:"var(--shadow-xs)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem",borderBottom:"1px solid var(--line)",paddingBottom:"0.5rem"}}>
                <span style={{fontSize:"0.75rem",fontWeight:700,color:"var(--content-secondary)",textTransform:"uppercase",letterSpacing:"0.05em"}}>
                  Pré-visualização
                </span>
                <div style={{display:"flex",gap:"0.25rem"}}>
                  <button
                    type="button"
                    onClick={()=>setPreviewTab("gbp")}
                    style={{
                      fontSize:"0.75rem",
                      padding:"0.2rem 0.5rem",
                      borderRadius:"0.375rem",
                      border:"none",
                      background:previewTab==="gbp"?"var(--brand)":"transparent",
                      color:previewTab==="gbp"?"#fff":"var(--content-secondary)",
                      cursor:"pointer",
                      fontWeight:600
                    }}
                  >
                    Google Maps
                  </button>
                  <button
                    type="button"
                    onClick={()=>setPreviewTab("social")}
                    style={{
                      fontSize:"0.75rem",
                      padding:"0.2rem 0.5rem",
                      borderRadius:"0.375rem",
                      border:"none",
                      background:previewTab==="social"?"var(--brand)":"transparent",
                      color:previewTab==="social"?"#fff":"var(--content-secondary)",
                      cursor:"pointer",
                      fontWeight:600
                    }}
                  >
                    Rede Social
                  </button>
                </div>
              </div>

              {previewTab==="gbp"?(
                <div style={{border:"1px solid var(--line)",borderRadius:"0.625rem",overflow:"hidden",background:"#fff",color:"#202124"}}>
                  <div style={{padding:"0.75rem",borderBottom:"1px solid #f1f3f4",display:"flex",alignItems:"center",gap:"0.5rem"}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:"#4285f4",display:"grid",placeItems:"center",color:"#fff"}}>
                      <Store style={{width:15,height:15}}/>
                    </div>
                    <div>
                      <div style={{fontSize:"0.8125rem",fontWeight:700,color:"#202124"}}>{clientName||"Perfil da Empresa"}</div>
                      <div style={{fontSize:"0.6875rem",color:"#70757a"}}>Postagem no Google · Hoje</div>
                    </div>
                  </div>

                  <div style={{height:110,background:"linear-gradient(135deg, #f8f9fa, #e8eaed)",display:"grid",placeItems:"center",color:"#70757a",fontSize:"0.75rem"}}>
                    <div style={{textAlign:"center"}}>
                      <Store style={{width:24,height:24,margin:"0 auto 4px",opacity:0.6}}/>
                      <span>{postType==="offer"?"Mídia da Oferta (4:3)":postType==="event"?"Capa do Evento (4:3)":"Foto do Post (4:3)"}</span>
                    </div>
                  </div>

                  <div style={{padding:"0.75rem"}}>
                    {postType==="offer"&&offerTitle&&(
                      <div style={{marginBottom:"0.4rem"}}>
                        <span style={{display:"inline-block",background:"#e6f4ea",color:"#137333",fontSize:"0.6875rem",fontWeight:700,padding:"2px 6px",borderRadius:4,marginBottom:4}}>
                          OFERTA ESPECIAL
                        </span>
                        <div style={{fontSize:"0.875rem",fontWeight:700,color:"#202124"}}>{offerTitle}</div>
                        {couponCode&&(
                          <div style={{border:"1px dashed #1a73e8",padding:"2px 6px",borderRadius:4,display:"inline-block",fontSize:"0.6875rem",color:"#1a73e8",fontWeight:600,marginTop:4}}>
                            Cupom: {couponCode}
                          </div>
                        )}
                      </div>
                    )}

                    {postType==="event"&&eventTitle&&(
                      <div style={{marginBottom:"0.4rem"}}>
                        <span style={{display:"inline-block",background:"#fef7e0",color:"#b06000",fontSize:"0.6875rem",fontWeight:700,padding:"2px 6px",borderRadius:4,marginBottom:4}}>
                          EVENTO LOCAL
                        </span>
                        <div style={{fontSize:"0.875rem",fontWeight:700,color:"#202124"}}>{eventTitle}</div>
                      </div>
                    )}

                    <p style={{fontSize:"0.8125rem",lineHeight:1.45,color:"#3c4043",margin:"0 0 0.75rem 0",whiteSpace:"pre-line"}}>
                      {body.trim()||"O texto digitado para a postagem será exibido aqui exatamente como os usuários verão no Google Maps e Search."}
                    </p>

                    {ctaAction!=="NONE"&&(
                      <div style={{display:"inline-block",width:"100%",textAlign:"center",padding:"0.45rem",borderRadius:"1.25rem",background:"#1a73e8",color:"#fff",fontSize:"0.8125rem",fontWeight:600}}>
                        {ctaLabels[ctaAction]} {ctaAction==="CALL"?"📞":"↗"}
                      </div>
                    )}
                  </div>
                </div>
              ):(
                <div style={{border:"1px solid var(--line)",borderRadius:"0.625rem",overflow:"hidden",background:"#fff",color:"#262626"}}>
                  <div style={{padding:"0.6rem 0.75rem",display:"flex",alignItems:"center",gap:"0.5rem"}}>
                    <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",display:"grid",placeItems:"center",color:"#fff",fontSize:"0.75rem",fontWeight:700}}>
                      A
                    </div>
                    <span style={{fontSize:"0.8125rem",fontWeight:700}}>{clientName?.toLowerCase().replace(/\s+/g,"_")||"alastre_cliente"}</span>
                  </div>

                  <div style={{aspectRatio:"1/1",background:"linear-gradient(135deg, #fafafa, #f0f0f0)",display:"grid",placeItems:"center",color:"#8e8e8e",fontSize:"0.75rem"}}>
                    <span>Feed Social (1:1 Quadrado)</span>
                  </div>

                  <div style={{padding:"0.75rem",fontSize:"0.8125rem",lineHeight:1.4}}>
                    <p style={{margin:"0 0 0.5rem 0",whiteSpace:"pre-line"}}>
                      <strong>{clientName?.toLowerCase().replace(/\s+/g,"_")||"alastre_cliente"}</strong>{" "}
                      {body.trim()||"Texto da legenda adaptado para Instagram/Facebook com chamada para ação."}
                    </p>
                    <span style={{color:"#00376b",fontSize:"0.75rem"}}>#seolocal #{theme?theme.toLowerCase().replace(/\s+/g,""):"negociolocal"}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="editor-actions">
            {creationMode==="ai"&&(
              <Button variant="outline" onClick={()=>void generate()} disabled={busy||!theme.trim()}>
                <Sparkles/> {busy?"Gerando...":"Gerar sugestão"}
              </Button>
            )}
            <Button variant="outline" onClick={()=>setCreating(false)}>Fechar</Button>
            <Button onClick={()=>void save()} disabled={busy||!theme.trim()||!body.trim()}>
              {busy?"Salvando...":"Salvar rascunho"}
            </Button>
          </div>
        </section>
      )}

      <section className="workflow-strip" aria-label="Fluxo de postagens">
        {postStages.map((stage,index)=>(
          <div key={stage}>
            <span>{index+1}</span>
            <strong>{stage}</strong>
            {index<postStages.length-1&&<ChevronRight/>}
          </div>
        ))}
      </section>

      {rows.length?(
        <section className={`operation-list ${view}`}>
          {rows.map((row)=>(
            <article className="panel" key={row.id}>
              <div>
                <div style={{display:"flex",gap:"0.5rem",alignItems:"center",marginBottom:"0.25rem"}}>
                  {row.post_type==="offer"?(
                    <span className="readiness-pill ready" style={{fontSize:"0.6875rem",padding:"1px 6px"}}>
                      <Tag style={{width:11,height:11}}/> Oferta
                    </span>
                  ):row.post_type==="event"?(
                    <span className="readiness-pill ready" style={{fontSize:"0.6875rem",padding:"1px 6px"}}>
                      <Ticket style={{width:11,height:11}}/> Evento
                    </span>
                  ):(
                    <span className="readiness-pill" style={{fontSize:"0.6875rem",padding:"1px 6px",background:"var(--surface-2)"}}>
                      <Store style={{width:11,height:11}}/> Atualização
                    </span>
                  )}
                  <strong>{row.theme||"Postagem sem tema"}</strong>
                </div>
                <p>{row.body||"Sem texto"}</p>
                {row.cta_action&&row.cta_action!=="NONE"&&(
                  <small style={{color:"var(--brand)",display:"inline-flex",alignItems:"center",gap:"0.25rem",marginTop:"0.25rem"}}>
                    <ExternalLink style={{width:12,height:12}}/> CTA: {ctaLabels[String(row.cta_action)]||String(row.cta_action)}
                  </small>
                )}
              </div>
              <span>{row.status}</span>
              <Button
                variant="outline"
                disabled={busy||!["draft","review"].includes(String(row.status))}
                onClick={()=>void approval(row)}
              >
                Enviar para aprovação
              </Button>
            </article>
          ))}
        </section>
      ):(
        <section className="panel operational-empty">
          <CalendarDays/>
          <div>
            <h3>Nenhuma postagem operacional registrada</h3>
            <p>Crie manualmente ou prepare uma ideia com IA. Nada será publicado automaticamente.</p>
          </div>
        </section>
      )}
    </div>
  );
}

const reviewStages=["Nova","Resposta sugerida","Revisão","Aprovada","Pronta para responder"];
export function ReviewOperations({clientId,rows=[],replies=[],onChanged}:{clientId:string;rows?:SeoRow[];replies?:SeoRow[];onChanged?:()=>void}){
  const [creating,setCreating]=useState(false);
  const [replying,setReplying]=useState<string|null>(null);
  const [rating,setRating]=useState(5);
  const [reviewer,setReviewer]=useState("");
  const [reviewText,setReviewText]=useState("");
  const [replyText,setReplyText]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  async function register(){
    setBusy(true);
    try{
      await postLocalSeo({action:"local_seo_review_register",client_id:clientId,payload:{rating,reviewer_name:reviewer||undefined,review_text:reviewText}});
      setCreating(false);
      setReviewer("");
      setReviewText("");
      setMessage("Avaliação registrada manualmente.");
      onChanged?.();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Não foi possível registrar.");
    }finally{
      setBusy(false);
    }
  }

  async function saveReply(reviewId:string){
    setBusy(true);
    try{
      await postLocalSeo({action:"local_seo_reply_save",client_id:clientId,review_id:reviewId,payload:{body:replyText,origin:"human"}});
      setReplying(null);
      setReplyText("");
      setMessage("Resposta salva como rascunho.");
      onChanged?.();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Não foi possível salvar a resposta.");
    }finally{
      setBusy(false);
    }
  }

  async function approval(reply:SeoRow){
    if(!reply.id)return;
    setBusy(true);
    try{
      await postLocalSeo({action:"local_seo_reply_transition",client_id:clientId,id:reply.id,status:"waiting_approval"});
      setMessage("Resposta enviada para aprovação, sem publicação externa.");
      onChanged?.();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Não foi possível enviar.");
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="seo-operation">
      <section className="operation-head">
        <div>
          <span className="section-kicker">CENTRAL DE AVALIAÇÕES</span>
          <h2>Avaliações</h2>
          <p>Registre avaliações reais manualmente e prepare respostas para aprovação.</p>
        </div>
        <Button onClick={()=>setCreating(true)}><Plus/>Registrar avaliação</Button>
      </section>
      <OperationMessage value={message}/>
      {creating&&(
        <section className="panel post-editor">
          <div className="post-form">
            <label>
              Nota
              <select value={rating} onChange={(e)=>setRating(Number(e.target.value))}>
                {[5,4,3,2,1].map((v)=><option key={v} value={v}>{v} estrelas</option>)}
              </select>
            </label>
            <label>
              Autor
              <Input value={reviewer} onChange={(e)=>setReviewer(e.target.value)} placeholder="Nome informado na avaliação"/>
            </label>
            <label className="wide">
              Avaliação
              <Textarea value={reviewText} onChange={(e)=>setReviewText(e.target.value)} placeholder="Cole o texto real da avaliação"/>
            </label>
          </div>
          <div className="editor-actions">
            <Button variant="outline" onClick={()=>setCreating(false)}>Cancelar</Button>
            <Button onClick={()=>void register()} disabled={busy||!reviewText.trim()}>Registrar manualmente</Button>
          </div>
        </section>
      )}
      <section className="workflow-strip" aria-label="Fluxo de avaliações">
        {reviewStages.map((stage,index)=>(
          <div key={stage}>
            <span>{index+1}</span>
            <strong>{stage}</strong>
            {index<reviewStages.length-1&&<ChevronRight/>}
          </div>
        ))}
      </section>
      {rows.length?(
        <section className="operation-list">
          {rows.map((row)=>{
            const reply=replies.find((item)=>item.review_id===row.id);
            const rowRating=Number(row.rating??5);
            const sentiment=getReviewSentiment(rowRating);
            return (
              <article className="panel" key={row.id}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.25rem"}}>
                    <strong>{String(row.reviewer_name??"Autor não informado")} · {rowRating} estrelas</strong>
                    {sentiment==="positive"?(
                      <span className="readiness-pill ready" style={{fontSize:"0.6875rem",padding:"1px 6px"}}>Positiva</span>
                    ):sentiment==="neutral"?(
                      <span className="readiness-pill" style={{fontSize:"0.6875rem",padding:"1px 6px",background:"var(--surface-2)"}}>Neutra</span>
                    ):(
                      <span className="readiness-pill missing" style={{fontSize:"0.6875rem",padding:"1px 6px"}}>Crítica</span>
                    )}
                  </div>
                  <p>{row.review_text||"Sem texto"}</p>
                  {reply?<p><b>Resposta:</b> {reply.body}</p>:null}
                </div>
                <span>{reply?.status??row.status}</span>
                {reply?(
                  <Button variant="outline" disabled={busy||!["draft","review"].includes(String(reply.status))} onClick={()=>void approval(reply)}>
                    Enviar para aprovação
                  </Button>
                ):replying===row.id?(
                  <div className="review-reply-editor">
                    <Textarea value={replyText} onChange={(e)=>setReplyText(e.target.value)} placeholder="Escreva uma resposta baseada em fatos confirmados"/>
                    <Button onClick={()=>void saveReply(String(row.id))} disabled={busy||!replyText.trim()}>Salvar rascunho</Button>
                  </div>
                ):(
                  <Button variant="outline" onClick={()=>setReplying(String(row.id))}>Preparar resposta</Button>
                )}
              </article>
            );
          })}
        </section>
      ):(
        <section className="panel operational-empty">
          <Star/>
          <div>
            <h3>Nenhuma avaliação registrada</h3>
            <p>Registre uma avaliação real manualmente para operar sem depender da API GBP.</p>
          </div>
          <span className="source-state"><FileEdit/>Fonte manual</span>
        </section>
      )}
    </div>
  );
}

export function ReviewOperationsAi({clientId,rows=[],replies=[],onChanged}:{clientId:string;rows?:SeoRow[];replies?:SeoRow[];onChanged?:()=>void}) {
  const [creating,setCreating]=useState(false);
  const [replying,setReplying]=useState<string|null>(null);
  const [rating,setRating]=useState(5);
  const [reviewer,setReviewer]=useState("");
  const [reviewText,setReviewText]=useState("");
  const [replyText,setReplyText]=useState("");
  const [replyOrigin,setReplyOrigin]=useState<"human"|"agent">("human");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  const activeReview=rows.find((r)=>r.id===replying);
  const activeRating=activeReview?Number(activeReview.rating??5):5;
  const activeSentiment=getReviewSentiment(activeRating);

  async function register(){
    setBusy(true);
    try{
      await postLocalSeo({action:"local_seo_review_register",client_id:clientId,payload:{rating,reviewer_name:reviewer||undefined,review_text:reviewText}});
      setCreating(false);
      setReviewer("");
      setReviewText("");
      setMessage("Avaliação registrada manualmente.");
      onChanged?.();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Não foi possível registrar.");
    }finally{
      setBusy(false);
    }
  }

  async function generate(reviewId:string){
    setBusy(true);
    setMessage("");
    try{
      const result=await postLocalSeo({action:"local_seo_reply_generate",client_id:clientId,review_id:reviewId});
      setReplying(reviewId);
      setReplyText(String(result.text??""));
      setReplyOrigin("agent");
      setMessage("Resposta gerada com IA e adaptada ao sentimento da avaliação. Revise antes de salvar.");
    }catch(error){
      setMessage(error instanceof Error?error.message:"Não foi possível gerar a resposta.");
    }finally{
      setBusy(false);
    }
  }

  async function saveReply(reviewId:string){
    setBusy(true);
    try{
      await postLocalSeo({action:"local_seo_reply_save",client_id:clientId,review_id:reviewId,payload:{body:replyText,origin:replyOrigin}});
      setReplying(null);
      setReplyText("");
      setReplyOrigin("human");
      setMessage("Resposta salva como rascunho.");
      onChanged?.();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Não foi possível salvar a resposta.");
    }finally{
      setBusy(false);
    }
  }

  async function approval(reply:SeoRow){
    if(!reply.id)return;
    setBusy(true);
    try{
      await postLocalSeo({action:"local_seo_reply_transition",client_id:clientId,id:reply.id,status:"waiting_approval"});
      setMessage("Resposta enviada para aprovação, sem publicação externa.");
      onChanged?.();
    }catch(error){
      setMessage(error instanceof Error?error.message:"Não foi possível enviar.");
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="seo-operation">
      <section className="operation-head">
        <div>
          <span className="section-kicker">CENTRAL DE AVALIAÇÕES & REPUTAÇÃO</span>
          <h2>Avaliações do Google</h2>
          <p>Triagem por sentimento, conformidade e geração de respostas estratégicas para aprovação.</p>
        </div>
        <Button onClick={()=>setCreating(true)}><Plus/>Registrar avaliação</Button>
      </section>

      <OperationMessage value={message}/>

      {creating&&(
        <section className="panel post-editor">
          <div className="post-form">
            <label>
              Nota
              <select value={rating} onChange={(event)=>setRating(Number(event.target.value))}>
                {[5,4,3,2,1].map((value)=><option key={value} value={value}>{value} estrelas</option>)}
              </select>
            </label>
            <label>
              Autor
              <Input value={reviewer} onChange={(event)=>setReviewer(event.target.value)} placeholder="Nome informado na avaliação"/>
            </label>
            <label className="wide">
              Avaliação
              <Textarea value={reviewText} onChange={(event)=>setReviewText(event.target.value)} placeholder="Cole o texto da avaliação real ou de teste"/>
            </label>
          </div>
          <div className="editor-actions">
            <Button variant="outline" onClick={()=>setCreating(false)}>Cancelar</Button>
            <Button onClick={()=>void register()} disabled={busy||!reviewText.trim()}>Registrar manualmente</Button>
          </div>
        </section>
      )}

      <section className="workflow-strip" aria-label="Fluxo de avaliações">
        {reviewStages.map((stage,index)=>(
          <div key={stage}>
            <span>{index+1}</span>
            <strong>{stage}</strong>
            {index<reviewStages.length-1&&<ChevronRight/>}
          </div>
        ))}
      </section>

      {rows.length?(
        <section className="operation-list">
          {rows.map((row)=>{
            const reply=replies.find((item)=>item.review_id===row.id);
            const rowRating=Number(row.rating??5);
            const sentiment=getReviewSentiment(rowRating);

            return (
              <article className="panel" key={row.id}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.25rem"}}>
                    <strong>{String(row.reviewer_name??"Autor não informado")} · {rowRating} estrelas</strong>
                    {sentiment==="positive"?(
                      <span className="readiness-pill ready" style={{fontSize:"0.6875rem",padding:"1px 6px"}}>
                        ★ Positiva · Fidelização
                      </span>
                    ):sentiment==="neutral"?(
                      <span className="readiness-pill" style={{fontSize:"0.6875rem",padding:"1px 6px",background:"color-mix(in srgb, var(--warning) 15%, transparent)",color:"var(--warning)"}}>
                        ★ Neutra · Oportunidade
                      </span>
                    ):(
                      <span className="readiness-pill missing" style={{fontSize:"0.6875rem",padding:"1px 6px"}}>
                        ★ Crítica · Resolução rápida
                      </span>
                    )}
                  </div>
                  <p>{row.review_text||"Sem texto"}</p>
                  {reply&&(
                    <p style={{marginTop:"0.5rem",borderLeft:"2px solid var(--brand)",paddingLeft:"0.5rem",color:"var(--content-primary)"}}>
                      <b>Resposta em rascunho:</b> {reply.body}
                    </p>
                  )}
                </div>

                <span>{reply?.status??row.status}</span>

                {reply?(
                  <Button
                    variant="outline"
                    disabled={busy||!["draft","review"].includes(String(reply.status))}
                    onClick={()=>void approval(reply)}
                  >
                    Enviar para aprovação
                  </Button>
                ):replying===row.id?(
                  <div className="review-reply-editor" style={{display:"grid",gap:"0.5rem"}}>
                    <div style={{padding:"0.5rem 0.75rem",borderRadius:"0.375rem",background:sentiment==="critical"?"color-mix(in srgb, var(--warning) 12%, transparent)":"var(--surface-2)",fontSize:"0.75rem"}}>
                      {sentiment==="critical"?(
                        <p style={{margin:0,color:"var(--warning)"}}>
                          <b>Diretriz de Tom (Review Management):</b> Mantenha postura empática e resolutiva sem confrontos públicos. Convide para diálogo em canal privado.
                        </p>
                      ):(
                        <p style={{margin:0,color:"var(--content-secondary)"}}>
                          <b>Diretriz de Tom (Review Management):</b> Agradeça com entusiasmo e reforce diferenciais do DNA do cliente.
                        </p>
                      )}
                    </div>
                    <Textarea
                      rows={3}
                      value={replyText}
                      onChange={(event)=>setReplyText(event.target.value)}
                      placeholder="Escreva ou edite a resposta baseada em fatos confirmados"
                    />
                    <div style={{display:"flex",gap:"0.5rem"}}>
                      <Button variant="outline" size="sm" onClick={()=>setReplying(null)}>Cancelar</Button>
                      <Button size="sm" onClick={()=>void saveReply(String(row.id))} disabled={busy||!replyText.trim()}>Salvar rascunho</Button>
                    </div>
                  </div>
                ):(
                  <div className="review-reply-editor" style={{display:"flex",gap:"0.4rem"}}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={()=>{
                        setReplying(String(row.id));
                        setReplyOrigin("human");
                      }}
                    >
                      Responder manualmente
                    </Button>
                    <Button size="sm" onClick={()=>void generate(String(row.id))} disabled={busy}>
                      <Sparkles style={{width:14,height:14}}/> {busy?"Gerando...":"Gerar com IA"}
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ):(
        <section className="panel operational-empty">
          <Star/>
          <div>
            <h3>Nenhuma avaliação registrada</h3>
            <p>Registre uma avaliação de teste para iniciar o fluxo operacional.</p>
          </div>
          <span className="source-state"><FileEdit/>Fonte manual</span>
        </section>
      )}
    </div>
  );
}

export function OpportunityOperations({
  rows = [],
  clientId,
  onNavigate,
  onGenerate,
  onStatusChange,
}: {
  rows?: SeoRow[];
  clientId?: string;
  onNavigate?: (section: LocalSeoSection) => void;
  onGenerate?: () => Promise<void>;
  onStatusChange?: (
    id: string,
    status:
      | "detected"
      | "analyzed"
      | "action_prepared"
      | "waiting_approval"
      | "in_progress"
      | "completed"
      | "dismissed",
  ) => Promise<void>;
}) {
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const filtered = rows.filter((row) => {
    if (priorityFilter === "all") return true;
    return String(row.priority).toLowerCase() === priorityFilter;
  });

  const criticalCount = rows.filter((r) => String(r.priority) === "critical").length;
  const highCount = rows.filter((r) => String(r.priority) === "high").length;
  const mediumCount = rows.filter((r) => String(r.priority) === "medium").length;
  const lowCount = rows.filter((r) => String(r.priority) === "low").length;

  function navigateToTarget(row: SeoRow) {
    const act = String(row.suggested_action || "").toLowerCase();
    const cat = String(row.category || "").toLowerCase();
    if (act === "open_profile" || cat === "profile") return onNavigate?.("profile");
    if (act === "open_keywords" || cat === "ranking" || cat === "keywords") return onNavigate?.("keywords");
    if (act === "open_competitors" || cat === "competition" || cat === "competitors") return onNavigate?.("competitors");
    if (act === "open_reviews" || cat === "reviews") return onNavigate?.("reviews");
    if (act === "open_posts" || cat === "content" || cat === "posts") return onNavigate?.("posts");
    return onNavigate?.("overview");
  }

  async function handleGenerate() {
    if (!onGenerate) return;
    setBusy(true);
    setMessage("");
    try {
      await onGenerate();
      setMessage("Oportunidades geradas com base nas evidências atuais.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível gerar oportunidades.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStatus(id: string, nextStatus: "in_progress" | "completed" | "dismissed") {
    if (!onStatusChange) return;
    setBusy(true);
    try {
      await onStatusChange(id, nextStatus);
      setMessage(`Status atualizado para ${nextStatus === "completed" ? "concluída" : nextStatus === "in_progress" ? "em andamento" : "descartada"}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível atualizar o status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="seo-operation">
      <section className="operation-head">
        <div>
          <span className="section-kicker">OPERAÇÃO POR EXCEÇÃO</span>
          <h2>Oportunidades de SEO Local</h2>
          <p>Diagnóstico acionável gerado a partir do perfil, palavras-chave e concorrentes reais.</p>
        </div>
        {onGenerate && (
          <Button onClick={() => void handleGenerate()} disabled={busy}>
            <Sparkles /> {busy ? "Analisando evidências..." : "Gerar por evidências"}
          </Button>
        )}
      </section>

      <OperationMessage value={message} />

      <div className="opportunity-control">
        <button
          type="button"
          className={priorityFilter === "all" ? "is-active" : ""}
          onClick={() => setPriorityFilter("all")}
        >
          Todas ({rows.length})
        </button>
        <button
          type="button"
          className={priorityFilter === "critical" ? "is-active" : ""}
          onClick={() => setPriorityFilter("critical")}
        >
          Crítica ({criticalCount})
        </button>
        <button
          type="button"
          className={priorityFilter === "high" ? "is-active" : ""}
          onClick={() => setPriorityFilter("high")}
        >
          Alta ({highCount})
        </button>
        <button
          type="button"
          className={priorityFilter === "medium" ? "is-active" : ""}
          onClick={() => setPriorityFilter("medium")}
        >
          Média ({mediumCount})
        </button>
        <button
          type="button"
          className={priorityFilter === "low" ? "is-active" : ""}
          onClick={() => setPriorityFilter("low")}
        >
          Baixa ({lowCount})
        </button>
      </div>

      <section className="opportunity-schema">
        <article>
          <AlertTriangle />
          <strong>Detectada</strong>
          <span>Evidência identificada</span>
        </article>
        <article>
          <FileEdit />
          <strong>Em andamento</strong>
          <span>Ação sendo executada</span>
        </article>
        <article>
          <CheckCircle2 />
          <strong>Concluída</strong>
          <span>Correção confirmada</span>
        </article>
      </section>

      {filtered.length ? (
        <section className="operation-list">
          {filtered.map((row) => {
            const isCompleted = row.status === "completed";
            const isDismissed = row.status === "dismissed";
            const isDone = isCompleted || isDismissed;
            return (
              <article className={`panel${isDone ? " is-muted" : ""}`} key={String(row.id)}>
                <div>
                  <div className="opportunity-title-row" style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                    <strong>{String(row.title || "Oportunidade")}</strong>
                    <span className={`priority-tag ${String(row.priority ?? "medium")}`} style={{ fontSize: "11px", padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase", background: "var(--color-bg-secondary, #222)", border: "1px solid var(--color-border, #444)" }}>
                      {String(row.priority ?? "medium")}
                    </span>
                    <span className="category-tag" style={{ fontSize: "11px", color: "var(--color-text-secondary, #888)" }}>
                      {String(row.category ?? "geral")}
                    </span>
                  </div>
                  <p>{String(row.diagnosis ?? "Sem diagnóstico informado.")}</p>
                  {Boolean(row.recommendation) ? (
                    <p style={{ fontSize: "12px", color: "var(--color-text-secondary, #aaa)", marginTop: "4px" }}>
                      <b>Recomendação:</b> {String(row.recommendation)}
                    </p>
                  ) : null}
                </div>
                <div className="opportunity-actions" style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <span className="status-badge" style={{ fontSize: "12px", padding: "2px 8px", background: "var(--color-bg-muted, #1a1a1a)", borderRadius: "4px" }}>
                    {String(row.status ?? "detected").replace("_", " ")}
                  </span>
                  {!isDone && (
                    <Button variant="default" onClick={() => navigateToTarget(row)}>
                      Agir agora <ArrowRight />
                    </Button>
                  )}
                  {onStatusChange && row.id && !isDone && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleStatus(String(row.id), "completed")}
                      >
                        Concluir
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleStatus(String(row.id), "dismissed")}
                      >
                        Descartar
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="panel operational-empty">
          <Lightbulb />
          <div>
            <h3>Nenhuma oportunidade encontrada</h3>
            <p>
              {rows.length === 0
                ? "Execute 'Gerar por evidências' para analisar o perfil, palavras-chave e concorrência."
                : "Nenhuma oportunidade com o filtro de prioridade selecionado."}
            </p>
          </div>
          {rows.length === 0 && onGenerate && (
            <Button onClick={() => void handleGenerate()} disabled={busy}>
              <Sparkles /> Analisar e gerar agora
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
