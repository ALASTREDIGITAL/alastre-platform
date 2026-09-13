"use client";

import { useMemo, useState } from "react";
import { BookOpen, BrainCircuit, CheckCircle2, ChevronRight, Search, ShieldCheck, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { skillRegistry, skillWorkflows, statusLabels, type SkillRecord, type SkillStatus } from "@/lib/skills-registry";

const statuses: Array<"all" | SkillStatus> = ["all", "active", "installed", "audited", "disabled", "rejected", "incompatible"];

export function SkillsModule() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("all");
  const [advanced, setAdvanced] = useState(false);
  const [selected, setSelected] = useState<SkillRecord | null>(null);
  const visible = useMemo(() => skillRegistry.filter((skill) => {
    const matchStatus = status === "all" || skill.status === status;
    const text = `${skill.name} ${skill.category} ${skill.purpose} ${skill.triggers.join(" ")}`.toLowerCase();
    return matchStatus && text.includes(query.trim().toLowerCase());
  }), [query, status]);

  return (
    <section className="skills-page layout-fluid">
      <PageHeader
        eyebrow="CONFIGURAÇÕES · INTELIGÊNCIA"
        title="Skills"
        description="Guias que ajudam a inteligência da plataforma a aplicar o padrão certo em cada tipo de trabalho. A escolha acontece automaticamente."
        helpKey="skills.overview"
        actions={<div className="view-switch"><button className={!advanced ? "is-active" : ""} onClick={() => setAdvanced(false)}>Simples</button><button className={advanced ? "is-active" : ""} onClick={() => setAdvanced(true)}>Avançado</button></div>}
      />

      <div className="skills-summary">
        <span><BrainCircuit /></span>
        <div><strong>{skillRegistry.filter((item) => item.status === "active").length} recursos ativos</strong><p>Skills orientam o trabalho; ferramentas validam a interface. Nenhum deles substitui aprovações.</p></div>
        <div className="skills-safety"><ShieldCheck /> Governança no repositório</div>
      </div>

      <div className="skills-toolbar">
        <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, área ou uso" /></label>
        <div className="review-filters" aria-label="Filtrar por status">{statuses.map((item) => <button key={item} className={status === item ? "is-active" : ""} onClick={() => setStatus(item)}>{item === "all" ? "Todas" : statusLabels[item]}</button>)}</div>
      </div>

      <div className="skills-grid">
        {visible.map((skill) => (
          <button className="skill-card" key={skill.id} onClick={() => setSelected(skill)}>
            <header><span className={`skill-status status-${skill.status}`}>{statusLabels[skill.status]}</span><small>{skill.category}</small></header>
            <h2>{skill.name}</h2><p>{skill.purpose}</p>
            <p className="skill-when"><strong>Quando é usada:</strong> {skill.triggers.slice(0, 3).join(" · ")}</p>
            <footer><span>{skill.scope}</span><span>Ver detalhes <ChevronRight /></span></footer>
          </button>
        ))}
      </div>
      {!visible.length && <div className="skills-empty"><Search /><strong>Nenhuma skill encontrada</strong><p>Ajuste a busca ou escolha outro status.</p></div>}

      <section className="skills-workflows">
        <div className="panel-heading"><span className="section-kicker">COMBINAÇÕES AUTOMÁTICAS</span><h2>Como trabalham em conjunto</h2><p>O tipo de pedido define a sequência. Você não precisa memorizar nomes.</p></div>
        <div>{skillWorkflows.map((workflow) => <article key={workflow.name}><BookOpen /><strong>{workflow.name}</strong><ol>{workflow.steps.map((step) => <li key={step}>{step}</li>)}</ol></article>)}</div>
      </section>

      {selected && <div className="skill-drawer-backdrop" role="presentation" onMouseDown={() => setSelected(null)}><aside className="skill-drawer" role="dialog" aria-modal="true" aria-label={`Detalhes de ${selected.name}`} onMouseDown={(event) => event.stopPropagation()}>
        <button className="drawer-close" aria-label="Fechar" onClick={() => setSelected(null)}><X /></button>
        <span className="section-kicker">{selected.category}</span><h2>{selected.name}</h2><p>{selected.purpose}</p>
        <dl><div><dt>Status</dt><dd>{statusLabels[selected.status]}</dd></div><div><dt>Escopo</dt><dd>{selected.scope}</dd></div>{advanced && <><div><dt>ID</dt><dd>{selected.id}</dd></div><div><dt>Origem</dt><dd>{selected.origin}</dd></div><div><dt>Versão / commit</dt><dd>{selected.version}</dd></div><div><dt>Caminho</dt><dd>{selected.path}</dd></div><div><dt>Licença</dt><dd>{selected.license}</dd></div><div><dt>Scripts / hooks</dt><dd>{selected.scriptsHooks}</dd></div><div><dt>Dependências</dt><dd>{selected.dependencies}</dd></div><div><dt>Compatibilidade</dt><dd>{selected.compatibility}</dd></div><div><dt>Uso</dt><dd>{selected.invocation}</dd></div></>}</dl>
        <h3>Quando entra em ação</h3><div className="skill-tags">{selected.triggers.map((trigger) => <span key={trigger}>{trigger}</span>)}</div>
        <div className="skill-risk"><CheckCircle2 /><div><strong>Limites e segurança</strong><p>{selected.risks}</p><p><b>Não usar:</b> {selected.whenNot}</p><p><b>Dependências:</b> {selected.dependencies} · <b>Seleção:</b> {selected.invocation}</p></div></div>
        <Button variant="outline" onClick={() => setSelected(null)}>Entendi</Button>
      </aside></div>}
    </section>
  );
}
