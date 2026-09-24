# Módulo 01 — Fábrica de Produtos

## Objetivo

Transformar o conhecimento tácito, a capacidade operacional e os custos da Alastre Platform em produtos estruturados, executáveis e economicamente verificáveis antes da criação de qualquer oferta comercial, precificação ou promessa ao cliente.

O foco inicial é o produto canônico **SEO Local e Google Business Profile (GBP)**.

---

## Escopo Implementado

1. **Entrevista Operacional Progressiva (Discovery)**:
   - Limite estrito de no máximo 7 perguntas por rodada (regra inquebrável).
   - Classificação explícita de informação: `fato` (declarado), `evidência` (comprovada), `inferência` (dedução lógica), `hipótese` (suposição) e `lacuna` (ausência de informação).
   - Identificação de lacunas impeditivas (`is_blocking_gap`) que afetam a viabilidade.
   - Capacidade de pausar, salvar respostas parciais e retomar rodadas sem perda de contexto.

2. **Matriz de Escopo Operacional**:
   - Separação mandatória entre **Implantação (Setup)** e **Recorrência Mensal (Monthly)**.
   - Cada atividade possui tempo estimado (minutos), nível de automação (0–100%), ferramental necessário, critério de aceite e evidência obrigatória de entrega.
   - Classificação operacional: `manual` (humano puro), `ai_assisted` (assistido por IA com revisão humana) ou `automated` (automação viável).
   - Totalizadores automáticos de horas de setup, horas mensais e percentual médio automatizável.

3. **SOPs e Matriz RACI**:
   - Associação de cada item de escopo a pelo menos um Procedimento Operacional Padrão (SOP).
   - SOP detalhado com condição de disparo (gatilho), insumos requeridos, checklist passo a passo, saída esperada, desvios comuns e evidência mandatória.
   - Matriz RACI completa por atividade: **R**esponsável, **A**provador (Accountable), **C**onsultado e **I**nformado.
   - Suporte explícito a papéis futuros (`is_future_role = true`), permitindo planejar a evolução da equipe sem quebrar a operação presente.

4. **Checkpoint de Viabilidade e Salvaguardas**:
   - Cálculo automático de viabilidade técnica e operacional (Score 0 a 100).
   - Bloqueio explícito (`blocked`) quando existirem lacunas impeditivas não resolvidas.
   - Estados de viabilidade: `blocked`, `ready_for_estimation` ou `ready_for_human_review`.
   - **Salvaguarda Crítica**: Nenhum preço, pacote comercial ou promessa de resultado externo pode ser gerado antes que o checkpoint seja validado e aprovado por um humano.

5. **Versionamento e Imutabilidade**:
   - Cada produto possui ciclo de vida: `draft` -> `in_review` -> `approved` -> `superseded` / `archived`.
   - Versões com status `approved` tornam-se estritamente **imutáveis** (`is_immutable = true`).
   - Alterações exigem a geração de uma nova versão (`v+1`), preservando o histórico da versão anterior.

6. **Produto Canônico Inicial: SEO Local & Google Business Profile**:
   - Pacote canônico completo cadastrado por padrão com perguntas de descoberta, matriz de escopo (setup inicial + rotina mensal recorrente), SOPs operacionais e matriz RACI.

---

## Arquitetura de Domínio e Contratos

- **Arquivo de Domínio**: `lib/product-factory-domain.ts`
  - Contratos TypeScript puros, sem efeitos colaterais.
  - Funções de cálculo de totais (`calculateScopeTotals`), cálculo de viabilidade (`calculateViabilityCheckpoint`), validação do limite de 7 perguntas (`validateSevenQuestionLimit`), classificação de informação (`classifyInformation`), salvaguarda de preços (`preventPrematurePricing`) e transições de versão (`createNextVersion`).
- **Validação e Tipagem de API**: `lib/product-factory-api.ts`
  - Schemas Zod para 12 ações server-side.
  - Cliente de consumo tipado `callProductFactoryApi`.

---

## Banco de Dados e Persistência

- **Migration**: `supabase/migrations/20260924100000_product_factory_foundation.sql`
- **Schema Drizzle (SQLite/D1)**: `db/schema.ts`
- **Tabelas Criadas**:
  1. `product_definitions`: Metadados do produto, versão, slug, categoria e flag de imutabilidade. Unique em `(agency_id, slug, version)`.
  2. `product_discovery_sessions`: Sessão de entrevista progressiva da operação, rodada atual e notas.
  3. `product_scope_items`: Itens de escopo com separação setup/recorrência, tempos e automação.
  4. `product_operational_sops`: Procedimentos operacionais padronizados com checklists e desvios.
  5. `product_raci_assignments`: Matriz RACI com suporte a papéis operacionais futuros.
  6. `product_viability_checkpoints`: Histórico e snapshot de checkpoints calculados e bloqueios.
- **Segurança de Dados e Isolamento Multi-Tenant**:
  - Row Level Security (RLS) habilitado em 100% das tabelas.
  - Permissões de `anon` e `authenticated` revogadas no schema público; operações permitidas exclusivamente para `service_role`.
  - **Atenção sobre RLS**: As policies `service_role using (true)` NÃO oferecem isolamento por tenant; elas apenas restringem o acesso ao backend confiável, impedindo clientes externos diretos.
  - O isolamento multiempresa é garantido em profundidade por:
    1. **Chaves estrangeiras compostas obrigatórias no banco**: `(agency_id, parent_id)` referenciando `(agency_id, id)` nas tabelas de produto, descoberta, escopo, SOPs, RACI, checkpoints e clientes, tornando estruturalmente impossível relacionar registros entre agências distintas no PostgreSQL.
    2. **Resolução de Ator Server-Side**: Validação mandatória de `actor.agencyId` na camada de API em todas as rotas e queries, rejeitando qualquer tentativa de acesso cross-tenant.

---

## API Server-Side

- **Endpoint**: `POST /api/product-factory` (`app/api/product-factory/route.ts`)
- **Ações Disponíveis**:
  - `list_products`: Lista produtos da agência autenticada.
  - `get_product_workspace`: Carrega produto, descoberta, escopo, SOPs, RACI e checkpoint.
  - `create_product`: Cria rascunho de novo produto.
  - `save_discovery_round`: Salva rodada de descoberta (máx. 7 perguntas validadas).
  - `upsert_scope_item`: Cria ou edita item de escopo (rejeita edição em versão imutável).
  - `delete_scope_item`: Remove item de escopo de versão editável.
  - `upsert_sop`: Cria ou edita SOP operacional.
  - `upsert_raci`: Registra papéis RACI com indicação de papel futuro.
  - `calculate_viability`: Recalcula e persiste o checkpoint de viabilidade.
  - `submit_for_review`: Submete a versão do produto para a Central de Aprovações (`approval_items`).
  - `approve_product`: Aprova versão (torna imutável `is_immutable = true`).
  - `create_new_version`: Cria nova versão incremental `v+1` baseada na versão aprovada.
- **Auditoria**:
  - Todo evento de mutação relevante registra log em `audit_events` com `agency_id`, ator e payload sanitizado.

---

## Interface e Experiência do Operador

- **Componente**: `app/product-factory-module.tsx`
- **Shell**: Integrado à barra de navegação no grupo **Produtos** com o ícone `PackagePlus`.
- **Modo Simples (Padrão)**:
  - Foco em linguagem acessível e clara.
  - Resumo de viabilidade visual (score, lacunas impeditivas e recomendação).
  - Navegação fluida entre Descoberta, Escopo, SOPs e Viabilidade.
- **Modo Avançado (Progressive Disclosure)**:
  - Exibição de identificadores de tenant, granularidade de RACI com papéis futuros, auditoria e controle de versões.
- **Ajuda Contextual**:
  - Integrado ao registro `lib/help-content.ts` com a chave `product_factory.overview`.

---

## Testes Automatizados

O módulo conta com suíte de testes completa cobrindo domínio, banco, segurança, API e UI:

1. `tests/product-factory-domain.test.ts` (7 testes):
   - Limite estrito de 7 perguntas por rodada.
   - Classificação de informação (fato, evidência, inferência, hipótese, lacuna).
   - Cálculo de escopo (setup vs recorrência).
   - Cálculo de viabilidade e bloqueio por lacuna impeditiva.
   - Validação de ciclo de vida e imutabilidade de versões aprovadas.
   - Criação de nova versão incremental.
   - Suporte a papéis futuros no RACI.
2. `tests/product-factory-security.test.ts` (1 teste):
   - Integridade da migration SQL: RLS, isolation por agency_id, revogação de acessos públicos.
3. `tests/product-factory-api.test.ts` (4 testes):
   - Fail-secure para requisições não autenticadas.
   - Validação de payloads com Zod.
   - Validação do limite de 7 perguntas na API.
   - Ciclo operacional ponta a ponta (criação, descoberta, escopo, SOPs, RACI, viabilidade e versionamento).
4. `tests/product-factory-navigation-and-ui.test.ts` (3 testes):
   - Contrato de navegação no `AppShell` (grupo "Produtos", ícone `PackagePlus`, rota `product-factory`).
   - Salvaguardas visuais, separação de abas e proteção de precificação.
   - Registro de ajuda contextual `product_factory.overview`.
