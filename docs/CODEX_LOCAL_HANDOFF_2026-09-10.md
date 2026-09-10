# Plataforma Autônoma Alastre Digital — Handoff para Codex Local

Atualizado em: 10/09/2026  
Projeto canônico: `alastre-platform`  
Cliente piloto: **Bionippon**

Este documento transfere o contexto técnico e operacional da Plataforma Alastre para outra sessão do Codex. Ele não contém senhas, tokens, refresh tokens, chaves privadas nem credenciais de banco.

## 1. Aviso crítico: projeto correto

Existem dois códigos diferentes e eles não devem ser misturados:

| Código | Função | Situação |
|---|---|---|
| `alastre-platform` | Plataforma Autônoma Alastre Digital: clientes, DNA, agentes, aprovações, Google Ads, GTM/GA4, custos e auditoria | **Projeto canônico deste handoff** |
| `ALASTREDIGITAL/project-lumina` | Sistema de relatórios que já existia em outro trabalho | Projeto separado; pode ser integrado futuramente como módulo/doador, mas não é a base desta plataforma |

Se a pasta local aberta mostrar primeiro o sistema de relatórios, o Codex está no repositório errado.

## 2. Onde o projeto está hoje

### Código-fonte atual

O código exato desta plataforma está no repositório de origem privado do ChatGPT Sites, e não em um repositório GitHub confirmado:

- Provider: `cloudflare_artifact`
- Repositório interno: `appgprj_6a98f227588c81918618ffa544b19799`
- Branch: `main`
- Remote sem credencial: `https://git.chatgpt-team.site/f478657c-f2ac-4d7e-b043-3a415c9b9772/appgprj_6a98f227588c81918618ffa544b19799.git`
- Commit publicado atual: `f54a5c165d3466d5608ceaa9c7066870b13bbebe`

O remote acima exige credencial temporária gerada pelo ChatGPT Sites. Nunca salvar essa credencial no Git, em `.env`, em documentação ou no histórico do terminal.

### GitHub

No momento deste handoff, **a Plataforma `alastre-platform` ainda não possui um remote GitHub configurado nesta cópia**. O destino recomendado é criar um repositório privado vazio:

`https://github.com/ALASTREDIGITAL/alastre-platform`

Não usar `project-lumina` como substituto. Após importar o pacote de código entregue junto deste documento:

```powershell
cd "C:\Projetos\ALASTRE DIGITAL\ALASTRE-PLATFORM"
git init
git add .
git commit -m "chore: import canonical Alastre Platform handoff"
git branch -M main
git remote add origin https://github.com/ALASTREDIGITAL/alastre-platform.git
git push -u origin main
```

Antes disso, criar no GitHub o repositório privado `ALASTREDIGITAL/alastre-platform`, vazio e sem README automático.

### Aplicação online

- Nome: `Alastre Digital — Plataforma`
- URL: `https://alastre-platform.ag-alastredigital.chatgpt.site`
- Site project ID: `appgprj_6a98f227588c81918618ffa544b19799`
- Versão online: `26`
- Acesso: privado/custom, somente proprietário
- Proprietário: `ag.alastredigital@gmail.com`
- Hospedagem: ChatGPT Sites sobre Cloudflare
- Modo de escrita externa online: `ALASTRE_WRITE_MODE=disabled`

## 3. Objetivo e arquitetura do produto

A plataforma é um monólito modular multiempresa para administrar toda a operação da Alastre Digital:

```text
Ator autenticado
  -> Agência e papel
  -> Cliente selecionado
  -> DNA e fontes de inteligência
  -> Agente especializado
  -> Proposta/rascunho imutável
  -> Aprovação humana
  -> Executor controlado
  -> API externa
  -> Validação, auditoria, métricas e custos
```

Princípios obrigatórios:

- isolamento por agência e por cliente;
- agentes propõem, mas não publicam diretamente;
- todo efeito externo exige aprovação humana registrada;
- IDs recebidos pelo frontend nunca são confiáveis sem validação no backend;
- comandos importantes devem ser idempotentes e auditáveis;
- nenhum segredo pode chegar ao navegador;
- toda execução de IA/API deve permitir medição de consumo e custo;
- dark mode, light mode e preferência do sistema devem funcionar integralmente;
- interface responsiva, legível e adequada a usuários leigos;
- cada módulo complexo deve ter passo a passo e explicações contextuais.

## 4. Roadmap aprovado

### Etapa 1 — Sistema operacional interno

- autenticação e contexto de agência/papel/cliente;
- cadastro de clientes;
- ingestão de informações do Perfil da Empresa no Google;
- DNA e memória por cliente;
- agente conversacional por texto/áudio;
- Google Ads em modo de análise, rascunho e aprovação;
- GTM e GA4 com discovery, plano, aprovação e execução controlada;
- fila de aprovações;
- auditoria, RLS e segurança;
- AI Gateway e controle de custos;
- piloto Bionippon.

### Etapa 2 — Performance e financeiro

- métricas consolidadas de Google Ads, Meta Ads, GA4 e GBP;
- relatórios e insights;
- metas, orçamento, rentabilidade e financeiro;
- integrar o sistema de relatórios existente como módulo/doador;
- Meta Ads.

### Etapa 3 — Autonomia

- agentes especializados coordenados;
- monitoramento e recomendações automáticas;
- execução autônoma limitada por política, orçamento e aprovação;
- reconciliação, rollback e alertas.

## 5. Stack atual

- Node.js `>=22.13.0`
- TypeScript `5.9.3`
- React `19.2.6`
- Next `16.2.6`
- Vite `8.0.13`
- Vinext `0.0.50`
- Tailwind CSS `4.2.1`
- Supabase JS `2.115.0`
- Supabase CLI `2.116.0`
- Zod `3.25.76`
- Drizzle ORM `0.45.2`
- shadcn/Base UI/Radix
- Poppins via `@fontsource/poppins`
- Cloudflare Worker/Sites

O `package-lock.json` está versionado e as versões sensíveis estão fixadas. Não trocar framework, package manager ou lockfile sem uma necessidade concreta.

## 6. Estrutura principal do repositório

```text
alastre-platform/
├── .openai/hosting.json              # vínculo com ChatGPT Sites
├── app/
│   ├── api/platform/route.ts         # fachada interna principal
│   ├── api/google-ads/route.ts       # fachada Google Ads
│   ├── app-shell.tsx                 # navegação e shell do produto
│   ├── clients-module.tsx            # clientes + ingestão inicial
│   ├── dna-module.tsx                # DNA/memória
│   ├── agent-workspace.tsx           # conversa com agente
│   ├── google-ads-module.tsx         # análise/rascunho Google Ads
│   ├── tracking-module.tsx           # GTM + GA4
│   ├── approvals-module.tsx          # fila HITL
│   ├── operations-module.tsx         # operação/visão geral
│   ├── theme-provider.tsx             # claro/escuro/sistema
│   ├── typography.css                # legibilidade global
│   └── tracking-lifecycle.css        # ciclo guiado de tracking
├── agents/seo-local/AGENT_SPEC.md    # agente especialista em SEO local
├── components/ui/                    # componentes reutilizáveis
├── lib/
│   ├── supabase.ts                   # cliente público Supabase
│   └── database.types.ts             # tipos do banco
├── supabase/
│   ├── functions/
│   │   ├── _shared/platform-contracts.ts
│   │   ├── alastre-google-ads-bridge/index.ts
│   │   ├── alastre-gtm-service/index.ts
│   │   └── alastre-ga4-service/index.ts
│   ├── migrations/                   # histórico reproduzível
│   └── schema/foundation.sql         # referência inicial; migrations são canônicas
├── tests/
│   ├── migration-security.test.mjs
│   ├── platform-security.test.mjs
│   ├── rendered-html.test.mjs
│   └── ui-components.test.mjs
├── .env.example
├── CONTEXT.md                        # linguagem do domínio
├── README.md
└── package.json
```

## 7. Supabase

### Projeto correto

- Nome: `Alastre Platform Homologação`
- Project ref: `fifbtwbndutbvwnbzgtz`
- URL: `https://fifbtwbndutbvwnbzgtz.supabase.co`
- Região: `sa-east-1` (São Paulo)
- PostgreSQL: `17`
- Status conferido: `ACTIVE_HEALTHY`

Não usar o Supabase do Gol de Placa nem qualquer banco legado para esta plataforma.

### Tabelas públicas atuais

Todas as 30 tabelas abaixo estavam com RLS ativo na conferência de 10/09/2026:

```text
agencies
agency_actors
agency_members
agent_messages
agent_runs
agent_threads
ai_cost_policies
ai_usage_events
approval_items
audit_events
client_dna_profiles
client_intelligence_sources
clients
credential_refs
departments
google_ads_campaign_drafts
integrations
platform_command_receipts
service_registry
tracking_candidate_artifacts
tracking_deployments
tracking_execution_runs
tracking_profiles
tracking_resource_candidates
tracking_resources
tracking_templates
tracking_validations
work_items
workflow_runs
workflows
```

Dados conhecidos em homologação:

- Agência: `Alastre Digital`
- Clientes ativos: `Bionippon`, `Democrata Imóveis`
- Existe um cliente de teste chamado `TESTEdfgdfgdfgdfgdf`; revisar/remover somente por operação explícita e auditada.

### Migrations

As migrations canônicas ficam em `supabase/migrations`. O banco remoto possuía 23 migrations aplicadas até `tracking_complete_lifecycle`.

Estado importante:

- `tracking_complete_lifecycle` já foi aplicado ao Supabase remoto;
- `tracking_missing_stack_creation` existe localmente, mas ainda não foi aplicado ao remoto;
- alguns timestamps locais diferem dos timestamps registrados remotamente porque migrations anteriores foram aplicadas por ferramenta. Comparar por **nome e conteúdo**, não apenas pelo timestamp;
- nunca editar migration já aplicada; criar nova migration corretiva.

### Edge Functions remotas

| Função | Versão remota | JWT | Papel |
|---|---:|---|---|
| `alastre-google-ads-bridge` | 28 | desativado na borda; autenticação interna própria | orquestrador/fachada da plataforma |
| `alastre-core-bridge` | 9 | desativado na borda; autenticação interna própria | ponte de serviços centrais |
| `alastre-gtm-service` | 31 | ativado | Google Tag Manager |
| `alastre-gtm-oauth` | 12 | desativado na borda; OAuth próprio | conexão OAuth Google |
| `alastre-ga4-service` | 9 | ativado | Google Analytics Admin |
| `alastre-gtm-democrata-fix` | 12 | ativado | correção histórica específica da Democrata |

Atenção de reprodutibilidade: o repositório atual contém fonte local de apenas `alastre-google-ads-bridge`, `alastre-gtm-service` e `alastre-ga4-service`. Antes de alterar as outras três funções, o Codex local deve recuperar suas versões remotas e adicioná-las ao Git. Não redeployar uma função cuja fonte local esteja ausente.

## 8. Variáveis de ambiente

Criar `.env.local` a partir de `.env.example`. Nunca versionar `.env.local`.

```dotenv
# Valores públicos
NEXT_PUBLIC_SUPABASE_URL=https://fifbtwbndutbvwnbzgtz.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=OBTER_NO_DASHBOARD_SUPABASE

# Somente servidor
SUPABASE_SECRET_KEY=OBTER_NO_DASHBOARD_SUPABASE
SUPABASE_GOOGLE_ADS_BRIDGE_URL=https://fifbtwbndutbvwnbzgtz.supabase.co/functions/v1/alastre-google-ads-bridge
ALASTRE_BRIDGE_SECRET=OBTER_DOS_SECRETS_DA_PLATAFORMA

# Segurança: manter bloqueado no desenvolvimento inicial
ALASTRE_WRITE_MODE=disabled

# AI Gateway
OPENAI_API_KEY=CONFIGURAR_SOMENTE_NO_SERVIDOR
OPENAI_MODEL=gpt-5-mini
OPENAI_INPUT_COST_PER_1M_BRL=
OPENAI_OUTPUT_COST_PER_1M_BRL=
```

Estado do ambiente online:

- `NEXT_PUBLIC_SUPABASE_URL`: configurada;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: configurada;
- `SUPABASE_GOOGLE_ADS_BRIDGE_URL`: configurada;
- `ALASTRE_WRITE_MODE`: `disabled`;
- `ALASTRE_BRIDGE_SECRET`: entrada marcada como secreta, mas sem valor disponível no ambiente do Site na última conferência; investigar antes de habilitar escrita.

Chaves Google, refresh tokens OAuth, `SUPABASE_SECRET_KEY`, OpenAI e segredos internos devem existir apenas nos secrets do Supabase/Sites ou no `.env.local`, nunca no frontend.

## 9. Configurar o Codex local

### Requisitos

- Git
- Node.js 22.13 ou superior
- npm
- Supabase CLI compatível com o projeto
- Codex CLI/IDE autenticado
- acesso à organização GitHub `ALASTREDIGITAL`
- acesso ao projeto Supabase `fifbtwbndutbvwnbzgtz`

### Instalação do projeto

Depois que `ALASTREDIGITAL/alastre-platform` existir no GitHub:

```powershell
cd "C:\Projetos\ALASTRE DIGITAL"
git clone https://github.com/ALASTREDIGITAL/alastre-platform.git ALASTRE-PLATFORM
cd ALASTRE-PLATFORM
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Comandos de validação:

```powershell
npm run build
npm test
npm run lint
```

### Vincular Supabase CLI

Descobrir primeiro os comandos disponíveis na versão instalada:

```powershell
npx supabase --version
npx supabase --help
npx supabase login
npx supabase link --project-ref fifbtwbndutbvwnbzgtz
npx supabase migration list
```

Não usar `db reset`, `db push`, `migration repair` ou comandos destrutivos sem comparar o estado local/remoto e obter autorização explícita.

### Conectar Supabase MCP ao Codex

Usar conexão restrita ao projeto de homologação. Começar em modo somente leitura:

```powershell
codex mcp add supabase-alastre-readonly --url "https://mcp.supabase.com/mcp?project_ref=fifbtwbndutbvwnbzgtz&read_only=true"
codex mcp login supabase-alastre-readonly
codex mcp list
```

Para uma sessão controlada de migrations/deploy, adicionar separadamente a conexão com escrita e manter aprovação manual de ferramentas:

```powershell
codex mcp add supabase-alastre-write --url "https://mcp.supabase.com/mcp?project_ref=fifbtwbndutbvwnbzgtz"
codex mcp login supabase-alastre-write
codex mcp list
```

O Codex armazena servidores MCP em `~/.codex/config.toml` ou em `.codex/config.toml` dentro de um projeto confiável. A documentação oficial recomenda escopo de projeto e modo read-only para reduzir risco.

## 10. Estado funcional dos módulos

| Módulo | Estado atual |
|---|---|
| Shell, navegação e responsividade | implementado |
| Dark/light/system | implementado |
| Tipografia/legibilidade | revisada; Poppins e tamanhos ampliados |
| Clientes | cadastro guiado implementado |
| Ingestão de texto do GBP | implementada na interface e backend |
| DNA e memória | estrutura, versionamento e status implementados |
| Agente conversacional | interface texto/áudio e persistência implementadas; IA real depende de configuração do AI Gateway |
| Google Ads | análise, rascunho, aprovação e ponte implementados em estágio inicial |
| Aprovações HITL | implementadas |
| Auditoria | implementada |
| Custos de IA | schema, políticas e registros implementados; painel/uso real ainda precisa maturidade |
| GTM/GA4 discovery | implementado |
| Seleção/criação de recursos GTM/GA4 | implementação local em conclusão; migration remota pendente |
| Preparação de workspace e versão GTM | implementação local em conclusão |
| Aprovação separada de publicação | implementação local em conclusão |
| Publicação e validação de produção | implementação local em conclusão; nenhuma publicação real foi executada nesse ciclo |
| Meta Ads | ainda não integrado à plataforma canônica |
| Relatórios | ainda não integrado ao projeto canônico |
| Financeiro | não iniciado |

## 11. Fluxo GTM/GA4 projetado

```text
Selecionar cliente
  -> executar discovery somente leitura
  -> reconciliar recursos existentes
  -> escolher GTM e GA4 corretos ou propor criação
  -> gerar plano e config_hash
  -> aprovação humana do plano
  -> preflight ao vivo
  -> criar workspace candidato
  -> configurar variável, Google Tag, triggers e tags de eventos
  -> garantir key events no GA4
  -> criar versão GTM sem publicar
  -> segunda aprovação humana, específica para publicação
  -> publicar versão exata aprovada
  -> validar versão, key events e IDs encontrados no site
  -> registrar evidências e auditoria
```

Travas existentes:

- `ALASTRE_WRITE_MODE` central;
- `approved=true` obrigatório nos serviços;
- `approval_id` UUID obrigatório;
- aprovação vinculada a cliente, implantação, `config_hash` e versão;
- serviços validam formatos de paths Google;
- frontend nunca recebe refresh token Google;
- execução e publicação são etapas separadas;
- falha deve preservar evidência sem marcar produção como validada.

## 12. Estado exato do trabalho não publicado

O checkout usado para este handoff possui alterações ainda não commitadas em relação ao commit online `f54a5c1`:

```text
M  app/approvals-module.tsx
M  app/layout.tsx
M  app/tracking-module.tsx
M  supabase/functions/alastre-ga4-service/index.ts
M  supabase/functions/alastre-google-ads-bridge/index.ts
M  supabase/functions/alastre-gtm-service/index.ts
M  tests/migration-security.test.mjs
?? app/tracking-lifecycle.css
?? supabase/migrations/20260910193000_tracking_complete_lifecycle.sql
?? supabase/migrations/20260910194500_tracking_missing_stack_creation.sql
```

Validação mais recente desse conjunto:

- build: aprovado;
- testes: 26 aprovados, 0 falhas;
- lint: aprovado.

Sincronização parcial já realizada:

- migration `tracking_complete_lifecycle`: aplicada ao Supabase;
- `alastre-gtm-service`: remoto v31;
- `alastre-ga4-service`: remoto v9;
- `alastre-google-ads-bridge`: remoto v28, mas o arquivo local contém mudanças posteriores ainda não redeployadas;
- migration `tracking_missing_stack_creation`: somente local;
- interface nova do ciclo completo: somente local e ainda não publicada no Site.

Consequência: o pacote de handoff deve ser tratado como a fonte mais nova. Não substituir esses arquivos pela versão 26 do Site.

## 13. Próxima sequência recomendada ao Codex local

1. Confirmar `git status` e preservar integralmente as mudanças do handoff.
2. Rodar `npm ci`, `npm run build`, `npm test` e `npm run lint`.
3. Revisar idempotência da criação de property/stream GA4 e da criação de versão GTM.
4. Aplicar `tracking_missing_stack_creation` somente após revisar o diff e os advisors.
5. Redeployar `alastre-google-ads-bridge` com a fonte local atual.
6. Conferir logs e advisors de segurança/performance.
7. Commitar tudo em `ALASTREDIGITAL/alastre-platform`.
8. Publicar nova versão privada do Site.
9. Manter `ALASTRE_WRITE_MODE=disabled` até `ALASTRE_BRIDGE_SECRET` estar configurado e existir um teste controlado.
10. Executar o primeiro ciclo real com Bionippon apenas por meio das duas aprovações internas; não usar chamadas manuais que contornem o fluxo.
11. Depois da certificação GTM/GA4, integrar Google Ads completo, Meta Ads, relatórios e financeiro conforme o roadmap.

## 14. Regras que o Codex local deve obedecer

- Não alterar nenhum outro projeto Supabase.
- Não misturar Gol de Placa com Alastre Platform.
- Não usar `project-lumina` como base desta plataforma.
- Não publicar campanhas, tags, containers, properties ou versões sem aprovação registrada.
- Não ativar orçamento de mídia automaticamente.
- Não colocar `service_role`, secret key, OAuth secret ou refresh token em código do navegador.
- Não editar migrations já aplicadas.
- Não aceitar IDs de cliente/agência/recurso sem resolver o ator e validar pertencimento no servidor.
- Não apagar dados de homologação sem comando explícito.
- Não declarar o GTM/GA4 “100% concluído” sem um teste real de ponta a ponta e validação pós-publicação.
- Preservar a identidade visual roxo + grafite, Poppins, estética futurista elegante e os dois temas completos.
- Trabalhar autonomamente e interromper apenas diante de credencial ausente, custo, ação irreversível ou publicação externa real.

## 15. Prompt pronto para colar no Codex local

```text
Você dará continuidade à Plataforma Autônoma Alastre Digital no repositório canônico alastre-platform. Antes de editar qualquer arquivo, leia integralmente:

1. docs/CODEX_LOCAL_HANDOFF_2026-09-10.md
2. CONTEXT.md
3. README.md
4. .env.example
5. package.json
6. todas as migrations em supabase/migrations, em ordem
7. supabase/functions/_shared/platform-contracts.ts
8. as três Edge Functions presentes no repositório
9. os testes em tests/

Projeto Supabase correto: fifbtwbndutbvwnbzgtz, Alastre Platform Homologação, sa-east-1.
Site atual: https://alastre-platform.ag-alastredigital.chatgpt.site, privado.
Cliente piloto: Bionippon.

Nunca use outro projeto Supabase. Nunca misture Gol de Placa ou project-lumina com este sistema. Não exponha segredos. Mantenha ALASTRE_WRITE_MODE=disabled até que as travas e o segredo da bridge estejam confirmados. Toda escrita em Google Ads, GTM, GA4 ou Meta exige aprovação humana registrada, vínculo ao cliente, hash/versionamento, idempotência, auditoria e validação posterior.

Comece auditando o estado local versus remoto. Preserve as mudanças não commitadas descritas no handoff. Rode build, testes e lint. Depois finalize o ciclo GTM/GA4: idempotência, migration tracking_missing_stack_creation, redeploy da bridge, advisors, commit e versão privada do Site. Não execute publicação real em conta Google sem a aprovação final específica dentro da plataforma.

Trabalhe em ciclos contínuos, sem pedir revisão a cada pequena etapa. Pare somente se faltar credencial, houver custo, operação destrutiva, conflito de projeto ou publicação externa real.
```

## 16. Referências oficiais de configuração

- Supabase MCP: https://supabase.com/docs/guides/ai-tools/mcp
- Codex MCP: https://learn.chatgpt.com/docs/extend/mcp?surface=cli
- Supabase dashboard do projeto: `https://supabase.com/dashboard/project/fifbtwbndutbvwnbzgtz`

## 17. Critério de continuidade bem-sucedida

O Codex local estará pronto quando conseguir:

1. abrir o repositório correto;
2. instalar dependências sem alterar o lockfile;
3. executar build, testes e lint;
4. listar exclusivamente o Supabase `fifbtwbndutbvwnbzgtz` via MCP;
5. comparar migrations locais/remotas;
6. listar as Edge Functions e suas versões;
7. manter escrita externa bloqueada;
8. explicar o próximo passo GTM/GA4 antes de efetuar qualquer publicação real.
