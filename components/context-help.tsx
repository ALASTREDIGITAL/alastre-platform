"use client";
import { CircleHelp, X } from "lucide-react";
import { HELP_CONTENT, type HelpKey } from "@/lib/help-content";

export function HelpButton({
  helpKey,
  label = "Entenda este módulo",
}: {
  helpKey: HelpKey;
  label?: string;
}) {
  const content = HELP_CONTENT[helpKey];
  return (
    <details className="context-help">
      <summary aria-label={`Ajuda: ${content.title}`}>
        <CircleHelp />
        <span>{label}</span>
      </summary>
      <div className="help-popover" role="note">
        <header>
          <strong>{content.title}</strong>
          <X aria-hidden="true" />
        </header>
        <p>{content.description}</p>
        <dl>
          <div>
            <dt>Por que importa</dt>
            <dd>{content.whyItMatters}</dd>
          </div>
          <div>
            <dt>Próximo passo</dt>
            <dd>{content.nextStep}</dd>
          </div>
        </dl>
      </div>
    </details>
  );
}

export function StatusExplanation({
  helpKey = "status.no_data",
  label,
}: {
  helpKey?: HelpKey;
  label: string;
}) {
  return (
    <span className="status-explanation">
      <span>{label}</span>
      <HelpButton helpKey={helpKey} label="" />
    </span>
  );
}
