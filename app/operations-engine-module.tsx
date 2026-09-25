"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Kanban,
  Layers,
  ListTodo,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Timer,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { IntegrationState } from "@/components/platform-state";
import { useAuth } from "@/lib/auth-context";
import type { View } from "./app-shell";
import {
  calculateCapacityMetrics,
  categorizeOperationalQueues,
  type CapacityMetrics,
  type OperationalQueues,
  type Workflow,
  type WorkflowTemplate,
  type WorkItem,
  type WorkItemStatus,
} from "@/lib/operations-domain";

type TabId = "queues" | "workflows" | "kanban" | "capacity" | "templates";

export function OperationsEngineModule(_props?: {
  onNavigate?: (view: View) => void;
}) {
  useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("queues");
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Dados do Workspace Operacional
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [queues, setQueues] = useState<OperationalQueues | null>(null);
  const [capacity, setCapacity] = useState<CapacityMetrics | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQueueFilter, setSelectedQueueFilter] = useState<
    "all" | "attention" | "overdue" | "blocked" | "in_review" | "in_progress" | "todo"
  >("attention");

  // Diálogo de Apontamento de Tempo
  const [timeLogModalItem, setTimeLogModalItem] = useState<WorkItem | null>(null);
  const [timeLogMinutes, setTimeLogMinutes] = useState(30);
  const [timeLogNotes, setTimeLogNotes] = useState("");

  // Diálogo de Conclusão / Evidência
  const [completeModalItem, setCompleteModalItem] = useState<WorkItem | null>(null);
  const [evidenceText, setEvidenceText] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  // Diálogo de Bloqueio
  const [blockModalItem, setBlockModalItem] = useState<WorkItem | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [clientActionRequired, setClientActionRequired] = useState("");

  // Diálogo de Criação de Workflow
  const [showCreateWorkflowModal, setShowCreateWorkflowModal] = useState(false);
  const [newWorkflowTitle, setNewWorkflowTitle] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");

  // Carregamento de dados
  const loadWorkspace = useCallback(async (signal?: AbortSignal) => {
    try {
      setErrorMessage(null);
      const res = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_workspace" }),
        signal,
      });

      if (!res.ok) {
        if (res.status === 503) {
          setUnavailable(true);
          return;
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.success) {
        setWorkflows(data.workflows || []);
        setWorkItems(data.workItems || []);
        setTemplates(data.templates || []);
        setQueues(data.queues || categorizeOperationalQueues(data.workItems || []));
        setCapacity(data.capacity || calculateCapacityMetrics(data.workItems || []));
        setUnavailable(false);
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return;
      setErrorMessage((err as Error)?.message || "Falha ao sincronizar operações.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void loadWorkspace(ctrl.signal);
    return () => ctrl.abort();
  }, [loadWorkspace]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadWorkspace();
  };

  // Ações Operacionais
  const handleStartTask = async (workItemId: string) => {
    try {
      setErrorMessage(null);
      const res = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_task", work_item_id: workItemId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível iniciar a tarefa.");
      }
      setFeedbackSuccess("Tarefa iniciada com sucesso!");
      setTimeout(() => setFeedbackSuccess(null), 3000);
      void loadWorkspace();
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message);
    }
  };

  const handleCompleteTask = async () => {
    if (!completeModalItem) return;
    try {
      setErrorMessage(null);
      const res = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete_task",
          work_item_id: completeModalItem.id,
          evidence_text: evidenceText || null,
          evidence_url: evidenceUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível concluir a tarefa.");
      }
      setFeedbackSuccess(
        data.status === "in_review"
          ? "Tarefa submetida para aprovação humana da liderança!"
          : "Tarefa concluída com sucesso!"
      );
      setTimeout(() => setFeedbackSuccess(null), 3000);
      setCompleteModalItem(null);
      setEvidenceText("");
      setEvidenceUrl("");
      void loadWorkspace();
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message);
    }
  };

  const handleLogTime = async () => {
    if (!timeLogModalItem) return;
    try {
      setErrorMessage(null);
      const res = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log_time",
          client_id: timeLogModalItem.client_id,
          work_item_id: timeLogModalItem.id,
          minutes_spent: Number(timeLogMinutes),
          notes: timeLogNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível apontar o tempo.");
      }
      setFeedbackSuccess(`Apontados ${timeLogMinutes} minutos com sucesso!`);
      setTimeout(() => setFeedbackSuccess(null), 3000);
      setTimeLogModalItem(null);
      setTimeLogMinutes(30);
      setTimeLogNotes("");
      void loadWorkspace();
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message);
    }
  };

  const handleBlockTask = async () => {
    if (!blockModalItem) return;
    try {
      setErrorMessage(null);
      const res = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "block_task",
          work_item_id: blockModalItem.id,
          blocked_reason: blockReason,
          block_type: clientActionRequired ? "client_action" : "technical_dependency",
          client_action_required: clientActionRequired || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível registrar o bloqueio.");
      }
      setFeedbackSuccess("Bloqueio registrado!");
      setTimeout(() => setFeedbackSuccess(null), 3000);
      setBlockModalItem(null);
      setBlockReason("");
      setClientActionRequired("");
      void loadWorkspace();
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message);
    }
  };

  const handleUnblockTask = async (workItemId: string) => {
    try {
      setErrorMessage(null);
      const res = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unblock_task",
          work_item_id: workItemId,
          resolution_notes: "Bloqueio superado pelo operador.",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível desbloquear a tarefa.");
      }
      setFeedbackSuccess("Tarefa desbloqueada e pronta para execução!");
      setTimeout(() => setFeedbackSuccess(null), 3000);
      void loadWorkspace();
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message);
    }
  };

  const handleCreateWorkflow = async () => {
    if (!newWorkflowTitle.trim()) return;
    try {
      setErrorMessage(null);
      const res = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_workflow",
          client_id: selectedClientId.trim() || "00000000-0000-0000-0000-000000000002",
          title: newWorkflowTitle.trim(),
          template_id: selectedTemplateId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível criar o workflow.");
      }
      setFeedbackSuccess("Workflow e tarefas instanciados com sucesso!");
      setShowCreateWorkflowModal(false);
      setNewWorkflowTitle("");
      setSelectedTemplateId("");
      setSelectedClientId("");
      setTimeout(() => setFeedbackSuccess(null), 3000);
      void loadWorkspace();
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message);
    }
  };

  // Filtragem de Work Items
  const filteredItems = workItems.filter((item) => {
    const matchesQuery =
      searchQuery.trim() === "" ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesQuery) return false;

    if (selectedQueueFilter === "attention") {
      return (
        item.status !== "completed" &&
        item.status !== "cancelled" &&
        (item.sla_status === "warning" ||
          item.sla_status === "breached" ||
          (item.due_date && item.due_date <= new Date().toISOString().slice(0, 10)))
      );
    }
    if (selectedQueueFilter === "overdue") {
      return (
        item.status !== "completed" &&
        item.due_date &&
        item.due_date < new Date().toISOString().slice(0, 10)
      );
    }
    if (selectedQueueFilter === "blocked") {
      return (
        item.status === "blocked_by_dependency" || item.status === "blocked_by_client"
      );
    }
    if (selectedQueueFilter === "in_review") {
      return item.status === "in_review";
    }
    if (selectedQueueFilter === "in_progress") {
      return item.status === "in_progress";
    }
    if (selectedQueueFilter === "todo") {
      return item.status === "todo" || item.status === "backlog";
    }
    return true;
  });

  const getStatusBadge = (status: WorkItemStatus) => {
    switch (status) {
      case "completed":
        return <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">Concluída</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="text-sky-500 border-sky-500/30">Em Andamento</Badge>;
      case "in_review":
        return <Badge variant="outline" className="text-amber-500 border-amber-500/30">Aguardando Aprovação</Badge>;
      case "blocked_by_client":
        return <Badge variant="outline" className="text-rose-500 border-rose-500/30">Bloqueada pelo Cliente</Badge>;
      case "blocked_by_dependency":
        return <Badge variant="outline" className="text-orange-500 border-orange-500/30">Dependência Pendente</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="text-muted-foreground">Cancelada</Badge>;
      default:
        return <Badge variant="outline">A Fazer</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Motor de Operações"
        description="Workflows padronizados, gestão de tarefas com dependências, apontamento de tempo e filas por urgência."
        helpKey="operations.overview"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdvancedMode(!isAdvancedMode)}
              className="text-xs"
            >
              {isAdvancedMode ? "Modo Simples" : "Modo Avançado"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        }
      />

      {/* Alertas de Notificação */}
      {feedbackSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedbackSuccess}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setErrorMessage(null)}>
            Dispensar
          </Button>
        </div>
      )}

      {/* Tratamento de Estados: Indisponível / Loading */}
      {unavailable ? (
        <IntegrationState
          message="O Motor de Operações requer a conexão de banco de dados ativa para gerenciar tarefas e apontamentos."
          onRetry={handleRefresh}
        />
      ) : loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Sincronizando tarefas operacionais e capacidade da equipe...</span>
        </div>
      ) : (
        <>
          {/* KPIs Executivos no Topo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-lg border bg-card/60 space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Atenção Hoje
              </span>
              <strong className="text-xl font-semibold block text-amber-500">
                {queues?.attentionToday.length || 0}
              </strong>
            </div>

            <div className="p-3.5 rounded-lg border bg-card/60 space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                Atrasadas
              </span>
              <strong className="text-xl font-semibold block text-rose-500">
                {queues?.overdue.length || 0}
              </strong>
            </div>

            <div className="p-3.5 rounded-lg border bg-card/60 space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />
                Bloqueadas
              </span>
              <strong className="text-xl font-semibold block text-orange-500">
                {queues?.blocked.length || 0}
              </strong>
            </div>

            <div className="p-3.5 rounded-lg border bg-card/60 space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-sky-500" />
                Em Andamento
              </span>
              <strong className="text-xl font-semibold block text-sky-500">
                {queues?.inProgress.length || 0}
              </strong>
            </div>

            <div className="p-3.5 rounded-lg border bg-card/60 space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Concluídas
              </span>
              <strong className="text-xl font-semibold block text-emerald-500">
                {queues?.completedCount || 0}
              </strong>
            </div>

            <div className="p-3.5 rounded-lg border bg-card/60 space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-indigo-500" />
                Tempo Realizado
              </span>
              <strong className="text-xl font-semibold block">
                {Math.round((capacity?.totalActualMinutes || 0) / 60)}h
                <small className="text-xs font-normal text-muted-foreground ml-1">
                  / {Math.round((capacity?.totalEstimatedMinutes || 0) / 60)}h prev.
                </small>
              </strong>
            </div>
          </div>

          {/* Abas de Navegação Operacional */}
          <div className="flex border-b border-border gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("queues")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === "queues"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <ListTodo className="w-4 h-4" />
              Filas & Atenção Hoje
              {queues && queues.attentionToday.length > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                  {queues.attentionToday.length}
                </Badge>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("workflows")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === "workflows"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="w-4 h-4" />
              Workflows Ativos ({workflows.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("kanban")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === "kanban"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Kanban className="w-4 h-4" />
              Quadro Visual (Kanban)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("capacity")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === "capacity"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="w-4 h-4" />
              Capacidade & Horas
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("templates")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === "templates"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Templates de Serviço ({templates.length})
            </button>
          </div>

          {/* ABA 1: FILAS & ATENÇÃO HOJE */}
          {activeTab === "queues" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
                  <Button
                    variant={selectedQueueFilter === "attention" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedQueueFilter("attention")}
                    className="text-xs"
                  >
                    Atenção Hoje ({queues?.attentionToday.length || 0})
                  </Button>
                  <Button
                    variant={selectedQueueFilter === "overdue" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedQueueFilter("overdue")}
                    className="text-xs"
                  >
                    Atrasadas ({queues?.overdue.length || 0})
                  </Button>
                  <Button
                    variant={selectedQueueFilter === "blocked" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedQueueFilter("blocked")}
                    className="text-xs"
                  >
                    Bloqueadas ({queues?.blocked.length || 0})
                  </Button>
                  <Button
                    variant={selectedQueueFilter === "in_review" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedQueueFilter("in_review")}
                    className="text-xs"
                  >
                    Em Revisão ({queues?.inReview.length || 0})
                  </Button>
                  <Button
                    variant={selectedQueueFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedQueueFilter("all")}
                    className="text-xs"
                  >
                    Todas ({workItems.length})
                  </Button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar tarefas..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-9"
                  />
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="p-12 text-center border border-dashed rounded-lg text-muted-foreground space-y-2">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 opacity-60" />
                  <p className="text-sm font-medium">Nenhuma tarefa pendente nesta fila.</p>
                  <p className="text-xs">Tudo em dia para as tarefas selecionadas.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border bg-card hover:border-primary/40 transition-colors space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(item.status)}
                            <h4 className="font-semibold text-sm">{item.title}</h4>
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {item.due_date && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              Prazo: {new Date(item.due_date).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                          <span className="text-xs font-mono bg-muted/60 px-2 py-0.5 rounded">
                            {item.actual_minutes}/{item.estimated_minutes} min
                          </span>
                        </div>
                      </div>

                      {/* Motivo de Bloqueio se aplicável */}
                      {item.blocked_reason && (
                        <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded text-xs text-rose-500 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                            <span>{item.blocked_reason}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnblockTask(item.id)}
                            className="text-xs h-7"
                          >
                            Desbloquear
                          </Button>
                        </div>
                      )}

                      {/* Modo Avançado: Detalhes Técnicos e Dependências */}
                      {isAdvancedMode && (
                        <div className="pt-2 border-t text-xs font-mono text-muted-foreground space-y-1">
                          <div>UUID: {item.id}</div>
                          <div>Workflow: {item.workflow_id}</div>
                          <div>
                            Dependências:{" "}
                            {item.depends_on_item_ids.length > 0
                              ? item.depends_on_item_ids.join(", ")
                              : "Nenhuma"}
                          </div>
                          {item.acceptance_criteria && (
                            <div>Critério de Aceite: {item.acceptance_criteria}</div>
                          )}
                        </div>
                      )}

                      {/* Barra de Ações Rápidas */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTimeLogModalItem(item)}
                            className="text-xs h-7"
                          >
                            <Timer className="w-3.5 h-3.5 mr-1" />
                            Apontar Horas
                          </Button>

                          {item.status !== "blocked_by_client" &&
                            item.status !== "blocked_by_dependency" &&
                            item.status !== "completed" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setBlockModalItem(item)}
                                className="text-xs h-7 text-rose-500"
                              >
                                Bloquear
                              </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                          {item.status === "todo" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStartTask(item.id)}
                              className="text-xs h-7 text-sky-500"
                            >
                              <Play className="w-3.5 h-3.5 mr-1" />
                              Iniciar Tarefa
                            </Button>
                          )}

                          {item.status === "in_progress" && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => setCompleteModalItem(item)}
                              className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              {item.requires_approval
                                ? "Enviar p/ Aprovação"
                                : "Concluir Tarefa"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABA 2: WORKFLOWS ATIVOS */}
          {activeTab === "workflows" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Workflows agrupam a jornada operacional completa de implantação ou recorrência mensal de um cliente.
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowCreateWorkflowModal(true)}
                  className="text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Novo Workflow
                </Button>
              </div>

              {workflows.length === 0 ? (
                <div className="p-12 text-center border border-dashed rounded-lg text-muted-foreground space-y-2">
                  <Layers className="w-8 h-8 mx-auto opacity-50" />
                  <p className="text-sm font-medium">Nenhum workflow ativo cadastrado.</p>
                  <p className="text-xs">
                    Instancie um novo workflow a partir de um template ou ative um cliente no Onboarding.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {workflows.map((wf) => (
                    <div key={wf.id} className="p-4 rounded-lg border bg-card space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {wf.workflow_type.replace("_", " ")}
                            </Badge>
                            <h4 className="font-semibold text-sm">{wf.title}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Status: {wf.status.toUpperCase()} · Início: {wf.target_start_date || "Hoje"}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-semibold">{wf.progress_percentage}% concluído</span>
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${wf.progress_percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
                        <span>
                          Tempo: {wf.total_actual_minutes} / {wf.total_estimated_minutes} min
                        </span>
                        {isAdvancedMode && (
                          <span className="font-mono text-[10px]">ID: {wf.id}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABA 3: QUADRO KANBAN */}
          {activeTab === "kanban" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Coluna A Fazer */}
              <div className="p-3 bg-muted/40 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">A Fazer</span>
                  <Badge variant="secondary" className="text-xs">
                    {workItems.filter((i) => i.status === "todo").length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {workItems
                    .filter((i) => i.status === "todo")
                    .map((item) => (
                      <div key={item.id} className="p-3 bg-card rounded border text-xs space-y-2">
                        <strong className="block font-medium">{item.title}</strong>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>{item.estimated_minutes} min</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartTask(item.id)}
                            className="h-6 text-[10px] px-2 text-sky-500"
                          >
                            Iniciar
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Coluna Em Andamento */}
              <div className="p-3 bg-sky-500/5 rounded-lg space-y-3 border border-sky-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-sky-500">Em Andamento</span>
                  <Badge variant="secondary" className="text-xs">
                    {workItems.filter((i) => i.status === "in_progress").length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {workItems
                    .filter((i) => i.status === "in_progress")
                    .map((item) => (
                      <div key={item.id} className="p-3 bg-card rounded border text-xs space-y-2">
                        <strong className="block font-medium">{item.title}</strong>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>{item.actual_minutes}/{item.estimated_minutes} min</span>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setCompleteModalItem(item)}
                            className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700"
                          >
                            Concluir
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Coluna Bloqueadas / Revisão */}
              <div className="p-3 bg-amber-500/5 rounded-lg space-y-3 border border-amber-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-amber-500">Bloqueadas / Em Revisão</span>
                  <Badge variant="secondary" className="text-xs">
                    {
                      workItems.filter(
                        (i) =>
                          i.status === "blocked_by_dependency" ||
                          i.status === "blocked_by_client" ||
                          i.status === "in_review"
                      ).length
                    }
                  </Badge>
                </div>
                <div className="space-y-2">
                  {workItems
                    .filter(
                      (i) =>
                        i.status === "blocked_by_dependency" ||
                        i.status === "blocked_by_client" ||
                        i.status === "in_review"
                    )
                    .map((item) => (
                      <div key={item.id} className="p-3 bg-card rounded border text-xs space-y-2">
                        {getStatusBadge(item.status)}
                        <strong className="block font-medium">{item.title}</strong>
                        {item.blocked_reason && (
                          <p className="text-[10px] text-rose-500">{item.blocked_reason}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Coluna Concluídas */}
              <div className="p-3 bg-emerald-500/5 rounded-lg space-y-3 border border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-emerald-500">Concluídas</span>
                  <Badge variant="secondary" className="text-xs">
                    {workItems.filter((i) => i.status === "completed").length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {workItems
                    .filter((i) => i.status === "completed")
                    .map((item) => (
                      <div key={item.id} className="p-3 bg-card rounded border text-xs space-y-1 opacity-70">
                        <strong className="block font-medium line-through">{item.title}</strong>
                        <span className="text-[10px] text-muted-foreground">
                          {item.actual_minutes} min realizados
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* ABA 4: CAPACIDADE & HORAS */}
          {activeTab === "capacity" && capacity && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg bg-card space-y-1">
                  <span className="text-xs text-muted-foreground">Minutos Previstos</span>
                  <strong className="text-2xl font-bold block">{capacity.totalEstimatedMinutes} min</strong>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(capacity.totalEstimatedMinutes / 60)} horas de trabalho estimadas
                  </span>
                </div>

                <div className="p-4 border rounded-lg bg-card space-y-1">
                  <span className="text-xs text-muted-foreground">Minutos Realizados</span>
                  <strong className="text-2xl font-bold block text-sky-500">{capacity.totalActualMinutes} min</strong>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(capacity.totalActualMinutes / 60)} horas efetivamente apontadas
                  </span>
                </div>

                <div className="p-4 border rounded-lg bg-card space-y-1">
                  <span className="text-xs text-muted-foreground">Variância de Tempo</span>
                  <strong
                    className={`text-2xl font-bold block ${
                      capacity.variancePercentage > 0 ? "text-rose-500" : "text-emerald-500"
                    }`}
                  >
                    {capacity.variancePercentage > 0 ? `+${capacity.variancePercentage}%` : `${capacity.variancePercentage}%`}
                  </strong>
                  <span className="text-xs text-muted-foreground">
                    {capacity.varianceMinutes > 0
                      ? `${capacity.varianceMinutes} min acima do previsto`
                      : "Operação dentro da previsão"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ABA 5: TEMPLATES DE SERVIÇO */}
          {activeTab === "templates" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Templates de workflow definem o padrão mestre de execução para implantações e rotinas de recorrência.
              </p>
              <div className="grid gap-3">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="p-4 rounded-lg border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{tpl.category.toUpperCase()}</Badge>
                        <h4 className="font-semibold text-sm">{tpl.name}</h4>
                        <span className="text-xs text-muted-foreground">v{tpl.version}</span>
                      </div>
                      <span className="text-xs font-mono">{tpl.estimated_total_minutes} min previstos</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{tpl.description}</p>
                    <div className="pt-2 border-t text-xs text-muted-foreground">
                      Contém {tpl.definition.length} tarefas padronizadas no roteiro.
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL DE APONTAMENTO DE TEMPO */}
      {timeLogModalItem && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-semibold text-base">Apontar Horas na Tarefa</h3>
            <p className="text-xs text-muted-foreground">{timeLogModalItem.title}</p>

            <div className="space-y-3">
              <div>
                <Label htmlFor="minutes" className="text-xs">Minutos Trabalhados</Label>
                <Input
                  id="minutes"
                  type="number"
                  min={5}
                  max={720}
                  step={5}
                  value={timeLogMinutes}
                  onChange={(e) => setTimeLogMinutes(Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="notes" className="text-xs">Observações / Detalhes</Label>
                <Input
                  id="notes"
                  placeholder="Ex: Revisadas 5 fotos e ajustado horário de funcionamento."
                  value={timeLogNotes}
                  onChange={(e) => setTimeLogNotes(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setTimeLogModalItem(null)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleLogTime}>
                Salvar Apontamento
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONCLUSÃO COM EVIDÊNCIA */}
      {completeModalItem && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-semibold text-base">
              {completeModalItem.requires_approval
                ? "Submeter Tarefa para Aprovação"
                : "Concluir Tarefa"}
            </h3>
            <p className="text-xs text-muted-foreground">{completeModalItem.title}</p>

            {completeModalItem.evidence_required && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-500">
                Esta tarefa exige comprovação documental ou link antes da conclusão.
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label htmlFor="evidenceText" className="text-xs">Comprovante Textual / Resumo</Label>
                <Input
                  id="evidenceText"
                  placeholder="Ex: Foto da fachada enviada no GBP e categoria confirmada."
                  value={evidenceText}
                  onChange={(e) => setEvidenceText(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="evidenceUrl" className="text-xs">Link da Evidência (URL)</Label>
                <Input
                  id="evidenceUrl"
                  placeholder="https://business.google.com/..."
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setCompleteModalItem(null)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleCompleteTask}>
                {completeModalItem.requires_approval ? "Enviar para Revisão" : "Confirmar Conclusão"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE BLOQUEIO */}
      {blockModalItem && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-semibold text-base text-rose-500">Registrar Bloqueio</h3>
            <p className="text-xs text-muted-foreground">{blockModalItem.title}</p>

            <div className="space-y-3">
              <div>
                <Label htmlFor="blockReason" className="text-xs">Motivo do Impedimento</Label>
                <Input
                  id="blockReason"
                  placeholder="Ex: Cliente não forneceu foto da fachada nem CNPJ ativo."
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="clientAction" className="text-xs">Ação Exigida do Cliente (Opcional)</Label>
                <Input
                  id="clientAction"
                  placeholder="Ex: Enviar comprovante de endereço via WhatsApp."
                  value={clientActionRequired}
                  onChange={(e) => setClientActionRequired(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setBlockModalItem(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" size="sm" onClick={handleBlockTask} disabled={!blockReason.trim()}>
                Confirmar Bloqueio
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE NOVO WORKFLOW */}
      {showCreateWorkflowModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-semibold text-base">Novo Workflow Operacional</h3>
            <p className="text-xs text-muted-foreground">
              Instancie uma nova jornada de implantação ou recorrência para um cliente.
            </p>

            <div className="space-y-3">
              <div>
                <Label htmlFor="workflowTitle" className="text-xs">Título do Workflow *</Label>
                <Input
                  id="workflowTitle"
                  placeholder="Ex: Implantação SEO Local — Unidade Matriz"
                  value={newWorkflowTitle}
                  onChange={(e) => setNewWorkflowTitle(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="workflowClient" className="text-xs">ID do Cliente (UUID)</Label>
                <Input
                  id="workflowClient"
                  placeholder="Ex: 00000000-0000-0000-0000-000000000002"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="workflowTemplate" className="text-xs">Template de Serviço (Opcional)</Label>
                <select
                  id="workflowTemplate"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Nenhum (Workflow Manual em Branco)</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.tasks?.length || 0} tarefas)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreateWorkflowModal(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleCreateWorkflow} disabled={!newWorkflowTitle.trim()}>
                Criar Workflow
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
