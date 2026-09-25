# Estado Atual do Projeto

## Direção vigente

A Alastre Platform está sendo reposicionada de uma fundação centrada em Google Ads para o sistema operacional interno da agência. O cliente e seu DNA passam a organizar todos os serviços; SEO Local é a prioridade funcional seguinte.

## Base disponível

- Frontend local navegável.
- Módulos existentes: Visão geral, Clientes, DNA e memória, Agentes, Google Ads, GTM e GA4, Aprovações, Custos e Auditoria.
- Tratamento compartilhado de respostas inválidas, falhas de rede e integração indisponível.
- Estados visuais de indisponibilidade sem tela branca ou stack técnico.
- Effects assíncronos canceláveis durante troca de módulo.
- Build, lint e testes já validados no ciclo anterior informado; correções recentes passaram por TypeScript, ESLint direcionado e navegação local.
- Migrations locais alinhadas ao Supabase de homologação conforme o estado informado.
- Bridge de Google Ads ativa na versão 29 conforme o estado informado.

## Ambiente e segurança

- Ambiente correto: Alastre Platform Homologação.
- Supabase project ref: `fifbtwbndutbvwnbzgtz`.
- `ALASTRE_WRITE_MODE` deve permanecer desativado.
- Publicações em Google Ads, GTM, GA4 ou Meta dependem de autorização explícita.
- Migrations aplicadas, segredos e credenciais não devem ser alterados durante iterações comuns.

## Limitações atuais

- Integrações podem ficar indisponíveis quando URL e segredo da bridge não estão configurados no ambiente local.
- A home ainda reflete parcialmente linguagem de fundação técnica e deve evoluir para Central de Operações.
- SEO Local ainda não possui domínio completo, dashboard próprio ou Alastre Local Score.
- Agentes, relatórios, Sites/SEO, Meta Ads, comercial e financeiro ainda requerem evolução conforme o roadmap.

## Marco B — base entregue localmente

- Navegação reorganizada por Clientes, Operação, Automação e Gestão.
- Central de Operações orientada a clientes, prioridades e integrações reais.
- Workspace navegável de SEO Local com nove áreas operacionais.
- Alastre Local Score V1 modelado como explicável, versionável e sem pontuações inventadas.
- Dados disponíveis no DNA reutilizados no Perfil Google.
- Estados seguros para avaliações, postagens, palavras-chave, concorrentes, oportunidades e histórico ainda sem integração.

## Foco corrente

Configurar localmente a URL e o segredo já existentes do bridge de homologação para permitir o smoke autenticado dos endpoints e da geração por IA. Não criar nem rotacionar segredos nesta etapa.

## Marco C — base entregue localmente

- Fila consolidada “Atenção hoje” preparada para muitos clientes.
- Fluxos de postagens, avaliações e oportunidades separados de publicação externa.
- Agente SEO Local como especialização padrão, limitado ao DNA e aos dados realmente disponíveis.
- Central de Aprovações preparada para fontes de SEO Local sem criar mecanismo paralelo.
- Migrations `20260912185228_local_seo_operations` e `20260912185933_local_seo_security_hardening` aplicadas em **2026-09-12** na homologação.

Este documento registra o estado conhecido, não substitui auditoria técnica quando uma tarefa depender de detalhes que possam ter mudado.

## Marco C.1 — persistência preparada localmente

- API interna validada para workspace, postagens, avaliações, respostas e oportunidades.
- Domínio de transições impede publicação ou resposta externa pelos fluxos internos.
- Respostas a avaliações são entidades próprias e aprovações reutilizam `approval_items`.
- Bridge valida ator, agência e cliente e registra auditoria operacional.
- UI de postagens salva rascunho e envia para aprovação quando backend e migration estiverem disponíveis.
- Política mínima de dados para IA implementada no servidor, com allowlist testada, sanitização de contato pessoal e prompts versionados.
- `alastre-google-ads-bridge` publicada e ativa na versão **30**.
- Smoke autenticado e geração real por IA permanecem bloqueados localmente porque `SUPABASE_GOOGLE_ADS_BRIDGE_URL` e `ALASTRE_BRIDGE_SECRET` estão vazios; nenhum segredo foi criado ou alterado.
- Google Business Profile continua sem conexão e `ALASTRE_WRITE_MODE` permanece `disabled`.
## Marco D — Connection Hub

Fundação implementada localmente. A interface completa é navegável sem criar conexões falsas; Google, Meta e serviços futuros permanecem aguardando implementação real. IA Alastre aparece como serviço incluído. A migration `connection_hub_foundation` existe apenas no repositório local e não foi aplicada ao Supabase. Nenhum OAuth, acesso a provider, credencial, publicação, deploy ou push foi executado.

## Marco D.1 — Google provider preparado

OAuth, callback, refresh, discovery read-only, seleção de Perfil da Empresa, binding e consulta pelo SEO Local estão implementados. A migration `20260912190349_connection_hub_foundation` foi aplicada em **2026-09-12** no Supabase Alastre Platform Homologação (`fifbtwbndutbvwnbzgtz`). Tabelas, RLS, policies, constraints, índices, RPCs restritas ao `service_role` e Supabase Vault foram validados; o Security Advisor não encontrou problemas. O fluxo real permanece bloqueado de forma segura até `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` e `GOOGLE_OAUTH_REDIRECT_URI` serem configurados no servidor. Nenhum token real foi recebido, nenhuma chamada ao Google foi executada, o GBP continua read-only e `ALASTRE_WRITE_MODE` permanece desativado.

## Marco C.2 — Connection Hub SaaS e Google pendente

- Connection Hub operacional e experiência SaaS em Modo Simples/Avançado.
- Google Provider com foundation pronta, mas administrativamente em `pending_provider_approval`.
- Projeto Google Cloud oficial: **Alastre Platform**, project ID `alastre-platform`, project number `286084102789`.
- Solicitação de acesso às Google Business Profile APIs: `4-5388000041735`, ainda pendente.
- OAuth aguardando aprovação e configuração administrativa. O projeto **Alastre Reports não é o projeto oficial deste SaaS**.
- Conexão Google gerenciada pela plataforma (`platform_managed`); o cliente administra apenas consentimento e escolha dos seus recursos.
- Escritas externas Google permanecem bloqueadas e `ALASTRE_WRITE_MODE=disabled`.
- SEO Local diferencia dados internos reais, dados parciais, integração não conectada, sincronização, demonstração, insuficiência e erro.
- Migration local `20260913035820_client_services_and_provider_admin.sql` prepara serviços habilitados por cliente. Ela **não foi aplicada remotamente**.

## Marco D — SEO Local V2 preparado localmente

- Visão geral transformada em painel executivo orientado a diagnóstico e ação.
- Alastre Local Score V2 mantém sete pilares e só calcula notas com evidências; pesos, confiança e explicações estão estruturados.
- Auditoria de Perfil Google cobre 18 verificações e diferencia informação do DNA, não verificado e indisponível.
- Avaliações, postagens e oportunidades reutilizam os fluxos persistentes e a aprovação humana existentes; nenhuma publicação ou resposta externa é executada.
- Planejamento editorial mensal, objetivos de conteúdo, palavras-chave, ranking local separado e concorrentes foram preparados.
- Migration local `20260913042436_local_seo_v2_foundation.sql` cria score snapshots, profile checks, keywords, rank snapshots e competitors com RLS e acesso exclusivo do `service_role`. Não foi aplicada remotamente.
- Google continua em `pending_provider_approval`; `ALASTRE_WRITE_MODE=disabled`.

## Marco D.1 — persistência real e operação manual

- Migrations `20260913035820_client_services_and_provider_admin` e `20260913042436_local_seo_v2_foundation` aplicadas em **2026-09-13** somente na homologação autorizada (`fifbtwbndutbvwnbzgtz`).
- Serviços por cliente, auditoria manual do perfil, palavras-chave, concorrentes, snapshots de score parcial e oportunidades determinísticas possuem API interna validada por ator, agência, cliente e papel.
- Novas tabelas estão com RLS ativo, acesso direto negado a `anon`/`authenticated`, acesso de servidor restrito a `service_role`, constraints e índices de consulta.
- O score parcial considera apenas verificações confirmadas; ausência de evidência não gera nota.
- Oportunidades por regras usam origem determinística e índice único para evitar duplicação aberta.
- A interface oferece cadastro, aprovação/arquivamento, auditoria manual e recarga persistente; ranking real e Google Business Profile continuam explicitamente indisponíveis.
- O ambiente local ainda precisa receber, por gestão segura de ambiente, `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SECRET_KEY`; nenhum segredo foi criado ou alterado.
- A correção da bridge para persistir serviços sem um identificador de usuário inválido está no código local, mas **não foi publicada**.
- `ALASTRE_WRITE_MODE` permanece desativado; nenhuma escrita em Google, GTM, GA4, GBP ou Ads foi realizada.

## Marco UX — redesign global

- Design system ganhou escala tipográfica sem textos funcionais abaixo de 13px, espaçamento mais generoso, cards menos densos e áreas de clique de pelo menos 44px.
- Central de Operações, Clientes, SEO Local, Local Score e Connection Hub usam hierarquia de página consistente e linguagem orientada a pessoas não técnicas.
- Ajuda contextual usa um registro tipado por `help_key`, com explicação, importância e próximo passo; a arquitetura está pronta para evoluir para uma Central de Ajuda.
- Sidebar foi reorganizada em Operação, Clientes, SEO Local, Aquisição, Conteúdo, Gestão e Configurações.
- Modo Simples permanece a experiência principal; detalhes administrativos do Google continuam exclusivos do Modo Avançado.
- Responsividade, foco visível, contraste, navegação por teclado e estados que não dependem apenas de cor foram reforçados.
- AppShell agora é fluido, sem `max-width` global, com gutters proporcionais e grids adaptativos até ultrawide.
- Sidebar possui grupos recolhíveis, modo compacto persistido localmente, tooltip por item e desaparece em favor da navegação móvel abaixo de 821px.
- Google Ads usa a largura adicional em uma composição 2/3 + 1/3; métricas, filas e cards aumentam o número de colunas conforme o espaço real.

## Marco 00 — Fundação de Produção Concluída

- **Higiene e Auditoria**: Histórico de 22 commits locais auditado e saneado contra exposição de segredos ou credenciais. Artefatos temporários e de desenvolvimento isolados via `.gitignore`.
- **Scripts Multiplataforma**: Scripts de `build`, `lint` e `test` desacoplados de bash exclusivo de container, funcionando de maneira uniforme em Windows (desenvolvimento) e Linux (CI/produção).
- **Estabilização da Suíte de Testes**: 175 testes em 31 suítes passando com 100% de sucesso. Concorrência controlada (`--test-concurrency=1`) e correção do carregamento de SSR no Vite evitaram deadlocks e colisões de portas.
- **Pipeline de Qualidade (CI)**: Pipeline configurado no GitHub Actions (`.github/workflows/ci.yml`) para Node 22 LTS com bloqueio obrigatório para quebras de lockfile (`npm ci`), TypeScript (`tsc --noEmit`), ESLint (`npm run lint`), testes automatizados (`npm test`) e build (`npm run build`).
- **Migrations de Homologação**: A migration `20260917144052_client_lifecycle_archive.sql` foi devidamente aplicada no Supabase Alastre Platform Homologação (`fifbtwbndutbvwnbzgtz`), alinhando o schema remoto com os modelos locais de arquivamento de clientes.
- **Inventário de Edge Functions**:
  - `alastre-google-ads-bridge`: Versão 30+ ativa em homologação; código versionado em `supabase/functions/alastre-google-ads-bridge`.
  - `alastre-ga4-service`: Versionada em `supabase/functions/alastre-ga4-service`.
  - `alastre-gtm-service`: Versionada em `supabase/functions/alastre-gtm-service`.
  - `_shared/`: Bibliotecas utilitárias de autenticação e validação em `supabase/functions/_shared/`.
- **Isolamento de Ambientes & Políticas**:
  - Homologação: `fifbtwbndutbvwnbzgtz`.
  - Futura Produção: Instância separada a ser provisionada quando da maturidade dos módulos de produto.
  - `ALASTRE_WRITE_MODE` permanece estritamente `disabled`. Nenhuma escrita externa em Google ou Meta sem aprovação humana.

## Marco 01 — Fábrica de Produtos Concluída

- **Domínio e Contratos**:
  - `lib/product-factory-domain.ts`: Contratos versionados para `ProductDefinition`, `DiscoverySession`, `ProductScopeItem`, `OperationalSop`, `RaciAssignment` e `ViabilityCheckpoint`.
  - Classificação estrita de informação: `fato`, `evidência`, `inferência`, `hipótese` e `lacuna`.
  - Regra de no máximo 7 perguntas por rodada de descoberta operacional.
  - Separação mandatória entre Implantação (setup) e Recorrência mensal (monthly).
  - Suporte a papéis operacionais futuros no RACI sem distorcer cargos atuais.
  - Salvaguarda rígida contra precificação prematura e promessas comerciais antes de viabilidade comprovada e revisão humana.
- **Banco de Dados e Persistência**:
  - Migration local `20260924100000_product_factory_foundation.sql` criando 6 tabelas com prefixo `product_`.
  - Hardening crítico de isolamento multiempresa: FKs compostas `(agency_id, parent_id)` referenciando `(agency_id, id)` e restrições únicas compostas em todas as tabelas filhas e clientes, impedindo que linhas pertençam a uma agência e referenciem produtos ou itens de outra.
  - RLS 100% ativo, grants de `anon`/`authenticated` revogados e acesso de backend restrito a `service_role` (lembrando que policies `service_role using (true)` apenas confinam o acesso ao backend, sendo o isolamento de tenant garantido pelas constraints compostas e pela resolução do ator autenticado).
  - Tipos atualizados em `lib/database.types.ts` e schema Drizzle em `db/schema.ts`.
- **API Server-Side e Auditoria**:
  - Endpoint `POST /api/product-factory` com 12 ações validadas por Zod.
  - Logs estruturados em `audit_events` para todas as mutações relevantes.
  - Submissão para revisão humana integrada à Central de Aprovações (`approval_items`).
  - Imutabilidade garantida para versões aprovadas e geração controlada de nova versão `v+1`.
- **Produto Canônico Inicial**:
  - Pacote padrão "SEO Local e Google Business Profile" configurado com perguntas de descoberta, matriz de escopo completa, SOPs operacionais detalhados e matriz RACI.
- **Interface e Navegação**:
  - `app/product-factory-module.tsx` integrado ao `AppShell` no grupo **Produtos** com o ícone `PackagePlus`.
  - Modo Simples como padrão com progressive disclosure para Modo Avançado.
  - Registro de ajuda contextual em `lib/help-content.ts` (`product_factory.overview`).
- **Suíte de Testes**:
  - 4 novas suítes de testes (`tests/product-factory-*.test.ts`) totalizando 15 testes aprovados com 100% de sucesso.

## Marco 02 — Comercial e CRM Concluído

- **Domínio e Contratos**:
  - `lib/commercial-crm-domain.ts`: Contratos e regras para pipeline (16 estágios com tabela estrita de transições), priorização (Fit, Intenção e Oportunidade separados), qualificação em 8 dimensões, diagnóstico de 11 passos, propostas vinculadas à Fábrica de Produtos, travas de imutabilidade, validação de desconto com contrapartida mandatória, justificativa obrigatória para motivo de perda por preço, checklist de handoff para onboarding e forecast em 3 cenários com premissas explícitas.
  - Salvaguarda mandatória: Oportunidades ganhas (`closed_won`) e handoffs aprovados **não** criam clientes automaticamente no banco; a ativação operacional fica sob controle do futuro Módulo 03 (Onboarding).
  - Nenhuma oportunidade pode ficar sem responsável, próxima ação e prazo definidos.
  - Métricas com amostras insuficientes exibem explicitamente nota de insuficiência em vez de taxas sintéticas.
- **Banco de Dados e Persistência**:
  - Migration `supabase/migrations/20260924110000_commercial_crm_foundation.sql` criando 8 tabelas com isolamento multiempresa via FKs compostas `(agency_id, parent_id)`, RLS em todas as tabelas, revogação de acessos públicos/anônimos e restrição exclusiva a `service_role`.
  - Constraints a nível de banco para próxima ação, prazo e justificativa de perda por preço.
  - Sincronização em `db/schema.ts` (Drizzle ORM) e `lib/database.types.ts`.
- **API Server-Side e Auditoria**:
  - Endpoint `POST /api/commercial` (`app/api/commercial/route.ts`) com 19 ações validadas via Zod (`lib/commercial-crm-api.ts`).
  - Registro de eventos em `audit_events` com isolamento por agência e proteção fail-secure.
- **Interface e Navegação**:
  - `app/commercial-module.tsx`: Central Comercial com 10 abas operacionais (Visão Geral, Pipeline Kanban, Oportunidades, Empresas, Qualificação, Diagnóstico, Propostas, Atividades, Inteligência, Forecast & Handoff).
  - Alternância entre Modo Simples e Modo Avançado.
  - Integração no `AppShell` no grupo **Gestão** com ícone `BriefcaseBusiness` e destaque.
  - Botão de abertura rápida para o CRM integrado na gaveta de leads da Central de Prospecção (`app/prospecting-module.tsx`).
  - Ajuda contextual registrada em `lib/help-content.ts` cobrindo visão geral, pipeline, qualificação, propostas e handoff.
- **Suíte de Testes**:
  - 4 suítes automatizadas com 31 testes aprovados (`tests/commercial-crm-*.test.ts`):
    - `tests/commercial-crm-domain.test.ts` (12 testes)
    - `tests/commercial-crm-security.test.ts` (1 teste)
    - `tests/commercial-crm-api.test.ts` (3 testes)
    - `tests/commercial-crm-navigation-and-ui.test.ts` (15 testes)

## Marco 03 — Onboarding de Clientes Concluído

- **Domínio e Contratos**:
  - `lib/client-onboarding-domain.ts`: Contratos e regras para ciclo de vida de onboarding (12 estágios e tabela estrita de transições), conferência da venda (`validateSalesConference`) com salvaguarda contra promessas de resultado externo indevidas, geração canônica de 12 requisitos de coleta (`generateDefaultRequirements`), salvaguarda de baseline factual sem zeros sintéticos (`validateBaselineData`), geração de plano de implantação com tempos estimados em minutos derivados do produto (`generateImplementationPlanFromProduct`) e checklist de prontidão com 11 critérios objetivos (`calculateActivationChecklist`).
  - Salvaguarda mandatória: Onboarding nunca deixa registros órfãos; criação de cliente, unidade sede, serviços e DNA é transacional e atômica.
  - Apenas handoffs comerciais com status `approved_for_onboarding` podem iniciar o processo.
  - Divergências comerciais bloqueiam a criação e a ativação do cliente com segurança.
- **Banco de Dados e Persistência**:
  - Migration `supabase/migrations/20260924120000_client_onboarding_foundation.sql` aplicada com sucesso no Supabase Homologação (`fifbtwbndutbvwnbzgtz`) via `npx supabase db push`.
  - 6 novas tabelas criadas: `client_onboardings`, `client_units`, `client_onboarding_requirements`, `client_onboarding_baselines`, `client_onboarding_plans`, `client_onboarding_decisions`.
  - Constraint `approval_items.source_type` atualizado para suportar `client_onboarding_activation`.
  - RLS 100% ativo, grants de `anon`/`authenticated` revogados e acesso de backend restrito a `service_role` com constraints compostas de isolamento multi-tenant `(agency_id, parent_id)`.
  - Supabase Security Advisors (`supabase db advisors --linked`): 0 erros e 0 alertas de segurança.
  - Espelho de schema atualizado no Drizzle ORM (`db/schema.ts`).
- **API Server-Side e Transações**:
  - Endpoint `POST /api/client-onboarding` (`app/api/client-onboarding/route.ts`) com 16 ações validadas via Zod (`lib/client-onboarding-api.ts`).
  - Criação transacional segura de cliente (`create_or_link_client_transactional`) com rollback defensivo.
  - Bloqueio e registro de divergência (`record_divergence`) e gate de aprovação humana de ativação (`approve_activation`).
- **Interface e Navegação**:
  - `app/client-onboarding-module.tsx`: Central de Onboarding de Clientes com 10 abas operacionais (Visão Geral, Venda & Escopo, Empresa & Unidades, Informações, Acessos & Conexões, DNA, Baseline, Implantação, Prontidão e Histórico).
  - Modo Simples como padrão com alternância fluida para Modo Avançado.
  - Conectado ao `AppShell` no grupo **Clientes** com ícone `UserCheck` e destaque (`featured: true`).
  - Ajuda contextual registrada em `lib/help-content.ts` cobrindo 7 tópicos operacionais.
- **Suíte de Testes e Validação Completa**:
  - 4 suítes automatizadas com 25 testes aprovados (`tests/client-onboarding-*.test.ts`):
    - `tests/client-onboarding-domain.test.ts` (10 testes)
    - `tests/client-onboarding-security.test.ts` (1 teste)
    - `tests/client-onboarding-api.test.ts` (4 testes)
    - `tests/client-onboarding-navigation-and-ui.test.ts` (10 testes)
  - `tsc --noEmit`: 0 erros de compilação.
  - `eslint`: 0 erros.
  - `npm run build`: 100% aprovado com rota `/api/client-onboarding` compilada.

## Marco de Hardening Crítico — Autenticação, Tenant, RBAC e Ativação Atômica (2026-09-24)

- **Eliminação de Fallbacks Inseguros (M01, M02, M03)**:
  - Removido qualquer uso de `actor_local`, tenant dummy `00000000-0000-0000-0000-000000000001` ou role `operator` como fallback.
  - Todas as rotas de API (`/api/product-factory`, `/api/commercial`, `/api/client-onboarding`) usam estritamente `resolveAuthenticatedActor`:
    - Banco configurado + falha na resolução do ator: **403 Forbidden**.
    - Banco indisponível ou configuração ausente em produção: **503 Service Unavailable**.
    - O armazenamento em memória é terminantemente proibido em produção (restrito a desenvolvimento e testes locais offline).
    - O campo `agency_id` recebido em payload é desconsiderado; a agência autenticada do ator é sempre soberana.
- **RBAC Centralizado & Segregação de Funções (SoD)**:
  - Módulos `lib/permissions.ts` e `lib/rbac.ts` centralizam as políticas por papel (`owner`, `admin`, `operations_lead`, `commercial_lead`, `operator`, `sales_rep`, `viewer`).
  - Ativação (`approve_activation`), cancelamento (`cancel`) e desbloqueio (`unblock`) restritos a `owner`, `admin` e `operations_lead`.
  - Operadores (`operator`) e visualizadores (`viewer`) são terminantemente proibidos de aprovar ativações (SoD).
- **Activation Gate Baseado em Dados Reais (Defesa Anti-TOCTOU)**:
  - Migration `20260924140000_client_onboarding_real_gate_defense.sql` aplicada no Supabase Homologação (`fifbtwbndutbvwnbzgtz`).
  - O gate de ativação no servidor e no RPC de banco não aceita mais contagens fictícias (`enabledServicesCount: onb.client_id ? 1 : 0`) nem deriva confirmação de DNA a partir do estágio do onboarding.
  - Consulta obrigatória e simultânea de `agency_id` e `client_id` em:
    - `public.client_services`: exige pelo menos um serviço real em estado pré-ativação permitido (`status in ('pending', 'active')`).
    - `public.client_dna_profiles`: exige perfil existente com `status = 'confirmed'` e preenchimento factual completo dos campos críticos (`getCriticalPendingFields(dna) === 0`).
  - RPC PostgreSQL `onboarding_activate_client` valida transacionalmente a existência de serviços reais e DNA confirmado com lock exclusivo, abortando com exceção em caso de violação de critérios e sem mutação residual.
- **Ativação Atômica no PostgreSQL**:
  - Migrations `20260924130000_client_onboarding_atomic_activation.sql` e `20260924140000_client_onboarding_real_gate_defense.sql` aplicadas no Supabase Homologação (`fifbtwbndutbvwnbzgtz`).
  - Função transacional `public.onboarding_activate_client` com `SECURITY DEFINER`, `search_path = public, pg_temp`, execução revogada de `public`/`anon`/`authenticated` e concedida somente a `service_role`.
  - Atualiza atomicamente `client_onboardings`, `clients`, `client_services` e `approval_items` com lock de linha (`FOR UPDATE`), prevenindo dupla ativação e retornando **409 Conflict** em caso de corrida ou ativação repetida.
- **Prevenção de Falsos Sucessos**:
  - Todas as mutações em M01, M02 e M03 validam contagem de linhas afetadas (`data.length > 0`), retornando **404 Not Found** se 0 linhas foram afetadas, e verificam a inserção em `audit_events` (retornando **500 Internal Server Error** em falhas de auditoria).
- **Suíte de Hardening e Validação Completa**:
  - 14 suítes de testes automatizados com 81 testes de domínio/API/UI/Hardening específicos aprovados:
    - `tests/product-factory-*.test.ts`: 15 testes aprovados
    - `tests/commercial-crm-*.test.ts`: 32 testes aprovados
    - `tests/client-onboarding-*.test.ts`: 25 testes aprovados
    - `tests/hardening-auth-tenant-activation.test.ts`: 9 testes de hardening aprovados
  - Suíte completa do repositório (`npm test`): **256 testes passando, 0 falhas** (100% de sucesso).
  - `tsc --noEmit`: 0 erros.
  - `eslint`: 0 erros.
  - `npm run build`: 100% aprovado com todas as 23 rotas compiladas.
  - `supabase db advisors --linked`: 0 erros e 0 alertas de segurança.

## Marco de Entrega — Módulo 04: Motor de Operações e Estabilização de Testes (2026-09-25)

- **Estabilização Definitiva do Test Runner (`npm test`)**:
  - **Arquivos Causadores do Travamento**: `tests/prospecting-functional-flow.test.ts` e `tests/prospecting-http-integration.test.ts`.
  - **Causa Raiz Identificada e Corrigida**:
    1. *Processos Externos do Vite & Wrangler Locks*: Os testes iniciavam instâncias completas do Vite via `child_process.spawn`. O Vite carregava o plugin `@cloudflare/vite-plugin`, criando instâncias de Miniflare com escrita em banco SQLite e persistência em `.wrangler/registry`. Isso criava concorrência de locks de arquivo no Windows e deixava dezenas de instâncias de `node.exe` órfãs segurando pipes `stdio`.
    2. *Handles Abertos no Event Loop*: Ao finalizar o teste, processos órfãos mantinham streams abertas no Windows, impedindo o runner nativo do Node (`node --test`) de encerrar o processo.
    3. *Desconexão de Estado em Lotes*: Em `lib/prospecting/prospecting-lease-manager.ts`, o método `isDncActive` chamava `this.loadFromFile()` a cada verificação de lead durante o loop de `completeJob`. Como `loadFromFile()` reatribuía os mapas em memória lendo do disco antes do `saveToFile()` do lote, ele sobrescrevia os leads em memória e desacoplava referências, gerando erros 409 em cascata.
  - **Solução Definitiva**:
    - Criação de helper leve in-process em `tests/helpers/prospecting-test-server.ts` usando `node:http.createServer` nativo e `vite.ssrLoadModule` com `configFile: false`. Não há spawns de processos externos, Miniflare nem criação de workers. Fechamento gracioso com `closeAllConnections()` e `server.close()`.
    - Remoção do recarregamento de disco no meio de loops em `lib/prospecting/prospecting-lease-manager.ts`.
  - **Resultado do Marco Global**: **281/281 testes aprovados (100% pass, 0 fail, 0 skipped, código de saída 0)**.

- **Banco de Dados e Persistência (M04)**:
  - Migration `supabase/migrations/20260924150000_operations_engine_foundation.sql` aplicada com sucesso no Supabase Homologação (`fifbtwbndutbvwnbzgtz`).
  - 4 novas tabelas criadas: `operations_workspaces`, `operations_service_definitions`, `operations_work_items`, `operations_sla_policies`.
  - RPC PostgreSQL atômica `public.operations_transition_work_item` para transições seguras de status (`pending`, `in_progress`, `blocked`, `completed`, `cancelled`), validação de dependências e auditoria transacional.
  - RLS ativado em 100% das novas tabelas com isolamento estrito por `agency_id = current_setting('app.current_agency_id')`.
  - Grants de execução e leitura restritos exclusivamente ao `service_role`.
  - Espelho de schema atualizado no Drizzle ORM (`db/schema.ts`).

- **API Server-Side e Transações**:
  - Endpoint `POST /api/operations` (`app/api/operations/route.ts`) autenticado com `resolveAuthenticatedActor`.
  - Ações operacionais validadas com schemas Zod em `lib/operations-api.ts`.
  - RBAC integrado com permissões de gestão e execução em `lib/permissions.ts`.
  - Auditoria completa em `audit_events` para toda mutação e transição de itens operacionais.

- **Interface e Navegação**:
  - Módulo `app/operations-engine-module.tsx` integrado com Modo Simples padrão e Modo Avançado.
  - 5 abas operacionais: Filas de Trabalho, Atenção & Atrasos, Workspaces, Políticas de SLA, Métricas & Capacidade.
  - Integrado ao `app/app-shell.tsx` no menu **Operações**.

- **Suíte de Testes do Módulo 04**:
  - 4 suítes automatizadas com 25 testes aprovados (`tests/operations-*.test.ts`):
    - `tests/operations-domain.test.ts` (10 testes)
    - `tests/operations-security.test.ts` (1 teste)
    - `tests/operations-api.test.ts` (4 testes)
    - `tests/operations-navigation-and-ui.test.ts` (10 testes)
  - `tsc --noEmit`: 0 erros de compilação.



