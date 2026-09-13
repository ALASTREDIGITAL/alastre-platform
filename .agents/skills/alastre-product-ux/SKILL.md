---
name: alastre-product-ux
description: Projetar, revisar ou refinar interfaces e fluxos da Alastre Platform com foco em clareza para pessoas não técnicas, Modo Simples, estados confiáveis, responsividade e identidade visual existente. Não usar para tarefas apenas de backend.
---

# Alastre Product UX

## Definição oficial do modo simples

O modo simples mostra somente o que é necessário para a próxima decisão. Não é a mesma tela avançada com alguns campos escondidos. Ele reorganiza a informação para responder rapidamente: onde estou, como está, o que precisa de atenção e o que faço agora.

- Use uma ação dominante quando houver um próximo passo claro.
- Consolide ausência de dados em um único estado honesto e acionável.
- Revele detalhes por progressive disclosure.
- Mantenha IDs, capabilities, resources, bindings, metadados, versões e diagnósticos técnicos exclusivamente no modo avançado.
- Ajuda contextual responde: o que é, por que importa e o que fazer.

1. Leia `docs/PRODUCT_VISION.md` e preserve o design system existente.
2. Comece pela tarefa e decisão que a pessoa precisa concluir, não pela estrutura técnica.
3. Trate o Modo Simples como padrão. Aplique progressive disclosure: mostre primeiro o essencial e revele contexto ou detalhes avançados sob demanda.
4. Use linguagem humana, hierarquia clara, ajuda contextual em funções importantes, alvos de toque confortáveis e texto legível. Nunca reduza fontes apenas para fazer conteúdo caber.
5. Modele carregamento, vazio, parcial, indisponível, erro e sucesso sem fabricar dados.
6. Mostre origem, confiança, limitação e próximo passo quando a IA ou uma integração participar.
7. Preserve contexto ao navegar e não deixe ações parecerem disponíveis quando estão bloqueadas.
8. Mantenha sidebar global simples e use navegação contextual dentro de módulos complexos.
9. Verifique responsividade real em mobile, tablet, notebook, desktop e ultrawide, incluindo 3440 × 1440.
10. Preserve light/dark, acessibilidade e estados humanos; busque acabamento premium e moderno, futurista apenas quando não prejudicar leitura. Conteúdo vence decoração.
11. Valide TypeScript, ESLint direcionado e smoke visual proporcional à mudança.

## Saída esperada

Entregue o fluxo funcional, decisões de UX, estados cobertos e telas recomendadas para revisão.
