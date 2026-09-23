---
name: social-media-publisher
description: Estruturar, agendar e orquestrar publicações multicanal (Google Business Profile, Instagram, Facebook, LinkedIn) na Alastre Platform, com adaptação de formato por canal, calendário editorial, validação de regras de mídia e esteira de aprovação.
---

# Social Media Publisher & Multi-Channel Content

Esta skill orienta o planejamento, redação e orquestração de conteúdos para redes sociais e presença local na Alastre Platform, conectando postagens do Google Meu Negócio à estratégia de conteúdo social do cliente.

## Canais Suportados e Particularidades de Formato

1. **Google Business Profile (GBP)**:
   - **Foco**: Intenção de compra local, busca ativa e conversão imediata.
   - **Tamanho recomendado**: 150 a 300 caracteres (máx 1500).
   - **CTAs**: Botão direto ("Saiba mais", "Ligar agora", "Agendar", "Fazer pedido").
   - **Formato de imagem**: 4:3 (ideal 1200x900px).
   - **Regra especial**: Nunca inserir telefone no texto.

2. **Instagram (Feed e Carrossel)**:
   - **Foco**: Visual, autoridade, prova social e engajamento da audiência.
   - **Legenda**: Gancho nas 2 primeiras linhas, estrutura com parágrafos curtos, hashtags estratégicas no final.
   - **Formato de imagem**: 1:1 (quadrado 1080x1080px) ou 4:5 (retrato 1080x1350px).
   - **CTA**: "Comente abaixo", "Envie uma mensagem direta (DM)" ou "Acesse o link na bio".

3. **Facebook**:
   - **Foco**: Compartilhamento, comunidade e links diretos clicáveis.
   - **Legenda**: Permite links clicáveis diretamente no corpo do texto e visualização de rich preview.
   - **Formato de imagem**: 16:9 ou 1:1.

## Calendário Editorial e Cadência Recomendada

- **Postagens de Atualização / Dica**: 1 a 2 vezes por semana.
- **Destaque de Serviço / Caso de Sucesso**: 1 vez a cada 15 dias.
- **Ofertas Especiais / Sazonais**: Início de campanhas ou datas sazonais (Dia das Mães, Black Friday, etc.).
- **Avisos e Horários Especiais**: Imediatamente antes de feriados ou períodos de recesso.

## Esteira de Segurança Alastre

1. **Geração / Criação**: Operador humano ou agente de IA cria a proposta de post com base no DNA do cliente.
2. **Revisão Visual**: O operador visualiza o preview interativo (Google Card vs Feed Social) e valida as regras anti-rejeição.
3. **Submissão para Aprovação**: O conteúdo entra no estado `waiting_approval`.
4. **Validação do Cliente / Gestor**: O gestor aprova o conteúdo na Central de Aprovações.
5. **Pronto para Publicação**: Somente após aprovação formal o conteúdo pode ser despachado (`ready_to_publish`).
