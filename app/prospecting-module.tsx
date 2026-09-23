"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Compass,
  Search,
  Building2,
  MapPin,
  Phone,
  Globe,
  Star,
  ExternalLink,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Info,
  CheckSquare,
  Square,
  Download,
  Trash2,
  XCircle,
  Loader2,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Ban,
  Sparkles,
  HelpCircle,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { POC_OFFLINE_LEADS } from "@/lib/prospecting/poc-offline-leads";

export interface ProspectingLeadItem {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  maps_url: string | null;
  place_id?: string | null;
  cid?: string | null;
  created_at: string;
}

export interface QualificationOptions {
  withoutWebsite: boolean;
  withoutPhone: boolean;
  fewReviews: boolean;
  lowRating: boolean;
  incompleteInfo: boolean;
  unclaimedProfile: boolean;
}

export type JobProgressState =
  | "idle"
  | "queued"
  | "claimed"
  | "scraping"
  | "normalizing"
  | "completed"
  | "cancelled"
  | "failed"
  | "blocked";

type FilterCriterion =
  | "all"
  | "no_website"
  | "no_phone"
  | "few_reviews"
  | "low_rating"
  | "incomplete"
  | "pending_checklist"
  | "completed_checklist";

interface LeadChecklistState {
  identity: boolean;
  address: boolean;
  phone: boolean;
  website: boolean;
  reviews: boolean;
}

import { detectOpportunities } from "@/lib/prospecting/opportunity-detector";

export interface ProspectingModuleProps {
  onNavigate?: (view: any) => void;
}

export function ProspectingModule({ onNavigate }: ProspectingModuleProps = {}) {
  // Formulário funcional
  const [niche, setNiche] = useState("Vidraçaria");
  const [city, setCity] = useState("Sorocaba");
  const [stateUf, setStateUf] = useState("SP");
  const [limit, setLimit] = useState(10);

  // Opções de qualificação
  const [qualOptions, setQualOptions] = useState<QualificationOptions>({
    withoutWebsite: true,
    withoutPhone: true,
    fewReviews: true,
    lowRating: true,
    incompleteInfo: true,
    unclaimedProfile: false,
  });

  // Estado da execução
  const [progressState, setProgressState] = useState<JobProgressState>("idle");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [blockTelemetry, setBlockTelemetry] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Health check real do motor de prospecção (Requisitos 1, 2, 3 e 4)
  const [supervisorHealth, setSupervisorHealth] = useState<{
    online: boolean;
    last_heartbeat: string | null;
    seconds_since_heartbeat: number | null;
    worker_id: string | null;
    message: string;
  }>({
    online: false,
    last_heartbeat: null,
    seconds_since_heartbeat: null,
    worker_id: null,
    message: "Verificando status do motor de prospecção...",
  });

  // Resultados
  const [leads, setLeads] = useState<ProspectingLeadItem[]>(() => {
    // Inicializa com a amostra offline de 10 itens para visualização imediata
    return POC_OFFLINE_LEADS.map((l) => ({
      id: l.id,
      name: l.name,
      category: l.category,
      address: l.address,
      phone: l.phone,
      website: l.website,
      rating: l.rating,
      review_count: l.review_count,
      maps_url: l.maps_url,
      cid: l.cid || null,
      created_at: "2026-09-22T21:00:00.000Z",
    }));
  });

  const [activeFilter, setActiveFilter] = useState<FilterCriterion>("all");
  const [selectedLead, setSelectedLead] = useState<ProspectingLeadItem | null>(
    null
  );
  const [checklists, setChecklists] = useState<
    Record<string, LeadChecklistState>
  >({});

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Health check contínuo do motor de prospecção a cada 2s (Requisitos 1, 2, 3 e 4)
  useEffect(() => {
    let isMounted = true;
    const checkSupervisorHealth = async () => {
      try {
        const res = await fetch("/api/prospecting/supervisor/status");
        if (res.ok && isMounted) {
          const data = await res.json();
          setSupervisorHealth(data);
        }
      } catch {
        if (isMounted) {
          setSupervisorHealth({
            online: false,
            last_heartbeat: null,
            seconds_since_heartbeat: null,
            worker_id: null,
            message: "Falha de conexão com o health check do supervisor.",
          });
        }
      }
    };

    checkSupervisorHealth();
    const interval = setInterval(checkSupervisorHealth, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Timer de duração da execução
  useEffect(() => {
    if (
      progressState === "queued" ||
      progressState === "claimed" ||
      progressState === "scraping" ||
      progressState === "normalizing"
    ) {
      elapsedTimerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    }
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [progressState]);

  // Carrega automaticamente APENAS se houver job ativamente em andamento (Requisitos 5 e 6)
  useEffect(() => {
    fetch("/api/prospecting/jobs")
      .then((r) => r.json())
      .then((data) => {
        if (data.activeJob) {
          setActiveJobId(data.activeJob.id);
          setNiche(data.activeJob.query);
          const parts = (data.activeJob.location || "").split(" - ");
          if (parts[0]) setCity(parts[0]);
          if (parts[1]) setStateUf(parts[1]);
        }
        if (data.supervisorHealth) {
          setSupervisorHealth(data.supervisorHealth);
        }
      })
      .catch(() => {});
  }, []);

  // Suporte a visualização direta de detalhes via URL (?details=true ou ?lead_id=...)
  useEffect(() => {
    if (typeof window !== "undefined" && leads.length > 0) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("details") === "true" || params.get("details") === "1") {
        setSelectedLead(leads[leads.length - 1]); // Exibe lead com carência (ex: Casa do Pet, sem site)
      } else if (params.get("lead_id")) {
        const found = leads.find((l) => l.id === params.get("lead_id"));
        if (found) setSelectedLead(found);
      }
    }
  }, [leads]);

  // Polling de acompanhamento do job ativo
  useEffect(() => {
    if (!activeJobId) return;

    const checkJob = async () => {
      try {
        const res = await fetch(`/api/prospecting/jobs/${activeJobId}`);
        if (!res.ok) return;

        const data = await res.json();
        const job = data.job;

        if (job) {
          if (job.status === "queued") {
            setProgressState("queued");
            setStatusMessage("Aguardando supervisor local reivindicar a tarefa...");
          } else if (job.status === "leased") {
            if (job.heartbeat_at) {
              setProgressState("scraping");
              setStatusMessage(
                "Coletor em execução no Google Maps... aguardando término da busca factual."
              );
            } else {
              setProgressState("claimed");
              setStatusMessage("Supervisor local inicializando o navegador Chromium.");
            }
          } else if (job.status === "completed") {
            setProgressState("completed");
            setStatusMessage("Prospecção concluída com sucesso! Resultados factuais carregados.");
            if (Array.isArray(data.leads) && data.leads.length > 0) {
              setLeads(data.leads);
            }
            if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          } else if (job.status === "blocked") {
            setProgressState("blocked");
            setBlockTelemetry(data.blockTelemetry);
            setStatusMessage(
              "Bloqueio ou CAPTCHA detectado no Google Maps. Execução interrompida com segurança."
            );
            if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          } else if (job.status === "cancelled" || job.status === "cancellation_requested") {
            setProgressState("cancelled");
            setStatusMessage("Execução cancelada pelo operador. Processos encerrados e formulário liberado.");
            if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          } else if (job.status === "failed") {
            setProgressState("failed");
            if (job.error_reason === "supervisor_unavailable_timeout") {
              setStatusMessage(
                "Tempo limite esgotado: nenhum supervisor local reivindicou a tarefa em 30 segundos. O formulário foi liberado."
              );
              setErrorMsg("Supervisor indisponível: o job foi retirado da fila automaticamente após 30 segundos.");
            } else if (job.error_reason === "execution_deadline_exceeded") {
              setStatusMessage(
                "Prazo máximo de execução (5 minutos) excedido. O job foi encerrado com segurança."
              );
              setErrorMsg("Prazo máximo de 5 minutos excedido.");
            } else {
              setStatusMessage(`A execução falhou: ${job.error_reason || "Erro no coletor"}`);
              setErrorMsg(job.error_reason || "Falha na execução do coletor.");
            }
            if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          }
        }
      } catch (err) {
        console.error("Erro no polling da prospecção:", err);
      }
    };

    // Polling a cada 1.5s
    pollingTimerRef.current = setInterval(checkJob, 1500);
    checkJob();

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [activeJobId]);

  // Ação: Iniciar Prospecção (Requisitos 2 e 4)
  const handleStartProspecting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMsg(null);
    setBlockTelemetry(null);

    // Requisito 2 & 4: Confirmar que o supervisor está online antes de permitir iniciar
    if (!supervisorHealth.online) {
      setErrorMsg(
        "O motor de prospecção local está offline no momento. Inicie o serviço com 'npm run dev:all' no terminal para habilitar a busca."
      );
      return;
    }

    if (!niche.trim()) {
      setErrorMsg("Informe o nicho ou termo de busca.");
      return;
    }
    if (!city.trim()) {
      setErrorMsg("Informe a cidade.");
      return;
    }

    setIsSubmitting(true);
    setElapsedSeconds(0);
    setProgressState("queued");
    setStatusMessage("Enfileirando trabalho no backend da Alastre Platform...");

    try {
      const res = await fetch("/api/prospecting/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: niche.trim(),
          city: city.trim(),
          state: stateUf.trim(),
          limit: Math.min(limit, 10),
          qualificationOptions: qualOptions,
        }),
      });

      if (res.status === 409) {
        const conflict = await res.json();
        setErrorMsg(
          "Já existe uma prospecção ativa em andamento no momento. Aguarde o término ou cancele-a."
        );
        setProgressState("idle");
        setIsSubmitting(false);
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      setActiveJobId(data.job.id);
      setProgressState("queued");
      setStatusMessage("Trabalho enfileirado com sucesso. Aguardando supervisor local...");
    } catch (err: any) {
      setErrorMsg(err.message || "Falha ao iniciar prospecção.");
      setProgressState("failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ação: Cancelar Execução (Requisito 7)
  const handleCancelProspecting = async () => {
    if (!activeJobId) return;
    try {
      setStatusMessage("Cancelando execução...");
      await fetch(`/api/prospecting/jobs/${activeJobId}/cancel`, {
        method: "POST",
      });
      setProgressState("cancelled");
      setStatusMessage("Execução cancelada pelo operador. Processos encerrados e formulário liberado.");
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    } catch (err) {
      console.error("Falha ao cancelar:", err);
    }
  };

  // Ação: Limpar Resultados
  const handleClearResults = () => {
    setLeads([]);
    setActiveJobId(null);
    setProgressState("idle");
    setStatusMessage("");
    setErrorMsg(null);
    setBlockTelemetry(null);
    setSelectedLead(null);
  };

  // Ação: Carregar Amostra Offline da PoC
  const handleLoadPocSample = () => {
    setLeads(
      POC_OFFLINE_LEADS.map((l) => ({
        id: l.id,
        name: l.name,
        category: l.category,
        address: l.address,
        phone: l.phone,
        website: l.website,
        rating: l.rating,
        review_count: l.review_count,
        maps_url: l.maps_url,
        cid: l.cid || null,
        created_at: "2026-09-22T21:00:00.000Z",
      }))
    );
    setProgressState("completed");
    setStatusMessage("Amostra factual da PoC (Vidraçarias em Sorocaba) carregada.");
    setErrorMsg(null);
  };

  // Checklist de validação humana
  const toggleChecklistItem = (
    leadId: string,
    itemKey: keyof LeadChecklistState
  ) => {
    setChecklists((prev) => {
      const current = prev[leadId] || {
        identity: false,
        address: false,
        phone: false,
        website: false,
        reviews: false,
      };
      return {
        ...prev,
        [leadId]: {
          ...current,
          [itemKey]: !current[itemKey],
        },
      };
    });
  };

  const getValidationProgress = (leadId: string): number => {
    const cl = checklists[leadId];
    if (!cl) return 0;
    return [cl.identity, cl.address, cl.phone, cl.website, cl.reviews].filter(
      Boolean
    ).length;
  };

  const isFullyValidated = (leadId: string): boolean => {
    return getValidationProgress(leadId) === 5;
  };

  // Filtragem dos resultados com base nos critérios de oportunidade
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const opps = detectOpportunities(lead);
      if (activeFilter === "no_website") return opps.withoutWebsite;
      if (activeFilter === "no_phone") return opps.withoutPhone;
      if (activeFilter === "few_reviews") return opps.fewReviews;
      if (activeFilter === "low_rating") return opps.lowRating;
      if (activeFilter === "incomplete") return opps.incompleteInfo;
      if (activeFilter === "pending_checklist") return !isFullyValidated(lead.id);
      if (activeFilter === "completed_checklist") return isFullyValidated(lead.id);
      return true;
    });
  }, [leads, activeFilter, checklists]);

  // Exportação CSV RFC-4180
  const handleExportCsv = () => {
    if (leads.length === 0) return;

    const headers = [
      "Nome",
      "Categoria",
      "Endereço",
      "Telefone",
      "Website",
      "Nota Google",
      "Total Avaliações",
      "Oportunidades",
      "URL Google Maps",
      "Evidência",
      "Momento da Coleta",
    ];

    const escapeCell = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = leads.map((lead) => {
      const oppList: string[] = [];
      const opps = detectOpportunities(lead);
      if (opps.withoutWebsite) oppList.push("Sem website");
      if (opps.withoutPhone) oppList.push("Sem telefone");
      if (opps.fewReviews) oppList.push("Poucas avaliações (<=10)");
      if (opps.lowRating) oppList.push("Nota baixa (<4.5)");
      if (opps.incompleteInfo) oppList.push("Cadastro incompleto");

      return [
        escapeCell(lead.name),
        escapeCell(lead.category ?? "Não localizado"),
        escapeCell(lead.address ?? "Não localizado"),
        escapeCell(lead.phone ?? "Não localizado"),
        escapeCell(lead.website ?? "Não localizado"),
        escapeCell(lead.rating !== null ? lead.rating : "Não informada"),
        escapeCell(
          lead.review_count !== null ? lead.review_count : "Não informada"
        ),
        escapeCell(oppList.join("; ") || "Perfil estruturado"),
        escapeCell(lead.maps_url ?? ""),
        escapeCell("Coleta pública Google Maps"),
        escapeCell(lead.created_at || new Date().toISOString()),
      ].join(",");
    });

    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const sanitizedName = `prospeccao_${niche}_${city}`
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_");
    link.setAttribute("href", url);
    link.setAttribute("download", `${sanitizedName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isExecutionActive =
    progressState === "queued" ||
    progressState === "claimed" ||
    progressState === "scraping" ||
    progressState === "normalizing";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Cabeçalho do Módulo e Status do Motor de Prospecção (Requisitos 1, 2 e 3) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          eyebrow="PROSPECÇÃO / DESCOBERTA & TRIAGEM"
          title="Central de Prospecção"
          description="Encontre negócios locais no Google Maps e identifique oportunidades comerciais com evidências 100% públicas e dados factuais."
        />

        {/* Indicador de Saúde do Motor de Prospecção (Requisito 3) */}
        <div
          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs shrink-0 transition-colors shadow-sm ${
            supervisorHealth.online
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              supervisorHealth.online
                ? "bg-emerald-500 animate-pulse"
                : "bg-red-500"
            }`}
          />
          <div>
            <div className="font-semibold flex items-center gap-1.5">
              <span>
                {supervisorHealth.online
                  ? "Motor de prospecção online"
                  : "Motor de prospecção offline"}
              </span>
            </div>
            <p className="text-[11px] opacity-80">
              {supervisorHealth.online
                ? supervisorHealth.seconds_since_heartbeat !== null
                  ? `Último heartbeat há ${supervisorHealth.seconds_since_heartbeat}s`
                  : "Conectado e apto para execução"
                : supervisorHealth.seconds_since_heartbeat !== null
                ? `Sem sinal há ${supervisorHealth.seconds_since_heartbeat}s`
                : "Supervisor não iniciado"}
            </p>
          </div>
        </div>
      </div>

      {/* Alerta Destacado Quando o Motor Estiver Offline (Requisito 3) */}
      {!supervisorHealth.online && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1.5">
            <p className="font-bold">
              Motor de Prospecção Indisponível
            </p>
            <p className="text-foreground leading-relaxed">
              O supervisor local responsável por executar a coleta no Google Maps não está conectado.
              Para habilitar o formulário e realizar prospecções em tempo real, inicie a aplicação com o comando unificado:
            </p>
            <div className="pt-0.5">
              <code className="px-2.5 py-1 rounded bg-muted border border-border font-mono text-xs text-foreground font-semibold">
                npm run dev:all
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Banner Permanente de Governança e Salvaguardas */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1 leading-relaxed">
          <p className="font-semibold">
            Ambiente Local de Homologação — Operação Factual Segura
          </p>
          <p className="text-muted-foreground">
            A plataforma opera em modo estritamente factual via supervisor local.
            Nenhum contato é realizado com empresas prospectadas, nenhum dado é inventado
            e valores ausentes são preservados como &ldquo;Não localizado&rdquo;. O limite máximo
            de segurança nesta etapa é de 10 resultados por execução.
          </p>
        </div>
      </div>

      {/* Formulário Funcional de Busca e Qualificação */}
      <div className="p-6 rounded-2xl bg-card border border-border space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">
              Critérios da Prospecção Local
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Limite seguro por execução: até 10 empresas
          </span>
        </div>

        <form onSubmit={handleStartProspecting} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Nicho / Termo */}
            <div className="space-y-1.5">
              <label
                htmlFor="input-niche"
                className="text-xs font-semibold text-foreground flex items-center gap-1.5"
              >
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                Nicho / Atividade
              </label>
              <input
                id="input-niche"
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Ex: Vidraçaria, Pet Shop, Dentista..."
                disabled={isExecutionActive}
                className="w-full h-10 px-3 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                required
              />
            </div>

            {/* Cidade */}
            <div className="space-y-1.5">
              <label
                htmlFor="input-city"
                className="text-xs font-semibold text-foreground flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                Cidade
              </label>
              <input
                id="input-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: Sorocaba, Campinas..."
                disabled={isExecutionActive}
                className="w-full h-10 px-3 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                required
              />
            </div>

            {/* Estado */}
            <div className="space-y-1.5">
              <label
                htmlFor="input-state"
                className="text-xs font-semibold text-foreground"
              >
                Estado (UF)
              </label>
              <select
                id="input-state"
                value={stateUf}
                onChange={(e) => setStateUf(e.target.value)}
                disabled={isExecutionActive}
                className="w-full h-10 px-3 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
              >
                <option value="SP">SP - São Paulo</option>
                <option value="RJ">RJ - Rio de Janeiro</option>
                <option value="MG">MG - Minas Gerais</option>
                <option value="PR">PR - Paraná</option>
                <option value="SC">SC - Santa Catarina</option>
                <option value="RS">RS - Rio Grande do Sul</option>
                <option value="BA">BA - Bahia</option>
                <option value="DF">DF - Distrito Federal</option>
                <option value="GO">GO - Goiás</option>
                <option value="PE">PE - Pernambuco</option>
                <option value="CE">CE - Ceará</option>
              </select>
            </div>

            {/* Quantidade Máxima (Teto seguro de 10) */}
            <div className="space-y-1.5">
              <label
                htmlFor="input-limit"
                className="text-xs font-semibold text-foreground"
              >
                Limite Máximo
              </label>
              <select
                id="input-limit"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                disabled={isExecutionActive}
                className="w-full h-10 px-3 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
              >
                <option value={5}>5 empresas</option>
                <option value={10}>10 empresas (Padrão Homologação)</option>
              </select>
            </div>
          </div>

          {/* Opções de Qualificação / Oportunidade */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Destaques de Oportunidade Comercial
              </span>
              <span className="text-[11px] text-muted-foreground">
                Sinaliza empresas com carências de presença online
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={qualOptions.withoutWebsite}
                  onChange={(e) =>
                    setQualOptions((prev) => ({
                      ...prev,
                      withoutWebsite: e.target.checked,
                    }))
                  }
                  disabled={isExecutionActive}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span>Sem website identificado</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={qualOptions.withoutPhone}
                  onChange={(e) =>
                    setQualOptions((prev) => ({
                      ...prev,
                      withoutPhone: e.target.checked,
                    }))
                  }
                  disabled={isExecutionActive}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span>Sem telefone identificado</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={qualOptions.fewReviews}
                  onChange={(e) =>
                    setQualOptions((prev) => ({
                      ...prev,
                      fewReviews: e.target.checked,
                    }))
                  }
                  disabled={isExecutionActive}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span>Poucas avaliações (≤ 10)</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={qualOptions.lowRating}
                  onChange={(e) =>
                    setQualOptions((prev) => ({
                      ...prev,
                      lowRating: e.target.checked,
                    }))
                  }
                  disabled={isExecutionActive}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span>Nota do Google abaixo de 4.5</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={qualOptions.incompleteInfo}
                  onChange={(e) =>
                    setQualOptions((prev) => ({
                      ...prev,
                      incompleteInfo: e.target.checked,
                    }))
                  }
                  disabled={isExecutionActive}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span>Cadastro incompleto (sem tel/site)</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={qualOptions.unclaimedProfile}
                  onChange={(e) =>
                    setQualOptions((prev) => ({
                      ...prev,
                      unclaimedProfile: e.target.checked,
                    }))
                  }
                  disabled={isExecutionActive}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="flex items-center gap-1">
                  Perfil não reivindicado
                  <span
                    className="text-[10px] text-muted-foreground"
                    title="Marcado somente quando houver comprovação pública factual"
                  >
                    (se comprovado)
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* Mensagem de Erro de Submissão */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Barra de Ações do Formulário */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              {/* Botão Principal: Iniciar Prospecção (Requisito 4) */}
              <Button
                type="submit"
                disabled={isExecutionActive || isSubmitting || !supervisorHealth.online}
                title={
                  !supervisorHealth.online
                    ? "Inicie o motor de prospecção com 'npm run dev:all' para habilitar a busca"
                    : undefined
                }
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 h-10 shadow-sm disabled:opacity-50"
              >
                {!supervisorHealth.online ? (
                  <>
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Motor Offline (Iniciar Indisponível)
                  </>
                ) : isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : isExecutionActive ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Executando Coleta...
                  </>
                ) : (
                  <>
                    <Compass className="w-4 h-4 mr-2" />
                    Iniciar Prospecção
                  </>
                )}
              </Button>

              {/* Botão: Cancelar Execução */}
              {isExecutionActive && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleCancelProspecting}
                  className="h-10 text-xs font-semibold"
                >
                  <XCircle className="w-4 h-4 mr-1.5" />
                  Cancelar Execução
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Botão: Limpar Resultados */}
              <Button
                type="button"
                variant="outline"
                onClick={handleClearResults}
                disabled={isExecutionActive || leads.length === 0}
                className="h-10 text-xs"
              >
                <Trash2 className="w-4 h-4 mr-1.5 text-muted-foreground" />
                Limpar Resultados
              </Button>

              {/* Botão: Carregar Amostra PoC */}
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadPocSample}
                disabled={isExecutionActive}
                className="h-10 text-xs"
                title="Carrega os 10 resultados factuais coletados anteriormente para testes rápidos offline"
              >
                <Clock className="w-4 h-4 mr-1.5 text-muted-foreground" />
                Amostra PoC (Offline)
              </Button>

              {/* Botão: Exportar CSV */}
              <Button
                type="button"
                variant="outline"
                onClick={handleExportCsv}
                disabled={isExecutionActive || leads.length === 0}
                className="h-10 text-xs font-medium"
              >
                <Download className="w-4 h-4 mr-1.5 text-muted-foreground" />
                Exportar CSV ({leads.length})
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Monitor de Progresso da Execução em Tempo Real */}
      {progressState !== "idle" && (
        <div className="p-5 rounded-2xl bg-card border border-border space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {isExecutionActive ? (
                <div className="w-3 h-3 rounded-full bg-primary animate-ping" />
              ) : progressState === "completed" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : progressState === "blocked" ? (
                <Ban className="w-5 h-5 text-amber-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-500" />
              )}
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {progressState === "queued" && "Aguardando na fila..."}
                  {progressState === "claimed" && "Supervisor iniciando..."}
                  {progressState === "scraping" && "Coletando no Google Maps..."}
                  {progressState === "normalizing" && "Normalizando identidades..."}
                  {progressState === "completed" && "Prospecção Concluída"}
                  {progressState === "blocked" && "Coleta Bloqueada pelo Google"}
                  {progressState === "cancelled" && "Execução Cancelada"}
                  {progressState === "failed" && "Falha na Prospecção"}
                </h3>
                <p className="text-xs text-muted-foreground">{statusMessage}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
              {isExecutionActive && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{elapsedSeconds}s decorridos</span>
                </div>
              )}
              {activeJobId && (
                <span className="text-[11px] bg-muted px-2 py-0.5 rounded">
                  Job: {activeJobId.slice(0, 16)}...
                </span>
              )}
            </div>
          </div>

          {/* Linha de Etapas do Progresso */}
          <div className="grid grid-cols-4 gap-2 pt-2 text-[11px]">
            <div
              className={`p-2 rounded-lg border text-center font-medium transition-colors ${
                progressState === "queued"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              1. Enfileirado
            </div>
            <div
              className={`p-2 rounded-lg border text-center font-medium transition-colors ${
                progressState === "claimed"
                  ? "border-primary bg-primary/10 text-primary"
                  : progressState === "scraping" ||
                    progressState === "normalizing" ||
                    progressState === "completed"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border text-muted-foreground"
              }`}
            >
              2. Supervisor
            </div>
            <div
              className={`p-2 rounded-lg border text-center font-medium transition-colors ${
                progressState === "scraping"
                  ? "border-primary bg-primary/10 text-primary animate-pulse"
                  : progressState === "normalizing" || progressState === "completed"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border text-muted-foreground"
              }`}
            >
              3. Coleta Maps
            </div>
            <div
              className={`p-2 rounded-lg border text-center font-medium transition-colors ${
                progressState === "completed"
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold"
                  : progressState === "blocked"
                  ? "border-amber-500 bg-amber-500/10 text-amber-600"
                  : progressState === "cancelled" || progressState === "failed"
                  ? "border-red-500 bg-red-500/10 text-red-600"
                  : "border-border text-muted-foreground"
              }`}
            >
              4. Finalização
            </div>
          </div>

          {/* Alerta de Bloqueio Sanitizado */}
          {progressState === "blocked" && blockTelemetry && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <Ban className="w-4 h-4" />
                Telemetria de Bloqueio Registrada (Sem Evasão):
              </div>
              <p>Tipo: {blockTelemetry.block_type || "captcha_detected"}</p>
              <p>Detector: {blockTelemetry.collector_version || "gosom-v1"}</p>
              <p>
                A Alastre Platform interrompeu o scraping cooperativamente para
                respeitar os termos de serviço e a estabilidade da rede.
              </p>
            </div>
          )}

          {/* Opção Tentar Novamente / Liberar Formulário (Requisito 5) */}
          {(progressState === "failed" || progressState === "cancelled") && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs">
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">
                    {progressState === "cancelled"
                      ? "Execução cancelada pelo operador"
                      : "A prospecção foi interrompida"}
                  </span>
                  <span className="text-foreground/80 leading-relaxed block mt-0.5">
                    {statusMessage || "O formulário está liberado para nova tentativa."}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setProgressState("idle");
                  setStatusMessage("");
                  setErrorMsg(null);
                  setActiveJobId(null);
                }}
                className="h-8 text-xs font-semibold shrink-0 border-destructive/30 hover:bg-destructive/15 text-destructive"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Tentar Novamente
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Resultados da Prospecção: Filtros & Tabela */}
      <div className="p-6 rounded-2xl bg-card border border-border space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Empresas Identificadas
            </h2>
            <p className="text-xs text-muted-foreground">
              Exibindo {filteredLeads.length} de {leads.length} fichas públicas coletadas
            </p>
          </div>

          {/* Filtros Rápidos por Critérios de Oportunidade */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-all ${
                activeFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos ({leads.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("no_website")}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-all ${
                activeFilter === "no_website"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Sem site (
              {leads.filter((l) => detectOpportunities(l).withoutWebsite).length}
              )
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("no_phone")}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-all ${
                activeFilter === "no_phone"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Sem telefone (
              {leads.filter((l) => detectOpportunities(l).withoutPhone).length}
              )
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("few_reviews")}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-all ${
                activeFilter === "few_reviews"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Poucas avaliações (
              {leads.filter((l) => detectOpportunities(l).fewReviews).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("low_rating")}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-all ${
                activeFilter === "low_rating"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Nota &lt; 4.5 (
              {leads.filter((l) => detectOpportunities(l).lowRating).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("pending_checklist")}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-all ${
                activeFilter === "pending_checklist"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Pendentes (
              {leads.filter((l) => !isFullyValidated(l.id)).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("completed_checklist")}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-all ${
                activeFilter === "completed_checklist"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Validados (
              {leads.filter((l) => isFullyValidated(l.id)).length})
            </button>
          </div>
        </div>

        {/* Tabela de Resultados */}
        {filteredLeads.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl space-y-3">
            <Building2 className="w-10 h-10 mx-auto text-muted-foreground/50" />
            <h3 className="text-sm font-semibold text-foreground">
              Nenhuma empresa encontrada com os filtros selecionados
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Experimente alterar os critérios de filtro ou realizar uma nova busca
              informando um nicho e cidade no formulário acima.
            </p>
            {leads.length === 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLoadPocSample}
                className="mt-2"
              >
                Carregar Amostra da PoC (10 Vidraçarias)
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-4">Empresa / Categoria</th>
                  <th className="py-3 px-4">Contato & Site</th>
                  <th className="py-3 px-3">Nota / Avaliações</th>
                  <th className="py-3 px-4">Oportunidades Comerciais</th>
                  <th className="py-3 px-3">Conferência</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLeads.map((lead, idx) => {
                  const opps = detectOpportunities(lead);
                  const progress = getValidationProgress(lead.id);
                  const fullyValidated = progress === 5;

                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* Índice */}
                      <td className="py-3 px-3 font-mono text-muted-foreground">
                        {idx + 1}
                      </td>

                      {/* Nome e Endereço */}
                      <td className="py-3 px-4 max-w-[220px]">
                        <div className="font-bold text-foreground truncate">
                          {lead.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {lead.category || "Empresa Local"}
                        </div>
                        {lead.address && (
                          <div className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
                            {lead.address}
                          </div>
                        )}
                      </td>

                      {/* Contato & Site */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {/* Telefone */}
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                            {lead.phone ? (
                              <span className="font-mono text-foreground">
                                {lead.phone}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/70 italic">
                                Não localizado
                              </span>
                            )}
                          </div>

                          {/* Site */}
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                            {lead.website ? (
                              <a
                                href={
                                  lead.website.startsWith("http")
                                    ? lead.website
                                    : `https://${lead.website}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline truncate max-w-[140px]"
                              >
                                {lead.website.replace(/^https?:\/\//, "")}
                              </a>
                            ) : (
                              <span className="text-muted-foreground/70 italic">
                                Não localizado
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Nota e Avaliações */}
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            {lead.rating !== null ? (
                              <span className="font-bold text-foreground">
                                {lead.rating.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">
                                Não informada
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {lead.review_count !== null
                              ? `${lead.review_count} avaliações`
                              : "Sem contagem"}
                          </div>
                        </div>
                      </td>

                      {/* Badges de Oportunidade */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {opps.withoutWebsite && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium border border-blue-500/20">
                              Sem site
                            </span>
                          )}
                          {opps.withoutPhone && (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-medium border border-red-500/20">
                              Sem telefone
                            </span>
                          )}
                          {opps.fewReviews && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-medium border border-amber-500/20">
                              Poucas avaliações
                            </span>
                          )}
                          {opps.lowRating && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-medium border border-purple-500/20">
                              Nota &lt; 4.5
                            </span>
                          )}
                          {!opps.withoutWebsite &&
                            !opps.withoutPhone &&
                            !opps.fewReviews &&
                            !opps.lowRating && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium border border-emerald-500/20">
                                Perfil estruturado
                              </span>
                            )}
                        </div>
                      </td>

                      {/* Progresso de Conferência Manual */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              fullyValidated ? "bg-emerald-500" : "bg-amber-400"
                            }`}
                          />
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {progress}/5
                          </span>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {lead.maps_url && (
                            <a
                              href={lead.maps_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
                              title="Abrir ficha no Google Maps"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLead(lead)}
                            className="h-7 px-2 text-[11px]"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Detalhes
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal / Gaveta de Detalhes do Lead */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  {selectedLead.category || "Empresa Local"}
                </span>
                <h3 className="text-lg font-bold text-foreground">
                  {selectedLead.name}
                </h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLead(null)}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>

            {/* Dados Factuais Coletados */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground font-semibold">
                  Endereço Factual:
                </span>
                <p className="text-foreground">
                  {selectedLead.address || "Não localizado na coleta"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground font-semibold">
                  Telefone Factual:
                </span>
                <p className="text-foreground font-mono">
                  {selectedLead.phone || "Não localizado na coleta"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground font-semibold">
                  Website Factual:
                </span>
                <p className="text-foreground">
                  {selectedLead.website ? (
                    <a
                      href={
                        selectedLead.website.startsWith("http")
                          ? selectedLead.website
                          : `https://${selectedLead.website}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {selectedLead.website}
                    </a>
                  ) : (
                    "Não localizado na coleta"
                  )}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground font-semibold">
                  Avaliações Google:
                </span>
                <p className="text-foreground flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {selectedLead.rating !== null
                    ? `${selectedLead.rating} ★ (${selectedLead.review_count ?? "0"} avaliações)`
                    : "Não informada"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground font-semibold">
                  Momento da Coleta:
                </span>
                <p className="text-foreground font-mono">
                  {selectedLead.created_at || "Sessão atual"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground font-semibold">
                  Identificador / CID:
                </span>
                <p className="text-foreground font-mono text-[11px] truncate">
                  {selectedLead.cid || selectedLead.place_id || "Não extraído"}
                </p>
              </div>
            </div>

            {/* Checklist de Conferência Humana Manual */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-primary" />
                  Checklist de Auditoria Manual
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  {getValidationProgress(selectedLead.id)}/5 conferidos
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  { key: "identity", label: "Nome e razão conferem no Google Maps" },
                  { key: "address", label: "Endereço físico confirmado" },
                  { key: "phone", label: "Telefone conferido ou confirmado ausente" },
                  { key: "website", label: "Website ou redes sociais conferidos" },
                  { key: "reviews", label: "Nota e volume de avaliações conferem com a ficha" },
                ].map(({ key, label }) => {
                  const isChecked =
                    checklists[selectedLead.id]?.[key as keyof LeadChecklistState] ||
                    false;
                  return (
                    <label
                      key={key}
                      onClick={() =>
                        toggleChecklistItem(
                          selectedLead.id,
                          key as keyof LeadChecklistState
                        )
                      }
                      className="flex items-center gap-2.5 cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Square className="w-4 h-4 text-muted-foreground/60" />
                      )}
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Ações do Modal */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              {selectedLead.maps_url ? (
                <a
                  href={selectedLead.maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir ficha oficial no Google Maps
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">
                  URL canônica não disponível
                </span>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedLead(null)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
