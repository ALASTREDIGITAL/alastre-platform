"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Star,
  Sparkles,
  MapPin,
  Phone,
  Globe,
  ExternalLink,
  MessageSquare,
  Image as ImageIcon,
  Award,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  Share2,
  Building2,
  UserCheck,
  ChevronRight,
  User,
  RefreshCw,
  Plus,
  ArrowUpRight,
  Filter,
  Lightbulb,
  Check,
  Copy,
  ThumbsUp,
  ShieldCheck,
  Printer,
} from "lucide-react";
import { LocalSeoExecutiveReport } from "@/components/local-seo-executive-report";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  analyzeGoogleReviews,
  BARBEARIA_DUTRA_DEMO_SNAPSHOT,
  BARBEARIA_DUTRA_DEMO_REVIEWS,
  inferCategoryFromName,
  type BusinessProfileSnapshot,
  type RawAuditReview,
  type CompleteReviewAuditResult,
} from "@/lib/review-audit-analyzer";
import {
  BEM_FEITO_REDES_DEMO_SNAPSHOT,
  BEM_FEITO_REDES_DEMO_REVIEWS,
} from "@/lib/local-seo-report-engine";

interface ReviewAuditDashboardProps {
  initialSnapshot?: BusinessProfileSnapshot;
  initialReviews?: RawAuditReview[];
  onImportAsClient?: (profile: BusinessProfileSnapshot) => void;
  initialOpenReport?: boolean;
  onOpenExecutiveReport?: () => void;
  isDemoMode?: boolean;
}

export function ReviewAuditDashboard({
  initialSnapshot,
  initialReviews,
  onImportAsClient,
  initialOpenReport = false,
  onOpenExecutiveReport,
  isDemoMode = false,
}: ReviewAuditDashboardProps) {
  const [snapshot, setSnapshot] = useState<BusinessProfileSnapshot>(() => {
    if (initialSnapshot) return initialSnapshot;
    if (typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      const cName = search.get("client_name");
      if (cName) {
        const rawCat = search.get("category") || search.get("segment");
        const resolvedCategory =
          rawCat && rawCat !== "Loja de telas" && rawCat !== "Empresa Local"
            ? rawCat
            : inferCategoryFromName(cName) || "Empresa Local";
        const cRating = search.get("rating");
        const cReviews = search.get("reviews_count");
        return {
          name: cName,
          category: resolvedCategory,
          rating: cRating ? parseFloat(cRating) : null,
          reviewsCount: cReviews ? parseInt(cReviews, 10) : null,
          address: search.get("address") || undefined,
          phone: search.get("phone") || undefined,
          website: search.get("website") || undefined,
        };
      }
      if (isDemoMode && search.get("open_report") === "true") {
        return BEM_FEITO_REDES_DEMO_SNAPSHOT;
      }
    }
    return isDemoMode
      ? BARBEARIA_DUTRA_DEMO_SNAPSHOT
      : {
          name: "Empresa em Análise",
          category: "Empresa Local",
          rating: null,
          reviewsCount: null,
        };
  });

  const [reviews, setReviews] = useState<RawAuditReview[]>(() => {
    if (initialReviews && initialReviews.length > 0) {
      return initialReviews;
    }
    if (isDemoMode) {
      if (typeof window !== "undefined") {
        const search = new URLSearchParams(window.location.search);
        const cName = search.get("client_name");
        if (cName?.toLowerCase().includes("bem feito") || search.get("open_report") === "true") {
          return BEM_FEITO_REDES_DEMO_REVIEWS;
        }
      }
      if (initialSnapshot?.name?.toLowerCase().includes("bem feito")) {
        return BEM_FEITO_REDES_DEMO_REVIEWS;
      }
      return BARBEARIA_DUTRA_DEMO_REVIEWS;
    }
    return [];
  });

  const [selectedWordFilter, setSelectedWordFilter] = useState<string | null>(null);
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showExecutiveReport, setShowExecutiveReport] = useState(initialOpenReport);
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState("");

  useEffect(() => {
    if (initialOpenReport) {
      setShowExecutiveReport(true);
    }
  }, [initialOpenReport]);

  useEffect(() => {
    if (initialSnapshot && initialSnapshot.name) {
      setSnapshot(initialSnapshot);
      if (!initialReviews || initialReviews.length === 0) {
        if (isDemoMode && initialSnapshot.name.toLowerCase().includes("bem feito")) {
          setReviews(BEM_FEITO_REDES_DEMO_REVIEWS);
        } else if (isDemoMode && initialSnapshot.name.toLowerCase().includes("barbearia")) {
          setReviews(BARBEARIA_DUTRA_DEMO_REVIEWS);
        } else {
          setReviews([]);
        }
      }
    }
  }, [initialSnapshot, initialReviews, isDemoMode]);

  useEffect(() => {
    if (initialReviews && initialReviews.length > 0) {
      setReviews(initialReviews);
    }
  }, [initialReviews]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      if (search.get("open_report") === "true" || search.get("report") === "true") {
        setShowExecutiveReport(true);
      }
      const cName = search.get("client_name");
      const cRating = search.get("rating");
      const cReviews = search.get("reviews_count");
      if (cName) {
        setSnapshot((prev) => ({
          ...prev,
          name: cName,
          category: search.get("category") || search.get("segment") || prev.category,
          phone: search.get("phone") || prev.phone,
          address: search.get("address") || prev.address,
          website: search.get("website") || prev.website,
          rating: cRating ? parseFloat(cRating) : prev.rating,
          reviewsCount: cReviews ? parseInt(cReviews, 10) : prev.reviewsCount,
        }));
        if (isDemoMode && cName.toLowerCase().includes("bem feito")) {
          setReviews(BEM_FEITO_REDES_DEMO_REVIEWS);
        }
      }

      try {
        const stored = localStorage.getItem("alastre_active_prospect_audit") || localStorage.getItem("alastre_last_review_audit");
        if (stored && (search.get("audit_session") || search.get("open_report"))) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.reviews && Array.isArray(parsed.reviews) && parsed.reviews.length > 0) {
            setReviews(parsed.reviews);
          }
          if (parsed && parsed.profile) {
            setSnapshot((prev) => ({ ...prev, ...parsed.profile }));
          }
        }
      } catch (e) {
        // ignore storage parse errors
      }
    }
  }, [isDemoMode]);

  // Processamento dos dados pelo motor analítico
  const auditResult: CompleteReviewAuditResult = useMemo(() => {
    return analyzeGoogleReviews(snapshot, reviews, isDemoMode);
  }, [snapshot, reviews, isDemoMode]);

  const { metrics, ratingDistribution, evolutionHistory, monthlyAverages, donuts, frequentWords, insights } =
    auditResult;

  // Filtro interativo por palavra clicada
  const filteredPositiveReviews = useMemo(() => {
    if (!selectedWordFilter) return auditResult.positiveReviews;
    const filterLower = selectedWordFilter.toLowerCase();
    return auditResult.positiveReviews.filter((r) =>
      r.text?.toLowerCase().includes(filterLower)
    );
  }, [auditResult.positiveReviews, selectedWordFilter]);

  function handleCopyPitch() {
    const text = `*Auditoria de Avaliações Google — ${snapshot.name}*\n\n` +
      `★ Nota Média: ${metrics.averageRating !== null ? metrics.averageRating.toFixed(1) : "—"} (${metrics.totalReviews !== null ? `${metrics.totalReviews} avaliações` : "contagem não coletada"})\n` +
      `💬 Taxa de Resposta: ${metrics.responseRatePercentage}%\n` +
      `⭐ Avaliações Positivas: ${metrics.positiveReviewsPercentage}%\n` +
      `🏆 Local Guides: ${metrics.localGuidesPercentage}%\n\n` +
      `*Diagnóstico da Agência:* Perfil com excelente reputação! Identificamos oportunidades para automatizar as respostas às avaliações com IA e acelerar a captação de novos reviews 5 estrelas.`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedPitch(true);
      setTimeout(() => setCopiedPitch(false), 2500);
    });
  }

  function handleLoadDemo() {
    setSnapshot(BARBEARIA_DUTRA_DEMO_SNAPSHOT);
    setReviews(BARBEARIA_DUTRA_DEMO_REVIEWS);
    setSelectedWordFilter(null);
  }

  function handleLoadBemFeitoRedes() {
    setSnapshot(BEM_FEITO_REDES_DEMO_SNAPSHOT);
    setReviews(BEM_FEITO_REDES_DEMO_REVIEWS);
    setSelectedWordFilter(null);
  }

  function handleApplyJson() {
    try {
      setJsonError("");
      const parsed = JSON.parse(jsonInput);
      if (Array.isArray(parsed)) {
        setReviews(parsed);
      } else if (parsed.reviews && Array.isArray(parsed.reviews)) {
        if (parsed.profile) setSnapshot((prev) => ({ ...prev, ...parsed.profile }));
        setReviews(parsed.reviews);
      } else {
        throw new Error("O JSON deve ser um array de avaliações ou um objeto com { profile, reviews }.");
      }
      setShowJsonModal(false);
      setJsonInput("");
    } catch (err: any) {
      setJsonError(err.message || "Formato JSON inválido.");
    }
  }

  // Gráfico horizontal de Votos Positivos
  const positiveVotesData = useMemo(() => {
    return [
      { star: "5 estrelas", votos: metrics.positiveReviewsCount },
      { star: "4 estrelas", votos: ratingDistribution.find((d) => d.stars === 4)?.count || 0 },
      { star: "3 estrelas", votos: ratingDistribution.find((d) => d.stars === 3)?.count || 0 },
      { star: "2 estrelas", votos: ratingDistribution.find((d) => d.stars === 2)?.count || 0 },
      { star: "1 estrela", votos: ratingDistribution.find((d) => d.stars === 1)?.count || 0 },
    ];
  }, [metrics, ratingDistribution]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* 1. TOPO / HEADER DO PERFIL (ESPELHO DO GBPCHECK) */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center font-bold text-xl text-primary">
              {snapshot.photoUrl ? (
                <img
                  src={snapshot.photoUrl}
                  alt={snapshot.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                snapshot.name.slice(0, 2).toUpperCase()
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  {snapshot.name}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" /> {snapshot.category || "Perfil Google"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Auditoria Pública (Sem API)
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center text-amber-500 font-semibold">
                  <span className="mr-1">
                    {metrics.averageRating !== null ? metrics.averageRating.toFixed(1) : "—"}
                  </span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${
                          metrics.averageRating !== null && s <= Math.round(metrics.averageRating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-muted-foreground">
                  ({metrics.totalReviews !== null ? `${metrics.totalReviews} avaliações no Google` : "Total público não coletado"})
                </span>
              </div>

              {snapshot.address && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground/80 shrink-0" />
                  <span className="truncate max-w-md">{snapshot.address}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyPitch}
              className="gap-1.5"
            >
              {copiedPitch ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copiedPitch ? "Copiado!" : "Copiar Pitch WhatsApp"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowJsonModal(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" /> Importar JSON
            </Button>

            {isDemoMode && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadBemFeitoRedes}
                  className="gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Perfil: Bem Feito Redes
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleLoadDemo}
                  className="gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" /> Demo: Barbearia Dutra
                </Button>
              </>
            )}

            <Button
              size="sm"
              onClick={() => {
                if (onOpenExecutiveReport) {
                  onOpenExecutiveReport();
                } else {
                  setShowExecutiveReport(true);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm font-semibold"
            >
              <Printer className="w-4 h-4" /> Relatório Executivo (PDF & Heatmap)
            </Button>

            {onImportAsClient && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => onImportAsClient(snapshot)}
              >
                <ArrowUpRight className="w-4 h-4" /> Importar para Carteira
              </Button>
            )}
          </div>
        </div>

        {/* Links rápidos para Google */}
        <div className="mt-4 pt-3 border-t border-border flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          {snapshot.phone && (
            <div className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" /> {snapshot.phone}
            </div>
          )}
          {snapshot.website && (
            <a
              href={snapshot.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <Globe className="w-3.5 h-3.5" /> Website Oficial <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <a
            href={snapshot.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(snapshot.name + " " + (snapshot.address || ""))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            <MapPin className="w-3.5 h-3.5" /> Ver no Google Maps <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* 2. GRADE DE 12 KPIS OFICIAIS DO GBPCHECK */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-primary" /> Métricas e Indicadores de Reputação
        </h2>

        {/* Banner de Rastreabilidade da Amostra Coletada */}
        <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-muted-foreground">
              Amostra de Auditoria: <strong className="text-foreground">{metrics.capturedReviewsCount} avaliações capturadas</strong>
              {metrics.totalReviews !== null && (
                <> de um total de <strong className="text-foreground">{metrics.totalReviews} avaliações no Google</strong></>
              )}
              {metrics.uncollectedReviewsCount !== null && metrics.uncollectedReviewsCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-medium"> ({metrics.uncollectedReviewsCount} avaliações não incluídas na amostra)</span>
              )}
            </span>
          </div>
          {metrics.capturedReviewsCount === 0 && (
            <div className="text-muted-foreground text-[11px]">
              {metrics.totalReviews !== null
                ? `O perfil possui ${metrics.totalReviews} avaliações públicas. Abra a aba "Avaliações" na página antes de auditar para capturar textos individuais.`
                : "Nenhuma avaliação capturada no DOM aberto."}
            </div>
          )}
        </div>

        {/* Linha 1 de KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-card border border-border p-3.5 rounded-xl">
            <div className="text-[11px] font-medium text-muted-foreground uppercase">Total de Avaliações</div>
            <div className="text-2xl font-bold text-foreground mt-1">
              {metrics.totalReviews !== null ? metrics.totalReviews : "—"}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {metrics.totalReviews !== null ? "Total público do perfil" : "Não coletado"}
            </div>
          </div>

          <div className="bg-card border border-border p-3.5 rounded-xl">
            <div className="text-[11px] font-medium text-muted-foreground uppercase">Respostas do Dono</div>
            <div className="text-2xl font-bold text-foreground mt-1">{metrics.ownerRepliesCount}</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
              {metrics.ownerRepliesPercentage}% respondidas
            </div>
          </div>

          <div className="bg-card border border-border p-3.5 rounded-xl">
            <div className="text-[11px] font-medium text-muted-foreground uppercase">Comentários dos Clientes</div>
            <div className="text-2xl font-bold text-foreground mt-1">{metrics.customerTextReviewsCount}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {metrics.customerTextReviewsPercentage}% das avaliações
            </div>
          </div>

          <div className="bg-card border border-border p-3.5 rounded-xl">
            <div className="text-[11px] font-medium text-muted-foreground uppercase">Média das Avaliações</div>
            <div className="text-2xl font-bold text-amber-500 mt-1 flex items-baseline gap-1">
              {metrics.averageRating !== null ? metrics.averageRating.toFixed(1) : "—"}
              {metrics.averageRating !== null && (
                <span className="text-xs font-normal text-muted-foreground">/ 5.0</span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {metrics.averageRating !== null ? "Nota consolidada" : "Sem nota"}
            </div>
          </div>

          <div className="bg-card border border-border p-3.5 rounded-xl">
            <div className="text-[11px] font-medium text-muted-foreground uppercase">Tamanho Médio</div>
            <div className="text-2xl font-bold text-foreground mt-1">{metrics.averageCommentLength}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Caracteres por texto</div>
          </div>

          <div className="bg-card border border-border p-3.5 rounded-xl">
            <div className="text-[11px] font-medium text-muted-foreground uppercase">Taxa de Resposta</div>
            <div className="text-2xl font-bold text-emerald-500 mt-1">{metrics.responseRatePercentage}%</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
              {metrics.ownerRepliesCount} respondidas
            </div>
          </div>
        </div>

        {/* Linha 2 de KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-card border border-border p-3.5 rounded-xl">
            <div className="text-[11px] font-medium text-muted-foreground uppercase">Com Fotos Adicionadas</div>
            <div className="text-2xl font-bold text-foreground mt-1">{metrics.withPhotosPercentage}%</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Presença visual</div>
          </div>

          <div className="bg-card border border-border p-3.5 rounded-xl">
            <div className="text-[11px] font-medium text-muted-foreground uppercase">Com Comentários</div>
            <div className="text-2xl font-bold text-foreground mt-1">{metrics.withCommentsPercentage}%</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {metrics.withCommentsCount} de {metrics.totalReviews}
            </div>
          </div>

          <div className="bg-card border border-border p-3.5 rounded-xl">
            <div className="text-[11px] font-medium text-muted-foreground uppercase">Local Guides</div>
            <div className="text-2xl font-bold text-orange-500 mt-1">{metrics.localGuidesPercentage}%</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {metrics.localGuidesCount} de {metrics.totalReviews}
            </div>
          </div>

          <div className="bg-card border border-border p-3.5 rounded-xl">
            <div className="text-[11px] font-medium text-muted-foreground uppercase">Com Imagens</div>
            <div className="text-2xl font-bold text-foreground mt-1">{metrics.withImagesPercentage}%</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {metrics.withImagesCount} de {metrics.totalReviews}
            </div>
          </div>

          <div className="bg-card border border-border p-3.5 rounded-xl">
            <div className="text-[11px] font-medium text-muted-foreground uppercase">Lista de Positivas</div>
            <div className="text-2xl font-bold text-emerald-500 mt-1">{metrics.positiveReviewsCount}</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
              {metrics.positiveReviewsPercentage}% (4 e 5 ★)
            </div>
          </div>

          <div className="bg-card border border-border p-3.5 rounded-xl">
            <div className="text-[11px] font-medium text-muted-foreground uppercase">Lista de Negativas</div>
            <div className="text-2xl font-bold text-rose-500 mt-1">{metrics.negativeReviewsCount}</div>
            <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-0.5">
              {metrics.negativeReviewsPercentage}% (1 a 3 ★)
            </div>
          </div>
        </div>
      </div>

      {/* 3. GRÁFICOS VISUAIS: EVOLUÇÃO, DISTRIBUIÇÃO E DONUTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Evolução da Quantidade no Último Ano */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              Evolução Da Quantidade de Avaliações no Último Ano
            </h3>
            <span className="text-xs text-muted-foreground font-medium">Acumulado</span>
          </div>
          {evolutionHistory.length === 0 ? (
            <div className="h-64 w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-border rounded-xl">
              <TrendingUp className="w-8 h-8 text-muted-foreground/50 mb-2" />
              <p className="text-xs font-semibold text-foreground">Série temporal não disponível</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Sem avaliações suficientes com data identificada para traçar o histórico de evolução.</p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolutionHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Quantidade de Avaliações"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Gráfico 2: Distribuição de Notas */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Distribuição de Notas</h3>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              {metrics.averageRating !== null ? `${metrics.averageRating.toFixed(1)} ★★★★★` : "Sem nota pública"}
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(val: any) => [`${val} avaliações`, "Total"]}
                />
                <Bar dataKey="count" name="Avaliações" radius={[4, 4, 0, 0]}>
                  {ratingDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.stars >= 4 ? "#10b981" : entry.stars === 3 ? "#f59e0b" : "#f43f5e"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Média das Avaliações Por Período (Volume + Linha de Média) */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Média Das Avaliações Por Período</h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block" /> Quantidade
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Média
              </span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyAverages} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 5]} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar yAxisId="left" dataKey="total" name="Quantidade" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="average" name="Média" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 4: Votos positivos em Avaliações (Barras Horizontais) */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Votos Positivos em Avaliações</h3>
            <span className="text-xs text-muted-foreground font-medium">Por estrelas</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={positiveVotesData} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <YAxis dataKey="star" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="votos" name="Quantidade de Avaliações" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. OS 4 DONUTS OFICIAIS DO GBPCHECK */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <PieIcon className="w-4 h-4 text-primary" /> Proporções e Comportamento dos Avaliadores
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Donut 1: Respondidas */}
          <div className="border border-border/70 rounded-xl p-4 flex flex-col items-center bg-muted/20">
            <div className="text-xs font-semibold text-foreground mb-1">Avaliações Respondidas</div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donuts.responses}
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donuts.responses.map((entry, index) => (
                      <Cell key={`cell-resp-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${v} avaliações`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground mt-1">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                ● Respondidas ({donuts.responses[0]?.percentage}%)
              </span>
              <span className="flex items-center gap-1">
                ● Sem Resposta ({donuts.responses[1]?.percentage}%)
              </span>
            </div>
          </div>

          {/* Donut 2: Comentários */}
          <div className="border border-border/70 rounded-xl p-4 flex flex-col items-center bg-muted/20">
            <div className="text-xs font-semibold text-foreground mb-1">Avaliações Com Comentários</div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donuts.comments}
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donuts.comments.map((entry, index) => (
                      <Cell key={`cell-comm-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${v} avaliações`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground mt-1">
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                ● Com Texto ({donuts.comments[0]?.percentage}%)
              </span>
              <span className="flex items-center gap-1">
                ● Só Estrelas ({donuts.comments[1]?.percentage}%)
              </span>
            </div>
          </div>

          {/* Donut 3: Imagens */}
          <div className="border border-border/70 rounded-xl p-4 flex flex-col items-center bg-muted/20">
            <div className="text-xs font-semibold text-foreground mb-1">Avaliações Com Imagens</div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donuts.images}
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donuts.images.map((entry, index) => (
                      <Cell key={`cell-img-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${v} avaliações`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground mt-1">
              <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                ● Com Fotos ({donuts.images[0]?.percentage}%)
              </span>
              <span className="flex items-center gap-1">
                ● Sem Fotos ({donuts.images[1]?.percentage}%)
              </span>
            </div>
          </div>

          {/* Donut 4: Local Guides */}
          <div className="border border-border/70 rounded-xl p-4 flex flex-col items-center bg-muted/20">
            <div className="text-xs font-semibold text-foreground mb-1">Feitas Por Local Guides</div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donuts.localGuides}
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donuts.localGuides.map((entry, index) => (
                      <Cell key={`cell-lg-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${v} avaliações`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground mt-1">
              <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-medium">
                ● Local Guides ({donuts.localGuides[0]?.percentage}%)
              </span>
              <span className="flex items-center gap-1">
                ● Normais ({donuts.localGuides[1]?.percentage}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. NUVEM / TAGS DE PALAVRAS MAIS REPETIDAS */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Palavras Mais Repetidas em Avaliações Positivas (4 a 5 estrelas)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Clique em uma palavra para filtrar os comentários relacionados abaixo.
            </p>
          </div>
          {selectedWordFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedWordFilter(null)}
              className="text-xs text-primary"
            >
              Limpar filtro ({selectedWordFilter})
            </Button>
          )}
        </div>

        {frequentWords.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-xs border border-dashed border-border rounded-lg">
            Nenhum comentário em texto disponível na amostra para análise de frequência de termos.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-2">
            {frequentWords.map((item) => {
              const isSelected = selectedWordFilter === item.word;
              return (
                <button
                  key={item.word}
                  onClick={() => setSelectedWordFilter(isSelected ? null : item.word)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all border ${
                    isSelected
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-muted/50 hover:bg-muted text-foreground border-border hover:border-emerald-500/40"
                  }`}
                >
                  <span>{item.word}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isSelected ? "bg-white/20 text-white" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. LISTA DAS PRINCIPAIS AVALIAÇÕES (POSITIVAS E NEGATIVAS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Avaliações Positivas */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Star className="w-4 h-4 fill-emerald-500 text-emerald-500" />
              Principais Avaliações Positivas (4 a 5 ★)
            </h3>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {filteredPositiveReviews.length} encontradas
            </span>
          </div>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {filteredPositiveReviews.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs space-y-2 border border-dashed border-border rounded-lg">
                <MessageSquare className="w-8 h-8 text-muted-foreground/60 mx-auto" />
                <div className="font-semibold text-foreground">Nenhuma avaliação individual em texto na amostra</div>
                <p>O perfil possui {snapshot.reviewsCount || 0} avaliações registradas no Google, mas nenhum texto de avaliação positiva individual foi obtido nesta coleta.</p>
              </div>
            ) : (
              filteredPositiveReviews.slice(0, 8).map((r, i) => (
                <div
                  key={r.id || i}
                  className="p-3.5 rounded-lg border border-border/70 bg-muted/20 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center text-xs">
                        {r.author.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          {r.author}
                          {r.isLocalGuide && (
                            <span className="px-1.5 py-0.2 text-[9px] rounded bg-orange-500/15 text-orange-600 font-bold">
                              Local Guide
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{r.relativeDate || "Google"}</div>
                      </div>
                    </div>
                    <div className="flex text-amber-400">
                      {[...Array(r.rating)].map((_, idx) => (
                        <Star key={idx} className="w-3.5 h-3.5 fill-amber-400" />
                      ))}
                    </div>
                  </div>

                  <p className="text-muted-foreground leading-relaxed pl-9">
                    {r.text}
                  </p>

                  {r.ownerReply && (
                    <div className="ml-9 p-2.5 rounded bg-muted/50 border-l-2 border-emerald-500 text-[11px] text-muted-foreground space-y-0.5">
                      <div className="font-semibold text-foreground">Resposta do proprietário:</div>
                      <p>{r.ownerReply.text}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Avaliações Negativas */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              Principais Avaliações Negativas (1, 2 e 3 ★)
            </h3>
            <span className="text-xs font-semibold text-rose-500">
              {auditResult.negativeReviews.length} encontradas
            </span>
          </div>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {auditResult.negativeReviews.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs space-y-2 border border-dashed border-border rounded-lg">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <div className="font-semibold text-foreground">
                  {reviews.length === 0
                    ? "Nenhuma avaliação individual na amostra coletada"
                    : "Nenhuma avaliação negativa registrada!"}
                </div>
                <p>
                  {reviews.length === 0
                    ? "Nenhum texto individual de avaliação foi capturado nesta auditoria pública."
                    : "O perfil analisado possui 100% de satisfação na amostra analisada."}
                </p>
              </div>
            ) : (
              auditResult.negativeReviews.map((r, i) => (
                <div
                  key={r.id || i}
                  className="p-3.5 rounded-lg border border-rose-500/20 bg-rose-500/5 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-rose-500/10 text-rose-600 font-bold flex items-center justify-center text-xs">
                        {r.author.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{r.author}</div>
                        <div className="text-[10px] text-muted-foreground">{r.relativeDate || "Google"}</div>
                      </div>
                    </div>
                    <div className="flex text-amber-400">
                      {[...Array(r.rating)].map((_, idx) => (
                        <Star key={idx} className="w-3.5 h-3.5 fill-amber-400" />
                      ))}
                    </div>
                  </div>

                  <p className="text-muted-foreground leading-relaxed pl-9">
                    {r.text}
                  </p>

                  {r.ownerReply && (
                    <div className="ml-9 p-2.5 rounded bg-muted/50 border-l-2 border-primary text-[11px] text-muted-foreground space-y-0.5">
                      <div className="font-semibold text-foreground">Resposta do proprietário:</div>
                      <p>{r.ownerReply.text}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 7. INSIGHTS COM INTELIGÊNCIA ARTIFICIAL (EXATAMENTE COMO NO GBPCHECK) */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Insights Positivos (4 a 5★)</h3>
            <p className="text-xs text-muted-foreground">
              Diagnóstico semântico automatizado com inteligência artificial para inteligência comercial.
            </p>
          </div>
        </div>

        {/* Resumo executivo */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border/80 space-y-2">
          <div className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wide">
            <Lightbulb className="w-4 h-4" /> Resumo das Avaliações
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            {insights.positive.summary}
          </p>
        </div>

        {/* Aspectos mais elogiados */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Aspectos Mais Elogiados
          </h4>

          {insights.positive.praisedAspects.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-border bg-card text-xs text-muted-foreground text-center">
              Sem dados suficientes na amostra para extrair aspectos mais elogiados.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {insights.positive.praisedAspects.map((aspect) => (
                <div
                  key={aspect.title}
                  className="p-4 rounded-xl border border-border bg-card space-y-2.5 hover:border-emerald-500/30 transition-all"
                >
                  <div className="font-bold text-sm text-foreground">{aspect.title}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {aspect.description}
                  </p>

                  <div className="space-y-1 pt-1">
                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                      Emoções citadas pelos clientes:
                    </div>
                    <div className="space-y-1">
                      {aspect.emotions.map((e, idx) => (
                        <div
                          key={idx}
                          className="text-xs italic text-foreground/80 bg-muted/40 px-2 py-1 rounded border-l-2 border-emerald-500"
                        >
                          "{e}"
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Produtos / Serviços Citados */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Produtos & Serviços Citados
          </h4>

          {insights.positive.citedProducts.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-border bg-card text-xs text-muted-foreground text-center">
              Nenhum produto ou serviço explicitamente citado nos comentários da amostra.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {insights.positive.citedProducts.map((prod) => (
                <div
                  key={prod.name}
                  className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-center justify-between gap-2"
                >
                  <span className="font-semibold text-xs text-foreground">{prod.name}</span>
                  <div className="flex gap-1">
                    {prod.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Oportunidades Identificadas */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Oportunidades de Crescimento & Posicionamento
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {insights.positive.opportunities.map((opp, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-border bg-card flex items-start gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed">{opp}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Insights Negativos (1 a 3★) */}
        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Pontos Críticos & Oportunidades de Retenção
            </h4>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            {!insights.negative.hasEnoughData ? (
              <div className="flex items-start gap-3 text-xs text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>{insights.negative.dataMessage}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-foreground/90">{insights.negative.summary}</p>
                {insights.negative.criticalAspects && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {insights.negative.criticalAspects.map((aspect) => (
                      <div
                        key={aspect.title}
                        className="p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-1.5 text-xs"
                      >
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>⚠️</span> {aspect.title}
                        </div>
                        <p className="text-muted-foreground">{aspect.complaint}</p>
                        <p className="text-primary font-medium">{aspect.suggestion}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL PARA IMPORTAR JSON MANUALMENTE */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" /> Importar Dados de Avaliações (JSON)
              </h3>
              <button
                onClick={() => setShowJsonModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Cole o JSON exportado da extensão Alastre Local Inspector ou um array compatível com o formato de avaliações.
            </p>

            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={8}
              placeholder='[ { "author": "Cliente", "rating": 5, "text": "Excelente!" } ]'
              className="w-full p-3 rounded-lg border border-border bg-background font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />

            {jsonError && (
              <div className="text-xs text-rose-500 font-medium">{jsonError}</div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowJsonModal(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleApplyJson} disabled={!jsonInput.trim()}>
                Carregar Análise
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RELATÓRIO EXECUTIVO PARA O CLIENTE (MODAL DE IMPRESSÃO & PDF) */}
      {showExecutiveReport && (
        <LocalSeoExecutiveReport
          initialSnapshot={snapshot}
          initialReviews={reviews}
          isDemoMode={isDemoMode}
          keyword={
            snapshot.category && snapshot.category !== "Loja de telas"
              ? snapshot.category
              : inferCategoryFromName(snapshot.name) || "Empresa Local"
          }
          locationLabel={snapshot.address || "Região Metropolitana"}
          onClose={() => setShowExecutiveReport(false)}
        />
      )}
    </div>
  );
}
