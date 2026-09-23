# Módulo 03 Onboarding de Clientes

## Objetivo

Converter uma venda aprovada em cliente operacional com acessos, contexto, baseline, responsabilidades e critérios de ativação claros.

## Escopo

- Conferência entre produto aprovado e escopo vendido.
- Criação idempotente de agência, cliente, atores e unidades quando aplicável.
- Coleta de informações, documentos, acessos e consentimentos.
- Connection Hub como porta única para providers.
- Construção e confirmação do DNA.
- Baseline do serviço e diagnóstico inicial.
- Dependências e pendências do cliente.
- Plano de implantação com responsáveis e prazos.
- Critério de ativação e transição para recorrência.

## Regras

- Onboarding não pode criar registros órfãos; operações críticas devem ser transacionais.
- Sucesso visual só pode ser mostrado após persistência confirmada.
- Acesso ausente, provider pendente e dado parcial são estados normais e explícitos.
- Promessa comercial fora do produto bloqueia ativação e exige resolução.

## Critérios de aceite

- O progresso é retomável e auditável.
- Toda pendência possui responsável e prazo.
- O cliente sabe exatamente o que precisa fornecer.
- A operação recebe contexto suficiente sem depender de mensagens informais.
- A ativação ocorre somente quando critérios objetivos forem cumpridos.
