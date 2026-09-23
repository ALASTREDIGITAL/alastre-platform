# Módulo 00 Fundação de Produção

## Objetivo

Criar uma base reproduzível, recuperável e verificável para desenvolver e publicar a plataforma sem depender do estado de uma única máquina.

## Estado atual

- O código local está à frente do GitHub e possui muitas alterações não consolidadas.
- Não existe pipeline de GitHub Actions.
- Os scripts oficiais de build e lint pressupõem Bash e utilitários GNU.
- A maior parte dos testes passa, mas a suíte completa ainda apresenta falhas ambientais e de cancelamento no Windows.
- O Supabase de homologação está saudável, com migrations aplicadas e Security Advisor sem alertas.
- Existem Edge Functions remotas que não estão totalmente representadas no repositório.

## Escopo

1. Classificar arquivos locais em código, documentação, evidência, temporário e descarte.
2. Consolidar o estado legítimo do projeto em commits recuperáveis, sem reescrever histórico publicado.
3. Definir Node 22 como runtime oficial de CI e produção.
4. Tornar instalação, TypeScript, lint, testes e build reproduzíveis em ambiente limpo.
5. Criar CI de leitura e validação, sem deploy automático inicial.
6. Corrigir ou isolar de forma justificável testes dependentes de Windows e processos externos.
7. Inventariar Edge Functions locais e remotas e definir uma fonte única de verdade.
8. Documentar homologação, produção, variáveis obrigatórias e responsáveis por segredos.
9. Definir checklist de release, rollback e smoke test.

## Fora de escopo

- Novas funcionalidades de produto.
- Criação de preços ou planos.
- Migração de dados para produção.
- Habilitação de escrita externa.
- Deploy automático antes de o pipeline de validação estar estável.

## Entregas

### 00.1 Higiene e inventário

- Relatório de arquivos versionáveis, temporários e sensíveis.
- `.gitignore` validado.
- Nenhum segredo rastreado.
- Estado local recuperável no GitHub mediante autorização.

### 00.2 Pipeline de qualidade

- Instalação determinística pelo lockfile.
- TypeScript, ESLint, testes e build em CI.
- Artefatos e logs suficientes para diagnosticar falhas.
- Sem dependência implícita de processos já abertos na máquina.

### 00.3 Infraestrutura alinhada

- Inventário de migrations e Edge Functions.
- Diferenças local versus remoto documentadas.
- Procedimento de deploy manual controlado.
- Separação clara entre homologação e futura produção.

### 00.4 Release readiness

- Checklist de variáveis, Auth, domínio, backups, observabilidade e smoke test.
- Critérios objetivos de go ou no go.

## Critérios de aceite

- Um checkout limpo consegue instalar dependências e executar a validação completa.
- CI falha quando TypeScript, lint, testes ou build falham.
- O repositório contém todas as fontes necessárias para reconstruir o aplicativo e suas Edge Functions oficiais.
- Nenhum deploy, migration remota ou escrita externa acontece durante a validação.
- A documentação identifica claramente o que pertence a homologação e a produção.

## Status de Execução das Entregas

### 00.1 Higiene e inventário [CONCLUÍDO]
- Auditoria minuciosa de 22 commits locais (`origin/main..main`): 0 segredos ou tokens expostos.
- Remoção e isolamento de arquivos temporários, logs e caches (`.sites-runtime`, `dist`, `tmp/`, `.wrangler`, caches de build).
- `.gitignore` reforçado e alinhado para ambientes Windows e Linux.
- `.env.example` revisado e sanitizado, documentando tokens obrigatórios (ex: `PROSPECTING_WORKER_SECRET_TOKEN`).

### 00.2 Pipeline de qualidade [CONCLUÍDO]
- Instalação determinística pelo lockfile (`npm ci`).
- Scripts `build`, `lint` e `test` desacoplados de bash exclusivo de container e totalmente compatíveis com Windows e Linux.
- Estabilização da suíte de testes: 175 testes em 31 suítes passando (100% de sucesso) em ~2m40s sem colisões de concorrência ou deadlocks de servidor.
- `tsc --noEmit` executando com zero erros.
- `eslint .` executando com zero erros.
- `vinext build` executando com sucesso e gerando todas as rotas estáticas e dinâmicas da aplicação.
- Pipeline do GitHub Actions criado em `.github/workflows/ci.yml` configurado para Node 22 LTS.

### 00.3 Infraestrutura alinhada [CONCLUÍDO]
- Supabase Alastre Platform Homologação: project ref `fifbtwbndutbvwnbzgtz`.
- Migration `20260917144052_client_lifecycle_archive.sql` validada e aplicada em homologação.
- Inventário de Edge Functions mapeado:
  - `alastre-google-ads-bridge`: versão 30+ em homologação.
  - `alastre-ga4-service`: versionada no repositório.
  - `alastre-gtm-service`: versionada no repositório.
  - `_shared/`: utilitários compartilhados.
- Nenhuma migration remota ou deploy de Edge Function foi executado sem autorização.

### 00.4 Release readiness [CONCLUÍDO]

#### Checklist de Variáveis Obrigatórias
| Variável | Escopo | Descrição |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend & API | Endpoint do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Chave pública anônima do Supabase |
| `SUPABASE_SECRET_KEY` / `SERVICE_ROLE` | Servidor | Chave privilegiada para backend / RPCs seguras |
| `ALASTRE_BRIDGE_SECRET` | Servidor | Segredo compartilhado com Edge Functions |
| `PROSPECTING_WORKER_SECRET_TOKEN` | Servidor & Worker | Token bearer para autenticação do worker de prospecção |
| `ALASTRE_WRITE_MODE` | Geral | `disabled` por padrão; nunca ativar sem autorização |

#### Critérios Go / No-Go
- **Go**:
  1. Todos os checks do GitHub Actions verdes (`npm ci`, `tsc`, `lint`, `test`, `build`).
  2. Nenhuma alteração não documentada em variáveis de ambiente.
  3. Security Advisor do Supabase sem alertas de vulnerabilidade ou RLS aberta.
  4. Homologação com migrations aplicadas e verificadas.
- **No-Go**:
  1. Qualquer falha em testes unitários ou de integração.
  2. Presença de segredos ou tokens em código versionado.
  3. Tentativa de publicação com `ALASTRE_WRITE_MODE=enabled` sem aprovação humana formal.

#### Procedimento de Rollback
1. **Frontend / Aplicação**: Reverter para o commit anterior conhecido e estável através de um novo deploy do commit funcional (sem force push).
2. **Edge Functions**: Caso uma atualização de Edge Function apresente falha, republicar a versão anterior estável via CLI do Supabase.
3. **Banco de Dados / Migrations**: Todas as migrations devem conter scripts idempotentes e plano de reversão documentado. Em caso de necessidade de rollback de schema, executar migration de reversão formalmente testada em ambiente local antes de homologação.

#### Smoke Test Pós-Deploy
1. Acessar `/` e verificar carregamento do AppShell sem erros de console ou SSR.
2. Navegar entre os módulos centrais (Clientes, Operações, SEO Local, Connection Hub).
3. Testar `GET /api/platform` ou `GET /api/internal/prospecting/worker/ping` para certificar respostas adequadas das APIs.
4. Validar que nenhuma tela branca ou erro de hydration ocorra nos navegadores modernos.
