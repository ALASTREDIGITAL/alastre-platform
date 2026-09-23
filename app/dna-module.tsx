"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  BrainCircuit,
  Building2,
  Check,
  CheckCircle2,
  Database,
  ExternalLink,
  Eye,
  Fingerprint,
  HelpCircle,
  History,
  Kanban,
  Layers,
  ListChecks,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Swords,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DecisionState, IntegrationState } from "@/components/platform-state";
import {
  isArrayOf,
  isRecord,
  isRequestCancelled,
  isString,
  postPlatform,
} from "@/lib/platform-api";
import { isClientSummaryArray, type ClientSummary } from "./clients-module";
import { PageHeader } from "@/components/page-header";
import {
  calculateDnaCompleteness,
  buildMissingInfoChecklist,
  buildAiPromptPreview,
  getCriticalPendingFields,
  TONE_OF_VOICE_PRESETS,
  COPILOT_CONFIGS,
  parseCopilotSuggestions,
  type DnaBusinessData,
  type DnaLocalIntelligence,
  type DnaPaidMediaRules,
  type DnaGovernance,
  type DnaFaqItem,
  type CopilotType,
  type CopilotSuggestion,
  type CopilotMessage,
} from "@/lib/dna-domain";

function getCopilotStorageKey(clientId: string, type: CopilotType): string {
  return `alastre_dna_copilot_${clientId}_${type}`;
}

function loadSavedCopilotChat(clientId: string, type: CopilotType): CopilotMessage[] | null {
  if (typeof window === "undefined" || !clientId) return null;
  try {
    const raw = localStorage.getItem(getCopilotStorageKey(clientId, type));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Falha silenciosa em caso de JSON corrompido
  }
  return null;
}

function saveCopilotChat(clientId: string, type: CopilotType, messages: CopilotMessage[]): void {
  if (typeof window === "undefined" || !clientId) return;
  try {
    localStorage.setItem(getCopilotStorageKey(clientId, type), JSON.stringify(messages));
  } catch {
    // Falha silenciosa se cota do localStorage for excedida
  }
}

function clearCopilotChat(clientId: string, type: CopilotType): void {
  if (typeof window === "undefined" || !clientId) return;
  try {
    localStorage.removeItem(getCopilotStorageKey(clientId, type));
  } catch {
    // Falha silenciosa
  }
}

type TeamMember = {
  id: string;
  display_name: string | null;
  email: string;
  role: string;
};

type AuditItem = {
  id: string;
  action: string;
  payload: {
    version?: number;
    status?: string;
    updated_by?: string;
  };
  created_at: string;
};

type Workspace = {
  client: ClientSummary;
  dna: {
    status: string;
    version: number;
    business_data: Record<string, unknown>;
    local_intelligence: Record<string, unknown>;
    paid_media_rules: Record<string, unknown>;
  };
  sources: Array<{
    id: string;
    source_type: string;
    label: string;
    status: string;
    source_url: string | null;
  }>;
  team_members?: TeamMember[];
  audit_history?: AuditItem[];
};

const isSource = (value: unknown): value is Workspace["sources"][number] =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.source_type) &&
  isString(value.label) &&
  isString(value.status) &&
  (value.source_url === null || isString(value.source_url));

const isWorkspace = (value: unknown): value is Workspace =>
  isRecord(value) &&
  isRecord(value.client) &&
  isString(value.client.id) &&
  isString(value.client.name) &&
  isRecord(value.dna) &&
  isString(value.dna.status) &&
  typeof value.dna.version === "number" &&
  isRecord(value.dna.business_data) &&
  isRecord(value.dna.local_intelligence) &&
  isRecord(value.dna.paid_media_rules) &&
  isArrayOf(isSource)(value.sources);

type TabKey = "identity" | "services" | "voice" | "seo" | "competitors_faq" | "checklist" | "simulator" | "history";

type DiffRow = {
  key: string;
  label: string;
  currentValue: string;
  suggestedValue: string;
  selected: boolean;
  isList?: boolean;
  listItems?: string[];
};

export function DnaModule({
  clientId,
  onOpenAgent,
  onOpenClients,
  onOpenJourney,
}: {
  clientId: string;
  onOpenAgent: (id: string) => void;
  onOpenClients?: () => void;
  onOpenJourney?: (id: string) => void;
}) {
  const [data, setData] = useState<Workspace | null>(null);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [selected, setSelected] = useState(clientId);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorNotice, setErrorNotice] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("identity");
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Estados editáveis do DNA
  const [businessData, setBusinessData] = useState<DnaBusinessData>({});
  const [localIntelligence, setLocalIntelligence] = useState<DnaLocalIntelligence>({});
  const [paidMediaRules, setPaidMediaRules] = useState<DnaPaidMediaRules>({});
  const [dnaStatus, setDnaStatus] = useState<"confirmed" | "needs_review" | "draft">("draft");
  const [version, setVersion] = useState(1);
  const [governance, setGovernance] = useState<DnaGovernance>({});
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [auditHistory, setAuditHistory] = useState<AuditItem[]>([]);

  // Inputs temporários para tags e FAQ
  const [newService, setNewService] = useState("");
  const [newDifferentiator, setNewDifferentiator] = useState("");
  const [newForbiddenClaim, setNewForbiddenClaim] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newCompetitor, setNewCompetitor] = useState("");
  const [newFaqQuestion, setNewFaqQuestion] = useState("");
  const [newFaqAnswer, setNewFaqAnswer] = useState("");

  // Modal de Nova Análise com IA
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisInput, setAnalysisInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [diffRows, setDiffRows] = useState<DiffRow[]>([]);
  const [criticalModalOpen, setCriticalModalOpen] = useState(false);

  // Copilotos Especializados Embutidos
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotType, setCopilotType] = useState<CopilotType>("keywords");
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (copilotOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [copilotMessages, copilotOpen, copilotLoading]);

  // Item 1: Proteção contra perda de alterações ao fechar ou recarregar
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const loadClients = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setUnavailable(false);
    setData(null);
    try {
      const list = await postPlatform({ action: "clients" }, isClientSummaryArray, signal);
      if (signal?.aborted) return;
      setClients(list);
      setSelected((current) =>
        list.some((client) => client.id === current) ? current : list[0]?.id ?? ""
      );
      if (list.length === 0) setLoading(false);
    } catch (error) {
      if (isRequestCancelled(error)) return;
      setClients([]);
      setSelected("");
      setUnavailable(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadClients(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadClients]);

  useEffect(() => {
    if (!selected || !clients.some((client) => client.id === selected)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setData(null);
      void postPlatform({ action: "workspace", client_id: selected }, isWorkspace, controller.signal)
        .then((workspace) => {
          if (!controller.signal.aborted) {
            setData(workspace);
            setBusinessData(workspace.dna.business_data as DnaBusinessData);
            setLocalIntelligence(workspace.dna.local_intelligence as DnaLocalIntelligence);
            setPaidMediaRules(workspace.dna.paid_media_rules as DnaPaidMediaRules);
            setDnaStatus(
              (workspace.dna.status as "confirmed" | "needs_review" | "draft") || "draft"
            );
            setVersion(workspace.dna.version || 1);
            setGovernance(
              ((workspace.dna.business_data as DnaBusinessData)?.governance as DnaGovernance) || {}
            );
            setTeamMembers(workspace.team_members || []);
            setAuditHistory(workspace.audit_history || []);
            setIsDirty(false);
            setUnavailable(false);
          }
        })
        .catch((error) => {
          if (!isRequestCancelled(error)) {
            setData(null);
            setUnavailable(true);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [clients, selected]);

  // Item 1: Proteção ao trocar de cliente
  const handleSelectClient = (newId: string) => {
    if (isDirty) {
      const confirmLeave = window.confirm(
        "Você possui alterações não salvas no DNA deste cliente. Deseja realmente descartar e trocar de cliente?"
      );
      if (!confirmLeave) return;
    }
    setSelected(newId);
  };

  // Completude Real e Checklist
  const completeness = useMemo(
    () => calculateDnaCompleteness(businessData, localIntelligence, paidMediaRules),
    [businessData, localIntelligence, paidMediaRules]
  );

  const checklist = useMemo(
    () =>
      buildMissingInfoChecklist(
        completeness,
        Array.isArray(localIntelligence.missing_information)
          ? localIntelligence.missing_information
          : [],
        Array.isArray(localIntelligence.ignored_missing_items)
          ? localIntelligence.ignored_missing_items
          : []
      ),
    [completeness, localIntelligence.missing_information, localIntelligence.ignored_missing_items]
  );

  // Item 5: Pendências críticas que bloqueiam confirmação
  const criticalPending = useMemo(() => getCriticalPendingFields(businessData), [businessData]);

  const promptPreview = useMemo(
    () =>
      buildAiPromptPreview(
        data?.client.name || (businessData.name as string) || "",
        businessData,
        localIntelligence,
        paidMediaRules
      ),
    [data?.client.name, businessData, localIntelligence, paidMediaRules]
  );

  // Atualizadores genéricos com marcação de dirty
  const updateBusiness = (patch: Partial<DnaBusinessData>) => {
    setBusinessData((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  const updateLocal = (patch: Partial<DnaLocalIntelligence>) => {
    setLocalIntelligence((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  const updatePaidMedia = (patch: Partial<DnaPaidMediaRules>) => {
    setPaidMediaRules((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  const updateGov = (patch: Partial<DnaGovernance>) => {
    setGovernance((prev) => {
      const next = { ...prev, ...patch };
      setBusinessData((b) => ({ ...b, governance: next }));
      return next;
    });
    setIsDirty(true);
  };

  // Item 9: Ignorar / Reativar pendência no checklist
  const toggleIgnoreChecklistItem = (itemId: string) => {
    const current = Array.isArray(localIntelligence.ignored_missing_items)
      ? [...localIntelligence.ignored_missing_items]
      : [];
    const next = current.includes(itemId)
      ? current.filter((i) => i !== itemId)
      : [...current, itemId];
    updateLocal({ ignored_missing_items: next });
  };

  // Funções de tags
  const addService = () => {
    const s = newService.trim();
    if (!s) return;
    const current = Array.isArray(businessData.services) ? businessData.services : [];
    if (!current.includes(s)) updateBusiness({ services: [...current, s] });
    setNewService("");
  };

  const removeService = (serviceToRemove: string) => {
    const current = Array.isArray(businessData.services) ? businessData.services : [];
    updateBusiness({ services: current.filter((s) => s !== serviceToRemove) });
  };

  const addDifferentiator = () => {
    const d = newDifferentiator.trim();
    if (!d) return;
    const current = Array.isArray(businessData.differentiators) ? businessData.differentiators : [];
    if (!current.includes(d)) updateBusiness({ differentiators: [...current, d] });
    setNewDifferentiator("");
  };

  const removeDifferentiator = (dToRemove: string) => {
    const current = Array.isArray(businessData.differentiators) ? businessData.differentiators : [];
    updateBusiness({ differentiators: current.filter((d) => d !== dToRemove) });
  };

  const addForbiddenClaim = () => {
    const f = newForbiddenClaim.trim();
    if (!f) return;
    const current = Array.isArray(paidMediaRules.forbidden_claims)
      ? paidMediaRules.forbidden_claims
      : [];
    if (!current.includes(f)) updatePaidMedia({ forbidden_claims: [...current, f] });
    setNewForbiddenClaim("");
  };

  const removeForbiddenClaim = (fToRemove: string) => {
    const current = Array.isArray(paidMediaRules.forbidden_claims)
      ? paidMediaRules.forbidden_claims
      : [];
    updatePaidMedia({ forbidden_claims: current.filter((f) => f !== fToRemove) });
  };

  const addKeyword = () => {
    const k = newKeyword.trim().toLowerCase();
    if (!k) return;
    const current = Array.isArray(localIntelligence.keywords) ? localIntelligence.keywords : [];
    if (!current.includes(k)) updateLocal({ keywords: [...current, k] });
    setNewKeyword("");
  };

  const removeKeyword = (kToRemove: string) => {
    const current = Array.isArray(localIntelligence.keywords) ? localIntelligence.keywords : [];
    updateLocal({ keywords: current.filter((k) => k !== kToRemove) });
  };

  const addCompetitor = () => {
    const c = newCompetitor.trim();
    if (!c) return;
    const current = Array.isArray(localIntelligence.competitors) ? localIntelligence.competitors : [];
    if (!current.includes(c)) updateLocal({ competitors: [...current, c] });
    setNewCompetitor("");
  };

  const removeCompetitor = (cToRemove: string) => {
    const current = Array.isArray(localIntelligence.competitors) ? localIntelligence.competitors : [];
    updateLocal({ competitors: current.filter((c) => c !== cToRemove) });
  };

  const addFaq = () => {
    const q = newFaqQuestion.trim();
    const a = newFaqAnswer.trim();
    if (!q || !a) return;
    const current = Array.isArray(businessData.faq) ? businessData.faq : [];
    const item: DnaFaqItem = { id: crypto.randomUUID(), question: q, answer: a };
    updateBusiness({ faq: [...current, item] });
    setNewFaqQuestion("");
    setNewFaqAnswer("");
  };

  const removeFaq = (idToRemove: string) => {
    const current = Array.isArray(businessData.faq) ? businessData.faq : [];
    updateBusiness({ faq: current.filter((f) => f.id !== idToRemove) });
  };

  // Métodos do Copiloto Embutido
  const openCopilot = (type: CopilotType) => {
    setCopilotType(type);
    const config = COPILOT_CONFIGS[type];
    const clientName = (businessData.name as string) || data?.client.name || "seu cliente";

    // 1. Carrega histórico salvo previamente no localStorage
    const saved = selected ? loadSavedCopilotChat(selected, type) : null;
    if (saved && saved.length > 0) {
      setCopilotMessages(saved);
    } else {
      const welcome: CopilotMessage = {
        id: "welcome",
        role: "assistant",
        content: `Olá! Sou o **${config.title}** para **${clientName}**.\n\n${config.description}\n\nVocê pode me perguntar dúvidas específicas do seu mercado ou clicar em um dos prompts rápidos abaixo.`,
        timestamp: new Date().toISOString(),
        suggestions: [],
      };
      setCopilotMessages([welcome]);
      if (selected) saveCopilotChat(selected, type, [welcome]);
    }
    setCopilotOpen(true);
  };

  const handleResetCopilotChat = () => {
    if (!selected) return;
    clearCopilotChat(selected, copilotType);
    const config = COPILOT_CONFIGS[copilotType];
    const clientName = (businessData.name as string) || data?.client.name || "seu cliente";
    const welcomeMsg: CopilotMessage = {
      id: "welcome-" + Date.now(),
      role: "assistant",
      content: `Olá! Conversa reiniciada com o **${config.title}** para **${clientName}**.\n\n${config.description}\n\nComo posso ajudar você agora?`,
      timestamp: new Date().toISOString(),
      suggestions: [],
    };
    setCopilotMessages([welcomeMsg]);
    saveCopilotChat(selected, copilotType, [welcomeMsg]);
  };

  const sendCopilotMessage = async (overrideText?: string) => {
    const textToSend = (overrideText ?? copilotInput).trim();
    if (!textToSend || !selected || copilotLoading) return;

    const userMsg: CopilotMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    const updatedWithUser = [...copilotMessages, userMsg];
    setCopilotMessages(updatedWithUser);
    saveCopilotChat(selected, copilotType, updatedWithUser);
    setCopilotInput("");
    setCopilotLoading(true);

    // Preparar histórico multi-turn para a inteligência artificial lembrar das mensagens anteriores
    const historyPayload = copilotMessages
      .filter(
        (m) =>
          m.id !== "welcome" &&
          !m.content.startsWith("Olá! Sou o") &&
          !m.content.startsWith("Olá! Conversa reiniciada")
      )
      .slice(-6)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    try {
      const res = await postPlatform(
        {
          action: "dna_copilot_chat",
          client_id: selected,
          copilot_type: copilotType,
          message: textToSend,
          history: historyPayload,
          context: {
            client_name: (businessData.name as string) || data?.client.name || "",
            segment: (businessData.segment as string) || "",
            city: (businessData.city as string) || "",
            services: Array.isArray(businessData.services) ? businessData.services : [],
            primary_service: (businessData.primary_service as string) || "",
            competitors: Array.isArray(localIntelligence.competitors) ? localIntelligence.competitors : [],
            keywords: Array.isArray(localIntelligence.keywords) ? localIntelligence.keywords : [],
          },
        },
        isRecord
      );

      const rawContent = typeof res.content === "string" ? res.content : "";
      const { cleanText, suggestions } = parseCopilotSuggestions(rawContent, copilotType);

      const assistantMsg: CopilotMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: cleanText || rawContent,
        timestamp: new Date().toISOString(),
        suggestions,
        provider: (res.provider as any) || "local_rules",
      };

      const finalMessages = [...updatedWithUser, assistantMsg];
      setCopilotMessages(finalMessages);
      saveCopilotChat(selected, copilotType, finalMessages);
    } catch {
      const errorMsg: CopilotMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Desculpe, ocorreu uma instabilidade ao consultar o Copiloto. Por favor, tente novamente.",
        timestamp: new Date().toISOString(),
        suggestions: [],
      };
      const finalMessages = [...updatedWithUser, errorMsg];
      setCopilotMessages(finalMessages);
      saveCopilotChat(selected, copilotType, finalMessages);
    } finally {
      setCopilotLoading(false);
    }
  };

  const applyCopilotSuggestion = (sugg: CopilotSuggestion) => {
    if (sugg.type === "keyword") {
      const kw = sugg.value.trim().toLowerCase();
      const current = Array.isArray(localIntelligence.keywords) ? localIntelligence.keywords : [];
      if (!current.includes(kw)) {
        updateLocal({ keywords: [...current, kw] });
      }
    } else if (sugg.type === "competitor") {
      const comp = sugg.value.trim();
      const current = Array.isArray(localIntelligence.competitors) ? localIntelligence.competitors : [];
      if (!current.includes(comp)) {
        updateLocal({ competitors: [...current, comp] });
      }
    } else if (sugg.type === "service") {
      const serv = sugg.value.trim();
      const current = Array.isArray(businessData.services) ? businessData.services : [];
      if (!current.includes(serv)) {
        updateBusiness({ services: [...current, serv] });
      }
    }
    setAddedSuggestions((prev) => new Set([...prev, sugg.value]));
    setIsDirty(true);
  };

  // Salvar DNA no backend (Item 4: bloqueia se !isDirty e não for mudança de status)
  const handleSave = async (overrideStatus?: "confirmed" | "needs_review" | "draft") => {
    if (!selected) return;

    // Item 5: Se tentar confirmar com pendências críticas, bloqueia e avisa
    if (overrideStatus === "confirmed" && criticalPending.length > 0) {
      setCriticalModalOpen(true);
      return;
    }

    setSaving(true);
    setNotice("");
    setErrorNotice("");
    const targetStatus = overrideStatus || dnaStatus;

    try {
      const payload = {
        business_data: { ...businessData, governance },
        local_intelligence: localIntelligence,
        paid_media_rules: paidMediaRules,
        status: targetStatus,
        client_name: businessData.name || data?.client.name,
      };

      const res = await postPlatform(
        { action: "dna_save", client_id: selected, payload },
        isRecord
      );

      const newVer = typeof res.version === "number" ? res.version : version + 1;
      setVersion(newVer);
      setDnaStatus(targetStatus);
      setIsDirty(false);
      setNotice(`DNA salvo com sucesso! Versão v${newVer} registrada na trilha de auditoria.`);

      // Atualiza histórico local
      const newAudit: AuditItem = {
        id: crypto.randomUUID(),
        action: "client_dna_updated",
        payload: { version: newVer, status: targetStatus, updated_by: "Operador Atual" },
        created_at: new Date().toISOString(),
      };
      setAuditHistory((prev) => [newAudit, ...prev]);

      if (data) {
        setData({
          ...data,
          dna: {
            ...data.dna,
            version: newVer,
            status: targetStatus,
            business_data: payload.business_data,
            local_intelligence: payload.local_intelligence,
            paid_media_rules: payload.paid_media_rules,
          },
        });
      }
    } catch {
      setErrorNotice("Não foi possível salvar as alterações do DNA. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  // Item 2 & 3: Executar Nova Análise com Gemini e gerar diff campo por campo
  const runAiAnalysis = async () => {
    if (!analysisInput.trim()) return;
    setAnalyzing(true);
    setErrorNotice("");
    try {
      const result = await postPlatform(
        { action: "analyze_onboarding_ai", raw_profile: analysisInput },
        isRecord
      );

      const draft = (result.analysis || result.profile) as Record<string, any> | undefined;
      if (!draft || typeof draft !== "object") {
        setErrorNotice("A análise não encontrou dados estruturados suficientes no texto informado.");
        return;
      }

      // Constrói lista de diffs campo por campo
      const rows: DiffRow[] = [];
      const fieldDefs: Array<{ key: string; label: string; current: unknown; isList?: boolean }> = [
        { key: "name", label: "Nome da Empresa", current: businessData.name },
        { key: "segment", label: "Segmento / Ramo", current: businessData.segment },
        { key: "city", label: "Cidade Principal", current: businessData.city },
        { key: "address", label: "Endereço Comercial", current: businessData.address },
        { key: "phone", label: "Telefone", current: businessData.phone },
        { key: "whatsapp", label: "WhatsApp", current: businessData.whatsapp },
        { key: "website", label: "Site Oficial", current: businessData.website },
        { key: "instagram", label: "Instagram", current: businessData.instagram_url },
        { key: "primary_service", label: "Serviço Principal", current: businessData.primary_service },
        { key: "services", label: "Catálogo de Serviços", current: businessData.services, isList: true },
        { key: "differentiators", label: "Diferenciais", current: businessData.differentiators, isList: true },
        { key: "primary_keyword", label: "Palavra-chave Principal", current: localIntelligence.primary_keyword },
        { key: "keywords", label: "Palavras-chave Locais", current: localIntelligence.keywords, isList: true },
        { key: "competitors", label: "Concorrentes Detectados", current: localIntelligence.competitors, isList: true },
        { key: "hours", label: "Horários de Atendimento", current: businessData.hours },
        { key: "audience", label: "Público-Alvo", current: businessData.audience },
        { key: "description", label: "Descrição da Empresa", current: businessData.description },
      ];

      for (const def of fieldDefs) {
        const val = draft[def.key];
        if (val !== undefined && val !== null && val !== "") {
          const currentStr = Array.isArray(def.current)
            ? def.current.join(", ")
            : String(def.current ?? "—");

          const suggestedStr = Array.isArray(val) ? val.join(", ") : String(val);

          // Se for diferente ou se o atual for vazio, marca para seleção padrão
          const hasDiff = currentStr.trim() !== suggestedStr.trim();
          if (hasDiff && suggestedStr.trim()) {
            rows.push({
              key: def.key,
              label: def.label,
              currentValue: currentStr,
              suggestedValue: suggestedStr,
              selected: true,
              isList: def.isList,
              listItems: Array.isArray(val) ? val : undefined,
            });
          }
        }
      }

      setDiffRows(rows);
    } catch {
      setErrorNotice("Falha ao rodar a análise por IA. Verifique sua conexão e tente novamente.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Item 2 & 3: Aplicar campos selecionados do diff
  const applySelectedDiffs = () => {
    const selectedDiffs = diffRows.filter((r) => r.selected);
    if (selectedDiffs.length === 0) return;

    const patchBusiness: Partial<DnaBusinessData> = {};
    const patchLocal: Partial<DnaLocalIntelligence> = {};

    for (const diff of selectedDiffs) {
      if (diff.key === "name") patchBusiness.name = diff.suggestedValue;
      else if (diff.key === "segment") patchBusiness.segment = diff.suggestedValue;
      else if (diff.key === "city") patchBusiness.city = diff.suggestedValue;
      else if (diff.key === "address") patchBusiness.address = diff.suggestedValue;
      else if (diff.key === "phone") patchBusiness.phone = diff.suggestedValue;
      else if (diff.key === "whatsapp") patchBusiness.whatsapp = diff.suggestedValue;
      else if (diff.key === "website") patchBusiness.website = diff.suggestedValue;
      else if (diff.key === "instagram") patchBusiness.instagram_url = diff.suggestedValue;
      else if (diff.key === "hours") patchBusiness.hours = diff.suggestedValue;
      else if (diff.key === "audience") patchBusiness.audience = diff.suggestedValue;
      else if (diff.key === "description") patchBusiness.description = diff.suggestedValue;
      else if (diff.key === "primary_service") patchBusiness.primary_service = diff.suggestedValue;
      else if (diff.key === "services" && diff.listItems) {
        const existing = Array.isArray(businessData.services) ? businessData.services : [];
        patchBusiness.services = Array.from(new Set([...existing, ...diff.listItems]));
      } else if (diff.key === "differentiators" && diff.listItems) {
        const existing = Array.isArray(businessData.differentiators) ? businessData.differentiators : [];
        patchBusiness.differentiators = Array.from(new Set([...existing, ...diff.listItems]));
      } else if (diff.key === "primary_keyword") patchLocal.primary_keyword = diff.suggestedValue;
      else if (diff.key === "keywords" && diff.listItems) {
        const existing = Array.isArray(localIntelligence.keywords) ? localIntelligence.keywords : [];
        patchLocal.keywords = Array.from(new Set([...existing, ...diff.listItems]));
      } else if (diff.key === "competitors" && diff.listItems) {
        const existing = Array.isArray(localIntelligence.competitors) ? localIntelligence.competitors : [];
        patchLocal.competitors = Array.from(new Set([...existing, ...diff.listItems]));
      }
    }

    updateBusiness(patchBusiness);
    updateLocal(patchLocal);
    setAnalysisOpen(false);
    setDiffRows([]);
    setAnalysisInput("");
    setNotice(`${selectedDiffs.length} campo(s) aplicados ao DNA com sucesso! Revise e clique em Salvar Alterações.`);
  };

  const selectedClientObj = clients.find((c) => c.id === selected);

  return (
    <div className="dna-page">
      {/* Top Header & Client Selector */}
      <div className="dna-top-bar">
        <PageHeader
          eyebrow={
            <>
              <Fingerprint /> CENTRO DE INTELIGÊNCIA & DNA
            </>
          }
          title="DNA do Cliente & Diretrizes de IA"
          description="A base de verdade inegociável da empresa. Todas as IAs, anúncios e postagens consultam essas regras."
          helpKey="clients.overview"
        />

        <div className="dna-top-actions">
          <div className="client-selector-box">
            <label htmlFor="dna-client-select" className="selector-label">
              <Users /> Cliente Ativo
            </label>
            <select
              id="dna-client-select"
              className="dna-select-input"
              value={selected}
              onChange={(e) => handleSelectClient(e.target.value)}
              disabled={clients.length === 0}
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
            onClick={() => {
              setDiffRows([]);
              setAnalysisOpen(true);
            }}
            title="Extrair fatos via IA a partir de texto bruto ou site"
          >
            <Sparkles /> Nova Análise IA
          </Button>

          {onOpenJourney && (
            <Button
              variant="outline"
              onClick={() => onOpenJourney(selected)}
              title="Abrir esteira operacional de 30 dias"
            >
              <Kanban /> Plano 30 Dias
            </Button>
          )}

          {/* Item 4: Desabilita se !isDirty */}
          <Button
            className="btn-confirm-dna"
            onClick={() => void handleSave()}
            disabled={saving || !isDirty || !selected}
            title={!isDirty ? "Nenhuma alteração pendente de salvamento" : "Salvar alterações no banco"}
          >
            <Save /> {saving ? "Salvando..." : isDirty ? "Salvar Alterações *" : "Salvo"}
          </Button>
        </div>
      </div>

      {/* Item 8: Governança Operacional com Usuários da Equipe */}
      {selected && (
        <div className="dna-governance-strip">
          <div className="dna-gov-item">
            <label>Responsável na Equipe</label>
            {teamMembers.length > 0 ? (
              <select
                className="dna-select-input"
                style={{ height: "38px", fontSize: "0.875rem" }}
                value={governance.responsible || ""}
                onChange={(e) => updateGov({ responsible: e.target.value })}
              >
                <option value="">Selecione um membro...</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.display_name || m.email}>
                    {m.display_name ? `${m.display_name} (${m.role})` : m.email}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                placeholder="Ex.: Rodrigo / Gestor SEO"
                value={governance.responsible || ""}
                onChange={(e) => updateGov({ responsible: e.target.value })}
              />
            )}
          </div>
          <div className="dna-gov-item">
            <label>Prazo da Próxima Revisão</label>
            <Input
              type="date"
              value={governance.target_date || ""}
              onChange={(e) => updateGov({ target_date: e.target.value })}
            />
          </div>
          <div className="dna-gov-item" style={{ gridColumn: "span 2" }}>
            <label>Próxima Ação Planejada</label>
            <Input
              placeholder="Ex.: Validar novas fotos e cadastrar 5 postagens estratégicas"
              value={governance.next_action || ""}
              onChange={(e) => updateGov({ next_action: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Feedback de Notificação */}
      {notice && (
        <div className="dna-safeguard-banner" style={{ borderColor: "var(--success)", background: "color-mix(in srgb, var(--success) 8%, var(--surface-1))" }}>
          <CheckCircle2 style={{ color: "var(--success)" }} />
          <p><strong>Sucesso:</strong> {notice}</p>
        </div>
      )}
      {errorNotice && (
        <div className="dna-safeguard-banner" style={{ borderColor: "var(--destructive)", background: "color-mix(in srgb, var(--destructive) 8%, var(--surface-1))" }}>
          <AlertTriangle style={{ color: "var(--destructive)" }} />
          <p><strong>Atenção:</strong> {errorNotice}</p>
        </div>
      )}

      {unavailable ? (
        <IntegrationState
          compact
          title="Memória temporariamente indisponível"
          message="Não foi possível carregar os clientes e suas memórias agora. Nenhuma informação foi alterada."
          onRetry={() => void loadClients()}
        />
      ) : loading ? (
        <DecisionState
          title="Carregando centro de inteligência"
          message="Reunindo os fatos confirmados, histórico, tom de voz e guardrails deste cliente."
        />
      ) : clients.length === 0 ? (
        <DecisionState
          icon={Fingerprint}
          title="Adicione o primeiro cliente para construir sua memória."
          message="O DNA nasce das informações do cliente e acompanha todas as decisões dos agentes."
          actionLabel={onOpenClients ? "Adicionar cliente" : undefined}
          onAction={onOpenClients}
        />
      ) : !data ? (
        <DecisionState
          icon={Fingerprint}
          title="Escolha um cliente para ver seu DNA."
          message="Selecione um cliente válido para carregar fatos, fontes e regras."
          actionLabel={onOpenClients ? "Selecionar cliente" : undefined}
          onAction={onOpenClients}
        />
      ) : (
        <>
          {/* Safeguard Banner quando não confirmado */}
          {dnaStatus !== "confirmed" && (
            <div className="dna-safeguard-banner">
              <ShieldAlert />
              <p>
                <strong>Modo de Revisão / Homologação Ativo:</strong> Este DNA está marcado como{" "}
                <em>{dnaStatus === "needs_review" ? "Revisão Solicitada" : "Rascunho"}</em>. Os
                agentes de IA operarão com travas de validação e ressalvas até a confirmação oficial.
              </p>
              <Button
                size="sm"
                className="btn-confirm-dna"
                onClick={() => void handleSave("confirmed")}
                disabled={saving}
              >
                <Check /> Confirmar Agora
              </Button>
            </div>
          )}

          {/* Hero com Indicador de Completude Real */}
          <section className="dna-hero">
            <div className="dna-hero-left">
              <div className="dna-status-row">
                <Badge
                  variant="outline"
                  className={
                    dnaStatus === "confirmed"
                      ? "status-confirmed-badge"
                      : "status-review-badge"
                  }
                >
                  <CheckCircle2 />{" "}
                  {dnaStatus === "confirmed"
                    ? "DNA Confirmado Oficialmente"
                    : dnaStatus === "needs_review"
                    ? "Revisão Solicitada"
                    : "Rascunho Inicial"}
                </Badge>
                <span className="dna-version-tag">
                  <Layers /> Versão v{version} · Trilha Segura
                </span>
                {isDirty && (
                  <Badge variant="outline" style={{ borderColor: "var(--warning)", color: "var(--warning)" }}>
                    Alterações não salvas *
                  </Badge>
                )}
              </div>
              <h2>{businessData.name || selectedClientObj?.name}</h2>
              <p>
                {businessData.segment ? `${businessData.segment} · ` : ""}
                {businessData.city || "Cidade não informada"}. Regras que orientam os geradores de
                conteúdo, respostas do Google Maps e anúncios.
              </p>
            </div>

            <div className="dna-score-wrap">
              <div className="dna-score-metric">
                <strong>{completeness.percentage}%</strong>
                <span>
                  {completeness.filledCount} de {completeness.totalCount} critérios preenchidos
                </span>
              </div>
              <div
                className="dna-score-bar"
                role="progressbar"
                aria-valuenow={completeness.percentage}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${completeness.percentage}%` }} />
              </div>
              {completeness.percentage < 100 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab("checklist")}
                  style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                >
                  Ver pendências ({completeness.totalCount - completeness.filledCount})
                </Button>
              )}
            </div>
          </section>

          {/* Abas do Editor Operacional */}
          <div className="dna-tabs">
            <button
              type="button"
              className={`dna-tab-btn ${activeTab === "identity" ? "active" : ""}`}
              onClick={() => setActiveTab("identity")}
            >
              <Building2 /> Fatos & Contato
            </button>
            <button
              type="button"
              className={`dna-tab-btn ${activeTab === "services" ? "active" : ""}`}
              onClick={() => setActiveTab("services")}
            >
              <Database /> Serviços & Diferenciais
            </button>
            <button
              type="button"
              className={`dna-tab-btn ${activeTab === "voice" ? "active" : ""}`}
              onClick={() => setActiveTab("voice")}
            >
              <Sparkles /> Tom de Voz & Guardrails
            </button>
            <button
              type="button"
              className={`dna-tab-btn ${activeTab === "seo" ? "active" : ""}`}
              onClick={() => setActiveTab("seo")}
            >
              <MapPin /> SEO & Palavras-chave
            </button>
            <button
              type="button"
              className={`dna-tab-btn ${activeTab === "competitors_faq" ? "active" : ""}`}
              onClick={() => setActiveTab("competitors_faq")}
            >
              <Swords /> Concorrentes & FAQ ({((businessData.faq?.length || 0) + (localIntelligence.competitors?.length || 0))})
            </button>
            <button
              type="button"
              className={`dna-tab-btn ${activeTab === "checklist" ? "active" : ""}`}
              onClick={() => setActiveTab("checklist")}
            >
              <ListChecks /> Checklist ({checklist.filter((c) => !c.completed).length})
            </button>
            <button
              type="button"
              className={`dna-tab-btn ${activeTab === "simulator" ? "active" : ""}`}
              onClick={() => setActiveTab("simulator")}
            >
              <Bot /> Simulador da IA
            </button>
            <button
              type="button"
              className={`dna-tab-btn ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              <History /> Histórico de Versões ({auditHistory.length})
            </button>
          </div>

          {/* Aba 1: Fatos & Contato */}
          {activeTab === "identity" && (
            <article className="panel dna-editor-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">IDENTIDADE OPERACIONAL</span>
                  <h2>Dados Cadastrais e Presença Física</h2>
                </div>
                <Badge variant="outline">Informações de Contato e NAP</Badge>
              </div>

              <div className="dna-form-grid">
                <div className="dna-form-field">
                  <label>Nome Comercial / Fantasia *</label>
                  <Input
                    value={businessData.name || ""}
                    onChange={(e) => updateBusiness({ name: e.target.value })}
                    placeholder="Nome da empresa"
                  />
                </div>
                <div className="dna-form-field">
                  <label>Segmento / Categoria Principal *</label>
                  <Input
                    value={businessData.segment || ""}
                    onChange={(e) => updateBusiness({ segment: e.target.value })}
                    placeholder="Ex.: Odontologia, Oficina Mecânica"
                  />
                </div>
                <div className="dna-form-field">
                  <label>Cidade Principal *</label>
                  <Input
                    value={businessData.city || ""}
                    onChange={(e) => updateBusiness({ city: e.target.value })}
                    placeholder="Ex.: Santo André"
                  />
                </div>
                <div className="dna-form-field">
                  <label>Estado / UF</label>
                  <Input
                    value={businessData.state || ""}
                    onChange={(e) => updateBusiness({ state: e.target.value })}
                    placeholder="Ex.: SP"
                  />
                </div>
                <div className="dna-form-field">
                  <label>Bairro</label>
                  <Input
                    value={businessData.neighborhood || ""}
                    onChange={(e) => updateBusiness({ neighborhood: e.target.value })}
                    placeholder="Ex.: Jardim das Flores"
                  />
                </div>
                <div className="dna-form-field">
                  <label>Endereço Completo</label>
                  <Input
                    value={businessData.address || ""}
                    onChange={(e) => updateBusiness({ address: e.target.value })}
                    placeholder="Rua, número, complemento"
                  />
                </div>
                <div className="dna-form-field">
                  <label>WhatsApp de Atendimento *</label>
                  <Input
                    value={businessData.whatsapp || ""}
                    onChange={(e) => updateBusiness({ whatsapp: e.target.value })}
                    placeholder="Ex.: 11988887777"
                  />
                </div>
                <div className="dna-form-field">
                  <label>Telefone Fixo / Comercial</label>
                  <Input
                    value={businessData.phone || ""}
                    onChange={(e) => updateBusiness({ phone: e.target.value })}
                    placeholder="Ex.: 1140028922"
                  />
                </div>
                <div className="dna-form-field">
                  <label>Site Oficial</label>
                  <Input
                    value={businessData.website || ""}
                    onChange={(e) => updateBusiness({ website: e.target.value })}
                    placeholder="https://empresa.com.br"
                  />
                </div>
                <div className="dna-form-field">
                  <label>Instagram</label>
                  <Input
                    value={businessData.instagram_url || ""}
                    onChange={(e) => updateBusiness({ instagram_url: e.target.value })}
                    placeholder="https://instagram.com/perfil"
                  />
                </div>
                <div className="dna-form-field">
                  <label>Horário de Funcionamento</label>
                  <Input
                    value={businessData.hours || ""}
                    onChange={(e) => updateBusiness({ hours: e.target.value })}
                    placeholder="Ex.: Seg a Sex 08h às 18h · Sáb 08h às 12h"
                  />
                </div>
                <div className="dna-form-field">
                  <label>Data de Abertura / Fundação</label>
                  <Input
                    value={businessData.opening_date || ""}
                    onChange={(e) => updateBusiness({ opening_date: e.target.value })}
                    placeholder="Ex.: 2018"
                  />
                </div>
              </div>
            </article>
          )}

          {/* Aba 2: Serviços & Diferenciais */}
          {activeTab === "services" && (
            <article className="panel dna-editor-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">OFERTA DE VALOR</span>
                  <h2>Serviços Ofertados e Diferenciais</h2>
                </div>
                <Badge variant="outline">Geração de Conteúdo e SEO</Badge>
              </div>

              <div className="dna-form-grid">
                <div className="dna-form-field full-width">
                  <label>Serviço Principal de Tração (Carro-chefe) *</label>
                  <Input
                    value={businessData.primary_service || ""}
                    onChange={(e) => updateBusiness({ primary_service: e.target.value })}
                    placeholder="Ex.: Implante Dentário / Alinhamento 3D / Lavagem a Seco"
                  />
                  <small>Este é o serviço mais citado nas chamadas para ação automáticas da IA.</small>
                </div>

                <div className="dna-form-field full-width dna-tags-wrapper">
                  <label>Catálogo de Serviços Oferecidos</label>
                  <div className="dna-tags-container">
                    {(Array.isArray(businessData.services) ? businessData.services : []).map((s) => (
                      <span className="dna-tag-pill" key={s}>
                        {s}
                        <button type="button" onClick={() => removeService(s)} title="Remover">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="dna-add-tag-row">
                    <Input
                      value={newService}
                      onChange={(e) => setNewService(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addService();
                        }
                      }}
                      placeholder="Adicionar serviço (ex: Clareamento a Laser)..."
                    />
                    <Button type="button" variant="outline" onClick={addService}>
                      <Plus size={16} /> Adicionar
                    </Button>
                  </div>
                </div>

                <div className="dna-form-field full-width dna-tags-wrapper">
                  <label>Diferenciais Competitivos</label>
                  <div className="dna-tags-container">
                    {(Array.isArray(businessData.differentiators) ? businessData.differentiators : []).map((d) => (
                      <span className="dna-tag-pill" key={d}>
                        {d}
                        <button type="button" onClick={() => removeDifferentiator(d)} title="Remover">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="dna-add-tag-row">
                    <Input
                      value={newDifferentiator}
                      onChange={(e) => setNewDifferentiator(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addDifferentiator();
                        }
                      }}
                      placeholder="Adicionar diferencial (ex: Estacionamento gratuito, 15 anos no mercado)..."
                    />
                    <Button type="button" variant="outline" onClick={addDifferentiator}>
                      <Plus size={16} /> Adicionar
                    </Button>
                  </div>
                </div>

                <div className="dna-form-field full-width">
                  <label>Público-Alvo e Perfil de Cliente Ideal</label>
                  <Textarea
                    value={businessData.audience || ""}
                    onChange={(e) => updateBusiness({ audience: e.target.value })}
                    placeholder="Ex.: Famílias de classe média, profissionais liberais que buscam atendimento rápido..."
                    rows={3}
                  />
                </div>

                <div className="dna-form-field full-width">
                  <label>Apresentação da Empresa / Descrição Institucional</label>
                  <Textarea
                    value={businessData.description || ""}
                    onChange={(e) => updateBusiness({ description: e.target.value })}
                    placeholder="Resumo otimizado sobre a história, missão e atuação da empresa..."
                    rows={4}
                  />
                </div>
              </div>
            </article>
          )}

          {/* Aba 3: Tom de Voz & Guardrails */}
          {activeTab === "voice" && (
            <article className="panel dna-editor-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">GOVERNANÇA DE CONTEÚDO</span>
                  <h2>Personalidade da IA & Guardrails Inegociáveis</h2>
                </div>
                <Badge variant="outline">Proteção Anti-Alucinação</Badge>
              </div>

              {/* Banner CTA do Copiloto de Tom de Voz */}
              <div className="dna-copilot-cta">
                <div className="dna-copilot-cta-left">
                  <div className="dna-copilot-cta-icon">
                    <Sparkles />
                  </div>
                  <div className="dna-copilot-cta-info">
                    <strong>Consultor de Tom de Voz & Diretrizes da Marca</strong>
                    <p>
                      Calibre a personalidade da IA, limites editoriais e tom de comunicação ideais para seu público.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => openCopilot("voice")}
                  style={{ background: "var(--brand)", color: "#fff", display: "inline-flex", gap: "8px", alignItems: "center" }}
                >
                  <Sparkles size={16} /> Consultar Tom de Voz
                </Button>
              </div>

              <div>
                <label style={{ fontSize: "0.875rem", fontWeight: 700, marginBottom: "8px", display: "block" }}>
                  Presets de Tom de Voz
                </label>
                <div className="dna-presets-grid">
                  {TONE_OF_VOICE_PRESETS.map((preset) => {
                    const isSelected =
                      businessData.tone_of_voice === preset.name ||
                      (preset.id === "personalizado" &&
                        businessData.tone_of_voice &&
                        !TONE_OF_VOICE_PRESETS.some(
                          (p) => p.id !== "personalizado" && p.name === businessData.tone_of_voice
                        ));

                    return (
                      <div
                        key={preset.id}
                        className={`dna-preset-card ${isSelected ? "selected" : ""}`}
                        onClick={() => updateBusiness({ tone_of_voice: preset.name })}
                      >
                        <strong>{preset.name}</strong>
                        <span>{preset.description}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="dna-form-field full-width" style={{ marginTop: "16px" }}>
                  <label>Instrução de Personalidade / Tom de Voz Customizado</label>
                  <Input
                    value={businessData.tone_of_voice || ""}
                    onChange={(e) => updateBusiness({ tone_of_voice: e.target.value })}
                    placeholder="Descreva o tom de voz da marca..."
                  />
                </div>
              </div>

              <div className="dna-form-grid" style={{ marginTop: "16px" }}>
                <div className="dna-form-field full-width">
                  <label>Diretrizes Editoriais (O que a IA DEVE fazer)</label>
                  <Textarea
                    value={businessData.editorial_instructions || ""}
                    onChange={(e) => updateBusiness({ editorial_instructions: e.target.value })}
                    placeholder="Ex.: Sempre convidar para falar pelo WhatsApp; destacar condições de parcelamento sem juros; usar emojis moderados..."
                    rows={3}
                  />
                  <small>Instruções positivas aplicadas aos briefings dos agentes.</small>
                </div>

                <div className="dna-form-field full-width dna-tags-wrapper">
                  <label style={{ color: "var(--destructive)" }}>
                    Guardrails Estritos (O que a IA NUNCA pode falar ou prometer)
                  </label>
                  <div className="dna-tags-container">
                    {(Array.isArray(paidMediaRules.forbidden_claims)
                      ? paidMediaRules.forbidden_claims
                      : []
                    ).map((f) => (
                      <span
                        className="dna-tag-pill"
                        key={f}
                        style={{ borderColor: "color-mix(in srgb, var(--destructive) 40%, var(--line))" }}
                      >
                        <ShieldAlert size={14} style={{ color: "var(--destructive)" }} />
                        {f}
                        <button type="button" onClick={() => removeForbiddenClaim(f)} title="Remover">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="dna-add-tag-row">
                    <Input
                      value={newForbiddenClaim}
                      onChange={(e) => setNewForbiddenClaim(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addForbiddenClaim();
                        }
                      }}
                      placeholder="Adicionar proibição (ex: Nunca divulgar tabela de preços em posts públicos)..."
                    />
                    <Button type="button" variant="outline" onClick={addForbiddenClaim}>
                      <Plus size={16} /> Bloquear Termo
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          )}

          {/* Aba 4: SEO & Palavras-chave */}
          {activeTab === "seo" && (
            <article className="panel dna-editor-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">RANKING LOCAL & MAPS</span>
                  <h2>Palavras-Chave e Diagnóstico Local</h2>
                </div>
                <Badge variant="outline">Visibilidade no Local Pack</Badge>
              </div>

              {/* Banner CTA do Copiloto de SEO */}
              <div className="dna-copilot-cta">
                <div className="dna-copilot-cta-left">
                  <div className="dna-copilot-cta-icon">
                    <Bot />
                  </div>
                  <div className="dna-copilot-cta-info">
                    <strong>Copiloto de Palavras-Chave & SEO Local</strong>
                    <p>
                      Converse com a IA especialista para descobrir termos de alta conversão para{" "}
                      {businessData.city ? `a região de ${businessData.city}` : "este cliente"}.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => openCopilot("keywords")}
                  style={{ background: "var(--brand)", color: "#fff", display: "inline-flex", gap: "8px", alignItems: "center" }}
                >
                  <Sparkles size={16} /> Abrir Copiloto de SEO
                </Button>
              </div>

              <div className="dna-form-grid">
                <div className="dna-form-field full-width">
                  <label>Palavra-chave Principal do Negócio</label>
                  <Input
                    value={localIntelligence.primary_keyword || ""}
                    onChange={(e) => updateLocal({ primary_keyword: e.target.value })}
                    placeholder="Ex.: dentista em santo andre / oficina mecanica sao bernardo"
                  />
                  <small>Termo de maior volume que ancora o título de postagens e ficha GBP.</small>
                </div>

                <div className="dna-form-field full-width dna-tags-wrapper">
                  <label>Palavras-Chave Secundárias e Termos Locais</label>
                  <div className="dna-tags-container">
                    {(Array.isArray(localIntelligence.keywords) ? localIntelligence.keywords : []).map((k) => (
                      <span className="dna-tag-pill" key={k}>
                        {k}
                        <button type="button" onClick={() => removeKeyword(k)} title="Remover">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="dna-add-tag-row">
                    <Input
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addKeyword();
                        }
                      }}
                      placeholder="Adicionar palavra-chave (ex: implante dentario preco abc)..."
                    />
                    <Button type="button" variant="outline" onClick={addKeyword}>
                      <Plus size={16} /> Adicionar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Diagnóstico Inicial do Onboarding */}
              {localIntelligence.diagnosis && (
                <div className="seo-diagnosis" style={{ marginTop: "20px" }}>
                  <div className="diagnosis-score">
                    <Sparkles />
                    <strong>{localIntelligence.diagnosis.score ?? "—"}%</strong>
                    <span>Score Inicial</span>
                    <small>{localIntelligence.diagnosis.method || "Cálculo heurístico"}</small>
                  </div>
                  <article>
                    <span className="section-kicker">PONTOS FORTES CONFIRMADOS</span>
                    <ul>
                      {localIntelligence.diagnosis.strengths?.map((item) => (
                        <li key={item}>
                          <CheckCircle2 />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                  <article>
                    <span className="section-kicker">PRIORIDADES RECOMENDADAS</span>
                    <ol>
                      {localIntelligence.diagnosis.priorities?.map((item, index) => (
                        <li key={item}>
                          <b>{index + 1}</b>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ol>
                  </article>
                </div>
              )}
            </article>
          )}

          {/* Item 10: Aba 5: Concorrentes & FAQ */}
          {activeTab === "competitors_faq" && (
            <article className="panel dna-editor-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">INTELIGÊNCIA COMPETITIVA & RESPOSTAS</span>
                  <h2>Concorrentes Diretos & Perguntas Frequentes (FAQ)</h2>
                </div>
                <Badge variant="outline">Enriquecimento de Prompts</Badge>
              </div>

              {/* Banner CTA do Copiloto de Concorrência */}
              <div className="dna-copilot-cta">
                <div className="dna-copilot-cta-left">
                  <div className="dna-copilot-cta-icon">
                    <Swords />
                  </div>
                  <div className="dna-copilot-cta-info">
                    <strong>Copiloto de Inteligência Competitiva</strong>
                    <p>
                      Mapeie quem disputa o Google Maps e os anúncios da região com trava estrita de contexto.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => openCopilot("competitors")}
                  style={{ background: "var(--brand)", color: "#fff", display: "inline-flex", gap: "8px", alignItems: "center" }}
                >
                  <Sparkles size={16} /> Abrir Copiloto de Concorrentes
                </Button>
              </div>

              {/* Concorrentes */}
              <div className="dna-tags-wrapper">
                <label style={{ fontSize: "0.875rem", fontWeight: 700 }}>
                  Concorrentes Diretos Monitorados
                </label>
                <div className="dna-tags-container">
                  {(Array.isArray(localIntelligence.competitors) ? localIntelligence.competitors : []).map((c) => (
                    <span className="dna-tag-pill" key={c}>
                      <Swords size={14} style={{ color: "var(--brand)" }} />
                      {c}
                      <button type="button" onClick={() => removeCompetitor(c)} title="Remover">
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="dna-add-tag-row">
                  <Input
                    value={newCompetitor}
                    onChange={(e) => setNewCompetitor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCompetitor();
                      }
                    }}
                    placeholder="Adicionar concorrente (ex: Clínica Dental Prime)..."
                  />
                  <Button type="button" variant="outline" onClick={addCompetitor}>
                    <Plus size={16} /> Adicionar Concorrente
                  </Button>
                </div>
              </div>

              {/* FAQ */}
              <div style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "0.875rem", fontWeight: 700, display: "block" }}>
                      Perguntas e Respostas Frequentes (FAQ)
                    </label>
                    <p style={{ fontSize: "0.8125rem", color: "var(--content-muted)", margin: "2px 0 0" }}>
                      A IA consulta estas respostas para responder avaliações e dúvidas com precisão cirúrgica.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openCopilot("faq")}
                    style={{ display: "inline-flex", gap: "6px", alignItems: "center", borderColor: "color-mix(in srgb, var(--brand) 40%, var(--line))", color: "var(--brand)" }}
                  >
                    <Sparkles size={14} /> Sugerir FAQ com IA
                  </Button>
                </div>

                <div className="dna-faq-list">
                  {(Array.isArray(businessData.faq) ? businessData.faq : []).map((faq) => (
                    <div key={faq.id} className="dna-faq-card">
                      <div className="dna-faq-header">
                        <strong>Q: {faq.question}</strong>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFaq(faq.id)}
                          title="Remover FAQ"
                          style={{ color: "var(--destructive)" }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                      <p><strong>R:</strong> {faq.answer}</p>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px", border: "1px dashed var(--line)", borderRadius: "14px", background: "var(--surface-2)" }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--content-secondary)" }}>
                    Adicionar Nova Pergunta e Resposta
                  </span>
                  <Input
                    placeholder="Pergunta (ex: Vocês atendem convênio X?)..."
                    value={newFaqQuestion}
                    onChange={(e) => setNewFaqQuestion(e.target.value)}
                  />
                  <Textarea
                    placeholder="Resposta oficial (ex: Não atendemos diretamente o convênio X, mas fornecemos recibo para reembolso integral)..."
                    value={newFaqAnswer}
                    onChange={(e) => setNewFaqAnswer(e.target.value)}
                    rows={2}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addFaq}
                    disabled={!newFaqQuestion.trim() || !newFaqAnswer.trim()}
                    style={{ alignSelf: "flex-end" }}
                  >
                    <Plus size={16} /> Adicionar FAQ
                  </Button>
                </div>
              </div>
            </article>
          )}

          {/* Item 9: Aba 6: Checklist de Pendências */}
          {activeTab === "checklist" && (
            <article className="panel dna-editor-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">AUDITORIA DE DADOS</span>
                  <h2>Checklist Operacional de Completude</h2>
                </div>
                <Badge variant="outline">
                  {completeness.filledCount} de {completeness.totalCount} atendidos
                </Badge>
              </div>

              <div className="dna-checklist-box">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className={`dna-checklist-item ${item.completed ? "done" : ""}`}
                    style={item.ignored ? { opacity: 0.6, borderColor: "var(--line)" } : {}}
                  >
                    <div className="dna-checklist-item-left">
                      {item.completed ? (
                        <CheckCircle2 style={{ color: "var(--success)" }} size={20} />
                      ) : (
                        <AlertTriangle style={{ color: "var(--warning)" }} size={20} />
                      )}
                      <span>
                        {item.label}
                        {item.ignored && (
                          <Badge variant="outline" style={{ marginLeft: "8px", fontSize: "0.7rem" }}>
                            Ignorado / Não se aplica
                          </Badge>
                        )}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {!item.completed && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (item.section === "identity") setActiveTab("identity");
                            else if (item.section === "services") setActiveTab("services");
                            else if (item.section === "voice") setActiveTab("voice");
                            else if (item.section === "seo") setActiveTab("seo");
                          }}
                        >
                          Preencher
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleIgnoreChecklistItem(item.id)}
                        title={item.ignored ? "Reativar verificação" : "Marcar como não aplicável"}
                        style={{ fontSize: "0.75rem" }}
                      >
                        {item.ignored ? "Reativar" : "Ignorar"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )}

          {/* Aba 7: Simulador da IA */}
          {activeTab === "simulator" && (
            <article className="panel dna-editor-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">TRANSPARÊNCIA E CONFIANÇA</span>
                  <h2>Como a Inteligência Artificial Enxerga este Cliente</h2>
                </div>
                <Badge variant="outline">Contexto Real Injetado em Prompts</Badge>
              </div>

              <p style={{ color: "var(--content-secondary)", fontSize: "0.9375rem" }}>
                Toda vez que você solicita ao agente de SEO Local que redija uma postagem ou
                responda uma avaliação, o backend compila os dados do DNA neste briefing:
              </p>

              <div className="dna-preview-terminal">
                <h4>// RESUMO OPERACIONAL COMPILADO</h4>
                <p style={{ color: "#38bdf8", marginBottom: "12px" }}>{promptPreview.summary}</p>

                <h4>// REGRAS ATIVAS NO PROMPT DO AGENTE</h4>
                <ul style={{ margin: "0 0 16px", paddingLeft: "20px" }}>
                  {promptPreview.rules.map((r, i) => (
                    <li key={i} style={{ color: "#e2e8f0", marginBottom: "4px" }}>
                      {r}
                    </li>
                  ))}
                </ul>

                <h4>// OBJETO DE CONTEXTO ALLOWLISTED (JSON)</h4>
                <pre>{JSON.stringify(promptPreview.contextJson, null, 2)}</pre>
              </div>
            </article>
          )}

          {/* Item 7: Aba 8: Histórico Real de Versões */}
          {activeTab === "history" && (
            <article className="panel dna-editor-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">GOVERNANÇA & AUDITORIA</span>
                  <h2>Linha do Tempo de Alterações do DNA</h2>
                </div>
                <Badge variant="outline">Registro Imutável em Banco</Badge>
              </div>

              {auditHistory.length === 0 ? (
                <p style={{ color: "var(--content-muted)", padding: "20px 0" }}>
                  Nenhum evento anterior registrado. O histórico será gravado a cada salvamento do DNA.
                </p>
              ) : (
                <div className="dna-timeline">
                  {auditHistory.map((item) => (
                    <div key={item.id} className="dna-timeline-item">
                      <div className="dna-timeline-left">
                        <span className="dna-timeline-version">
                          v{item.payload.version ?? "1"}
                        </span>
                        <div className="dna-timeline-info">
                          <strong>
                            {item.action === "client_dna_updated"
                              ? "DNA Atualizado e Persistido"
                              : item.action === "client_dna_confirmed"
                              ? "DNA Homologado e Confirmado"
                              : item.action}
                          </strong>
                          <span>
                            Por: {item.payload.updated_by || "Operador da Agência"} · Status:{" "}
                            {item.payload.status === "confirmed"
                              ? "Confirmado"
                              : "Em Revisão"}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" style={{ fontSize: "0.75rem" }}>
                        {new Date(item.created_at).toLocaleString("pt-BR")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </article>
          )}

          {/* Barra de Rodapé com Decisão e Status */}
          <section className="dna-decision">
            <div className="dna-decision-info">
              <ShieldCheck className="decision-shield-icon" />
              <div>
                <strong>Revisão Humana do DNA Operacional</strong>
                <p>
                  Confirme a integridade dos dados para autorizar os agentes a planejarem e
                  responderem com base nestes fatos.
                </p>
              </div>
            </div>

            <div className="dna-decision-actions">
              {notice && <span className="dna-notice">{notice}</span>}

              {dnaStatus === "confirmed" ? (
                <Button
                  variant="outline"
                  onClick={() => void handleSave("needs_review")}
                  disabled={saving}
                >
                  <RotateCcw /> Solicitar Revisão
                </Button>
              ) : (
                <Button
                  className="btn-confirm-dna"
                  onClick={() => void handleSave("confirmed")}
                  disabled={saving}
                  title={
                    criticalPending.length > 0
                      ? `Faltam dados críticos: ${criticalPending.join(", ")}`
                      : "Homologar DNA oficialmente"
                  }
                >
                  <CheckCircle2 /> Confirmar DNA Oficial
                </Button>
              )}

              {/* Item 4: Desabilita se !isDirty */}
              <Button
                variant="outline"
                onClick={() => void handleSave()}
                disabled={saving || !isDirty}
              >
                <Save /> {saving ? "Salvando..." : isDirty ? "Salvar Rascunho *" : "Rascunho Salvo"}
              </Button>

              <Button variant="outline" onClick={() => onOpenAgent(selected)}>
                <BrainCircuit /> Conversar com Agente
              </Button>
            </div>
          </section>
        </>
      )}

      {/* Item 2 & 3: Modal de Nova Análise com Gemini e Revisão Campo a Campo */}
      {analysisOpen && (
        <div className="dna-analysis-modal-overlay">
          <div className="dna-analysis-modal">
            <div className="dna-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Sparkles style={{ color: "var(--brand)" }} />
                <strong style={{ fontSize: "1.1rem" }}>Análise de Fatos com IA (Gemini)</strong>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setAnalysisOpen(false)}>
                <X size={18} />
              </Button>
            </div>

            <div className="dna-modal-body">
              {diffRows.length === 0 ? (
                <>
                  <p style={{ fontSize: "0.9rem", color: "var(--content-secondary)" }}>
                    Cole informações sobre a empresa (perfil do Google, site, apresentação ou WhatsApp).
                    O Gemini extrairá os fatos estruturados e você poderá escolher exatamente quais
                    campos deseja aceitar antes de mesclar.
                  </p>
                  <Textarea
                    placeholder="Cole aqui o texto ou dados do cliente para análise..."
                    value={analysisInput}
                    onChange={(e) => setAnalysisInput(e.target.value)}
                    rows={8}
                    disabled={analyzing}
                  />
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div className="dna-diff-actions-row">
                    <div>
                      <Badge variant="outline" style={{ borderColor: "var(--success)", color: "var(--success)" }}>
                        {diffRows.length} campo(s) identificado(s)
                      </Badge>
                      <span style={{ fontSize: "0.8125rem", color: "var(--content-secondary)", marginLeft: "10px" }}>
                        Marque os campos que deseja aplicar ao DNA:
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDiffRows((prev) => prev.map((r) => ({ ...r, selected: true })))}
                      >
                        Marcar Todos
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDiffRows((prev) => prev.map((r) => ({ ...r, selected: false })))}
                      >
                        Desmarcar Todos
                      </Button>
                    </div>
                  </div>

                  {/* Lista de Comparação Campo a Campo */}
                  <div className="dna-diff-list">
                    {diffRows.map((row, index) => (
                      <div
                        key={row.key}
                        className={`dna-diff-item ${row.selected ? "selected" : ""}`}
                        onClick={() =>
                          setDiffRows((prev) =>
                            prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r))
                          )
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => {}} // tratado no onClick do container
                        />
                        <span className="dna-diff-label">{row.label}</span>
                        <span className="dna-diff-current">{row.currentValue}</span>
                        <span className="dna-diff-arrow">➔</span>
                        <span className="dna-diff-suggested">{row.suggestedValue}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="dna-modal-footer">
              <Button variant="outline" onClick={() => setAnalysisOpen(false)}>
                Cancelar
              </Button>

              {diffRows.length === 0 ? (
                <Button
                  onClick={runAiAnalysis}
                  disabled={analyzing || !analysisInput.trim()}
                  className="btn-confirm-dna"
                >
                  {analyzing ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} /> Analisando com Gemini...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Executar Análise
                    </>
                  )}
                </Button>
              ) : (
                <div style={{ display: "flex", gap: "10px" }}>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDiffRows((prev) => prev.map((r) => ({ ...r, selected: true })));
                      setTimeout(applySelectedDiffs, 50);
                    }}
                  >
                    Aceitar Todos
                  </Button>
                  <Button
                    className="btn-confirm-dna"
                    onClick={applySelectedDiffs}
                    disabled={diffRows.filter((r) => r.selected).length === 0}
                  >
                    <Check size={16} /> Aplicar Selecionados ({diffRows.filter((r) => r.selected).length})
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Item 5: Modal de Aviso de Pendências Críticas */}
      {criticalModalOpen && (
        <div className="dna-analysis-modal-overlay">
          <div className="dna-analysis-modal" style={{ maxWidth: "520px" }}>
            <div className="dna-modal-header" style={{ borderColor: "color-mix(in srgb, var(--warning) 35%, var(--line))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <AlertCircle style={{ color: "var(--warning)" }} />
                <strong style={{ fontSize: "1.1rem" }}>Pendências Críticas Identificadas</strong>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCriticalModalOpen(false)}>
                <X size={18} />
              </Button>
            </div>

            <div className="dna-modal-body">
              <p style={{ fontSize: "0.9rem", color: "var(--content-secondary)", lineHeight: 1.5 }}>
                O DNA não pode ser <strong>confirmado oficialmente</strong> enquanto os seguintes dados vitais
                estiverem ausentes:
              </p>

              <ul style={{ display: "flex", flexDirection: "column", gap: "8px", paddingLeft: "20px" }}>
                {criticalPending.map((p) => (
                  <li key={p} style={{ fontWeight: 600, color: "var(--content-primary)" }}>
                    {p}
                  </li>
                ))}
              </ul>

              <p style={{ fontSize: "0.85rem", color: "var(--content-muted)", margin: "8px 0 0" }}>
                Você pode continuar preenchendo os dados agora ou salvar as alterações como <strong>Rascunho</strong>{" "}
                enquanto obtém essas informações com o cliente.
              </p>
            </div>

            <div className="dna-modal-footer" style={{ justifyContent: "flex-end" }}>
              <Button variant="outline" onClick={() => setCriticalModalOpen(false)}>
                Voltar e Preencher
              </Button>
              <Button
                onClick={() => {
                  setCriticalModalOpen(false);
                  void handleSave("draft");
                }}
              >
                Salvar como Rascunho
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Gaveta do Copiloto Especializado Embutido */}
      {copilotOpen && (
        <div className="dna-copilot-drawer-overlay" onClick={() => setCopilotOpen(false)}>
          <div className="dna-copilot-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="dna-copilot-drawer-header">
              <div className="dna-copilot-header-info">
                <strong>{COPILOT_CONFIGS[copilotType].title}</strong>
                <span className="dna-copilot-scope-badge">
                  <ShieldAlert size={13} /> {COPILOT_CONFIGS[copilotType].scopeNotice}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetCopilotChat}
                  title="Iniciar nova conversa (limpa histórico deste copiloto)"
                  style={{ gap: "5px", fontSize: "0.8rem", color: "var(--content-secondary)" }}
                >
                  <RotateCcw size={14} />
                  <span>Nova conversa</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCopilotOpen(false)} title="Fechar">
                  <X size={18} />
                </Button>
              </div>
            </div>

            <div className="dna-copilot-messages">
              {copilotMessages.map((msg) => (
                <div key={msg.id} className={`dna-copilot-msg ${msg.role}`}>
                  <div className="dna-copilot-bubble">
                    {msg.content}
                    {msg.role === "assistant" && msg.provider && (
                      <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Badge
                          variant="secondary"
                          style={{
                            fontSize: "0.68rem",
                            padding: "1px 6px",
                            opacity: 0.85,
                            background:
                              msg.provider === "gemini"
                                ? "rgba(168, 85, 247, 0.15)"
                                : msg.provider === "openai"
                                ? "rgba(59, 130, 246, 0.15)"
                                : "rgba(234, 179, 8, 0.15)",
                            color:
                              msg.provider === "gemini"
                                ? "#c084fc"
                                : msg.provider === "openai"
                                ? "#60a5fa"
                                : "#eab308",
                          }}
                        >
                          {msg.provider === "gemini"
                            ? "✨ Google Gemini IA"
                            : msg.provider === "openai"
                            ? "✨ OpenAI GPT"
                            : "⚙️ Regras de SEO Local"}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {msg.role === "assistant" && msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="dna-copilot-suggestions-box">
                      <span className="dna-copilot-suggestions-title">
                        Clique para adicionar ao DNA com 1 clique:
                      </span>
                      <div className="dna-copilot-suggestions-list">
                        {msg.suggestions.map((sugg) => {
                          const isAdded =
                            addedSuggestions.has(sugg.value) ||
                            (sugg.type === "keyword" &&
                              (Array.isArray(localIntelligence.keywords)
                                ? localIntelligence.keywords
                                : []
                              ).includes(sugg.value.toLowerCase())) ||
                            (sugg.type === "competitor" &&
                              (Array.isArray(localIntelligence.competitors)
                                ? localIntelligence.competitors
                                : []
                              ).includes(sugg.value)) ||
                            (sugg.type === "service" &&
                              (Array.isArray(businessData.services)
                                ? businessData.services
                                : []
                              ).includes(sugg.value));

                          return (
                            <button
                              key={sugg.value}
                              type="button"
                              disabled={isAdded}
                              onClick={() => applyCopilotSuggestion(sugg)}
                              className={`dna-suggestion-chip ${isAdded ? "added" : ""}`}
                              title={isAdded ? "Já está no DNA" : "Adicionar ao DNA"}
                            >
                              {isAdded ? <Check size={13} /> : <Plus size={13} />}
                              <span>{sugg.value}</span>
                              {isAdded && (
                                <small style={{ fontSize: "0.65rem", opacity: 0.8 }}>(Adicionado)</small>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {copilotLoading && (
                <div className="dna-copilot-msg assistant">
                  <div className="dna-copilot-bubble" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <RefreshCw className="spin" size={16} />
                    <span>Consultando dados e gerando recomendações...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="dna-copilot-quick-prompts">
              {COPILOT_CONFIGS[copilotType].quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="dna-quick-prompt-btn"
                  disabled={copilotLoading}
                  onClick={() => void sendCopilotMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="dna-copilot-input-bar">
              <Input
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendCopilotMessage();
                  }
                }}
                placeholder={`Pergunte ao Copiloto sobre ${
                  copilotType === "competitors" ? "concorrentes locais..." : "palavras-chave..."
                }`}
                disabled={copilotLoading}
              />
              <Button
                type="button"
                disabled={copilotLoading || !copilotInput.trim()}
                onClick={() => void sendCopilotMessage()}
                style={{ background: "var(--brand)", color: "#fff", minWidth: "90px" }}
              >
                {copilotLoading ? <RefreshCw className="spin" size={16} /> : <Send size={16} />}
                <span>{copilotLoading ? "..." : "Enviar"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
