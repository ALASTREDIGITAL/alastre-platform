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
  - RLS 100% ativo, tenant isolation por `agency_id`, grants de `anon`/`authenticated` revogados e acesso de backend restrito a `service_role`.
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

