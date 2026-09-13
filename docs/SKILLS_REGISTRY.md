# Registro de Skills — Alastre Platform

Atualizado em 2026-09-13. O registro é catálogo e governança; não instala recursos pela interface e não concede permissões.

## Formato e escopo

O Codex descobre skills do repositório em `.agents/skills/<id>/SKILL.md`. As skills deste stack são versionadas no projeto para não modificar outros repositórios nem a configuração global. O pedido do usuário e `AGENTS.md` prevalecem sobre qualquer skill.

## Stack ativo

### frontend-design

- **ID/status:** `frontend-design` / `active`
- **Origem:** `anthropics/skills`, commit `34040c9c568585f6929bedeaad110ad08f079624`
- **Licença/caminho:** Apache-2.0 / `.agents/skills/frontend-design`
- **Finalidade:** direção visual para nova interface ou reformulação substancial.
- **Usar / não usar:** usar antes de criar uma linguagem visual; não usar para correção pontual ou polish final.
- **Superfície:** somente `SKILL.md` e `LICENSE.txt`; sem scripts, hooks, dependências, rede ou comandos executáveis.
- **Compatibilidade/invocação:** padrão Agent Skills reconhecido pelo Codex; automática ou manual.
- **Risco:** pode sugerir mudança estética forte; `alastre-product-ux` e a identidade vigente vencem.

### impeccable

- **ID/status:** `impeccable` / `active`
- **Origem:** perfil seguro derivado de `pbakaus/impeccable` 4.3.1, commit `cb56ed6c19a07329a9fa0cd4e657bee040156593`
- **Licença/caminho:** Apache-2.0 / `.agents/skills/impeccable`
- **Finalidade:** revisão final de hierarquia, tipografia, espaçamento, consistência, acessibilidade e responsividade.
- **Usar / não usar:** usar no QA ou finalização; não usar para backend ou para substituir uma direção visual.
- **Superfície upstream:** launcher shell/CMD, binário próprio, JavaScript de navegador, subagente e hook Codex. O launcher pode baixar binário para o perfil do usuário.
- **Configuração Alastre:** somente instruções e licença. Nenhum launcher, binário, subagente ou hook foi instalado; nenhum script externo foi executado.
- **Compatibilidade/invocação:** perfil instruction-only compatível com Codex/Windows; automática ou manual.
- **Risco:** capacidade do engine upstream deliberadamente indisponível em troca de previsibilidade e segurança.

### alastre-product-ux

- **ID/status:** `alastre-product-ux` / `active`
- **Origem/versão:** Alastre Digital / 1.1.0
- **Licença/caminho:** interna / `.agents/skills/alastre-product-ux`
- **Finalidade:** Modo Simples, progressive disclosure de produto, ajuda contextual, legibilidade, navegação, responsividade, ultrawide, temas, acessibilidade e estados humanos.
- **Usar / não usar:** toda interface ou fluxo Alastre; não usar isoladamente para backend.
- **Superfície:** somente Markdown; sem scripts, hooks, dependências ou rede.
- **Compatibilidade/invocação:** Codex nativo; automática.
- **Prioridade:** vence qualquer orientação estética externa conflitante.

As skills internas `alastre-security-review`, `alastre-local-seo` e `alastre-saas-architecture` permanecem `active`, sem scripts ou dependências.

## Candidatas não instaladas

### taste-skill

- **ID/status:** `taste-skill` / `incompatible`
- **Origem:** `Leonxlnx/taste-skill`, commit `ccbc15639c97057cbfcf32ecebc38ef716e4bb37`, MIT.
- **Caminho:** não instalado.
- **Achados:** o arquivo candidato usa o nome interno `design-taste-frontend` e declara explicitamente que não serve para dashboards, tabelas ou produto multi-etapas. Inclui regras que podem solicitar bibliotecas e ferramentas visuais. O repositório possui scripts de manutenção, não executados.
- **Decisão:** incompatível com o núcleo da Alastre Platform. Não será roteada automaticamente.

### progressive-disclosure

- **ID/status:** `progressive-disclosure` / `incompatible`
- **Origem:** `Neeeophytee/finding-unknowns-skills`, commit `6d7dda2a7b6d50db6a0da3a8b7899dea7f2856cd`, MIT.
- **Caminho:** não instalado.
- **Achados:** a skill reorganiza arquivos extensos de instruções em referências condicionais. Não trata disclosure progressivo na interface. O repositório contém scripts de validação/site, não executados; o diretório da skill é somente Markdown.
- **Decisão:** nome compatível, comportamento incorreto para o workflow solicitado. O princípio de produto está incorporado em `alastre-product-ux`.

## QA visual e Playwright

- **Status:** `active` como ferramenta do ambiente, não como skill do projeto.
- O pacote `playwright` e `@playwright/test` não estão instalados no `package.json`/`node_modules` do projeto.
- O Codex desta sessão oferece controle real do navegador para navegação, snapshots e inspeção visual. Ele será reutilizado sem nova dependência.
- A skill Playwright do catálogo OpenAI existe, mas não foi instalada porque não é necessária para este stack.

## Roteamento

1. **Nova interface:** `frontend-design` → `alastre-product-ux` → implementação → QA visual.
2. **Redesign:** `frontend-design` quando substancial → `alastre-product-ux` → implementação → `impeccable`.
3. **Responsividade/ultrawide:** `alastre-product-ux` → QA visual → `impeccable`.
4. **Finalização:** QA visual → `impeccable` → validação direcionada.

## Teste prático: App Shell e ultrawide

Skills aplicadas: `alastre-product-ux` e `impeccable` (perfil seguro). `frontend-design` não foi acionada porque a etapa pediu auditoria, não nova direção. As duas candidatas incompatíveis não foram usadas.

Recomendações de baixo risco, sem alteração visual neste checkpoint:

1. preservar o shell fluido e o modo compacto da sidebar, já adequados à operação;
2. em 2560–3440 px, limitar a largura de blocos de leitura, mas permitir que métricas e filas usem mais colunas;
3. conferir a densidade da navegação completa em 1366 px e manter tooltips no modo compacto;
4. tratar o menu móvel extenso como próximo ponto de evolução, com acesso hierárquico em vez de uma faixa longa;
5. manter Poppins, a identidade roxa, os temas e os estados humanos; não criar uma nova estética neste marco.

## Atualização segura

Antes de atualizar terceiros, repetir auditoria de `SKILL.md`, licença, diff do commit, scripts, hooks, binários, dependências, rede, permissões e compatibilidade. Não ativar hooks ou executar launchers como efeito colateral de uma atualização.

## Stack V1.2 — agentes, segurança, confiança e contexto

Fonte auditada: `Owl-Listener/ai-design-skills`, commit `f41b650435b62dec6d5b1dc3598ac4679f8b7ae7`, licença MIT. O aviso de licença está em `.agents/skills/OWL_LISTENER_LICENSE.txt`. Os 11 diretórios instalados contêm somente `SKILL.md`, sem scripts, hooks, binários, dependências ou rede. O upstream possui `.githooks/pre-commit` e `scripts/build.py` para materializar plugins Claude/Gemini; nenhum foi copiado, ativado ou executado. Todos usam o formato Agent Skills compatível com descoberta Codex e foram adaptados no próprio Markdown, sem código executável.

| ID / nome | Categoria | Path / status / uso | Quando usar / não usar | Risco e adaptação |
| --- | --- | --- | --- | --- |
| `context-window-design` / Context Window Design | Agentes | `.agents/skills/context-window-design` / active / automático | DNA, memória, histórico e recuperação sob demanda / tarefa curta sem contexto acumulado | Privacidade e tenant continuam sob regras Alastre. |
| `conversation-patterns` / Conversation Patterns | Agentes | `.agents/skills/conversation-patterns` / active / automático | Esclarecimento, confirmação, erro, recuperação e handoff / processamento sem conversa | Não deve criar confirmações repetitivas sem risco real. |
| `mixed-initiative-flow` / Mixed Initiative Flow | Segurança | `.agents/skills/mixed-initiative-flow` / active / automático | Ação externa, autonomia e transferência de controle / leitura determinística | Adaptada: proposta, aprovação e execução são estados distintos. |
| `feedback-loops` / Feedback Loops | Agentes | `.agents/skills/feedback-loops` / active / automático | Correção, preferência e aprendizado / evento sem efeito futuro | Adaptada: nenhum aprendizado silencioso em regra crítica; persistência é auditável. |
| `system-prompt-structure` / System Prompt Structure | Agentes | `.agents/skills/system-prompt-structure` / active / automático | Criar ou revisar agente / prompt casual | Adaptada: tenant, dados, efeitos, aprovação e versão explícitos; sem chain-of-thought. |
| `template-design` / Template Design | Agentes | `.agents/skills/template-design` / active / automático | Prompt parametrizado e versionável / instrução sem reuso | Adaptada: variáveis críticas tipadas e falha segura; template não concede permissão. |
| `constraint-specification` / Constraint Specification | Segurança | `.agents/skills/constraint-specification` / active / automático | Regras testáveis, limites e formatos / preferência editorial simples | Adaptada: prompt não substitui RLS, backend, idempotência ou approval gate. |
| `few-shot-patterns` / Few-shot Patterns | Agentes | `.agents/skills/few-shot-patterns` / active / automático | Calibrar saída e edge cases / instrução suficiente | Adaptada: exemplos fictícios ou sanitizados e incapazes de conceder permissão. |
| `guardrail-design` / Guardrail Design | Segurança | `.agents/skills/guardrail-design` / active / automático | Guardrails, recusas e escalonamento / preferência visual | Adaptada: `alastre-security-review` prevalece e escrita externa segue hard-blocked. |
| `trust-calibration` / Trust Calibration | Segurança | `.agents/skills/trust-calibration` / active / automático | Fato, inferência, dado parcial, sugestão e desconhecido / saída determinística | Adaptada: confiança deriva de evidência; N/D não é zero. |
| `transparency-patterns` / Transparency Patterns | Segurança | `.agents/skills/transparency-patterns` / active / automático | Proveniência, limites e estados humanos / detalhe interno sem valor | Adaptada: evidências e resumo decisório, nunca raciocínio privado. |

Para todos os 11 itens: origem, commit e licença são os informados acima; scripts/hooks locais: nenhum; dependências: nenhuma; compatibilidade: Codex nativo instruction-only; risco comum: orientação externa subordinada a `AGENTS.md`, arquitetura vigente e skills internas Alastre.

### Auditada e rejeitada

`chain-of-thought-design` foi auditada no mesmo commit e não foi instalada. Embora o diretório candidato seja somente Markdown e tecnicamente compatível, ele recomenda cadeias explícitas de raciocínio. A Alastre absorve apenas o workflow observável **dados → validações → regras → proposta → evidências → aprovação**, sem solicitar, armazenar ou expor raciocínio interno.

### Skills internas revisadas

- `alastre-security-review` 1.2.0: multi-tenant, `agency_id`/`client_id`, RLS, `service_role` server-side, secrets fora de browser/logs, OAuth state, PKCE, vault, approval gates, write mode, idempotência, auditoria e proteção cross-tenant.
- `alastre-saas-architecture` 1.2.0: monólito modular, Client + DNA, Connection Hub, capabilities, client services, modos gerenciados, custos, aprovações e tokens fora dos módulos.
- `alastre-local-seo` 1.2.0: evidência, source, confidence, N/D, score explicável, LocalRankProvider separado e publicação sempre controlada.

### Workflows automáticos

1. **Criar agente:** System Prompt Structure → Template Design → Few-shot Patterns → Constraint Specification.
2. **Revisar agente:** System Prompt Structure → Constraint Specification → Alastre Security Review quando sensível.
3. **Ação externa segura:** Mixed Initiative Flow → Guardrail Design → Alastre Security Review → aprovação humana.
4. **SEO Local:** Alastre Local SEO → Trust Calibration → Transparency Patterns.
5. **Arquitetura SaaS:** Alastre SaaS Architecture → Alastre Security Review.
6. **Análise com dados parciais:** Trust Calibration → Transparency Patterns.
7. **Feedback e aprendizado:** Feedback Loops → governança e auditoria → revisão humana quando crítica.

### Checkpoint prático somente leitura

- **SEO Local com dados parciais:** `alastre-local-seo` → `trust-calibration` → `transparency-patterns`. Resultado esperado confirmado nas constraints: N/D preservado, sem ranking/score inventado, origem e confiança visíveis.
- **Ação que alteraria serviço externo:** `mixed-initiative-flow` → `guardrail-design` → `alastre-security-review`. Resultado esperado confirmado: proposta permitida, aprovação humana obrigatória e nenhuma execução decorrente do teste.
- **Esqueleto de novo agente:** `system-prompt-structure` → `template-design` → `few-shot-patterns` → `constraint-specification`. Resultado esperado confirmado: identidade, contexto, variáveis, exemplos sanitizados, constraints, versão e saída testável.
- **Arquitetura de nova integração:** `alastre-saas-architecture` → `alastre-security-review`. Resultado esperado confirmado: Connection Hub, tenant isolation, credenciais server-side, validação de IDs, idempotência, auditoria e writes separados.

O teste offline `codex debug prompt-input` confirmou que as 14 skills requeridas são injetadas no catálogo model-visible do Codex. `chain-of-thought-design` não aparece nesse catálogo. A simulação remota foi deliberadamente não realizada porque o revisor de segurança bloqueou o envio de contexto do repositório à API; o checkpoint permaneceu inteiramente local.

## Stack V1.3 — Motion Design

As cinco candidatas foram auditadas e aceitas como perfis adaptados. Nenhuma altera o produto por existir; o roteamento só as aplica quando motion tem função clara.

| ID | Origem / commit / licença | Path / status | Scripts, hooks e dependências | Uso / limites |
| --- | --- | --- | --- | --- |
| `animate` | `emilkowalski/skills` / `d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7` / MIT | `.agents/skills/animate` / active-adapted | Nenhum; `RECIPES.md` é referência Markdown | Implementação solicitada; usa tokens Alastre, CSS primeiro e não anima sem propósito. |
| `find-animation-opportunities` | mesma origem, commit e licença | `.agents/skills/find-animation-opportunities` / active-adapted | Nenhum | Auditoria read-only automática para “tela parada”; máximo cinco oportunidades e rejeições explícitas. |
| `improve-animations` | mesma origem, commit e licença | `.agents/skills/improve-animations` / active-adapted | Nenhum; `AUDIT.md` e `PLAN-TEMPLATE.md` são referências | Na Alastre responde em conversa; não cria planos, não delega e não altera arquivos sem pedido específico. |
| `review-animations` | mesma origem, commit e licença | `.agents/skills/review-animations` / active-adapted | Nenhum; `STANDARDS.md` é referência | Revisão automática somente quando o pedido for de motion; valores internos prevalecem. |
| `design-motion-principles` | `kylezantos/design-motion-principles` / `4a9ca879f24a361f4dca4174fe2da0f67b5ddee3` / MIT | `.agents/skills/design-motion-principles` / active-adapted | Sem scripts/hooks/dependências; referências incluem templates HTML inertes | Perfil Alastre usa relatório Markdown inline, não abre browser/HTML e exclui motion lúdico do dashboard. |
| `alastre-motion-system` | Alastre Digital / 1.0.0 / interna | `.agents/skills/alastre-motion-system` / active | Nenhum | Autoridade para propósito, tokens, reduced motion, performance e padrões por componente. |

Licenças preservadas em `.agents/skills/EMIL_KOWALSKI_SKILLS_LICENSE.txt` e `.agents/skills/KYLE_ZANTOS_MOTION_LICENSE.txt`. Os repositórios auditados não possuem scripts ou hooks dentro das cinco skills. Nenhum comando descrito nas referências, relatório HTML, browser-open, subagente ou instalação de pacote foi executado.

### Tokens conceituais

`alastre-motion-system` define `duration-instant`, `duration-fast`, `duration-normal`, `duration-emphasis`, `easing-standard`, `easing-enter`, `easing-exit` e `easing-emphasized`. Os valores concretos deverão ser centralizados e calibrados no Marco Design V2; componentes não podem criar escalas paralelas.

### Auditoria prática — App Shell e Sidebar

- **Alta prioridade:** o recolhimento da sidebar troca `width` e `margin-left` sem transição coordenada. Uma transição curta, interruptível e baseada nos tokens normal/standard pode explicar a mudança espacial; reduced motion deve ser instantâneo.
- **Média prioridade:** o ícone do toggle muda entre setas sem continuidade. Um crossfade curto por opacity pode confirmar direção sem bounce ou rotação chamativa.
- **Baixa prioridade:** grupos expansíveis mudam conteúdo e sinal `+`/`−` abruptamente. Uma indicação curta de estado pode ajudar, desde que não anime grandes blocos nem atrase navegação.
- **Preservar:** itens da navegação já têm feedback de background/color em 180 ms; adicionar translate/scale em cada item seria excesso.
- **Rejeitado:** transição animada entre todos os módulos. A navegação é frequente e o shell persistente já mantém orientação; motion de página atrasaria leitura.
- **Acessibilidade confirmada:** há fallback global para `prefers-reduced-motion` em `app/globals.css`.

Nenhuma dessas oportunidades foi implementada neste checkpoint; são insumos específicos para o Marco Design V2.
