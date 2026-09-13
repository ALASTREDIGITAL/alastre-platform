# Alastre Platform — Design System V2

## Direção

O sistema visual é um **console operacional editorial**: sóbrio, preciso e humano. Grafite organiza o ambiente; branco e superfícies neutras sustentam leitura; roxo identifica decisões, seleção e inteligência. O produto evita brilho decorativo, excesso de gradientes e cartões com o mesmo peso.

## Tipografia

Comparação feita no contexto de Central de Operações, Clientes, Cliente 360, SEO Local, Google Ads, Connection Hub e Skills:

| Família | Leitura operacional | Números | Personalidade | Decisão |
| --- | --- | --- | --- | --- |
| Geist | Excelente | Excelente | Tecnológica, porém neutra | Não escolhida |
| Inter | Excelente | Excelente | Familiar e genérica | Não escolhida |
| Manrope | Excelente | Excelente | Precisa, contemporânea e própria | **Escolhida** |

Manrope Variable é a família única. Pesos entre 500 e 760 criam hierarquia sem trocar de fonte. A escala parte de 12 px para metadados, 13 px para controles, 14 px para texto secundário, 15 px para corpo, 19 px para seções e títulos fluidos entre 28 e 58 px.

## Tokens

- Espaçamento: base de 4 px; controles entre 40 e 44 px; painéis com 16–24 px; seções com 24–48 px.
- Raios: 10 px em controles e 14 px em painéis. Pílulas ficam restritas a estados curtos.
- Bordas: neutras e discretas. Sombras em três níveis (`xs`, `sm`, `md`) explicam elevação, sem decorar.
- Superfícies: canvas, superfície primária, superfície secundária e superfície elevada, equivalentes nos temas claro e escuro.
- Cores: roxo para seleção/ação, verde para confirmação, âmbar para atenção e vermelho para bloqueio ou erro.
- Foco: contorno sólido de 2 px com afastamento de 3 px, sempre visível por teclado.

## Shell, sidebar e ultrawide

A sidebar tem 264 px no desktop, 76 px recolhida e 288 px em telas muito largas. O workspace acompanha a mesma geometria sem sobreposição. O modo compacto preserva ícones e tooltips nativos. No mobile, a navegação contextual permanece horizontal e rolável, com alvos de toque de pelo menos 40 px.

O conteúdo usa largura fluida com limite de 1800 px, chegando a 2440 px no ultrawide. Grades crescem por função — quatro métricas, três ou quatro áreas operacionais — em vez de simplesmente esticar texto. Linhas de leitura permanecem limitadas a aproximadamente 68 caracteres.

## Motion

Motion serve a feedback, estado ou continuidade. Tokens semânticos: `instant` 80 ms, `fast` 140 ms, `normal` 200 ms e `emphasis` 260 ms; curvas `standard`, `enter`, `exit` e `emphasized` ficam centralizadas.

Aplicações atuais: feedback de pressão e crossfade do ícone de recolher/expandir. Navegação entre módulos é instantânea. Cartões não sobem em massa, listas não entram em cascata e indicadores não pulsam. `prefers-reduced-motion` remove deslocamento e mantém estados finais legíveis.

## Padrões de produto

- Cabeçalho: contexto, título, descrição curta e ações agrupadas.
- Painel: uma responsabilidade por superfície, título curto e próximo passo explícito.
- Métrica: rótulo, valor tabular e interpretação; sem números decorativos.
- Estado vazio/indisponível: explica o estado, preserva o contexto e oferece ação apenas quando funcional.
- Botões: primário para a próxima decisão; secundário para alternativas; desabilitado comunica indisponibilidade real.
- Dados e IA: origem, confiança, limitação e proteção de escrita devem permanecer visíveis.
