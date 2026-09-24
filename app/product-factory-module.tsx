"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  FileCheck,
  FileSpreadsheet,
  ListChecks,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { Progress } from "@/components/ui/progress";
import {
  callProductFactoryApi,
  type ProductWorkspaceData,
} from "@/lib/product-factory-api";
import {
  classifyInformation,
  calculateScopeTotals,
  preventPrematurePricing,
  STANDARD_SEO_LOCAL_DISCOVERY_ROUNDS,
  type ProductDefinition,
  type DiscoveryAnswer,
  type ViabilityCheckpoint,
  type InformationClassification,
} from "@/lib/product-factory-domain";
import type { View } from "./app-shell";

interface ProductFactoryModuleProps {
  onNavigate?: (view: View) => void;
}

export function ProductFactoryModule({ onNavigate }: ProductFactoryModuleProps) {
  const [products, setProducts] = useState<ProductDefinition[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<ProductWorkspaceData | null>(null);
  const [activeTab, setActiveTab] = useState<string>("discovery");
  const [activeRound, setActiveRound] = useState<number>(1);
  const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Estado local para respostas da rodada atual
  const [answersMap, setAnswersMap] = useState<Record<string, {
    text: string;
    classification: InformationClassification;
    is_blocking_gap: boolean;
    gap_notes: string;
  }>>({});

  // 1. Carrega lista de produtos
  const loadProducts = useCallback(async (selectId?: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await callProductFactoryApi<{ products: ProductDefinition[] }>({
        action: "list_products",
      });
      setProducts(res.products || []);
      if (res.products && res.products.length > 0) {
        const toSelect = selectId || selectedProductId || res.products[0].id;
        setSelectedProductId(toSelect);
      } else {
        setSelectedProductId(null);
        setWorkspace(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Não foi possível carregar a lista de produtos.");
    } finally {
      setLoading(false);
    }
  }, [selectedProductId]);

  // 2. Carrega workspace do produto selecionado
  const loadWorkspace = useCallback(async (productId: string) => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const ws = await callProductFactoryApi<ProductWorkspaceData>({
        action: "get_product",
        product_id: productId,
      });
      setWorkspace(ws);

      // Preenche respostas da rodada ativa
      const session = ws.sessions.find((s) => s.round_number === activeRound);
      if (session) {
        const initialAnswers: typeof answersMap = {};
        for (const a of session.answers) {
          initialAnswers[a.question_id] = {
            text: a.answer_text,
            classification: a.classification,
            is_blocking_gap: a.is_blocking_gap,
            gap_notes: a.gap_notes || "",
          };
        }
        setAnswersMap(initialAnswers);
      } else {
        setAnswersMap({});
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao carregar detalhes do produto.");
    } finally {
      setActionLoading(false);
    }
  }, [activeRound]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (selectedProductId) {
      loadWorkspace(selectedProductId);
    }
  }, [selectedProductId, loadWorkspace]);

  // Criar Produto Padrão a partir do modelo oficial de SEO Local
  const handleCreateDefaultProduct = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callProductFactoryApi<{ ok: boolean; product: ProductDefinition }>({
        action: "create_product",
        name: "SEO Local e Google Business Profile",
        slug: "seo-local-gbp",
        summary: "Serviço contínuo de gestão, otimização, postagens e avaliações no Perfil da Empresa no Google.",
        target_objective: "Atrair clientes qualificados no raio de busca local com evidências auditadas.",
        target_market: "Pequenos e médios negócios com atendimento físico local ou prestação de serviços regional.",
        icp_description: "Ticket médio acima de R$ 250, equipe de atendimento apta a responder contatos em tempo hábil.",
        anti_icp_description: "E-commerce sem presença física ou operações ilegais/proibidas pelas diretrizes do Google.",
        transformational_promise: "Posicionar a empresa com relevância máxima controlável e reputação protegida.",
        controllable_deliverables: [
          "Auditoria técnica completa de 18 pontos",
          "Otimização de categorias, horários e atributos",
          "4 postagens mensais com fotos reais",
          "Respostas a 100% das novas avaliações em até 24h úteis",
        ],
        influenciable_indicators: [
          "Visualizações da ficha no Google Maps e Busca",
          "Cliques para ligação e solicitações de rota",
        ],
        external_results: [
          "Faturamento financeiro do cliente",
          "Volume final de vendas no balcão",
        ],
      });

      if (res.product) {
        setFeedbackSuccess("Produto oficial criado com sucesso! Inicialize a entrevista de descoberta.");
        await loadProducts(res.product.id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao inicializar produto.");
    } finally {
      setActionLoading(false);
    }
  };

  // Salvar Rodada de Descoberta
  const handleSaveRound = async () => {
    if (!workspace) return;
    setActionLoading(true);
    setErrorMessage(null);
    setFeedbackSuccess(null);

    const roundDef = STANDARD_SEO_LOCAL_DISCOVERY_ROUNDS.find((r) => r.round === activeRound) ||
      STANDARD_SEO_LOCAL_DISCOVERY_ROUNDS[0];

    const answersPayload: DiscoveryAnswer[] = roundDef.questions.map((q) => {
      const cur = answersMap[q.id];
      const answerText = cur?.text || "";
      const isGap = cur?.is_blocking_gap || cur?.classification === "gap" || !answerText.trim();
      return {
        question_id: q.id,
        answer_text: answerText,
        classification: cur?.classification || (isGap ? "gap" : classifyInformation(answerText)),
        confidence: isGap ? "none" : "high",
        is_blocking_gap: isGap,
        gap_notes: cur?.gap_notes || (isGap ? "Dado pendente de confirmação com a operação" : undefined),
        answered_at: new Date().toISOString(),
      };
    });

    try {
      await callProductFactoryApi({
        action: "save_discovery_round",
        product_id: workspace.product.id,
        round_number: activeRound,
        status: "completed",
        questions: roundDef.questions,
        answers: answersPayload,
      });

      setFeedbackSuccess(`Rodada ${activeRound} salva com sucesso!`);
      await loadWorkspace(workspace.product.id);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar rodada de descoberta.");
    } finally {
      setActionLoading(false);
    }
  };

  // Calcular Viabilidade
  const handleCalculateViability = async () => {
    if (!workspace) return;
    setActionLoading(true);
    setErrorMessage(null);
    setFeedbackSuccess(null);

    try {
      const res = await callProductFactoryApi<{ ok: boolean; viability: ViabilityCheckpoint }>({
        action: "calculate_viability",
        product_id: workspace.product.id,
      });
      setWorkspace((prev) => (prev ? { ...prev, viability: res.viability } : null));
      setFeedbackSuccess("Checkpoint de viabilidade recalculado com evidências atuais.");
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao calcular viabilidade.");
    } finally {
      setActionLoading(false);
    }
  };

  // Submeter para Aprovação Humana
  const handleSubmitReview = async () => {
    if (!workspace) return;
    setActionLoading(true);
    setErrorMessage(null);
    setFeedbackSuccess(null);

    try {
      const res = await callProductFactoryApi<{ ok: boolean; product: ProductDefinition; viability: ViabilityCheckpoint }>({
        action: "submit_for_review",
        product_id: workspace.product.id,
        submission_note: "Submetido pela interface operacional da Fábrica de Produtos.",
      });
      setWorkspace((prev) => (prev ? { ...prev, product: res.product, viability: res.viability } : null));
      setFeedbackSuccess("Versão do produto submetida para aprovação humana na Central de Aprovações!");
    } catch (err: any) {
      setErrorMessage(err.message || "Não foi possível submeter o produto para aprovação.");
    } finally {
      setActionLoading(false);
    }
  };

  // Criar Nova Versão
  const handleCreateNewVersion = async () => {
    if (!workspace) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await callProductFactoryApi<{ ok: boolean; product: ProductDefinition }>({
        action: "create_new_version",
        product_id: workspace.product.id,
      });
      if (res.product) {
        setFeedbackSuccess(`Nova versão v${res.product.version} criada em modo rascunho.`);
        await loadProducts(res.product.id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao criar nova versão do produto.");
    } finally {
      setActionLoading(false);
    }
  };

  // Totais de Escopo Calculados
  const scopeTotals = workspace ? calculateScopeTotals(workspace.scopeItems) : null;
  const pricingGuard = workspace && workspace.viability
    ? preventPrematurePricing(workspace.product, workspace.viability)
    : null;

  return (
    <div className="module-container space-y-6">
      <PageHeader
        eyebrow="Módulo 01 · Fábrica de Produtos"
        title="Fábrica de Produtos"
        description="Estruture conhecimento operacional, separe implantação de recorrência, documente SOPs e valide a viabilidade antes de gerar preço, plano ou promessa."
        helpKey="product_factory.overview"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdvancedMode(!isAdvancedMode)}
              className="text-xs"
            >
              {isAdvancedMode ? "Modo Simples (Padrão)" : "Modo Avançado"}
            </Button>
            {workspace?.product.status === "approved" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateNewVersion}
                disabled={actionLoading}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Criar Nova Versão (v{workspace.product.version + 1})
              </Button>
            )}
          </div>
        }
      />

      {/* Alertas de Feedback */}
      {errorMessage && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Atenção:</strong> {errorMessage}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setErrorMessage(null)}>✕</Button>
        </div>
      )}

      {feedbackSuccess && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Sucesso:</strong> {feedbackSuccess}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setFeedbackSuccess(null)}>✕</Button>
        </div>
      )}

      {/* Estado Vazio: Nenhum Produto Cadastrado */}
      {!loading && products.length === 0 && (
        <Card className="p-8 text-center border-dashed">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
            <Briefcase className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Nenhum produto cadastrado na agência</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
            A Fábrica de Produtos permite transformar a capacidade da Alastre Digital em serviços recorrentes padronizados e economicamente viáveis.
          </p>
          <Button onClick={handleCreateDefaultProduct} disabled={actionLoading} className="h-11 px-6">
            <Sparkles className="h-4 w-4 mr-2" />
            Inicializar Produto Oficial: SEO Local & GBP
          </Button>
        </Card>
      )}

      {/* Seleção de Produto e Resumo do Ciclo de Vida */}
      {products.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="p-4 lg:col-span-1 border-muted/60 space-y-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Produto em Edição
            </label>
            <select
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              value={selectedProductId || ""}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedProductId(id);
              }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (v{p.version}) · {p.status.toUpperCase()}
                </option>
              ))}
            </select>

            {workspace && (
              <div className="pt-3 border-t border-border/50 space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between items-center">
                  <span>Versão atual:</span>
                  <Badge variant="outline" className="font-mono">v{workspace.product.version}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Status do ciclo:</span>
                  <Badge
                    variant={
                      workspace.product.status === "approved"
                        ? "default"
                        : workspace.product.status === "in_review"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {workspace.product.status === "draft" && "Rascunho"}
                    {workspace.product.status === "in_review" && "Em Revisão"}
                    {workspace.product.status === "approved" && "Aprovado (Imutável)"}
                    {workspace.product.status === "superseded" && "Substituído"}
                    {workspace.product.status === "archived" && "Arquivado"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Imutabilidade:</span>
                  <span>{workspace.product.is_immutable ? "Sim (Protegido)" : "Não (Editável)"}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Cards Rápidos de Diagnóstico da Decisão */}
          {workspace && (
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Card 1: Descoberta e Lacunas */}
              <Card className="p-4 border-muted/60 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Completude da Descoberta
                  </span>
                  <div className="text-2xl font-bold mb-1">
                    {workspace.viability?.discovery_completeness_percentage ?? 0}%
                  </div>
                  <Progress
                    value={workspace.viability?.discovery_completeness_percentage ?? 0}
                    className="h-2 mb-2"
                  />
                </div>
                <div className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>Lacunas impeditivas:</span>
                  <strong className={workspace.viability && workspace.viability.blocking_gaps.length > 0 ? "text-amber-400 font-semibold" : "text-emerald-400"}>
                    {workspace.viability?.blocking_gaps.length ?? 0} aberta(s)
                  </strong>
                </div>
              </Card>

              {/* Card 2: Esforço Estimado */}
              <Card className="p-4 border-muted/60 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Dimensão de Tempo
                  </span>
                  <div className="text-2xl font-bold mb-1">
                    {scopeTotals?.totalSetupHours ?? 0}h <span className="text-sm font-normal text-muted-foreground">setup</span>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">
                    {scopeTotals?.monthlyRecurringHours ?? 0}h / mês <span className="text-xs">(recorrência)</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>Atividades cadastradas:</span>
                  <strong>{scopeTotals?.itemsCount ?? 0}</strong>
                </div>
              </Card>

              {/* Card 3: Checkpoint de Viabilidade */}
              <Card className="p-4 border-muted/60 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Resultado da Viabilidade
                  </span>
                  <div className="flex items-center gap-2 mb-2">
                    {workspace.viability?.result === "ready_for_human_review" && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                        Pronto para Revisão
                      </Badge>
                    )}
                    {workspace.viability?.result === "ready_for_estimation" && (
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs">
                        Pronto para Estimativa
                      </Badge>
                    )}
                    {(!workspace.viability || workspace.viability?.result === "blocked") && (
                      <Badge variant="destructive" className="text-xs">
                        Bloqueado
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {workspace.viability?.explanation || "Aguardando cálculo do primeiro checkpoint."}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground pt-2 border-t border-border/40 flex items-center justify-between">
                  <span>Score de Viabilidade:</span>
                  <strong className="font-mono">{workspace.viability?.viability_score ?? 0} / 100</strong>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Conteúdo Principal por Abas de Domínio */}
      {workspace && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/40 p-1 border border-border/40 rounded-lg">
            <TabsTrigger value="discovery" className="gap-2 text-xs sm:text-sm">
              <ListChecks className="h-4 w-4" />
              1. Entrevista de Descoberta
            </TabsTrigger>
            <TabsTrigger value="scope" className="gap-2 text-xs sm:text-sm">
              <FileSpreadsheet className="h-4 w-4" />
              2. Matriz de Escopo
            </TabsTrigger>
            <TabsTrigger value="sops_raci" className="gap-2 text-xs sm:text-sm">
              <Users className="h-4 w-4" />
              3. SOPs e RACI
            </TabsTrigger>
            <TabsTrigger value="viability" className="gap-2 text-xs sm:text-sm">
              <ShieldCheck className="h-4 w-4" />
              4. Checkpoint de Viabilidade
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: ENTREVISTA PROGRESSIVA */}
          <TabsContent value="discovery" className="space-y-4">
            <Card className="p-6 border-muted/60 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-primary" />
                    Entrevista Operacional Progressiva (Máximo 7 Perguntas)
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Entreviste a operação passo a passo. Fatos e evidências habilitam a viabilidade; lacunas são registradas explicitamente.
                  </p>
                </div>

                {/* Seletor de Rodadas */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground mr-1">Rodada:</span>
                  {STANDARD_SEO_LOCAL_DISCOVERY_ROUNDS.map((r) => (
                    <Button
                      key={r.round}
                      variant={activeRound === r.round ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveRound(r.round)}
                      className="text-xs"
                    >
                      Rodada {r.round}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Lista de Perguntas da Rodada (Garantia de Máximo 7) */}
              {(() => {
                const currentRound = STANDARD_SEO_LOCAL_DISCOVERY_ROUNDS.find((r) => r.round === activeRound) ||
                  STANDARD_SEO_LOCAL_DISCOVERY_ROUNDS[0];

                return (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-md border border-border/40">
                      <span><strong>{currentRound.title}</strong></span>
                      <span>Total de {currentRound.questions.length} perguntas (limite seguro: ≤ 7)</span>
                    </div>

                    <div className="space-y-5">
                      {currentRound.questions.map((q, idx) => {
                        const cur = answersMap[q.id] || {
                          text: "",
                          classification: "fact",
                          is_blocking_gap: false,
                          gap_notes: "",
                        };

                        return (
                          <div
                            key={q.id}
                            className={`p-4 rounded-lg border transition-colors ${
                              cur.is_blocking_gap
                                ? "border-amber-500/40 bg-amber-500/5"
                                : cur.text.trim()
                                ? "border-border/80 bg-card"
                                : "border-border/40 bg-muted/10"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div>
                                <span className="text-xs font-mono text-primary font-semibold mr-2">
                                  #{idx + 1}
                                </span>
                                <strong className="text-sm">{q.question_text}</strong>
                                <p className="text-xs text-muted-foreground mt-0.5">{q.explanation}</p>
                              </div>
                              <Badge variant={q.is_required ? "secondary" : "outline"} className="text-[10px]">
                                {q.is_required ? "Obrigatória" : "Opcional"}
                              </Badge>
                            </div>

                            {/* Resposta */}
                            <div className="space-y-2 mt-3">
                              <Textarea
                                placeholder="Registre aqui a resposta da operação com fatos e evidências reais..."
                                value={cur.text}
                                onChange={(e) => {
                                  const text = e.target.value;
                                  setAnswersMap((prev) => ({
                                    ...prev,
                                    [q.id]: {
                                      ...prev[q.id],
                                      text,
                                      classification: prev[q.id]?.classification || classifyInformation(text),
                                    },
                                  }));
                                }}
                                rows={2}
                                className="text-sm"
                              />

                              {/* Barra de Classificação da Informação */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Classificação:</span>
                                  <select
                                    className="bg-background border border-input rounded px-2 py-1 text-xs"
                                    value={cur.classification}
                                    onChange={(e) => {
                                      const classification = e.target.value as InformationClassification;
                                      const isGap = classification === "gap";
                                      setAnswersMap((prev) => ({
                                        ...prev,
                                        [q.id]: {
                                          ...prev[q.id],
                                          classification,
                                          is_blocking_gap: isGap,
                                        },
                                      }));
                                    }}
                                  >
                                    <option value="fact">Fato (Declarado)</option>
                                    <option value="evidence">Evidência (Comprovada)</option>
                                    <option value="inference">Inferência (Dedução lógica)</option>
                                    <option value="hypothesis">Hipótese (Suposição)</option>
                                    <option value="gap">Lacuna (Informação ausente)</option>
                                  </select>
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={cur.is_blocking_gap}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setAnswersMap((prev) => ({
                                        ...prev,
                                        [q.id]: {
                                          ...prev[q.id],
                                          is_blocking_gap: checked,
                                          classification: checked ? "gap" : prev[q.id]?.classification || "fact",
                                        },
                                      }));
                                    }}
                                    className="rounded border-input text-amber-500 focus:ring-amber-500"
                                  />
                                  <span className="text-amber-400 font-medium">Marcar como Lacuna Impeditiva</span>
                                </label>
                              </div>

                              {cur.is_blocking_gap && (
                                <Input
                                  placeholder="Explique o que precisa ser obtido para sanar esta lacuna..."
                                  value={cur.gap_notes}
                                  onChange={(e) => {
                                    const gap_notes = e.target.value;
                                    setAnswersMap((prev) => ({
                                      ...prev,
                                      [q.id]: { ...prev[q.id], gap_notes },
                                    }));
                                  }}
                                  className="text-xs bg-amber-500/10 border-amber-500/30 text-amber-200 mt-2"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                      <Button
                        onClick={handleSaveRound}
                        disabled={actionLoading || workspace.product.is_immutable}
                        className="h-10 px-5"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Salvar e Concluir Rodada {activeRound}
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </Card>
          </TabsContent>

          {/* ABA 2: MATRIZ DE ESCOPO */}
          <TabsContent value="scope" className="space-y-4">
            <Card className="p-6 border-muted/60 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    Matriz de Escopo Operacional
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Separação clara entre Implantação (Setup) e Recorrência Mensal com evidências exigidas e critérios de aceite.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">
                    {scopeTotals?.automatablePercentage ?? 0}% Automatizável
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {scopeTotals?.totalSetupHours ?? 0}h Setup · {scopeTotals?.monthlyRecurringHours ?? 0}h/mês Recorrência
                  </Badge>
                </div>
              </div>

              {/* Tabela ou Lista de Atividades de Escopo */}
              <div className="space-y-6">
                {/* 1. Implantação (Setup) */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Atividades de Implantação (Setup Único)
                    </h4>
                  </div>

                  {workspace.scopeItems.filter((i) => i.delivery_type === "setup").length === 0 ? (
                    <div className="p-4 rounded-lg border border-dashed text-xs text-muted-foreground text-center">
                      Nenhuma atividade de implantação cadastrada.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {workspace.scopeItems
                        .filter((i) => i.delivery_type === "setup")
                        .map((item) => (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-lg border border-border/60 bg-card hover:border-primary/40 transition-colors text-sm flex flex-col md:flex-row justify-between gap-4"
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <strong>{item.activity_name}</strong>
                                <Badge variant="outline" className="text-[10px]">
                                  {item.scope_classification === "included" && "Incluído"}
                                  {item.scope_classification === "not_included" && "Não Incluído"}
                                  {item.scope_classification === "optional" && "Opcional"}
                                  {item.scope_classification === "upsell" && "Upsell"}
                                </Badge>
                                {item.is_automatable && (
                                  <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                                    Automatizável
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
                                <span>Aceite: <strong>{item.acceptance_criteria || "Não especificado"}</strong></span>
                                <span>Evidência: <strong>{item.required_evidence || "Não especificada"}</strong></span>
                              </div>
                            </div>

                            <div className="flex md:flex-col justify-between items-end gap-1 text-right shrink-0">
                              <span className="font-mono text-sm font-semibold">{item.estimated_minutes} min</span>
                              <span className="text-xs text-muted-foreground">Papel: {item.default_role}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* 2. Recorrência Mensal */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <RotateCcw className="h-4 w-4 text-blue-400" />
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Atividades de Recorrência Mensal
                    </h4>
                  </div>

                  {workspace.scopeItems.filter((i) => i.delivery_type === "recurring").length === 0 ? (
                    <div className="p-4 rounded-lg border border-dashed text-xs text-muted-foreground text-center">
                      Nenhuma atividade de recorrência cadastrada.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {workspace.scopeItems
                        .filter((i) => i.delivery_type === "recurring")
                        .map((item) => (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-lg border border-border/60 bg-card hover:border-primary/40 transition-colors text-sm flex flex-col md:flex-row justify-between gap-4"
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <strong>{item.activity_name}</strong>
                                <Badge variant="secondary" className="text-[10px]">
                                  {item.frequency}
                                </Badge>
                                {item.is_automatable && (
                                  <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                                    Automatizável
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
                                <span>Aceite: <strong>{item.acceptance_criteria || "Não especificado"}</strong></span>
                                <span>Evidência: <strong>{item.required_evidence || "Não especificada"}</strong></span>
                              </div>
                            </div>

                            <div className="flex md:flex-col justify-between items-end gap-1 text-right shrink-0">
                              <span className="font-mono text-sm font-semibold">{item.estimated_minutes} min / rotina</span>
                              <span className="text-xs text-muted-foreground">Papel: {item.default_role}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* ABA 3: SOPS E RACI */}
          <TabsContent value="sops_raci" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Card SOPs */}
              <Card className="p-6 border-muted/60 space-y-4">
                <div className="flex justify-between items-center border-b border-border/50 pb-3">
                  <div>
                    <h3 className="text-base font-semibold flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-primary" />
                      Procedimentos Operacionais (SOPs)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Instruções detalhadas para garantir qualidade e continuidade operacional.
                    </p>
                  </div>
                  <Badge variant="outline">{workspace.sops.length} cadastrados</Badge>
                </div>

                <div className="space-y-3">
                  {workspace.sops.length === 0 ? (
                    <div className="p-6 border border-dashed rounded text-center text-xs text-muted-foreground">
                      Nenhum SOP cadastrado para este produto.
                    </div>
                  ) : (
                    workspace.sops.map((sop) => (
                      <div key={sop.id} className="p-4 rounded-lg border border-border/60 bg-muted/5 space-y-2 text-sm">
                        <div className="flex justify-between items-start">
                          <strong className="text-primary">{sop.name}</strong>
                          <span className="text-xs text-muted-foreground font-mono">{sop.estimated_minutes} min</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{sop.objective}</p>
                        <div className="text-xs space-y-1 pt-1 border-t border-border/30">
                          <div><strong>Gatilho:</strong> {sop.trigger}</div>
                          <div><strong>Responsável:</strong> {sop.responsible_role}</div>
                          <div><strong>Critério de conclusão:</strong> {sop.completion_criteria}</div>
                          <div><strong>Evidência:</strong> {sop.required_evidence}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              {/* Card RACI */}
              <Card className="p-6 border-muted/60 space-y-4">
                <div className="flex justify-between items-center border-b border-border/50 pb-3">
                  <div>
                    <h3 className="text-base font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Matriz de Responsabilidade (RACI)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      R (Responsável), A (Aprovador), C (Consultado), I (Informado). Suporta papéis futuros.
                    </p>
                  </div>
                  <Badge variant="outline">{workspace.raci.length} papéis</Badge>
                </div>

                <div className="space-y-3">
                  {workspace.raci.length === 0 ? (
                    <div className="p-6 border border-dashed rounded text-center text-xs text-muted-foreground">
                      Nenhum papel RACI atribuído.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {workspace.raci.map((r) => (
                        <div key={r.id} className="py-2.5 flex items-center justify-between text-sm">
                          <div className="space-y-0.5">
                            <strong>{r.activity_name}</strong>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Papel: <strong>{r.role}</strong></span>
                              {r.is_future_role && (
                                <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-300 border-amber-500/20">
                                  Papel Futuro
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Badge
                            className={
                              r.raci_type === "R"
                                ? "bg-primary text-primary-foreground font-bold"
                                : r.raci_type === "A"
                                ? "bg-emerald-600 text-white font-bold"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {r.raci_type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* ABA 4: CHECKPOINT DE VIABILIDADE & DECISÃO */}
          <TabsContent value="viability" className="space-y-6">
            <Card className="p-6 border-muted/60 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Checkpoint de Viabilidade Operacional
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Verificação formal de consistência antes de qualquer preço, pacote ou promessa comercial externa.
                  </p>
                </div>

                <Button
                  onClick={handleCalculateViability}
                  variant="outline"
                  size="sm"
                  disabled={actionLoading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recalcular Viabilidade
                </Button>
              </div>

              {workspace.viability ? (
                <div className="space-y-6">
                  {/* Status Geral de Viabilidade */}
                  <div className={`p-4 rounded-lg border flex items-start gap-3 ${
                    workspace.viability.result === "ready_for_human_review"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : workspace.viability.result === "ready_for_estimation"
                      ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                      : "border-red-500/40 bg-red-500/10 text-red-300"
                  }`}>
                    {workspace.viability.result === "ready_for_human_review" ? (
                      <CheckCircle2 className="h-6 w-6 shrink-0 mt-0.5" />
                    ) : workspace.viability.result === "ready_for_estimation" ? (
                      <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="h-6 w-6 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <strong className="text-base">
                        {workspace.viability.result === "ready_for_human_review" && "Pronto para Revisão Humana"}
                        {workspace.viability.result === "ready_for_estimation" && "Pronto para Estimativa de Custos"}
                        {workspace.viability.result === "blocked" && "Produto Bloqueado por Lacunas"}
                      </strong>
                      <p className="text-sm opacity-90">{workspace.viability.explanation}</p>
                    </div>
                  </div>

                  {/* Lacunas Impeditivas */}
                  {workspace.viability.blocking_gaps.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold uppercase tracking-wider text-red-400 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Lacunas Impeditivas Identificadas ({workspace.viability.blocking_gaps.length})
                      </h4>
                      <div className="space-y-1.5">
                        {workspace.viability.blocking_gaps.map((gap, i) => (
                          <div key={i} className="p-3 rounded border border-red-500/30 bg-red-500/5 text-xs text-red-300 flex items-start gap-2">
                            <span className="font-mono font-bold">✕</span>
                            <span>{gap}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Salvaguarda Estrita de Precificação e Promessa Comercial */}
                  <div className="p-5 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Lock className="h-5 w-5 text-primary" />
                      <h4 className="text-sm font-semibold text-primary uppercase tracking-wider">
                        Salvaguarda Inegociável da Alastre Platform
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Conforme as regras de governança e arquitetura, a Alastre Platform <strong>nunca aprova preço automaticamente</strong> nem inventa pacotes comerciais sem escopo e viabilidade comprovados. Promessas contratuais sobre faturamento ou posições no Google são expressamente proibidas.
                    </p>
                    {pricingGuard && !pricingGuard.priceAllowed && (
                      <div className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
                        <ShieldAlert className="h-4 w-4" />
                        Precificação e promessa comercial bloqueadas: {pricingGuard.reasons.join(" · ")}
                      </div>
                    )}
                  </div>

                  {/* Ação Dominante: Submeter para Revisão Humana */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                    {workspace.product.status === "draft" && (
                      <Button
                        onClick={handleSubmitReview}
                        disabled={
                          actionLoading ||
                          workspace.viability.result === "blocked" ||
                          workspace.product.is_immutable
                        }
                        className="h-11 px-6 font-semibold"
                      >
                        <FileCheck className="h-4 w-4 mr-2" />
                        Submeter Versão para Aprovação Humana
                      </Button>
                    )}
                    {workspace.product.status === "in_review" && (
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-sm px-4 py-2">
                        Versão aguardando decisão na Central de Aprovações
                      </Badge>
                    )}
                    {workspace.product.status === "approved" && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-sm px-4 py-2">
                        ✓ Versão Aprovada e Imutável
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 border border-dashed rounded text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Clique em Recalcular Viabilidade para analisar as rodadas de descoberta e matriz de escopo.
                  </p>
                  <Button onClick={handleCalculateViability} disabled={actionLoading}>
                    Calcular Primeiro Checkpoint
                  </Button>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Modo Avançado: Progressive Disclosure */}
      {isAdvancedMode && workspace && (
        <Card className="p-6 border-muted/60 space-y-4 bg-muted/5 font-mono text-xs">
          <h4 className="text-sm font-semibold font-sans flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            Modo Avançado · Metadados e Diagnóstico Interno
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p><strong>product_id:</strong> {workspace.product.id}</p>
              <p><strong>agency_id:</strong> {workspace.product.agency_id}</p>
              <p><strong>client_id:</strong> {workspace.product.client_id || "null (global)"}</p>
              <p><strong>version:</strong> {workspace.product.version}</p>
              <p><strong>status:</strong> {workspace.product.status}</p>
            </div>
            <div>
              <p><strong>is_immutable:</strong> {String(workspace.product.is_immutable)}</p>
              <p><strong>created_at:</strong> {workspace.product.created_at}</p>
              <p><strong>updated_at:</strong> {workspace.product.updated_at}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
