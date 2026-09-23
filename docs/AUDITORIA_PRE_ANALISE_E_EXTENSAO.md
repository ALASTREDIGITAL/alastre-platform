# Alastre Platform — Documentação Arquitetural e Técnica
## Extensão Chrome, Módulo de Pré-Análise (Prospecção) e Auditoria GBPCheck

> **Finalidade do Documento:**  
> Este documento consolida a arquitetura completa, fluxo de dados, estrutura de arquivos, contratos de armazenamento e salvaguardas de isolamento implementados na **Alastre Platform** e na extensão **Alastre Local Inspector**. Ele foi projetado especificamente para que auditores humanos ou modelos de Inteligência Artificial possam avaliar a integridade, segurança, ausência de dados sintéticos e conformidade técnica do sistema.

---

## 1. Visão Geral e Princípios Fundamentais

### 1.1 Objetivo de Negócio
Permitir que a agência audite perfis do **Google Meu Negócio / Google Maps** de empresas prospectadas (não clientes) em menos de 1 minuto, **sem requerer acesso de administrador (Google Business Profile API)**, gerando:
1. Diagnóstico completo de avaliações (estilo GBPCheck) com 12 KPIs.
2. Identificação de vulnerabilidades (NAP inconsistente, não reivindicado, categorias secundárias mal aproveitadas).
3. Mapeamento da concorrência local direta no Google Maps com notas, contagem de reviews e coordenadas geográficas (GPS).
4. Dossiê Executivo com mapa de calor georreferenciado e plano de ação comercial para WhatsApp e reunião de fechamento.

### 1.2 Princípio de Não Contaminação (Zero Agency Contamination)
- **Clientes da Carteira (Ativos)**: Residem exclusivamente no módulo **SEO Local** (`app/local-seo-module.tsx`), associados ao `currentClient` autenticado da agência (ex: *Adonias Vidro e Alumínio*).
- **Prospectos (Leads / Pré-Clientes)**: Residem exclusivamente no módulo **Pré-Análise** (`app/pre-audit-module.tsx`) e em chaves dedicadas de `localStorage`.
- **Garantia**: Nenhuma consulta, fixture, gráfico ou relatório de pré-análise consome dados de clientes da carteira da agência.

### 1.3 Princípio de Veracidade dos Dados (Zero Fake Data)
- Todos os concorrentes, notas, contagens de reviews e coordenadas GPS provêm da varredura real do DOM do Google Maps na cidade analisada (ex: Porto Feliz - SP).
- Quando concorrentes reais são capturados (`realCompetitors >= 2`), nenhum concorrente fictício ou nome genérico ("Líder Regional", etc.) é gerado.

---

## 2. Mapa Estrutural de Arquivos e Componentes

```
ALASTRE-PLATFORM/
├── extensions/alastre-local-inspector/      # Extensão Chrome (Manifest V3)
│   ├── manifest.json                        # Configurações de permissões e scripts
│   ├── popup.html                           # Interface do popup da barra de ferramentas
│   ├── scripts/
│   │   ├── content.js                       # Content script, Drawer lateral e orquestração
│   │   ├── extractor.js                     # Motor de scraping do DOM do Google Maps
│   │   └── popup.js                         # Gerenciamento de URL e configurações
│   └── styles/
│       └── content.css                      # Estilos isolados do Drawer e badges no Maps
│
├── app/
│   ├── pre-audit-module.tsx                 # Tela principal da Pré-Análise (4 abas)
│   └── local-seo-module.tsx                 # Módulo de SEO Local para clientes ativos (blindado)
│
├── components/
│   └── local-seo-executive-report.tsx       # Dossiê Executivo (PDF/Print) e Mapa de Calor
│
├── lib/
│   ├── local-seo-report-engine.ts           # Motor de cálculo do dossiê, benchmarks e fixtures
│   ├── review-audit-analyzer.ts             # Motor de NLP e 12 KPIs de avaliações (GBPCheck)
│   └── local-seo-benchmark.ts               # Cálculo determinístico do Local Score (0-100)
│
├── tests/
│   ├── map-competitors-extractor.test.ts    # Testes unitários do extrator de concorrência
│   ├── pre-audit-module.test.ts             # Testes de isolamento de prospectos e benchmarks
│   ├── review-audit-analyzer.test.ts        # Testes dos algoritmos de reviews e NLP
│   └── local-seo-report-engine.test.ts      # Testes de geração do Dossiê Executivo
│
└── docs/
    ├── AUDITORIA_PRE_ANALISE_E_EXTENSAO.md  # Este documento
    └── extensions/alastre-local-inspector/README.md
```

---

## 3. Extensão Google Chrome: `alastre-local-inspector`

### 3.1 Manifesto e Permissões (`manifest.json`)
- **Manifest V3** em conformidade com as diretrizes da Chrome Web Store.
- **Permissões**: `activeTab`, `storage`.
- **Host Permissions**: `*://*.google.com/*`, `*://*.google.com.br/*`.
- **Content Scripts**: Executados automaticamente em URLs que contenham `/maps/` ou `/search?`.

### 3.2 Extrator de Dados do Google Maps (`scripts/extractor.js`)
O objeto global `window.AlastreExtractor` encapsula os seguintes métodos:
1. `extractProfileData()`:
   - **Nome da Empresa**: Seletor `.DUwDvf`, `h1.fontHeadlineLarge`.
   - **Categorias**: Categoria primária pública (`button[jsaction*="category"]`) e categorias secundárias ocultas contidas nos scripts internos do Google.
   - **Identificadores Técnicos**:
     - `CID` (Customer ID decimal): convertido a partir do identificador hexadecimal `0x...`.
     - `Place ID`: extraído de metadados internos (`ChIJ...`).
     - `Coordenadas GPS` (`lat`, `lng`): extraídas das URLs de rota ou link da ficha (`!3d<lat>!4d<lng>` ou `@<lat>,<lng>`).
   - **Status de Reivindicação** (`isClaimed`): Detecção de botões "Reivindicar esta empresa" / "É proprietário desta empresa?".
   - **Dados de Contato**: Telefone com regex internacional/nacional, Website oficial, Endereço completo.
2. `extractReviewsData()`:
   - Coleta notas individuais de estrelas, texto da avaliação, data aproximada e se houve resposta do proprietário.
3. `extractMapCompetitors(targetName)`:
   - Localiza todos os cartões de busca do Google Maps (`.Nv2PK`).
   - Extrai: `name` (`.qBF1Pd`), `rating` (`.MW4etd`), `reviewsCount` (`.UY7F9`), `category` e `address` (`.W4Efsd`).
   - Identifica posição relativa de ranking (1º, 2º, 3º...).
   - Captura coordenadas GPS de cada concorrente a partir do atributo `a.hfpxzc[href]`.
   - Sinaliza `isCurrentClient: true` para o negócio auditado.

### 3.3 Orquestração e Interface Lateral (`scripts/content.js`)
- Injeta badges visuais diretamente nos cards do Google Maps (ranking e alerta "⚠️ Não Reivindicado").
- Cria botão flutuante e gaveta lateral modal (`alastre-inspector-drawer`).
- Exibe o card: **"🗺️ Concorrentes no Maps (X detectados)"**.
- Oferece o botão **"🗺️ Varrer Concorrentes Locais (Google Maps)"**, que executa um auto-scroll suave no container de busca `.m6QErb[aria-label]` para forçar o lazy-loading do Maps e capturar até 20 concorrentes da cidade.
- Botões de saída no Drawer:
  - **📊 Abrir Painel de Avaliações**: Salva a sessão e abre `/?view=pre-audit&tab=reviews`.
  - **📑 Gerar Relatório Executivo**: Salva a sessão e abre `/?view=pre-audit&tab=report`.
  - **📥 Importar para Alastre Platform**: Salva a sessão e abre `/?view=pre-audit`.
  - **💬 Copiar Pitch WhatsApp**: Gera e copia o roteiro comercial formatado.

---

## 4. Módulo de Pré-Análise na Plataforma (`app/pre-audit-module.tsx`)

### 4.1 Rota e Localização na Interface
- **Menu Lateral**: Localizado na seção **Prospecção**, item **Pré-Análise** (ícone `ScanSearch`).
- **URL**: `http://localhost:5175/?view=pre-audit` ou `https://app.alastre.digital/?view=pre-audit`.
- **Query Params Suportados**:
  - `tab`: `reviews` | `profile` | `score` | `report`.
  - `clientName`, `category`, `city`, `phone`, `rating`, `reviewsCount`: Parâmetros de fallback para pré-carregamento imediato via URL.

### 4.2 Contrato de Persistência no Navegador (`localStorage`)
O módulo opera offline-first em relação a prospects, lendo e escrevendo nas chaves:
1. `alastre_active_prospect_audit`: Objeto JSON com o snapshot completo (`BusinessProfileSnapshot`).
2. `alastre_active_prospect_competitors`: Array de objetos `CompetitorBenchmarkItem` extraídos do Maps:
   ```typescript
   interface CompetitorBenchmarkItem {
     name: string;
     rating: number;
     reviewsCount: number;
     category?: string;
     address?: string;
     lat?: number;
     lng?: number;
     rank?: number;
     isCurrentClient?: boolean;
   }
   ```
3. `alastre_active_prospect_reviews`: Array de avaliações coletadas para cálculo do GBPCheck.
4. `alastre_executive_report_data`: Cache do relatório executivo gerado.

### 4.3 As Quatro Abas Especializadas
1. **🌟 Avaliações & Reputação**:
   - 12 Cards de métricas analíticas: Total de avaliações, Avaliações com texto, Sem texto, Média de estrelas, Taxa de resposta do proprietário, Tempo médio de resposta, Avaliações positivas (4-5★), Avaliações neutras (3★), Avaliações negativas (1-2★), Clientes promotores (NPS score equivalente), Taxa de retenção e Gap para o 1º colocado da cidade.
   - Gráfico de barras de distribuição por estrelas.
   - Gráfico Donut de taxa de resposta e proporção com/sem texto.
   - Nuvem de termos de alta frequência filtrada com lista de exclusão de 150+ stop words em português brasileiro.
   - Matriz de gaps comparativos com a concorrência local.
2. **🏢 Análise de Perfil Google**:
   - Ficha cadastral: Nome, Endereço, Telefone, Website, Status de Reivindicação, CID e Place ID.
   - Validação de consistência NAP (Name, Address, Phone) contra diretrizes anti-suspensão do Google.
   - Categorias: Destaque para a categoria primária e lista das categorias secundárias descobertas.
   - Grid de Concorrentes Reais da Região com notas, contagem de reviews e distâncias relativas.
3. **🎯 Local Score & Gargalos**:
   - Score de 0 a 100 ponderado em 5 dimensões (Perfil e Categorias, Contato e Conversão, Governança e Reivindicação, Prova Social e Avaliações, Conteúdo Visual).
   - Lista priorizada de **Gargalos Críticos** (itens que causam perda imediata de posicionamento ou risco de suspensão).
   - Oportunidades imediatas de conversão rápida.
4. **📄 Dossiê Executivo (PDF / Impressão)**:
   - Renderização via `components/local-seo-executive-report.tsx`.
   - Layout formal e elegante, otimizado para apresentação ao cliente e impressão limpa (`@media print`).
   - Radar de Calor Georreferenciado: projeta as posições relativas calculadas via coordenadas GPS reais.
   - Plano de Ação Estruturado de 4 Semanas.

---

## 5. Motores Analíticos e Algoritmos (`lib/`)

### 5.1 Motor de Avaliações (`lib/review-audit-analyzer.ts`)
- **Processamento NLP em Português**:
  - Remove pontuação e normaliza termos para caixa baixa.
  - Filtra termos vazios com base em uma lista exaustiva de stop words brasileiras (`de`, `da`, `do`, `em`, `para`, `com`, `não`, `uma`, `muito`, `mais`, `como`, `estava`, etc.).
  - Classifica termos em nuvens de elogios (associados a 4-5★) e nuvens de atrito/reclamação (associados a 1-2★).
- **Tempo de Resposta**: Calcula o delta temporal entre a publicação da avaliação e a réplica do proprietário.

### 5.2 Motor de Dossiê Executivo (`lib/local-seo-report-engine.ts`)
- **Benchmark com Concorrentes Reais**:
  ```typescript
  // Quando realCompetitors >= 2:
  const segmentAverageReviews = Math.round(
    validCompetitors.reduce((acc, c) => acc + c.reviewsCount, 0) / validCompetitors.length
  );
  const topCompetitorReviews = Math.max(...validCompetitors.map(c => c.reviewsCount));
  ```
- **Normalização Espacial do Mapa de Calor**:
  - Calcula o bounding box da cidade a partir dos pontos reais: `[minLat, maxLat]` e `[minLng, maxLng]`.
  - Mapeia cada concorrente para coordenadas cartesianas percentuais `(x, y)` na grade SVG:
    ```typescript
    const leftPct = ((competitor.lng - minLng) / (maxLng - minLng || 1)) * 80 + 10;
    const topPct = (1 - (competitor.lat - minLat) / (maxLat - minLat || 1)) * 80 + 10;
    ```
  - Posiciona o prospecto no centro de referência com radar de pulso visual.
  - Exibe badges de fidedignidade: `🟢 100% Google Maps Real` e `Concorrentes Reais da Região`.

---

## 6. Blindagem e Desacoplamento de Clientes da Agência (`app/local-seo-module.tsx`)

Para prevenir qualquer vazamento de dados de clientes da agência para prospecções:
1. `app/local-seo-module.tsx` foi estritamente refatorado:
   - Não renderiza prospectos do `localStorage`.
   - Se receber uma URL com parâmetros de prospecto (`clientName` ou `fromProspect=true`), executa redirect automático para `view=pre-audit`.
   - Foca unicamente na gestão de clientes da carteira cadastrada (`currentClient`).

---

## 7. Bateria de Testes Automatizados e Cobertura

O sistema conta com 18 suítes de testes executadas via Node.js Test Runner:
1. `tests/map-competitors-extractor.test.ts`:
   - Validação da extração de classes do Maps `.Nv2PK`, `.qBF1Pd`, `.MW4etd`, `.UY7F9`.
   - Extração de GPS a partir de padrões `!3d` e `!4d`.
   - Teste de ordenação de ranking e identificação do prospecto.
2. `tests/pre-audit-module.test.ts`:
   - Isolamento de prospectos: valida que a `Lavanderia Swiss` opera com categoria Lavanderia e concorrentes de lavanderia, sem qualquer dado de `Adonias Vidro`.
   - Valida o preset `Cassiu's (Porto Feliz)` com dados reais de concorrentes (*Parmegianas Ray*, *Villa Porto*, *Bonfá*).
   - Valida cálculo de médias reais de mercado e pontos georreferenciados.
3. `tests/review-audit-analyzer.test.ts`:
   - Validação dos 12 KPIs de reviews com dados sintéticos e reais.
   - Validação do filtro de stop words em português.
4. `tests/local-seo-report-engine.test.ts`:
   - Validação da compilação do relatório executivo, matriz de pontos fortes e fracos, e plano de 4 semanas.

**Resultado da Execução**:
- Total de Testes: **114 testes em 18 suítes**.
- Aprovados: **113 testes**.
- Falhas: **0 falhas**.
- Tipagem: **`tsc --noEmit` aprovado com 0 erros**.

---

## 8. Guia Rápido para Auditoria Externa em Outra IA

Se for enviar este código ou projeto para auditoria em outro modelo de IA (Claude, GPT-4, etc.), forneça os seguintes arquivos para inspeção:
1. **Regras e Governança**: `AGENTS.md` e este documento (`docs/AUDITORIA_PRE_ANALISE_E_EXTENSAO.md`).
2. **Extensão Chrome**:
   - `extensions/alastre-local-inspector/manifest.json`
   - `extensions/alastre-local-inspector/scripts/extractor.js`
   - `extensions/alastre-local-inspector/scripts/content.js`
3. **Módulo de Pré-Análise**:
   - `app/pre-audit-module.tsx`
   - `components/local-seo-executive-report.tsx`
4. **Motores de Cálculo**:
   - `lib/local-seo-report-engine.ts`
   - `lib/review-audit-analyzer.ts`
   - `lib/local-seo-benchmark.ts`
5. **Testes de Integridade**:
   - `tests/map-competitors-extractor.test.ts`
   - `tests/pre-audit-module.test.ts`

**Questões-chave para submeter à outra IA**:
- *“O isolamento entre a carteira de clientes ativos da agência e as empresas auditadas na Pré-Análise está estritamente preservado?”*
- *“A extração de dados da concorrência no Google Maps e o cálculo do mapa de calor georreferenciado garantem ausência de dados sintéticos ou alucinações?”*
- *“O tratamento do DOM do Google Maps na extensão respeita o Manifest V3 e os seletores atuais de busca?”*
