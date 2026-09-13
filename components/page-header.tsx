import type { ReactNode } from "react";
import { HelpButton } from "@/components/context-help";
import type { HelpKey } from "@/lib/help-content";

export function PageHeader({
  eyebrow,
  title,
  description,
  helpKey,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  description: string;
  helpKey: HelpKey;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-header-actions">
        {actions}
        <HelpButton helpKey={helpKey} />
      </div>
    </header>
  );
}
