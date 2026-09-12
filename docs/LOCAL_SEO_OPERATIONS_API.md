# API interna de SEO Local

`POST /api/local-seo` é a única entrada do frontend. A rota valida sessão e payload, força escrita externa desativada e encaminha ao bridge, que resolve o ator, confirma agência e cliente e valida transições.

## Ações

- `local_seo_workspace`: carrega postagens, avaliações, respostas e oportunidades do cliente.
- `local_seo_post_save` / `local_seo_post_transition`: cria ou edita rascunho e move somente por estados permitidos.
- `local_seo_review_register`: registra avaliação recebida por meio interno ou importação controlada.
- `local_seo_reply_save` / `local_seo_reply_transition`: mantém a resposta separada da avaliação.
- `local_seo_opportunity_save` / `local_seo_opportunity_transition`: cria, prioriza e acompanha oportunidade.
- `local_seo_post_generate` / `local_seo_reply_generate`: contratos reservados para o AI Gateway. A conexão do conteúdo operacional ao provedor requer decisão explícita de governança de dados.

Entrar em `waiting_approval` cria um item na Central de Aprovações. Aprovar nunca publica nem responde no Google; apenas libera o estado interno seguinte. Os estados `published` e `responded` não são alcançáveis por estes endpoints internos.

## Segurança

As tabelas têm RLS ativa, não dão acesso a `anon`/`authenticated` e são acessadas pelo bridge com `service_role` somente depois da validação do ator e do tenant. Operações relevantes geram `audit_events`. A migration permanece local e não aplicada.
