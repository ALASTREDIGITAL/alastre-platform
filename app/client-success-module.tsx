"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  HeartPulse,
  Award,
  Calendar,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  LogOut,
  History,
  Plus,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Search,
  CheckSquare,
  Sparkles,
  Lock,
} from "lucide-react";
import {
  calculateClientHealthScore,
  NO_RANKING_PROMISE_DISCLAIMER,
  type ClientHealthScoreResult,
  type ClientScorecard,
  type ClientMeeting,
  type ClientMeetingDecision,
  type ChurnRiskAssessment,
  type ExpansionRecommendation,
  type CancellationRequest,
  type OffboardingInventory,
  type PrimaryCauseType,
  type HealthScoreStatus,
  type DataCoverageStatus,
} from "@/lib/client-success-domain";
import { useAuth } from "@/lib/auth-context";

export interface ClientSuccessModuleProps {
  onNavigate?: (view: string) => void;
  selectedClientId?: string;
}

export function ClientSuccessModule({
  onNavigate,
  selectedClientId: initialClientId,
}: ClientSuccessModuleProps) {
  const { actor } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "carteira" | "scorecard" | "reunioes" | "riscos" | "renovacao" | "expansao" | "offboarding" | "historico"
  >("carteira");
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States para dados
  const [healthScores, setHealthScores] = useState<ClientHealthScoreResult[]>([]);
  const [scorecards, setScorecards] = useState<ClientScorecard[]>([]);
  const [meetings, setMeetings] = useState<ClientMeeting[]>([]);
  const [churnAssessments, setChurnAssessments] = useState<ChurnRiskAssessment[]>([]);
  const [expansionRecommendations, setExpansionRecommendations] = useState<ExpansionRecommendation[]>([]);
  const [cancellationRequests, setCancellationRequests] = useState<CancellationRequest[]>([]);
  const [offboardingInventories, setOffboardingInventories] = useState<OffboardingInventory[]>([]);

  // Filtros
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId || "");

  // Modal forms states
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showScorecardModal, setShowScorecardModal] = useState(false);
  const [showChurnModal, setShowChurnModal] = useState(false);
  const [showExpansionModal, setShowExpansionModal] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);

  // Form inputs
  const [formClientId, setFormClientId] = useState(initialClientId || "11111111-1111-4111-a111-111111111111");
  const [formDeliveryScore, setFormDeliveryScore] = useState<number>(85);
  const [formQualityScore, setFormQualityScore] = useState<number>(90);
  const [formCooperationScore, setFormCooperationScore] = useState<number>(70);
  const [formValueScore, setFormValueScore] = useState<number>(80);
  const [formIndicatorScore, setFormIndicatorScore] = useState<number>(75);
  const [formCauseAlastre, setFormCauseAlastre] = useState<number>(0);
  const [formCauseClient, setFormCauseClient] = useState<number>(1);
  const [formCauseChannel, setFormCauseChannel] = useState<number>(0);

  // Reunião form
  const [meetingObjective, setMeetingObjective] = useState("");
  const [meetingParticipants, setMeetingParticipants] = useState("");
  const [meetingDecisionText, setMeetingDecisionText] = useState("");

  // Expansão form
  const [expType, setExpType] = useState<"renewal" | "scope_review" | "expansion_unit" | "expansion_service" | "upsell" | "downsell">("expansion_service");
  const [expTargetService, setExpTargetService] = useState("");
  const [expFitRationale, setExpFitRationale] = useState("");
  const [expValueRationale, setExpValueRationale] = useState("");
  const [expImpactAssessment, setExpImpactAssessment] = useState("");

  // Cancelamento form
  const [cancMotive, setCancMotive] = useState("");
  const [cancDetails, setCancDetails] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = selectedClientId ? `?client_id=${encodeURIComponent(selectedClientId)}` : "";
      const res = await fetch(`/api/client-success${q}`);
      if (!res.ok) {
        throw new Error(`Falha ao carregar dados de CS: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.success) {
        setHealthScores(data.healthScores || []);
        setScorecards(data.scorecards || []);
        setMeetings(data.meetings || []);
        setChurnAssessments(data.churnAssessments || []);
        setExpansionRecommendations(data.expansionRecommendations || []);
        setCancellationRequests(data.cancellationRequests || []);
        setOffboardingInventories(data.offboardingInventories || []);
      } else {
        throw new Error(data.error || "Erro desconhecido ao buscar dados de CS");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar dados";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedClientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handler para calcular Health Score
  const handleCalculateHealth = async () => {
    try {
      const res = await fetch("/api/client-success", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "calculate_health",
          client_id: formClientId,
          operational_delivery: { score: formDeliveryScore, weight: 1, data_available: true },
          quality_compliance: { score: formQualityScore, weight: 1, data_available: true },
          client_cooperation: { score: formCooperationScore, weight: 1, data_available: true },
          perceived_value: { score: formValueScore, weight: 1, data_available: true },
          indicator_evolution: { score: formIndicatorScore, weight: 1, data_available: true },
          churn_risk_factor: { score: 85, weight: 1, data_available: true },
          active_scope: { score: 90, weight: 1, data_available: true },
          cause_breakdown: {
            alastre_issues_count: formCauseAlastre,
            channel_limitations_count: formCauseChannel,
            client_dependencies_count: formCauseClient,
            insufficient_data_fields: [],
          },
        }),
      });
      if (res.ok) {
        setShowHealthModal(false);
        fetchData();
      } else {
        const d = await res.json();
        alert(`Erro ao calcular score: ${d.error || "Tente novamente"}`);
      }
    } catch (e: unknown) {
      alert("Falha na requisição ao calcular health score");
    }
  };

  // Handler para registrar reunião
  const handleCreateMeeting = async () => {
    if (!meetingObjective.trim() || !meetingParticipants.trim()) {
      alert("Objetivo e participantes são obrigatórios.");
      return;
    }
    try {
      const res = await fetch("/api/client-success", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_meeting",
          client_id: formClientId,
          objective: meetingObjective,
          participants: meetingParticipants.split(",").map((p) => p.trim()),
          analyzed_data_summary: "Reunião de alinhamento estratégico e apresentação de resultados.",
          risks_identified: ["Atraso no envio de materiais pelo cliente"],
          next_steps: ["Validação do relatório quinzenal"],
        }),
      });
      if (res.ok) {
        const d = await res.json();
        if (meetingDecisionText.trim() && d.meeting) {
          await fetch("/api/client-success", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "create_meeting_decision",
              meeting_id: d.meeting.id,
              client_id: formClientId,
              decision: meetingDecisionText,
              responsible_actor_id: actor?.actorId || "operador-cs",
            }),
          });
        }
        setShowMeetingModal(false);
        setMeetingObjective("");
        setMeetingParticipants("");
        setMeetingDecisionText("");
        fetchData();
      }
    } catch (e) {
      alert("Erro ao registrar reunião");
    }
  };

  // Convert decision to work item in Module 04
  const handleConvertDecisionToTask = async (meetingId: string, decisionId: string, decisionText: string) => {
    try {
      const res = await fetch("/api/client-success", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "convert_decision_to_work_item",
          decision_id: decisionId,
          meeting_id: meetingId,
          client_id: formClientId,
          title: decisionText,
          description: `Decisão de Reunião CS: ${decisionText}`,
          assignee_id: actor?.actorId || "operador-cs",
        }),
      });
      if (res.ok) {
        alert("Tarefa criada com sucesso no Motor de Operações (Módulo 04)!");
        fetchData();
      }
    } catch {
      alert("Falha ao converter decisão em tarefa.");
    }
  };

  // Handler para criar Recomendação de Expansão
  const handleCreateExpansion = async () => {
    if (expFitRationale.length < 10 || expValueRationale.length < 10 || expImpactAssessment.length < 10) {
      alert("Todas as justificativas devem conter ao menos 10 caracteres.");
      return;
    }
    try {
      const res = await fetch("/api/client-success", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_expansion_recommendation",
          client_id: formClientId,
          type: expType,
          target_service_name: expTargetService || "Expansão de Serviço Local SEO",
          demonstrated_fit_rationale: expFitRationale,
          evidenced_value_rationale: expValueRationale,
          operational_impact_assessment: expImpactAssessment,
        }),
      });
      if (res.ok) {
        setShowExpansionModal(false);
        setExpFitRationale("");
        setExpValueRationale("");
        setExpImpactAssessment("");
        fetchData();
      } else {
        const d = await res.json();
        alert(d.error || "Erro ao registrar recomendação");
      }
    } catch {
      alert("Erro na chamada de expansão");
    }
  };

  // Handler para aprovar expansão
  const handleApproveExpansion = async (recId: string, decision: "approved" | "rejected") => {
    try {
      const res = await fetch("/api/client-success", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_expansion",
          recommendation_id: recId,
          client_id: formClientId,
          decision,
          actor_id: actor?.actorId || "gestor-cs",
        }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch {
      alert("Falha ao aprovar expansão");
    }
  };

  // Handler para solicitação de cancelamento
  const handleCreateCancellation = async () => {
    if (!cancMotive.trim()) {
      alert("Motivo principal é obrigatório");
      return;
    }
    try {
      const res = await fetch("/api/client-success", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_cancellation_request",
          client_id: formClientId,
          primary_motive: cancMotive,
          detailed_reason: cancDetails,
          transition_plan: "Plano de transição de 30 dias com inventário de acessos a revogar.",
        }),
      });
      if (res.ok) {
        setShowCancellationModal(false);
        setCancMotive("");
        setCancDetails("");
        fetchData();
      }
    } catch {
      alert("Erro ao registrar cancelamento");
    }
  };

  // Helpers de Formatação
  const getStatusBadge = (status: HealthScoreStatus, dataStatus: DataCoverageStatus) => {
    if (dataStatus === "insufficient") {
      return (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5" /> Dados Insuficientes (N/D)
        </span>
      );
    }
    switch (status) {
      case "excellent":
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Excelente
          </span>
        );
      case "good":
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saudável
          </span>
        );
      case "attention":
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Atenção Necessária
          </span>
        );
      case "critical":
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Risco Crítico
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
            N/D
          </span>
        );
    }
  };

  const getCauseLabel = (cause: PrimaryCauseType) => {
    switch (cause) {
      case "alastre_delivery_failure":
        return <span className="text-rose-400 font-medium">Falha Operacional da Alastre</span>;
      case "channel_limitation":
        return <span className="text-amber-400 font-medium">Limitação/Indisponibilidade do Canal</span>;
      case "client_dependency_failure":
        return <span className="text-blue-400 font-medium">Dependência / Atraso do Cliente</span>;
      case "insufficient_data":
        return <span className="text-neutral-400 font-medium">Dados Insuficientes para Diagnóstico</span>;
      default:
        return <span className="text-emerald-400 font-medium">Sem Falhas Registradas</span>;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-4 sm:p-6 text-foreground">
      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/50 rounded-xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Central de Sucesso do Cliente</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Módulo 07 — Transformação de execução em valor, retenção saudável e expansão orientada a dados.
              </p>
            </div>
          </div>
        </div>

        {/* Alternador Modo Simples / Modo Avançado */}
        <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-lg border border-border/40">
          <span className="text-xs font-medium text-muted-foreground">
            {isAdvancedMode ? "Modo Avançado (Técnico)" : "Modo Simples (Operador)"}
          </span>
          <button
            onClick={() => setIsAdvancedMode(!isAdvancedMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              isAdvancedMode ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isAdvancedMode ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <button
            onClick={fetchData}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Alerta de Isenção de Promessa Externa */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-500 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>{NO_RANKING_PROMISE_DISCLAIMER}</span>
      </div>

      {/* Navegação por Abas (8 Abas Sugeridas) */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("carteira")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "carteira"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <HeartPulse className="w-4 h-4" />
          Carteira & Health Score
        </button>

        <button
          onClick={() => setActiveTab("scorecard")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "scorecard"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Award className="w-4 h-4" />
          Scorecard de Valor
        </button>

        <button
          onClick={() => setActiveTab("reunioes")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "reunioes"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Reuniões e Decisões
        </button>

        <button
          onClick={() => setActiveTab("riscos")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "riscos"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Riscos e Recuperação
        </button>

        <button
          onClick={() => setActiveTab("renovacao")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "renovacao"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Renovação e Escopo
        </button>

        <button
          onClick={() => setActiveTab("expansao")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "expansao"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Expansão (Upsell)
        </button>

        <button
          onClick={() => setActiveTab("offboarding")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "offboarding"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LogOut className="w-4 h-4" />
          Cancelamento & Offboarding
        </button>

        <button
          onClick={() => setActiveTab("historico")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "historico"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="w-4 h-4" />
          Histórico & Auditoria
        </button>
      </div>

      {/* Conteúdo Principal das Abas */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card border border-border/50 rounded-xl">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Carregando dados de Sucesso do Cliente...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-sm">
          <div className="font-semibold flex items-center gap-2 mb-1">
            <XCircle className="w-5 h-5" /> Erro ao carregar Sucesso do Cliente
          </div>
          <p>{error}</p>
        </div>
      ) : (
        <>
          {/* TAB 1: CARTEIRA & HEALTH SCORE */}
          {activeTab === "carteira" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Saúde da Carteira de Clientes</h2>
                  <p className="text-xs text-muted-foreground">
                    Pontuação explicável, decomponível e com separação rigorosa de causas e cobertura de dados.
                  </p>
                </div>
                <button
                  onClick={() => setShowHealthModal(true)}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Novo Cálculo de Health Score
                </button>
              </div>

              {healthScores.length === 0 ? (
                <div className="p-8 text-center bg-card border border-border/50 rounded-xl">
                  <HeartPulse className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <h3 className="text-base font-semibold">Nenhum Health Score Calculado</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    Não existem scores computados para a carteira nesta agência. Clique em "Novo Cálculo" para registrar o diagnóstico inicial.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {healthScores.map((h, i) => (
                    <div
                      key={i}
                      className="bg-card border border-border/60 rounded-xl p-5 space-y-4 hover:border-border/90 transition-all shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-mono text-muted-foreground block">
                            Cliente ID: {isAdvancedMode ? h.client_id : h.client_id.substring(0, 8) + "..."}
                          </span>
                          <div className="text-2xl font-bold mt-1">
                            {h.data_status === "insufficient" ? "N/D" : `${h.overall_score}/100`}
                          </div>
                        </div>
                        {getStatusBadge(h.status, h.data_status)}
                      </div>

                      {/* Cobertura de Dados */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground font-medium">Cobertura de Dados</span>
                          <span className="font-semibold">{h.coverage_pct}%</span>
                        </div>
                        <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              h.coverage_pct >= 80
                                ? "bg-emerald-500"
                                : h.coverage_pct >= 30
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                            style={{ width: `${h.coverage_pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Pilares Decompostos */}
                      <div className="space-y-2 pt-2 border-t border-border/40 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Entrega & SLA (Módulo 04):</span>
                          <span className="font-medium">
                            {h.operational_delivery_score !== null ? `${h.operational_delivery_score} pts` : "Sem dados"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Qualidade & Evidências (Módulo 06):</span>
                          <span className="font-medium">
                            {h.quality_compliance_score !== null ? `${h.quality_compliance_score} pts` : "Sem dados"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Cooperação / Pendências do Cliente:</span>
                          <span className="font-medium">
                            {h.client_cooperation_score !== null ? `${h.client_cooperation_score} pts` : "Sem dados"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Evolução do SEO Local (Módulo 05):</span>
                          <span className="font-medium">
                            {h.indicator_evolution_score !== null ? `${h.indicator_evolution_score} pts` : "Sem dados"}
                          </span>
                        </div>
                      </div>

                      {/* Segregação de Causas */}
                      <div className="pt-2 border-t border-border/40 text-xs space-y-1">
                        <span className="text-muted-foreground block font-medium">Causa Primária de Inconsistência:</span>
                        <div>{getCauseLabel(h.primary_cause)}</div>
                      </div>

                      {isAdvancedMode && (
                        <div className="p-2.5 bg-muted/40 rounded-lg text-[11px] font-mono space-y-1 text-muted-foreground">
                          <div>alastre_issues: {h.cause_breakdown.alastre_issues_count}</div>
                          <div>channel_limitations: {h.cause_breakdown.channel_limitations_count}</div>
                          <div>client_dependencies: {h.cause_breakdown.client_dependencies_count}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SCORECARD DE VALOR */}
          {activeTab === "scorecard" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Scorecards de Valor do Cliente</h2>
                  <p className="text-xs text-muted-foreground">
                    Relatórios consolidados de entregas verificáveis, evidências e recomendações sem promessa de resultados externos.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const res = await fetch("/api/client-success", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "create_scorecard",
                        client_id: formClientId,
                        period_label: "Setembro / 2026",
                        health_score_snapshot: 82,
                        completed_deliveries_count: 14,
                        verified_evidences_count: 12,
                        observed_indicators: { local_seo_score: 78, keywords_ranked: 15 },
                        collection_limitations: ["GBP API aguardando aprovação remota Google"],
                        improvements_implemented: ["Otimização de categorias primárias", "Inclusão de geotags em 20 fotos"],
                        client_pendencies: ["Aprovação do orçamento de fotos 360"],
                        next_steps: ["Reunião mensal de alinhamento", "Auditoria de citações em diretórios"],
                        recommendations: [
                          {
                            id: "rec_1",
                            title: "Expansão para Unidade Centro",
                            rationale: "Fit demonstrado na matriz e SEO Local consolidado na unidade principal",
                            type: "expansion",
                          },
                        ],
                      }),
                    });
                    if (res.ok) fetchData();
                  }}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Gerar Scorecard Periódico
                </button>
              </div>

              {scorecards.length === 0 ? (
                <div className="p-8 text-center bg-card border border-border/50 rounded-xl">
                  <Award className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <h3 className="text-base font-semibold">Nenhum Scorecard Gerado</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    Scorecards de valor reúnem evidências do Módulo 06 e indicadores do Módulo 05 para prestação de contas transparente.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scorecards.map((sc, idx) => (
                    <div key={idx} className="bg-card border border-border/60 rounded-xl p-6 space-y-4 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/40">
                        <div>
                          <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                            {sc.period_label}
                          </span>
                          <h3 className="text-lg font-bold">Relatório Periódico de Entregas & Valor</h3>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground block">Health Score Snapshot</span>
                            <span className="text-lg font-bold text-emerald-500">{sc.health_score_snapshot}/100</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-3.5 bg-muted/30 rounded-lg border border-border/40">
                          <span className="text-xs font-medium text-muted-foreground block mb-1">
                            Entregas Concluídas (Módulo 04)
                          </span>
                          <span className="text-xl font-bold">{sc.completed_deliveries_count} tarefas</span>
                        </div>
                        <div className="p-3.5 bg-muted/30 rounded-lg border border-border/40">
                          <span className="text-xs font-medium text-muted-foreground block mb-1">
                            Evidências Verificadas (Módulo 06)
                          </span>
                          <span className="text-xl font-bold text-emerald-500">{sc.verified_evidences_count} evidências</span>
                        </div>
                        <div className="p-3.5 bg-muted/30 rounded-lg border border-border/40">
                          <span className="text-xs font-medium text-muted-foreground block mb-1">
                            Limitações de Coleta
                          </span>
                          <span className="text-sm font-semibold text-amber-500">
                            {sc.collection_limitations.length} observações
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
                        <div className="space-y-1.5">
                          <span className="font-semibold text-foreground block">Melhorias Implementadas:</span>
                          <ul className="list-disc list-inside text-muted-foreground space-y-1">
                            {sc.improvements_implemented.map((imp, i) => (
                              <li key={i}>{imp}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-1.5">
                          <span className="font-semibold text-foreground block">Pendências e Dependências do Cliente:</span>
                          <ul className="list-disc list-inside text-amber-500/90 space-y-1">
                            {sc.client_pendencies.map((p, i) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {sc.recommendations.length > 0 && (
                        <div className="pt-3 border-t border-border/40">
                          <span className="text-xs font-semibold text-foreground block mb-2">Recomendações Fundamentadas:</span>
                          <div className="space-y-2">
                            {sc.recommendations.map((rec, i) => (
                              <div key={i} className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs">
                                <div className="font-semibold text-primary">{rec.title}</div>
                                <div className="text-muted-foreground mt-0.5">{rec.rationale}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-[11px] text-muted-foreground/80 italic pt-2 border-t border-border/30">
                        {sc.disclaimer_no_guarantee}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REUNIÕES E DECISÕES */}
          {activeTab === "reunioes" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Agenda e Registro de Reuniões</h2>
                  <p className="text-xs text-muted-foreground">
                    Reuniões orientadas a decisão com vínculo automático a tarefas operacionais no Motor de Operações (Módulo 04).
                  </p>
                </div>
                <button
                  onClick={() => setShowMeetingModal(true)}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Nova Reunião de CS
                </button>
              </div>

              {meetings.length === 0 ? (
                <div className="p-8 text-center bg-card border border-border/50 rounded-xl">
                  <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <h3 className="text-base font-semibold">Nenhuma Reunião Registrada</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    Registre reuniões de alinhamento com clientes e transforme decisões acionáveis em tarefas operacionais.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {meetings.map((m, idx) => (
                    <div key={idx} className="bg-card border border-border/60 rounded-xl p-5 space-y-4 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                              {new Date(m.meeting_date).toLocaleDateString("pt-BR")}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              ID: {isAdvancedMode ? m.id : m.id.substring(0, 8)}
                            </span>
                          </div>
                          <h3 className="text-base font-bold mt-1">{m.objective}</h3>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Participantes:</span> {m.participants.join(", ")}
                      </div>

                      {m.analyzed_data_summary && (
                        <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground block mb-0.5">Dados Analisados:</span>
                          {m.analyzed_data_summary}
                        </div>
                      )}

                      {/* Decisões e Botão para Converter em Work Item */}
                      <div className="space-y-2 pt-2 border-t border-border/40">
                        <span className="text-xs font-semibold text-foreground block">Decisões Acionáveis:</span>
                        {m.decisions && m.decisions.length > 0 ? (
                          m.decisions.map((dec, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-3 bg-muted/40 border border-border/50 rounded-lg text-xs"
                            >
                              <div>
                                <span className="font-medium text-foreground block">{dec.decision}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  Responsável: {dec.responsible_actor_id} | Status:{" "}
                                  <strong className="text-primary">{dec.status}</strong>
                                </span>
                              </div>
                              {dec.status !== "converted_to_task" ? (
                                <button
                                  onClick={() => handleConvertDecisionToTask(m.id, dec.id, dec.decision)}
                                  className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md font-medium flex items-center gap-1.5 transition-colors"
                                >
                                  <CheckSquare className="w-3.5 h-3.5" /> Criar Tarefa (Módulo 04)
                                </button>
                              ) : (
                                <span className="text-xs font-medium text-emerald-500 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Tarefa Gerada
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-muted-foreground italic">Nenhuma decisão registrada nesta reunião.</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RISCOS E RECUPERAÇÃO */}
          {activeTab === "riscos" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Gestão de Risco de Churn e Recuperação</h2>
                  <p className="text-xs text-muted-foreground">
                    Sinais observados, severidade e planos de recuperação com geração de tarefas corretivas.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const res = await fetch("/api/client-success", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "create_churn_assessment",
                        client_id: formClientId,
                        risk_severity: "high",
                        confidence_level: "high",
                        data_coverage_pct: 85,
                        reason_summary: "Atraso recorrente no envio de aprovações e redução de engajamento do ponto de contato.",
                        signals: [
                          {
                            id: "sig_1",
                            signal_type: "unresponsive_client",
                            severity: "high",
                            description: "Cliente não respondeu mensagens há 14 dias",
                            detected_at: new Date().toISOString(),
                          },
                        ],
                        recovery_plan_summary: "Reunião emergencial de alinhamento com diretoria e facilitação de aprovações.",
                      }),
                    });
                    if (res.ok) fetchData();
                  }}
                  className="px-4 py-2 text-sm font-medium bg-rose-500 text-white rounded-lg hover:bg-rose-600 flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Registrar Risco de Churn
                </button>
              </div>

              {churnAssessments.length === 0 ? (
                <div className="p-8 text-center bg-card border border-border/50 rounded-xl">
                  <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <h3 className="text-base font-semibold">Nenhum Risco Ativo Identificado</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    Acompanhe sinais prévios de churn com nível de confiança e plano atômico de recuperação.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {churnAssessments.map((ca, idx) => (
                    <div key={idx} className="bg-card border border-border/60 rounded-xl p-5 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between pb-2 border-b border-border/40">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase">
                            Severidade: {ca.risk_severity}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Confiança: <strong>{ca.confidence_level}</strong> | Cobertura: <strong>{ca.data_coverage_pct}%</strong>
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ca.assessed_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-foreground">{ca.reason_summary}</p>

                      {ca.recovery_plan_summary && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs space-y-2">
                          <div className="font-semibold text-amber-500">Plano de Recuperação:</div>
                          <p className="text-muted-foreground">{ca.recovery_plan_summary}</p>
                          <button
                            onClick={async () => {
                              const res = await fetch("/api/client-success", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  action: "create_recovery_task",
                                  assessment_id: ca.id,
                                  client_id: formClientId,
                                  title: "Reunião Emergencial de Recuperação de Conta",
                                  description: ca.recovery_plan_summary,
                                  assignee_id: actor?.actorId || "gestor-cs",
                                }),
                              });
                              if (res.ok) {
                                alert("Tarefa de recuperação criada no Módulo 04!");
                                fetchData();
                              }
                            }}
                            className="px-3 py-1.5 bg-amber-500 text-white rounded font-medium text-xs flex items-center gap-1 mt-2 hover:bg-amber-600 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" /> Gerar Tarefa de Recuperação (Módulo 04)
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5 & 6: RENOVAÇÃO & EXPANSÃO */}
          {(activeTab === "renovacao" || activeTab === "expansao") && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {activeTab === "renovacao" ? "Renovação e Revisão de Escopo" : "Expansão por Serviço ou Unidade"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Recomendações fundamentadas com fit demonstrado, valor evidenciado e esteira de aprovação humana.
                  </p>
                </div>
                <button
                  onClick={() => setShowExpansionModal(true)}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Nova Recomendação de Expansão
                </button>
              </div>

              {expansionRecommendations.length === 0 ? (
                <div className="p-8 text-center bg-card border border-border/50 rounded-xl">
                  <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <h3 className="text-base font-semibold">Nenhuma Oportunidade de Expansão Ativa</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    Toda expansão de escopo exige fit técnico comprovado e aprovação humana explícita antes da transição comercial.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {expansionRecommendations.map((exp, idx) => (
                    <div key={idx} className="bg-card border border-border/60 rounded-xl p-5 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between pb-2 border-b border-border/40">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-primary/10 text-primary border border-primary/20 uppercase">
                            Tipo: {exp.type}
                          </span>
                          <span className="text-xs font-semibold text-foreground">
                            {exp.target_service_name || "Serviço Adicional"}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            exp.human_approval_status === "approved"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : exp.human_approval_status === "rejected"
                              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                          }`}
                        >
                          Aprovação: {exp.human_approval_status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <span className="font-semibold text-foreground block mb-1">Fit Demonstrado:</span>
                          <p className="text-muted-foreground">{exp.demonstrated_fit_rationale}</p>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <span className="font-semibold text-foreground block mb-1">Valor Evidenciado:</span>
                          <p className="text-muted-foreground">{exp.evidenced_value_rationale}</p>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <span className="font-semibold text-foreground block mb-1">Impacto Operacional:</span>
                          <p className="text-muted-foreground">{exp.operational_impact_assessment}</p>
                        </div>
                      </div>

                      {exp.human_approval_status === "pending" && (
                        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                          <button
                            onClick={() => handleApproveExpansion(exp.id, "approved")}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar Recomendação
                          </button>
                          <button
                            onClick={() => handleApproveExpansion(exp.id, "rejected")}
                            className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded hover:bg-rose-700 transition-colors flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Rejeitar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: CANCELAMENTO & OFFBOARDING */}
          {activeTab === "offboarding" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Solicitação de Cancelamento & Inventário de Offboarding</h2>
                  <p className="text-xs text-muted-foreground">
                    Desativação segura de conta, tarefas de transição, retenção de histórico de auditoria e revogação de acessos.
                  </p>
                </div>
                <button
                  onClick={() => setShowCancellationModal(true)}
                  className="px-4 py-2 text-sm font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 flex items-center gap-2 transition-colors shadow-sm"
                >
                  <LogOut className="w-4 h-4" /> Solicitar Cancelamento
                </button>
              </div>

              {cancellationRequests.length === 0 ? (
                <div className="p-8 text-center bg-card border border-border/50 rounded-xl">
                  <LogOut className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <h3 className="text-base font-semibold">Nenhuma Solicitação de Cancelamento</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    O offboarding preserva integralmente as evidências e o histórico de auditoria do cliente sem exclusões destrutivas.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cancellationRequests.map((canc, idx) => (
                    <div key={idx} className="bg-card border border-border/60 rounded-xl p-5 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between pb-2 border-b border-border/40">
                        <div>
                          <span className="text-xs font-mono text-muted-foreground">
                            Solicitado em: {new Date(canc.request_date).toLocaleDateString("pt-BR")}
                          </span>
                          <h3 className="text-base font-bold text-rose-400">Motivo: {canc.primary_motive}</h3>
                        </div>
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          Status: {canc.status}
                        </span>
                      </div>

                      {canc.transition_plan && (
                        <div className="p-3 bg-muted/30 rounded-lg text-xs">
                          <span className="font-semibold text-foreground block mb-1">Plano de Transição:</span>
                          <p className="text-muted-foreground">{canc.transition_plan}</p>
                        </div>
                      )}

                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs space-y-1 text-amber-500">
                        <div className="font-semibold flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" /> Política de Retenção de Dados e Auditoria
                        </div>
                        <p className="text-amber-500/90">
                          Nenhum dado ou evidência é apagado. Os acessos aos sistemas externos são revogados por tarefas operacionais internas.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 8: HISTÓRICO & AUDITORIA */}
          {activeTab === "historico" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Histórico e Auditoria de Sucesso do Cliente</h2>
                <p className="text-xs text-muted-foreground">
                  Trilha imutável de alterações, registros de health score, scorecards, reuniões e eventos do cliente.
                </p>
              </div>

              <div className="bg-card border border-border/60 rounded-xl p-6 text-xs space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <History className="w-5 h-5 text-primary flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-foreground block">Auditoria Ativa por Tenant (`agency_id`)</span>
                    <span className="text-muted-foreground">
                      Todas as ações e eventos de Sucesso do Cliente são auditados via `audit_events`.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: NOVO HEALTH SCORE */}
      {showHealthModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold">Novo Cálculo de Health Score</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">ID do Cliente</label>
                <input
                  type="text"
                  value={formClientId}
                  onChange={(e) => setFormClientId(e.target.value)}
                  className="w-full p-2 bg-muted/40 border border-border rounded-md text-foreground font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Entrega Operacional (0-100)</label>
                  <input
                    type="number"
                    value={formDeliveryScore}
                    onChange={(e) => setFormDeliveryScore(Number(e.target.value))}
                    className="w-full p-2 bg-muted/40 border border-border rounded-md text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Qualidade & Evidências (0-100)</label>
                  <input
                    type="number"
                    value={formQualityScore}
                    onChange={(e) => setFormQualityScore(Number(e.target.value))}
                    className="w-full p-2 bg-muted/40 border border-border rounded-md text-foreground"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Cooperação do Cliente (0-100)</label>
                  <input
                    type="number"
                    value={formCooperationScore}
                    onChange={(e) => setFormCooperationScore(Number(e.target.value))}
                    className="w-full p-2 bg-muted/40 border border-border rounded-md text-foreground"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Percepção de Valor (0-100)</label>
                  <input
                    type="number"
                    value={formValueScore}
                    onChange={(e) => setFormValueScore(Number(e.target.value))}
                    className="w-full p-2 bg-muted/40 border border-border rounded-md text-foreground"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
              <button
                onClick={() => setShowHealthModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleCalculateHealth}
                className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Calcular e Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA REUNIÃO */}
      {showMeetingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold">Registrar Reunião de CS</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Objetivo da Reunião</label>
                <input
                  type="text"
                  placeholder="Ex: Alinhamento trimestral de resultados e aprovações"
                  value={meetingObjective}
                  onChange={(e) => setMeetingObjective(e.target.value)}
                  className="w-full p-2 bg-muted/40 border border-border rounded-md text-foreground"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Participantes (separados por vírgula)</label>
                <input
                  type="text"
                  placeholder="Carlos (Cliente), Ana (CS Alastre), Pedro (Operação)"
                  value={meetingParticipants}
                  onChange={(e) => setMeetingParticipants(e.target.value)}
                  className="w-full p-2 bg-muted/40 border border-border rounded-md text-foreground"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Decisão Acionável Aprovada</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Cliente autoriza expansão do SEO Local para nova unidade no Centro"
                  value={meetingDecisionText}
                  onChange={(e) => setMeetingDecisionText(e.target.value)}
                  className="w-full p-2 bg-muted/40 border border-border rounded-md text-foreground"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
              <button
                onClick={() => setShowMeetingModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateMeeting}
                className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Salvar Reunião
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA EXPANSÃO */}
      {showExpansionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold">Nova Recomendação de Expansão</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Tipo de Recomendação</label>
                <select
                  value={expType}
                  onChange={(e) => setExpType(e.target.value as unknown as typeof expType)}
                  className="w-full p-2 bg-muted/40 border border-border rounded-md text-foreground"
                >
                  <option value="renewal">Renovação Contratual</option>
                  <option value="scope_review">Revisão de Escopo</option>
                  <option value="expansion_unit">Expansão por Unidade</option>
                  <option value="expansion_service">Expansão por Serviço</option>
                  <option value="upsell">Upsell</option>
                  <option value="downsell">Downsell Ajustado</option>
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">Serviço Alvo</label>
                <input
                  type="text"
                  placeholder="Ex: Gestão Avançada de Reputação GBP"
                  value={expTargetService}
                  onChange={(e) => setExpTargetService(e.target.value)}
                  className="w-full p-2 bg-muted/40 border border-border rounded-md text-foreground"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Fit Demonstrado (Justificativa)</label>
                <textarea
                  rows={2}
                  placeholder="Descreva o alinhamento técnico e operacional do cliente..."
                  value={expFitRationale}
                  onChange={(e) => setExpFitRationale(e.target.value)}
                  className="w-full p-2 bg-muted/40 border border-border rounded-md text-foreground"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Valor / Necessidade Evidenciada</label>
                <textarea
                  rows={2}
                  placeholder="Evidências do Módulo 05/06 que justificam o novo escopo..."
                  value={expValueRationale}
                  onChange={(e) => setExpValueRationale(e.target.value)}
                  className="w-full p-2 bg-muted/40 border border-border rounded-md text-foreground"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Avaliação de Impacto Operacional</label>
                <textarea
                  rows={2}
                  placeholder="Capacidade operacional requerida no Módulo 04..."
                  value={expImpactAssessment}
                  onChange={(e) => setExpImpactAssessment(e.target.value)}
                  className="w-full p-2 bg-muted/40 border border-border rounded-md text-foreground"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
              <button
                onClick={() => setShowExpansionModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateExpansion}
                className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Submeter para Aprovação Humana
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CANCELAMENTO */}
      {showCancellationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-rose-500">Solicitar Cancelamento & Offboarding</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Motivo Principal</label>
                <input
                  type="text"
                  placeholder="Ex: Mudança de direcionamento estratégico / Encerramento de operações"
                  value={cancMotive}
                  onChange={(e) => setCancMotive(e.target.value)}
                  className="w-full p-2 bg-muted/40 border border-border rounded-md text-foreground"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Detalhes Adicionais</label>
                <textarea
                  rows={3}
                  placeholder="Descreva o contexto do cancelamento..."
                  value={cancDetails}
                  onChange={(e) => setCancDetails(e.target.value)}
                  className="w-full p-2 bg-muted/40 border border-border rounded-md text-foreground"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
              <button
                onClick={() => setShowCancellationModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCancellation}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700"
              >
                Confirmar Solicitação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
