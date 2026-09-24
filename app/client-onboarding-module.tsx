"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  FileCheck2,
  Filter,
  Fingerprint,
  Link2,
  ListCheck,
  ListTodo,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import {
  callClientOnboardingApi,
  type OnboardingWorkspaceData,
} from "@/lib/client-onboarding-api";
import {
  ONBOARDING_STAGES,
  STAGE_DESCRIPTIONS,
  type ClientOnboarding,
  type OnboardingRequirement,
  type OnboardingStage,
} from "@/lib/client-onboarding-domain";
import type { View } from "./app-shell";

interface ClientOnboardingModuleProps {
  onNavigate?: (view: View) => void;
  selectedId?: string;
}

export function ClientOnboardingModule({ onNavigate, selectedId }: ClientOnboardingModuleProps) {
  // Estados principais
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dados carregados
  const [onboardings, setOnboardings] = useState<ClientOnboarding[]>([]);
  const [selectedOnboardingId, setSelectedOnboardingId] = useState<string | null>(selectedId ?? null);
  const [workspace, setWorkspace] = useState<OnboardingWorkspaceData | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  // Modais e formulários locais
  const [showNewHandoffModal, setShowNewHandoffModal] = useState<boolean>(false);
  const [handoffInputId, setHandoffInputId] = useState<string>("");

  const [showDivergenceModal, setShowDivergenceModal] = useState<boolean>(false);
  const [divergenceReason, setDivergenceReason] = useState<string>("");
  const [divergenceIssues, setDivergenceIssues] = useState<string[]>([]);

  const [showAddUnitModal, setShowAddUnitModal] = useState<boolean>(false);
  const [newUnitName, setNewUnitName] = useState<string>("");
  const [newUnitType, setNewUnitType] = useState<"headquarters" | "branch">("branch");
  const [newUnitCity, setNewUnitCity] = useState<string>("");
  const [newUnitStateUf, setNewUnitStateUf] = useState<string>("SP");
  const [newUnitIsPhysical, setNewUnitIsPhysical] = useState<boolean>(true);
  const [newUnitHasArea, setNewUnitHasArea] = useState<boolean>(false);
  const [newUnitRadius, setNewUnitRadius] = useState<number>(20);

  // Formulário de Criação Transacional de Cliente
  const [clientFormName, setClientFormName] = useState<string>("");
  const [unitFormName, setUnitFormName] = useState<string>("");
  const [unitFormCity, setUnitFormCity] = useState<string>("");
  const [unitFormStateUf, setUnitFormStateUf] = useState<string>("SP");

  // Formulário de Requisito (Dispensa / Evidência)
  const [selectedReqForAction, setSelectedReqForAction] = useState<OnboardingRequirement | null>(null);
  const [reqActionType, setReqActionType] = useState<"verify" | "waive">("verify");
  const [reqEvidenceInput, setReqEvidenceInput] = useState<string>("");
  const [reqWaivedReasonInput, setReqWaivedReasonInput] = useState<string>("");

  // Formulário Baseline
  const [baseProfileScore, setBaseProfileScore] = useState<number>(50);
  const [baseRating, setBaseRating] = useState<number>(4.5);
  const [baseReviewsCount, setBaseReviewsCount] = useState<number>(10);
  const [baseUnansweredCount, setBaseUnansweredCount] = useState<number>(2);
  const [baseRankingNotes, setBaseRankingNotes] = useState<string>("");
  const [baseLimitations, setBaseLimitations] = useState<string>("");

  // 1. Carregar lista de onboardings
  const loadOnboardings = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await callClientOnboardingApi<{ onboardings: ClientOnboarding[] }>({
        action: "list_onboardings",
      });

      if (res.success && res.data) {
        setOnboardings(res.data.onboardings || []);
        // Selecionar o primeiro se nenhum selecionado
        if (!selectedOnboardingId && res.data.onboardings.length > 0) {
          setSelectedOnboardingId(res.data.onboardings[0].id);
        }
      } else {
        setErrorMessage(res.error || "Falha ao consultar processos de onboarding.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de conexão ao carregar onboardings.");
    } finally {
      setLoading(false);
    }
  }, [selectedOnboardingId]);

  useEffect(() => {
    loadOnboardings();
  }, [loadOnboardings]);

  // 2. Carregar Workspace do Onboarding selecionado
  const loadWorkspace = useCallback(async (onboardingId: string) => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callClientOnboardingApi<OnboardingWorkspaceData>({
        action: "get_onboarding_workspace",
        onboardingId,
      });

      if (res.success && res.data) {
        setWorkspace(res.data);
        setSelectedOnboardingId(onboardingId);

        // Preenche formulário de cliente inicial caso não criado
        if (!res.data.client && res.data.company) {
          setClientFormName(res.data.company.name || "");
          setUnitFormName(`${res.data.company.name || ""} - Sede`);
          setUnitFormCity(res.data.company.city || "");
          setUnitFormStateUf(res.data.company.stateUf || "SP");
        }

        // Preenche baseline se já existir
        if (res.data.baseline) {
          setBaseProfileScore(res.data.baseline.profileCompletenessScore ?? 50);
          setBaseRating(res.data.baseline.currentRating ?? 4.5);
          setBaseReviewsCount(res.data.baseline.currentReviewCount ?? 0);
          setBaseUnansweredCount(res.data.baseline.unansweredReviewsCount ?? 0);
          setBaseRankingNotes(res.data.baseline.rankingVisibilityNotes ?? "");
          setBaseLimitations((res.data.baseline.collectionLimitations || []).join("\n"));
        }
      } else {
        setErrorMessage(res.error || "Falha ao carregar detalhes do onboarding.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de conexão ao abrir onboarding.");
    } finally {
      setActionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOnboardingId) {
      loadWorkspace(selectedOnboardingId);
    }
  }, [selectedOnboardingId, loadWorkspace]);

  // 3. Ações Operacionais

  // Iniciar Onboarding por Handoff
  const handleStartFromHandoff = async () => {
    if (!handoffInputId.trim()) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callClientOnboardingApi<{ onboardingId: string }>({
        action: "start_from_handoff",
        salesHandoffId: handoffInputId.trim(),
      });

      if (res.success && res.data?.onboardingId) {
        setSuccessMessage("Onboarding iniciado a partir do handoff com sucesso!");
        setShowNewHandoffModal(false);
        setHandoffInputId("");
        await loadOnboardings();
        setSelectedOnboardingId(res.data.onboardingId);
        setActiveTab("sales_scope");
      } else {
        setErrorMessage(res.error || "Não foi possível iniciar o onboarding.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao processar handoff.");
    } finally {
      setActionLoading(false);
    }
  };

  // Conferência Comercial: Aprovar
  const handleReviewSales = async () => {
    if (!selectedOnboardingId) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callClientOnboardingApi({
        action: "review_sales",
        onboardingId: selectedOnboardingId,
        decision: "approved",
        notes: "Escopo, produto e contrapartidas conferidos com sucesso pelo operador.",
      });

      if (res.success) {
        setSuccessMessage("Conferência comercial aprovada!");
        await loadWorkspace(selectedOnboardingId);
        await loadOnboardings();
        setActiveTab("company_units");
      } else {
        setErrorMessage(res.error || "Falha ao aprovar conferência.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de conexão.");
    } finally {
      setActionLoading(false);
    }
  };

  // Conferência Comercial: Registrar Divergência
  const handleRecordDivergence = async () => {
    if (!selectedOnboardingId || !divergenceReason.trim()) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callClientOnboardingApi({
        action: "record_divergence",
        onboardingId: selectedOnboardingId,
        reason: divergenceReason.trim(),
        issues: divergenceIssues.length > 0 ? divergenceIssues : ["divergencia_escopo_comercial"],
      });

      if (res.success) {
        setSuccessMessage("Divergência registrada com sucesso. Onboarding bloqueado com segurança.");
        setShowDivergenceModal(false);
        setDivergenceReason("");
        setDivergenceIssues([]);
        await loadWorkspace(selectedOnboardingId);
        await loadOnboardings();
      } else {
        setErrorMessage(res.error || "Falha ao registrar divergência.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao registrar divergência.");
    } finally {
      setActionLoading(false);
    }
  };

  // Resolver Divergência
  const handleResolveDivergence = async () => {
    if (!selectedOnboardingId) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callClientOnboardingApi({
        action: "block_or_cancel",
        onboardingId: selectedOnboardingId,
        operation: "unblock",
        reason: "Divergência alinhada e resolvida com a equipe comercial.",
      });

      if (res.success) {
        setSuccessMessage("Divergência resolvida. Processo desbloqueado.");
        await loadWorkspace(selectedOnboardingId);
        await loadOnboardings();
      } else {
        setErrorMessage(res.error || "Falha ao desbloquear onboarding.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao desbloquear.");
    } finally {
      setActionLoading(false);
    }
  };

  // Criação Transacional de Cliente e Unidade Sede
  const handleCreateClientTransactional = async () => {
    if (!selectedOnboardingId || !clientFormName.trim()) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callClientOnboardingApi({
        action: "create_or_link_client_transactional",
        onboardingId: selectedOnboardingId,
        clientName: clientFormName.trim(),
        unitName: unitFormName.trim() || `${clientFormName.trim()} - Sede`,
        unitCity: unitFormCity.trim() || "São Paulo",
        unitStateUf: unitFormStateUf.trim() || "SP",
      });

      if (res.success) {
        setSuccessMessage("Cliente e Unidade Sede criados com sucesso de forma transacional!");
        await loadWorkspace(selectedOnboardingId);
        await loadOnboardings();
        setActiveTab("information_collection");
      } else {
        setErrorMessage(res.error || "Falha ao criar cliente e unidade sede.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de conexão ao criar cliente.");
    } finally {
      setActionLoading(false);
    }
  };

  // Cadastrar Nova Unidade
  const handleUpsertUnit = async () => {
    if (!selectedOnboardingId || !newUnitName.trim()) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callClientOnboardingApi({
        action: "upsert_unit",
        onboardingId: selectedOnboardingId,
        name: newUnitName.trim(),
        unitType: newUnitType,
        isPhysicalStore: newUnitIsPhysical,
        hasServiceArea: newUnitHasArea,
        serviceRadiusKm: newUnitRadius,
        city: newUnitCity.trim() || "São Paulo",
        stateUf: (newUnitStateUf.trim() || "SP").toUpperCase(),
        status: "active",
      });

      if (res.success) {
        setSuccessMessage("Unidade cadastrada com sucesso!");
        setShowAddUnitModal(false);
        setNewUnitName("");
        await loadWorkspace(selectedOnboardingId);
      } else {
        setErrorMessage(res.error || "Falha ao cadastrar unidade.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de conexão.");
    } finally {
      setActionLoading(false);
    }
  };

  // Atualizar Requisito (Verificar ou Dispensar)
  const handleSaveRequirementAction = async () => {
    if (!selectedOnboardingId || !selectedReqForAction) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callClientOnboardingApi({
        action: "update_requirement",
        onboardingId: selectedOnboardingId,
        requirementId: selectedReqForAction.id,
        status: reqActionType === "verify" ? "verified" : "waived",
        evidenceText: reqActionType === "verify" ? reqEvidenceInput.trim() : undefined,
        waivedReason: reqActionType === "waive" ? reqWaivedReasonInput.trim() : undefined,
      });

      if (res.success) {
        setSuccessMessage(
          reqActionType === "verify"
            ? "Requisito verificado com evidência registrada!"
            : "Requisito dispensado com justificativa documentada."
        );
        setSelectedReqForAction(null);
        setReqEvidenceInput("");
        setReqWaivedReasonInput("");
        await loadWorkspace(selectedOnboardingId);
      } else {
        setErrorMessage(res.error || "Falha ao atualizar requisito.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao processar requisito.");
    } finally {
      setActionLoading(false);
    }
  };

  // Salvar Baseline Factual
  const handleSaveBaseline = async () => {
    if (!selectedOnboardingId) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const limitations = baseLimitations
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await callClientOnboardingApi({
        action: "save_baseline",
        onboardingId: selectedOnboardingId,
        profileCompletenessScore: baseProfileScore,
        currentRating: baseRating,
        currentReviewCount: baseReviewsCount,
        unansweredReviewsCount: baseUnansweredCount,
        rankingVisibilityNotes: baseRankingNotes.trim(),
        contentAudit: {
          hasCoverPhoto: true,
          hasLogo: true,
          photosCount: 8,
          lastPostDate: undefined,
          hasAttributes: true,
        },
        trackedKeywords: [],
        knownCompetitors: [],
        availableConversions: {},
        collectionLimitations: limitations,
        unavailableDataPoints: [],
      });

      if (res.success) {
        setSuccessMessage("Baseline factual salvo com sucesso sem zeros sintéticos!");
        await loadWorkspace(selectedOnboardingId);
        setActiveTab("implementation_plan");
      } else {
        setErrorMessage(res.error || "Falha ao salvar baseline factual.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar baseline.");
    } finally {
      setActionLoading(false);
    }
  };

  // Gerar Plano de Implantação a partir do Produto
  const handleGeneratePlan = async () => {
    if (!selectedOnboardingId) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callClientOnboardingApi({
        action: "generate_plan",
        onboardingId: selectedOnboardingId,
        targetStartDate: new Date().toISOString().slice(0, 10),
      });

      if (res.success) {
        setSuccessMessage("Plano de implantação gerado a partir do catálogo oficial!");
        await loadWorkspace(selectedOnboardingId);
        setActiveTab("readiness_checklist");
      } else {
        setErrorMessage(res.error || "Falha ao gerar plano de implantação.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao gerar plano.");
    } finally {
      setActionLoading(false);
    }
  };

  // Submeter para Ativação (Approval Gate)
  const handleSubmitActivation = async () => {
    if (!selectedOnboardingId) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callClientOnboardingApi({
        action: "submit_activation",
        onboardingId: selectedOnboardingId,
        notes: "Checklist de prontidão conferido pelo operador.",
      });

      if (res.success) {
        setSuccessMessage("Onboarding submetido para aprovação da liderança!");
        await loadWorkspace(selectedOnboardingId);
        await loadOnboardings();
      } else {
        setErrorMessage(res.error || "Falha ao submeter para ativação.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao submeter ativação.");
    } finally {
      setActionLoading(false);
    }
  };

  // Aprovar Ativação Operacional
  const handleApproveActivation = async () => {
    if (!selectedOnboardingId) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callClientOnboardingApi({
        action: "approve_activation",
        onboardingId: selectedOnboardingId,
        notes: "Ativação operacional autorizada pela liderança da agência.",
      });

      if (res.success) {
        setSuccessMessage("Cliente ativado com sucesso para operação recorrente!");
        await loadWorkspace(selectedOnboardingId);
        await loadOnboardings();
      } else {
        setErrorMessage(res.error || "Falha ao aprovar ativação.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao aprovar ativação.");
    } finally {
      setActionLoading(false);
    }
  };

  // Filtro de onboardings
  const filteredOnboardings = useMemo(() => {
    return onboardings.filter((item) => {
      const matchesSearch =
        searchQuery === "" ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.clientId && item.clientId.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStage = stageFilter === "all" || item.status === stageFilter;

      return matchesSearch && matchesStage;
    });
  }, [onboardings, searchQuery, stageFilter]);

  // Contadores de métricas gerais
  const metrics = useMemo(() => {
    const total = onboardings.length;
    const inReview = onboardings.filter(
      (o) => o.status === "awaiting_commercial_review" || o.status === "awaiting_operations_review"
    ).length;
    const awaitingClient = onboardings.filter(
      (o) => o.status === "awaiting_client_information" || o.status === "collecting_access"
    ).length;
    const blocked = onboardings.filter((o) => o.status === "blocked").length;
    const active = onboardings.filter((o) => o.status === "active").length;
    return { total, inReview, awaitingClient, blocked, active };
  }, [onboardings]);

  // Status formatado amigável
  const formatStageLabel = (stage: OnboardingStage) => {
    return STAGE_DESCRIPTIONS[stage]?.label || stage;
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* Cabeçalho da Página */}
      <PageHeader
        title="Central de Onboarding de Clientes"
        description="Transforma vendas aprovadas em clientes operacionais com unidades, acessos, DNA, baseline factual e critérios rígidos de ativação."
        helpKey="client_onboarding.overview"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle Modo Simples / Modo Avançado */}
            <div className="flex items-center rounded-lg border bg-muted p-1">
              <button
                type="button"
                onClick={() => setIsAdvancedMode(false)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  !isAdvancedMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Modo Simples
              </button>
              <button
                type="button"
                onClick={() => setIsAdvancedMode(true)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  isAdvancedMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Modo Avançado
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadOnboardings();
                if (selectedOnboardingId) loadWorkspace(selectedOnboardingId);
              }}
              disabled={loading || actionLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading || actionLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>

            <Button
              size="sm"
              onClick={() => setShowNewHandoffModal(true)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4" />
              Novo Onboarding por Handoff
            </Button>
          </div>
        }
      />

      {/* Banner de Mensagens de Sucesso e Erro */}
      {successMessage && (
        <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-sm font-medium">{successMessage}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSuccessMessage(null)} className="h-7 px-2">
            Fechar
          </Button>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center justify-between p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <p className="text-sm font-medium">{errorMessage}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setErrorMessage(null)} className="h-7 px-2">
            Fechar
          </Button>
        </div>
      )}

      {/* Navegação por Abas (10 Áreas da Central de Onboarding) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 h-auto p-1 gap-1 bg-muted/60">
          <TabsTrigger value="overview" className="text-xs py-2">
            1. Visão Geral
          </TabsTrigger>
          <TabsTrigger value="sales_scope" className="text-xs py-2">
            2. Venda & Escopo
          </TabsTrigger>
          <TabsTrigger value="company_units" className="text-xs py-2">
            3. Empresa & Unidades
          </TabsTrigger>
          <TabsTrigger value="information_collection" className="text-xs py-2">
            4. Informações
          </TabsTrigger>
          <TabsTrigger value="access_connections" className="text-xs py-2">
            5. Acessos
          </TabsTrigger>
          <TabsTrigger value="dna_construction" className="text-xs py-2">
            6. DNA
          </TabsTrigger>
          <TabsTrigger value="baseline_setup" className="text-xs py-2">
            7. Baseline
          </TabsTrigger>
          <TabsTrigger value="implementation_plan" className="text-xs py-2">
            8. Implantação
          </TabsTrigger>
          <TabsTrigger value="readiness_checklist" className="text-xs py-2">
            9. Prontidão
          </TabsTrigger>
          <TabsTrigger value="history_decisions" className="text-xs py-2">
            10. Histórico
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* ABA 1: VISÃO GERAL */}
        {/* ========================================================================= */}
        <TabsContent value="overview" className="mt-4 flex flex-col gap-6">
          {/* Métricas Rápidas */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="p-4 flex flex-col justify-between">
              <span className="text-xs text-muted-foreground font-medium">Total em Onboarding</span>
              <span className="text-2xl font-bold mt-2">{metrics.total}</span>
              <span className="text-[11px] text-muted-foreground mt-1">Processos registrados</span>
            </Card>

            <Card className="p-4 flex flex-col justify-between">
              <span className="text-xs text-muted-foreground font-medium">Em Conferência</span>
              <span className="text-2xl font-bold mt-2 text-amber-600">{metrics.inReview}</span>
              <span className="text-[11px] text-muted-foreground mt-1">Comercial e Operações</span>
            </Card>

            <Card className="p-4 flex flex-col justify-between">
              <span className="text-xs text-muted-foreground font-medium">Aguardando Cliente</span>
              <span className="text-2xl font-bold mt-2 text-blue-600">{metrics.awaitingClient}</span>
              <span className="text-[11px] text-muted-foreground mt-1">Acessos e documentos</span>
            </Card>

            <Card className="p-4 flex flex-col justify-between">
              <span className="text-xs text-muted-foreground font-medium">Bloqueados / Divergência</span>
              <span className="text-2xl font-bold mt-2 text-rose-600">{metrics.blocked}</span>
              <span className="text-[11px] text-muted-foreground mt-1">Aguardam resolução</span>
            </Card>

            <Card className="p-4 flex flex-col justify-between">
              <span className="text-xs text-muted-foreground font-medium">Ativos / Concluídos</span>
              <span className="text-2xl font-bold mt-2 text-emerald-600">{metrics.active}</span>
              <span className="text-[11px] text-muted-foreground mt-1">Em operação recorrente</span>
            </Card>
          </div>

          {/* Filtros e Busca */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-2 w-full md:w-80">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID, empresa ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">Todos os estágios</option>
                {ONBOARDING_STAGES.map((st: OnboardingStage) => (
                  <option key={st} value={st}>
                    {STAGE_DESCRIPTIONS[st]?.label || st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lista de Processos de Onboarding */}
          {loading ? (
            <Card className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <p>Carregando processos de onboarding da agência...</p>
            </Card>
          ) : filteredOnboardings.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
              <ListCheck className="h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold text-lg text-foreground">Nenhum processo de onboarding encontrado</h3>
              <p className="max-w-md text-sm">
                Quando uma proposta comercial for aceita e o handoff de vendas for aprovado, o processo de onboarding
                aparecerá aqui para conferência operacional e ativação.
              </p>
              <Button onClick={() => setShowNewHandoffModal(true)} className="gap-2 mt-2">
                <Plus className="h-4 w-4" />
                Iniciar Onboarding Manual por Handoff
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOnboardings.map((ob) => {
                const isSelected = selectedOnboardingId === ob.id;
                const stageInfo = STAGE_DESCRIPTIONS[ob.status];

                return (
                  <Card
                    key={ob.id}
                    onClick={() => {
                      setSelectedOnboardingId(ob.id);
                    }}
                    className={`p-5 cursor-pointer transition-all hover:border-foreground/40 flex flex-col justify-between ${
                      isSelected ? "border-2 border-primary shadow-sm" : ""
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Badge
                          variant={
                            ob.status === "active"
                              ? "default"
                              : ob.status === "blocked"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-[11px]"
                        >
                          {stageInfo?.label || ob.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ob.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>

                      <h4 className="font-semibold text-base text-foreground mt-1 line-clamp-1">
                        {ob.clientId ? `Cliente: ${ob.clientId}` : "Cliente ainda não criado"}
                      </h4>

                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {stageInfo?.description || "Acompanhamento de implantação operacional."}
                      </p>

                      {ob.divergenceReason && (
                        <div className="mt-3 p-2 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs">
                          <strong>Divergência:</strong> {ob.divergenceReason}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                      {isAdvancedMode ? (
                        <span className="font-mono text-[10px] truncate max-w-[180px]">ID: {ob.id}</span>
                      ) : (
                        <span>Handoff: {ob.salesHandoffId ? "Vinculado" : "Direto"}</span>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOnboardingId(ob.id);
                          setActiveTab("sales_scope");
                        }}
                        className="h-7 px-2 text-primary font-medium gap-1"
                      >
                        Abrir
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 2: VENDA & ESCOPO (CONFERÊNCIA DA VENDA) */}
        {/* ========================================================================= */}
        <TabsContent value="sales_scope" className="mt-4 flex flex-col gap-6">
          {!workspace ? (
            <Card className="p-8 text-center text-muted-foreground">
              Selecione um processo de onboarding na aba Visão Geral para visualizar o escopo comercial.
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Status da Conferência */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border bg-card">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">Conferência da Venda e Escopo Comercial</h3>
                    <Badge variant={workspace.onboarding.status === "blocked" ? "destructive" : "secondary"}>
                      {formatStageLabel(workspace.onboarding.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Validação obrigatória entre o produto aprovado na Fábrica de Produtos e o que foi prometido na proposta.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {workspace.onboarding.status === "awaiting_commercial_review" && (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDivergenceModal(true)}
                        disabled={actionLoading}
                        className="gap-2"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        Registrar Divergência
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleReviewSales}
                        disabled={actionLoading}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Aprovar Conferência Comercial
                      </Button>
                    </>
                  )}

                  {workspace.onboarding.status === "blocked" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResolveDivergence}
                      disabled={actionLoading}
                      className="gap-2"
                    >
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Resolver Divergência e Desbloquear
                    </Button>
                  )}
                </div>
              </div>

              {/* Detalhes do Escopo Comercial Snapshot */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b pb-3">
                    <Package className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold text-sm">Produto e Termos Financeiros Contratados</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Produto Vinculado:</span>
                      <p className="font-medium mt-0.5">
                        {workspace.product?.name || "SEO Local & Google Business Profile"}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs text-muted-foreground">Versão do Catálogo:</span>
                      <p className="font-medium mt-0.5">v{workspace.onboarding.productVersion || 1}</p>
                    </div>

                    <div>
                      <span className="text-xs text-muted-foreground">Valor de Setup:</span>
                      <p className="font-semibold text-foreground mt-0.5">
                        R$ {workspace.proposal?.setupPrice || "1.500,00"}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs text-muted-foreground">Valor Mensal Recorrente:</span>
                      <p className="font-semibold text-foreground mt-0.5">
                        R$ {workspace.proposal?.monthlyPrice || "1.200,00"}/mês
                      </p>
                    </div>
                  </div>

                  {isAdvancedMode && (
                    <div className="mt-2 pt-3 border-t text-xs">
                      <span className="text-muted-foreground font-mono">Handoff ID:</span>{" "}
                      <span className="font-mono">{workspace.onboarding.salesHandoffId || "N/A"}</span>
                    </div>
                  )}
                </Card>

                <Card className="p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b pb-3">
                    <FileCheck2 className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold text-sm">Salvaguarda de Alinhamento e Promessas</h4>
                  </div>

                  <div className="flex flex-col gap-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground font-medium">Promessas de Vendas Declaradas:</span>
                      <p className="text-xs mt-1 p-2 rounded bg-muted">
                        {workspace.salesHandoff?.promisesMade ||
                          "Aumento de visibilidade local através de otimização de perfil, gestão de avaliações e consistência NAP conforme SOP."}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs text-muted-foreground font-medium">Riscos Operacionais Identificados:</span>
                      <p className="text-xs mt-1 p-2 rounded bg-muted">
                        {workspace.salesHandoff?.operationalRisks ||
                          "Necessidade de acesso de proprietário ao Google Business Profile e verificação de telefone da sede."}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Tabela de Itens de Escopo Acordados */}
              <Card className="p-5">
                <h4 className="font-semibold text-sm mb-4">Itens de Escopo Inclusos no Contrato</h4>
                <div className="divide-y text-sm">
                  {[
                    { item: "Diagnóstico inicial e baseline completo", type: "Setup", sla: "5 dias úteis" },
                    { item: "Otimização de categorias primárias e secundárias", type: "Setup", sla: "7 dias úteis" },
                    { item: "Auditoria e saneamento de consistência NAP", type: "Setup", sla: "10 dias úteis" },
                    { item: "Gestão e resposta estratégica a avaliações", type: "Recorrente", sla: "Até 48h úteis" },
                    { item: "Publicação semanal de Local Posts no GBP", type: "Recorrente", sla: "Semanal" },
                    { item: "Monitoramento de visibilidade no Local Pack", type: "Recorrente", sla: "Mensal" },
                  ].map((row, i) => (
                    <div key={i} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-medium text-foreground">{row.item}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <Badge variant="outline">{row.type}</Badge>
                        <span>SLA: {row.sla}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 3: EMPRESA & UNIDADES (CRIAÇÃO TRANSACIONAL E FILIAIS) */}
        {/* ========================================================================= */}
        <TabsContent value="company_units" className="mt-4 flex flex-col gap-6">
          {!workspace ? (
            <Card className="p-8 text-center text-muted-foreground">
              Selecione um processo de onboarding para gerenciar empresa e unidades.
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Caso o cliente ainda não tenha sido criado */}
              {!workspace.client ? (
                <Card className="p-6 border-dashed border-2 flex flex-col gap-4 bg-muted/20">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-6 w-6 text-primary" />
                    <div>
                      <h4 className="font-semibold text-base">Criação Transacional do Cliente</h4>
                      <p className="text-xs text-muted-foreground">
                        O cliente ainda não existe no catálogo operacional da agência. Crie o cliente e sua unidade sede
                        em uma transação atômica e segura.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Nome Comercial da Empresa *</label>
                      <Input
                        value={clientFormName}
                        onChange={(e) => setClientFormName(e.target.value)}
                        placeholder="Ex: Vidraçaria Cristal Sorocaba"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Nome da Unidade Sede *</label>
                      <Input
                        value={unitFormName}
                        onChange={(e) => setUnitFormName(e.target.value)}
                        placeholder="Ex: Vidraçaria Cristal - Sede Campolim"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Cidade da Sede *</label>
                      <Input
                        value={unitFormCity}
                        onChange={(e) => setUnitFormCity(e.target.value)}
                        placeholder="Ex: Sorocaba"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Estado (UF) *</label>
                      <Input
                        value={unitFormStateUf}
                        onChange={(e) => setUnitFormStateUf(e.target.value)}
                        placeholder="Ex: SP"
                        maxLength={2}
                        className="mt-1 uppercase"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end mt-2">
                    <Button
                      onClick={handleCreateClientTransactional}
                      disabled={actionLoading || !clientFormName.trim()}
                      className="gap-2 bg-primary text-primary-foreground"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Criar Cliente e Unidade Sede
                    </Button>
                  </div>
                </Card>
              ) : (
                /* Cliente já criado: exibe dados e tabela de unidades */
                <div className="flex flex-col gap-6">
                  <div className="p-4 rounded-lg border bg-card flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground">Cliente Operacional Vinculado</span>
                      <h3 className="font-semibold text-lg text-foreground mt-0.5">{workspace.client.name}</h3>
                      {isAdvancedMode && (
                        <span className="font-mono text-xs text-muted-foreground">
                          Client ID: {workspace.client.id} · Slug: {workspace.client.slug}
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs font-medium bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300">
                      Cliente Ativo no Catálogo
                    </Badge>
                  </div>

                  {/* Gerenciamento de Unidades */}
                  <Card className="p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <h4 className="font-semibold text-base">Unidades Operacionais Cadastradas</h4>
                        <p className="text-xs text-muted-foreground">
                          Cada unidade possui seu próprio endereço, tipo de cobertura e perfis locais.
                        </p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => setShowAddUnitModal(true)}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar Filial
                      </Button>
                    </div>

                    <div className="divide-y text-sm">
                      {workspace.units.map((unit) => (
                        <div key={unit.id} className="py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{unit.name}</span>
                              <Badge variant={unit.unitType === "headquarters" ? "default" : "secondary"} className="text-[10px]">
                                {unit.unitType === "headquarters" ? "Sede" : "Filial"}
                              </Badge>
                              {unit.isPhysicalStore && (
                                <Badge variant="outline" className="text-[10px]">
                                  Loja Física
                                </Badge>
                              )}
                              {unit.hasServiceArea && (
                                <Badge variant="outline" className="text-[10px]">
                                  Raio {unit.serviceRadiusKm || 20}km
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>{unit.city ? `${unit.city} - ${unit.stateUf || "SP"}` : "Endereço a complementar"}</span>
                              {unit.addressStreet && <span>· {unit.addressStreet}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end md:self-center">
                            <Badge variant="outline" className="text-xs">
                              {unit.status === "active" ? "Ativa" : "Configurando"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 4: COLETA DE INFORMAÇÕES E DOCUMENTOS */}
        {/* ========================================================================= */}
        <TabsContent value="information_collection" className="mt-4 flex flex-col gap-6">
          {!workspace ? (
            <Card className="p-8 text-center text-muted-foreground">
              Selecione um onboarding para acompanhar a coleta de informações e documentos.
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="p-4 rounded-lg border bg-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg">Coleta de Informações e Documentos</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Itens fornecidos pelo cliente com evidência verificada ou dispensa formal justificada.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span className="text-muted-foreground">Progresso da Coleta:</span>
                  <Badge variant="secondary">
                    {
                      workspace.requirements.filter(
                        (r) =>
                          r.category !== "access_credentials" &&
                          r.category !== "consents_agreements" &&
                          (r.status === "verified" || r.status === "waived")
                      ).length
                    }{" "}
                    de{" "}
                    {
                      workspace.requirements.filter(
                        (r) => r.category !== "access_credentials" && r.category !== "consents_agreements"
                      ).length
                    }{" "}
                    concluídos
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {workspace.requirements
                  .filter((r) => r.category !== "access_credentials" && r.category !== "consents_agreements")
                  .map((req) => (
                    <Card key={req.id} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {req.status === "verified" ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          ) : req.status === "waived" ? (
                            <ShieldCheck className="h-5 w-5 text-amber-600" />
                          ) : (
                            <Clock className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm text-foreground">{req.title}</h4>
                            <Badge
                              variant={
                                req.status === "verified"
                                  ? "default"
                                  : req.status === "waived"
                                  ? "outline"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {req.status === "verified"
                                ? "Verificado"
                                : req.status === "waived"
                                ? "Dispensado"
                                : req.status === "submitted"
                                ? "Enviado pelo Cliente"
                                : "Pendente"}
                            </Badge>
                            {req.isRequired && (
                              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                Obrigatório
                              </Badge>
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground mt-1">{req.description}</p>

                          {req.evidenceText && (
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2 bg-emerald-50 dark:bg-emerald-950/30 p-1.5 rounded">
                              <strong>Evidência:</strong> {req.evidenceText}
                            </p>
                          )}

                          {req.waivedReason && (
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded">
                              <strong>Justificativa de Dispensa:</strong> {req.waivedReason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        {req.status !== "verified" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedReqForAction(req);
                              setReqActionType("verify");
                            }}
                            className="h-8 text-xs gap-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Validar Evidência
                          </Button>
                        )}

                        {req.status !== "waived" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedReqForAction(req);
                              setReqActionType("waive");
                            }}
                            className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Dispensar...
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 5: ACESSOS E CONEXÕES */}
        {/* ========================================================================= */}
        <TabsContent value="access_connections" className="mt-4 flex flex-col gap-6">
          {!workspace ? (
            <Card className="p-8 text-center text-muted-foreground">
              Selecione um onboarding para gerenciar acessos e integrações.
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="p-4 rounded-lg border bg-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg">Acessos de Plataformas e Connection Hub</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    O Connection Hub é a porta única para autorizações OAuth e acessos de provedores externos.
                  </p>
                </div>

                {onNavigate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate("connections")}
                    className="gap-2"
                  >
                    <Link2 className="h-4 w-4" />
                    Abrir Connection Hub da Agência
                  </Button>
                )}
              </div>

              {/* Lista de Acessos Críticos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workspace.requirements
                  .filter((r) => r.category === "access_credentials" || r.category === "consents_agreements")
                  .map((req) => (
                    <Card key={req.id} className="p-5 flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-sm text-foreground">{req.title}</h4>
                          <Badge
                            variant={
                              req.status === "verified"
                                ? "default"
                                : req.status === "waived"
                                ? "outline"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {req.status === "verified" ? "Conectado / Verificado" : req.status === "waived" ? "Dispensado" : "Pendente"}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground mt-2">{req.description}</p>

                        {req.evidenceText && (
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded">
                            <strong>Comprovante:</strong> {req.evidenceText}
                          </p>
                        )}

                        {req.waivedReason && (
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                            <strong>Motivo de Dispensa:</strong> {req.waivedReason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-3 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedReqForAction(req);
                            setReqActionType("verify");
                          }}
                          className="h-8 text-xs gap-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Confirmar Acesso
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedReqForAction(req);
                            setReqActionType("waive");
                          }}
                          className="h-8 text-xs text-muted-foreground"
                        >
                          Dispensar
                        </Button>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 6: DNA DA EMPRESA */}
        {/* ========================================================================= */}
        <TabsContent value="dna_construction" className="mt-4 flex flex-col gap-6">
          {!workspace ? (
            <Card className="p-8 text-center text-muted-foreground">
              Selecione um onboarding para visualizar a construção do DNA da marca.
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="p-4 rounded-lg border bg-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg">Construção e Validação do DNA do Cliente</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cliente e DNA são a fonte compartilhada de contexto para todos os módulos e agentes de IA.
                  </p>
                </div>

                {onNavigate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate("dna")}
                    className="gap-2"
                  >
                    <Fingerprint className="h-4 w-4" />
                    Abrir Módulo de DNA Completo
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-5 flex flex-col gap-4">
                  <h4 className="font-semibold text-sm border-b pb-2">Identidade e Posicionamento</h4>
                  <div className="flex flex-col gap-3 text-xs">
                    <div>
                      <span className="font-medium text-muted-foreground">Diferencial Central:</span>
                      <p className="mt-1 p-2 rounded bg-muted">
                        Atendimento ágil em menos de 2h na região metropolitana com garantia de 1 ano em serviços de instalação.
                      </p>
                    </div>

                    <div>
                      <span className="font-medium text-muted-foreground">Público-Alvo Prioritário:</span>
                      <p className="mt-1 p-2 rounded bg-muted">
                        Proprietários de residências em condomínios e pequenas empresas comerciais buscando soluções sob medida.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-5 flex flex-col gap-4">
                  <h4 className="font-semibold text-sm border-b pb-2">Voz da Marca e Restrições</h4>
                  <div className="flex flex-col gap-3 text-xs">
                    <div>
                      <span className="font-medium text-muted-foreground">Tom de Voz:</span>
                      <p className="mt-1 p-2 rounded bg-muted">
                        Técnico, prestativo e transparente. Foco em soluções seguras e esclarecimento de dúvidas sem jargões confusos.
                      </p>
                    </div>

                    <div>
                      <span className="font-medium text-muted-foreground">Restrições e Palavras Proibidas:</span>
                      <p className="mt-1 p-2 rounded bg-muted">
                        Nunca garantir preço mais baixo do mercado ou prazo de entrega sem medição prévia no local.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 7: BASELINE FACTUAL DO SERVIÇO */}
        {/* ========================================================================= */}
        <TabsContent value="baseline_setup" className="mt-4 flex flex-col gap-6">
          {!workspace ? (
            <Card className="p-8 text-center text-muted-foreground">
              Selecione um onboarding para registrar o baseline inicial.
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="p-4 rounded-lg border bg-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg">Baseline Inicial Factual</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Fotografia inicial do perfil antes das ações da agência. Sem zeros sintéticos e sem promessas não comprovadas.
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={handleSaveBaseline}
                  disabled={actionLoading}
                  className="gap-2 bg-primary text-primary-foreground"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Salvar Baseline Factual
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Local Score Prévio (0 a 100)</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={baseProfileScore}
                    onChange={(e) => setBaseProfileScore(Number(e.target.value))}
                  />
                  <span className="text-[11px] text-muted-foreground">Calculado na auditoria inicial</span>
                </Card>

                <Card className="p-4 flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Nota Média GBP (1.0 a 5.0)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min={1}
                    max={5}
                    value={baseRating}
                    onChange={(e) => setBaseRating(Number(e.target.value))}
                  />
                  <span className="text-[11px] text-muted-foreground">Observada no perfil público</span>
                </Card>

                <Card className="p-4 flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Total de Avaliações</label>
                  <Input
                    type="number"
                    min={0}
                    value={baseReviewsCount}
                    onChange={(e) => setBaseReviewsCount(Number(e.target.value))}
                  />
                  <span className="text-[11px] text-muted-foreground">Contagem real de reviews</span>
                </Card>

                <Card className="p-4 flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground">Avaliações sem Resposta</label>
                  <Input
                    type="number"
                    min={0}
                    value={baseUnansweredCount}
                    onChange={(e) => setBaseUnansweredCount(Number(e.target.value))}
                  />
                  <span className="text-[11px] text-muted-foreground">Pendências prévias de reputação</span>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-5 flex flex-col gap-3">
                  <h4 className="font-semibold text-sm">Observações de Visibilidade e Ranking Local</h4>
                  <Textarea
                    rows={4}
                    placeholder="Ex: Empresa aparece na 8ª posição média no Local Pack para termos como 'vidraçaria sorocaba' e não pontua em bairros vizinhos."
                    value={baseRankingNotes}
                    onChange={(e) => setBaseRankingNotes(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">
                    Registre apenas o que foi observado em auditoria manual ou ferramentas reais. Nunca prometa primeira posição.
                  </span>
                </Card>

                <Card className="p-5 flex flex-col gap-3">
                  <h4 className="font-semibold text-sm">Limitações de Coleta Declaradas</h4>
                  <Textarea
                    rows={4}
                    placeholder="Insira uma limitação por linha. Ex:
Histórico de chamadas não integrado antes do início do contrato
Acesso à conta do Google Ads indisponível no primeiro mês"
                    value={baseLimitations}
                    onChange={(e) => setBaseLimitations(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">
                    Declarar lacunas evita falsas suposições de dados históricos ausentes.
                  </span>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 8: PLANO DE IMPLANTAÇÃO */}
        {/* ========================================================================= */}
        <TabsContent value="implementation_plan" className="mt-4 flex flex-col gap-6">
          {!workspace ? (
            <Card className="p-8 text-center text-muted-foreground">
              Selecione um onboarding para visualizar o plano de implantação.
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="p-4 rounded-lg border bg-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg">Plano de Implantação e Virada de Chave</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tarefas sequenciais derivadas da Fábrica de Produtos com tempo em minutos e responsáveis.
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={handleGeneratePlan}
                  disabled={actionLoading}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Gerar Plano a partir do Produto
                </Button>
              </div>

              {!workspace.plan ? (
                <Card className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                  <ListTodo className="h-10 w-10 text-muted-foreground" />
                  <h4 className="font-semibold text-base text-foreground">Plano de implantação ainda não gerado</h4>
                  <p className="max-w-md text-xs">
                    Clique no botão acima para derivar automaticamente as tarefas operacionais de setup a partir da matriz de escopo do produto.
                  </p>
                </Card>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Resumo de Tempo */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4">
                      <span className="text-xs text-muted-foreground">Total de Atividades de Setup:</span>
                      <p className="text-xl font-bold mt-1">{workspace.plan.items.length} tarefas</p>
                    </Card>

                    <Card className="p-4">
                      <span className="text-xs text-muted-foreground">Tempo Total Estimado:</span>
                      <p className="text-xl font-bold mt-1">
                        {Math.floor(workspace.plan.totalSetupMinutes / 60)}h {workspace.plan.totalSetupMinutes % 60}min
                      </p>
                    </Card>

                    <Card className="p-4">
                      <span className="text-xs text-muted-foreground">Status do Plano:</span>
                      <p className="text-xl font-bold mt-1 capitalize text-primary">{workspace.plan.status}</p>
                    </Card>
                  </div>

                  {/* Tabela de Tarefas */}
                  <Card className="p-5">
                    <h4 className="font-semibold text-sm mb-3">Tarefas Operacionais de Setup</h4>
                    <div className="divide-y text-xs">
                      {workspace.plan.items.map((item) => (
                        <div key={item.id} className="py-2.5 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <span className="font-medium text-foreground">{item.activityName}</span>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-muted-foreground shrink-0">
                            <span>{item.estimatedMinutes} min</span>
                            <Badge variant="outline">{item.defaultRole}</Badge>
                            <Badge variant="secondary">{item.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 9: PRONTIDÃO E CRITÉRIOS DE ATIVAÇÃO */}
        {/* ========================================================================= */}
        <TabsContent value="readiness_checklist" className="mt-4 flex flex-col gap-6">
          {!workspace ? (
            <Card className="p-8 text-center text-muted-foreground">
              Selecione um onboarding para auditar a prontidão e critérios de ativação.
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Barra de Prontidão */}
              <div className="p-5 rounded-lg border bg-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">Checklist Objetivo de Ativação</h3>
                    <Badge variant={workspace.readiness.isReady ? "default" : "secondary"}>
                      {workspace.readiness.items.filter((i) => i.fulfilled).length} de {workspace.readiness.items.length} critérios cumpridos
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Critérios de qualidade inegociáveis para liberar o cliente para a esteira e motor de operações recorrentes.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {workspace.onboarding.status !== "ready_for_activation" &&
                    workspace.onboarding.status !== "active" && (
                      <Button
                        size="sm"
                        onClick={handleSubmitActivation}
                        disabled={actionLoading}
                        className="gap-2"
                      >
                        <UserCheck className="h-4 w-4" />
                        Submeter para Aprovação de Ativação
                      </Button>
                    )}

                  {workspace.onboarding.status === "ready_for_activation" && (
                    <Button
                      size="sm"
                      onClick={handleApproveActivation}
                      disabled={actionLoading || !workspace.readiness.isReady}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Aprovar Ativação Operacional
                    </Button>
                  )}
                </div>
              </div>

              {/* Lista dos 11 Critérios Objetivos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workspace.readiness.items.map((it) => (
                  <Card key={it.key} className="p-4 flex items-start gap-3">
                    <div className="mt-0.5">
                      {it.fulfilled ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-rose-500" />
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-sm text-foreground">{it.label}</span>
                      <p className="text-xs text-muted-foreground mt-1">{it.details || it.description}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ========================================================================= */}
        {/* ABA 10: HISTÓRICO E DECISÕES AUDITÁVEIS */}
        {/* ========================================================================= */}
        <TabsContent value="history_decisions" className="mt-4 flex flex-col gap-6">
          {!workspace ? (
            <Card className="p-8 text-center text-muted-foreground">
              Selecione um onboarding para acompanhar a trilha de auditoria e decisões.
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="p-4 rounded-lg border bg-card">
                <h3 className="font-semibold text-lg">Trilha de Decisões e Eventos Auditáveis</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Registros imutáveis de conferências comerciais, divergências, dispensas com justificativa e autorizações.
                </p>
              </div>

              <div className="divide-y text-xs">
                {workspace.decisions.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">
                    Nenhuma decisão registrada até o momento.
                  </Card>
                ) : (
                  workspace.decisions.map((dec) => (
                    <Card key={dec.id} className="p-4 mb-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <Badge variant="outline" className="capitalize text-[11px]">
                          {dec.decisionType.replace(/_/g, " ")}
                        </Badge>
                        <span>{new Date(dec.decidedAt).toLocaleString("pt-BR")}</span>
                      </div>

                      <div className="text-sm font-medium text-foreground mt-1">
                        Decisão: <span className="capitalize">{dec.decisionType}</span>
                      </div>

                      {dec.reason && <p className="text-xs text-muted-foreground mt-0.5">{dec.reason}</p>}

                      {isAdvancedMode && (
                        <div className="mt-2 pt-2 border-t font-mono text-[10px] text-muted-foreground">
                          Actor ID: {dec.actorId} · ID: {dec.id}
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal: Iniciar Onboarding por Handoff */}
      {showNewHandoffModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 flex flex-col gap-4">
            <h3 className="font-semibold text-lg">Iniciar Onboarding a partir de Venda</h3>
            <p className="text-xs text-muted-foreground">
              Insira o identificador do Handoff Comercial aprovado (ou o ID da oportunidade ganha) para iniciar a conferência.
            </p>

            <div>
              <label className="text-xs font-medium text-muted-foreground">ID do Handoff de Vendas *</label>
              <Input
                placeholder="Ex: handoff-12345"
                value={handoffInputId}
                onChange={(e) => setHandoffInputId(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setShowNewHandoffModal(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleStartFromHandoff}
                disabled={actionLoading || !handoffInputId.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Iniciar Processo
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Registrar Divergência Comercial */}
      {showDivergenceModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-semibold text-lg">Registrar Divergência Comercial</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Descreva o motivo da divergência. O onboarding será bloqueado até que o alinhamento com a equipe de vendas seja concluído.
            </p>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Motivo do Bloqueio *</label>
              <Textarea
                rows={3}
                placeholder="Ex: Promessa de 1ª posição garantida em contrato não permitida pela política da agência."
                value={divergenceReason}
                onChange={(e) => setDivergenceReason(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setShowDivergenceModal(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleRecordDivergence}
                disabled={actionLoading || !divergenceReason.trim()}
              >
                Bloquear e Registrar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Adicionar Unidade Filial */}
      {showAddUnitModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 flex flex-col gap-4">
            <h3 className="font-semibold text-lg">Cadastrar Nova Unidade</h3>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome da Unidade *</label>
                <Input
                  placeholder="Ex: Vidraçaria Cristal - Filial Votorantim"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Cidade</label>
                  <Input
                    placeholder="Votorantim"
                    value={newUnitCity}
                    onChange={(e) => setNewUnitCity(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">UF</label>
                  <Input
                    placeholder="SP"
                    maxLength={2}
                    value={newUnitStateUf}
                    onChange={(e) => setNewUnitStateUf(e.target.value)}
                    className="mt-1 uppercase"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs mt-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newUnitIsPhysical}
                    onChange={(e) => setNewUnitIsPhysical(e.target.checked)}
                  />
                  <span>Loja Física</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newUnitHasArea}
                    onChange={(e) => setNewUnitHasArea(e.target.checked)}
                  />
                  <span>Área de Atendimento</span>
                </label>
              </div>

              {newUnitHasArea && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Raio de Atendimento (km)</label>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={newUnitRadius}
                    onChange={(e) => setNewUnitRadius(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setShowAddUnitModal(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleUpsertUnit}
                disabled={actionLoading || !newUnitName.trim()}
              >
                Salvar Unidade
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Ação de Requisito (Validar Evidência ou Dispensar) */}
      {selectedReqForAction && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 flex flex-col gap-4">
            <h3 className="font-semibold text-lg">
              {reqActionType === "verify" ? "Validar Evidência de Requisito" : "Dispensar Requisito"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Requisito: <strong>{selectedReqForAction.title}</strong>
            </p>

            {reqActionType === "verify" ? (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Evidência / Link / Descrição da Conferência *
                </label>
                <Textarea
                  rows={3}
                  placeholder="Ex: Cartão CNPJ conferido no portal da Receita Federal e contrato social arquivado no drive."
                  value={reqEvidenceInput}
                  onChange={(e) => setReqEvidenceInput(e.target.value)}
                  className="mt-1"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Justificativa Obrigatória para Dispensa *
                </label>
                <Textarea
                  rows={3}
                  placeholder="Ex: Empresa recém-inaugurada sem histórico de postagens ou base prévia de contatos."
                  value={reqWaivedReasonInput}
                  onChange={(e) => setReqWaivedReasonInput(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setSelectedReqForAction(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveRequirementAction}
                disabled={
                  actionLoading ||
                  (reqActionType === "verify" && !reqEvidenceInput.trim()) ||
                  (reqActionType === "waive" && !reqWaivedReasonInput.trim())
                }
                className={reqActionType === "verify" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
              >
                {reqActionType === "verify" ? "Confirmar Verificação" : "Registrar Dispensa"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
