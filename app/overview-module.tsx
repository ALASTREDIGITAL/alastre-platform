import { ArrowRight, BarChart3, CheckCircle2, ClipboardCheck, Link2, MapPinned, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DailySeoQueue } from "@/components/local-seo-operations";
import { PageHeader } from "@/components/page-header";

export function OverviewModule({ firstName, onOpenLocalSeo, onOpenApprovals, onOpenConnections }: {
  firstName: string;
  onOpenLocalSeo: () => void;
  onOpenApprovals: () => void;
  onOpenConnections: () => void;
}) {
  return (
    <div className="agency-overview overview-simple">
      <PageHeader eyebrow={<><MapPinned /> VISÃO GERAL</>} title={`Boa noite, ${firstName}.`} description="Comece conectando as fontes da agência. Depois, esta tela reúne somente o que realmente precisa da sua decisão." helpKey="operations.overview" />
      <section className="overview-attention" aria-labelledby="attention-title">
        <div className="overview-attention-icon"><Link2 /></div>
        <div><span className="section-kicker">PRÓXIMO PASSO</span><h2 id="attention-title">Conecte a primeira fonte de dados</h2><p>Sem uma conexão ativa, ainda não há prioridades reais para mostrar. A Alastre orienta a configuração e mantém seus dados protegidos.</p></div>
        <Button onClick={onOpenConnections}>Ver conexões <ArrowRight /></Button>
      </section>
      <div className="overview-sections">
        <section className="overview-row">
          <div className="overview-row-icon"><UsersRound /></div>
          <div><span className="section-kicker">CLIENTES</span><h2>Sua carteira aparecerá aqui</h2><p>Clientes conectados e aqueles que precisam de atenção serão organizados em uma única lista.</p></div>
          <span className="quiet-status">Aguardando dados</span>
        </section>
        <section className="overview-row">
          <div className="overview-row-icon"><BarChart3 /></div>
          <div><span className="section-kicker">DESEMPENHO</span><h2>Ainda não calculado</h2><p>Resultados serão exibidos somente quando houver evidências suficientes.</p></div>
          <Button variant="ghost" onClick={onOpenLocalSeo}>Conhecer SEO Local <ArrowRight /></Button>
        </section>
      </div>
      <details className="overview-details disclosure-panel">
        <summary>Ver estrutura operacional</summary>
        <div className="disclosure-content">
          <DailySeoQueue />
          <section className="ops-main-grid">
            <article className="panel priority-panel"><div className="panel-heading"><div><span className="section-kicker">OPERAÇÃO</span><h2>Prioridades</h2></div><ClipboardCheck /></div><div className="ops-empty"><strong>Nenhuma prioridade calculada</strong><p>Alertas reais aparecerão quando clientes e fontes estiverem disponíveis.</p></div></article>
            <article className="panel ops-queue"><div className="panel-heading"><div><span className="section-kicker">DECISÕES</span><h2>Aprovações</h2></div><CheckCircle2 /></div><p>Conteúdos e ações que precisam de decisão humana serão reunidos aqui.</p><Button variant="outline" onClick={onOpenApprovals}>Abrir aprovações <ArrowRight /></Button></article>
          </section>
        </div>
      </details>
    </div>
  );
}
