"use client";

import React, { useState, useMemo } from "react";
import {
  Printer,
  Share2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  MapPin,
  Phone,
  Globe,
  Star,
  Sparkles,
  TrendingUp,
  BarChart3,
  Flame,
  Check,
  Copy,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateExecutiveReport,
  BEM_FEITO_REDES_DEMO_SNAPSHOT,
  BEM_FEITO_REDES_DEMO_REVIEWS,
  type ExecutiveReportData,
  type AuditFactorItem,
  type CompetitorBenchmarkItem,
} from "@/lib/local-seo-report-engine";
import {
  type BusinessProfileSnapshot,
  type RawAuditReview,
  inferCategoryFromName,
} from "@/lib/review-audit-analyzer";

interface LocalSeoExecutiveReportProps {
  initialSnapshot?: BusinessProfileSnapshot;
  initialReviews?: RawAuditReview[];
  initialCompetitors?: CompetitorBenchmarkItem[];
  keyword?: string;
  locationLabel?: string;
  onClose?: () => void;
  isDemoMode?: boolean;
}

export function LocalSeoExecutiveReport({
  initialSnapshot,
  initialReviews,
  initialCompetitors,
  keyword,
  locationLabel,
  onClose,
  isDemoMode = false,
}: LocalSeoExecutiveReportProps) {
  const [activeTab, setActiveTab] = useState<"todos" | "fraco" | "razoavel" | "bom">("todos");
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState<"1km" | "3km" | "5km">("3km");

  const report: ExecutiveReportData = useMemo(() => {
    const snap =
      initialSnapshot ||
      (isDemoMode
        ? BEM_FEITO_REDES_DEMO_SNAPSHOT
        : {
            name: "Empresa Auditada",
            category: "Empresa Local",
            rating: null,
            reviewsCount: null,
          });

    const resolvedKeyword =
      keyword && keyword !== "Loja de telas" && keyword !== "Empresa Local"
        ? keyword
        : snap.category && snap.category !== "Loja de telas"
        ? snap.category
        : inferCategoryFromName(snap.name) || "Empresa Local";

    const resolvedLocation = locationLabel || snap.address || "Região Metropolitana";

    const resolvedReviews =
      initialReviews && initialReviews.length > 0
        ? initialReviews
        : isDemoMode
        ? BEM_FEITO_REDES_DEMO_REVIEWS
        : [];

    return generateExecutiveReport(
      snap,
      resolvedReviews,
      resolvedKeyword,
      resolvedLocation,
      initialCompetitors,
      isDemoMode
    );
  }, [initialSnapshot, initialReviews, initialCompetitors, keyword, locationLabel, isDemoMode]);

  const filteredFactors = useMemo(() => {
    if (activeTab === "todos") return report.factors;
    return report.factors.filter((f) => f.status === activeTab);
  }, [report.factors, activeTab]);

  function handlePrint() {
    window.print();
  }

  function handleCopyWhatsApp() {
    const text = `*Auditoria Estratégica de SEO Local — ${report.profile.name}*\n\n` +
      `🎯 *Diagnóstico de Presença Google:*\n` +
      `• Pontuação Geral de Saúde: *${report.overallScore}/100 (${report.overallStatus.toUpperCase()})*\n` +
      `• 🔴 Métricas Críticas (Gargalos): *${report.healthCounts.fraco}*\n` +
      `• 🟡 Métricas em Atenção (Melhoria): *${report.healthCounts.razoavel}*\n` +
      `• 🟢 Métricas Excelentes (Fortalezas): *${report.healthCounts.bom}*\n\n` +
      `📊 *Comparativo Regional (${report.keyword}):*\n` +
      `• Avaliações da sua empresa: *${report.profile.reviewsCount !== undefined && report.profile.reviewsCount !== null ? report.profile.reviewsCount : "Não informado"}*\n` +
      `• Média dos concorrentes na sua região: *${report.segmentAverageReviews}*\n` +
      `• Líder de mercado local: *${report.topCompetitorReviews} avaliações*\n\n` +
      `🚀 *Plano de Ação:* Preparamos o plano de 30 dias para sanar os gargalos e expandir seu raio de calor no Google Maps. Podemos agendar uma reunião de 15 minutos para apresentar?`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedPitch(true);
      setTimeout(() => setCopiedPitch(false), 2500);
    });
  }

  // Cor semântica do score
  const scoreColor =
    report.overallScore >= 75
      ? "text-emerald-500 stroke-emerald-500"
      : report.overallScore >= 50
      ? "text-amber-500 stroke-amber-500"
      : "text-rose-500 stroke-rose-500";

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md overflow-y-auto print:static print:bg-white print:p-0">
      {/* BARRA DE AÇÕES SUPERIOR (OCULTA NA IMPRESSÃO) */}
      <header className="sticky top-0 z-50 bg-card border-b border-border px-6 py-3.5 flex items-center justify-between gap-4 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 font-black flex items-center justify-center text-sm border border-emerald-500/20">
            A
          </div>
          <div>
            <div className="font-bold text-sm text-foreground flex items-center gap-2">
              Dossiê Executivo de Presença Local & Mapa de Calor
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-semibold">
                Alastre Intelligence
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {report.profile.name} • Nicho: {report.keyword} • {report.locationLabel}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyWhatsApp} className="gap-1.5 text-xs">
            {copiedPitch ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copiedPitch ? "Copiado!" : "Copiar para WhatsApp"}
          </Button>

          <Button size="sm" onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs shadow-sm">
            <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
          </Button>

          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
              ✕ Fechar
            </Button>
          )}
        </div>
      </header>

      {/* DOCUMENTO EXECUTIVO IMPRIMÍVEL (FORMATO A4 / PÁGINA LIMPA) */}
      <main className="max-w-5xl mx-auto p-6 md:p-10 space-y-8 print:p-0 print:max-w-none print:space-y-6">
        
        {/* CABEÇALHO DO RELATÓRIO CO-BRANDED */}
        <div className="border-b border-border pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Relatório de Auditoria de SEO Local & Google Business Profile
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {report.profile.name}
            </h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap pt-1">
              <span>Segmento: <strong className="text-foreground">{report.keyword}</strong></span>
              <span>•</span>
              <span>Região: <strong className="text-foreground">{report.locationLabel}</strong></span>
              <span>•</span>
              <span>Data da Auditoria: <strong className="text-foreground">{report.generatedAt}</strong></span>
            </div>
          </div>

          <div className="text-right shrink-0 sm:border-l sm:border-border sm:pl-6 space-y-0.5">
            <div className="text-xs font-bold text-foreground">Alastre Digital Platform</div>
            <div className="text-[11px] text-muted-foreground">Governança & Inteligência Local</div>
            <div className="text-[10px] text-emerald-600 font-mono">Dados Públicos Auditados</div>
          </div>
        </div>

        {/* BLOCO 1: PONTUAÇÃO GERAL & SAÚDE DO NEGÓCIO (ESPELHO DA PÁGINA 1 DO PDF) */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          {/* Gauge Semicircular de Desempenho */}
          <div className="md:col-span-6 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Pontuação Geral — Desempenho do Negócio
            </div>

            {/* Gauge SVG semicircular nítido para tela e impressão */}
            <div className="relative w-56 h-28 flex items-end justify-center overflow-hidden">
              <svg className="w-56 h-56 transform -rotate-180" viewBox="0 0 200 200">
                {/* Arco de fundo (trilho cinza) */}
                <circle
                  cx="100"
                  cy="100"
                  r="75"
                  fill="none"
                  stroke="currentColor"
                  className="text-muted/30"
                  strokeWidth="16"
                  strokeDasharray="235.6 235.6"
                />
                {/* Arco colorido do score */}
                <circle
                  cx="100"
                  cy="100"
                  r="75"
                  fill="none"
                  className={scoreColor}
                  strokeWidth="16"
                  strokeDasharray="235.6 235.6"
                  strokeDashoffset={235.6 - (235.6 * report.overallScore) / 100}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.8s ease" }}
                />
              </svg>

              {/* Ponteiro central e valor numérico */}
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
                <span className="text-4xl font-extrabold text-foreground tracking-tight">
                  {report.overallScore}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  de 100 pontos
                </span>
              </div>
            </div>

            <div className="pt-2">
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  report.overallStatus === "bom"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : report.overallStatus === "razoavel"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                }`}
              >
                Classificação: {report.overallStatus}
              </span>
            </div>
            <p className="text-xs text-muted-foreground max-w-sm">
              Média ponderada baseada em conformidade NAP, prova social, engajamento e competitividade local perante o nicho.
            </p>
          </div>

          {/* Pontuação Detalhada (Cards Fraco / Razoável / Bom da Página 1) */}
          <div className="md:col-span-6 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Pontuação Detalhada das Métricas
            </div>

            <div className="space-y-3">
              {/* Fraco */}
              <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-500 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                    {report.healthCounts.fraco}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-foreground">Fraco</div>
                    <div className="text-xs text-muted-foreground">Métricas críticas que precisam de atenção urgente</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 shrink-0">Gargalo</span>
              </div>

              {/* Razoável */}
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                    {report.healthCounts.razoavel}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-foreground">Razoável</div>
                    <div className="text-xs text-muted-foreground">Métricas com potencial de melhoria imediata</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 shrink-0">Oportunidade</span>
              </div>

              {/* Bom */}
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
                    {report.healthCounts.bom}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-foreground">Bom</div>
                    <div className="text-xs text-muted-foreground">Métricas em excelente estado e conformidade</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">Fortaleza</span>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground pt-1">
              Total de <strong>{report.factors.length} pontos de auditoria</strong> inspecionados publicamente.
            </div>
          </div>
        </section>

        {/* BLOCO 2: MAPA DE CALOR & GEOVISIBILIDADE DA REGIÃO (SUPERANDO O LEAFLET DO PDF) */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 break-inside-avoid">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                <MapPin className="w-4 h-4 text-emerald-500" /> Distribuição Espacial dos Concorrentes Coletados
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> {report.isRealGoogleMapsData ? "Coleta Direta via Google Maps" : "Modo Demonstração"}
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground">
                Dispersão geográfica dos concorrentes da busca "{report.keyword}" em {report.locationLabel}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {report.spatialMapDisclaimer || "Representa a localização geográfica dos estabelecimentos identificados na busca pública, e não densidade de demanda de clientes ou tráfego de pedestres."}
              </p>
            </div>

            <div className="flex items-center gap-1 text-xs print:hidden">
              {(["1km", "3km", "5km"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRadius(r)}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    selectedRadius === r
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Raio {r}
                </button>
              ))}
            </div>
          </div>

          {/* Renderização Vetorial Nítida da Distribuição Espacial */}
          {report.isSpatialMapAvailable === false || report.heatmapPoints.length < 2 ? (
            <div className="relative w-full h-64 rounded-xl overflow-hidden border border-dashed border-border bg-card flex flex-col items-center justify-center p-6 text-center">
              <MapPin className="w-8 h-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-bold text-foreground">Amostra Geográfica Insuficiente</p>
              <p className="text-xs text-muted-foreground max-w-md mt-1">
                {report.spatialMapDisclaimer || "Coordenadas GPS insuficientes na amostra pública para exibição da distribuição espacial."}
              </p>
            </div>
          ) : (
            <div className="relative w-full h-80 rounded-xl overflow-hidden border border-border bg-slate-950 flex items-center justify-center">
              {/* Grid de Coordenadas de Fundo */}
              <div
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage: `radial-gradient(#10b981 1px, transparent 1px), radial-gradient(#38bdf8 1px, transparent 1px)`,
                  backgroundSize: "32px 32px",
                  backgroundPosition: "0 0, 16px 16px",
                }}
              />

              {/* Zonas Concêntricas Térmicas */}
              <div className="absolute w-[500px] h-[500px] rounded-full border border-dashed border-emerald-500/20 pointer-events-none animate-pulse" />
              <div className="absolute w-[360px] h-[360px] rounded-full border border-emerald-500/30 bg-emerald-500/5 pointer-events-none" />
              <div className="absolute w-[220px] h-[220px] rounded-full border border-emerald-400/50 bg-emerald-500/10 pointer-events-none" />
              <div className="absolute w-[90px] h-[90px] rounded-full bg-emerald-500/25 blur-xl pointer-events-none" />

              {/* Projeção Geográfica Dinâmica dos Pinos com Coordenadas Verificadas */}
              {(() => {
                const allPoints = report.heatmapPoints.filter(
                  (p) => typeof p.lat === "number" && typeof p.lng === "number" && !isNaN(p.lat) && !isNaN(p.lng)
                );
                const clientPoint = allPoints.find((p) => p.isClient);
                const compPoints = allPoints.filter((p) => !p.isClient);
                const lats = allPoints.map((p) => p.lat);
                const lngs = allPoints.map((p) => p.lng);
                const minLat = Math.min(...lats);
                const maxLat = Math.max(...lats);
                const minLng = Math.min(...lngs);
                const maxLng = Math.max(...lngs);
                const latSpan = Math.max(0.004, maxLat - minLat);
                const lngSpan = Math.max(0.004, maxLng - minLng);

                const clientLeft =
                  clientPoint && lngSpan > 0.0005
                    ? Math.min(84, Math.max(16, 16 + ((clientPoint.lng - minLng) / lngSpan) * 68))
                    : 50;
                const clientTop =
                  clientPoint && latSpan > 0.0005
                    ? Math.min(84, Math.max(16, 16 + ((maxLat - clientPoint.lat) / latSpan) * 68))
                    : 50;

                return (
                  <>
                    {/* Pino Central da Empresa Auditada */}
                    {clientPoint && (
                      <div
                        className="absolute z-20 flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2 transition-all"
                        style={{ left: `${clientLeft}%`, top: `${clientTop}%` }}
                      >
                        <div className="relative">
                          <span className="absolute -inset-1 rounded-full bg-emerald-500 animate-ping opacity-75" />
                          <div className="relative w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shadow-lg border-2 border-white text-xs">
                            ★
                          </div>
                        </div>
                        <div className="mt-1 px-2.5 py-1 rounded-md bg-slate-900/95 border border-emerald-500 text-white text-[11px] font-bold shadow-md whitespace-nowrap">
                          {report.profile.name} (Auditado)
                        </div>
                      </div>
                    )}

                    {/* Pinos dos Concorrentes Verificados no Entorno */}
                    {compPoints.slice(0, 12).map((comp, idx) => {
                      const left = Math.min(88, Math.max(12, 16 + ((comp.lng - minLng) / lngSpan) * 68));
                      const top = Math.min(88, Math.max(12, 16 + ((maxLat - comp.lat) / latSpan) * 68));

                      return (
                        <div
                          key={comp.id}
                          className="absolute z-10 flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2 transition-all"
                          style={{ left: `${left}%`, top: `${top}%` }}
                        >
                          <div className="w-5 h-5 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-[10px] shadow-md border border-white">
                            {idx + 1}
                          </div>
                          <div className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-border text-[10px] text-slate-200 whitespace-nowrap mt-0.5 shadow">
                            {comp.name} {comp.reviewsCount ? `(${comp.reviewsCount})` : ""}
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}

              {/* Legenda do Mapa */}
              <div className="absolute bottom-3 left-3 z-20 bg-slate-900/90 border border-border/80 px-3 py-2 rounded-lg text-[11px] text-slate-300 flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span>Sua Empresa (Auditada)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span>Concorrentes Mapeados</span>
                </div>
              </div>
            </div>
          )}

          {/* Cards das Zonas de Raio */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {report.visibilityZones.map((zone) => (
              <div key={zone.radiusLabel} className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-foreground">{zone.radiusLabel}</span>
                  <span
                    className={`font-semibold ${
                      zone.status === "bom"
                        ? "text-emerald-500"
                        : zone.status === "razoavel"
                        ? "text-amber-500"
                        : "text-rose-500"
                    }`}
                  >
                    {zone.coverageScore}% de força
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      zone.status === "bom"
                        ? "bg-emerald-500"
                        : zone.status === "razoavel"
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                    style={{ width: `${zone.coverageScore}%` }}
                  />
                </div>
                <div className="text-[11px] text-muted-foreground pt-0.5">
                  {zone.competitorsInRadius} concorrentes disputando a primeira página neste raio.
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BLOCO 3: BENCHMARKING COM A CONCORRÊNCIA (PÁGINA 3 E 5 DO PDF) */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 break-inside-avoid">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                <BarChart3 className="w-4 h-4 text-primary" /> Benchmarking Competitivo Local
                {report.isRealGoogleMapsData && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Concorrentes Reais da Região
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-foreground">
                Top Empresas Mais Avaliadas no Segmento "{report.keyword}" {report.locationLabel ? `em ${report.locationLabel}` : ''}
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">
              Média do Setor: <strong className="text-foreground">{report.segmentAverageReviews > 0 ? `${report.segmentAverageReviews} avaliações` : "Não coletada"}</strong>
            </span>
          </div>

          {report.competitors.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs space-y-2 border border-dashed border-border rounded-xl">
              <BarChart3 className="w-8 h-8 text-muted-foreground/60 mx-auto" />
              <div className="font-semibold text-foreground">Concorrentes locais não coletados nesta sessão</div>
              <p>Execute a varredura da extensão Alastre Local Inspector na busca do Google Maps para identificar os concorrentes locais que disputam o Local Pack com {report.profile.name}.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {report.competitors.slice(0, 11).map((comp) => {
                const maxReviews = Math.max(1, report.topCompetitorReviews);
                const barWidth = Math.max(3, Math.min(100, Math.round((comp.reviewsCount / maxReviews) * 100)));

                return (
                  <div
                    key={comp.rank + comp.name}
                    className={`p-2.5 rounded-lg border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      comp.isCurrentClient
                        ? "border-rose-500 bg-rose-500/10 font-bold"
                        : "border-border/60 bg-muted/20"
                    }`}
                  >
                    <div className="sm:w-60 shrink-0 flex items-center gap-2">
                      <span className="w-6 text-muted-foreground text-[11px]">{comp.rank}º</span>
                      <span className={comp.isCurrentClient ? "text-rose-600 dark:text-rose-400" : "text-foreground"}>
                        {comp.name}
                      </span>
                    </div>

                    {/* Barra comparativa proporcional */}
                    <div className="flex-1 w-full bg-muted/40 h-3 rounded-full overflow-hidden mx-2">
                      <div
                        className={`h-full rounded-full ${
                          comp.isCurrentClient ? "bg-rose-500" : "bg-primary"
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    <div className="sm:w-36 shrink-0 flex items-center justify-end gap-2 text-right">
                      <span className="text-muted-foreground">★ {comp.rating.toFixed(1)}</span>
                      <strong className="text-foreground">({comp.reviewsCount.toLocaleString("pt-BR")})</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Diagnóstico da Concorrência */}
          {report.competitors.length > 0 ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs">
              <span className="text-base">⚠️</span>
              <div className="space-y-1">
                <strong className="text-foreground">Diagnóstico do Gap Competitivo:</strong>
                <p className="text-muted-foreground leading-relaxed">
                  Sua empresa possui <strong>{report.profile.reviewsCount ?? 0} avaliações</strong>, enquanto os líderes da
                  região acumulam mais de <strong>{report.topCompetitorReviews}</strong> e a média local é de{" "}
                  <strong>{report.segmentAverageReviews}</strong>. Para disputar o topo do Local Pack (3 primeiros lugares no
                  Maps), é vital acelerar a captação de novas avaliações semanais.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-muted/30 border border-border/80 flex items-start gap-3 text-xs">
              <span className="text-base">ℹ️</span>
              <div className="space-y-1">
                <strong className="text-foreground">Amostra Competitiva Pendente:</strong>
                <p className="text-muted-foreground leading-relaxed">
                  O benchmarking comparativo e o cálculo de gap serão gerados assim que você realizar a coleta dos concorrentes locais no Google Maps via extensão.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* BLOCO 4: MATRIZ DE DIAGNÓSTICO (PONTOS BONS VS O QUE PRECISA SER MELHORADO) */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5 break-inside-avoid">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Matriz de Diagnóstico Fato a Fato
              </div>
              <h3 className="text-base font-bold text-foreground">
                Auditoria dos 20 Fatores de Ranqueamento e Conversão
              </h3>
            </div>

            {/* Filtros interativos (Ocultos na impressão) */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border print:hidden text-xs">
              <button
                onClick={() => setActiveTab("todos")}
                className={`px-2.5 py-1 rounded font-semibold ${
                  activeTab === "todos" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Todos ({report.factors.length})
              </button>
              <button
                onClick={() => setActiveTab("fraco")}
                className={`px-2.5 py-1 rounded font-semibold text-rose-500 ${
                  activeTab === "fraco" ? "bg-card shadow-sm" : ""
                }`}
              >
                🔴 Fraco ({report.healthCounts.fraco})
              </button>
              <button
                onClick={() => setActiveTab("razoavel")}
                className={`px-2.5 py-1 rounded font-semibold text-amber-500 ${
                  activeTab === "razoavel" ? "bg-card shadow-sm" : ""
                }`}
              >
                🟡 Razoável ({report.healthCounts.razoavel})
              </button>
              <button
                onClick={() => setActiveTab("bom")}
                className={`px-2.5 py-1 rounded font-semibold text-emerald-500 ${
                  activeTab === "bom" ? "bg-card shadow-sm" : ""
                }`}
              >
                🟢 Bom ({report.healthCounts.bom})
              </button>
            </div>
          </div>

          {/* Grade de Fatores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFactors.map((factor) => {
              const isGood = factor.status === "bom";
              const isWarning = factor.status === "razoavel";
              const isBad = factor.status === "fraco";

              return (
                <div
                  key={factor.id}
                  className={`p-4 rounded-xl border space-y-2.5 transition-all text-xs ${
                    isBad
                      ? "border-rose-500/30 bg-rose-500/5"
                      : isWarning
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-emerald-500/30 bg-emerald-500/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                      {isGood ? "🟢" : isWarning ? "🟡" : "🔴"} {factor.title}
                    </span>
                    <span
                      className={`font-mono font-bold text-xs ${
                        isGood ? "text-emerald-600" : isWarning ? "text-amber-600" : "text-rose-600"
                      }`}
                    >
                      {factor.scorePercentage}%
                    </span>
                  </div>

                  {/* Barra de progresso do fator */}
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isGood ? "bg-emerald-500" : isWarning ? "bg-amber-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${factor.scorePercentage}%` }}
                    />
                  </div>

                  <p className="text-muted-foreground leading-relaxed">
                    <strong>Fato verificado:</strong> {factor.evidence}
                  </p>

                  {factor.recommendation && (
                    <div className="p-2 rounded bg-muted/60 border-l-2 border-primary text-[11px] text-foreground/90 space-y-0.5">
                      <strong className="text-primary flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Recomendação da Agência:
                      </strong>
                      <span>{factor.recommendation}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* BLOCO 5: PLANO ESTRATÉGICO DE 30 DIAS (FECHAMENTO COMERCIAL DA AGÊNCIA) */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4 break-inside-avoid">
          <div className="border-b border-border pb-3">
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-500" /> Proposta de Execução Estratégica
            </div>
            <h3 className="text-base font-bold text-foreground">
              Plano de Ação de 30 Dias Recomendado para {report.profile.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Roteiro de implementação das melhorias prioritárias para ultrapassar os concorrentes locais.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {report.actionPlan.map((action) => (
              <div
                key={action.week}
                className="p-4 rounded-xl border border-border bg-muted/20 space-y-2.5 flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 uppercase">
                    Mês 1
                  </span>
                  <div className="font-bold text-xs text-foreground pt-1">{action.title}</div>
                  <p className="text-[11px] text-muted-foreground">{action.focus}</p>
                </div>

                <ul className="space-y-1.5 text-[11px] text-muted-foreground pt-2 border-t border-border/60">
                  {action.deliverables.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-bold shrink-0">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* BLOCO 6: RODAPÉ DE BLINDAGEM JURÍDICA E CONFORMIDADE */}
        <footer className="pt-4 border-t border-border text-[11px] text-muted-foreground space-y-2 leading-relaxed">
          <p className="font-mono text-[10px] text-muted-foreground/80">
            {report.methodologyDisclaimer}
          </p>
          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/40">
            <span>© 2026 Alastre Platform — Governança e Inteligência Local</span>
            <span>Relatório ID: ALASTRE-AUDIT-{Date.now().toString(36).toUpperCase()}</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
