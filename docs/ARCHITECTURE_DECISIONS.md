# Decisões de Arquitetura

## AD-001 — Cliente e DNA como núcleo

**Status:** aceita.

O cliente é a raiz dos domínios funcionais. Seu DNA centraliza contexto, fatos confirmados, fontes e regras reutilizados por módulos e agentes. Informações compartilhadas não devem ser duplicadas de forma divergente em cada módulo.

## AD-002 — SEO Local como domínio prioritário

**Status:** aceita.

SEO Local / Google Business Profile orienta a próxima evolução do produto. Google Ads e tracking permanecem importantes, porém complementares. Novos investimentos estruturais devem considerar primeiro seu impacto na operação central da agência e no SEO Local.

## AD-003 — Agentes como camada transversal

**Status:** aceita.

Agentes não são silos. Eles consomem o DNA, atuam em domínios especializados, respeitam políticas e aprovações e registram ações relevantes para histórico, auditoria e relatórios.

## AD-004 — Human-in-the-Loop e operação por exceção

**Status:** aceita.

A plataforma automatiza detecção, preparação e recomendação. Publicações, campanhas, orçamento e demais ações externas sensíveis exigem controle explícito e trilha de auditoria. A interface deve concentrar a atenção humana nas exceções e decisões relevantes.

## AD-005 — Escrita externa bloqueada por padrão

**Status:** aceita.

`ALASTRE_WRITE_MODE=disabled` é o padrão obrigatório até autorização explícita. Integrações devem separar leitura, planejamento, aprovação e execução. Falhas ou ausência de integração devem resultar em estados seguros e navegáveis, nunca em tentativa implícita de escrita.

## AD-006 — Contratos de API validados na fronteira

**Status:** aceita.

Respostas HTTP e JSON devem ser validadas antes de chegar à interface. A camada compartilhada deve distinguir sucesso, formato inválido, indisponibilidade, falha de rede e cancelamento. Componentes não devem executar `.map`, `Object.entries` ou acesso profundo antes da validação do payload.

## AD-007 — Efeitos assíncronos canceláveis

**Status:** aceita.

Um `useEffect` retorna somente `undefined` ou uma função de cleanup. Fetches iniciados por effects usam `AbortController` quando apropriado, tratam cancelamento como fluxo normal e não atualizam estado após desmontagem.

## AD-008 — Alastre Local Score explicável

**Status:** aceita como direção; fórmula pendente de dados.

O score será modular, transparente e versionado. Seus pilares iniciais são Perfil, Relevância, Reputação, Conteúdo, Autoridade, Presença Local e Conversão. Pesos e regras não serão fixados arbitrariamente; devem evoluir com dados reais e manter explicação por pilar.

## AD-009 — Experiência orientada ao operador

**Status:** aceita.

A home é uma Central de Operações, não um painel de infraestrutura. Textos, estados e ações devem priorizar clientes, saúde, tarefas, alertas, oportunidades, aprovações e resultados, com linguagem acessível e ajuda contextual.

## AD-010 — Evolução modular e integrações isoladas

**Status:** aceita.

SEO Local, Sites/SEO, mídia paga, tracking, relatórios, comercial e financeiro evoluem como domínios conectados pelo cliente, DNA, aprovações e auditoria. Integrações externas devem permanecer isoladas e substituíveis. Os projetos e ambientes `project-lumina`, `alastre-platform`, Alastre Platform Homologação e Supabase Gol de Placa não podem ser misturados sem plano explícito.

## AD-011 — Validação proporcional ao risco

**Status:** aceita.

Iterações comuns usam TypeScript da área, lint direcionado e smoke tests específicos. Validações completas ficam reservadas para marcos, mudanças estruturais, deploys e pushes importantes solicitados.

## AD-012 — Git e entrega em checkpoints

**Status:** aceita.

Trabalho visual permanece local durante a iteração. Commit, push e deploy ocorrem em checkpoints maiores ou quando solicitados. Não criar branches sem necessidade nem reescrever histórico já publicado e sincronizado com ferramentas externas.

## AD-013 — Operações de SEO Local persistentes e auditáveis

**Status:** aceita; migration local pendente de aplicação autorizada.

Postagens, avaliações e oportunidades são registros operacionais persistentes vinculados a `agency_id` e `client_id`. Estados representam preparação, revisão, aprovação e execução como etapas diferentes. A Central de Aprovações existente recebe novas origens de SEO Local; aprovação nunca implica publicação automática. Dados operacionais não usam `localStorage` como fonte permanente.
## AD-014 — Integrações externas pertencem ao Connection Hub

Integrações externas são acessadas por meio do Connection Hub. Módulos funcionais não possuem credenciais OAuth. SEO Local, Google Ads e Tracking devem consumir progressivamente uma abstração equivalente a `getClientConnection(client_id, capability)`. Connections pertencem ao tenant; recursos descobertos são entidades próprias e só se tornam parte da operação de um cliente por um binding validado no servidor. Credenciais são referências server-side, nunca campos públicos, respostas, logs ou auditoria.

## AD-015 — Modo Simples como experiência SaaS padrão

O Modo Simples é a experiência SaaS padrão. Detalhes técnicos de integração ficam ocultos de usuários comuns. O modo avançado pode apresentar IDs, capabilities, health, sincronização e erros sanitizados, mas jamais tokens, chaves ou segredos. Entitlements serão aplicados por capability, sem acoplamento rígido a nomes de planos.

## AD-016 — Isolamento e autorização de conexões

Toda connection, capability, resource, authorization session e binding carrega `agency_id`. FKs compostas impedem bindings entre tenants; tabelas ficam inacessíveis a `anon` e `authenticated` e são operadas pela camada server-side, que deverá resolver usuário, organização e papel antes de cada ação. O estado OAuth será armazenado somente como hash com expiração. Eventos de auditoria registram o ciclo de vida, nunca credenciais.

## AD-017 — Google provider, Vault e consentimento incremental

Google é um provider único com capabilities independentes. A primeira autorização solicita somente `business.manage` para Google Business Profile; Google Ads, Analytics e Tag Manager exigirão consentimento incremental. Tokens são armazenados pelo `CredentialStore` no Supabase Vault e entidades públicas conservam apenas a referência. O adapter é server-side, paginado e read-only nesta fase. Dados Google não sobrescrevem o DNA: são uma fonte de verdade apenas para os campos do recurso externo.
