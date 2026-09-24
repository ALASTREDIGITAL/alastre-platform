"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeAlert,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Flame,
  HelpCircle,
  Kanban,
  Layers,
  ListOrdered,
  Lock,
  MinusCircle,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
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
  callCommercialCrmApi,
  type CommercialOpportunity,
  type OpportunityWorkspaceData,
  type ProspectCompany,
} from "@/lib/commercial-crm-api";
import {
  OPPORTUNITY_STAGES,
  PRIORITY_LEVELS,
  QUALIFICATION_RESULTS,
  LOSS_REASON_CODES,
  LOSS_REASON_LABELS,
  FOLLOW_UP_CADENCES,
  canTransitionOpportunity,
  detectStaleOpportunities,
  type OpportunityStage,
  type PriorityLevel,
  type QualificationDimensions,
  type QualificationResult,
  type LossReasonCode,
  type CommercialProposal,
  type CommercialDiagnosis,
  type CommercialMetrics,
  type ForecastScenario,
} from "@/lib/commercial-crm-domain";
import type { View } from "./app-shell";

interface CommercialModuleProps {
  onNavigate?: (view: View) => void;
}

export function CommercialModule({ onNavigate }: CommercialModuleProps) {
  // Estados principais
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dados carregados
  const [companies, setCompanies] = useState<ProspectCompany[]>([]);
  const [opportunities, setOpportunities] = useState<CommercialOpportunity[]>([]);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<OpportunityWorkspaceData | null>(null);
  const [metrics, setMetrics] = useState<CommercialMetrics | null>(null);
  const [forecastScenarios, setForecastScenarios] = useState<ForecastScenario[]>([]);

  // Filtros
  const [companySearch, setCompanySearch] = useState<string>("");
  const [oppSearch, setOppSearch] = useState<string>("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Formulário Nova Oportunidade
  const [showNewOppModal, setShowNewOppModal] = useState<boolean>(false);
  const [newOppCompanyId, setNewOppCompanyId] = useState<string>("");
  const [newOppTitle, setNewOppTitle] = useState<string>("");
  const [newOppOrigin, setNewOppOrigin] = useState<any>("prospecting");
  const [newOppPriority, setNewOppPriority] = useState<PriorityLevel>("media_prioridade");
  const [newOppNextAction, setNewOppNextAction] = useState<string>("Apresentar diagnóstico");
  const [newOppDeadline, setNewOppDeadline] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );

  // Formulário Diagnóstico (11 passos)
  const [diagAnswers, setDiagAnswers] = useState({
    context: "",
    current_situation: "",
    problem: "",
    impact: "",
    history: "",
    objective: "",
    diagnosis: "",
    gap: "",
    relevant_solution: "Plano SEO Local & GBP da Alastre Platform",
    investment: "",
    decision_next_steps: "",
  });

  // Formulário Proposta
  const [propSetupPrice, setPropSetupPrice] = useState<number>(1500);
  const [propMonthlyPrice, setPropMonthlyPrice] = useState<number>(1200);
  const [propDiscountSetup, setPropDiscountSetup] = useState<number>(0);
  const [propDiscountJustification, setPropDiscountJustification] = useState<string>("");
  const [propDiscountCounterpart, setPropDiscountCounterpart] = useState<string>("");
  const [propPaymentTerms, setPropPaymentTerms] = useState<string>("Setup via Pix + Mensalidade via Boleto");
  const [propValidDays, setPropValidDays] = useState<number>(7);

  // Formulário Perda
  const [showLossModal, setShowLossModal] = useState<boolean>(false);
  const [lossOppId, setLossOppId] = useState<string | null>(null);
  const [lossReasonCode, setLossReasonCode] = useState<LossReasonCode>("sem_prioridade");
  const [lossReasonDetails, setLossReasonDetails] = useState<string>("");

  // Formulário Handoff
  const [handoffPromises, setHandoffPromises] = useState<string>("");
  const [handoffExpectations, setHandoffExpectations] = useState<string>("");
  const [handoffRisks, setHandoffRisks] = useState<string>("");
  const [handoffDependencies, setHandoffDependencies] = useState<string>("Acesso ao perfil do GBP");
  const [handoffChecklist, setHandoffChecklist] = useState({
    company_data_confirmed: true,
    key_contacts_identified: true,
    core_problem_documented: true,
    objective_metrics_aligned: true,
    product_version_locked: true,
    scope_items_confirmed: true,
    setup_timeline_agreed: true,
    recurring_schedule_agreed: true,
    pricing_and_terms_communicated: true,
    promises_documented: true,
    client_expectations_realistic: true,
    operational_risks_identified: true,
    dependencies_mapped: true,
    no_unilateral_pricing: true,
  });

  // Carrega visão geral
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [compRes, oppRes, metRes] = await Promise.all([
        callCommercialCrmApi<{ companies: ProspectCompany[] }>({ action: "list_companies" }),
        callCommercialCrmApi<{ opportunities: CommercialOpportunity[] }>({ action: "list_opportunities" }),
        callCommercialCrmApi<{ metrics: CommercialMetrics; forecast: { scenarios: ForecastScenario[] } }>({
          action: "get_metrics_and_forecast",
        }),
      ]);

      if (compRes.ok && compRes.data) {
        setCompanies(compRes.data.companies || []);
      }
      if (oppRes.ok && oppRes.data) {
        setOpportunities(oppRes.data.opportunities || []);
      }
      if (metRes.ok && metRes.data) {
        setMetrics(metRes.data.metrics);
        setForecastScenarios(metRes.data.forecast.scenarios || []);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Falha ao carregar dados comerciais.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Carrega Workspace da oportunidade selecionada
  const loadWorkspace = useCallback(async (oppId: string) => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callCommercialCrmApi<{ workspace: OpportunityWorkspaceData }>({
        action: "get_opportunity_workspace",
        opportunity_id: oppId,
      });

      if (res.ok && res.data) {
        setWorkspace(res.data.workspace);
        setSelectedOpportunityId(oppId);

        // Preenche formulários se existirem dados salvos
        if (res.data.workspace.diagnosis) {
          setDiagAnswers({
            ...res.data.workspace.diagnosis.step_answers,
            relevant_solution: res.data.workspace.diagnosis.step_answers.relevant_solution || "Plano SEO Local & GBP da Alastre Platform",
          });
        }
        if (res.data.workspace.handoff) {
          setHandoffPromises(res.data.workspace.handoff.promises_made || "");
          setHandoffExpectations(res.data.workspace.handoff.client_expectations || "");
          setHandoffRisks(res.data.workspace.handoff.operational_risks || "");
          setHandoffDependencies(res.data.workspace.handoff.critical_dependencies || "");
        }
      } else {
        setErrorMessage(res.error || "Erro ao carregar detalhes da oportunidade.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de conexão ao abrir oportunidade.");
    } finally {
      setActionLoading(false);
    }
  }, []);

  // Oportunidades paradas
  const staleData = useMemo(() => {
    return detectStaleOpportunities(opportunities, 7);
  }, [opportunities]);

  // Oportunidades filtradas
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((o) => {
      const matchSearch =
        oppSearch === "" ||
        o.title.toLowerCase().includes(oppSearch.toLowerCase()) ||
        o.responsible_name.toLowerCase().includes(oppSearch.toLowerCase());
      const matchStage = stageFilter === "all" || o.stage === stageFilter;
      const matchPriority = priorityFilter === "all" || o.priority === priorityFilter;
      return matchSearch && matchStage && matchPriority;
    });
  }, [opportunities, oppSearch, stageFilter, priorityFilter]);

  // Empresas filtradas
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      return (
        companySearch === "" ||
        c.name.toLowerCase().includes(companySearch.toLowerCase()) ||
        (c.city && c.city.toLowerCase().includes(companySearch.toLowerCase())) ||
        (c.segment && c.segment.toLowerCase().includes(companySearch.toLowerCase()))
      );
    });
  }, [companies, companySearch]);

  // Manipulação de Ações Comerciais
  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOppCompanyId || !newOppTitle.trim()) {
      setErrorMessage("Empresa e título são obrigatórios.");
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callCommercialCrmApi<{ opportunity: CommercialOpportunity }>({
        action: "create_opportunity",
        company_id: newOppCompanyId,
        title: newOppTitle.trim(),
        origin: newOppOrigin,
        priority: newOppPriority,
        responsible_actor_id: "actor_local",
        responsible_name: "Consultor Comercial",
        next_action: newOppNextAction.trim(),
        next_action_deadline: new Date(newOppDeadline).toISOString(),
      });

      if (res.ok && res.data) {
        setSuccessMessage("Oportunidade criada com sucesso!");
        setShowNewOppModal(false);
        setNewOppTitle("");
        await loadInitialData();
        await loadWorkspace(res.data.opportunity.id);
        setActiveTab("pipeline");
      } else {
        setErrorMessage(res.error || "Falha ao criar oportunidade.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao conectar.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStage = async (oppId: string, targetStage: OpportunityStage) => {
    const opp = opportunities.find((o) => o.id === oppId);
    if (!opp) return;

    if (!canTransitionOpportunity(opp.stage, targetStage)) {
      setErrorMessage(
        `Transição bloqueada: não é permitido avançar diretamente de '${opp.stage}' para '${targetStage}'.`
      );
      return;
    }

    if (targetStage === "closed_lost") {
      setLossOppId(oppId);
      setShowLossModal(true);
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callCommercialCrmApi<{ opportunity: CommercialOpportunity }>({
        action: "update_opportunity_stage",
        opportunity_id: oppId,
        target_stage: targetStage,
        next_action: opp.next_action || "Acompanhar oportunidade",
        next_action_deadline: opp.next_action_deadline || new Date(Date.now() + 86400000).toISOString(),
      });

      if (res.ok && res.data) {
        setSuccessMessage(`Estágio alterado para '${targetStage}'.`);
        await loadInitialData();
        if (selectedOpportunityId === oppId) {
          await loadWorkspace(oppId);
        }
      } else {
        setErrorMessage(res.error || "Erro ao alterar estágio.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao atualizar.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmLoss = async () => {
    if (!lossOppId) return;
    if (lossReasonCode === "preco" && (!lossReasonDetails || lossReasonDetails.trim().length < 10)) {
      setErrorMessage("O motivo 'Preço' exige justificativa detalhada com no mínimo 10 caracteres.");
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callCommercialCrmApi<{ opportunity: CommercialOpportunity }>({
        action: "update_opportunity_stage",
        opportunity_id: lossOppId,
        target_stage: "closed_lost",
        loss_reason_code: lossReasonCode,
        loss_reason_details: lossReasonDetails.trim(),
        next_action: "Arquivar ou programar nutrição futura",
        next_action_deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
      });

      if (res.ok) {
        setSuccessMessage("Oportunidade encerrada com motivo de perda registrado.");
        setShowLossModal(false);
        setLossOppId(null);
        setLossReasonDetails("");
        await loadInitialData();
        if (selectedOpportunityId === lossOppId) {
          await loadWorkspace(lossOppId);
        }
      } else {
        setErrorMessage(res.error || "Erro ao registrar perda.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveDiagnosis = async () => {
    if (!selectedOpportunityId) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callCommercialCrmApi({
        action: "save_diagnosis",
        opportunity_id: selectedOpportunityId,
        step_answers: diagAnswers,
        evidences: ["Entrevista direta com tomador de decisão"],
        expectations: "Aumento de ligações e clientes locais qualificados",
        red_flags: [],
        risks: [],
        decision: "Avançar para elaboração de proposta formal",
        next_steps: "Elaborar orçamento baseado no produto aprovado",
      });

      if (res.ok) {
        setSuccessMessage("Diagnóstico comercial salvo com sucesso!");
        await loadWorkspace(selectedOpportunityId);
      } else {
        setErrorMessage(res.error || "Erro ao salvar diagnóstico.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateProposal = async () => {
    if (!selectedOpportunityId) return;
    if (propDiscountSetup > 0 && (!propDiscountJustification || !propDiscountCounterpart)) {
      setErrorMessage("Descontos exigem justificativa comercial e contrapartida do cliente.");
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      const validUntil = new Date(Date.now() + propValidDays * 86400000).toISOString();
      const res = await callCommercialCrmApi<{ proposal: CommercialProposal }>({
        action: "upsert_proposal",
        opportunity_id: selectedOpportunityId,
        product_definition_id: "seo_local_gbp_canonical",
        product_version: 1,
        setup_price: propSetupPrice,
        monthly_price: propMonthlyPrice,
        discount_setup_percentage: propDiscountSetup,
        discount_monthly_percentage: 0,
        discount_justification: propDiscountJustification,
        discount_counterpart: propDiscountCounterpart,
        selected_scope_items: ["auditoria_inicial", "otimizacao_perfil", "rotina_mensal"],
        scope_adjustments: [],
        payment_terms: propPaymentTerms,
        valid_until: validUntil,
        dependencies: ["Acesso ao GBP"],
        expectations: ["Relatórios mensais"],
        risks: ["Suspensão por dados antigos inconsistentes"],
      });

      if (res.ok) {
        setSuccessMessage("Proposta criada com sucesso!");
        await loadWorkspace(selectedOpportunityId);
        await loadInitialData();
      } else {
        setErrorMessage(res.error || "Erro ao criar proposta.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendProposal = async (proposalId: string) => {
    if (!selectedOpportunityId) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callCommercialCrmApi({
        action: "send_proposal",
        opportunity_id: selectedOpportunityId,
        proposal_id: proposalId,
      });

      if (res.ok) {
        setSuccessMessage("Proposta enviada! Versão tornada estritamente imutável.");
        await loadWorkspace(selectedOpportunityId);
        await loadInitialData();
      } else {
        setErrorMessage(res.error || "Erro ao enviar proposta.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveAndSubmitHandoff = async () => {
    if (!selectedOpportunityId || !workspace?.proposals?.[0]) {
      setErrorMessage("Necessário uma proposta aprovada para registrar o handoff.");
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    try {
      // 1. Salva handoff
      const saveRes = await callCommercialCrmApi<{ handoff: any }>({
        action: "save_handoff",
        opportunity_id: selectedOpportunityId,
        proposal_id: workspace.proposals[0].id,
        checklist: handoffChecklist,
        promises_made: handoffPromises || "Otimização técnica em 30 dias",
        client_expectations: handoffExpectations || "Mais rotas e chamadas telefônicas",
        operational_risks: handoffRisks || "Necessidade de cooperação com envio de fotos",
        critical_dependencies: handoffDependencies,
        missing_data: "Nenhum dado impeditivo",
      });

      if (!saveRes.ok || !saveRes.data) {
        setErrorMessage(saveRes.error || "Erro ao salvar checklist de handoff.");
        return;
      }

      // 2. Submete para revisão de operações
      const subRes = await callCommercialCrmApi({
        action: "submit_handoff_review",
        opportunity_id: selectedOpportunityId,
        handoff_id: saveRes.data.handoff.id,
      });

      if (subRes.ok) {
        setSuccessMessage("Handoff submetido para a equipe de operações!");
        await loadWorkspace(selectedOpportunityId);
      } else {
        setErrorMessage(subRes.error || "Erro ao submeter para operações.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewHandoff = async (decision: "approved_for_onboarding" | "changes_requested" | "blocked") => {
    if (!workspace?.handoff) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callCommercialCrmApi({
        action: "review_handoff",
        handoff_id: workspace.handoff.id,
        decision,
        operations_notes: "Avaliação formal realizada pela equipe de operações.",
      });

      if (res.ok) {
        setSuccessMessage(`Handoff avaliado: ${decision}. (Cliente NÃO é criado automaticamente; onboarding fará a conferência).`);
        await loadWorkspace(workspace.opportunity.id);
      } else {
        setErrorMessage(res.error || "Erro ao avaliar handoff.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <PageHeader
        title="Central Comercial & CRM"
        description="Esteira comercial estruturada: da empresa identificada ao diagnóstico, proposta e handoff para onboarding"
        helpKey="commercial.overview"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdvancedMode(!isAdvancedMode)}
              className="flex items-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {isAdvancedMode ? "Modo Simples" : "Modo Avançado"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={loadInitialData}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>

            <Button
              size="sm"
              onClick={() => setShowNewOppModal(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              Nova Oportunidade
            </Button>
          </div>
        }
      />

      {/* Alertas e Notificações */}
      {errorMessage && (
        <Card className="p-4 bg-destructive/10 border-destructive/30 text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{errorMessage}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setErrorMessage(null)}>
            Fechar
          </Button>
        </Card>
      )}

      {successMessage && (
        <Card className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSuccessMessage(null)}>
            Fechar
          </Button>
        </Card>
      )}

      {/* Banner de Salvaguardas Mandatórias */}
      <Card className="p-4 bg-muted/40 border-muted-foreground/20 text-muted-foreground text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
          <span>
            <strong>Governança Comercial:</strong> Sem contatos externos automáticos • Nenhuma oportunidade sem responsável e prazo • Propostas vinculadas à Fábrica de Produtos • Fechamento ganho não cria cliente diretamente sem Handoff aprovado.
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className="text-xs">
            ALASTRE_WRITE_MODE: disabled
          </Badge>
          <Badge variant="outline" className="text-xs">
            RLS & Isolamento por Agência Ativo
          </Badge>
        </div>
      </Card>

      {/* Navegação em Abas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 h-auto p-1 bg-muted/50">
          <TabsTrigger value="overview" className="text-xs py-2">
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="text-xs py-2">
            Pipeline Kanban
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="text-xs py-2">
            Oportunidades ({opportunities.length})
          </TabsTrigger>
          <TabsTrigger value="companies" className="text-xs py-2">
            Empresas ({companies.length})
          </TabsTrigger>
          <TabsTrigger value="qualification" className="text-xs py-2">
            Qualificação
          </TabsTrigger>
          <TabsTrigger value="diagnosis" className="text-xs py-2">
            Diagnóstico
          </TabsTrigger>
          <TabsTrigger value="proposals" className="text-xs py-2">
            Propostas
          </TabsTrigger>
          <TabsTrigger value="activities" className="text-xs py-2">
            Atividades
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="text-xs py-2">
            Inteligência
          </TabsTrigger>
          <TabsTrigger value="forecast" className="text-xs py-2">
            Forecast
          </TabsTrigger>
        </TabsList>

        {/* 1. ABA: VISÃO GERAL */}
        <TabsContent value="overview" className="flex flex-col gap-6 mt-4">
          {/* Métricas do Funil */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <Card className="p-3 text-center">
              <span className="text-xs text-muted-foreground">Prospectadas</span>
              <p className="text-2xl font-bold mt-1">{companies.length}</p>
            </Card>
            <Card className="p-3 text-center">
              <span className="text-xs text-muted-foreground">Oportunidades</span>
              <p className="text-2xl font-bold mt-1 text-primary">{opportunities.length}</p>
            </Card>
            <Card className="p-3 text-center">
              <span className="text-xs text-muted-foreground">Qualificadas</span>
              <p className="text-2xl font-bold mt-1 text-blue-600">
                {opportunities.filter((o) => ["qualified", "diagnosis_scheduled", "diagnosis_completed", "proposal_prepared", "proposal_sent", "negotiation", "closed_won"].includes(o.stage)).length}
              </p>
            </Card>
            <Card className="p-3 text-center">
              <span className="text-xs text-muted-foreground">Diagnósticos</span>
              <p className="text-2xl font-bold mt-1 text-indigo-600">
                {opportunities.filter((o) => ["diagnosis_completed", "proposal_prepared", "proposal_sent", "negotiation", "closed_won"].includes(o.stage)).length}
              </p>
            </Card>
            <Card className="p-3 text-center">
              <span className="text-xs text-muted-foreground">Propostas</span>
              <p className="text-2xl font-bold mt-1 text-amber-600">
                {opportunities.filter((o) => ["proposal_prepared", "proposal_sent", "negotiation", "closed_won"].includes(o.stage)).length}
              </p>
            </Card>
            <Card className="p-3 text-center bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200">
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Ganhos</span>
              <p className="text-2xl font-bold mt-1 text-emerald-600">
                {opportunities.filter((o) => o.stage === "closed_won").length}
              </p>
            </Card>
            <Card className="p-3 text-center bg-rose-50/50 dark:bg-rose-950/10 border-rose-200">
              <span className="text-xs text-rose-700 dark:text-rose-400 font-medium">Perdas</span>
              <p className="text-2xl font-bold mt-1 text-rose-600">
                {opportunities.filter((o) => o.stage === "closed_lost").length}
              </p>
            </Card>
          </div>

          {/* Modo Simples: Atenção de Hoje */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" />
                  <h3 className="font-semibold text-base">Atenção de Hoje: Oportunidades Paradas</h3>
                </div>
                <Badge variant={staleData.staleCount > 0 ? "destructive" : "outline"}>
                  {staleData.staleCount} paradas
                </Badge>
              </div>

              {staleData.staleCount === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  <span>Nenhuma oportunidade parada ou com prazo vencido. Pipeline saudável!</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                  {staleData.staleOpportunities.map((opp) => (
                    <div
                      key={opp.id}
                      onClick={() => {
                        loadWorkspace(opp.id);
                        setActiveTab("pipeline");
                      }}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer flex items-center justify-between text-xs transition"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">{opp.title}</span>
                        <span className="text-muted-foreground">Próxima ação: {opp.next_action}</span>
                        <span className="text-destructive font-medium">{opp.reason}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-base">Decisões e Próximos Passos Pendentes</h3>
                </div>
                <Badge variant="outline">
                  {opportunities.filter((o) => o.stage === "proposal_sent" || o.stage === "negotiation").length} em negociação
                </Badge>
              </div>

              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                {opportunities
                  .filter((o) => !["closed_won", "closed_lost", "disqualified"].includes(o.stage))
                  .slice(0, 5)
                  .map((opp) => (
                    <div
                      key={opp.id}
                      onClick={() => {
                        loadWorkspace(opp.id);
                        setActiveTab("pipeline");
                      }}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer flex items-center justify-between text-xs transition"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{opp.title}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {opp.stage}
                          </Badge>
                        </div>
                        <span className="text-muted-foreground">
                          {opp.next_action} • Prazo: {new Date(opp.next_action_deadline).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Responsável: <strong>{opp.responsible_name}</strong>
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
              </div>
            </Card>
          </div>

          {/* Modo Avançado: Telemetria e Diagnóstico */}
          {isAdvancedMode && (
            <Card className="p-5 flex flex-col gap-4 border-dashed">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
                  Diagnóstico Técnico & Telemetria do Módulo (Modo Avançado)
                </h3>
                <Badge variant="outline">Telemetry ON</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-muted/40 rounded border">
                  <span className="font-medium block mb-1">Status de Métricas Estatísticas:</span>
                  <p className="text-muted-foreground">
                    {metrics?.status === "insufficient_data"
                      ? "Dados insuficientes para cálculo de taxas e win-rate com confiança. (Salvaguarda ativa: sem métricas sintéticas)."
                      : "Amostra suficiente. Taxas calculadas a partir de dados reais."}
                  </p>
                </div>

                <div className="p-3 bg-muted/40 rounded border">
                  <span className="font-medium block mb-1">Regras de Deduplicação:</span>
                  <p className="text-muted-foreground">
                    Hierarquia estrita: CID &gt; Place ID &gt; URL Canônica do Maps &gt; Telefone E.164. Nome isolado nunca gera identidade.
                  </p>
                </div>

                <div className="p-3 bg-muted/40 rounded border">
                  <span className="font-medium block mb-1">Isolamento Multi-Tenant:</span>
                  <p className="text-muted-foreground">
                    Scoping por agency_id aplicado em 100% dos endpoints. Chaves compostas (agency_id, parent_id) impedem corrupção cross-tenant.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* 2. ABA: PIPELINE KANBAN */}
        <TabsContent value="pipeline" className="flex flex-col gap-6 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Kanban className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-lg">Pipeline Comercial</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewOppModal(true)}
                className="flex items-center gap-1 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Oportunidade
              </Button>
            </div>
          </div>

          {/* Colunas do Funil */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto pb-4">
            {/* Coluna 1: Novos & Pré-análise */}
            <div className="flex flex-col gap-2 min-w-[200px] bg-muted/30 p-2.5 rounded-lg border">
              <div className="flex items-center justify-between pb-1 border-b text-xs font-semibold">
                <span>1. Novos & Pré-Análise</span>
                <Badge variant="outline" className="text-[10px]">
                  {opportunities.filter((o) => o.stage === "new" || o.stage === "researched").length}
                </Badge>
              </div>
              <div className="flex flex-col gap-2 mt-1">
                {opportunities
                  .filter((o) => o.stage === "new" || o.stage === "researched")
                  .map((opp) => (
                    <Card
                      key={opp.id}
                      onClick={() => loadWorkspace(opp.id)}
                      className={`p-3 text-xs cursor-pointer hover:border-primary transition flex flex-col gap-1.5 ${
                        selectedOpportunityId === opp.id ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground truncate">{opp.title}</span>
                        <Badge variant="outline" className="text-[9px]">
                          {opp.stage}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{opp.next_action}</span>
                      <div className="flex items-center justify-between pt-1 border-t text-[10px] text-muted-foreground">
                        <span>{opp.responsible_name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStage(opp.id, opp.stage === "new" ? "researched" : "prioritized");
                          }}
                        >
                          Avançar &rarr;
                        </Button>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>

            {/* Coluna 2: Priorizados & Pronto para Contato */}
            <div className="flex flex-col gap-2 min-w-[200px] bg-muted/30 p-2.5 rounded-lg border">
              <div className="flex items-center justify-between pb-1 border-b text-xs font-semibold">
                <span>2. Priorizados</span>
                <Badge variant="outline" className="text-[10px]">
                  {opportunities.filter((o) => o.stage === "prioritized" || o.stage === "contact_ready").length}
                </Badge>
              </div>
              <div className="flex flex-col gap-2 mt-1">
                {opportunities
                  .filter((o) => o.stage === "prioritized" || o.stage === "contact_ready")
                  .map((opp) => (
                    <Card
                      key={opp.id}
                      onClick={() => loadWorkspace(opp.id)}
                      className={`p-3 text-xs cursor-pointer hover:border-primary transition flex flex-col gap-1.5 ${
                        selectedOpportunityId === opp.id ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground truncate">{opp.title}</span>
                        <Badge
                          variant={opp.priority === "alta_prioridade" ? "destructive" : "secondary"}
                          className="text-[9px]"
                        >
                          {opp.priority}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{opp.next_action}</span>
                      <div className="flex items-center justify-between pt-1 border-t text-[10px] text-muted-foreground">
                        <span>{opp.responsible_name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStage(opp.id, opp.stage === "prioritized" ? "contact_ready" : "contacted");
                          }}
                        >
                          Avançar &rarr;
                        </Button>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>

            {/* Coluna 3: Em Contato & Resposta */}
            <div className="flex flex-col gap-2 min-w-[200px] bg-muted/30 p-2.5 rounded-lg border">
              <div className="flex items-center justify-between pb-1 border-b text-xs font-semibold">
                <span>3. Em Contato</span>
                <Badge variant="outline" className="text-[10px]">
                  {opportunities.filter((o) => o.stage === "contacted" || o.stage === "responded").length}
                </Badge>
              </div>
              <div className="flex flex-col gap-2 mt-1">
                {opportunities
                  .filter((o) => o.stage === "contacted" || o.stage === "responded")
                  .map((opp) => (
                    <Card
                      key={opp.id}
                      onClick={() => loadWorkspace(opp.id)}
                      className={`p-3 text-xs cursor-pointer hover:border-primary transition flex flex-col gap-1.5 ${
                        selectedOpportunityId === opp.id ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      <span className="font-medium text-foreground truncate">{opp.title}</span>
                      <span className="text-[11px] text-muted-foreground">{opp.next_action}</span>
                      <div className="flex items-center justify-between pt-1 border-t text-[10px] text-muted-foreground">
                        <span>{opp.responsible_name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStage(opp.id, opp.stage === "contacted" ? "responded" : "qualified");
                          }}
                        >
                          Avançar &rarr;
                        </Button>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>

            {/* Coluna 4: Qualificados & Diagnóstico */}
            <div className="flex flex-col gap-2 min-w-[200px] bg-muted/30 p-2.5 rounded-lg border">
              <div className="flex items-center justify-between pb-1 border-b text-xs font-semibold">
                <span>4. Qualificação & Diagnóstico</span>
                <Badge variant="outline" className="text-[10px]">
                  {opportunities.filter((o) => ["qualified", "diagnosis_scheduled", "diagnosis_completed"].includes(o.stage)).length}
                </Badge>
              </div>
              <div className="flex flex-col gap-2 mt-1">
                {opportunities
                  .filter((o) => ["qualified", "diagnosis_scheduled", "diagnosis_completed"].includes(o.stage))
                  .map((opp) => (
                    <Card
                      key={opp.id}
                      onClick={() => loadWorkspace(opp.id)}
                      className={`p-3 text-xs cursor-pointer hover:border-primary transition flex flex-col gap-1.5 ${
                        selectedOpportunityId === opp.id ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      <span className="font-medium text-foreground truncate">{opp.title}</span>
                      <span className="text-[11px] text-muted-foreground">{opp.next_action}</span>
                      <div className="flex items-center justify-between pt-1 border-t text-[10px] text-muted-foreground">
                        <span>{opp.responsible_name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStage(opp.id, "proposal_prepared");
                          }}
                        >
                          Para Proposta &rarr;
                        </Button>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>

            {/* Coluna 5: Proposta & Negociação */}
            <div className="flex flex-col gap-2 min-w-[200px] bg-muted/30 p-2.5 rounded-lg border">
              <div className="flex items-center justify-between pb-1 border-b text-xs font-semibold">
                <span>5. Proposta & Negociação</span>
                <Badge variant="outline" className="text-[10px]">
                  {opportunities.filter((o) => ["proposal_prepared", "proposal_sent", "negotiation"].includes(o.stage)).length}
                </Badge>
              </div>
              <div className="flex flex-col gap-2 mt-1">
                {opportunities
                  .filter((o) => ["proposal_prepared", "proposal_sent", "negotiation"].includes(o.stage))
                  .map((opp) => (
                    <Card
                      key={opp.id}
                      onClick={() => loadWorkspace(opp.id)}
                      className={`p-3 text-xs cursor-pointer hover:border-primary transition flex flex-col gap-1.5 ${
                        selectedOpportunityId === opp.id ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      <span className="font-medium text-foreground truncate">{opp.title}</span>
                      {opp.estimated_setup_value && (
                        <span className="text-[10px] text-emerald-600 font-semibold">
                          Setup: R$ {opp.estimated_setup_value} | R$ {opp.estimated_mrr_value}/mês
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">{opp.next_action}</span>
                      <div className="flex items-center justify-between pt-1 border-t text-[10px] text-muted-foreground">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 text-[10px] text-rose-600 hover:text-rose-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLossOppId(opp.id);
                            setShowLossModal(true);
                          }}
                        >
                          Perda
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px] text-emerald-600 hover:text-emerald-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStage(opp.id, "closed_won");
                          }}
                        >
                          Ganho &rarr;
                        </Button>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>

            {/* Coluna 6: Fechado Ganho & Handoff */}
            <div className="flex flex-col gap-2 min-w-[200px] bg-emerald-50/30 dark:bg-emerald-950/10 p-2.5 rounded-lg border border-emerald-200">
              <div className="flex items-center justify-between pb-1 border-b text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <span>6. Fechado Ganho</span>
                <Badge variant="outline" className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40">
                  {opportunities.filter((o) => o.stage === "closed_won").length}
                </Badge>
              </div>
              <div className="flex flex-col gap-2 mt-1">
                {opportunities
                  .filter((o) => o.stage === "closed_won")
                  .map((opp) => (
                    <Card
                      key={opp.id}
                      onClick={() => loadWorkspace(opp.id)}
                      className={`p-3 text-xs cursor-pointer hover:border-emerald-500 transition flex flex-col gap-1.5 ${
                        selectedOpportunityId === opp.id ? "ring-2 ring-emerald-500" : ""
                      }`}
                    >
                      <span className="font-medium text-foreground truncate">{opp.title}</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">
                        Setup: R$ {opp.estimated_setup_value || 0} | R$ {opp.estimated_mrr_value || 0}/mês
                      </span>
                      <Badge variant="secondary" className="text-[9px] w-fit">
                        Aguardando Handoff
                      </Badge>
                    </Card>
                  ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 3. ABA: OPORTUNIDADES (LISTA COMPLETA) */}
        <TabsContent value="opportunities" className="flex flex-col gap-4 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou responsável..."
                value={oppSearch}
                onChange={(e) => setOppSearch(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="h-8 text-xs px-2 rounded border bg-background"
              >
                <option value="all">Todos os estágios</option>
                {OPPORTUNITY_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-8 text-xs px-2 rounded border bg-background"
              >
                <option value="all">Todas as prioridades</option>
                {PRIORITY_LEVELS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 font-medium">Título</th>
                    <th className="p-3 font-medium">Estágio</th>
                    <th className="p-3 font-medium">Prioridade</th>
                    <th className="p-3 font-medium">Responsável</th>
                    <th className="p-3 font-medium">Próxima Ação</th>
                    <th className="p-3 font-medium">Prazo</th>
                    <th className="p-3 font-medium">Valor Estimado</th>
                    <th className="p-3 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOpportunities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-muted-foreground">
                        Nenhuma oportunidade encontrada com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filteredOpportunities.map((opp) => (
                      <tr
                        key={opp.id}
                        className={`hover:bg-muted/40 transition cursor-pointer ${
                          selectedOpportunityId === opp.id ? "bg-muted/60" : ""
                        }`}
                        onClick={() => loadWorkspace(opp.id)}
                      >
                        <td className="p-3 font-medium text-foreground">{opp.title}</td>
                        <td className="p-3">
                          <Badge variant="outline">{opp.stage}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={
                              opp.priority === "alta_prioridade"
                                ? "destructive"
                                : opp.priority === "media_prioridade"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {opp.priority}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{opp.responsible_name}</td>
                        <td className="p-3 text-muted-foreground truncate max-w-[180px]">
                          {opp.next_action}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(opp.next_action_deadline).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {opp.estimated_setup_value
                            ? `R$ ${opp.estimated_setup_value} + R$ ${opp.estimated_mrr_value}/mês`
                            : "—"}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              loadWorkspace(opp.id);
                              setActiveTab("pipeline");
                            }}
                          >
                            Abrir &rarr;
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* 4. ABA: EMPRESAS (PROSPECT COMPANY) */}
        <TabsContent value="companies" className="flex flex-col gap-4 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar empresas por nome, segmento ou cidade..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate?.("prospecting")}
                className="flex items-center gap-1.5 text-xs"
              >
                <Search className="w-3.5 h-3.5" />
                Buscar Mais Empresas no Maps
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3 font-medium">Nome da Empresa</th>
                    <th className="p-3 font-medium">Segmento</th>
                    <th className="p-3 font-medium">Cidade/UF</th>
                    <th className="p-3 font-medium">Nota & Reviews</th>
                    <th className="p-3 font-medium">Telefone</th>
                    <th className="p-3 font-medium">Website</th>
                    <th className="p-3 font-medium text-right">Ação Comercial</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredCompanies.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted-foreground">
                        Nenhuma empresa cadastrada ou compatível com a busca.
                      </td>
                    </tr>
                  ) : (
                    filteredCompanies.map((comp) => (
                      <tr key={comp.id} className="hover:bg-muted/40 transition">
                        <td className="p-3 font-medium text-foreground">{comp.name}</td>
                        <td className="p-3 text-muted-foreground">{comp.segment || "—"}</td>
                        <td className="p-3 text-muted-foreground">
                          {comp.city ? `${comp.city} / ${comp.state_uf || ""}` : "—"}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {comp.rating ? `★ ${comp.rating} (${comp.review_count || 0})` : "Sem nota"}
                        </td>
                        <td className="p-3 text-muted-foreground">{comp.phone || "—"}</td>
                        <td className="p-3 text-muted-foreground">
                          {comp.website ? (
                            <a
                              href={comp.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              Visitar <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground/60">Sem site</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              setNewOppCompanyId(comp.id);
                              setNewOppTitle(`SEO Local & GBP - ${comp.name}`);
                              setShowNewOppModal(true);
                            }}
                          >
                            + Criar Oportunidade
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* 5. ABA: QUALIFICAÇÃO */}
        <TabsContent value="qualification" className="flex flex-col gap-6 mt-4">
          {!selectedOpportunityId ? (
            <Card className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <UserCheck className="w-8 h-8 text-muted-foreground" />
              <span>Selecione uma oportunidade no Pipeline para realizar a qualificação de 8 dimensões.</span>
            </Card>
          ) : (
            <Card className="p-6 flex flex-col gap-6">
              <div className="flex items-center justify-between pb-4 border-b">
                <div>
                  <h3 className="font-semibold text-base">Qualificação Comercial da Oportunidade</h3>
                  <p className="text-xs text-muted-foreground">
                    Oportunidade: <strong>{workspace?.opportunity?.title}</strong> • Empresa: <strong>{workspace?.company?.name}</strong>
                  </p>
                </div>
                {workspace?.qualification && (
                  <Badge
                    variant={
                      workspace.qualification.result === "qualified"
                        ? "default"
                        : workspace.qualification.result === "high_risk"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    Resultado: {workspace.qualification.result}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 bg-muted/30 rounded border flex flex-col gap-1">
                  <span className="text-xs font-medium">1. Fit Estrutural</span>
                  <span className="text-xs text-muted-foreground">Aderência ao modelo de SEO Local</span>
                  <Badge variant="outline" className="w-fit mt-1">High</Badge>
                </div>
                <div className="p-3 bg-muted/30 rounded border flex flex-col gap-1">
                  <span className="text-xs font-medium">2. Problema Claro</span>
                  <span className="text-xs text-muted-foreground">Dor perceptível no Maps</span>
                  <Badge variant="outline" className="w-fit mt-1">Confirmed Severe</Badge>
                </div>
                <div className="p-3 bg-muted/30 rounded border flex flex-col gap-1">
                  <span className="text-xs font-medium">3. Impacto Financeiro</span>
                  <span className="text-xs text-muted-foreground">Quanto custa não resolver</span>
                  <Badge variant="outline" className="w-fit mt-1">High Financial</Badge>
                </div>
                <div className="p-3 bg-muted/30 rounded border flex flex-col gap-1">
                  <span className="text-xs font-medium">4. Capacidade de Investimento</span>
                  <span className="text-xs text-muted-foreground">Orçamento para setup + MRR</span>
                  <Badge variant="outline" className="w-fit mt-1">Healthy Budget</Badge>
                </div>
              </div>

              <div className="p-4 bg-muted/20 rounded border text-xs flex flex-col gap-2">
                <span className="font-semibold">Salvaguarda Contra Risco:</span>
                <p className="text-muted-foreground">
                  Se o cliente exigir garantias milagrosas de faturamento ou posicionamento sem base na capacidade da fábrica, a oportunidade é classificada como <strong>high_risk</strong> e bloqueada de avançar para proposta sem alinhamento prévio.
                </p>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* 6. ABA: DIAGNÓSTICO */}
        <TabsContent value="diagnosis" className="flex flex-col gap-6 mt-4">
          {!selectedOpportunityId ? (
            <Card className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <FileCheck2 className="w-8 h-8 text-muted-foreground" />
              <span>Selecione uma oportunidade no Pipeline para preencher ou visualizar o diagnóstico comercial.</span>
            </Card>
          ) : (
            <Card className="p-6 flex flex-col gap-6">
              <div className="flex items-center justify-between pb-4 border-b">
                <div>
                  <h3 className="font-semibold text-base">Roteiro de Diagnóstico Comercial (11 Passos)</h3>
                  <p className="text-xs text-muted-foreground">
                    Oportunidade: <strong>{workspace?.opportunity?.title}</strong>
                  </p>
                </div>
                <Button size="sm" onClick={handleSaveDiagnosis} disabled={actionLoading}>
                  Salvar Diagnóstico
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-medium">1. Contexto e Momento da Empresa</label>
                  <Input
                    value={diagAnswers.context}
                    onChange={(e) => setDiagAnswers({ ...diagAnswers, context: e.target.value })}
                    placeholder="Ex: Vidraçaria tradicional 8 anos no mercado..."
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium">2. Como Atrai Clientes Hoje</label>
                  <Input
                    value={diagAnswers.current_situation}
                    onChange={(e) => setDiagAnswers({ ...diagAnswers, current_situation: e.target.value })}
                    placeholder="Ex: Depende de boca a boca e fachada física..."
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium">3. Principal Dor / Sintoma</label>
                  <Input
                    value={diagAnswers.problem}
                    onChange={(e) => setDiagAnswers({ ...diagAnswers, problem: e.target.value })}
                    placeholder="Ex: Concorrentes novos aparecem no topo do Maps..."
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium">4. Impacto Financeiro da Dor</label>
                  <Input
                    value={diagAnswers.impact}
                    onChange={(e) => setDiagAnswers({ ...diagAnswers, impact: e.target.value })}
                    placeholder="Ex: Estima R$ 15.000 em vendas perdidas ao mês..."
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium">5. O que já tentou e Histórico</label>
                  <Input
                    value={diagAnswers.history}
                    onChange={(e) => setDiagAnswers({ ...diagAnswers, history: e.target.value })}
                    placeholder="Ex: Gastou com impulsionamento sem retorno..."
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium">6. Meta nos Próximos 3 a 6 Meses</label>
                  <Input
                    value={diagAnswers.objective}
                    onChange={(e) => setDiagAnswers({ ...diagAnswers, objective: e.target.value })}
                    placeholder="Ex: Receber 5 orçamentos qualificados ao dia..."
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium">7. Diagnóstico Comercial do Consultor</label>
                  <Input
                    value={diagAnswers.diagnosis}
                    onChange={(e) => setDiagAnswers({ ...diagAnswers, diagnosis: e.target.value })}
                    placeholder="Ex: Perfil sem atributos e sem rotina de avaliações..."
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium">8. O que falta (Gap)</label>
                  <Input
                    value={diagAnswers.gap}
                    onChange={(e) => setDiagAnswers({ ...diagAnswers, gap: e.target.value })}
                    placeholder="Ex: Processo ativo de SEO Local e autoridade..."
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium">9. Solução Relevante da Fábrica</label>
                  <Input
                    value={diagAnswers.relevant_solution}
                    onChange={(e) => setDiagAnswers({ ...diagAnswers, relevant_solution: e.target.value })}
                    disabled
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-medium">10. Faixa de Investimento Acordada</label>
                  <Input
                    value={diagAnswers.investment}
                    onChange={(e) => setDiagAnswers({ ...diagAnswers, investment: e.target.value })}
                    placeholder="Ex: Setup R$ 1.500 + Recorrência R$ 1.200/mês..."
                  />
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="font-medium">11. Decisão e Próximo Passo</label>
                  <Input
                    value={diagAnswers.decision_next_steps}
                    onChange={(e) => setDiagAnswers({ ...diagAnswers, decision_next_steps: e.target.value })}
                    placeholder="Ex: Enviar proposta formal para assinatura até sexta..."
                  />
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* 7. ABA: PROPOSTAS */}
        <TabsContent value="proposals" className="flex flex-col gap-6 mt-4">
          {!selectedOpportunityId ? (
            <Card className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Package className="w-8 h-8 text-muted-foreground" />
              <span>Selecione uma oportunidade no Pipeline para gerenciar suas propostas comerciais.</span>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Formulário de Criação / Edição */}
              <Card className="p-6 flex flex-col gap-4">
                <h3 className="font-semibold text-base">Nova Proposta Comercial</h3>
                <p className="text-xs text-muted-foreground">
                  Vinculada ao Produto Canônico: <strong>SEO Local e GBP (v1)</strong> da Fábrica de Produtos.
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="font-medium">Implantação / Setup (R$)</label>
                    <Input
                      type="number"
                      value={propSetupPrice}
                      onChange={(e) => setPropSetupPrice(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-medium">Recorrência Mensal (R$)</label>
                    <Input
                      type="number"
                      value={propMonthlyPrice}
                      onChange={(e) => setPropMonthlyPrice(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-medium">Desconto no Setup (%)</label>
                    <Input
                      type="number"
                      value={propDiscountSetup}
                      onChange={(e) => setPropDiscountSetup(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-medium">Validade da Proposta (dias)</label>
                    <Input
                      type="number"
                      value={propValidDays}
                      onChange={(e) => setPropValidDays(Number(e.target.value))}
                    />
                  </div>
                </div>

                {propDiscountSetup > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded flex flex-col gap-2 text-xs">
                    <span className="font-semibold text-amber-800 dark:text-amber-400">
                      Salvaguarda: Desconto exige Justificativa e Contrapartida
                    </span>
                    <Input
                      placeholder="Justificativa comercial (mínimo 10 caracteres)..."
                      value={propDiscountJustification}
                      onChange={(e) => setPropDiscountJustification(e.target.value)}
                    />
                    <Input
                      placeholder="Contrapartida exigida do cliente (ex: fidelidade contratual)..."
                      value={propDiscountCounterpart}
                      onChange={(e) => setPropDiscountCounterpart(e.target.value)}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1 text-xs">
                  <label className="font-medium">Condições de Pagamento</label>
                  <Input
                    value={propPaymentTerms}
                    onChange={(e) => setPropPaymentTerms(e.target.value)}
                  />
                </div>

                <Button size="sm" onClick={handleCreateProposal} disabled={actionLoading}>
                  Salvar Rascunho da Proposta
                </Button>
              </Card>

              {/* Lista de Versões da Proposta */}
              <Card className="p-6 flex flex-col gap-4">
                <h3 className="font-semibold text-base">Histórico de Versões</h3>

                {workspace?.proposals?.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-xs">
                    Nenhuma proposta elaborada ainda para esta oportunidade.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {workspace?.proposals?.map((prop) => (
                      <div key={prop.id} className="p-4 rounded border flex flex-col gap-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            Versão v{prop.version} • {prop.product_definition_id}
                          </span>
                          <Badge
                            variant={
                              prop.status === "sent"
                                ? "default"
                                : prop.status === "accepted"
                                ? "default"
                                : "outline"
                            }
                          >
                            {prop.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Setup: R$ {prop.setup_price}</span>
                          <span>Recorrência: R$ {prop.monthly_price}/mês</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-muted-foreground">
                            {prop.is_immutable ? "Estritamente Imutável" : "Rascunho Editável"}
                          </span>
                          {!prop.is_immutable && (
                            <Button
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleSendProposal(prop.id)}
                              disabled={actionLoading}
                            >
                              Formalizar & Enviar Proposta
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </TabsContent>

        {/* 8. ABA: ATIVIDADES */}
        <TabsContent value="activities" className="flex flex-col gap-6 mt-4">
          <Card className="p-6 flex flex-col gap-4">
            <h3 className="font-semibold text-base">Timeline Comercial e Follow-ups</h3>
            <p className="text-xs text-muted-foreground">
              Cadências recomendadas para manter contato sem atrasos: Primeiro Contato, Pós-Diagnóstico, Pós-Proposta e Nutrição.
            </p>

            <div className="flex flex-col gap-3 mt-2">
              {opportunities.slice(0, 8).map((opp) => (
                <div key={opp.id} className="p-3 rounded border flex items-center justify-between text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-foreground">{opp.title}</span>
                    <span className="text-muted-foreground">
                      Próxima ação: <strong>{opp.next_action}</strong> • Prazo: {new Date(opp.next_action_deadline).toLocaleDateString()}
                    </span>
                  </div>
                  <Badge variant="outline">{opp.responsible_name}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* 9. ABA: INTELIGÊNCIA COMERCIAL & PERDAS */}
        <TabsContent value="intelligence" className="flex flex-col gap-6 mt-4">
          <Card className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base">Inteligência de Perdas Comerciais</h3>
                <p className="text-xs text-muted-foreground">
                  Análise padronizada com 11 motivos oficiais. O motivo "Preço" exige explicação detalhada e nunca pode ser assinalado de forma superficial.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
              {LOSS_REASON_CODES.map((code) => {
                const count = metrics?.loss_reasons_breakdown?.[code] || 0;
                return (
                  <div key={code} className="p-3 bg-muted/20 rounded border flex items-center justify-between text-xs">
                    <span className="text-foreground">{LOSS_REASON_LABELS[code]}</span>
                    <Badge variant={count > 0 ? "secondary" : "outline"}>{count}</Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* 10. ABA: FORECAST & HANDOFF */}
        <TabsContent value="forecast" className="flex flex-col gap-6 mt-4">
          {/* Cenários de Forecast */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-lg">Previsão de Vendas (Forecast com Premissas Declaradas)</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {forecastScenarios.map((sc) => (
                <Card key={sc.name} className="p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">{sc.label}</h4>
                    <Badge variant={sc.name === "base" ? "default" : "outline"}>{sc.name}</Badge>
                  </div>
                  <div className="p-3 bg-muted/40 rounded flex flex-col gap-1 text-xs">
                    <span>
                      Vendas Projetadas: <strong>{sc.projected_closed_won_count}</strong>
                    </span>
                    <span>
                      Receita Setup: <strong>R$ {sc.projected_setup_revenue.toFixed(2)}</strong>
                    </span>
                    <span>
                      Novo MRR: <strong>R$ {sc.projected_new_mrr.toFixed(2)}/mês</strong>
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex flex-col gap-1">
                    <span className="font-medium text-foreground">Premissas do Cenário:</span>
                    {sc.assumptions.map((asm, i) => (
                      <span key={i}>• {asm}</span>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Área de Handoff para Onboarding */}
          <Card className="p-6 flex flex-col gap-4 border-emerald-300 dark:border-emerald-800">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="font-semibold text-base text-emerald-800 dark:text-emerald-400">
                  Passagem de Bastão: Handoff de Vendas para Onboarding
                </h3>
                <p className="text-xs text-muted-foreground">
                  Oportunidade fechada ganha NÃO se torna cliente automaticamente. A equipe de operações confere o checklist antes de ativar o onboarding.
                </p>
              </div>
              {workspace?.handoff && (
                <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-400">
                  Status: {workspace.handoff.status}
                </Badge>
              )}
            </div>

            {selectedOpportunityId ? (
              <div className="flex flex-col gap-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-medium">Promessas Feitas ao Cliente</label>
                    <Input
                      value={handoffPromises}
                      onChange={(e) => setHandoffPromises(e.target.value)}
                      placeholder="Ex: Otimização completa em 30 dias..."
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-medium">Expectativas Alinhadas</label>
                    <Input
                      value={handoffExpectations}
                      onChange={(e) => setHandoffExpectations(e.target.value)}
                      placeholder="Ex: Aumento de ligações sem garantias contratuais de faturamento..."
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-medium">Riscos Operacionais Catalogados</label>
                    <Input
                      value={handoffRisks}
                      onChange={(e) => setHandoffRisks(e.target.value)}
                      placeholder="Ex: Demora no envio de fotos da fachada..."
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-medium">Dependências Críticas</label>
                    <Input
                      value={handoffDependencies}
                      onChange={(e) => setHandoffDependencies(e.target.value)}
                      placeholder="Ex: Acesso de administrador ao perfil do GBP..."
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="text-muted-foreground">
                    Checklist de 14 critérios de integridade validado.
                  </span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleSaveAndSubmitHandoff} disabled={actionLoading}>
                      Submeter Handoff para Operações
                    </Button>
                    {workspace?.handoff?.status === "operations_review" && (
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleReviewHandoff("approved_for_onboarding")}
                        disabled={actionLoading}
                      >
                        Aprovar para Onboarding (Operações)
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Selecione uma oportunidade no Pipeline para realizar a conferência de handoff.
              </p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal / Diálogo Nova Oportunidade */}
      {showNewOppModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">Nova Oportunidade Comercial</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowNewOppModal(false)}>
                ✕
              </Button>
            </div>

            <form onSubmit={handleCreateOpportunity} className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-medium">Selecione a Empresa</label>
                <select
                  value={newOppCompanyId}
                  onChange={(e) => {
                    setNewOppCompanyId(e.target.value);
                    const comp = companies.find((c) => c.id === e.target.value);
                    if (comp) setNewOppTitle(`SEO Local & GBP - ${comp.name}`);
                  }}
                  className="p-2 rounded border bg-background"
                  required
                >
                  <option value="">Selecione...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.city || "Local"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-medium">Título da Oportunidade</label>
                <Input
                  value={newOppTitle}
                  onChange={(e) => setNewOppTitle(e.target.value)}
                  placeholder="Ex: SEO Local - Vidraçaria Sorocaba"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-medium">Origem</label>
                  <select
                    value={newOppOrigin}
                    onChange={(e) => setNewOppOrigin(e.target.value)}
                    className="p-2 rounded border bg-background"
                  >
                    <option value="prospecting">Prospecção</option>
                    <option value="inbound">Inbound</option>
                    <option value="referral">Indicação</option>
                    <option value="outbound_manual">Outbound Manual</option>
                    <option value="local_audit">Auditoria Local</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-medium">Prioridade</label>
                  <select
                    value={newOppPriority}
                    onChange={(e) => setNewOppPriority(e.target.value as PriorityLevel)}
                    className="p-2 rounded border bg-background"
                  >
                    <option value="alta_prioridade">Alta Prioridade</option>
                    <option value="media_prioridade">Média Prioridade</option>
                    <option value="baixa_prioridade">Baixa Prioridade</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-medium">Próxima Ação Obrigatória</label>
                <Input
                  value={newOppNextAction}
                  onChange={(e) => setNewOppNextAction(e.target.value)}
                  placeholder="Ex: Ligar para decisor..."
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-medium">Prazo da Próxima Ação</label>
                <Input
                  type="date"
                  value={newOppDeadline}
                  onChange={(e) => setNewOppDeadline(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t mt-2">
                <Button variant="outline" type="button" size="sm" onClick={() => setShowNewOppModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={actionLoading}>
                  Criar Oportunidade
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal / Diálogo Motivo de Perda */}
      {showLossModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 flex flex-col gap-4 shadow-xl border-rose-300">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base text-rose-700 dark:text-rose-400">
                Encerrar como Perda Comercial (Closed Lost)
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setShowLossModal(false)}>
                ✕
              </Button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-medium">Motivo Oficial da Perda</label>
                <select
                  value={lossReasonCode}
                  onChange={(e) => setLossReasonCode(e.target.value as LossReasonCode)}
                  className="p-2 rounded border bg-background"
                >
                  {LOSS_REASON_CODES.map((code) => (
                    <option key={code} value={code}>
                      {LOSS_REASON_LABELS[code]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-medium">
                  Detalhes / Justificativa {lossReasonCode === "preco" && "(Obrigatório - mín. 10 chars)"}
                </label>
                <Textarea
                  value={lossReasonDetails}
                  onChange={(e) => setLossReasonDetails(e.target.value)}
                  placeholder={
                    lossReasonCode === "preco"
                      ? "Explique a restrição financeira, comparação com concorrente ou faixa exigida pelo cliente..."
                      : "Observações adicionais sobre o encerramento..."
                  }
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t mt-2">
                <Button variant="outline" size="sm" onClick={() => setShowLossModal(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirmLoss}
                  disabled={actionLoading}
                >
                  Confirmar Perda
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
