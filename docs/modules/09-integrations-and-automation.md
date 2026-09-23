# Módulo 09 Integrações e Automação

## Objetivo

Conectar providers e automatizar rotinas comprovadas sem comprometer segurança, controle humano ou reconstrução da operação.

## Escopo

- OAuth e capabilities por provider.
- Descoberta e binding de recursos.
- Sincronização incremental e health.
- Filas, idempotência, timeout, retentativa e dead letter.
- Execução externa após aprovação.
- Verificação pós execução.
- Alertas e degradação segura.
- Custos e limites de IA.
- Rollback ou compensação quando suportados.

## Reutilização obrigatória

- Connection Hub e CredentialStore.
- Vault para credenciais.
- Motor de operações.
- Aprovações, auditoria, evidências e write mode.

## Regras

- Integração indisponível não pode bloquear a navegação do restante do produto.
- Tokens nunca entram em tabelas ou respostas públicas.
- Consentimento deve ser incremental por capability.
- Toda escrita externa deve ser idempotente, aprovada, auditada e verificada.
- Automação só substitui um fluxo manual já compreendido e mensurável.

## Critérios de aceite

- Revogação, expiração, ausência de permissão e indisponibilidade são tratadas com segurança.
- Uma execução pode ser relacionada à aprovação, atividade, ator e evidência.
- Falhas não produzem sucesso aparente nem repetição perigosa.
- O provider pode ser substituído sem reescrever o domínio funcional.
