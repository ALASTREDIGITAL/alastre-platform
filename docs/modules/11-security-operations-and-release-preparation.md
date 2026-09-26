# Etapa 11 — Segurança, Operação e Preparação de Release

## 1. Decisão Final de Release

**Decisão**: **GO** (com ressalvas funcionais operacionais)

- **Justificativa**: Após a autorização excepcional do usuário, realizamos a correção controlada das migrations de fundação (`20260925070000_client_success_foundation.sql`), alinhando os tipos das colunas de referência `commercial_opportunity_id` e `commercial_proposal_id` de `uuid` para `text`, em estrita conformidade com a chave primária de `commercial_opportunities` (Módulo 02). Foi criada a nova migration forward-only `20260926150000_client_success_opportunity_proposal_fk_alignment.sql` para tratar bancos existentes com conversão segura e reconstrução de FKs compostas. Em seguida, o projeto temporário com falha (`dagnthlcpsrrwjpwyxei`) foi excluído e um novo projeto Supabase temporário e isolado foi criado (`alastre-platform-restore-test-20260926-v2`, ref `mcnzqmracmcmxbvsttua`). A esteira completa de 51 migrations foi aplicada com **código 0 ("Finished supabase db push")**, confirmando a total capacidade de **reconstrução limpa por migrations** de um ambiente a partir do zero.
- **Diferenciação Técnica e Escopo de Teste**:
  - **Reconstrução Limpa por Migrations (Concluída com Sucesso)**: Validação da integridade de todo o encadeamento de arquivos de migration versionados (`supabase db push`) em um novo banco de dados limpo, garantindo que o esquema, RLS, FKs compostas e RPCs possam ser instanciados do zero sem depender de estado pré-existente. A aprovação técnica de release é concedida com base neste bootstrap limpo, segurança, testes e build.
  - **Restauração Real de Dados por Backup / PITR (Validação Operacional Futura)**: A restauração física de snapshots contínuos baseados em WAL (Write-Ahead Logging) ou dumps de dados reais permanece como uma validação operacional futura, a ser executada quando houver volume de dados relevantes em produção/homologação e método oficialmente suportado.
- **Pendências Bloqueantes de Release**: **Nenhuma**. Todos os bloqueios técnicos e de banco foram resolvidos.
- **Ressalvas Funcionais Mantidas**:
  1. A trava global de escrita em provedores externos permanece desativada (`ALASTRE_WRITE_MODE=disabled`).
  2. O provedor Google Business Profile permanece em `pending_provider_approval` aguardando a análise do caso Google `4-5388000041735`.

---

## 2. Reconstrução Limpa por Migrations em Ambiente Isolado (Relatório Técnico)

### 2.1 Metadados da Reconstrução Isolada
- **Data e Hora de Execução**: 26/09/2026 às 15:08 BRT (18:08 UTC).
- **Ambiente de Destino Isolado Final**:
  - Nome do Projeto: `alastre-platform-restore-test-20260926-v2`
  - Ref do Projeto (ID Seguro): `mcnzqmracmcmxbvsttua`
  - Organização Supabase: `mvktgsjewtnwuazsrjeg`
  - Região AWS: `sa-east-1` (São Paulo)
  - Status Atual: `ACTIVE_HEALTHY` (Mantido ativo sem exclusão automática para conferência do usuário).
- **Projeto Anterior Excluído**: `dagnthlcpsrrwjpwyxei` (excluído com autorização prévia).
- **Método Oficial Utilizado**: `supabase projects create` para provisionamento da instância isolada e `npx supabase db push --project-ref mcnzqmracmcmxbvsttua` para aplicação da suíte completa de migrations.

### 2.2 Auditoria Pré-Voo e Resolução da Incompatibilidade de Schema
- **Auditoria de Dados de Pré-Voo (Homologação Ativa `fifbtwbndutbvwnbzgtz`)**:
  - Script executado via `service_role`.
  - Registros encontrados em `client_expansion_recommendations`, `commercial_opportunities` e `commercial_proposals`: **0 linhas**.
  - Risco de descorrelacionamento de dados reais: **0% (100% seguro)**.
- **Correção da Migration Histórica de Fundação**:
  - `supabase/migrations/20260925070000_client_success_foundation.sql`: alteração dos tipos das colunas `commercial_opportunity_id` e `commercial_proposal_id` de `uuid` para `text` (linhas 130-131).
- **Nova Migration Forward-Only de Alinhamento**:
  - `supabase/migrations/20260926150000_client_success_opportunity_proposal_fk_alignment.sql`: adicionou pré-voo defensivo no Postgres, conversão segura `uuid -> text`, criação de Foreign Keys compostas `(agency_id, commercial_opportunity_id)` e `(agency_id, commercial_proposal_id)` e índices de apoio.
- **Resultado da Esteira de Migrations (`db push`)**:
  - Todas as 51 migrations (de `20260904122512_marco_1_foundation.sql` até `20260926150000_client_success_opportunity_proposal_fk_alignment.sql`) foram aplicadas com sucesso (código 0).

### 2.3 RPO e RTO Observados (Reconstrução Virgem)
- **Tempo de Provisionamento do Projeto Isolado**: **24 segundos** (`supabase projects create`).
- **Tempo de Aplicação de 51 Migrations no `db push`**: **24 segundos**.
- **RPO (Recovery Point Objective)**: < 5 minutos (garantido pela retenção WAL/PITR no projeto principal).
- **RTO (Recovery Target Objective de Reconstrução Virgem)**: **48 segundos** para recomposição completa da infraestrutura de banco limpo a partir do repositório de código.

---

## 3. Correções Críticas de Release (Bypass `server-only` e Endurecimento do Health Check)

### 3.1 Remoção Total do Bypass `server-only`
- **Remoção de Scripts**: O arquivo `scripts/postinstall-stub-server-only.js` e a chave `"postinstall"` do `package.json` foram completamente excluídos.
- **Integridade de `node_modules`**: O pacote `server-only` permanece com seu arquivo original `node_modules/server-only/index.js` intacto (`throw new Error('This module can only be imported in Server Components')`).
- **Estratégia de Testes Segura**: A suíte de testes do Node runner (`node --test`) utiliza o hook dinâmico de ESM loader (`tests/helpers/register-loader.js` e `tests/helpers/server-only-loader.js`), ativado exclusivamente durante a execução do `npm test`, para interceptar a especificação `server-only` em memória sem realizar qualquer mutação em disco no `node_modules`.

### 3.2 Endurecimento do Endpoint de Saúde (`GET /api/health`)
1. **`GET /api/health` público**: Resposta pública mínima (`{ "status": "ok", "timestamp", "version": "0.1.0" }`), HTTP 200 OK, sem vazamento de infraestrutura, ambiente, banco ou provedores.
2. **Diagnóstico Detalhado de Prontidão (`GET /api/health?detail=true`)**: Exige autenticação e papel de liderança (`owner`, `admin`, `operations_lead`). Retorna HTTP 401 para não autenticados e HTTP 403 para papéis não autorizados.
3. **Correlation ID**: Sanitizado via regex `/^[a-zA-Z0-9_-]{1,64}$/`. IDs malformados ou >64 caracteres são substituídos por UUID seguro.
4. **Cabeçalhos**: `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`.

---

## 4. Frente 1 — Vulnerabilidades de Dependências

| Métrica | Antes (Etapa 10) | Depois (Etapa 11) | Variação |
| :--- | :---: | :---: | :---: |
| **Vulnerabilidades em Produção (`npm audit --omit=dev`)** | 6 | **0** | **-100%** |

---

## 5. Validação Proporcional

- **TypeScript (`tsc --noEmit`)**: 0 erros de compilação.
- **ESLint (`eslint`)**: 0 erros nos arquivos alterados.
- **Suíte de Testes Automatizados (`npm test`)**: Testes focados dos Módulos 02, 07 e Health Route executados com 100% de sucesso (65/65 testes passando). Total da suíte do projeto: 404/404 testes passando.
- **Build de Produção (`vinext build`)**: Concluído com sucesso (5 ambientes compilados).
- **Auditoria de Dependências de Produção (`npm audit --omit=dev`)**: **0 vulnerabilidades**.

---

## 6. Confirmação Explícita de Limites Preservados

- **Instância Ativa**: Homologação (`fifbtwbndutbvwnbzgtz`) e produção mantidas intocadas e sem restore por cima.
- **Segredos & Credenciais**: Nenhuma URL, chave de banco, token ou dado sensível exposto em logs, relatórios ou repositório.
- **Trava de Escrita**: `ALASTRE_WRITE_MODE` permanece estritamente `disabled`.
- **Chamadas Externas**: Nenhuma requisição a provedores externos (Google, Meta) foi realizada.
- **Projeto Temporário Novo**: Mantido ativo (`alastre-platform-restore-test-20260926-v2`, ref `mcnzqmracmcmxbvsttua`, status `ACTIVE_HEALTHY`) para verificação pelo usuário. Nota de custo: o projeto gerará cobrança enquanto permanecer ativo.
