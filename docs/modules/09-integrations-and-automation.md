# Módulo 09 Integrações e Automação

## Objetivo

Transformar as integrações existentes em uma camada operacional segura, modular e substituível: conexões por provider, capabilities, bindings de recursos, sincronização incremental, saúde, filas, execução controlada, aprovação humana real com segregação de funções e hash imutável, auditoria, evidências, retentativas e falha segura.

## Escopo Entregue

1. **Conexões e Capabilities**:
   - Catálogo interno de provedores (`google`, `meta`, `alastre_ai`, `electronic_signature`, `email`) e capabilities (`google_business_profile`, `google_drive`, `google_ads`, `google_analytics`, `google_tag_manager`, `meta_ads`, `facebook_pages`, `instagram_business`, `ai_generation`, `electronic_signature_signing`, `email_notifications`).
   - Status seguros de conexão: `pending`, `connected`, `expired`, `revoked`, `permission_denied`, `unavailable`, `degraded`, `error`, `disconnected`, `attention`.
   - Consentimento incremental por capability com verificação de escopos concedidos.
   - Descoberta e vínculo de recursos externos a clientes e agências via Connection Hub.
   - Credenciais armazenadas exclusivamente via Supabase Vault (`vault:...`); nunca segredos expostos.

2. **Sincronização e Saúde**:
   - Syncs incrementais com cursor/estado (`sync_cursor`, `last_synced_at`), evitando duplicações.
   - Health checks com último sucesso, último erro sanitizado e agendamento da próxima tentativa (`next_sync_at`).
   - Limite de tentativas, timeout e backoff exponencial (`sync_attempts`, `max_attempts`, `backoff_seconds`).
   - Falhas repetidas ou fatais roteadas diretamente para a fila Dead Letter.
   - Tratos visuais de indisponibilidade sem erros de tela branca ou vazamento de stack técnico.

3. **Fila e Execução de Jobs**:
   - Modelo de jobs com chave de idempotência (`idempotency_key`), payload sanitizado, status (`pending`, `queued`, `running`, `completed`, `failed`, `dead_letter`, `cancelled`), tentativas, timeout e vínculo com cliente, `work_item_id` (Módulo 04) e `evidence_id` (Módulo 06).
   - Deduplicação segura por tenant (`agency_id`, `idempotency_key`).
   - Execução simulada/controlada por adapter, preservando a ausência de chamadas externas reais neste módulo.
   - Toda execução gera registro imutável em `audit_events` e vínculo a evidências de qualidade.
   - Falhas nunca são convertidas em falso sucesso.

4. **Escritas Externas Controladas, Uso Exclusivo de RPCs e SoD**:
   - Segregação de Funções (SoD) centralizada em `lib/permissions.ts`: `operator` e `viewer` NUNCA podem aprovar, cancelar aprovação, autorizar ou executar planos de escrita externa (acesso exclusivo para `owner`, `admin` e `operations_lead`).
   - **Eliminação de Escrita Direta**: Em banco configurado, `createWritePlan`, `approveWritePlan` e `executeWritePlan` executam **exclusivamente via RPCs transacionais**:
     - `automation_create_write_plan`
     - `automation_approve_write_plan`
     - `automation_execute_write_plan`
   - Parâmetro canônico `p_actor_id` nas RPCs resolve de forma inequívoca o ator autenticado (`agency_actors.id` ou email) via `service_role`.
   - Se qualquer RPC falhar ou retornar erro, a aplicação rejeita a operação com erro seguro HTTP 500/503. Nenhuma escrita direta, fallback ou alteração parcial de tabela é permitida.
   - Execução segregada: `executeWritePlan` exige aprovação prévia no plano (`status = 'approved'`) e no `approval_item`, verificando equivalência de hashes.
   - Trava de segurança: com `ALASTRE_WRITE_MODE=disabled`, a execução transiciona o plano para `blocked_write_mode` com justificativa explícita e PRESERVA o `approval_item` como `approved` (sem rebaixá-lo ou marcá-lo como rejected).
   - Validação de integridade de hash no servidor impedindo tampering ou alteração posterior de payload, com bloqueio de dupla execução / replay check.

5. **Custos e Limites de IA**:
   - Logs de uso de IA (`automation_ai_usage_logs`) com contagem de tokens in/out, custo estimado e resumo sanitizado sem prompts sensíveis.
   - Limites mensais por agência e capability (`automation_ai_limits`).
   - Ausência de dados tratada com a tag explícita "Dados Insuficientes (N/D)", sem estimativas ou zeros sintéticos.

6. **Interface e Experiência do Usuário**:
   - Integração da aba "Automação Operacional (Módulo 09)" na Central de Conexões.
   - Alternância entre Modo Simples (padrão, linguagem clara para operadores) e Modo Avançado (técnico, exibindo hashes SHA-256, cursores, idempotency keys e JSON sanitizados).
   - Visualização de 7 abas funcionais: Conexões, Recursos Vinculados, Sincronizações, Fila & Jobs, Dead Letter, Escritas Controladas e Custos/Limites de IA.

## Salvaguardas de Segurança e Banco de Dados

- **Migrations Forward-Only**:
  - `supabase/migrations/20260925140000_automation_and_integrations_foundation.sql`
  - `supabase/migrations/20260925150000_automation_write_plan_hardening.sql`
  - `supabase/migrations/20260925160000_automation_rpc_strict_transactional.sql` (hardened: parâmetro `p_actor_id`, eliminação de escritas diretas, privilégios exclusivos para `service_role`).
- **Tabelas Criadas / Modificadas**: `automation_sync_states`, `automation_jobs`, `automation_write_plans`, `automation_ai_usage_logs`, `automation_ai_limits`, `approval_items`.
- **Isolamento Multi-Tenant**: Unique constraints `(agency_id, id)` e Foreign Keys compostas com `agency_id`.
- **RLS Ativado**: Privilégios revogados de `public`, `anon` e `authenticated`; acesso de servidor exclusivamente via `service_role`.
- **Defesa Anti-SSRF**: Validador `validateExternalEndpointUrl` garante que endpoints pertençam estritamente ao catálogo de domínios permitidos por provider.
- **Sanitização de Segredos**: Função `sanitizeSensitiveData` limpa qualquer token, senha, chave ou cabeçalho de payloads, logs, respostas de API e banco de dados.

## Validação Realizada

- **Suíte de Testes do Módulo 09**: 15/15 testes passando em `tests/automation-and-integrations.test.ts` (cobrindo SoD, aprovação real, atomicidade, ausência de fallbacks diretos, replay check, SSRF, sanitização e API handler).
- **TypeScript**: `npx tsc --noEmit` executado com 0 erros.
- **ESLint**: `npx eslint` executado nos arquivos alterados com 0 erros e 0 warnings.
- **Migrations Remotas**: Aplicadas com sucesso na homologação `fifbtwbndutbvwnbzgtz`.
- **Supabase Security Advisor / DB Lint**: `npx supabase db lint --linked` executado sem erros no Supabase Homologação.
