# Módulo 04 Motor de Operações

## Objetivo

Executar implantação e recorrência por meio de workflows padronizados, mensuráveis e reutilizáveis entre serviços.

## Escopo

- Templates versionados de workflow.
- Instâncias por agência, cliente, unidade e serviço.
- Tarefas únicas e recorrentes.
- Gatilhos, frequências, responsáveis, SLA e prioridade.
- Dependências entre tarefas.
- Estimativa e apontamento de tempo.
- Participação e bloqueios do cliente.
- Aprovações e critérios de conclusão.
- Exceções, retentativas e escalonamento.
- Filas por responsável, cliente, serviço e urgência.

## Reutilização obrigatória

- `workflows`, `workflow_runs` e `work_items` existentes.
- `approval_items` e `audit_events`.
- Serviços habilitados por cliente.

## Regras

- Não criar um novo motor por módulo.
- Recorrência deve representar trabalho necessário, não atividade artificial.
- Conclusão exige evidência compatível com a tarefa.
- Automação e execução humana devem compartilhar o mesmo contrato de resultado.

## Critérios de aceite

- Um produto aprovado pode gerar implantação e recorrência previsíveis.
- A operação consegue ver atenção de hoje, atrasos, bloqueios e capacidade.
- Tarefas não podem saltar dependências ou aprovação obrigatória.
- Tempo previsto e realizado alimentam capacidade e custos.
