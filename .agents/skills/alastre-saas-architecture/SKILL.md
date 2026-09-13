---
name: alastre-saas-architecture
description: Projetar ou revisar arquitetura SaaS, módulos, contratos internos, APIs, integrações e persistência da Alastre Platform com foco em multi-tenant, operação por exceção, adapters e evolução incremental. Não usar para simples ajustes visuais.
---

# Alastre SaaS Architecture

1. Leia `docs/ARCHITECTURE_DECISIONS.md` e preserve decisões vigentes.
2. Preserve o monólito modular e trate Client + DNA como o centro dos módulos e agentes.
3. Trate agência e cliente como limites explícitos em contratos, consultas e auditoria.
4. Faça o Connection Hub possuir integrações, capabilities, credenciais, bindings e health.
5. Modele client services e os modos `platform_managed` e `customer_managed` explicitamente.
6. Mantenha providers atrás de adapters e estados confiáveis de disponibilidade; módulos de feature nunca acessam tokens diretamente.
7. Separe leitura, proposta de agente, rascunho, aprovação humana, execução e reconciliação para operar por exceção.
8. Prefira contratos tipados e validação de IDs no backend a acesso profundo em payload não confiável.
9. Modele operações idempotentes, canceláveis, auditáveis e observáveis; inclua cost tracking quando houver consumo mensurável.
10. Evite migrations ou novos serviços quando uma extensão compatível resolve o problema.
11. Preserve compatibilidade progressiva e documente decisões estruturais duradouras.
12. Valide a menor superfície necessária antes de ampliar escopo.

## Saída esperada

Descreva limites, fluxo de dados, controles, trade-offs e validação. Sinalize separadamente qualquer passo que exija autorização.
