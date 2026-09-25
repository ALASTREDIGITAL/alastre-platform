# Módulo 03 Onboarding de Clientes

## Objetivo

Converter uma venda aprovada (`approved_for_onboarding`) em um cliente operacional ativo com acessos, contexto, baseline factual, responsabilidades atribuídas e critérios de ativação claros, assegurando isolamento rigoroso por agência, transações atômicas sem registros órfãos e salvaguardas explícitas contra promessas comerciais abusivas e dados sintéticos.

## Fluxo Operacional da Central de Onboarding

```text
Handoff Comercial Aprovado (Módulo 02)
→ Início Idempotente do Onboarding (draft)
→ Conferência Comercial da Venda (awaiting_commercial_review)
   ├─ Se divergência ou promessa fora de escopo → Bloqueado (blocked)
   └─ Se aprovado → Conferência Operacional (awaiting_operations_review)
→ Criação Transacional de Cliente & Unidade Sede (awaiting_client_information)
→ Cadastro de Unidades Adicionais (Filiais & Áreas de Atendimento com Raio km)
→ Coleta de Informações, Documentos e Contatos (12 requisitos padrão)
   ├─ Validação com Evidência Registrada
   └─ Dispensa Formal com Justificativa Obrigatória (>= 5 caracteres)
→ Coleta e Vinculação de Acessos via Connection Hub (collecting_access)
→ Construção e Confirmação do DNA Compartilhado (building_dna)
→ Estabelecimento de Baseline Factual sem Zeros Sintéticos (establishing_baseline)
→ Geração do Plano de Implantação derivado do Produto (planning_implementation)
→ Auditoria do Checklist Objetivo de 11 Critérios de Ativação (ready_for_activation)
→ Submissão para Aprovação Humana da Liderança
→ Aprovação Final e Virada de Chave para Recorrência (active)
```

## Arquitetura e Entidades de Domínio

O domínio de Onboarding foi implementado em `lib/client-onboarding-domain.ts` com tipagem estrita, isolamento por `agency_id`, foreign keys compostas e sem qualquer simulação de dados:

1. **Separação Rígida de Entidades**:
   - `ClientOnboarding`: Instância do processo de implantação com ciclo de vida, snapshot comercial, metadados e atores responsáveis.
   - `ClientUnit`: Unidades operacionais (sede, filial, centro de área de atendimento) com modelo de atendimento (loja física vs área), raio em km, endereço e vínculo ao Google Business Profile.
   - `OnboardingRequirement`: Requisitos canônicos de coleta organizados em 12 categorias com responsável, prazo, evidência textual/URL e dispensa com justificativa documentada.
   - `OnboardingBaseline`: Diagnóstico factual de entrada (Local Score observado, nota média GBP, contagem de reviews, pendências de resposta, notas de posicionamento e limitações de coleta declaradas). Proibição expressa de zeros inventados.
   - `ImplementationPlan`: Atividades de setup sequenciais derivadas do produto formal, tempos estimados em minutos e responsáveis alocados.
   - `OnboardingDecision`: Trilha de auditoria imutável registrando conferências comerciais, divergências com motivo, dispensas justificadas e autorizações de ativação.

2. **12 Estágios de Ciclo de Vida e Tabela Estrita de Transições**:
   - Estágios: `draft`, `awaiting_commercial_review`, `awaiting_operations_review`, `awaiting_client_information`, `collecting_access`, `building_dna`, `establishing_baseline`, `planning_implementation`, `ready_for_activation`, `active`, `blocked`, `cancelled`.
   - Transições controladas por `ALLOWED_ONBOARDING_TRANSITIONS`, impedindo avanços arbitrários sem os marcos precedentes.

3. **Conferência da Venda e Salvaguardas Anti-Promessas (`validateSalesConference`)**:
   - Valida correspondência exata com produto e versão aprovados na Fábrica de Produtos.
   - Detecta e rejeita termos proibidos no handoff comercial, tais como `"primeiro lugar"`, `"número 1"`, `"ranking garantido"` ou promessas de leads e ligações sem base demonstrável.

4. **12 Requisitos Padrão de Coleta (`generateDefaultRequirements`)**:
   - Abrange: Dados cadastrais/NAP, Contatos de emergência/decisores, Identidade visual/Logotipo, Catálogo de produtos/serviços, Unidades e horários, Fotos reais, Acesso GBP (Connection Hub), Termos de consentimento, Metas realistas, Restrições da marca, Histórico e Concorrentes conhecidos.
   - Dispensa exige justificativa detalhada e não vazia.

5. **Salvaguarda do Baseline (`validateBaselineData`)**:
   - Rejeita notas fora do intervalo [1.0, 5.0], escores negativos e campos zerados sem evidência de coleta.
   - Declaração obrigatória de limitações de coleta quando ferramentas ou dados históricos prévios forem inacessíveis.

6. **Checklist Objetivo de 11 Critérios de Ativação (`calculateActivationChecklist`)**:
   1. Venda conferida e aprovada sem divergências.
   2. Cliente criado e validado no catálogo.
   3. Unidades operacionais cadastradas (sede/filiais).
   4. Serviços contratados habilitados (`client_services`).
   5. DNA mínimo confirmado na memória compartilhada.
   6. Acessos essenciais conectados ou com dispensa justificada.
   7. Baseline inicial factual estabelecido e versionado.
   8. Plano de implantação gerado a partir do produto.
   9. Responsáveis operacionais alocados.
   10. Ausência de bloqueios ou divergências pendentes.
   11. Aprovação humana da liderança registrada.

## Persistência e Banco de Dados

- **Migration**: `supabase/migrations/20260924120000_client_onboarding_foundation.sql`
- **Projeto Supabase Homologação**: `fifbtwbndutbvwnbzgtz` (aplicada e confirmada via `npx supabase db push`)
- **6 Tabelas Criadas**:
  1. `client_onboardings`
  2. `client_units`
  3. `client_onboarding_requirements`
  4. `client_onboarding_baselines`
  5. `client_onboarding_plans`
  6. `client_onboarding_decisions`
- **Constraints Multi-Tenant**: Foreign keys compostas em todas as relações filhas: `(agency_id, parent_id)`.
- **Constraint Atualizado**: `approval_items.source_type` expandido para incluir `client_onboarding_activation`.
- **Segurança e RLS**:
  - `alter table ... enable row level security` nas 6 tabelas.
  - `revoke all on ... from public, anon, authenticated` em todas as tabelas.
  - `grant select, insert, update, delete ... to service_role`.
  - Security Advisors do Supabase (`supabase db advisors --linked`): 0 erros e 0 alertas de segurança.

## API Server-side e Transações Atômicas

- **Contratos Zod**: `lib/client-onboarding-api.ts` define 16 schemas estritos com união discriminada (`action`), validando tipos, intervalos e regras de negócio na fronteira HTTP.
- **Rota Principal**: `app/api/client-onboarding/route.ts`
  - `start_from_handoff`: Inicia processo com verificação de idempotência por handoff e bloqueio de handoffs não aprovados.
  - `review_sales`: Registra conferência comercial e avança para revisão operacional.
  - `record_divergence`: Bloqueia o processo sem criar cliente quando houver promessas comerciais abusivas.
  - `create_or_link_client_transactional`: Transação atômica que cria o cliente em `public.clients`, a unidade sede em `public.client_units`, o serviço em `public.client_services`, o DNA em `public.client_dna_profiles`, vincula requisitos e grava log em `audit_events` com rollback defensivo em caso de erro.
  - `upsert_unit`: Cadastra filiais adicionais vinculadas à agência e ao cliente.
  - `update_requirement`: Valida comprovantes de requisitos ou exige justificativa formal para dispensa.
  - `save_baseline`: Persiste diagnóstico inicial factual versionado.
  - `generate_plan`: Deriva atividades de implantação e calcula tempos totais de setup em minutos.
  - `submit_activation`: Submete o onboarding conferido para o gate de aprovação da liderança.
  - `approve_activation`: Registra aprovação formal humana, atualiza status para `active` e grava `activated_at`.

## Interface da Central de Onboarding

Implementada em `app/client-onboarding-module.tsx` e conectada ao `app/app-shell.tsx`:

- **Modo Simples (Padrão)**: Linguagem direta, clara para operadores, badges semânticos e ações guiadas.
- **Modo Avançado (Toggle)**: Expõe identificadores UUID, snapshots JSON de propostas, tempos em minutos técnicos e trilha raw de auditoria.
- **10 Áreas Funcionais (Abas)**:
  1. `overview`: Contadores gerais, listagem filtrável por status/busca e seleção de onboarding ativo.
  2. `sales_scope`: Conferência da proposta comercial, preços de setup/mensalidade e botões de aprovar ou registrar divergência.
  3. `company_units`: Formulário transacional de criação de cliente/sede e tabela de filiais com raio em km.
  4. `information_collection`: Acompanhamento de coleta de dados, fotos e documentos com validação de comprovantes.
  5. `access_connections`: Gestão de acessos GBP e conexão via Connection Hub.
  6. `dna_construction`: Visualização e confirmação dos pilares de identidade, tom de voz e restrições.
  7. `baseline_setup`: Formulário factual de Local Score, avaliações, notas de visibilidade e lacunas declaradas.
  8. `implementation_plan`: Atividades de setup com tempo estimado em minutos, responsáveis e cronograma.
  9. `readiness_checklist`: Painel com os 11 critérios objetivos de ativação e botão de aprovação final.
  10. `history_decisions`: Timeline imutável de auditoria e decisões tomadas.
- **Tratamento de Estados**: Cobertura completa de loading (esqueletos/spinners), vazio (empty states orientativos), parcial (avisos de lacunas), erro (alertas com retry), não autorizado (401) e indisponível (500).
- **Ajuda Contextual**: Conectada a 7 tópicos em `lib/help-content.ts` via `PageHeader` (`helpKey="client_onboarding.overview"`).

## Hardening de Segurança, Autenticação e Ativação Atômica (2026-09-24)

- **Eliminação de Fallback Inseguro**: Removidos completamente os fallbacks em memória e valores estáticos (`actor_local`, agência `00000000-0000-0000-0000-000000000001`, role `operator`). Todas as requisições passam por `resolveAuthenticatedActor`:
  - Banco configurado + resolução de ator falha: **403 Forbidden**.
  - Banco indisponível ou configuração ausente em produção: **503 Service Unavailable**.
  - Armazenamento em memória restrito exclusivamente a desenvolvimento e testes locais.
  - O campo `agency_id` do payload é estritamente ignorado em favor da agência autenticada do ator.
- **RBAC Centralizado e Segregação de Funções (SoD)**:
  - Implementado em `lib/permissions.ts` e `lib/rbac.ts`.
  - Ativação (`approve_activation`), cancelamento e desbloqueio restritos a `owner`, `admin` e `operations_lead`.
  - Operadores (`operator`) e visualizadores (`viewer`) são terminantemente impedidos de aprovar ativações (SoD).
- **Activation Gate Real**:
  - `approve_activation` recalcula os 11 critérios de prontidão a partir do estado fresco do banco/armazenamento.
  - Valida o item de aprovação pendente (`approval_items`) com checagem estrita de `agency_id`, `source_type = 'client_onboarding_activation'`, `source_id = onboardingId` e `status = 'pending'`.
  - Se faltar qualquer critério, retorna **409 Conflict** com a lista de pendências (`missingCriteria`), sem tocar ou mutar nenhum registro.
- **Ativação Atômica via RPC PostgreSQL**:
  - Migration `20260924130000_client_onboarding_atomic_activation.sql` aplicada na homologação (`fifbtwbndutbvwnbzgtz`).
  - Função `public.onboarding_activate_client` executada em transação única com `FOR UPDATE`, atualizando `client_onboardings`, `clients`, `client_services` e `approval_items`.
  - Revogado de `public`, `anon` e `authenticated`; concedido apenas a `service_role`.
  - Bloqueia ativação dupla concorrente ou repetida retornando **409 Conflict**.
- **Prevenção de Falso Sucesso**:
  - Todas as mutações validam o número de linhas afetadas (`data.length > 0`), retornando **404 Not Found** se 0 linhas foram afetadas, e verificam a inserção em `audit_events` (retornando **500 Internal Server Error** em caso de falha de auditoria).

## Verificação e Definition of Done

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Testes de Domínio | `node --test tests/client-onboarding-domain.test.ts` | 10/10 aprovados |
| Testes de Segurança DB | `node --test tests/client-onboarding-security.test.ts` | 1/1 aprovado |
| Testes de API | `node --test tests/client-onboarding-api.test.ts` | 4/4 aprovados |
| Testes de Navegação & UI | `node --test tests/client-onboarding-navigation-and-ui.test.ts` | 10/10 aprovados |
| Testes de Hardening (M01, M02, M03) | `node --test tests/hardening-auth-tenant-activation.test.ts` | 6/6 aprovados |
| Type-checking TypeScript | `npx tsc --noEmit` | 0 erros |
| Linter ESLint | `npx eslint lib/permissions.ts lib/rbac.ts app/api/client-onboarding app/client-onboarding` | 0 erros |
| Build de Produção | `npm run build` | 0 erros (`/api/client-onboarding` compilado) |
| Supabase Security Advisors | `npx supabase db advisors --linked` | 0 erros, 0 alertas de segurança |
| Migration Remota | `npx supabase db push` | Aplicada com sucesso no ref `fifbtwbndutbvwnbzgtz` |

