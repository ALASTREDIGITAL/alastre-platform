"use client";

import { useState } from "react";
import { Building2, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

export function AgencyOnboardingModal() {
  const { userEmail, completeOnboarding } = useAuth();
  const [agencyName, setAgencyName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!agencyName.trim() || agencyName.trim().length < 2) {
      setFeedback({ type: "error", message: "Informe o nome da sua agência (mínimo 2 caracteres)." });
      return;
    }

    setSubmitting(true);
    try {
      const result = await completeOnboarding(agencyName.trim());
      if (result.success) {
        setFeedback({ type: "success", message: "Ambiente da agência criado com sucesso!" });
      } else {
        setFeedback({ type: "error", message: result.error ?? "Não foi possível registrar a agência." });
      }
    } catch {
      setFeedback({ type: "error", message: "Erro inesperado ao criar agência." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 md:p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-primary uppercase">
              <Sparkles className="h-3.5 w-3.5" />
              SaaS Multi-Agência
            </div>
            <h1 className="text-xl font-bold text-foreground">
              Configurar sua Agência
            </h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Bem-vindo à <strong>Alastre Platform</strong>! Criaremos um ambiente de trabalho exclusivo e isolado para sua agência, onde seus clientes, dados de SEO Local, campanhas e inteligência permanecerão totalmente protegidos.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-lg p-3 text-xs border ${
                feedback.type === "success"
                  ? "border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="agency-name">Nome da sua Agência</Label>
            <Input
              id="agency-name"
              placeholder="Ex.: Agência Crescer Digital"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              disabled={submitting}
              autoFocus
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Conta de e-mail do gestor: <strong>{userEmail}</strong> (definido como Owner).
            </p>
          </div>

          <div className="rounded-xl border bg-muted/40 p-3.5 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Garantias do Ambiente SaaS
            </div>
            <ul className="space-y-1 pl-6 list-disc">
              <li>Isolamento estrito multi-tenant (RLS ativado)</li>
              <li>Escrita externa bloqueada por padrão para segurança total</li>
              <li>Acesso a todos os módulos de SEO Local, DNA e Conexões</li>
            </ul>
          </div>

          <Button
            type="submit"
            className="w-full h-11 gap-2 font-medium text-sm"
            disabled={submitting || !agencyName.trim()}
          >
            {submitting ? "Criando ambiente..." : "Concluir e Acessar Plataforma"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
