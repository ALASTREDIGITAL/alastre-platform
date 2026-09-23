# Plano Mestre de Produtização

## Objetivo

Transformar a Alastre Platform no sistema operacional da Alastre Digital para criar, vender, implantar, executar, medir e melhorar serviços recorrentes. Google Business Profile e SEO Local são o primeiro produto completo operado pelo sistema, sem limitar a arquitetura a esse serviço.

## Princípios

- Produto, oferta e operação são domínios diferentes.
- Preço, plano e promessa dependem de escopo, capacidade e custo demonstráveis.
- Entregáveis controláveis, indicadores influenciáveis e resultados externos devem permanecer separados.
- Fato, evidência, inferência, hipótese e lacuna devem ser estados explícitos dos dados relevantes.
- Cliente e DNA são o núcleo compartilhado.
- Toda operação pertence a uma agência e, quando aplicável, a um cliente e uma unidade.
- Preparação, revisão, aprovação, execução e verificação são etapas distintas.
- Automação prepara e executa rotinas permitidas; ações sensíveis permanecem Human in the Loop.
- Nenhum dado sintético pode aparecer como resultado real.

## Arquitetura funcional

| Módulo | Responsabilidade | Documento |
| --- | --- | --- |
| 00 Fundação de Produção | Repositório, CI, build, testes, ambientes e deploy seguro | `docs/modules/00-production-foundation.md` |
| 01 Fábrica de Produtos | Descoberta, escopo, SOPs, capacidade e viabilidade do produto | `docs/modules/01-product-factory.md` |
| 02 Comercial e CRM | Prospecção, qualificação, pipeline, proposta, forecast e handoff | `docs/modules/02-commercial-crm.md` |
| 03 Onboarding de Clientes | Conferência da venda, acessos, DNA, baseline e ativação | `docs/modules/03-client-onboarding.md` |
| 04 Motor de Operações | Workflows, tarefas, recorrência, SLA, dependências e tempo | `docs/modules/04-operations-engine.md` |
| 05 Entrega de SEO Local | Perfil, conteúdo, reputação, autoridade, ranking e conversões | `docs/modules/05-local-seo-delivery.md` |
| 06 Qualidade e Evidências | Critérios de aceite, provas, revisão, auditoria e exceções | `docs/modules/06-quality-and-evidence.md` |
| 07 Sucesso do Cliente | Saúde, reuniões, retenção, renovação, expansão e offboarding | `docs/modules/07-client-success.md` |
| 08 Capacidade e Financeiro | Custos, margem, capacidade, contratação, CAC e precificação | `docs/modules/08-capacity-and-finance.md` |
| 09 Integrações e Automação | Providers, sincronização e execução externa controlada | `docs/modules/09-integrations-and-automation.md` |

## Dependências entre módulos

```text
00 Fundação de Produção
  → 01 Fábrica de Produtos
      → 02 Comercial e CRM
      → 03 Onboarding
          → 04 Motor de Operações
              → 05 Entrega de SEO Local
              → 06 Qualidade e Evidências
                  → 07 Sucesso do Cliente
                      → 08 Capacidade e Financeiro
                          → 09 Integrações e Automação
```

O desenvolvimento pode reutilizar bases existentes em outra ordem quando houver dependência técnica, mas nenhum módulo deve declarar concluído um resultado pertencente a outro.

## Contratos transversais

Todos os módulos devem reutilizar, quando aplicável:

- `agencies`, `agency_actors`, `clients` e DNA para identidade e contexto;
- `client_services` para habilitação de serviços;
- Connection Hub para integrações;
- `workflows`, `workflow_runs` e `work_items` para execução;
- `approval_items` para aprovação humana;
- `audit_events` para rastreabilidade;
- estados de origem, confiança, disponibilidade e sincronização já definidos;
- Modo Simples como experiência principal e Modo Avançado para detalhes técnicos.

## Processo de entrega

Cada módulo será executado em incrementos pequenos. Para cada incremento:

1. diagnosticar o que já existe;
2. registrar decisões e limites;
3. definir modelo de dados e contratos;
4. implementar domínio e persistência;
5. implementar APIs;
6. implementar interface;
7. testar regras, isolamento e falhas;
8. validar TypeScript, lint, testes e build;
9. atualizar o estado do módulo.

## Gates de avanço

Um módulo só avança quando:

- seus critérios de aceite estão verificáveis;
- os dados não dependem de sucesso simulado;
- isolamento multiempresa foi testado;
- estados de erro e indisponibilidade são seguros;
- mudanças de banco possuem migration e políticas;
- o incremento não depende de escrita externa não autorizada;
- riscos e pendências foram documentados.

## Ordem aprovada

O trabalho começa pelo Módulo 00. A Fábrica de Produtos começa somente após existir um caminho reproduzível de validação e recuperação do projeto.
