"use client";

import type { LucideIcon } from "lucide-react";
import { CircleHelp, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";

export function IntegrationState({
  title = "Dados ainda não conectados",
  message = "Este módulo ficará disponível quando a conexão deste ambiente for configurada. Nenhuma ação externa foi realizada.",
  onRetry,
  compact = false,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <section className={`panel integration-state${compact ? " compact" : ""}`} role="status" aria-live="polite">
      <span className="integration-state-icon"><Unplug aria-hidden="true" /></span>
      <div>
        <span className="section-kicker">CONEXÃO</span>
        <h2>{title}</h2>
        <p>{message}</p>
        <span className="integration-state-safety"><ShieldCheck aria-hidden="true" /> Escrita externa continua bloqueada</span>
      </div>
      {onRetry ? <Button variant="outline" onClick={onRetry}><RefreshCw aria-hidden="true" /> Tentar novamente</Button> : null}
    </section>
  );
}

export function DecisionState({ icon: Icon = CircleHelp, title, message, actionLabel, onAction, secondaryLabel, onSecondary }: {
  icon?: LucideIcon; title: string; message: string; actionLabel?: string; onAction?: () => void; secondaryLabel?: string; onSecondary?: () => void;
}) {
  return <section className="panel decision-state" role="status"><span className="decision-state-icon"><Icon aria-hidden="true" /></span><div><h2>{title}</h2><p>{message}</p>{(actionLabel&&onAction)||(secondaryLabel&&onSecondary)?<div className="decision-state-actions">{actionLabel&&onAction?<Button onClick={onAction}>{actionLabel}</Button>:null}{secondaryLabel&&onSecondary?<Button variant="outline" onClick={onSecondary}>{secondaryLabel}</Button>:null}</div>:null}</div></section>;
}
