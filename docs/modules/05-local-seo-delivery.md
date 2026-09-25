# Módulo 05 — Entrega de SEO Local e Google Business Profile

## Objetivo

Operar a entrega de Google Business Profile e SEO Local com dados autênticos, processo totalmente auditável, esteira de aprovação humana, integração ao Motor de Operações (Módulo 04) e transparência nas limitações e resultados.

## Funcionalidades Implementadas

1. **Perfil GBP**:
   - Diagnóstico centralizado de 18 pontos (elegibilidade, risco, categorias, serviços, produtos, descrição, atributos, horários, áreas atendidas, telefone, site, UTMs e NAP).
   - Identificação explícita da origem do dado (`provider`, `manual`, `evidence`, `inference`, `hypothesis`, `unavailable`).
   - Ausência de evidência tratada como `Indisponível (N/D)`, nunca como falha confirmada ou zero no Alastre Local Score.

2. **Conteúdo Local**:
   - Calendário editorial multicanal (Google Business Profile, Instagram, Facebook).
   - Postagens do tipo Atualização (`standard`), Oferta (`offer`) e Evento (`event`) com botão de CTA e validação de conformidade (alerta de telefone no corpo e tamanho ideal de 150-300 caracteres).
   - Botão para criar tarefas operacionais vinculadas diretamente a `work_items` no Motor de Operações (Módulo 04).
   - Trava de escrita externa quando `ALASTRE_WRITE_MODE=disabled`.

3. **Reputação**:
   - Gestão de avaliações com classificação de sentimento (`positive`, `neutral`, `negative`, `critical`).
   - Respostas assistidas por IA com tom de voz alinhado ao DNA do cliente.
   - Botão para criar tarefas operacionais de solicitação ativa de avaliações junto aos clientes.
   - Esteira de aprovação humana com estado `waiting_approval` antes de qualquer resposta.

4. **Autoridade Local**:
   - Monitoramento de Palavras-Chave de Busca Local (intenção transacional, comercial, local, marca, informacional).
   - Mapeamento de Concorrentes Locais diretos com notas e avaliações observadas.
   - Citações & Diretórios NAP (Google Maps, Apple Maps, Apontador, Yelp Brasil, Guia Mais, TeleListas, Facebook Page, Bing Places).

5. **Visibilidade & Conversão**:
   - Baseline histórico de entrada no onboarding.
   - Alastre Local Score (7 pilares ponderados com índice de confiança).
   - Status claro do provedor de ranking (`unconfiguredLocalRankProvider` - `not_configured`).
   - Status de Grid/Heatmap ("não contratado" quando ausente).
   - Isenção explícita de promessas de posições, leads, conversões ou vendas (`NO_RANKING_PROMISE_DISCLAIMER`).

6. **Integração com Motor de Operações**:
   - Oportunidades, postagens e campanhas de solicitação de avaliação convertíveis em `work_items` no Módulo 04.
   - Reutilização de `clients`, `client_services`, DNA, Connection Hub, `workflows`, `work_items`, `approval_items` e `audit_events`.

7. **Interface Unificada**:
   - Alternância entre **Modo Simples (Padrão)** para operadores e clientes e **Modo Avançado (Técnico)** para diagnósticos detalhados.
   - 8 abas funcionais: Visão Geral, Perfil GBP, Conteúdo, Reputação, Autoridade, Visibilidade & Conversão, Plano de Ação, Histórico & Evidências.

8. **Banco, API e Segurança**:
   - Migration forward-only: `20260925040000_local_seo_delivery_v5.sql`.
   - Vínculo por foreign key composta `(agency_id, client_id)`.
   - RLS ativado e permissões revogadas para `public`, `anon`, `authenticated` (acesso exclusivo por `service_role` no backend).
   - Autenticação e autorização server-side via `resolveAuthenticatedActor`.
