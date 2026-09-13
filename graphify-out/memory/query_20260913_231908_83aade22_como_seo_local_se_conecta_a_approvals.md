---
type: "query"
date: "2026-09-13T23:19:08.988043+00:00"
question: "Como SEO Local se conecta a approvals?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["PostOperations()", "Approval", "platform_apply_local_seo_approval"]
---

# Q: Como SEO Local se conecta a approvals?

## Answer

Expanded from graph vocabulary: seo, local, approval, approvals, operation, operations, opportunity, post, queue, review. O fluxo usa componentes de operações SEO Local para enviar postagens ao status waiting_approval; approval_items aceita fontes local_seo_post, local_seo_review_response e local_seo_opportunity_action; a decisão humana aplica a transição interna correspondente sem publicação externa.

## Outcome

- Signal: useful

## Source Nodes

- PostOperations()
- Approval
- platform_apply_local_seo_approval