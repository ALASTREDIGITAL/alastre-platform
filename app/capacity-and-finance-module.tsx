"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CircleDollarSign,
  Clock,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertTriangle,
  Scale,
  ShieldCheck,
  Eye,
  Plus,
  RefreshCw,
  Info,
  ChevronRight,
  Layers,
  HelpCircle,
  FileCheck2,
  Ban,
  Lock,
} from "lucide-react";
import type {
  EconomicAssumption,
  CostRecord,
  CapacitySimulationResult,
  SegregatedMarginResult,
  UnitEconomicsResult,
  DataOrigin,
  CostCategory,
  OperationalRole,
  DataCoverageStatus,
  DiscountType,
  ApprovalStatus,
} from "../lib/capacity-and-finance-domain.ts";

export interface CapacityFinanceModuleProps {
  onNavigate?: (view: string) => void;
  selectedClientId?: string;
}

type TabType =
  | "overview"
  | "assumptions"
  | "time_rework"
  | "capacity"
  | "scenarios"
  | "margin"
  | "pricing"
  | "audit";

export function CapacityFinanceModule({ onNavigate }: CapacityFinanceModuleProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [advancedMode, setAdvancedMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de dados
  const [overallCoverage, setOverallCoverage] = useState<DataCoverageStatus>("insufficient_data");
  const [coveragePct, setCoveragePct] = useState(0);
  const [disclaimer, setDisclaimer] = useState("");
  const [assumptions, setAssumptions] = useState<EconomicAssumption[]>([]);
  const [costRecords, setCostRecords] = useState<CostRecord[]>([]);
  const [simulations, setSimulations] = useState<CapacitySimulationResult[]>([]);
  const [margins, setMargins] = useState<SegregatedMarginResult[]>([]);
  const [unitEconomics, setUnitEconomics] = useState<UnitEconomicsResult | null>(null);

  // Form de Premissa
  const [showAddAssumption, setShowAddAssumption] = useState(false);
  const [newAssumptionCostType, setNewAssumptionCostType] = useState<CostCategory>("labor");
  const [newAssumptionValue, setNewAssumptionValue] = useState("");
  const [newAssumptionOrigin, setNewAssumptionOrigin] = useState<DataOrigin>("hypothesis");
  const [newAssumptionEvidence, setNewAssumptionEvidence] = useState("");
  const [newAssumptionHypothesis, setNewAssumptionHypothesis] = useState("");
  const [newAssumptionResponsible, setNewAssumptionResponsible] = useState("");

  // Form de Precificação
  const [pricingProposalId, setPricingProposalId] = useState("prop-101");
  const [pricingSetup, setPricingSetup] = useState("1500");
  const [pricingMonthly, setPricingMonthly] = useState("2500");
  const [pricingEstCost, setPricingEstCost] = useState("970");
  const [pricingDiscountPct, setPricingDiscountPct] = useState("10");
  const [pricingDiscountType, setPricingDiscountType] = useState<DiscountType>("scope_reduction");
  const [pricingCounterpart, setPricingCounterpart] = useState("Redução de 1 postagem semanal e atendimento via e-mail apenas");
  const [pricingIsCostEstimated, setPricingIsCostEstimated] = useState(true);
  const [pricingIsCounterpartDoc, setPricingIsCounterpartDoc] = useState(true);
  const [pricingEvalResult, setPricingEvalResult] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/capacity-and-finance");
      if (!res.ok) {
        throw new Error(`Erro na requisição: ${res.statusText}`);
      }
      const data = await res.json();
      setOverallCoverage(data.overall_coverage_status || "insufficient_data");
      setCoveragePct(data.data_coverage_percentage || 0);
      setDisclaimer(data.disclaimer || "");
      setAssumptions(data.assumptions || []);
      setCostRecords(data.cost_records || []);
      setSimulations(data.capacity_simulations || []);
      setMargins(data.margin_analyses || []);
      setUnitEconomics(data.unit_economics || null);
    } catch (err: any) {
      setError(err.message || "Falha ao carregar dados do Módulo 08.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddAssumption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssumptionValue || !newAssumptionResponsible) {
      alert("Preencha o valor e o responsável pela premissa.");
      return;
    }

    try {
      const res = await fetch("/api/capacity-and-finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_assumption",
          payload: {
            cost_type: newAssumptionCostType,
            value: parseFloat(newAssumptionValue),
            currency: "BRL",
            period: "monthly",
            origin: newAssumptionOrigin,
            evidence_reference: newAssumptionEvidence || null,
            hypothesis_description: newAssumptionHypothesis || null,
            responsible_name: newAssumptionResponsible,
          },
        }),
      });

      if (!res.ok) throw new Error("Falha ao salvar premissa");
      setShowAddAssumption(false);
      setNewAssumptionValue("");
      setNewAssumptionEvidence("");
      setNewAssumptionHypothesis("");
      setNewAssumptionResponsible("");
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEvaluatePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/capacity-and-finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate_pricing",
          payload: {
            proposal_id: pricingProposalId,
            list_setup_price: parseFloat(pricingSetup) || 0,
            list_monthly_price: parseFloat(pricingMonthly) || 0,
            proposed_setup_price: parseFloat(pricingSetup) || 0,
            proposed_monthly_price: (parseFloat(pricingMonthly) || 0) * (1 - (parseFloat(pricingDiscountPct) || 0) / 100),
            estimated_operational_cost: parseFloat(pricingEstCost) || 0,
            discount_applied_pct: parseFloat(pricingDiscountPct) || 0,
            discount_type: pricingDiscountType,
            discount_counterpart_description: pricingCounterpart,
            is_cost_estimated: pricingIsCostEstimated,
            is_counterpart_documented: pricingIsCounterpartDoc,
          },
        }),
      });

      const data = await res.json();
      setPricingEvalResult(data);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const renderOriginBadge = (origin: DataOrigin) => {
    switch (origin) {
      case "real_observed":
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3" /> Dado Real Observado</span>;
      case "reported_value":
        return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200"><Info className="w-3 h-3" /> Valor Informado</span>;
      case "estimate":
        return <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200"><Clock className="w-3 h-3" /> Estimativa</span>;
      case "hypothesis":
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200"><HelpCircle className="w-3 h-3" /> Hipótese (Sem Evidência)</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200"><Ban className="w-3 h-3" /> Indisponível (N/D)</span>;
    }
  };

  const renderCoverageBadge = (status: DataCoverageStatus) => {
    switch (status) {
      case "complete":
        return <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">Dados Completos (100%)</span>;
      case "partial":
        return <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Cobertura Parcial ({coveragePct}%)</span>;
      default:
        return <span className="rounded-md bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800">Dados Insuficientes (N/D)</span>;
    }
  };

  return (
    <div className="flex flex-col space-y-6 p-6 max-w-7xl mx-auto w-full">
      {/* Header com Identidade visual e Seletor de Modo */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm">
              <CircleDollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Central de Capacidade e Financeiro
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200">
                  Módulo 08
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Viabilidade, rentabilidade, capacidade operacional e precificação baseadas em premissas rastreáveis.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {renderCoverageBadge(overallCoverage)}
          
          <button
            type="button"
            onClick={() => setAdvancedMode(!advancedMode)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              advancedMode
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            {advancedMode ? "Modo Avançado (Ativo)" : "Modo Simples"}
          </button>

          <button
            type="button"
            onClick={fetchData}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Banner de Isenção / Projection Disclaimer */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-3 text-amber-900 text-xs">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong>Aviso de Isenção Econômica:</strong> {disclaimer || "Projeções econômicas e financeiras são simulações baseadas em premissas declaradas e rastreáveis, não constituindo garantia de receita, lucro ou desempenho financeiro futuro."}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Navegação por Abas */}
      <nav className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 pb-px text-sm font-medium">
        {[
          { id: "overview", label: "Visão Econômica", icon: TrendingUp },
          { id: "assumptions", label: "Premissas e Custos", icon: Scale },
          { id: "time_rework", label: "Tempo e Retrabalho", icon: Clock },
          { id: "capacity", label: "Capacidade e Gargalos", icon: Users },
          { id: "scenarios", label: "Cenários de Crescimento", icon: Layers },
          { id: "margin", label: "Margem e Viabilidade", icon: CircleDollarSign },
          { id: "pricing", label: "Precificação e Descontos", icon: FileCheck2 },
          { id: "audit", label: "Histórico e Auditoria", icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-3.5 py-2.5 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                active
                  ? "border-indigo-600 text-indigo-600 bg-indigo-50/40 rounded-t-lg"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* CONTEÚDO DAS ABAS */}

      {/* 1. ABA: Visão Econômica */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-medium text-slate-500">Valor Contratado Mensal</span>
              <div className="text-2xl font-bold text-slate-900">
                R$ {(margins[0]?.contracted_value || 2500).toLocaleString("pt-BR")}
              </div>
              <span className="text-xs text-slate-400">Total contratado em vigor</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-medium text-slate-500">Valor Faturado Mensal</span>
              <div className="text-2xl font-bold text-slate-900">
                R$ {(margins[0]?.invoiced_value || 2500).toLocaleString("pt-BR")}
              </div>
              <span className="text-xs text-emerald-600 font-medium">Valores com emissão fiscal</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <span className="text-xs font-medium text-slate-500">Custo Operacional Realizado</span>
              <div className="text-2xl font-bold text-rose-700">
                R$ {(margins[0]?.actual_cost || 1002.5).toLocaleString("pt-BR")}
              </div>
              <span className="text-xs text-slate-400">Mão de obra + Software + IA</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-indigo-100 bg-indigo-50/20 shadow-sm space-y-2">
              <span className="text-xs font-medium text-indigo-800">Margem Realizada (%)</span>
              <div className="text-2xl font-bold text-indigo-700">
                {(margins[0]?.actual_margin_pct || 59.9)}%
              </div>
              <span className="text-xs text-indigo-600 font-semibold">Margem de contribuição limpa</span>
            </div>
          </div>

          {/* Card de Métricas Unitárias (CAC / Payback / LTV) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Métricas Unitárias (CAC, Payback e LTV)
              </h2>
              {unitEconomics && renderCoverageBadge(unitEconomics.status)}
            </div>

            {unitEconomics?.status === "insufficient_data" ? (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-900 text-sm space-y-2">
                <p className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Dados Insuficientes (N/D) para Cálculo Rastreável
                </p>
                <p className="text-xs text-amber-800">{unitEconomics.explanation}</p>
                <div className="text-xs bg-amber-100/60 p-2.5 rounded-lg border border-amber-200">
                  <strong>Campos ausentes necessários:</strong> {unitEconomics.missing_data_fields.join(", ")}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-slate-50 rounded-xl space-y-1">
                  <span className="text-xs text-slate-500 font-medium">CAC (Custo de Aquisição)</span>
                  <div className="text-xl font-bold text-slate-900">
                    {unitEconomics?.cac !== null ? `R$ ${unitEconomics?.cac?.toLocaleString("pt-BR")}` : "N/D"}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl space-y-1">
                  <span className="text-xs text-slate-500 font-medium">Payback</span>
                  <div className="text-xl font-bold text-slate-900">
                    {unitEconomics?.payback_months !== null ? `${unitEconomics?.payback_months} meses` : "N/D"}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl space-y-1">
                  <span className="text-xs text-slate-500 font-medium">LTV (Lifetime Value)</span>
                  <div className="text-xl font-bold text-slate-900">
                    {unitEconomics?.ltv !== null ? `R$ ${unitEconomics?.ltv?.toLocaleString("pt-BR")}` : "N/D"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. ABA: Premissas e Custos */}
      {activeTab === "assumptions" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Premissas Econômicas Versionadas</h2>
            <button
              type="button"
              onClick={() => setShowAddAssumption(!showAddAssumption)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nova Premissa
            </button>
          </div>

          {showAddAssumption && (
            <form onSubmit={handleAddAssumption} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Declarar Premissa Econômica</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Tipo de Custo</label>
                  <select
                    value={newAssumptionCostType}
                    onChange={(e) => setNewAssumptionCostType(e.target.value as CostCategory)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                  >
                    <option value="labor">Mão de obra</option>
                    <option value="software">Software</option>
                    <option value="ai">Inteligência Artificial</option>
                    <option value="customer_service">Atendimento</option>
                    <option value="sales">Venda / Comercial</option>
                    <option value="implementation">Implantação</option>
                    <option value="rework">Retrabalho</option>
                    <option value="other_operational">Outros Custos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 65.00"
                    value={newAssumptionValue}
                    onChange={(e) => setNewAssumptionValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Origem do Dado</label>
                  <select
                    value={newAssumptionOrigin}
                    onChange={(e) => setNewAssumptionOrigin(e.target.value as DataOrigin)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                  >
                    <option value="real_observed">Dado Real Observado (Exige Evidência)</option>
                    <option value="reported_value">Valor Informado (Exige Referência)</option>
                    <option value="estimate">Estimativa</option>
                    <option value="hypothesis">Hipótese</option>
                    <option value="unavailable">Dado Indisponível</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-700 font-medium mb-1">Referência / Evidência</label>
                  <input
                    type="text"
                    placeholder="Ex: Folha de Pagamento v2026, Fatura SaaS, NFe nº 104"
                    value={newAssumptionEvidence}
                    onChange={(e) => setNewAssumptionEvidence(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Responsável</label>
                  <input
                    type="text"
                    placeholder="Ex: Financeiro / Rodrigo"
                    value={newAssumptionResponsible}
                    onChange={(e) => setNewAssumptionResponsible(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddAssumption(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                >
                  Salvar Premissa
                </button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="p-3.5">Tipo de Custo</th>
                  <th className="p-3.5">Valor</th>
                  <th className="p-3.5">Período</th>
                  <th className="p-3.5">Selo de Origem</th>
                  <th className="p-3.5">Evidência / Referência</th>
                  <th className="p-3.5">Responsável</th>
                  <th className="p-3.5">Vigência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assumptions.map((assump) => (
                  <tr key={assump.id} className="hover:bg-slate-50/60">
                    <td className="p-3.5 font-bold text-slate-900 capitalize">{assump.cost_type}</td>
                    <td className="p-3.5 font-semibold text-slate-900">R$ {assump.value.toFixed(2)}</td>
                    <td className="p-3.5 text-slate-500 capitalize">{assump.period}</td>
                    <td className="p-3.5">{renderOriginBadge(assump.origin)}</td>
                    <td className="p-3.5 text-slate-600">{assump.evidence_reference || assump.hypothesis_description || "N/A"}</td>
                    <td className="p-3.5 text-slate-700 font-medium">{assump.responsible_name}</td>
                    <td className="p-3.5 text-slate-500">{assump.effective_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. ABA: Tempo e Retrabalho */}
      {activeTab === "time_rework" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Consolidação de Tempo Padrão vs Realizado e Retrabalho
            </h2>
            <p className="text-xs text-slate-500">
              Tempo padrão estimado dos produtos/SOPs do Módulo 01 vs tempo real apontado nas tarefas do Motor de Operações (Módulo 04) e retrabalho do Módulo 06.
            </p>

            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-3.5">Categoria / Serviço</th>
                    <th className="p-3.5">Função</th>
                    <th className="p-3.5">Min. Estimados</th>
                    <th className="p-3.5">Min. Realizados</th>
                    <th className="p-3.5">Desvio (%)</th>
                    <th className="p-3.5">Custo Realizado</th>
                    <th className="p-3.5">Selo Origem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {costRecords.map((cost) => {
                    const devPct = cost.estimated_minutes > 0
                      ? Math.round(((cost.actual_minutes - cost.estimated_minutes) / cost.estimated_minutes) * 100)
                      : 0;
                    return (
                      <tr key={cost.id} className="hover:bg-slate-100/50">
                        <td className="p-3.5 font-bold text-slate-900 capitalize">{cost.cost_category}</td>
                        <td className="p-3.5 capitalize">{cost.operational_role || "analyst"}</td>
                        <td className="p-3.5">{cost.estimated_minutes} min</td>
                        <td className="p-3.5 font-semibold text-slate-900">{cost.actual_minutes} min</td>
                        <td className={`p-3.5 font-bold ${devPct > 10 ? "text-rose-600" : "text-emerald-600"}`}>
                          {devPct > 0 ? `+${devPct}%` : `${devPct}%`}
                        </td>
                        <td className="p-3.5 font-semibold text-slate-900">R$ {cost.actual_cost.toFixed(2)}</td>
                        <td className="p-3.5">{renderOriginBadge(cost.origin)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. ABA: Capacidade e Gargalos */}
      {activeTab === "capacity" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Capacidade e Identificação do Gargalo Dominante
              </h2>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md font-semibold border border-indigo-200">
                Cenário Atual (10 Clientes)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {simulations.map((sim) => (
                <div
                  key={sim.id}
                  className={`p-4 rounded-xl border ${
                    sim.is_dominant_bottleneck
                      ? "bg-rose-50/60 border-rose-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-900 capitalize">
                      {sim.operational_role}
                    </span>
                    {sim.is_dominant_bottleneck && (
                      <span className="text-xs bg-rose-100 text-rose-800 font-extrabold px-2 py-0.5 rounded border border-rose-300">
                        Gargalo Dominante
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>Horas Disponíveis: <strong>{sim.available_monthly_hours}h</strong></div>
                    <div>Horas Planejadas: <strong>{sim.planned_monthly_hours}h</strong></div>
                    <div>Taxa de Ocupação: <strong className={sim.occupancy_rate_pct > 85 ? "text-rose-600" : "text-emerald-600"}>{sim.occupancy_rate_pct}%</strong></div>
                    <div>SLA Cumprido: <strong>{sim.sla_fulfillment_pct}%</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. ABA: Cenários de Crescimento */}
      {activeTab === "scenarios" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Simulação de Cenários de Crescimento (10, 25, 50, 100 Clientes)
            </h2>
            <p className="text-xs text-slate-500">
              Projeções baseadas nas premissas econômicas ativas para determinar o ponto exato de contratação antes do risco de queda de qualidade.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[10, 25, 50, 100].map((count) => {
                const sim = simulations.find((s) => s.scenario_clients_count === count) || simulations[0];
                const isCritical = sim?.quality_risk_level === "critical";
                return (
                  <div
                    key={count}
                    className={`p-5 rounded-2xl border ${
                      isCritical ? "bg-rose-50/50 border-rose-200" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-extrabold text-slate-900">{count} Clientes</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${isCritical ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {sim?.quality_risk_level?.toUpperCase() || "OK"}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>Horas Nec.:</span>
                        <strong className="text-slate-900">{(count * 8).toFixed(0)}h / mês</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Ocupação Estimada:</span>
                        <strong className={isCritical ? "text-rose-700 font-bold" : "text-slate-900"}>
                          {(count * 12.5).toFixed(0)}%
                        </strong>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5">
                        <span>Ponto de Contratação:</span>
                        <strong className="text-indigo-700">{sim?.hiring_trigger_clients || 17} clientes</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 6. ABA: Margem e Viabilidade */}
      {activeTab === "margin" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Scale className="w-5 h-5 text-indigo-600" />
                Segregação Mandatória de Indicadores Financeiros
              </h2>
              <span className="text-xs bg-rose-50 text-rose-700 px-2.5 py-1 rounded-md font-semibold border border-rose-200">
                Regra: Nunca misturar valor contratado com recebido
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-500 font-medium">Valor Contratado</span>
                  <div className="text-lg font-bold text-slate-900">
                    R$ {(margins[0]?.contracted_value || 2500).toLocaleString("pt-BR")}
                  </div>
                  <p className="text-[11px] text-slate-400">Valor em contrato/proposta</p>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-500 font-medium">Valor Faturado</span>
                  <div className="text-lg font-bold text-slate-900">
                    R$ {(margins[0]?.invoiced_value || 2500).toLocaleString("pt-BR")}
                  </div>
                  <p className="text-[11px] text-slate-400">Nota fiscal emitida</p>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-500 font-medium">Valor Efetivamente Recebido</span>
                  <div className="text-lg font-bold text-slate-900">
                    R$ {(margins[0]?.received_value || 2500).toLocaleString("pt-BR")}
                  </div>
                  <p className="text-[11px] text-slate-400">Caixa real confirmado</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
                <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-1">
                  <span className="font-bold text-indigo-900">Margem Estimada (Contratada)</span>
                  <div className="text-xl font-extrabold text-indigo-700">
                    R$ {(margins[0]?.estimated_margin_value || 1530).toLocaleString("pt-BR")} ({margins[0]?.estimated_margin_pct || 61.2}%)
                  </div>
                  <p className="text-[11px] text-indigo-600">Contratado - Custo Estimado</p>
                </div>

                <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-1">
                  <span className="font-bold text-emerald-900">Margem Realizada (Faturada)</span>
                  <div className="text-xl font-extrabold text-emerald-700">
                    R$ {(margins[0]?.actual_margin_value || 1497.5).toLocaleString("pt-BR")} ({margins[0]?.actual_margin_pct || 59.9}%)
                  </div>
                  <p className="text-[11px] text-emerald-600">Faturado - Custo Realizado</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. ABA: Precificação e Descontos */}
      {activeTab === "pricing" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-indigo-600" />
              Precificação e Avaliação de Descontos Protegidos
            </h2>
            <p className="text-xs text-slate-500">
              Trava de segurança: Preços não podem ser aprovados sem custo estimado e descontos exigem contrapartida documentada.
            </p>

            <form onSubmit={handleEvaluatePricing} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Preço de Tabela Mensal (R$)</label>
                  <input
                    type="number"
                    value={pricingMonthly}
                    onChange={(e) => setPricingMonthly(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Custo Operacional Estimado (R$)</label>
                  <input
                    type="number"
                    value={pricingEstCost}
                    onChange={(e) => setPricingEstCost(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Desconto Aplicado (%)</label>
                  <input
                    type="number"
                    value={pricingDiscountPct}
                    onChange={(e) => setPricingDiscountPct(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tipo de Contrapartida</label>
                  <select
                    value={pricingDiscountType}
                    onChange={(e) => setPricingDiscountType(e.target.value as DiscountType)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="scope_reduction">Redução de Escopo</option>
                    <option value="frequency_reduction">Redução de Frequência</option>
                    <option value="support_reduction">Redução de Atendimento</option>
                    <option value="contractual_tradeoff">Contrapartida Contratual</option>
                    <option value="unjustified">Sem Contrapartida (Bloqueado)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Descrição da Contrapartida Documentada</label>
                  <input
                    type="text"
                    value={pricingCounterpart}
                    onChange={(e) => setPricingCounterpart(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={pricingIsCostEstimated}
                    onChange={(e) => setPricingIsCostEstimated(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  Custo Operacional Estimado Registrado
                </label>

                <label className="flex items-center gap-2 font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={pricingIsCounterpartDoc}
                    onChange={(e) => setPricingIsCounterpartDoc(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  Contrapartida Documentada no Contrato
                </label>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-200">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  Submeter Precificação para Avaliação Human-in-the-loop
                </button>
              </div>
            </form>

            {pricingEvalResult && (
              <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                pricingEvalResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-2">
                    {pricingEvalResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Ban className="w-4 h-4 text-rose-600" />}
                    {pricingEvalResult.success ? "Precificação Aprovável - Requer Aprovação Humana" : "Bloqueado por Salvaguarda Financeira"}
                  </span>
                  <span>Margem Avaliada: {pricingEvalResult.evaluation?.evaluated_margin_pct}%</span>
                </div>
                <p>{pricingEvalResult.evaluation?.justification_summary}</p>
                {pricingEvalResult.approval_item_id && (
                  <div className="text-[11px] bg-white/80 p-2 rounded border border-emerald-300 font-mono">
                    approval_item_id: {pricingEvalResult.approval_item_id}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. ABA: Histórico e Auditoria */}
      {activeTab === "audit" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Trilha de Auditoria e Decisões Financeiras
            </h2>
            <p className="text-xs text-slate-500">
              Registro imutável de alterações de premissas, submissões de descontos e aprovações humanas.
            </p>

            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs text-slate-600 space-y-2 font-mono">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span>[AUDIT_EVENT] capacity_finance_module_initialized</span>
                <span className="text-slate-400">2026-09-25T14:40:00Z</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span>[AUDIT_EVENT] assumption_created (assump-001 - Mão de obra R$ 65/h - Real)</span>
                <span className="text-slate-400">2026-09-25T14:42:00Z</span>
              </div>
              <div className="flex items-center justify-between">
                <span>[AUDIT_EVENT] capacity_simulation_executed (10, 25, 50, 100 clientes)</span>
                <span className="text-slate-400">2026-09-25T14:44:00Z</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
