"use client";
import {
  BarChart3,
  BrainCircuit,
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
  Images,
  Kanban,
  ScanSearch,
  Compass,
  PackagePlus,
  UserCheck,
  Workflow as WorkflowIcon,
  HeartPulse,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ThemeSwitcher } from "./theme-switcher";
import { GoogleAdsModule } from "./google-ads-module";
import { ApprovalsModule } from "./approvals-module";
import { ClientsModule } from "./clients-module";
import { DnaModule } from "./dna-module";
import { AgentWorkspace } from "./agent-workspace";
import { OperationsModule } from "./operations-module";
import { TrackingModule } from "./tracking-module";
import { LocalSeoModule } from "./local-seo-module";
import { PreAuditModule } from "./pre-audit-module";
import { ProspectingModule } from "./prospecting-module";
import { ProductFactoryModule } from "./product-factory-module";
import { CommercialModule } from "./commercial-module";
import { OverviewModule } from "./overview-module";
import { ConnectionsModule } from "./connections-module";
import { SkillsModule } from "./skills-module";
import { ImageGeotagModule } from "./image-geotag-module";
import { ClientJourneyModule } from "./client-journey-module";
import { ClientOnboardingModule } from "./client-onboarding-module";
import { OperationsEngineModule } from "./operations-engine-module";
import { QualityModuleApp } from "./quality-module";
import { ClientSuccessModule } from "./client-success-module";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { placeholderConfigs } from "@/components/placeholder-configs";
import { useAuth } from "@/lib/auth-context";
import { AgencyOnboardingModal } from "@/components/agency-onboarding-modal";
export type View =
  | "overview"
  | "operations-engine"
  | "quality"
  | "product-factory"
  | "clients"
  | "client-journey"
  | "client-onboarding"
  | "dna"
  | "prospecting"
  | "pre-audit"
  | "local-seo"
  | "google-ads"
  | "meta-ads"
  | "tracking"
  | "image-geotag"
  | "sites-seo"
  | "reports"
  | "commercial"
  | "finance"
  | "agents"
  | "approvals"
  | "costs"
  | "audit"
  | "connections"
  | "skills"
  | "client-success";
const views: View[] = [
  "overview",
  "operations-engine",
  "quality",
  "product-factory",
  "clients",
  "client-journey",
  "client-onboarding",
  "dna",
  "prospecting",
  "pre-audit",
  "local-seo",
  "google-ads",
  "meta-ads",
  "tracking",
  "image-geotag",
  "sites-seo",
  "reports",
  "commercial",
  "finance",
  "agents",
  "approvals",
  "costs",
  "audit",
  "connections",
  "skills",
  "client-success",
];
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
      {
        label: "Motor de Operações",
        icon: WorkflowIcon,
        view: "operations-engine",
        featured: true,
      },
      {
        label: "Qualidade e Evidências",
        icon: ShieldCheck,
        view: "quality",
        featured: true,
      },
      { label: "Aprovações", icon: CheckCircle2, view: "approvals" },
      { label: "Agentes", icon: Bot, view: "agents" },
    ],
  },
  {
    label: "Produtos",
    items: [
      {
        label: "Fábrica de Produtos",
        icon: PackagePlus,
        view: "product-factory",
        featured: true,
      },
    ],
  },
  {
    label: "Clientes",
    items: [
      { label: "Clientes", icon: Users, view: "clients" },
      { label: "Sucesso do Cliente", icon: HeartPulse, view: "client-success", featured: true },
      { label: "Esteira do Cliente", icon: Kanban, view: "client-journey", featured: true },
      { label: "Onboarding de Clientes", icon: UserCheck, view: "client-onboarding", featured: true },
      { label: "DNA e memória", icon: Fingerprint, view: "dna" },
    ],
  },
  {
    label: "Prospecção",
    items: [
      {
        label: "Central de Prospecção",
        icon: Compass,
        view: "prospecting",
        featured: true,
      },
    ],
  },
  {
    label: "Auditoria",
    items: [
      {
        label: "Pré-Análise",
        icon: ScanSearch,
        view: "pre-audit",
        featured: true,
      },
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
      { label: "Meta Ads", icon: BarChart3, view: "meta-ads" },
      { label: "GTM e GA4", icon: Waypoints, view: "tracking" },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { label: "Geotag de imagens", icon: Images, view: "image-geotag" },
      { label: "Sites & SEO", icon: Store, view: "sites-seo" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Relatórios", icon: FileBarChart, view: "reports" },
      { label: "Comercial", icon: BriefcaseBusiness, view: "commercial", featured: true },
      { label: "Financeiro", icon: CircleDollarSign, view: "finance" },
      { label: "Custos", icon: CircleDollarSign, view: "costs" },
      { label: "Auditoria do Sistema", icon: ShieldCheck, view: "audit" },
    ],
  },
  {
    label: "Configurações",
    items: [
      { label: "Conexões", icon: Link2, view: "connections" },
      { label: "Inteligência e Skills", icon: BrainCircuit, view: "skills" },
    ],
  },
];
const mobileItems = groups
  .flatMap((group) => group.items)
  .filter((item) => item.view);
const viewLabels = Object.fromEntries(
  mobileItems.map((item) => [item.view, item.label]),
) as Partial<Record<View, string>>;
export function AppShell({ userName, initialView }: { userName: string; initialView?: string }) {
  const { agency, actor, needsOnboarding } = useAuth();
  const [activeView, setActiveView] = useState<View>(() => {
    if (initialView && views.includes(initialView as View)) {
      return initialView as View;
    }
    if (typeof window !== "undefined") {
      const requested = new URLSearchParams(window.location.search).get("view");
      if (requested && views.includes(requested as View)) {
        return requested as View;
      }
    }
    return "overview";
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Operação": true,
    "Produtos": true,
    "Prospecção": true,
    "Auditoria": true,
    "SEO Local": true,
    "Gestão": true,
  });
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const firstName = userName.includes("@") ? "Rodrigo" : userName.split(" ")[0];

  const navigateToView = useCallback((view: View) => {
    setActiveView(view);
    const parentGroup = groups.find((g) => g.items.some((item) => item.view === view));
    if (parentGroup) {
      setOpenGroups((prev) => ({ ...prev, [parentGroup.label]: true }));
    }
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", view);
      window.history.pushState({ view }, "", url.toString());
      const workspace = document.querySelector(".workspace");
      if (workspace) {
        workspace.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, []);

  const toggleGroup = useCallback((groupLabel: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupLabel]: !prev[groupLabel],
    }));
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const requested = new URLSearchParams(window.location.search).get("view");
      if (requested && views.includes(requested as View)) {
        setActiveView(requested as View);
        const parentGroup = groups.find((g) => g.items.some((item) => item.view === requested));
        if (parentGroup) {
          setOpenGroups((prev) => ({ ...prev, [parentGroup.label]: true }));
        }
      } else {
        setActiveView("overview");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const requested = new URLSearchParams(window.location.search).get("view");
      if (requested && views.includes(requested as View)) {
        setActiveView(requested as View);
        const parentGroup = groups.find((g) => g.items.some((item) => item.view === requested));
        if (parentGroup) {
          setOpenGroups((prev) => ({ ...prev, [parentGroup.label]: true }));
        }
      }
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
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem("alastre.selectedClient");
      if (saved) setSelectedClient(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const selectClient = useCallback((id: string) => {
    setSelectedClient(id);
    window.localStorage.setItem("alastre.selectedClient", id);
  }, []);
  const toggleSidebar = () => setSidebarCompact((current) => {
    const next = !current;
    window.localStorage.setItem("alastre.sidebar.compact", String(next));
    return next;
  });
  const content =
    activeView === "product-factory" ? (
      <ProductFactoryModule onNavigate={navigateToView} />
    ) : activeView === "prospecting" ? (
      <ProspectingModule onNavigate={navigateToView} />
    ) : activeView === "pre-audit" ? (
      <PreAuditModule onNavigate={navigateToView} />
    ) : activeView === "image-geotag" ? (
      <ImageGeotagModule clientId={selectedClient} onSelectClient={selectClient} />
    ) : activeView === "skills" ? (
      <SkillsModule />
    ) : activeView === "connections" ? (
      <ConnectionsModule />
    ) : activeView === "local-seo" ? (
      <LocalSeoModule
        clientId={selectedClient}
        onSelectClient={selectClient}
        onOpenConnections={() => navigateToView("connections")}
      />
    ) : activeView === "google-ads" ? (
      <GoogleAdsModule
        clientId={selectedClient}
        onSelectClient={selectClient}
        onBack={() => navigateToView("overview")}
        onOpenConnections={() => navigateToView("connections")}
      />
    ) : activeView === "tracking" ? (
      <TrackingModule
        clientId={selectedClient}
        onSelectClient={selectClient}
        onOpenConnections={() => navigateToView("connections")}
      />
    ) : activeView === "clients" ? (
      <ClientsModule
        onOpenDna={(id) => {
          setSelectedClient(id);
          navigateToView("dna");
        }}
        onOpenAgent={(id) => {
          setSelectedClient(id);
          navigateToView("agents");
        }}
        onOpenLocalSeo={(id) => {
          setSelectedClient(id);
          navigateToView("local-seo");
        }}
        onOpenJourney={(id) => {
          setSelectedClient(id);
          navigateToView("client-journey");
        }}
        onOpenConnections={() => navigateToView("connections")}
      />
    ) : activeView === "client-journey" ? (
      <ClientJourneyModule
        clientId={selectedClient}
        onSelectClient={selectClient}
        onNavigate={navigateToView}
      />
    ) : activeView === "client-onboarding" ? (
      <ClientOnboardingModule onNavigate={navigateToView} />
    ) : activeView === "dna" ? (
      <DnaModule
        clientId={selectedClient}
        onOpenClients={() => navigateToView("clients")}
        onOpenAgent={(id) => {
          setSelectedClient(id);
          navigateToView("agents");
        }}
        onOpenJourney={(id) => {
          setSelectedClient(id);
          navigateToView("client-journey");
        }}
      />
    ) : activeView === "agents" ? (
      <AgentWorkspace
        clientId={selectedClient}
        onOpenClients={() => navigateToView("clients")}
        onOpenBuilder={(id) => {
          setSelectedClient(id);
          navigateToView("google-ads");
        }}
      />
    ) : activeView === "meta-ads" ? (
      <ModulePlaceholder
        config={placeholderConfigs["meta-ads"]}
        icon={BarChart3}
        onNavigate={(view) => navigateToView(view as View)}
      />
    ) : activeView === "sites-seo" ? (
      <ModulePlaceholder
        config={placeholderConfigs["sites-seo"]}
        icon={Store}
        onNavigate={(view) => navigateToView(view as View)}
      />
    ) : activeView === "reports" ? (
      <ModulePlaceholder
        config={placeholderConfigs.reports}
        icon={FileBarChart}
        onNavigate={(view) => navigateToView(view as View)}
      />
    ) : activeView === "commercial" ? (
      <CommercialModule onNavigate={navigateToView} />
    ) : activeView === "finance" ? (
      <ModulePlaceholder
        config={placeholderConfigs.finance}
        icon={CircleDollarSign}
        onNavigate={(view) => navigateToView(view as View)}
      />
    ) : activeView === "operations-engine" ? (
      <OperationsEngineModule />
    ) : activeView === "quality" ? (
      <QualityModuleApp onNavigate={(view) => navigateToView(view as View)} />
    ) : activeView === "client-success" ? (
      <ClientSuccessModule onNavigate={(view) => navigateToView(view as View)} selectedClientId={selectedClient} />
    ) : activeView === "costs" ? (
      <OperationsModule mode="costs" />
    ) : activeView === "audit" ? (
      <OperationsModule mode="audit" />
    ) : activeView === "approvals" ? (
      <ApprovalsModule onOpenConnections={() => navigateToView("connections")} />
    ) : (
      <OverviewModule
        firstName={firstName}
        onOpenLocalSeo={() => navigateToView("local-seo")}
        onOpenApprovals={() => navigateToView("approvals")}
        onOpenConnections={() => navigateToView("connections")}
        onOpenClients={() => navigateToView("clients")}
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
            <strong>{agency?.name ?? "ALASTRE"}</strong>
            <span>{actor?.role ? `${actor.role.toUpperCase()} · OPERAÇÕES` : "OPERAÇÕES"}</span>
          </div>
        </div>
        <button type="button" className="sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCompact ? "Expandir menu lateral" : "Recolher menu lateral"} title={sidebarCompact ? "Expandir menu lateral" : "Recolher menu lateral"}>
          <span className="sidebar-toggle-icons" aria-hidden="true">
            <ChevronLeft className="sidebar-toggle-collapse" />
            <ChevronRight className="sidebar-toggle-expand" />
          </span>
        </button>
        <nav className="side-nav grouped-nav">
          {groups.map((group) => {
            const isOpen = sidebarCompact || (openGroups[group.label] ?? false);
            const singleItem = group.items.length === 1 && group.items[0]?.view ? group.items[0] : null;
            const hasActiveItem = group.items.some((item) => item.view === activeView);

            return (
              <div className="nav-group" key={group.label}>
                <button
                  type="button"
                  className={`nav-group-header${hasActiveItem ? " group-has-active" : ""}`}
                  onClick={() => {
                    if (singleItem?.view) {
                      navigateToView(singleItem.view);
                      setOpenGroups((prev) => ({ ...prev, [group.label]: true }));
                    } else {
                      toggleGroup(group.label);
                    }
                  }}
                  aria-expanded={isOpen}
                  title={isOpen ? `Recolher ${group.label}` : `Expandir ${group.label}`}
                >
                  <span className="nav-label">{group.label}</span>
                  <span className="nav-group-chevron" aria-hidden="true">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                {isOpen && (
                  <div className="nav-group-items">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = item.view === activeView;
                      return (
                        <button
                          type="button"
                          key={item.label}
                          className={`nav-item${active ? " is-active" : ""}${item.featured ? " nav-featured" : ""}`}
                          onClick={() => item.view && navigateToView(item.view)}
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
                  </div>
                )}
              </div>
            );
          })}
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
          <div className="workspace-context" aria-live="polite">
            <span>Alastre Platform /</span>
            <strong>{viewLabels[activeView] ?? "Operação"}</strong>
          </div>
          <div className="environment-pill">
            <span className="live-pulse" />
            Operação segura
          </div>
          <div className="topbar-actions">
            <ThemeSwitcher />
            <div className="user-chip" title={actor?.email ?? userName}>
              <span>{(actor?.email ?? firstName).slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{agency?.name ? `${firstName} · ${agency.name}` : firstName}</strong>
                <small>{actor?.role ? actor.role.toUpperCase() : "Operador"}</small>
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
                onClick={() => item.view && navigateToView(item.view)}
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
      {needsOnboarding && <AgencyOnboardingModal />}
    </div>
  );
}
