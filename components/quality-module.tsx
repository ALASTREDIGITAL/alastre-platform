"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Layers,
  History,
  Lock,
  Plus,
  RefreshCw,
  Search,
  AlertOctagon,
  UserCheck,
  CheckSquare,
  ExternalLink,
} from "lucide-react";
import {
  evidenceTypeLabels,
  verificationStatusLabels,
  ncSeverityLabels,
  type QualityEvidence,
  type QualityChecklistTemplate,
  type QualityChecklistRun,
  type QualityNonConformity,
  type QualityAuditHistoryEntry,
  type EvidenceType,
  type NonConformitySeverity,
} from "@/lib/quality-domain";
import { useAuth } from "@/lib/auth-context";

export interface QualityModuleProps {
  onNavigate?: (view: string) => void;
  selectedClientId?: string;
  selectedWorkItemId?: string;
}

export function QualityModule({
  onNavigate,
  selectedClientId,
  selectedWorkItemId,
}: QualityModuleProps) {
  const { actor } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "reviews" | "evidences" | "checklists" | "non_conformities" | "corrective" | "audit"
  >("reviews");
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);

  // Estados de dados
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evidences, setEvidences] = useState<QualityEvidence[]>([]);
  const [templates, setTemplates] = useState<QualityChecklistTemplate[]>([]);
  const [checklistRuns, setChecklistRuns] = useState<QualityChecklistRun[]>([]);
  const [nonConformities, setNonConformities] = useState<QualityNonConformity[]>([]);
  const [auditHistory, setAuditHistory] = useState<QualityAuditHistoryEntry[]>([]);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modais de Criação
  const [showNewEvidenceModal, setShowNewEvidenceModal] = useState(false);
  const [showNewNCModal, setShowNewNCModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form de Nova Evidência
  const [newEvWorkItemId, setNewEvWorkItemId] = useState(selectedWorkItemId || "");
  const [newEvType, setNewEvType] = useState<EvidenceType>("screenshot");
  const [newEvReference, setNewEvReference] = useState("");
  const [newEvLimitationNote, setNewEvLimitationNote] = useState("");

  // Form de Nova Não Conformidade
  const [newNcClientId, setNewNcClientId] = useState(selectedClientId || "");
  const [newNcWorkItemId, setNewNcWorkItemId] = useState(selectedWorkItemId || "");
  const [newNcTitle, setNewNcTitle] = useState("");
  const [newNcSeverity, setNewNcSeverity] = useState<NonConformitySeverity>("medium");
  const [newNcRootCause, setNewNcRootCause] = useState("");
  const [newNcImpact, setNewNcImpact] = useState("");

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch_workspace" }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Falha ao carregar dados de qualidade e evidências");
      } else {
        setEvidences(data.evidences || []);
        setTemplates(data.checklist_templates || []);
        setChecklistRuns(data.checklist_runs || []);
        setNonConformities(data.non_conformities || []);
        setAuditHistory(data.audit_history || []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro de conexão com o servidor";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  // Ação de Verificação de Evidência
  const handleVerifyEvidence = async (evidenceId: string, status: "verified" | "rejected") => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_evidence",
          evidence_id: evidenceId,
          verification_status: status,
          reason: `Verificação manual efetuada pelo operador ${actor?.email || ""}`,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Atenção: ${data.error}`);
      } else {
        await loadWorkspace();
      }
    } catch (err: unknown) {
      alert("Erro ao processar verificação de evidência");
    } finally {
      setActionLoading(false);
    }
  };

  // Submissão de Nova Evidência
  const handleCreateEvidenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvWorkItemId || !newEvReference) {
      alert("Por favor preencha o ID do item de trabalho e a referência verificável.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_evidence",
          work_item_id: newEvWorkItemId,
          client_id: selectedClientId || null,
          evidence_type: newEvType,
          origin: "manual",
          verifiable_reference: newEvReference,
          limitation_note: newEvLimitationNote || null,
          sanitized_metadata: {
            created_by: actor?.email || "operador",
            environment: "homologacao",
          },
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Erro ao criar evidência: ${data.error}`);
      } else {
        setShowNewEvidenceModal(false);
        setNewEvReference("");
        setNewEvLimitationNote("");
        await loadWorkspace();
      }
    } catch {
      alert("Falha na chamada de criação de evidência");
    } finally {
      setActionLoading(false);
    }
  };

  // Submissão de Nova Não Conformidade
  const handleCreateNCSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNcTitle || (!newNcClientId && !selectedClientId)) {
      alert("Título e ID do Cliente são obrigatórios.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open_non_conformity",
          client_id: newNcClientId || selectedClientId,
          work_item_id: newNcWorkItemId || null,
          title: newNcTitle,
          severity: newNcSeverity,
          root_cause: newNcRootCause,
          impact: newNcImpact,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Erro ao abrir Não Conformidade: ${data.error}`);
      } else {
        setShowNewNCModal(false);
        setNewNcTitle("");
        setNewNcRootCause("");
        setNewNcImpact("");
        await loadWorkspace();
      }
    } catch {
      alert("Falha na abertura de Não Conformidade");
    } finally {
      setActionLoading(false);
    }
  };

  // Gerar Ação Corretiva
  const handleCreateCorrectiveAction = async (ncId: string, title: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_corrective_action",
          non_conformity_id: ncId,
          title: `Solução: ${title}`,
          priority: "high",
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Erro ao gerar ação corretiva: ${data.error}`);
      } else {
        alert("Ação Corretiva criada no Motor de Operações (Módulo 04)!");
        await loadWorkspace();
      }
    } catch {
      alert("Falha ao criar ação corretiva");
    } finally {
      setActionLoading(false);
    }
  };

  // Encerrar Não Conformidade
  const handleResolveNC = async (ncId: string, status: "resolved" | "waived") => {
    const reason = prompt(
      status === "resolved"
        ? "Informe a verificação de solução:"
        : "Justificativa formal para dispensa da Não Conformidade:",
    );
    if (!reason) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve_non_conformity",
          non_conformity_id: ncId,
          resolution_status: status,
          reason,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Atenção: ${data.error}`);
      } else {
        await loadWorkspace();
      }
    } catch {
      alert("Erro ao encerrar Não Conformidade");
    } finally {
      setActionLoading(false);
    }
  };

  // Itens em fila de revisão
  const pendingEvidences = evidences.filter((e) => e.verification_status === "pending");
  const openNCs = nonConformities.filter((nc) => ["open", "in_analysis", "action_created", "reopened"].includes(nc.status));
  const criticalNCs = openNCs.filter((nc) => nc.severity === "critical");

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border rounded-lg p-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">Qualidade e Evidências</h1>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Módulo 06
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Critérios claros de entrega, verificação documental, segregação de funções e ações corretivas.
            </p>
          </div>
        </div>

        {/* Controles: Modo Simples / Avançado & Recarregar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAdvancedMode(!isAdvancedMode)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              isAdvancedMode
                ? "bg-secondary text-secondary-foreground border-secondary"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {isAdvancedMode ? "Modo Avançado (Técnico)" : "Modo Simples (Padrão)"}
          </button>

          <button
            type="button"
            onClick={loadWorkspace}
            disabled={loading}
            className="p-2 border rounded-md hover:bg-muted text-muted-foreground transition-colors disabled:opacity-50"
            title="Atualizar dados de qualidade"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowNewEvidenceModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Evidência
          </button>
        </div>
      </div>

      {/* Alerta de Não Conformidade Crítica (Bloqueio Operacional) */}
      {criticalNCs.length > 0 && (
        <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-lg flex items-start gap-3 text-destructive">
          <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <strong className="font-semibold">Atenção: Bloqueio de Conclusão Ativo!</strong>
            <p className="mt-0.5">
              {criticalNCs.length === 1
                ? "Existe 1 Não Conformidade Crítica pendente. Atividades de alto risco vinculadas não podem ser concluídas."
                : `Existem ${criticalNCs.length} Não Conformidades Críticas pendentes bloqueando a conclusão de entregas.`}
            </p>
          </div>
        </div>
      )}

      {/* Alerta de Erro de Servidor */}
      {error && (
        <div className="p-4 border border-amber-500/50 bg-amber-500/10 text-amber-600 rounded-lg flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadWorkspace}
            className="text-xs font-semibold underline hover:opacity-80"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Navegação por Abas */}
      <div className="border-b flex items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("reviews")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "reviews"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Fila de Revisões
          {pendingEvidences.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-600 font-semibold rounded-full">
              {pendingEvidences.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("evidences")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "evidences"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="w-4 h-4" />
          Evidências ({evidences.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("checklists")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "checklists"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          Checklists ({checklistRuns.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("non_conformities")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "non_conformities"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Não Conformidades
          {openNCs.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-destructive/20 text-destructive font-semibold rounded-full">
              {openNCs.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("corrective")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "corrective"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-4 h-4" />
          Correções e Reaberturas
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "audit"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="w-4 h-4" />
          Histórico e Auditoria ({auditHistory.length})
        </button>
      </div>

      {/* ABA 1: FILA DE REVISÕES */}
      {activeTab === "reviews" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {pendingEvidences.length === 0
                ? "Nenhuma evidência aguardando revisão no momento."
                : `Exibindo ${pendingEvidences.length} evidência(s) pendente(s) de validação.`}
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">
              Carregando fila de revisões...
            </div>
          ) : pendingEvidences.length === 0 ? (
            <div className="p-12 text-center border border-dashed rounded-lg bg-card text-muted-foreground space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/80" />
              <strong className="block text-foreground font-semibold">Tudo em dia!</strong>
              <p className="text-sm max-w-md mx-auto">
                Não há entregas ou evidências de alto risco pendentes de verificação.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingEvidences.map((ev) => {
                const isSelfActor = ev.responsible_actor_id === actor?.actorId;
                return (
                  <div key={ev.id} className="border bg-card rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          {evidenceTypeLabels[ev.evidence_type] || ev.evidence_type}
                        </span>
                        <h4 className="text-sm font-semibold mt-1">
                          Item: {ev.work_item_id.slice(0, 8)}...
                        </h4>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(ev.captured_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>

                    <div className="p-2.5 bg-muted/50 rounded text-xs space-y-1 font-mono break-all">
                      <span className="text-muted-foreground block font-sans">
                        Referência Verificável:
                      </span>
                      <strong>{ev.verifiable_reference}</strong>
                    </div>

                    {ev.limitation_note && (
                      <div className="p-2 bg-amber-500/10 text-amber-700 text-xs rounded">
                        <strong>Limitação:</strong> {ev.limitation_note}
                      </div>
                    )}

                    {isSelfActor && (
                      <div className="p-2 bg-muted text-xs text-muted-foreground rounded flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span>
                          Segregação de funções: você é o responsável pela captura e não pode auto-aprovar.
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      <button
                        type="button"
                        onClick={() => handleVerifyEvidence(ev.id, "rejected")}
                        disabled={actionLoading}
                        className="px-2.5 py-1 text-xs border text-destructive hover:bg-destructive/10 rounded transition-colors"
                      >
                        Rejeitar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVerifyEvidence(ev.id, "verified")}
                        disabled={actionLoading || isSelfActor}
                        className="px-3 py-1 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded transition-colors disabled:opacity-50"
                      >
                        Aprovar e Trancar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ABA 2: EVIDÊNCIAS CANÔNICAS */}
      {activeTab === "evidences" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar evidência ou ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Total de Evidências: <strong>{evidences.length}</strong>
            </div>
          </div>

          <div className="border rounded-lg bg-card overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="p-3">Tipo & Origem</th>
                  <th className="p-3">Item de Trabalho</th>
                  <th className="p-3">Referência Verificável</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Data</th>
                  {isAdvancedMode && <th className="p-3">Metadados</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {evidences.length === 0 ? (
                  <tr>
                    <td colSpan={isAdvancedMode ? 6 : 5} className="p-6 text-center text-muted-foreground">
                      Nenhuma evidência registrada. Clique em &quot;Nova Evidência&quot; para vincular uma entrega.
                    </td>
                  </tr>
                ) : (
                  evidences
                    .filter(
                      (e) =>
                        !searchQuery ||
                        e.verifiable_reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        e.work_item_id.toLowerCase().includes(searchQuery.toLowerCase()),
                    )
                    .map((ev) => (
                      <tr key={ev.id} className="hover:bg-muted/50">
                        <td className="p-3">
                          <div className="font-semibold text-xs">
                            {evidenceTypeLabels[ev.evidence_type] || ev.evidence_type}
                          </div>
                          <span className="text-[10px] text-muted-foreground uppercase">
                            Origem: {ev.origin}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs">
                          {ev.work_item_id.slice(0, 8)}...
                        </td>
                        <td className="p-3 max-w-xs truncate font-mono text-xs">
                          {ev.verifiable_reference}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                              ev.verification_status === "verified"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : ev.verification_status === "rejected"
                                  ? "bg-destructive/10 text-destructive border-destructive/20"
                                  : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            }`}
                          >
                            {verificationStatusLabels[ev.verification_status] || ev.verification_status}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(ev.captured_at).toLocaleDateString("pt-BR")}
                        </td>
                        {isAdvancedMode && (
                          <td className="p-3 text-xs font-mono max-w-xs truncate">
                            {JSON.stringify(ev.sanitized_metadata)}
                          </td>
                        )}
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: CHECKLISTS DE QUALIDADE */}
      {activeTab === "checklists" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Checklists de qualidade configurados por tipo de produto e nível de risco.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tmpl) => (
              <div key={tmpl.id} className="border bg-card rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">{tmpl.title}</h4>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-primary/10 text-primary border border-primary/20">
                    Risco: {tmpl.risk_level.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Categoria: {tmpl.category} · Versão v{tmpl.version}
                </p>

                <div className="border-t pt-2 space-y-2">
                  <strong className="text-xs uppercase text-muted-foreground block">
                    Critérios ({tmpl.items?.length || 0}):
                  </strong>
                  {tmpl.items?.map((item) => (
                    <div key={item.id} className="text-xs p-2 bg-muted/40 rounded space-y-1">
                      <div className="flex items-center justify-between font-medium">
                        <span>{item.criterion}</span>
                        {item.is_mandatory && (
                          <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-semibold">
                            Obrigatório
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-muted-foreground text-[11px]">{item.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 4: NÃO CONFORMIDADES */}
      {activeTab === "non_conformities" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Registro e acompanhamento de falhas de qualidade e desvios operacionais.
            </span>
            <button
              type="button"
              onClick={() => setShowNewNCModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-destructive text-white rounded-md hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              Abrir Não Conformidade
            </button>
          </div>

          <div className="space-y-3">
            {nonConformities.length === 0 ? (
              <div className="p-10 text-center border border-dashed rounded-lg bg-card text-muted-foreground space-y-1">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                <strong className="block text-foreground text-sm">Nenhuma Não Conformidade aberta</strong>
                <p className="text-xs">Todas as atividades estão operando dentro do padrão.</p>
              </div>
            ) : (
              nonConformities.map((nc) => (
                <div key={nc.id} className="border bg-card rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded ${
                            nc.severity === "critical"
                              ? "bg-destructive text-white"
                              : nc.severity === "high"
                                ? "bg-amber-500 text-white"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {ncSeverityLabels[nc.severity] || nc.severity}
                        </span>
                        <h4 className="font-semibold text-sm">{nc.title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        NC-{nc.id.slice(0, 8)} · Status: <strong>{nc.status.toUpperCase()}</strong>
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(nc.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs p-2.5 bg-muted/40 rounded">
                    <div>
                      <strong className="block text-muted-foreground">Causa Raiz:</strong>
                      <span>{nc.root_cause || "Em levantamento"}</span>
                    </div>
                    <div>
                      <strong className="block text-muted-foreground">Impacto:</strong>
                      <span>{nc.impact || "Em avaliação"}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <span className="text-muted-foreground">
                      Aberto por: <strong>{nc.opened_by_actor_id}</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      {!nc.corrective_work_item_id && nc.status !== "resolved" && nc.status !== "waived" && (
                        <button
                          type="button"
                          onClick={() => handleCreateCorrectiveAction(nc.id, nc.title)}
                          disabled={actionLoading}
                          className="px-2.5 py-1 bg-primary text-primary-foreground font-semibold rounded hover:opacity-90"
                        >
                          Criar Ação Corretiva
                        </button>
                      )}

                      {nc.status !== "resolved" && nc.status !== "waived" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleResolveNC(nc.id, "waived")}
                            disabled={actionLoading}
                            className="px-2.5 py-1 border text-muted-foreground hover:bg-muted rounded"
                          >
                            Dispensar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveNC(nc.id, "resolved")}
                            disabled={actionLoading}
                            className="px-2.5 py-1 bg-emerald-600 text-white font-semibold rounded hover:bg-emerald-700"
                          >
                            Concluir Resolução
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ABA 5: CORREÇÕES E REABERTURAS */}
      {activeTab === "corrective" && (
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-card space-y-2">
            <h3 className="font-semibold text-sm">Ações Corretivas e Tarefas Reabertas</h3>
            <p className="text-xs text-muted-foreground">
              Integração direta com o Motor de Operações (Módulo 04). Toda Não Conformidade relevante
              gera uma atividade rastreável com aceitação condicional.
            </p>
          </div>

          <div className="space-y-3">
            {nonConformities.filter((nc) => nc.corrective_work_item_id).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm border border-dashed rounded-lg bg-card">
                Nenhuma Ação Corretiva em andamento no momento.
              </div>
            ) : (
              nonConformities
                .filter((nc) => nc.corrective_work_item_id)
                .map((nc) => (
                  <div key={nc.id} className="border bg-card rounded-lg p-4 flex items-center justify-between text-sm">
                    <div>
                      <span className="text-xs font-semibold text-primary block">
                        Item Corretivo: {nc.corrective_work_item_id?.slice(0, 8)}...
                      </span>
                      <strong>{nc.title}</strong>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Vinculado à Não Conformidade NC-{nc.id.slice(0, 8)} · Status NC: {nc.status}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate?.("operations-engine")}
                      className="px-3 py-1 text-xs border rounded-md hover:bg-muted flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver no Motor
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* ABA 6: HISTÓRICO E AUDITORIA */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Registro imutável de todas as verificações, dispensas e alterações de estado.
            </span>
          </div>

          <div className="border rounded-lg bg-card overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="p-3">Data & Hora</th>
                  <th className="p-3">Entidade</th>
                  <th className="p-3">Ação</th>
                  <th className="p-3">Ator</th>
                  <th className="p-3">Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {auditHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      Nenhum registro no histórico de auditoria.
                    </td>
                  </tr>
                ) : (
                  auditHistory.map((h) => (
                    <tr key={h.id} className="hover:bg-muted/50 font-mono text-xs">
                      <td className="p-3 text-muted-foreground">
                        {new Date(h.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-3 uppercase">{h.entity_type}</td>
                      <td className="p-3 font-semibold text-primary">{h.action}</td>
                      <td className="p-3">{h.actor_id}</td>
                      <td className="p-3 font-sans text-xs">{h.change_reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE NOVA EVIDÊNCIA */}
      {showNewEvidenceModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Cadastrar Nova Evidência</h3>
              <button
                type="button"
                onClick={() => setShowNewEvidenceModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEvidenceSubmit} className="space-y-3 text-sm">
              <div>
                <label className="block font-medium mb-1">ID do Item de Trabalho (Work Item)*</label>
                <input
                  type="text"
                  required
                  placeholder="UUID do item de trabalho..."
                  value={newEvWorkItemId}
                  onChange={(e) => setNewEvWorkItemId(e.target.value)}
                  className="w-full p-2 border rounded bg-background font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Tipo de Evidência*</label>
                <select
                  value={newEvType}
                  onChange={(e) => setNewEvType(e.target.value as EvidenceType)}
                  className="w-full p-2 border rounded bg-background"
                >
                  <option value="before_after">Antes / Depois</option>
                  <option value="screenshot">Captura de Tela (Screenshot)</option>
                  <option value="url">URL Externa Verificável</option>
                  <option value="external_id">Identificador Externo</option>
                  <option value="sanitized_payload">Payload Sanitizado</option>
                  <option value="manual_confirmation">Confirmação Manual</option>
                  <option value="automated_validation">Validação Automatizada</option>
                  <option value="collection_limitation">Limitação de Coleta</option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1">Referência Verificável (URL/Print/ID)*</label>
                <input
                  type="text"
                  required
                  placeholder="https://... ou Print #123 ou ID..."
                  value={newEvReference}
                  onChange={(e) => setNewEvReference(e.target.value)}
                  className="w-full p-2 border rounded bg-background"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Observação de Limitação (se houver)</label>
                <textarea
                  placeholder="Ex: Coleta parcial devido a bloqueio temporário de API..."
                  value={newEvLimitationNote}
                  onChange={(e) => setNewEvLimitationNote(e.target.value)}
                  className="w-full p-2 border rounded bg-background text-xs"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewEvidenceModal(false)}
                  className="px-4 py-2 border rounded text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded hover:opacity-90"
                >
                  {actionLoading ? "Salvando..." : "Salvar Evidência"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE NOVA NÃO CONFORMIDADE */}
      {showNewNCModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Abrir Não Conformidade Operacional
              </h3>
              <button
                type="button"
                onClick={() => setShowNewNCModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNCSubmit} className="space-y-3 text-sm">
              <div>
                <label className="block font-medium mb-1">ID do Cliente (UUID)*</label>
                <input
                  type="text"
                  required
                  placeholder="UUID do cliente..."
                  value={newNcClientId}
                  onChange={(e) => setNewNcClientId(e.target.value)}
                  className="w-full p-2 border rounded bg-background font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Título da Ocorrência*</label>
                <input
                  type="text"
                  required
                  placeholder="Descreva o problema de forma clara..."
                  value={newNcTitle}
                  onChange={(e) => setNewNcTitle(e.target.value)}
                  className="w-full p-2 border rounded bg-background"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Criticidade / Severidade*</label>
                <select
                  value={newNcSeverity}
                  onChange={(e) => setNewNcSeverity(e.target.value as NonConformitySeverity)}
                  className="w-full p-2 border rounded bg-background font-semibold"
                >
                  <option value="low">Baixo Impacto</option>
                  <option value="medium">Médio Impacto</option>
                  <option value="high">Alto Risco Operacional</option>
                  <option value="critical">CRÍTICO (Bloqueia Conclusão Operacional)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1">Causa Raiz Identificada</label>
                <textarea
                  placeholder="Origem provável da falha..."
                  value={newNcRootCause}
                  onChange={(e) => setNewNcRootCause(e.target.value)}
                  className="w-full p-2 border rounded bg-background text-xs"
                  rows={2}
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Impacto Esperado</label>
                <textarea
                  placeholder="Efeitos no projeto ou cliente..."
                  value={newNcImpact}
                  onChange={(e) => setNewNcImpact(e.target.value)}
                  className="w-full p-2 border rounded bg-background text-xs"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewNCModal(false)}
                  className="px-4 py-2 border rounded text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-destructive text-white font-semibold rounded hover:opacity-90"
                >
                  {actionLoading ? "Registrando..." : "Abrir Não Conformidade"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
