# Roadmap

O roadmap prioriza primeiro uma operação interna utilizável e, em seguida, o domínio central de SEO Local. A passagem entre marcos depende de navegação estável, dados confiáveis e segurança operacional.

## Marco A — Produto utilizável

- Navegação estável e estados de erro/indisponibilidade seguros.
- Clientes e onboarding.
- DNA central do cliente.
- Agentes consumindo o DNA.
- Home como dashboard operacional da agência.

## Marco B — SEO Local V1

**Estado:** base navegável entregue localmente; integrações e dados reais pendentes.

- Domínio de dados de SEO Local e Google Business Profile.
- Dashboard de SEO Local por cliente.
- Alastre Local Score V1 explicável e extensível.
- Perfil, auditoria, avaliações, postagens e oportunidades.
- Histórico e alertas operacionais básicos.

## Marco C — Agente SEO Local

**Estado:** Marco C.1 aplicado na homologação; bridge v30 e política mínima de IA entregues. Smoke autenticado aguarda configuração local do bridge, e o Google Business Profile permanece desconectado.

- Recomendações priorizadas.
- Geração assistida de postagens.
- Geração assistida de respostas a avaliações.
- Fila de revisão e aprovação humana.

## Marco D — Relatórios SEO Local

- Histórico e evolução.
- Registro das entregas realizadas.
- Resultados, oportunidades e próximos passos.
- Relatório automatizado e base para integração com Alastre Reports.

## Marco E — Google Ads e Tracking

- Finalizar diagnóstico e operação de Google Ads.
- Finalizar GTM e GA4.
- Aprovação humana e operação real controlada.
- Manter escrita externa desativada até autorização explícita.

## Marco F — Meta Ads

- Adotar arquitetura semelhante a Google Ads.
- Planejamento, aprovação, execução controlada e análise.

## Marco G — Sites e SEO integrado

- Integrar oportunidades locais, conteúdo, páginas, schema, performance, conversão e tracking.
- Compartilhar inteligência com SEO Local e mídia paga.

## Marco H — Comercial e prospecção

- Prospecção local e Opportunity Score.
- Diagnóstico de leads.
- Kanban: lead, contato, diagnóstico, reunião, proposta, negociação, ganho e onboarding.

## Marco I — Propostas, contratos e financeiro

- Propostas e modelos reutilizáveis.
- Aceite, assinatura eletrônica e contratos.
- Recorrência, contas a receber, custos e rentabilidade por cliente.

## Marco J — Autonomia operacional ampliada

- Operação por exceção em escala.
- Automação segura de rotinas recorrentes.
- Alertas, filas e agentes coordenados.
- Evolução da plataforma para possível oferta SaaS.
## Marco D — Connection Hub (fundação local)

- [x] Catálogo de providers e capabilities, estados humanos e health conceitual.
- [x] Experiência Configurações → Conexões, modos simples/avançado e onboarding de organização/cliente.
- [x] Contratos internos, modelo multi-tenant e migration local não aplicada.
- [ ] OAuth Google real, cofre de credenciais, discovery, seleção e binding persistido.
- [ ] Adaptação progressiva de SEO Local, Ads e Tracking para consumir conexões válidas do Hub.

### Marco D.1 — Google Business Profile

- [x] OAuth server-side com state, PKCE, consentimento mínimo e callback seguro.
- [x] Adapter Google read-only para Accounts e Locations, paginação, refresh e health.
- [x] Supabase Vault como credential store e resource binding com validação de tenant.
- [x] SEO Local consulta o Connection Hub por cliente e capability.
- [ ] Aplicar a migration local e configurar as credenciais OAuth administrativas para realizar a primeira conexão real.

### Marco C.2 — SaaS readiness enquanto Google está pendente

- [x] Status administrativo do provider separado de conexão, autorização e health.
- [x] Google `platform_managed` e bloqueado em `pending_provider_approval` sem chamadas externas.
- [x] Onboarding em seis etapas e catálogo de serviços por cliente.
- [x] Abstração `LocalSeoDataProvider` e estados confiáveis de dados.
- [x] Central de Operações preparada para escala sem contagens fictícias.
- [ ] Após aprovação: configurar OAuth, marcar `ready_for_oauth` e executar a primeira sincronização read-only.

### Marco D — SEO Local V2: central operacional

- [x] Visão executiva por cliente com saúde, origem dos dados e ações diretas.
- [x] Local Score V2 com pesos, confiança, evidências, problemas, impacto e recomendação.
- [x] Auditoria completa do Perfil Google preparada sem fabricar verificações.
- [x] Centrais operacionais de avaliações, planejamento editorial e oportunidades.
- [x] Palavras-chave, LocalRankProvider separado e comparação competitiva preparados.
- [x] Central da Agência e Cliente 360 preparados para operação modular.
- [x] Aplicar as migrations autorizadas e persistir serviços, auditoria manual, palavras-chave, concorrentes, score parcial e oportunidades por regra.
- [x] Restringir os novos domínios ao servidor com RLS, validação de tenant e auditoria operacional.
- [ ] Configurar as variáveis seguras no runtime local para homologar o ciclo completo pela interface.
- [ ] Integrar o gateway de IA para sugestões de palavras-chave quando a configuração estiver disponível.
- [ ] Conectar Google Business Profile e um LocalRankProvider após aprovação dos providers, mantendo leitura e escrita externa sob controles separados.
