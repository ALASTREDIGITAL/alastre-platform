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

OAuth, callback, refresh, discovery read-only, seleção de Perfil da Empresa, binding e consulta pelo SEO Local estão implementados localmente. O fluxo real permanece bloqueado de forma segura até a migration do Connection Hub ser aplicada e `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` e `GOOGLE_OAUTH_REDIRECT_URI` serem configurados no servidor. Nenhum token real foi recebido, nenhuma chamada ao Google foi executada e nenhuma migration remota foi aplicada.
