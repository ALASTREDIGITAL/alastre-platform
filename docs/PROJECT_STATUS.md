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
