# Google no Connection Hub

## Projeto oficial e situação administrativa

- Google Cloud Project: **Alastre Platform**
- Project ID: `alastre-platform`
- Project Number: `286084102789`
- Solicitação GBP: `4-5388000041735`
- Estado atual: `pending_provider_approval`
- Gerenciamento: `platform_managed`

O Google ainda não aprovou/liberou o acesso. `Alastre Reports` não é o projeto oficial do novo SaaS. Enquanto o provider estiver pendente, OAuth, discovery e health externo ficam bloqueados. Nenhum segredo é registrado nesta documentação.

## Fluxo

O Google é um único provider do Connection Hub. Nesta primeira integração, o consentimento solicita apenas `https://www.googleapis.com/auth/business.manage`. O servidor cria uma sessão curta e single-use, armazena somente o hash de `state` na tabela e guarda o verificador PKCE no Supabase Vault. O callback valida usuário, tenant, estado e expiração antes de trocar o código.

Tokens nunca chegam ao frontend. Access e refresh tokens são guardados como um segredo JSON no Vault; `integration_connections` mantém apenas a referência `vault:<uuid>`. Refresh ocorre no servidor. Falha por revogação muda a saúde para atenção e exige reconexão.

## Discovery e recursos

O adapter consulta, de forma somente leitura, a Account Management API para contas acessíveis e a Business Information API para locations, usando paginação e `readMask`. O banco conserva somente campos operacionais necessários e metadata sanitizada. Accounts e locations tornam-se `ExternalResource`; a location mantém a conta pai por `parent_external_resource_key`.

O usuário escolhe uma location descoberta e a vincula a um `client_id` já existente. O servidor valida actor, agência, cliente, recurso, connection e capability. SEO Local consulta o Connection Hub por `client_id + google_business_profile`; nunca lê tokens nem chama o Google diretamente.

## Health e sincronização

Estados públicos são: conectado, precisa de atenção, problema e não configurado. Internamente são registrados `last_sync_at`, `last_success_at`, `sync_status` e códigos sanitizados. A primeira sincronização é estritamente read-only e não sobrescreve o DNA; os campos importados mantêm `source: google_business_profile`.

## Limites atuais

A migration do Connection Hub precisa ser aplicada e o Vault precisa estar disponível. Também são necessárias credenciais OAuth de uma aplicação Google Cloud aprovada para Business Profile APIs. Google Ads, Analytics e Tag Manager usarão o mesmo provider com consentimento incremental, sem OAuth paralelo.

## Google Provider Readiness

- [x] Google Cloud project definido
- [ ] Business Profile APIs habilitadas e aprovadas
- [ ] OAuth consent configurado
- [ ] OAuth Client criado
- [ ] Redirect URI cadastrada
- [ ] `GOOGLE_OAUTH_CLIENT_ID` configurado server-side
- [ ] `GOOGLE_OAUTH_CLIENT_SECRET` configurado server-side
- [ ] `GOOGLE_OAUTH_REDIRECT_URI` configurado server-side
- [ ] Primeira conexão real realizada
- [ ] Account discovery validado
- [ ] Location discovery validado
- [ ] Client binding validado

## Primeiro teste real após aprovação

1. Confirmar quota GBP maior que zero e APIs necessárias habilitadas.
2. Configurar Google Auth, criar o OAuth Web Client e cadastrar o redirect URI.
3. Configurar as variáveis somente no servidor.
4. Alterar `GOOGLE_PROVIDER_AVAILABILITY` para `ready_for_oauth`.
5. Usuário conecta o Google, autoriza, escolhe Account/Location e vincula o Perfil ao cliente.
6. Executar a primeira sincronização estritamente read-only.

`ALASTRE_WRITE_MODE` permanece `disabled`; não publicar perfil, posts ou respostas nesta etapa.
