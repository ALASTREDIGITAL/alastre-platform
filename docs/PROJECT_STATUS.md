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

## Marco de Entrega — Módulo 04: Motor de Operações (2026-09-25)

- Migration `supabase/migrations/20260924150000_operations_engine_foundation.sql` e hardening aplicados no Supabase Homologação (`fifbtwbndutbvwnbzgtz`).
- Motor de operações centralizado com isolamento por tenant (`agency_id`), RPCs transacionais, Workspaces, Work Items, Políticas de SLA e auditoria.

## Marco de Entrega — Módulo 05: Entrega de SEO Local e Google Business Profile (2026-09-25)

- **Escopo Funcional Entregue**:
  - Central de Entrega de SEO Local reestruturada em 8 abas funcionais: Visão Geral, Perfil GBP, Conteúdo, Reputação, Autoridade, Visibilidade & Conversão, Plano de Ação, Histórico & Evidências.
  - Alternância de visualização entre Modo Simples (padrão) e Modo Avançado (técnico).
  - Diagnóstico de Perfil em 18 pontos com indicação explícita da origem dos dados (`provider`, `manual`, `evidence`, `inference`, `hypothesis`, `unavailable`). Ausência de evidência tratada como `Indisponível (N/D)`, sem nota zero ou erro falso.
  - Conteúdo Local com planejamento de postagens (`standard`, `offer`, `event`), regras de conformidade (alertas de telefone e contagem de caracteres) e botão para transformar postagens em tarefas operacionais no Motor de Operações (Módulo 04).
  - Reputação com triagem por sentimento (`positive`, `neutral`, `negative`, `critical`), respostas assistidas por IA, esteira de aprovação humana e botão para gerar tarefas operacionais de solicitação ativa de avaliações.
  - Autoridade Local cobrindo Palavras-Chave de busca local, Concorrentes Locais observados e Citações em Diretórios (NAP Consistency) em 9 guias principais (Google Maps, Apple Maps, Apontador, Yelp, etc.).
  - Visibilidade e Conversão com Alastre Local Score (7 pilares), baseline histórico, status do provedor de ranking (`unconfiguredLocalRankProvider`), status de grid e isenção de promessas de posições ou conversões (`NO_RANKING_PROMISE_DISCLAIMER`).
  - Plano de Ação vinculando diagnósticos e oportunidades a `work_items` no Motor de Operações (Módulo 04) com rastreamento transacional.
  - Trava de escrita externa quando `ALASTRE_WRITE_MODE=disabled`.

- **Banco de Dados, API e Segurança**:
  - Migration forward-only: `supabase/migrations/20260925040000_local_seo_delivery_v5.sql`.
  - Vínculos de chave estrangeira compostos por `(agency_id, client_id)` ou `(agency_id, work_item_id)`.
  - RLS ativado e permissões revogadas para `public`, `anon`, `authenticated` (acesso por `service_role`).
  - `POST /api/local-seo-v2` atualizado com Zod validation, `resolveAuthenticatedActor` e auditoria de eventos em `audit_events`.

- **Suíte de Validação**:
  - 18 testes automatizados focados no Módulo 05 (`tests/local-seo-delivery-v5.test.ts`).
  - Total da suíte de SEO Local (`tests/local-seo-*.test.ts`): 53 testes passando (100% de sucesso).
  - `tsc --noEmit`: 0 erros de compilação.
  - `eslint`: 0 erros.

## Marco de Entrega — Módulo 06: Qualidade e Evidências (2026-09-25)

- **Escopo Funcional Entregue**:
  - Central de Qualidade e Evidências reestruturada em 6 abas funcionais: Fila de Revisões, Evidências, Checklists, Não Conformidades, Correções e Reaberturas, Histórico e Auditoria.
  - Alternância de visualização entre Modo Simples (padrão) e Modo Avançado (técnico).
  - Estrutura canônica de evidências vinculadas a `work_items` com suporte aos 8 tipos obrigatórios (`before_after`, `screenshot`, `url`, `external_id`, `sanitized_payload`, `manual_confirmation`, `automated_validation`, `collection_limitation`).
  - Checklists de qualidade versionados reutilizáveis por tipo de produto, serviço e nível de risco (`low`, `normal`, `high`, `critical`).
  - Política de revisão por risco (`mandatory`, `sampled`, `optional`) com regra de Segregação de Funções (SoD) que impede autoaprovação em tarefas de alto risco quando executor = verificador.
  - Mapeamento e abertura de Não Conformidades com registro de causa raiz, impacto e botão para gerar Ações Corretivas diretamente no Motor de Operações (Módulo 04). Bloqueio operacional em tarefas vinculadas a Não Conformidades Críticas abertas.
  - Histórico de auditoria imutável (`quality_audit_history`) preservando estados anteriores, novos estados, autor, data/hora e justificativa, impedindo sobrescrita silenciosa de evidências trancadas (`is_locked`).

- **Banco de Dados, API e Segurança**:
  - Migration forward-only: `supabase/migrations/20260925050000_quality_and_evidence_foundation.sql`.
  - Tabelas: `quality_evidences`, `quality_checklist_templates`, `quality_checklist_runs`, `quality_non_conformities`, `quality_audit_history`.
  - Unique constraints em `(agency_id, id)` e Foreign Keys compostas `(agency_id, work_item_id)` e `(agency_id, client_id)`.
  - RLS ativado e permissões revogadas para `public`, `anon`, `authenticated` (acesso por `service_role`).
  - RPC privilegiada `quality_verify_evidence` com `SECURITY DEFINER` e `SET search_path = ''`.
  - Endpoint `POST /api/quality` com validações Zod e `resolveAuthenticatedActor`.

- **Suíte de Validação**:
  - 15 testes automatizados focados no Módulo 06 (`tests/quality-and-evidence.test.ts`).
  - `tsc --noEmit`: 0 erros de compilação.
  - `eslint`: 0 erros nos arquivos alterados.

## Marco de Entrega — Módulo 07: Sucesso do Cliente (2026-09-25)

- **Escopo Funcional Entregue**:
  - Central de Sucesso do Cliente estruturada em 8 abas funcionais: Carteira & Health Score, Scorecard de Valor, Reuniões e Decisões, Riscos e Recuperação, Renovação e Escopo, Expansão (Upsell/Downsell), Cancelamento & Offboarding, Histórico & Auditoria.
  - Alternância de visualização entre Modo Simples (padrão) e Modo Avançado (técnico).
  - Health Score explicável e decomponível (0-100 pts) cobrindo 7 fatores principais com indicação explícita de cobertura de dados (`complete`, `partial`, `insufficient`). Tratamento mandatório de dados ausentes como `Dados Insuficientes (N/D)`, sem notas negativas arbitrárias.
  - Segregação mandatória de causas primárias de inconsistência (`alastre_delivery_failure`, `channel_limitation`, `client_dependency_failure`, `insufficient_data`).
  - Scorecards de Valor periódicos reunindo entregas concluídas, evidências do Módulo 06 e mensagem de isenção de garantia (`NO_RANKING_PROMISE_DISCLAIMER`).
  - Registro de reuniões e conversão direta de decisões acionáveis em tarefas operacionais (`work_items`) no Motor de Operações (Módulo 04).
  - Matriz de risco de churn com severidade, nível de confiança e geração atômica de tarefas de recuperação no Módulo 04.
  - Esteira de expansão e renovação com exigência mandatória de fit demonstrado, valor evidenciado, impacto operacional no Módulo 04 e aprovação humana explícita.
  - Solicitações de cancelamento e offboarding seguro com inventário de revogação de acessos, tarefas de transição no Módulo 04 e política de retenção de auditoria sem exclusões destrutivas.

- **Banco de Dados, API e Segurança**:
  - Migrations forward-only: `supabase/migrations/20260925070000_client_success_foundation.sql` e `20260925080000_client_success_hardening.sql`.
  - Tabelas: `client_health_scores`, `client_scorecards`, `client_meetings`, `client_meeting_decisions`, `client_churn_assessments`, `client_expansion_recommendations`, `client_cancellation_requests`, `client_offboarding_inventories`.
  - Constraints únicas `(agency_id, id)` e Foreign Keys compostas `(agency_id, client_id)`.
  - RLS ativado e permissões revogadas para `public`, `anon`, `authenticated` (acesso restrito ao `service_role`).
  - Endpoint `POST /api/client-success` e `GET /api/client-success` com validação Zod, `resolveAuthenticatedActor` e auditoria.

- **Suíte de Validação**:
  - 23 testes automatizados focados no Módulo 07 (`tests/client-success-*.test.ts`).
  - 16 testes de migração e segurança (`tests/migration-security.test.mjs`).
  - 4 testes de segurança da plataforma (`tests/platform-security.test.mjs`).
  - Total: 43 testes automatizados passando (100% sucesso).

## Marco de Entrega — Módulo 08: Capacidade e Financeiro (2026-09-25)

- **Escopo Funcional Entregue**:
  - Central de Capacidade e Financeiro estruturada em 8 abas funcionais: Visão Econômica, Premissas e Custos, Tempo e Retrabalho, Capacidade e Gargalos, Cenários de Crescimento, Margem e Viabilidade, Precificação e Descontos, Histórico e Auditoria.
  - Alternância de visualização entre Modo Simples (padrão) e Modo Avançado (técnico).
  - Premissas econômicas versionadas com classificação da origem do dado (`real_observed`, `reported_value`, `estimate`, `hypothesis`, `unavailable`). Premissa sem evidência reclassificada obrigatoriamente como hipótese.
  - Consolidação de tempo padrão (Módulo 01 / Módulo 04) e realizado (`work_item_time_logs` do Módulo 04) com rastreamento de custos por mão de obra, software, IA, atendimento, venda, implantação e retrabalho (Módulo 06).
  - Cálculo de capacidade por função e cenários para 10, 25, 50 e 100 clientes, identificando a função que representa o gargalo dominante e o ponto de contratação antes do risco de queda de qualidade.
  - Análise de margem com segregação mandatória de valor contratado, faturado e recebido, além de custo estimado vs realizado e margem estimada vs realizada. Proibição estrita de misturar valor contratado com recebido.
  - Cálculo de CAC, Payback e LTV com exibição explícita de "Dados Insuficientes (N/D)" e lista de campos ausentes quando não houver cobertura total. Proibição de inventar métricas financeiras sintéticas.
  - Precificação e descontos protegidos: trava que impede aprovação de preço sem custo operacional estimado, trava que exige contrapartida documentada para descontos, e esteira de aprovação humana (`approval_items` com `source_type = 'capacity_financial_pricing'`).
  - Imutabilidade da trilha de auditoria e registro de todos os eventos em `audit_events`.
  - Exibição mandatória de aviso de isenção econômica (`PROJECTION_DISCLAIMER`) e selos de origem em todas as telas.

- **Banco de Dados, API e Segurança**:
  - Migration forward-only: `supabase/migrations/20260925100000_capacity_and_finance_foundation.sql`.
  - Tabelas: `financial_economic_assumptions`, `financial_cost_records`, `financial_capacity_simulations`, `financial_margin_analyses`, `financial_pricing_decisions`.
  - Constraints únicas `(agency_id, id)` e Foreign Keys compostas `(agency_id, client_id)`, `(agency_id, product_definition_id)`, `(agency_id, proposal_id)`.
  - RLS ativado e permissões revogadas para `public`, `anon`, `authenticated` (acesso restrito ao `service_role`).
  - Endpoint `POST /api/capacity-and-finance` e `GET /api/capacity-and-finance` com validação Zod, `resolveAuthenticatedActor` e auditoria.

- **Suíte de Validação**:
  - 10 testes automatizados focados no Módulo 08 (`tests/capacity-and-finance-*.test.ts`).
  - 16 testes de migração e segurança (`tests/migration-security.test.mjs`).
  - 4 testes de segurança da plataforma (`tests/platform-security.test.mjs`).
  - Total da suíte executada: 46 testes automatizados passando (100% sucesso).
  - TypeScript (`tsc --noEmit`): 0 erros.
  - ESLint: 0 erros nos arquivos alterados.

## Marco de Entrega — Módulo 09: Integrações e Automação (2026-09-25)

- **Escopo Funcional Entregue**:
  - Central de Automação Operacional e Integrações reestruturada em 7 abas funcionais na Central de Conexões: Conexões & Capabilities, Recursos Vinculados, Sincronizações, Fila & Jobs, Dead Letter & Falhas, Escritas Controladas (Write Plans) e Custos & Limites de IA.
  - Alternância de visualização entre Modo Simples (padrão) e Modo Avançado (técnico).
  - Catálogo interno de provedores (`google`, `meta`, `alastre_ai`, `electronic_signature`, `email`) e capacidades (`google_business_profile`, `meta_ads`, `ai_generation`, etc.) com consentimento incremental.
  - Sincronização incremental com cursores (`sync_cursor`), health checks, limite de tentativas, timeout e backoff exponencial sem duplicações.
  - Fila de jobs idempotente (`idempotency_key`), deduplicação por tenant, execução simulada/controlada por adapter e roteamento automático de falhas para a fila Dead Letter sem repetição perigosa.
  - Escritas externas controladas: geração de planos imutáveis com hash SHA-256 de 64 caracteres, exigência de aprovação humana vinculada ao plano exato em `approval_items`, e trava de segurança que retém a execução quando `ALASTRE_WRITE_MODE=disabled`.
  - Suporte a rollback/compensação restrito a quando o adapter declarar suporte (`supports_rollback`), sem capacidades de rollback inventadas.
  - Registro de custos e limites de IA sem prompts sensíveis, com exibição mandatória de "Dados Insuficientes (N/D)" quando não houver histórico de consumo.
  - Tratamento visual seguro de indisponibilidade sem telas brancas ou vazamento de stack técnico.

- **Banco de Dados, API e Segurança**:
  - Migration forward-only: `supabase/migrations/20260925140000_automation_and_integrations_foundation.sql` aplicada na homologação `fifbtwbndutbvwnbzgtz`.
  - Tabelas: `automation_sync_states`, `automation_jobs`, `automation_write_plans`, `automation_ai_usage_logs`, `automation_ai_limits`.
  - Constraints únicas `(agency_id, id)` e Foreign Keys compostas `(agency_id, connection_id)`, `(agency_id, client_id)`, `(agency_id, work_item_id)`, `(agency_id, evidence_id)`.
  - RLS ativado em 100% das novas tabelas e privilégios revogados para `public`, `anon`, `authenticated` (acesso exclusivo do `service_role`).
  - Proteção contra SSRF: validador `validateExternalEndpointUrl` restringe endpoints externos estritamente aos domínios autorizados do provedor.
  - Sanitização de segredos: `sanitizeSensitiveData` limpa tokens, senhas e credenciais de respostas, logs e banco.
  - Endpoint `POST /api/automation` e `GET /api/automation` com validação Zod, `resolveAuthenticatedActor` e auditoria em `audit_events`.

- **Suíte de Validação**:
  - 13 testes automatizados focados no Módulo 09 (`tests/automation-and-integrations.test.ts`).
  - Total da suíte executada do repositório: 393 testes automatizados passando (100% sucesso).
  - TypeScript (`tsc --noEmit`): 0 erros de compilação.
  - ESLint: 0 erros e 0 warnings nos arquivos alterados.
  - Build de Produção: `npm run build` (`vinext build`) concluído com 0 erros.
  - Supabase Security Advisor / DB Lint: 0 problemas encontrados nas tabelas e políticas do Módulo 09.

## Marco de Entrega — Etapa 11: Segurança, Operação e Preparação de Release (2026-09-26)

- **Exercício Real de Restauração Isolada (Supabase PITR/Restore)**:
  - **Projeto Isolado Criado**: `alastre-platform-restore-test-20260926` (ref `dagnthlcpsrrwjpwyxei`, região `sa-east-1`, status `ACTIVE_HEALTHY`).
  - **Resultado**: **`NO-GO`**.
  - **Causa Raiz Identificada**: A aplicação das migrations de fundação via `supabase db push` foi interrompida na migration `20260925090000_client_success_multi_tenant_hardening.sql` por incompatibilidade de tipo de dados SQL (SQLSTATE 42804: `commercial_opportunities.id` `text` vs `client_expansion_recommendations.commercial_opportunity_id` `uuid`).
  - **Ação Segura Executada**: Nenhum procedimento destrutivo ou alteração de migration aplicada foi realizado. O projeto temporário foi mantido ativo para inspecção e deliberação do usuário.

- **Erradicação de Vulnerabilidades em Dependências de Produção**:
  - `npm audit --omit=dev`: **0 vulnerabilidades** em dependências de tempo de execução de produção.
  - Pacotes `next` (16.3.6), `eslint-config-next` (16.3.6), `vite` (8.3.1) e transitivos atualizados mantendo o lockfile e sem quebras em `vinext`.
  - `npm audit fix --force` **não foi utilizado**; atualizações feitas de forma seletiva e segura.

- **Remoção de Bypass `server-only` e Proteção Preservada**:
  - Exclusão total do script `scripts/postinstall-stub-server-only.js` e do hook `"postinstall"` em `package.json`.
  - O arquivo `node_modules/server-only/index.js` permanece intacto com sua proteção nativa contra importação no cliente.
  - Testes automatizados executados via hook dinâmico de ESM loader (`tests/helpers/register-loader.js`), que intercepta o specifier em memória durante o `npm test` sem alterar `node_modules` em disco.

- **Endurecimento da Rota de Saúde (`GET /api/health`)**:
  - Resposta pública mínima (`{ "status": "ok", "timestamp", "version": "0.1.0" }`), sem dados de infraestrutura, ambiente, banco, `write_mode` ou provedores.
  - Diagnóstico detalhado de prontidão (`GET /api/health?detail=true`) restrito a atores autenticados com papéis de liderança (`owner`, `admin`, `operations_lead`), com retorno `401 Unauthorized` ou `403 Forbidden` quando não autorizado.
  - Validação de Correlation ID limitando o tamanho máximo em 64 caracteres e sanitizando caracteres inválidos/XSS.
  - Cabeçalho de controle de cache `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`.

- **Suíte de Validação Proporcional**:
  - `npm test`: **404/404 testes passando (100% sucesso)**, incluindo suíte de observabilidade `tests/monitoring-and-health.test.ts`.
  - TypeScript (`npx tsc --noEmit`): **0 erros de compilação**.
  - ESLint (`npx eslint`): **0 erros** nos arquivos alterados.
  - Build de Produção (`npx vinext build`): Concluído com sucesso (5 ambientes compilados).
  - Decision: **`NO-GO`** (devido à pendência de alinhamento de tipo de dados na migration 43 para reconstrução limpa a partir do zero).





