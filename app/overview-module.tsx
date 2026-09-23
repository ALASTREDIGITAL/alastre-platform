import { 
  ArrowRight, 
  BarChart3, 
  Building2, 
  CheckCircle2, 
  ClipboardCheck, 
  Link2, 
  MapPinned, 
  ShieldCheck, 
  Sparkles, 
  Zap 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DailySeoQueue } from "@/components/local-seo-operations";
import { PageHeader } from "@/components/page-header";

export function OverviewModule({
  firstName,
  onOpenLocalSeo,
  onOpenApprovals,
  onOpenConnections,
  onOpenClients,
}: {
  firstName: string;
  onOpenLocalSeo: () => void;
  onOpenApprovals: () => void;
  onOpenConnections: () => void;
  onOpenClients?: () => void;
}) {
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Bom dia" : currentHour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="agency-overview overview-simple">
      <div className="overview-header-wrap">
        <PageHeader
          eyebrow={
            <>
              <MapPinned /> VISÃO GERAL EXECUTIVA
            </>
          }
          title={`${greeting}, ${firstName || "Operador"}.`}
          description="Centro de comando unificado. Conecte fontes da agência para monitorar presença local, aprovar campanhas e gerenciar decisões sem ruído."
          helpKey="operations.overview"
        />
        <div className="overview-live-badge" aria-label="Status do sistema">
          <span className="live-pulse-dot" />
          <ShieldCheck />
          <span>Operação Segura · Gravação Protegida</span>
        </div>
      </div>

      <section className="overview-attention" aria-labelledby="attention-title">
        <div className="overview-attention-icon">
          <Zap />
        </div>
        <div className="overview-attention-body">
          <span className="section-kicker">PRÓXIMO PASSO RECOMENDADO</span>
          <h2 id="attention-title">Conecte as primeiras fontes da sua carteira</h2>
          <p>
            Sem uma fonte de dados ativa, a plataforma opera em modo seguro e sem métricas calculadas. 
            Conecte o perfil do Google Meu Negócio ou contas de anúncios para ativar a análise de rankeamento e fila diária.
          </p>
        </div>
        <Button className="btn-hero-action" onClick={onOpenConnections}>
          Configurar conexões <ArrowRight />
        </Button>
      </section>

      <div className="overview-command-grid" aria-label="Acessos rápidos de comando">
        <article className="overview-command-card" onClick={onOpenClients} role="button" tabIndex={0}>
          <div className="card-top">
            <span className="card-icon"><Building2 /></span>
            <span className="card-status-pill">Carteira</span>
          </div>
          <h3>Clientes & DNA</h3>
          <p>Organize dados de negócios, memórias persistentes e informações estruturadas para cada cliente.</p>
          <div className="card-footer">
            <span className="card-action-text">Gerenciar clientes</span>
            <ArrowRight />
          </div>
        </article>

        <article className="overview-command-card" onClick={onOpenLocalSeo} role="button" tabIndex={0}>
          <div className="card-top">
            <span className="card-icon"><MapPinned /></span>
            <span className="card-status-pill highlight">Alta prioridade</span>
          </div>
          <h3>SEO Local & GBP</h3>
          <p>Auditoria de perfil, Local Score, palavras-chave de busca local, avaliações e posts com IA.</p>
          <div className="card-footer">
            <span className="card-action-text">Abrir SEO Local</span>
            <ArrowRight />
          </div>
        </article>

        <article className="overview-command-card" onClick={onOpenApprovals} role="button" tabIndex={0}>
          <div className="card-top">
            <span className="card-icon"><ClipboardCheck /></span>
            <span className="card-status-pill">Fila humana</span>
          </div>
          <h3>Central de Decisões</h3>
          <p>Revise sugestões de conteúdo, respostas de avaliações e alterações estratégicas antes da publicação.</p>
          <div className="card-footer">
            <span className="card-action-text">Ver aprovações</span>
            <ArrowRight />
          </div>
        </article>

        <article className="overview-command-card" onClick={onOpenConnections} role="button" tabIndex={0}>
          <div className="card-top">
            <span className="card-icon"><Link2 /></span>
            <span className="card-status-pill">Segurança</span>
          </div>
          <h3>Conexões & Fontes</h3>
          <p>Gerencie chaves, credenciais de homologação e canais oficiais com isolamento multi-tenant.</p>
          <div className="card-footer">
            <span className="card-action-text">Ver conexões</span>
            <ArrowRight />
          </div>
        </article>
      </div>

      <details className="overview-details disclosure-panel" open>
        <summary>Estrutura operacional diária (SEO Local & Aprovações)</summary>
        <div className="disclosure-content">
          <DailySeoQueue />
          <section className="ops-main-grid">
            <article className="panel priority-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">OPERAÇÃO AUTOMATIZADA</span>
                  <h2>Prioridades do Dia</h2>
                </div>
                <ClipboardCheck />
              </div>
              <div className="ops-empty">
                <strong>Nenhuma prioridade pendente no momento</strong>
                <p>Alertas reais aparecerão automaticamente quando fontes de dados forem sincronizadas.</p>
              </div>
            </article>
            <article className="panel ops-queue">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">DECISÕES CRÍTICAS</span>
                  <h2>Aprovações Agendadas</h2>
                </div>
                <CheckCircle2 />
              </div>
              <p>Conteúdos, posts no GBP e ações que necessitam de decisão humana antes do disparo.</p>
              <Button variant="outline" onClick={onOpenApprovals}>
                Abrir central de aprovações <ArrowRight />
              </Button>
            </article>
          </section>
        </div>
      </details>
    </div>
  );
}

