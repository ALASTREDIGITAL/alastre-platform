# Módulo 06 — Qualidade e Evidências

## Objetivo

Garantir que toda entrega relevante possua critérios claros de qualidade, evidência verificável, revisão adequada ao risco, segregação de responsabilidades e tratamento rastreável de falhas sem depender de narrativa manual.

## Escopo Entregue

1. **Evidências Canônicas Vinculadas à Atividade** (`public.quality_evidences`):
   - Vinculadas diretamente a `work_items` no Motor de Operações (Módulo 04), e quando aplicável ao cliente, unidade, serviço e item de entrega.
   - Suporte aos 8 tipos canônicos: `before_after`, `screenshot`, `url`, `external_id`, `sanitized_payload`, `manual_confirmation`, `automated_validation`, `collection_limitation`.
   - Sanitização automática contra segredos, senhas, chaves de API, Bearer tokens ou payloads sensíveis brutos.

2. **Checklists de Qualidade Versionados** (`public.quality_checklist_templates` e `public.quality_checklist_runs`):
   - Checklists reutilizáveis por tipo de produto, serviço e nível de risco (`low`, `normal`, `high`, `critical`).
   - Critérios individuais com indicação de criticidade, obrigatoriedade, tipo de evidência exigido, responsável pela execução e responsável pela revisão.
   - Bloqueio de conclusão de atividades de alto risco sem critérios e evidências compatíveis.

3. **Revisão e Segregação de Funções (SoD)**:
   - Política de revisão por risco: `mandatory` (obrigatória para `critical` e `high`), `sampled` (amostragem para `normal`) e `optional` (opcional para `low`).
   - Impedimento estrito de autoaprovação: o responsável pela preparação/execução não pode auto-aprovar ou verificar a própria atividade quando a política exigir segregação.

4. **Não Conformidades e Ações Corretivas** (`public.quality_non_conformities`):
   - Registro estruturado com título, severidade, causa raiz e impacto.
   - Criação direta de Ação Corretiva no Motor de Operações (Módulo 04) vinculada à Não Conformidade.
   - Não Conformidades Críticas geram bloqueio operacional impedindo a conclusão do `work_item` até a resolução ou dispensa formal por responsável autorizado.

5. **Proteção contra Mudanças Indevidas e Histórico Imutável** (`public.quality_audit_history`):
   - Evidências ou resultados verificados/trancados (`is_locked = true`) não podem ser sobrescritos silenciosamente.
   - Registro completo de alterações preservando versão anterior, versão nova, autor, data/hora e justificativa, alimentando também `audit_events`.

6. **Consumo por Módulos Futuros (Módulo 07 — Relatórios)**:
   - Estruturas de dados preparadas para consumo direto pelo Módulo 07 sem necessidade de digitação manual de relatórios.
   - Reutilização dos mecanismos nativos da Alastre Platform (`work_items`, `workflows`, `approval_items`, `audit_events`).

7. **Banco de Dados, API e Interface**:
   - Migration forward-only: `supabase/migrations/20260925050000_quality_and_evidence_foundation.sql`.
   - RLS habilitado com revogação total de acessos para `public`, `anon`, `authenticated` (acesso exclusivo por `service_role`).
   - Endpoint API server-side: `POST /api/quality` com validações Zod e `resolveAuthenticatedActor`.
   - Interface completa em `components/quality-module.tsx` com alternância entre Modo Simples (padrão) e Modo Avançado (técnico) e 6 abas funcionais (Fila de Revisões, Evidências, Checklists, Não Conformidades, Correções e Reaberturas, Histórico e Auditoria).

## Trava de Escrita Externa

- `ALASTRE_WRITE_MODE=disabled`: Nenhuma chamada ou escrita externa é disparada para Google, Meta, WhatsApp ou e-mail.
- Ações externas sem verificação permanecem com status `pending` ou `collection_limitation`.
