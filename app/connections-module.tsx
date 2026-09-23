"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  Building2,
  Check,
  ChevronRight,
  CircleHelp,
  Cloud,
  Link2,
  Mail,
  Settings2,
  ShieldCheck,
  Signature,
  Unplug,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { clientServiceCatalog } from "@/lib/client-services";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import {
  googleCloudAdministration,
  providers,
  type ProviderAvailabilityStatus,
  type ProviderDefinition,
} from "@/lib/connection-hub-domain";

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
    // Ignore
  }
  return fetch(url, { ...init, headers });
}

const icons = {
  google: Cloud,
  meta: Users,
  alastre_ai: BrainCircuit,
  electronic_signature: Signature,
  email: Mail,
};
const onboardingSteps = [
  "Dados da empresa",
  "DNA da empresa",
  "Conexões",
  "Serviços contratados",
  "Revisão",
  "Cliente pronto",
];
type GoogleConfiguration = {
  configured: boolean;
  providerAvailability: ProviderAvailabilityStatus;
  health: string;
  connectionManagementMode: "platform_managed";
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  redirectUriConfigured: boolean;
};
const pendingGoogle: GoogleConfiguration = {
  configured: false,
  providerAvailability: "pending_provider_approval",
  health: "provider_pending",
  connectionManagementMode: "platform_managed",
  clientIdConfigured: false,
  clientSecretConfigured: false,
  redirectUriConfigured: false,
};

function ProviderCard({
  provider,
  onOpen,
  google,
  connected = false,
}: {
  provider: ProviderDefinition;
  onOpen: (provider: ProviderDefinition) => void;
  google: GoogleConfiguration;
  connected?: boolean;
}) {
  const Icon = icons[provider.key],
    included = provider.availability === "included",
    isGoogle = provider.key === "google",
    pending =
      isGoogle && google.providerAvailability === "pending_provider_approval";
  const status = connected
    ? "Conta conectada"
    : pending
      ? "Aguardando liberação"
      : included
        ? "Incluída no sistema"
        : provider.availability === "planned"
          ? "Em breve"
          : "Não conectado";
  return (
    <article className="connection-card">
      <div className={`provider-mark ${provider.key}`}>
        <Icon />
      </div>
      <div className="connection-card-copy">
        <span>{provider.group}</span>
        <h2>{provider.name}</h2>
        <p>{provider.description}</p>
        <div className="connection-status">
          <i
            className={included || connected ? "ok" : pending ? "pending" : ""}
          />
          <strong>{status}</strong>
        </div>
      </div>
      <Button variant="outline" onClick={() => onOpen(provider)}>
        {connected
          ? "Gerenciar"
          : pending
            ? "Ver status"
            : included
              ? "Ver serviços"
              : provider.availability === "planned"
                ? "Conhecer"
                : "Conectar"}
        <ChevronRight />
      </Button>
    </article>
  );
}

type HubResource = {
  id: string;
  capability: string;
  resource_type: string;
  display_name: string;
  metadata?: Record<string, unknown>;
};
type HubClient = { id: string; name: string };
function GoogleResources() {
  const [resources, setResources] = useState<HubResource[]>([]),
    [clients, setClients] = useState<HubClient[]>([]),
    [clientId, setClientId] = useState(""),
    [message, setMessage] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [hubResponse, clientsResponse] = await Promise.all([
        authFetch("/api/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "connections" }),
          signal,
        }),
        authFetch("/api/platform", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clients" }),
          signal,
        }),
      ]);
      const hub = (await hubResponse.json().catch(() => null)) as {
          resources?: unknown;
        } | null,
        clientPayload = await clientsResponse.json().catch(() => null);
      if (signal?.aborted) return;
      const locations = Array.isArray(hub?.resources)
        ? hub.resources.filter(
            (item): item is HubResource =>
              typeof item === "object" &&
              item !== null &&
              "id" in item &&
              "resource_type" in item &&
              (item as HubResource).resource_type ===
                "google_business_location",
          )
        : [];
      const validClients = Array.isArray(clientPayload)
        ? clientPayload.filter(
            (item): item is HubClient =>
              typeof item === "object" &&
              item !== null &&
              typeof (item as HubClient).id === "string" &&
              typeof (item as HubClient).name === "string",
          )
        : [];
      setResources(locations);
      setClients(validClients);
      setClientId((current) => current || validClients[0]?.id || "");
    } catch {
      if (!signal?.aborted) {
        setResources([]);
        setClients([]);
      }
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);
  const bind = async (resourceId: string) => {
    if (!clientId) return;
    setMessage("");
    try {
      const response = await authFetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bind_resource",
          client_id: clientId,
          resource_id: resourceId,
          capability: "google_business_profile",
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: unknown };
      } | null;
      setMessage(
        response.ok
          ? "Perfil vinculado ao cliente com segurança."
          : typeof body?.error?.message === "string"
            ? body.error.message
            : "Não foi possível vincular este perfil.",
      );
    } catch {
      setMessage("Não foi possível vincular este perfil.");
    }
  };
  return (
    <section className="resource-picker">
      <div>
        <span className="section-kicker">PERFIS ENCONTRADOS</span>
        <h3>Escolha o Perfil da Empresa</h3>
        <p>
          Somente perfis descobertos pela conta Google podem ser vinculados.
        </p>
      </div>
      {resources.length ? (
        <>
          <label>
            Cliente
            <select
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <div className="resource-list">
            {resources.map((resource) => (
              <article key={resource.id}>
                <div>
                  <strong>{resource.display_name}</strong>
                  <span>
                    {typeof resource.metadata?.address === "string"
                      ? resource.metadata.address
                      : "Endereço não informado"}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!clientId}
                  onClick={() => void bind(resource.id)}
                >
                  Vincular
                </Button>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="resource-empty">
          Nenhum Perfil da Empresa descoberto ainda.
        </div>
      )}
      {message && <p className="resource-message">{message}</p>}
    </section>
  );
}

export function ConnectionsModule() {
  const [mode, setMode] = useState<"simple" | "advanced">("simple"),
    [selected, setSelected] = useState<ProviderDefinition | null>(null),
    [notice, setNotice] = useState(""),
    [connecting, setConnecting] = useState(false),
    [google, setGoogle] = useState<GoogleConfiguration>(pendingGoogle),
    [googleConnected, setGoogleConnected] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void authFetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "providers" }),
      signal: controller.signal,
    })
      .then(async (response) => ({
        ok: response.ok,
        body: (await response.json().catch(() => null)) as {
          google?: Partial<GoogleConfiguration>;
        } | null,
      }))
      .then(({ ok, body }) => {
        if (!controller.signal.aborted && ok && body?.google)
          setGoogle({ ...pendingGoogle, ...body.google });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (google.providerAvailability !== "ready_for_oauth") {
        setGoogleConnected(false);
        return;
      }
      void authFetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connections" }),
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: unknown) => {
          if (controller.signal.aborted) return;
          const items =
            typeof body === "object" &&
            body !== null &&
            "items" in body &&
            (body as { items?: unknown }).items;
          setGoogleConnected(
            Array.isArray(items) &&
              items.some(
                (item) =>
                  typeof item === "object" &&
                  item !== null &&
                  "provider" in item &&
                  "status" in item &&
                  (item as { provider: unknown }).provider === "google" &&
                  (item as { status: unknown }).status === "connected",
              ),
          );
        })
        .catch(() => {
          if (!controller.signal.aborted) setGoogleConnected(false);
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [google.providerAvailability]);
  const connectGoogle = async () => {
    if (google.providerAvailability !== "ready_for_oauth") return;
    setConnecting(true);
    setNotice("");
    try {
      const response = await authFetch("/api/connections/google/authorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ return_path: "/?view=connections" }),
        }),
        body = (await response.json().catch(() => null)) as {
          authorization_url?: unknown;
          error?: { message?: unknown };
        } | null;
      if (response.ok && typeof body?.authorization_url === "string") {
        window.location.assign(body.authorization_url);
        return;
      }
      setNotice(
        typeof body?.error?.message === "string"
          ? body.error.message
          : "Google ainda precisa ser configurado pela Alastre.",
      );
    } catch {
      setNotice(
        "Não foi possível iniciar a conexão Google. Tente novamente mais tarde.",
      );
    } finally {
      setConnecting(false);
    }
  };
  const googlePending =
    google.providerAvailability === "pending_provider_approval";
  return (
    <div className="connections-page">
      <PageHeader
        eyebrow={<><Link2 /> CONFIGURAÇÕES · CONEXÕES</>}
        title="Conecte suas ferramentas"
        description="Escolha o serviço. A Alastre orienta o próximo passo e cuida da configuração técnica."
        helpKey="connections.overview"
        actions={<div
          className="mode-switch"
          role="group"
          aria-label="Nível de detalhes"
        >
          <button
            className={mode === "simple" ? "active" : ""}
            onClick={() => setMode("simple")}
          >
            Modo simples
          </button>
          <button
            className={mode === "advanced" ? "active" : ""}
            onClick={() => setMode("advanced")}
          >
            <Settings2 />
            Modo avançado
          </button>
        </div>}
      />
      {mode === "advanced" && <>
      <section className="connection-health-strip">
        <span>
          <ShieldCheck />
        </span>
        <div>
          <strong>Central de conexões protegida</strong>
          <p>Nenhuma credencial é exibida ou solicitada nesta tela.</p>
        </div>
        <div className="health-summary">
          <i className="pending" /> Google aguardando liberação · nenhuma ação
          necessária
        </div>
      </section>
      <section className="onboarding-panel panel">
        <div className="onboarding-head">
          <div>
            <span className="section-kicker">ONBOARDING DE CLIENTE</span>
            <h2>Do cadastro à operação, sem bloqueios</h2>
            <p>Conexões indisponíveis podem ser configuradas depois.</p>
          </div>
          <Building2 />
        </div>
        <ol className="connection-steps six">
          {onboardingSteps.map((step, index) => (
            <li key={step} className={index === 0 ? "current" : ""}>
              <span>{index === 0 ? <Check /> : index + 1}</span>
              <strong>{step}</strong>
              {index < onboardingSteps.length - 1 && <ArrowRight />}
            </li>
          ))}
        </ol>
        <div className="service-preview">
          {Object.entries(clientServiceCatalog).map(([key, service]) => (
            <article key={key}>
              <Check />
              <div>
                <strong>{service.name}</strong>
                <span>Ativar ou configurar depois</span>
              </div>
            </article>
          ))}
        </div>
      </section>
      </>}
      <section>
        <div className="connection-section-heading">
          <div>
            <span className="section-kicker">PROVEDORES</span>
            <h2>Suas conexões</h2>
          </div>
          <details className="connection-help">
            <summary>
              <CircleHelp /> Como funciona?
            </summary>
            <div>
              Você entra com sua conta, escolhe a empresa e a vincula ao cliente
              certo. A Alastre cuida da parte técnica.
            </div>
          </details>
        </div>
        <div className="connection-grid">
          {providers.filter((provider) => mode === "advanced" || ["google", "meta", "alastre_ai"].includes(provider.key)).map((provider) => (
            <ProviderCard
              key={provider.key}
              provider={provider}
              google={google}
              connected={provider.key === "google" && googleConnected}
              onOpen={(item) => {
                setNotice("");
                setSelected(item);
              }}
            />
          ))}
        </div>
      </section>
      {mode === "advanced" && (
        <section className="advanced-panel panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">MODO AVANÇADO</span>
              <h2>Diagnóstico administrativo seguro</h2>
            </div>
            <ShieldCheck />
          </div>
          <div className="advanced-grid google-admin">
            <div>
              <span>Projeto Google Cloud</span>
              <strong>{googleCloudAdministration.projectName}</strong>
            </div>
            <div>
              <span>Project ID</span>
              <strong>{googleCloudAdministration.projectId}</strong>
            </div>
            <div>
              <span>Project Number</span>
              <strong>{googleCloudAdministration.projectNumber}</strong>
            </div>
            <div>
              <span>Solicitação GBP</span>
              <strong>{googleCloudAdministration.gbpAccessRequest}</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong>Aguardando aprovação do Google</strong>
            </div>
            <div>
              <span>OAuth Client</span>
              <strong>
                {google.clientIdConfigured ? "Configurado" : "Não configurado"}
              </strong>
            </div>
            <div>
              <span>Redirect URI local</span>
              <strong>{googleCloudAdministration.redirectUri}</strong>
            </div>
            <div>
              <span>Write mode</span>
              <strong>disabled</strong>
            </div>
          </div>
          <p>
            Gerenciamento pela plataforma. Tokens, chaves e segredos nunca são
            exibidos.
          </p>
        </section>
      )}
      {selected && (
        <div
          className="connection-drawer-backdrop"
          role="presentation"
          onMouseDown={() => setSelected(null)}
        >
          <aside
            className="connection-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`Configurar ${selected.name}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="drawer-close"
              onClick={() => setSelected(null)}
              aria-label="Fechar"
            >
              ×
            </button>
            <span className="section-kicker">{selected.group}</span>
            <h2>{selected.name}</h2>
            <div
              className={`drawer-status ${googlePending && selected.key === "google" ? "provider-pending" : ""}`}
            >
              <Unplug />
              <div>
                <strong>
                  {selected.key === "google" && googleConnected
                    ? "Conta Google conectada"
                    : selected.key === "google" && googlePending
                      ? "Aguardando liberação"
                      : selected.availability === "included"
                        ? "Incluída no sistema"
                        : selected.availability === "planned"
                          ? "Em breve"
                          : "Não conectado"}
                </strong>
                <p>
                  {selected.key === "google" && googlePending
                    ? "A integração com o Google está sendo preparada pela Alastre. Nenhuma ação é necessária agora."
                    : selected.description}
                </p>
              </div>
            </div>
            {selected.key === "google" && googlePending && (
              <div className="simple-provider-summary">
                <strong>Quando estiver disponível, você poderá:</strong>
                <ul>
                  <li>Entrar com sua conta Google</li>
                  <li>Escolher a empresa e o Perfil Google</li>
                  <li>Vincular o perfil ao cliente correto</li>
                </ul>
                <span>Ação necessária agora: nenhuma.</span>
              </div>
            )}
            {selected.capabilities.length > 0 && (
              <div className="capability-list">
                {selected.capabilities.map((cap) => (
                  <div key={cap.key}>
                    <span>
                      <Check />
                    </span>
                    <div>
                      <strong>{cap.name}</strong>
                      <p>{cap.help}</p>
                      {mode === "advanced" && <code>{cap.key}</code>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selected.key === "google" && googleConnected && (
              <GoogleResources />
            )}
            <Button
              disabled={
                selected.availability === "planned" ||
                connecting ||
                (selected.key === "google" && googlePending)
              }
              onClick={() =>
                selected.key === "google"
                  ? void connectGoogle()
                  : setNotice(
                      "A IA Alastre já está incluída. A gestão de plano virá em uma etapa futura.",
                    )
              }
            >
              {connecting
                ? "Preparando conexão..."
                : selected.key === "google" && googlePending
                  ? "Aguardando liberação"
                  : selected.availability === "included"
                    ? "Gerenciar no futuro"
                    : selected.availability === "planned"
                      ? "Disponível em breve"
                      : googleConnected
                        ? "Reconectar Google"
                        : "Conectar Google"}
            </Button>
            {notice && (
              <div className="drawer-notice">
                <ShieldCheck />
                {notice}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
