# Módulo 04 — Motor de Operações

## Objetivo

Executar implantação e recorrência por meio de workflows padronizados, mensuráveis e reutilizáveis entre serviços, com controle rigoroso de SLA, dependências, bloqueios e capacidade operacional.

## Escopo Entregue

- **Templates e Workspaces**: Workspaces e definições de serviços padronizados por agência (`operations_workspaces` e `operations_service_definitions`).
- **Instâncias e Itens de Trabalho**: Gestão completa de tarefas únicas e recorrentes (`operations_work_items`) vinculadas a agência, cliente, unidade e serviço contratado.
- **Transição de Estados e Dependências**: RPC PostgreSQL atômica (`operations_transition_work_item`) para movimentação de status (`pending`, `in_progress`, `blocked`, `completed`, `cancelled`), validando resolução obrigatória de dependências prévias.
- **SLA e Gestão de Prazos**: Políticas de SLA configuráveis (`operations_sla_policies`) por prioridade (`urgent`, `high`, `medium`, `low`) com detecção de violação e cálculo de horas restantes.
- **Bloqueios e Registro de Divergência**: Registro formal de motivos de bloqueio (ex.: aguardando cliente, dependência externa) com desbloqueio rastreável e auditado.
- **Apontamento e Estimativas**: Rastreamento de tempo estimado vs. tempo realizado (`estimated_minutes` vs. `actual_minutes`) para retroalimentar capacidade e custos.
- **Filas e Visões Operacionais**: Fila de "Atenção de Hoje" (atrasados e urgentes), visão por responsável, cliente e serviço.
- **Reutilização do Ecossistema**: Integração completa com `audit_events`, `approval_items` e segregação por agência (`agency_id`).

## Estrutura de Banco de Dados

- **Migration**: `supabase/migrations/20260924150000_operations_engine_foundation.sql` (aplicada em homologação Supabase `fifbtwbndutbvwnbzgtz`).
- **Tabelas**:
  - `operations_workspaces`: Ambientes/agrupamentos de trabalho por agência.
  - `operations_service_definitions`: Catálogo de templates de serviços operacionais.
  - `operations_work_items`: Itens operacionais com status, SLA, datas, dependências e apontamento de esforço.
  - `operations_sla_policies`: Definições de prazos por criticidade e tipo de serviço.
- **Segurança e RLS**:
  - RLS ativado em 100% das tabelas com políticas restritas a `agency_id = current_setting('app.current_agency_id')`.
  - RPC com `SECURITY DEFINER` e `search_path = public, pg_temp`.
  - Permissões concedidas exclusivamente ao `service_role`; acesso público revogado.

## API Server-Side

- **Endpoint**: `POST /api/operations` (`app/api/operations/route.ts`).
- **Ações Disponíveis**:
  - `list_workspaces` / `upsert_workspace`
  - `list_service_definitions` / `upsert_service_definition`
  - `list_work_items` / `create_work_item` / `transition_work_item`
  - `list_sla_policies` / `upsert_sla_policy`
  - `get_operations_summary`
- **Autenticação e RBAC**: `resolveAuthenticatedActor` obrigatório; `agency_id` do payload é desconsiderado em prol do tenant autenticado.

## Interface de Usuário

- **Componente**: `app/operations-engine-module.tsx`.
- **Modo Simples (Padrão)**: Fila operacional amigável, cartões de tarefas com indicadores claros de SLA e ações diretas de transição.
- **Modo Avançado**: Visualização detalhada de dependências, payloads JSON, IDs de correlação e políticas de SLA.
- **Abas**:
  1. *Filas de Trabalho*: Lista filtrável por status, prioridade e responsável.
  2. *Atenção & Atrasos*: Foco imediato em tarefas com SLA estourado ou bloqueios ativos.
  3. *Workspaces*: Gestão dos núcleos de execução operacional.
  4. *Políticas de SLA*: Parâmetros de atendimento por criticidade.
  5. *Métricas & Capacidade*: Resumo de itens concluídos, em andamento e esforço apontado.
- **Navegação**: Conectado ao `AppShell` no grupo **Operações** com ícone `Kanban` e badge de destaque.

## Cobertura de Testes

- 4 suítes com 25 testes automatizados:
  - `tests/operations-domain.test.ts` (10 testes)
  - `tests/operations-security.test.ts` (1 teste abrangente de tenant e RBAC)
  - `tests/operations-api.test.ts` (4 testes de integração de API)
  - `tests/operations-navigation-and-ui.test.ts` (10 testes de navegação e renderização)
- Marco de validação global: **281/281 testes aprovados (100% pass)**.
