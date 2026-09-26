# Etapa 11 — Segurança, Operação e Preparação de Release

## 1. Decisão Final de Release

**Decisão**: **NO-GO**

- **Justificativa**: Em atendimento à autorização explícita do usuário para a realização do **Exercício Real de Restauração Isolada**, foi provisionado um novo projeto Supabase temporário e isolado (`alastre-platform-restore-test-20260926`, ref `dagnthlcpsrrwjpwyxei`). Durante a aplicação da esteira oficial de migrations (`supabase db push`), o processo foi interrompido na migration `20260925090000_client_success_multi_tenant_hardening.sql` devido a uma incompatibilidade de tipos de dados SQL entre tabelas de módulos distintos (SQLSTATE 42804: `commercial_opportunities.id` do tipo `text` versus `client_expansion_recommendations.commercial_opportunity_id` do tipo `uuid`). Conforme os critérios estritos da etapa, o exercício foi classificado como **NO-GO**, sem tentativa de procedimentos destrutivos ou edições de migrations aplicadas.
- **Pendência Bloqueante de Release**:
  - Alinhamento de tipos entre a chave primária `commercial_opportunities.id` e a referência `client_expansion_recommendations.commercial_opportunity_id` via nova migration segura, permitindo a recomposição integral de um banco limpo a partir do zero.
- **Ressalvas Funcionais Mantidas**:
  1. A trava global de escrita em provedores externos permanece desativada (`ALASTRE_WRITE_MODE=disabled`).
  2. O provedor Google Business Profile permanece em `pending_provider_approval` aguardando a análise do caso Google `4-5388000041735`.

---

## 2. Exercício Real de Restauração Isolada (Relatório Técnico)

### 2.1 Metadados do Exercício
- **Data e Hora de Execução**: 26/09/2026 às 11:31 BRT (14:31 UTC).
- **Ambiente de Destino Isolado**:
  - Nome do Projeto: `alastre-platform-restore-test-20260926`
  - Ref do Projeto (ID Seguro): `dagnthlcpsrrwjpwyxei`
  - Organização Supabase: `mvktgsjewtnwuazsrjeg`
  - Região AWS: `sa-east-1` (São Paulo)
  - Status Atual: `ACTIVE_HEALTHY` (Mantido ativo sem exclusão automática para avaliação do usuário).
- **Método Oficial Utilizado**: `supabase projects create` para provisionamento da instância isolada e `supabase db push --project-ref dagnthlcpsrrwjpwyxei` para aplicação da suíte de migrations.

### 2.2 Evidência Técnica da Falha
- **Migration Afetada**: `20260925090000_client_success_multi_tenant_hardening.sql` (migration 43 de 50).
- **Código de Erro Postgres**: `SQLSTATE 42804` (incompatible_type).
- **Mensagem Oficial do Banco**:
  ```text
  ERROR: foreign key constraint "client_expansion_recommendations_agency_opportunity_fk" cannot be implemented (SQLSTATE 42804)
  Key columns "commercial_opportunity_id" and "id" are of incompatible types: uuid and text.
  ```
- **Diagnóstico da Causa Raiz**:
  - Na migration `20260924110000_commercial_crm_foundation.sql` (Módulo 02), a tabela `public.commercial_opportunities` foi criada com chave primária `id text primary key`.
  - Na migration `20260925070000_client_success_foundation.sql` (Módulo 07), a tabela `public.client_expansion_recommendations` declarou a coluna `commercial_opportunity_id uuid`.
  - Na migration `20260925090000_client_success_multi_tenant_hardening.sql`, a tentativa de criação da Foreign Key composta `(agency_id, commercial_opportunity_id) references public.commercial_opportunities(agency_id, id)` falhou devido à divergência de tipos (`uuid` vs `text`).

### 2.3 RPO e RTO Observados
- **Tempo de Provisionamento de Projeto Isolado**: **24 segundos** (`supabase projects create`).
- **Tempo de Execução até a Falha no `db push`**: **26 segundos**.
- **RPO (Recovery Point Objective)**: < 5 minutos (garantido pela retenção WAL/PITR no projeto principal).
- **RTO (Recovery Target Objective)**: **Bloqueado** para reconstrução total a partir de banco virgem devido à inconsistência de schema entre os Módulos 02 e 07.

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
- **Suíte de Testes Automatizados (`npm test`)**: **404/404 testes passando (100% sucesso)**.
- **Build de Produção (`vinext build`)**: Concluído com sucesso (5 ambientes compilados).
- **Auditoria de Dependências de Produção (`npm audit --omit=dev`)**: **0 vulnerabilidades**.

---

## 6. Confirmação Explícita de Limites Preservados

- **Instância Ativa**: Homologação (`fifbtwbndutbvwnbzgtz`) e produção mantidas intocadas e sem restore por cima.
- **Segredos & Credenciais**: Nenhuma URL, chave de banco, token ou dado sensível exposto em logs, relatórios ou repositório.
- **Trava de Escrita**: `ALASTRE_WRITE_MODE` permanece estritamente `disabled`.
- **Chamadas Externas**: Nenhuma requisição a provedores externos (Google, Meta) foi realizada.
- **Projeto Temporário**: Mantido ativo (`dagnthlcpsrrwjpwyxei`) para decisão e controle do usuário.
