# Módulo 02 Comercial e CRM

## Objetivo

Transformar a PoC de Prospecção Local em uma Central Comercial operacional, conectada à Fábrica de Produtos e ao restante da plataforma, estruturando um processo comercial rastreável que prioriza clientes adequados, mantém consentimento e entrega uma venda coerente para a operação.

## Fluxo da Esteira Comercial

```text
Empresa identificada
→ pré-análise
→ priorização (Fit, Intenção, Oportunidade)
→ contato autorizado
→ resposta
→ qualificação (8 dimensões)
→ diagnóstico comercial (11 passos estruturados)
→ proposta formal (vinculada à Fábrica de Produtos)
→ negociação (imutável após envio)
→ ganho ou perda (motivo de perda 'preço' com justificativa mandatória)
→ handoff para onboarding (checklist completo de 14 critérios)
```

## Arquitetura e Entidades de Domínio

O domínio comercial foi modelado em `lib/commercial-crm-domain.ts` com tipagem estrita, isolamento por `agency_id` e sem invenções de dados sintéticos:

1. **Separação Rígida de Entidades**:
   - `ProspectCompany`: Empresa identificada ou prospectada.
   - `ProspectContact`: Contatos formais e responsáveis identificados.
   - `CommercialOpportunity`: Ciclo de negociação ativo com estágio, valor estimado, responsável e próxima ação.
   - `SalesHandoff`: Passagem de bastão estruturada para operações.
   - `Client`: Entidade de cliente ativo mantida estritamente no Módulo de Clientes (nenhuma criação automática em ganho).

2. **16 Estágios de Pipeline e Tabela Explícita de Transições**:
   - Estágios: `new`, `researched`, `prioritized`, `contact_ready`, `contacted`, `responded`, `qualified`, `diagnosis_scheduled`, `diagnosis_completed`, `proposal_prepared`, `proposal_sent`, `negotiation`, `closed_won`, `closed_lost`, `nurture`, `disqualified`.
   - Transições controladas por `ALLOWED_OPPORTUNITY_TRANSITIONS`, bloqueando saltos arbitrários.

3. **Matriz de Priorização (Fit, Intenção, Oportunidade)**:
   - `calculatePrioritization`: Avaliação em 3 eixos independentes sem penalizar campos vazios com dados negativos.
   - Níveis resultantes: `alta_prioridade`, `media_prioridade`, `baixa_prioridade`, `descartar`.

4. **Qualificação em 8 Dimensões**:
   - Avalia: `fit`, `problem`, `impact`, `priority`, `decision`, `investment_capacity`, `expectation`, `cooperation`.
   - Classificação: `qualified`, `nurture`, `no_fit`, `high_risk`.
   - Salvaguarda: Expectativas irreais de garantia ou faturamento resultam em `high_risk` automático.

5. **Diagnóstico Comercial Estruturado (11 Passos)**:
   - Valida completude dos 11 passos: Contexto, Situação Atual, Problema Central, Impacto nos Negócios, Histórico de Tentativas, Objetivo Desejado, Diagnóstico Técnico, Gap Identificado, Solução Aderente, Capacidade de Investimento e Próximos Passos de Decisão.

6. **Propostas Comerciais Vinculadas à Fábrica de Produtos**:
   - Vinculação obrigatória com `product_definition_id` e `product_version` de um produto aprovado na Fábrica de Produtos.
   - Descontos exigem justificativa (>= 10 chars) e contrapartida mandatória do cliente (>= 5 chars).
   - Propostas tornam-se imutáveis após o envio (`sent` ou `accepted`). Alterações posteriores exigem a criação de uma nova versão `v+1`.

7. **Motivos de Perda e Inteligência**:
   - 11 códigos padronizados: `sem_orcamento`, `sem_prioridade`, `sem_fit`, `concorrente`, `preco`, `expectativa_incompativel`, `sem_decisor`, `adiado`, `solucao_interna`, `nao_respondeu`, `produto_inadequado`.
   - Salvaguarda mandatória: O motivo `preco` exige explicação detalhada da objeção real com pelo menos 10 caracteres.

8. **Handoff para Onboarding (Sem Criação Automática)**:
   - Checklist de 14 critérios operacionais confirmados.
   - Status: `draft`, `commercial_review`, `operations_review`, `approved_for_onboarding`, `changes_requested`, `blocked`.
   - Aprovação não cria cliente no banco: entrega alinhada e pronta para o futuro Módulo 03 (Onboarding).

9. **Métricas e Previsão Comercial (Forecast)**:
   - Salvaguarda contra dados sintéticos: amostras com menos de 3 oportunidades ou menos de 2 fechamentos exibem explicitamente `status: "insufficient_data"`.
   - Três cenários de previsão declarados: Conservador, Base (mais provável) e Agressivo (teto operacional).

10. **Detecção de Oportunidades Estagnadas (Stale)**:
    - Identifica automaticamente oportunidades com prazo de próxima ação vencido ou inativas há mais de 7 dias.

## Persistência e Banco de Dados

- **Migration**: `supabase/migrations/20260924110000_commercial_crm_foundation.sql`
- **8 Tabelas Criadas**:
  1. `commercial_companies`
  2. `commercial_contacts`
  3. `commercial_opportunities`
  4. `commercial_assessments`
  5. `commercial_diagnoses`
  6. `commercial_proposals`
  7. `commercial_activities`
  8. `commercial_sales_handoffs`
- **Segurança e Isolamento Multiempresa**:
  - Chaves estrangeiras compostas `(agency_id, parent_id)` referenciando `(agency_id, id)`.
  - Índices compostos de suporte e restrições únicas compostas.
  - RLS habilitado em todas as 8 tabelas.
  - Permissões de `anon` e `authenticated` expressamente revogadas.
  - Acesso reservado com exclusividade ao `service_role`.
  - Constraints a nível de banco para próxima ação (`next_action`), prazo (`next_action_deadline`) e detalhamento de perda por preço (`check_price_loss_reason_has_details`).
- **Alinhamento de Modelos**:
  - Drizzle ORM sincronizado em `db/schema.ts`.
  - Tipos TypeScript do Supabase atualizados em `lib/database.types.ts`.

## API Server-Side

- **Endpoint**: `POST /api/commercial` em `app/api/commercial/route.ts`
- **Validação de Schemas**: Zod discricionário via `commercialCrmRequestSchema` em `lib/commercial-crm-api.ts`.
- **19 Ações Operacionais Suportadas**:
  1. `list_companies`
  2. `get_company`
  3. `create_or_update_company`
  4. `list_opportunities`
  5. `get_opportunity_workspace`
  6. `create_opportunity`
  7. `update_opportunity_stage`
  8. `save_prioritization`
  9. `save_qualification`
  10. `save_diagnosis`
  11. `upsert_proposal`
  12. `send_proposal`
  13. `create_proposal_version`
  14. `upsert_activity`
  15. `complete_activity`
  16. `save_handoff`
  17. `submit_handoff_review`
  18. `review_handoff`
  19. `get_metrics_and_forecast`
- **Auditoria e Governança**:
  - Eventos de auditoria gravados em `audit_events` com agente autenticado, IP e metadados sanitizados.
  - Fail-secure: requisições em produção sem autenticação retornam HTTP 401.

## Interface do Usuário

- **Componente**: `app/commercial-module.tsx` integrado ao `AppShell` no grupo **Gestão** com ícone `BriefcaseBusiness` e tag `featured`.
- **10 Abas Especializadas**:
  1. *Visão Geral*: Indicadores do funil, ações prioritárias de hoje, oportunidades estagnadas e alertas.
  2. *Pipeline Kanban*: Visualização das oportunidades organizadas pelas etapas do funil de vendas.
  3. *Oportunidades*: Listagem filtrável por estágio e prioridade, pesquisa e criação de novas oportunidades.
  4. *Empresas*: Base de empresas prospectadas e qualificadas para prospecção comercial.
  5. *Qualificação*: Formulário das 8 dimensões de maturidade comercial com classificação em tempo real.
  6. *Diagnóstico*: Roteiro estruturado de 11 passos para consultores comerciais.
  7. *Propostas*: Elaboração e controle de propostas versionadas, trava de imutabilidade e validação de descontos com contrapartidas.
  8. *Atividades*: Cadência de follow-up, histórico de interações e controle de prazos.
  9. *Inteligência*: Análise de motivos de perda e aprendizados comerciais.
  10. *Forecast & Handoff*: Projeções de receita em 3 cenários e checklist de transição segura para onboarding.
- **Ajuda Contextual**: Integrada via `PageHeader` com o tópico `commercial.overview` e documentada em `lib/help-content.ts`.

## Cobertura de Testes

Quatro suítes de testes automatizados com 100% de aprovação:
1. `tests/commercial-crm-domain.test.ts` (12 testes): Validação de transições de pipeline, integridade, priorização, qualificação, diagnóstico, descontos, motivos de perda, handoff e forecast.
2. `tests/commercial-crm-security.test.ts` (1 teste): Verificação da migration, constraints compostas, RLS e permissões no banco.
3. `tests/commercial-crm-api.test.ts` (3 testes): Testes de fail-secure, validação de requisições malformadas e ciclo de vida operacional ponta a ponta.
4. `tests/commercial-crm-navigation-and-ui.test.ts` (15 testes): Validação da ajuda contextual, montagem no AppShell, contratos de navegação da prospecção e salvaguardas de schemas.
