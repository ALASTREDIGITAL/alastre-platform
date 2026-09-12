"use client";

import { RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";

export function IntegrationState({
  title = "Integração ainda não conectada",
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
        <span className="section-kicker">CONEXÃO SEGURA</span>
        <h2>{title}</h2>
        <p>{message}</p>
        <span className="integration-state-safety"><ShieldCheck aria-hidden="true" /> Escrita externa continua bloqueada</span>
      </div>
      {onRetry ? <Button variant="outline" onClick={onRetry}><RefreshCw aria-hidden="true" /> Tentar novamente</Button> : null}
    </section>
  );
}
