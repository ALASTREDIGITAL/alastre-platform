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


