"use client";

import {
  Activity, ArrowRight, Bot, CheckCircle2, ChevronRight, CircleDollarSign,
  Clock3, FileBarChart, Fingerprint, Gauge, LayoutDashboard, MapPin, Network,
  ScanLine, Search, Settings, ShieldCheck, Sparkles, Users,
  Waypoints,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ThemeSwitcher } from "./theme-switcher";
import { GoogleAdsModule } from "./google-ads-module";
import { ApprovalsModule } from "./approvals-module";
import { ClientsModule } from "./clients-module";
import { DnaModule } from "./dna-module";
import { AgentWorkspace } from "./agent-workspace";
import { OperationsModule } from "./operations-module";
import { TrackingModule } from "./tracking-module";

const navigation = [
  { label: "Visão geral", icon: LayoutDashboard, view: "overview" as const },
  { label: "Google Ads", icon: Search, view: "google-ads" as const },
  { label: "GTM e GA4", icon: Waypoints, view: "tracking" as const },
  { label: "Clientes", icon: Users, view: "clients" as const },
  { label: "DNA e memória", icon: Fingerprint, view: "dna" as const },
  { label: "Aprovações", icon: CheckCircle2, view: "approvals" as const },
  { label: "Agentes", icon: Bot, view: "agents" as const },
  { label: "Relatórios", icon: FileBarChart },
  { label: "Custos", icon: CircleDollarSign, view: "costs" as const },
  { label: "Auditoria", icon: ShieldCheck, view: "audit" as const },
];

const foundations = [
  { label: "Identidade visual", detail: "Tokens e temas definidos", status: "Pronto" },
  { label: "Arquitetura", detail: "Monólito modular", status: "Pronto" },
  { label: "Banco homologação", detail: "Supabase isolado e protegido", status: "Pronto" },
  { label: "Integrações", detail: "Fontes em recuperação", status: "Mapeado" },
];

const integrations = [
  { name: "Google Ads", state: "Inventariado", tone: "violet" },
  { name: "Google Tag Manager", state: "Fonte pendente", tone: "amber" },
  { name: "Meta Ads", state: "Etapa 2", tone: "neutral" },
  { name: "Relatórios", state: "Doador validado", tone: "green" },
];

export function AppShell({ userName }: { userName: string }) {
  const [activeView, setActiveView] = useState<"overview" | "google-ads" | "tracking" | "clients" | "dna" | "approvals" | "agents" | "costs" | "audit">("overview");
  const [selectedClient, setSelectedClient] = useState("b10a1a00-0000-4000-8000-000000000001");
  const firstName = userName.includes("@") ? "Rodrigo" : userName.split(" ")[0];

  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="brand-block">
          <div className="brand-logo-wrap">
            <Image src="/alastre-logo.png" alt="Alastre Digital" fill sizes="42px" unoptimized className="brand-logo" />
          </div>
          <div className="brand-copy"><strong>ALASTRE</strong><span>OPERAÇÕES</span></div>
        </div>

        <nav className="side-nav">
          <span className="nav-label">Operação</span>
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = item.view === activeView;
            return (
              <button type="button" key={item.label} className={`nav-item${isActive ? " is-active" : ""}`}
                onClick={() => item.view && setActiveView(item.view)}
                aria-current={isActive ? "page" : undefined}
                title={item.view ? item.label : `${item.label} — próximo marco`}>
                <Icon aria-hidden="true" /><span>{item.label}</span>{!item.view ? <span className="nav-dot" /> : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="security-line">
            <ShieldCheck aria-hidden="true" />
            <div><strong>Ambiente protegido</strong><span>Homologação privada</span></div>
          </div>
          <button className="settings-link" type="button"><Settings aria-hidden="true" />Configurações</button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <div className="mobile-symbol"><Image src="/alastre-logo.png" alt="" fill sizes="31px" unoptimized /></div><strong>ALASTRE</strong>
          </div>
          <div className="environment-pill"><span className="live-pulse" />Fundação técnica</div>
          <div className="topbar-actions">
            <ThemeSwitcher />
            <div className="user-chip" title={userName}>
              <span>{firstName.slice(0, 1).toUpperCase()}</span>
              <div><strong>{firstName}</strong><small>Administrador</small></div>
            </div>
          </div>
        </header>

        <div className="mobile-nav" aria-label="Navegação móvel">
          {navigation.filter((item) => item.view).map((item) => {
            const Icon = item.icon;
            const isActive = item.view === activeView;
            return <button type="button" key={item.label} className={isActive ? "is-active" : ""}
              onClick={() => item.view && setActiveView(item.view)}
              aria-current={isActive ? "page" : undefined}><Icon aria-hidden="true" /><span>{item.label}</span></button>;
          })}
        </div>

        <div className="content-wrap">
          {activeView === "google-ads" ? <GoogleAdsModule clientId={selectedClient} onSelectClient={setSelectedClient} onBack={() => setActiveView("overview")} />
          : activeView === "tracking" ? <TrackingModule clientId={selectedClient} onSelectClient={setSelectedClient} />
          : activeView === "clients" ? <ClientsModule onOpenDna={(id) => { setSelectedClient(id); setActiveView("dna"); }} onOpenAgent={(id) => { setSelectedClient(id); setActiveView("agents"); }} />
          : activeView === "dna" ? <DnaModule clientId={selectedClient} onOpenAgent={(id) => { setSelectedClient(id); setActiveView("agents"); }} />
          : activeView === "agents" ? <AgentWorkspace clientId={selectedClient} onOpenBuilder={(id) => {setSelectedClient(id);setActiveView("google-ads");}} />
          : activeView === "costs" ? <OperationsModule mode="costs" />
          : activeView === "audit" ? <OperationsModule mode="audit" />
          : activeView === "approvals" ? <ApprovalsModule /> : <>
          <section className="intro-row">
            <div>
              <div className="eyebrow"><ScanLine aria-hidden="true" /> CENTRAL DE OPERAÇÕES</div>
              <h1>Boa noite, {firstName}.</h1>
              <p>A fundação segura está online. O próximo avanço será ativar acesso e dados reais de forma controlada.</p>
            </div>
            <Badge variant="outline" className="stage-badge">Marco 1 · Fundação online</Badge>
          </section>

          <section className="signal-grid" aria-label="Resumo da fundação">
            <article className="signal-card signal-primary">
              <div className="signal-head"><span className="signal-icon"><Gauge aria-hidden="true" /></span><Badge>Etapa atual</Badge></div>
              <strong className="signal-number">80%</strong><span className="signal-label">Fundação técnica</span>
              <Progress value={80} className="foundation-progress" /><small>Supabase, RLS e auditoria validados</small>
            </article>
            <article className="signal-card">
              <div className="signal-head"><span className="signal-icon"><Users aria-hidden="true" /></span><span className="signal-kicker">PILOTO</span></div>
              <strong className="signal-title">Bionippon</strong><span className="signal-label">Indaiatuba · Salto · Itu · Porto Feliz</span>
              <div className="signal-status"><span /> Piloto ativo no Supabase</div>
            </article>
            <article className="signal-card">
              <div className="signal-head"><span className="signal-icon"><CheckCircle2 aria-hidden="true" /></span><span className="signal-kicker">APROVAÇÕES</span></div>
              <strong className="signal-number">0</strong><span className="signal-label">Nenhuma ação externa pendente</span>
              <div className="signal-status safe"><ShieldCheck aria-hidden="true" /> Escrita bloqueada</div>
            </article>
            <article className="signal-card">
              <div className="signal-head"><span className="signal-icon"><CircleDollarSign aria-hidden="true" /></span><span className="signal-kicker">CUSTOS</span></div>
              <strong className="signal-title">R$ 0/mês</strong><span className="signal-label">Supabase de homologação</span>
              <div className="signal-status neutral"><Clock3 aria-hidden="true" /> IA e APIs ainda desativadas</div>
            </article>
          </section>

          <section className="main-grid">
            <article className="panel foundation-panel">
              <div className="panel-heading"><div><span className="section-kicker">FUNDAÇÃO</span><h2>Prontidão da plataforma</h2></div><Activity aria-hidden="true" /></div>
              <div className="foundation-list">
                {foundations.map((item, index) => (
                  <div className="foundation-row" key={item.label}>
                    <span className={`foundation-index${index < 3 ? " done" : ""}`}>{index < 3 ? <CheckCircle2 aria-hidden="true" /> : index + 1}</span>
                    <div><strong>{item.label}</strong><span>{item.detail}</span></div>
                    <Badge variant="outline" className={`status-${item.status.toLowerCase()}`}>{item.status}</Badge>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel pilot-panel">
              <div className="pilot-orbit" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit-dot" /><MapPin /></div>
              <div className="pilot-content">
                <span className="section-kicker">PRIMEIRO CLIENTE</span><h2>Bionippon</h2>
                <p>Cadastrada no ambiente de homologação para validar DNA, diagnóstico de Google Ads e aprovações sem alterações automáticas.</p>
                <Button className="pilot-button" onClick={() => setActiveView("google-ads")}>Abrir Google Ads <ArrowRight aria-hidden="true" /></Button>
              </div>
            </article>
          </section>

          <section className="panel integrations-panel">
            <div className="panel-heading integrations-heading"><div><span className="section-kicker">ECOSSISTEMA</span><h2>Capacidades inventariadas</h2></div><span className="updated-at">Atualizado agora</span></div>
            <div className="integration-grid">
              {integrations.map((integration) => (
                <div className="integration-item" key={integration.name}>
                  <span className={`integration-mark ${integration.tone}`}><Network aria-hidden="true" /></span>
                  <div><strong>{integration.name}</strong><span>{integration.state}</span></div><ChevronRight aria-hidden="true" />
                </div>
              ))}
            </div>
          </section>

          <footer className="workspace-footer">
            <span><Sparkles aria-hidden="true" /> Alastre Digital · Fundação V1</span>
            <span>Dados reais e automações externas permanecem bloqueados</span>
          </footer>
          </>}
        </div>
      </main>
    </div>
  );
}
