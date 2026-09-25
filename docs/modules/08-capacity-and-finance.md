# Módulo 08: Capacidade e Financeiro

## Objetivo

Demonstrar se produtos e serviços são entregáveis e rentáveis com base em tempo, custo e premissas rastreáveis, apoiando decisões de preço, contratação, desconto e crescimento sem inventar dados financeiros sintéticos.

## Escopo Implementado

1. **Premissas Econômicas Versionadas**:
   - Tabela `financial_economic_assumptions` com classificação rigorosa da origem do dado (`real_observed`, `reported_value`, `estimate`, `hypothesis`, `unavailable`).
   - Trava de integridade: Premissa sem referência de evidência é reclassificada como hipótese (`hypothesis`), jamais como fato.

2. **Consolidação de Custos e Tempo**:
   - Tabela `financial_cost_records` consolidando tempo padrão (Módulo 01 / Módulo 04) e realizado (`work_item_time_logs` do Módulo 04) por produto, escopo, serviço, cliente, unidade, workflow, tarefa, função operacional e retrabalho (Módulo 06).
   - Suporte a custos de mão de obra, software, IA, atendimento, venda, implantação, retrabalho e outros custos operacionais.

3. **Simulações de Capacidade e Gargalos**:
   - Tabela `financial_capacity_simulations` calculando horas disponíveis, planejadas, realizadas, retrabalho, SLA e taxa de ocupação por função operacional.
   - Cenários para 10, 25, 50 e 100 clientes com identificação automática do gargalo dominante e cálculo do ponto de contratação (`hiring_trigger_clients`) antes do colapso de qualidade.

4. **Margem e Viabilidade Segregada**:
   - Tabela `financial_margin_analyses` com segregação mandatória entre:
     - Valor Contratado (`contracted_value`)
     - Valor Faturado (`invoiced_value`)
     - Valor Recebido (`received_value`)
     - Custo Estimado (`estimated_cost`) vs Custo Realizado (`actual_cost`)
     - Margem Estimada (`estimated_margin_pct`) vs Margem Realizada (`actual_margin_pct`)
   - Proibição estrita de misturar valor contratado com valor recebido.

5. **CAC, Payback e LTV Rastreáveis**:
   - Cálculo de métricas unitárias somente quando existirem dados rastreáveis em banco.
   - Na ausência de cobertura, a API e a interface exibem explicitamente "Dados Insuficientes (N/D)" com a lista de campos ausentes. Nenhuma métrica é inventada com dados sintéticos.

6. **Precificação e Descontos Protegidos**:
   - Tabela `financial_pricing_decisions` e integração com `approval_items` (`source_type = 'capacity_financial_pricing'`).
   - Trava 1: Preço não pode ser aprovado sem custo operacional estimado registrado (`is_cost_estimated = true`).
   - Trava 2: Desconto > 0% exige contrapartida documentada ou redução de escopo/frequência/suporte (`is_counterpart_documented = true`).
   - Trava 3: Nenhuma aprovação automática — toda precificação sensível exige responsável humano e aprovação explícita.

7. **Interface Central de Capacidade e Financeiro**:
   - Componente `CapacityFinanceModule` em `app/capacity-and-finance-module.tsx`.
   - Suporte a Modo Simples (padrão) e Modo Avançado (técnico).
   - 8 Abas Operacionais: Visão Econômica, Premissas e Custos, Tempo e Retrabalho, Capacidade e Gargalos, Cenários de Crescimento, Margem e Viabilidade, Precificação e Descontos, Histórico e Auditoria.
   - Exibição de aviso de isenção de projeção (`PROJECTION_DISCLAIMER`) e selos de origem de dados em todas as visões.

8. **Banco, API e Segurança**:
   - Migration `supabase/migrations/20260925100000_capacity_and_finance_foundation.sql`.
   - Isolamento multi-tenant via `agency_id` obrigatório e FKs compostas `(agency_id, parent_id)`.
   - RLS ativado com revogação total para `public`, `anon`, `authenticated` e acesso restrito ao `service_role`.
   - Endpoint `/api/capacity-and-finance` com resolução server-side por `resolveAuthenticatedActor`.

## Suíte de Testes Automatizados

- `tests/capacity-and-finance-domain.test.ts`: Regras de negócio, origem de dados, cálculo de capacidade, margens segregadas, CAC/Payback/LTV sem dados sintéticos, travas de precificação.
- `tests/capacity-and-finance-api.test.ts`: Validações de payload Zod, GET/POST actions, submissão para esteira de aprovação humana.
- `tests/capacity-and-finance-security.test.ts`: Isolamento multi-tenant, bloqueio unauth, verificação de RLS e migração.
- `tests/capacity-and-finance-navigation-and-ui.test.ts`: Verificação das 8 abas e integração no `app-shell`.
