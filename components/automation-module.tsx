"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BrainCircuit,
  ChevronRight,
  Cloud,
  Cpu,
  FileCheck,
  Layers,
  Lock,
  Play,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type {
  AutomationAiLimitRecord,
  AutomationAiUsageLogRecord,
  AutomationJobRecord,
  AutomationSyncStateRecord,
  AutomationWritePlanRecord,
} from "@/lib/automation-domain";

async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  try {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }
  } catch {
    // Ignite
  }
  return fetch(url, { ...init, headers });
}

type TabType =
  | "connections"
  | "resources"
  | "syncs"
  | "jobs"
  | "dead_letter"
  | "write_plans"
  | "ai_limits";

type OverviewData = {
  write_mode: "disabled" | "enabled";
  sync_states: AutomationSyncStateRecord[];
  jobs: AutomationJobRecord[];
  write_plans: AutomationWritePlanRecord[];
  ai_usage_logs: AutomationAiUsageLogRecord[];
  ai_limits: AutomationAiLimitRecord[];
  summary: {
    total_syncs: number;
    active_jobs: number;
    dead_letter_jobs: number;
    pending_write_plans: number;
  };
};

export function AutomationModule({
  onNavigate,
}: {
  onNavigate?: (view: string) => void;
}) {
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [activeTab, setActiveTab] = useState<TabType>("connections");
  const [notice, setNotice] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);

  // Formulários interativos para testes e simulação segura
  const [idempotencyKeyInput, setIdempotencyKeyInput] = useState(`idemp-${Date.now()}`);
  const [capabilityInput] = useState("google_business_profile");
  const [actionNameInput] = useState("sync_location_metadata");
  const [actionTypeInput] = useState("publish_post_draft");

  const loadData = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await authFetch("/api/automation", {
        method: "POST",
        body: JSON.stringify({ action: "overview" }),
        signal,
      });
      if (signal?.aborted) return;
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Falha ao carregar dados de automação");
      }
      const data = (await res.json()) as OverviewData;
      setOverview(data);
    } catch {
      // Falha tratada silenciosamente na UI com dados nulos
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  // Ações de Automação
  const handleEnqueueJob = async () => {
    setNotice(null);
    try {
      const res = await authFetch("/api/automation", {
        method: "POST",
        body: JSON.stringify({
          action: "enqueue_job",
          idempotency_key: idempotencyKeyInput,
          capability: capabilityInput,
          action_name: actionNameInput,
          payload: { target: "demo_resource", source: "ui_button" },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Falha ao enfileirar job");
      setNotice(
        data.deduplicated
          ? `Job idempotente detectado! Reutilizando ID existente (${data.job.id.slice(0, 8)}...)`
          : `Novo job enfileirado com sucesso! ID: ${data.job.id.slice(0, 8)}...`,
      );
      setIdempotencyKeyInput(`idemp-${Date.now()}`);
      await loadData();
    } catch (err: unknown) {
      setNotice(`Erro: ${err instanceof Error ? err.message : "Falha na ação"}`);
    }
  };

  const handleProcessJob = async (jobId: string, outcome: "success" | "fail_retryable" | "fail_fatal") => {
    setNotice(null);
    try {
      const res = await authFetch("/api/automation", {
        method: "POST",
        body: JSON.stringify({
          action: "process_job",
          job_id: jobId,
          simulate_outcome: outcome,
          simulated_error_code: outcome !== "success" ? "simulated_provider_timeout" : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Falha ao processar job");
      setNotice(`Job ${jobId.slice(0, 8)}... atualizado para status: ${data.status}`);
      await loadData();
    } catch (err: unknown) {
      setNotice(`Erro: ${err instanceof Error ? err.message : "Falha no processamento"}`);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    setNotice(null);
    try {
      const res = await authFetch("/api/automation", {
        method: "POST",
        body: JSON.stringify({
          action: "cancel_job",
          job_id: jobId,
          reason: "Cancelado pelo operador via interface",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Falha ao cancelar job");
      setNotice(`Job ${jobId.slice(0, 8)}... cancelado com sucesso.`);
      await loadData();
    } catch (err: unknown) {
      setNotice(`Erro: ${err instanceof Error ? err.message : "Falha no cancelamento"}`);
    }
  };

  const handleCreateWritePlan = async () => {
    setNotice(null);
    try {
      const res = await authFetch("/api/automation", {
        method: "POST",
        body: JSON.stringify({
          action: "create_write_plan",
          capability: capabilityInput,
          action_type: actionTypeInput,
          plan_payload: { post_title: "Postagem de Demonstração", schedule_date: new Date().toISOString() },
          supports_rollback: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Falha ao criar plano de escrita");
      setNotice(`Plano imutável registrado com hash SHA-256: ${data.plan_hash.slice(0, 16)}...`);
      await loadData();
    } catch (err: unknown) {
      setNotice(`Erro: ${err instanceof Error ? err.message : "Falha na criação do plano"}`);
    }
  };

  const handleExecuteWritePlan = async (planId: string, planHash: string) => {
    setNotice(null);
    try {
      const res = await authFetch("/api/automation", {
        method: "POST",
        body: JSON.stringify({
          action: "execute_write_plan",
          plan_id: planId,
          plan_hash: planHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Falha ao executar plano");
      if (!data.executed) {
        setNotice(`Bloqueio de Segurança Ativo: ${data.reason}`);
      } else {
        setNotice(`Plano executado com sucesso!`);
      }
      await loadData();
    } catch (err: unknown) {
      setNotice(`Erro: ${err instanceof Error ? err.message : "Falha na execução"}`);
    }
  };

  const handleRecordAiUsage = async () => {
    setNotice(null);
    try {
      const res = await authFetch("/api/automation", {
        method: "POST",
        body: JSON.stringify({
          action: "record_ai_usage",
          capability: "ai_generation",
          model_name: "gemini-3.6-flash",
          tokens_input: 1250,
          tokens_output: 450,
          estimated_cost_usd: 0.0025,
          sanitized_summary: "Geração de resposta a avaliação de cliente (dados pessoais ocultados)",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Falha ao registrar uso de IA");
      setNotice(`Uso de IA registrado: 1.700 tokens / $0,0025 USD`);
      await loadData();
    } catch (err: unknown) {
      setNotice(`Erro: ${err instanceof Error ? err.message : "Falha no registro de IA"}`);
    }
  };

  return (
    <div className="automation-page">
      <PageHeader
        eyebrow={<><Zap /> CONFIGURAÇÕES · INTEGRAÇÕES & AUTOMAÇÃO</>}
        title="Integrações e Automação Operacional"
        description="Fila idempotente de jobs, sincronização incremental, planos imutáveis de escrita com aprovação humana e limites de IA."
        helpKey="connections.overview"
        actions={
          <div className="mode-switch" role="group" aria-label="Nível de detalhes">
            <button className={mode === "simple" ? "active" : ""} onClick={() => setMode("simple")}>
              Modo simples
            </button>
            <button className={mode === "advanced" ? "active" : ""} onClick={() => setMode("advanced")}>
              <Settings2 />
              Modo avançado
            </button>
          </div>
        }
      />

      {/* Trava Geral de Escrita Externa */}
      <section className="connection-health-strip">
        <span><ShieldAlert /></span>
        <div>
          <strong>Modo de Escrita Externa: ALASTRE_WRITE_MODE={overview?.write_mode ?? "disabled"}</strong>
          <p>Toda escrita externa permanece bloqueada por padrão. Planos aprovados geram simulações auditadas.</p>
        </div>
        <div className="health-summary">
          <i className="ok" /> Proteção ativada contra publicações não autorizadas
        </div>
      </section>

      {/* Alerta / Mensagem de Ação */}
      {notice && (
        <div className="drawer-notice" style={{ marginBottom: "1rem" }}>
          <ShieldCheck />
          {notice}
        </div>
      )}

      {/* Navegação por Abas do Módulo 09 */}
      <nav className="tabs-nav" aria-label="Navegação da automação" style={{ marginBottom: "1.5rem" }}>
        <button
          className={activeTab === "connections" ? "tab-active" : ""}
          onClick={() => setActiveTab("connections")}
        >
          <Cloud /> Conexões ({overview?.summary.total_syncs ?? 0})
        </button>
        <button
          className={activeTab === "syncs" ? "tab-active" : ""}
          onClick={() => setActiveTab("syncs")}
        >
          <RefreshCw /> Sincronizações
        </button>
        <button
          className={activeTab === "jobs" ? "tab-active" : ""}
          onClick={() => setActiveTab("jobs")}
        >
          <Cpu /> Fila & Jobs ({overview?.summary.active_jobs ?? 0})
        </button>
        <button
          className={activeTab === "dead_letter" ? "tab-active" : ""}
          onClick={() => setActiveTab("dead_letter")}
        >
          <ShieldAlert /> Dead Letter ({overview?.summary.dead_letter_jobs ?? 0})
        </button>
        <button
          className={activeTab === "write_plans" ? "tab-active" : ""}
          onClick={() => setActiveTab("write_plans")}
        >
          <FileCheck /> Escritas Controladas ({overview?.summary.pending_write_plans ?? 0})
        </button>
        <button
          className={activeTab === "ai_limits" ? "tab-active" : ""}
          onClick={() => setActiveTab("ai_limits")}
        >
          <Sparkles /> Custos & Limites de IA
        </button>
      </nav>

      {/* Conteúdo da Aba 1: Conexões & Salvaguardas */}
      {activeTab === "connections" && (
        <div className="tab-pane">
          <div className="connection-section-heading">
            <div>
              <span className="section-kicker">PROVEDORES E CAPABILITIES</span>
              <h2>Catálogo Seguro de Integrações</h2>
            </div>
            {onNavigate && (
              <Button variant="outline" onClick={() => onNavigate("connections")}>
                Ver Central de Conexões <ChevronRight />
              </Button>
            )}
          </div>

          <div className="connection-grid">
            <article className="connection-card">
              <div className="provider-mark google"><Cloud /></div>
              <div className="connection-card-copy">
                <span>Google Cloud API</span>
                <h2>Google Business Profile</h2>
                <p>Sincronização de perfis, postagens locais, avaliações e métricas do Google Maps.</p>
                <div className="connection-status">
                  <i className="ok" />
                  <strong>Pronto para OAuth / Pendente de Liberação</strong>
                </div>
              </div>
            </article>

            <article className="connection-card">
              <div className="provider-mark meta"><Layers /></div>
              <div className="connection-card-copy">
                <span>Meta Graph API</span>
                <h2>Meta Ads & Instagram</h2>
                <p>Leitura de anúncios, métricas de campanhas e engajamento social.</p>
                <div className="connection-status">
                  <i />
                  <strong>Planejado (Em Breve)</strong>
                </div>
              </div>
            </article>

            <article className="connection-card">
              <div className="provider-mark alastre_ai"><BrainCircuit /></div>
              <div className="connection-card-copy">
                <span>Motor IA Alastre</span>
                <h2>IA & Automação Inteligente</h2>
                <p>Assistente de diagnóstico, análise de sentimentos e minutas de conteúdo.</p>
                <div className="connection-status">
                  <i className="ok" />
                  <strong>Incluída na Plataforma</strong>
                </div>
              </div>
            </article>
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 2: Sincronizações Incrementais */}
      {activeTab === "syncs" && (
        <div className="tab-pane">
          <div className="connection-section-heading">
            <div>
              <span className="section-kicker">SINCRONIZAÇÃO INCREMENTAL</span>
              <h2>Cursores e Saúde de Conexões</h2>
            </div>
          </div>

          <div className="resource-list">
            {overview?.sync_states.length ? (
              overview.sync_states.map((sync) => (
                <article key={sync.id}>
                  <div>
                    <strong>{sync.capability.toUpperCase()}</strong>
                    <span>
                      Status: <code>{sync.status}</code> | Cursor: <code>{sync.sync_cursor ?? "N/D"}</code>
                    </span>
                    <small style={{ color: "var(--muted-foreground)" }}>
                      Último sucesso: {sync.last_success_at ? new Date(sync.last_success_at).toLocaleString("pt-BR") : "Nunca"} | Tentativas: {sync.sync_attempts}/{sync.max_attempts}
                    </small>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void loadData()}>
                    <RefreshCw className="w-3 h-3" /> Atualizar
                  </Button>
                </article>
              ))
            ) : (
              <div className="resource-empty">
                Nenhuma sincronização executada ainda. O sistema executa syncs incrementais conforme a necessidade do serviço.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 3: Fila de Jobs & Execuções */}
      {activeTab === "jobs" && (
        <div className="tab-pane">
          <div className="connection-section-heading">
            <div>
              <span className="section-kicker">FILA E IDEMPOTÊNCIA</span>
              <h2>Execução Controlada de Jobs</h2>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Button size="sm" onClick={() => void handleEnqueueJob()}>
                <Zap /> Enfileirar Job Demo
              </Button>
            </div>
          </div>

          {mode === "advanced" && (
            <div className="panel" style={{ marginBottom: "1rem", padding: "1rem" }}>
              <span className="section-kicker">SIMULADOR DE FILA (MODO AVANÇADO)</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                <input
                  type="text"
                  placeholder="Chave de Idempotência"
                  value={idempotencyKeyInput}
                  onChange={(e) => setIdempotencyKeyInput(e.target.value)}
                  style={{ padding: "0.4rem", borderRadius: "4px", border: "1px solid var(--border)" }}
                />
                <input
                  type="text"
                  placeholder="Capability"
                  value={capabilityInput}
                  onChange={(e) => setCapabilityInput(e.target.value)}
                  style={{ padding: "0.4rem", borderRadius: "4px", border: "1px solid var(--border)" }}
                />
                <input
                  type="text"
                  placeholder="Nome da Ação"
                  value={actionNameInput}
                  onChange={(e) => setActionNameInput(e.target.value)}
                  style={{ padding: "0.4rem", borderRadius: "4px", border: "1px solid var(--border)" }}
                />
              </div>
            </div>
          )}

          <div className="resource-list">
            {overview?.jobs.length ? (
              overview.jobs.map((job) => (
                <article key={job.id}>
                  <div>
                    <strong>{job.action_name} ({job.capability})</strong>
                    <span>
                      Idempotency Key: <code>{job.idempotency_key}</code>
                    </span>
                    <small style={{ color: "var(--muted-foreground)" }}>
                      Status: <strong>{job.status.toUpperCase()}</strong> | Tentativa: {job.attempts}/{job.max_attempts} | Timeout: {job.timeout_seconds}s
                    </small>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {job.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => void handleProcessJob(job.id, "success")}>
                          <Play className="w-3 h-3" /> Sucesso
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleProcessJob(job.id, "fail_retryable")}>
                          Falhar (Retentar)
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleCancelJob(job.id)}>
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="resource-empty">
                A fila está limpa. Nenhum job pendente no momento.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 4: Dead Letter Queue */}
      {activeTab === "dead_letter" && (
        <div className="tab-pane">
          <div className="connection-section-heading">
            <div>
              <span className="section-kicker">FALHAS E RECONCILIAÇÃO</span>
              <h2>Fila Dead Letter (Sem Loop Infinito)</h2>
            </div>
          </div>

          <div className="resource-list">
            {overview?.jobs.filter((j) => j.status === "dead_letter").length ? (
              overview.jobs
                .filter((j) => j.status === "dead_letter")
                .map((job) => (
                  <article key={job.id} style={{ borderColor: "var(--destructive)" }}>
                    <div>
                      <strong style={{ color: "var(--destructive)" }}>{job.action_name} — EXCEDEU TENTATIVAS</strong>
                      <span>Erro sanitizado: <code>{job.last_error_sanitized ?? "fatal_error"}</code></span>
                      <small>Tentativas: {job.attempts}/{job.max_attempts} | ID: {job.id}</small>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void handleCancelJob(job.id)}>
                      <Trash2 className="w-3 h-3" /> Remover da Fila
                    </Button>
                  </article>
                ))
            ) : (
              <div className="resource-empty">
                Nenhuma falha crítica na fila Dead Letter. Operação saudável.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 5: Escritas Controladas (Write Plans) */}
      {activeTab === "write_plans" && (
        <div className="tab-pane">
          <div className="connection-section-heading">
            <div>
              <span className="section-kicker">APROVAÇÃO HUMANA DE ESCRITA</span>
              <h2>Planos Imutáveis com SHA-256 Hash</h2>
            </div>
            <Button size="sm" onClick={() => void handleCreateWritePlan()}>
              <FileCheck /> Criar Plano de Escrita
            </Button>
          </div>

          <div className="resource-list">
            {overview?.write_plans.length ? (
              overview.write_plans.map((plan) => (
                <article key={plan.id}>
                  <div>
                    <strong>{plan.action_type.toUpperCase()} ({plan.capability})</strong>
                    <span>
                      SHA-256 Hash: <code>{plan.plan_hash}</code>
                    </span>
                    <small>
                      Status: <strong>{plan.status.toUpperCase()}</strong> | Suporta Rollback: {plan.supports_rollback ? "Sim" : "Não"}
                    </small>
                  </div>
                  {plan.status === "pending_approval" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleExecuteWritePlan(plan.id, plan.plan_hash)}
                    >
                      <Lock className="w-3 h-3" /> Aprovar & Executar
                    </Button>
                  )}
                </article>
              ))
            ) : (
              <div className="resource-empty">
                Nenhum plano de escrita pendente de aprovação humana.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo da Aba 6: Custos e Limites de IA */}
      {activeTab === "ai_limits" && (
        <div className="tab-pane">
          <div className="connection-section-heading">
            <div>
              <span className="section-kicker">CUSTOS E TRANSPARÊNCIA</span>
              <h2>Uso e Limites de Inteligência Artificial</h2>
            </div>
            <Button size="sm" variant="outline" onClick={() => void handleRecordAiUsage()}>
              <Sparkles /> Registrar Uso Simulação
            </Button>
          </div>

          <div className="connection-grid" style={{ marginBottom: "1.5rem" }}>
            {overview?.ai_limits.length ? (
              overview.ai_limits.map((limit) => (
                <article key={limit.id} className="connection-card">
                  <div className="provider-mark alastre_ai"><BrainCircuit /></div>
                  <div className="connection-card-copy">
                    <span>Capability: {limit.capability}</span>
                    <h2>Cota Mensal de IA</h2>
                    <p>
                      Tokens Consumidos: {limit.current_monthly_tokens.toLocaleString("pt-BR")} / {limit.monthly_token_limit.toLocaleString("pt-BR")}
                    </p>
                    <p>
                      Custo Estimado: ${Number(limit.current_monthly_cost_usd).toFixed(4)} / ${Number(limit.monthly_cost_limit_usd).toFixed(2)} USD
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <div className="resource-empty" style={{ gridColumn: "1 / -1" }}>
                Dados Insuficientes (N/D). Nenhum uso de IA registrado para este tenant no período corrente.
              </div>
            )}
          </div>

          <div className="connection-section-heading">
            <h3>Histórico de Chamadas Sanitizadas de IA</h3>
          </div>
          <div className="resource-list">
            {overview?.ai_usage_logs.length ? (
              overview.ai_usage_logs.map((log) => (
                <article key={log.id}>
                  <div>
                    <strong>{log.model_name} — {log.capability}</strong>
                    <span>{log.sanitized_summary}</span>
                    <small>
                      Tokens: {log.tokens_input} in / {log.tokens_output} out | Cost: ${Number(log.estimated_cost_usd).toFixed(4)} USD | Data: {new Date(log.created_at).toLocaleString("pt-BR")}
                    </small>
                  </div>
                </article>
              ))
            ) : (
              <div className="resource-empty">
                Nenhum log de uso de IA disponível.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
