---
name: impeccable
description: Fazer a revisão final, somente por inspeção, de interfaces da Alastre Platform quanto a hierarquia, legibilidade, espaçamento, consistência, responsividade, acessibilidade e acabamento. Use ao finalizar uma tela ou quando o usuário pedir polish, critique ou QA visual. Não usar para backend nem executar launchers ou hooks.
license: Apache-2.0; perfil adaptado de pbakaus/impeccable 4.3.1
metadata:
  upstream-commit: cb56ed6c19a07329a9fa0cd4e657bee040156593
  profile: alastre-instruction-only
---

# Impeccable: perfil seguro Alastre

Este perfil preserva a finalidade de crítica e acabamento do Impeccable, sem seus binários, launchers, subagentes ou hooks. O pedido do usuário e `alastre-product-ux` prevalecem.

## Revisão

1. Entenda o trabalho principal da tela e inspecione a interface real antes de opinar.
2. Avalie hierarquia, ritmo, densidade, alinhamento, contraste, tipografia, linguagem e estados.
3. Verifique desktop, notebook, mobile e ultrawide em passes limitados.
4. Confirme foco visível, teclado, alvos de toque, temas e redução de movimento.
5. Preserve identidade, conteúdo factual, rotas, eventos e comportamento fora do escopo.
6. Diferencie defeito funcional, inconsistência visual e preferência estética.
7. Priorize os poucos ajustes com maior impacto; evite redesenho amplo durante uma revisão final.

## Limites

- Não executar ou baixar o engine Impeccable.
- Não instalar ou habilitar hooks.
- Não criar `.impeccable`, `PRODUCT.md` ou `DESIGN.md` automaticamente.
- Não adicionar dependências, imagens, fontes ou design systems sem necessidade e autorização compatível.
- Não substituir a identidade visual da Alastre por uma estética genérica ou excessivamente experimental.

## Saída

Entregue achados priorizados com evidência visual, impacto e recomendação concreta. Quando a interface estiver adequada, diga isso sem inventar problemas.
