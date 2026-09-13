# Fluxo Graph-first

Graphify é o mapa técnico da Alastre Platform. Ele encontra onde trabalhar; as skills Alastre orientam como trabalhar. Documentos canônicos continuam sendo a fonte de visão, decisões, roadmap e estado.

## Escopo inicial

O grafo estrutural inclui `app/`, `components/`, `lib/`, `supabase/` e configurações arquiteturais selecionadas. `docs/` permanece no escopo futuro, mas foi omitido desta extração `code-only` para evitar processamento semântico e consumo de tokens. `.agents/skills/`, artefatos gerados, dependências, mídia e qualquer caminho potencialmente sensível ficam excluídos.

## Uso

Use query específica para arquitetura, dependências, fluxo e impacto. Abra depois apenas as fontes retornadas e confirme nelas os fatos críticos. Pule o grafo quando o arquivo já for conhecido ou a alteração for pequena e localizada.

## Freshness

- Atualizado: grafo gerado no checkpoint atual, sem mudança estrutural posterior.
- Possivelmente desatualizado: pequenas mudanças de código posteriores podem afetar relações locais.
- Desatualizado: módulo, dependência estrutural ou arquivo central mudou desde a extração.

Atualize incrementalmente em checkpoints relevantes. Não reconstrua por CSS, copy ou typo.

## Segurança

`.graphifyignore` é deliberadamente mais restritivo que `.gitignore`. Nenhum `.env`, credential, token, secret, vault, chave, certificado ou dump pode entrar no grafo. O source sempre confirma decisões; o grafo nunca concede permissão para escrita externa.
