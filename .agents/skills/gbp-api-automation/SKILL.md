---
name: gbp-api-automation
description: Integrar e automatizar chamadas técnicas à Google Business Profile API (Google My Business / Business Information API / Local Posts / Reviews) na Alastre Platform, com mapeamento de endpoints, payloads JSON, tratamento de escopos OAuth e salvaguardas de escrita.
---

# Google Business Profile API Automation

Esta skill orienta a arquitetura técnica, adaptadores e comunicação de backend com a Google Business Profile API na Alastre Platform.

## Escopos OAuth Necessários

- `https://www.googleapis.com/auth/business.manage` (Escopo principal para gerenciamento de contas, locais, postagens e avaliações).

## Estrutura de Endpoints Oficiais

A Google dividiu a antiga Google My Business API v4 em micro-APIs especializadas:

1. **Contas (`My Business Account Management API`)**:
   - `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts`
   - Retorna a lista de contas organizacionais ou contas pessoais vinculadas ao token OAuth.

2. **Informações do Local (`My Business Business Information API`)**:
   - `GET https://mybusinessbusinessinformation.googleapis.com/v1/{parent=accounts/*}/locations`
   - Parâmetros: `readMask=name,title,storeCode,phoneNumbers,websiteUri,regularHours,categories,storefrontAddress,metadata`
   - Retorna os locais (estabelecimentos) cadastrados na conta.

3. **Postagens Locais (`Google My Business API - localPosts`)**:
   - `GET https://mybusiness.googleapis.com/v4/{parent=accounts/*/locations/*}/localPosts`
   - `POST https://mybusiness.googleapis.com/v4/{parent=accounts/*/locations/*}/localPosts`
   - **Payload JSON do LocalPost**:
   ```json
   {
     "languageCode": "pt-BR",
     "summary": "Texto da postagem (150-300 caracteres recomendados)",
     "callToAction": {
       "actionType": "LEARN_MORE",
       "url": "https://meusite.com.br/servico"
     },
     "media": [
       {
         "mediaFormat": "PHOTO",
         "sourceUrl": "https://storage.meusite.com.br/imagem.jpg"
       }
     ],
     "topicType": "STANDARD"
   }
   ```
   - Para Ofertas (`topicType: "OFFER"`):
   ```json
   {
     "topicType": "OFFER",
     "offer": {
       "couponCode": "DESC20",
       "redeemOnlineUrl": "https://meusite.com.br/promocao",
       "termsConditions": "Válido até 30/11/2026."
     }
   }
   ```

4. **Avaliações (`Google My Business API - reviews`)**:
   - `GET https://mybusiness.googleapis.com/v4/{parent=accounts/*/locations/*}/reviews`
   - `PUT https://mybusiness.googleapis.com/v4/{parent=accounts/*/locations/*/reviews/*}/reply`
   - **Payload de Resposta**:
   ```json
   {
     "comment": "Olá [Nome], agradecemos imensamente pela confiança em nossos serviços!"
   }
   ```

## Salvaguardas de Implementação no Alastre Platform

- **Lock de Escrita**: Todas as requisições que alteram dados (`POST`, `PUT`, `DELETE`) devem verificar se `ALASTRE_WRITE_MODE=enabled` no servidor. Por padrão, a plataforma opera com `ALASTRE_WRITE_MODE=disabled`.
- **Validação de Tenant**: Toda chamada deve garantir que a credencial OAuth e o `location_id` pertencem ao cliente ativo.
- **Fail-Safe / Resiliência**: Tokens expirados devem acionar renovação automática via `refresh_token`. Se o refresh token for revogado pelo usuário no Google, sinalizar estado de reconexão necessária (`reconnect: true`).
