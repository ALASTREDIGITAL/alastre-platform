"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ScanSearch,
  Star,
  Building2,
  ShieldCheck,
  FileBarChart,
  MapPin,
  Phone,
  Globe,
  Clock,
  Sparkles,
  Share2,
  Printer,
  UserPlus,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  Store,
  Layers,
  Flame,
  Search,
  Upload,
  FileJson,
  Info,
  HelpCircle,
  Eye,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ReviewAuditDashboard } from "@/components/review-audit-dashboard";
import { LocalSeoExecutiveReport } from "@/components/local-seo-executive-report";
import {
  BEM_FEITO_REDES_DEMO_SNAPSHOT,
  BEM_FEITO_REDES_DEMO_REVIEWS,
  LAVANDERIA_SWISS_DEMO_SNAPSHOT,
  LAVANDERIA_SWISS_DEMO_REVIEWS,
  CASSIUS_PORTO_FELIZ_DEMO_SNAPSHOT,
  CASSIUS_PORTO_FELIZ_DEMO_REVIEWS,
  CASSIUS_PORTO_FELIZ_REAL_COMPETITORS,
  generateExecutiveReport,
  type ExecutiveReportData,
  type CompetitorBenchmarkItem,
} from "@/lib/local-seo-report-engine";
import {
  BARBEARIA_DUTRA_DEMO_SNAPSHOT,
  BARBEARIA_DUTRA_DEMO_REVIEWS,
  inferCategoryFromName,
  type BusinessProfileSnapshot,
  type RawAuditReview,
} from "@/lib/review-audit-analyzer";
import type {
  AuditSessionEnvelope,
  AuditChecklistCriterion,
  LocalScoreSummary,
  EvidenceStatus
} from "@/lib/pre-audit-types";
import { validateAuditSessionEnvelope } from "@/lib/audit-session-verifier";

export {
  LAVANDERIA_SWISS_DEMO_SNAPSHOT,
  LAVANDERIA_SWISS_DEMO_REVIEWS,
  CASSIUS_PORTO_FELIZ_DEMO_SNAPSHOT,
  CASSIUS_PORTO_FELIZ_DEMO_REVIEWS,
  CASSIUS_PORTO_FELIZ_REAL_COMPETITORS,
};

type PreAuditSection = "reviews" | "profile" | "score" | "report";

interface PreAuditModuleProps {
  onNavigate?: (view: any) => void;
}

export function PreAuditModule({ onNavigate }: PreAuditModuleProps) {
  const [section, setSection] = useState<PreAuditSection>("reviews");
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoPreset, setDemoPreset] = useState<"cassius" | "swiss" | "bemfeito" | "barbearia">("cassius");
  const [transferError, setTransferError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Envelope ativo da sessão autenticada
  const [activeEnvelope, setActiveEnvelope] = useState<AuditSessionEnvelope | null>(() => {
    if (typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      const sessionId = search.get("session_id");
      if (sessionId) {
        try {
          const cached = sessionStorage.getItem(`alastre_active_session_${sessionId}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            const val = validateAuditSessionEnvelope(parsed);
            if (val.isValid) return parsed;
          }
        } catch (e) {}
      }
    }
    return null;
  });

  // Handshake seguro com a extensão via bridge.js e token no hash da URL
  useEffect(() => {
    if (typeof window === "undefined") return;

    const search = new URLSearchParams(window.location.search);
    const sessionId = search.get("session_id");
    const requestedTab = search.get("tab") as PreAuditSection | null;
    if (requestedTab && ["reviews", "profile", "score", "report"].includes(requestedTab)) {
      setSection(requestedTab);
    }

    // Se já carregamos a sessão do cache para este sessionId, não precisa requisitar novamente
    if (activeEnvelope && activeEnvelope.sessionId === sessionId) return;

    // Verificar se há token de transferência no hash (#token=...)
    const hash = window.location.hash;
    const tokenMatch = hash.match(/token=([a-zA-Z0-9-]+)/);
    const transferToken = tokenMatch ? tokenMatch[1] : null;

    if (sessionId && transferToken) {
      // Limpar o hash da barra de endereços imediatamente para não deixar rastro visual
      history.replaceState(null, "", window.location.pathname + window.location.search);

      // Ouvir a resposta do bridge
      const handleBridgeMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (!event.data || typeof event.data !== "object") return;

        if (event.data.type === "ALASTRE_AUDIT_SESSION_DELIVERED") {
          window.removeEventListener("message", handleBridgeMessage);
          if (event.data.success && event.data.envelope) {
            const validation = validateAuditSessionEnvelope(event.data.envelope);
            if (validation.isValid) {
              setActiveEnvelope(event.data.envelope);
              setIsDemoMode(false);
              setTransferError(null);
              try {
                sessionStorage.setItem(
                  `alastre_active_session_${event.data.envelope.sessionId}`,
                  JSON.stringify(event.data.envelope)
                );
              } catch (e) {}
            } else {
              setTransferError(`Envelope inválido: ${validation.errors.join(", ")}`);
            }
          } else {
            setTransferError(event.data.error || "Falha na entrega segura da sessão pela extensão.");
          }
        }
      };

      window.addEventListener("message", handleBridgeMessage);

      // Disparar solicitação de reivindicação para o bridge
      window.postMessage(
        {
          type: "ALASTRE_CLAIM_AUDIT_SESSION",
          sessionId,
          transferToken,
          targetOrigin: window.location.origin
        },
        window.location.origin
      );

      return () => {
        window.removeEventListener("message", handleBridgeMessage);
      };
    }
  }, []);

  // Perfil derivado da sessão real ou do preset de demonstração
  const profile: BusinessProfileSnapshot = useMemo(() => {
    if (isDemoMode) {
      switch (demoPreset) {
        case "cassius":
          return CASSIUS_PORTO_FELIZ_DEMO_SNAPSHOT;
        case "swiss":
          return LAVANDERIA_SWISS_DEMO_SNAPSHOT;
        case "bemfeito":
          return BEM_FEITO_REDES_DEMO_SNAPSHOT;
        case "barbearia":
          return BARBEARIA_DUTRA_DEMO_SNAPSHOT;
      }
    }

    if (activeEnvelope && activeEnvelope.profile) {
      const p = activeEnvelope.profile;
      return {
        name: p.name.value || "Empresa Auditada",
        category: p.primaryCategory.value || undefined,
        rating: p.rating.value !== null ? p.rating.value : null,
        reviewsCount: p.reviewCount.value !== null ? p.reviewCount.value : null,
        address: p.address.value || undefined,
        phone: p.phone.value || undefined,
        website: p.website.value || undefined,
        hours: p.hours.value || undefined,
        cid: p.cid.value || undefined,
        placeId: p.placeId.value || undefined,
        lat: p.coordinates.value ? p.coordinates.value.lat : undefined,
        lng: p.coordinates.value ? p.coordinates.value.lng : undefined,
        isClaimed: p.isClaimed.value !== null ? p.isClaimed.value : undefined,
      };
    }

    return isDemoMode
      ? CASSIUS_PORTO_FELIZ_DEMO_SNAPSHOT
      : {
          name: "Empresa em Análise",
          category: "Empresa Local",
          rating: null,
          reviewsCount: null,
        };
  }, [isDemoMode, demoPreset, activeEnvelope]);

  // Concorrentes derivados da sessão ou demonstração
  const competitors: CompetitorBenchmarkItem[] = useMemo(() => {
    if (isDemoMode) {
      if (demoPreset === "cassius") return CASSIUS_PORTO_FELIZ_REAL_COMPETITORS;
      return [];
    }

    if (activeEnvelope && activeEnvelope.competitors) {
      return activeEnvelope.competitors.map((c) => ({
        rank: c.rankInVisibleSample,
        name: c.name,
        category: c.category || "Empresa Local",
        reviewsCount: c.reviewsCount !== null ? c.reviewsCount : 0,
        rating: c.rating !== null ? c.rating : 0,
        isCurrentClient: Boolean(c.isCurrentClient),
        distanceKm: c.distanceKm !== null ? c.distanceKm : undefined,
        lat: c.coordinates ? c.coordinates.lat : undefined,
        lng: c.coordinates ? c.coordinates.lng : undefined,
        address: c.address,
      }));
    }

    return [];
  }, [isDemoMode, demoPreset, activeEnvelope]);

  // Avaliações derivadas
  const reviews: RawAuditReview[] = useMemo(() => {
    if (isDemoMode) {
      switch (demoPreset) {
        case "cassius":
          return CASSIUS_PORTO_FELIZ_DEMO_REVIEWS;
        case "swiss":
          return LAVANDERIA_SWISS_DEMO_REVIEWS;
        case "bemfeito":
          return BEM_FEITO_REDES_DEMO_REVIEWS;
        case "barbearia":
          return BARBEARIA_DUTRA_DEMO_REVIEWS;
      }
    }

    if (activeEnvelope && activeEnvelope.reviews && activeEnvelope.reviews.length > 0) {
      return activeEnvelope.reviews.map((r: any) => ({
        id: r.id,
        author: r.author,
        rating: r.rating,
        text: r.text || "",
        isLocalGuide: r.isLocalGuide,
        localGuideLevel: r.localGuideLevel,
        avatarUrl: r.avatarUrl,
        hasImages: r.hasImages,
        ownerReply: r.ownerReply || (r.hasOwnerReply ? { text: r.ownerReplyText || "" } : null),
        relativeDate: r.relativeDate || r.relativePublishDate,
      }));
    }

    return [];
  }, [isDemoMode, demoPreset, activeEnvelope]);

  // Relatório Executivo
  const executiveReport: ExecutiveReportData = useMemo(() => {
    return generateExecutiveReport(
      profile,
      reviews,
      profile.category,
      profile.address,
      competitors.length >= 2 ? competitors : undefined,
      isDemoMode
    );
  }, [profile, reviews, competitors, isDemoMode]);

  // Importação manual de arquivo JSON da coleta
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        const validation = validateAuditSessionEnvelope(parsed);
        if (validation.isValid) {
          setActiveEnvelope(parsed);
          setIsDemoMode(false);
          setTransferError(null);
          sessionStorage.setItem(`alastre_active_session_${parsed.sessionId}`, JSON.stringify(parsed));
        } else {
          setTransferError(`Arquivo inválido: ${validation.errors.join(", ")}`);
        }
      } catch (err) {
        setTransferError("Erro ao processar arquivo JSON. Certifique-se de que é um pacote de auditoria válido.");
      }
    };
    reader.readAsText(file);
  };

  // Copiar Pitch WhatsApp
  const handleCopyPitch = () => {
    const pName = profile.name;
    const text = `*Auditoria Estratégica de SEO Local — ${pName}*\n\n` +
      `Olá! Analisamos a presença pública da sua empresa no Google Maps e identificamos oportunidades comerciais imediatas:\n\n` +
      `• *Local Score:* ${executiveReport.overallScore}/100\n` +
      `• *Avaliações Atuais:* ${profile.reviewsCount || 0} reviews (Nota: ${profile.rating ? profile.rating.toFixed(1) : "Sem nota"}★)\n` +
      (competitors.length > 0 ? `• *Líder Local na Categoria:* ${executiveReport.topCompetitorReviews} avaliações\n` : "") +
      `• *Status de Reivindicação:* ${profile.isClaimed === false ? "⚠️ Não reivindicado (Risco crítico de invasão)" : "Verificado/Em conformidade"}\n\n` +
      `Preparamos um Dossiê Executivo completo com o plano de ação de 30 dias para dominar as buscas na sua cidade. Podemos agendar 15 minutos para apresentar?`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedPitch(true);
      setTimeout(() => setCopiedPitch(false), 2500);
    });
  };

  // Renderizar selo de evidência
  const renderEvidenceBadge = (status: EvidenceStatus) => {
    switch (status) {
      case "confirmed":
        return <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">Confirmado no DOM</span>;
      case "inferred":
        return <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 font-semibold border border-blue-500/20">Inferido</span>;
      case "not_found":
        return <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-semibold border border-amber-500/20">Não Encontrado</span>;
      case "unavailable":
        return <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-500 font-semibold border border-slate-500/20">Não Mensurável Publicamente</span>;
      case "demo":
        return <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 font-semibold border border-purple-500/20">Demonstração</span>;
    }
  };

  // Estado Vazio Limpo (quando não há sessão nem demo)
  if (!activeEnvelope && !isDemoMode) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        <PageHeader
          title="Pré-Análise & Prospecção de Clientes"
          description="Auditoria fidedigna de perfis do Google Maps e concorrência local sem requerer acesso administrativo."
        />

        {transferError && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold">Falha no resgate da sessão</p>
              <p className="text-xs text-rose-500 mt-0.5">{transferError}</p>
            </div>
          </div>
        )}

        <div className="p-12 rounded-2xl border border-border bg-card text-center max-w-2xl mx-auto space-y-6 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
            <ScanSearch className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">Nenhuma Sessão de Auditoria Ativa</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Para analisar uma empresa real com dados 100% fidedignos, abra o perfil no Google Maps com a extensão{" "}
              <strong>Alastre Local Inspector</strong> e clique em <em>"Abrir Dossiê Executivo na Plataforma"</em>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="gap-2 w-full sm:w-auto"
            >
              <Upload className="w-4 h-4" /> Carregar Arquivo JSON da Coleta
            </Button>

            <Button
              onClick={() => {
                setIsDemoMode(true);
                setDemoPreset("cassius");
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 w-full sm:w-auto"
            >
              <Sparkles className="w-4 h-4" /> Explorar Demonstrações (Modo Demo)
            </Button>
          </div>

          <p className="text-xs text-muted-foreground pt-4 border-t border-border">
            🛡️ <strong>Garantia de Isolamento:</strong> Os dados desta área são mantidos em sessão isolada e jamais são associados à carteira de clientes ativos da agência.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* TARJA PERSISTENTE DO MODO DEMONSTRAÇÃO */}
      {isDemoMode && (
        <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-between gap-4 flex-wrap shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>[MODO DEMONSTRAÇÃO COM DADOS ILUSTRATIVOS]</span>
            <span className="text-xs font-normal text-amber-700/80 dark:text-amber-300/80 hidden md:inline">
              Esta visualização utiliza dados estáticos de exemplo para demonstração das capacidades analíticas.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsDemoMode(false);
                setActiveEnvelope(null);
              }}
              className="text-xs border-amber-500/30 text-amber-700 hover:bg-amber-500/20"
            >
              Sair do Modo Demonstração
            </Button>
          </div>
        </div>
      )}

      {/* CABEÇALHO */}
      <PageHeader
        title="Pré-Análise & Prospecção de Clientes"
        description={`Empresa em análise: ${profile.name} • Nicho: ${profile.category || "Empresa Local"} • ${profile.address || "Localização auditada"}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {isDemoMode && (
              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-card border border-border">
                <span className="text-xs text-muted-foreground font-semibold px-2">Presets:</span>
                <Button
                  variant={demoPreset === "cassius" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setDemoPreset("cassius")}
                >
                  🥩 Cassiu's
                </Button>
                <Button
                  variant={demoPreset === "swiss" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setDemoPreset("swiss")}
                >
                  🧺 Lavanderia Swiss
                </Button>
                <Button
                  variant={demoPreset === "bemfeito" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setDemoPreset("bemfeito")}
                >
                  🛡️ Bem Feito
                </Button>
                <Button
                  variant={demoPreset === "barbearia" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setDemoPreset("barbearia")}
                >
                  💈 Barbearia
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyPitch}
              className="text-xs gap-1.5"
            >
              {copiedPitch ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copiedPitch ? "Pitch Copiado!" : "Copiar Pitch WhatsApp"}
            </Button>

            <Button
              size="sm"
              onClick={() => setSection("report")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-sm"
            >
              <FileBarChart className="w-4 h-4" /> Dossiê Executivo (PDF)
            </Button>
          </div>
        }
      />

      {/* SELETOR DE ABAS PRINCIPAIS */}
      <div className="border-b border-border flex items-center gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setSection("reviews")}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            section === "reviews"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Star className="w-4 h-4" /> 1. Avaliações & Reputação (GBPCheck)
        </button>

        <button
          onClick={() => setSection("profile")}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            section === "profile"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="w-4 h-4" /> 2. Checklist & Perfil Google (22 Critérios)
        </button>

        <button
          onClick={() => setSection("score")}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            section === "score"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> 3. Local Score v2 & Cobertura
        </button>

        <button
          onClick={() => setSection("report")}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            section === "report"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileBarChart className="w-4 h-4" /> 4. Dossiê Executivo & Mapa Espacial
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      {section === "reviews" && (
        <ReviewAuditDashboard
          initialSnapshot={profile}
          initialReviews={reviews}
          onOpenExecutiveReport={() => setSection("report")}
          isDemoMode={isDemoMode}
        />
      )}

      {section === "profile" && (
        <div className="space-y-6">
          {/* CARDS DE IDENTIFICAÇÃO TÉCNICA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Identificadores Google</div>
              <div className="text-xs space-y-1">
                <div><span className="text-muted-foreground">Place ID:</span> <span className="font-mono text-foreground font-semibold">{profile.placeId || "Não identificado"}</span></div>
                <div><span className="text-muted-foreground">CID:</span> <span className="font-mono text-foreground font-semibold">{profile.cid || "Não identificado"}</span></div>
                <div>
                  <span className="text-muted-foreground">Reivindicação:</span>{" "}
                  {profile.isClaimed === true ? (
                    <span className="text-emerald-500 font-bold">✓ Verificado</span>
                  ) : profile.isClaimed === false ? (
                    <span className="text-rose-500 font-bold">⚠️ Não Reivindicado</span>
                  ) : (
                    <span className="text-slate-400 font-semibold">○ Não Mensurável Publicamente</span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Contato & Localização</div>
              <div className="text-xs space-y-1">
                <div><span className="text-muted-foreground">Telefone:</span> <span className="text-foreground font-semibold">{profile.phone || "Não informado"}</span></div>
                <div><span className="text-muted-foreground">Website:</span> <span className="text-foreground font-semibold">{profile.website || "Sem website"}</span></div>
                <div><span className="text-muted-foreground">Endereço:</span> <span className="text-foreground font-semibold">{profile.address || "Não informado"}</span></div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-2">
              <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Concorrência Detectada</div>
              <div className="text-xs space-y-1">
                <div><span className="text-muted-foreground">Estabelecimentos:</span> <span className="font-bold text-foreground">{competitors.length} coletados na busca</span></div>
                <div><span className="text-muted-foreground">Média de Reviews:</span> <span className="font-bold text-foreground">{executiveReport.segmentAverageReviews} avaliações</span></div>
                <div><span className="text-muted-foreground">Líder Regional:</span> <span className="font-bold text-foreground">{executiveReport.topCompetitorReviews} avaliações</span></div>
              </div>
            </div>
          </div>

          {/* CHECKLIST DE 22 CRITÉRIOS CONSOLIDADOS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Checklist de Auditoria Técnica (22 Critérios)</h3>
                <p className="text-xs text-muted-foreground">
                  Separação estrita entre dado observado no DOM, conformidade com diretrizes do Google e recomendações práticas.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(activeEnvelope?.checklist || []).map((crit) => (
                <div key={crit.id} className="p-4 rounded-xl border border-border bg-card space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-sm text-foreground">{crit.title}</div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {crit.evaluationStatus === "compliant" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-bold">🟢 Conforme</span>
                      )}
                      {crit.evaluationStatus === "warning" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold">🟡 Atenção</span>
                      )}
                      {crit.evaluationStatus === "non_compliant" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 font-bold">🔴 Não Conforme</span>
                      )}
                      {crit.evaluationStatus === "not_evaluable" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-600 font-bold">○ Não Mensurável</span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs space-y-1 bg-muted/30 p-2.5 rounded-lg border border-border/50">
                    <div>
                      <span className="font-semibold text-muted-foreground">Dado Observado:</span>{" "}
                      <span className="font-mono text-foreground font-semibold">{String(crit.observedValue || "Não encontrado")}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="font-semibold text-muted-foreground">Status da Evidência:</span>
                      {renderEvidenceBadge(crit.evidenceStatus)}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <p>{crit.explanation}</p>
                    <p className="text-[11px] text-muted-foreground/80 mt-1 italic">Base: {crit.evaluationBasis}</p>
                  </div>

                  {crit.recommendedAction && (
                    <div className="text-xs p-2 rounded bg-emerald-500/5 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                      <strong>Ação Recomendada:</strong> {crit.recommendedAction}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {section === "score" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CARD DO SCORE DE QUALIDADE OBSERVADA */}
            <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Score de Qualidade Observada</h3>
                  <p className="text-xs text-muted-foreground">Calculado exclusivamente sobre os critérios públicos verificáveis.</p>
                </div>
                <div className="text-3xl font-black text-emerald-600">
                  {activeEnvelope?.score?.observableQualityScore || executiveReport.overallScore}/100
                </div>
              </div>

              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${activeEnvelope?.score?.observableQualityScore || executiveReport.overallScore}%` }}
                />
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Este indicador reflete o nível de completude e conformidade das informações públicas com as diretrizes do Google Meu Negócio.
              </p>
            </div>

            {/* CARD DE COBERTURA DA COLETA */}
            <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Índice de Cobertura da Coleta</h3>
                  <p className="text-xs text-muted-foreground">Percentual de critérios inspecionados no DOM público.</p>
                </div>
                <div className="text-3xl font-black text-blue-600">
                  {activeEnvelope?.score?.coverageIndex ?? (isDemoMode ? 82 : 0)}%
                </div>
              </div>

              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${activeEnvelope?.score?.coverageIndex ?? (isDemoMode ? 82 : 0)}%` }}
                />
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Campos protegidos ou métricas históricas privadas são identificados como não mensuráveis publicamente e excluídos do denominador de avaliação.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-muted/20 text-xs text-muted-foreground">
            ⚖️ <strong>Aviso Ético e Legal:</strong> Este diagnóstico avalia conformidade com boas práticas recomendadas e não representa garantia algorítmica de ranqueamento nas posições do Google Maps.
          </div>
        </div>
      )}

      {section === "report" && (
        <LocalSeoExecutiveReport
          initialSnapshot={profile}
          initialReviews={reviews}
          initialCompetitors={competitors}
          isDemoMode={isDemoMode}
          onClose={() => setSection("reviews")}
        />
      )}
    </div>
  );
}
