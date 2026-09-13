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

## Roteador de skills

Use as skills de `.agents/skills` automaticamente pelo tipo de trabalho; o usuário não precisa citar nomes.

- Nova interface ou reformulação visual substancial: `frontend-design` → `alastre-product-ux` → `alastre-motion-system` somente quando motion tiver função clara.
- Redesign de produto: `frontend-design` quando houver nova direção → `alastre-product-ux` → `find-animation-opportunities` → `improve-animations` → `impeccable`.
- Responsividade, ultrawide, navegação ou UX complexa: `alastre-product-ux` → QA visual → `impeccable`.
- Finalização de tela ou polimento: QA visual → `impeccable`.
- SEO Local, Perfil da Empresa, Local Score, avaliações, postagens ou ranking local: `alastre-local-seo`.
- Arquitetura, SaaS, multi-tenant, contrato de API, persistência ou provider: `alastre-saas-architecture`.
- Integração, IA, dados, permissão, ação externa ou mudança sensível: finalize com `alastre-security-review`.
- Bug, refatoração, domínio, revisão e testes: combine com as skills de engenharia já existentes somente quando o gatilho delas corresponder.

### Agentes, contexto, confiança e ações externas

- Criar agente: `system-prompt-structure` → `template-design` → `few-shot-patterns` → `constraint-specification`.
- Revisar agente: `system-prompt-structure` → `constraint-specification` → `alastre-security-review` quando houver dados, permissões ou efeitos.
- Contexto de IA, memória, DNA ou recuperação sob demanda: `context-window-design`.
- Conversação, esclarecimento, erro, recuperação, confirmação ou handoff: `conversation-patterns`.
- Feedback ou aprendizado: `feedback-loops`; mudanças persistentes em regras críticas exigem governança explícita.
- Ação externa: `mixed-initiative-flow` → `guardrail-design` → `alastre-security-review`.
- Backend ou arquitetura: `alastre-saas-architecture` → `alastre-security-review`.
- SEO Local: `alastre-local-seo` → `trust-calibration` → `transparency-patterns`.
- Dado incerto, parcial ou indisponível: `trust-calibration` → `transparency-patterns`.

Para um agente de SEO Local, combine o fluxo de agentes com `alastre-local-seo`, `trust-calibration` e `transparency-patterns`. `chain-of-thought-design` não está instalada: use somente o workflow observável dados → validações → regras → proposta → evidências → aprovação, sem solicitar, armazenar ou expor raciocínio interno.

### Motion

- Tela percebida como parada ou pedido por oportunidades: `find-animation-opportunities` → `improve-animations` → `alastre-motion-system`.
- Implementar animação solicitada: `alastre-product-ux` → `alastre-motion-system` → `animate`.
- Revisar animações existentes: `review-animations` → `design-motion-principles` → `alastre-motion-system` → `impeccable`.
- Motion entra somente depois de hierarquia, conteúdo e UX estarem resolvidos. Não force as skills de motion em tarefas que não precisam de movimento.
- Toda recomendação respeita `prefers-reduced-motion`, acessibilidade, performance, legibilidade e os tokens semânticos da Alastre. Não use animação constante, glow pulsante, bounce infantil, confetti de rotina ou efeitos gratuitos.

Ordem preferencial:

1. compreender produto e estado atual;
2. aplicar a skill principal do domínio;
3. aplicar arquitetura apenas quando a mudança for estrutural;
4. implementar;
5. aplicar revisão de segurança quando houver dados, IA, integrações ou efeitos externos;
6. validar de forma proporcional.

Se duas skills conflitarem, prevalecem o pedido atual do usuário, estas instruções, as decisões de arquitetura e os controles de segurança, nessa ordem. Não execute scripts, hooks ou instaladores de skills de terceiros sem auditoria e autorização adequadas.

`taste-skill` e a skill externa chamada `progressive-disclosure` não fazem parte do roteamento: a primeira exclui dashboards e produto multi-etapas; a segunda organiza arquivos de instrução, não interfaces. Progressive disclosure de produto é uma regra interna de `alastre-product-ux`. O Impeccable instalado é o perfil Alastre sem launcher, binário ou hooks.
