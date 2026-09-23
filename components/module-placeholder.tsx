"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowRight, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

export type PlaceholderConfig = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  badge: string;
  expectedFeatures: Array<{
    title: string;
    detail: string;
  }>;
  actionHint?: string;
  ctaLabel?: string;
  ctaView?: string;
};

export function ModulePlaceholder({
  config,
  icon: Icon,
  onNavigate,
}: {
  config: PlaceholderConfig;
  icon: LucideIcon;
  onNavigate?: (view: string) => void;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5 font-semibold text-xs tracking-wider uppercase">
            <Icon className="h-3.5 w-3.5 text-primary" />
            {config.eyebrow}
          </span>
        }
        title={config.title}
        description={config.description}
        helpKey="operations.overview"
        actions={
          <Badge variant="outline" className="h-7 px-3 text-xs gap-1.5 font-medium">
            <Clock className="h-3 w-3 text-amber-500" />
            {config.badge}
          </Badge>
        }
      />

      <div className="rounded-2xl border bg-card p-6 md:p-8 shadow-xs">
        <div className="max-w-3xl space-y-6">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3 text-primary shrink-0">
              <Icon className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">
                O que este módulo trará para a operação
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Este módulo faz parte do catálogo de serviços da Alastre Platform e está estruturado na arquitetura do monólito. Enquanto a interface dedicada é finalizada, as operações continuam protegidas e governadas pelo DNA do Cliente e Connection Hub.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            {config.expectedFeatures.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border bg-muted/40 p-4 space-y-1.5 transition-colors hover:bg-muted/70"
              >
                <div className="flex items-center gap-2 font-medium text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{feature.title}</span>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  {feature.detail}
                </p>
              </div>
            ))}
          </div>

          {config.actionHint && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed bg-background/50 p-4 mt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <span>{config.actionHint}</span>
              </div>
              {config.ctaLabel && config.ctaView && onNavigate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate(config.ctaView!)}
                  className="gap-1.5"
                >
                  {config.ctaLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
