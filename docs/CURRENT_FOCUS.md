# Foco atual

- **Objetivo operacional:** PoC isolada de Prospecção Local com motor factual (`gosom/google-maps-scraper` v1.18.1), sem APIs pagas, sem porta 8080 exposta e com governança estrita de leases e identidade.
- **Módulo em foco:** Prospecção Local (`lib/prospecting/`, `app/api/internal/prospecting/worker/`, `scripts/poc/`).
- **Estado atual:** PoC concluída com êxito sob as 10 diretrizes: lease atômico com deadline imutável de 5 min (`first_leased_at`), limite rígido de tentativas (`attempt_count`), desduplicação por `identity_key` (CID > Place ID > URL > Telefone), rotas internas autenticadas em tempo constante sem credenciais Supabase, cancelamento cooperativo (SIGTERM/SIGKILL), DNC durável com hash SHA-256, telemetria sanitizada de bloqueio e auditoria de acesso sem IPs. Busca teste "Vidraçaria em Sorocaba - SP" extraiu 10 fichas reais com zero dados sintéticos e sem contatar nenhuma empresa.
- **Validação:** 16 novos testes de governança aprovados (100% de sucesso); compilação TypeScript com 0 erros (`tsc --noEmit`); dossiê de auditoria gerado em `scripts/poc/output/vidracaria-sorocaba-audit.json` e documentação upstream em `docs/PROSPECTING_POC_AUDIT.md`.
- **Próxima entrega:** Apresentação dos 10 resultados para conferência manual do operador contra o Google Maps.
- **Restrições críticas:** Zero dados sintéticos; nenhuma alteração em tabelas de clientes ou CRM; porta 8080 estritamente desativada/não exposta; proibição absoluta de contato com os leads.

