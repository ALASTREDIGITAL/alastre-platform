# Módulo 07 — Sucesso do Cliente (Customer Success)

## Objetivo

Transformar execução técnica e evidências operacionais em percepção transparente de valor, retenção saudável, reuniões orientadas a decisão e expansão compatível com a capacidade real e fit demonstrado pelo cliente.

## Escopo Entregue

1. **Health Score do Cliente Explicável**:
   - Pontuação explicável e decomponível (0-100 pts) cobrindo 7 fatores principais:
     - Entrega Operacional & SLA (Módulo 04);
     - Qualidade, Evidências e Não Conformidades (Módulo 06);
     - Cooperação do Cliente e Aprovadores (`approval_items`);
     - Percepção de Valor / Satisfação;
     - Evolução de Indicadores do Serviço (Módulo 05 - SEO Local);
     - Fator de Risco de Churn;
     - Estabilidade de Escopo Ativo (`client_services`).
   - Mapeamento explícito de Cobertura de Dados (`coverage_pct`, `complete`, `partial`, `insufficient`).
   - Ausência de dado tratada obrigatoriamente como `Dados Insuficientes (N/D)`, sem conversão em nota negativa arbitrária.
   - Segregação mandatória de causas primárias de inconsistência:
     - `alastre_delivery_failure`: Falha operacional / atraso SLA Alastre;
     - `channel_limitation`: Limitação ou indisponibilidade externa do canal;
     - `client_dependency_failure`: Pendência, falta de acesso ou atraso do cliente;
     - `insufficient_data`: Dados insuficientes para diagnóstico.

2. **Scorecard e Relatórios de Valor**:
   - Geração de scorecards periódicos com entregas concluídas, evidências verificadas (Módulo 06), limitações de coleta, melhorias implementadas, dependências do cliente e recomendações fundamentadas.
   - Preservação da regra mandatória de isenção de promessas externas: `Resultados influenciados por múltiplos fatores externos. Não há promessa de ranking, leads, conversões ou vendas.`

3. **Reuniões e Decisões Acionáveis**:
   - Registro de pauta, objetivo, participantes, dados analisados, decisões, prazos e riscos.
   - Toda decisão acionável pode ser convertida diretamente em tarefa operacional (`work_items`) no Motor de Operações (Módulo 04).

4. **Identificação de Risco de Churn e Plano de Recuperação**:
   - Matriz de sinais prévios de churn com severidade (`low`, `medium`, `high`, `critical`), nível de confiança (`low`, `medium`, `high`) e cobertura de dados.
   - Geração de plano de recuperação atômico com criação direta de tarefas de recuperação no Módulo 04.

5. **Renovação, Revisão de Escopo e Expansão (Upsell/Downsell)**:
   - Esteira para `renewal`, `scope_review`, `expansion_unit`, `expansion_service`, `upsell` e `downsell`.
   - Exigência mandatória de justificativa de fit demonstrado, valor evidenciado, impacto operacional no Módulo 04 e aprovação humana explícita.
   - Vínculo opcional com oportunidades/propostas comerciais do Módulo 02.

6. **Cancelamento e Offboarding Seguro**:
   - Fluxo interno para solicitações de cancelamento, plano de transição e inventário de revogação de acessos.
   - Geração de tarefas internas de offboarding no Módulo 04.
   - Política de retenção legal de dados e auditoria: **Nenhum dado ou evidência é destruído**.

## Estrutura de Banco de Dados (Migrations Forward-Only)

- `20260925070000_client_success_foundation.sql`:
  - `client_health_scores`
  - `client_scorecards`
  - `client_meetings`
  - `client_meeting_decisions`
  - `client_churn_assessments`
  - `client_expansion_recommendations`
  - `client_cancellation_requests`
  - `client_offboarding_inventories`
- `20260925080000_client_success_hardening.sql`:
  - Índices multi-tenant em `(agency_id, client_id)`.
  - Habilitação de RLS em todas as tabelas.
  - Revogação de privilégios públicos (`public`, `anon`, `authenticated`) e concessão restrita ao `service_role`.

## Endpoints de API (`app/api/client-success/route.ts`)

- `GET /api/client-success`: Consulta consolidada por `agency_id` (e opcionalmente `client_id`).
- `POST /api/client-success`:
  - `calculate_health`
  - `create_scorecard`
  - `create_meeting`
  - `create_meeting_decision`
  - `convert_decision_to_work_item` (vincula ao Módulo 04)
  - `create_churn_assessment`
  - `create_recovery_task` (vincula ao Módulo 04)
  - `create_expansion_recommendation`
  - `approve_expansion`
  - `create_cancellation_request`
  - `approve_cancellation`
  - `create_offboarding_inventory`
  - `create_offboarding_task` (vincula ao Módulo 04)

## Suíte de Testes Automatizados

- `tests/client-success-domain.test.ts`: Testes unitários do modelo de saúde, segregação de causas, scorecard e expansão.
- `tests/client-success-api.test.ts`: Testes de integração de rotas API e geração de tarefas no Módulo 04.
- `tests/client-success-security.test.ts`: Isolamento multi-tenant por `agency_id` e verificação de migrations SQL/RLS.
- `tests/client-success-navigation-and-ui.test.ts`: Testes de estrutura do componente da Central de CS e registro no `app-shell.tsx`.
