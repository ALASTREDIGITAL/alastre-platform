"use client";
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileBarChart,
  Fingerprint,
  LayoutDashboard,
  Link2,
  MapPinned,
  Search,
  ShieldCheck,
  Store,
  Users,
  Waypoints,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ThemeSwitcher } from "./theme-switcher";
import { GoogleAdsModule } from "./google-ads-module";
import { ApprovalsModule } from "./approvals-module";
import { ClientsModule } from "./clients-module";
import { DnaModule } from "./dna-module";
import { AgentWorkspace } from "./agent-workspace";
import { OperationsModule } from "./operations-module";
import { TrackingModule } from "./tracking-module";
import { LocalSeoModule } from "./local-seo-module";
import { OverviewModule } from "./overview-module";
import { ConnectionsModule } from "./connections-module";
type View =
  | "overview"
  | "clients"
  | "dna"
  | "local-seo"
  | "google-ads"
  | "tracking"
  | "agents"
  | "approvals"
  | "costs"
  | "audit"
  | "connections";
const views:View[]=["overview","clients","dna","local-seo","google-ads","tracking","agents","approvals","costs","audit","connections"];
type NavItem = {
  label: string;
  icon: typeof Store;
  view?: View;
  featured?: boolean;
};
const groups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Operação",
    items: [
      { label: "Visão geral", icon: LayoutDashboard, view: "overview" },
      { label: "Aprovações", icon: CheckCircle2, view: "approvals" },
      { label: "Agentes", icon: Bot, view: "agents" },
    ],
  },
  {
    label: "Clientes",
    items: [
      { label: "Clientes", icon: Users, view: "clients" },
      { label: "DNA e memória", icon: Fingerprint, view: "dna" },
    ],
  },
  {
    label: "SEO Local",
    items: [
      {
        label: "SEO Local",
        icon: MapPinned,
        view: "local-seo",
        featured: true,
      },
    ],
  },
  {
    label: "Aquisição",
    items: [
      { label: "Google Ads", icon: Search, view: "google-ads" },
      { label: "Meta Ads", icon: BarChart3 },
      { label: "GTM e GA4", icon: Waypoints, view: "tracking" },
    ],
  },
  {
    label: "Conteúdo",
    items: [{ label: "Sites & SEO", icon: Store }],
  },
  {
    label: "Gestão",
    items: [
      { label: "Relatórios", icon: FileBarChart },
      { label: "Comercial", icon: BriefcaseBusiness },
      { label: "Financeiro", icon: CircleDollarSign },
      { label: "Custos", icon: CircleDollarSign, view: "costs" },
      { label: "Auditoria", icon: ShieldCheck, view: "audit" },
    ],
  },
];
groups.push({
  label: "Configurações",
  items: [{ label: "Conexões", icon: Link2, view: "connections" }],
});
const mobileItems = groups
  .flatMap((group) => group.items)
  .filter((item) => item.view);
export function AppShell({ userName }: { userName: string }) {
  const [activeView, setActiveView] = useState<View>("overview");
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [selectedClient, setSelectedClient] = useState(
    "b10a1a00-0000-4000-8000-000000000001",
  );
  const firstName = userName.includes("@") ? "Rodrigo" : userName.split(" ")[0];
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const requested = new URLSearchParams(window.location.search).get("view");
      if (requested && views.includes(requested as View)) setActiveView(requested as View);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem("alastre.sidebar.compact");
      const notebook = window.matchMedia("(min-width: 821px) and (max-width: 1180px)").matches;
      setSidebarCompact(saved === null ? notebook : saved === "true");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const toggleSidebar = () => setSidebarCompact((current) => {
    const next = !current;
    window.localStorage.setItem("alastre.sidebar.compact", String(next));
    return next;
  });
  const content =
    activeView === "connections" ? (
      <ConnectionsModule />
    ) : activeView === "local-seo" ? (
      <LocalSeoModule
        clientId={selectedClient}
        onSelectClient={setSelectedClient}
        onOpenConnections={() => setActiveView("connections")}
      />
    ) : activeView === "google-ads" ? (
      <GoogleAdsModule
        clientId={selectedClient}
        onSelectClient={setSelectedClient}
        onBack={() => setActiveView("overview")}
      />
    ) : activeView === "tracking" ? (
      <TrackingModule
        clientId={selectedClient}
        onSelectClient={setSelectedClient}
      />
    ) : activeView === "clients" ? (
      <ClientsModule
        onOpenDna={(id) => {
          setSelectedClient(id);
          setActiveView("dna");
        }}
        onOpenAgent={(id) => {
          setSelectedClient(id);
          setActiveView("agents");
        }}
        onOpenLocalSeo={(id) => {
          setSelectedClient(id);
          setActiveView("local-seo");
        }}
        onOpenConnections={() => setActiveView("connections")}
      />
    ) : activeView === "dna" ? (
      <DnaModule
        clientId={selectedClient}
        onOpenAgent={(id) => {
          setSelectedClient(id);
          setActiveView("agents");
        }}
      />
    ) : activeView === "agents" ? (
      <AgentWorkspace
        clientId={selectedClient}
        onOpenBuilder={(id) => {
          setSelectedClient(id);
          setActiveView("google-ads");
        }}
      />
    ) : activeView === "costs" ? (
      <OperationsModule mode="costs" />
    ) : activeView === "audit" ? (
      <OperationsModule mode="audit" />
    ) : activeView === "approvals" ? (
      <ApprovalsModule />
    ) : (
      <OverviewModule
        firstName={firstName}
        onOpenLocalSeo={() => setActiveView("local-seo")}
        onOpenApprovals={() => setActiveView("approvals")}
        onOpenConnections={() => setActiveView("connections")}
      />
    );
  return (
    <div className={`app-frame${sidebarCompact ? " sidebar-compact" : ""}`}>
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="brand-block">
          <div className="brand-logo-wrap">
            <Image
              src="/alastre-logo.png"
              alt="Alastre Digital"
              fill
              sizes="42px"
              unoptimized
              className="brand-logo"
            />
          </div>
          <div className="brand-copy">
            <strong>ALASTRE</strong>
            <span>OPERAÇÕES</span>
          </div>
        </div>
        <button type="button" className="sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCompact ? "Expandir menu lateral" : "Recolher menu lateral"} title={sidebarCompact ? "Expandir menu lateral" : "Recolher menu lateral"}>
          {sidebarCompact ? <ChevronRight /> : <ChevronLeft />}
        </button>
        <nav className="side-nav grouped-nav">
          {groups.map((group) => (
            <details className="nav-group" key={group.label} open={sidebarCompact || group.items.some((item) => item.view === activeView) || group.label === "Operação"}>
              <summary className="nav-label">{group.label}</summary>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.view === activeView;
                return (
                  <button
                    type="button"
                    key={item.label}
                    className={`nav-item${active ? " is-active" : ""}${item.featured ? " nav-featured" : ""}`}
                    onClick={() => item.view && setActiveView(item.view)}
                    disabled={!item.view}
                    aria-current={active ? "page" : undefined}
                    title={item.view ? item.label : `${item.label} — em breve`}
                  >
                    <Icon />
                    <span>{item.label}</span>
                    {!item.view && <span className="soon-label">Em breve</span>}
                  </button>
                );
              })}
            </details>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="security-line">
            <ShieldCheck />
            <div>
              <strong>Ambiente protegido</strong>
              <span>Homologação privada</span>
            </div>
          </div>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <div className="mobile-symbol">
              <Image
                src="/alastre-logo.png"
                alt=""
                fill
                sizes="31px"
                unoptimized
              />
            </div>
            <strong>ALASTRE</strong>
          </div>
          <div className="environment-pill">
            <span className="live-pulse" />
            Operação segura
          </div>
          <div className="topbar-actions">
            <ThemeSwitcher />
            <div className="user-chip" title={userName}>
              <span>{firstName.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{firstName}</strong>
                <small>Administrador</small>
              </div>
            </div>
          </div>
        </header>
        <div className="mobile-nav" aria-label="Navegação móvel">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const active = item.view === activeView;
            return (
              <button
                type="button"
                key={item.label}
                className={active ? "is-active" : ""}
                onClick={() => item.view && setActiveView(item.view)}
                aria-current={active ? "page" : undefined}
              >
                <Icon />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className="content-wrap">{content}</div>
      </main>
    </div>
  );
}
