---
name: alastre-motion-system
description: Definir, implementar ou revisar motion e microinterações da Alastre Platform com tokens semânticos, propósito explícito, acessibilidade, performance e contenção visual. Use quando uma interface precisar de animação, continuidade, feedback ou auditoria de movimento; não use para forçar motion em mudanças estáticas.
---

# Alastre Motion System

Motion é infraestrutura de compreensão, não decoração. Só anime para orientar atenção, explicar mudança, conectar origem e destino, confirmar interação ou melhorar a percepção de qualidade. Se nenhum propósito se aplicar, não anime.

## Regras inegociáveis

- Preserve legibilidade, foco, navegação por teclado e conclusão instantânea da ação.
- Respeite `prefers-reduced-motion`; remova deslocamento, zoom, rotação, parallax e loops, mantendo feedback estático ou por opacity/color quando útil.
- Prefira `transform` e `opacity`. Evite layout shift e propriedades que acionem layout/paint sem necessidade.
- Não use movimento constante, glow pulsante, bounce infantil, confetti de rotina, parallax, cyberpunk ou efeitos sobre dados que precisam ser lidos.
- Não instale biblioteca quando CSS ou a ferramenta já presente resolver. Motion nunca concede permissão nem dispara ação externa.
- Centralize durações e curvas; não crie números ou cubic-beziers isolados em componentes.

## Tokens semânticos

Os nomes abaixo são o contrato. Valores concretos devem viver em um único arquivo do design system e ser calibrados visualmente antes de adoção global.

- `duration-instant`: mudança sem percurso perceptível, especialmente teclado e ações muito frequentes.
- `duration-fast`: feedback de press, hover e pequenos controles.
- `duration-normal`: menus, tabs, tooltips e transições usuais de estado.
- `duration-emphasis`: drawer, dialog ou mudança rara que precisa explicar continuidade; continua curta e nunca bloqueia interação.
- `easing-standard`: propriedades contínuas e microfeedback.
- `easing-enter`: entrada responsiva, inicia perceptivelmente e assenta suavemente.
- `easing-exit`: saída mais curta e discreta que a entrada.
- `easing-emphasized`: deslocamento espacial raro e intencional, sem overshoot lúdico.

## Padrões por superfície

- **Page transition:** preserve o shell; use crossfade curto apenas quando a troca abrupta prejudicar orientação. Conteúdo já deve ser interativo.
- **Navigation e tabs:** estado ativo responde imediatamente; indicador pode conectar origem/destino sem animar conteúdo de leitura a cada troca.
- **Sidebar:** expansão/recolhimento explica geometria com transform/opacity; teclado e reduced motion usam mudança instantânea.
- **Cards e metrics:** feedback de press ou atualização de valor, sem hover-scale generalizado e sem contadores performáticos.
- **Buttons:** resposta imediata e sutil; loading não desloca label nem permite clique duplicado.
- **Drawers, dialogs e menus:** origem espacial coerente, backdrop coordenado, foco gerenciado e saída rápida.
- **Tooltips:** primeiro contato pode ser suave; navegação sequencial deve parecer instantânea.
- **Accordion:** revele relação entre controle e conteúdo; não sacrifique leitura nem anime grandes blocos repetidamente.
- **Loading e skeleton:** indique progresso sem pulsação agressiva; preserve dimensões para evitar layout shift.
- **AI processing:** estado calmo, limitado e interrompível; não simule atividade contínua nem certeza.
- **Status e notifications:** confirme mudança uma vez; nunca pulse indefinidamente. Entrada e saída seguem a mesma origem.

## Workflow

1. Resolva hierarquia e UX antes de motion.
2. Classifique frequência e propósito.
3. Reuse tokens e escolha a solução mais barata.
4. Defina estado inicial, ativo, interrompido, saída e reduced motion.
5. Valide teclado, repetição rápida, legibilidade, layout shift e sensação no navegador.

## Saída

Informe propósito, frequência, tokens, propriedades, comportamento reduced-motion e feel-check. Uma recomendação de “não animar” é resultado válido.
