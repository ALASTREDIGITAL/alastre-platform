# Instruções de trabalho — Alastre Platform

## Contexto obrigatório

Antes de iniciar uma tarefa, leia nesta ordem:

1. `AGENTS.md`;
2. `docs/PRODUCT_VISION.md`;
3. `docs/ROADMAP.md`;
4. `docs/PROJECT_STATUS.md`;
5. somente então, os arquivos diretamente relacionados à tarefa.

Consulte `docs/ARCHITECTURE_DECISIONS.md` quando a mudança envolver arquitetura, integrações, dados, segurança ou decisões de produto. Não reanalise o repositório inteiro a cada tarefa e preserve a documentação técnica existente.

## Forma de trabalho

- Trabalhe com autonomia dentro do escopo solicitado e avance por macroetapas.
- Não peça confirmação para componentes, código local, correções, UX/UI, tipos, helpers, reorganizações, documentação ou validações locais não destrutivas.
- Reutilize contexto, padrões e componentes existentes.
- Não implemente escopo adicional sem solicitação.
- Evite documentação redundante e respostas extensas.
- Não interrompa a execução entre arquivos relacionados, salvo bloqueio ou risco real.

Peça autorização somente antes de:

- habilitar escrita externa;
- publicar ou ativar recursos em Google ou Meta;
- ativar campanhas ou alterar orçamentos;
- executar migration remota ou modificar migration já aplicada;
- realizar alteração destrutiva em banco ou excluir dados;
- alterar segredos ou rotacionar credenciais;
- fazer deploy de produção;
- tomar decisão de negócio ainda não documentada.

## Segurança

- Manter `ALASTRE_WRITE_MODE=disabled` até autorização explícita.
- Nunca expor segredos nem publicar automaticamente.
- Supabase autorizado para este projeto: **Alastre Platform Homologação**, project ref `fifbtwbndutbvwnbzgtz`.
- Nunca misturar o Supabase Gol de Placa neste projeto.
- Não misturar `project-lumina` e `alastre-platform` sem plano explícito.
- Não fazer push ou deploy automaticamente durante iteração visual.
- Não criar branches desnecessárias nem reescrever histórico publicado.

## Validação

Durante desenvolvimento visual e funcional, prefira TypeScript da área, ESLint direcionado, smoke test local, navegação visual e verificações específicas. Execute build, lint e suíte completos somente ao concluir marco importante, antes de deploy, antes de push importante solicitado ou quando uma mudança estrutural justificar.

Não repita uma validação recém-aprovada se o código relacionado não mudou.

## Entrega

Em cada macroetapa:

1. entenda o estado atual;
2. defina o plano internamente;
3. implemente os itens relacionados;
4. corrija erros encontrados;
5. valide apenas o necessário;
6. deixe a interface navegável;
7. apresente resumo conciso.

O resumo final deve informar somente o que foi implementado, áreas principais alteradas, validações realizadas, riscos ou pendências reais e a próxima macroetapa recomendada.
