import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Link2,
  MapPinned,
  MessageSquareText,
  Search,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DailySeoQueue } from "@/components/local-seo-operations";
import { PageHeader } from "@/components/page-header";

const agencyQueues = [
  {
    label: "Aguardando aprovação",
    detail: "Itens enviados para decisão humana",
    icon: ClipboardCheck,
  },
  {
    label: "Integrações com problema",
    detail: "Conexões que exigem atenção",
    icon: Link2,
  },
  {
    label: "Avaliações sem resposta",
    detail: "Respostas ainda não preparadas",
    icon: MessageSquareText,
  },
  {
    label: "Postagens em revisão",
    detail: "Conteúdos aguardando validação",
    icon: CalendarClock,
  },
  {
    label: "Oportunidades prioritárias",
    detail: "Ações com maior impacto potencial",
    icon: Search,
  },
  {
    label: "Clientes sem conexão",
    detail: "Cadastros que podem ser conectados depois",
    icon: UsersRound,
  },
  {
    label: "Clientes recém-adicionados",
    detail: "Onboardings ainda em preparação",
    icon: UserPlus,
  },
];

export function OverviewModule({
  firstName,
  onOpenLocalSeo,
  onOpenApprovals,
  onOpenConnections,
}: {
  firstName: string;
  onOpenLocalSeo: () => void;
  onOpenApprovals: () => void;
  onOpenConnections: () => void;
}) {
  return (
    <div className="agency-overview">
      <PageHeader
        eyebrow={
          <>
            <MapPinned /> CENTRAL DE OPERAÇÕES
          </>
        }
        title={`Boa noite, ${firstName}.`}
        description="Aqui está o que precisa da sua atenção. A plataforma mostra somente dados reais e explica o próximo passo."
        helpKey="operations.overview"
        actions={
          <Button onClick={onOpenLocalSeo}>
            Abrir SEO Local <ArrowRight />
          </Button>
        }
      />
      <section className="panel agency-attention">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">ATENÇÃO HOJE</span>
            <h2>Visão da agência</h2>
          </div>
          <AlertTriangle />
        </div>
        <div className="agency-queue-grid">
          {agencyQueues.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label}>
                <Icon />
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
                <b>Sem dados</b>
              </article>
            );
          })}
        </div>
      </section>
      <DailySeoQueue />
      <section className="ops-main-grid">
        <article className="panel priority-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">OPERAÇÃO POR EXCEÇÃO</span>
              <h2>Prioridades consolidadas</h2>
            </div>
            <AlertTriangle />
          </div>
          <div className="ops-empty">
            <ClipboardCheck />
            <strong>Nenhuma prioridade calculada</strong>
            <p>
              Alertas reais aparecerão aqui quando clientes, serviços e fontes
              estiverem disponíveis.
            </p>
            <Button variant="outline" onClick={onOpenLocalSeo}>
              Preparar SEO Local
            </Button>
          </div>
        </article>
        <article className="panel ops-queue">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">FLUXO HUMANO</span>
              <h2>Aprovações</h2>
            </div>
            <CheckCircle2 />
          </div>
          <div className="queue-summary">
            <strong>Sem dados</strong>
            <span>
              Avaliações, postagens e campanhas aguardando decisão serão
              consolidadas nesta fila.
            </span>
          </div>
          <Button variant="outline" onClick={onOpenApprovals}>
            Abrir aprovações <ArrowRight />
          </Button>
        </article>
      </section>
      <section className="panel connection-overview">
        <div>
          <span className="section-kicker">CONEXÕES</span>
          <h2>Google aguardando liberação</h2>
          <p>
            A integração está sendo preparada pela Alastre. Nenhuma ação do
            usuário é necessária agora.
          </p>
        </div>
        <Button variant="outline" onClick={onOpenConnections}>
          <Link2 /> Ver conexões
        </Button>
      </section>
    </div>
  );
}
