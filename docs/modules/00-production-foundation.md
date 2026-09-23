# Módulo 00 Fundação de Produção

## Objetivo

Criar uma base reproduzível, recuperável e verificável para desenvolver e publicar a plataforma sem depender do estado de uma única máquina.

## Estado atual

- O código local está à frente do GitHub e possui muitas alterações não consolidadas.
- Não existe pipeline de GitHub Actions.
- Os scripts oficiais de build e lint pressupõem Bash e utilitários GNU.
- A maior parte dos testes passa, mas a suíte completa ainda apresenta falhas ambientais e de cancelamento no Windows.
- O Supabase de homologação está saudável, com migrations aplicadas e Security Advisor sem alertas.
- Existem Edge Functions remotas que não estão totalmente representadas no repositório.

## Escopo

1. Classificar arquivos locais em código, documentação, evidência, temporário e descarte.
2. Consolidar o estado legítimo do projeto em commits recuperáveis, sem reescrever histórico publicado.
3. Definir Node 22 como runtime oficial de CI e produção.
4. Tornar instalação, TypeScript, lint, testes e build reproduzíveis em ambiente limpo.
5. Criar CI de leitura e validação, sem deploy automático inicial.
6. Corrigir ou isolar de forma justificável testes dependentes de Windows e processos externos.
7. Inventariar Edge Functions locais e remotas e definir uma fonte única de verdade.
8. Documentar homologação, produção, variáveis obrigatórias e responsáveis por segredos.
9. Definir checklist de release, rollback e smoke test.

## Fora de escopo

- Novas funcionalidades de produto.
- Criação de preços ou planos.
- Migração de dados para produção.
- Habilitação de escrita externa.
- Deploy automático antes de o pipeline de validação estar estável.

## Entregas

### 00.1 Higiene e inventário

- Relatório de arquivos versionáveis, temporários e sensíveis.
- `.gitignore` validado.
- Nenhum segredo rastreado.
- Estado local recuperável no GitHub mediante autorização.

### 00.2 Pipeline de qualidade

- Instalação determinística pelo lockfile.
- TypeScript, ESLint, testes e build em CI.
- Artefatos e logs suficientes para diagnosticar falhas.
- Sem dependência implícita de processos já abertos na máquina.

### 00.3 Infraestrutura alinhada

- Inventário de migrations e Edge Functions.
- Diferenças local versus remoto documentadas.
- Procedimento de deploy manual controlado.
- Separação clara entre homologação e futura produção.

### 00.4 Release readiness

- Checklist de variáveis, Auth, domínio, backups, observabilidade e smoke test.
- Critérios objetivos de go ou no go.

## Critérios de aceite

- Um checkout limpo consegue instalar dependências e executar a validação completa.
- CI falha quando TypeScript, lint, testes ou build falham.
- O repositório contém todas as fontes necessárias para reconstruir o aplicativo e suas Edge Functions oficiais.
- Nenhum deploy, migration remota ou escrita externa acontece durante a validação.
- A documentação identifica claramente o que pertence a homologação e a produção.

## Primeiro incremento

Executar apenas o diagnóstico de higiene e reprodutibilidade. Não apagar, mover, commitar, enviar ou publicar nada nessa primeira entrega.
