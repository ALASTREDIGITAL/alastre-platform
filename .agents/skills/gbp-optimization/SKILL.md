---
name: gbp-optimization
description: Otimizar e auditar perfis de empresas no Google (Google Business Profile - GBP) na Alastre Platform, cobrindo categorização primária e secundária, completude de dados, atributos, consistência NAP, regras anti-suspensão e fatores de ranqueamento no Local Pack.
---

# Google Business Profile Optimization (GBP)

Esta skill orienta a auditoria e otimização de perfis de empresas no Google Meu Negócio / Google Business Profile (GBP), garantindo que os clientes da Alastre Platform alcancem a máxima visibilidade no Local Pack e no Google Maps.

## Governança Alastre

- **Isolamento por tenant**: Todas as configurações de perfil pertencem estritamente ao cliente/tenant ativo.
- **Modo Somente Leitura**: Modificações no perfil externo exigem aprovação humana e autorização expressa (`ALASTRE_WRITE_MODE=disabled` por padrão).
- **Sem falsas promessas de ranking**: Nunca garantir #1 no Google. O ranking depende de relevância, distância e proeminência calculados pelo algoritmo do Google.

## Fatores Críticos de Ranqueamento (Local Pack)

1. **Categoria Primária (Fator #1 de Relevância)**:
   - A categoria primária possui o maior peso de ranqueamento direto em pesquisas locais.
   - Deve representar a atividade principal do negócio (ex.: "Dentista", "Advogado trabalhista", "Restaurante italiano").
   - Categorias secundárias (até 9 adicionais) capturam serviços complementares, mas não substituem a primária.

2. **Integridade do Nome Comercial (Prevenção de Suspensão)**:
   - O nome no Google Business Profile DEVE corresponder estritamente ao nome comercial real da empresa (como consta na fachada, site e registros).
   - **PROIBIDO**: Adicionar palavras-chave, cidades ou qualificadores no nome (ex.: "Clínica Sorriso - O melhor Dentista em Campinas"). O algoritmo do Google suspende perfis com keyword stuffing no nome.

3. **Endereço e Área de Cobertura (SAB vs Loja Física)**:
   - Empresas com atendimento no local: endereço físico visível e consistente.
   - Empresas de área de cobertura (Service Area Businesses - SAB, ex.: encanador, eletricista que vai até o cliente): ocultar endereço residencial e definir raios ou cidades atendidas.
   - Consistência NAP (Name, Address, Phone): endereço idêntico ao do site oficial e diretórios locais.

4. **Horários de Funcionamento**:
   - Horários regulares precisos.
   - Horários especiais configurados para feriados e datas comemorativas (evita avaliações negativas por clientes que encontram o local fechado).

5. **Descrição Comercial (Até 750 caracteres)**:
   - Focar nos primeiros 250 caracteres (área visível sem expansão).
   - Incluir proposição de valor única, diferenciais do DNA da empresa e principais serviços de forma natural.
   - Não incluir links nem números de telefone na descrição (o Google proíbe).

6. **Atributos do Perfil**:
   - Preencher atributos aplicáveis (acessibilidade para cadeirantes, métodos de pagamento aceitos, wi-fi, estacionamento).
   - Atributos respondem a filtros diretos de usuários no Google Maps.

7. **Fotos e Mídia Visual**:
   - Fotos reais e profissionais: logotipo (1:1), foto de capa (16:9), fachada/exterior (essencial para clientes localizarem a entrada), interior e equipe.
   - Evitar fotos genéricas de banco de imagens (stock photos), que reduzem a conversão e podem ser reprovadas.

8. **Catálogo de Serviços e Produtos**:
   - Cadastrar os principais serviços detalhados com descrição e faixa de preço quando aplicável.
   - Ajuda na correspondência com pesquisas long-tail no Google.
