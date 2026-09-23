"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  Kanban,
  LayoutGrid,
  ListTodo,
  MapPinned,
  MessageCircle,
  PlusCircle,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import {
  JOURNEY_STAGES,
  JOURNEY_TASKS,
  calculateJourneyProgress,
  calculateStageProgress,
  filterTasks,
  loadClientJourneyState,
  saveClientJourneyState,
  type ClientJourneyState,
  type JourneyStage,
  type JourneyStageId,
  type JourneyStatus,
  type JourneyTask,
  type JourneyTrack,
  type KanbanColumn,
} from "@/lib/client-journey-domain";
import type { View } from "./app-shell";
import { postPlatform, isRequestCancelled } from "@/lib/platform-api";
import { postLocalSeoV2 } from "@/lib/local-seo-v2-api";
import { type ClientSummary, isClientSummaryArray } from "./clients-module";

export function ClientJourneyModule({
  clientId,
  onSelectClient,
  onNavigate,
}: {
  clientId?: string;
  onSelectClient: (id: string) => void;
  onNavigate: (view: View) => void;
}) {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [activeTrack, setActiveTrack] = useState<JourneyTrack | "all">("gmn");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [viewMode, setViewMode] = useState<"checklist" | "kanban">("checklist");
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({
    onboarding: true,
    briefing: true,
    setup: true,
    management: true,
    delivery: true,
    gtp_tech: true,
    gtp_campaigns: true,
    gtp_monitor: true,
  });
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);

  // Estado das tarefas do cliente selecionado
  const [journeyState, setJourneyState] = useState<ClientJourneyState>(() =>
    loadClientJourneyState(clientId ?? ""),
  );

  // Carregar lista de clientes
  useEffect(() => {
    const controller = new AbortController();
    async function fetchClients() {
      setLoadingClients(true);
      try {
        let raw: unknown[];
        try {
          raw = await postPlatform({ action: "clients" }, isClientSummaryArray, controller.signal);
        } catch {
          const data = await postLocalSeoV2({ action: "clients" }, controller.signal);
          raw = Array.isArray(data.clients) ? data.clients : [];
        }
        const list = raw.filter(
          (item): item is ClientSummary =>
            !!item &&
            typeof item === "object" &&
            typeof (item as Record<string, unknown>).id === "string" &&
            typeof (item as Record<string, unknown>).name === "string",
        );
        if (controller.signal.aborted) return;
        setClients(list);
        if (list.length && (!clientId || !list.some((c) => c.id === clientId))) {
          onSelectClient(list[0].id);
        }
      } catch (err) {
        if (isRequestCancelled(err)) return;
      } finally {
        if (!controller.signal.aborted) setLoadingClients(false);
      }
    }
    fetchClients();
    return () => controller.abort();
  }, [clientId, onSelectClient]);

  // Recarrega estado quando muda o clientId
  useEffect(() => {
    if (clientId) {
      setJourneyState(loadClientJourneyState(clientId));
    }
  }, [clientId]);

  const activeClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? clients[0],
    [clients, clientId],
  );

  // Atualizar campo de uma tarefa (status, responsável, data de execução, notas)
  const handleUpdateTaskField = useCallback(
    (taskId: string, field: "status" | "assignee" | "executionDate" | "notes", value: string) => {
      if (!clientId) return;
      setJourneyState((prev) => {
        const currentTask = prev.tasks[taskId] ?? { status: "pending" };
        const next: ClientJourneyState = {
          ...prev,
          clientId,
          tasks: {
            ...prev.tasks,
            [taskId]: {
              ...currentTask,
              [field]: value,
              updatedAt: new Date().toISOString(),
            },
          },
        };
        saveClientJourneyState(next);
        return next;
      });
    },
    [clientId],
  );

  // Alternar datas de início e finalização do projeto
  const handleUpdateProjectDate = useCallback(
    (field: "startDate" | "endDate", value: string) => {
      if (!clientId) return;
      setJourneyState((prev) => {
        const next: ClientJourneyState = {
          ...prev,
          clientId,
          dates: {
            ...prev.dates,
            [field]: value,
          },
        };
        saveClientJourneyState(next);
        return next;
      });
    },
    [clientId],
  );

  // Alternar checkbox (pending <-> completed)
  const handleToggleTask = useCallback(
    (taskId: string) => {
      const current = journeyState.tasks[taskId]?.status ?? "pending";
      const nextStatus: JourneyStatus = current === "completed" ? "pending" : "completed";
      handleUpdateTaskField(taskId, "status", nextStatus);
    },
    [journeyState, handleUpdateTaskField],
  );

  // Copiar template do WhatsApp
  const handleCopyWhatsapp = useCallback((taskId: string, template: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(template);
      setCopiedTaskId(taskId);
      window.setTimeout(() => setCopiedTaskId(null), 2500);
    }
  }, []);

  // Tarefas filtradas
  const filteredTasks = useMemo(() => {
    return filterTasks(JOURNEY_TASKS, {
      track: activeTrack,
      statusFilter,
      clientState: journeyState,
    });
  }, [activeTrack, statusFilter, journeyState]);

  // Métricas e progresso
  const progress = useMemo(() => {
    return calculateJourneyProgress(journeyState, filteredTasks);
  }, [journeyState, filteredTasks]);

  // Alternar estágio no checklist
  const toggleStage = (stageId: string) => {
    setExpandedStages((prev) => ({
      ...prev,
      [stageId]: !prev[stageId],
    }));
  };

  const kanbanColumns: Array<{ id: KanbanColumn; label: string; count: number }> = [
    {
      id: "entrada",
      label: "Entrada / Onboarding",
      count: filteredTasks.filter((t) => t.kanbanColumn === "entrada").length,
    },
    {
      id: "organizando",
      label: "Organizando / Briefing",
      count: filteredTasks.filter((t) => t.kanbanColumn === "organizando").length,
    },
    {
      id: "executando",
      label: "Executando (Configuração & Gestão)",
      count: filteredTasks.filter((t) => t.kanbanColumn === "executando").length,
    },
    {
      id: "entregue",
      label: "Entregue & Monitorando",
      count: filteredTasks.filter((t) => t.kanbanColumn === "entregue").length,
    },
  ];

  return (
    <div className="client-journey-page space-y-6">
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5 font-semibold text-primary">
            <Kanban className="h-4 w-4" />
            Matriz Operacional da Agência · GMN & Tráfego
          </span>
        }
        title="Esteira do Cliente"
        description="Rotina operacional oficial da agência. Acompanhe Onboarding, Briefing, Configuração, Gestão Contínua e Encerramento com data de execução, responsável e atalhos diretos para as ferramentas do sistema."
        helpKey="client-journey"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-surface-2 border border-line rounded-lg px-3 py-1.5 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <label htmlFor="client-selector" className="sr-only">
                Selecionar cliente
              </label>
              <select
                id="client-selector"
                value={clientId ?? ""}
                onChange={(e) => onSelectClient(e.target.value)}
                className="bg-transparent border-0 font-medium text-foreground focus:outline-none cursor-pointer"
                disabled={loadingClients || !clients.length}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("clients")}
              className="gap-1.5"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Gerenciar Clientes</span>
            </Button>
          </div>
        }
      />

      {/* Faixa Superior Estilo Planilha Oficial: CLIENTE / DATA DE INÍCIO / DATA DE FINALIZAÇÃO */}
      <section className="bg-surface-1 border border-line rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
              CLIENTE:
            </span>
            <strong className="text-base text-foreground font-bold truncate">
              {activeClient?.name ?? "Selecione um cliente"}
            </strong>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <label className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase block">
                Data de Início:
              </label>
              <input
                type="date"
                value={journeyState.dates?.startDate ?? ""}
                onChange={(e) => handleUpdateProjectDate("startDate", e.target.value)}
                className="bg-surface-2 border border-line rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-brand w-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <label className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase block">
                Data de Finalização:
              </label>
              <input
                type="date"
                value={journeyState.dates?.endDate ?? ""}
                onChange={(e) => handleUpdateProjectDate("endDate", e.target.value)}
                className="bg-surface-2 border border-line rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-brand w-full"
              />
            </div>
          </div>
        </div>

        {/* Barra de Progresso Geral */}
        <div className="mt-4 pt-3 border-t border-line/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-foreground">
              Progresso Geral da Esteira:
            </span>
            <span className="text-sm font-bold text-brand">
              {progress.percentage}%
            </span>
            <span className="text-xs text-muted-foreground">
              ({progress.completed} de {progress.total} tarefas concluídas)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Fase ativa:</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-soft text-brand">
              {progress.currentStage.emoji} {progress.currentStage.title}
            </span>
          </div>
        </div>

        <div className="mt-2 w-full bg-surface-3 rounded-full h-2.5 overflow-hidden border border-line">
          <div
            className="bg-brand h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </section>

      {/* Barra de Filtros & Controles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        {/* Filtro por Trilha */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTrack === "gmn"
                ? "bg-brand text-white shadow-sm"
                : "bg-surface-2 text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTrack("gmn")}
          >
            <MapPinned className="h-3.5 w-3.5" />
            <span>Rotina Oficial GMN ({JOURNEY_TASKS.filter((t) => t.track === "gmn").length} passos)</span>
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTrack === "gtp"
                ? "bg-brand text-white shadow-sm"
                : "bg-surface-2 text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTrack("gtp")}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Tráfego & Anúncios GTP ({JOURNEY_TASKS.filter((t) => t.track === "gtp").length} passos)</span>
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTrack === "all"
                ? "bg-brand text-white shadow-sm"
                : "bg-surface-2 text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTrack("all")}
          >
            Todas ({JOURNEY_TASKS.length})
          </button>
        </div>

        {/* Alternador de Modo: Checklist vs Kanban */}
        <div className="flex items-center gap-2">
          <div className="bg-surface-2 border border-line rounded-lg p-0.5 flex items-center">
            <button
              type="button"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === "checklist"
                  ? "bg-surface-1 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setViewMode("checklist")}
              title="Visualização em Matriz Checklist por fases da planilha"
            >
              <ListTodo className="h-3.5 w-3.5" />
              <span>Matriz / Checklist</span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === "kanban"
                  ? "bg-surface-1 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setViewMode("kanban")}
              title="Visualização em Quadro Kanban estilo Trello"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Quadro Kanban</span>
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "pending" | "completed")}
            className="bg-surface-2 border border-line rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none cursor-pointer"
          >
            <option value="all">Status: Todos</option>
            <option value="pending">Apenas Pendentes</option>
            <option value="completed">Apenas Concluídos</option>
          </select>
        </div>
      </div>

      {/* RENDERIZAÇÃO: MODO CHECKLIST / MATRIZ DA PLANILHA */}
      {viewMode === "checklist" && (
        <div className="space-y-6">
          {JOURNEY_STAGES.map((stage) => {
            const stageTasks = filteredTasks.filter((t) => t.stageId === stage.id);
            if (!stageTasks.length) return null;

            const isExpanded = expandedStages[stage.id] ?? true;
            const stageProgress = calculateStageProgress(stage.id, journeyState, JOURNEY_TASKS);

            const badgeColorClasses = {
              orange: "bg-orange-500/10 text-orange-500 border-orange-500/30",
              yellow: "bg-amber-500/10 text-amber-500 border-amber-500/30",
              blue: "bg-blue-500/10 text-blue-500 border-blue-500/30",
              green: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
              red: "bg-rose-500/10 text-rose-500 border-rose-500/30",
              purple: "bg-purple-500/10 text-purple-400 border-purple-500/30",
            }[stage.badgeColor];

            return (
              <section
                key={stage.id}
                className="panel border border-line bg-surface-1 rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Cabeçalho da Fase no Estilo da Planilha Oficial */}
                <header
                  className="p-4 cursor-pointer hover:bg-surface-2/60 transition-colors border-b border-line select-none flex flex-col md:flex-row md:items-center justify-between gap-3"
                  onClick={() => toggleStage(stage.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{stage.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-extrabold tracking-wide uppercase text-foreground">
                          {stage.title}
                        </h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${badgeColorClasses}`}>
                          {stageTasks.length} tarefas
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{stage.description}</p>
                    </div>
                  </div>

                  {/* Colunas Cabeçalho da Planilha: Progresso / Responsável */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground block">Progresso da Fase:</span>
                      <strong className={`text-lg font-extrabold ${stageProgress.percentage === 100 ? "text-emerald-500" : "text-brand"}`}>
                        {stageProgress.percentage}%
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground p-1"
                      aria-label={isExpanded ? "Recolher fase" : "Expandir fase"}
                    >
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  </div>
                </header>

                {/* Tabela de Tarefas da Fase */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-line bg-surface-2/70 text-muted-foreground font-semibold">
                          <th className="py-2.5 px-4 w-10">OK</th>
                          <th className="py-2.5 px-4">Atividade / Passo Operacional</th>
                          <th className="py-2.5 px-3 w-36">Status da tarefa</th>
                          <th className="py-2.5 px-3 w-36">Data de execução</th>
                          <th className="py-2.5 px-3 w-40">Responsável</th>
                          <th className="py-2.5 px-4 text-right w-44">Ação no Sistema</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/60">
                        {stageTasks.map((task) => {
                          const taskState = journeyState.tasks[task.id] ?? { status: "pending" };
                          const isDone = taskState.status === "completed";
                          const isInProgress = taskState.status === "in_progress";
                          const isBlocked = taskState.status === "blocked";

                          return (
                            <tr
                              key={task.id}
                              className={`hover:bg-surface-2/40 transition-colors ${
                                isDone ? "bg-emerald-500/[0.02]" : ""
                              }`}
                            >
                              {/* Checkbox de Conclusão */}
                              <td className="py-3 px-4 align-top">
                                <button
                                  type="button"
                                  onClick={() => handleToggleTask(task.id)}
                                  className={`mt-0.5 flex items-center justify-center h-4.5 w-4.5 rounded border transition-all cursor-pointer ${
                                    isDone
                                      ? "bg-emerald-500 border-emerald-500 text-white"
                                      : "border-line bg-surface-2 hover:border-brand"
                                  }`}
                                  title={isDone ? "Marcar como pendente" : "Marcar como concluído"}
                                >
                                  {isDone && <CheckCircle2 className="h-3.5 w-3.5" />}
                                </button>
                              </td>

                              {/* Descrição da Atividade */}
                              <td className="py-3 px-4 align-top">
                                <div className="space-y-1">
                                  <div className="font-bold text-foreground text-xs leading-snug">
                                    <span className={isDone ? "line-through text-muted-foreground" : ""}>
                                      {task.title}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    {task.description}
                                  </p>

                                  {/* Botão de Cópia do WhatsApp se aplicável */}
                                  {task.whatsappTemplate && (
                                    <div className="pt-1">
                                      <button
                                        type="button"
                                        onClick={() => handleCopyWhatsapp(task.id, task.whatsappTemplate!)}
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded cursor-pointer"
                                      >
                                        <MessageCircle className="h-3 w-3" />
                                        <span>
                                          {copiedTaskId === task.id ? "Texto Copiado!" : "Copiar Texto WhatsApp"}
                                        </span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Status da Tarefa */}
                              <td className="py-3 px-3 align-top">
                                <select
                                  value={taskState.status}
                                  onChange={(e) =>
                                    handleUpdateTaskField(task.id, "status", e.target.value)
                                  }
                                  className={`w-full text-xs font-semibold rounded px-2 py-1.5 border cursor-pointer ${
                                    isDone
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                      : isInProgress
                                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                        : isBlocked
                                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                          : "bg-surface-2 text-muted-foreground border-line"
                                  }`}
                                >
                                  <option value="pending">Informe o Status</option>
                                  <option value="in_progress">Em Andamento</option>
                                  <option value="completed">Concluído</option>
                                  <option value="blocked">Impedimento</option>
                                </select>
                              </td>

                              {/* Data de Execução */}
                              <td className="py-3 px-3 align-top">
                                <input
                                  type="date"
                                  value={taskState.executionDate ?? ""}
                                  onChange={(e) =>
                                    handleUpdateTaskField(task.id, "executionDate", e.target.value)
                                  }
                                  className="w-full bg-surface-2 border border-line rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-brand"
                                />
                              </td>

                              {/* Responsável */}
                              <td className="py-3 px-3 align-top">
                                <div className="flex items-center gap-1.5 bg-surface-2 border border-line rounded px-2 py-1">
                                  <UserCheck className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <input
                                    type="text"
                                    defaultValue={taskState.assignee ?? ""}
                                    placeholder="Informe o Responsável"
                                    onBlur={(e) =>
                                      handleUpdateTaskField(task.id, "assignee", e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        handleUpdateTaskField(task.id, "assignee", (e.target as HTMLInputElement).value);
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                    className="bg-transparent border-0 text-xs text-foreground w-full focus:outline-none placeholder:text-muted-foreground/60"
                                  />
                                </div>
                              </td>

                              {/* Botão de Ação Direta no Sistema */}
                              <td className="py-3 px-4 align-top text-right">
                                {task.targetView ? (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="gap-1.5 text-xs font-semibold border border-brand/30 hover:bg-brand hover:text-white"
                                    onClick={() => onNavigate(task.targetView!)}
                                    title={`Abrir ${task.targetViewLabel} para este cliente`}
                                  >
                                    <span>{task.targetViewLabel}</span>
                                    <ArrowRight className="h-3 w-3" />
                                  </Button>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground italic">
                                    Ação Operacional
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* RENDERIZAÇÃO: MODO QUADRO KANBAN (ESTILO TRELLO) */}
      {viewMode === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {kanbanColumns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.kanbanColumn === col.id);

            return (
              <div
                key={col.id}
                className="bg-surface-1 border border-line rounded-2xl p-4 space-y-3 min-h-[440px] shadow-sm flex flex-col"
              >
                {/* Cabeçalho da Coluna */}
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-brand" />
                    {col.label}
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground">
                    {colTasks.length}
                  </span>
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[720px] pr-1">
                  {colTasks.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-line rounded-xl mt-4">
                      Nenhuma atividade nesta etapa
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const taskState = journeyState.tasks[task.id] ?? { status: "pending" };
                      const isDone = taskState.status === "completed";

                      return (
                        <div
                          key={task.id}
                          className={`bg-surface-2 border border-line rounded-xl p-3 shadow-sm hover:border-brand/40 transition-all flex flex-col gap-2.5 ${
                            isDone ? "opacity-75 bg-surface-2/60" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                                task.track === "gmn"
                                  ? "bg-amber-500/10 text-amber-500"
                                  : "bg-blue-500/10 text-blue-400"
                              }`}
                            >
                              {task.track === "gmn" ? "GMN" : "GTP"}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleToggleTask(task.id)}
                              className={`h-4 w-4 rounded border flex items-center justify-center cursor-pointer ${
                                isDone
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : "border-line bg-surface-1"
                              }`}
                              title={isDone ? "Desmarcar" : "Concluir"}
                            >
                              {isDone && <CheckCircle2 className="h-3 w-3" />}
                            </button>
                          </div>

                          <h4
                            className={`text-xs font-semibold leading-snug ${
                              isDone ? "line-through text-muted-foreground" : "text-foreground"
                            }`}
                          >
                            {task.title}
                          </h4>

                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>

                          {/* Data e Responsável no Card Kanban */}
                          <div className="text-[10px] text-muted-foreground flex items-center justify-between gap-2 pt-1 border-t border-line/40">
                            <span>👤 {taskState.assignee || "Sem resp."}</span>
                            <span>📅 {taskState.executionDate || "Sem data"}</span>
                          </div>

                          {/* Botão de Atalho para a Tela do Sistema */}
                          <div className="mt-auto pt-1 flex items-center justify-between gap-2">
                            {task.targetView ? (
                              <button
                                type="button"
                                onClick={() => onNavigate(task.targetView!)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline cursor-pointer"
                                title={`Abrir tela de ${task.targetViewLabel}`}
                              >
                                <span>{task.targetViewLabel}</span>
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">Operação</span>
                            )}

                            <select
                              value={taskState.status}
                              onChange={(e) =>
                                handleUpdateTaskField(task.id, "status", e.target.value)
                              }
                              className="text-[10px] bg-surface-1 border border-line rounded px-1.5 py-0.5 cursor-pointer"
                            >
                              <option value="pending">Pendente</option>
                              <option value="in_progress">Em curso</option>
                              <option value="completed">Concluído</option>
                              <option value="blocked">Travado</option>
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
