# Módulo 09 Integrações e Automação

## Objetivo

Transformar as integrações existentes em uma camada operacional segura, modular e substituível: conexões por provider, capabilities, bindings de recursos, sincronização incremental, saúde, filas, execução controlada, aprovação humana com hash imutável, auditoria, evidências, retentativas e falha segura.

## Escopo Entregue

1. **Conexões e Capabilities**:
   - Catálogo interno de provedores (`google`, `meta`, `alastre_ai`, `electronic_signature`, `email`) e capabilities (`google_business_profile`, `google_drive`, `google_ads`, `google_analytics`, `google_tag_manager`, `meta_ads`, `facebook_pages`, `instagram_business`, `ai_generation`, `electronic_signature_signing`, `email_notifications`).
   - Status seguros de conexão: `pending`, `connected`, `expired`, `revoked`, `permission_denied`, `unavailable`, `degraded`, `error`, `disconnected`, `attention`.
   - Consentimento incremental por capability com verificação de escopos concedidos.
   - Descoberta e vinculo de recursos externos a clientes e agências via Connection Hub.
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

4. **Escritas Externas Controladas**:
   - Toda intenção de escrita gera um plano imutável (`automation_write_plans`) com hash SHA-256 de 64 caracteres.
   - Exige aprovação humana vinculada ao plano exato (`approval_items` com `source_type = 'automation_write'`) antes de qualquer execução.
   - Trava de segurança: com `ALASTRE_WRITE_MODE=disabled`, a execução é retida no status `blocked_write_mode` com justificativa explícita.
   - Validação de integridade de hash no servidor impedindo tampering ou alteração posterior de payload.
   - Suporte a rollback/compensação apenas quando o adapter declarar suporte (`supports_rollback`).

5. **Custos e Limites de IA**:
   - Logs de uso de IA (`automation_ai_usage_logs`) com contagem de tokens in/out, custo estimado e resumo sanitizado sem prompts sensíveis.
   - Limites mensais por agência e capability (`automation_ai_limits`).
   - Ausência de dados tratada com a tag explícita "Dados Insuficientes (N/D)", sem estimativas ou zeros sintéticos.

6. **Interface e Experiência do Usuário**:
   - Integração da aba "Automação Operacional (Módulo 09)" na Central de Conexões.
   - Alternância entre Modo Simples (padrão, linguagem clara para operadores) e Modo Avançado (técnico, exibindo hashes SHA-256, cursores, idempotency keys e JSON sanitizados).
   - Visualização de 7 abas funcionais: Conexões, Recursos Vinculados, Sincronizações, Fila & Jobs, Dead Letter, Escritas Controladas e Custos/Limites de IA.

## Salvaguardas de Segurança e Banco de Dados

- **Migration Forward-Only**: `supabase/migrations/20260925140000_automation_and_integrations_foundation.sql`.
- **Tabelas Criadas**: `automation_sync_states`, `automation_jobs`, `automation_write_plans`, `automation_ai_usage_logs`, `automation_ai_limits`.
- **Isolamento Multi-Tenant**: Unique constraints `(agency_id, id)` e Foreign Keys compostas com `agency_id`.
- **RLS Ativado**: Privilégios revogados de `public`, `anon` e `authenticated`; acesso de servidor exclusivamente via `service_role`.
- **Defesa Anti-SSRF**: Validador `validateExternalEndpointUrl` garante que endpoints pertençam estritamente ao catálogo de domínios permitidos por provider (ex: `*.googleapis.com`, `graph.facebook.com`).
- **Sanitização de Segredos**: Função `sanitizeSensitiveData` limpa qualquer token, senha, chave ou cabeçalho de payloads, logs, respostas de API e banco de dados.

## Validação Realizada

- **Suíte de Testes do Módulo 09**: 13/13 testes passando em `tests/automation-and-integrations.test.ts`.
- **Suíte Completa do Repositório**: 393/393 testes automatizados passando (100% sucesso).
- **TypeScript**: `npx tsc --noEmit` executado com 0 erros.
- **ESLint**: `npx eslint` executado nos arquivos alterados com 0 erros e 0 warnings.
- **Build de Produção**: `npm run build` (`vinext build`) concluído com sucesso.
- **Migration Remota**: Aplicada com sucesso na homologação `fifbtwbndutbvwnbzgtz`.
- **Supabase Security Advisor / DB Lint**: Executado sem falhas nas novas tabelas ou RLS do Módulo 09.
